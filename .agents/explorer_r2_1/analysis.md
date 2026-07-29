# Technical Analysis: Localhost Health & Daemon Status HUD Component (R2)

## Executive Summary
This document provides the architectural and technical specification for integrating a **Localhost Health & Daemon Status HUD Component (`LocalhostStatusHUD`)** into the PORTFOLIO - VITAL application. The HUD widget provides real-time, zero-stall visibility into local environment metrics including Server Port (3001), Client/Server JS Heap Memory Usage, Auto-Backup File Count, File Watcher status, and CRDT Offline Sync connectivity.

---

## 1. Existing Component & Layout Architecture

### 1.1 Layout Structure Analysis
- **Main Page Entry (`src/app/page.tsx`)**:
  - Renders `<Sidebar>` at the top of the viewport (`sticky top-0 z-50`).
  - Wraps main views (`PortfolioDashboardView`, `WorkspaceView`, `MindMap3D`, `ProjectManagementPage`) in `<main id="main-scroll-container">`.
  - Manages global modals (e.g., `<AppLogModal>`, `<AIAssistantModal>`).
- **Header Component (`src/components/Sidebar.tsx`)**:
  - Acts as the top navigation bar (`<header className="sticky top-0 ... bg-[var(--color-card)]/70 backdrop-blur-md">`).
  - Left Section: Module navigation pills (`대시보드`, `예산관리`, `마인드맵`, `사업관리`).
  - Right Section: Currently holds a static button for "구동 로그 기록" (App Daemon Logs) styled as a rounded pill (`max-w-[200px] w-full`).
  - Mobile Section: Floating dock nav bar at the bottom (`sm:hidden fixed bottom-6`).

### 1.2 Layout Placement Recommendation
- **Primary Integration Point: Sticky Top Navigation Header (`src/components/Sidebar.tsx`)**
  - **Location**: Right side of the top header bar, enhancing/replacing the current static daemon log button with an interactive HUD Status Badge.
  - **Rationale**:
    1. **Universal Visibility**: The header is sticky and stays visible across all 4 module views (`dashboard`, `workspace`, `mindmap`, `project`).
    2. **Unobtrusive Compact State**: Does not take up space inside dashboard grid cards or conflict with the floating LLM widget on the bottom-right or mobile dock on the bottom-center.
    3. **Natural Ergonomics**: Developers and users look to the top-right header status bar for system indicators (port, memory, sync state).

---

## 2. Metric Probing & Data Retrieval Strategy

To strictly comply with `AGENTS.md` guidelines (hooks-based controllers, Zod safety, zero-stall, 100ms max task time limit, tab-visibility pausing), metrics are collected via a custom React Query hook: `useLocalhostHealth`.

| Metric | Source / Method | Implementation Detail |
| :--- | :--- | :--- |
| **Server Port** | `window.location.port` \|\| `process.env.PORT` | Probed on client as `window.location.port \|\| '3001'`. Fallback server-side default `3001`. |
| **Local Heap Usage (MB)** | Client: `(performance as any).memory?.usedJSHeapSize`<br>Server: `process.memoryUsage().heapUsed` | Client JS Heap calculated via `Math.round(usedJSHeapSize / 1048576)`. Server Node Heap returned via health API endpoint in MB. |
| **Auto-Backup Count** | File System Scan (`data/backups/`) | Server endpoint scans total backup JSON files across Son (`backups/[sheet]`), Daily (`daily/[sheet]`), and Weekly (`weekly/[sheet]`) folders. |
| **File Watcher Status** | API Health / App Logs state | Checks watcher daemon status (`MANUAL_STANDBY` or `ACTIVE`), watch target (`d:/Desktop`), and last scan timestamp. |
| **Offline Sync Indicator** | `navigator.onLine` + Yjs CRDT state | Combines browser `navigator.onLine` with `window.__globalYProvider?.wsconnected` status and `hchps-global-tombstones` sync state. |

---

## 3. Custom Health Hook Architecture (`useLocalhostHealth.ts`)

