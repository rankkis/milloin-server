import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EnceModule } from './ence/ence.module';
import { RATE_LIMIT_OPTIONS } from './shared/config/rate-limit.config';
import { HttpCacheInterceptor } from './shared/http/http-cache';
import { ClockModule } from './shared/clock/clock';
import {
  ProblemDetailsFilter,
  validationException,
} from './shared/http/problem-details';
import { PricesModule } from './v1/prices/prices.module';
import { PlansModule } from './v1/plans/plans.module';
import { HealthModule } from './v1/health/health.module';
import { ForecastsModule } from './v1/forecasts/forecasts.module';

@Module({
  imports: [
    ClockModule,
    ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS),
    EnceModule,
    PricesModule,
    PlansModule,
    HealthModule,
    ForecastsModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
    {
      // Request bodies and query parameters are checked against their DTO;
      // unknown fields are refused
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: validationException,
      }),
    },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
