// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../migrations/20260722000100_add_vehicle_text_year_and_body.sql',
    import.meta.url,
  ),
  'utf8',
);
const normalizedMigration = migration.replace(/\s+/gu, ' ');

describe('Vehicle text Year and Body migration', () => {
  it('converts existing integer years to equivalent text in one forward migration', () => {
    expect(normalizedMigration).toContain(
      'alter table public.vehicles drop constraint vehicles_year_range, alter column year type text using year::text,',
    );
  });

  it('adds nullable bounded Year and Body constraints', () => {
    expect(normalizedMigration).toContain(
      `constraint vehicles_year_not_blank check (year is null or year ~ '[^[:space:]]')`,
    );
    expect(normalizedMigration).toContain(
      'constraint vehicles_year_length check (char_length(year) <= 50)',
    );
    expect(normalizedMigration).toContain('add column body text');
    expect(normalizedMigration).toContain(
      'constraint vehicles_body_length check (char_length(body) <= 50)',
    );
  });

  it('grants only the new Body write capability while retaining existing Year grants', () => {
    expect(migration).toMatch(
      /grant insert \(body\)\s+on table public\.vehicles\s+to authenticated/iu,
    );
    expect(migration).toMatch(
      /grant update \(body\)\s+on table public\.vehicles\s+to authenticated/iu,
    );
    expect(migration).not.toMatch(/grant[\s\S]*to (?:anon|public)/iu);
    expect(migration).not.toMatch(/revoke/iu);
  });

  it('does not replace RLS, policies, functions, triggers, indexes, or ownership', () => {
    expect(migration).not.toMatch(
      /create policy|drop policy|row level security|create function|drop function|create trigger|drop trigger|create index|drop index|owner to/iu,
    );
  });
});
