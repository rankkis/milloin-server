import { Module } from '@nestjs/common';
import { WashingMachineModule } from './washing-machine/washing-machine.module';

@Module({
  imports: [WashingMachineModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
