// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const databaseSuite = readFileSync(
  new URL('./authentication_access.test.sql', import.meta.url),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

describe('authentication database integration suite', () => {
  it('exposes the Supabase CLI database test command', () => {
    expect(packageJson.scripts['test:db']).toBe('supabase test db');
  });

  it('is transactional, deterministic, and uses synthetic identities', () => {
    expect(databaseSuite).toMatch(/^begin;/iu);
    expect(databaseSuite).toMatch(/rollback;\s*$/iu);
    expect(databaseSuite).toContain('extensions.plan(38)');
    expect(databaseSuite).toContain('10000000-0000-4000-8000-000000000001');
    expect(databaseSuite).not.toMatch(/gmail\.com|@googlemail|service[_-]?role[_-]?key/iu);
  });

  it('covers provisioning, immutable display names, and explicit-name fallback', () => {
    expect(databaseSuite).toContain('insert into auth.users');
    expect(databaseSuite).toContain('later auth-user metadata updates do not resynchronize');
    expect(databaseSuite).toContain('public.provision_app_user(');
    expect(databaseSuite).toContain('service role provisions a missing-name Google identity');
  });

  it('covers every current-user and Garage Admin identity state', () => {
    for (const scenario of [
      'mapped admin',
      'mapped member',
      'authenticated unmapped identity',
      'unauthenticated identity',
      'anonymous policy evaluation',
    ]) {
      expect(databaseSuite).toContain(scenario);
    }

    expect(databaseSuite).toContain('public.current_app_user_id()');
    expect(databaseSuite).toContain('public.current_app_user_role()');
    expect(databaseSuite).toContain('public.get_current_app_user()');
    expect(databaseSuite).toContain('public.is_garage_admin()');
  });

  it('covers direct denial and browser mutation attempts', () => {
    for (const statement of [
      'select * from public.app_users',
      'select * from public.user_identities',
      'update public.app_users set role',
      'update public.app_users set display_name',
      'update public.user_identities',
      'delete from public.user_identities',
    ]) {
      expect(databaseSuite).toContain(statement);
    }

    expect(databaseSuite).toContain('pg_temp.is_insufficient_privilege');
  });

  it('does not create out-of-scope product tables', () => {
    expect(databaseSuite).not.toMatch(
      /create table[^;]*(?:vehicles|service_records|service_items)/iu,
    );
  });
});
