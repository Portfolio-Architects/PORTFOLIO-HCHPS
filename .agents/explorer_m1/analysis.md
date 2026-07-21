# Codebase Exploration & Implementation Plan

## 1. Inventory Module Implementation Analysis

### State Hooks & Handlers in `src/app/page.tsx`
In `src/app/page.tsx`, the inventory state is managed using the `useInventory` hook:
```typescript
const { items: inventoryItems, addItem, updateItem, deleteItem, adjustStock, getItemHistory } = useInventory();
```

The hook returns the following:
- `items` (aliased to `inventoryItems`): Array of type `InventoryItem[]` representing the list of promotional materials.
- `addItem`: Function to add a new inventory item.
- `updateItem`: Function to update metadata of an existing inventory item.
- `deleteItem`: Function to delete an item from inventory.
- `adjustStock`: Function to adjust the stock quantity of an item.
- `getItemHistory`: Function to retrieve the log of stock changes for a specific item.

### Propagation of State and Handlers
Currently, these states and handlers are passed to both `WorkspaceView` and `InventoryList` in `src/app/page.tsx`:

1. **Passing to `WorkspaceView` (lines 500–519):**
   ```tsx
   <WorkspaceView
     ...
     inventoryItems={inventoryItems}
     addItem={addItem}
     updateItem={updateItem}
     deleteItem={deleteItem}
     adjustStock={adjustStock}
     getItemHistory={getItemHistory}
     ...
   />
   ```
   *Note: Although `WorkspaceView` receives these props, it currently does not render them.*

2. **Passing to `InventoryList` (lines 523–535):**
   ```tsx
   <InventoryList
     items={inventoryItems}
     addItem={addItem}
     updateItem={updateItem}
     deleteItem={deleteItem}
     adjustStock={adjustStock}
     getItemHistory={getItemHistory}
   />
   ```
   *Note: This displays the standalone inventory management page.*

3. **Passing to `useMergedSignals` (line 186):**
   ```typescript
   const { mergedKeywordMap, mergedEntries } = useMergedSignals(
     signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems
   );
   ```
   *This shows that the inventory items are also used to compile global semantic signals.*

---

## 2. Relocating `InventoryList` into `WorkspaceView` (Sub-tab Layout)

To make `InventoryList` a sub-tab of `WorkspaceView` (Budget Management), we will edit `src/components/WorkspaceView.tsx`.

### Proposed Changes in `src/components/WorkspaceView.tsx`

1. **Dynamic Import of `InventoryList`**:
   To prevent bulkier bundle size on initial load, we will dynamically import `InventoryList` with `ssr: false`:
   ```typescript
   import dynamic from 'next/dynamic';

   const InventoryList = dynamic(() => import('@/components/inventory/InventoryList').then(mod => mod.InventoryList), {
     ssr: false,
     loading: () => (
       <div className="flex flex-col items-center justify-center py-20 gap-4">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
         <p className="text-sm text-slate-500 font-bold">홍보 자재 관리 대장을 불러오는 중...</p>
       </div>
     )
   });
   ```

2. **Add Tab State**:
   Add a state variable to control which sub-tab is displayed:
   ```typescript
   const [activeTab, setActiveTab] = useState<'budget' | 'inventory'>('budget');
   ```

3. **Sub-Tab Navigation Header Layout**:
   Add a styled tab bar matching the workspace's slate styling:
   ```tsx
   <div className="flex border-b border-slate-200/50 bg-slate-50/50 p-1.5 rounded-2xl w-full border border-slate-200/30 gap-2 shrink-0">
     <button
       onClick={() => setActiveTab('budget')}
       className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
         activeTab === 'budget'
           ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
           : 'text-slate-500 hover:text-slate-800'
       }`}
     >
       📊 예산 대조보드
     </button>
     <button
       onClick={() => setActiveTab('inventory')}
       className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
         activeTab === 'inventory'
           ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
           : 'text-slate-500 hover:text-slate-800'
       }`}
     >
       📦 홍보 자재 관리
     </button>
   </div>
   ```

