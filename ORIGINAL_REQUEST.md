# Original User Request

## Initial Request — 2026-07-15T18:19:12+09:00

이 프로젝트는 바이탈 앱(`PORTFOLIO - VITAL`)에 재귀적 자기개선 루프(Recursive Self-Improvement, RSI)를 구축하여, 정기적으로 코드베이스 진단 및 데이터 무결성 검증을 수행하고, 감지된 병목이나 아키텍처 오류를 자율 치유(Self-Healing) 및 리팩토링하는 무인 자동화 파이프라인을 구현하는 것을 목표로 합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 자율 진화(Self-Evolution) 메인 스크립트 구축
- `scripts/self-evolution.js` 스크립트를 구현합니다. 이 스크립트는 실행 시 다음 단계를 거칩니다:
  1. `node scripts/diagnose-targets.js`를 비동기 구동하여 최신 `data/diagnose_report.json`을 갱신 및 로드합니다.
  2. `diagnose_report.json`에 기재된 결함(Lint 경고, 아키텍처 위반, 성능 병목)을 분석합니다.
  3. 검출된 주요 성능 병목 및 규격 위반을 자율적으로 리팩토링하여 소스 코드를 직접 수정합니다:
     - **시간 복잡도 개선**: rendering/map 루프 내의 $O(N^2)$ 순차 검색/필터를 $O(1)$ 상수 시간 lookup 구조로 자동 변환 또는 `useMemo` 적용.
     - **콘솔 스팸 제거**: UI 컴포넌트 내의 `console.warn`/`console.error` 스팸 코드를 탐색해 안전하게 제거하거나 주석 처리.
     - **지연 임포트 주입**: 대형 모듈(예: `MindMap3D`, `WeeklyScheduler` 등)의 직접 임포트를 감지하여 Next.js `dynamic(..., { ssr: false })` 임포트로 자동 리팩토링.
  4. 수정이 발생하면 `node scripts/run-harness.js`를 기동하여 ESLint, TypeScript(tsc) 빌드, Zod 데이터 검증 등 시스템 무결성을 테스트합니다.
  5. **검증 성공 시**:
     - `PORTFOLIO VITAL - Engineering Report.md`에 구체적인 리팩토링 패치 내역을 즉각 기록합니다.
     - `node scripts/sync-rules.js`를 실행하여 마일스톤 로그를 갱신합니다.
     - Git 커밋 및 푸시를 실행합니다 (커밋 메시지 포맷: `[auto] self-improvement: optimize <details>`).
  6. **검증 실패 시 (Self-Rollback Guard)**:
     - `git checkout -- <파일경로>` 또는 사전 백업을 활용해 즉시 이전의 안전한 상태로 소스 코드를 복구(Rollback)합니다.
     - 동일 파일 영역에 대해 3회 연속 치유 실패 시, 해당 영역에 `[FALLBACK mode]` 가드와 동적 디버깅용 catch 구문을 생성하여 대비합니다.

### R2. 무한 틱 스케줄러 체인(Infinity Tick Chain) 프로토콜 검증
- AI 에이전트가 유휴 상태 진입 전 `schedule` 도구를 사용하여 3분(180초) 뒤의 틱 알림(`Prompt: "RSI_TICK"`)을 설정하고, 틱 수신 시 `scripts/self-evolution.js`를 구동한 뒤 다시 틱을 연쇄 호출하는 루프가 원활히 작동하도록 안내 및 검증 시나리오를 구성합니다.

## Verification Plan

### Automated Tests
- 테스트용 병목 컴포넌트(`src/components/dashboard/DummyPerfTest.tsx`)를 생성하여 아래의 인위적인 병목들을 주입합니다:
  - `.map()` 루프 내에서 다른 배열을 `.filter()`하는 $O(N^2)$ 코드
  - direct `console.warn` 호출
  - `MindMap3D` 모듈의 direct static import
- `node scripts/self-evolution.js`를 수동으로 기동하여 해당 컴포넌트의 병목이 개선되는지(O(1) 맵 전환, 콘솔 제거, dynamic import 적용) 확인합니다.
- 리팩토링된 코드가 `node scripts/run-harness.js`를 성공적으로 통과하고, 마일스톤 동기화 및 `Engineering Report.md` 작성이 이루어지는지 검증합니다.
- 고의로 린트 에러를 유발하는 변환 시나리오를 구동하여, Rollback Guard가 동작해 이전 상태로 소스코드가 온전히 복구되는지 검증합니다.

## Acceptance Criteria

### 자율 개선 및 롤백 기능 검증
- [ ] `scripts/self-evolution.js`를 기동했을 때 `data/diagnose_report.json`을 분석하여 병목 코드를 감지하고 자동 리팩토링할 수 있어야 함.
- [ ] 리팩토링된 컴포넌트가 eslint, tsc 빌드를 깨지 않아야 하며, 성공 시 자동으로 Engineering Report 기록, 마일스톤 동기화(`sync-rules.js`), git 커밋이 이루어져야 함.
- [ ] 빌드/린트가 깨지는 수정 발생 시 `Self-Rollback Guard`에 의해 즉시 이전 버전으로 복구되어야 함.
- [ ] `RSI_TICK` 틱 수신 시의 무한 틱 스케줄러 체인이 정상 작동 가능한 구조를 갖추어야 함.
