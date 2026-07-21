# R2: Lazy Loading & FCP Analysis Report

## 1. Executive Summary

An investigation into the import patterns of the heavy dashboard components (`MindMap3D`, `WeeklyScheduler`, `WikiEditor`) reveals that while some components are loaded dynamically at the top level, nested static imports and layout-mismatched fallbacks introduce bundle bloat and layout shifts:
- **`WikiEditor` (WYSIWYG Editor)** is statically imported inside `MindMap3D.tsx`. Since `WikiEditor` pulls in the entire `@blocknote` core, react, and mantine libraries, loading the 3D Mindmap forces the client to download these heavy rich-text libraries even if the wiki drawer is never opened.
- **`WeeklyScheduler`** is dynamically imported, but its loading placeholder has a height of `300px`, whereas the loaded component stands at `620px` on desktop. This causes a significant Cumulative Layout Shift (CLS) of ~320px upon chunk load.
- **`MindMap3D`** is dynamically loaded, but its placeholder does not match the dashboard styling or the HUD layout, leading to minor CLS and visual jarring.

Refactoring these imports to fully deferred `next/dynamic` wrappers with matching skeleton loaders will isolate third-party dependencies (Mantine, BlockNote) and eliminate CLS.

---

## 2. Analysis of Target Components & Import Patterns

### A. MindMap3D (`src/components/MindMap3D.tsx`)
- **Import Locations:**
  - `src/app/page.tsx:35` (Dynamic, `ssr: false`, loading placeholder of `h-[660px]`).
  - `src/components/dashboard/DummyPerfTest.tsx:3` (Dynamic, `ssr: false`, no custom fallback).
  - `src/app/page.tsx:179` (Preloaded dynamically: `if (module === 'mindmap') import('@/components/MindMap3D');`).
- **Dependencies:**
  - Standard React, custom canvas engine `OntologyCanvasEngine` (pure HTML5 2D Canvas rendering with orbital mathematics, zero external heavy 3D graph libraries).
  - **Critical Leak:** `import { WikiEditor } from './WikiEditor';` (Line 14) is a static import. This pulls the heavy `@blocknote` suite into the `MindMap3D` bundle chunk.
- **Props Signature:**
  ```typescript
  interface MindMap3DProps {
    signalKeywords: Record<string, number>;
    signalEntries: SignalEntry[];
    onAddSignal: (text: string) => void;
    onDeleteSignal?: (id: string) => void;
    onUpdateKeywords?: (id: string, keywords: string[]) => void;
    onRenameCategory?: (oldName: string, newName: string) => void;
    onDeleteCategory?: (name: string) => void;
    isActive?: boolean;
  }
  ```
- **Dynamic Prop Safety:** All props are callback functions, standard strings/objects, or primitive state flags. Next.js dynamic import wrapper handles these correctly. No react `ref` properties are exposed by `MindMap3DProps`, so no ref-forwarding wrapper is necessary.

### B. WeeklyScheduler (`src/components/dashboard/WeeklyScheduler.tsx`)
- **Import Locations:**
  - `src/components/dashboard/PortfolioDashboardView.tsx:7` (Dynamic, `ssr: false`, loading height `h-[300px]`).
- **Dependencies:**
  - `lucide-react` (icons), `useSchedules` custom hook, types from `@/types`. No heavy calendar grid libraries (e.g., FullCalendar or big-calendar) are imported.
- **Props Signature:**
  - `React.FC` / Empty (`{}`).
- **Dynamic Prop Safety:** Fully safe as it does not accept props.
- **CLS Bottleneck:** The current fallback is a simple spinner card with `h-[300px]`, while the fully loaded component is `h-[620px]` on desktop, creating a shift of over 300px.

### C. WikiEditor (`src/components/WikiEditor.tsx`)
- **Import Locations:**
  - **Statically imported** in `src/components/MindMap3D.tsx:14`.
- **Dependencies:**
  - `@blocknote/core`
  - `@blocknote/react`
  - `@blocknote/mantine`
  - `@blocknote/mantine/style.css`
  - `@/lib/llm-client` (for AI context continuation via Llama 3.1)
  *Total bundle size impact: ~350KB+ gzip due to Mantine CSS/JS, ProseMirror, and BlockNote core utilities.*
- **Props Signature:**
  ```typescript
  interface WikiEditorProps {
    nodeId: string;
    nodeTitle: string;
    initialBlocks?: PartialBlock[];
    onChange?: (blocks: PartialBlock[]) => void;
    onClose?: () => void;
    addCustomEdge?: (source: string, target: string) => void;
  }
  ```
