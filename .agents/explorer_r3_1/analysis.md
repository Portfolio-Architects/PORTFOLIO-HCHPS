# R3 Command Palette (`Ctrl+K` / `Cmd+K`) Technical Exploration & Component Design Analysis

## 1. Executive Summary & Problem Scope

The objective of Mission R3 is to explore, analyze, and design a keyboard-driven **Command Palette (`Ctrl+K` / `Cmd+K`)** for the VITAL / HCHPS application. Currently, navigation across modules (Dashboard, Budget Workspace, 3D MindMap, Project Management) requires mouse clicks on top navigation buttons or mobile docks, and data search is split between specific views (e.g. `SearchResultModal` for wiki/drive content, local filters inside individual tables).

This analysis provides a comprehensive blueprint for implementing `CommandPalette.tsx`, enabling zero-latency global item search and instant keyboard navigation across all core data models (tasks, budget entries, inventory items, contacts, projects) and application views.

---

## 2. Codebase Investigation Evidence & Findings

### 2.1 Existing Modal, Dialog, and Overlay Implementations

An exhaustive search across `src/` revealed the existing modal pattern topology:

| Component | File Path | Line Range | Key Overlay Features & Patterns |
| font-mono | font-mono | font-mono | |
| `Modal` | `src/components/ui/modal.tsx` | 26–64 | Standard dialog base. Uses `fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop`. Controls `document.body.style.overflow = 'hidden'`. Closes on background click or `X` button. |
| `SearchResultModal` | `src/components/SearchResultModal.tsx` | 118–143, 169–351 | Integrated search popup. Backdrop: `fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md`. Features tabbed results (`wiki` vs `file`) and item click handlers. |
| `AppLogModal` | `src/components/AppLogModal.tsx` | — | System daemon log viewer overlay with dark theme terminal styling. |
| `AIAssistantModal` | `src/components/ai/AIAssistantModal.tsx` | 262–377 | Floating assistant modal responding to enter/esc keys within input context. |

> **Key Finding**: No global keyboard listener for `Ctrl+K` / `Cmd+K` currently exists in the application codebase. All existing modals rely on explicit button trigger clicks or custom custom events (`wiki:openNode`).

---

### 2.2 Module Navigation Routes & State Architecture

Navigation state management was traced through `src/app/page.tsx` and `src/components/Sidebar.tsx`:

1. **Module Union Type Definition** (`src/types/index.ts:174`):
   ```typescript
   export type ModuleType = 'workspace' | 'mindmap' | 'dashboard' | 'project';
   ```

2. **Active Module State & Switching** (`src/app/page.tsx:355–361`, `529–533`):
   - `activeModule` state lives in `ProtectedApp` (`src/app/page.tsx:355`).
   - Switching handler updates `visitedModules` for lazy loading / hydration persistence:
     ```typescript
     const handleModuleChange = useCallback((module: ModuleType) => {
       setActiveModule(module);
       setVisitedModules(prev => prev[module] ? prev : { ...prev, [module]: true });
       localStorage.setItem('hchps_active_module', module);
     }, []);
     ```
   - Top Header Navigation (`src/components/Sidebar.tsx:44–66`) renders tab buttons:
     - `'dashboard'`: "대시보드" (`LayoutDashboard` icon)
     - `'workspace'`: "예산관리" (`Archive` icon)
     - `'mindmap'`: "마인드맵" (`Zap` icon)
     - `'project'`: "사업관리" (`FolderGit2` icon)

3. **External Event Dispatch Navigation**:
   - `SearchResultModal.tsx:203-207` dispatches `wiki:openNode` custom event.
   - `page.tsx:573-582` listens to `wiki:openNode` to dynamically switch `activeModule` to `'mindmap'`.

---

### 2.3 Instant Local Data Sources for Cross-Module Item Search

Data hooks operating as local disk SSOT via `src/app/api/data/route.ts` and React Query were analyzed for search fields and action targets:

| Data Type | Primary Hook | Source File | Searchable Fields | Nav Target Module & Action |
|---|---|---|---|---|
| **Tasks** | `useTasks()` | `src/hooks/useTasks.ts` | `title`, `description`, `category`, `tags` (array), `dueDate`, `priority`, `status` | Target: `'dashboard'` (opens task item or switches view) |
| **Budget Items** | `useBudget()` | `src/hooks/useBudget.ts` | `BudgetCategory.name`, `policyProject`, `statItem`; `BudgetEntry.purpose`, `memo`, `docRegNum`, `amount` | Target: `'workspace'` (switches tab, applies category filter) |
| **Inventory** | `useInventory()` | `src/hooks/useInventory.ts` | `InventoryItem.name`, `category`, `currentStock`, `unit` | Target: `'workspace'` (switches to 홍보물 inventory tab) |
| **Contacts** | `useContacts()` | `src/hooks/useContacts.ts` | `Contact.name`, `phone`, `email`, `notes` | Target: `'dashboard'` (highlights contact in ContactsBox) |
| **Projects** | `useProjects()` | `src/hooks/useProjects.ts` | `Project.name`, `description`, `staff`, `location`, `target` | Target: `'project'` (switches to project management view) |
| **Meetings** | `useMeetings()` | `src/hooks/useMeetings.ts` | `Meeting.title`, `location`, `attendees` (array), `notes` | Target: `'dashboard'` (weekly scheduler view) |

---

## 3. Command Palette Component Design Specification

### 3.1 Global Keyboard Event Listener & Interaction Rules

The command palette must capture keyboard events globally at the `window` level, regardless of active focus (unless typing inside standard modal forms, with `Ctrl+K` taking precedence).

