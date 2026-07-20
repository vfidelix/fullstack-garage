// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../migrations/20260720000200_add_controlled_user_provisioning.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('controlled authentication provisioning migration', () => {
  it('provisions only the deny-by-default member shape', () => {
    expect(migration).toContain('insert into public.app_users (display_name)');
    expect(migration).not.toMatch(/insert into public\.app_users \([^)]*role/iu);
    expect(migration).toContain('\'supabase\'');
    expect(migration).toContain('p_auth_user_id::text');
  });

  it('limits automatic provisioning to new Google auth users', () => {
    expect(migration).toContain('new.raw_app_meta_data ->> \'provider\'');
    expect(migration).toContain('is distinct from \'google\'');
    expect(migration).toContain('new.raw_user_meta_data ->> \'full_name\'');
    expect(migration).toContain('new.raw_user_meta_data ->> \'name\'');
    expect(migration).toMatch(/after insert on auth\.users/iu);
    expect(migration).not.toMatch(/after update on auth\.users/iu);
    expect(migration).not.toMatch(/update public\.app_users/iu);
  });

  it('requires an explicit nonblank name for privileged provisioning', () => {
    expect(migration).toContain('p_display_name text');
    expect(migration).toContain('raise exception \'A nonblank display name is required.\'');
    expect(migration).toContain('raise exception \'Authentication user is not a Google identity.\'');
    expect(migration).toContain('if v_display_name = \'\' then');
  });

  it('serializes retries and reuses the existing immutable identity mapping', () => {
    const lockPosition = migration.indexOf('pg_advisory_xact_lock');
    const identityLookupPosition = migration.indexOf('select identity.user_id');
    const appUserInsertPosition = migration.indexOf('insert into public.app_users');

    expect(lockPosition).toBeGreaterThan(-1);
    expect(identityLookupPosition).toBeGreaterThan(lockPosition);
    expect(appUserInsertPosition).toBeGreaterThan(identityLookupPosition);
    expect(migration).not.toMatch(/update public\.user_identities/iu);
  });

  it('uses fixed search paths and denies browser execution', () => {
    expect(migration.match(/security definer/giu)).toHaveLength(2);
    expect(migration.match(/set search_path = ''/gu)).toHaveLength(2);
    expect(migration).toMatch(
      /revoke all on function public\.provision_app_user\(uuid, text\)[\s\S]*from anon, authenticated/iu,
    );
    expect(migration).toMatch(
      /grant execute on function public\.provision_app_user\(uuid, text\)[\s\S]*to service_role/iu,
    );
    expect(migration).not.toMatch(/grant execute[\s\S]*to (?:anon|authenticated)/iu);
  });
});
