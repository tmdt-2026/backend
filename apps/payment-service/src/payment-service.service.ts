import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import moment from 'moment';
import * as qs from 'qs';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentPublisher } from './publishers/payment.publisher';
import { CreatePaymentDto } from '../dto/create-payment.dto';

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

  async createPaymentUrl(dto: CreatePaymentDto, ipAddress: string) {
    const { amount, orderId, paymentMethod, description, returnUrl: clientReturnUrl } = dto;

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    let vnpUrl = process.env.VNP_URL;
    const returnUrl = clientReturnUrl || process.env.VNP_RETURN_URL;

    const createDate = moment().format('YYYYMMDDHHmmss');
    const now = new Date();

    const payment = await this.prisma.payment.create({
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

  async getTransaction(transactionId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: transactionId },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy giao dịch thanh toán.',
      });
    }

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

  async updatePaymentStatus(query: any) {
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
    const orderResponse = await axios.get(`${this.orderServiceUrl}/orders/${orderId}`, {
      headers: { 'X-Service-Token': this.internalServiceToken },
    });
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
