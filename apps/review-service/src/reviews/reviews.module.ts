import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { RpcModule } from '../rpc/rpc.module';
import { PublishersModule } from '../publishers/publishers.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [RpcModule, PublishersModule, UploadModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
