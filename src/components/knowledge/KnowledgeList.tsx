'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { KnowledgeEntry } from '@/types';
import { BookOpen, Search, Plus, Tag, Trash2, Edit2, X, Check, SearchX } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface KnowledgeListProps {
  entries: KnowledgeEntry[];
  addKnowledge: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateKnowledge: (id: string, updates: Partial<KnowledgeEntry>) => void;
  deleteKnowledge: (id: string) => void;
  filterKnowledge: (filters: { search?: string; category?: string; tag?: string }) => KnowledgeEntry[];
  metadata: { categories: string[]; tags: string[] };
}

export function KnowledgeList({ entries, addKnowledge, updateKnowledge, deleteKnowledge, filterKnowledge, metadata }: KnowledgeListProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [activeTag, setActiveTag] = useState<string>('');
  
  // View states
  const [isAdding, setIsAdding] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  
  // Add form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');

  const filtered = filterKnowledge({ search, category: activeCategory, tag: activeTag });

  const activeEntry = useMemo(() => {
    return filtered.find(f => f.id === selectedEntryId) || null;
  }, [filtered, selectedEntryId]);

  // If the active filter hides the selected entry, deselect it (unless you want to keep the right pane locked).
  // Keeping it simple: it stays selected if it's in `filtered`.
  useEffect(() => {
    if (selectedEntryId && !filtered.find(f => f.id === selectedEntryId)) {
        if (!isAdding && !editingId) {
            setSelectedEntryId(null);
        }
    }
  }, [filtered, selectedEntryId, isAdding, editingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    addKnowledge({
      title: title.trim(),
      content: content.trim(),
      category: category.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
    });
    
    setTitle('');
    setContent('');
    setCategory('');
    setTags('');
    setIsAdding(false);
  };

  const startEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setEditCategory(entry.category || '');
    setEditTags(entry.tags.join(', '));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    updateKnowledge(editingId, {
      title: editTitle.trim(),
      content: editContent.trim(),
      category: editCategory.trim(),
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setEditingId(null);
  };

  const inputClass = "w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm transition-shadow";

  const renderRightPane = () => {
    if (isAdding) {
      return (
        <div className="p-6 h-full overflow-y-auto bg-blue-50/20">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto mt-4">
            <h3 className="text-xl font-bold text-blue-900 border-b border-blue-100 pb-3 flex items-center gap-2">
              <Plus size={20} /> 새 암묵지 등록
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" placeholder="제목 (키워드 포함)" value={title} onChange={e => setTitle(e.target.value)} 
                className="px-3 py-2.5 border rounded-lg shadow-sm focus:ring-2 outline-none border-blue-200" autoFocus required 
              />
              <input 
                type="text" placeholder="카테고리 (예: 지식/문서)" value={category} onChange={e => setCategory(e.target.value)} 
                className="px-3 py-2.5 border rounded-lg shadow-sm focus:ring-2 outline-none border-blue-200" 
              />
            </div>
            <textarea 
              placeholder="내용 (상세한 지식, 가이드라인 등)" value={content} onChange={e => setContent(e.target.value)} 
              className="w-full h-64 px-3 py-3 border rounded-lg shadow-sm focus:ring-2 outline-none resize-none border-blue-200 leading-relaxed" required
            />
            <input 
              type="text" placeholder="태그 (쉼표로 구분)" value={tags} onChange={e => setTags(e.target.value)} 
              className="w-full px-3 py-2.5 border rounded-lg shadow-sm focus:ring-2 outline-none border-blue-200 text-sm" 
            />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">취소</button>
              <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm">저장</button>
            </div>
          </form>
        </div>
      );
    }

    if (editingId && activeEntry) {
      return (
        <div className="p-6 h-full overflow-y-auto bg-amber-50/20">
          <div className="space-y-4 max-w-2xl mx-auto mt-4">
            <h3 className="text-xl font-bold text-amber-800 border-b border-amber-200 pb-3 flex items-center gap-2">
               <Edit2 size={20} /> 암묵지 수정
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="제목"
                className={`${inputClass} border-amber-200 focus:ring-amber-400 py-2.5 shadow-sm`}
                autoFocus
              />
              <input
                type="text"
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="카테고리"
                className={`${inputClass} border-amber-200 focus:ring-amber-400 py-2.5 shadow-sm`}
              />
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="내용"
              className={`${inputClass} border-amber-200 focus:ring-amber-400 resize-none h-64 leading-relaxed shadow-sm`}
            />
            <input
              type="text"
              value={editTags}
              onChange={e => setEditTags(e.target.value)}
              placeholder="태그 (쉼표로 구분)"
              className={`${inputClass} border-amber-200 focus:ring-amber-400 py-2.5 shadow-sm`}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
              >
                <Check size={16} /> 수정 완료
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeEntry) {
      return (
        <div className="flex flex-col h-full bg-white">
          <div className="px-8 py-7 border-b border-gray-100 bg-gray-50/30">
             <div className="flex justify-between items-start">
               <div>
                 {activeEntry.category && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-md mb-3 inline-block">{activeEntry.category}</span>}
                 <h2 className="text-2xl font-black text-gray-900 mb-2">{activeEntry.title}</h2>
                 <div className="text-xs font-medium text-gray-400">등록일: {new Date(activeEntry.createdAt).toLocaleDateString()}</div>
               </div>
               <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                 <button onClick={() => startEdit(activeEntry)} className="text-gray-500 hover:text-amber-600 hover:bg-amber-50 p-1.5 rounded transition-all cursor-pointer flex items-center gap-1 text-xs font-bold" title="수정">
                   <Edit2 size={14} /> 수정
                 </button>
                 <div className="w-px h-4 bg-gray-200"></div>
                 <button onClick={() => { if(window.confirm('정말 삭제하시겠습니까?')) { deleteKnowledge(activeEntry.id); setSelectedEntryId(null); } }} className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-all cursor-pointer flex items-center gap-1 text-xs font-bold" title="삭제">
                   <Trash2 size={14} /> 삭제
                 </button>
               </div>
             </div>
          </div>
          <div className="p-8 flex-1 overflow-y-auto w-full custom-scrollbar">
             <div className="text-[15px] whitespace-pre-wrap text-gray-700 leading-[1.8] max-w-4xl">
                {activeEntry.content}
             </div>
             
             {activeEntry.tags && activeEntry.tags.length > 0 && (
               <div className="flex flex-wrap gap-2 mt-12 pt-6 border-t border-gray-100 max-w-4xl">
                 {activeEntry.tags.map(tag => (
                   <span key={tag} className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1 border border-gray-200">
                     <Tag size={12} /> {tag}
                   </span>
                 ))}
               </div>
             )}
          </div>
        </div>
      );
    }

    // Default Empty State
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 bg-gray-50/50 h-full">
         <BookOpen size={64} className="mb-5 opacity-20 text-gray-500" />
         <h3 className="text-lg font-bold text-gray-500 mb-2">선택된 메모가 없습니다</h3>
         <p className="text-sm font-medium">좌측에서 메모를 선택하거나 새 메모를 등록하세요.</p>
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col min-h-[calc(100vh-140px)]">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-shrink-0">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="제목, 내용 또는 카테고리 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {metadata.categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(activeCategory === cat ? '' : cat); setActiveTag(''); setSelectedEntryId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${activeCategory === cat ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {cat}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-1 hidden sm:block"></div>
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setSelectedEntryId(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex-shrink-0 ${isAdding ? 'bg-blue-800 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            <Plus size={16} /> 새 메모 작성
          </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* Left List Pane */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col gap-2.5 overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar pb-4">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
              <SearchX className="mx-auto mb-3 opacity-30" size={32} />
              <p className="text-sm font-bold">검색 결과가 없습니다.</p>
            </div>
          ) : (
            filtered.map(entry => {
              const isSelected = selectedEntryId === entry.id && !isAdding;
              return (
                <div
                  key={entry.id}
                  onClick={() => { setSelectedEntryId(entry.id); setIsAdding(false); setEditingId(null); }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-blue-600 bg-blue-50/30 ring-1 ring-blue-600 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className={`font-bold text-[14px] line-clamp-1 flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>{entry.title}</h3>
                  </div>
                  <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed mb-3">{entry.content}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                      {entry.category && <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{entry.category}</span>}
                    </div>
                    <span className="text-[10px] font-medium text-gray-400">
                      {new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col relative h-[500px] lg:h-auto">
           {renderRightPane()}
        </div>
      </div>
    </div>
  );
}
