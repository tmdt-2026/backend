import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [SettingsModule],
  controllers: [InternalController],
})
export class InternalModule {}
