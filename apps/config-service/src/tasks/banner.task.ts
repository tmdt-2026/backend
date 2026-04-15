import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BannersService } from '../banners/banners.service';

@Injectable()
export class BannerTask {
  private readonly logger = new Logger(BannerTask.name);

  constructor(private readonly bannersService: BannersService) {}

  /** Run every 5 minutes — deactivate expired banners */
  @Cron('0 */5 * * * *')
  async deactivateExpiredBanners(): Promise<void> {
    const count = await this.bannersService.deactivateExpired();
    if (count > 0) this.logger.log(`Deactivated ${count} expired banners`);
  }

  /** Run every 5 minutes — activate scheduled banners */
  @Cron('0 */5 * * * *')
  async activateScheduledBanners(): Promise<void> {
    const count = await this.bannersService.activateScheduled();
    if (count > 0) this.logger.log(`Activated ${count} scheduled banners`);
  }
}
