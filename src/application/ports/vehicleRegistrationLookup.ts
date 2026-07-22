import type {
  RegistrationLookupInput,
  RegistrationLookupResult,
} from '../../domain/vehicles/registrationLookup';

export interface VehicleRegistrationLookup {
  lookup(input: RegistrationLookupInput): Promise<RegistrationLookupResult>;
}
