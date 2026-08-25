'use client';

import { useState, useEffect, useMemo, RefObject } from 'react';

export interface UseVirtualListOptions {
  totalItems: number;
  itemHeight?: number;
  overscan?: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Zero-Dependency Window Virtualizer Hook
 * Calculates visible index range and top/bottom padding to preserve container height
 * while rendering only the visible items in the DOM.
 */
export function useVirtualList({
  totalItems,
  itemHeight = 120,
  overscan = 2,
  containerRef
}: UseVirtualListOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [containerOffsetTop, setContainerOffsetTop] = useState(0);

  useEffect(() => {
    const scrollParent = (typeof document !== 'undefined' && document.getElementById('main-scroll-container')) || (typeof window !== 'undefined' ? window : null);
    if (!scrollParent) return;

    let rafId: number | null = null;

    const updateOffsetAndMetrics = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (scrollParent === window) {
        setScrollTop(window.scrollY);
        setViewportHeight(window.innerHeight);
        setContainerOffsetTop(containerRect.top + window.scrollY);
      } else {
        const el = scrollParent as HTMLElement;
        const elRect = el.getBoundingClientRect();
        setScrollTop(el.scrollTop);
        setViewportHeight(el.clientHeight);
        setContainerOffsetTop(containerRect.top - elRect.top + el.scrollTop);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (scrollParent === window) {
          setScrollTop(window.scrollY);
        } else {
          const el = scrollParent as HTMLElement;
          setScrollTop(el.scrollTop);
        }
      });
    };

    const handleResize = () => {
      updateOffsetAndMetrics();
    };

    updateOffsetAndMetrics();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef]);

  const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);

  const startIndex = Math.max(0, Math.floor(relativeScrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems,
    Math.ceil((relativeScrollTop + viewportHeight) / itemHeight) + overscan
  );

  const topPadding = startIndex * itemHeight;
  const bottomPadding = Math.max(0, (totalItems - endIndex) * itemHeight);

  return useMemo(() => ({
    startIndex,
    endIndex,
    topPadding,
    bottomPadding
  }), [startIndex, endIndex, topPadding, bottomPadding]);
}
