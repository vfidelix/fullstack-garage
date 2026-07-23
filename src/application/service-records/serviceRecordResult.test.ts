import { describe, expect, it } from 'vitest';
import type { ServiceRecordValidationIssue } from '../../domain/service-records/serviceRecord';
import {
  createServiceRecordError,
  createServiceRecordValidationError,
  type ServiceRecordErrorCategory,
  type ServiceRecordResult,
} from './serviceRecordResult';

const messages: Readonly<Record<Exclude<ServiceRecordErrorCategory, 'validation'>, string>> = {
  not_found: 'This Service Record could not be found.',
  unauthorized: 'You do not have access to manage Service Records.',
  version_conflict: 'This Service Record changed elsewhere. Reload it and try again.',
  lifecycle_conflict: 'This Service Record cannot be changed in its current state.',
  chronology_conflict: 'This Service Record conflicts with the Vehicle service history.',
  temporary_failure: 'Service Records are temporarily unavailable. Please try again.',
};

describe('Service Record application results', () => {
  it.each(Object.entries(messages))('uses safe app-owned copy for %s', (category, message) => {
    expect(createServiceRecordError(category as Exclude<ServiceRecordErrorCategory, 'validation'>))
      .toEqual({ category, message });
  });

  it('preserves structured domain validation issues without private input values', () => {
    const issues: readonly ServiceRecordValidationIssue[] = [
      { field: 'serviceDate', code: 'invalid_date' },
      { field: 'items[0].name', code: 'required' },
    ];
    expect(createServiceRecordValidationError(issues)).toEqual({
      category: 'validation',
      message: 'Some Service Record details are invalid. Review the highlighted fields.',
      issues,
    });
  });

  it('models success and failure as discriminated app-owned results', () => {
    const success: ServiceRecordResult<string> = { ok: true, value: 'record-1' };
    const failure: ServiceRecordResult<string> = {
      ok: false,
      error: createServiceRecordError('temporary_failure'),
    };
    expect(success.ok).toBe(true);
    expect(failure).toEqual({ ok: false, error: { category: 'temporary_failure', message: messages.temporary_failure } });
  });
});
