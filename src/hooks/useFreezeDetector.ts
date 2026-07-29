'use client';

import { useEffect, useRef } from 'react';

export interface FreezeEventDetail {
  duration: number; // in ms
  activeModule?: string;
  timestamp: string;
}

function recordFreezeSessionLog(logMessage: string, duration: number, currentModule: string) {
  if (typeof window === 'undefined') return;
  console.warn(logMessage);

  try {
    const existingRaw = sessionStorage.getItem('vital-freeze-logs');
    const existing: Array<{ timestamp: string; level: 'warn' | 'error'; message: string }> = existingRaw ? JSON.parse(existingRaw) : [];
    
    if (existing.length >= 50) existing.shift();
    
    existing.push({
      timestamp: new Date().toISOString(),
      level: duration > 300 ? 'error' : 'warn',
      message: logMessage
    });

    sessionStorage.setItem('vital-freeze-logs', JSON.stringify(existing));
  } catch (e) {
    console.warn('[Freeze Detector] Failed to save freeze log to sessionStorage:', e);
  }

  window.dispatchEvent(new CustomEvent('vital:freeze_logged', {
    detail: {
      duration,
      module: currentModule,
      timestamp: new Date().toISOString()
    }
  }));
}

function initPerformanceObserver(onFreeze: (duration: number, startTime: number) => void): PerformanceObserver | null {
  try {
    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        // If multiple longtasks are flushed simultaneously in a single callback, it indicates background tab queueing
        const isBatchFlush = entries.length >= 2;
        
        for (const entry of entries) {
          if (entry.duration >= 60) {
            if (isBatchFlush && entry.duration > 500) {
              // Ignore batch-flushed background tab tasks
              continue;
            }
            onFreeze(entry.duration, entry.startTime);
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      return observer;
    }
  } catch (err) {
    console.warn('[Freeze Detector] PerformanceObserver fallback:', err);
  }
  return null;
}

/**
 * Real-time Main Thread Freeze & Long Task Detector
 * Detects JS event loop stalls > 50ms using PerformanceObserver & RAF fallback.
 * Strictly filters out false positive stalls caused by background tab switching & window blur.
 */
export function useFreezeDetector(activeModule: string) {
  const activeModuleRef = useRef(activeModule);
  useEffect(() => {
    activeModuleRef.current = activeModule;
  }, [activeModule]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastTime = performance.now();
    let lastVisibilityChangeTime = performance.now();
    const mountTime = performance.now();

    const handleFreeze = (duration: number, startTime?: number) => {
      const now = performance.now();
      
      // 1. Ignore if tab is hidden or within initial mount grace period (2000ms)
      if (document.hidden || (now - mountTime < 2000)) {
        lastTime = now;
        return;
      }

      // 2. Ignore longtasks during tab switching / window refocus grace period (3500ms)
      if (now - lastVisibilityChangeTime < 3500) {
        lastTime = now;
        return;
      }

      // 3. Check performance entry startTime if available
      if (typeof startTime === 'number') {
        const taskEndTime = startTime + duration;
        // If task ended near visibility change or started before last visibility change, ignore as background artifact
        if (startTime < lastVisibilityChangeTime || (now - taskEndTime < 3500)) {
          lastTime = now;
          return;
        }
      }

      // 4. Ignore unrealistic duration spikes (> 2500ms) which are OS/browser tab throttles
      if (duration > 2500) {
        lastTime = now;
        return;
      }

      const currentModule = activeModuleRef.current || 'unknown';
      recordFreezeSessionLog(`[Freeze Detector] UI thread stall detected: ${Math.round(duration)}ms on module '${currentModule}'`, duration, currentModule);
    };

    const observer = initPerformanceObserver(handleFreeze);

    const checkFrameDelta = (now: number) => {
      if (document.hidden) {
        lastTime = now;
        animFrameId = requestAnimationFrame(checkFrameDelta);
        return;
      }

      const delta = now - lastTime;
      // Only report frame delta if not in background, realistic (< 2500ms), and well after visibility change
      if (!observer && delta > 150 && delta <= 2500 && (now - lastVisibilityChangeTime >= 3500) && (now - mountTime >= 2000)) {
        handleFreeze(delta);
      }
      lastTime = now;
      animFrameId = requestAnimationFrame(checkFrameDelta);
    };

    const handleVisibilityChange = () => {
      lastTime = performance.now();
      lastVisibilityChangeTime = performance.now();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    let animFrameId: number | null = requestAnimationFrame(checkFrameDelta);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      if (observer) {
        try { observer.disconnect(); } catch {}
      }
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, []);
}
