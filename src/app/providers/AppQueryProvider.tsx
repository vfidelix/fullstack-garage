import {
  QueryClientProvider,
  type QueryClient,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getAppQueryClient } from '../queryClientComposition';

interface AppQueryProviderProps {
  readonly children: ReactNode;
  readonly client?: QueryClient;
}

export function AppQueryProvider({
  children,
  client: providedClient,
}: AppQueryProviderProps) {
  const client = providedClient ?? getAppQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}
