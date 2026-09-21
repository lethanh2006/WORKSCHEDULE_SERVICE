import type { RequestWithContext } from '../interfaces/request-context.interface';

export interface ForwardedRequestContext {
  requestId: string;
  userPayload?: string;
}

export function forwardedRequestContext(
  request: RequestWithContext,
): ForwardedRequestContext {
  const userPayload = request.headers['x-user-payload'];
  return {
    requestId: request.requestContext?.requestId ?? '',
    ...(typeof userPayload === 'string' ? { userPayload } : {}),
  };
}
