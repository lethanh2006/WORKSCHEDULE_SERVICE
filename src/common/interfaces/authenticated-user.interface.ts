import type { Request } from 'express';

export interface AuthenticatedUser extends Record<string, unknown> {
  _id?: string;
  id?: string;
  role?: string;
}

export interface RequestWithAuthenticatedUser extends Request {
  user?: AuthenticatedUser;
}
