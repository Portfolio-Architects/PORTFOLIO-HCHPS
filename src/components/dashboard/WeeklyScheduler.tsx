'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useSchedules } from '@/hooks/useSchedules';
import { ScheduleType, Schedule } from '@/types';
import { 
  Calendar, ChevronLeft, ChevronRight, Clock, Plus, Shield, 
  Users, BookOpen, FileText, Trash2, AlertCircle, X, Edit3, Grid, LayoutGrid
} from 'lucide-react';

// ============ Time Helper Utilities ============
const formatDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// ============ Schedule Direct Creation / Edit Modal ============
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule?: Schedule | null;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  onSaveAdd: (data: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSaveUpdate: (id: string, updates: Partial<Schedule>) => void;
  onDeleteSchedule: (id: string) => void;
}

function ScheduleModal({
  isOpen,
  onClose,
  schedule,
  initialDate,
  initialStartTime,
  initialEndTime,
  onSaveAdd,
  onSaveUpdate,
  onDeleteSchedule
}: ScheduleModalProps) {
  const isEditing = Boolean(schedule);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ScheduleType>('meeting');
  const [person, setPerson] = useState('담당자');
  const [date, setDate] = useState('');
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    if (schedule) {
      setTitle(schedule.title);
      setType(schedule.type);
      setPerson(schedule.person);
      setDate(schedule.date);
      setIsRange(Boolean(schedule.endDate && schedule.endDate !== schedule.date));
      setEndDate(schedule.endDate || schedule.date);
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setNotes(schedule.notes || '');
    } else {
      const today = formatDateStr(new Date());
      setTitle('신규 일정');
      setType('meeting');
      setPerson('담당자');
      setDate(initialDate || today);
      setIsRange(false);
      setEndDate(initialDate || today);
      setStartTime(initialStartTime || '10:00');
      setEndTime(initialEndTime || '11:00');
      setNotes('');
    }
    setError(null);
  }, [isOpen, schedule, initialDate, initialStartTime, initialEndTime]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    if (isEditing && schedule) {
      onSaveUpdate(schedule.id, {
        title: title.trim(),
        type,
        person: person.trim(),
        date,
        endDate: isRange ? endDate : undefined,
        startTime,
        endTime,
        notes: notes.trim()
      });
    } else {
      onSaveAdd({
        title: title.trim(),
        type,
        person: person.trim(),
        date,
        endDate: isRange ? endDate : undefined,
        startTime,
        endTime,
        notes: notes.trim()
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (schedule && confirm(`'${schedule.title}' 일정을 삭제하시겠습니까?`)) {
      onDeleteSchedule(schedule.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[500px] overflow-hidden flex flex-col p-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            {isEditing ? <Edit3 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
            <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
              {isEditing ? '일정 수정 및 상세' : '새 일정 직접 등록'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
          {/* 분류 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">일정 분류</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['security', 'meeting', 'education', 'other'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 px-1 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    type === t
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t === 'security' && '보안'}
                  {t === 'meeting' && '회의'}
                  {t === 'education' && '교육'}
                  {t === 'other' && '기타'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">일정 제목 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">담당자 / 참석자 *</label>
            <input
              type="text"
              required
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">시작 날짜</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">종료 날짜</label>
              <input
                type="date"
                value={isRange ? endDate : date}
                disabled={!isRange}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="modalRangeCheck"
              checked={isRange}
              onChange={(e) => {
                setIsRange(e.target.checked);
                if (e.target.checked) setEndDate(date);
              }}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <label htmlFor="modalRangeCheck" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              연속 일정으로 등록 (Range)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">시작 시간</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">종료 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">메모 / 특이사항</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="상세 내용을 적어주세요."
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="flex items-center justify-between mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors border-0 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> 삭제
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-0 cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors border-0 cursor-pointer"
              >
                {isEditing ? '수정 저장' : '일정 등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Schedule Registration Form (Sidebar Panel) ============
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
    <form onSubmit={handleSubmit} className="xl:col-span-3 flex flex-col gap-4 bg-slate-50/20 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/40 dark:border-slate-800 backdrop-blur-xs max-h-[580px] overflow-y-auto">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
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
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'
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
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">일정명 (제목)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 4층 보안"
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-650 placeholder:font-semibold"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">담당자 / 참석자</label>
        <input
          type="text"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="담당 당번 혹은 회의 주최자"
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-650 placeholder:font-semibold"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">시작 날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
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
          className="w-4 h-4 rounded text-indigo-650 border-slate-300 dark:border-slate-750 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="isRangeCheck" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
          연속 일정으로 등록
        </label>
      </div>

      {isRange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">종료 날짜</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={date}
            className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">퀵 시간 설정</label>
        <div className="flex flex-wrap gap-1.5 mb-1">
          <button
            type="button"
            onClick={() => applyPreset('11:30', '13:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '11:30' && endTime === '13:00'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            보안 (11:30~13:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('10:00', '11:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '10:00' && endTime === '11:00'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            회의 (10:00~11:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('14:00', '15:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '14:00' && endTime === '15:00'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            회의 (14:00~15:00)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('09:00', '18:00')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              startTime === '09:00' && endTime === '18:00'
                ? 'bg-slate-600 border-slate-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            종일 (09:00~18:00)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">시작 시간</label>
          <div className="flex gap-1.5">
            <select
              value={startTime.split(':')[0] || '11'}
              onChange={(e) => setStartTime(`${e.target.value}:${startTime.split(':')[1] || '30'}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select
              value={startTime.split(':')[1] || '30'}
              onChange={(e) => setStartTime(`${startTime.split(':')[0] || '11'}:${e.target.value}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">종료 시간</label>
          <div className="flex gap-1.5">
            <select
              value={endTime.split(':')[0] || '13'}
              onChange={(e) => setEndTime(`${e.target.value}:${endTime.split(':')[1] || '00'}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {hours.map(h => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select
              value={endTime.split(':')[1] || '00'}
              onChange={(e) => setEndTime(`${endTime.split(':')[0] || '13'}:${e.target.value}`)}
              className="w-1/2 px-3 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {minutes.map(m => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">메모 / 특이사항</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="상세 위치, 안건 및 기타 중요 특이사항을 적어주세요."
          className="w-full px-4.5 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-slate-950/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-650 placeholder:font-semibold resize-none h-20"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] cursor-pointer"
      >
        스케줄 등록
      </button>
    </form>
  );
});
ScheduleForm.displayName = 'ScheduleForm';

// ============ Schedule Item Component (With Drag & Drop & Direct Edit Click) ============
const ScheduleItem = React.memo(({ 
  schedule, 
  config, 
  onDelete,
  onEdit
}: { 
  schedule: Schedule; 
  config: { bg: string; badge: string; icon: React.ReactNode }; 
  onDelete: (id: string) => void;
  onEdit?: (schedule: Schedule) => void;
}) => {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`'${schedule.title}' 일정을 삭제하시겠습니까?`)) {
      onDelete(schedule.id);
    }
  }, [onDelete, schedule.id, schedule.title]);

  const handleDragStart = (e: React.DragEvent) => {
    const durationMins = Math.max(30, timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime));
    const payload = JSON.stringify({
      id: schedule.id,
      durationMins,
      startTime: schedule.startTime,
      endTime: schedule.endTime
    });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        if (onEdit) onEdit(schedule);
      }}
      className={`group relative flex flex-col p-2.5 border rounded-xl transition-all duration-200 hover:shadow-sm cursor-pointer select-none ${config.bg}`}
      title={`[클릭: 상세/수정 | 드래그: 일정 재배치]\n${schedule.title}\n담당: ${schedule.person}${schedule.notes ? `\n메모: ${schedule.notes}` : ''}`}
    >
      {/* Title & Type Icon */}
      <div className="flex items-start justify-between gap-1.5">
        <span 
          className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight leading-tight line-clamp-2 pr-4 cursor-pointer"
        >
          {schedule.title}
        </span>
        <div className="shrink-0 text-slate-500 dark:text-slate-400">
          {config.icon}
        </div>
      </div>

      {schedule.endDate && schedule.endDate !== schedule.date && (
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700 px-1.5 py-0.5 rounded-md mt-1.5 self-start select-none">
          기간: {schedule.date.slice(5)} ~ {schedule.endDate.slice(5)}
        </span>
      )}

      {/* Time & Person */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5 shrink-0 text-slate-450 dark:text-slate-500" />
          {schedule.startTime} ~ {schedule.endTime}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[65px] text-right bg-white/60 dark:bg-slate-800 dark:text-slate-300">
          {schedule.person}
        </span>
      </div>

      {schedule.notes && (
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 mt-1 border-t border-slate-200/40 dark:border-slate-800 pt-1">
          <FileText className="w-2.5 h-2.5 shrink-0 text-slate-450 dark:text-slate-500" />
          <span className="truncate max-w-[120px]">
            {schedule.notes}
          </span>
        </p>
      )}

      {/* Trash/Delete Action */}
      <button
        onClick={handleDelete}
        className="absolute top-1 right-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer border-0 bg-transparent"
        title="삭제"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
});
ScheduleItem.displayName = 'ScheduleItem';

// ============ Main Weekly Scheduler Component ============
const WeeklySchedulerComponent: React.FC = () => {
  const { schedules, loading, addSchedule, updateSchedule, deleteSchedule } = useSchedules();

  // View Mode: 'week' | 'month' | 'timetable'
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'timetable'>('week');

  // Date navigation state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Sidebar schedule form state
  const [date, setDate] = useState(() => formatDateStr(new Date()));
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState(() => formatDateStr(new Date()));

  // Modal direct creation/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>('');
  const [modalInitialStartTime, setModalInitialStartTime] = useState<string>('10:00');
  const [modalInitialEndTime, setModalInitialEndTime] = useState<string>('11:00');

  // 7-day week days (Mon~Sun) calculation
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

  // 42-day Month Calendar Grid calculation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstOfMonth.getDay();
    const offset = (dayOfWeek + 6) % 7; // Monday start
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - offset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Range texts
  const weekRangeText = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    return `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`;
  }, [weekDays]);

  const monthText = useMemo(() => {
    return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;
  }, [currentDate]);

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(currentDate.getMonth() - 1);
    } else {
      next.setDate(currentDate.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(currentDate.getMonth() + 1);
    } else {
      next.setDate(currentDate.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Pre-calculate / map schedules by day string
  const schedulesByDayMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const s of schedules) {
      const startDate = s.date;
      const endDateVal = s.endDate || s.date;
      
      // Map for single day or range
      let cur = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`);
      const end = new Date(endDateVal.includes('T') ? endDateVal : `${endDateVal}T00:00:00`);
      while (cur <= end) {
        const dStr = formatDateStr(cur);
        const existing = map.get(dStr) || [];
        existing.push(s);
        map.set(dStr, existing);
        cur.setDate(cur.getDate() + 1);
      }
    }
    // Sort each day's list
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [schedules]);

  const getSchedulesForDay = useCallback((dayStr: string) => {
    return schedulesByDayMap.get(dayStr) || [];
  }, [schedulesByDayMap]);

  // Drag and drop handler for target cell
  const handleDropCell = useCallback((e: React.DragEvent, targetDate: string, targetStartTime?: string) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const data = JSON.parse(raw);
      const { id, durationMins, startTime: origStartTime } = data;
      if (!id) return;

      const startTimeVal = targetStartTime || origStartTime || '10:00';
      const startMins = timeToMinutes(startTimeVal);
      const endMins = startMins + (durationMins || 60);
      const endTimeVal = minutesToTime(endMins);

      updateSchedule(id, {
        date: targetDate,
        startTime: startTimeVal,
        endTime: endTimeVal
      });
    } catch {
      // Silent error boundary for drag-and-drop reschedule
    }
  }, [updateSchedule]);

  // Open modal helper
  const handleOpenCellModal = (targetDate: string, startTimeVal?: string, endTimeVal?: string) => {
    setEditingSchedule(null);
    setModalInitialDate(targetDate);
    setModalInitialStartTime(startTimeVal || '10:00');
    setModalInitialEndTime(endTimeVal || '11:00');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sched: Schedule) => {
    setEditingSchedule(sched);
    setIsModalOpen(true);
  };

  // Schedule type style helper
  const getTypeConfig = (schedType: ScheduleType) => {
    switch (schedType) {
      case 'security':
        return {
          bg: 'bg-indigo-50/70 border-indigo-100 hover:border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-300',
          badge: 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
          icon: <Shield className="w-3.5 h-3.5" />
        };
      case 'meeting':
        return {
          bg: 'bg-emerald-50/70 border-emerald-100 hover:border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300',
          badge: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
          icon: <Users className="w-3.5 h-3.5" />
        };
      case 'education':
        return {
          bg: 'bg-amber-50/70 border-amber-100 hover:border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-300',
          badge: 'bg-amber-100/85 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
          icon: <BookOpen className="w-3.5 h-3.5" />
        };
      case 'other':
      default:
        return {
          bg: 'bg-slate-50/70 border-slate-100 hover:border-slate-200 text-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-slate-300',
          badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-350',
          icon: <Calendar className="w-3.5 h-3.5" />
        };
    }
  };

  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const timetableHours = useMemo(() => Array.from({ length: 13 }, (_, i) => String(i + 8).padStart(2, '0')), []);

  return (
    <div className="glass-panel dark:glass-panel-dark rounded-[2rem] p-6 sm:p-8 shadow-2xs border border-white/20 dark:border-slate-800/40 transition-all duration-300 hover:shadow-md">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl border border-indigo-500/15">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">통합 일정 플래너</h4>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">보안, 회의, 교육 등 주요 일정을 다각도 뷰로 통합 조율합니다.</p>
          </div>
        </div>

        {/* Header Actions: View Mode Switcher + Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex p-1 bg-slate-100/80 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>주간</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>월간</span>
            </button>
            <button
              onClick={() => setViewMode('timetable')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                viewMode === 'timetable'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>타임테이블</span>
            </button>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 bg-slate-100/60 dark:bg-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-700 border border-slate-200/40 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-350 rounded-xl transition-all cursor-pointer hover:shadow-2xs active:scale-[0.97]"
            >
              오늘
            </button>
            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800 border border-slate-200/30 dark:border-slate-700 rounded-xl p-1 shrink-0">
              <button
                onClick={handlePrev}
                className="p-1 hover:bg-white dark:hover:bg-slate-750 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-350" />
              </button>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-3 min-w-[180px] text-center">
                {viewMode === 'month' ? monthText : weekRangeText}
              </span>
              <button
                onClick={handleNext}
                className="p-1 hover:bg-white dark:hover:bg-slate-750 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-350" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Form Container */}
        <ScheduleForm 
          date={date}
          setDate={setDate}
          isRange={isRange}
          setIsRange={setIsRange}
          endDate={endDate}
          setEndDate={setEndDate}
          addSchedule={addSchedule}
        />

        {/* Views Container (Right side / col-span-9) */}
        <div className="xl:col-span-9 flex flex-col min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
              <p className="text-xs font-bold">스케줄 정보를 불러오고 있습니다...</p>
            </div>
          ) : viewMode === 'week' ? (
            /* ================= 1. WEEK VIEW ================= */
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 h-full min-h-[500px]">
              {weekDays.map((day, idx) => {
                const dayStr = formatDateStr(day);
                const daySchedules = getSchedulesForDay(dayStr);
                const isToday = new Date().toDateString() === day.toDateString();
                const dayNum = day.getDate();

                return (
                  <div
                    key={idx}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropCell(e, dayStr)}
                    className={`flex flex-col bg-white/30 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/40 rounded-2xl p-3 h-full min-h-[200px] md:min-h-[480px] transition-all hover:bg-white/60 dark:hover:bg-slate-800/40 hover:shadow-2xs ${
                      isToday ? 'bg-indigo-50/10 border-indigo-300/50 shadow-xs ring-1 ring-indigo-500/5 dark:bg-indigo-950/20 dark:border-indigo-800/50 dark:ring-indigo-500/10' : ''
                    }`}
                  >
                    {/* Header */}
                    <div 
                      onClick={() => handleOpenCellModal(dayStr)}
                      className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/40 dark:border-slate-800/50 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 p-1 rounded-lg transition-all select-none"
                      title={`${dayNum}일 직관적 일정 추가 (클릭)`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[12px] font-bold ${
                          idx === 5 ? 'text-blue-500' : idx === 6 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {dayNames[idx]}
                        </span>
                        <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {dayNum}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-350 bg-slate-200/40 dark:bg-slate-800 px-1.5 py-0.5 rounded-full shrink-0">
                        {daySchedules.length}건
                      </span>
                    </div>

                    {/* Column Body */}
                    <div 
                      onClick={() => handleOpenCellModal(dayStr)}
                      className="flex flex-col gap-2 overflow-y-auto flex-1 max-h-[360px] md:max-h-none custom-scrollbar min-h-[140px]"
                    >
                      {daySchedules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-8 text-slate-400 dark:text-slate-500 italic text-[11px] font-semibold cursor-pointer">
                          + 클릭하여 추가
                        </div>
                      ) : (
                        daySchedules.map((schedule) => {
                          const config = getTypeConfig(schedule.type);
                          return (
                            <ScheduleItem
                              key={schedule.id}
                              schedule={schedule}
                              config={config}
                              onDelete={deleteSchedule}
                              onEdit={handleOpenEditModal}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'month' ? (
            /* ================= 2. MONTH VIEW (42-Cell Grid) ================= */
            <div className="flex flex-col gap-2 w-full">
              {/* Day Name Header Row */}
              <div className="grid grid-cols-7 gap-1 bg-slate-100/60 dark:bg-slate-800/60 p-2 rounded-xl text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                {dayNames.map((d, i) => (
                  <div key={d} className={i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : ''}>
                    {d}
                  </div>
                ))}
              </div>

              {/* 42-day Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthDays.map((day, idx) => {
                  const dayStr = formatDateStr(day);
                  const daySchedules = getSchedulesForDay(dayStr);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = new Date().toDateString() === day.toDateString();

                  return (
                    <div
                      key={dayStr + idx}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropCell(e, dayStr)}
                      onClick={() => handleOpenCellModal(dayStr)}
                      className={`min-h-[90px] max-h-[110px] p-1.5 rounded-xl border flex flex-col justify-start transition-all cursor-pointer ${
                        isCurrentMonth 
                          ? 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-850' 
                          : 'bg-slate-100/20 dark:bg-slate-950/20 border-transparent text-slate-300 dark:text-slate-700'
                      } ${isToday ? 'ring-2 ring-indigo-500/60 bg-indigo-50/10' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1 px-1">
                        <span className={`text-[11px] font-bold ${
                          isToday 
                            ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center' 
                            : isCurrentMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'
                        }`}>
                          {day.getDate()}
                        </span>
                        {daySchedules.length > 0 && (
                          <span className="text-[9px] font-bold text-slate-400">
                            {daySchedules.length}
                          </span>
                        )}
                      </div>

                      {/* Compact schedule pills */}
                      <div className="flex flex-col gap-1 overflow-y-auto max-h-[70px] custom-scrollbar">
                        {daySchedules.map((s) => {
                          const config = getTypeConfig(s.type);
                          return (
                            <div
                              key={s.id}
                              draggable={true}
                              onDragStart={(e) => {
                                const durationMins = Math.max(30, timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
                                e.dataTransfer.setData('application/json', JSON.stringify({
                                  id: s.id,
                                  durationMins,
                                  startTime: s.startTime,
                                  endTime: s.endTime
                                }));
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(s);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate flex items-center justify-between gap-1 shadow-2xs ${config.bg}`}
                              title={`${s.startTime} ${s.title}`}
                            >
                              <span className="truncate">{s.title}</span>
                              <span className="text-[8px] opacity-70 shrink-0">{s.startTime}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= 3. TIMETABLE VIEW (08:00 to 20:00 Matrix) ================= */
            <div className="flex flex-col border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/40 dark:bg-slate-900/40">
              {/* Header Row: Days */}
              <div className="grid grid-cols-8 border-b border-slate-200/60 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/60 text-center text-xs font-bold text-slate-700 dark:text-slate-200 py-2.5">
                <div className="text-slate-400">시간</div>
                {weekDays.map((d, i) => {
                  const dayStr = formatDateStr(d);
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <div key={dayStr} className={`flex items-center justify-center gap-1 ${isToday ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : ''}`}>
                      <span>{dayNames[i]}</span>
                      <span className="text-[11px]">({d.getDate()}일)</span>
                    </div>
                  );
                })}
              </div>

              {/* Hourly Slot Rows */}
              <div className="flex flex-col overflow-y-auto max-h-[550px] custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/50">
                {timetableHours.map((hourStr) => {
                  const nextHourStr = String(Number(hourStr) + 1).padStart(2, '0');
                  return (
                    <div key={hourStr} className="grid grid-cols-8 min-h-[54px] items-stretch">
                      {/* Hour Label */}
                      <div className="p-2 border-r border-slate-200/40 dark:border-slate-800/40 text-[11px] font-bold text-slate-400 flex items-center justify-center bg-slate-50/40 dark:bg-slate-950/40">
                        {hourStr}:00
                      </div>

                      {/* 7 Day Slot Cells */}
                      {weekDays.map((day) => {
                        const dayStr = formatDateStr(day);
                        const daySchedules = getSchedulesForDay(dayStr);
                        // Filter schedules starting in this hour slot
                        const matchingSchedules = daySchedules.filter((s) => s.startTime.startsWith(hourStr));

                        return (
                          <div
                            key={dayStr + hourStr}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDropCell(e, dayStr, `${hourStr}:00`)}
                            onClick={() => handleOpenCellModal(dayStr, `${hourStr}:00`, `${nextHourStr}:00`)}
                            className="p-1 border-r border-slate-100 dark:border-slate-800/40 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer flex flex-col gap-1 min-h-[50px]"
                            title={`${dayStr} ${hourStr}:00 일정 등록 (클릭)`}
                          >
                            {matchingSchedules.map((s) => {
                              const config = getTypeConfig(s.type);
                              return (
                                <div
                                  key={s.id}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    const durationMins = Math.max(30, timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
                                    e.dataTransfer.setData('application/json', JSON.stringify({
                                      id: s.id,
                                      durationMins,
                                      startTime: s.startTime,
                                      endTime: s.endTime
                                    }));
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(s);
                                  }}
                                  className={`p-1.5 rounded-lg border text-[10px] font-bold flex flex-col gap-0.5 shadow-2xs ${config.bg}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">{s.title}</span>
                                    <span className="text-[9px] opacity-75">{s.startTime}~{s.endTime}</span>
                                  </div>
                                  <span className="text-[8.5px] opacity-80">{s.person}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Direct Click Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        schedule={editingSchedule}
        initialDate={modalInitialDate}
        initialStartTime={modalInitialStartTime}
        initialEndTime={modalInitialEndTime}
        onSaveAdd={addSchedule}
        onSaveUpdate={updateSchedule}
        onDeleteSchedule={deleteSchedule}
      />
    </div>
  );
};

export const WeeklyScheduler = React.memo(WeeklySchedulerComponent);
WeeklyScheduler.displayName = 'WeeklyScheduler';
