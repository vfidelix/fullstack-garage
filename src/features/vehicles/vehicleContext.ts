import { createContext, useContext } from 'react';
import type { VehicleUseCases } from '../../application/use-cases/vehicles/vehicleUseCases';

export type VehicleOperations = Pick<
  VehicleUseCases,
  | 'archiveVehicle'
  | 'createVehicle'
  | 'deleteVehicle'
  | 'getVehicle'
  | 'listActiveVehicles'
  | 'listArchivedVehicles'
  | 'restoreVehicle'
  | 'updateVehicle'
>;

export const VehicleContext = createContext<VehicleOperations | undefined>(
  undefined,
);

export interface VehicleSessionGuard {
  readonly capture: () => number;
  readonly generation: number;
  readonly isCurrent: (generation: number | undefined) => boolean;
}

export const VehicleSessionContext = createContext<VehicleSessionGuard | undefined>(
  undefined,
);

export function useVehicleOperations(): VehicleOperations {
  const operations = useContext(VehicleContext);

  if (operations === undefined) {
    throw new Error('Vehicle hooks must be used within VehicleProvider.');
  }

  return operations;
}

export function useVehicleSessionGuard(): VehicleSessionGuard {
  const session = useContext(VehicleSessionContext);

  if (session === undefined) {
    throw new Error('Vehicle session hooks must be used within VehicleProvider.');
  }

  return session;
}
