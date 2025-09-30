import { Module } from '@nestjs/common';
import { WashingMachineController } from './washing-machine.controller';
import { WashingMachineService } from './washing-machine.service';
import { ElectricityPriceModule } from '../shared/electricity-price/electricity-price.module';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [WashingMachineController],
  providers: [WashingMachineService],
})
export class WashingMachineModule {}
