# Original User Request

## Initial Request — 2026-07-15T08:28:41Z

바이탈(VITAL) 웹 애플리케이션의 구동 속도 및 런타임 인터랙션 반응성을 전체적으로 정밀 튜닝하여 고속 구동 환경을 수립합니다.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 초기 대시보드 로딩 성능 최적화
- `src/app/page.tsx` 등 앱 진입점에서 초기 렌더링 부하를 줄이기 위해 dynamic import 및 프리로드 구조를 고도화합니다.
- 스플래시 화면 노출 및 마운트 프로세스의 지연 요소를 제거하여 최초 로딩 시간을 단축합니다.

### R2. 3D 마인드맵 렌더링 및 인터랙션 성능 고도화
- `src/components/MindMap3D.tsx` 및 관련 Canvas 2D / Three.js 렌더링 루프의 연산 효율을 높여 60 FPS 렌더링을 지향합니다.
- 드래그, 줌, 호버 등 고빈도 사용자 상호작용 발생 시, GC(가비지 컬렉터) 렉 및 리렌더 스파이크가 발생하지 않도록 렌더 가드와 객체 풀링(Object Pooling) 기법 등을 정밀화합니다.

### R3. 탭 전환 및 컴포넌트 렌더 가드 최적화
- 예산 대시보드, 홍보물 재고 리스트 등 대규모 DOM 노드를 생성하는 개별 탭 전환 시의 UI 프리징을 차단합니다.
- `useSyncExternalStore`와 디바운싱 배칭 기법을 통한 외부 상태 구독을 정밀화하고, `React.memo` 및 `useMemo` / `useCallback` 기법을 적용하여 불필요한 전파 리렌더링을 완전히 방어합니다.

### R4. 로컬 데이터 API 및 파일 스캐너 최적화
- `/api/data` 엔드포인트의 파일 읽기/쓰기 및 동기화 응답 시간(RTT)을 개선하기 위해 홀드 딜레이 배칭 및 캐시 룩업을 보강합니다.
- 바탕화면 파일 감시자(`watcher.ts`) 데몬의 구동 프로세스를 튜닝하여 메인 백엔드 스레드의 CPU 점유율을 50% 이하로 통제합니다.

### R5. 정적 및 런타임 빌드 무결성 보장
- `node scripts/run-harness.js` 및 `npm run build`를 가동하여 린트 오류, 타입 오류, 아키텍처 규칙 위반 및 성능 병목 요인이 0건인 상태를 확보합니다.

## Acceptance Criteria

### 빌드 및 정적 품질 무결성
- [ ] `data/diagnose_report.json` 내 `totalBottlenecks`, `totalViolations`, `totalWarnings` 모두 `0` 달성.
- [ ] `npm run build` 실행 시 에러 없이 정상적으로 컴파일 및 빌드가 완수됨.

### 런타임 성능 품질
- [ ] 초기 화면 기동 및 첫 UI 렌더링 진입까지 메인 스레드 점유율 및 blocking 연산이 최소화됨.
- [ ] 3D 마인드맵 인터랙션 시 프레임 드랍(60 FPS 미만) 현상이 제거됨.
- [ ] 각 탭(WorkspaceView, InventoryList, CrmDashboardView 등) 간의 전환 시 렉(Freezing) 현상이 방지됨.

## Follow-up — 2026-07-16T01:03:50Z

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
- [ ] `scripts/self-evolution.js`가 eslint, tsc 빌드를 깨지 않아야 하며, 성공 시 자동으로 Engineering Report 기록, 마일스톤 동기화(`sync-rules.js`), git 커밋이 이루어져야 함.
- [ ] 빌드/린트가 깨지는 수정 발생 시 `Self-Rollback Guard`에 의해 즉시 이전 버전으로 복구되어야 함.
- [ ] `RSI_TICK` 틱 수신 시의 무한 틱 스케줄러 체인이 정상 작동 가능한 구조를 갖추어야 함.

