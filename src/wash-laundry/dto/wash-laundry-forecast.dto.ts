import { ApiProperty } from '@nestjs/swagger';
import { OptimalTimeDto } from '../../shared/dto/optimal-time.dto';
import { ForecastDefaultsDto } from '../../shared/dto/forecast-defaults.dto';

export class WashLaundryForecastDto {
  @ApiProperty({
    description:
      'Cost and timing if starting washing right now (from current hour). Included when enough price data is available.',
    type: OptimalTimeDto,
    required: false,
  })
  now?: OptimalTimeDto;

  @ApiProperty({
    description:
      'Optimal washing time for today during day hours (06:00-20:00 Finnish time). Only included if currently daytime.',
    type: OptimalTimeDto,
    required: false,
  })
  today?: OptimalTimeDto;

  @ApiProperty({
    description:
      "Optimal washing time for tonight (20:01-05:59 Finnish time). Only included if cheaper than today's optimal time.",
    type: OptimalTimeDto,
    required: false,
  })
  tonight?: OptimalTimeDto;

  @ApiProperty({
    description:
      'Optimal washing time for tomorrow during day hours (06:00-20:00 Finnish time). Included during night time OR during day time if cheaper than today.',
    type: OptimalTimeDto,
    required: false,
  })
  tomorrow?: OptimalTimeDto;

  @ApiProperty({
    description:
      'Default configuration values used in calculations (tariffs, power consumption, period duration)',
    type: ForecastDefaultsDto,
  })
  defaults: ForecastDefaultsDto;
}
