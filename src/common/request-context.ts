import type { RequestWithAuthenticatedUser } from './auth';

export interface RequestContext {
  requestId: string;
}

export interface RequestWithContext extends RequestWithAuthenticatedUser {
  requestContext?: RequestContext;
}
