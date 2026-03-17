'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { classifyAndParse, ParsedResult } from '@/lib/korean-nlp';
import { Zap, Calendar, Clock, MapPin, Users, DollarSign, AlertTriangle, Send, Radio } from 'lucide-react';

type InputMode = 'task' | 'signal';

interface QuickInputProps {
  onCreateTask: (data: { title: string; dueDate?: string; priority: 'low' | 'medium' | 'high'; tags: string[]; category: string }) => void;
  onCreateSignal: (text: string) => void;
  onNavigate: (module: string) => void;
}

function formatAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

export function QuickInput({ onCreateTask, onCreateSignal, onNavigate }: QuickInputProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<InputMode>('task');
  const [justCreated, setJustCreated] = useState(false);

  // Parse only in task mode
  const parsed = useMemo<ParsedResult | null>(() => {
    if (mode !== 'task' || text.trim().length < 2) return null;
    return classifyAndParse(text);
  }, [text, mode]);

  const handleSubmit = useCallback(() => {
    if (text.trim().length < 2) return;

    if (mode === 'signal') {
      onCreateSignal(text.trim());
      setText('');
      setJustCreated(true);
      setTimeout(() => setJustCreated(false), 2500);
      return;
    }

    // Task mode
    if (!parsed) return;
    const tags: string[] = [...parsed.tags];
    if (parsed.people.length > 0) parsed.people.forEach(p => tags.push(p));
    if (parsed.location) tags.push(parsed.location);
    if (parsed.amount) tags.push(formatAmount(parsed.amount));

    onCreateTask({
      title: parsed.title,
      dueDate: parsed.date,
      priority: parsed.priority,
      tags,
      category: parsed.category || '',
    });

    onNavigate('workspace');
    setText('');
    setJustCreated(true);
    setTimeout(() => setJustCreated(false), 2500);
  }, [parsed, text, mode, onCreateTask, onCreateSignal, onNavigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = mode === 'signal' ? text.trim().length >= 2 : !!parsed;

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
      <div className="relative">
        {/* Input Row */}
        <div className="flex items-center gap-2 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border-light)] shadow-[var(--shadow-sm)] px-4 py-2 transition-shadow focus-within:shadow-md focus-within:border-[var(--color-primary)]">
          {/* Mode Toggle */}
          <div className="flex items-center shrink-0 border-r border-[var(--color-border-light)] pr-2 mr-1">
            <button
              onClick={() => setMode('task')}
              className={`px-2.5 py-1 rounded-l-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                mode === 'task'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-100 text-[var(--color-text-tertiary)] hover:bg-gray-200'
              }`}
            >
              📋 업무
            </button>
            <button
              onClick={() => setMode('signal')}
              className={`px-2.5 py-1 rounded-r-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                mode === 'signal'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-[var(--color-text-tertiary)] hover:bg-gray-200'
              }`}
            >
              📡 시그널
            </button>
          </div>

          {mode === 'signal' ? (
            <Radio size={16} className="text-emerald-500 shrink-0" />
          ) : (
            <Zap size={16} className="text-[var(--color-primary)] shrink-0" />
          )}

          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
            placeholder={mode === 'signal'
              ? '지금 느끼는 것을 자유롭게 기록하세요...'
              : '아무 말이나 입력하세요... 예: 회의 자료 준비, 20일까지 결제 해야함'
            }
          />

          {/* Mode badge */}
          {canSubmit && (
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              mode === 'signal'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-[rgba(74,108,247,0.08)] text-[var(--color-primary)]'
            }`}>
              {mode === 'signal' ? '📡 시그널' : '📋 업무'}
            </span>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              canSubmit
                ? mode === 'signal'
                  ? 'bg-emerald-500 text-white hover:opacity-90'
                  : 'bg-[var(--color-primary)] text-white hover:opacity-90'
                : 'bg-gray-100 text-[var(--color-text-tertiary)]'
            }`}
          >
            <Send size={14} />
          </button>
        </div>

        {/* Preview Tags (task mode only) */}
        {mode === 'task' && parsed && (
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
            <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto hidden sm:inline">
              → &quot;{parsed.title}&quot;
            </span>
          </div>
        )}

        {/* Success feedback */}
        {justCreated && (
          <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium animate-pulse ${
            mode === 'signal' ? 'text-emerald-500' : 'text-[var(--color-success)]'
          }`}>
            {mode === 'signal' ? '📡 시그널 기록 완료!' : '✅ 업무 생성 완료!'}
          </div>
        )}
      </div>
    </div>
  );
}
