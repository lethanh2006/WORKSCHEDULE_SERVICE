import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { flushLoggerAndShutdownTelemetry } from '@nrapp/observability';
import { workscheduleAppLogger } from './structured-logger.service';

@Injectable()
export class TelemetryLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await flushLoggerAndShutdownTelemetry(workscheduleAppLogger, 3_000);
  }
}
