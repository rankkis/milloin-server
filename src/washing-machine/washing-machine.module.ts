import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { WashingMachineController } from './washing-machine.controller';
import { WashingMachineService } from './washing-machine.service';
import { ElectricityPriceService } from './electricity-price.service';

@Module({
  imports: [CacheModule.register()],
  controllers: [WashingMachineController],
  providers: [WashingMachineService, ElectricityPriceService],
})
export class WashingMachineModule {}
