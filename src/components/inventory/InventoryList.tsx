'use client';

import React, { useState } from 'react';
import { InventoryItem, StockChange } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Package } from 'lucide-react';

interface InventoryListProps {
  items: InventoryItem[];
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (itemId: string, change: number, reason: string) => void;
  getItemHistory: (itemId: string) => StockChange[];
}

export function InventoryList({ items, addItem, updateItem, deleteItem, adjustStock, getItemHistory }: InventoryListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('개');
  const [adjChange, setAdjChange] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (selectedItem) {
      updateItem(selectedItem.id, { name, category, unit });
    } else {
      addItem({ name, category, currentStock: Number(stock) || 0, unit, budgetEntryIds: [] });
    }
    resetForm();
  };

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !adjChange) return;
    adjustStock(selectedItem.id, Number(adjChange), adjReason || (Number(adjChange) > 0 ? '입고' : '출고'));
    setShowAdjustModal(false); setAdjChange(''); setAdjReason('');
  };

  const resetForm = () => {
    setName(''); setCategory(''); setStock(''); setUnit('개'); setSelectedItem(null); setShowAddModal(false);
  };

  const openEdit = (item: InventoryItem) => {
    setSelectedItem(item); setName(item.name); setCategory(item.category); setUnit(item.unit); setShowAddModal(true);
  };

  const openAdjust = (item: InventoryItem) => {
    setSelectedItem(item); setShowAdjustModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">홍보물 관리</h2>
        <button onClick={() => { setSelectedItem(null); resetForm(); setShowAddModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
          <Plus size={16} /> 품목 추가
        </button>
      </div>

      {items.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]"><Package size={32} className="mx-auto mb-2 opacity-30" />홍보물 품목을 추가해 보세요</div></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => {
            const history = getItemHistory(item.id).slice(0, 3);
            return (
              <Card key={item.id}>
                <CardContent>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-sm">{item.name}</div>
                      {item.category && <div className="text-xs text-[var(--color-text-tertiary)]">{item.category}</div>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] cursor-pointer"><Pencil size={13} /></button>
                      <button onClick={() => deleteItem(item.id)} className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-primary)]">{item.currentStock} <span className="text-sm font-normal text-[var(--color-text-tertiary)]">{item.unit}</span></div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { openAdjust(item); setAdjChange('1'); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[rgba(16,185,129,0.08)] text-[var(--color-success)] text-xs font-medium hover:bg-[rgba(16,185,129,0.15)] transition-colors cursor-pointer">
                      <ArrowUp size={12} /> 입고
                    </button>
                    <button onClick={() => { openAdjust(item); setAdjChange('-1'); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[rgba(239,68,68,0.08)] text-[var(--color-danger)] text-xs font-medium hover:bg-[rgba(239,68,68,0.15)] transition-colors cursor-pointer">
                      <ArrowDown size={12} /> 출고
                    </button>
                  </div>
                  {history.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[var(--color-border-light)] space-y-1">
                      {history.map(h => (
                        <div key={h.id} className="flex justify-between text-[10px] text-[var(--color-text-tertiary)]">
                          <span>{h.reason}</span>
                          <span className={h.change > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{h.change > 0 ? '+' : ''}{h.change}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showAddModal} onClose={resetForm} title={selectedItem ? '품목 수정' : '새 품목'} size="sm">
        <form onSubmit={handleAdd} className="space-y-4">
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">품명 *</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} required /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">분류</label><input type="text" value={category} onChange={e => setCategory(e.target.value)} className={inputClass} placeholder="예: 사무용품" /></div>
          {!selectedItem && <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">초기 수량</label><input type="number" value={stock} onChange={e => setStock(e.target.value)} className={inputClass} placeholder="0" /></div>}
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">단위</label><input type="text" value={unit} onChange={e => setUnit(e.target.value)} className={inputClass} /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">{selectedItem ? '수정' : '추가'}</button>
        </form>
      </Modal>

      {/* Adjust Modal */}
      <Modal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title={`재고 조정 — ${selectedItem?.name}`} size="sm">
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="text-center text-sm text-[var(--color-text-secondary)]">현재 재고: <span className="font-bold text-[var(--color-text-primary)]">{selectedItem?.currentStock} {selectedItem?.unit}</span></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">변동 수량 (양수=입고, 음수=출고) *</label><input type="number" value={adjChange} onChange={e => setAdjChange(e.target.value)} className={inputClass} required /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">사유</label><input type="text" value={adjReason} onChange={e => setAdjReason(e.target.value)} className={inputClass} placeholder="입고/출고 사유" /></div>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">적용</button>
        </form>
      </Modal>
    </div>
  );
}
