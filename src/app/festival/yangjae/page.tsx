import React from 'react';
import { Metadata, Viewport } from 'next';
import YangjaeFestivalClientWrapper from '@/components/festival/YangjaeFestivalClientWrapper';

export const metadata: Metadata = {
  title: '2026 양재천 건강 페스티벌 주간 관제판 | 강남구보건소',
  description: '『강남구보건소』와 함께하는 2026 양재천 걷자! 건강 페스티벌 실시간 진행현황 대시보드',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function YangjaeFestivalPage() {
  return (
    <div className="min-h-screen bg-slate-100/70 sm:py-8 sm:px-4 flex justify-center items-start">
      <YangjaeFestivalClientWrapper />
    </div>
  );
}

