import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { RequestWithContext } from "../interfaces/request-context.interface";
import { StructuredLoggerService } from "../observability/structured-logger.service";
import { toError } from "../utils/error.util";

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
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = toError(exception);
    const details = {
      requestId: request.requestContext?.requestId ?? "unknown",
      userId: request.user?._id ?? request.user?.id,
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode: status,
      durationMs: request.requestContext
        ? Number(process.hrtime.bigint() - request.requestContext.startedAt) /
          1e6
        : 0,
      errorName: error.name,
      message: error.message,
    };
    if (status >= 500)
      this.logger.error("http_request_failed", details, error.stack);
    else this.logger.warn("http_request_rejected", details);
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    this.adapterHost.httpAdapter.reply(
      http.getResponse(),
      body !== null && typeof body === "object"
        ? body
        : {
            statusCode: status,
            message: body ?? "Internal server error",
            requestId: request.requestContext?.requestId ?? "unknown",
          },
      status,
    );
  }
}
