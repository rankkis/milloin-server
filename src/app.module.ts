import { Module } from '@nestjs/common';
import { WashingMachineModule } from './washing-machine/washing-machine.module';
import { ChargeEvModule } from './charge-ev/charge-ev.module';

@Module({
  imports: [WashingMachineModule, ChargeEvModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
