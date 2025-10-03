import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { SpotHintaApiResponse } from '../interfaces/spot-hinta-api.interface';
import { IElectricityPriceProvider } from '../interfaces/electricity-price-provider.interface';

/**
 * Fallback provider using spot-hinta.fi API.
 * Note: This API provides hourly prices which are converted to 15-minute intervals
 * by duplicating the hourly price across four 15-minute periods.
 * Use DatabaseProvider (ENTSO-E data) as primary source for accurate 15-minute pricing.
 */
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

  /**
   * Transforms spot-hinta API response to 15-minute intervals.
   * Note: spot-hinta.fi provides hourly prices, so we split each hour into four 15-minute intervals
   * with the same price. This is a fallback behavior when primary ENTSO-E source is unavailable.
   */
  private transformSpotHintaResponse(
    data: SpotHintaApiResponse[],
  ): ElectricityPriceDto[] {
    const pricePoints: ElectricityPriceDto[] = [];

    for (const item of data) {
      const hourStart = new Date(item.DateTime);

      // Split hourly price into 4x 15-minute intervals
      for (let quarter = 0; quarter < 4; quarter++) {
        const quarterStart = new Date(hourStart);
        quarterStart.setMinutes(quarter * 15);

        const quarterEnd = new Date(quarterStart);
        quarterEnd.setMinutes(quarterStart.getMinutes() + 15);

        pricePoints.push({
          price: item.PriceWithTax,
          startDate: quarterStart.toISOString(),
          endDate: quarterEnd.toISOString(),
        });
      }
    }

    return pricePoints;
  }

  async getFuturePrices(): Promise<ElectricityPriceDto[]> {
    const now = new Date();

    try {
      const [todayPrices, tomorrowPrices] = await Promise.all([
        this.getTodayPrices(),
        this.getTomorrowPrices().catch(() => []),
      ]);

      // Filter today's prices to include only current 15-minute interval and future intervals
      const futureTodayPrices = todayPrices.filter((price) => {
        const priceDate = new Date(price.startDate);
        return priceDate >= now;
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
