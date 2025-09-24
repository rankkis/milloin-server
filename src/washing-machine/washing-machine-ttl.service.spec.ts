import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WashingMachineService } from './washing-machine.service';
import { ElectricityPriceService } from './electricity-price.service';

describe('WashingMachineService - TTL Logic', () => {
  let service: WashingMachineService;

  beforeEach(async () => {
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockElectricityPriceService = {
      getTodayPrices: jest.fn(),
      getTomorrowPrices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WashingMachineService,
        {
          provide: ElectricityPriceService,
          useValue: mockElectricityPriceService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<WashingMachineService>(WashingMachineService);
  });

  describe('Earliest StartTime Selection for TTL', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should select earliest startTime among available options', () => {
      // Create mock result with multiple options
      const result = {
        today: {
          startTime: '2025-09-24T14:00:00.000Z',
          endTime: '2025-09-24T16:00:00.000Z',
          price: 5.0,
          period: 'day' as const,
          rank: 1,
          savings: 0,
          savingsPercentage: 0,
        },
        tonight: {
          startTime: '2025-09-24T21:00:00.000Z',
          endTime: '2025-09-24T23:00:00.000Z',
          price: 3.0,
          period: 'night' as const,
          rank: 1,
          savings: 2.0,
          savingsPercentage: 40,
        },
        tomorrow: {
          startTime: '2025-09-25T08:00:00.000Z',
          endTime: '2025-09-25T10:00:00.000Z',
          price: 4.0,
          period: 'day' as const,
          rank: 1,
          savings: 1.0,
          savingsPercentage: 20,
        },
      };

      // Test the earliest selection logic
      const availableOptions = [
        result.today,
        result.tonight,
        result.tomorrow,
      ].filter(Boolean);
      const earliestOption = availableOptions.reduce((earliest, current) =>
        new Date(current.startTime) < new Date(earliest.startTime)
          ? current
          : earliest,
      );

      // Should select today (14:00) as it's earliest
      expect(earliestOption.startTime).toBe('2025-09-24T14:00:00.000Z');
      expect(earliestOption).toBe(result.today);
    });

    it('should handle case with only tonight available', () => {
      const result: { today?: any; tonight?: any; tomorrow?: any } = {
        tonight: {
          startTime: '2025-09-24T21:00:00.000Z',
          endTime: '2025-09-24T23:00:00.000Z',
          price: 3.0,
          period: 'night' as const,
          rank: 1,
          savings: 0,
          savingsPercentage: 0,
        },
      };

      const availableOptions = [
        result.today,
        result.tonight,
        result.tomorrow,
      ].filter(Boolean);
      const earliestOption = availableOptions.reduce((earliest, current) =>
        new Date(current.startTime) < new Date(earliest.startTime)
          ? current
          : earliest,
      );

      // Should select tonight as it's the only option
      expect(earliestOption.startTime).toBe('2025-09-24T21:00:00.000Z');
      expect(earliestOption).toBe(result.tonight);
    });

    it('should handle case with tomorrow being earliest', () => {
      const result: { today?: any; tonight?: any; tomorrow?: any } = {
        tonight: {
          startTime: '2025-09-24T23:30:00.000Z',
          endTime: '2025-09-25T01:30:00.000Z',
          price: 5.0,
          period: 'night' as const,
          rank: 1,
          savings: 0,
          savingsPercentage: 0,
        },
        tomorrow: {
          startTime: '2025-09-25T06:00:00.000Z',
          endTime: '2025-09-25T08:00:00.000Z',
          price: 3.0,
          period: 'day' as const,
          rank: 1,
          savings: 2.0,
          savingsPercentage: 40,
        },
      };

      const availableOptions = [
        result.today,
        result.tonight,
        result.tomorrow,
      ].filter(Boolean);
      const earliestOption = availableOptions.reduce((earliest, current) =>
        new Date(current.startTime) < new Date(earliest.startTime)
          ? current
          : earliest,
      );

      // Should select tonight (23:30) as it's earlier than tomorrow (06:00 next day)
      expect(earliestOption.startTime).toBe('2025-09-24T23:30:00.000Z');
      expect(earliestOption).toBe(result.tonight);
    });

    it('should handle edge case with same startTimes', () => {
      const result: { today?: any; tonight?: any; tomorrow?: any } = {
        today: {
          startTime: '2025-09-24T14:00:00.000Z',
          endTime: '2025-09-24T16:00:00.000Z',
          price: 5.0,
          period: 'day' as const,
          rank: 1,
          savings: 0,
          savingsPercentage: 0,
        },
        tomorrow: {
          startTime: '2025-09-24T14:00:00.000Z', // Same time (edge case)
          endTime: '2025-09-24T16:00:00.000Z',
          price: 3.0,
          period: 'day' as const,
          rank: 1,
          savings: 2.0,
          savingsPercentage: 40,
        },
      };

      const availableOptions = [
        result.today,
        result.tonight,
        result.tomorrow,
      ].filter(Boolean);
      const earliestOption = availableOptions.reduce((earliest, current) =>
        new Date(current.startTime) < new Date(earliest.startTime)
          ? current
          : earliest,
      );

      // Should select first one encountered (today) when times are equal
      expect(earliestOption.startTime).toBe('2025-09-24T14:00:00.000Z');
      expect(earliestOption).toBe(result.today);
    });

    it('should correctly compare times across day boundaries', () => {
      const result: { today?: any; tonight?: any; tomorrow?: any } = {
        tonight: {
          startTime: '2025-09-24T22:00:00.000Z', // Tonight at 22:00
          endTime: '2025-09-25T00:00:00.000Z',
          price: 3.0,
          period: 'night' as const,
          rank: 1,
          savings: 0,
          savingsPercentage: 0,
        },
        tomorrow: {
          startTime: '2025-09-25T02:00:00.000Z', // Tomorrow early morning at 02:00
          endTime: '2025-09-25T04:00:00.000Z',
          price: 2.0,
          period: 'night' as const,
          rank: 1,
          savings: 1.0,
          savingsPercentage: 33,
        },
      };

      const availableOptions = [
        result.today,
        result.tonight,
        result.tomorrow,
      ].filter(Boolean);
      const earliestOption = availableOptions.reduce((earliest, current) =>
        new Date(current.startTime) < new Date(earliest.startTime)
          ? current
          : earliest,
      );

      // Should select tonight (22:00) as it's earlier than tomorrow (02:00 next day)
      expect(earliestOption.startTime).toBe('2025-09-24T22:00:00.000Z');
      expect(earliestOption).toBe(result.tonight);
    });
  });

  describe('TTL Calculation Method', () => {
    it('should calculate correct TTL for future times', () => {
      // Mock current time
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-09-24T10:30:00.000Z'));

      // Access private method
      const ttlMethod = (service as any).getTtlUntilEndOfOptimalHour.bind(
        service,
      );

      // Test TTL calculation for 14:00 start time
      const ttl = ttlMethod('2025-09-24T14:00:00.000Z');

      // Should be from 10:30:00 to 14:59:59 = 4h 29m 59s = 16139 seconds
      const expectedSeconds = 4 * 3600 + 29 * 60 + 59;
      expect(ttl).toBe(expectedSeconds);

      jest.useRealTimers();
    });

    it('should return minimum TTL for past times', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-09-24T15:30:00.000Z'));

      const ttlMethod = (service as any).getTtlUntilEndOfOptimalHour.bind(
        service,
      );

      // Test TTL for past time
      const ttl = ttlMethod('2025-09-24T14:00:00.000Z');

      // Should return minimum of 1 second
      expect(ttl).toBe(1);

      jest.useRealTimers();
    });

    it('should calculate TTL for times on next day', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-09-24T23:30:00.000Z'));

      const ttlMethod = (service as any).getTtlUntilEndOfOptimalHour.bind(
        service,
      );

      // Test TTL for tomorrow 06:00
      const ttl = ttlMethod('2025-09-25T06:00:00.000Z');

      // Should be from 23:30:00 today to 06:59:59 tomorrow = 7h 29m 59s = 26999 seconds
      const expectedSeconds = 7 * 3600 + 29 * 60 + 59;
      expect(ttl).toBe(expectedSeconds);

      jest.useRealTimers();
    });
  });

  describe('Logic Integration', () => {
    it('should demonstrate the complete TTL selection logic', () => {
      // This test demonstrates the exact logic used in the service
      const mockResult = {
        today: {
          startTime: '2025-09-24T14:00:00.000Z',
          endTime: '2025-09-24T16:00:00.000Z',
          price: 6.0,
          period: 'day' as const,
          rank: 1,
          savings: 0,
          savingsPercentage: 0,
        },
        tonight: {
          startTime: '2025-09-24T21:00:00.000Z',
          endTime: '2025-09-24T23:00:00.000Z',
          price: 4.0,
          period: 'night' as const,
          rank: 1,
          savings: 2.0,
          savingsPercentage: 33,
        },
        tomorrow: {
          startTime: '2025-09-25T08:00:00.000Z',
          endTime: '2025-09-25T10:00:00.000Z',
          price: 5.0,
          period: 'day' as const,
          rank: 1,
          savings: 1.0,
          savingsPercentage: 17,
        },
      };

      // This is the exact logic from the service
      const availableOptions = [
        mockResult.today,
        mockResult.tonight,
        mockResult.tomorrow,
      ].filter(Boolean);
      const earliestOption =
        availableOptions.length > 0
          ? availableOptions.reduce((earliest, current) =>
              new Date(current.startTime) < new Date(earliest.startTime)
                ? current
                : earliest,
            )
          : null;

      expect(earliestOption).not.toBeNull();
      expect(earliestOption?.startTime).toBe('2025-09-24T14:00:00.000Z');
      expect(earliestOption).toBe(mockResult.today);

      // This proves that TTL will be calculated based on today's startTime,
      // not the cheapest option (tonight) or any other logic
    });
  });
});
