import { Save } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import {
  AUSTRALIAN_REGISTRATION_STATES,
  VEHICLE_NOTES_MAX_LENGTH,
  VEHICLE_ODOMETER_MAX,
  VEHICLE_TEXT_MAX_LENGTH,
  countVehicleTextCharacters,
  type CreateVehicle,
  type Vehicle,
} from '../../domain/vehicles/vehicle';
import { VehicleFeatureError } from './vehicleQueries';
import { getSafeVehicleErrorMessage } from './vehicleErrorMessages';
import {
  createVehicleFormDefaults,
  vehicleFormResolver,
  type VehicleFormValues,
} from './vehicleFormSchema';
import styles from './VehicleForm.module.css';

interface VehicleFormProps {
  readonly initialVehicle?: Vehicle;
  readonly onSubmit: (input: CreateVehicle) => Promise<void>;
  readonly submitLabel: string;
}

const validationMessages = {
  required: 'This field is required.',
  too_long: 'This value is too long.',
  invalid_year: 'Enter a whole-number year from 1900 to 9999.',
  invalid_registration_state: 'Select an Australian state or territory.',
  invalid_odometer: 'Enter a non-negative whole number.',
  invalid_odometer_unit: 'Select kilometres or miles.',
} as const;

interface CharacterCountProps {
  readonly id: string;
  readonly maximum: number;
  readonly value: string;
}

function CharacterCount({ id, maximum, value }: CharacterCountProps) {
  return (
    <p className={styles.characterCount} id={id}>
      {`${String(countVehicleTextCharacters(value.trim()))} / ${String(maximum)} characters`}
    </p>
  );
}

function describedBy(countId: string, errorId: string, hasError: boolean): string {
  return hasError ? `${countId} ${errorId}` : countId;
}

