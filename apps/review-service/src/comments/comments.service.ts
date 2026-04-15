import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommentsRepository } from './comments.repository';
import { ProductRpc } from '../rpc/product.rpc';
import { UserRpc } from '../rpc/user.rpc';
import { ReviewPublisher } from '../publishers/review.publisher';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { QueryCommentsDto } from './dto/query-comments.dto';
import { UpdateCommentVisibilityDto } from './dto/update-visibility.dto';
import { UserPayload } from '../common/decorators/current-user.decorator';
import {
  CommentNotFoundException,
  NotCommentOwnerException,
  EditWindowExpiredException,
  MaxDepthExceededException,
  ProductNotFoundException,
} from '../common/exceptions/review.exceptions';
import { Comment } from '@prisma/review-client';

@Injectable()
export class CommentsService {
  private readonly editWindowMs: number;

  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly productRpc: ProductRpc,
    private readonly userRpc: UserRpc,
    private readonly publisher: ReviewPublisher,
    private readonly config: ConfigService,
  ) {
    this.editWindowMs = config.get<number>('app.commentEditWindowMs') ?? 15 * 60 * 1000;
  }

  async getByProduct(productId: string, query: QueryCommentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [roots, total] = await this.commentsRepository.findRoots(productId, {
      skip,
      take: limit,
      where: { isVisible: true },
    });

    const rootIds = roots.map((r) => r.id);
    const replies = rootIds.length
      ? await this.commentsRepository.findRepliesByParentIds(rootIds)
      : [];

    const replyMap = new Map<string, Comment[]>();
    replies.forEach((r) => {
      const bucket = replyMap.get(r.parentId!) ?? [];
      bucket.push(r);
      replyMap.set(r.parentId!, bucket);
    });

    const tree = roots.map((root) => ({
      ...this.mapComment(root),
      replies: (replyMap.get(root.id) ?? []).map((r1) => ({
        ...this.mapComment(r1),
        replies: (replyMap.get(r1.id) ?? []).map((r2) => ({
          ...this.mapComment(r2),
          replies: [],
        })),
      })),
    }));

    return {
      success: true,
      data: tree,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createComment(dto: CreateCommentDto, currentUser: UserPayload) {
    const product = await this.productRpc.getProductById(dto.productId);
    if (!product) throw new ProductNotFoundException();

    const user = await this.userRpc.getUserById(currentUser.userId);
    const roleBadge = this.resolveRoleBadge(currentUser.roles);
    const userName = user?.detail?.fullName ?? user?.userName ?? 'Ẩn danh';

    const comment = await this.commentsRepository.create({
      productId: dto.productId,
      userId: currentUser.userId,
      depth: 0,
      content: dto.content,
      userNameSnapshot: userName,
      userRoleSnapshot: roleBadge,
    });

    return { ...this.mapComment(comment), replies: [] };
  }

  async replyComment(parentId: string, dto: ReplyCommentDto, currentUser: UserPayload) {
    const parent = await this.commentsRepository.findById(parentId);
    if (!parent || !parent.isVisible) throw new CommentNotFoundException();
    if (parent.depth >= 2) throw new MaxDepthExceededException();

    const user = await this.userRpc.getUserById(currentUser.userId);
    const roleBadge = this.resolveRoleBadge(currentUser.roles);
    const userName = user?.detail?.fullName ?? user?.userName ?? 'Ẩn danh';

    const reply = await this.commentsRepository.create({
      productId: parent.productId,
      userId: currentUser.userId,
      parent: { connect: { id: parentId } },
      depth: parent.depth + 1,
      content: dto.content,
      userNameSnapshot: userName,
      userRoleSnapshot: roleBadge,
    });

    // Notify parent owner
    if (parent.userId !== currentUser.userId) {
      const product = await this.productRpc.getProductById(parent.productId);
      await this.publisher.publishCommentReplied({
        commentId: parentId,
        replyId: reply.id,
        targetUserId: parent.userId,
        replyUserId: currentUser.userId,
        replyUserName: userName,
        productId: parent.productId,
        productName: product?.name ?? '',
      });
    }

    return { ...this.mapComment(reply), replies: [] };
  }

  async updateComment(commentId: string, dto: UpdateCommentDto, currentUser: UserPayload) {
    const comment = await this.commentsRepository.findById(commentId);
    if (!comment || !comment.isVisible) throw new CommentNotFoundException();
    if (comment.userId !== currentUser.userId) throw new NotCommentOwnerException();

    const ageMs = Date.now() - comment.createdAt.getTime();
    if (ageMs > this.editWindowMs) throw new EditWindowExpiredException();

    const updated = await this.commentsRepository.update(commentId, {
      content: dto.content,
      editedAt: new Date(),
    });

    return { ...this.mapComment(updated), replies: [] };
  }

  async deleteComment(commentId: string, currentUser: UserPayload) {
    const comment = await this.commentsRepository.findById(commentId);
    if (!comment) throw new CommentNotFoundException();

    const isAdmin = currentUser.roles.includes('admin');
    if (!isAdmin && comment.userId !== currentUser.userId) {
      throw new NotCommentOwnerException();
    }

    await this.commentsRepository.softDelete(commentId);
    return { message: 'Đã xoá bình luận' };
  }

  async updateVisibility(commentId: string, dto: UpdateCommentVisibilityDto) {
    const comment = await this.commentsRepository.findById(commentId);
    if (!comment) throw new CommentNotFoundException();

    const updated = await this.commentsRepository.updateVisibility(
      commentId, dto.isVisible, dto.adminNote,
    );
    return { id: updated.id, isVisible: updated.isVisible, adminNote: updated.adminNote };
  }

  private resolveRoleBadge(roles: string[]): string {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('staff')) return 'staff';
    return 'customer';
  }

  private mapComment(comment: Comment) {
    return {
      id: comment.id,
      productId: comment.productId,
      depth: comment.depth,
      content: comment.content,
      isVisible: comment.isVisible,
      editedAt: comment.editedAt,
      user: {
        id: comment.userId,
        name: comment.userNameSnapshot ?? 'Ẩn danh',
        role: comment.userRoleSnapshot ?? 'customer',
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
