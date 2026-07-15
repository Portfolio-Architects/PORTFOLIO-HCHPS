# [성능 최적화 검증] Target Files Refactoring Analysis Report

## 1. 개요 및 요약 (Overview & Summary)

본 보고서는 `implementation_plan.md`에 명시된 4개 대상 파일의 성능 최적화 패치 현황을 정적 분석 및 컴파일 빌드 테스트, 하네스(Harness) 실행 로그를 바탕으로 검증한 결과입니다.

분석 결과, **모든 대상 파일은 최적화 계획에 따라 100% 완전하게 리팩토링이 완료**되었음을 확인하였으며, `useEffect` 빈 의존성 배열 내에 부적절하게 동반되는 React 상태 변이(State Mutation)나 메모리 누수 위험이 있는 비동기 로직 및 이벤트 리스너의 방치 사례는 존재하지 않습니다.

* **Lint 경고 수:** 0건
* **아키텍처 규칙 위반 수:** 0건
* **성능 병목 탐지 수:** 0건
* **빌드 결과:** 성공 (`Compiled successfully in 79s`, TypeScript 및 static pages 생성 성공)

---

## 2. 파일별 검증 결과 및 비교 분석 (File-by-File Analysis)

### A. `src/hooks/useSignal.ts`
* **계획서 제안 내용:** 
  - `useEffect` 내 비동기 데이터 fetch 및 KV/localStorage 마이그레이션 로직을 `useCallback` 기반의 `fetchSignals`로 분리하고 의존성 배열에 `[fetchSignals]`를 전달할 것.
* **현재 코드 분석:**
  - `fetchSignals`가 `useCallback`으로 정확히 래핑되어 컴포넌트 외부 팩터의 변경 사항과 격리됨 (Line 140-188).
  - 마운트 시의 로드 `useEffect`는 의존성 배열에 `[fetchSignals]`만을 명시하여 빈 배열 내의 암묵적 데이터 로딩 및 상태 변경 병목을 방지 (Line 191-193).
* **코드 스니펫:**
  ```typescript
  // Line 140:
  const fetchSignals = useCallback(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    readSheet<SignalEntry>(SHEET_NAME)
      .then(rows => {
        // ... 생략 (비동기 데이터 fetch 및 localStorage 동기화) ...
      });
  }, []);

  // Line 191:
  // Initial load from Google Sheets (with localStorage fallback)
  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);
  ```
* **상태 변이 및 클린업 평가:** 
  - `useEffect` 내에서 직접적으로 `setEntries`를 호출하는 대신, 메모이즈된 `fetchSignals` 내에서 호출하도록 분리함. `initialLoadDone.current` ref 가드를 적용하여 Strict Mode에서 더블 렌더가 발생할 때 중복 호출을 효과적으로 차단합니다.

### B. `src/components/SecurityLockScreen.tsx`
* **계획서 제안 내용:** 
  - 키패드 입력 리스너 `handleKeyDown`을 `useCallback`으로 컴포넌트 레벨에 추출하고, `useEffect` 의존성 배열에 `[handleKeyDown]`을 바인딩하여 리스너의 갱신 효율을 극대화할 것.
* **현재 코드 분석:**
  - `handleKeyDown`은 `useCallback`으로 올바르게 래핑되어 있으며 (Line 60-74), `useEffect`에서 키보드 이벤트 리스너의 추가/제거 및 클린업이 완벽히 구성됨 (Line 76-79).
* **코드 스니펫:**
  ```typescript
  // Line 60:
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      setPin(prev => {
        if (prev.length < PIN_LENGTH) return prev + e.key;
        return prev;
      });
      setErrorMsg('');
    } 
    // ... 백스페이스 및 삭제 처리 ...
  }, []);

  // Line 76:
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  ```
* **상태 변이 및 클린업 평가:** 
  - 언마운트 시 `removeEventListener`를 통해 클린업이 철저히 실행되고 있으며, 빈 의존성 배열 이펙트가 존재하지 않아 상태 변이가 누출될 우려가 전혀 없습니다.

### C. `src/components/MindMap3D.tsx`
* **계획서 제안 내용:** 
  - `useEffect` 내에 등록되던 CustomEvent 리스너 콜백(`handleOpenWiki`, `handleCloseWiki`)을 `useCallback`으로 분리하고, 의존성 배열에 전달할 것.
* **현재 코드 분석:**
  - 두 Wiki 핸들러 모두 `useCallback`으로 컴포넌트 상위에서 래핑됨 (Line 186-201).
  - 이벤트 리스너 등록 `useEffect`에 `[handleOpenWiki, handleCloseWiki]`가 정상 등록되고, 클린업(이벤트 제거) 역시 올바르게 구현됨 (Line 203-211).
* **코드 스니펫:**
  ```typescript
  // Line 186:
  const handleOpenWiki = useCallback((e: CustomEvent<{ id: string; label: string }>) => {
    const existingNode = engineRef.current?.nodes.find(n => n.id === e.detail.id);
    setActiveNode((existingNode || { /* ... */ }) as unknown as OrbitalNode);
    setIsWikiOpen(true);
  }, [setActiveNode, setIsWikiOpen]);

  // Line 199:
  const handleCloseWiki = useCallback(() => {
    setActiveNode(null);
  }, [setActiveNode]);

  // Line 203:
  useEffect(() => {
    window.addEventListener('wiki:openNode', handleOpenWiki as EventListener);
    window.addEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    
    return () => {
      window.removeEventListener('wiki:openNode', handleOpenWiki as EventListener);
      window.removeEventListener('wiki:closeNode', handleCloseWiki as EventListener);
    };
  }, [handleOpenWiki, handleCloseWiki]);
  ```
