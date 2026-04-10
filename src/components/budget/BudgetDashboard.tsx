'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { BudgetCategory, BudgetEntry, BudgetActionType, generateId } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Modal } from '@/components/ui/modal';
import { extractTextFromPdfBuffer } from '@/lib/pdf-parser';
import { askLlama } from '@/lib/llm-client';
import { Plus, Pencil, Trash2, FileCheck, FilePlus2, CheckCircle2, AlertOctagon, ShieldAlert, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { replaceAll } from '@/lib/sheets-api';

interface BudgetDashboardProps {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => BudgetCategory;
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void;
  deleteCategory: (id: string) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  getCategoryStats: (id: string) => { 
    totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number;
    generalSpent: number; dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  } | null;
  overallStats: { 
    totalBudget: number; totalSpent: number; totalPlanned: number; remaining: number;
    dailyExpenseIssued: number; dailyExpenseSpent: number; dailyExpenseRemaining: number;
  };
  addKnowledge?: (k: { title: string; content: string; category: string; tags: string[] }) => void;
}

function formatN(n: number) { return n.toLocaleString('ko-KR'); }

const COLORS = ['#4A6CF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const ACTION_TYPE_CONFIG: Record<BudgetActionType, { label: string; badge: string; badgeBg: string; icon: typeof FilePlus2 }> = {
  general: { label: '일반 지출', badge: '일반', badgeBg: 'bg-blue-100 text-blue-700', icon: FileCheck },
  issuance: { label: '일상경비 교부', badge: '교부', badgeBg: 'bg-amber-100 text-amber-700', icon: FilePlus2 },
  daily_expense: { label: '일상경비 지출', badge: '경비지출', badgeBg: 'bg-teal-100 text-teal-700', icon: FileCheck },
};

const MultiSelectDropdown = ({ 
  label, 
  options, 
  selected, 
  onChange,
  disabled
}: { 
  label: string; 
  options: string[]; 
  selected: string[]; 
  onChange: (val: string[]) => void;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isAll = selected.length === 0;

  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter(o => o !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className="relative inline-block w-full sm:max-w-[200px]">
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white focus:ring-1 focus:ring-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        <span className="truncate">{isAll ? `${label} 전체` : `${selected.length}개 선택됨${selected.length === 1 ? ` (${selected[0]})` : ''}`}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            <div 
              className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
              onClick={() => { onChange([]); setIsOpen(false); }}
            >
              <input type="checkbox" checked={isAll} readOnly className="mr-2" />
              <span className="text-sm font-medium text-blue-600">{label} 전체</span>
            </div>
            {options.map(opt => (
              <div 
                key={opt}
                className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50"
                onClick={() => toggle(opt)}
              >
                <input type="checkbox" checked={selected.includes(opt)} readOnly className="mr-2" />
                <span className="text-sm text-gray-700 truncate">{opt}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
};

const PolicyGroupCard = React.memo(({
  group,
  entries,
  getCategoryStats,
  deleteCategory,
  deleteEntry,
  openEditCat,
  openEditEntry
}: {
  group: { policyName: string; cats: BudgetCategory[] };
  entries: BudgetEntry[];
  getCategoryStats: (id: string) => { totalBudget: number; spent: number; planned: number; remaining: number; usageRate: number } | null;
  deleteCategory: (id: string) => void;
  deleteEntry: (id: string) => void;
  openEditCat: (cat: BudgetCategory) => void;
  openEditEntry: (entry: BudgetEntry) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { policyName, cats } = group;

  const { totalBudget, spent, planned, remaining, usageRate, groupEntries, groupedByDetail } = useMemo(() => {
    const tBudget = cats.reduce((s, c) => s + c.totalBudget, 0);
    let tSpent = 0; let tPlanned = 0; let tRemaining = 0;
    
    cats.forEach(c => {
      const st = getCategoryStats(c.id);
      if (st) { tSpent += st.spent; tPlanned += st.planned; tRemaining += st.remaining; }
    });
    
    const rate = tBudget > 0 ? Math.round((tSpent / tBudget) * 100) : 0;
    
    const catIds = cats.map(c => c.id);
    const gEntries = entries
      .filter(e => catIds.includes(e.categoryId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by detailedProject
    const groups: { detailName: string; cats: BudgetCategory[] }[] = [];
    cats.forEach(cat => {
      const detail = cat.detailedProject || '분류되지 않은 세부사업';
      let group = groups.find(g => g.detailName === detail);
      if (!group) {
        group = { detailName: detail, cats: [] };
        groups.push(group);
      }
      group.cats.push(cat);
    });

    return { totalBudget: tBudget, spent: tSpent, planned: tPlanned, remaining: tRemaining, usageRate: rate, groupEntries: gEntries, groupedByDetail: groups };
  }, [cats, entries, getCategoryStats]);

  return (
    <Card className="overflow-hidden border border-[var(--color-border-light)] shadow-sm mb-3 last:mb-0">
      <div 
        className="px-5 py-4 cursor-pointer hover:opacity-90 transition-all border-l-4"
        style={{ 
          borderLeftColor: cats[0]?.color || 'var(--color-border-light)',
          backgroundColor: cats[0]?.color ? `${cats[0].color}0D` : '#F9FAFB'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cats[0]?.color || 'var(--color-primary)' }} />
            <h3 className="font-bold text-[17px] text-gray-800">{policyName}</h3>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-xs text-gray-500 font-medium px-2.5 py-1 rounded-full bg-gray-200">단위사업 {cats.length}개</div>
             <div className="text-gray-400">{isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</div>
          </div>
        </div>
        <div className="flex justify-between text-sm mb-1.5 px-1">
          <span className="text-[var(--color-text-secondary)] font-semibold">총 사용 {formatN(spent)}원 / {formatN(totalBudget)}원</span>
          <span className="text-[var(--color-primary)] font-bold">잔여 {formatN(remaining)}원</span>
        </div>
        <ProgressBar value={usageRate} showLabel />
        {planned > 0 && <div className="text-xs text-amber-600 mt-1.5 font-medium px-1">📋 품의 예정액: {formatN(planned)}원</div>}
      </div>
      
      {isOpen && (
        <div className="px-5 py-3 divide-y divide-gray-100">
          {groupedByDetail.map(detailGroup => (
            <div key={detailGroup.detailName} className="py-3 first:pt-0">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded bg-[var(--color-primary)]/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                </div>
                <div className="text-[14px] font-bold text-gray-800">{detailGroup.detailName}</div>
              </div>
              <div className="space-y-3 pl-2">
                {detailGroup.cats.map(cat => {
                  const stats = getCategoryStats(cat.id);
                  if (!stats) return null;
                  return (
                    <div key={cat.id} className="group/item">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}/>
                          <div className="line-clamp-1">{cat.statItem || cat.name}</div>
                          <span className="text-xs text-gray-400 font-normal truncate hidden sm:block max-w-[200px]">({cat.name})</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEditCat(cat)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Pencil size={12} /></button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mb-1.5 pl-[14px]">
                        <span className="text-gray-500">사용 {formatN(stats.spent)} / {formatN(stats.totalBudget)}</span>
                        <span className="text-gray-600 font-bold">잔여 {formatN(stats.remaining)}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                         <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, stats.usageRate)}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          
          {groupEntries.length > 0 && (
            <div className="pt-3 space-y-2 mt-2">
              <div className="text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">최근 지출 내역</div>
              {groupEntries.slice(0, 6).map(entry => {
                const cfg = ACTION_TYPE_CONFIG[entry.actionType || 'general'] || ACTION_TYPE_CONFIG['general'];
                const parentCat = cats.find(c => c.id === entry.categoryId);
                return (
                  <div key={entry.id} className="flex items-center justify-between text-xs group bg-gray-50/60 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${cfg.badgeBg}`}>{cfg.badge}</span>
                      <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1 py-0.5 rounded truncate max-w-[70px] hidden sm:block">{parentCat?.unitProject || '알수없음'}</span>
                      {entry.docRegNum && <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 py-0.5 rounded truncate max-w-[100px] hidden sm:block">{entry.docRegNum}</span>}
                      <span className="text-[var(--color-text-secondary)] font-medium truncate">{entry.purpose}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                       <span className="font-semibold text-gray-700">{formatN(entry.amount)}원</span>
                       <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                         <button onClick={() => openEditEntry(entry)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><Pencil size={12} /></button>
                         <button onClick={() => deleteEntry(entry.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                       </div>
                     </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
});
PolicyGroupCard.displayName = "PolicyGroupCard";

export function BudgetDashboard(props: BudgetDashboardProps) {
  const { categories, entries, addCategory, updateCategory, deleteCategory, addEntry, updateEntry, deleteEntry, getCategoryStats, overallStats } = props;
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [catName, setCatName] = useState('');
  const [catBudget, setCatBudget] = useState('');
  
  const [catPolicy, setCatPolicy] = useState('');
  const [catUnit, setCatUnit] = useState('');
  const [catDetail, setCatDetail] = useState('');
  const [catStat, setCatStat] = useState('');

  const [filterPolicy, setFilterPolicy] = useState<string[]>([]);
  const [filterUnit, setFilterUnit] = useState<string[]>([]);
  const [filterDetail, setFilterDetail] = useState<string[]>([]);
  const [filterStat, setFilterStat] = useState<string[]>([]);

  const [nationalFund, setNationalFund] = useState('');
  const [localFund, setLocalFund] = useState('');
  
  const [entryAmount, setEntryAmount] = useState('');
  const [entryPurpose, setEntryPurpose] = useState('');
  const [entryDocNum, setEntryDocNum] = useState('');
  const [entryMemo, setEntryMemo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [returnToEntryModal, setReturnToEntryModal] = useState(false);
  const [actionType, setActionType] = useState<BudgetActionType>('general');

  const [isLoaded, setIsLoaded] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  // Auto-Migration for Legacy Nomenclature
  useEffect(() => {
    let migrated = false;
    categories.forEach(cat => {
      if (cat.name && cat.name.includes('건강생활실천공통')) {
        updateCategory(cat.id, {
          ...cat,
          name: cat.name.replace('건강생활실천공통', '건강생활실천사업(건강증진)')
        });
        migrated = true;
      }
    });
    if (migrated) console.info('[Migration] Legacy category nomenclature updated.');
  }, [categories, updateCategory]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    try {
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromPdfBuffer(buffer);

      const categoryOptions = categories.map(c => `ID: ${c.id} | 분류: ${c.policyProject} > ${c.unitProject} > ${c.detailedProject} | 항목: ${c.statItem} | 별칭: ${c.name}`).join('\n');
      
      const systemPrompt = `
당신은 보건진흥과 예산 문서를 분석하여 아래 JSON 스키마로 정확하게 반환하는 스마트 스캐너입니다.
[사용 가능한 예산 카테고리 목록]
${categoryOptions}

다음 규칙을 엄격히 준수하세요:
1. 문서 내용에서 '지출 금액(원)', '사용 목적(적요)', 그리고 문맥상 완벽히 일치하는 예산 '항목(통계목)'을 찾아보세요.
2. 예산 과목 매칭: 위 목록 중 가장 관련성 높은 통계목(예: 사무관리비, 공공운영비 등 여비)을 찾아 그 항목에 해당하는 정확한 "ID"를 추출해야 합니다. 
3. 응답할 JSON은 반드시 'reasoning' 필드를 맨 처음 작성하여 지출 목적과 통계목 매칭의 논리적 이유를 스스로 설명한 뒤에 'categoryId' 등 나머지 필드를 작성하세요.
4. 금액은 숫자만 추출. 목적은 20자 이내로 요약.
5. 문서 하단 "시행 [문서번호] (날짜)" 패턴을 찾아 "시행 문서 번호"(예: 보건행정과-1234)와 해당 문서를 시행한 "날짜"(예: 2026-04-10)를 우선적으로 추출.
6. 응답은 오직 순수한 JSON 객체 문자열이어야 하며, 마크다운이나 백틱이 없어야 합니다.
형식: {"reasoning": "지출 목적이 XX이므로 YY항목이 적합함", "categoryId": "정확한ID", "amount": 1234, "purpose": "요약", "docNum": "보건행정과-123", "date": "2026-04-10"}
      `.trim();

      const responseText = await askLlama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[문서 원문]\n${text}\n\n위 문서를 분석하여 반드시 지정된 JSON 형식으로만 응답해.` }
      ]);

      let jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let result: any = null;

      try {
        result = JSON.parse(jsonStr);
      } catch (e1) {
        // 단일 객체 매칭 (첫번째 { } 블록)
        const objMatch = jsonStr.match(/\{[\s\S]*?\}/);
        // 배열 매칭 (첫번째 [ ] 블록)
        const arrMatch = jsonStr.match(/\[[\s\S]*?\]/);
        
        let parsed = false;
        if (arrMatch) {
          try {
            result = JSON.parse(arrMatch[0]);
            parsed = true;
          } catch(e) {}
        }
        
        if (!parsed && objMatch) {
          try {
            result = JSON.parse(objMatch[0]);
            parsed = true;
          } catch(e) {}
        }
        
        if (!parsed) {
          // 마지막 시도: 전체를 둘러보는 광범위 매칭
          const startIdx = jsonStr.indexOf('{');
          const endIdx = jsonStr.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            result = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
          } else {
            throw new Error('유효한 JSON 묶음을 찾을 수 없습니다.');
          }
        }
      }

      // 배열일 경우 다중 폼 중 첫번째만 로드하고 알림
      if (Array.isArray(result)) {
        if (result.length > 1) {
          alert(`여러 건(${result.length}건)의 내역이 분석되었습니다! 현재 폼에는 첫 번째 내역만 자동으로 입력됩니다.`);
        }
        result = result[0] || {};
      }

      if (result.categoryId) {
        let matchedCat = categories.find(c => c.id === String(result.categoryId).trim());
        
        if (!matchedCat) {
          const catStr = String(result.categoryId).trim().toLowerCase();
          
          // 1순위: AI 응답(catStr) 내에서 통계목 + 사업명(별칭) 동시 포함
          matchedCat = categories.find(c => {
            const hasStat = c.statItem && (catStr.includes(c.statItem.split('(')[0].trim().toLowerCase()) || catStr.includes(c.statItem.replace(/[^0-9-]/g, '')));
            const prefix = c.name ? c.name.split('-')[0].trim().substring(0, 6).toLowerCase() : '';
            const hasProj = (c.unitProject && catStr.includes(c.unitProject.toLowerCase())) ||
                            (prefix && catStr.includes(prefix));
            return hasStat && hasProj;
          });

          // 2순위: 카테고리 이름이나 별칭 직접 매칭
          if (!matchedCat) {
            matchedCat = categories.find(c => 
              c.name.toLowerCase() === catStr ||
              c.name.toLowerCase().includes(catStr) ||
              catStr.includes(c.name.toLowerCase())
            );
          }
        }

        // 3순위 (최후의 보루): AI가 매칭을 실패하거나 빈 값을 반환했을 경우, PDF 원본 텍스트(raw text)에서 직접 교집합 찾기
        if (!matchedCat) {
          const rawText = text.replace(/\s+/g, '').toLowerCase(); // 띄어쓰기 제거하여 매칭 확률 증가
          const scoredCats = categories.map(c => {
            let score = 0;
            // 통계목 검사 (예: "행사운영비", "201-03")
            const statWord = c.statItem ? c.statItem.split('(')[0].trim().toLowerCase() : '';
            const statNum = c.statItem ? c.statItem.replace(/[^0-9-]/g, '') : '';
            if (statWord && rawText.includes(statWord)) score += 10;
            if (statNum && rawText.includes(statNum)) score += 10;

            // 프로젝트 검사 (예: "건강생활실천", "건강도시조성")
            const prefix = c.name ? c.name.split('-')[0].trim().substring(0, 6).toLowerCase().replace(/\s+/g, '') : '';
            const unit = c.unitProject ? c.unitProject.toLowerCase().replace(/\s+/g, '') : '';
            if (unit && rawText.includes(unit)) score += 5;
            if (prefix && rawText.includes(prefix)) score += 5;

            return { cat: c, score };
          });

          // 통계목과 프로젝트가 둘 다 매칭되어 스코어가 15점 이상인 후보군 필터링
          const bestMatches = scoredCats.filter(sc => sc.score >= 15).sort((a, b) => b.score - a.score);
          if (bestMatches.length > 0) {
            matchedCat = bestMatches[0].cat;
          }
        }

        if (matchedCat) {
          setSelectedCatId(matchedCat.id);
        }
      }
      if (result.amount) {
        const amtStr = result.amount.toString().replace(/[^0-9]/g, '');
        setEntryAmount(amtStr ? Number(amtStr).toLocaleString('ko-KR') : '');
      }
      if (result.purpose) setEntryPurpose(result.purpose.substring(0, 30));
      
      // 1. LLM 파싱 결과 기본 할당
      let finalDocNum = result.docNum || '';
      let finalDate = (result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date)) ? result.date : '';

      // 2. 정규식(Regex)을 통한 초정밀 원본 텍스트 직접 추출 (우선순위 높음)
      const docRegex = /시행[\s\n]*([가-힣a-zA-Z0-9]+-\d+)[\s\n]*\([\s\n]*(\d{4})\.[\s\n]*(\d{1,2})\.[\s\n]*(\d{1,2})\.[\s\n]*\)/;
      const docMatch = text.match(docRegex);
      if (docMatch) {
        finalDocNum = docMatch[1]; // 보건행정과-3084
        const year = docMatch[2];
        const month = docMatch[3].padStart(2, '0');
        const day = docMatch[4].padStart(2, '0');
        finalDate = `${year}-${month}-${day}`;
      }

      if (finalDocNum) setEntryDocNum(finalDocNum);
      if (finalDate) setEntryDate(finalDate);

      alert('✅ AI가 지출 품의서를 성공적으로 분석하여 폼을 채웠습니다.');
    } catch (err: any) {
      console.error('PDF 파싱 오류:', err);
      alert('문서 분석에 실패했습니다. 형식 오류 또는 네트워크 문제일 수 있습니다.\n상세오류: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsParsingPdf(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hchps-budget-filters-v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.policy)) setFilterPolicy(parsed.policy);
        if (Array.isArray(parsed.unit)) setFilterUnit(parsed.unit);
        if (Array.isArray(parsed.detail)) setFilterDetail(parsed.detail);
        if (Array.isArray(parsed.stat)) setFilterStat(parsed.stat);
      }
    } catch (e) {}
    setIsLoaded(true);
  }, []);

  const handleSaveFilters = () => {
    localStorage.setItem('hchps-budget-filters-v2', JSON.stringify({
      policy: filterPolicy,
      unit: filterUnit,
      detail: filterDetail,
      stat: filterStat
    }));
    alert('✅ 현재 필터링 상태가 저장되었습니다. 앞으로 페이지 접속 시 이 필터가 유지됩니다.');
  };

  const handleResetFilters = () => {
    setFilterPolicy([]);
    setFilterUnit([]);
    setFilterDetail([]);
    setFilterStat([]);
    localStorage.removeItem('hchps-budget-filters-v2');
  };
  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow";
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catBudget) return;

    // 매칭비율 3:7 검증 로직 (전체 예산 입력 & 국비/시비 입력 시)
    if (nationalFund && localFund) {
      const nat = Number(nationalFund);
      const loc = Number(localFund);
      const total = Number(catBudget);
      if (nat + loc !== total) {
        alert('Error: 국비와 지방비의 합이 총 예산과 일치하지 않습니다.');
        return;
      }
      const natRatio = nat / total;
      if (Math.abs(natRatio - 0.3) > 0.05) {
        alert('Warning: 서울시 통합건강증진사업 지침에 따른 [국비 30% : 지방비 70%] 매칭 비율을 충족하지 않습니다. 계속 진행하시겠습니까?');
      }
    }

    if (editCatId) {
      updateCategory(editCatId, { name: catName, totalBudget: Number(catBudget), policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, statItem: catStat });
    } else {
      addCategory({ name: catName, totalBudget: Number(catBudget), color: COLORS[categories.length % COLORS.length], policyProject: catPolicy, unitProject: catUnit, detailedProject: catDetail, statItem: catStat });
    }
    setCatName(''); setCatBudget(''); setNationalFund(''); setLocalFund('');
    setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatStat('');
    setEditCatId(null); setShowCatModal(false);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryAmount || !entryPurpose.trim() || !selectedCatId) return;
    
    // 예산 지침 컴플라이언스 룰 검증
    const targetCat = categories.find(c => c.id === selectedCatId);
    const stats = targetCat ? getCategoryStats(targetCat.id) : null;
    const reqAmount = Number(entryAmount.replace(/,/g, ''));
    
    // 0. 중복 지출 방지 (최근 7일 내 동일 예산과목 & 동일 금액)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const isDuplicate = entries.some(e => 
      e.categoryId === selectedCatId && 
      e.amount === reqAmount &&
      e.date >= sevenDaysAgo
    );

    if (isDuplicate) {
      if (!window.confirm(`[경고] 최근 7일 내에 동일한 금액(${formatN(reqAmount)}원)이 같은 과목으로 지출된 이력이 있습니다.\n중복 등록입니까? 그래도 진행하시겠습니까?`)) {
        return;
      }
    }

    // 1. 가용 잔액 확인
    if (stats) {
      if (actionType === 'general' || actionType === 'issuance') {
        if (reqAmount > stats.remaining) {
          alert(`Error: 일반 예산 잔액이 부족합니다. (현재 가용 실 잔액: ${formatN(stats.remaining)}원)`);
          return;
        }
      } else if (actionType === 'daily_expense') {
        if (reqAmount > stats.dailyExpenseRemaining) {
          alert(`Error: 일상경비 통장 가용 잔액이 부족합니다. (현재 가용 잔액: ${formatN(stats.dailyExpenseRemaining)}원)`);
          return;
        }
      }
    }

    // 2. 금지 비목 차단 (블랙리스트)
    if (entryPurpose.includes('자산취득') || entryPurpose.includes('컴퓨터') || entryPurpose.includes('장비') || targetCat?.name.includes('자산취득비') || targetCat?.name.includes('인건비')) {
      alert('Error: 통합건강증진사업 지침상 자산취득성 사업비 및 인건비 편성이 불가합니다.');
      return;
    }

    // 3. 오분류 방지
    if (entryPurpose.includes('자문료') || entryPurpose.includes('속기료') || entryPurpose.includes('사례금') || entryPurpose.includes('수수료')) {
      if (!targetCat?.name.includes('일반수용비') && !targetCat?.name.includes('210-01')) {
        alert("Error: 지침 위반. 전문가 자문 등은 반드시 '일반수용비(210-01목)'로 집행해야 합니다.");
        return;
      }
    }

    // 4. 편법 지출 방지 경고
    if (entryPurpose.includes('일용임금') || entryPurpose.includes('행정보조')) {
      if (!window.confirm("Warning: 계속 고용 금지 및 중복 계상 금지 지침 재확인 요망. 불필요한 일용인력 계속 고용은 감사 대상입니다. 계속 진행할까요?")) {
        return;
      }
    }

    if (editEntryId) {
      updateEntry(editEntryId, {
        categoryId: selectedCatId,
        amount: reqAmount,
        date: entryDate,
        purpose: entryPurpose,
        memo: entryMemo,
        actionType,
        docRegNum: entryDocNum,
      });
    } else {
      addEntry({
        categoryId: selectedCatId,
        amount: reqAmount,
        date: entryDate,
        purpose: entryPurpose,
        memo: entryMemo,
        actionType,
        docRegNum: entryDocNum,
      });
    }
    closeEntryModal();
  };

  const closeEntryModal = () => {
    setEntryAmount(''); setEntryPurpose(''); setEntryMemo(''); setEntryDocNum(''); setEditEntryId(null); setShowEntryModal(false);
  };

  const openEditCat = (cat: BudgetCategory) => {
    setCatName(cat.name); setCatBudget(cat.totalBudget.toString());
    setCatPolicy(cat.policyProject || ''); setCatUnit(cat.unitProject || '');
    setCatDetail(cat.detailedProject || ''); setCatStat(cat.statItem || '');
    setEditCatId(cat.id); setShowCatModal(true);
  };

  const openEntryModal = () => {
    setEditEntryId(null);
    setShowEntryModal(true);
  };

  const handleInlineAddCat = () => {
    setShowEntryModal(false);
    setReturnToEntryModal(true);
    setEditCatId(null);
    setCatName(''); setCatPolicy(''); setCatUnit(''); setCatDetail(''); setCatStat(''); setCatBudget('');
    setShowCatModal(true);
  };

  const handleInlineEditCat = () => {
    const cat = categories.find(c => c.id === selectedCatId);
    if (!cat) return;
    setShowEntryModal(false);
    setReturnToEntryModal(true);
    openEditCat(cat);
  };

  const handleInlineDeleteCat = () => {
    if (!selectedCatId) return;
    if (window.confirm("정말 이 예산 과목을 삭제하시겠습니까? 관련 지출 항목들도 모두 삭제됩니다.")) {
      deleteCategory(selectedCatId);
      setSelectedCatId('');
    }
  };

  const openEditEntry = (entry: BudgetEntry) => {
    setEditEntryId(entry.id);
    setSelectedCatId(entry.categoryId);
    setEntryAmount(entry.amount.toLocaleString('ko-KR'));
    setEntryDate(entry.date);
    setEntryPurpose(entry.purpose);
    setEntryMemo(entry.memo || '');
    setEntryDocNum(entry.docRegNum || '');
    setActionType(entry.actionType || 'general');
    setShowEntryModal(true);
  };

  const currentMonth = new Date().getMonth() + 1;
  const isEndOfYearApproaching = currentMonth >= 11;
  
  // 위험 사업 추출 (집행률 70% 미만이면서 하반기, 또는 연말인데 가용액 10% 이상인 경우)
  const riskCategories = useMemo(() => {
    return categories.map(cat => {
      const st = getCategoryStats(cat.id);
      if (!st) return null;
      if (currentMonth >= 9 && st.usageRate < 70) return { cat, st, reason: '3분기 집행률 70% 미만' };
      if (isEndOfYearApproaching && (st.remaining / st.totalBudget) >= 0.1) return { cat, st, reason: '회계연도 마감 임박 (가용 잔액 10% 초과)' };
      return null;
    }).filter(Boolean);
  }, [categories, getCategoryStats, currentMonth, isEndOfYearApproaching]);

  // Hierarchical Filter Calculation
  const uniquePolicies = useMemo(() => Array.from(new Set(categories.map(c => c.policyProject).filter(Boolean))), [categories]);
  const unitOptions = useMemo(() => Array.from(new Set(categories.filter(c => filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')).map(c => c.unitProject).filter(Boolean))), [categories, filterPolicy]);
  const detailOptions = useMemo(() => Array.from(new Set(categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || ''))).map(c => c.detailedProject).filter(Boolean))), [categories, filterPolicy, filterUnit]);
  const statOptions = useMemo(() => Array.from(new Set(categories.filter(c => (filterPolicy.length === 0 || filterPolicy.includes(c.policyProject || '')) && (filterUnit.length === 0 || filterUnit.includes(c.unitProject || '')) && (filterDetail.length === 0 || filterDetail.includes(c.detailedProject || ''))).map(c => c.statItem).filter(Boolean))), [categories, filterPolicy, filterUnit, filterDetail]);

  const filteredCategoriesTree = useMemo(() => {
    return categories.filter(c => {
      if (filterPolicy.length > 0 && !filterPolicy.includes(c.policyProject || '')) return false;
      if (filterUnit.length > 0 && !filterUnit.includes(c.unitProject || '')) return false;
      if (filterDetail.length > 0 && !filterDetail.includes(c.detailedProject || '')) return false;
      if (filterStat.length > 0 && !filterStat.includes(c.statItem || '')) return false;
      return true;
    });
  }, [categories, filterPolicy, filterUnit, filterDetail, filterStat]);

  const groupedByPolicy = useMemo(() => {
    const groups: { policyName: string; cats: BudgetCategory[] }[] = [];
    filteredCategoriesTree.forEach(cat => {
      const policy = cat.policyProject || '분류되지 않음';
      let group = groups.find(g => g.policyName === policy);
      if (!group) {
        group = { policyName: policy, cats: [] };
        groups.push(group);
      }
      group.cats.push(cat);
    });
    return groups;
  }, [filteredCategoriesTree]);

  // Dynamic stats based on selected filters
  const filteredStats = useMemo(() => {
    let totalBudget = 0;
    let remaining = 0;
    let totalSpent = 0;

    let dailyExpenseIssued = 0;
    let dailyExpenseSpent = 0;
    let dailyExpenseRemaining = 0;

    filteredCategoriesTree.forEach(cat => {
      const catStats = getCategoryStats(cat.id);
      if (catStats) {
        totalBudget += catStats.totalBudget;
        remaining += catStats.remaining;
        totalSpent += catStats.spent;
        dailyExpenseIssued += catStats.dailyExpenseIssued;
        dailyExpenseSpent += catStats.dailyExpenseSpent;
        dailyExpenseRemaining += catStats.dailyExpenseRemaining;
      }
    });

    return { totalBudget, remaining, totalSpent, dailyExpenseIssued, dailyExpenseSpent, dailyExpenseRemaining };
  }, [filteredCategoriesTree, getCategoryStats, entries]);

  return (
    <div className="space-y-6">
      
      {/* Risk Alert Widget */}
      {riskCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-700 font-bold">
            <ShieldAlert size={20} />
            <h2>불용액 발생 위험 - 긴급 모니터링 알림</h2>
          </div>
          <p className="text-xs text-red-600 mb-2">다음 사업들은 조기 집행 및 연말 잔액 소진 조치(추경 등)가 강력 권고됩니다.</p>
          <div className="flex flex-col gap-2">
            {riskCategories.map((item, id) => (
              <div key={id} className="flex flex-wrap items-center justify-between text-xs bg-white/50 px-3 py-2 rounded-lg">
                <span className="font-semibold text-gray-800">[{item?.cat.name}]</span>
                <span className="text-red-600 font-medium">{item?.reason}</span>
                <span className="text-gray-600">현재 잔액: <strong className="text-red-700">{formatN(item?.st.remaining ?? 0)}원</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">예산 관리</h2>
        <div className="flex gap-2">
          <button onClick={() => openEntryModal()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer" disabled={categories.length === 0}>
            <FilePlus2 size={16} /> 지출 품의
          </button>
        </div>
      </div>

      {/* Hierarchical Filters */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border-light)] p-3 rounded-xl shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm font-bold text-gray-700">다중 필터링 시스템</div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveFilters} className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors">
              구성 저장하기
            </button>
            <button onClick={handleResetFilters} className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center gap-1.5">
              <RefreshCw size={14} /> 초기화 및 해제
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MultiSelectDropdown label="정책사업명" options={uniquePolicies as string[]} selected={filterPolicy} onChange={val => { setFilterPolicy(val); setFilterUnit([]); setFilterDetail([]); setFilterStat([]); }} />
          <MultiSelectDropdown label="단위사업명" options={unitOptions as string[]} selected={filterUnit} onChange={val => { setFilterUnit(val); setFilterDetail([]); setFilterStat([]); }} disabled={unitOptions.length === 0} />
          <MultiSelectDropdown label="세부사업명" options={detailOptions as string[]} selected={filterDetail} onChange={val => { setFilterDetail(val); setFilterStat([]); }} disabled={detailOptions.length === 0} />
          <MultiSelectDropdown label="통계목" options={statOptions as string[]} selected={filterStat} onChange={val => setFilterStat(val)} disabled={statOptions.length === 0} />
        </div>
      </div>

      {/* Overall Summary (3-way split) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="h-full flex flex-col justify-center">
          <div className="text-xs text-[var(--color-text-tertiary)]">전체 (총 예산/총 지출)</div>
          <div className="text-lg font-bold mt-1 text-gray-800">{formatN(filteredStats.totalBudget)}원</div>
          <div className="text-xs font-semibold mt-1 text-gray-500">지출계: {formatN(filteredStats.totalSpent)}원</div>
        </CardContent></Card>
        
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/50"><CardContent className="h-full flex flex-col justify-center">
          <div className="text-[11px] font-bold text-blue-600 mb-1">일반 계좌</div>
          <div className="text-sm font-bold text-gray-700">일반 지출: {formatN(filteredStats.totalSpent - filteredStats.dailyExpenseIssued)}원</div>
          <div className="text-sm font-bold mt-1 text-blue-700">잔여: {formatN(filteredStats.remaining)}원</div>
        </CardContent></Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-50/50"><CardContent className="h-full flex flex-col justify-center">
          <div className="text-[11px] font-bold text-amber-600 mb-1">일상경비 통장 이체내역</div>
          <div className="text-sm font-bold text-gray-700">교부액 (이체원금): {formatN(filteredStats.dailyExpenseIssued)}원</div>
          <div className="text-sm font-bold mt-1 text-amber-700">실지출액: {formatN(filteredStats.dailyExpenseSpent)}원</div>
        </CardContent></Card>

        <Card className="border-[var(--color-border-light)]"><CardContent className="h-full flex flex-col justify-center">
          <div className="text-[11px] font-bold text-teal-600 mb-1">일상경비 통장 가용 잔액</div>
          <div className="text-xl font-black mt-1 text-teal-700">{formatN(filteredStats.dailyExpenseRemaining)}원</div>
        </CardContent></Card>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Card><div className="px-5 py-10 text-center text-sm text-[var(--color-text-tertiary)]">예산 과목을 추가해 보세요</div></Card>
      ) : (
        <div className="space-y-3">
          {groupedByPolicy.length === 0 && <div className="text-center text-sm text-gray-500 py-8">선택된 필터에 해당하는 예산 과목이 없습니다.</div>}
          {groupedByPolicy.map(group => (
            <PolicyGroupCard
              key={group.policyName}
              group={group}
              entries={entries}
              getCategoryStats={getCategoryStats}
              deleteCategory={deleteCategory}
              deleteEntry={deleteEntry}
              openEditCat={openEditCat}
              openEditEntry={openEditEntry}
            />
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal isOpen={showCatModal} onClose={() => { 
        setShowCatModal(false); 
        if (returnToEntryModal) { setShowEntryModal(true); setReturnToEntryModal(false); } 
      }} title={editCatId ? '예산 과목 수정' : '새 예산 과목'} size="lg">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">정책사업명</label><input type="text" value={catPolicy} onChange={e => setCatPolicy(e.target.value)} className={inputClass} placeholder="예: 건강도시조성" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">단위사업명</label><input type="text" value={catUnit} onChange={e => setCatUnit(e.target.value)} className={inputClass} placeholder="예: 찾아가는 보건소" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">세부사업명</label><input type="text" value={catDetail} onChange={e => setCatDetail(e.target.value)} className={inputClass} placeholder="예: 방문간호운영" /></div>
            <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">통계목</label><input type="text" value={catStat} onChange={e => setCatStat(e.target.value)} className={inputClass} placeholder="예: 일반수용비(210-01)" /></div>
          </div>
          
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">별칭명 (단축 과목명) *</label><input type="text" value={catName} onChange={e => setCatName(e.target.value)} className={inputClass} required placeholder="예: 방문간호 일반수용비" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">총 예산액 (원) *</label><input type="number" value={catBudget} onChange={e => setCatBudget(e.target.value)} className={inputClass} required placeholder="0" /></div>
          
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
             <div className="text-xs font-bold text-gray-600 mb-2">보건복지부 / 수도권 비율 매칭 검증 (선택)</div>
             <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[11px] text-gray-500 mb-1">국비 (30%)</label><input type="number" value={nationalFund} onChange={e => setNationalFund(e.target.value)} className={inputClass} placeholder="입력" /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">지방비 (70%)</label><input type="number" value={localFund} onChange={e => setLocalFund(e.target.value)} className={inputClass} placeholder="입력" /></div>
             </div>
          </div>

          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">{editCatId ? '수정' : '추가'}</button>
        </form>
      </Modal>

      {/* Entry Modal */}
      <Modal isOpen={showEntryModal} onClose={() => setShowEntryModal(false)} title="지출 등록" size="sm">
        <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
          {(Object.keys(ACTION_TYPE_CONFIG) as BudgetActionType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setActionType(type)}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-1 rounded-md text-[13px] font-bold transition-all ${actionType === type ? 'bg-white text-gray-900 shadow font-black' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              {ACTION_TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
        <form onSubmit={handleAddEntry} className="space-y-4">
          
          {/* AI Parser Widget */}
          <div className="relative border border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-4 text-center hover:bg-blue-50 transition-colors">
             <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={isParsingPdf} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
             <div className="flex flex-col items-center justify-center pointer-events-none">
                {isParsingPdf ? (
                   <div className="flex flex-col items-center gap-2">
                     <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-xs text-blue-600 font-bold animate-pulse">AI 모델로 실시간 분석 중...</span>
                   </div>
                ) : (
                   <>
                     <div className="text-blue-400 mb-1.5"><FilePlus2 size={24} className="mx-auto" /></div>
                     <div className="text-[13px] font-bold text-blue-800">스마트 파일 인식 (PDF 업로드)</div>
                     <div className="text-[11px] text-blue-600/70">이곳에 품의서를 끌어다 놓으면 폼이 자동으로 채워집니다.</div>
                   </>
                )}
             </div>
          </div>

          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">예산 과목 *</label>
            <div className="flex items-center gap-2">
              <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={`${inputClass} flex-1`} required>
                <option value="">선택</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={handleInlineAddCat} className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="과목 추가">
                <Plus size={16} />
              </button>
              <button type="button" onClick={handleInlineEditCat} disabled={!selectedCatId} className="p-2.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors" title="과목 수정">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={handleInlineDeleteCat} disabled={!selectedCatId} className="p-2.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors" title="과목 삭제">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">금액 (원) *</label>
             <input type="text" value={entryAmount} onChange={e => {
               const raw = e.target.value.replace(/[^0-9]/g, '');
               setEntryAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
             }} className={inputClass} required placeholder="0" />
          </div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">품의 내용 *</label><input type="text" value={entryPurpose} onChange={e => setEntryPurpose(e.target.value)} className={inputClass} required placeholder="어떤 지출을 승인받을 건지" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">시행 문서 번호</label><input type="text" value={entryDocNum} onChange={e => setEntryDocNum(e.target.value)} className={inputClass} placeholder="예: 찾아가는보건팀-1234 (선택)" /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">날짜</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputClass} /></div>
          <div><label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">메모</label><input type="text" value={entryMemo} onChange={e => setEntryMemo(e.target.value)} className={inputClass} placeholder="추가 메모 (선택)" /></div>
          <button
            type="submit"
            className={`w-full px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm ${
              actionType === 'general' ? 'bg-blue-600' : actionType === 'issuance' ? 'bg-amber-500' : 'bg-teal-600'
            }`}
          >
            {ACTION_TYPE_CONFIG[actionType].label} 등록
          </button>
        </form>
      </Modal>
    </div>
  );
}
