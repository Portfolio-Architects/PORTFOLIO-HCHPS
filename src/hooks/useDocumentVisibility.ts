'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to monitor tab/document visibility (AGENTS.md Rule 2-J compliance).
 * Returns true when the page is active/visible, and false when the tab is backgrounded/hidden.
 */
export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => 
    typeof document !== 'undefined' ? !document.hidden : true
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
