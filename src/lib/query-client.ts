import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (data remains fresh before refetching)
      gcTime: 1000 * 60 * 15,   // 15 minutes garbage collection (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Stop retrying if the error is related to auth (401/403) or we've retried 2 times already
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: true, // Auto-sync when returning to the tab
    },
    mutations: {
      retry: 1, // Minimize retry on mutation to prevent duplicate records
    }
  },
});
