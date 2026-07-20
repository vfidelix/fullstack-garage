import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePrivateStateCleanup } from '../../app/providers/authenticationContext';
import { clearVehiclePrivateCache } from './vehicleQueries';
import {
  VehicleContext,
  VehicleSessionContext,
  type VehicleOperations,
  type VehicleSessionGuard,
} from './vehicleContext';

interface VehicleProviderProps {
  readonly children: ReactNode;
  readonly operations: VehicleOperations;
}

export function VehicleProvider({
  children,
  operations,
}: VehicleProviderProps) {
  const queryClient = useQueryClient();
  const sessionGeneration = useRef(0);
  const [publishedGeneration, setPublishedGeneration] = useState(0);
  const sessionGuard = useMemo<VehicleSessionGuard>(() => ({
    capture: () => sessionGeneration.current,
    generation: publishedGeneration,
    isCurrent: (generation) => generation === sessionGeneration.current,
  }), [publishedGeneration]);
  const clearPrivateState = useCallback(
    () => {
      sessionGeneration.current += 1;
      setPublishedGeneration(sessionGeneration.current);
      return clearVehiclePrivateCache(queryClient);
    },
    [queryClient],
  );

  usePrivateStateCleanup(clearPrivateState);

  return (
    <VehicleContext.Provider value={operations}>
      <VehicleSessionContext.Provider value={sessionGuard}>
        {children}
      </VehicleSessionContext.Provider>
    </VehicleContext.Provider>
  );
}
