# Project: RSI and Auto-Healing Pipeline

## Architecture
- **Model**: `src/app/api/data/route.ts`가 데이터의 SSOT이며, 로컬 디렉토리 `data/*.json`을 통해 관리됨. Zod 스키마 검증이 데이터 정합성을 보장함.
- **Controller/Scheduler (RSI)**: `scripts/self-evolution.js`가 진단 스크립트 `scripts/diagnose-targets.js`를 기동하여 `data/diagnose_report.json`에서 병목/이슈를 수집하고, 수정한 뒤 `scripts/run-harness.js`로 무결성을 검증하고, 성공 시 git commit 및 `scripts/sync-rules.js`를 기동하는 자동화 파이프라인.
- **Validation Component**: `src/components/dashboard/DummyPerfTest.tsx`에 고의로 성능 병목과 린트 에러를 유발하는 로직을 주입하여 파이프라인의 리팩토링 및 롤백 능력을 엔드투엔드로 테스트함.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | 프로젝트 환경 및 기존 스크립트 분석 | `scripts/` 내 `diagnose-targets.js`, `run-harness.js` 파일 및 기존 아키텍처 파악 | None | IN_PROGRESS |
| M2 | `scripts/self-evolution.js` 구현 | O(N^2) 루프 개선, console 스팸 제거, dynamic import 전환, Harness 무결성 검증, 커밋 및 롤백 가드 포함한 스크립트 작성 | M1 | PLANNED |
| M3 | `DummyPerfTest.tsx` 및 모의 테스트 구축 | 고의 병목 주입 컴포넌트 생성 및 린트 오류 테스트 설정 | M2 | PLANNED |
| M4 | 무한 틱(Infinity Tick) 체인 및 통합 파이프라인 검증 | 180초 스케줄러 설정 가이드, 자율 리팩토링 검증, 롤백 가드 검증 | M3 | PLANNED |

## Code Layout
- `scripts/self-evolution.js`: 자율 개선 및 자가 치유 오케스트레이터 스크립트
- `scripts/diagnose-targets.js`: 성능 병목 및 구조적 문제 진단 스크립트 (기존)
- `scripts/run-harness.js`: ESLint, TypeScript(tsc), Zod 검증 스크립트 (기존)
- `scripts/sync-rules.js`: 패치 기록 후 `AGENTS.md` 자동 동기화 및 갱신 스크립트 (기존)
- `src/components/dashboard/DummyPerfTest.tsx`: 더미 성능 테스트 컴포넌트 (신규)

## Interface Contracts
- **`diagnose_report.json` -> `self-evolution.js`**: `diagnose-targets.js` 실행 시 생성되는 JSON 결과 포맷을 활용하여 병목 대상 파일, 줄 번호, 타입(O(N^2), console 스팸, dynamic import 대상)을 식별함.
- **`run-harness.js` -> `self-evolution.js`**: 실행 결과 exit code가 0이면 무결성 성공, non-zero이면 실패(롤백 기동)로 판단함.
