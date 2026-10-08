import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WashLaundryModule } from './wash-laundry/wash-laundry.module';
import { ChargeEvModule } from './charge-ev/charge-ev.module';
import { OverviewModule } from './overview/overview.module';
import { RATE_LIMIT_OPTIONS } from './shared/config/rate-limit.config';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // default TTL in seconds
      max: 100, // max items in cache
    }),
    ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS),
    WashLaundryModule,
    ChargeEvModule,
    OverviewModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
