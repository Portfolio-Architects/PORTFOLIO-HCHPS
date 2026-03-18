'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { classifyAndParse, ParsedResult } from '@/lib/korean-nlp';
import { Zap, Calendar, Clock, MapPin, Users, DollarSign, AlertTriangle, Send, Repeat } from 'lucide-react';

interface QuickInputProps {
  onCreateTask: (data: { title: string; dueDate?: string; priority: 'low' | 'medium' | 'high'; tags: string[]; category: string; recurrence?: string; recurrenceEndDate?: string }) => void;
  onCreateKnowledge?: (data: { title: string; content: string; tags: string[]; category: string }) => void;
  onNavigate: (module: string) => void;
}

function formatAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

export function QuickInput({ onCreateTask, onCreateKnowledge, onNavigate }: QuickInputProps) {
  const [text, setText] = useState('');
  const [justCreated, setJustCreated] = useState(false);
  const [createdLabel, setCreatedLabel] = useState('업무 생성 완료!');

  const parsed = useMemo<ParsedResult | null>(() => {
    if (text.trim().length < 2) return null;
    return classifyAndParse(text);
  }, [text]);

  const handleSubmit = useCallback(() => {
    if (!parsed || text.trim().length < 2) return;

    const tags: string[] = [...parsed.tags];
    if (parsed.people.length > 0) parsed.people.forEach(p => tags.push(p));
    if (parsed.location) tags.push(parsed.location);
    if (parsed.amount) tags.push(formatAmount(parsed.amount));

    // Merge date + time into dueDate (e.g. "2026-03-19T14:00")
    let dueDate = parsed.date;
    if (dueDate && parsed.time) {
      dueDate = `${dueDate}T${parsed.time}`;
    }

    if (parsed.type === 'knowledge' && onCreateKnowledge) {
      onCreateKnowledge({
        title: parsed.title,
        content: parsed.rawText,
        tags,
        category: parsed.category || '',
      });
      setCreatedLabel('지식 등록 완료!');
      onNavigate('knowledge');
    } else {
      onCreateTask({
        title: parsed.title,
        dueDate,
        priority: parsed.priority,
        tags,
        category: parsed.category || '',
        recurrence: parsed.recurrence,
        recurrenceEndDate: parsed.recurrenceEndDate
      });
      setCreatedLabel('업무 생성 완료!');
      onNavigate('workspace');
    }

    setText('');
    setJustCreated(true);
    setTimeout(() => setJustCreated(false), 2500);
  }, [parsed, text, onCreateTask, onCreateKnowledge, onNavigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border-light)] shadow-[var(--shadow-sm)] px-4 py-2 transition-shadow focus-within:shadow-md focus-within:border-[var(--color-primary)]">
        <Zap size={16} className="text-[var(--color-primary)] shrink-0" />
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          placeholder="아무 말이나 입력하세요... 예: 회의 자료 준비, 20일까지 결제 해야함"
        />

        {parsed && (
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
            parsed.type === 'knowledge' 
              ? 'bg-[rgba(234,179,8,0.1)] text-yellow-600'
              : 'bg-[rgba(74,108,247,0.08)] text-[var(--color-primary)]'
          }`}>
            {parsed.type === 'knowledge' ? '💡 지식' : '📋 업무'}
          </span>
        )}

        <button
          onClick={handleSubmit}
          disabled={!parsed}
          className={`p-2 rounded-xl transition-all cursor-pointer ${parsed ? 'bg-[var(--color-primary)] text-white hover:opacity-90' : 'bg-gray-100 text-[var(--color-text-tertiary)]'}`}
        >
          <Send size={14} />
        </button>
      </div>

      {parsed && (
        <div className="flex items-center gap-2 mt-2 flex-wrap px-1">
          {parsed.date && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-blue-50 text-blue-600">
              <Calendar size={10} /> {parsed.date}
            </span>
          )}
          {parsed.time && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-600">
              <Clock size={10} /> {parsed.time}
            </span>
          )}
          {parsed.people.map(p => (
            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-green-50 text-green-600">
              <Users size={10} /> {p}
            </span>
          ))}
          {parsed.location && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-orange-50 text-orange-600">
              <MapPin size={10} /> {parsed.location}
            </span>
          )}
          {parsed.amount && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-yellow-50 text-yellow-600">
              <DollarSign size={10} /> {formatAmount(parsed.amount)}
            </span>
          )}
          {parsed.priority === 'high' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-red-50 text-red-600">
              <AlertTriangle size={10} /> 긴급
            </span>
          )}
          {parsed.recurrence && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-teal-50 text-teal-600">
              <Repeat size={10} /> {parsed.recurrence}
            </span>
          )}
          <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto hidden sm:inline">
            → &quot;{parsed.title}&quot;
          </span>
        </div>
      )}

      {justCreated && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium text-[var(--color-success)] animate-pulse">
          ✅ {createdLabel}
        </div>
      )}
    </div>
  );
}
