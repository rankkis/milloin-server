import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { OverviewModule } from './overview/overview.module';
import { OptimalWindowModule } from './optimal-window/optimal-window.module';
import { OptimalScheduleModule } from './optimal-schedule/optimal-schedule.module';
import { RATE_LIMIT_OPTIONS } from './shared/config/rate-limit.config';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // default TTL in seconds
      max: 100, // max items in cache
    }),
    ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS),
    OverviewModule,
    OptimalWindowModule,
    OptimalScheduleModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
