import { ApiProperty } from '@nestjs/swagger';

/**
 * Default configuration values used in forecast calculations
 */
export class ForecastDefaultsDto {
  @ApiProperty({
    description: 'Electricity exchange tariff in cents per kWh',
    example: 6.7,
  })
  exchangeTariffCentsKwh: number;

  @ApiProperty({
    description: 'Margin tariff in cents per kWh',
    example: 0.5,
  })
  marginTariffCentsKwh: number;

  @ApiProperty({
    description: 'Default power consumption in kWh',
    example: 11,
  })
  powerConsumptionKwh: number;

  @ApiProperty({
    description: 'Default period duration in hours',
    example: 4,
  })
  periodHours: number;
}
