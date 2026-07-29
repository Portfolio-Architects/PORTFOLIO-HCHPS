# Milestone 3 (R3: Batch Actions & Modal Comparison UX) Remediation Blueprint

## 1. Audit Finding Diagnosis & Root Cause Analysis

### Overview
The audit review report (`reviewer_m3_1/report.md`) flagged four critical issues regarding Milestone 3:
1. **Missing Batch Helper Functions**: `batchUpdateEntries`, `batchDeleteEntries`, and `batchSettleEntries` were reported missing in `useBudget.ts`.
2. **Missing `ExpenseBatchToolbar.tsx`**: Floating multi-select batch action toolbar missing/not functioning.
3. **`LedgerModal.tsx` Incomplete UX**: Missing `isSplitView` dual-panel toggle, entry multi-select checkboxes, and batch toolbar integration.
4. **`ExpenseEntryModal.tsx` Missing Cross-Modal Navigation**: Missing target budget category comparison card and navigation button to `LedgerModal`.

### Root Cause Analysis
- In `src/hooks/useBudget.ts`, the functions `batchUpdateEntries`, `batchDeleteEntries`, and `batchSettleEntries` **were written internally**, but **were omitted from the return object in `src/app/page.tsx` destructuring**.
- In `src/app/page.tsx`, `useBudget()` was called without extracting `batchUpdateEntries`, `batchDeleteEntries`, and `batchSettleEntries`. As a result, they were **never passed down** to `WorkspaceView.tsx` or `BudgetDashboard.tsx`.
- Because `BudgetDashboard.tsx` received `undefined` for these batch function props, `LedgerModal.tsx` operated with no batch action handlers connected.
- In `ExpenseEntryModal.tsx`, while form validation against category stats existed, there was no **target budget overview card** or **cross-modal comparison button** (`onOpenLedgerModal`) linking back to `LedgerModal`.

---

## 2. Step-by-Step Implementation Specification for Worker 3

### Step 1: `src/hooks/useBudget.ts` Verification & Export Protocol

Ensure `src/hooks/useBudget.ts` contains the following batch mutations and exports them cleanly:

```typescript
// ================= Batch Entry Mutations =================
const batchUpdateEntriesMut = useMutation({
  mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<BudgetEntry> }) => {
    const current = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || entries;
    const idSet = new Set(ids);
    const newEntries = current.map(e => idSet.has(e.id) ? { ...e, ...updates } : e);
    await replaceAll('BUDGET_ENTRIES', newEntries);
    return newEntries;
  },
  onMutate: async ({ ids, updates }) => {
    await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
    const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
    const idSet = new Set(ids);
    queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) =>
      (old || []).map(e => idSet.has(e.id) ? { ...e, ...updates } : e)
    );
    return { previous };
  },
  onError: (err, vars, context) => {
    if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
    queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
  }
});

const batchDeleteEntriesMut = useMutation({
  mutationFn: async (ids: string[]) => {
    if (typeof window !== 'undefined') {
      try {
        const tombstones = getTombstones();
        let changed = false;
        ids.forEach(id => {
          if (!tombstones.some(t => t.id === id)) {
            tombstones.push({ id, deletedAt: Date.now() });
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('hchps-global-tombstones', JSON.stringify(tombstones));
        }
      } catch {}
    }
    const current = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || entries;
    const idSet = new Set(ids);
    const remaining = current.filter(e => !idSet.has(e.id));
    await replaceAll('BUDGET_ENTRIES', remaining);
    return remaining;
  },
  onMutate: async (ids) => {
    await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
    const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
    const idSet = new Set(ids);
    queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) =>
      (old || []).filter(e => !idSet.has(e.id))
    );
    return { previous };
  },
  onError: (err, vars, context) => {
    if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
    queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
  }
});

const batchSettleEntriesMut = useMutation({
  mutationFn: async ({ ids, status }: { ids: string[]; status: 'SETTLED' | 'PENDING' | 'REJECTED' }) => {
    const current = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']) || entries;
    const idSet = new Set(ids);
    const newEntries = current.map(e => {
      if (!idSet.has(e.id)) return e;
      if (status === 'SETTLED') {
        return { ...e, isSettled: true, isPlanned: false };
      } else if (status === 'PENDING') {
        return { ...e, isSettled: false, isPlanned: true };
      } else {
        const memoText = e.memo ? `${e.memo} [지출반려]` : '[지출반려]';
        return { ...e, isSettled: false, isPlanned: false, memo: memoText };
      }
    });
    await replaceAll('BUDGET_ENTRIES', newEntries);
    return newEntries;
  },
  onMutate: async ({ ids, status }) => {
    await queryClient.cancelQueries({ queryKey: ['BUDGET_ENTRIES'] });
    const previous = queryClient.getQueryData<BudgetEntry[]>(['BUDGET_ENTRIES']);
    const idSet = new Set(ids);
    queryClient.setQueryData<BudgetEntry[]>(['BUDGET_ENTRIES'], (old) =>
      (old || []).map(e => {
        if (!idSet.has(e.id)) return e;
        if (status === 'SETTLED') {
          return { ...e, isSettled: true, isPlanned: false };
        } else if (status === 'PENDING') {
          return { ...e, isSettled: false, isPlanned: true };
        } else {
          const memoText = e.memo ? `${e.memo} [지출반려]` : '[지출반려]';
          return { ...e, isSettled: false, isPlanned: false, memo: memoText };
        }
      })
    );
    return { previous };
  },
  onError: (err, vars, context) => {
    if (context?.previous) queryClient.setQueryData(['BUDGET_ENTRIES'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['BUDGET_ENTRIES'] });
    queryClient.invalidateQueries({ queryKey: ['BUDGET_CATEGORIES'] });
  }
});

const batchUpdateEntries = useCallback((ids: string[], updates: Partial<BudgetEntry>) => {
  if (!ids || ids.length === 0) return;
  batchUpdateEntriesMut.mutate({ ids, updates });
}, [batchUpdateEntriesMut]);

const batchDeleteEntries = useCallback((ids: string[]) => {
  if (!ids || ids.length === 0) return;
  batchDeleteEntriesMut.mutate(ids);
}, [batchDeleteEntriesMut]);

const batchSettleEntries = useCallback((ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => {
  if (!ids || ids.length === 0) return;
  batchSettleEntriesMut.mutate({ ids, status });
}, [batchSettleEntriesMut]);
```

