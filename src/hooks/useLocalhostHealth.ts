'use client';

import { useQuery } from '@tanstack/react-query';

export interface BackupTierStats {
  son: number;
  father: number;
  grandfather: number;
  total: number;
}

export interface LocalhostHealthData {
  port3001: {
    status: 'online' | 'offline' | 'degraded';
    latencyMs: number;
    port: number;
  };
  heapMemory: {
    clientMB: number | null;
    serverMB: number | null;
    totalMB: number | null;
  };
  backups: BackupTierStats;
  fileWatcher: {
    active: boolean;
    path: string;
  };
  offlineSync: {
    isOnline: boolean;
    crdtSynced: boolean;
    pendingCount: number;
    lastSyncedAt: string | null;
  };
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>;
  timestamp: string;
}

export function useLocalhostHealth(enabled = true) {
  return useQuery<LocalhostHealthData, Error>({
    queryKey: ['localhost-health'],
    queryFn: async () => {
      const startTime = performance.now();
      let status: 'online' | 'offline' | 'degraded' = 'online';
      let latencyMs = 0;
      let logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];
      let serverMB: number | null = null;
      let daemonActive = false;
      let watchDir = 'd:/Desktop';
      let backups: BackupTierStats = { son: 0, father: 0, grandfather: 0, total: 0 };

      // Detect server port dynamically with fallback to 3001
      const portNumber =
        typeof window !== 'undefined' && window.location.port
          ? parseInt(window.location.port, 10) || 3001
          : 3001;

      try {
        const res = await fetch('/api/app-logs', { cache: 'no-store' });
        const endTime = performance.now();
        latencyMs = Math.round(endTime - startTime);

        if (!res.ok) {
          status = 'degraded';
        } else {
          const json = await res.json();
          if (json.success) {
            logs = json.data || [];
            daemonActive = json.daemonActive ?? false;
            watchDir = json.watchDir || 'd:/Desktop';
            serverMB = json.serverHeapMB ?? null;
            if (json.backupStats) {
              backups = json.backupStats;
            }
          } else {
            status = 'degraded';
          }
        }
      } catch {
        status = 'offline';
        latencyMs = 0;
      }

      // Probing client memory (performance.memory in V8 engine)
      let clientMB: number | null = null;
      if (
        typeof window !== 'undefined' &&
        (performance as unknown as { memory?: { usedJSHeapSize: number } })?.memory?.usedJSHeapSize
      ) {
        const memoryInfo = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
        clientMB = Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024));
      }

      const totalMB = (clientMB ?? 0) + (serverMB ?? 0);

      // Offline sync indicator state from navigator, window.__globalYProvider & localStorage
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const crdtSynced =
        typeof window !== 'undefined'
          ? ((window as unknown as { __globalYProvider?: { synced?: boolean } }).__globalYProvider?.synced ?? true)
          : true;

      let pendingCount = 0;
      if (typeof localStorage !== 'undefined') {
        try {
          const tombstones = localStorage.getItem('hchps-global-tombstones');
          if (tombstones) {
            const parsed = JSON.parse(tombstones);
            pendingCount = Array.isArray(parsed) ? parsed.length : 0;
          }
        } catch {}
      }

      return {
        port3001: {
          status,
          latencyMs,
          port: portNumber,
        },
        heapMemory: {
          clientMB,
          serverMB,
          totalMB: totalMB > 0 ? totalMB : null,
        },
        backups,
        fileWatcher: {
          active: daemonActive,
          path: watchDir,
        },
        offlineSync: {
          isOnline,
          crdtSynced,
          pendingCount,
          lastSyncedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        },
        logs,
        timestamp: new Date().toISOString(),
      };
    },
    enabled,
    refetchInterval: () => {
      if (!enabled) return false;
      if (typeof document !== 'undefined' && document.hidden) return false;
      return 30000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}

