'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentEntry, generateId } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { fetchDocumentEntries } from '@/lib/document.fetch';
import { generateHwpx, downloadBlob, formatAmount } from '@/lib/hwpx-generator';
import {
  FileText, Plus, Download, RefreshCw, Loader2, AlertCircle, PencilLine
} from 'lucide-react';

// ============ Status Badge ============

function StatusBadge({ status }: { status: DocumentEntry['status'] }) {
  const styles = {
    draft: 'bg-gray-100 text-gray-600',
    ready: 'bg-blue-50 text-[var(--color-primary)]',
    done: 'bg-green-50 text-[var(--color-success)]',
  };
  const labels = { draft: '초안', ready: '준비됨', done: '생성완료' };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ============ Empty Form Template ============

function emptyEntry(): Omit<DocumentEntry, 'id'> {
  return {
    title: '',
    expenseType: '일상경비',
    amount: 0,
    vendorName: '',
    vendorRegNo: '',
    relatedDoc: '',
    recipient: '내부결재',
    budgetAccount: '',
    paymentMethod: '채주 청구 의거 보건행정과 일상경비출납원이 납품업체 계좌로 입금',
    status: 'draft',
  };
}

// ============ Main Component ============

export function DocumentGenerator() {
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetError, setSheetError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState<Omit<DocumentEntry, 'id'>>(emptyEntry());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const templateRef = useRef<ArrayBuffer | null>(null);

  // Load template HWPX into memory
  useEffect(() => {
    fetch('/templates/template.hwpx')
      .then(r => r.arrayBuffer())
      .then(buf => { templateRef.current = buf; })
      .catch(() => console.warn('HWPX 템플릿 파일을 로드할 수 없습니다.'));
  }, []);

  // Load data from Google Sheets
  const loadData = useCallback(async () => {
    setLoading(true);
    setSheetError(false);
    try {
      const data = await fetchDocumentEntries();
      if (data.length > 0) {
        setEntries(data);
      } else {
        setSheetError(true);
      }
    } catch {
      setSheetError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Open modal for new / edit
  const openNew = () => {
    setEditForm(emptyEntry());
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (entry: DocumentEntry) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = entry;
    setEditForm(rest);
    setEditingId(entry.id);
    setShowModal(true);
  };

  const saveEntry = () => {
    if (!editForm.title.trim()) return;
    if (editingId) {
      setEntries(prev => prev.map(e => e.id === editingId ? { ...editForm, id: editingId } : e));
    } else {
      setEntries(prev => [...prev, { ...editForm, id: generateId() }]);
    }
    setShowModal(false);
  };

  // Generate HWPX
  const handleGenerate = async (entry: DocumentEntry) => {
    if (!templateRef.current) {
      alert('HWPX 템플릿 파일이 로드되지 않았습니다.\n/public/templates/ 폴더에 template.hwpx 파일을 확인해주세요.');
      return;
    }

    setGenerating(entry.id);
    try {
      const blob = await generateHwpx(templateRef.current, entry);
      const filename = `(${entry.expenseType})${entry.title}.hwpx`;
      downloadBlob(blob, filename);

      // Mark as done
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'done' as const } : e));
    } catch (err) {
      console.error('HWPX 생성 오류:', err);
      alert('문서 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(null);
    }
  };

  const updateField = <K extends keyof Omit<DocumentEntry, 'id'>>(key: K, val: Omit<DocumentEntry, 'id'>[K]) => {
    setEditForm(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">기안문 생성</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            Google Sheets 데이터 또는 수동 입력으로 한글(.hwpx) 기안문을 자동 생성합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            시트 동기화
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus size={14} />
            수동 추가
          </button>
        </div>
      </div>

      {/* Sheet connection status */}
      {sheetError && entries.length === 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 text-sm text-[var(--color-text-tertiary)]">
              <AlertCircle size={18} className="text-[var(--color-warning)]" />
              <div>
                <div className="font-medium text-[var(--color-text-secondary)]">Google Sheets 미연결</div>
                <div className="text-xs mt-0.5">
                  DOCUMENT_DATA 시트가 없거나 접근이 불가합니다. &quot;수동 추가&quot; 버튼으로 직접 입력할 수 있습니다.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && entries.length === 0 && (
        <div className="flex items-center justify-center py-12 text-[var(--color-text-tertiary)]">
          <Loader2 size={24} className="animate-spin mr-2" />
          데이터 로딩 중...
        </div>
      )}

      {/* Entry Cards */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(entry => (
            <Card key={entry.id}>
              <div className="px-4 sm:px-5 py-3 sm:py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 p-2 bg-blue-50 rounded-lg shrink-0">
                      <FileText size={16} className="text-[var(--color-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          ({entry.expenseType}){entry.title}
                        </span>
                        <StatusBadge status={entry.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-[var(--color-text-tertiary)]">
                        <span className="font-medium text-[var(--color-text-secondary)]">
                          {entry.amount.toLocaleString('ko-KR')}원
                        </span>
                        <span>{entry.vendorName}</span>
                        {entry.relatedDoc && <span>{entry.relatedDoc}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(entry)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                      <PencilLine size={14} />
                    </button>
                    <button
                      onClick={() => handleGenerate(entry)}
                      disabled={generating === entry.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                    >
                      {generating === entry.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      <span className="hidden sm:inline">HWPX</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && !sheetError && (
        <div className="text-center py-16 text-[var(--color-text-tertiary)]">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm font-medium">기안문 데이터가 없습니다</div>
          <div className="text-xs mt-1">&quot;수동 추가&quot; 버튼을 눌러 새 기안문을 작성하세요</div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? '기안문 수정' : '기안문 추가'} size="lg">
        <div className="space-y-4">
          {/* Row 1: Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">건명 *</label>
            <input
              value={editForm.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="예: 2026 지역사회 비만예방 캠페인 부스 렌탈비 지급"
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>

          {/* Row 2: Type + Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">경비구분</label>
              <select
                value={editForm.expenseType}
                onChange={e => updateField('expenseType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="일상경비">일상경비</option>
                <option value="여비">여비</option>
                <option value="업무추진비">업무추진비</option>
                <option value="특수활동비">특수활동비</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">금액 (원)</label>
              <input
                type="number"
                value={editForm.amount || ''}
                onChange={e => updateField('amount', parseInt(e.target.value) || 0)}
                placeholder="544000"
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Amount preview */}
          {editForm.amount > 0 && (
            <div className="text-xs text-[var(--color-primary)] bg-blue-50 px-3 py-2 rounded-lg">
              💰 {formatAmount(editForm.amount)}
            </div>
          )}

          {/* Row 3: Vendor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">업체명</label>
              <input
                value={editForm.vendorName}
                onChange={e => updateField('vendorName', e.target.value)}
                placeholder="티트리렌탈"
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">사업자등록번호</label>
              <input
                value={editForm.vendorRegNo}
                onChange={e => updateField('vendorRegNo', e.target.value)}
                placeholder="580-04-02685"
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Row 4: Related Doc + Recipient */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">관련문서</label>
              <input
                value={editForm.relatedDoc}
                onChange={e => updateField('relatedDoc', e.target.value)}
                placeholder="보건행정과-1809(2026.02.12.)"
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">수신</label>
              <input
                value={editForm.recipient}
                onChange={e => updateField('recipient', e.target.value)}
                placeholder="내부결재"
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Row 5: Budget Account */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">예산과목</label>
            <input
              value={editForm.budgetAccount}
              onChange={e => updateField('budgetAccount', e.target.value)}
              placeholder="보건행정과, 건강도시 조성, 건강증진사업관리, 일반운영비, 행사운영비"
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Row 6: Payment Method */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">지급방법</label>
            <input
              value={editForm.paymentMethod}
              onChange={e => updateField('paymentMethod', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={saveEntry}
              disabled={!editForm.title.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {editingId ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
