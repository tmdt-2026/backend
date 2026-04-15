import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ProductServiceUnavailableException } from '../common/exceptions/review.exceptions';

export interface ProductRpcResponse {
  id: string;
  name: string;
}

@Injectable()
export class ProductRpc {
  private readonly logger = new Logger(ProductRpc.name);
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('rpc.productServiceUrl')!;
    this.serviceToken = config.get<string>('rpc.serviceToken')!;
    this.timeout = config.get<number>('rpc.timeoutMs')!;
  }

  async getProductById(productId: string): Promise<ProductRpcResponse | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<ProductRpcResponse>(
          `${this.baseUrl}/api/internal/products/${productId}`,
          {
            headers: { 'X-Service-Token': this.serviceToken },
            timeout: this.timeout,
          },
        ),
      );
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      this.logger.error(`Product Service error: ${err.message}`);
      throw new ProductServiceUnavailableException();
    }
  }
}
