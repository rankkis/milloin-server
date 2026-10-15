import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Forecast, ForecastHorizon } from './forecast';

/**
 * The forecaster's API is private: it answers only with the shared secret
 * in FORECASTER_API_KEY (set on both Vercel projects) in this header.
 */
export const FORECASTER_KEY_HEADER = 'x-forecaster-key';

const TIMEOUT_MS = 10 * 1000;

const UNAVAILABLE = 'Forecasts are unavailable';

/**
 * Fetches forecasts from electricity-price-forecaster
 * (FORECASTER_API_URL) for milloin-web, which never sees the key.
 */
@Injectable()
export class ForecastsService {
  private readonly logger = new Logger(ForecastsService.name);

  async getForecast(horizon: ForecastHorizon): Promise<Forecast> {
    const baseUrl = process.env.FORECASTER_API_URL;
    const key = process.env.FORECASTER_API_KEY;
    if (!baseUrl || !key) {
      this.logger.error('FORECASTER_API_URL or FORECASTER_API_KEY is not set');
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    let response: Response;
    try {
      response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/v1/forecasts/${horizon}`,
        {
          headers: { [FORECASTER_KEY_HEADER]: key, accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (error) {
      this.logger.error(`Forecaster did not answer: ${error}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    if (response.status === 404) {
      throw new NotFoundException(`No ${horizon} forecast has been made yet`);
    }
    if (!response.ok) {
      this.logger.error(`Forecaster answered ${response.status}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    return (await response.json()) as Forecast;
  }
}