- **Toggle Trigger**: `Ctrl + K` (Windows/Linux) or `Cmd + K` (macOS).
  ```typescript
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    setIsOpen(prev => !prev);
  }
  ```
- **Escape Key**: Closes the palette modal when open.
- **ArrowDown / ArrowUp**: Moves `selectedIndex` between 0 and `filteredItems.length - 1` with auto-scroll into view.
- **Enter Key**: Triggers the action of `filteredItems[selectedIndex]` and closes palette.
- **Tab / Shift+Tab**: Trapped inside palette modal elements.

---

### 3.2 Search & Instant Filtering Engine Architecture

A unified search result structure (`CommandPaletteItem`) normalizes all searchable items into a uniform list with category tags and execution handlers:

```typescript
export type CommandCategory = 'navigation' | 'tasks' | 'budget' | 'inventory' | 'contacts' | 'projects';

export interface CommandPaletteItem {
  id: string;
  category: CommandCategory;
  categoryLabel: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string; // e.g. bg-blue-500/20 text-blue-400
  icon: React.ElementType;
  keywords?: string[];
  onSelect: () => void;
}
```

#### Matching Algorithm:
- Multi-token fuzzy query matching: Query `"부엉이 예산"` splits into `["부엉이", "예산"]`.
- Checks if **all** query tokens match any of `title`, `subtitle`, `categoryLabel`, or `keywords`.
- Returns grouped results sorted by category priority: **Navigation -> Tasks -> Budget -> Projects -> Inventory -> Contacts**.

---

### 3.3 High-Contrast Dark Theme UI/UX Specification

Compliant with `AGENTS.md` Rule 1 (React 19 & TailwindCSS v4 standards):

- **Backdrop Overlay**: `fixed inset-0 z-[120] bg-black/65 backdrop-blur-md transition-opacity duration-200 flex items-start justify-center pt-[12vh] px-4`
- **Modal Container**: `w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] text-slate-100`
- **Search Header Input**:
  - Icon: `Search` (slate-400)
  - Input: `w-full bg-transparent px-4 py-4 text-base text-slate-100 placeholder-slate-500 outline-none font-medium`
  - Keyboard hint badge: `<kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 font-mono">ESC</kbd>`
- **Category Header**: `px-4 py-1.5 bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-y border-slate-800/80 flex items-center gap-1.5`
- **Result Item Row**:
  - Regular: `px-4 py-3 flex items-center justify-between cursor-pointer transition-colors border-l-4 border-transparent hover:bg-slate-800/60 text-slate-300`
  - Active (Keyboard Selected): `bg-blue-600/25 border-l-4 border-blue-500 text-white font-semibold shadow-inner`
- **Footer Shortcut Legend**: `px-4 py-2 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between font-medium`

---

### 3.4 Accessibility & Focus Management Specification

1. **Focus Trapping**:
   - On opening, store `document.activeElement` into `lastFocusedElementRef`.
   - Shift focus immediately to `inputRef.current`.
   - On closing, restore focus to `lastFocusedElementRef.current?.focus()`.
2. **ARIA Compliance Attributes**:
   - Outer Container: `role="dialog" aria-modal="true" aria-label="Command Palette"`
   - Search Input: `role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="command-palette-list"`
   - Results Container: `id="command-palette-list" role="listbox"`
   - Item Row: `role="option" aria-selected={isSelected}`

---

## 4. Proposed Implementation Architecture & Code Patch Proposal

### 4.1 Proposed Component File: `src/components/CommandPalette.tsx`

```tsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, LayoutDashboard, Archive, Zap, FolderGit2, 
  CheckSquare, DollarSign, Box, Phone, Calendar, ArrowRight, CornerDownLeft 
} from 'lucide-react';
import { ModuleType, Task, BudgetCategory, BudgetEntry, InventoryItem, Contact, Project, Meeting } from '@/types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: ModuleType) => void;
  tasks?: Task[];
  budgetCategories?: BudgetCategory[];
  budgetEntries?: BudgetEntry[];
  inventoryItems?: InventoryItem[];
  contacts?: Contact[];
  projects?: Project[];
  meetings?: Meeting[];
}

// Full self-contained component implementation structure...
```

### 4.2 Integration Point in `src/app/page.tsx`

Add state & shortcut listener at top level of `ProtectedApp`:

```tsx
// Inside ProtectedApp component in src/app/page.tsx:
const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setIsCommandPaletteOpen(prev => !prev);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

// Render CommandPalette at the end of JSX tree:
<CommandPalette
  isOpen={isCommandPaletteOpen}
  onClose={() => setIsCommandPaletteOpen(false)}
  onNavigate={handleModuleChange}
  tasks={tasks}
  budgetCategories={budgetCategories}
  budgetEntries={budgetEntries}
  inventoryItems={inventoryItems}
  contacts={contacts}
  projects={projects}
  meetings={meetings}
/>
```

---

## 5. Independent Verification Plan

1. **Keyboard Trigger Test**: Press `Ctrl+K` or `Cmd+K` from any view -> verifies palette opens. Press `ESC` -> verifies palette closes and focus restores.
2. **Instant Search Test**: Type `"부엉이"` or `"예산"` -> verifies matching items across tasks, budget, inventory, contacts, and navigation commands render in < 16ms.
3. **Keyboard Navigation Test**: Press `ArrowDown` and `ArrowUp` -> verifies item highlight moves smoothly and active item auto-scrolls into viewport.
4. **Action Execution Test**: Press `Enter` on a navigation or item result -> verifies active module switches to target view and palette closes.
5. **Static Diagnostics Verification**: Run `npx tsc --noEmit` and `node scripts/run-harness.js` -> verifies 0 TypeScript compilation errors and 0 Zod/harness warnings.
