import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CHEF = 'chef',
  USER = 'user',
}

export const SCHEDULE_MANAGERS = [Role.ADMIN, Role.MANAGER, Role.CHEF];

export interface AuthenticatedUser extends Record<string, unknown> {
  _id?: string;
  id?: string;
  role?: string;
}

export interface RequestWithAuthenticatedUser extends Request {
  user?: AuthenticatedUser;
}

export function parseAuthenticatedUser(
  value: unknown,
): AuthenticatedUser | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  const id = typeof record._id === 'string' ? record._id : record.id;
  if (typeof id !== 'string' || !id) return null;
  if (record.role !== undefined && typeof record.role !== 'string') return null;
  return record;
}

export function authenticatedUserId(user: AuthenticatedUser): string {
  return String(user._id ?? user.id);
}

export const AUTHENTICATED_KEY = 'authenticated';
export const ROLES_KEY = 'roles';
export const Authenticated = () => SetMetadata(AUTHENTICATED_KEY, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
