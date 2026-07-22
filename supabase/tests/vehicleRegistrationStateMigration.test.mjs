// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../migrations/20260721000100_add_vehicle_registration_state.sql',
    import.meta.url,
  ),
  'utf8',
);
const normalizedMigration = migration.replace(/\s+/gu, ' ');

describe('Vehicle registration state migration', () => {
  it('adds one nullable registration_state column for existing Vehicle rows', () => {
    expect(normalizedMigration).toContain(
      'alter table public.vehicles add column registration_state text,',
    );
    expect(migration).not.toMatch(/registration_state text not null/iu);
  });

  it('limits registration_state to approved Australian state and territory codes', () => {
    expect(normalizedMigration).toContain(
      'constraint vehicles_registration_state_valid check ( registration_state is null or registration_state in (',
    );

    for (const state of ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']) {
      expect(migration).toContain(`'${state}'`);
    }

    expect(migration).not.toMatch(/PlateAPI|lookup|provider|metadata/iu);
  });

  it('grants authenticated browsers only registration_state writes', () => {
    expect(migration).toMatch(
      /grant insert \(registration_state\)\s+on table public\.vehicles\s+to authenticated/iu,
    );
    expect(migration).toMatch(
      /grant update \(registration_state\)\s+on table public\.vehicles\s+to authenticated/iu,
    );
    expect(migration).not.toMatch(/grant[\s\S]*to anon/iu);
  });

  it('adds no duplicate uniqueness or Service Record placeholder work', () => {
    expect(migration).not.toMatch(/unique|exclude/iu);
    expect(migration).not.toMatch(
      /service_records|service_items|service_record_id|history/iu,
    );
    expect(migration).not.toMatch(/on delete cascade/iu);
  });
});
