# Adversarial Challenge Report — Refactoring Verification

## Challenge Summary

**Overall risk assessment**: HIGH (Due to a critical logic error in `useSignal.ts` that silently prevents tombstone tracking for deleted entries on clean clients)

---

## Challenges

### [Critical] Challenge 1: Silent Failure in Tombstone Tracking in `useSignal.ts`

- **Assumption challenged**: That fallback placeholders containing JavaScript/TypeScript comments (e.g. `[/* empty */]`) can be parsed as valid JSON using `JSON.parse`.
- **Attack scenario**: 
  - Under a clean browser context (or when local storage is cleared), the key `hchps-global-tombstones` is absent from `localStorage`.
  - When the user deletes a signal using `deleteSignal(id)`, the code attempts to retrieve existing tombstones:
    `const deletedIds = JSON.parse(localStorage.getItem('hchps-global-tombstones') || '[/* empty */]');`
  - Since the item is null, it falls back to `"[/* empty */]"`.
  - Calling `JSON.parse("[/* empty */]")` throws a `SyntaxError: Unexpected token / in JSON at position 1` because JSON syntax does not support comments.
  - This error is caught by the silent `catch {}` block.
  - Consequently, the execution of the deletion logic is aborted before pushing the deleted ID and writing it back to `localStorage`.
  - The tombstone list remains uninitialized (`null`), and the deletion is never recorded as a tombstone on the client.
  - When the application performs a remote sync with the sheet API, the deleted signals (which still exist in remote KV cache due to eventual consistency latency) are downloaded again and "resurrected" as zombie data.
- **Blast radius**: Eventual consistency data synchronization is compromised. Deletions on clean client sessions are not persistent across sync operations, causing deleted entries to reappear.
- **Mitigation**: Change the fallback JSON string from `"[/* empty */]"` to `'[]'` in `src/hooks/useSignal.ts` at line 149 and line 226.

---

### [Low] Challenge 2: Staggered Preloading Timing under Rapid Unmount in `page.tsx`

- **Assumption challenged**: That asynchronous timers and idle callbacks scheduled during rendering will not trigger state updates on an unmounted component.
- **Attack scenario**:
  - `ProtectedApp` schedules three staggered timeouts inside a `requestIdleCallback` block to preload modules.
  - If the user logs out or redirects (causing `ProtectedApp` to unmount) before the timers execute, there is a risk of a memory leak or React state updates on an unmounted component.
- **Blast radius**: Low. The current implementation in `page.tsx` contains a robust cleanup hook that tracks the `idleCallbackId` and all active `timers`, and cancels/clears them inside the `useEffect` cleanup return. Therefore, no leaks or state updates occur.
- **Mitigation**: Maintain the current cleanup guards. If any other async events or promises are introduced to the preloading phase, ensure they check a `mounted` ref before calling state setters.

---

## Stress Test Results

We executed a comprehensive Jest test suite (`__tests__/refactoring_verification.test.tsx`) under JSDOM to stress test the refactored code and cleanup mechanisms. The results are detailed below:

| Test Case / Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **useSignal: Keyword Extraction** | Exclude stopwords, strip suffixes (e.g. `에서`, `을`), and filter out short terms. | Correctly extracted roots and filtered noise. | **PASS** |
| **useSignal: Frequency Aggregation** | Map keywords to count frequencies correctly. | Correctly counted frequencies. | **PASS** |
| **useSignal: Tombstone Logic (Workaround)** | Add deleted signal ID to tombstones when storage is pre-populated. | Tombstone added successfully. | **PASS** |
| **useSignal: Tombstone Clean Storage (Bug)** | Attempting deletion on clean localStorage should fail to record tombstone. | Tombstone list remains null due to `SyntaxError`. | **PASS** (Bug Verified) |
| **SecurityLockScreen: Listeners** | keydown listener added on mount and fully removed on unmount. | Listener cleared on unmount. | **PASS** |
| **SecurityLockScreen: Key Processing** | Keydown events update PIN correctly. | Inputs processed without leaks. | **PASS** |
| **MindMap3D: Listeners & Cleanup** | Custom wiki listeners, keydown, and engine destroy cleaned up. | `engine.destroy()` called; listeners unregistered. | **PASS** |
| **MindMap3D: Canvas Wheel Listener** | Wheel handler added to canvas and cleaned up. | Added with `passive: false` and cleared. | **PASS** |
| **page.tsx: Splash Timer Cleanup** | 10 rapid mount/unmount iterations do not crash or leak timers. | All timers cleared via `clearTimeout`. | **PASS** |

---

## Unchallenged Areas

- **Canvas GPU Rendering Performance** — We did not measure hardware acceleration or WebGL frame times under real GPU devices because the verification runs within a headless node environment using JSDOM. Real GPU profile limits remain unchecked.
