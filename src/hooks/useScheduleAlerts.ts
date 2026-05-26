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

function getUrgency(dt: Date, now: Date): ScheduleAlert['urgency'] | null {
  const diffMs = dt.getTime() - now.getTime();
  const diffMin = diffMs / 60000;

  // 이미 지난 일정 (모두 지남으로 표시)
  if (diffMin < 0) return 'overdue';

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // 현재 진행 중 (±30분)
  if (diffMin >= 0 && diffMin <= 30) return 'now';
  if (dt <= todayEnd) return 'today';
  if (dt <= tomorrowEnd) return 'tomorrow';
  if (dt <= weekEnd) return 'this-week';
  return null;
}

export function useScheduleAlerts(
  tasks: Task[],
  meetings: Meeting[]
): ScheduleAlert[] {
  return useMemo(() => {
    const now = new Date();
    const alerts: ScheduleAlert[] = [];

    // 1. Tasks (마감일 있는 미완료 업무)
    for (const t of tasks) {
      if (!t.dueDate || t.status === 'done') continue;
      const dt = new Date(t.dueDate + 'T09:00:00');
      const urgency = getUrgency(dt, now);
      if (!urgency) continue;
      alerts.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        datetime: dt,
        urgency,
        icon: '📋',
      });
    }

    // 2. Meetings
    for (const m of meetings) {
      const dt = new Date(m.datetime);
      if (isNaN(dt.getTime())) continue;
      const urgency = getUrgency(dt, now);
      if (!urgency) continue;
      alerts.push({
        id: `meet-${m.id}`,
        type: 'meeting',
        title: m.title,
        datetime: dt,
        location: m.location,
        urgency,
        icon: '🤝',
      });
    }

    // 긴급도 순 → 시간 순 정렬
    const urgencyOrder: Record<string, number> = { overdue: 0, now: 1, today: 2, tomorrow: 3, 'this-week': 4 };
    alerts.sort((a, b) => {
      const uo = (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9);
      if (uo !== 0) return uo;
      return a.datetime.getTime() - b.datetime.getTime();
    });

    return alerts;
  }, [tasks, meetings]);
}
