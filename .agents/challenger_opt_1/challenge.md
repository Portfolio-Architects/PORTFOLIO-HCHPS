# Adversarial Review & Optimization Verification Report

## Challenge Summary

**Overall risk assessment**: HIGH

While the optimizations implemented by Worker 1 successfully resolve the targeted performance bottlenecks (rendering loop CPU usage, API latency, $O(N \cdot M)$ stats recalculation, and page load sizes), there is a critical build-time regression that prevents the application from building successfully for production.

---

## Challenges

### [Critical] Challenge 1: Watcher Daemon Triggered at Build-Time Crashes Next.js Build

- **Assumption challenged**: The assumption that top-level execution checks like `typeof window === 'undefined'` in `src/app/api/data/route.ts` are safe and only run in a live server environment.
- **Attack scenario**: During `next build`, Next.js compiles and prerenders the API routes. Because `typeof window === 'undefined'` evaluates to `true` in the Node.js build process, the top-level block executes `startWatcherDaemon()`. This starts a heavy file watcher in the background scanning `F:\부엉이_정리됨` containing 26,000+ files, running python parser sub-processes.
- **Blast radius**: 
  1. The large size of files (e.g., `.search_cache.json`) causes the stdout buffer of `fast_parser.py` to overflow, throwing `RangeError: stdout maxBuffer length exceeded (ERR_CHILD_PROCESS_STDIO_MAXBUFFER)`. This uncaught error in the worker thread crashes the Next.js build.
  2. The concurrent background disk scan locks files in the `.next` directory, causing compiler collisions like `ENOENT: pages-manifest.json` or `ENOENT: _buildManifest.js.tmp` not found, leading to random build failures.
- **Mitigation**: Prevent the watcher daemon from starting during build by checking `process.env.NEXT_PHASE` or verifying if the environment is a live server (e.g. `process.env.NODE_ENV !== 'production' || !process.env.NEXT_IS_BUILDING`).

---

## Stress Test Results

- **Dashboard Rapid Mount/Unmount**:
  - *Scenario*: Mount and unmount the `Home` component 100 times sequentially inside Jest.
  - *Expected behavior*: Staggered preloading timers and requestIdleCallback are cleaned up completely on unmount, with 0 memory leaks or runtime exceptions.
  - *Actual behavior*: All setTimeout and requestIdleCallback handles were successfully cancelled and cleared. Tests passed.
  - *Status*: PASS

- **Tombstone Syntax Error Under Empty Storage**:
  - *Scenario*: Add and delete a signal with empty or non-existent `hchps-global-tombstones` in localStorage.
  - *Expected behavior*: The JSON parsing logic should handle the absence of tombstones gracefully, without throwing a SyntaxError.
  - *Actual behavior*: The useSignal hook correctly falls back to empty arrays and records the deleted ID successfully. Tests passed.
  - *Status*: PASS

- **Clean next build (Turbopack)**:
  - *Scenario*: Run `npm run build` using Next.js default Turbopack build.
  - *Expected behavior*: Successful generation of optimized build artifacts.
  - *Actual behavior*: Failed with `ENOENT: pages-manifest.json` and watcher parser stdio buffer overflow.
  - *Status*: FAIL

- **Webpack Build (`next build --webpack`)**:
  - *Scenario*: Run `npx next build --webpack` to compile using Webpack.
  - *Expected behavior*: Successful generation of optimized build artifacts.
  - *Actual behavior*: Failed with `RangeError: stdout maxBuffer length exceeded` on `.search_cache.json` under watcher daemon.
  - *Status*: FAIL

---

## Unchallenged Areas

- **E2EE encryption operations**: Handled as bypassed in local development as per `AGENTS.md` guidelines.
- **Actual public sheets sync API**: Mocked out during testing, so real network latency on Google Sheets sync was not tested.
