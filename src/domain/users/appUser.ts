export type AppUserId = string;

export type AppUserRole = 'admin' | 'member';

export interface AppUser {
  readonly id: AppUserId;
  readonly displayName: string;
  readonly role: AppUserRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function isGarageAdmin(user: AppUser): boolean {
  return user.role === 'admin';
}
