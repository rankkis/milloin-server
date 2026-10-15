import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { FORECASTER_KEY_HEADER, ForecastsService } from './forecasts.service';

const forecast = {
  horizon: '72h',
  resolution: 'hour',
  issuedAt: '2026-10-15T09:00:00.000Z',
  modelVersion: '72h-hour-profile-v1',
  change: '0001',
  points: [],
};

describe('ForecastsService', () => {
  const service = new ForecastsService();
  const env = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.FORECASTER_API_URL = 'https://forecaster.test/';
    process.env.FORECASTER_API_KEY = 'secret';
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('fetches the forecast with the key', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(forecast)));

    await expect(service.getForecast('72h')).resolves.toEqual(forecast);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://forecaster.test/v1/forecasts/72h');
    expect(init.headers[FORECASTER_KEY_HEADER]).toBe('secret');
  });

  it('answers 404 when there is no forecast yet', async () => {
    fetchSpy.mockResolvedValue(new Response('{}', { status: 404 }));

    await expect(service.getForecast('week')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('answers 503 when the forecaster fails or refuses the key', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(service.getForecast('72h')).rejects.toThrow(
      ServiceUnavailableException,
    );

    fetchSpy.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.getForecast('72h')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('answers 503 without calling out when not configured', async () => {
    delete process.env.FORECASTER_API_KEY;

    await expect(service.getForecast('72h')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
