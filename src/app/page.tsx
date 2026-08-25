'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedApp } from '@/components/ProtectedApp';
import { initCryptoContext } from '@/lib/crypto';
import { Sparkles } from 'lucide-react';

function AppSkeleton() {
  return (
    <div className="w-full min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="w-48 h-4 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [appMode, setAppMode] = useState<'HCHPS' | 'VITAL'>('VITAL');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  useEffect(() => {
    initCryptoContext('0509').catch(() => {});
  }, []);

  useEffect(() => {
    document.title = 'PORTFOLIO - VITAL';
  }, [appMode]);

  useEffect(() => {
    let removeTimerId: NodeJS.Timeout | null = null;
    const timerId = setTimeout(() => {
      setIsInitializing(false);
      removeTimerId = setTimeout(() => {
        setShowSplash(false);
      }, 700);
    }, 1000);

    return () => {
      clearTimeout(timerId);
      if (removeTimerId) {
        clearTimeout(removeTimerId);
      }
    };
  }, []);

  const handleModeChange = useCallback(() => {
    setAppMode('VITAL');
  }, []);

  return (
    <>
      {isMounted ? (
        <ProtectedApp 
          appMode={appMode} 
          onModeChange={handleModeChange} 
          isInitializingGlobal={isInitializing}
        />
      ) : (
        <AppSkeleton />
      )}
      
      {/* 프리미엄 전역 로딩 스플래시 화면 */}
      {showSplash && (
        <div 
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-700 ease-out pointer-events-auto"
          style={{ opacity: isInitializing ? 1 : 0 }}
        >
          <div className="flex flex-col items-center gap-6 max-w-md text-center px-6 animate-in fade-in zoom-in-95 duration-500">
            {/* 시각적 브랜드 링 심볼 */}
            <div className="relative flex items-center justify-center w-24 h-24">
              {/* 바깥 회전 링 */}
              <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/10 border-t-indigo-500 animate-spin duration-1000"></div>
              {/* 안쪽 역회전 링 */}
              <div className="absolute w-16 h-16 rounded-full border-[2.5px] border-emerald-500/10 border-b-emerald-500 animate-spin duration-700 reverse"></div>
              {/* 중앙 로고 빛 */}
              <div className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-lg shadow-indigo-500/50 flex items-center justify-center animate-pulse">
                <Sparkles size={14} className="text-white" />
              </div>
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              <h1 className="text-xl font-black text-white tracking-wider uppercase">
                VITAL Work & Wealth
              </h1>
              <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase">
                Architecture Initialization
              </p>
              <div className="h-px bg-slate-800 my-1 w-full max-w-[200px] mx-auto"></div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[280px] mx-auto">
                종단간 암호화(E2EE) 환경 내 예산 정산 및 시그널 노드 동기화를 가동하고 있습니다. 잠시만 기다려 주십시오.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
