'use client';

import React from 'react';
import { Card, CardContent } from './ui/card';
import { ProgressBar } from './ui/progress-bar';
import { ListTodo, CheckCircle2, Clock, AlertTriangle, Wallet, CalendarDays, FolderKanban } from 'lucide-react';
import { Task, Meeting, Project } from '@/types';

interface DashboardViewProps {
  tasks: Task[];
  taskStats: { total: number; todo: number; inProgress: number; done: number; overdue: number; completionRate: number };
  budgetStats: { totalBudget: number; totalSpent: number; remaining: number };
  meetings: Meeting[];
  projects: Project[];
  getProjectProgress: (id: string) => number;
  getUpcomingMeetings: (limit?: number) => Meeting[];
  onNavigate: (module: string) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function DashboardView({
  tasks, taskStats, budgetStats, meetings, projects, getProjectProgress, getUpcomingMeetings, onNavigate
}: DashboardViewProps) {
  const upcoming = getUpcomingMeetings(3);
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.dueDate?.startsWith(today) && t.status !== 'done');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">대시보드</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hover onClick={() => onNavigate('workspace')}>
          <CardContent className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[rgba(74,108,247,0.08)]">
              <ListTodo size={20} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-tertiary)]">전체 업무</div>
              <div className="text-xl font-bold">{taskStats.total}</div>
            </div>
          </CardContent>
        </Card>

        <Card hover onClick={() => onNavigate('workspace')}>
          <CardContent className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[rgba(16,185,129,0.08)]">
              <CheckCircle2 size={20} className="text-[var(--color-success)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-tertiary)]">완료</div>
              <div className="text-xl font-bold text-[var(--color-success)]">{taskStats.done}</div>
            </div>
          </CardContent>
        </Card>

        <Card hover onClick={() => onNavigate('workspace')}>
          <CardContent className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[rgba(245,158,11,0.08)]">
              <Clock size={20} className="text-[var(--color-warning)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-tertiary)]">진행중</div>
              <div className="text-xl font-bold text-[var(--color-warning)]">{taskStats.inProgress}</div>
            </div>
          </CardContent>
        </Card>

        <Card hover onClick={() => onNavigate('workspace')}>
          <CardContent className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[rgba(239,68,68,0.08)]">
              <AlertTriangle size={20} className="text-[var(--color-danger)]" />
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-tertiary)]">마감 초과</div>
              <div className="text-xl font-bold text-[var(--color-danger)]">{taskStats.overdue}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Tasks */}
        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <h3 className="font-semibold text-sm">📋 오늘의 업무</h3>
            <span className="text-xs text-[var(--color-text-tertiary)]">{todayTasks.length}개</span>
          </div>
          <CardContent>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">오늘 마감 업무가 없습니다 ✨</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${task.priority === 'high' ? 'bg-[var(--color-danger)]' : task.priority === 'medium' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'}`} />
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    <span className={`badge ${task.status === 'in-progress' ? 'status-in-progress' : 'status-todo'}`}>{task.status === 'in-progress' ? '진행중' : '대기'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Meetings */}
        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <h3 className="font-semibold text-sm">📅 예정된 미팅</h3>
            <button onClick={() => onNavigate('workspace')} className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer">전체보기</button>
          </div>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">예정된 미팅이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(m => (
                  <div key={m.id} className="flex items-start gap-3 py-2">
                    <CalendarDays size={16} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.title}</div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {formatDate(m.datetime)} {m.location && `· ${m.location}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Summary */}
        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <h3 className="font-semibold text-sm">💰 예산 현황</h3>
            <button onClick={() => onNavigate('workspace')} className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer">상세보기</button>
          </div>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">전체 예산</span>
                <span className="font-semibold">{formatNumber(budgetStats.totalBudget)}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">사용 금액</span>
                <span className="font-semibold text-[var(--color-primary)]">{formatNumber(budgetStats.totalSpent)}원</span>
              </div>
              <ProgressBar
                value={budgetStats.totalBudget > 0 ? (budgetStats.totalSpent / budgetStats.totalBudget) * 100 : 0}
                showLabel
              />
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">잔여</span>
                <span className={`font-semibold ${budgetStats.remaining < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                  {formatNumber(budgetStats.remaining)}원
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Progress */}
        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <h3 className="font-semibold text-sm">📊 프로젝트 진행률</h3>
            <button onClick={() => onNavigate('workspace')} className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer">전체보기</button>
          </div>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">등록된 프로젝트가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 4).map(project => {
                  const progress = getProjectProgress(project.id);
                  return (
                    <div key={project.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                          {project.name}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {project.checklistItems.filter(i => i.completed).length}/{project.checklistItems.length}
                        </span>
                      </div>
                      <ProgressBar value={progress} color={project.color} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Completion Rate */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)]">업무 완료율</div>
              <div className="text-3xl font-bold mt-1">{taskStats.completionRate}%</div>
            </div>
            <div className="w-full sm:w-48">
              <ProgressBar value={taskStats.completionRate} height={10} color="var(--color-success)" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
