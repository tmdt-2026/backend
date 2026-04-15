import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrderRpc } from './order.rpc';
import { ProductRpc } from './product.rpc';
import { UserRpc } from './user.rpc';

@Module({
  imports: [HttpModule],
  providers: [OrderRpc, ProductRpc, UserRpc],
  exports: [OrderRpc, ProductRpc, UserRpc],
})
export class RpcModule {}