## Follow-up — 2026-07-16T11:56:03+09:00

홍보물 페이지를 예산관리 페이지의 하위 탭으로 전환하고, 예산관리 하단에 존재하던 '법제처 국가법령 연계' 패널을 독립된 신규 '법령 시스템' 페이지로 상향 이관하여 통합 구축합니다.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 예산관리 페이지(WorkspaceView) 하위 탭 전환
- 기존 '홍보물' 독립 메뉴를 '예산관리' 모듈 내부의 하위 탭으로 이관합니다.
- [WorkspaceView](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/WorkspaceView.tsx) 상단에 '예산 대조보드'와 '홍보 자재 관리'를 선택할 수 있는 탭 바를 추가합니다.
- '홍보 자재 관리' 선택 시 기존의 [InventoryList](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/inventory/InventoryList.tsx) 컴포넌트가 렌더링되며, 기존에 제공되던 모든 재고 관리 기능(재고 조정, 이력 등)이 완벽히 정상 동작해야 합니다.

### R2. 법령 시스템 페이지 신규 구축 및 국가법령 연계 패널 상향 이관
- 기존 전역 Sidebar 및 [page.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/app/page.tsx)의 `inventory` 모듈 타입을 `law` 모듈 타입으로 교체하고, Sidebar 메뉴명을 '홍보물'에서 '법령 시스템'으로 변경합니다. (아이콘은 `Scale` 또는 `FileText` 등 적절한 법령 아이콘 적용)
- [BudgetDashboard.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/budget/BudgetDashboard.tsx) 하단에 존재하던 [LawSearchPanel](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/budget/ui/LawSearchPanel.tsx)을 해당 위치에서 **제거**합니다.
- 신규 독립 모듈용 컴포넌트 `LawSystemView.tsx`를 생성하고, 이관된 [LawSearchPanel](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/budget/ui/LawSearchPanel.tsx)을 메인에 배치하여 통합합니다.
- 법령 시스템 페이지는 다음 기능을 지원하는 고급스러운 글래스모피즘 UI 레이아웃으로 구성합니다:
  - **법제처 실시간 검색 탭:** 기존 [LawSearchPanel](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/src/components/budget/ui/LawSearchPanel.tsx)의 실시간 국가법령/자치법규 API 연계 검색 및 본문 보기 기능 유지.
  - **핵심 법령/조례 로컬 사전 탭:** 지역보건법, 국민체육진흥법, 강남구 구민체육진흥 조례 등 실무에 밀접한 주요 법령 조문들을 간략히 요약·색인해 둔 로컬 Mock 사전 UI 및 실시간 검색 기능 구축.
  - **공문서 서식 가이드 팁:** 공문서 표준 지침(`hwp_generation_guidelines.md`)의 핵심 레이아웃/서식(항목 기호 다단계 순서 Ⅰ -> 가 -> 1 -> 가), 날짜/시간 부호법, 띄어쓰기 규격 등을 한눈에 볼 수 있는 '기안 작성 가이드' 패널을 우측 영역에 제공.

