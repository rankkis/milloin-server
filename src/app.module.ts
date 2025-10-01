import { Module } from '@nestjs/common';
import { WashLaundryModule } from './wash-laundry/wash-laundry.module';
import { ChargeEvModule } from './charge-ev/charge-ev.module';

@Module({
  imports: [WashLaundryModule, ChargeEvModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
