import { Test, TestingModule } from '@nestjs/testing';
import { ChargeEvController } from './charge-ev.controller';
import { ChargeEvService } from './charge-ev.service';

describe('ChargeEvController', () => {
  let controller: ChargeEvController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChargeEvController],
      providers: [
        {
          provide: ChargeEvService,
          useValue: {
            getForecast: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChargeEvController>(ChargeEvController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
