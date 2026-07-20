// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationDirectory = new URL('../migrations/', import.meta.url);
const rlsMigration = readFileSync(
  new URL('20260720000400_enable_authentication_rls.sql', migrationDirectory),
  'utf8',
);
const provisioningMigration = readFileSync(
  new URL(
    '20260720000200_add_controlled_user_provisioning.sql',
    migrationDirectory,
  ),
  'utf8',
);
const helperMigration = readFileSync(
  new URL(
    '20260720000300_add_current_app_user_helpers.sql',
    migrationDirectory,
  ),
  'utf8',
);

describe('authentication row-level security migration', () => {
  it('enables RLS on both authentication-owned tables', () => {
    expect(rlsMigration).toMatch(
      /alter table public\.app_users\s+enable row level security/iu,
    );
    expect(rlsMigration).toMatch(
      /alter table public\.user_identities\s+enable row level security/iu,
    );
    expect(rlsMigration).not.toMatch(/disable row level security/iu);
  });

  it('revokes every direct table privilege from browser roles', () => {
    expect(rlsMigration).toMatch(
      /revoke all privileges\s+on table public\.app_users, public\.user_identities\s+from public, anon, authenticated/iu,
    );
    expect(rlsMigration).not.toMatch(/grant\s+(?:select|insert|update|delete|all)/iu);
  });

  it('adds no policy that could expose or mutate authentication rows', () => {
    expect(rlsMigration).not.toMatch(/create policy|alter policy|drop policy/iu);
    expect(rlsMigration).not.toMatch(/using\s*\(|with check\s*\(/iu);
    expect(rlsMigration).not.toMatch(/force row level security/iu);
  });

  it('preserves authenticated profile RPC and privileged provisioning grants', () => {
    expect(helperMigration).toMatch(
      /grant execute on function public\.get_current_app_user\(\)\s+to authenticated/iu,
    );
    expect(provisioningMigration).toMatch(
      /grant execute on function public\.provision_app_user\(uuid, text\)\s+to service_role/iu,
    );
    expect(rlsMigration).not.toMatch(/revoke[\s\S]*on function/iu);
  });
});
