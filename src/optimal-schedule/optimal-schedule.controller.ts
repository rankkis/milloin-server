import {
  Body,
  Controller,
  HttpCode,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OptimalScheduleRequestDto } from './dto/optimal-schedule-request.dto';
import { OptimalScheduleDto } from './dto/optimal-schedule.dto';
import { OptimalScheduleService } from './optimal-schedule.service';

@ApiTags('optimal-schedule')
@Controller('optimal-schedule')
export class OptimalScheduleController {
  constructor(
    private readonly optimalScheduleService: OptimalScheduleService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Find the cheapest schedule to draw an amount of energy',
    description: `
      Give the energy needed and the highest power, for example 50 kWh with an 11 kW charger, and optionally
      when the energy may be drawn: the earliest start, the deadline and the shortest block. Returns the
      cheapest 15-minute slots before the deadline grouped into on/off blocks, the device running at full power
      except in one slot that tops up the rest, and the cost of starting right away for comparison.
      Prices include 25.5 % VAT, no tariffs or margins.
    `,
  })
  @ApiOkResponse({ type: OptimalScheduleDto })
  @ApiBadRequestResponse({
    description:
      'The request body is not valid, or the energy does not fit before the deadline at the given power',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Electricity prices are unavailable: both ENTSO-E and the fallback provider (spot-hinta.fi) failed.',
  })
  findSchedule(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    request: OptimalScheduleRequestDto,
  ): Promise<OptimalScheduleDto> {
    return this.optimalScheduleService.findSchedule(request);
  }
}
