import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export interface ElectricityPrice {
  price: number;
  startDate: string;
  endDate: string;
}

@Injectable()
export class ElectricityPriceService {
  private readonly baseUrl = 'https://api.spot-hinta.fi';

  async getCurrentPrices(): Promise<ElectricityPrice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/JustNow`);

      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch current electricity prices',
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
        'Error fetching electricity prices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTodayPrices(): Promise<ElectricityPrice[]> {
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

  async getTomorrowPrices(): Promise<ElectricityPrice[]> {
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

  private transformSpotHintaResponse(data: any[]): ElectricityPrice[] {
    return data.map((item) => ({
      price: item.PriceWithTax,
      startDate: new Date(item.DateTime).toISOString(),
      endDate: new Date(
        new Date(item.DateTime).getTime() + 60 * 60 * 1000,
      ).toISOString(),
    }));
  }
}
