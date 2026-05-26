# HCHPS Work & Wealth Architecture - AI 에이전트 매니페스트 (AGENTS.md)

## 1. 시스템 온톨로지 (M-V-C)
이 저장소는 MVC 온톨로지가 혼합된 수정된 FSD(Feature-Sliced Design) 아키텍처를 엄격하게 따릅니다:
- **모델 (스토리지)**: `functions/api/data.ts` (Cloudflare KV)가 단일 진실 공급원(SSOT)입니다. `localStorage`는 오직 휘발성 오프라인 캐시 역할만 수행하며 절대 주 데이터 소스로 사용되지 않습니다.
- **뷰 (UI)**: `src/components/dashboard` 및 기능별 컴포넌트들입니다. 엄격한 TailwindCSS 스타일링을 적용합니다.
- **컨트롤러 (Hooks)**: 데이터 페칭 및 뮤테이션은 반드시 `src/hooks/` 내부의 React Query(예: `useTasks`, `useBudget`)를 통해서만 수행되어야 합니다. 컴포넌트 내에서의 직접적인 API 호출은 엄격히 금지됩니다.

## 2. AI 에이전트 행동 수칙 (Rules of Engagement)

### A. 데이터 불변성 및 암호화
1. **종단간 암호화(E2EE) 우회 금지**: 모든 페이로드는 네트워크를 타기 전에 반드시 암호화되어야 합니다. `src/lib/crypto.ts`에 있는 `encryptPayload` / `decryptPayload`를 비활성화하거나 우회하지 마십시오.
2. **좀비 데이터 방지 (Tombstones)**: Cloudflare KV는 결과적 일관성(Eventually Consistent)을 갖습니다. 항목을 삭제할 때는 이후 페치 시 삭제된 데이터가 부활하는 것을 막기 위해 반드시 전역 툼스톤 배열(localStorage의 `hchps-global-tombstones`)을 활용해야 합니다.

### B. 시끄러운 실패 (Loud Failures - 안전장치 메커니즘)
코드를 뮤테이션하려다 Zod 스키마 검증 오류가 발생하면, 시스템이 경고를 발생시킬 것입니다 (`[HARNESS ZOD ERROR]`). 
- 이 오류들을 억압(suppress)하지 마십시오.
- 오류 페이로드를 읽고 정확히 어느 필드(경로)에서 타입 기대치를 충족하지 못했는지 파악하십시오.
- 하위 호환성을 위해 `schemas.ts`에 항상 대체 기본값(`.catch()`)을 제공하되, 근본적인 데이터 생성 로직 자체를 수정해야 합니다.

### C. 네트워크 및 CORS 경계
Cloudflare 백엔드(`functions/api/*.ts`)는 CORS를 엄격하게 강제합니다.
허용된 출처(Allowed Origins):
- `https://portfolio-hchps.pages.dev`
- `https://portfolio-architects.github.io`
- `http://localhost:3001`
이 헤더들을 업데이트하지 않고 localhost 포트를 `3001`에서 절대 변경하지 마십시오.

### D. 로컬 개발 환경 가동 및 중요 문서 노출 규칙
1. **로컬 개발 서버 기동 시 문서 아티팩트 자동 노출**: 로컬 개발 서버를 오픈/실행하는 작업을 인지하거나 수행할 때, 개발 컨텍스트 유지와 에이전트 준수 규칙을 즉시 모니터링하기 위하여 반드시 `PORTFOLIO HCHPS - Engineering Report.md` 파일과 `AGENTS.md` 파일을 우측 아티팩트 사이드바(Artifact Sidebar)에 띄워야 합니다.


## 3. 다중 에이전트 파이프라인 맵
- `src/lib/agents/planner.ts`: 작업 분해 및 컨텍스트 검색.
- `src/lib/agents/generator.ts`: 실행 및 코드 합성.
- `src/lib/agents/evaluator.ts`: Zod 스키마 및 TypeScript 검증 피드백 루프.

## 4. 재귀적 자기 개선 (Recursive Self-Improvement)
시스템과 AI 에이전트는 지속적인 자기 진단 및 최적화 루프를 통해 스스로의 성능을 향상시킵니다:
- **자가 치유 (Self-Healing)**: 평가자(Evaluator)가 발생시킨 Zod 스키마 또는 TypeScript 검증 오류에 대해, 에이전트는 스스로 실패 원인을 분석하고 사람의 개입 없이 코드를 수정하여 재검증합니다.
- **코드 및 아키텍처 자동 리팩토링**: 런타임 성능 지표 및 에러 로그를 기반으로, 에이전트는 주기적으로 비효율적인 코드 블록을 식별하고 구조적 리팩토링을 제안/적용합니다.
- **프롬프트 진화 루프**: 성공/실패 사례의 맥락을 분석하여 에이전트 스스로 향후 작업의 지시문과 컨텍스트 로딩(Context Retrieval) 방식을 최적화합니다.
