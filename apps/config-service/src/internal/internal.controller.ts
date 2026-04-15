import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';

@Controller('internal/config')
@UseGuards(ServiceAuthGuard)
export class InternalController {
  constructor(private readonly settingsService: SettingsService) {}

  /** GET /internal/config/settings/:key — get single setting value */
  @Get('settings/:key')
  async getSettingByKey(@Param('key') key: string) {
    const setting = await this.settingsService.findByKey(key, true);
    return {
      key: setting.settingKey,
      value: setting.settingValue,
      type: setting.settingType,
      parsed: this.settingsService.parseSettings([setting])[setting.settingKey],
    };
  }

  /** GET /internal/config/settings?keys=key1,key2 — get multiple settings */
  @Get('settings')
  async getSettings(@Query('keys') keysParam: string) {
    if (!keysParam) return {};
    const keys = keysParam.split(',').map(k => k.trim()).filter(Boolean);
    const result: Record<string, unknown> = {};

    await Promise.all(
      keys.map(async key => {
        try {
          const setting = await this.settingsService.findByKey(key, true);
          result[key] = this.settingsService.parseSettings([setting])[setting.settingKey];
        } catch {
          result[key] = null;
        }
      })
    );

    return result;
  }
}
