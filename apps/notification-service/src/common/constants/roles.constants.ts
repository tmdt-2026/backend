export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
