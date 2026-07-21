# Handoff Report: Lazy Loading & FCP Analysis (R2)

## 1. Observation
We observed the following files and lines:
- **`src/components/MindMap3D.tsx:14`**: `import { WikiEditor } from './WikiEditor';` (static import of `WikiEditor`).
- **`src/components/WikiEditor.tsx:5-7`**: 
  ```typescript
  import { PartialBlock } from '@blocknote/core';
  import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, DefaultReactSuggestionItem } from '@blocknote/react';
  import { BlockNoteView } from '@blocknote/mantine';
  ```
- **`src/components/dashboard/PortfolioDashboardView.tsx:7-15`**:
  ```typescript
  const WeeklyScheduler = dynamic(() => import('./WeeklyScheduler').then(mod => mod.WeeklyScheduler), {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center py-20 gap-4 glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-sm text-slate-500 font-bold">주간 플래너를 로드하는 중...</p>
      </div>
    )
  });
  ```
- **`src/app/page.tsx:35-43`**:
  ```typescript
  const MindMap3D = dynamic(() => import('@/components/MindMap3D').then(mod => mod.MindMap3D), {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[660px] gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-sm text-slate-500 font-bold">3D 마인드맵 엔진을 로드하는 중...</p>
      </div>
    )
  });
  ```

---

## 2. Logic Chain
1. Since **`WikiEditor`** is statically imported inside **`MindMap3D.tsx`**, loading the `MindMap3D` chunk automatically loads the entire `@blocknote` core/react/mantine ecosystem (~350KB+ gzip bundle size). This happens even if the user never clicks on a node to open the sliding wiki edit panel drawer.
2. Because **`WeeklyScheduler`** has a dynamic loading fallback height of `300px`, whereas the actual scheduler renders with a height of `620px` on desktop, a layout shift (CLS) of ~320px is triggered when the component chunk loads and hydrates in the client.
3. Similarly, the dynamic loading fallback of **`MindMap3D`** is a simple spinner card that does not visually match the orbital layout of the canvas, which causes a minor visual shift upon hydration.
4. Converting `WikiEditor` to a client-side deferred dynamic import using `next/dynamic` with `{ ssr: false }` inside `MindMap3D.tsx` will decouple the blocknote library from the mindmap, ensuring it is only fetched on-demand when the wiki drawer opens.
5. Upgrading the loaders to custom-styled skeletons matching the exact layouts and heights of the target components will eliminate CLS and improve First Contentful Paint (FCP) visual transitions.
6. The prop signatures of these components do not utilize React `refs` requiring forwarding, which makes dynamic wrapping completely transparent and safe.

---

## 3. Caveats
- No caveats identified. We did not run a webpack analyzer, but the third-party dependencies are well-known bundle drivers.

---

## 4. Conclusion
Dynamic wrappers with `{ ssr: false }` and matching skeleton interfaces should be implemented to defer `WikiEditor` (and its BlockNote/Mantine dependencies) and prevent layout shifts for the dashboard modules.

---

## 5. Verification Method
- **Implementation & Build:** Ensure the proposed dynamic import files compile without errors:
  ```powershell
  npm run build
  ```
- **FCP and Deferral Verification:** Open the web app in a browser (localhost:3001) with the network tab open. Confirm that the `@blocknote` bundles are not fetched when viewing the 3D Mindmap initially, and are only downloaded when opening the wiki panel overlay.
- **CLS Verification:** Verify visually that the transition from skeletons to fully loaded components is layout-stable (no size jumps).