```typescript
export interface LocalhostHealthMetrics {
  serverPort: number;
  clientHeapMb: number;
  clientHeapLimitMb: number;
  serverHeapMb: number;
  totalBackupsCount: number;
  latestBackupTime: string | null;
  watcherStatus: 'ACTIVE' | 'STANDBY' | 'DISABLED';
  watchDir: string;
  isOnline: boolean;
  crdtSyncStatus: 'synced' | 'syncing' | 'offline';
  timestamp: string;
}
```

### Key Safety & Performance Rules for `useLocalhostHealth`:
1. **Background Pause Guard**: `refetchIntervalInBackground: false` and `refetchOnWindowFocus: false` when tab is hidden (`document.hidden`).
2. **Interval**: 10,000ms polling when window is focused.
3. **Graceful Fallbacks**: If `performance.memory` is unsupported (e.g. non-Blink browsers), returns fallback calculation or `0` without throwing runtime errors.

---

## 4. UI/UX Design Specification (TailwindCSS v4 Standard)

### 4.1 Compact Badge Bar (`LocalhostStatusHUD`)
- **Placement**: Top Right Header (`Sidebar.tsx`).
- **Visual Design**:
  - Container: `bg-slate-900/90 text-slate-200 border border-slate-700/60 rounded-full px-3 py-1.5 backdrop-blur-md hover:bg-slate-800 transition-all cursor-pointer shadow-sm`
  - Elements:
    - **Pulsating Status LED**: `w-2 h-2 rounded-full bg-emerald-400 animate-pulse` (when healthy/online).
    - **Port Pill**: `text-[10px] font-mono font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40` -> `:3001`
    - **Heap Badge**: `text-[11px] font-mono text-slate-300` -> `42 MB`
    - **Backup Count Badge**: `text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded` -> `BK 20+`
    - **Sync Badge**: `Wifi / WifiOff` icon (green when synced, amber when syncing, red when offline).

### 4.2 Expanded Modal / HUD Drawer (`LocalhostDaemonHUD`)
When the user clicks the Compact Badge in the header, a high-contrast dark theme modal opens.

- **Theme Palette**:
  - Background: `bg-slate-950/95 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl`
  - Headers: `text-xs font-mono font-bold uppercase tracking-wider text-slate-400`
- **Component Layout (4 Grid Metrics + Actions)**:
  1. **Card 1: Server & Port Health**: Port `3001`, Protocol `HTTP/1.1`, Status `200 OK`, Latency `<5ms`.
  2. **Card 2: Heap Memory Gauge**: Visual progress bar (`usedJSHeapSize` / `jsHeapSizeLimit`), Node.js Heap usage, Client JS Heap usage.
  3. **Card 3: Auto-Backup Topology**: Total backup count across sheets (Son/Father/Grandfather), disk usage, latest backup timestamp, "Trigger Manual Backup" button.
  4. **Card 4: File Watcher & CRDT Sync**: Watcher path (`d:/Desktop`), CRDT Room (`hchps-global`), Tombstones sync count, Online state indicator.
- **Footer**: Quick link button to open `<AppLogModal>` ("Open Full Console Logs").

---

## 5. Implementation Roadmap & Verification Plan

1. **API Endpoint Expansion (`/api/health`)**:
   - Create or update `/api/app-logs` / `/api/health` to return JSON metrics for heap, backups count, watcher status, and timestamp.
2. **Hook Creation (`src/hooks/useLocalhostHealth.ts`)**:
   - Implement client memory reading + server query.
3. **Component Construction**:
   - Create `src/components/dashboard/LocalhostStatusHUD.tsx` (Compact Pill + Expanded Dark Theme Modal).
4. **Integration**:
   - Embed `<LocalhostStatusHUD>` in `src/components/Sidebar.tsx` header right section.
5. **Verification**:
   - Run TypeScript typecheck (`npx tsc --noEmit`).
   - Run Harness validation script (`node scripts/run-harness.js`).
