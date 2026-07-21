// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../migrations/20260720000600_create_vehicle_management.sql',
    import.meta.url,
  ),
  'utf8',
);
const normalizedMigration = migration.replace(/\s+/gu, ' ');

describe('Vehicle management migration', () => {
  it('creates the complete provider-neutral Vehicle schema', () => {
    expect(migration).toMatch(/create table public\.vehicles\s*\(/iu);

    for (const column of [
      'id uuid primary key default gen_random_uuid()',
      'owner_id uuid not null default public.current_app_user_id()',
      'make text not null',
      'model text not null',
      'year integer',
      'registration text',
      'vin text',
      'current_odometer bigint',
      `odometer_unit text not null default 'km'`,
      'engine text',
      'notes text',
      'archived_at timestamptz',
      'created_at timestamptz not null default now()',
      'updated_at timestamptz not null default now()',
    ]) {
      expect(migration).toContain(column);
    }
  });

  it('enforces ownership and the future composite relationship key', () => {
    expect(migration).toMatch(
      /constraint vehicles_owner_id_fkey\s+foreign key \(owner_id\)\s+references public\.app_users \(id\)\s+on delete restrict/iu,
    );
    expect(migration).toMatch(
      /constraint vehicles_id_owner_id_key\s+unique \(id, owner_id\)/iu,
    );
  });

  it('enforces required text, exact length limits, and the fixed year range', () => {
    expect(migration).toMatch(
      /constraint vehicles_make_not_blank\s+check \(make ~ '\[\^\[:space:\]\]'\)/iu,
    );
    expect(migration).toMatch(
      /constraint vehicles_model_not_blank\s+check \(model ~ '\[\^\[:space:\]\]'\)/iu,
    );

    for (const field of ['make', 'model', 'registration', 'vin', 'engine']) {
      expect(normalizedMigration).toContain(
        `constraint vehicles_${field}_length check (char_length(${field}) <= 50)`,
      );
    }

    expect(normalizedMigration).toContain(
      'constraint vehicles_notes_length check (char_length(notes) <= 500)',
    );
    expect(normalizedMigration).toContain(
      'constraint vehicles_year_range check (year between 1900 and 9999)',
    );
  });

  it('enforces whole non-negative odometers and supported units', () => {
    expect(migration).toContain('current_odometer bigint');
    expect(normalizedMigration).toContain(
      'constraint vehicles_current_odometer_range check (current_odometer between 0 and 9007199254740991)',
    );
    expect(normalizedMigration).toContain(
      `constraint vehicles_odometer_unit_valid check (odometer_unit in ('km', 'mi'))`,
    );
  });

  it('adds owner-scoped and active owner-scoped indexes', () => {
    expect(migration).toMatch(
      /create index vehicles_owner_id_idx\s+on public\.vehicles \(owner_id\)/iu,
    );
    expect(migration).toMatch(
      /create index vehicles_active_owner_id_idx\s+on public\.vehicles \(owner_id\)\s+where archived_at is null/iu,
    );
  });

  it('enables RLS and derives all browser authorization from reviewed helpers', () => {
    expect(migration).toMatch(
      /alter table public\.vehicles\s+enable row level security/iu,
    );
    expect(migration.match(/create policy vehicles_/giu)).toHaveLength(4);
    expect(migration).toMatch(
      /create policy vehicles_select_admin[\s\S]*for select[\s\S]*using \(public\.is_garage_admin\(\)\)/iu,
    );
    expect(migration).toMatch(
      /create policy vehicles_insert_admin[\s\S]*for insert[\s\S]*with check \([\s\S]*public\.is_garage_admin\(\)[\s\S]*owner_id = public\.current_app_user_id\(\)[\s\S]*\)/iu,
    );
    expect(migration).toMatch(
      /create policy vehicles_update_admin[\s\S]*for update[\s\S]*using \(public\.is_garage_admin\(\)\)[\s\S]*with check \(public\.is_garage_admin\(\)\)/iu,
    );
    expect(migration).toMatch(
      /create policy vehicles_delete_admin[\s\S]*for delete[\s\S]*using \(public\.is_garage_admin\(\)\)/iu,
    );
  });

  it('grants authenticated browsers only required table capabilities', () => {
    expect(migration).toMatch(
      /revoke all privileges\s+on table public\.vehicles\s+from public, anon, authenticated/iu,
    );
    expect(migration).toMatch(
      /grant select, delete\s+on table public\.vehicles\s+to authenticated/iu,
    );
    expect(migration).toMatch(
      /grant insert \(\s*make,\s*model,\s*year,\s*registration,\s*vin,\s*current_odometer,\s*odometer_unit,\s*engine,\s*notes\s*\)\s+on table public\.vehicles\s+to authenticated/iu,
    );
    expect(migration).toMatch(
      /grant update \(\s*make,\s*model,\s*year,\s*registration,\s*vin,\s*current_odometer,\s*odometer_unit,\s*engine,\s*notes\s*\)\s+on table public\.vehicles\s+to authenticated/iu,
    );

    for (const protectedColumn of [
      'id',
      'owner_id',
      'archived_at',
      'created_at',
      'updated_at',
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`grant (?:insert|update) \\([^)]*${protectedColumn}`, 'iu'),
      );
    }

    expect(migration).not.toMatch(/grant[\s\S]*to anon/iu);
  });

  it('maintains update time without exposing the system column', () => {
    expect(migration).toContain(
      'create function public.set_vehicle_updated_at()',
    );
    expect(migration).toContain('new.updated_at = statement_timestamp()');
    expect(migration).toMatch(
      /create trigger set_vehicle_updated_at\s+before update on public\.vehicles\s+for each row\s+execute function public\.set_vehicle_updated_at\(\)/iu,
    );
    expect(migration).toMatch(
      /revoke all on function public\.set_vehicle_updated_at\(\)\s+from public, anon, authenticated, service_role/iu,
    );
  });

  it('implements atomic archive and restore operations with minimum grants', () => {
    for (const operation of ['archive', 'restore']) {
      expect(migration).toContain(
        `create function public.${operation}_vehicle(p_vehicle_id uuid)`,
      );
      expect(migration).toMatch(
        new RegExp(
          `create function public\\.${operation}_vehicle\\(p_vehicle_id uuid\\)[\\s\\S]*security definer[\\s\\S]*set search_path = ''[\\s\\S]*if not public\\.is_garage_admin\\(\\)`,
          'iu',
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on function public\\.${operation}_vehicle\\(uuid\\)[\\s\\S]*from public, anon, service_role`,
          'iu',
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `grant execute on function public\\.${operation}_vehicle\\(uuid\\)[\\s\\S]*to authenticated`,
          'iu',
        ),
      );
    }

    expect(migration).toMatch(
      /update public\.vehicles as vehicle\s+set archived_at = statement_timestamp\(\)[\s\S]*vehicle\.archived_at is null/iu,
    );
    expect(migration).toMatch(
      /update public\.vehicles as vehicle\s+set archived_at = null[\s\S]*vehicle\.archived_at is not null/iu,
    );
  });

  it('keeps every security-definer function on a fixed empty search path', () => {
    const securityDefinerCount = migration.match(/security definer/giu)?.length ?? 0;
    const fixedSearchPathCount = migration.match(/set search_path = ''/gu)?.length ?? 0;

    expect(securityDefinerCount).toBe(2);
    expect(fixedSearchPathCount).toBeGreaterThanOrEqual(securityDefinerCount);
  });

  it('adds no duplicate uniqueness or premature Service Record persistence', () => {
    const uniquenessConstraints = migration.match(/unique \([^)]+\)/giu) ?? [];

    expect(uniquenessConstraints).toEqual(['unique (id, owner_id)']);
    expect(migration).not.toMatch(
      /unique \([^)]*(?:make|model|registration|vin)/iu,
    );
    expect(migration).not.toMatch(
      /service_records|service_items|service_record_id|history/iu,
    );
    expect(migration).not.toMatch(/on delete cascade/iu);
  });
});
