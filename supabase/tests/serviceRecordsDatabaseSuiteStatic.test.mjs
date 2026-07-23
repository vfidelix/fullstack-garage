// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const suite = readFileSync(new URL('./service_records.test.sql', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../migrations/20260722000200_create_service_record_management.sql', import.meta.url),
  'utf8',
);

describe('Service Record database coverage source', () => {
  it('is transactional, deterministic, and has the declared assertion count', () => {
    expect(suite).toMatch(/^begin;/iu);
    expect(suite).toMatch(/rollback;\s*$/iu);
    expect(suite).toContain('extensions.plan(35)');
    expect(suite).toContain('Synthetic Service Record Admin');
  });

  it('covers constraints, ownership, RLS identities, item-parent access, and append-only history', () => {
    for (const assertion of [
      'draft ownership is derived',
      'draft item ordering must be contiguous',
      'direct item writes are denied',
      'mapped non-admin cannot',
      'authenticated unmapped identity cannot',
      'unauthenticated caller cannot',
      'completed aggregate trigger rejects',
      'completed item trigger rejects',
      'append-only export trigger rejects',
    ]) {
      expect(suite).toContain(assertion);
    }
  });

  it('covers archive rollback, lifecycle conflicts, stale saves, retry rules, and numbering', () => {
    for (const assertion of [
      'archive failure rolls back',
      'archive rollback preserves',
      'blocks Vehicle odometer-unit changes',
      'blocks Vehicle deletion',
      'stale saves are rejected',
      'approved completion retry version is idempotent',
      'unapproved completion retry version conflicts',
      'immutable global display number',
    ]) {
      expect(suite).toContain(assertion);
    }

    expect(migration).toMatch(/select \* into v_record from public\.service_records where id = p_record_id for update/iu);
    expect(migration).toContain('create function public.assert_service_record_odometer_chronology');
    expect(migration).toContain('perform public.assert_service_record_odometer_chronology(v_record.vehicle_id, v_record.service_date, v_record.odometer, p_record_id)');
    expect(migration).toContain('nextval(\'public.service_record_display_number_sequence\')');
  });
});
