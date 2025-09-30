import { ApiProperty } from '@nestjs/swagger';
import { OptimalTimeDto } from '../../shared/dto/optimal-time.dto';
import { ForecastDefaultsDto } from '../../shared/dto/forecast-defaults.dto';

export class ChargeForecastDto {
  @ApiProperty({
    description:
      'Cost and timing if starting charging right now (from current hour, 4-hour period). Always included for comparison.',
    type: OptimalTimeDto,
  })
  now: OptimalTimeDto;

  @ApiProperty({
    description:
      'Optimal charging time for the next 12 hours (4-hour period). Always included if data available.',
    type: OptimalTimeDto,
    required: true,
  })
  next12Hours: OptimalTimeDto;

  @ApiProperty({
    description:
      'Optimal charging time for all available data starting now (4-hour period). Only included if cheaper than next12Hours period.',
    type: OptimalTimeDto,
    required: false,
  })
  extended?: OptimalTimeDto;

  @ApiProperty({
    description:
      'Default configuration values used in calculations (tariffs, power consumption, period duration)',
    type: ForecastDefaultsDto,
  })
  defaults: ForecastDefaultsDto;
}
