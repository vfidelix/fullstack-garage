// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../migrations/20260722000200_create_service_record_management.sql', import.meta.url),
  'utf8',
);

describe('Service Record management migration', () => {
  it('creates aggregate, ordered-item, and append-only export tables', () => {
    for (const table of [
      'service_records',
      'service_record_items',
      'service_record_exports',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`, 'iu'));
    }

    expect(migration).toMatch(/foreign key \(vehicle_id, owner_id\)[\s\S]*references public\.vehicles \(id, owner_id\)/iu);
    expect(migration).toContain('check (status in (\'draft\', \'completed\'))');
    expect(migration).toContain('check (currency_code = \'AUD\')');
    expect(migration).toContain('unique (service_record_id, sort_order)');
  });

  it('keeps browser writes behind constrained, safe RPCs', () => {
    for (const operation of [
      'create_service_record_draft',
      'save_service_record_draft',
      'delete_service_record_draft',
      'complete_service_record',
      'create_service_record_export',
    ]) {
      expect(migration).toMatch(new RegExp(`create function public\\.${operation}`, 'iu'));
    }

    expect(migration).toMatch(/security definer[\s\S]*set search_path = ''/iu);
    expect(migration).toMatch(/revoke all privileges\s+on table public\.service_records, public\.service_record_items, public\.service_record_exports\s+from public, anon, authenticated/iu);
    expect(migration).toMatch(/grant select\s+on table public\.service_records, public\.service_record_items, public\.service_record_exports\s+to authenticated/iu);
    expect(migration).not.toMatch(/grant (?:insert|update|delete)[\s\S]*on table public\.service_record/iu);
  });

  it('implements global numbering, concurrency, chronology, and immutable completed history', () => {
    expect(migration).toContain('create sequence public.service_record_display_number_sequence');
    expect(migration).toContain('\'SR-\' || lpad(nextval(\'public.service_record_display_number_sequence\')::text, 6, \'0\')');
    expect(migration).toContain('for update');
    expect(migration).toContain('p_expected_version = v_record.version - 1');
    expect(migration).toContain('raise exception \'Service Record version conflict.\'');
    expect(migration).toContain('raise exception \'Service Record odometer is below earlier completed history.\'');
    expect(migration).toContain('raise exception \'Service Record odometer is above later completed history.\'');
    expect(migration).toContain('service_record_completed_immutable');
    expect(migration).toContain('service_record_exports_append_only');
  });

  it('integrates archive/delete/unit lifecycle restrictions without erasing completed history', () => {
    expect(migration).toContain('delete from public.service_records');
    expect(migration).toContain('and record.status = \'draft\'');
    expect(migration).toContain('vehicle_completed_history_guard');
    expect(migration).toContain('raise exception \'Vehicle cannot be deleted while completed Service Record history exists.\'');
    expect(migration).toContain('raise exception \'Vehicle odometer unit cannot change while completed Service Record history exists.\'');
  });
});