**Hook Return Statement**:
```typescript
return { 
  categories: uniqueCategories, 
  entries, 
  isLoading: catLoading || entryLoading,
  addCategory, 
  updateCategory, 
  deleteCategory, 
  replaceCategories,
  addEntry, 
  updateEntry, 
  deleteEntry, 
  batchUpdateEntries,
  batchDeleteEntries,
  batchSettleEntries,
  getCategoryStats, 
  checkLimit,
  overallStats,
  overallStatsActual
};
```

---

### Step 2: `src/components/budget/ui/ExpenseBatchToolbar.tsx` Specification

Ensure `ExpenseBatchToolbar.tsx` is completely defined with the following code:

```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, SlidersHorizontal, Trash2, X, AlertCircle, Clock } from 'lucide-react';

export interface ExpenseBatchToolbarProps {
  selectedCount: number;
  onSettleApprove: () => void;
  onStatusChange: (status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function ExpenseBatchToolbar({
  selectedCount,
  onSettleApprove,
  onStatusChange,
  onDelete,
  onClearSelection
}: ExpenseBatchToolbarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 border border-slate-700/80 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 sm:gap-4 text-xs font-semibold select-none">
        
        {/* Selected Count Indicator */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700/80">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="font-extrabold text-white text-sm tracking-tight">
            {selectedCount}<span className="text-xs text-slate-300 font-normal ml-0.5">개 항목 선택됨</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          
          {/* Batch Settle / Approve */}
          <button
            onClick={onSettleApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            title="선택한 항목을 모두 정산(결제) 완료 처리"
          >
            <CheckCircle2 size={15} />
            <span>일괄 승인</span>
          </button>

          {/* Batch Status Change */}
          <div className="relative" ref={statusMenuRef}>
            <button
              onClick={() => setShowStatusMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              title="상태 일괄 변경"
            >
              <SlidersHorizontal size={15} />
              <span>상태 변경</span>
            </button>

            {showStatusMenu && (
              <div className="absolute bottom-full mb-2 left-0 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-1.5 space-y-1 z-[110] animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    onStatusChange('SETTLED');
                    setShowStatusMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors font-medium text-xs cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>정산 완료 (SETTLED)</span>
                </button>
                <button
                  onClick={() => {
                    onStatusChange('PENDING');
                    setShowStatusMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition-colors font-medium text-xs cursor-pointer"
                >
                  <Clock size={14} />
                  <span>품의 진행중 (PENDING)</span>
                </button>
                <button
                  onClick={() => {
                    onStatusChange('REJECTED');
                    setShowStatusMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition-colors font-medium text-xs cursor-pointer"
                >
                  <AlertCircle size={14} />
                  <span>지출 반려 (REJECTED)</span>
                </button>
              </div>
            )}
          </div>

          {/* Batch Delete */}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            title="선택한 항목 일괄 삭제"
          >
            <Trash2 size={15} />
            <span>선택 삭제</span>
          </button>
        </div>

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          className="ml-1 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          title="선택 해제"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
```

