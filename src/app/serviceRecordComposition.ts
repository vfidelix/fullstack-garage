import { ServiceRecordUseCases } from '../application/use-cases/service-records/serviceRecordUseCases';
import { JsPdfServiceRecordRenderer } from '../infrastructure/pdf/JsPdfServiceRecordRenderer';
import { SupabaseServiceRecordRepository } from '../infrastructure/supabase/repositories/SupabaseServiceRecordRepository';
import { SupabaseServiceRecordSnapshotRepository } from '../infrastructure/supabase/repositories/SupabaseServiceRecordSnapshotRepository';
import { SupabaseVehicleRepository } from '../infrastructure/supabase/repositories/SupabaseVehicleRepository';
import { getAuthenticationController } from './authenticationComposition';

let serviceRecordUseCases: ServiceRecordUseCases | undefined;

export function getServiceRecordUseCases(): ServiceRecordUseCases {
  serviceRecordUseCases ??= new ServiceRecordUseCases(
    new SupabaseServiceRecordRepository(),
    new SupabaseVehicleRepository(),
    new SupabaseServiceRecordSnapshotRepository(),
    new JsPdfServiceRecordRenderer(),
    getAuthenticationController(),
    {
      createId: () => globalThis.crypto.randomUUID(),
      now: () => new Date().toISOString(),
    },
  );

  return serviceRecordUseCases;
}
