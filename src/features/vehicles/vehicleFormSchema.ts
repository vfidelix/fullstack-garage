import type { FieldError, FieldErrors, Resolver } from 'react-hook-form';
import { z } from 'zod';
import {
  VEHICLE_NOTES_MAX_LENGTH,
  VEHICLE_ODOMETER_MAX,
  VEHICLE_TEXT_MAX_LENGTH,
  VEHICLE_YEAR_MAX,
  VEHICLE_YEAR_MIN,
  countVehicleTextCharacters,
  isAustralianRegistrationState,
  type AustralianRegistrationState,
  type CreateVehicle,
  type OdometerUnit,
  type Vehicle,
} from '../../domain/vehicles/vehicle';

export interface VehicleFormValues {
  readonly make: string;
  readonly model: string;
  readonly year: string;
  readonly registration: string;
  readonly registrationState: '' | AustralianRegistrationState;
  readonly vin: string;
  readonly currentOdometer: string;
  readonly odometerUnit: OdometerUnit;
  readonly engine: string;
  readonly body: string;
  readonly notes: string;
}

const vehicleFormFields = [
  'make',
  'model',
  'year',
  'registration',
  'registrationState',
  'vin',
  'currentOdometer',
  'odometerUnit',
  'engine',
  'body',
  'notes',
] as const satisfies readonly (keyof VehicleFormValues)[];

function isVehicleFormField(value: PropertyKey): value is keyof VehicleFormValues {
  return vehicleFormFields.some((field) => field === value);
}

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function optionalInteger(value: string): number | undefined {
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : Number(normalized);
}

function optionalRegistrationState(
  value: string,
): AustralianRegistrationState | undefined {
  const normalized = value.trim().toUpperCase();
  return normalized === '' ? undefined : normalized as AustralianRegistrationState;
}

function isOdometerIntegerInRange(value: string): boolean {
  if (!/^\d+$/u.test(value)) {
    return false;
  }

  const normalized = value.replace(/^0+(?=\d)/u, '');
  const maximum = String(VEHICLE_ODOMETER_MAX);

  return normalized.length < maximum.length
    || (normalized.length === maximum.length && normalized <= maximum);
}

const rawVehicleFormSchema = z.object({
  make: z.string(),
  model: z.string(),
  year: z.string(),
  registration: z.string(),
  registrationState: z.string(),
  vin: z.string(),
  currentOdometer: z.string(),
  odometerUnit: z.enum(['km', 'mi'], {
    error: 'Select kilometres or miles.',
  }),
  engine: z.string(),
  body: z.string(),
  notes: z.string(),
});

