import React, { useState } from 'react';
import { X, ListTodo, Archive, CalendarDays, Zap } from 'lucide-react';

interface AddDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSignal: (text: string) => void;
  onAddTask: (title: string, desc: string) => void;
  onAddKnowledge: (title: string, content: string) => void;
  onAddMeeting: (title: string, notes: string) => void;
}

export function AddDataModal({ isOpen, onClose, onAddSignal, onAddTask, onAddKnowledge, onAddMeeting }: AddDataModalProps) {
  const [type, setType] = useState<'signal' | 'task' | 'knowledge' | 'meeting'>('signal');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim() && type !== 'signal') {
      alert('제목을 입력해주세요.');
      return;
    }
    if (type === 'signal' && !content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    if (type === 'signal') onAddSignal(content);
    if (type === 'task') onAddTask(title, content);
    if (type === 'knowledge') onAddKnowledge(title, content);
    if (type === 'meeting') onAddMeeting(title, content);
    
    setTitle(''); 
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">새로운 데이터 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button 
              onClick={() => setType('signal')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${type === 'signal' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Zap size={18} />
              <span className="text-xs font-semibold">시그널</span>
            </button>
            <button 
              onClick={() => setType('task')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${type === 'task' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <ListTodo size={18} />
              <span className="text-xs font-semibold">업무</span>
            </button>
            <button 
              onClick={() => setType('knowledge')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${type === 'knowledge' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <Archive size={18} />
              <span className="text-xs font-semibold">지식</span>
            </button>
            <button 
              onClick={() => setType('meeting')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${type === 'meeting' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              <CalendarDays size={18} />
              <span className="text-xs font-semibold">미팅</span>
            </button>
          </div>

          <div className="space-y-3 mt-4">
            {type !== 'signal' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">제목</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="제목을 입력하세요..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{type === 'signal' ? '시그널 내용' : '상세 내용'}</label>
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={type === 'signal' ? "떠오르는 아이디어나 시그널을 자유롭게 메모하세요..." : "선택사항입니다."}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            취소
          </button>
          <button 
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
