# Challenge Report — 2026-07-15T01:44:35Z

## Challenge Summary

**Overall risk assessment**: LOW

The refactoring in `src/hooks/useSignal.ts`, `src/components/SecurityLockScreen.tsx`, `src/components/MindMap3D.tsx`, and `src/app/page.tsx` is highly correct, cleanly written, and structurally robust. Stress testing confirms that timers and event listeners are properly registered and unregistered without memory leaks. 

However, we identified a minor functional limitation in the keyword extraction logic of `useSignal.ts`.

---

## Challenges

### [Low] Challenge 1: Unstripped Formal Korean Suffixes in Keyword Extraction

- **Assumption challenged**: The assumption that `extractKeywords` cleanly extracts the semantic root words for all common Korean sentences.
- **Attack scenario**: A user inputs a signal in formal speech ending in `~했습니다` or `~습니다` (e.g. "서울시 강남체육센터에서 비만예방 프로그램을 진행했습니다."). Because these specific formal suffixes are missing from the `suffixPatterns` array, the word `진행했습니다` is extracted as a keyword instead of being stripped to `진행`.
- **Blast radius**: The generated 3D MindMap receives noisy, unnormalized keyword labels (like "진행했습니다" instead of "진행"), reducing the readability and connectivity of the ontology graph.
- **Mitigation**: Update the `suffixPatterns` array in `src/hooks/useSignal.ts` to include formal suffix endings such as `'했습니다'`, `'습니다'`, `'합니다'`, `'됩니다'`, and `'했습니다'`.

---

## Stress Test Results

- **Timer Cleanup under Rapid Mount/Unmount Stress (`src/app/page.tsx`)**
  - Scenario: Render and immediately unmount `Home` component 100 times in a rapid loop to simulate extreme navigation/mount churn.
  - Expected behavior: All timers scheduled by the component's effects are cleaned up, yielding zero dangling timers.
  - Actual behavior: 100 timeouts were scheduled by `Home` and exactly 100 timeouts were cleared (ignoring 6 one-time timeouts scheduled internally by Next.js's dynamic imports on first hydration).
  - Status: **PASS**

- **Inner Timer Cleanup mid-flight (`src/app/page.tsx`)**
  - Scenario: Render `Home` component, fast-forward Jest fake timers past the first threshold (1800ms) to trigger the second splash timer, then immediately unmount.
  - Expected behavior: The pending inner timeout is cancelled successfully upon unmount.
  - Actual behavior: All scheduled timeouts (including the inner splash timer and ProtectedApp preloading timers, totaling 5) were successfully cancelled on unmount.
  - Status: **PASS**

- **SecurityLockScreen Keydown Event Cleanup (`src/components/SecurityLockScreen.tsx`)**
  - Scenario: Mount `SecurityLockScreen` and monitor `window.addEventListener` for `keydown`, then unmount it and verify cleanup.
  - Expected behavior: The `keydown` listener is added on mount and the exact same handler reference is removed on unmount.
  - Actual behavior: 1 listener registered on mount, 0 remaining listeners on unmount.
  - Status: **PASS**

- **MindMap3D Event Listener Lifecycle (`src/components/MindMap3D.tsx`)**
  - Scenario: Mount the actual `MindMap3D` component and verify that the `keydown`, `wiki:openNode`, and `wiki:closeNode` listeners are registered and subsequently unregistered.
  - Expected behavior: All 3 listeners are registered on mount and cleaned up on unmount.
  - Actual behavior: Registered handlers were cleanly unregistered upon component unmount, with 0 leftover listeners.
  - Status: **PASS**

- **Compilation Check**
  - Scenario: Run typescript type check (`npx tsc --noEmit`) to verify zero compile errors or regressions.
  - Expected behavior: Clean compilation.
  - Actual behavior: Successfully compiles with no errors.
  - Status: **PASS**

---

## Unchallenged Areas

- **Canvas Orbit Simulation Performance**: The real rendering performance of `OntologyCanvasEngine` and `PerformanceProfiler` inside `MindMap3D` under a GPU-bound environment was not stress-tested because Jest runs in a headless Node/JSDOM context where canvas rendering operations are mocked/stubbed.

---

## Attack Surface

- **Hypotheses tested**: Checked whether React component lifecycles correctly cleanup asynchronous operations (timeouts and window event listeners) when unmounted before completion.
- **Vulnerabilities found**:
  - Missing formal Korean verb/postposition suffixes (`했습니다`, `습니다`) in `src/hooks/useSignal.ts`'s keyword extractor, leading to unnormalized keyword tokens.
- **Untested angles**: Physical GPU performance during dense graph orbiting under low memory/throttled CPU conditions.

---

## Loaded Skills

- No external Antigravity skills were loaded for this task.
