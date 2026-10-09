import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { EnceDto } from './dto/ence.dto';
import { EnceCacheService } from './ence-cache.service';
import { EnceService } from './ence.service';

@ApiTags('ence')
@Controller('ence')
export class EnceController {
  constructor(
    private readonly enceService: EnceService,
    private readonly cache: EnceCacheService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "ENCE's next Counter-Strike match, streams, results and news",
    description: `
      The running or next match of ENCE (the Finnish CS2 team) with up to 5 Finnish and
      English streams, the following matches, the latest results and news.

      Matches come from PandaScore and news from Google News. Both are fetched at most
      once an hour, so a match that just started may not be marked live yet, and scores
      of running matches are not included.
    `,
  })
  @ApiResponse({ status: 200, type: EnceDto })
  @ApiServiceUnavailableResponse({
    description: 'The match source is unavailable and nothing is cached',
  })
  getEnce(): Promise<EnceDto> {
    return this.enceService.getEnce();
  }

  @Get('logos/:id')
  @SkipThrottle()
  @ApiOperation({
    summary: 'A team logo',
    description:
      'Copy of a team logo, by the id in the `logo` paths of GET /ence.',
  })
  @ApiParam({ name: 'id', example: '3f2a9c0d1b7e4a55' })
  @ApiResponse({ status: 200, description: 'The image' })
  @ApiNotFoundResponse({ description: 'No such logo' })
  async getLogo(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const logo = /^[0-9a-f]{16}$/.test(id)
      ? await this.cache.getLogo(id)
      : undefined;
    if (!logo) {
      throw new NotFoundException('No such logo');
    }
    res
      .set({
        'Content-Type': logo.contentType,
        'Cache-Control': 'public, max-age=604800',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(Buffer.from(logo.data, 'base64'));
  }
}
