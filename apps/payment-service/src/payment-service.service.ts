import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import moment from 'moment';
import * as qs from 'qs';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentPublisher } from './publishers/payment.publisher';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { UserPayload } from './common/decorators/current-user.decorator';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  // Internal URLs must include the /api/v1 global prefix set in each service's main.ts
  private readonly orderServiceUrl = `${process.env.ORDER_SERVICE_URL ?? 'http://order-service:3005'}/api/v1`;
  private readonly userServiceUrl = `${process.env.USER_SERVICE_URL ?? 'http://user-service:3001'}/api/v1`;
  private readonly internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN ?? 'internal-secret-token-change-in-production';
  private readonly frontendBaseUrl = process.env.FRONTEND_URL ?? process.env.APP_URL ?? 'http://localhost:3000';

  constructor(
    private prisma: PrismaService,
    private readonly publisher: PaymentPublisher,
  ) {}

  private isPrivileged(user: UserPayload) {
    return user.roles?.includes('admin') || user.roles?.includes('staff');
  }

  private sortAndSerializeVnpayParams(params: Record<string, string>) {
    return Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`)
      .join('&');
  }

  async createPaymentUrl(dto: CreatePaymentDto, ipAddress: string) {
    const { amount, orderId, paymentMethod, description, returnUrl: clientReturnUrl } = dto;
    if (!Number.isFinite(amount) || Number(amount) <= 0) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    }

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    let vnpUrl = process.env.VNP_URL;
    const returnUrl = clientReturnUrl || process.env.VNP_RETURN_URL;

    const createDate = moment().format('YYYYMMDDHHmmss');
    const now = new Date();

    const existingPayment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (existingPayment?.status === 'success') {
      throw new BadRequestException('Đơn hàng này đã thanh toán thành công');
    }

    const payment = existingPayment
      ? await this.prisma.payment.update({
          where: { orderId },
          data: {
            amount,
            paymentMethod: paymentMethod ?? 'vnpay',
            status: 'pending',
            transactionCode: null,
            paidAt: null,
          },
        })
      : await this.prisma.payment.create({
          data: {
            orderId,
            amount,
            paymentMethod: paymentMethod ?? 'vnpay',
            status: 'pending',
          },
        });

    let vnp_Params: any = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = description || ('Thanh toan don hang:' + orderId);
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddress;
    vnp_Params['vnp_CreateDate'] = createDate;
    vnp_Params['vnp_BankCode'] = 'NCB';

    vnp_Params = this.sortObject(vnp_Params);
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    // Response shape matches API docs: paymentUrl (not url)
    return {
      paymentUrl: vnpUrl,
      transactionId: payment.id,
      orderId,
      amount,
      paymentMethod: payment.paymentMethod,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    };
  }

  async getTransaction(transactionId: string, requester: UserPayload) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: transactionId },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy giao dịch thanh toán.',
      });
    }

    await this.assertPaymentAccess(payment.orderId, requester);

    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionCode: (payment as any).transactionCode ?? null,
      paidAt: (payment as any).paidAt ?? null,
      createdAt: (payment as any).createdAt,
      updatedAt: (payment as any).updatedAt,
    };
  }

  async getTransactionByOrderId(orderId: string, requester: UserPayload) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy giao dịch thanh toán.',
      });
    }
    await this.assertPaymentAccess(orderId, requester);
    return this.getTransaction(payment.id, requester);
  }

  async retryPaymentUrl(orderId: string, requester: UserPayload, ipAddress: string, returnUrl?: string) {
    await this.assertPaymentAccess(orderId, requester);

    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (payment?.status === 'success') {
      throw new BadRequestException('Đơn hàng này đã thanh toán thành công');
    }

    const amount = payment ? Number(payment.amount) : await this.getOrderAmount(orderId);
    return this.createPaymentUrl(
      {
        orderId,
        amount,
        paymentMethod: 'vnpay',
        description: `Thanh toán lại đơn hàng ${orderId}`,
        returnUrl,
      },
      ipAddress,
    );
  }

  async listTransactions(status?: string, orderId?: string) {
    const transactions = await this.prisma.payment.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(orderId ? { orderId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionCode: payment.transactionCode ?? null,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));
  }

  async updatePaymentStatus(query: any) {
    const isValid = this.verifyVnpaySignature(query);
    if (!isValid) {
      throw new BadRequestException('Chữ ký VNPay không hợp lệ');
    }

    const orderId = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionNo = query['vnp_TransactionNo'];

    // FIX: Chuyển về chữ thường để khớp Enum PaymentStatus
    const statusValue = responseCode === '00' ? 'success' : 'failed';

    const updatedPayment = await this.prisma.payment.update({
      where: { orderId: orderId },
      data: {
        status: statusValue,
        transactionCode: transactionNo,
        providerResponse: JSON.stringify(query),
        paidAt: responseCode === '00' ? new Date() : null,
      },
    });

    try {
      const notificationPayload = await this.buildPaymentNotificationPayload(orderId, updatedPayment, query);

      if (statusValue === 'success') {
        await this.publisher.publishPaymentSuccess(notificationPayload.success);
      } else {
        await this.publisher.publishPaymentFailed(notificationPayload.failed);
      }
    } catch (error: any) {
      this.logger.warn(`Payment notification publish skipped for ${orderId}: ${error.message}`);
    }

    return updatedPayment;
  }

  private async buildPaymentNotificationPayload(orderId: string, payment: any, query: any) {
    const orderResponse = await axios.get(`${this.orderServiceUrl}/orders/internal/${orderId}?token=${encodeURIComponent(this.internalServiceToken)}`);
    const order = orderResponse.data?.data ?? orderResponse.data;
    const userProfile = await this.getUserProfile(order.user_id);

    const amount = Number(payment.amount ?? (Number(query['vnp_Amount'] ?? 0) / 100)).toFixed(2);
    const paidAt = payment.paidAt ? new Date(payment.paidAt).toISOString() : new Date().toISOString();

    return {
      success: {
        orderId,
        orderCode: orderId,
        userEmail: userProfile.userEmail,
        userName: userProfile.userName,
        amount,
        paymentMethod: payment.paymentMethod,
        transactionCode: payment.transactionCode ?? query['vnp_TransactionNo'] ?? '',
        paidAt,
        receiptUrl: this.buildFrontendUrl(`/orders/${orderId}/receipt`),
      },
      failed: {
        orderId,
        orderCode: orderId,
        userEmail: userProfile.userEmail,
        userName: userProfile.userName,
        amount,
        failReason: this.getFailReason(query['vnp_ResponseCode']),
        retryUrl: this.buildFrontendUrl(`/orders/${orderId}/payment`),
      },
    };
  }

  private async getUserProfile(userId: string): Promise<{ userEmail: string; userName: string }> {
    try {
      const response = await axios.get(`${this.userServiceUrl}/internal/users/${userId}`, {
        headers: {
          'X-Service-Token': this.internalServiceToken,
        },
      });

      const user = response.data?.data ?? response.data;

      return {
        userEmail: user.email ?? '',
        userName: user.userName ?? user.fullName ?? 'Khách hàng',
      };
    } catch {
      return {
        userEmail: '',
        userName: 'Khách hàng',
      };
    }
  }

  private buildFrontendUrl(path: string): string {
    return `${this.frontendBaseUrl.replace(/\/$/, '')}${path}`;
  }

  private getFailReason(responseCode: unknown): string {
    if (responseCode === '00') {
      return 'Thanh toán thành công';
    }

    return `Thanh toán thất bại (${String(responseCode ?? 'unknown')})`;
  }

  private verifyVnpaySignature(query: Record<string, unknown>) {
    const secureHash = String(query.vnp_SecureHash ?? '');
    if (!secureHash) {
      return false;
    }

    const secretKey = process.env.VNP_HASH_SECRET ?? '';
    if (!secretKey) {
      return false;
    }

    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key === 'vnp_SecureHash' || key === 'vnp_SecureHashType') {
        continue;
      }
      if (typeof value === 'string') {
        params[key] = value;
      }
    }

    const signData = this.sortAndSerializeVnpayParams(params);
    const hmac = crypto.createHmac('sha512', secretKey);
    const calculated = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    return calculated === secureHash;
  }

  private async assertPaymentAccess(orderId: string, requester: UserPayload) {
    if (this.isPrivileged(requester)) {
      return;
    }
    const ownerId = await this.getOrderOwnerId(orderId);
    if (!ownerId || ownerId !== requester.userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập giao dịch này');
    }
  }

  private async getOrderOwnerId(orderId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.orderServiceUrl}/orders/internal/${orderId}?token=${encodeURIComponent(this.internalServiceToken)}`,
      );
      const order = response.data?.data ?? response.data;
      return order?.user_id ?? order?.userId ?? null;
    } catch {
      return null;
    }
  }

  private async getOrderAmount(orderId: string): Promise<number> {
    const response = await axios.get(
      `${this.orderServiceUrl}/orders/internal/${orderId}?token=${encodeURIComponent(this.internalServiceToken)}`,
    );
    const order = response.data?.data ?? response.data;
    const amount = Number(order?.final_amount ?? order?.total_price ?? order?.total_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Không thể xác định số tiền đơn hàng để thanh toán lại');
    }
    return amount;
  }

  private sortObject(obj: any) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
  }
}
