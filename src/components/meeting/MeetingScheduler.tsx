'use client';

import React, { useState } from 'react';
import { Meeting } from '@/types';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, MapPin, Users, FileText, CalendarDays } from 'lucide-react';

interface MeetingSchedulerProps {
  meetings: Meeting[];
  addMeeting: (m: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
}

function formatDT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }) + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function MeetingScheduler({ meetings, addMeeting, updateMeeting, deleteMeeting }: MeetingSchedulerProps) {
  const [showModal, setShowModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [attendeesStr, setAttendeesStr] = useState('');
  const [agenda, setAgenda] = useState('');
  const [notes, setNotes] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  const openAdd = () => { setEditMeeting(null); setTitle(''); setDatetime(''); setEndTime(''); setLocation(''); setAttendeesStr(''); setAgenda(''); setNotes(''); setShowModal(true); };
  const openEdit = (m: Meeting) => { setEditMeeting(m); setTitle(m.title); setDatetime(m.datetime.slice(0, 16)); setEndTime(m.endTime || ''); setLocation(m.location || ''); setAttendeesStr(m.attendees.join(', ')); setAgenda(m.agenda || ''); setNotes(m.notes || ''); setShowModal(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !datetime) return;
    const data = { title, datetime: new Date(datetime).toISOString(), endTime: endTime || undefined, location: location || undefined, attendees: attendeesStr.split(',').map(s => s.trim()).filter(Boolean), agenda: agenda || undefined, notes: notes || undefined };
    if (editMeeting) { updateMeeting(editMeeting.id, data); } else { addMeeting(data); }
    setShowModal(false);
  };

  const sorted = [...meetings].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const now = new Date();
  const upcoming = sorted.filter(m => new Date(m.datetime) >= now);
  const past = sorted.filter(m => new Date(m.datetime) < now).reverse();

  const renderMeeting = (m: Meeting, isPast = false) => (
    <Card key={m.id} hover onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
      <div className={`px-4 py-3 ${isPast ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-[var(--color-primary)] shrink-0" />
              <span className="font-semibold text-sm truncate">{m.title}</span>
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1 ml-[22px]">{formatDT(m.datetime)}</div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={e => { e.stopPropagation(); openEdit(m); }} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] cursor-pointer"><Pencil size={14} /></button>
            <button onClick={e => { e.stopPropagation(); deleteMeeting(m.id); }} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer"><Trash2 size={14} /></button>
          </div>
        </div>
        {expandedId === m.id && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] ml-[22px] space-y-2 text-xs text-[var(--color-text-secondary)]">
            {m.location && <div className="flex items-center gap-1.5"><MapPin size={12} />{m.location}</div>}
            {m.attendees.length > 0 && <div className="flex items-center gap-1.5"><Users size={12} />{m.attendees.join(', ')}</div>}
            {m.agenda && <div className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5 shrink-0" /><span>{m.agenda}</span></div>}
            {m.notes && <div className="bg-gray-50 rounded-lg p-2 mt-1 text-[var(--color-text-secondary)]">{m.notes}</div>}
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">미팅</h2>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
          <Plus size={16} /> 새 미팅
        </button>
      </div>

      {meetings.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">미팅 일정을 추가해 보세요</div></Card>
      ) : (
        <>
          {upcoming.length > 0 && (<div><h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">📅 예정</h3><div className="space-y-2">{upcoming.map(m => renderMeeting(m))}</div></div>)}
          {past.length > 0 && (<div className="mt-6"><h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] mb-2">🕐 지난 미팅</h3><div className="space-y-2">{past.slice(0, 10).map(m => renderMeeting(m, true))}</div></div>)}
        </>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editMeeting ? '미팅 수정' : '새 미팅'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">제목 *</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} required placeholder="미팅 제목" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">시작 *</label><input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} className={inputClass} required /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">종료</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputClass} /></div>
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">장소</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputClass} placeholder="회의실, 온라인 링크 등" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">참석자 (쉼표 구분)</label><input type="text" value={attendeesStr} onChange={e => setAttendeesStr(e.target.value)} className={inputClass} placeholder="홍길동, 김철수" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">안건</label><textarea value={agenda} onChange={e => setAgenda(e.target.value)} className={`${inputClass} resize-none`} rows={2} placeholder="회의 안건" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">메모/회의록</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="회의 메모" /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">{editMeeting ? '수정' : '추가'}</button>
        </form>
      </Modal>
    </div>
  );
}
