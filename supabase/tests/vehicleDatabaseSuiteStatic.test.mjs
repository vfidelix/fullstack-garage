// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const databaseSuite = readFileSync(
  new URL('./vehicle_management.test.sql', import.meta.url),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

describe('Vehicle database integration suite source', () => {
  it('keeps live execution behind the Supabase CLI command', () => {
    expect(packageJson.scripts['test:db']).toBe('supabase test db');
  });

  it('is transactional, deterministic, and synthetic', () => {
    expect(databaseSuite).toMatch(/^begin;/iu);
    expect(databaseSuite).toMatch(/rollback;\s*$/iu);
    expect(databaseSuite).toContain('extensions.plan(75)');
    expect(databaseSuite).toContain('Synthetic Vehicle Admin');
    expect(databaseSuite).not.toMatch(
      /gmail\.com|@googlemail|service[_-]?role[_-]?key/iu,
    );
  });

  it('covers each operation for the complete role matrix', () => {
    for (const caller of [
      'mapped admin',
      'mapped non-admin',
      'authenticated unmapped identity',
      'unauthenticated caller',
    ]) {
      for (const operation of [
        'list active',
        'list archived',
        'get',
        'create',
        'update',
        'archive',
        'restore',
        'delete',
      ]) {
        expect(databaseSuite.toLowerCase()).toMatch(
          new RegExp(`${caller}[^'\\n]*${operation}`, 'u'),
        );
      }
    }
  });

  it('checks denied zero-row updates from a privileged context', () => {
    for (const caller of [
      'mapped non-admin',
      'authenticated unmapped identity',
    ]) {
      const updateAttempt = databaseSuite.indexOf(
        `${caller} update cannot reach a Vehicle row`,
      );
      const privilegedContext = databaseSuite.indexOf(
        'reset role;',
        updateAttempt,
      );
      const unchangedAssertion = databaseSuite.indexOf(
        `${caller} update leaves the protected Vehicle row unchanged`,
        privilegedContext,
      );
      const callerContextRestored = databaseSuite.indexOf(
        'set local role authenticated;',
        unchangedAssertion,
      );

      expect(updateAttempt).toBeGreaterThan(-1);
      expect(privilegedContext).toBeGreaterThan(updateAttempt);
      expect(unchangedAssertion).toBeGreaterThan(privilegedContext);
      expect(callerContextRestored).toBeGreaterThan(unchangedAssertion);

      const privilegedAssertion = databaseSuite.slice(
        privilegedContext,
        callerContextRestored,
      );

      expect(privilegedAssertion).toMatch(
        /select model\s+from public\.vehicles\s+where id = '23000000-0000-4000-8000-000000000001'\s+\),\s+'Active Model'::text,/u,
      );
    }
  });

  it('covers protected owner and system fields', () => {
    for (const field of [
      'owner_id',
      'id',
      'archived_at',
      'created_at',
      'updated_at',
    ]) {
      expect(databaseSuite).toContain(field);
    }

    expect(databaseSuite).toContain(
      'caller-supplied owner cannot expand create access',
    );
    expect(databaseSuite).toContain(
      'caller-supplied owner cannot expand update access',
    );
    expect(databaseSuite).toContain(
      'caller cannot bypass the archive RPC through the table',
    );
  });

  it('covers every schema constraint and accepted boundary', () => {
    for (const assertion of [
      'owner foreign-key constraint',
      'composite Vehicle and owner uniqueness constraint',
      'make must not be blank',
      'make cannot exceed 50 characters',
      'model must not be blank',
      'model cannot exceed 50 characters',
      'year cannot be below 1900',
      'year cannot exceed 9999',
      'registration cannot exceed 50 characters',
      'VIN cannot exceed 50 characters',
      'odometer cannot be negative',
      'odometer cannot exceed the safe integer maximum',
      'odometer unit must be km or mi',
      'engine cannot exceed 50 characters',
      'notes cannot exceed 500 characters',
      'lower boundaries and exact text limits are accepted',
      'upper year boundary is accepted and odometer unit defaults to km',
      'safe integer odometer maximum is accepted',
      'non-BMP text one code point over the limit is rejected',
      'non-BMP notes one code point over the limit are rejected',
      'non-BMP exact code-point limits are accepted for every text field',
    ]) {
      expect(databaseSuite).toContain(assertion);
    }

    expect(databaseSuite).toMatch(/repeat\(U&'\\\+01F600', 50\)/u);
    expect(databaseSuite).toContain('char_length(notes) = 500');
  });

  it('covers active and archived behavior plus direct table and RPC access', () => {
    expect(databaseSuite).toContain('archive rejects an already archived Vehicle');
    expect(databaseSuite).toContain('restore rejects an already active Vehicle');
    expect(databaseSuite).toContain('archive rejects a missing Vehicle');
    expect(databaseSuite).toContain('restore rejects a missing Vehicle');
    expect(databaseSuite).toContain('has_table_privilege(\'authenticated\'');
    expect(databaseSuite).toContain('has_table_privilege(\'anon\'');
    expect(databaseSuite).toContain(
      'has_function_privilege(\n    \'authenticated\'',
    );
    expect(databaseSuite).toContain('has_function_privilege(\'anon\'');
  });

  it('covers allowed duplicates, deletion, and odometer-unit changes', () => {
    expect(databaseSuite).toContain(
      'duplicate-looking Vehicles are stored without a uniqueness error',
    );
    expect(databaseSuite).toContain(
      'mapped admin can currently change the odometer unit',
    );
    expect(databaseSuite).toContain(
      'mapped admin can currently permanently delete the Vehicle fixture',
    );
  });

  it('does not claim deferred persistence behavior', () => {
    expect(databaseSuite).not.toMatch(
      /service[_ ]records?|history|delete (?:block|conflict)|unit (?:lock|conflict)/iu,
    );
  });
});
