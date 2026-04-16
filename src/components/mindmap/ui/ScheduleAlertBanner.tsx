'use client';

import React, { useState } from 'react';
import { ScheduleAlert } from '@/hooks/useScheduleAlerts';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { Bell, BellOff, BellRing, ChevronDown, ChevronUp } from 'lucide-react';

interface ScheduleAlertBannerProps {
  alerts: ScheduleAlert[];
  notificationPermission?: NotificationPermission;
  onRequestPermission?: () => Promise<NotificationPermission | string>;
  appEnabled?: boolean;
  onToggleAppEnabled?: () => void;
  mergedEntries?: any[];
}

const URGENCY_STYLE: Record<string, { bg: string; text: string; badge: string; label: string }> = {
  overdue:     { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',    badge: 'bg-red-500 text-white',       label: '지남' },
  now:         { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-500 text-white',     label: '진행중' },
  today:       { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-500 text-white',      label: '오늘' },
  tomorrow:    { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-600', badge: 'bg-indigo-400 text-white',  label: '내일' },
  'this-week': { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600',  badge: 'bg-slate-400 text-white',     label: '이번주' },
};

function formatTime(dt: Date): string {
  return dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateShort(dt: Date): string {
  const now = new Date();
  const isToday = dt.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = dt.toDateString() === tomorrow.toDateString();

  if (isToday) return formatTime(dt);
  if (isTomorrow) return `내일 ${formatTime(dt)}`;
  return `${dt.getMonth() + 1}/${dt.getDate()} ${formatTime(dt)}`;
}

export function ScheduleAlertBanner({ alerts, notificationPermission, onRequestPermission, appEnabled = true, onToggleAppEnabled, mergedEntries = [] }: ScheduleAlertBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const { overrides, customNodes } = useGraphCustomization();

  const nodeAlerts = React.useMemo(() => {
    const result: ScheduleAlert[] = [];
    const now = new Date();
    
    for (const [nodeId, override] of Object.entries(overrides)) {
      if (!override.dueDate || override.isCompleted) continue;
      
      const dt = new Date(override.dueDate + 'T09:00:00');
      if (isNaN(dt.getTime())) continue;

      const diffMs = dt.getTime() - now.getTime();
      const diffMin = diffMs / 60000;
      let urgency: ScheduleAlert['urgency'] | null = null;

      if (diffMin < 0) urgency = 'overdue';
      else if (diffMin <= 30) urgency = 'now';
      else {
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        const weekEnd = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 6);
        if (dt <= todayEnd) urgency = 'today';
        else if (dt <= tomorrowEnd) urgency = 'tomorrow';
        else if (dt <= weekEnd) urgency = 'this-week';
      }

      if (!urgency) continue;

      let label = override.customLabel;
      if (!label) label = customNodes.find(n => n.id === nodeId)?.label;
      if (!label && mergedEntries) label = mergedEntries.find(e => e.id === nodeId)?.text || '이름 없는 노드';
      
      result.push({
        id: `node-${nodeId}`,
        type: 'task',
        title: label || '일정 노드',
        datetime: dt,
        urgency,
        icon: '📌',
      });
    }
    return result;
  }, [overrides, customNodes, mergedEntries]);

  const allAlerts = React.useMemo(() => {
    const combined = [...alerts, ...nodeAlerts];
    const uOrder: Record<string, number> = { overdue: 0, now: 1, today: 2, tomorrow: 3, 'this-week': 4 };
    return combined.sort((a, b) => {
      const u1 = uOrder[a.urgency] ?? 9;
      const u2 = uOrder[b.urgency] ?? 9;
      if (u1 !== u2) return u1 - u2;
      return a.datetime.getTime() - b.datetime.getTime();
    });
  }, [alerts, nodeAlerts]);

  const isNotifGranted = notificationPermission === 'granted';
  const isNotifDenied = notificationPermission === 'denied';

  if (allAlerts.length === 0) {
      return (
        <div className="mt-3">
          <div className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 min-w-0 text-slate-500">
              <Bell size={14} className="shrink-0" />
              <span className="text-xs">현재 임박한 일정이 없습니다.</span>
            </div>
            {onRequestPermission && (
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 animate-pulse ml-2 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestPermission();
                }}
              >
                <BellOff size={10} /> 알림 허용
              </button>
            )}
          </div>
        </div>
      );
    }
    return null;

  const urgent = allAlerts.filter(a => a.urgency === 'overdue' || a.urgency === 'now' || a.urgency === 'today');
  const upcoming = allAlerts.filter(a => a.urgency === 'tomorrow' || a.urgency === 'this-week');

  // 접힌 상태에서는 최대 3개만 표시
  const visibleAlerts = expanded ? allAlerts : allAlerts.slice(0, 3);
  const hasMore = allAlerts.length > 3;

  return (
    <div className="mt-3">
      {/* Summary Bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer select-none"
        onClick={() => hasMore && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bell size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700 truncate">
            일정 알림
          </span>
          {urgent.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold leading-none shrink-0">
              {urgent.length}
            </span>
          )}
          {upcoming.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-300 text-slate-700 font-bold leading-none shrink-0">
              +{upcoming.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* 알림 권한 토글 버튼 */}
          {(onRequestPermission || onToggleAppEnabled) && !isNotifDenied && (
            <button
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                appEnabled && isNotifGranted
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 animate-pulse'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isNotifGranted && onRequestPermission) {
                  onRequestPermission();
                } else if (onToggleAppEnabled) {
                  onToggleAppEnabled();
                }
              }}
              title={appEnabled && isNotifGranted ? '푸시 알림 켜짐 (클릭 시 앱 알림 끄기)' : !isNotifGranted ? '클릭하여 푸시 알림 허용' : '푸시 알림 꺼짐 (클릭 시 켜기)'}
            >
              {appEnabled && isNotifGranted ? (
                <><BellRing size={10} /> 알림 ON</>
              ) : !isNotifGranted ? (
                <><BellOff size={10} /> 알림 허용</>
              ) : (
                <><BellOff size={10} /> 알림 OFF</>
              )}
            </button>
          )}
          {isNotifDenied && (
            <span className="text-[10px] text-slate-400 px-1.5">
              알림 차단됨
            </span>
          )}
          {hasMore && (
            <button className="text-slate-400 shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Alert Items */}
      <div className="mt-1.5 space-y-1">
        {visibleAlerts.map(alert => {
          const style = URGENCY_STYLE[alert.urgency] || URGENCY_STYLE['today'];
          return (
            <div
              key={alert.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${style.bg}`}
            >
              <span className="shrink-0">{alert.icon}</span>
              <span className={`font-semibold truncate flex-1 ${style.text}`}>
                {alert.title}
              </span>
              {alert.location && (
                <span className="text-[10px] text-slate-400 truncate max-w-[80px] hidden sm:inline">
                  📍{alert.location}
                </span>
              )}
              <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                {formatDateShort(alert.datetime)}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 leading-none ${style.badge}`}>
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
