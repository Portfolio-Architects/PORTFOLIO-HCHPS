# Original User Request

## 2026-07-22T04:52:09Z

[Freeze Detector] 로그분석 결과 `dashboard` (최대 2,836ms) 및 `workspace` (최대 3,752ms) 모듈에서 발생한 UI thread stall 현상을 해결하고, `AGENTS.md` 규격에 맞는 Zero-Stall 및 백그라운드 탭 렌더링 일시 중지 최적화를 자율 실행합니다.

Working directory: d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. UI Thread Stall 원인 분석 및 메인 스레드 렌더링 격리
- `src/components/dashboard` 및 `src/components/workspace` 모듈에서 대용량 DOM 순회 또는 비동기 트랜잭션 수신 시 발생하는 메인 스레드 블로킹 요소를 식별합니다.
- UI 가상화(`useVirtualGrid`) 및 Props 메모이제이션 (`React.memo`, `useMemo`, `useCallback`)을 배치하여 렌더 점유 시간을 100ms 미만으로 압축합니다.

### R2. Zero-Stall 및 백그라운드 탭 렌더링/폴링 일시 중지 규격 적용 (AGENTS.md Sec. 2-J)
- `document.hidden` 또는 탭 이탈 시 DB 와처 폴링, 3D/물리 시뮬레이션 틱 및 React Query 백그라운드 리패치를 완전 차단합니다.
- 탭 복귀 시 delta 타임스탬프 간격 클램핑(`Math.min(now - lastFrameTime, 100)`)으로 Instant-Resume을 보장합니다.

### R3. 하이드레이션 청크 분할 및 동적 임포트 적용 (AGENTS.md Sec. 2-I)
- 대용량 컴포넌트는 `dynamic(() => import(...), { ssr: false })`로 임포트하고 Skeleton UI 가드를 배치합니다.

## Acceptance Criteria

### Performance & Zero-Stall
- [ ] UI thread stall (> 100ms) 감지 0건 및 60 FPS 유지
- [ ] `npx tsc --noEmit` 컴파일 0 오류
- [ ] `node scripts/run-harness.js` (Zod 스키마, ESLint, MVC 규격) 100% 성공
- [ ] `node scripts/sync-rules.js` 실행으로 AGENTS.md 마일스톤 로그 자동 업데이트
