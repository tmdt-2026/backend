import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentsRepository } from './comments.repository';
import { RpcModule } from '../rpc/rpc.module';
import { PublishersModule } from '../publishers/publishers.module';

@Module({
  imports: [RpcModule, PublishersModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
