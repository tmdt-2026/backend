import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });
  }

  async findMany(query: QueryUsersDto) {
    const { search, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { userName: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          userDetail: true,
          userRoles: { include: { role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async updateProfile(userId: string, data: {
    userName?: string;
    phoneNumber?: string;
    fullName?: string;
    avatarUrl?: string;
    dateOfBirth?: Date;
    gender?: any;
  }) {
    const { userName, phoneNumber, fullName, avatarUrl, dateOfBirth, gender } = data;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(userName && { userName }),
          ...(phoneNumber !== undefined && { phoneNumber }),
        },
      });

      await tx.userDetail.upsert({
        where: { userId },
        update: {
          ...(fullName !== undefined && { fullName }),
          ...(avatarUrl !== undefined && { avatarUrl }),
          ...(dateOfBirth !== undefined && { dateOfBirth }),
          ...(gender !== undefined && { gender }),
        },
        create: {
          userId,
          fullName,
          avatarUrl,
          dateOfBirth,
          gender,
        },
      });

      return tx.user.findUnique({
        where: { id: userId },
        include: { userDetail: true, userRoles: { include: { role: true } } },
      });
    });
  }

  async toggleActive(userId: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { isActive },
      });
      if (!isActive) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
  }

  async updateRoles(userId: string, roleNames: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId, roleId: r.id })),
      });
      return tx.user.findUnique({
        where: { id: userId },
        include: { userDetail: true, userRoles: { include: { role: true } } },
      });
    });
  }
}
