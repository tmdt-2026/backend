import { Controller, Post, Get, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('internal/users')
@Public()
@UseGuards(ServiceAuthGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // GET /internal/users/:id
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      fullName: user.userDetail?.fullName,
      avatarUrl: user.userDetail?.avatarUrl,
    };
  }

  // POST /internal/users/batch
  @Post('batch')
  async batchGetUsers(@Body('ids') ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      include: {
        userDetail: true,
        userRoles: { include: { role: true } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      userName: user.userName,
      email: user.email,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      fullName: user.userDetail?.fullName,
      avatarUrl: user.userDetail?.avatarUrl,
    }));
  }
}
