import { VehicleUseCases } from '../application/use-cases/vehicles/vehicleUseCases';
import { LookupVehicleRegistration } from '../application/use-cases/vehicles/lookupVehicleRegistration';
import { CloudflareVehicleRegistrationLookup } from '../infrastructure/cloudflare/CloudflareVehicleRegistrationLookup';
import { SupabaseAccessTokenProvider } from '../infrastructure/supabase/auth/SupabaseAccessTokenProvider';
import { SupabaseVehicleRepository } from '../infrastructure/supabase/repositories/SupabaseVehicleRepository';
import { getAuthenticationController } from './authenticationComposition';

let vehicleUseCases: VehicleUseCases | undefined;
let vehicleRegistrationLookup: LookupVehicleRegistration | undefined;

export function getVehicleUseCases(): VehicleUseCases {
  vehicleUseCases ??= new VehicleUseCases(
    new SupabaseVehicleRepository(),
    getAuthenticationController(),
  );

  return vehicleUseCases;
}

export function getVehicleRegistrationLookup(): LookupVehicleRegistration {
  vehicleRegistrationLookup ??= new LookupVehicleRegistration(
    new CloudflareVehicleRegistrationLookup(new SupabaseAccessTokenProvider()),
    getAuthenticationController(),
  );

  return vehicleRegistrationLookup;
}
