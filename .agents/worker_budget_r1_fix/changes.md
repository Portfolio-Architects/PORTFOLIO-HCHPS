# Worker R1 Remediation Changes Log

## Files Modified

1. **`src/components/budget/ui/InlineEditCell.tsx`**
   - **Issue**: ESLint `@typescript-eslint/react-hooks/refs` error due to accessing and modifying `prevValueRef.current` directly in render.
   - **Fix**: Replaced `prevValueRef` with React state `prevValue`. Used state-based conditional prop sync (`if (prevValue !== value) { setPrevValue(value); setTempValue(...); }`), which is standard React state adjustment from props. Eliminates ref access during render and avoids synchronous `setState` inside `useEffect`.

2. **`src/components/budget/ui/BudgetCategoryCardItem.tsx`**
   - **Issue 1**: Numeric parsing bug in `handleSubItemUpdate` where `Number(newValue)` returned `NaN` on formatted strings like `"1,000,000"` or `"50,000원"`, resetting amounts to `0`.
   - **Fix 1**: Applied robust numeric sanitization:
     ```ts
     const cleaned = String(newValue).replace(/,/g, '').replace(/원/g, '').trim();
     const numAmt = isNaN(Number(cleaned)) ? 0 : Number(cleaned);
     ```
   - **Issue 2**: Unused prop warning from `onEditEntry: _onEditEntry` destructuring parameter while JSX used `onEditEntry(e)`.
   - **Fix 2**: Simplified parameter destructuring to `onEditEntry,` matching JSX call sites and eliminating the unused parameter alias.

3. **`src/components/budget/ui/PolicyGroupCard.tsx`**
   - **Issue**: TypeScript error `TS7053` on line 234 (`STATUS_CONFIG[groupStatus]`) due to implicit `any` indexing type.
   - **Fix**: Cast `groupStatus` as `keyof typeof STATUS_CONFIG` (`STATUS_CONFIG[groupStatus as keyof typeof STATUS_CONFIG]`).

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors)
- `node scripts/run-harness.js`: PASS (0 Zod database errors, 0 ESLint errors, 0 ESLint warnings)
