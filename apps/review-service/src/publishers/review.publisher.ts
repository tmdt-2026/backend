import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export const REVIEW_RABBITMQ_CLIENT = 'REVIEW_RABBITMQ_CLIENT';

@Injectable()
export class ReviewPublisher {
  private readonly logger = new Logger(ReviewPublisher.name);

  constructor(
    @Inject(REVIEW_RABBITMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async publishReviewCreated(data: {
    reviewId: string;
    userId: string;
    productId: string;
    productName: string;
    rating: number;
    createdAt: string;
  }): Promise<void> {
    await this.publish('review.created', data);
  }

  async publishCommentReplied(data: {
    commentId: string;
    replyId: string;
    targetUserId: string;
    replyUserId: string;
    replyUserName: string;
    productId: string;
    productName: string;
  }): Promise<void> {
    await this.publish('comment.replied', data);
  }

  private async publish(pattern: string, data: any): Promise<void> {
    try {
      await this.client.emit(pattern, data).toPromise();
      this.logger.log(`Published: ${pattern}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish ${pattern}: ${error.message}`);
    }
  }
}
