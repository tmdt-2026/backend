import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { ReviewsRepository } from '../reviews/reviews.repository';

@Module({
  controllers: [InternalController],
  providers: [ReviewsRepository],
})
export class InternalModule {}
