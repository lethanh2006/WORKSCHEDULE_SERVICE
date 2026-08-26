import '@nrapp/observability/register';

import dns from 'node:dns';
import {
  logAndRecordException,
  PinoNestLogger,
  shutdownTelemetry,
} from '@nrapp/observability';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { workscheduleAppLogger } from './common/observability/structured-logger.service';
import { toError } from './common/utils/error.util';

const rootLogger = workscheduleAppLogger;

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new PinoNestLogger(rootLogger, 'NestApplication'),
  });
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 5004);
}

void bootstrap().catch(async (reason: unknown) => {
  const error = toError(reason);
  logAndRecordException(
    rootLogger,
    'service.bootstrap.failed',
    error,
    {},
    {
      classification: {
        statusCode: 500,
        code: 'BOOTSTRAP_FAILED',
        expected: false,
        retryable: false,
        logLevel: 'fatal',
        safeMessage: 'Service bootstrap failed',
      },
    },
  );
  await shutdownTelemetry(2_000);
  process.exitCode = 1;
});
