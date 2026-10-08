import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { calculateCacheTtl } from '../shared/utils/cache-ttl.helper';
import {
  DEFAULT_WINDOW_COUNT,
  OptimalWindowRequestDto,
} from './dto/optimal-window-request.dto';
import {
  OptimalWindowCaseDto,
  OptimalWindowsDto,
} from './dto/optimal-window.dto';
import { OPTIMAL_WINDOW_CASES } from './optimal-window.cases';
import { OptimalWindowService } from './optimal-window.service';

const UNAVAILABLE =
  'Electricity prices are unavailable: both ENTSO-E and the fallback provider (spot-hinta.fi) failed.';

@ApiTags('optimal-window')
@Controller('optimal-window')
export class OptimalWindowController {
  constructor(private readonly optimalWindowService: OptimalWindowService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Find the cheapest windows for your own task',
    description: `
      Give the length of the task and optionally its energy use and the time range it must fit in.
      Returns the cheapest windows that do not overlap each other, cheapest first, and the window
      starting now for comparison. Prices include 25.5 % VAT, no tariffs or margins.
    `,
  })
  @ApiOkResponse({ type: OptimalWindowsDto })
  @ApiBadRequestResponse({ description: 'The request body is not valid' })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  findWindows(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    request: OptimalWindowRequestDto,
  ): Promise<OptimalWindowsDto> {
    return this.optimalWindowService.findWindows(request);
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List the preset cases',
    description:
      'The ready-made requests served at /optimal-window/cases/{case}.',
  })
  @ApiOkResponse({ type: [OptimalWindowCaseDto] })
  listCases(): OptimalWindowCaseDto[] {
    return OPTIMAL_WINDOW_CASES;
  }

  @Get('cases/:case')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(() => calculateCacheTtl())
  @ApiOperation({
    summary: 'Find the cheapest windows for a preset case',
    description: `
      Same as POST /optimal-window with the case's duration and energy use, searching all
      published prices and returning the ${DEFAULT_WINDOW_COUNT} cheapest windows.
    `,
  })
  @ApiParam({
    name: 'case',
    enum: OPTIMAL_WINDOW_CASES.map((preset) => preset.case),
  })
  @ApiOkResponse({ type: OptimalWindowsDto })
  @ApiNotFoundResponse({ description: 'No such case' })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  findCaseWindows(@Param('case') name: string): Promise<OptimalWindowsDto> {
    const preset = OPTIMAL_WINDOW_CASES.find((item) => item.case === name);
    if (!preset) {
      throw new NotFoundException(`Unknown case: ${name}`);
    }
    return this.optimalWindowService.findWindows({
      durationHours: preset.durationHours,
      energyKwh: preset.energyKwh,
    });
  }
}
