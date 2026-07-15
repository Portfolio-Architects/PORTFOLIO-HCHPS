# Code Quality and Architecture Review

This report presents an independent review of the refactoring changes made to the core files in the **PORTFOLIO - VITAL** workspace. The review covers correctness, React best practices, TypeScript standards, MVC compliance, performance optimization, and risk assessment.

---

# PART 1: Quality Review

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1: TypeScript Type Checking and Next.js Build Failure
- **What**: The Next.js production build (`npm run build`) fails during the TypeScript compilation phase (`Running TypeScript...`) due to syntax/type errors in the stress test file.
- **Where**: `__tests__/refactoring-stress.test.tsx` (lines 251, 267, 358, 363)
- **Why**: 
  - Lines 251 & 267: Direct conversion of `global.setTimeout` to `jest.Mock` fails TS compilation (`error TS2352`). TypeScript requires converting to `unknown` first (e.g. `as unknown as jest.Mock`).
  - Lines 358 & 363: `const signalEntries = [];` implicitly infers type `any[]` which fails strict type constraints (`error TS7034`, `error TS7005`). It should be typed explicitly, for example: `const signalEntries: SignalEntry[] = [];`.
- **Suggestion**: The implementer must fix the type assertions and variable typings in the test file so that `npx tsc --noEmit` and `npm run build` pass cleanly.

### [Minor] Finding 2: Unused Props Destructured or Defined in `MindMap3D.tsx`
- **What**: Props `onAddSignal`, `onDeleteSignal`, and `onUpdateKeywords` are defined in the `MindMap3DProps` interface and passed down from `page.tsx` but are never destructured or used in the component body of `MindMap3D.tsx`.
- **Where**: `src/components/MindMap3D.tsx` (lines 34-36 and line 72)
- **Why**: Dead props reduce readability and create confusion regarding where signal mutations occur. Graph-specific custom node mutations are handled via `useGraphCustomization` directly inside `MindMap3D.tsx`.
- **Suggestion**: Clean up unused props in `MindMap3DProps` and `page.tsx` if they are no longer needed.

### [Minor] Finding 3: Direct API Calls in Controller Hook `useSignal.ts`
- **What**: The custom controller hook `useSignal` performs direct promise-based data fetching and synchronization with Google Sheets API via `@/lib/sheets-api` instead of utilizing React Query.
- **Where**: `src/hooks/useSignal.ts` (lines 4, 143, 213, 232, 244, 255)
- **Why**: While `useSignal` resides in `src/hooks/` (matching the controller layer rule) and serves as an abstraction for components, it bypasses React Query's cache and mutation management, which is the standard defined in `AGENTS.md`.
- **Suggestion**: Consider wrapping `sheets-api` operations inside React Query (`useQuery` and `useMutation`) for unified loading states and error handling, if consistent with other hooks like `useTasks`.

## Verified Claims

- **Harness static analysis checks (`node scripts/run-harness.js`)** → verified via command execution → **PASS**
  - *Detail*: Running the harness passes with 0 lint warnings, 0 architectural violations, and 0 performance bottlenecks. Zod database schemas are also fully valid.
- **Splash screen useEffect memory leak resolved** → verified via source code analysis of `src/app/page.tsx` → **PASS**
  - *Detail*: Both `timerId` and `removeTimerId` are declared at the effect scope, and both are explicitly cleared via `clearTimeout` in the cleanup function.
- **IME Composition and Backspace issue resolved in search inputs** → verified via analysis of `Sidebar.tsx` and `page.tsx` → **PASS**
  - *Detail*: Input search is decoupled or debounced, preventing React re-render cycles from interrupting the browser IME buffer during Korean input.
- **E2EE Encryption Bypass for performance** → verified via `useSignal.ts` and `useSecurityLock` analysis → **PASS**
  - *Detail*: Plain-text JSON reading/writing is used for storage (`data/*.json` and `hchps-signal-log` / `hchps-global-tombstones`) without E2EE bottlenecks, satisfying rule A1.
- **Zombie Data Prevention (Tombstones)** → verified via `useSignal.ts` and `MindMap3D.tsx` → **PASS**
  - *Detail*: Correctly tracks `hchps-global-tombstones` to filter out deleted IDs from eventually-consistent sheets API payloads.

## Coverage Gaps

- **Sheets API Offline Syncer** — risk level: **LOW** — recommendation: **accept risk**
  - *Detail*: The background sync mutations inside `useSignal.ts` silently catch sheets-api errors (console.warn). If a sync fails, the data remains in `localStorage` cache but will not retry syncing to sheets-api until the next manual change triggers a save, which could cause slight drift if offline for long periods. Given it is a local offline-first app, this risk is acceptable.

## Unverified Items

- **Production Build (`npm run build`)** — reason not verified: Next.js build failed due to TypeScript errors in `__tests__/refactoring-stress.test.tsx` (see Critical Finding 1).

---

# PART 2: Adversarial Challenge Review

## Challenge Summary

**Overall risk assessment**: LOW to MEDIUM

## Challenges

### [Medium] Challenge 1: Async Race Condition in PIN verification
- **Assumption challenged**: Assumes that input locks and UI state setters resolve in sequential lockstep and that user input is disabled during verification.
- **Attack scenario**: The user enters a 4-digit PIN. `handlePinComplete` is triggered, which invokes the asynchronous `onVerify` method. While `onVerify` is awaiting resolution, the user rapidly presses Backspace and then types a different digit, generating a second concurrent `onVerify` call. If the second call resolves faster than the first, or if the first resolves later and overrides the second's error state, it can lead to erratic UI states, overlapping shake animations, and multiple unresolved timeouts.
- **Blast radius**: Visual glitching, console errors, or possible bypass of authentication if states are modified dynamically during the unresolved async gap.
- **Mitigation**: Introduce a loading flag (e.g. `isVerifying`) that disables the keypad and keyboard listeners while an authentication request is in progress.

### [Low] Challenge 2: $O(N^2)$ Physics Calculations Freeze UI Thread
- **Assumption challenged**: Assumes that the volume of signals/nodes mapped into the mindmap remains small enough that the Canvas 2D engine's tick loop doesn't block the UI thread.
- **Attack scenario**: If the user has a large volume of notes or automated processes that populate hundreds of nodes, the 2D physics engine (`OntologyCanvasEngine.tick()`) will run $O(N^2)$ calculations on every frame. Since it runs in the main UI thread, this will lead to immediate frame rate dropping and UI freeze.
- **Blast radius**: Complete UI unresponsiveness, prompting browser warnings.
- **Mitigation**: Implement frustum/LOD culling for physics calculations, disable physics for nodes that are far away, or run physics calculations in a Web Worker to isolate the UI thread.

## Stress Test Results

- **Rapid backspace/typing during PIN authentication** → predicted behavior: race condition triggers overlapping shake timeouts → **FAIL**
- **Increasing node count to 1000+** → predicted behavior: physics engine ticks exceed 16.7ms frame budget, causing lag warnings → **FAIL**

## Unchallenged Areas

- **PartyKit and CRDT sync replication** — reason not challenged: WebSocket synchronization and offline storage mechanisms are handled outside the scope of the target files being reviewed.
