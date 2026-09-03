'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export function SplashView() {
  return (
    <div 
      className="relative w-full min-h-screen bg-slate-950 flex flex-col items-center justify-center pointer-events-none select-none"
      suppressHydrationWarning
    >
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6 animate-in fade-in zoom-in-95 duration-400">
        <div className="relative flex items-center justify-center w-24 h-24">
          <div className="absolute inset-0 rounded-full border-[3px] border-indigo-500/20 border-t-indigo-500 animate-spin duration-1000"></div>
          <div className="absolute w-16 h-16 rounded-full border-[2.5px] border-emerald-500/20 border-b-emerald-500 animate-spin duration-700 reverse"></div>
          <div className="absolute w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-lg shadow-indigo-500/50 flex items-center justify-center animate-pulse">
            <Sparkles size={14} className="text-white" />
          </div>
        </div>
        
        <div className="flex flex-col gap-2 mt-2">
          <h1 className="text-xl font-black text-white tracking-wider uppercase">
            VITAL Work & Wealth
          </h1>
          <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase">
            Architecture Ready
          </p>
          <div className="h-px bg-slate-800 my-1 w-full max-w-[200px] mx-auto"></div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[280px] mx-auto">
            로컬 단일 진실 공급원(SSOT) 및 지능형 워크스페이스를 연결하고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SplashView;
