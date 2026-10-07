import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { SpotHintaApiResponse } from '../interfaces/spot-hinta-api.interface';
import { IElectricityPriceProvider } from '../interfaces/electricity-price-provider.interface';

/**
 * Fallback price provider using spot-hinta.fi API.
 * Note: This API provides hourly prices which are converted to 15-minute intervals
 * by duplicating the hourly price across four 15-minute periods.
 * Use EntsoeProvider as primary source for accurate 15-minute pricing.
 */
@Injectable()
export class SpotHintaProvider implements IElectricityPriceProvider {
  readonly name = 'spot-hinta.fi';
  private readonly baseUrl = 'https://api.spot-hinta.fi';

  /**
   * Fetches today's and, when published, tomorrow's prices (Finnish days)
   * and returns the ones overlapping startDate..endDate.
   */
  async fetchPrices(
    startDate: Date,
    endDate: Date,
  ): Promise<ElectricityPriceDto[]> {
    const [today, tomorrow] = await Promise.all([
      this.fetchDay('Today'),
      this.fetchDay('Tomorrow').catch(() => []),
    ]);

    return [...today, ...tomorrow].filter(
      (price) =>
        Date.parse(price.endDate) > startDate.getTime() &&
        Date.parse(price.startDate) < endDate.getTime(),
    );
  }

  private async fetchDay(
    day: 'Today' | 'Tomorrow',
  ): Promise<ElectricityPriceDto[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${day}`);

      if (!response.ok) {
        throw new HttpException(
          `Failed to fetch electricity prices for ${day.toLowerCase()}`,
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
        `Error fetching electricity prices for ${day.toLowerCase()}`,
        HttpStatus.SERVICE_UNAVAILABLE,
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
}
