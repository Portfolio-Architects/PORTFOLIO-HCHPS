'use client';

import React, { useState } from 'react';
import { useLocalhostHealth } from '@/hooks/useLocalhostHealth';
import { 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  FolderGit2, 
  Terminal, 
  X, 
  RotateCw, 
  Wifi, 
  WifiOff,
  RefreshCw
} from 'lucide-react';

interface LocalhostStatusHUDProps {
  onOpenLogs?: () => void;
}

export function LocalhostStatusHUD({ onOpenLogs }: LocalhostStatusHUDProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: health, isLoading, isFetching, refetch } = useLocalhostHealth(true);

  const status = health?.port3001.status || (isLoading ? 'online' : 'offline');
  const serverPort = health?.port3001.port ?? 3001;
  const isOnline = health?.offlineSync.isOnline ?? true;
  const crdtSynced = health?.offlineSync.crdtSynced ?? true;
  const clientMB = health?.heapMemory.clientMB ?? null;
  const serverMB = health?.heapMemory.serverMB ?? null;
  const displayHeapMB = clientMB || serverMB || 0;
  const totalBackups = health?.backups.total ?? 0;

  // LED status styling
  const getStatusColor = () => {
    if (status === 'offline') return 'rose';
    if (status === 'degraded' || !isOnline || !crdtSynced) return 'amber';
    return 'emerald';
  };

  const statusColor = getStatusColor();

  return (
    <>
      {/* Sleek Compact Badge Pill in Header */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 dark:bg-slate-950/90 border border-slate-700/60 hover:border-emerald-500/50 rounded-full text-xs font-medium text-slate-200 shadow-xs hover:shadow-emerald-500/10 transition-all select-none cursor-pointer group"
        title="Localhost Health & Daemon Status HUD"
        suppressHydrationWarning
      >
        <span className="relative flex h-2 w-2" suppressHydrationWarning>
          <span
            className={`relative inline-flex rounded-full h-2 w-2 shadow-xs ${
              statusColor === 'emerald'
                ? 'bg-emerald-500 shadow-emerald-500/50'
                : statusColor === 'amber'
                ? 'bg-amber-500 shadow-amber-500/50'
                : 'bg-rose-500 shadow-rose-500/50'
            }`}
          />
        </span>

        <div className="flex items-center gap-1.5 text-[11px] font-mono" suppressHydrationWarning>
          <span className="font-semibold text-slate-100" suppressHydrationWarning>{serverPort}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300" suppressHydrationWarning>{displayHeapMB}MB</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300" suppressHydrationWarning>Bk:{totalBackups}</span>
        </div>

        {isOnline ? (
          <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
        ) : (
          <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
        )}
      </button>

      {/* Expanded High-Contrast Dark Theme HUD Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-slate-950/95 border border-slate-800 text-slate-100 backdrop-blur-xl shadow-2xl rounded-2xl max-w-xl w-full p-6 space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-emerald-400">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-50 flex items-center gap-2">
                    Localhost Health & Daemon Status HUD
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Port {serverPort} • Latency: {health?.port3001.latencyMs ?? 0}ms • Refetch: 5000ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-800 transition-all cursor-pointer"
                  title="수동 새로고침"
                >
                  <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-800 transition-all cursor-pointer"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid 1: Server Status & Connection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">Dev Server (Port {serverPort})</div>
                    <div className="text-xs font-semibold font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ONLINE ({health?.port3001.latencyMs ?? 0}ms)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-rose-400" />
                  )}
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">Offline & CRDT Sync</div>
                    <div className={`text-xs font-semibold font-mono flex items-center gap-1.5 mt-0.5 ${
                      isOnline ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isOnline
                        ? `ONLINE (${crdtSynced ? 'CRDT Synced' : 'Syncing'})`
                        : `OFFLINE (${health?.offlineSync.pendingCount ?? 0} Pending)`}
                    </div>
                  </div>
                </div>
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${crdtSynced ? '' : 'animate-spin text-amber-400'}`} />
              </div>
            </div>

            {/* Section 2: Memory Gauges */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span>Heap Memory Monitoring (MB)</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Total Active: <strong className="text-slate-100">{health?.heapMemory.totalMB ?? displayHeapMB} MB</strong>
                </span>
              </div>

              {/* Client Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Browser JS Heap (Client):</span>
                  <span className="text-blue-300 font-semibold">{clientMB !== null ? `${clientMB} MB` : 'N/A'}</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(10, ((clientMB || 0) / 300) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Server Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Next.js Dev Heap (Server):</span>
                  <span className="text-emerald-300 font-semibold">{serverMB !== null ? `${serverMB} MB` : 'N/A'}</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(10, ((serverMB || 0) / 400) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Auto-Backup Tier Stats */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Auto-Backup Tiers (다중 계층 이력 보존)</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Son Tier</div>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                    {health?.backups.son ?? 0}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">최근 20회</div>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Father Tier</div>
                  <div className="text-sm font-bold font-mono text-blue-400 mt-0.5">
                    {health?.backups.father ?? 0}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">일별 7일</div>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Grandfather</div>
                  <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                    {health?.backups.grandfather ?? 0}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">주별 4주</div>
                </div>

                <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-slate-400 font-medium">Total Count</div>
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                    {totalBackups}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">전체 백업</div>
                </div>
              </div>
            </div>

            {/* Section 4: File Watcher & Path */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-400">File Watcher Target:</span>
                  <code className="ml-2 px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-200">
                    {health?.fileWatcher.path ?? 'd:/Desktop'}
                  </code>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Mode: {health?.fileWatcher.active ? 'Active' : 'Manual'}
              </span>
            </div>

            {/* Modal Footer / Daemon Logs Action */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] font-mono text-slate-400">
                Last probe: {health?.offlineSync.lastSyncedAt ?? 'Just now'}
              </span>

              {onOpenLogs && (
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    onOpenLogs();
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>구동 로그 전체 보기 (Daemon Logs)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

