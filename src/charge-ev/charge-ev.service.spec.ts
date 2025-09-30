import { Test, TestingModule } from '@nestjs/testing';
import { ChargeEvService } from './charge-ev.service';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';

describe('ChargeEvService', () => {
  let service: ChargeEvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargeEvService,
        {
          provide: ElectricityPriceService,
          useValue: {
            getTodayPrices: jest.fn(),
            getTomorrowPrices: jest.fn(),
            getCurrentPrices: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChargeEvService>(ChargeEvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
