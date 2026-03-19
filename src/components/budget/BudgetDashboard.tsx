'use client';

import React, { useState, useMemo } from 'react';
import { BudgetCategory, BudgetEntry, BudgetEntryType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, FileCheck, FilePlus2 } from 'lucide-react';

interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => { totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number } | null;
  overallStats: { totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number };
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

const COLORS = ['#4A6CF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const TYPE_CONFIG: Record<BudgetEntryType, { label: string; badge: string; badgeBg: string; icon: typeof FilePlus2 }> = {
  approval:   { label: '지출 품의', badge: '품의', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  resolution: { label: '지출 결의', badge: '결의', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
};

export function BudgetDashboard({ categories, entries, addCategory, updateCategory, deleteCategory, addEntry, deleteEntry, getCategoryStats, overallStats }: BudgetDashboardProps) {
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [catName, setCatName] = useState('');
  const [catBudget, setCatBudget] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPurpose, setEntryPurpose] = useState('');
  const [entryMemo, setEntryMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<BudgetEntryType>('approval');
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | BudgetEntryType>('all');

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  // Stats by type
  const typeStats = useMemo(() => {
    const approvalTotal = entries.filter(e => (e.entryType || 'resolution') === 'approval').reduce((s, e) => s + e.amount, 0);
    const resolutionTotal = entries.filter(e => (e.entryType || 'resolution') === 'resolution').reduce((s, e) => s + e.amount, 0);
    return { approvalTotal, resolutionTotal };
  }, [entries]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catBudget) return;
    if (editCatId) {
      updateCategory(editCatId, { name: catName, totalBudget: Number(catBudget) });
    } else {
      addCategory({ name: catName, totalBudget: Number(catBudget), color: COLORS[categories.length % COLORS.length] });
    }
    setCatName(''); setCatBudget(''); setEditCatId(null); setShowCatModal(false);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount || !entryPurpose.trim() || !selectedCatId) return;
    addEntry({
      categoryId: selectedCatId,
      amount: Number(entryAmount),
      date: entryDate,
      purpose: entryPurpose,
      memo: entryMemo,
      isPlanned: entryType === 'approval',
      entryType,
    });
    setEntryAmount(''); setEntryPurpose(''); setEntryMemo(''); setShowEntryModal(false);
  };

  const openEditCat = (cat: BudgetCategory) => {
    setCatName(cat.name); setCatBudget(cat.totalBudget.toString()); setEditCatId(cat.id); setShowCatModal(true);
  };

  const openEntryModal = (type: BudgetEntryType) => {
    setEntryType(type);
    setShowEntryModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">예산 관리</h2>
        <div className="flex gap-2">
          <button onClick={() => { setEditCatId(null); setCatName(''); setCatBudget(''); setShowCatModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">
            <Plus size={16} /> 예산 과목
          </button>
          <button onClick={() => openEntryModal('approval')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FilePlus2 size={16} /> 지출 품의
          </button>
          <button onClick={() => openEntryModal('resolution')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FileCheck size={16} /> 지출 결의
          </button>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">전체 예산</div>
          <div className="text-lg font-bold mt-1">{formatN(overallStats.totalBudget)}원</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">품의 금액</div>
          <div className="text-lg font-bold mt-1 text-amber-600">{formatN(typeStats.approvalTotal)}원</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">결의 금액</div>
          <div className="text-lg font-bold mt-1 text-[var(--color-primary)]">{formatN(typeStats.resolutionTotal)}원</div>
        </CardContent></Card>
        <Card><CardContent>
          <div className="text-xs text-[var(--color-text-tertiary)]">잔여 예산</div>
          <div className={`text-lg font-bold mt-1 ${overallStats.remaining < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>{formatN(overallStats.remaining)}원</div>
        </CardContent></Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([['all', '전체'], ['approval', '품의'], ['resolution', '결의']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setViewFilter(key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              viewFilter === key
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {label}
            <span className="ml-1 text-[10px] opacity-60">
              ({key === 'all' ? entries.length : entries.filter(e => (e.entryType || 'resolution') === key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">예산 과목을 추가해 보세요</div></Card>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const stats = getCategoryStats(cat.id);
            if (!stats) return null;
            const catEntries = entries
              .filter(e => e.categoryId === cat.id)
              .filter(e => viewFilter === 'all' || (e.entryType || 'resolution') === viewFilter)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return (
              <Card key={cat.id}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <h3 className="font-semibold text-sm">{cat.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditCat(cat)} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[var(--color-text-secondary)]">사용 {formatN(stats.spent)}원 / {formatN(stats.totalBudget)}원</span>
                    <span className="text-[var(--color-text-tertiary)]">잔여 {formatN(stats.remaining)}원</span>
                  </div>
                  <ProgressBar value={stats.usageRate} color={cat.color} showLabel />
                  {stats.planned > 0 && <div className="text-xs text-amber-600 mt-1">📋 품의 금액: {formatN(stats.planned)}원</div>}

                  {/* Entries */}
                  {catEntries.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] space-y-1.5">
                      {catEntries.slice(0, 8).map(entry => {
                        const cfg = TYPE_CONFIG[(entry.entryType || 'resolution') as BudgetEntryType];
                        return (
                          <div key={entry.id} className="flex items-center justify-between text-xs group">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.badgeBg}`}>{cfg.badge}</span>
                              <span className="text-[var(--color-text-tertiary)]">{entry.date}</span>
                              <span>{entry.purpose}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatN(entry.amount)}원</span>
                              <button onClick={() => deleteEntry(entry.id)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer transition-opacity"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title={editCatId ? '예산 과목 수정' : '새 예산 과목'} size="sm">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">과목명 *</label><input type="text" value={catName} onChange={e => setCatName(e.target.value)} className={inputClass} required placeholder="예: 사무용품비" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 금액 (원) *</label><input type="number" value={catBudget} onChange={e => setCatBudget(e.target.value)} className={inputClass} required placeholder="0" /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">{editCatId ? '수정' : '추가'}</button>
        </form>
      </Modal>

      {/* Entry Modal */}
      <Modal isOpen={showEntryModal} onClose={() => setShowEntryModal(false)} title={TYPE_CONFIG[entryType].label} size="sm">
        <form onSubmit={handleAddEntry} className="space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {(['approval', 'resolution'] as const).map(type => {
              const cfg = TYPE_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEntryType(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border ${
                    entryType === type
                      ? type === 'approval'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} /> {cfg.label}
                </button>
              );
            })}
          </div>

          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 과목 *</label>
            <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={inputClass} required>
              <option value="">선택</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">금액 (원) *</label><input type="number" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} className={inputClass} required placeholder="0" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">{entryType === 'approval' ? '품의 내용' : '지출 목적'} *</label><input type="text" value={entryPurpose} onChange={e => setEntryPurpose(e.target.value)} className={inputClass} required placeholder={entryType === 'approval' ? '어떤 지출을 승인받을 건지' : '무엇에 사용했는지'} /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">날짜</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">메모</label><input type="text" value={entryMemo} onChange={e => setEntryMemo(e.target.value)} className={inputClass} placeholder="추가 메모 (선택)" /></div>
          <button
            type="submit"
            className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer ${
              entryType === 'approval' ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
            }`}
          >
            {TYPE_CONFIG[entryType].label} 등록
          </button>
        </form>
      </Modal>
    </div>
  );
}
