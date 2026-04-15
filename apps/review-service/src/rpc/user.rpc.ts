import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface UserRpcResponse {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  detail?: {
    fullName?: string;
    avatarUrl?: string;
  };
  avatarUrl?: string;
}

@Injectable()
export class UserRpc {
  private readonly logger = new Logger(UserRpc.name);
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('rpc.userServiceUrl')!;
    this.serviceToken = config.get<string>('rpc.serviceToken')!;
    this.timeout = config.get<number>('rpc.timeoutMs')!;
  }

  async getUserById(userId: string): Promise<UserRpcResponse | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<any>(
          `${this.baseUrl}/api/internal/users/${userId}`,
          {
            headers: { 'X-Service-Token': this.serviceToken },
            timeout: this.timeout,
          },
        ),
      );
      return res.data?.data ?? res.data;
    } catch (err: any) {
      this.logger.warn(`Could not fetch user ${userId}: ${err.message}`);
      return null;
    }
  }
}
