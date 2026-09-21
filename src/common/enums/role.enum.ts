export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CHEF = 'chef',
  USER = 'user',
}

export const SCHEDULE_MANAGERS = [Role.ADMIN, Role.MANAGER, Role.CHEF];
