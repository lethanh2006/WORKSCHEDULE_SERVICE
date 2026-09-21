import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GatewaySignatureService } from '../common/security/gateway-signature.service';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import {
  StructuredLoggerService,
  LoggerLifecycleService,
} from '../common/logging/logger';
import { RequestIdMiddleware } from '../common/middleware/request-id.middleware';
import { RolesGuard } from '../common/guards/roles.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    StructuredLoggerService,
    LoggerLifecycleService,
    RolesGuard,
    GatewaySignatureService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [StructuredLoggerService, RolesGuard, GatewaySignatureService],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
