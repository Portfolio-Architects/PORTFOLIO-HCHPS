'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { initCryptoContext } from '@/lib/crypto';
import { SplashView } from '@/components/SplashView';
import { ProtectedApp } from '@/components/ProtectedApp';

export function ClientApp() {
  const [appMode, setAppMode] = useState<'HCHPS' | 'VITAL'>('VITAL');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initCryptoContext('0509').catch(() => {});
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);

  useEffect(() => {
    document.title = 'PORTFOLIO - VITAL';
  }, [appMode]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setIsInitializing(false);
    }, 400);

    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 800);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const handleModeChange = useCallback(() => {
    setAppMode('VITAL');
  }, []);

  return (
    <div className="relative w-full min-h-screen bg-[#f8fafc]">
      <Suspense fallback={null}>
        <ProtectedApp 
          appMode={appMode} 
          onModeChange={handleModeChange} 
        />
      </Suspense>
      
      {showSplash && (
        <div 
          className="fixed inset-0 z-[300] transition-opacity duration-400 ease-out pointer-events-none"
          style={{ opacity: isInitializing ? 1 : 0 }}
        >
          <SplashView />
        </div>
      )}
    </div>
  );
}

export default ClientApp;
