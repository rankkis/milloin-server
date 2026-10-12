import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
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
import { HttpCache } from '../../shared/http/http-cache';
import { ProblemDto } from '../../shared/http/problem-details';
import { PRICES_UNAVAILABLE } from '../common/responses';
import { PlanSearchDto } from './dto/plan-search.dto';
import { PlansQueryDto } from './dto/plans-query.dto';
import { PlanPresetDto, PlansDto } from './dto/plans.dto';
import { PLAN_PRESETS } from './plan-presets';
import { PlansService } from './plans.service';

const INVALID = {
  description:
    'A parameter is not valid, or the parameters do not fit together',
  type: ProblemDto,
};
const UNAVAILABLE = { description: PRICES_UNAVAILABLE, type: ProblemDto };

@ApiTags('plans')
@Controller('v1/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({
    operationId: 'getPlans',
    summary: 'When to run a load',
    description: `
The cheapest time to run a load before a deadline, and whether to run it now.

- **Continuous** (default): the load runs without a break once started, like a washing machine or a sauna.
  Give \`durationHours\` (and \`energyKwh\` for costs). Returns up to \`limit\` runs that do not overlap, cheapest first.
- **Pausable** (\`pausable=true\`): the load may stop and start, like an EV charger, water heater or battery.
  Give \`durationHours\` (time on), or \`energyKwh\` with \`maxPowerKw\`. Returns the single cheapest plan,
  in blocks of at least \`minBlockHours\`.

\`activeNow\` and \`nextChangeAt\` tell a device whether to be on and when to switch next. A plan searched from a
fixed \`earliestStart\` (for example \`today\`) stays the same between requests, so a device following
\`activeNow\` runs exactly the planned time.

Example: charge 50 kWh at 11 kW before 08:00 tomorrow, at least an hour at a time:
\`/v1/plans?pausable=true&energyKwh=50&maxPowerKw=11&minBlockHours=1&latestEnd=2026-10-13T08:00:00%2B03:00\`
    `,
  })
  @ApiOkResponse({ type: PlansDto })
  @ApiBadRequestResponse(INVALID)
  @ApiServiceUnavailableResponse(UNAVAILABLE)
  getPlans(@Query() query: PlansQueryDto): Promise<PlansDto> {
    return this.plansService.findPlans(query);
  }

  @Post('search')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'searchPlans',
    summary: 'When to run a load, with inputs too long for a URL',
    description: `
The same as GET /v1/plans with the fields in a JSON body, plus \`profileKwh\` for a load whose power changes and
\`startTimes\` to compare given starts. Responses to POST are not cached by the CDN; prefer GET when it is enough.
    `,
  })
  @ApiOkResponse({ type: PlansDto })
  @ApiBadRequestResponse(INVALID)
  @ApiServiceUnavailableResponse(UNAVAILABLE)
  searchPlans(@Body() body: PlanSearchDto): Promise<PlansDto> {
    return this.plansService.findPlans(body);
  }

  @Get('presets')
  @HttpCache(60 * 60)
  @ApiOperation({
    operationId: 'listPlanPresets',
    summary: 'The ready-made loads',
    description: 'Each preset is a set of GET /v1/plans parameters.',
  })
  @ApiOkResponse({ type: [PlanPresetDto] })
  listPlanPresets(): PlanPresetDto[] {
    return PLAN_PRESETS;
  }

  @Get('presets/:name')
  @ApiOperation({
    operationId: 'getPresetPlans',
    summary: 'When to run a ready-made load',
    description:
      "GET /v1/plans with the preset's parameters. Any GET /v1/plans parameter overrides the preset's, for example `/v1/plans/presets/ev-charging?energyKwh=30&latestEnd=tomorrow`.",
  })
  @ApiParam({ name: 'name', enum: PLAN_PRESETS.map((preset) => preset.name) })
  @ApiOkResponse({ type: PlansDto })
  @ApiBadRequestResponse(INVALID)
  @ApiNotFoundResponse({ description: 'No such preset', type: ProblemDto })
  @ApiServiceUnavailableResponse(UNAVAILABLE)
  getPresetPlans(
    @Param('name') name: string,
    @Query() query: PlansQueryDto,
  ): Promise<PlansDto> {
    const preset = PLAN_PRESETS.find((item) => item.name === name);
    if (!preset) {
      throw new NotFoundException(`Unknown preset: ${name}`);
    }
    const defined = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined),
    ) as PlansQueryDto;
    // A duration given replaces the preset's power, and a power its duration
    const defaults = {
      pausable: preset.pausable,
      energyKwh: preset.energyKwh,
      minBlockHours: preset.minBlockHours,
      ...(defined.maxPowerKw === undefined && {
        durationHours: preset.durationHours,
      }),
      ...(defined.durationHours === undefined && {
        maxPowerKw: preset.maxPowerKw,
      }),
    };
    const request = { ...defaults, ...defined };
    if (!request.pausable) {
      delete request.minBlockHours;
    }
    return this.plansService.findPlans(request, preset.name);
  }
}
