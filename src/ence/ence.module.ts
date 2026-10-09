import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { getCache } from '@vercel/functions';
import { EnceController } from './ence.controller';
import { EnceCacheService } from './ence-cache.service';
import { EnceService } from './ence.service';
import {
  ENCE_SHARED_CACHE,
  NEWS_PROVIDER,
  TEAM_DATA_PROVIDERS,
} from './interfaces/team-data.interface';
import { GoogleNewsProvider } from './providers/google-news.provider';
import { PandaScoreProvider } from './providers/pandascore.provider';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EnceController],
  providers: [
    EnceService,
    EnceCacheService,
    PandaScoreProvider,
    {
      // Match sources in priority order
      provide: TEAM_DATA_PROVIDERS,
      useFactory: (pandaScore: PandaScoreProvider) => [pandaScore],
      inject: [PandaScoreProvider],
    },
    { provide: NEWS_PROVIDER, useClass: GoogleNewsProvider },
    {
      // Vercel runtime cache; process memory outside Vercel
      provide: ENCE_SHARED_CACHE,
      useFactory: () => getCache({ namespace: 'milloin-server' }),
    },
  ],
})
export class EnceModule {}
