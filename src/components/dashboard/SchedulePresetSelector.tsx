'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ScheduleType } from '@/types';
import { 
  SchedulePreset, 
  getSchedulePresets, 
  getPresetsByType, 
  addCustomPreset, 
  deleteCustomPreset 
} from '@/lib/schedule-presets';
import { 
  Sparkles, Plus, Trash2, X, Search, Check, Bookmark, Clock, User, FileText 
} from 'lucide-react';

const PRESET_FILTER_OPTIONS: Array<{ type: 'all' | ScheduleType; label: string }> = [
  { type: 'all', label: '전체' },
  { type: 'security', label: '보안' },
  { type: 'meeting', label: '회의' },
  { type: 'education', label: '교육' },
  { type: 'other', label: '기타' }
];

interface PresetChipsProps {
  currentType: ScheduleType;
  onSelectPreset: (preset: SchedulePreset) => void;
  onOpenManageModal: () => void;
}

interface PresetChipItemProps {
  preset: SchedulePreset;
  onSelect: (preset: SchedulePreset) => void;
}

const PresetChipItem = React.memo(({ preset, onSelect }: PresetChipItemProps) => {
  const handleClick = useCallback(() => {
    onSelect(preset);
  }, [onSelect, preset]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 px-2.5 py-1 bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-[0.97]"
      title={`담당자: ${preset.person || '미지정'}${preset.startTime ? ` | 시간: ${preset.startTime}~${preset.endTime}` : ''}`}
    >
      <span>{preset.title}</span>
    </button>
  );
});
PresetChipItem.displayName = 'PresetChipItem';

export const SchedulePresetChips = React.memo(({
  currentType,
  onSelectPreset,
  onOpenManageModal
}: PresetChipsProps) => {
  const presets = useMemo(() => {
    return getPresetsByType(currentType);
  }, [currentType]);

  const topPresets = useMemo(() => {
    return presets.slice(0, 5);
  }, [presets]);

  if (presets.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-[10.5px] text-slate-400">등록된 상용구가 없습니다.</span>
        <button
          type="button"
          onClick={onOpenManageModal}
          className="text-[10.5px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer border-0 bg-transparent"
        >
          <Sparkles className="w-3 h-3" />
          <span>상용구 관리</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>자주 쓰는 상용구 (1-클릭 완성)</span>
        </label>
        <button
          type="button"
          onClick={onOpenManageModal}
          className="text-[10.5px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer border-0 bg-transparent"
        >
          <span>전체/관리</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {topPresets.map((preset) => (
          <PresetChipItem
            key={preset.id}
            preset={preset}
            onSelect={onSelectPreset}
          />
        ))}
      </div>
    </div>
  );
});
SchedulePresetChips.displayName = 'SchedulePresetChips';

// ============ Preset Management & Full Selector Modal ============

interface ManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: SchedulePreset) => void;
  currentFormValues?: {
    title: string;
    type: ScheduleType;
    person: string;
    startTime: string;
    endTime: string;
    notes?: string;
  };
}

