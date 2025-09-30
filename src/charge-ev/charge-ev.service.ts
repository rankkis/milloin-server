import { Injectable } from '@nestjs/common';
import { TARIFF_CONFIG } from '../shared/config/tariff.config';
import { OptimalTimeDto } from '../shared/dto/optimal-time.dto';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { findOptimalPeriod } from '../shared/electricity-price/utils/find-optimal-period.helper';
import { ChargeForecastDto } from './dto/charge-forecast.dto';

@Injectable()
export class ChargeEvService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
  ) {}

  async getForecast(): Promise<ChargeForecastDto> {
    const chargingDurationHours = 4; // EV charging period

    // Get price data for today and tomorrow
    const todayPrices = await this.electricityPriceService.getTodayPrices();
    let tomorrowPrices: ElectricityPriceDto[] = [];

    try {
      tomorrowPrices = await this.electricityPriceService.getTomorrowPrices();
    } catch (error) {
      console.warn("Tomorrow's prices not available yet");
      console.warn('Error details:', error.message);
    }

    const now = new Date();
    const allPrices = [...todayPrices, ...tomorrowPrices];

    // Filter prices starting from now (includes current hour if it hasn't ended)
    const futurePrice = allPrices.filter((price) => {
      const priceEndTime = new Date(price.endDate);
      return priceEndTime > now;
    });

    // Calculate 12 hours from now
    const next12HoursLimit = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Filter prices for next 12 hours
    const next12HoursPrices = futurePrice.filter((price) => {
      const priceStartTime = new Date(price.startDate);
      return priceStartTime < next12HoursLimit;
    });

    // Calculate "now" optimal time (what it costs to start right now)
    const startingNowPrices = futurePrice.slice(0, chargingDurationHours);
    if (startingNowPrices.length < chargingDurationHours) {
      throw new Error('Not enough price data to calculate charging cost');
    }

    const nowOptimalResult = findOptimalPeriod(
      startingNowPrices,
      chargingDurationHours,
      1,
    );
    if (nowOptimalResult.length === 0) {
      throw new Error('Unable to calculate current hour pricing');
    }

    const nowOptimal: OptimalTimeDto = {
      ...nowOptimalResult[0],
      potentialSavings: null, // No savings when starting now
      potentialSavingsPercentage: null,
    };

    // Find optimal 4-hour period in next 12 hours
    const next12HoursOptimalTimes = findOptimalPeriod(
      next12HoursPrices,
      chargingDurationHours,
    );

    if (next12HoursOptimalTimes.length === 0) {
      throw new Error('No optimal charging time found for next 12 hours');
    }

    const next12HoursOptimal: OptimalTimeDto = {
      ...next12HoursOptimalTimes[0],
      ...this.calculateSavings(nowOptimal, next12HoursOptimalTimes[0]),
    };

    // Find optimal 4-hour period in all available data
    const allOptimalTimes = findOptimalPeriod(
      futurePrice,
      chargingDurationHours,
    );

    const result: ChargeForecastDto = {
      now: nowOptimal,
      next12Hours: next12HoursOptimal,
      defaults: {
        exchangeTariffCentsKwh: TARIFF_CONFIG.EXCHANGE_TARIFF_CENTS_KWH,
        marginTariffCentsKwh: TARIFF_CONFIG.MARGIN_TARIFF_CENTS_KWH,
        powerConsumptionKwh: 11, // EV charging default power consumption
        periodHours: chargingDurationHours,
      },
    };

    // Include extended period only if it's cheaper than next12Hours
    if (
      allOptimalTimes.length > 0 &&
      allOptimalTimes[0].priceAvg < next12HoursOptimal.priceAvg
    ) {
      result.extended = {
        ...allOptimalTimes[0],
        ...this.calculateSavings(nowOptimal, allOptimalTimes[0]),
      };
    }

    return result;
  }

  private isCurrentHourOptimal(optimal: {
    startTime: string;
    endTime: string;
  }): boolean {
    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);

    const optimalStart = new Date(optimal.startTime);
    const optimalEnd = new Date(optimal.endTime);

    // Check if current hour falls within the optimal time period
    return currentHour >= optimalStart && currentHour < optimalEnd;
  }

  private calculateSavings(
    nowOptimal: OptimalTimeDto,
    optimal: {
      startTime: string;
      endTime: string;
      priceAvg: number;
      estimatedTotalPrice: number;
    },
  ): {
    potentialSavings: number | null;
    potentialSavingsPercentage: number | null;
  } {
    // If currently in optimal time, no savings to calculate
    if (this.isCurrentHourOptimal(optimal)) {
      return { potentialSavings: null, potentialSavingsPercentage: null };
    }

    // Calculate savings: (now price) - (optimal price)
    const savings =
      nowOptimal.estimatedTotalPrice - optimal.estimatedTotalPrice;
    const savingsPercentage = (savings / nowOptimal.estimatedTotalPrice) * 100;

    return {
      potentialSavings: Math.round(savings * 100) / 100,
      potentialSavingsPercentage: Math.round(savingsPercentage * 100) / 100,
    };
  }
}
