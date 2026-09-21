import type { RequestWithAuthenticatedUser } from './authenticated-user.interface';

export interface RequestContext {
  requestId: string;
}

export interface RequestWithContext extends RequestWithAuthenticatedUser {
  requestContext?: RequestContext;
}
