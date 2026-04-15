import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublishersModule } from '../publishers/publishers.module';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';
import { BannersRepository } from './banners.repository';

@Module({
  imports: [PrismaModule, PublishersModule],
  controllers: [BannersController],
  providers: [BannersService, BannersRepository],
  exports: [BannersService],
})
export class BannersModule {}
