import { describe, expect, it } from 'vitest';
import { isGarageAdmin, type AppUser, type AppUserRole } from './appUser';

function buildAppUser(role: AppUserRole): AppUser {
  return {
    id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
    displayName: 'Garage Operator',
    role,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

describe('isGarageAdmin', () => {
  it('recognizes an application user with the admin role', () => {
    expect(isGarageAdmin(buildAppUser('admin'))).toBe(true);
  });

  it('denies an application user with the reserved member role', () => {
    expect(isGarageAdmin(buildAppUser('member'))).toBe(false);
  });
});
