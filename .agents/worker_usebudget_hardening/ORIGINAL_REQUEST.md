## 2026-07-29T17:10:31Z
You are Worker 5 (useBudget Batch Actions Hardening Worker) for the Budget UI/UX Overhaul project.
Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_usebudget_hardening

Objective:
Harden the batch action functions in `src/hooks/useBudget.ts`:

1. **`batchSettleEntries` Idempotency**:
   When setting status to `'REJECTED'`, check if `memo` already includes `' [지출반려]'` before appending, so repeated batch rejections do not produce duplicate tags (e.g. `' [지출반려] [지출반려]'`).

2. **`batchDeleteEntries` Referential Integrity Guard**:
   Check if any deleted entry has `isPlanned: true` and linked actual expenditures (`relatedPlanId === id`), preventing orphan records.

3. **`batchUpdateEntries` Limit Check Integration**:
   Run category budget remaining checks when updating amounts in bulk.

4. **Verification**:
   Run `npx tsc --noEmit` and `node scripts/run-harness.js` from `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL` to confirm 0 errors.
