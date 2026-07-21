'use client';

import { useQuery } from '@tanstack/react-query';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface AppLogsResponse {
  success: boolean;
  data: LogEntry[];
  daemonActive: boolean;
  watchDir: string;
}

export function useAppLogs(enabled = false) {
  return useQuery<AppLogsResponse, Error>({
    queryKey: ['app-logs'],
    queryFn: async () => {
      const res = await fetch('/api/app-logs');
      if (!res.ok) {
        throw new Error('Failed to fetch execution logs');
      }
      return res.json();
    },
    enabled,
    refetchInterval: enabled ? 10000 : false, // Auto refetch every 10 seconds when open
    refetchIntervalInBackground: false,
  });
}
