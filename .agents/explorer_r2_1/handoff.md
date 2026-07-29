# 5-Component Handoff Report: R2 Localhost Health & Daemon Status HUD

## 1. Observation
- **Layout & Navigation Structure**:
  - `src/app/page.tsx:615-623`: `<Sidebar>` is mounted as the top sticky header component.
  - `src/components/Sidebar.tsx:29`: Header element rendered with `sticky top-0 left-0 right-0 z-50 pointer-events-auto bg-[var(--color-card)]/70 backdrop-blur-md`.
  - `src/components/Sidebar.tsx:70-81`: Right section of the top navigation contains a button for opening daemon logs:
    ```tsx
    <div className="flex items-center gap-2 max-w-[200px] w-full pr-1.5">
      <button
        onClick={onOpenLogs}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-500/5 hover:bg-slate-500/8 border border-slate-200/40 rounded-full text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-all select-none cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate">구동 로그 기록</span>
        </div>
        <Terminal size={12} className="text-slate-400" />
      </button>
    </div>
    ```
- **Existing Metric & Log Endpoints**:
  - `src/app/api/app-logs/route.ts:57`: Server heap memory is probed using `Math.round(process.memoryUsage().heapUsed / 1024 / 1024)`.
  - `src/app/api/app-logs/route.ts:114-119`: Returns JSON response containing `{ success: true, data: sortedLogs, daemonActive: false, watchDir: 'd:/Desktop' }`.
  - `src/app/api/data/route.ts:195-260`: Auto-backups are maintained across `backups/[sheet]`, `backups/daily/[sheet]`, and `backups/weekly/[sheet]` (storing 20 recent, 7 daily, 4 weekly backup JSON files per sheet).
  - `src/hooks/useYjsStore.ts:82-84`: Host resolution for CRDT PartyKit: `window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'`.
- **Existing Modal Theme**:
  - `src/components/AppLogModal.tsx:102`: Uses light terminal theme for full console, while `src/components/mindmap/ui/MindMapHUD.tsx:65` uses `bg-slate-900` high-contrast dark backdrop.

---

## 2. Logic Chain
1. **Observation 1** (`Sidebar.tsx:29, 70-81`) shows that the application header is a sticky top bar rendered on every page view and currently houses a static button for "구동 로그 기록" in the top-right corner.
2. **Logic Step 1**: Placing the new `LocalhostStatusHUD` component in `src/components/Sidebar.tsx` (replacing/enhancing the daemon logs pill) provides persistent, 100% viewport visibility across all modules without cluttering dashboard card grids or obscuring floating bottom UI tools.
3. **Observation 2** (`app-logs/route.ts:57` & `data/route.ts:195`) shows server heap memory and multi-tier backup paths are already active on the Node.js backend.
4. **Logic Step 2**: Client JS memory can be probed locally using standard browser `(performance as any).memory?.usedJSHeapSize`, while server heap, watcher state, and backup file counts can be fetched via a React Query hook (`useLocalhostHealth.ts`) targeting an expanded `/api/app-logs` or dedicated `/api/health` route.
5. **Observation 3** (`AGENTS.md:Section 2.I & 2.J` & `useYjsStore.ts`) mandates 0-stall, tab visibility pausing (`refetchIntervalInBackground: false`), dynamic imports for heavy modals, and Tailwind v4 high-contrast dark theme styling for system widgets.
6. **Logic Step 3**: The HUD component should consist of a lightweight **Compact Badge Pill** in the header and a dynamically imported **Expanded Dark Theme HUD Modal** (`LocalhostDaemonHUD`), ensuring minimal initial JS bundle impact and zero main-thread freezing.

---

## 3. Caveats
- **Browser Memory API Scope**: `performance.memory` is non-standard and supported primarily in Blink engines (Chrome, Edge, Opera). On Safari or Firefox, client JS heap reading will return `undefined`; the HUD must gracefully fall back to server heap metrics without crashing.
- **Port Detection**: In static SSG / decoupled proxy environments, `window.location.port` might reflect an upstream port (e.g. 80/443). In local Next.js dev mode (`http://localhost:3001`), `window.location.port` accurately returns `'3001'`.

---

## 4. Conclusion
1. **Optimal Component Placement**: Embed `LocalhostStatusHUD` into the top sticky header (`src/components/Sidebar.tsx`), occupying the right-hand action slot.
2. **Data Fetching Architecture**: Create `useLocalhostHealth.ts` utilizing `@tanstack/react-query` to fetch combined server metrics (`/api/app-logs` or `/api/health`) and merge with client browser metrics (`performance.memory`, `navigator.onLine`).
3. **UI/UX Design**: Standardize on a two-tier layout:
   - **Tier 1 (Compact Pill)**: Status LED + `:3001` + `Heap MB` + `Backup Count` + `Sync Icon` in sticky header.
   - **Tier 2 (Expanded HUD Modal)**: 4-card metric dashboard in Tailwind v4 high-contrast dark theme (`slate-950` / `slate-800`), featuring memory usage gauges, backup stats, file watcher path, CRDT connection status, and log console triggers.

---

## 5. Verification Method
1. **Type & Rule Verification**:
   - Run `npx tsc --noEmit` from project root to ensure zero TypeScript errors.
   - Run `node scripts/run-harness.js` to ensure Zod, ESLint, and MVC ontology rules pass with 0 errors.
2. **File Inspection**:
   - Inspect `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_r2_1\analysis.md` and `handoff.md`.
3. **Invalidation Conditions**:
   - Component placed outside `Sidebar.tsx` header causing layout shift or card occlusion.
   - Background polling active when `document.hidden` is true (violating Rule 2.J).