- **Dynamic Prop Safety:** Fully safe. The component is instantiated in `MindMap3D.tsx` with a key: `<WikiEditor key={activeNode.id} ... />`. This ensures proper React mount lifecycles when switching nodes, and the dynamic import's chunk loader will update dynamically with the matching active node props.

---

## 3. Bundle Bloat & Third-Party Dependency Analysis

The following third-party dependencies are the main drivers of the bundle weight:
1. **BlockNote & Mantine:** Rich text libraries containing virtual DOM mapping, complex ProseMirror operations, and layout frameworks. Statically importing these forces the initial download of their script and stylesheets.
2. **Yjs & CRDT Infrastructure:** Though managed via dynamic context, Yjs and PartyKit dependencies are isolated to hooks (`useYjsStore.ts` and `useGraphCustomization.ts`). We must maintain client-only executions (`ssr: false`) to prevent SSR mismatches since these hooks depend on browser APIs (`window`, `localStorage`, `indexedDB`).

---

## 4. Proposed Refactoring & Wrapper Design

To resolve these issues, we propose implementing Next.js dynamic import wrappers with matching visual skeleton fallbacks to prevent CLS.

### A. Refactoring WikiEditor in MindMap3D.tsx
To defer loading `@blocknote` and `mantine` libraries until the wiki sidebar is actually toggled open:

#### Proposed Changes in `src/components/MindMap3D.tsx`:

1. Replace static import:
   ```typescript
   // Remove this line:
   // import { WikiEditor } from './WikiEditor';
   ```
2. Add dynamic import wrapper at module level:
   ```typescript
   import dynamic from 'next/dynamic';

   const WikiEditor = dynamic(() => import('./WikiEditor').then(mod => mod.WikiEditor), {
     ssr: false,
     loading: () => <WikiEditorSkeleton />
   });
   ```

#### WikiEditor Loading Skeleton UI Design:
```tsx
function WikiEditorSkeleton() {
  return (
    <div className="absolute top-0 right-0 h-full bg-white z-[120] shadow-xl border-l border-slate-200 w-full md:w-[450px] lg:w-[500px] flex flex-col animate-pulse">
      {/* Header Skeleton */}
      <div className="shrink-0 pt-6 px-8 pb-4 border-b border-slate-100 flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="w-20 h-3.5 bg-slate-200 rounded" />
          <div className="w-48 h-6 bg-slate-200 rounded" />
        </div>
        <div className="w-8 h-8 bg-slate-200 rounded-full" />
      </div>

      {/* Editor Content Body Skeleton */}
      <div className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
        <div className="w-32 h-8 bg-slate-200 rounded-md" />
        
        <div className="space-y-4">
          <div className="w-full h-4 bg-slate-200 rounded" />
          <div className="w-11/12 h-4 bg-slate-200 rounded" />
          <div className="w-10/12 h-4 bg-slate-200 rounded" />
        </div>

        <div className="w-44 h-6 bg-slate-200 rounded-md mt-4" />
        
        <div className="space-y-3 pl-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-200 rounded-full" />
            <div className="w-5/6 h-3 bg-slate-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-200 rounded-full" />
            <div className="w-4/5 h-3 bg-slate-200 rounded" />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-xs text-slate-400 font-bold">블록 에디터 리소스를 불러오는 중...</span>
        </div>
      </div>
    </div>
  );
}
```

---

### B. Optimizing WeeklyScheduler Fallback in PortfolioDashboardView.tsx
To eliminate the layout shift (~320px), we propose a custom skeleton dashboard scheduler card.

#### Proposed Changes in `src/components/dashboard/PortfolioDashboardView.tsx`:

1. Replace the current `WeeklyScheduler` dynamic definition:
   ```typescript
   const WeeklyScheduler = dynamic(() => import('./WeeklyScheduler').then(mod => mod.WeeklyScheduler), {
     ssr: false,
     loading: () => <WeeklySchedulerSkeleton />
   });
   ```

