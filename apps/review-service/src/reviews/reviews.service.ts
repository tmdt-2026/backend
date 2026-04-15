import { Injectable } from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { OrderRpc } from '../rpc/order.rpc';
import { ProductRpc } from '../rpc/product.rpc';
import { UserRpc, UserRpcResponse } from '../rpc/user.rpc';
import { ReviewPublisher } from '../publishers/review.publisher';
import { UploadService } from '../upload/upload.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { QueryAdminReviewsDto } from './dto/query-admin-reviews.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { UserPayload } from '../common/decorators/current-user.decorator';
import {
  OrderNotFoundException,
  NotOrderOwnerException,
  OrderNotCompletedException,
  ProductNotInOrderException,
  AlreadyReviewedException,
  ProductNotFoundException,
  ReviewNotFoundException,
  TooManyImagesException,
} from '../common/exceptions/review.exceptions';
import { Review } from '@prisma/review-client';
import { Prisma } from '@prisma/review-client';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly orderRpc: OrderRpc,
    private readonly productRpc: ProductRpc,
    private readonly userRpc: UserRpc,
    private readonly publisher: ReviewPublisher,
    private readonly uploadService: UploadService,
  ) {}

  async createReview(dto: CreateReviewDto, files: Express.Multer.File[], currentUser: UserPayload) {
    // Validate image count
    if (files && files.length > 5) throw new TooManyImagesException();

    // STEP 1: Verify order
    const order = await this.orderRpc.getOrderById(dto.orderId);
    if (!order) throw new OrderNotFoundException();
    if (order.userId !== currentUser.userId) throw new NotOrderOwnerException();
    if (order.status !== 'completed') throw new OrderNotCompletedException();

    const productInOrder = order.items.some((item) => item.productId === dto.productId);
    if (!productInOrder) throw new ProductNotInOrderException();

    // STEP 2: Verify product
    const product = await this.productRpc.getProductById(dto.productId);
    if (!product) throw new ProductNotFoundException();

    // STEP 3: Check unique
    const existing = await this.reviewsRepository.findByUniqueKey(
      currentUser.userId, dto.productId, dto.orderId,
    );
    if (existing) throw new AlreadyReviewedException();

    // STEP 4: Upload images
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await this.uploadService.uploadReviewImages(files, currentUser.userId);
    }

    // STEP 5: Get user snapshot
    const user = await this.userRpc.getUserById(currentUser.userId);
    const userName = user?.detail?.fullName ?? user?.userName ?? 'Ẩn danh';

    // STEP 6: Save review
    const review = await this.reviewsRepository.create({
      userId: currentUser.userId,
      productId: dto.productId,
      orderId: dto.orderId,
      rating: dto.rating,
      content: dto.content ?? null,
      images: imageUrls.length ? imageUrls : undefined,
      userNameSnapshot: userName,
      productNameSnapshot: product.name,
    });

    // STEP 7: Publish event
    await this.publisher.publishReviewCreated({
      reviewId: review.id,
      userId: currentUser.userId,
      productId: dto.productId,
      productName: product.name,
      rating: dto.rating,
      createdAt: review.createdAt.toISOString(),
    });

    return this.mapReview(review, user);
  }

  async getReviewsByProduct(productId: string, query: QueryReviewsDto) {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 10);
    const take = query.limit ?? 10;

    const where: Prisma.ReviewWhereInput = {};
    if (query.rating) where.rating = query.rating;
    if (query.hasImage) where.images = { not: Prisma.JsonNull };

    const orderBy: Prisma.ReviewOrderByWithRelationInput = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    };

    const [reviews, total] = await this.reviewsRepository.findByProduct(productId, {
      skip, take, where, orderBy,
    });

    return {
      success: true,
      data: reviews.map((r) => this.mapReview(r, null)),
      meta: {
        page: query.page ?? 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getRatingStats(productId: string) {
    return this.reviewsRepository.getRatingStats(productId);
  }

  async getMyReviews(userId: string, query: QueryReviewsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await this.reviewsRepository.findByUser(userId, skip, limit);

    return {
      success: true,
      data: reviews.map((r) => this.mapReview(r, null)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllAdmin(query: QueryAdminReviewsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};
    if (query.productId) where.productId = query.productId;
    if (query.userId) where.userId = query.userId;
    if (query.rating) where.rating = query.rating;
    if (query.isVisible !== undefined) where.isVisible = query.isVisible;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const orderBy: Prisma.ReviewOrderByWithRelationInput = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    };

    const [reviews, total] = await this.reviewsRepository.findAllAdmin({ skip, take: limit, where, orderBy });

    return {
      success: true,
      data: reviews.map((r) => this.mapReview(r, null)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateVisibility(id: string, dto: UpdateVisibilityDto) {
    const review = await this.reviewsRepository.findById(id);
    if (!review) throw new ReviewNotFoundException();

    const updated = await this.reviewsRepository.updateVisibility(id, dto.isVisible, dto.adminNote);
    return { id: updated.id, isVisible: updated.isVisible, adminNote: updated.adminNote };
  }

  private mapReview(review: Review, user: UserRpcResponse | null) {
    return {
      id: review.id,
      orderId: review.orderId,
      productId: review.productId,
      rating: review.rating,
      content: review.content,
      images: review.images ?? [],
      isVisible: review.isVisible,
      adminNote: review.adminNote,
      productNameSnapshot: review.productNameSnapshot,
      user: {
        id: review.userId,
        name: review.userNameSnapshot ?? user?.detail?.fullName ?? user?.userName ?? 'Ẩn danh',
        avatar: user?.detail?.avatarUrl ?? user?.avatarUrl ?? null,
      },
      createdAt: review.createdAt,
    };
  }
}
