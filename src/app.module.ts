import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { WashLaundryModule } from './wash-laundry/wash-laundry.module';
import { ChargeEvModule } from './charge-ev/charge-ev.module';
import { OverviewModule } from './overview/overview.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // default TTL in seconds
      max: 100, // max items in cache
    }),
    WashLaundryModule,
    ChargeEvModule,
    OverviewModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
