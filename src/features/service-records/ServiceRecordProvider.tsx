import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePrivateStateCleanup } from '../../app/providers/authenticationContext';
import { clearServiceRecordPrivateCache } from './serviceRecordQueries';
import {
  ServiceRecordContext,
  ServiceRecordSessionContext,
  type ServiceRecordOperations,
  type ServiceRecordSessionGuard,
} from './serviceRecordContext';

interface ServiceRecordProviderProps {
  readonly children: ReactNode;
  readonly operations: ServiceRecordOperations;
}

export function ServiceRecordProvider({ children, operations }: ServiceRecordProviderProps) {
  const queryClient = useQueryClient();
  const sessionGeneration = useRef(0);
  const [publishedGeneration, setPublishedGeneration] = useState(0);
  const sessionGuard = useMemo<ServiceRecordSessionGuard>(() => ({
    capture: () => sessionGeneration.current,
    generation: publishedGeneration,
    isCurrent: (generation) => generation === sessionGeneration.current,
  }), [publishedGeneration]);
  const clearPrivateState = useCallback(() => {
    sessionGeneration.current += 1;
    setPublishedGeneration(sessionGeneration.current);
    return clearServiceRecordPrivateCache(queryClient);
  }, [queryClient]);

  usePrivateStateCleanup(clearPrivateState);

  return (
    <ServiceRecordContext.Provider value={operations}>
      <ServiceRecordSessionContext.Provider value={sessionGuard}>
        {children}
      </ServiceRecordSessionContext.Provider>
    </ServiceRecordContext.Provider>
  );
}
