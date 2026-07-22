import type { VehicleRegistrationLookup } from '../../ports/vehicleRegistrationLookup';
import type {
  RegistrationLookupInput,
  RegistrationLookupResult,
} from '../../../domain/vehicles/registrationLookup';
import type { AuthenticationController } from '../auth/authenticationController';

export class LookupVehicleRegistration {
  public constructor(
    private readonly lookupPort: VehicleRegistrationLookup,
    private readonly authentication: AuthenticationController,
  ) {}

  public async execute(input: RegistrationLookupInput): Promise<RegistrationLookupResult> {
    return this.authentication.getCurrentAppUser() === null
      ? { status: 'error', category: 'unauthenticated' }
      : this.lookupPort.lookup(input);
  }
}