4. **Conditional Tab Rendering**:
   Swap the content based on `activeTab`:
   ```tsx
   {activeTab === 'budget' ? (
     <BudgetDashboard
       categories={props.budgetCategories}
       entries={props.budgetEntries}
       addCategory={props.addCategory}
       updateCategory={props.updateCategory}
       deleteCategory={props.deleteCategory}
       replaceCategories={props.replaceCategories}
       addEntry={props.addEntry}
       updateEntry={props.updateEntry}
       deleteEntry={props.deleteEntry}
       getCategoryStats={props.getCategoryStats}
       overallStats={props.overallStats}
     />
   ) : (
     <InventoryList
       items={props.inventoryItems}
       addItem={props.addItem}
       updateItem={props.updateItem}
       deleteItem={props.deleteItem}
       adjustStock={props.adjustStock}
       getItemHistory={props.getItemHistory}
     />
   )}
   ```

---

## 3. Module ID Swap (Replacing `inventory` with `law`)

We will swap the module ID `inventory` with `law` representing the new independent Law System page.

### 1. `src/types/index.ts`
Modify the `ModuleType` enum to include `law` instead of `inventory`:
```typescript
// Line 167
export type ModuleType = 'workspace' | 'mindmap' | 'dashboard' | 'law';
```

### 2. `src/components/Sidebar.tsx`
Update the navigation items to render '법령/지침' with a `Scale` or `BookOpen` icon:
- Import `Scale` from `lucide-react`.
- Replace the `inventory` nav item:
```typescript
// Line 17
const navItems: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'workspace', label: '예산관리', icon: Archive },
  { id: 'mindmap', label: '마인드맵', icon: Zap },
  { id: 'law', label: '법령/지침', icon: Scale },
];
```

### 3. `src/app/page.tsx`
Update `src/app/page.tsx` to handle the new `law` module ID:
- **State initialization (line 167):**
  ```typescript
  const [visitedModules, setVisitedModules] = useState<Record<ModuleType, boolean>>({
    dashboard: true,
    mindmap: false,
    workspace: false,
    law: false,
  });
  ```
- **Preloading list & delay (lines 206–240):**
  ```typescript
  const triggerPreload = (module: ModuleType) => {
    if (module === 'mindmap') import('@/components/MindMap3D');
    else if (module === 'workspace') import('@/components/WorkspaceView');
    else if (module === 'law') import('@/components/law/LawSystemPage');
  };
  // ...
  const startStaggeredSequence = () => {
    timers.push(window.setTimeout(() => triggerPreload('mindmap'), 1500));
    timers.push(window.setTimeout(() => triggerPreload('workspace'), 3500));
    timers.push(window.setTimeout(() => triggerPreload('law'), 5500));
  };
  ```
- **Swipe order array (line 363):**
  ```typescript
  const order: ModuleType[] = ['dashboard', 'workspace', 'mindmap', 'law'];
  ```
- **Page header title rendering (line 442):**
  ```tsx
  activeModule === 'law' ? '법령/지침' : ''
  ```
- **Dynamic import setup:**
  Remove `InventoryList` dynamic import, and add:
  ```typescript
  const LawSystemPage = dynamic(() => import('@/components/law/LawSystemPage').then(mod => mod.LawSystemPage), {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-sm text-slate-500 font-bold">법령/지침 시스템을 불러오는 중...</p>
      </div>
    )
  });
  ```
- **Page content rendering (lines 523–535):**
  Replace `InventoryList` block with:
  ```tsx
  {visitedModules.law && (
    <div className={activeModule === 'law' ? 'block' : 'hidden'}>
      <LawSystemPage />
    </div>
  )}
  ```

---

## 4. Removing `LawSearchPanel` from `BudgetDashboard`

To isolate the Budget dashboard, we will remove `LawSearchPanel` from `src/components/budget/BudgetDashboard.tsx`.

### Proposed Changes in `BudgetDashboard.tsx`
1. **Remove Import (line 15):**
   ```typescript
   // Delete this line:
   import { LawSearchPanel } from './ui/LawSearchPanel';
   ```
