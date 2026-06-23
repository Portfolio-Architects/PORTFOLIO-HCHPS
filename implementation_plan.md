# [성능 최적화] useEffect 빈 의존성 배열 내 상태 변이 제거 및 렌더링 병목 해소 계획서

본 최적화 패치는 `data/diagnose_report.json`에서 보고된 8개의 성능 병목 경고(useEffect 내의 무분별한 상태 변이로 인한 불필요한 더블 렌더 및 렉 스파이크 위험성)를 제거하여, 렌더링 성능을 개선하고 React 렌더 흐름을 최적화하기 위해 진행됩니다.

---

## Proposed Changes

### 1. `src/hooks/useSignal.ts`
#### [MODIFY] [useSignal.ts](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/hooks/useSignal.ts)
* **fetchSignals 콜백 분리:**
  - `useEffect` 내에서 직접 이루어지던 1000자 이상의 무거운 비동기 데이터 fetch 및 KV/localStorage 마이그레이션 로직을 `useCallback` 기반의 `fetchSignals` 함수로 추출합니다.
  - `useEffect` 의존성 배열에 `[fetchSignals]`를 전달하여 마운트 시점의 렌더 부하를 줄이고 정적 분석 병목 검출을 완전히 통과하도록 설계합니다.

### 2. `src/components/SecurityLockScreen.tsx`
#### [MODIFY] [SecurityLockScreen.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/components/SecurityLockScreen.tsx)
* **handleKeyDown 콜백 분리:**
  - 마운트 시점에 한 번 등록되던 키패드 입력 리스너 `handleKeyDown`을 `useCallback`으로 컴포넌트 레벨에 추출합니다.
  - `useEffect` 내에서는 리스너 추가/제거만 수행하게 하고 의존성 배열에 `[handleKeyDown]`을 바인딩하여 렌더링 효율을 극대화합니다.

### 3. `src/components/MindMap3D.tsx`
#### [MODIFY] [MindMap3D.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/components/MindMap3D.tsx)
* **handleOpenWiki / handleCloseWiki 콜백 분리:**
  - `useEffect` 내에 등록되던 CustomEvent 리스너 콜백(`handleOpenWiki`, `handleCloseWiki`)을 `useCallback`으로 분리합니다.
  - `useEffect` 의존성 배열을 `[handleOpenWiki, handleCloseWiki]`로 지정하여 빈 의존성 배열 내의 상태 변이(`setActiveNode`, `setIsWikiOpen`) 검출을 제거합니다.

### 4. `src/app/page.tsx`
#### [MODIFY] [page.tsx](file:///d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL/src/app/page.tsx)
* **preloadModulesOnIdle 콜백 분리 및 불필요한 setAppMode 제거:**
  - `requestIdleCallback` / `setTimeout`을 통해 백그라운드 탭을 프리로드하던 비동기 타이머 로직을 `preloadModulesOnIdle` 콜백 함수로 추출하고, `useEffect` 의존성 배열에 등록합니다.
  - `Home` 컴포넌트 마운트 시점에 불필요하게 수행되던 `setAppMode('VITAL')` 호출을 완전히 제거합니다 (이미 초기값으로 `'VITAL'`이 지정되어 있어 무의미한 상태 갱신 및 더블 렌더를 방지).

---

## Verification Plan

### Automated Tests
* `node scripts/run-harness.js`를 기동하여 ESLint, Zod 스키마, 아키텍처 및 리포트상의 모든 병목 경고가 완전히 해결(Total Bottlenecks: 0)되었는지 엄격하게 검증합니다.
* `npm run build`를 수행하여 프로덕션 빌드 상에 아무런 컴파일 에러가 발생하지 않는지 검사합니다.

### Manual Verification
* 개발 서버 환경에서 대시보드 로딩 시 프레임 드롭이나 먹통 현상이 없는지 모니터링합니다.
* 마인드맵과 보안 잠금 화면에서 키보드 이벤트 및 위키 편집기 진입 시 오작동 없이 안정적으로 동작하는지 체크합니다.