export function VehicleForm({
  initialVehicle,
  onSubmit,
  submitLabel,
}: VehicleFormProps) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<VehicleFormValues, unknown, CreateVehicle>({
    defaultValues: createVehicleFormDefaults(initialVehicle),
    mode: 'onBlur',
    resolver: vehicleFormResolver,
  });
  const values = useWatch({ control });

  const submit = handleSubmit(async (input) => {
    try {
      await onSubmit(input);
    } catch (error: unknown) {
      if (error instanceof VehicleFeatureError && error.category === 'validation') {
        const issues = error.issues ?? [];

        if (issues.length === 0) {
          setError('root.server', {
            message: getSafeVehicleErrorMessage('validation'),
            type: 'server',
          });
          return;
        }

        for (const [index, issue] of issues.entries()) {
          setError(issue.field, {
            message: validationMessages[issue.code],
            type: 'server',
          }, { shouldFocus: index === 0 });
        }
        return;
      }

      const message = error instanceof VehicleFeatureError
        ? getSafeVehicleErrorMessage(error.category)
        : 'Vehicles are temporarily unavailable. Please try again.';
      setError('root.server', { message, type: 'server' });
    }
  });

  return (
    <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="vehicle-make">Make</label>
          <input
            {...register('make')}
            aria-describedby={describedBy(
              'vehicle-make-count',
              'vehicle-make-error',
              errors.make !== undefined,
            )}
            aria-invalid={errors.make !== undefined}
            autoComplete="off"
            id="vehicle-make"
          />
          <CharacterCount
            id="vehicle-make-count"
            maximum={VEHICLE_TEXT_MAX_LENGTH}
            value={values.make ?? ''}
          />
          {errors.make?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-make-error">
              {errors.make.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-model">Model</label>
          <input
            {...register('model')}
            aria-describedby={describedBy(
              'vehicle-model-count',
              'vehicle-model-error',
              errors.model !== undefined,
            )}
            aria-invalid={errors.model !== undefined}
            autoComplete="off"
            id="vehicle-model"
          />
          <CharacterCount
            id="vehicle-model-count"
            maximum={VEHICLE_TEXT_MAX_LENGTH}
            value={values.model ?? ''}
          />
          {errors.model?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-model-error">
              {errors.model.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-year">Year</label>
          <input
            {...register('year')}
            aria-describedby={errors.year === undefined ? undefined : 'vehicle-year-error'}
            aria-invalid={errors.year !== undefined}
            id="vehicle-year"
            inputMode="numeric"
            max={9999}
            min={1900}
            step={1}
            type="number"
          />
          {errors.year?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-year-error">
              {errors.year.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-registration">Registration</label>
          <input
            {...register('registration')}
            aria-describedby={describedBy(
              'vehicle-registration-count',
              'vehicle-registration-error',
              errors.registration !== undefined,
            )}
            aria-invalid={errors.registration !== undefined}
            autoComplete="off"
            id="vehicle-registration"
          />
          <CharacterCount
            id="vehicle-registration-count"
            maximum={VEHICLE_TEXT_MAX_LENGTH}
            value={values.registration ?? ''}
          />
          {errors.registration?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-registration-error">
              {errors.registration.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-registration-state">Registration state</label>
          <select
            {...register('registrationState')}
            aria-describedby={errors.registrationState === undefined
              ? undefined
              : 'vehicle-registration-state-error'}
            aria-invalid={errors.registrationState !== undefined}
            id="vehicle-registration-state"
          >
            <option value="">Not recorded</option>
            {AUSTRALIAN_REGISTRATION_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {errors.registrationState?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-registration-state-error">
              {errors.registrationState.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-vin">VIN</label>
          <input
            {...register('vin')}
            aria-describedby={describedBy(
              'vehicle-vin-count',
              'vehicle-vin-error',
              errors.vin !== undefined,
            )}
            aria-invalid={errors.vin !== undefined}
            autoComplete="off"
            id="vehicle-vin"
          />
          <CharacterCount
            id="vehicle-vin-count"
            maximum={VEHICLE_TEXT_MAX_LENGTH}
            value={values.vin ?? ''}
          />
          {errors.vin?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-vin-error">
              {errors.vin.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-odometer">Current odometer</label>
          <input
            {...register('currentOdometer')}
            aria-describedby={errors.currentOdometer === undefined
              ? undefined
              : 'vehicle-odometer-error'}
            aria-invalid={errors.currentOdometer !== undefined}
            id="vehicle-odometer"
            inputMode="numeric"
            max={VEHICLE_ODOMETER_MAX}
            min={0}
            step={1}
            type="number"
          />
          {errors.currentOdometer?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-odometer-error">
              {errors.currentOdometer.message}
            </p>
          )}
        </div>

        <fieldset className={`${styles.field ?? ''} ${styles.unitField ?? ''}`}>
          <legend>Odometer unit</legend>
          <div className={styles.segmentedControl}>
            <label>
              <input {...register('odometerUnit')} type="radio" value="km" />
              <span>Kilometres</span>
            </label>
            <label>
              <input {...register('odometerUnit')} type="radio" value="mi" />
              <span>Miles</span>
            </label>
          </div>
          {errors.odometerUnit?.message !== undefined && (
            <p className={styles.fieldError}>{errors.odometerUnit.message}</p>
          )}
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="vehicle-engine">Engine</label>
          <input
            {...register('engine')}
            aria-describedby={describedBy(
              'vehicle-engine-count',
              'vehicle-engine-error',
              errors.engine !== undefined,
            )}
            aria-invalid={errors.engine !== undefined}
            autoComplete="off"
            id="vehicle-engine"
          />
          <CharacterCount
            id="vehicle-engine-count"
            maximum={VEHICLE_TEXT_MAX_LENGTH}
            value={values.engine ?? ''}
          />
          {errors.engine?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-engine-error">
              {errors.engine.message}
            </p>
          )}
        </div>

        <div className={`${styles.field ?? ''} ${styles.notesField ?? ''}`}>
          <label htmlFor="vehicle-notes">Notes</label>
          <textarea
            {...register('notes')}
            aria-describedby={describedBy(
              'vehicle-notes-count',
              'vehicle-notes-error',
              errors.notes !== undefined,
            )}
            aria-invalid={errors.notes !== undefined}
            id="vehicle-notes"
            rows={6}
          />
          <CharacterCount
            id="vehicle-notes-count"
            maximum={VEHICLE_NOTES_MAX_LENGTH}
            value={values.notes ?? ''}
          />
          {errors.notes?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-notes-error">
              {errors.notes.message}
            </p>
          )}
        </div>
      </div>

      {errors.root?.server?.message !== undefined && (
        <p className={styles.formError} role="alert">
          {errors.root.server.message}
        </p>
      )}

      <div className={styles.actions}>
        <button className={styles.submitButton} disabled={isSubmitting} type="submit">
          <Save aria-hidden="true" className={styles.buttonIcon} />
          <span>{isSubmitting ? 'Saving…' : submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
