import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const MultiSelectDropdown = ({ 
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
