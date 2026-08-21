import type { RequestWithAuthenticatedUser } from "./authenticated-user.interface";

export interface RequestContext {
  requestId: string;
  startedAt: bigint;
}

export interface RequestWithContext extends RequestWithAuthenticatedUser {
  requestContext?: RequestContext;
}
