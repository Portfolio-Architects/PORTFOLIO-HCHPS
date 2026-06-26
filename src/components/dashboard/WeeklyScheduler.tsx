'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useSchedules } from '@/hooks/useSchedules';
import { ScheduleType } from '@/types';
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, Shield, Users, BookOpen, FileText, Trash2, AlertCircle } from 'lucide-react';

// ============ Schedule Registration Form (Locally Isolated to prevent main grid lag) ============
const ScheduleForm = React.memo(({ 
  date, 
  setDate, 
  isRange, 
  setIsRange, 
  endDate, 
  setEndDate, 
  addSchedule 
}: {
  date: string;
  setDate: (date: string) => void;
  isRange: boolean;
  setIsRange: (val: boolean) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  addSchedule: (sched: any) => void;
}) => {
  const [title, setTitle] = useState('보안');
  const [type, setType] = useState<ScheduleType>('security');
  const [person, setPerson] = useState('오창선');
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('13:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (newVal: string) => {
    setDate(newVal);
    if (endDate < newVal) {
      setEndDate(newVal);
    }
  };

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutes = useMemo(() => ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'], []);

  const applyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('일정 제목을 입력해주세요.');
      return;
    }
    if (!person.trim()) {
      setError('담당자/참석자를 입력해주세요.');
      return;
    }
    if (startTime >= endTime) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    if (isRange && endDate && date > endDate) {
      setError('종료 날짜는 시작 날짜보다 빠를 수 없습니다.');
      return;
    }

    addSchedule({
      title: title.trim(),
      type,
      person: person.trim(),
      date,
      endDate: isRange ? endDate : undefined,
      startTime,
      endTime,
      notes: notes.trim()
    });

    setTitle('보안');
    setPerson('오창선');
    setNotes('');
    setIsRange(false);
    setEndDate(date);
  };

  return (
    <form onSubmit={handleSubmit} className="xl:col-span-3 flex flex-col gap-4 bg-slate-55/20 p-6 rounded-2xl border border-slate-200/40 backdrop-blur-xs max-h-[580px] overflow-y-auto">
      <span className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
        <Plus className="w-4 h-4 text-indigo-500" /> 새 일정 등록
      </span>

      {error && (
        <div className="flex items-center gap-2 text-xs font-bold bg-rose-500/10 text-rose-600 p-3 rounded-xl border border-rose-500/20">
          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">일정 분류</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(['security', 'meeting', 'education', 'other'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                type === t
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              {t === 'security' && '보안'}
              {t === 'meeting' && '업무 회의'}
              {t === 'education' && '직원 교육'}
              {t === 'other' && '기타 일정'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">일정명 (제목)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 4층 보안"
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 placeholder:font-semibold"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">담당자 / 참석자</label>
        <input
          type="text"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="담당 당번 혹은 회의 주최자"
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 placeholder:font-semibold"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">시작 날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          required
        />
      </div>

      <div className="flex items-center gap-2 mb-1 select-none">
        <input
          type="checkbox"
          id="isRangeCheck"
          checked={isRange}
          onChange={(e) => {
            setIsRange(e.target.checked);
            if (e.target.checked) {
              setEndDate(date);
            }
          }}
          className="w-4 h-4 rounded text-indigo-650 border-slate-300 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="isRangeCheck" className="text-xs font-bold text-slate-600 cursor-pointer">
          연속 일정으로 등록
        </label>
      </div>

      {isRange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500">종료 날짜</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={date}
            className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">퀵 시간 설정</label>
        <div className="flex flex-wrap gap-1.5 mb-1">
          <button
            type="button"
            onClick={() => applyPreset('11:30', '13:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '11:30' && endTime === '13:00'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            보안 (11:30~13:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('10:00', '11:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '10:00' && endTime === '11:00'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            회의 (10:00~11:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('14:00', '15:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '14:00' && endTime === '15:00'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            회의 (14:00~15:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('09:00', '18:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '09:00' && endTime === '18:00'
                ? 'bg-slate-600 border-slate-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            종일 (09:00~18:00)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500">시작 시간</label>
          <div className="flex gap-1.5">
            <select
              value={startTime.split(':')[0] || '11'}
              onChange={(e) => setStartTime(`${e.target.value}:${startTime.split(':')[1] || '30'}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select
              value={startTime.split(':')[1] || '30'}
              onChange={(e) => setStartTime(`${startTime.split(':')[0] || '11'}:${e.target.value}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500">종료 시간</label>
          <div className="flex gap-1.5">
            <select
              value={endTime.split(':')[0] || '13'}
              onChange={(e) => setEndTime(`${e.target.value}:${endTime.split(':')[1] || '00'}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select
              value={endTime.split(':')[1] || '00'}
              onChange={(e) => setEndTime(`${endTime.split(':')[0] || '13'}:${e.target.value}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">메모 / 특이사항</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="상세 위치, 안건 및 기타 중요 특이사항을 적어주세요."
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200/60 text-sm font-semibold text-slate-700 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 placeholder:font-semibold resize-none h-20"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98]"
      >
        스케줄 등록
      </button>
    </form>
  );
});
ScheduleForm.displayName = 'ScheduleForm';


// ============ Main Weekly Scheduler Component ============
export const WeeklyScheduler: React.FC = () => {
  const { schedules, loading, addSchedule, deleteSchedule } = useSchedules();

  // 기준 날짜 상태
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // 일정 등록을 위한 공유 상태
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 선택한 주의 월~일 날짜 배열 구하기
  const weekDays = useMemo(() => {
    const tempDate = new Date(currentDate);
    const day = tempDate.getDay(); 
    const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(tempDate.setDate(diff));

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [currentDate]);

  // 주의 첫째 날(월)과 마지막 날(일) 포맷팅된 텍스트
  const weekRangeText = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    return `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`;
  }, [weekDays]);

  // 주간 이동 핸들러
  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Pre-calculate/group schedules for each week day to avoid filtering inside the rendering loop
  const schedulesByDayMap = useMemo(() => {
    const map = new Map<string, typeof schedules>();
    for (const day of weekDays) {
      const dayStr = day.toISOString().split('T')[0];
      const filtered = schedules
        .filter((s) => {
          const sDate = s.date;
          const eDate = s.endDate || s.date;
          return dayStr >= sDate && dayStr <= eDate;
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      map.set(dayStr, filtered);
    }
    return map;
  }, [schedules, weekDays]);

  // 요일별 일정 필터링 (useMemo 맵에서 룩업하여 O(1) 수준으로 극적 향상)
  const getSchedulesForDay = useCallback((dayDate: Date) => {
    const dayStr = dayDate.toISOString().split('T')[0];
    return schedulesByDayMap.get(dayStr) || [];
  }, [schedulesByDayMap]);

  // 유형별 스타일 & 아이콘 헬퍼
  const getTypeConfig = (schedType: ScheduleType) => {
    switch (schedType) {
      case 'security':
        return {
          bg: 'bg-indigo-55/70 border-indigo-100 hover:border-indigo-200 text-indigo-700',
          badge: 'bg-indigo-100/80 text-indigo-800',
          icon: <Shield className="w-3.5 h-3.5" />
        };
      case 'meeting':
        return {
          bg: 'bg-emerald-55/70 border-emerald-100 hover:border-emerald-200 text-emerald-700',
          badge: 'bg-emerald-100/80 text-emerald-800',
          icon: <Users className="w-3.5 h-3.5" />
        };
      case 'education':
        return {
          bg: 'bg-amber-55/70 border-amber-100 hover:border-amber-200 text-amber-700',
          badge: 'bg-amber-100/85 text-amber-800',
          icon: <BookOpen className="w-3.5 h-3.5" />
        };
      case 'other':
      default:
        return {
          bg: 'bg-slate-55/70 border-slate-100 hover:border-slate-200 text-slate-700',
          badge: 'bg-slate-100 text-slate-800',
          icon: <Calendar className="w-3.5 h-3.5" />
        };
    }
  };

  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="glass-panel rounded-[2rem] p-8 shadow-2xs border border-white/20 transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl border border-indigo-500/15">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800 tracking-tight">통합 주간 일정 플래너</h4>
            <p className="text-xs font-semibold text-slate-450 mt-0.5">보안, 회의, 교육 등 주간 주요 일정을 한눈에 조율합니다.</p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3.5 py-1.5 bg-slate-100/60 hover:bg-slate-200/60 border border-slate-200/40 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer hover:shadow-2xs active:scale-[0.97]"
          >
            오늘
          </button>
          <div className="flex items-center bg-slate-100/50 border border-slate-200/30 rounded-xl p-1 shrink-0">
            <button
              onClick={handlePrevWeek}
              className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-3 min-w-[210px] text-center">
              {weekRangeText}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Form Container (Locally isolated ScheduleForm component to eliminate typing input latency) */}
        <ScheduleForm 
          date={date}
          setDate={setDate}
          isRange={isRange}
          setIsRange={setIsRange}
          endDate={endDate}
          setEndDate={setEndDate}
          addSchedule={addSchedule}
        />

        {/* Weekly Grid View (right side / col-span-9) */}
        <div className="xl:col-span-9 flex flex-col min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
              <p className="text-xs font-bold">스케줄 정보를 불러오고 있습니다...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 h-full min-h-[500px]">
              {weekDays.map((day, idx) => {
                const daySchedules = getSchedulesForDay(day);
                const isToday = new Date().toDateString() === day.toDateString();
                const dayNum = day.getDate();

                return (
                  <div
                    key={idx}
                    className={`flex flex-col bg-white/30 border border-slate-200/40 rounded-2xl p-3 h-full min-h-[200px] md:min-h-[480px] transition-all hover:bg-white/60 hover:shadow-2xs ${
                      isToday ? 'bg-indigo-50/10 border-indigo-300/50 shadow-xs ring-1 ring-indigo-500/5' : ''
                    }`}
                  >
                    {/* Day Column Header */}
                    <div 
                      onClick={() => setDate(day.toISOString().split('T')[0])}
                      className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/40 cursor-pointer hover:bg-slate-100/50 p-1 rounded-lg transition-all select-none"
                      title={`${dayNum}일로 일정 등록 날짜 지정`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[12px] font-bold ${
                          idx === 5 ? 'text-blue-500' : idx === 6 ? 'text-red-500' : 'text-slate-500'
                        }`}>
                          {dayNames[idx]}
                        </span>
                        <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-800'
                        }`}>
                          {dayNum}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-450 bg-slate-200/40 px-1.5 py-0.5 rounded-full shrink-0">
                        {daySchedules.length}건
                      </span>
                    </div>

                    {/* Column Body: Schedules */}
                    <div className="flex flex-col gap-2 overflow-y-auto flex-1 max-h-[360px] md:max-h-none scrollbar-none">
                      {daySchedules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-8 text-slate-350 italic text-[11px] font-semibold">
                          일정 없음
                        </div>
                      ) : (
                        daySchedules.map((schedule) => {
                          const config = getTypeConfig(schedule.type);

                          return (
                            <div
                              key={schedule.id}
                              className={`group relative flex flex-col p-2.5 border rounded-xl transition-all duration-200 hover:shadow-xs ${config.bg}`}
                            >
                              {/* Title & Type Icon */}
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="text-xs font-bold text-slate-800 tracking-tight leading-tight line-clamp-2 pr-4">
                                  {schedule.title}
                                </span>
                                <div className="shrink-0 text-slate-550">
                                  {config.icon}
                                </div>
                              </div>

                              {schedule.endDate && schedule.endDate !== schedule.date && (
                                <span className="text-[9px] font-bold text-slate-500 bg-white/80 border border-slate-200/50 px-1.5 py-0.5 rounded-md mt-1.5 self-start select-none">
                                  기간: {schedule.date.slice(5)} ~ {schedule.endDate.slice(5)}
                                </span>
                              )}

                              {/* Time & Person */}
                              <div className="flex items-center justify-between gap-2 mt-2">
                                <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                  {schedule.startTime}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[55px] text-right bg-white/60">
                                  {schedule.person}
                                </span>
                              </div>

                              {/* Notes tooltip (hover check) */}
                              {schedule.notes && (
                                <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-0.5 mt-1 border-t border-slate-200/40 pt-1">
                                  <FileText className="w-2.5 h-2.5 shrink-0 text-slate-450" />
                                  <span className="truncate max-w-[80px]" title={schedule.notes}>
                                    {schedule.notes}
                                  </span>
                                </p>
                              )}

                              {/* Trash/Delete Action */}
                              <button
                                onClick={() => {
                                  if (confirm(`'${schedule.title}' 일정을 삭제하시겠습니까?`)) {
                                    deleteSchedule(schedule.id);
                                  }
                                }}
                                className="absolute top-1 right-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
