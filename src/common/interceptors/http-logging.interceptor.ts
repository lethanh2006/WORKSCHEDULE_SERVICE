import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { RequestWithContext } from "../interfaces/request-context.interface";
import { StructuredLoggerService } from "../observability/structured-logger.service";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        this.logger.info("http_request_completed", {
          requestId: request.requestContext?.requestId ?? "unknown",
          userId: request.user?._id ?? request.user?.id,
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode: response.statusCode,
          durationMs: request.requestContext
            ? Number(
                process.hrtime.bigint() - request.requestContext.startedAt,
              ) / 1e6
            : 0,
        });
      }),
    );
  }
}
