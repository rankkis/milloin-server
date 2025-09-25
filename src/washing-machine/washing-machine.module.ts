import { Module } from '@nestjs/common';
import { WashingMachineController } from './washing-machine.controller';
import { WashingMachineService } from './washing-machine.service';
import { ElectricityPriceFiModule } from '../shared/electricity-price-fi/electricity-price-fi.module';

@Module({
  imports: [ElectricityPriceFiModule],
  controllers: [WashingMachineController],
  providers: [WashingMachineService],
})
export class WashingMachineModule {}
