import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { SpotHintaApiResponse } from '../interfaces/spot-hinta-api.interface';
import { IElectricityPriceProvider } from '../interfaces/electricity-price-provider.interface';

@Injectable()
export class SpotHintaProvider implements IElectricityPriceProvider {
  private readonly baseUrl = 'https://api.spot-hinta.fi';

  async getCurrentPrice(): Promise<ElectricityPriceDto> {
    try {
      const response = await fetch(`${this.baseUrl}/JustNow`);

      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch current electricity price',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return this.transformSpotHintaResponse([data])[0];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error fetching electricity price',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTodayPrices(): Promise<ElectricityPriceDto[]> {
    try {
      const response = await fetch(`${this.baseUrl}/Today`);

      if (!response.ok) {
        throw new HttpException(
          "Failed to fetch today's electricity prices",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return this.transformSpotHintaResponse(data);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Error fetching today's electricity prices",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTomorrowPrices(): Promise<ElectricityPriceDto[]> {
    try {
      const response = await fetch(`${this.baseUrl}/Tomorrow`);

      if (!response.ok) {
        throw new HttpException(
          "Failed to fetch tomorrow's electricity prices",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return this.transformSpotHintaResponse(data);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Error fetching tomorrow's electricity prices",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private transformSpotHintaResponse(
    data: SpotHintaApiResponse[],
  ): ElectricityPriceDto[] {
    return data.map((item) => ({
      price: item.PriceWithTax,
      startDate: new Date(item.DateTime).toISOString(),
      endDate: new Date(
        new Date(item.DateTime).getTime() + 60 * 60 * 1000,
      ).toISOString(),
    }));
  }

  async getFuturePrices(): Promise<ElectricityPriceDto[]> {
    const now = new Date();
    const currentHour = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0,
    );

    try {
      const [todayPrices, tomorrowPrices] = await Promise.all([
        this.getTodayPrices(),
        this.getTomorrowPrices().catch(() => []), // Return empty array if tomorrow's prices are not available
      ]);

      // Filter today's prices to include only current hour and future hours
      const futureTodayPrices = todayPrices.filter((price) => {
        const priceDate = new Date(price.startDate);
        return priceDate >= currentHour;
      });

      // Combine today's remaining prices with tomorrow's prices
      return [...futureTodayPrices, ...tomorrowPrices];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error fetching future electricity prices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
