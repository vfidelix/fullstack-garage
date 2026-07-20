// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../migrations/20260720000500_add_garage_admin_helper.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('Garage Admin authorization helper migration', () => {
  it('defines a zero-argument boolean helper', () => {
    expect(migration).toMatch(
      /create function public\.is_garage_admin\(\)\s+returns boolean/iu,
    );
    expect(migration).not.toMatch(/is_garage_admin\s*\([^)]*[a-z_]+/iu);
  });

  it('derives authority only from the reviewed app-owned role helper', () => {
    expect(migration).toContain('public.current_app_user_role()');
    expect(migration).toContain('= \'admin\'');
    expect(migration).toContain('coalesce(');
    expect(migration).toContain(', false)');
    expect(migration).not.toMatch(/auth\.uid|user_id|provider_subject/iu);
  });

  it('is stable and security-definer with an empty search path', () => {
    expect(migration).toContain('language sql');
    expect(migration).toContain('stable');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = \'\'');
  });

  it('allows future anon and authenticated policy evaluation only', () => {
    expect(migration).toMatch(
      /revoke all on function public\.is_garage_admin\(\)\s+from public, service_role/iu,
    );
    expect(migration).toMatch(
      /grant execute on function public\.is_garage_admin\(\)\s+to anon, authenticated/iu,
    );
    expect(migration).not.toMatch(/to service_role|to public/iu);
  });

  it('does not create policies or placeholder product tables', () => {
    expect(migration).not.toMatch(/create policy|alter policy/iu);
    expect(migration).not.toMatch(
      /(?:create|alter) table[^;]*(?:vehicles|service_records)/iu,
    );
  });
});
