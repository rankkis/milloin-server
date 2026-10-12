import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { OverviewModule } from './overview/overview.module';
import { OptimalWindowModule } from './optimal-window/optimal-window.module';
import { OptimalScheduleModule } from './optimal-schedule/optimal-schedule.module';
import { EnceModule } from './ence/ence.module';
import { RATE_LIMIT_OPTIONS } from './shared/config/rate-limit.config';
import { HttpCacheInterceptor } from './shared/http/http-cache';

@Module({
  imports: [
    ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS),
    OverviewModule,
    OptimalWindowModule,
    OptimalScheduleModule,
    EnceModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
  ],
})
export class AppModule {}
