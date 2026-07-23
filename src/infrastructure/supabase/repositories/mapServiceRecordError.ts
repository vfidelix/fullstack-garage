import {
  createServiceRecordError,
  createServiceRecordValidationError,
  type ServiceRecordError,
} from '../../../application/service-records/serviceRecordResult';

function facts(error: unknown): { code: string | null; status: number | null } {
  if (typeof error !== 'object' || error === null) return { code: null, status: null };
  return {
    code: 'code' in error && typeof error.code === 'string' ? error.code : null,
    status: 'status' in error && typeof error.status === 'number' ? error.status : null,
  };
}

export function mapSupabaseServiceRecordError(error: unknown): ServiceRecordError {
  const { code, status } = facts(error);
  if (code !== null && ['22001', '22003', '22023', '22P02', '23502', '23505', '23514'].includes(code)) return createServiceRecordValidationError([]);
  if (code === 'P0002') return createServiceRecordError('not_found');
  if (code === '40001') return createServiceRecordError('version_conflict');
  if (code === '55000') return createServiceRecordError('lifecycle_conflict');
  if (status === 401 || status === 403 || code === '42501' || code === 'PGRST301' || code === 'PGRST302') return createServiceRecordError('unauthorized');
  return createServiceRecordError('temporary_failure');
}
