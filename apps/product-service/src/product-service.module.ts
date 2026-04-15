// src/product-service.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { ProductController } from './product-service.controller';
import { ProductRpcController } from './product.rpc.controller';
import { ProductService } from './product-service.service';
import { PrismaModule } from '../prisma/prisma.module';

const rootEnvPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../../../.env'),
].find((path) => existsSync(path));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
    }),
    PrismaModule,
  ],
  controllers: [ProductController, ProductRpcController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductServiceModule {}
