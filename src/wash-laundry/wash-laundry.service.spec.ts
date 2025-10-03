import { Test } from '@nestjs/testing';
import { WashLaundryService } from './wash-laundry.service';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';

describe.skip('WashLaundryService - Business Rules', () => {
  let service: WashLaundryService;
  let mockElectricityPriceService: jest.Mocked<ElectricityPriceService>;

  beforeEach(async () => {
    mockElectricityPriceService = {
      getTodayPrices: jest.fn(),
      getTomorrowPrices: jest.fn(),
      getCurrentPrices: jest.fn(),
      getFuturePrices: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        WashLaundryService,
        {
          provide: ElectricityPriceService,
          useValue: mockElectricityPriceService,
        },
      ],
    }).compile();

    service = moduleRef.get<WashLaundryService>(WashLaundryService);
  });

  describe('Today calculation rules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should include today calculation when current time is during daytime (10:00 Finnish)', async () => {
      // Mock current time as 2024-07-15 10:00 Finnish time (UTC+3)
      // This translates to 07:00 UTC
      const mockDate = new Date('2024-07-15T07:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.15,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        }, // 10:00-11:00 Finnish (current)
        {
          price: 0.12,
          startDate: '2024-07-15T08:00:00.000Z',
          endDate: '2024-07-15T09:00:00.000Z',
        }, // 11:00-12:00 Finnish
        {
          price: 0.09,
          startDate: '2024-07-15T09:00:00.000Z',
          endDate: '2024-07-15T10:00:00.000Z',
        }, // 12:00-13:00 Finnish
        {
          price: 0.08,
          startDate: '2024-07-15T10:00:00.000Z',
          endDate: '2024-07-15T11:00:00.000Z',
        }, // 13:00-14:00 Finnish
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue([]);
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.15,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(15.7); // Cheapest 2-hour slot: ((0.08 + 7.2) + (0.09 + 7.2)) / 2 = 15.7 cents (includes tariffs)
    });

    it('should NOT include today calculation when current time is nighttime (22:00 Finnish)', async () => {
      // Mock current time as 2024-07-15 22:00 Finnish time (UTC+3)
      // This translates to 19:00 UTC
      const mockDate = new Date('2024-07-15T19:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.12,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish (current)
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue([]);
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.12,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeUndefined();
    });

    it('should NOT include today calculation when current time is early morning (05:00 Finnish)', async () => {
      // Mock current time as 2024-07-15 05:00 Finnish time (UTC+3)
      // This translates to 02:00 UTC
      const mockDate = new Date('2024-07-15T02:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.1,
          startDate: '2024-07-15T02:00:00.000Z',
          endDate: '2024-07-15T03:00:00.000Z',
        }, // 05:00-06:00 Finnish (current)
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue([]);
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.1,
          startDate: '2024-07-15T02:00:00.000Z',
          endDate: '2024-07-15T03:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeUndefined();
    });
  });

  describe('Tomorrow calculation rules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should include tomorrow when today is NOT available (nighttime)', async () => {
      // Mock current time as 22:00 Finnish time (nighttime - no today)
      const mockDate = new Date('2024-07-15T19:00:00.000Z'); // 22:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.12,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish
      ];

      const tomorrowPrices: ElectricityPriceDto[] = [
        {
          price: 0.08,
          startDate: '2024-07-16T05:00:00.000Z',
          endDate: '2024-07-16T06:00:00.000Z',
        }, // 08:00-09:00 Finnish tomorrow
        {
          price: 0.1,
          startDate: '2024-07-16T06:00:00.000Z',
          endDate: '2024-07-16T07:00:00.000Z',
        }, // 09:00-10:00 Finnish tomorrow
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue(
        tomorrowPrices,
      );
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.12,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeUndefined();
      expect(result.tomorrow).toBeDefined();
      expect(result.tomorrow.priceAvg).toBe(16.2); // ((0.08 + 7.2) + (0.10 + 7.2)) / 2 = 16.2 cents (includes tariffs)
    });

    it('should include tomorrow when it is cheaper than today', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.15,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        }, // 10:00-11:00 Finnish (current)
        {
          price: 0.18,
          startDate: '2024-07-15T08:00:00.000Z',
          endDate: '2024-07-15T09:00:00.000Z',
        }, // 11:00-12:00 Finnish
      ];

      const tomorrowPrices: ElectricityPriceDto[] = [
        {
          price: 0.08,
          startDate: '2024-07-16T05:00:00.000Z',
          endDate: '2024-07-16T06:00:00.000Z',
        }, // 08:00-09:00 Finnish tomorrow
        {
          price: 0.1,
          startDate: '2024-07-16T06:00:00.000Z',
          endDate: '2024-07-16T07:00:00.000Z',
        }, // 09:00-10:00 Finnish tomorrow
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue(
        tomorrowPrices,
      );
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.15,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(23.7); // ((0.15 + 7.2) + (0.18 + 7.2)) / 2 = 23.7 cents (includes tariffs)
      expect(result.tomorrow).toBeDefined();
      expect(result.tomorrow.priceAvg).toBe(16.2); // ((0.08 + 7.2) + (0.10 + 7.2)) / 2 = 16.2 cents (includes tariffs)
      expect(result.tomorrow.priceAvg).toBeLessThan(result.today.priceAvg);
    });

    it('should NOT include tomorrow when today is available and tomorrow is more expensive', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.08,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        }, // 10:00-11:00 Finnish (current)
        {
          price: 0.1,
          startDate: '2024-07-15T08:00:00.000Z',
          endDate: '2024-07-15T09:00:00.000Z',
        }, // 11:00-12:00 Finnish
      ];

      const tomorrowPrices: ElectricityPriceDto[] = [
        {
          price: 0.15,
          startDate: '2024-07-16T05:00:00.000Z',
          endDate: '2024-07-16T06:00:00.000Z',
        }, // 08:00-09:00 Finnish tomorrow
        {
          price: 0.18,
          startDate: '2024-07-16T06:00:00.000Z',
          endDate: '2024-07-16T07:00:00.000Z',
        }, // 09:00-10:00 Finnish tomorrow
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue(
        tomorrowPrices,
      );
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.08,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(16.2); // ((0.08 + 7.2) + (0.10 + 7.2)) / 2 = 16.2 cents (includes tariffs)
      expect(result.tomorrow).toBeUndefined(); // More expensive than today (23.7 > 16.2)
    });
  });

  describe('Tonight calculation rules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should include tonight when it is cheaper than today', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.15,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        }, // 10:00-11:00 Finnish (current)
        {
          price: 0.18,
          startDate: '2024-07-15T08:00:00.000Z',
          endDate: '2024-07-15T09:00:00.000Z',
        }, // 11:00-12:00 Finnish
        {
          price: 0.08,
          startDate: '2024-07-15T18:00:00.000Z',
          endDate: '2024-07-15T19:00:00.000Z',
        }, // 21:00-22:00 Finnish (tonight)
        {
          price: 0.1,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish (tonight)
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue([]);
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.15,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(23.7); // ((0.15 + 7.2) + (0.18 + 7.2)) / 2 = 23.7 cents (includes tariffs)
      expect(result.tonight).toBeDefined();
      expect(result.tonight.priceAvg).toBe(16.2); // ((0.08 + 7.2) + (0.10 + 7.2)) / 2 = 16.2 cents (includes tariffs)
      expect(result.tonight.priceAvg).toBeLessThan(result.today.priceAvg);
    });

    it('should NOT include tonight when today is available and tonight is more expensive', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.08,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        }, // 10:00-11:00 Finnish (current)
        {
          price: 0.1,
          startDate: '2024-07-15T08:00:00.000Z',
          endDate: '2024-07-15T09:00:00.000Z',
        }, // 11:00-12:00 Finnish
        {
          price: 0.15,
          startDate: '2024-07-15T18:00:00.000Z',
          endDate: '2024-07-15T19:00:00.000Z',
        }, // 21:00-22:00 Finnish (tonight)
        {
          price: 0.18,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish (tonight)
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue([]);
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.08,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(16.2); // ((0.08 + 7.2) + (0.10 + 7.2)) / 2 = 16.2 cents (includes tariffs)
      expect(result.tonight).toBeUndefined(); // More expensive than today (23.7 > 16.2)
    });

    it('should include tonight when today is NOT available (nighttime)', async () => {
      // Mock current time as 22:00 Finnish time (nighttime - no today)
      const mockDate = new Date('2024-07-15T19:00:00.000Z'); // 22:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.08,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish (current)
        {
          price: 0.1,
          startDate: '2024-07-15T20:00:00.000Z',
          endDate: '2024-07-15T21:00:00.000Z',
        }, // 23:00-00:00 Finnish
      ];

      const tomorrowPrices: ElectricityPriceDto[] = [
        {
          price: 0.05,
          startDate: '2024-07-15T22:00:00.000Z',
          endDate: '2024-07-15T23:00:00.000Z',
        }, // 01:00-02:00 Finnish (tomorrow nighttime)
        {
          price: 0.06,
          startDate: '2024-07-15T23:00:00.000Z',
          endDate: '2024-07-16T00:00:00.000Z',
        }, // 02:00-03:00 Finnish (tomorrow nighttime)
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue(
        tomorrowPrices,
      );
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.08,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeUndefined(); // Nighttime - no today
      expect(result.tonight).toBeDefined(); // Available since no today to compare against
    });
  });

  describe('Complex scenarios', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle scenario with all three periods available and correct filtering', async () => {
      // Mock current time as 14:00 Finnish time (afternoon - today available)
      const mockDate = new Date('2024-07-15T11:00:00.000Z'); // 14:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.12,
          startDate: '2024-07-15T11:00:00.000Z',
          endDate: '2024-07-15T12:00:00.000Z',
        }, // 14:00-15:00 Finnish (current)
        {
          price: 0.15,
          startDate: '2024-07-15T12:00:00.000Z',
          endDate: '2024-07-15T13:00:00.000Z',
        }, // 15:00-16:00 Finnish
        {
          price: 0.08,
          startDate: '2024-07-15T18:00:00.000Z',
          endDate: '2024-07-15T19:00:00.000Z',
        }, // 21:00-22:00 Finnish (tonight)
        {
          price: 0.1,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish (tonight)
      ];

      const tomorrowPrices: ElectricityPriceDto[] = [
        {
          price: 0.18,
          startDate: '2024-07-16T05:00:00.000Z',
          endDate: '2024-07-16T06:00:00.000Z',
        }, // 08:00-09:00 Finnish tomorrow
        {
          price: 0.2,
          startDate: '2024-07-16T06:00:00.000Z',
          endDate: '2024-07-16T07:00:00.000Z',
        }, // 09:00-10:00 Finnish tomorrow
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue(
        tomorrowPrices,
      );
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.12,
          startDate: '2024-07-15T11:00:00.000Z',
          endDate: '2024-07-15T12:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(20.7); // ((0.12 + 7.2) + (0.15 + 7.2)) / 2 = 20.7 cents (includes tariffs)

      expect(result.tonight).toBeDefined(); // Cheaper than today (16.2 < 20.7)
      expect(result.tonight.priceAvg).toBe(16.2); // ((0.08 + 7.2) + (0.10 + 7.2)) / 2 = 16.2 cents (includes tariffs)

      expect(result.tomorrow).toBeUndefined(); // More expensive than today (26.2 > 20.7)
    });

    it('should handle equal prices correctly (edge case)', async () => {
      // Mock current time as 10:00 Finnish time (daytime)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const todayPrices: ElectricityPriceDto[] = [
        {
          price: 0.1,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        }, // 10:00-11:00 Finnish (current)
        {
          price: 0.12,
          startDate: '2024-07-15T08:00:00.000Z',
          endDate: '2024-07-15T09:00:00.000Z',
        }, // 11:00-12:00 Finnish
        {
          price: 0.1,
          startDate: '2024-07-15T18:00:00.000Z',
          endDate: '2024-07-15T19:00:00.000Z',
        }, // 21:00-22:00 Finnish (tonight)
        {
          price: 0.12,
          startDate: '2024-07-15T19:00:00.000Z',
          endDate: '2024-07-15T20:00:00.000Z',
        }, // 22:00-23:00 Finnish (tonight)
      ];

      mockElectricityPriceService.getTodayPrices.mockResolvedValue(todayPrices);
      mockElectricityPriceService.getTomorrowPrices.mockResolvedValue([]);
      mockElectricityPriceService.getCurrentPrices.mockResolvedValue([
        {
          price: 0.1,
          startDate: '2024-07-15T07:00:00.000Z',
          endDate: '2024-07-15T08:00:00.000Z',
        },
      ]);

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.priceAvg).toBe(18.2); // ((0.10 + 7.2) + (0.12 + 7.2)) / 2 = 18.2 cents (includes tariffs)
      expect(result.tonight).toBeUndefined(); // Equal price, not cheaper (11 < 11 is false)
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
