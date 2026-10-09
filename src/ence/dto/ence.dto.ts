import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnceTeamDto {
  @ApiProperty({ example: 'ENCE' })
  name: string;

  @ApiPropertyOptional({
    description:
      "Path of the team's logo, relative to the API root (e.g. https://milloin.xyz/api/). Missing when the source has no logo.",
    example: 'ence/logos/3f2a9c0d1b7e4a55',
  })
  logo?: string;
}

export class EnceStreamDto {
  @ApiProperty({ description: 'Channel name', example: 'cct_cs' })
  name: string;

  @ApiProperty({ example: 'Twitch' })
  platform: string;

  @ApiProperty({
    description: 'Language of the broadcast: fi or en',
    example: 'en',
  })
  language: string;

  @ApiProperty({ example: 'https://www.twitch.tv/cct_cs' })
  url: string;

  @ApiProperty({ description: "The tournament's own broadcast" })
  official: boolean;

  @ApiPropertyOptional({
    description: 'Viewers when the data was fetched, when the source tells',
    example: 18400,
  })
  viewers?: number;
}

export class EnceMatchDto {
  @ApiProperty({
    description: 'Start time (UTC)',
    example: '2026-10-10T15:30:00.000Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'The source reported the match as running when fetched',
  })
  live: boolean;

  @ApiProperty({ type: EnceTeamDto })
  opponent: EnceTeamDto;

  @ApiProperty({ example: 'CCT Europe Series 9 2026' })
  event: string;

  @ApiPropertyOptional({ example: 'Bo3' })
  format?: string;
}

export class EnceNextMatchDto extends EnceMatchDto {
  @ApiProperty({
    type: [EnceStreamDto],
    description:
      'Up to 5 Finnish and English streams: most viewers first when known, otherwise official ones first, then Finnish',
  })
  streams: EnceStreamDto[];
}

export class EnceResultDto {
  @ApiProperty({ example: '2026-10-07T16:00:00.000Z' })
  startTime: string;

  @ApiProperty({ type: EnceTeamDto })
  opponent: EnceTeamDto;

  @ApiProperty({ example: 'CCT Europe Series 9 2026' })
  event: string;

  @ApiProperty({ description: "ENCE's maps won", example: 2 })
  teamScore: number;

  @ApiProperty({ description: "The opponent's maps won", example: 1 })
  opponentScore: number;
}

export class EnceNewsDto {
  @ApiProperty({ example: 'ENCE qualify for the playoffs' })
  title: string;

  @ApiPropertyOptional({ example: 'Dust2.us' })
  source?: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ example: '2026-10-08T09:12:00.000Z' })
  publishedAt: string;
}

export class EnceDto {
  @ApiProperty({
    description: 'When the matches were fetched (UTC); refreshed hourly',
    example: '2026-10-09T10:12:00.000Z',
  })
  updatedAt: string;

  @ApiProperty({ description: 'Source of the matches', example: 'PandaScore' })
  source: string;

  @ApiProperty({ type: EnceTeamDto })
  team: EnceTeamDto;

  @ApiPropertyOptional({
    type: EnceNextMatchDto,
    description: 'The running or next match; missing when none is scheduled',
  })
  nextMatch?: EnceNextMatchDto;

  @ApiProperty({
    type: [EnceMatchDto],
    description: 'Up to 3 matches after the next one',
  })
  upcoming: EnceMatchDto[];

  @ApiProperty({
    type: [EnceResultDto],
    description: 'Up to 3 latest results, latest first',
  })
  results: EnceResultDto[];

  @ApiProperty({
    type: [EnceNewsDto],
    description: 'Up to 3 latest news items about ENCE, latest first',
  })
  news: EnceNewsDto[];
}
