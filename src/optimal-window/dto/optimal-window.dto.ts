import { ApiProperty } from '@nestjs/swagger';
import { OptimalTimeDto } from '../../shared/dto/optimal-time.dto';

export class WindowDto extends OptimalTimeDto {
  @ApiProperty({
    description:
      'Electricity cost of the window in cents: priceAvg × energyKwh. Only when energyKwh is known.',
    example: 28.4,
    required: false,
  })
  costCents?: number;

  @ApiProperty({
    description:
      'Cents saved compared with starting now (startNow). Negative when the window costs more. Only when energyKwh and startNow are known.',
    example: 41.3,
    required: false,
  })
  savingsCents?: number;
}

export class OptimalWindowsDto {
  @ApiProperty({ description: 'Length of each window in hours', example: 3 })
  durationHours: number;

  @ApiProperty({
    description: 'Electricity used during a window (kWh)',
    example: 7,
    required: false,
  })
  energyKwh?: number;

  @ApiProperty({
    description:
      'Earliest start that was searched (ISO 8601, Zulu): the current 15-minute interval or the requested earliestStart',
    example: '2025-10-01T11:30:00.000Z',
    type: String,
  })
  earliestStart: string;

  @ApiProperty({
    description:
      'Latest end that was searched (ISO 8601, Zulu): the requested latestEnd or the end of the last published price',
    example: '2025-10-02T21:00:00.000Z',
    type: String,
  })
  latestEnd: string;

  @ApiProperty({
    description:
      'The window starting at the current 15-minute interval, for comparison. Left out when prices do not reach far enough.',
    type: WindowDto,
    required: false,
  })
  startNow?: WindowDto;

  @ApiProperty({
    description:
      'The cheapest windows that do not overlap each other, cheapest first. On a tie the earlier window comes first. Empty when no window fits between earliestStart and latestEnd.',
    type: [WindowDto],
  })
  windows: WindowDto[];
}

export class OptimalWindowPresetDto {
  @ApiProperty({
    description: 'Name of the preset, used in /optimal-window/presets/{preset}',
    example: 'charge-ev',
  })
  name: string;

  @ApiProperty({
    description: 'What the preset is for',
    example: 'Charging an electric vehicle',
  })
  description: string;

  @ApiProperty({ description: 'Length of the window in hours', example: 4 })
  durationHours: number;

  @ApiProperty({
    description: 'Electricity used during the window (kWh)',
    example: 11,
  })
  energyKwh: number;
}
