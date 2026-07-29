# Handoff Report: Local Data Hydration & Instant UI Feedback (R1 Exploration)

## 1. Observation

### Codebase Inspections & Exact Line References
1. **`src/hooks/useTasks.ts`**:
   - Lines 87–132: `addTaskMut`, `updateTaskMut`, `deleteTaskMut` implement `onMutate`, `onError`, `onSettled`.
   - Line 98, 117, 131: `onSettled: () => queryClient.invalidateQueries({ queryKey: ['TASKS'] })`.
   - Lines 172–177: `await addTaskMut.mutateAsync(nextTask)` inside `updateTask` creates sequential mutation blocking for recurring tasks.

2. **`src/hooks/useBudget.ts`**:
   - Lines 21–31: `enqueueKvWrite` implementation with artificial delay:
     ```ts
     function enqueueKvWrite<T>(fn: () => Promise<T>): Promise<T> {
       const p = kvWriteQueue.then(() => 
         fn()
           .then(res => new Promise<T>(resolve => setTimeout(() => resolve(res), 300)))
           .catch(err => new Promise<never>((_, reject) => setTimeout(() => reject(err), 300)))
       );
       kvWriteQueue = p.catch(() => null);
       return p;
     }
     ```
   - Lines 85, 148: `updateCategoryMut` and `updateEntryMut` call `enqueueKvWrite`, delaying mutation resolution by 300ms.
   - Line 205: `deleteCategory` triggers two mutations sequentially: `deleteCategoryMut.mutate(id)` and `replaceEntriesMut.mutate(remainingEntries)`.

3. **`src/hooks/useInventory.ts` & `src/hooks/useContacts.ts`**:
   - `useInventory.ts` (lines 8–11) and `useContacts.ts` (lines 29–34) use custom `useGoogleSheet` hook rather than `@tanstack/react-query`.
   - `useGoogleSheet.ts` (lines 24–31) hydrates from `localStorage` immediately on mount.
   - `useSheetCrud` (lines 101–124) runs `syncAdd`, `syncUpdate`, `syncDelete` asynchronously without `try/catch` or error rollback mechanisms for local React state.

4. **`src/app/api/data/route.ts` & `src/lib/sheets-api.ts`**:
   - `route.ts` line 279: `apiCache.delete(sheet)` in `writeDataToFile` invalidates in-memory API cache on write, causing subsequent reads to execute `fs.readFile` disk operations.
   - `route.ts` line 282: `backupDataFile(sheet, data).catch(...)` runs asynchronously in background without blocking POST HTTP response.
   - `sheets-api.ts` lines 316–335: `writeData` updates client-side `clientCache` immediately upon HTTP POST success.

---

## 2. Logic Chain

1. **Observation 1 & 2** show that `useTasks` and `useBudget` use React Query with `onMutate` optimistic updates, but `onSettled` calls `invalidateQueries`, which triggers an immediate network HTTP GET fetch after every mutation.
2. **Observation 2** shows that `useBudget.ts` explicitly introduces a 300ms artificial delay via `enqueueKvWrite` on every category/entry update, directly causing a 300ms UI update delay before `onSettled` settles.
3. **Observation 3** shows that `useInventory` and `useContacts` achieve instant 0ms cold-start rendering via `localStorage` hydration, but lack error rollback logic (`onError`) and do not share query state via React Query.
4. **Observation 4** shows that `sheets-api.ts` already updates `clientCache` in memory when `writeData` succeeds, making post-mutation network refetches via `invalidateQueries` redundant.
5. **Conclusion**: Unifying all 4 hooks under React Query with `localStorage` `initialData` hydration, removing `enqueueKvWrite` 300ms artificial delays, eliminating redundant `invalidateQueries` refetches on settled mutations, and updating server `apiCache` directly will achieve true 0ms optimistic UI updates without disk I/O delay across the entire application.

---

## 3. Caveats

- **Network Mode**: Investigation was conducted under CODE_ONLY network mode. No external APIs were queried.
- **Yjs/PartyKit Integration**: Real-time CRDT sync via PartyKit/Yjs operates in parallel with local data fetching; recommendations focus on local React Query & disk data hydration.

---

## 4. Conclusion

To implement R1 requirements (Local Data Hydration & Instant UI Feedback with 0ms UI delay):
1. **Unify Hooks**: Standardize `useInventory` and `useContacts` to use React Query alongside `useTasks` and `useBudget`.
2. **0ms Cold Start**: Add `initialData` loading from `localStorage` (`hchps-fallback-<SHEET>`) to `useQuery` across all 4 hooks.
3. **Remove 300ms Delays**: Remove `enqueueKvWrite` artificial delay from `useBudget.ts`.
4. **Optimistic Settlement**: Rely on `onMutate` cache updates and `onError` snapshot rollback; remove `invalidateQueries` calls from `onSettled`.
5. **Server Cache Preservation**: Update `apiCache` in `/api/data/route.ts` directly on write instead of deleting it.

---

## 5. Verification Method

1. **Static Analysis & Harness Verification**:
   - Run `node scripts/run-harness.js` to ensure TypeScript compilation and Zod schema validations pass without errors.
2. **Manual Inspection**:
   - Check `useBudget.ts` for absence of `setTimeout(..., 300)` or `enqueueKvWrite`.
   - Inspect `useTasks.ts`, `useBudget.ts`, `useInventory.ts`, `useContacts.ts` for `initialData` from `localStorage`.
