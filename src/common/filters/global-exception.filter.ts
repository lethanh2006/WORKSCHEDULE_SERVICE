import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { normalizeRouteTemplate } from '@nrapp/observability';
import type { RequestWithContext } from '../interfaces/request-context.interface';
import { StructuredLoggerService } from '../observability/structured-logger.service';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly logger: StructuredLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const route =
      typeof request.route?.path === 'string'
        ? normalizeRouteTemplate(
            `${request.baseUrl ?? ''}${request.route.path}`,
          )
        : 'unmatched';
    const result = this.logger.handleHttpException(exception, {
      requestId: request.requestContext?.requestId,
      method: request.method,
      route,
    });

    this.adapterHost.httpAdapter.reply(
      http.getResponse(),
      result.body,
      result.statusCode,
    );
  }
}