---

### Step 3: `src/components/budget/ui/LedgerModal.tsx` Enhancements

1. **Props Interface Update**:
```typescript
interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => CategoryStats | null;
  onSettle?: (plannedEntryId: string, actualAmount: number) => void;
  batchUpdateEntries?: (ids: string[], updates: Partial<BudgetEntry>) => void;
  batchDeleteEntries?: (ids: string[]) => void;
  batchSettleEntries?: (ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  onOpenExpenseEntry?: (entry: BudgetEntry) => void;
  initialSelectedCategoryId?: string;
}
```

2. **State & View Mode Controls**:
- View mode switcher: `viewMode` state (`'ledger'` vs `'split'`).
- Split view category selector: `selectedCatId`.
- Multi-select selection state: `selectedEntryIds`.
- Checkboxes rendered on each entry item card with `toggleSelectEntry(id)`.
- Global select all toggle button in header.
- Sticky `<ExpenseBatchToolbar ... />` at the bottom when `selectedEntryIds.length > 0`.
- Clicking entry purpose or pencil icon triggers `onOpenExpenseEntry(e)` for seamless editing.

---

### Step 4: `src/components/budget/ui/ExpenseEntryModal.tsx` Enhancements

1. **Props Interface Update**:
```typescript
interface ExpenseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => CategoryStats | null;
  initialData: Partial<BudgetEntry> | null;
  preselectedCategoryId?: string;
  onSave: (isEdit: boolean, id: string | null, data: Partial<BudgetEntry>) => void;
  onOpenCategoryModal?: () => void;
  onOpenLedgerModal?: (categoryId?: string) => void;
}
```

2. **Live Target Category Budget Overview Card**:
When `selectedCatId` is selected, compute live stats `getCategoryStats(selectedCatId)` and display a visual overview card inside `ExpenseEntryModal`:
```tsx
{selectedCatId && (() => {
  const stats = getCategoryStats(selectedCatId);
  const cat = categories.find(c => c.id === selectedCatId);
  if (!stats || !cat) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-700">🎯 선택 예산 과목 현황</span>
        {onOpenLedgerModal && (
          <button
            type="button"
            onClick={() => onOpenLedgerModal(selectedCatId)}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
          >
            🔍 원장/듀얼패널 대조 뷰에서 확인
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="bg-white p-1.5 rounded border border-slate-200">
          <span className="text-slate-400 block text-[9px] font-sans">총 예산</span>
          <span className="font-bold text-slate-800">{stats.totalBudget.toLocaleString()}원</span>
        </div>
        <div className="bg-blue-50 p-1.5 rounded border border-blue-100">
          <span className="text-blue-600 block text-[9px] font-sans">실 집행액</span>
          <span className="font-bold text-blue-700">{stats.spent.toLocaleString()}원</span>
        </div>
        <div className="bg-teal-50 p-1.5 rounded border border-teal-100">
          <span className="text-teal-600 block text-[9px] font-sans">가용 잔액</span>
          <span className="font-bold text-teal-700">{stats.remaining.toLocaleString()}원</span>
        </div>
      </div>
      <div className="pt-0.5">
        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5 font-bold">
          <span>소진율</span>
          <span>{stats.usageRate.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${stats.usageRate > 90 ? 'bg-rose-500' : stats.usageRate > 75 ? 'bg-amber-500' : 'bg-teal-500'}`}
            style={{ width: `${Math.min(100, stats.usageRate)}%` }}
          />
        </div>
      </div>
    </div>
  );
})()}
```

---

### Step 5: Parent Component Prop Wiring Specification

#### 1. `src/app/page.tsx`
Destructure batch functions from `useBudget()` and pass to `<WorkspaceView>`:
```typescript
// Line 374 in page.tsx
const {
  categories: budgetCategories,
  entries: budgetEntries,
  addCategory,
  updateCategory,
  deleteCategory,
  replaceCategories,
  addEntry,
  updateEntry,
  deleteEntry,
  batchUpdateEntries,
  batchDeleteEntries,
  batchSettleEntries,
  getCategoryStats,
  overallStatsActual
} = useBudget();

