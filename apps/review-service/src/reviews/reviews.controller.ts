import {
  Controller, Get, Post, Patch, Param, Body, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { QueryAdminReviewsDto } from './dto/query-admin-reviews.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { CurrentUser, UserPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { memoryStorage } from 'multer';

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
};

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ── Public ───────────────────────────────────────────────────

  @Get('reviews/products/:productId')
  @Public()
  getByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: QueryReviewsDto,
  ) {
    return this.reviewsService.getReviewsByProduct(productId, query);
  }

  @Get('reviews/products/:productId/stats')
  @Public()
  getStats(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.reviewsService.getRatingStats(productId);
  }

  // ── Authenticated ────────────────────────────────────────────

  @Post('reviews')
  @Roles('customer', 'staff', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('images', 5, multerOptions))
  create(
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: UserPayload,
  ) {
    return this.reviewsService.createReview(dto, files ?? [], user);
  }

  @Get('reviews/me')
  @Roles('customer', 'staff', 'admin')
  getMyReviews(@CurrentUser() user: UserPayload, @Query() query: QueryReviewsDto) {
    return this.reviewsService.getMyReviews(user.userId, query);
  }

  // ── Admin ─────────────────────────────────────────────────────

  @Get('reviews')
  @Roles('admin')
  getAll(@Query() query: QueryAdminReviewsDto) {
    return this.reviewsService.getAllAdmin(query);
  }

  @Patch('reviews/:id/visibility')
  @Roles('admin')
  updateVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.reviewsService.updateVisibility(id, dto);
  }
}
