import '@nrapp/observability/register';

import dns from 'node:dns';
import {
  flushLoggerAndShutdownTelemetry,
  logAndRecordException,
} from '@nrapp/observability';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appLogger, nestLogger } from './common/observability/app-logger';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: nestLogger,
  });
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 5004);
}

void bootstrap().catch(async (error: unknown) => {
  logAndRecordException(
    appLogger,
    'process.bootstrap.failed',
    error,
    {},
    {
      message: 'Không thể khởi động dịch vụ lịch làm việc',
      classification: {
        statusCode: 500,
        code: 'BOOTSTRAP_FAILED',
        expected: false,
        retryable: false,
        logLevel: 'fatal',
      },
    },
  );
  await flushLoggerAndShutdownTelemetry(appLogger, 3_000);
  process.exitCode = 1;
});
