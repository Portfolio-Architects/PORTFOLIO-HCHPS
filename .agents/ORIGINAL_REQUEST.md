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
