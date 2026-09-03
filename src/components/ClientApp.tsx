'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { initCryptoContext } from '@/lib/crypto';
import { SplashView } from '@/components/SplashView';
import { ProtectedApp } from '@/components/ProtectedApp';

const emptySubscribe = () => () => {};

export function ClientApp() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [appMode, setAppMode] = useState<'HCHPS' | 'VITAL'>('VITAL');

  useEffect(() => {
    initCryptoContext('0509').catch(() => {});
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    document.title = 'PORTFOLIO - VITAL';
  }, [appMode]);

  const handleModeChange = useCallback(() => {
    setAppMode('VITAL');
  }, []);

  if (!isClient) {
    return <SplashView />;
  }

  return (
    <ProtectedApp 
      appMode={appMode} 
      onModeChange={handleModeChange} 
    />
  );
}

export default ClientApp;






