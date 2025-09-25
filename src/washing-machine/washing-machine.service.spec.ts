import { Test } from '@nestjs/testing';
import { WashingMachineService } from './washing-machine.service';
import { ElectricityPriceFiService } from '../shared/electricity-price-fi/electricity-price-fi.service';
import { ElectricityPriceDto } from '../shared/electricity-price-fi/dto/electricity-price.dto';

describe('WashingMachineService - Business Rules', () => {
  let service: WashingMachineService;
  let mockElectricityPriceService: jest.Mocked<ElectricityPriceFiService>;

  beforeEach(async () => {
    mockElectricityPriceService = {
      getTodayPrices: jest.fn(),
      getTomorrowPrices: jest.fn(),
      getCurrentPrices: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        WashingMachineService,
        {
          provide: ElectricityPriceFiService,
          useValue: mockElectricityPriceService,
        },
      ],
    }).compile();

    service = moduleRef.get<WashingMachineService>(WashingMachineService);
  });

  describe('Today calculation rules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should include today calculation when current time is during daytime (10:00 Finnish)', async () => {
      // Mock current time as 2024-07-15 10:00 Finnish time (UTC+3)
      // This translates to 07:00 UTC
      const mockDate = new Date('2024-07-15T07:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(8.5); // Cheapest 2-hour slot: (0.08 + 0.09) / 2 * 100 = 8.5 cents
    });

    it('should NOT include today calculation when current time is nighttime (22:00 Finnish)', async () => {
      // Mock current time as 2024-07-15 22:00 Finnish time (UTC+3)
      // This translates to 19:00 UTC
      const mockDate = new Date('2024-07-15T19:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeUndefined();
    });

    it('should NOT include today calculation when current time is early morning (05:00 Finnish)', async () => {
      // Mock current time as 2024-07-15 05:00 Finnish time (UTC+3)
      // This translates to 02:00 UTC
      const mockDate = new Date('2024-07-15T02:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeUndefined();
    });
  });

  describe('Tomorrow calculation rules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should include tomorrow when today is NOT available (nighttime)', async () => {
      // Mock current time as 22:00 Finnish time (nighttime - no today)
      const mockDate = new Date('2024-07-15T19:00:00.000Z'); // 22:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeUndefined();
      expect(result.tomorrow).toBeDefined();
      expect(result.tomorrow.price).toBe(9); // (0.08 + 0.10) / 2 * 100 = 9 cents
    });

    it('should include tomorrow when it is cheaper than today', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(16.5); // (0.15 + 0.18) / 2 * 100 = 16.5 cents
      expect(result.tomorrow).toBeDefined();
      expect(result.tomorrow.price).toBe(9); // (0.08 + 0.10) / 2 * 100 = 9 cents
      expect(result.tomorrow.price).toBeLessThan(result.today.price);
    });

    it('should NOT include tomorrow when today is available and tomorrow is more expensive', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(9); // (0.08 + 0.10) / 2 * 100 = 9 cents
      expect(result.tomorrow).toBeUndefined(); // More expensive than today (16.5 > 9)
    });
  });

  describe('Tonight calculation rules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should include tonight when it is cheaper than today', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(16.5); // (0.15 + 0.18) / 2 * 100 = 16.5 cents
      expect(result.tonight).toBeDefined();
      expect(result.tonight.price).toBe(9); // (0.08 + 0.10) / 2 * 100 = 9 cents
      expect(result.tonight.price).toBeLessThan(result.today.price);
    });

    it('should NOT include tonight when today is available and tonight is more expensive', async () => {
      // Mock current time as 10:00 Finnish time (daytime - today available)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(9); // (0.08 + 0.10) / 2 * 100 = 9 cents
      expect(result.tonight).toBeUndefined(); // More expensive than today (16.5 > 9)
    });

    it('should include tonight when today is NOT available (nighttime)', async () => {
      // Mock current time as 22:00 Finnish time (nighttime - no today)
      const mockDate = new Date('2024-07-15T19:00:00.000Z'); // 22:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeUndefined(); // Nighttime - no today
      expect(result.tonight).toBeDefined(); // Available since no today to compare against
    });
  });

  describe('Complex scenarios', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle scenario with all three periods available and correct filtering', async () => {
      // Mock current time as 14:00 Finnish time (afternoon - today available)
      const mockDate = new Date('2024-07-15T11:00:00.000Z'); // 14:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(13.5); // (0.12 + 0.15) / 2 * 100

      expect(result.tonight).toBeDefined(); // Cheaper than today (9 < 13.5)
      expect(result.tonight.price).toBe(9); // (0.08 + 0.10) / 2 * 100

      expect(result.tomorrow).toBeUndefined(); // More expensive than today (19 > 13.5)
    });

    it('should handle equal prices correctly (edge case)', async () => {
      // Mock current time as 10:00 Finnish time (daytime)
      const mockDate = new Date('2024-07-15T07:00:00.000Z'); // 10:00 Finnish
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

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

      const result = await service.getForecast(24);

      expect(result.today).toBeDefined();
      expect(result.today.price).toBe(11); // (0.10 + 0.12) / 2 * 100
      expect(result.tonight).toBeUndefined(); // Equal price, not cheaper (11 < 11 is false)
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
