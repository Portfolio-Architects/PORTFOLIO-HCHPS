# Original User Request

## Initial Request — 2026-07-29T06:56:33Z

예산관리 페이지(`src/components/budget/`)의 실무 처리 효율성을 극대화하기 위해 데이터 구조 및 API 무결성을 100% 유지하면서 테이블 Inline-Editing, 키보드 단축키(Ctrl+Enter, Esc, Tab), 비목별 잔액 Highlight, 지출 항목 Batch Action 및 모달 대조 UX를 종합 개편합니다.

Working directory: d:/Desktop/PORTFOLIO/PORTFOLIO - VITAL
Integrity mode: development

## Requirements

### R1. 테이블 Inline-Editing & 키보드 단축키(Key Navigation) 시스템
- 예산 항목 및 지출 입력/수정 시 별도 폼 이동 없이 테이블 셀 직접 편집(Inline-Editing) 지원.
- `Tab`/`Shift+Tab`으로 셀 이동, `Ctrl+Enter`로 저장/완료, `Esc`로 취소 가능한 키보드 포커스 흐름 구축.

### R2. 실시간 비목별 집계 Highlight & 필터링 강화
- 예산 집행액 및 잔액 초과/주의 상태를 직관적인 color badge 및 highlight 애니메이션으로 전달.
- 월별/비목별/집행 상태별 실시간 검색 및 필터링 반응성 최적화(DOM Stall 0ms).

### R3. 지출 항목 일괄 처리(Batch Action) & 모달 UX 최적화
- 다중 지출 항목 선택 후 승인/상태 변경/삭제를 한 번에 처리하는 Batch Action UI 제공.
- 지출 결의서 및 예산 원장 모달(`LedgerModal`, `ExpenseEntryModal`) 간 간편 전환 및 대조 모드 지원.

## Acceptance Criteria

### Performance & UX
- [ ] 예산 셀 편집 및 단축키 이동 시 입력 지연 0ms (60 FPS 유지)
- [ ] 다중 항목 선택 및 Batch Action 적용 시 하이라이트 및 상태 즉시 반영
- [ ] Zero-Stall 규격 및 백그라운드 탭 pause 준수

### Code Integrity & System Rules
- [ ] `npx tsc --noEmit` 실행 시 컴파일 오류 0건
- [ ] `node scripts/run-harness.js` 검증 통과 (Zod 스키마 무결성 100% 유지)
- [ ] 기존 API (`/api/data/route.ts`) 및 `useBudget` 커스텀 훅 데이터 계약 변경 없음
