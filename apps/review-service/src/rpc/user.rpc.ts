import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

export const REVIEW_USER_RMQ_CLIENT = 'REVIEW_USER_RMQ_CLIENT';

export interface UserRpcResponse {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  fullName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UserRpc {
  private readonly logger = new Logger(UserRpc.name);
  private readonly timeoutMs = parseInt(process.env.RPC_TIMEOUT_MS ?? '3000', 10);

  constructor(
    @Inject(REVIEW_USER_RMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async getUserById(userId: string): Promise<UserRpcResponse | null> {
    try {
      const user = await firstValueFrom(
        this.client
          .send<UserRpcResponse>({ cmd: 'user.get-by-id' }, { id: userId })
          .pipe(timeout(this.timeoutMs)),
      );
      return user ?? null;
    } catch (err: any) {
      this.logger.warn(`Could not fetch user ${userId}: ${err.message}`);
      return null;
    }
  }
}
