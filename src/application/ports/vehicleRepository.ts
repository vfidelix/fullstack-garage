import type {
  CreateVehicle,
  UpdateVehicle,
  Vehicle,
  VehicleDuplicateCandidate,
  VehicleId,
  VehicleSummary,
} from '../../domain/vehicles/vehicle';
import type { VehicleResult } from '../vehicles/vehicleResult';

export interface VehicleDuplicateWarning {
  readonly vehicleId: VehicleId;
  readonly label: string;
}

export interface VehicleRepository {
  listActive(): Promise<VehicleResult<readonly VehicleSummary[]>>;
  listArchived(): Promise<VehicleResult<readonly VehicleSummary[]>>;
  getById(id: VehicleId): Promise<VehicleResult<Vehicle>>;
  create(input: CreateVehicle): Promise<VehicleResult<Vehicle>>;
  update(
    id: VehicleId,
    input: UpdateVehicle,
  ): Promise<VehicleResult<Vehicle>>;
  archive(id: VehicleId): Promise<VehicleResult<Vehicle>>;
  restore(id: VehicleId): Promise<VehicleResult<Vehicle>>;
  delete(id: VehicleId): Promise<VehicleResult<void>>;

  // Duplicate lookup spans active and archived Vehicles.
  findDuplicate(
    candidate: VehicleDuplicateCandidate,
    excludeVehicleId?: VehicleId,
  ): Promise<VehicleResult<VehicleDuplicateWarning | undefined>>;
}
