// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../migrations/20260720000300_add_current_app_user_helpers.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('current application user helper migration', () => {
  it('derives the application user only from the current Supabase identity', () => {
    expect(migration).toContain('create function public.current_app_user_id()');
    expect(migration).toContain('identity.provider = \'supabase\'');
    expect(migration).toContain('identity.provider_subject = auth.uid()::text');
    expect(migration).not.toMatch(/current_app_user_id\s*\([^)]*[a-z_]+/iu);
  });

  it('exposes provider-neutral scalar ID and role results', () => {
    expect(migration).toMatch(
      /create function public\.current_app_user_id\(\)\s+returns uuid/iu,
    );
    expect(migration).toMatch(
      /create function public\.current_app_user_role\(\)\s+returns text/iu,
    );
    expect(migration).toContain('app_user.id = public.current_app_user_id()');
  });

  it('returns a complete adapter-friendly application profile shape', () => {
    expect(migration).toMatch(
      /returns table \(\s*id uuid,\s*display_name text,\s*role text,\s*created_at timestamptz,\s*updated_at timestamptz\s*\)/iu,
    );
    expect(migration).toContain('create function public.get_current_app_user()');
  });

  it('uses stable security-definer functions with fixed search paths', () => {
    expect(migration.match(/language sql/giu)).toHaveLength(3);
    expect(migration.match(/stable/giu)).toHaveLength(3);
    expect(migration.match(/security definer/giu)).toHaveLength(3);
    expect(migration.match(/set search_path = ''/gu)).toHaveLength(3);
  });

  it('grants only authenticated execution and adds no policy or admin helper', () => {
    expect(migration.match(/grant execute/giu)).toHaveLength(3);
    expect(migration.match(/to authenticated/giu)).toHaveLength(3);
    expect(migration).not.toMatch(/grant execute[\s\S]*to (?:anon|service_role)/iu);
    expect(migration).not.toMatch(/enable row level security|create policy/iu);
    expect(migration).not.toMatch(/is_(?:garage_)?admin|returns boolean/iu);
  });
});
