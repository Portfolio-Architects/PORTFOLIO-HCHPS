# Technical Context — System-Wide Freeze & Architectural Violation Elimination

## Codebase Context
- Project: PORTFOLIO - VITAL (`d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL`)
- Architecture: Modified FSD with MVC Ontology
  - Storage / Model: `src/app/api/data/route.ts` & local JSON (`data/*.json`)
  - UI / View: `src/components/dashboard`, `src/components/workspace`, `src/components/project`, `src/components/mindmap`
  - Controller / Hooks: `src/hooks/`
- Rules of Engagement (AGENTS.md):
  - Direct `fetch()` in UI components is an Architectural Violation.
  - Zero-Stall rule: Long Task thread stall >100ms is prohibited.
  - `document.hidden` / tab pause requirements for WebGL/3D loops.
  - Mandatory use of `node scripts/run-harness.js` and `node scripts/sync-rules.js`.

## Key Files Target List
1. `src/components/dashboard/LocalhostStatusHUD.tsx`: Refactor direct `fetch()` to `src/hooks/useLocalhostHealth.ts`.
2. `src/hooks/useLocalhostHealth.ts`: New custom hook for fetching localhost health metrics using React Query or standard state management.
3. `src/components/mindmap/MindMap3D.tsx`: Pause physics tick loop when hidden/inactive, clamp delta `Math.min(now - lastFrameTime, 33.3)`.
4. `src/app/project/ProjectManagementPage.tsx`: Component React.memo & callback isolation.
5. `src/components/project/WeeklyScheduler.tsx` / related components: React.memo & callback isolation.
6. `scripts/run-harness.js`: Gatekeeper test runner.
7. `scripts/sync-rules.js`: Rule & milestone log sync.
