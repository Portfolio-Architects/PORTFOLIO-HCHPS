'use client';

import React from 'react';
import dynamic from 'next/dynamic';

function YangjaeFestivalSkeleton() {
  return (
    <div className="yangjae-dashboard-container w-full max-w-md bg-white sm:rounded-2xl sm:border-2 sm:shadow-lg overflow-hidden flex flex-col min-h-screen text-slate-900 font-sans sm:border-slate-300 p-4 space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="h-12 bg-slate-900 rounded-xl flex items-center justify-between px-4">
        <div className="h-5 bg-slate-700 rounded w-48"></div>
        <div className="h-7 bg-slate-800 rounded-lg w-16"></div>
      </div>
      {/* Overview Skeleton */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
        <div className="h-4 bg-slate-100 rounded w-full"></div>
        <div className="h-4 bg-slate-100 rounded w-5/6"></div>
        <div className="h-4 bg-slate-100 rounded w-4/6"></div>
      </div>
      {/* Tabs Skeleton */}
      <div className="flex gap-2">
        <div className="h-10 bg-slate-200 rounded-lg flex-1"></div>
        <div className="h-10 bg-slate-100 rounded-lg flex-1"></div>
      </div>
      {/* Task Cards Skeleton */}
      <div className="space-y-3">
        <div className="h-16 bg-slate-100 border border-slate-200 rounded-xl"></div>
        <div className="h-16 bg-slate-100 border border-slate-200 rounded-xl"></div>
        <div className="h-16 bg-slate-100 border border-slate-200 rounded-xl"></div>
      </div>
    </div>
  );
}

const DynamicDashboard = dynamic(
  () => import('@/components/festival/YangjaeFestivalDashboard'),
  {
    ssr: false,
    loading: () => <YangjaeFestivalSkeleton />,
  }
);

export default function YangjaeFestivalClientWrapper() {
  return <DynamicDashboard />;
}
