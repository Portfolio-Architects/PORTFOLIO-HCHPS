## 2026-07-15T18:26:20+09:00
You are an Implementation Worker (teamwork_preview_worker).
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m2_m3.

Your mission is to implement:
1. scripts/self-evolution.js
2. src/components/dashboard/DummyPerfTest.tsx

## Core Requirements for scripts/self-evolution.js:
- It must run node scripts/diagnose-targets.js to generate/load data/diagnose_report.json.
- Analyze the report and automatically refactor three bottleneck types:
  1. O(N^2) complexity: Convert rendering/map nested loops (.find(), .filter(), .some()) to O(1) Map lookups using useMemo.
  2. Console spam: Find and comment out (e.g. /* console.warn(...) */) console.warn or console.error in src/components/.
  3. Dynamic imports: Rewrite static imports of heavy components (MindMap3D, WeeklyScheduler, InventoryList, BlockNote) to Next.js dynamic imports with { ssr: false } where applicable (e.g., in pages/dashboard components).
- Execute node scripts/run-harness.js for lint, tsc, and zod validation after any code mutation.
- Rollback Guard:
  - On Validation Success: Record patch details in PORTFOLIO VITAL - Engineering Report.md, run node scripts/sync-rules.js, and git commit/push with message "[auto] self-improvement: optimize <details>".
  - On Validation Failure: Instantly revert mutations (using git checkout or backup).
  - If a file region fails validation 3 consecutive times, apply [FALLBACK mode] by wrapping the affected region in try-catch.

## Core Requirements for src/components/dashboard/DummyPerfTest.tsx:
- Write a dummy testing React component containing:
  - A heavy O(N^2) mapping loop (e.g. using .find() inside .map()).
  - console.warn / console.error calls.
  - A static import of a heavy component (e.g., MindMap3D or WeeklyScheduler).
- This component will be used to test self-evolution.js.
- Ensure the self-evolution script can run on it and successfully refactor it.
- Also, test the Rollback Guard by intentionally introducing a syntax or lint error in a backup/test scenario and ensuring the script rolls it back cleanly.

## MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please write a detailed report of your work, implemented codes, and validation results at d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_m2_m3\handoff.md.
