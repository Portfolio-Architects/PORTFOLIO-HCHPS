import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (data remains fresh before refetching)
      gcTime: 1000 * 60 * 15,   // 15 minutes garbage collection (formerly cacheTime)
      retry: 2, // Retry failed queries twice
      refetchOnWindowFocus: true, // Auto-sync when returning to the tab
    },
    mutations: {
      retry: 2,
    }
  },
});