interface ManagePresetCardItemProps {
  preset: SchedulePreset;
  onSelect: (preset: SchedulePreset) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const ManagePresetCardItem = React.memo(({
  preset,
  onSelect,
  onDelete
}: ManagePresetCardItemProps) => {
  const handleClick = useCallback(() => {
    onSelect(preset);
  }, [onSelect, preset]);

  return (
    <div
      onClick={handleClick}
      className="p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-800 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
    >
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
            preset.type === 'security' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' :
            preset.type === 'meeting' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
            preset.type === 'education' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
            'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
          }`}>
            {preset.type === 'security' && '보안'}
            {preset.type === 'meeting' && '회의'}
            {preset.type === 'education' && '교육'}
            {preset.type === 'other' && '기타'}
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
            {preset.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" />
            {preset.person}
          </span>
          {preset.startTime && preset.endTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {preset.startTime} ~ {preset.endTime}
            </span>
          )}
          {preset.notes && (
            <span className="flex items-center gap-1 truncate max-w-[200px]">
              <FileText className="w-3 h-3 text-slate-400" />
              {preset.notes}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
          선택 &gt;
        </span>
        {!preset.isDefault && (
          <button
            type="button"
            onClick={(e) => onDelete(preset.id, e)}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border-0 cursor-pointer"
            title="상용구 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
});
ManagePresetCardItem.displayName = 'ManagePresetCardItem';

export const SchedulePresetManageModal = React.memo(({
  isOpen,
  onClose,
  onSelectPreset,
  currentFormValues
}: ManageModalProps) => {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | ScheduleType>('all');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleSelectPresetAndClose = useCallback((preset: SchedulePreset) => {
    onSelectPreset(preset);
    onClose();
  }, [onSelectPreset, onClose]);

  const allPresets = useMemo(() => {
    // version dependency triggers refresh on add/delete
    if (!isOpen && version === 0) return [];
    return getSchedulePresets();
  }, [isOpen, version]);

  const filteredPresets = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (selectedTypeFilter === 'all' && !q) return allPresets;

    const result: SchedulePreset[] = [];
    for (let i = 0; i < allPresets.length; i++) {
      const p = allPresets[i];
      if (selectedTypeFilter !== 'all' && p.type !== selectedTypeFilter) continue;
      if (q) {
        const matchesSearch =
          p.title.toLowerCase().includes(q) ||
          p.person.toLowerCase().includes(q) ||
          (p.notes ? p.notes.toLowerCase().includes(q) : false);
        if (!matchesSearch) continue;
      }
      result.push(p);
    }
    return result;
  }, [allPresets, selectedTypeFilter, search]);

  const handleSaveCurrentAsPreset = useCallback(() => {
    if (!currentFormValues || !currentFormValues.title.trim()) return;

    addCustomPreset({
      title: currentFormValues.title.trim(),
      type: currentFormValues.type,
      person: currentFormValues.person.trim() || '담당자',
      startTime: currentFormValues.startTime,
      endTime: currentFormValues.endTime,
      notes: currentFormValues.notes || ''
    });

    setVersion(v => v + 1);
    setSaveSuccessMsg(`'${currentFormValues.title}' 상용구로 저장되었습니다!`);
    setTimeout(() => setSaveSuccessMsg(''), 2500);
  }, [currentFormValues]);

  const handleDeletePreset = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 상용구를 목록에서 삭제하시겠습니까?')) {
      deleteCustomPreset(id);
      setVersion(v => v + 1);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[560px] overflow-hidden flex flex-col p-6 max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200/50 dark:border-amber-900">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                자주 쓰는 스케줄 상용구 관리
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                원클릭으로 일정을 채우거나 나만의 상용구를 등록해 재사용합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save current form values action banner */}
        {currentFormValues && currentFormValues.title.trim() && (
          <div className="mb-4 p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/60 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="text-xs truncate">
                <span className="font-bold text-slate-700 dark:text-slate-200">현재 작성 내용: </span>
                <span className="text-indigo-700 dark:text-indigo-300 font-semibold">{currentFormValues.title} ({currentFormValues.person})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveCurrentAsPreset}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all border-0 cursor-pointer shrink-0 flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>상용구로 저장</span>
            </button>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mb-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="상용구 제목, 담당자, 내용 검색..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto">
            {PRESET_FILTER_OPTIONS.map(({ type: t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTypeFilter(t)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                  selectedTypeFilter === t
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100/70 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset List Container */}
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1 custom-scrollbar min-h-[220px]">
          {filteredPresets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
              <span>일치하는 상용구가 없습니다.</span>
            </div>
          ) : (
            filteredPresets.map((preset) => (
              <ManagePresetCardItem
                key={preset.id}
                preset={preset}
                onSelect={handleSelectPresetAndClose}
                onDelete={handleDeletePreset}
              />
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-bold transition-colors border-0 cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
});
SchedulePresetManageModal.displayName = 'SchedulePresetManageModal';