### R3. 아키텍처 규칙 및 Zod 무결성 유지
- 수정 시 [AGENTS.md](file:///d:/Desktop/PORTFOLIO/PORTFOLIO%20-%20VITAL/AGENTS.md)의 MVC 아키텍처 규칙(hooks를 통한 데이터 처리, components 내 직접 API 호출 금지 등) 및 데이터 불변성 규칙을 엄격히 준수합니다.
- Zod 스키마 오류가 발생하지 않도록 기존 타입 정의와 데이터 맵 구조를 일관성 있게 조율합니다.

## Acceptance Criteria

### UI 및 네비게이션
- [ ] Sidebar 네비게이션에서 '홍보물'이 제거되고 '법령 시스템'이 추가되었으며 클릭 시 해당 모듈로 정상 이동한다.
- [ ] 예산관리 모듈 진입 시 상단에 탭이 노출되고, 탭 클릭 시 '예산 대조보드'와 '홍보 자재 관리' 화면이 정상 전환된다.
- [ ] 기존 예산관리(BudgetDashboard) 페이지 하단에서 법제처 검색 패널이 깔끔하게 제거되었다.

### 기능 검증
- [ ] 하위 탭으로 이관된 홍보 자재 관리 화면에서 비품 추가 및 재고 조정 동작 시 에러 없이 데이터가 갱신된다.
- [ ] 신규 법령 시스템 페이지에서 법제처 실시간 검색 기능(API 연계 및 본문 뷰어)이 이관 전과 동일하게 정상 동작한다.
- [ ] 법령 시스템 내의 핵심 로컬 사전 및 기안 작성 가이드가 정상적으로 표출되며, 실시간 검색 필터링이 올바르게 수행된다.

### 시스템 빌드 안정성
- [ ] `npm run build` 명령어 수행 시 TypeScript 빌드 및 Next.js 빌드가 경고/에러 없이 완벽히 성공한다.

## Verification Plan

### Automated Tests
- `npm run build`

### Manual Verification
- 개발 서버를 실행하여 브라우저에서 '예산관리 -> 홍보 자재 관리' 탭의 동작을 검증합니다.
- 신규 '법령 시스템' 모듈로 이동하여 법제처 실시간 검색 및 본문 보기 기능, 로컬 사전 탭, 우측 서식 가이드 패널이 정상 동작하는지 테스트합니다.

## Follow-up — 2026-07-16T12:00:00+09:00

이 프로젝트는 바이탈 앱(`PORTFOLIO - VITAL`)의 3D 마인드맵 컴포넌트의 렌더링 속도를 대폭 개선하고, 무의미한 노드를 걸러내고 핵심 실무 키워드 위주로 노드를 생성하는 노드 파싱 알고리즘 고도화 및 사용자가 필요 시 수동으로 노드를 등록/관리할 수 있는 수동 노드 관리 인터페이스를 구축하는 것을 목표로 합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. AI 시맨틱 추출 엔진 고도화 및 검토 모달 도입
- **AI 필터링 극대화**: `src/app/api/llm/extract/route.ts`의 Gemini 프롬프트를 강화하여 무의미한 조사, 단순 수식어 등의 명사 노드 생성을 엄격히 제어하며, 백엔드 레벨에서 불용어 필터와 노드 개수 제약을 장착합니다.
- **추출 노드 검토 및 승인 모달**: 텍스트에서 시맨틱 그래프 추출 완료 시 Yjs 스토어에 바로 병합하지 않고, 유저가 추출된 노드와 관계 목록을 직접 검토(추가, 선택 삭제, 관계 편집)한 뒤 승인 버튼을 통해 최종 마인드맵에 반영하는 검토 팝업 UI를 구현합니다.

### R2. 마인드맵 3D 엔진 렌더링 성능 대폭 개선 (Target 60 FPS)
- **Dirty-Flag 기반 레이아웃 생략**: 토폴로지 변화(노드 추가/삭제/연결 변경)가 발생하지 않는 동안은 BFS 트리 생성 및 `computePositions` 내의 좌표 재계산을 완전히 생략하도록 `Dirty-Flag` 기법을 전역 적용합니다.
- **Frustum Culling**: 화면 Frustum(카메라 시야 범위) 바깥에 위치한 노드 및 엣지는 그리기 연산 및 물리 충돌 연산 대상에서 완전히 제외합니다.
- **충돌 방지 최적화**: 화면 충돌 해결 루프의 반복 횟수를 최적화하고, Damping 파라미터를 조율하여 프레임 드랍과 공전 시의 떨림(Jittering) 현상을 차단합니다.
- **Orbiting 연산 효율화**: 공전 애니메이션 실행 시 매 프레임 발생하는 삼각함수 호출을 가산각 기반 회전 행렬 연산 또는 정적 룩업으로 대체해 CPU 점유율을 대폭 낮춥니다.

### R3. 수동 노드 및 엣지 조작 인터페이스 (Yjs CRDT 연동)
- **노드 수동 생성/삭제**: 마인드맵 HUD/인스펙터(`MindMapInspector.tsx`) 상에 유저가 라벨을 입력해 새로운 노드를 수동으로 즉시 배치하고, 원치 않는 노드를 삭제할 수 있는 편집 폼을 추가합니다.
- **관계(Edge) 연결/해제 UI**: 마인드맵 상에서 노드들을 선택하거나 지정하여 노드 간의 엣지를 수동으로 추가(신규 SPO 관계 정의)하고 연결을 끊을 수 있는 관리 인터페이스를 도입합니다.
- **CRDT 실시간 협업 동기화**: 모든 수동 제어(노드/엣지 생성 및 삭제)는 Yjs CRDT 협업 스토어에 즉시 연동 및 실시간 싱크되어 작동해야 합니다.

## Verification Plan

### Automated Tests
- `npm run lint` 및 `npm run build`를 실행하여 리팩토링 결과에 대한 정적 타입/스타일 에러 및 빌드 무결성을 검증합니다.

### Manual Verification
- 임의의 위키 문서에서 "시맨틱 그래프 추출"을 트리거하여 추출 결과 검토 모달이 정상 팝업되는지 확인하고, 노드를 편집하여 최종 마인드맵에 병합되는지 검증합니다.
- HUD/인스펙터의 수동 폼을 통해 임의의 노드(`테스트노드_A`, `테스트노드_B`)를 생성하고, 두 노드 간에 `의존성` 관계 엣지를 생성한 뒤 마인드맵 상에 즉시 그려지는지 Yjs 연동을 확인합니다.
- 브라우저 개발자 도구의 성능 프로파일러를 띄워 마인드맵 공전 및 탐색 시 FPS가 안정적으로 60 FPS 이상 유지되는지, CPU 병목 연산 시간이 단축되었는지 검사합니다.

## Acceptance Criteria

### 마인드맵 성능 및 제어 기능 검증
- [ ] 텍스트 시맨틱 추출 시 바로 병합되지 않고 유저가 노드/엣지 목록을 검토·수정 후 승인할 수 있는 모달 팝업이 구현되어야 함.
- [ ] 토폴로지 비변경 상태 시 BFS 레이아웃 연산을 원천 생략하는 Dirty-Flag 기법 및 화면 바깥 요소에 대한 Frustum Culling이 적용되어야 함.
- [ ] 마인드맵 상에서 노드를 수동으로 생성/삭제하고, 노드 간 엣지를 생성/삭제할 수 있는 HUD/인스펙터 편집 조작계가 구현되어 Yjs 스토어와 실시간 동기화되어야 함.
- [ ] 마인드맵 동작 중 16ms 이하로 렌더 틱이 유지되어 랙 현상이 해결되어야 함.
- [ ] `npm run build` 및 `npm run lint` 검증을 에러 없이 성공적으로 통과해야 함.
- [ ] 변경 패치 정보가 `PORTFOLIO VITAL - Engineering Report.md`에 실시간으로 작성되고 `node scripts/sync-rules.js`를 통해 마일스톤 동기화가 이루어져야 함.

## Follow-up — 2026-07-16T03:52:32Z

VITAL 웹 애플리케이션의 메인 페이지 로딩 속도 향상 및 렌더링 성능을 극대화하기 위해 초기 자바스크립트 청크 축소, Dynamic Lazy Loading 최적화, 불필요한 리렌더링 차단, 그리고 메모리 관리를 포함한 극한의 최적화 작업을 수행합니다.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 초기 진입 속도 및 스플래시 로딩 최적화
- 초기 로딩 시 다운로드되는 메인 JS 번들 크기를 최소화하기 위해, 첫 화면(대시보드) 렌더링에 필수적이지 않은 모든 컴포넌트(3D 마인드맵, 예산관리, 법령/지침 등)를 완전한 비동기 지연 임포트(`dynamic()` with `ssr: false` 및 지연 preloading) 처리합니다.
- 스플래시 화면(`Home` 컴포넌트 하단의 스플래시 오버레이) 노출 및 초기화 대기 시간(현재 약 1.8초 이상 설정된 타이머 등)을 사용자 경험에 방해되지 않는 최적의 시간(예: 데이터 로드 완료 즉시 전환)으로 단축합니다.

### R2. 탭 전환 시 UI 프리징 해제 및 렌더링 차단
- 대시보드, 예산관리, 마인드맵, 법령/지침 등의 메인 탭 전환 시 1프레임 이상의 렌더 프리징(UI 멈춤) 현상을 차단합니다.
- 리렌더링 부하가 큰 복합 컴포넌트(예: BudgetDashboard, InventoryList)와 하위 컴포넌트(카드, 리스트 아이템)들에 대해 `React.memo`를 통한 렌더링 전파 차단을 적용하고, 핸들러 함수와 가공 데이터 객체에 `useCallback` 및 `useMemo`를 엄격히 적용합니다.

### R3. 3D 마인드맵 렌더링 고속화 및 GC 렉 제거
- 3D 마인드맵 노드 및 간선 렌더링 성능을 극대화하여 대규모 데이터 로드 시 프레임 레이트(Target 60 FPS)를 유지합니다.
- 렌더링 루프(`requestAnimationFrame` 등) 및 궤도 연산 로직 내에서 삼각함수, 행렬 연산 및 매 프레임 발생하는 일시적 객체 생성을 최소화하고, 연산 결과 캐싱 및 객체 풀(Object Pooling) 패턴을 적용하여 가비지 컬렉터(GC)로 인한 미세 뚝끊김(Stuttering)을 방지합니다.
- 카메라 프러스텀 바깥의 노드는 렌더링을 완전히 생략하는 컬링(Culling)을 효율적으로 수행하도록 조율합니다.

### R4. API 데이터 페칭 지연 제거 및 로컬 캐싱 강화
- `/api/data` 라우트 등 로컬 JSON 데이터 조회 시 파일 I/O 병목을 최소화하고, React Query(`useTasks`, `useBudget` 등)의 `staleTime`, `gcTime` 설정을 정교화하여 불필요한 API 다중 재요청을 차단하고 로컬 메모리 캐시를 최우선 활용하도록 개선합니다.

## Acceptance Criteria

### 로딩 성능
- [ ] 첫 진입 시 스플래시 로딩 오버레이가 데이터 로드 완료 및 락 해제 후 지연 없이 부드럽게 걷힌다.
- [ ] 브라우저 개발자 도구의 Performance 탭에서 메인 탭 전환 시 CPU 메인 스레드 점유로 인한 Long Task(50ms 이상) 횟수가 현저히 감소한다.

### 렌더링 정밀도
- [ ] `React Developer Tools`의 Highlight Updates를 켰을 때, 특정 노드나 예산 셀 변경 시 무관한 부모/형제 컴포넌트들의 중복 렌더링이 발생하지 않는다.
- [ ] 3D 마인드맵 조작 시 프레임이 눈에 띄게 끊기지 않고 부드럽게(Target 60 FPS) 회전 및 줌이 수행된다.

### 빌드 안정성
- [ ] `npm run build` 결과물 빌드 시 청크 분할 및 최적화가 정상 처리되어 프로덕션 빌드가 성공한다.

## Verification Plan

### Automated Tests
- `npm run build`

### Manual Verification
- 브라우저 개발자 도구의 네트워크/성능 탭을 켜서 청크 크기 및 탭 전환 시 스레드 점유 상태를 육안 및 타임라인으로 검사합니다.