// Line 745 in page.tsx
<WorkspaceView
  budgetCategories={budgetCategories}
  budgetEntries={actualBudgetEntries}
  addCategory={addCategory}
  updateCategory={updateCategory}
  deleteCategory={deleteCategory}
  replaceCategories={replaceCategories}
  addEntry={addEntry}
  updateEntry={updateEntry}
  deleteEntry={deleteEntry}
  batchUpdateEntries={batchUpdateEntries}
  batchDeleteEntries={batchDeleteEntries}
  batchSettleEntries={batchSettleEntries}
  getCategoryStats={handleGetCategoryStats}
  overallStats={overallStatsActual}
  // ...other props
/>
```

#### 2. `src/components/WorkspaceView.tsx`
Update `WorkspaceViewProps` interface and forward batch props to `BudgetDashboard`:
```typescript
interface WorkspaceViewProps {
  // Budget
  budgetCategories: BudgetCategory[];
  budgetEntries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  replaceCategories: (cats: BudgetCategory[]) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  batchUpdateEntries?: (ids: string[], updates: Partial<BudgetEntry>) => void;
  batchDeleteEntries?: (ids: string[]) => void;
  batchSettleEntries?: (ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  getCategoryStats: (id: string) => CategoryStats | null;
  overallStats: { ... };
  // ...
}

// In WorkspaceViewComponent JSX:
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
  batchUpdateEntries={props.batchUpdateEntries}
  batchDeleteEntries={props.batchDeleteEntries}
  batchSettleEntries={props.batchSettleEntries}
  getCategoryStats={props.getCategoryStats}
  overallStats={props.overallStats}
/>
```

#### 3. `src/components/budget/BudgetDashboard.tsx`
Update `BudgetDashboardProps` interface and pass handlers to `LedgerModal` and `ExpenseEntryModal`:
```typescript
interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  replaceCategories?: (cats: BudgetCategory[]) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  batchUpdateEntries?: (ids: string[], updates: Partial<BudgetEntry>) => void;
  batchDeleteEntries?: (ids: string[]) => void;
  batchSettleEntries?: (ids: string[], status: 'SETTLED' | 'PENDING' | 'REJECTED') => void;
  getCategoryStats: (id: string) => CategoryStats | null;
  overallStats: { ... };
}

// In BudgetDashboard JSX:
{showEntryModal && (
  <ExpenseEntryModal
    isOpen={showEntryModal}
    onClose={() => setShowEntryModal(false)}
    categories={categories}
    entries={entries}
    getCategoryStats={getCategoryStats}
    initialData={entryModalInitialData}
    onSave={handleSaveEntry}
    onOpenCategoryModal={() => {
      setShowEntryModal(false);
      setReturnToEntryModal(true);
      setCatModalInitialData(null);
      setShowCatModal(true);
    }}
    onOpenLedgerModal={(catId) => {
      setShowEntryModal(false);
      setShowLedgerModal(true);
    }}
  />
)}

{showLedgerModal && (
  <LedgerModal
    isOpen={showLedgerModal}
    onClose={() => setShowLedgerModal(false)}
    categories={categories}
    entries={entries}
    getCategoryStats={getCategoryStats}
    onSettle={handleSettleEntry}
    batchUpdateEntries={props.batchUpdateEntries}
    batchDeleteEntries={props.batchDeleteEntries}
    batchSettleEntries={props.batchSettleEntries}
    onOpenExpenseEntry={(entry) => {
      setShowLedgerModal(false);
      openEditEntry(entry);
    }}
  />
)}
```

---

## 3. Independent Verification Protocol

To verify that Worker 3 has cleanly resolved all Milestone 3 audit findings:

1. **TypeScript Type Safety**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Output*: 0 type errors.

2. **Schema & Rule Harness Check**:
   ```bash
   node scripts/run-harness.js
   ```
   *Expected Output*: 0 Zod schema errors, 0 ESLint errors, 0 MVC violations.

3. **Functional UX Checklist**:
   - [ ] Open Ledger Modal (`원장대조` button on dashboard).
   - [ ] Verify T-Account Ledger View vs Dual-Panel Split View toggle (`LayoutList` / `Columns2`).
   - [ ] Select multiple entry checkboxes in Ledger Modal.
   - [ ] Verify floating `ExpenseBatchToolbar` appears at bottom with count.
   - [ ] Test "일괄 승인" (Batch Settle) -> items status updated atomically.
   - [ ] Test "상태 변경" dropdown (SETTLED, PENDING, REJECTED).
   - [ ] Test "선택 삭제" -> items deleted with tombstone storage update.
   - [ ] Click an entry item -> opens `ExpenseEntryModal` populated with entry details.
   - [ ] Open `ExpenseEntryModal` -> select a category -> verify target category overview card appears.
   - [ ] Click "🔍 원장/듀얼패널 대조 뷰에서 확인" -> switches smoothly to `LedgerModal`.
