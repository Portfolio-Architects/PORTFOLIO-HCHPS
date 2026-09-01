"use client";

import React, { useState, useMemo } from 'react';
import { Check, Share2 } from 'lucide-react';
import { useYangjaeFestival, YANGJAE_FALLBACK_DATA } from '@/hooks/useYangjaeFestival';

// Universal Robust Clipboard Copy (Works on all mobile/desktop browsers)
function copyToClipboardSafe(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  // 1. Try modern navigator.clipboard
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }

  // 2. Fallback for non-secure HTTP / Webview / Kakao In-app
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export default function YangjaeFestivalDashboard() {
  const { data = YANGJAE_FALLBACK_DATA } = useYangjaeFestival();
  const [selectedTab, setSelectedTab] = useState<'roadmap' | 'booths' | 'departments'>('roadmap');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLargeFont, setIsLargeFont] = useState<boolean>(false);

  // Derived D-Day calculation
  const daysLeft = useMemo(() => {
    const target = new Date("2026-10-31T09:00:00");
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, []);

  const PUBLIC_SHARE_URL = "https://hour-ordered-foreign-oops.trycloudflare.com/festival/yangjae";

  const handleCopySummary = async () => {
    const currentWeek = data.weeklyRoadmap.find((w) => w.status === 'in-progress') || data.weeklyRoadmap[1];
    const doneTasks = currentWeek?.details.map((d) => ` - ${d}`).join('\n') || '';

    const targetUrl = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
      ? `${window.location.origin}/festival/yangjae`
      : PUBLIC_SHARE_URL;

    const text = `[2026 양재천 건강 페스티벌 | D-${daysLeft} 주간 진행보고]

■ 건강도시 강남! 2026 양재천 걷자! 건강 페스티벌 추진 현황을 공유합니다.

■ 행사개요
 - 행 사 명: ${data.meta.title}
 - 일    시: ${data.meta.eventDate} (${data.meta.eventTime})
 - 장    소: ${data.meta.location}
 - 코    스: ${data.meta.course}
 - 참    여: ${data.meta.targetAudience}

■ 행사구성
 ❍ 강남구보건소와 함께하는 건강 걷기 체험 프로그램
 ❍ 보건 사업 및 민간 건강 관련 체험·홍보 : 20~30개 부스

1. 8월 추진실적 (사전답사 1~4차 및 실무회의 5차 완료)
 - 1~4차 현장 사전답사 및 대행사(제이민) 미팅 (수변문화쉼터 코스 확정)
 - 5차 실무회의(8.31.): 세부 운영안 및 현안 협의 완료
 - 치수과 하천점용허가 승인 완료

2. 이번 주 추진현황 (${currentWeek?.period})
${doneTasks}

3. 부스 확정 현황: 총 ${data.booths.length}개 부스 중 ${data.booths.filter(b => b.status === '확정').length}개 확정
 - 민간 전문 4대 기관 (고대척추 X-Ray 버스, 자생한방, 차병원, 유디치과)
 - 민간 헬스케어 (한국신체정보, 서울체력장, 케이스튜디오)
 - 보건소 특화 13개 테마 부스 (정신건강, 치매, CPR, 감염병 등)

※ [실시간 모바일 관제판 바로가기]
${targetUrl}`;

    await copyToClipboardSafe(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);

    if (typeof navigator !== 'undefined' && navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: '2026 양재천 건강 페스티벌 주간 관제판',
          text: text,
          url: targetUrl,
        });
      } catch {
        // Fallback already copied to clipboard
      }
    }
  };

  const categories = ['전체', '전문 의료·검진', '민간 헬스케어', '보건소 특화', '첨단 로봇', '구정 연계'];
  const filteredBooths = selectedCategory === '전체' 
    ? data.booths 
    : data.booths.filter(b => b.category.includes(selectedCategory));

  return (
    <div className="w-full flex justify-center selection:bg-slate-800 selection:text-white pb-16 relative">
      {/* Floating Copy Success Toast Modal */}
      {copied && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700">
          <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
          <div>
            <div className="font-bold text-sm">단톡방 공유 문구가 복사되었습니다!</div>
            <div className="text-xs text-slate-300">카카오톡 단톡방에 붙여넣기(Ctrl+V) 하세요.</div>
          </div>
        </div>
      )}

      {/* Mobile-Fixed Container (Clean Public Admin Report Style) */}
      <div 
        className="w-full max-w-md bg-white sm:rounded-2xl sm:border-2 sm:border-slate-300 sm:shadow-lg overflow-hidden flex flex-col min-h-screen text-slate-900 font-sans transition-all"
        style={{ fontSize: isLargeFont ? '17px' : '13.5px' }}
      >
        
        {/* Top Sticky Header (Clean Public Organization Look) */}
        <div className="sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2 border-b border-slate-800 shadow-sm">
          <div>
            <div className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-medium text-slate-300`}>강남구보건소 보건행정과</div>
            <div className={`${isLargeFont ? 'text-base' : 'text-sm'} font-bold tracking-tight`}>2026 양재천 건강 페스티벌</div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Big Font Toggle Button */}
            <button
              onClick={() => setIsLargeFont(!isLargeFont)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                isLargeFont 
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black ring-2 ring-amber-300/60 scale-105' 
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title="글자 크기 확대"
            >
              <span className="font-black">가+</span>
              <span>{isLargeFont ? '보통' : '큰글씨'}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>공유</span>
            </button>
          </div>
        </div>

        {/* Content Container (Official Administrative Report Format) */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-50/50">
          
          {/* Section 1: Overview Box (공공기관 공문서 서식) */}
          <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-slate-800">
              <h2 className={`${isLargeFont ? 'text-lg' : 'text-base'} font-extrabold text-slate-900 flex items-center gap-1.5`}>
                <span className="text-slate-800 font-black">󰏚</span> 행사 추진 개요
              </h2>
              <span className={`${isLargeFont ? 'text-sm px-3 py-1' : 'text-xs px-2.5 py-1'} font-black bg-slate-900 text-white rounded-md font-mono`}>
                D-{daysLeft}
              </span>
            </div>

            <div className="space-y-2 text-slate-800">
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 행사명</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                <span className="font-extrabold text-slate-900 leading-snug break-keep">{data.meta.title}</span>
              </div>
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 일&nbsp;&nbsp;&nbsp;&nbsp;시</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                <span className="font-semibold text-slate-800">{data.meta.eventDate} ({data.meta.eventTime})</span>
              </div>
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 장&nbsp;&nbsp;&nbsp;&nbsp;소</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                <span className="font-semibold text-slate-800 leading-snug break-keep">{data.meta.location}</span>
              </div>
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 코&nbsp;&nbsp;&nbsp;&nbsp;스</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                <span className="font-semibold text-slate-800">{data.meta.course}</span>
              </div>
              <div className={`grid ${isLargeFont ? 'grid-cols-[68px_10px_1fr] text-sm' : 'grid-cols-[58px_8px_1fr] text-xs'} items-baseline gap-1`}>
                <span className="font-bold text-slate-600 tracking-wider">• 참&nbsp;&nbsp;&nbsp;&nbsp;여</span>
                <span className="font-bold text-slate-400 text-center">:</span>
                <span className="font-semibold text-slate-800">{data.meta.targetAudience}</span>
              </div>

              {/* Administrative Program Structure Box (▢ 구 성) */}
              <div className="pt-2.5 mt-2.5 border-t-2 border-slate-200">
                <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-extrabold text-slate-900 mb-1.5 flex items-center gap-1.5`}>
                  <span className="text-slate-800 font-bold">▢</span>
                  <span>구&nbsp;&nbsp;&nbsp;&nbsp;성</span>
                </div>
                <div className="space-y-1.5 pl-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-800 flex items-start gap-1.5 leading-relaxed`}>
                    <span className="text-slate-700 font-bold shrink-0">❍</span>
                    <span className="font-semibold text-slate-900">강남구보건소와 함께하는 건강 걷기 체험 프로그램</span>
                  </div>
                  <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-800 flex items-start gap-1.5 leading-relaxed`}>
                    <span className="text-slate-700 font-bold shrink-0">❍</span>
                    <span className="font-semibold text-slate-900">보건 사업 및 민간 건강 관련 체험·홍보 : 20~30개 부스</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Tab Navigation (Simple Public Report Tabs - 3 Cols) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-200 p-1 rounded-lg border border-slate-300">
            {[
              { id: 'roadmap', label: '1. 추진일정' },
              { id: 'booths', label: '2. 부스현황' },
              { id: 'departments', label: '3. 협조부서' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as 'roadmap' | 'booths' | 'departments')}
                className={`${isLargeFont ? 'py-2.5 text-sm font-black' : 'py-2 text-xs font-bold'} rounded-md transition-all cursor-pointer text-center ${
                  selectedTab === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-300/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: 주차별 추진 로드맵 */}
          {selectedTab === 'roadmap' && (
            <div className="space-y-3">
              <div className="px-1">
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-bold text-slate-900 flex items-center gap-1.5`}>
                  <span>▢</span> 주차별 세부 추진계획
                </h3>
              </div>

              {data.weeklyRoadmap.map((item) => (
                <div 
                  key={item.week}
                  className={`p-3.5 rounded-lg border-2 transition-all ${
                    item.status === 'in-progress'
                      ? 'bg-amber-50/70 border-amber-400 shadow-xs ring-1 ring-amber-300'
                      : item.status === 'done'
                      ? 'bg-white border-slate-300'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className={`font-black ${isLargeFont ? 'text-sm px-2 py-0.5' : 'text-xs px-1.5 py-0.5'} bg-slate-900 text-white rounded`}>
                        {item.label || `${item.week}주차`}
                      </span>
                      <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-bold text-slate-700`}>{item.period}</span>
                    </div>

                    <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded border ${
                      item.status === 'done'
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : item.status === 'in-progress'
                        ? 'bg-amber-100 text-amber-900 border-amber-400 font-black'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {item.status === 'done' ? '✓ 완료' : item.status === 'in-progress' ? '▶ 진행중 (현재)' : '예정'}
                    </span>
                  </div>

                  <div className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 mb-2`}>
                    {item.title}
                  </div>

                  <ul className={`space-y-1.5 ${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-800 bg-slate-50 p-3 rounded border border-slate-200`}>
                    {item.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-slate-600 font-bold shrink-0">-</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: 부스 운영 현황 */}
          {selectedTab === 'booths' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-bold text-slate-900 flex items-center gap-1.5`}>
                  <span>▢</span> 테마별 부스 배치 계획
                </h3>
                <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-bold text-slate-700`}>
                  확정 {data.booths.filter(b => b.status === '확정').length} / 총 {data.booths.length}개
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`${isLargeFont ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'} rounded font-bold whitespace-nowrap border cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Booths Table Format */}
              <div className="space-y-2.5">
                {filteredBooths.map((booth) => (
                  <div 
                    key={booth.id}
                    className="p-3.5 bg-white border-2 border-slate-300 rounded-lg shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-mono font-bold text-slate-500`}>No.{booth.id}</span>
                        <span className={`${isLargeFont ? 'text-xs' : 'text-[11px]'} font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300`}>
                          {booth.category}
                        </span>
                      </div>
                      <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'} font-bold rounded border ${
                        booth.status === '확정'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {booth.status}
                      </span>
                    </div>

                    <div className={`${isLargeFont ? 'text-base' : 'text-sm'} font-extrabold text-slate-900 mb-1.5`}>
                      {booth.name}
                    </div>

                    <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed mb-1.5`}>
                      <span className="font-bold text-slate-600">내용: </span>{booth.program}
                    </div>

                    <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-600 font-medium flex justify-between`}>
                      <span>부스규모: <strong className="text-slate-900">{booth.scale}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: 협조 부서 */}
          {selectedTab === 'departments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className={`${isLargeFont ? 'text-base' : 'text-sm'} font-bold text-slate-900 flex items-center gap-1.5`}>
                  <span>▢</span> 구청 내 협조 부서 실무 현황
                </h3>
                <span className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-500 font-medium`}>총 {data.departmentsCooperation.length}개 부서</span>
              </div>

              <div className="space-y-2.5">
                {data.departmentsCooperation.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 bg-white border-2 border-slate-300 rounded-lg shadow-2xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} font-black text-slate-900`}>
                        • {item.dept}
                      </div>
                      <div className={`${isLargeFont ? 'text-sm' : 'text-xs'} text-slate-700 mt-1 leading-relaxed`}>
                        {item.task}
                      </div>
                    </div>

                    <span className={`${isLargeFont ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-1'} font-bold rounded border shrink-0 ${
                      item.status.includes('완료')
                        ? 'bg-slate-100 text-slate-800 border-slate-400 font-black'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
