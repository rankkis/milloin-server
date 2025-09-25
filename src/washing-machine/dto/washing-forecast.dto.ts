import { ApiProperty } from '@nestjs/swagger';
import { OptimalTimeDto } from './optimal-time.dto';

export class WashingForecastDto {
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
}
