import type { ServiceRecordValidationIssue } from '../../domain/service-records/serviceRecord';

export type ServiceRecordErrorCategory
  = | 'validation'
    | 'not_found'
    | 'unauthorized'
    | 'version_conflict'
    | 'lifecycle_conflict'
    | 'chronology_conflict'
    | 'temporary_failure';

export interface ServiceRecordValidationError {
  readonly category: 'validation';
  readonly message: string;
  readonly issues: readonly ServiceRecordValidationIssue[];
}

export type ServiceRecordOperationErrorCategory = Exclude<
  ServiceRecordErrorCategory,
  'validation'
>;

export interface ServiceRecordOperationError {
  readonly category: ServiceRecordOperationErrorCategory;
  readonly message: string;
}

export type ServiceRecordError
  = | ServiceRecordValidationError
    | ServiceRecordOperationError;

export type ServiceRecordResult<T>
  = | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: ServiceRecordError };

const serviceRecordErrorMessages: Readonly<
  Record<ServiceRecordOperationErrorCategory, string>
> = {
  not_found: 'This Service Record could not be found.',
  unauthorized: 'You do not have access to manage Service Records.',
  version_conflict: 'This Service Record changed elsewhere. Reload it and try again.',
  lifecycle_conflict: 'This Service Record cannot be changed in its current state.',
  chronology_conflict: 'This Service Record conflicts with the Vehicle service history.',
  temporary_failure: 'Service Records are temporarily unavailable. Please try again.',
};

export function createServiceRecordError(
  category: ServiceRecordOperationErrorCategory,
): ServiceRecordOperationError {
  return { category, message: serviceRecordErrorMessages[category] };
}

export function createServiceRecordValidationError(
  issues: readonly ServiceRecordValidationIssue[],
): ServiceRecordValidationError {
  return {
    category: 'validation',
    message: 'Some Service Record details are invalid. Review the highlighted fields.',
    issues,
  };
}
