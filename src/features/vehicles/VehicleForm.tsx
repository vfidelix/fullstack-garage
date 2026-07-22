import { Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import type {
  RegistrationLookupInput,
  RegistrationLookupResult,
  VehicleRegistrationSuggestion,
} from '../../domain/vehicles/registrationLookup';
import { validateRegistrationLookupInput } from '../../domain/vehicles/registrationLookup';
import { usePrivateStateCleanup } from '../../app/providers/authenticationContext';
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
  createVehicleFormResolver,
  createVehicleFormDefaults,
  type VehicleFormValues,
} from './vehicleFormSchema';
import styles from './VehicleForm.module.css';

interface VehicleFormProps {
  readonly initialVehicle?: Vehicle;
  readonly lookupRegistration?: (input: RegistrationLookupInput) => Promise<RegistrationLookupResult>;
  readonly onSubmit: (input: CreateVehicle) => Promise<void>;
  readonly submitLabel: string;
}

type SuggestedField = 'make' | 'model' | 'year' | 'engine' | 'body';
type LockableSuggestedField = Exclude<SuggestedField, 'year'>;
type ManualSnapshot = Pick<VehicleFormValues, SuggestedField>;

interface LookupApplicationState {
  readonly lockedFields: Readonly<Record<LockableSuggestedField, boolean>>;
  readonly nonManualYearUntouched: boolean;
}

interface RegistrationLookupProps {
  readonly errors: FieldErrors<VehicleFormValues>;
  readonly register: UseFormRegister<VehicleFormValues>;
  readonly setValue: UseFormSetValue<VehicleFormValues>;
  readonly values: VehicleFormValues;
  readonly lookup: (input: RegistrationLookupInput) => Promise<RegistrationLookupResult>;
  readonly onApplicationChange: (state: LookupApplicationState) => void;
}

const clearedLookupApplication: LookupApplicationState = {
  lockedFields: {
    make: false,
    model: false,
    engine: false,
    body: false,
  },
  nonManualYearUntouched: false,
};

const lookupErrorMessages = {
  invalid_input: 'Enter a registration and select a state or territory before looking up.',
  unauthenticated: 'Your session has expired. Sign in again to use lookup.',
  unauthorized: 'Registration lookup is only available to Garage Admins.',
  not_configured: 'Registration lookup is not configured at this time.',
  rate_limited: 'Registration lookup is temporarily unavailable. Please try again later.',
  temporary_unavailable: 'Registration lookup is temporarily unavailable. Manual entry remains available.',
} as const;

function suggestionLabel(suggestion: VehicleRegistrationSuggestion): string {
  return [suggestion.year, suggestion.make, suggestion.model, suggestion.engine, suggestion.body]
    .filter((part) => part !== undefined)
    .join(' · ');
}

function appendDetailedDescription(notes: string, detailedDescription?: string): string {
  const description = detailedDescription?.trim() ?? '';
  if (
    description.length === 0
    || notes.toLowerCase().includes(description.toLowerCase())
  ) {
    return notes;
  }

  return notes.trim().length === 0
    ? description
    : `${notes}\n\n${description}`;
}

