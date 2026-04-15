import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Comment, Prisma } from '@prisma/review-client';

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  async findRoots(
    productId: string,
    params: { skip: number; take: number; where?: Prisma.CommentWhereInput },
  ): Promise<[Comment[], number]> {
    const where: Prisma.CommentWhereInput = {
      productId,
      parentId: null,
      depth: 0,
      ...params.where,
    };
    return this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comment.count({ where }),
    ]);
  }

  async findRepliesByParentIds(parentIds: string[]): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: {
        OR: [
          { parentId: { in: parentIds } },
          { parent: { parentId: { in: parentIds } } },
        ],
        isVisible: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(data: Prisma.CommentCreateInput): Promise<Comment> {
    return this.prisma.comment.create({ data });
  }

  async update(id: string, data: Prisma.CommentUpdateInput): Promise<Comment> {
    return this.prisma.comment.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.comment.update({
      where: { id },
      data: { isVisible: false },
    });
  }

  async updateVisibility(id: string, isVisible: boolean, adminNote?: string): Promise<Comment> {
    return this.prisma.comment.update({
      where: { id },
      data: { isVisible, adminNote: adminNote ?? null },
    });
  }
}
