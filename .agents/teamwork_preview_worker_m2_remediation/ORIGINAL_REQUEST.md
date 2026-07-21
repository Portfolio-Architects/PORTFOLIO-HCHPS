## 2026-07-21T06:59:19Z
<USER_REQUEST>
You are the Remediation Worker (`teamwork_preview_worker_m2_remediation`).
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\teamwork_preview_worker_m2_remediation
Project Root: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Parent Orchestrator ID: fd566a6d-b875-4699-a3d8-ad4969407ab3

Your task is to fix 5 specific bugs / ESLint violations in `src/components/inventory/InventoryList.tsx` and `src/components/budget/ui/PolicyGroupCard.tsx` (and `src/hooks/useVirtualGrid.ts` if relevant):

1. **Bug 1 (ESLint `react-hooks/refs`)**: In `src/components/inventory/InventoryList.tsx`, accessing `containerRef.current.offsetTop` directly in the render body violates React Hook ref access rules. Fix: Compute offset inside the `handleScroll` event listener using `containerRef.current.getBoundingClientRect().top + scrollParent.scrollTop` or derived inside event handlers/effects, NOT directly in render body.
2. **Bug 2 (`useVirtualGrid` scroll calculation)**: In `src/components/inventory/InventoryList.tsx` / `useVirtualGrid.ts`, relative scroll top calculation miscalculates when nested in relative containers. Fix: calculate scroll top using `getBoundingClientRect()` relative to `scrollParent`.
3. **Bug 3 (Virtual grid row keys)**: Virtual grid rows currently use `key={rowIndex}`, causing DOM reconciliation thrashing on item delete/filter. Fix: use a stable row key such as `key={row[0]?.id || rowIndex}`.
4. **Bug 4 (Modal state cleanup)**: `handleAdjust` leaves `selectedItem` in state when closing the adjust modal. Fix: add `setSelectedItem(null)` on modal close handler.
5. **Bug 5 (`PolicyGroupCard.tsx` category swap)**: `handleSwapCat` in `src/components/budget/ui/PolicyGroupCard.tsx` updates ALL N categories instead of ONLY the 2 swapped categories. Fix: call `updateCategory` ONLY for `idx` and `targetIdx`.

### Verification Requirements:
- Execute `npx tsc --noEmit` and `node scripts/run-harness.js` via `run_command`.
- Ensure 0 ESLint errors/warnings, 0 TypeScript errors, 0 Zod schema errors, 0 architectural violations, 0 performance bottlenecks.

### Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Reporting:
- Create `progress.md` and `changes.md` in your working directory.
- Create `handoff.md` with complete verification details, command outputs, and file changes.
- Send a message to Parent Orchestrator (fd566a6d-b875-4699-a3d8-ad4969407ab3) with your summary and handoff location.
</USER_REQUEST>
