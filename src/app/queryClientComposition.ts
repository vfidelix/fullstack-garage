import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        gcTime: 0,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });
}

let appQueryClient: QueryClient | undefined;

export function getAppQueryClient(): QueryClient {
  appQueryClient ??= createAppQueryClient();

  return appQueryClient;
}
