import { Injectable } from '@nestjs/common';
import { ElectricityPriceDto } from './dto/electricity-price.dto';
import { IElectricityPriceProvider } from './interfaces/electricity-price-provider.interface';
import { SpotHintaProvider } from './providers/spot-hinta.provider';

@Injectable()
export class ElectricityPriceFiService {
  private provider: IElectricityPriceProvider;

  constructor(private spotHintaProvider: SpotHintaProvider) {
    this.provider = this.spotHintaProvider;
  }

  async getCurrentPrices(): Promise<ElectricityPriceDto[]> {
    const currentPrice = await this.provider.getCurrentPrice();
    return [currentPrice];
  }

  async getTodayPrices(): Promise<ElectricityPriceDto[]> {
    return this.provider.getTodayPrices();
  }

  async getTomorrowPrices(): Promise<ElectricityPriceDto[]> {
    return this.provider.getTomorrowPrices();
  }

  async getFuturePrices(): Promise<ElectricityPriceDto[]> {
    return this.provider.getFuturePrices();
  }
}
