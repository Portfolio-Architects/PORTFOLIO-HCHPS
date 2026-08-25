'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

function getSnapshot(): boolean {
  return typeof document !== 'undefined' ? !document.hidden : true;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Hook to monitor tab/document visibility (AGENTS.md Rule 2-J compliance).
 * Implemented via useSyncExternalStore for zero tearing and zero mount latency.
 * Returns true when the page is active/visible, and false when the tab is backgrounded/hidden.
 */
export function useDocumentVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
