'use client';

import React, { useState } from 'react';
import { KnowledgeEntry } from '@/types';
import { BookOpen, Search, Plus, Tag, Trash2, Edit2 } from 'lucide-react';
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
  const [isAdding, setIsAdding] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');

  const filtered = filterKnowledge({ search, category: activeCategory, tag: activeTag });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="암묵지 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus size={18} /> 새 지식 등록
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => { setActiveCategory(''); setActiveTag(''); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!activeCategory && !activeTag ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          전체
        </button>
        {metadata.categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setActiveTag(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === cat ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {cat}
          </button>
        ))}
        {metadata.tags.map(tag => (
          <button
            key={tag}
            onClick={() => { setActiveTag(tag); setActiveCategory(''); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTag === tag ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Tag size={12} /> {tag}
          </button>
        ))}
      </div>

      {isAdding && (
        <Card className="p-4 border-blue-200 bg-blue-50/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-medium text-blue-900 border-b border-blue-100 pb-2">새 암묵지 등록</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" placeholder="제목 (키워드 포함)" value={title} onChange={e => setTitle(e.target.value)} 
                className="px-3 py-2 border rounded-lg focus:ring-2 outline-none border-blue-200" autoFocus required 
              />
              <input 
                type="text" placeholder="카테고리 (예: 보고, 미팅, 엑셀)" value={category} onChange={e => setCategory(e.target.value)} 
                className="px-3 py-2 border rounded-lg focus:ring-2 outline-none border-blue-200" 
              />
            </div>
            <textarea 
              placeholder="내용 (상세한 어드바이스, 팁 등)" value={content} onChange={e => setContent(e.target.value)} 
              className="w-full h-24 px-3 py-2 border rounded-lg focus:ring-2 outline-none resize-none border-blue-200" required
            />
            <input 
              type="text" placeholder="태그 (쉼표로 구분. 예: 기획,영업,임원보고)" value={tags} onChange={e => setTags(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none border-blue-200 text-sm" 
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">취소</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">저장</button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400">
            <BookOpen className="mx-auto mb-3 opacity-50" size={32} />
            <p>등록된 지식이 없습니다.</p>
          </div>
        ) : (
          filtered.map(entry => (
            <Card key={entry.id} className="p-5 flex flex-col hover:border-blue-200 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {entry.category && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{entry.category}</span>}
                  <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                </div>
                <button onClick={() => deleteKnowledge(entry.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-600 flex-1 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
              
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-4 pt-3 border-t border-gray-100">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Tag size={10} /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
