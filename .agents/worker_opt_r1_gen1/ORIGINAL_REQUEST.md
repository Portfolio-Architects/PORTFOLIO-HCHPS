## 2026-07-21T01:24:41Z
You are worker_opt_r1_gen1.
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_opt_r1_gen1.

Your task is to implement Requirement 1 (R1): Top-Level Hook Scoping & Conditional Computing in `ProtectedApp` (`src/app/page.tsx`), `useMergedSignals.ts`, and `useGraphCustomization.ts`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Key Implementation Specifications:
1. `src/hooks/useMergedSignals.ts`:
   - Update `useMergedSignals` signature to accept an 8th parameter: `enabled: boolean = true`.
   - Define module-level static fallback constants: `const EMPTY_KEYWORD_MAP: Record<string, number> = {};` and `const EMPTY_MERGED_ENTRIES: SignalEntry[] = [];`.
   - When `!enabled`, return `{ mergedKeywordMap: EMPTY_KEYWORD_MAP, mergedEntries: EMPTY_MERGED_ENTRIES }` directly without running `extractKeywords` or date sorting loops.

2. `src/hooks/useGraphCustomization.ts`:
   - Locate the Auto-Save `useEffect` (around lines 690-698) that syncs data to the cloud.
   - Update its condition from `if (!cloudFetched.current || isSyncing.current) return;` to `if (!enabled || !cloudFetched.current || isSyncing.current) return;`.

3. `src/app/page.tsx`:
   - Define module-level static constant `EMPTY_AI_CONTEXT` outside components.
   - Inside `ProtectedApp`, compute `isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen;`.
   - Pass `isMergedSignalsEnabled` to `useMergedSignals(...)`.
   - Update `aiContextData` `useMemo` so if `!isQuickInputOpen`, it returns `EMPTY_AI_CONTEXT`.

4. Verification:
   - Run `npx tsc --noEmit` and `node scripts/run-harness.js` to ensure 0 type errors, 0 lint errors, 0 schema violations.
   - Document changes in `handoff.md` and send a message back to parent with test results.