function createVehicleFormSchema(allowProviderYear: boolean) {
  return rawVehicleFormSchema
    .superRefine((values, context) => {
      const make = values.make.trim();
      const model = values.model.trim();
      const year = values.year.trim();
      const odometer = values.currentOdometer.trim();
      const registrationState = optionalRegistrationState(values.registrationState);

      if (countVehicleTextCharacters(make) === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Make is required.',
          path: ['make'],
        });
      } else if (countVehicleTextCharacters(make) > VEHICLE_TEXT_MAX_LENGTH) {
        context.addIssue({
          code: 'custom',
          message: `Make must be ${String(VEHICLE_TEXT_MAX_LENGTH)} characters or fewer.`,
          path: ['make'],
        });
      }

      if (countVehicleTextCharacters(model) === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Model is required.',
          path: ['model'],
        });
      } else if (countVehicleTextCharacters(model) > VEHICLE_TEXT_MAX_LENGTH) {
        context.addIssue({
          code: 'custom',
          message: `Model must be ${String(VEHICLE_TEXT_MAX_LENGTH)} characters or fewer.`,
          path: ['model'],
        });
      }

      for (const [field, label] of [
        ['registration', 'Registration'],
        ['vin', 'VIN'],
        ['engine', 'Engine'],
        ['body', 'Body'],
      ] as const) {
        if (
          countVehicleTextCharacters(values[field].trim())
          > VEHICLE_TEXT_MAX_LENGTH
        ) {
          context.addIssue({
            code: 'custom',
            message: `${label} must be ${String(VEHICLE_TEXT_MAX_LENGTH)} characters or fewer.`,
            path: [field],
          });
        }
      }

      if (
        registrationState !== undefined
        && !isAustralianRegistrationState(registrationState)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Select an Australian state or territory.',
          path: ['registrationState'],
        });
      }

      if (
        countVehicleTextCharacters(values.notes.trim())
        > VEHICLE_NOTES_MAX_LENGTH
      ) {
        context.addIssue({
          code: 'custom',
          message: `Notes must be ${String(VEHICLE_NOTES_MAX_LENGTH)} characters or fewer.`,
          path: ['notes'],
        });
      }

      if (year.length > 0) {
        const invalidManualYear = !/^\d{4}$/u.test(year)
          || Number(year) < VEHICLE_YEAR_MIN
          || Number(year) > VEHICLE_YEAR_MAX;
        const invalidProviderYear = countVehicleTextCharacters(year)
          > VEHICLE_TEXT_MAX_LENGTH;

        if (allowProviderYear ? invalidProviderYear : invalidManualYear) {
          context.addIssue({
            code: 'custom',
            message: allowProviderYear
              ? `Year must be ${String(VEHICLE_TEXT_MAX_LENGTH)} characters or fewer.`
              : `Year must be exactly four digits from ${String(VEHICLE_YEAR_MIN)} to ${String(VEHICLE_YEAR_MAX)}.`,
            path: ['year'],
          });
        }
      }

      if (odometer.length > 0 && !isOdometerIntegerInRange(odometer)) {
        context.addIssue({
          code: 'custom',
          message: `Odometer must be a whole number from 0 to ${String(VEHICLE_ODOMETER_MAX)}.`,
          path: ['currentOdometer'],
        });
      }
    })
    .transform((values): CreateVehicle => {
      const year = optionalText(values.year);
      const registration = optionalText(values.registration);
      const registrationState = optionalRegistrationState(values.registrationState);
      const vin = optionalText(values.vin);
      const currentOdometer = optionalInteger(values.currentOdometer);
      const engine = optionalText(values.engine);
      const body = optionalText(values.body);
      const notes = optionalText(values.notes);

      return {
        make: values.make.trim(),
        model: values.model.trim(),
        ...(year === undefined ? {} : { year }),
        ...(registration === undefined ? {} : { registration }),
        ...(registrationState === undefined ? {} : { registrationState }),
        ...(vin === undefined ? {} : { vin }),
        ...(currentOdometer === undefined ? {} : { currentOdometer }),
        odometerUnit: values.odometerUnit,
        ...(engine === undefined ? {} : { engine }),
        ...(body === undefined ? {} : { body }),
        ...(notes === undefined ? {} : { notes }),
      };
    });
}

export const vehicleFormSchema = createVehicleFormSchema(false);

const providerYearVehicleFormSchema = createVehicleFormSchema(true);

function resolveVehicleForm(
  values: VehicleFormValues,
  allowProviderYear: boolean,
): ReturnType<Resolver<VehicleFormValues, unknown, CreateVehicle>> {
  const schema = allowProviderYear
    ? providerYearVehicleFormSchema
    : vehicleFormSchema;
  const result = schema.safeParse(values);

  if (result.success) {
    return { errors: {}, values: result.data };
  }

  const fieldErrors: Partial<Record<keyof VehicleFormValues, FieldError>> = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field !== undefined && isVehicleFormField(field) && fieldErrors[field] === undefined) {
      fieldErrors[field] = {
        message: issue.message,
        type: 'validation',
      };
    }
  }

  return {
    errors: fieldErrors as FieldErrors<VehicleFormValues>,
    values: {},
  };
}

export const vehicleFormResolver: Resolver<
  VehicleFormValues,
  unknown,
  CreateVehicle
> = (values) => {
  return resolveVehicleForm(values, false);
};

export function createVehicleFormResolver(
  allowProviderYear: boolean,
): Resolver<VehicleFormValues, unknown, CreateVehicle> {
  return (values) => resolveVehicleForm(values, allowProviderYear);
}

export function createVehicleFormDefaults(vehicle?: Vehicle): VehicleFormValues {
  return {
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? '',
    registration: vehicle?.registration ?? '',
    registrationState: vehicle?.registrationState ?? '',
    vin: vehicle?.vin ?? '',
    currentOdometer: vehicle?.currentOdometer === undefined
      ? ''
      : String(vehicle.currentOdometer),
    odometerUnit: vehicle?.odometerUnit ?? 'km',
    engine: vehicle?.engine ?? '',
    body: vehicle?.body ?? '',
    notes: vehicle?.notes ?? '',
  };
}
