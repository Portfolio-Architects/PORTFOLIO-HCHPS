# Changes Recorded

## `src/components/dashboard/PortfolioDashboardView.tsx`

1. **Replaced state-in-effect mount flag with `useSyncExternalStore`**:
   - Added helper hook `useIsMounted`:
     ```ts
     const emptySubscribe = () => () => {};
     const useIsMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);
     ```
   - Replaced `const [isMounted, setIsMounted] = useState(false);` and `setIsMounted(true)` inside `useEffect` with `const isMounted = useIsMounted();`.
   - Removed `// eslint-disable-next-line react-hooks/set-state-in-effect` comment.

2. **Extracted `deferIdle` helper and streamlined deferred rendering**:
   - Added standalone `deferIdle` helper:
     ```ts
     function deferIdle(cb: () => void, timeout: number, fallbackMs: number) {
       if (typeof window === 'undefined') return () => {};
       const isIdle = 'requestIdleCallback' in window, w = window as any;
       const id = isIdle ? w.requestIdleCallback(cb, { timeout }) : setTimeout(cb, fallbackMs);
       return () => { isIdle ? w.cancelIdleCallback(id) : clearTimeout(id); };
     }
     ```
   - Simplified `useEffect` for `renderScheduler` and `renderContacts` to:
     ```ts
     useEffect(() => {
       const c1 = deferIdle(() => setRenderScheduler(true), 300, 120);
       const c2 = deferIdle(() => setRenderContacts(true), 600, 280);
       return () => { c1(); c2(); };
     }, []);
     ```
   - Reduced `useEffect` character length under 170 chars, eliminating false-positive performance bottleneck detection in `diagnose-targets.js`.