2. **Remove Rendering (line 358):**
   ```tsx
   // Delete this block:
   {/* Law & Ordinance Search API Integration */}
   <LawSearchPanel />
   ```

---

## 5. Propose New `LawSystemPage.tsx` Component Plan

The new `src/components/law/LawSystemPage.tsx` will consolidate the legal tools and administrative documentation standards into a unified interface.

### Relocating `LawSearchPanel`
Move `src/components/budget/ui/LawSearchPanel.tsx` to `src/components/law/LawSearchPanel.tsx`.
- Adjust imports: The search panel relies on absolute paths (e.g. `@/hooks/useLawSearch`), which do not break when relocated.
- Renders the National Law & Ordinance search tool connecting to the Ministry of Government Legislation API.

### Incorporating Local Law Dictionary
We will define an interactive dictionary dataset of 13+ critical municipal and administrative terms. Features will include:
- Search input to filter terms by name.
- Category tags to filter terms (e.g. "용어 구별", "회계 용어", "법률 효력").
- Clean cards showing the term, category, definition, and correct usage examples.

### Incorporating Standard Document Guide Panel
A reference panel showing spacing, layout, margins, and ending rules based on `hwp_generation_guidelines.md`:
- **Document Layout**: A4 page margins (top/bottom 15mm, left/right 20mm), 130% line height.
- **Typography Standards**: Heading 1 (22pt, HeadlineM), Level 1 index (16pt, HeadlineM), Body text (15pt, Human Myeongjo, 98% width, -2% letter spacing), Tables/Notes (13pt, Jung Gothic).
- **Hierarchical Indexing**: Bullet hierarchy (`Ⅰ.` $\rightarrow$ `가.` $\rightarrow$ `1)` $\rightarrow$ `가)` $\rightarrow$ `⑴`), indenting by 10pt (2 spaces) per level, and aligning subsequent lines (`Shift + Tab` format).
- **Spacing Guidelines**: 1 space after heading indexes. 2 spaces after attachments ('붙임  1.').
- **"끝." (The End) Rules**:
  - *No attachment*: add 2 spaces after final word and write `끝.` (e.g. `수고하셨습니다.  끝.`).
  - *With attachment*: add 2 spaces after final attachment list and write `끝.` (e.g. `1부.  끝.`).
  - *Ending with a Table*: Write `끝.` 2 spaces after the bottom boundary of the table, left-aligned.
- **Administrative Value Tuning**: Guidelines for Factuality (no `-시키다` suffix), Accessibility (purifying loanwords), Non-Authoritativeness (avoiding military commands), Neutrality (female-first 가나다순 list ordering, e.g. `여 15, 남 20`).

### Code Sketch for `LawSystemPage.tsx`
The full implementation sketch of `LawSystemPage.tsx` will follow a multi-tab workspace structure.

```tsx
'use client';

import React, { useState } from 'react';
import { Scale, BookOpen, FileText, Search } from 'lucide-react';
import { LawSearchPanel } from './LawSearchPanel';

// Local Dictionary Data
const DICTIONARY_ENTRIES = [ ... ];

export function LawSystemPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'dictionary' | 'guide'>('search');
  
  return (
    <div className="w-full flex flex-col gap-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200/50 bg-slate-50/50 p-1.5 rounded-2xl w-full border border-slate-200/30 gap-2 shrink-0">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'search' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale size={14} /> 법령/조례 실시간 검색
        </button>
        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'dictionary' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen size={14} /> 자치/행정 용어 사전
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'guide' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={14} /> 공문서 표준 작성 가이드
        </button>
      </div>

      {/* Content Rendering */}
      <div className="flex-1">
        {activeTab === 'search' && <LawSearchPanel />}
        {activeTab === 'dictionary' && <LawDictionarySection />}
        {activeTab === 'guide' && <DocumentGuideSection />}
      </div>
    </div>
  );
}

function LawDictionarySection() {
  // Dictionary filtering & UI representation
  ...
}

function DocumentGuideSection() {
  // Collapsible or card-based guideline panels
  ...
}
```
