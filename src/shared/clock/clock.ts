import { Global, Module } from '@nestjs/common';

/**
 * The current time. Services take it from here instead of Date.now(), so
 * tests and tools can fix the time.
 */
export abstract class Clock {
  /** Milliseconds since the epoch */
  abstract now(): number;
}

export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}

export const systemClock = new SystemClock();

@Global()
@Module({
  providers: [{ provide: Clock, useValue: systemClock }],
  exports: [Clock],
})
export class ClockModule {}
