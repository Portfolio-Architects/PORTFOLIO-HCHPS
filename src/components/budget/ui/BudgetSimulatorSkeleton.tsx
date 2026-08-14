'use client';

import React from 'react';

export const BudgetSimulatorSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6 animate-pulse p-1 sm:p-2">
      {/* Header Title Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded-lg" />
            <div className="h-4 w-72 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-32 h-9 bg-slate-200 rounded-xl" />
          <div className="w-28 h-9 bg-slate-150 rounded-xl" />
        </div>
      </div>

      {/* Summary Cards Skeleton (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200/90 rounded-2xl p-5 h-32 flex flex-col justify-between shadow-xs"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="w-8 h-8 bg-slate-200 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-28 bg-slate-200 rounded-lg" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Input Form Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-5 w-44 bg-slate-200 rounded" />
              <div className="h-3 w-64 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="w-28 h-8 bg-slate-200 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 h-10 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-4 h-10 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-4 h-10 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-3 h-10 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-2 h-10 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-4 h-10 bg-slate-100 rounded-xl" />
          <div className="lg:col-span-3 h-10 bg-slate-100 rounded-xl" />
        </div>
      </div>

      {/* Result Table Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex gap-2">
            <div className="w-36 h-9 bg-slate-200 rounded-xl" />
            <div className="w-36 h-9 bg-slate-150 rounded-xl" />
          </div>
          <div className="w-48 h-9 bg-slate-200 rounded-xl" />
        </div>

        <div className="h-64 bg-slate-50 rounded-xl border border-slate-200" />
      </div>
    </div>
  );
};

export default BudgetSimulatorSkeleton;
