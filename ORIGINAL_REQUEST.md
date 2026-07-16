# Original User Request

## Initial Request — 2026-07-16T10:49:55+09:00

이 프로젝트는 바이탈 앱(`PORTFOLIO - VITAL`)의 대시보드 및 주요 뷰들의 디자인을 고도화하되, 가독성(Readability) 및 렌더링 성능/속도(Performance)를 최우선으로 확보하는 것을 목표로 합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 모던 다크 테마 기반 고대비 가독성 UI 고도화
- 바이탈 앱 전체(대시보드 `PortfolioDashboardView.tsx`, 주간 일정 플래너 `WeeklyScheduler.tsx`, 마인드맵 `MindMap3D.tsx`, `MindMapInspector.tsx`, 각 모달 및 카드 뷰 등)의 UI를 일괄 리팩토링합니다.
- `Inter` 또는 `Outfit` 등의 가독성 높은 프리미엄 웹 폰트를 임포트하여 적용하고, 텍스트-배경 간의 명확한 고대비 컬러 스키마를 구성하여 시각 피로를 최소화합니다.
- 카드 컴포넌트 및 모달의 테두리, 그림자, 패딩, 마진 등을 조율하여 정보의 시각적 계층 구조(Hierarchy)를 극대화합니다.

### R2. Next.js Lazy Loading 및 FCP 최적화
- 초기 번들링 크기가 큰 주요 컴포넌트(`MindMap3D`, `WeeklyScheduler`, `WikiEditor` 등)를 Next.js `dynamic(..., { ssr: false })` 임포트로 전환하여 첫 페이지의 FCP(First Contentful Paint) 속도를 획기적으로 개선하고 첫 진입 시 브라우저 메인 스레드 프리징을 막습니다.

### R3. 리렌더링 차단 및 16ms 렌더 락 방어
- 주요 UI 컴포넌트들에 `React.memo` 분할 기법을 전방위적으로 적용하고, 이벤트 핸들러 및 계산형 상수 데이터에 `useCallback`과 `useMemo`를 치밀하게 연동하여 불필요한 하위 카드 리렌더링 전파를 완전히 차단합니다.
- 복잡한 DOM 요소(스케줄러, 마인드맵)의 로딩 시점에 Staggered Loading(순차 지연 프리로딩) 기법을 장착하여 화면 렌더 틱을 격리시키고 프레임 드랍을 막습니다.

## Verification Plan

### Automated Tests
- `npm run lint` 및 `npm run build`를 수행하여 리팩토링 결과물에 대한 정적 타입/스타일 오류와 빌드 안정성을 검증합니다.
- React DevTools 및 Next.js 빌드 리포트를 통해 각 대형 컴포넌트의 Chunk 분리 상태(dynamic chunks 생성 여부)를 검증합니다.

### Manual Verification
- 고도화 작업이 완료된 바이탈 앱의 로컬 서버를 가동한 뒤, 메인 대시보드 화면 및 주요 서브 뷰들의 다크 모드 스타일, 가독성 강화 폰트 적용 상태, 탭 전환 시의 UI 프리징 유무를 육안과 체감 반응 속도로 직접 점검합니다.

## Acceptance Criteria

### 디자인 고도화 및 성능 검증
- [ ] 앱 전반에 걸쳐 고대비 모던 다크 테마와 가독성이 뛰어난 전용 폰트(Inter/Outfit)가 일관되게 반영되어 있어야 함.
- [ ] `next/dynamic` lazy loading이 `MindMap3D`, `WeeklyScheduler` 등 대형 컴포넌트에 정상 적용되어 FCP 속도가 향상되어야 함.
- [ ] 메인 대시보드 내 카드 컴포넌트들에 `React.memo` 및 `useCallback`/`useMemo` 최적화가 적용되어 불필요한 연쇄 리렌더링이 발생하지 않아야 함.
- [ ] `npm run build` 및 `npm run lint` 검증을 에러 없이 성공적으로 통과해야 함.
- [ ] 최적화 패치 내역이 `PORTFOLIO VITAL - Engineering Report.md`에 실시간으로 작성되고 `node scripts/sync-rules.js`를 통해 마일스톤 동기화가 이루어져야 함.
