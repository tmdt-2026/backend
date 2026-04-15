import { Module } from '@nestjs/common';
import { BannersModule } from '../banners/banners.module';
import { BannerTask } from './banner.task';

@Module({
  imports: [BannersModule],
  providers: [BannerTask],
})
export class TasksModule {}
