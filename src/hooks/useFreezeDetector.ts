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

function initPerformanceObserver(onFreeze: (duration: number) => void): PerformanceObserver | null {
  try {
    if ('PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 60) {
            onFreeze(entry.duration);
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
 * Ignores background tab switching duration.
 */
export function useFreezeDetector(activeModule: string) {
  const activeModuleRef = useRef(activeModule);
  useEffect(() => {
    activeModuleRef.current = activeModule;
  }, [activeModule]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastTime = performance.now();
    const handleFreeze = (duration: number) => {
      // Ignore background tab switching false positives (> 5 seconds or when document is hidden)
      if (document.hidden || duration > 4000) {
        lastTime = performance.now();
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
      // Only report frame delta if not in background and delta is realistic (< 4000ms)
      if (!observer && delta > 150 && delta <= 4000) {
        handleFreeze(delta);
      }
      lastTime = now;
      animFrameId = requestAnimationFrame(checkFrameDelta);
    };

    const handleVisibilityChange = () => {
      lastTime = performance.now();
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
