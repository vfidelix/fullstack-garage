import {
  isGarageAdmin,
  type AppUser,
  type AppUserId,
} from '../../../domain/users/appUser';
import {
  validateCreateVehicle,
  validateUpdateVehicle,
  type CreateVehicle,
  type UpdateVehicle,
  type Vehicle,
  type VehicleDuplicateCandidate,
  type VehicleId,
  type VehicleSummary,
} from '../../../domain/vehicles/vehicle';
import type {
  VehicleDuplicateWarning,
  VehicleRepository,
} from '../../ports/vehicleRepository';
import {
  createVehicleError,
  createVehicleValidationError,
  type VehicleResult,
} from '../../vehicles/vehicleResult';

export interface CurrentAppUserSource {
  getCurrentAppUser(): AppUser | null;
}

export interface VehicleMutationOutcome {
  readonly vehicle: Vehicle;
  readonly duplicateWarning?: VehicleDuplicateWarning;
}

export class VehicleUseCases {
  public constructor(
    private readonly repository: VehicleRepository,
    private readonly currentUserSource: CurrentAppUserSource,
  ) {}

  public listActiveVehicles(): Promise<VehicleResult<readonly VehicleSummary[]>> {
    return this.runAuthorized(() => this.repository.listActive());
  }

  public listArchivedVehicles(): Promise<VehicleResult<readonly VehicleSummary[]>> {
    return this.runAuthorized(() => this.repository.listArchived());
  }

  public getVehicle(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    return this.runAuthorized(() => this.repository.getById(id));
  }

  public async createVehicle(
    input: CreateVehicle,
  ): Promise<VehicleResult<VehicleMutationOutcome>> {
    const initiatingUser = this.getCurrentGarageAdmin();
    if (initiatingUser === null) {
      return this.unauthorized();
    }

    const validation = validateCreateVehicle(input);
    if (!validation.valid) {
      return {
        ok: false,
        error: createVehicleValidationError(validation.issues),
      };
    }

    return this.persistWithDuplicateWarning(
      validation.value,
      () => this.repository.create(validation.value),
      initiatingUser.id,
    );
  }

  public async updateVehicle(
    id: VehicleId,
    input: UpdateVehicle,
  ): Promise<VehicleResult<VehicleMutationOutcome>> {
    const initiatingUser = this.getCurrentGarageAdmin();
    if (initiatingUser === null) {
      return this.unauthorized();
    }

    const validation = validateUpdateVehicle(input);
    if (!validation.valid) {
      return {
        ok: false,
        error: createVehicleValidationError(validation.issues),
      };
    }

    return this.persistWithDuplicateWarning(
      validation.value,
      () => this.repository.update(id, validation.value),
      initiatingUser.id,
      id,
    );
  }

  public archiveVehicle(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    return this.runAuthorized(() => this.repository.archive(id));
  }

  public restoreVehicle(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    return this.runAuthorized(() => this.repository.restore(id));
  }

  public deleteVehicle(id: VehicleId): Promise<VehicleResult<void>> {
    return this.runAuthorized(() => this.repository.delete(id));
  }

  private async persistWithDuplicateWarning(
    input: CreateVehicle,
    persist: () => Promise<VehicleResult<Vehicle>>,
    initiatingUserId: AppUserId,
    excludeVehicleId?: VehicleId,
  ): Promise<VehicleResult<VehicleMutationOutcome>> {
    const candidate: VehicleDuplicateCandidate = {
      make: input.make,
      model: input.model,
      ...(input.registration === undefined
        ? {}
        : { registration: input.registration }),
      ...(input.registrationState === undefined
        ? {}
        : { registrationState: input.registrationState }),
    };
    const duplicateResult = await this.callRepository(() => (
      excludeVehicleId === undefined
        ? this.repository.findDuplicate(candidate)
        : this.repository.findDuplicate(candidate, excludeVehicleId)
    ));
    if (!this.hasSameCurrentGarageAdmin(initiatingUserId)) {
      return this.unauthorized();
    }

    const persistenceResult = await this.callRepository(persist);

    if (!persistenceResult.ok) {
      return persistenceResult;
    }

    const duplicateWarning = duplicateResult.ok
      ? duplicateResult.value
      : undefined;

    return {
      ok: true,
      value: {
        vehicle: persistenceResult.value,
        ...(duplicateWarning === undefined ? {} : { duplicateWarning }),
      },
    };
  }

  private async runAuthorized<T>(
    operation: () => Promise<VehicleResult<T>>,
  ): Promise<VehicleResult<T>> {
    if (!this.hasCurrentGarageAdmin()) {
      return this.unauthorized();
    }

    return this.callRepository(operation);
  }

  private hasCurrentGarageAdmin(): boolean {
    return this.getCurrentGarageAdmin() !== null;
  }

  private hasSameCurrentGarageAdmin(initiatingUserId: AppUserId): boolean {
    return this.getCurrentGarageAdmin()?.id === initiatingUserId;
  }

  private getCurrentGarageAdmin(): AppUser | null {
    try {
      const user = this.currentUserSource.getCurrentAppUser();
      return user !== null && isGarageAdmin(user) ? user : null;
    } catch {
      return null;
    }
  }

  private async callRepository<T>(
    operation: () => Promise<VehicleResult<T>>,
  ): Promise<VehicleResult<T>> {
    try {
      return await operation();
    } catch {
      return {
        ok: false,
        error: createVehicleError('temporary_failure'),
      };
    }
  }

  private unauthorized<T>(): VehicleResult<T> {
    return {
      ok: false,
      error: createVehicleError('unauthorized'),
    };
  }
}