function RegistrationLookup({
  errors,
  register,
  setValue,
  values,
  lookup,
  onApplicationChange,
}: RegistrationLookupProps) {
  const [result, setResult] = useState<RegistrationLookupResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<ManualSnapshot | null>(null);
  const snapshotRef = useRef<ManualSnapshot | null>(null);
  const requestGeneration = useRef(0);
  const lookupInput = useRef<string | null>(null);
  const clearLookup = useCallback(() => {
    const manual = snapshotRef.current;
    if (manual !== null) {
      for (const field of Object.keys(manual) as SuggestedField[]) {
        setValue(field, manual[field], { shouldDirty: true });
      }
    }
    snapshotRef.current = null;
    setSnapshot(null);
    requestGeneration.current += 1;
    setIsLoading(false);
    setResult(null);
    setSelectedIndex(0);
    lookupInput.current = null;
    onApplicationChange(clearedLookupApplication);
  }, [onApplicationChange, setValue]);
  usePrivateStateCleanup(clearLookup);

  const currentInput = validateRegistrationLookupInput({
    registration: values.registration,
    registrationState: values.registrationState,
  });
  const inputKey = currentInput === null
    ? null
    : `${currentInput.registration}\u0000${currentInput.registrationState}`;

  useEffect(() => {
    if (lookupInput.current !== null && lookupInput.current !== inputKey) clearLookup();
  }, [clearLookup, inputKey]);

  const runLookup = async (): Promise<void> => {
    if (currentInput === null) {
      setResult({ status: 'error', category: 'invalid_input' });
      return;
    }
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    lookupInput.current = inputKey;
    setIsLoading(true);
    setResult(null);
    const lookupResult = await lookup(currentInput);
    if (requestGeneration.current === generation) {
      setResult(lookupResult);
      setSelectedIndex(0);
      setIsLoading(false);
    }
  };

  const applySuggestion = (): void => {
    if (result?.status !== 'found') return;
    const suggestion = result.suggestions[selectedIndex];
    if (suggestion === undefined || inputKey === null) return;
    const manualSnapshot = {
      make: values.make,
      model: values.model,
      year: values.year,
      engine: values.engine,
      body: values.body,
    };
    snapshotRef.current = manualSnapshot;
    setSnapshot(manualSnapshot);
    for (const field of ['make', 'model', 'engine', 'body'] as const) {
      if (suggestion[field] !== undefined) setValue(field, suggestion[field], { shouldDirty: true });
    }
    if (suggestion.year !== undefined) setValue('year', suggestion.year, { shouldDirty: true });
    const nextNotes = appendDetailedDescription(values.notes, suggestion.detailedDescription);
    if (nextNotes !== values.notes) setValue('notes', nextNotes, { shouldDirty: true });
    setValue('registrationState', suggestion.registrationState, { shouldDirty: true });
    lookupInput.current = inputKey;
    onApplicationChange({
      lockedFields: {
        make: suggestion.make !== undefined,
        model: suggestion.model !== undefined,
        engine: suggestion.engine !== undefined,
        body: suggestion.body !== undefined,
      },
      nonManualYearUntouched: suggestion.year !== undefined,
    });
  };

  const applied = snapshot !== null;
  return (
    <section className={styles.lookup} aria-labelledby="registration-lookup-title">
      <div className={styles.lookupHeading}>
        <div>
          <p className={styles.lookupEyebrow}>Recommended</p>
          <h2 id="registration-lookup-title">Registration lookup</h2>
        </div>
        <a href="/privacy/registration-lookup">Privacy notice</a>
      </div>
      <p>Enter a Registration and state or territory to receive a Vehicle recommendation. You can always continue with manual entry.</p>
      <div className={styles.lookupInputs}>
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
            value={values.registration}
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
      </div>
      <div className={styles.lookupControls}>
        <button className={styles.lookupButton} disabled={isLoading || applied} onClick={() => void runLookup()} type="button">
          {isLoading ? 'Looking up…' : 'Lookup registration'}
        </button>
        {applied && <button className={styles.clearLookupButton} onClick={clearLookup} type="button">Clear recommendation</button>}
      </div>
      {result?.status === 'error' && <p className={styles.lookupError} role="alert">{lookupErrorMessages[result.category]}</p>}
      {result?.status === 'no_match' && <p className={styles.lookupStatus} role="status">No Vehicle suggestion was found. Continue with manual entry.</p>}
      {result?.status === 'found' && !applied && (
        <div className={styles.suggestions}>
          <p className={styles.lookupStatus}>Select a provider recommendation, then apply it to the form.</p>
          {result.suggestions.map((suggestion, index) => (
            <label className={styles.suggestion} key={`${suggestionLabel(suggestion)}-${String(index)}`}>
              <input
                checked={selectedIndex === index}
                name="vehicle-lookup-suggestion"
                onChange={() => { setSelectedIndex(index); }}
                type="radio"
              />
              <span>{suggestionLabel(suggestion)}</span>
            </label>
          ))}
          <button className={styles.lookupButton} onClick={applySuggestion} type="button">Apply selected Vehicle</button>
        </div>
      )}
      {applied && <p className={styles.lookupStatus} role="status">Provider-recommended Vehicle details are applied. Locked fields remain read-only until cleared.</p>}
    </section>
  );
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
  lookupRegistration,
  onSubmit,
  submitLabel,
}: VehicleFormProps) {
  const [lookupApplication, setLookupApplication] = useState<LookupApplicationState>(() => ({
    ...clearedLookupApplication,
    nonManualYearUntouched: (initialVehicle?.year?.trim().length ?? 0) > 0,
  }));
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
    setError,
  } = useForm<VehicleFormValues, unknown, CreateVehicle>({
    defaultValues: createVehicleFormDefaults(initialVehicle),
    mode: 'onBlur',
    resolver: createVehicleFormResolver(lookupApplication.nonManualYearUntouched),
  });
  const watchedValues = useWatch({ control });
  const values: VehicleFormValues = {
    ...createVehicleFormDefaults(initialVehicle),
    ...watchedValues,
  };
  const yearRegistration = register('year');

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
      {lookupRegistration !== undefined && (
        <RegistrationLookup
          lookup={lookupRegistration}
          errors={errors}
          onApplicationChange={setLookupApplication}
          register={register}
          setValue={setValue}
          values={values}
        />
      )}
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="vehicle-make">Make</label>
          <input
            {...register('make')}
            className={lookupApplication.lockedFields.make ? styles.lookupLocked : undefined}
            readOnly={lookupApplication.lockedFields.make}
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
            value={values.make}
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
            className={lookupApplication.lockedFields.model ? styles.lookupLocked : undefined}
            readOnly={lookupApplication.lockedFields.model}
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
            value={values.model}
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
            {...yearRegistration}
            aria-describedby={errors.year === undefined ? undefined : 'vehicle-year-error'}
            aria-invalid={errors.year !== undefined}
            autoComplete="off"
            id="vehicle-year"
            inputMode="numeric"
            onChange={(event) => {
              setLookupApplication((current) => current.nonManualYearUntouched
                ? { ...current, nonManualYearUntouched: false }
                : current);
              void yearRegistration.onChange(event);
            }}
            type="text"
          />
          {errors.year?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-year-error">
              {errors.year.message}
            </p>
          )}
        </div>

        {lookupRegistration === undefined && (
          <>
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
                value={values.registration}
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
          </>
        )}

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
            value={values.vin}
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
            className={lookupApplication.lockedFields.engine ? styles.lookupLocked : undefined}
            readOnly={lookupApplication.lockedFields.engine}
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
            value={values.engine}
          />
          {errors.engine?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-engine-error">
              {errors.engine.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="vehicle-body">Body</label>
          <input
            {...register('body')}
            className={lookupApplication.lockedFields.body ? styles.lookupLocked : undefined}
            readOnly={lookupApplication.lockedFields.body}
            aria-describedby={describedBy(
              'vehicle-body-count',
              'vehicle-body-error',
              errors.body !== undefined,
            )}
            aria-invalid={errors.body !== undefined}
            autoComplete="off"
            id="vehicle-body"
          />
          <CharacterCount
            id="vehicle-body-count"
            maximum={VEHICLE_TEXT_MAX_LENGTH}
            value={values.body}
          />
          {errors.body?.message !== undefined && (
            <p className={styles.fieldError} id="vehicle-body-error">
              {errors.body.message}
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
            value={values.notes}
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
