import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import moment from 'moment';
import * as qs from 'qs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  async createPaymentUrl(amount: number, orderId: string, ipAddress: string) {
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    let vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const createDate = moment().format('YYYYMMDDHHmmss');

    // FIX: Đảm bảo trường trong DB khớp (order_id hay orderId)
    // Dựa trên lỗi trước, tôi dùng 'order_id'. Nếu schema bạn dùng 'orderId', hãy sửa lại chữ này.
    await this.prisma.payment.create({
      data: {
        orderId: orderId, // Đảm bảo ID gửi từ HTML đủ 36 ký tự hoặc sửa Schema thành VarChar(255)
        amount: amount,
        paymentMethod: 'vnpay', // Phải khớp với Enum PaymentMethod trong Schema
        status: 'pending', // Phải khớp với Enum PaymentStatus
      },
    });

    let vnp_Params: any = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100; // VNPAY đơn vị là đồng * 100
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

    return vnpUrl;
  }

  async updatePaymentStatus(query: any) {
    const orderId = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionNo = query['vnp_TransactionNo'];

    // FIX: Chuyển về chữ thường để khớp Enum PaymentStatus
    const statusValue = responseCode === '00' ? 'success' : 'failed';

    return await this.prisma.payment.update({
      where: { orderId: orderId },
      data: {
        status: statusValue,
        transactionCode: transactionNo,
        providerResponse: JSON.stringify(query),
        paidAt: responseCode === '00' ? new Date() : null,
      },
    });
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
