import { VehicleUseCases } from '../application/use-cases/vehicles/vehicleUseCases';
import { SupabaseVehicleRepository } from '../infrastructure/supabase/repositories/SupabaseVehicleRepository';
import { getAuthenticationController } from './authenticationComposition';

let vehicleUseCases: VehicleUseCases | undefined;

export function getVehicleUseCases(): VehicleUseCases {
  vehicleUseCases ??= new VehicleUseCases(
    new SupabaseVehicleRepository(),
    getAuthenticationController(),
  );

  return vehicleUseCases;
}
