'use client';

import React, { useState, useMemo } from 'react';
import { Task, Meeting, BudgetEntry } from '@/types';
import { Card } from './ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  meetings: Meeting[];
  budgetEntries: BudgetEntry[];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarView({ tasks, meetings, budgetEntries }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const dayEvents = useMemo(() => {
    const map: Record<number, { tasks: Task[]; meetings: Meeting[]; budget: BudgetEntry[] }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter(t => t.dueDate?.startsWith(dateStr));
      const dayMeetings = meetings.filter(m => m.datetime.startsWith(dateStr));
      const dayBudget = budgetEntries.filter(e => e.date.startsWith(dateStr));
      if (dayTasks.length || dayMeetings.length || dayBudget.length) {
        map[d] = { tasks: dayTasks, meetings: dayMeetings, budget: dayBudget };
      }
    }
    return map;
  }, [year, month, daysInMonth, tasks, meetings, budgetEntries]);

  const todayDate = new Date();
  const isToday = (d: number) => todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === d;
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">캘린더</h2>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-sm font-semibold min-w-[120px] text-center">{year}년 {month + 1}월</span>
          <button onClick={next} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"><ChevronRight size={18} /></button>
          <button onClick={today} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium hover:bg-gray-200 cursor-pointer transition-colors ml-2">오늘</button>
        </div>
      </div>

      <Card>
        <div className="p-2 sm:p-4 overflow-x-auto no-scrollbar">
          <div className="min-w-[500px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map((d, i) => (
                <div key={d} className={`text-center text-xs font-semibold py-2 ${i === 0 ? 'text-[var(--color-danger)]' : i === 6 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'}`}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="p-1.5 sm:p-2 min-h-[60px] sm:min-h-[80px]" />;
                const events = dayEvents[day];
                const dayOfWeek = (firstDay + day - 1) % 7;
                return (
                  <div key={day} className={`p-1.5 sm:p-2 min-h-[60px] sm:min-h-[80px] rounded-lg calendar-cell ${isToday(day) ? 'bg-[rgba(74,108,247,0.06)] ring-1 ring-[var(--color-primary)]' : ''}`}>
                    <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-[var(--color-primary)] font-bold' : dayOfWeek === 0 ? 'text-[var(--color-danger)]' : dayOfWeek === 6 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                      {day}
                    </div>
                    {events && (
                      <div className="space-y-0.5">
                        {events.tasks.slice(0, 2).map(t => {
                          const time = t.dueDate?.includes('T') ? t.dueDate.split('T')[1]?.slice(0, 5) : null;
                          return (
                            <div key={t.id} className="text-[9px] px-1 py-0.5 rounded bg-[rgba(74,108,247,0.1)] text-[var(--color-primary)] truncate">
                              {time && <span className="font-semibold">{time} </span>}{t.title}
                            </div>
                          );
                        })}
                        {events.meetings.slice(0, 2).map(m => {
                          const time = m.datetime.includes('T') ? m.datetime.split('T')[1]?.slice(0, 5) : null;
                          return (
                            <div key={m.id} className="text-[9px] px-1 py-0.5 rounded bg-[rgba(16,185,129,0.1)] text-[var(--color-success)] truncate">
                              📅 {time && <span className="font-semibold">{time} </span>}{m.title}
                            </div>
                          );
                        })}
                        {events.budget.slice(0, 1).map(b => (
                          <div key={b.id} className="text-[9px] px-1 py-0.5 rounded bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)] truncate">💰 {b.purpose}</div>
                        ))}
                        {(events.tasks.length + events.meetings.length + events.budget.length > 3) && (
                          <div className="text-[9px] text-[var(--color-text-tertiary)] text-center">+{events.tasks.length + events.meetings.length + events.budget.length - 3}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
