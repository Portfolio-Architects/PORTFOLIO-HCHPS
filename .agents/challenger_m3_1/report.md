# Milestone 3 (R3: Batch Actions & Modal Comparison UX) Empirical Challenge Report

**Date**: 2026-07-29  
**Challenger**: Challenger 1 (EMPIRICAL CHALLENGER)  
**Target**: `useBudget.ts`, `LedgerModal.tsx`, `ExpenseBatchToolbar.tsx`, `BatchEditModal.tsx`  
**Working Directory**: `d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\challenger_m3_1`  

---

## Challenge Summary

**Overall Risk Assessment**: **MEDIUM**

The core Milestone 3 implementations (`batchUpdateEntries`, `batchDeleteEntries`, `batchSettleEntries`) and modal comparison views (`ledger` T-Account view vs `split` dual-panel view) are functional, well-isolated, and demonstrate exceptional execution performance ($< 3\text{ms}$ execution for 5,000 entries). Type checking (`npx tsc --noEmit`) and database schema integrity tests passed with **0 errors**.

However, empirical stress testing uncovered **3 subtle state mutation & edge-case vulnerabilities**:
1. Non-idempotent string concatenation on `REJECTED` status batch settlements (repeated applications result in memo string duplication: `"[지출반려] [지출반려]"`).
2. Omission of referential integrity validation in `batchDeleteEntries` when deleting planned entries (`isPlanned: true`) with linked actual expenditures (`relatedPlanId`).
3. Omission of category budget limit validation in `batchUpdateEntries` when bulk modifying transaction amounts.

---

## Stress Test & Empirical Results

| Test Scenario | Input / Dataset | Expected Behavior | Actual Behavior | Result | Execution Time |
|---|---|---|---|---|---|
| **Empty Array Input** | `ids = []` | Early return, zero state mutation, no crash | Intact state preserved, returned cleanly | **PASS** | $< 0.1\text{ms}$ |
| **Missing / Non-existent IDs** | `ids = ['ghost-1', 'ghost-2']` | Filter out non-matching IDs, preserve valid items | Zero mutations to existing 100 entries | **PASS** | $< 0.1\text{ms}$ |
| **High Volume Batch Update** | 5,000 entries, 2,500 selected | Update 2,500 items in sub-50ms | 5,000 items processed, 2,500 updated | **PASS** | **1.23 ms** |
| **High Volume Batch Delete** | 5,000 entries, 2,500 selected | Delete 2,500 items in sub-50ms | 2,500 items cleanly removed | **PASS** | **0.90 ms** |
| **High Volume Batch Settle** | 5,000 entries, 2,500 selected | Update status in sub-50ms | 2,500 items settled | **PASS** | **2.43 ms** |
| **TypeScript Compiler Check** | Full repository scan | `npx tsc --noEmit` 0 errors | 0 errors | **PASS** | Task-39 Complete |
| **Zod Schema Integrity** | 78 records across 4 tables | 0 schema violations | 0 errors | **PASS** | Task-45 Complete |
| **Repeated Batch Rejection** | 3 consecutive `REJECTED` calls | Idempotent memo tag (single `[지출반려]`) | Appended tag 3 times (`[지출반려] [지출반려] [지출반려]`) | **WARN** | Logic flaw |
| **Batch Delete Planned Entry** | Planned entry with linked expenses | Block delete or warn user | Deletes planned entry, leaving orphaned children | **WARN** | Integrity flaw |
| **Batch Update Exceeding Limit** | Amount $> \text{remaining budget}$ | Enforce checkLimit protection | Updates amount without budget limit check | **WARN** | Limit check bypass |

---

## Challenges & Failure Mode Analysis

### [Medium] Challenge 1: Non-Idempotent Memo Mutation in `batchSettleEntries`

- **Assumption Challenged**: Status changes in batch operations should be idempotent.
- **Attack Scenario**: User selects 10 entries and clicks "지출 반려 (REJECTED)". Later, the user selects them again and applies "지출 반려" or status changes back and forth.
- **Observed Behavior**:
  ```ts
  const memoText = e.memo ? `${e.memo} [지출반려]` : '[지출반려]';
  ```
  Repeated execution results in `memo: "Purchase item [지출반려] [지출반려] [지출반려]"`.
- **Blast Radius**: Pollutes database memo text with duplicate suffix tags.
- **Suggested Defense**:
  ```ts
  const hasTag = e.memo?.includes('[지출반려]');
  const memoText = hasTag ? e.memo : (e.memo ? `${e.memo} [지출반려]` : '[지출반려]');
  ```

### [Medium] Challenge 2: Referential Integrity Omission in `batchDeleteEntries`

- **Assumption Challenged**: Deleting planned entries via batch actions must enforce the same child expenditure checks as single item deletion.
- **Attack Scenario**: Single item `deleteEntry(id)` checks:
  ```ts
  if (entryToDelete && entryToDelete.isPlanned) {
    const hasSettledChildren = entries.some(e => e.relatedPlanId === id);
    if (hasSettledChildren) { alert(...); return; }
  }
  ```
  However, `batchDeleteEntries(ids)` directly filters out the entries without checking if any selected planned entry has settled children with `relatedPlanId === id`.
- **Blast Radius**: Creates orphaned actual expenditure entries whose parent plan ID points to a deleted item.
- **Suggested Defense**: Before executing `batchDeleteEntriesMut`, check if any of the target IDs are planned entries with dependent settled children, and block or warn the user.

### [Low] Challenge 3: Budget Limit Bypass in `batchUpdateEntries`

- **Assumption Challenged**: Updating entry amounts in bulk should respect category budget limits.
- **Attack Scenario**: Single item `updateEntry` calls `checkLimit` before mutating. `batchUpdateEntries` directly applies property updates without evaluating `checkLimit`.
- **Blast Radius**: Allows bulk updates to set expense amounts exceeding the category's available budget.
- **Suggested Defense**: Pass updates through `checkLimit` or sum the delta of selected items to ensure category budget is not exceeded.

---

## Unchallenged Areas

- **React Query Cache Optimistic Updates**: `onMutate` cache updates for `batchUpdateEntriesMut`, `batchDeleteEntriesMut`, and `batchSettleEntriesMut` correctly update local Query cache and handle rollback on error.
- **Modal Comparison UI**: `LedgerModal.tsx` dual-mode rendering (`ledger` comparison view vs `split` dual-panel view) functions correctly with no layout shifts or crashes.
