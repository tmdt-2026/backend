import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { OrderServiceUnavailableException } from '../common/exceptions/review.exceptions';

export interface OrderRpcResponse {
  id: string;
  userId: string;
  status: string;
  items: Array<{
    productVariantId: string;
    productId: string;
    productName: string;
  }>;
}

@Injectable()
export class OrderRpc {
  private readonly logger = new Logger(OrderRpc.name);
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('rpc.orderServiceUrl')!;
    this.serviceToken = config.get<string>('rpc.serviceToken')!;
    this.timeout = config.get<number>('rpc.timeoutMs')!;
  }

  async getOrderById(orderId: string): Promise<OrderRpcResponse | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<OrderRpcResponse>(
          `${this.baseUrl}/api/internal/orders/${orderId}`,
          {
            headers: { 'X-Service-Token': this.serviceToken },
            timeout: this.timeout,
          },
        ),
      );
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      this.logger.error(`Order Service error: ${err.message}`);
      throw new OrderServiceUnavailableException();
    }
  }
}
