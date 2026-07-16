# Self-Evolution & RSI Pipeline Implementation Plan

## Objectives
Validate and verify the Recursive Self-Improvement (RSI) loop and Self-Healing pipeline. We need to:
1. Ensure `scripts/self-evolution.js` implements O(N^2) complexity optimization, console log spams suppression, Next.js dynamic imports, run-harness validation, engineering report logging, milestone syncing, and Git commit/push integration.
2. Build/Verify `src/components/dashboard/DummyPerfTest.tsx` containing the mock performance bottlenecks (O(N^2) loop, console warnings, and direct MindMap3D import).
3. Test the Self-Rollback Guard by intentionally injecting a syntax/lint error into the component, running `self-evolution.js`, and asserting it reverts to the original clean state.
4. Verify the Infinity Tick Chain scheduler logic to ensure it can trigger 3-minute periodic diagnostics/optimizations and sustain the self-evolution loop recursively.

## Milestones
| Milestone | Name | Objective | Assigned Subagents | Status |
|-----------|------|-----------|--------------------|--------|
| M1 | 프로젝트 환경 및 기존 스크립트 분석 | Analyze existing scripts (`diagnose-targets.js`, `run-harness.js`, `sync-rules.js`) and current database schemas | Explorer 1 | DONE |
| M2 | `scripts/self-evolution.js` 구현 및 보완 | Ensure the evolution script correctly parses diagnostics, refactors targets, validates, and runs git integration | Worker 1 | IN_PROGRESS |
| M3 | `DummyPerfTest.tsx` 병목 주입 및 리팩토링 검증 | Test the evolution script against `DummyPerfTest.tsx` containing mock bottlenecks and verify it refactors them successfully | Worker 1, Challenger 1 | PLANNED |
| M4 | Self-Rollback Guard 및 Infinity Tick 체인 검증 | Test rollback guard via syntax errors, verify consecutive failure count logic, and design/validate the RSI_TICK scheduler chain | Worker 1, Challenger 1, Auditor | PLANNED |

## Detailed Verification Plan
1. **Initial Baseline Run**: Run diagnostics to ensure the workspace starts with 0 bottlenecks or only the intentional ones.
2. **Mock Bottleneck Injection**: Ensure `src/components/dashboard/DummyPerfTest.tsx` has O(N^2) loop, console.warn/error, and static MindMap3D import.
3. **Execution & Refactoring**: Run `self-evolution.js` and verify it successfully updates `DummyPerfTest.tsx`, passes `run-harness.js`, logs the milestone to the engineering reports, and runs git commit.
4. **Rollback Guard Test**: Run `self-evolution.js` with `--test-rollback` or manually inject an ESLint/TypeScript compilation error. Confirm that:
   - Verification harness fails.
   - All mutations are rolled back.
   - The file is restored to its exact pre-mutation state.
   - The failure count is recorded in `data/self_evolution_state.json`.
5. **Infinity Tick Chain Validation**: Verify the scheduling logic of the 3-minute `RSI_TICK` (180 seconds) loop using the `schedule` tool or equivalent scheduler script configuration.
