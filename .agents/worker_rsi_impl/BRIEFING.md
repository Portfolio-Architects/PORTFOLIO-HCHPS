# BRIEFING — 2026-07-15T18:21:40+09:00

## Mission
Implement scripts/self-evolution.js and verify it against DummyPerfTest.tsx and the harness, ensuring 0-0-0 validation.

## 🔒 My Identity
- Archetype: worker_rsi_impl
- Roles: implementer, qa, specialist
- Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_rsi_impl
- Original parent: d1deeaa8-6d8d-46c6-bd15-fec48487af6a
- Milestone: M2 and M3 (RSI & Self-Evolution)

## 🔒 Key Constraints
- Local development localhost port is 3001, allowed origins: http://localhost:3001 and https://portfolio-architects.github.io.
- E2EE encryption bypass (deactivating E2EE) is prohibited - E2EE encryption bypass comments/checks will be flagged by diagnose-targets.js. Wait, rule 2A1 says "로컬 성능 최적화를 위한 E2EE 바이패스: 로컬 개발 및 오프라인 전용 앱 특성에 맞게 새로고침 로딩 속도를 극대화하기 위해, E2EE 암호화 연산은 완전히 비활성화(Bypass)하고 평문(Plain Text) JSON 형식으로 디스크에 직접 읽고 씁니다." But `diagnose-targets.js` checks: "if (content.includes('encryptPayload') && (content.includes('bypass') || content.includes('//') && content.includes('E2EE')))" - this flags architectural violations. So we must not put such comments or bypass E2EE directly in components.
- Do not cheat: do not hardcode test results.
- Must write handoff.md in our folder with the 5-component handoff report.
- We must run `node scripts/sync-rules.js` after engineering report update.

## Current Parent
- Conversation ID: d1deeaa8-6d8d-46c6-bd15-fec48487af6a
- Updated: not yet

## Task Summary
- **What to build**: `scripts/self-evolution.js` and `src/components/dashboard/DummyPerfTest.tsx`.
- **Success criteria**:
  - `self-evolution.js` runs `diagnose-targets.js` and parses/refactors 3 bottlenecks: Time Complexity, Console Spam, and Lazy Loading.
  - Automatically runs `run-harness.js`. If exit code is 0: appends log to Engineering Report.md, runs sync-rules.js, commits changes to git as `[auto] self-improvement: optimize <details>` and pushes.
  - If exit code is not 0, rolls back. Tracks file failures. On 3rd failure, injects `try-catch` fallback block or tags code/report.
  - Test on `src/components/dashboard/DummyPerfTest.tsx` and verify automated refactoring.
  - Test Rollback Guard on syntax/lint error in `DummyPerfTest.tsx`.
  - Compile-check codebase via `npm run build` and ensure 0 warnings/violations/bottlenecks.
- **Interface contracts**: PROJECT.md
- **Code layout**: src/components, scripts/

## Key Decisions Made
- [TBD]

## Artifact Index
- [TBD]

## Change Tracker
- **Files modified**: None
- **Build status**: Untested
- **Pending issues**: Implement self-evolution script and dummy component

## Quality Status
- **Build/test result**: Untested
- **Lint status**: Untested
- **Tests added/modified**: None

## Loaded Skills
- None