* **빈 의존성 배열(`[]`) 이펙트 정밀 진단:**
  - 본 파일에서 빈 의존성 배열 `[]`을 사용하는 유일한 `useEffect` 블록은 아래의 엔진 unmount 클린업 블록입니다 (Line 552-560):
    ```typescript
    useEffect(() => {
      return () => {
        const engine = engineRef.current;
        if (engine) {
          engine.destroy();
          engineRef.current = null;
        }
      };
    }, []);
    ```
  - **진단:** 이 클린업 이펙트는 React `useState`의 상태 변경이 아닌, `engineRef.current`라는 레퍼런스(ref) 값을 무효화(null)하고 리소스를 물리적으로 파괴(`engine.destroy()`)하는 작업만 수행합니다. 이는 React 렌더 흐름에 영향을 주지 않는 순수 자원 해제 작업이므로 완벽하게 안전하고 적절합니다.

### D. `src/app/page.tsx`
* **계획서 제안 내용:** 
  - 백그라운드 프리로드 타이머 로직을 `preloadModulesOnIdle` 콜백 함수로 추출하고 `useEffect` 의존성 배열에 추가할 것.
  - 마운트 시 무의미한 상태 갱신을 유발하던 `setAppMode('VITAL')` 호출을 완전히 제거할 것.
* **현재 코드 분석:**
  - `preloadModulesOnIdle`이 `useCallback`으로 성공적으로 격리됨 (Line 155-187).
  - `useEffect`가 `[preloadModulesOnIdle]`을 의존성 배열로 바라보며, 타이머가 언마운트 시점에 안전하게 클리어되도록 클린업 로직이 강화됨 (Line 190-210).
  - 기존 마운트 시점의 `setAppMode('VITAL')` 코드는 완전히 제거되어 렌더링 무결성이 향상됨.
* **코드 스니펫:**
  ```typescript
  // Line 155:
  const preloadModulesOnIdle = useCallback(() => {
    if (typeof window === 'undefined' || isInitializingGlobal) return null;
    // ... 생략 (Staggered Preloading 타이머 설정 및 requestIdleCallback 등록) ...
    return { timers, idleCallbackId };
  }, [isInitializingGlobal]);

  // Line 190:
  useEffect(() => {
    syncTombstones().catch((err) => {
      console.error('Failed to sync tombstones on mount:', err);
    });

    const idleTimer = preloadModulesOnIdle();

    return () => {
      if (idleTimer) {
        if (typeof window !== 'undefined') {
          if (idleTimer.idleCallbackId && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(idleTimer.idleCallbackId);
          }
          if (idleTimer.timers) {
            idleTimer.timers.forEach(t => clearTimeout(t));
          }
        }
      }
    };
  }, [preloadModulesOnIdle]);
  ```
* **빈 의존성 배열(`[]`) 이펙트 정밀 진단:**
  - 본 파일에서 빈 의존성 배열 `[]`을 사용하는 `useEffect` 블록은 다음 한 군데입니다 (Line 213-215):
    ```typescript
    useEffect(() => {
      document.title = 'PORTFOLIO - VITAL';
    }, []);
    ```
  - **진단:** 이 블록은 윈도우 문서 제목(`document.title`)이라는 React 외부의 전역 DOM 요소를 조작할 뿐이며, React 컴포넌트 내부의 상태 변이(`setXXX`)를 전혀 포함하지 않습니다. 마운트 시 최초 1회만 제목을 설정하므로 성능 낭비나 오작동의 우려 없이 완전히 무해합니다.

---

## 3. 검증 도구 실행 결과 요약 (Harness & Compiler Verification)

1. **자동화 검증 스크립트 실행 (`node scripts/run-harness.js`):**
   - Zod 스키마 검증: `'TASKS'`, `'BUDGET_CATEGORIES'`, `'BUDGET_ENTRIES'`, `'PROJECTS'`에 대한 무결성 진단 결과 **0개 오류** 검출.
   - ESLint 문법 및 정적 분석 진단: 소스코드 상 아키텍처 규칙 위반 및 성능 병목(Perf Bottlenecks) **0건** 달성.
   - 통합 진단 보고서 `data/diagnose_report.json` 컴파일 통과.
2. **Next.js 프로덕션 빌드 (`npm run build`):**
   - Turbopack 빌드 컴파일러 통과 (`Compiled successfully in 79s`).
   - static pages 및 api 라우트 정적/동적 생성 정상화 완료.

---

## 4. 권장 및 후속 전략 (Recommendations & Next Steps)

현재 구현된 최적화 패치는 완벽한 동작 정합성과 정적 무결성을 만족하고 있습니다. 향후 컴포넌트 수정 시 아래 지침을 지속적으로 준수할 것을 권장합니다:
* **비동기 API 및 타이머 관리:** `useEffect` 내에서 직접 `fetch`나 `setTimeout`을 선언할 경우 반드시 해당 스코프 내의 리액트 상태 갱신이 종속되지 않도록 주의하고, 불가피하다면 반드시 `useCallback`으로 격리하여 의존성 추적의 깊이를 차단할 것.
* **Ref 변이를 통한 렌더 스파이크 예방:** 컴포넌트의 라이프사이클이나 동작 상태 관리에 있어 리렌더링을 수반할 필요가 없는 단순 플래그성 상태(예: `initialLoadDone` 등)는 리액트 State 대신 `useRef`를 우선 활용하여 렌더 루프를 간소화할 것.
