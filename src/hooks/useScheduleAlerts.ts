'use client';

import { useMemo } from 'react';
import { Task, Meeting } from '@/types';

export interface ScheduleAlert {
  id: string;
  type: 'task' | 'meeting';
  title: string;
  datetime: Date;
  location?: string;
  urgency: 'overdue' | 'now' | 'today' | 'tomorrow' | 'this-week';
  icon: string;
}

const URGENCY_RANK: Record<ScheduleAlert['urgency'], number> = {
  overdue: 0,
  now: 1,
  today: 2,
  tomorrow: 3,
  'this-week': 4,
};

function getUrgency(
  dtTime: number,
  nowTime: number,
  todayEndTime: number,
  tomorrowEndTime: number,
  weekEndTime: number
): ScheduleAlert['urgency'] | null {
  const diffMs = dtTime - nowTime;
  const diffMin = diffMs / 60000;

  // 이미 지난 일정 (모두 지남으로 표시)
  if (diffMin < 0) return 'overdue';

  // 현재 진행 중 (±30분)
  if (diffMin <= 30) return 'now';
  if (dtTime <= todayEndTime) return 'today';
  if (dtTime <= tomorrowEndTime) return 'tomorrow';
  if (dtTime <= weekEndTime) return 'this-week';
  return null;
}

function computeScheduleAlerts(tasks: Task[], meetings: Meeting[]): ScheduleAlert[] {
  const now = new Date();
  const nowTime = now.getTime();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndTime = todayEnd.getTime();
  const tomorrowEndTime = todayEndTime + 86400000;
  const weekEndTime = todayEndTime + 518400000; // 6 * 86400000

  const alerts: (ScheduleAlert & { _time: number; _rank: number })[] = [];

  // 1. Tasks (마감일 있는 미완료 업무)
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t.dueDate || t.status === 'done') continue;
    const dateStr = t.dueDate.includes('T') ? t.dueDate : `${t.dueDate}T09:00:00`;
    const dtTime = Date.parse(dateStr);
    if (!dtTime || isNaN(dtTime)) continue;
    const urgency = getUrgency(dtTime, nowTime, todayEndTime, tomorrowEndTime, weekEndTime);
    if (!urgency) continue;
    alerts.push({
      id: `task-${t.id}`,
      type: 'task',
      title: t.title,
      datetime: new Date(dtTime),
      urgency,
      icon: '📋',
      _time: dtTime,
      _rank: URGENCY_RANK[urgency] ?? 9,
    });
  }

  // 2. Meetings
  for (let i = 0; i < meetings.length; i++) {
    const m = meetings[i];
    if (!m.datetime) continue;
    const dtTime = Date.parse(m.datetime);
    if (!dtTime || isNaN(dtTime)) continue;
    const urgency = getUrgency(dtTime, nowTime, todayEndTime, tomorrowEndTime, weekEndTime);
    if (!urgency) continue;
    alerts.push({
      id: `meet-${m.id}`,
      type: 'meeting',
      title: m.title,
      datetime: new Date(dtTime),
      location: m.location,
      urgency,
      icon: '🤝',
      _time: dtTime,
      _rank: URGENCY_RANK[urgency] ?? 9,
    });
  }

  // 긴급도 순 → 시간 순 고속 O(1) 랭크 비교 정렬
  alerts.sort((a, b) => {
    const diff = a._rank - b._rank;
    return diff !== 0 ? diff : a._time - b._time;
  });

  return alerts;
}

export function useScheduleAlerts(
  tasks: Task[],
  meetings: Meeting[]
): ScheduleAlert[] {
  return useMemo(() => {
    return computeScheduleAlerts(tasks, meetings);
  }, [tasks, meetings]);
}


