# Code Optimization & Refactoring Verification Analysis

This report analyzes `src/hooks/useSignal.ts` and `src/app/page.tsx` against the specifications in `implementation_plan.md`. The objective is to verify if they are fully refactored, if any changes are missing, and if any `useEffect` blocks with empty dependency arrays contain state mutations that lack callbacks or cleanup.

---

## 1. Executive Summary

- **`src/hooks/useSignal.ts`**: **Fully Compliant**. The file successfully implements the callback extraction (`fetchSignals`) using `useCallback` and lists `fetchSignals` in the dependency array of the respective `useEffect`. There are no empty dependency array `useEffect` blocks that mutate state.
- **`src/app/page.tsx`**: **Mostly Compliant with a Subtle Leak**. 
  - The module preloading logic (`preloadModulesOnIdle`) has been extracted into a `useCallback` and is properly registered in the dependency array of the mounting `useEffect`.
  - The unnecessary `setAppMode('VITAL')` call in `Home` component mount was successfully removed.
  - **Subtle Bug / Memory Leak Identified**: The splash screen `useEffect` inside the `Home` component (lines 554-566) sets a nested timeout where the cleanup function for the inner timeout is returned inside the outer timeout's callback. This returned cleanup function is ignored by `setTimeout`, meaning the inner timeout (`removeTimer`) is never cleaned up if the component unmounts between 1800ms and 2500ms.

---

## 2. Detailed Findings

### A. `src/hooks/useSignal.ts`

#### Alignment with `implementation_plan.md`
- **Plan Requirement**: Extract heavy async fetch and migration logic into a `useCallback` based `fetchSignals` and pass it to `useEffect`'s dependency array.
- **Observation**:
  - The function `fetchSignals` is defined on line 140 using `useCallback`:
    ```typescript
    const fetchSignals = useCallback(() => {
      if (initialLoadDone.current) return;
      initialLoadDone.current = true;
      readSheet<SignalEntry>(SHEET_NAME)
        .then(rows => { ... })
        .catch(() => { ... });
    }, []);
    ```
  - The corresponding `useEffect` on line 191 is written as:
    ```typescript
    useEffect(() => {
      fetchSignals();
    }, [fetchSignals]);
    ```
- **Analysis**:
  - There are no empty dependency arrays (`[]`) with state mutations.
  - The `useEffect` has `[fetchSignals]` as its dependency, preventing it from triggering double renders since `fetchSignals`'s identity is stable (memoized with `useCallback`).
  - No changes are missing or incomplete.

---

### B. `src/app/page.tsx`

#### Alignment with `implementation_plan.md`
- **Plan Requirement 1**: Extract module preloading timer logic into `preloadModulesOnIdle` callback and register in `useEffect` dependencies.
- **Observation**:
  - The callback `preloadModulesOnIdle` is declared on line 155 using `useCallback`:
    ```typescript
    const preloadModulesOnIdle = useCallback(() => {
      if (typeof window === 'undefined' || isInitializingGlobal) return null;
      ...
      return { timers, idleCallbackId };
    }, [isInitializingGlobal]);
    ```
  - The preloading `useEffect` on line 190 uses `preloadModulesOnIdle` in its dependency array and implements robust cleanup:
    ```typescript
    useEffect(() => {
      syncTombstones().catch((err) => { ... });
      const idleTimer = preloadModulesOnIdle();
      return () => {
        if (idleTimer) {
          if (typeof window !== 'undefined') {
            if (idleTimer.idleCallbackId && 'cancelIdleCallback' in window && typeof idleTimer.idleCallbackId === 'number') {
              window.cancelIdleCallback(idleTimer.idleCallbackId);
            }
            if (idleTimer.timers && Array.isArray(idleTimer.timers)) {
              idleTimer.timers.forEach(t => clearTimeout(t));
            }
          }
        }
      };
    }, [preloadModulesOnIdle]);
    ```
  - This matches the plan exactly.
- **Plan Requirement 2**: Completely remove unnecessary `setAppMode('VITAL')` call in `Home` mount.
- **Observation**:
  - The initial state is defined as `const [appMode, setAppMode] = useState<'HCHPS' | 'VITAL'>('VITAL');` (line 545).
  - No mount-level `useEffect` performs `setAppMode('VITAL')`. The requirement has been satisfied.

#### Missing/Incomplete Changes & Memory Leak (Splash Screen useEffect)
- **Observation**:
  - In `Home` (lines 554-566):
    ```typescript
    useEffect(() => {
      // 클라이언트 마운트 및 PIN 락이 해제되어 활성화된 순간부터 1.8초 동안만 스플래시 가동
      if (isClient && !isLocked) {
        const timer = setTimeout(() => {
          setIsInitializing(false);
          const removeTimer = setTimeout(() => {
            setShowSplash(false);
          }, 700);
          return () => clearTimeout(removeTimer); // <-- BUG: Returned inside setTimeout callback, ignored by React!
        }, 1800);
        return () => clearTimeout(timer);
      }
    }, [isClient, isLocked]);
    ```
  - **The Bug**:
    - The returned function `() => clearTimeout(removeTimer)` is inside the callback function of the outer `setTimeout`. Its return value is completely discarded by the browser's timer loop.
    - If the component unmounts or `isClient`/`isLocked` changes *after* 1800ms but *before* 2500ms, the outer `timer` has already fired, and calling `clearTimeout(timer)` does nothing.
    - The inner `removeTimer` will still execute after the remaining time and trigger `setShowSplash(false)` on an unmounted component.
  - **Impact**: State mutation after unmount leading to potential memory leaks and console warnings.

---

## 3. Recommendation & Fix Strategy

To resolve the memory leak in the splash screen timer inside `src/app/page.tsx`, we must track both timers at the `useEffect` scope and ensure both are cancelled in the main cleanup function returned to React.

### Proposed Code Patch for `src/app/page.tsx`

```typescript
<<<<
  useEffect(() => {
    // 클라이언트 마운트 및 PIN 락이 해제되어 활성화된 순간부터 1.8초 동안만 스플래시 가동
    if (isClient && !isLocked) {
      const timer = setTimeout(() => {
        setIsInitializing(false);
        const removeTimer = setTimeout(() => {
          setShowSplash(false);
        }, 700);
        return () => clearTimeout(removeTimer);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [isClient, isLocked]);
====
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    let removeTimerId: NodeJS.Timeout | undefined;

    // 클라이언트 마운트 및 PIN 락이 해제되어 활성화된 순간부터 1.8초 동안만 스플래시 가동
    if (isClient && !isLocked) {
      timerId = setTimeout(() => {
        setIsInitializing(false);
        removeTimerId = setTimeout(() => {
          setShowSplash(false);
        }, 700);
      }, 1800);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (removeTimerId) clearTimeout(removeTimerId);
    };
  }, [isClient, isLocked]);
>>>>
```
