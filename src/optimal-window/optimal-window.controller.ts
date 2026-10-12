import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HttpCache } from '../shared/http/http-cache';
import {
  DEFAULT_WINDOW_COUNT,
  OptimalWindowRequestDto,
} from './dto/optimal-window-request.dto';
import {
  OptimalWindowPresetDto,
  OptimalWindowsDto,
} from './dto/optimal-window.dto';
import { OPTIMAL_WINDOW_PRESETS } from './optimal-window.presets';
import { OptimalWindowService } from './optimal-window.service';
import { Deprecated } from '../shared/http/deprecated';

const UNAVAILABLE =
  'Electricity prices are unavailable: both ENTSO-E and the fallback provider (spot-hinta.fi) failed.';

@ApiTags('optimal-window')
@Controller('optimal-window')
export class OptimalWindowController {
  constructor(private readonly optimalWindowService: OptimalWindowService) {}

  @Post()
  @Deprecated('/v1/plans')
  @HttpCode(200)
  @ApiOperation({
    deprecated: true,
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
    @Body() request: OptimalWindowRequestDto,
  ): Promise<OptimalWindowsDto> {
    return this.optimalWindowService.findWindows(request);
  }

  @Get('presets')
  @Deprecated('/v1/plans/presets')
  @HttpCache(60 * 60)
  @ApiOperation({
    deprecated: true,
    summary: 'List the presets',
    description:
      'The ready-made requests served at /optimal-window/presets/{preset}.',
  })
  @ApiOkResponse({ type: [OptimalWindowPresetDto] })
  listPresets(): OptimalWindowPresetDto[] {
    return OPTIMAL_WINDOW_PRESETS;
  }

  @Get('presets/:preset')
  @Deprecated('/v1/plans/presets')
  @ApiOperation({
    deprecated: true,
    summary: 'Find the cheapest windows for a preset',
    description: `
      Same as POST /optimal-window with the preset's duration, energy use and start options, searching all
      published prices and returning the ${DEFAULT_WINDOW_COUNT} cheapest windows.
    `,
  })
  @ApiParam({
    name: 'preset',
    enum: OPTIMAL_WINDOW_PRESETS.map((preset) => preset.name),
  })
  @ApiOkResponse({ type: OptimalWindowsDto })
  @ApiNotFoundResponse({ description: 'No such preset' })
  @ApiServiceUnavailableResponse({ description: UNAVAILABLE })
  findPresetWindows(@Param('preset') name: string): Promise<OptimalWindowsDto> {
    const preset = OPTIMAL_WINDOW_PRESETS.find((item) => item.name === name);
    if (!preset) {
      throw new NotFoundException(`Unknown preset: ${name}`);
    }
    return this.optimalWindowService.findWindows({
      durationHours: preset.durationHours,
      energyKwh: preset.energyKwh,
      ...(preset.startOffsetsHours && {
        startOffsetsHours: preset.startOffsetsHours,
      }),
      ...(preset.startEveryFullHour && { startEveryFullHour: true }),
    });
  }
}