#### WeeklyScheduler Loading Skeleton UI Design:
```tsx
function WeeklySchedulerSkeleton() {
  return (
    <div className="glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 h-[620px] animate-pulse flex flex-col gap-6">
      {/* Header Placeholder */}
      <div className="flex justify-between items-center pb-6 border-b border-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-200/60 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <div className="w-44 h-5 bg-slate-200/60 rounded" />
            <div className="w-64 h-3 bg-slate-200/40 rounded" />
          </div>
        </div>
        <div className="w-48 h-8 bg-slate-200/50 rounded-xl" />
      </div>

      {/* Grid Layout Placeholder */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left Form Skeleton */}
        <div className="xl:col-span-3 flex flex-col gap-4 border-r border-slate-200/30 pr-6">
          <div className="w-24 h-4 bg-slate-200/60 rounded" />
          <div className="w-full h-10 bg-slate-200/40 rounded-xl" />
          <div className="w-32 h-4 bg-slate-200/60 rounded" />
          <div className="w-full h-10 bg-slate-200/40 rounded-xl" />
          <div className="flex gap-2">
            <div className="w-1/2 h-10 bg-slate-200/40 rounded-xl" />
            <div className="w-1/2 h-10 bg-slate-200/40 rounded-xl" />
          </div>
          <div className="w-full h-24 bg-slate-200/40 rounded-xl mt-auto" />
        </div>

        {/* Right Weekly Grid Skeleton */}
        <div className="xl:col-span-9 grid grid-cols-7 gap-3 h-full">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="flex flex-col bg-slate-100/40 border border-slate-200/30 rounded-2xl p-3 gap-3 h-full">
              <div className="flex items-center justify-between border-b border-slate-200/30 pb-2">
                <div className="w-6 h-4 bg-slate-200/60 rounded" />
                <div className="w-4 h-4 bg-slate-200/60 rounded-full" />
              </div>
              <div className="flex-1 flex flex-col gap-2 justify-center items-center">
                <div className="w-8 h-8 bg-slate-200/40 rounded-full" />
                <div className="w-10 h-2 bg-slate-200/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### C. Optimizing MindMap3D Fallback in page.tsx
To ensure a matching dark visual styling and concentric orbital layouts that mimic the 3D canvas before it renders.

#### Proposed Changes in `src/app/page.tsx`:

1. Replace the current `MindMap3D` dynamic definition:
   ```typescript
   const MindMap3D = dynamic(() => import('@/components/MindMap3D').then(mod => mod.MindMap3D), {
     ssr: false,
     loading: () => <MindMap3DSkeleton />
   });
   ```

#### MindMap3D Loading Skeleton UI Design:
```tsx
function MindMap3DSkeleton() {
  return (
    <div className="flex flex-col h-[660px] w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden animate-pulse">
      {/* Top HUD Skeleton */}
      <div className="flex justify-between items-center mb-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
          <div className="flex flex-col gap-2">
            <div className="w-36 h-5 bg-slate-800 rounded" />
            <div className="w-48 h-3 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="w-24 h-9 bg-slate-800 rounded-xl" />
      </div>

      {/* Orbit Visualization Mockup */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[100px] h-[100px] border border-slate-800/60 rounded-full" />
        <div className="absolute w-[240px] h-[240px] border border-slate-800/40 rounded-full" />
        <div className="absolute w-[380px] h-[380px] border border-slate-800/20 rounded-full" />
        <div className="absolute w-[500px] h-[500px] border border-slate-800/10 rounded-full" />
      </div>

      {/* Center Status Loader */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 z-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-400">3D 마인드맵 시각화 엔진을 구축하는 중...</p>
          <p className="text-[11px] text-slate-600 mt-1">네트워크 분석 및 실시간 궤도 매핑 준비 중</p>
        </div>
      </div>

      {/* Bottom HUD HUD Placeholder */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center z-10">
        <div className="flex gap-2">
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
          <div className="w-10 h-10 bg-slate-800 rounded-xl" />
        </div>
        <div className="w-40 h-8 bg-slate-800 rounded-lg" />
        <div className="w-24 h-10 bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}
```

---

## 5. Summary of Recommended Actions
1. **WikiEditor Wrapper:** Replace the static import of `WikiEditor` in `MindMap3D.tsx` with a dynamic import `{ ssr: false }`. Integrate the `WikiEditorSkeleton` loading component.
2. **WeeklyScheduler Fallback:** Update the dynamic fallback in `PortfolioDashboardView.tsx` from `h-[300px]` spinner to `WeeklySchedulerSkeleton` layout to avoid CLS.
3. **MindMap3D Fallback:** Update the dynamic fallback in `page.tsx` to `MindMap3DSkeleton` to matches the orbital aesthetics and UI heights.
