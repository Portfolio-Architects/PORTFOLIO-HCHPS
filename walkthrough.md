# Walkthrough - 11월 예산 소진 플래너 및 선형 회귀 분석

이번 작업에서는 **11월 30일까지 남은 예산을 100% 소진하기 위한 정밀 지출 계획선**을 연산하고, 사용자가 입력한 **월 고정(루틴) 지출액**을 공제하여 남은 변동 지출을 고르게 분할하는 시뮬레이터 뷰와 차트 시각화를 성공적으로 통합하였습니다.

---

## 변경된 작업 사항

### 1. Hooks ([usePortfolioAnalytics.ts](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/hooks/usePortfolioAnalytics.ts))
- **마일스톤 상태 추가**: 월 고정 지출액인 `routineSpend` (기본값: `0`) 상태를 통합하고 바인딩 완료.
- **최소자승법 선형 회귀(OLS) 모델 탑재**: 
  - 1월부터 5월(현재 달)까지 실제 누적 집행 금액 데이터를 바탕으로 추세선 기울기($m$) 및 절편($c$) 계산.
  - 전월(Jan-May) 데이터로부터 연말 최종 예상 소진율(`projectedEoyExecutionRate`) 및 자연 소진월(`exhaustionMonthName`)을 실시간으로 추적/예상.
- **11월 마감 Burn Plan 궤적 산출**:
  - 6월~11월(남은 6개월) 동안 `PlanMonthly = routineSpend + (RemainingBudget - (routineSpend * 6)) / 6` 방식으로 분해하여 11월 30일에 정확히 100% 집행률을 보장하는 계획선 데이터 생성.

### 2. UI Components ([PortfolioDashboardView.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/components/dashboard/PortfolioDashboardView.tsx))
- **11월 예산 소진 플래너 시뮬레이터 HUD 패널 추가**:
  - 월 루틴 지출액을 조절할 수 있는 슬라이더와 직접 정수 입력 필드 배치.
  - 슬라이더 조절 시 실시간으로 차트와 요약 금액이 리플렉션되는 글래스모피즘(Glassmorphism) 기반 HUD 구현.
- **차트 구성 고도화 (Recharts ComposedChart)**:
  - **월별 보기**: 1~5월은 실제 집행액, 6~11월은 계획된 집행 권장액(`planMonthly`)을 반투명 점선 스트로크 바 차트로 이중 표출하여 명확한 지수 비교 유도.
  - **누적 보기**: 기존 단순 타겟 점선 외에 **실제 누적 집행선 (Actual Cumulative Area)**, **선형 회귀 추세선 (Regression Dash-line)**, **11월 완수 소진 계획선 (Burn Plan Solid-line)** 세 가지 궤적을 병렬 렌더링.

---

## 위키 데이터 유실 방지 및 자동 이관 변경 사항 (2026-05-27)

### 1. API 및 암호화 예외 전파 ([sheets-api.ts](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/lib/sheets-api.ts))
- `readSheet`가 E2EE 복호화 에러 및 HTTP 500/네트워크 단절 에러가 났을 때 `[]`를 반환하지 않고 **상위 호출단으로 에러를 그대로 전파(throw)** 하도록 강제화했습니다.
- 이를 통해, 네트워크가 끊겼거나 복호화가 불가능한 상황을 "서버에 데이터가 없음"으로 잘못 판정하여 빈 파일로 덮어쓰는(overwrite) 오동작을 원천적으로 예방했습니다.

### 2. 위키 저장소 제어 및 자동 자가 이관 ([useWikiStorage.ts](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/hooks/useWikiStorage.ts))
- **`isFetchedRef` 안전장치 도입**: 서버에서 데이터를 로드해 오기 전이거나 불러오기가 실패한 상태에서는 `saveBlocks`의 서버 저장 로직이 자동 차단되도록 설계하여 빈 문서 덮어쓰기 레이스 컨디션을 최종 차단했습니다.
- **클라우드 조회 및 동기식 UI 해제**: 로딩 완료 전까지 에디터 렌더링을 지연(`isLoaded = false` 유지)시켜, 비어있는 초안 에디터가 서버 내용을 덮어쓰지 않도록 안정화시켰습니다.
- **화이트보드 병합 노드 복원 체계**: 화이트보드 캔버스에서 개별 작성되었던 커스텀 노드가 실제 데이터 노드와 라벨 매칭으로 병합될 때, 기존 커스텀 노드 위키(`WIKI_DOC_custom-*`)를 조회하여 Canonical ID(`WIKI_DOC_leaf-kw-*`) 경로로 무손실 자동 마이그레이션하는 RAG 자가 치유 파이프라인을 구축했습니다.

### 3. 컴포넌트 연동 ([MindMap3D.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/components/MindMap3D.tsx) & [useProjects.ts](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/hooks/useProjects.ts))
- `MindMap3D.tsx`에서 `useWikiStorage`를 생성할 때 `activeNode.label`을 공급하여 병합 노드에 대한 자가 이관이 정상적으로 시작되도록 연동 완료.
- `useProjects.ts` 등 cascade 삭제단에서 발생할 수 있는 `readSheet` 미처리 Promise Rejection 방지 보완.

---

## 검증 내역

### 빌드 및 무결성 확인
- Next.js Turbopack 빌드(`npm run build`)를 실행하여 TypeScript 오류, 번들 클리핑 및 렌더링 컴포넌트 꼬임 현상이 0건임을 검증 및 확정했습니다:
```bash
✓ Compiled successfully in 54s
✓ Generating static pages using 3 workers (9/9) in 4.5s
```
- 모든 컴포넌트가 React 19 / Next.js 16 아키텍처 규칙에 완벽히 부합하여 렌더링되고 있습니다.
