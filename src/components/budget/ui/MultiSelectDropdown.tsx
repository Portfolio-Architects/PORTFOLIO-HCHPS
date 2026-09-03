import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export type DropdownOption = string | { value: string; suffix?: string };

function getOptValue(opt: DropdownOption): string {
  return typeof opt === 'string' ? opt : opt.value;
}

function getOptSuffix(opt: DropdownOption): string {
  return typeof opt === 'string' ? '' : opt.suffix || '';
}

interface MultiSelectDropdownProps {
  label: string; 
  options: DropdownOption[]; 
  selected: string[]; 
  onChange: (val: string[]) => void;
  disabled?: boolean;
}

function MultiSelectDropdownComponent({ 
  label, 
  options, 
  selected, 
  onChange,
  disabled
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAll = selected.length === 0;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (optStr: string) => {
    if (selectedSet.has(optStr)) {
      const next: string[] = [];
      for (let i = 0; i < selected.length; i++) {
        if (selected[i] !== optStr) next.push(selected[i]);
      }
      onChange(next);
    } else {
      onChange([...selected, optStr]);
    }
  };

  return (
    <div className="relative inline-block w-full sm:max-w-[220px]">
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white focus:ring-1 focus:ring-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        <span className="truncate">{isAll ? `${label} 전체` : `${selected.length}개 선택됨${selected.length === 1 ? ` (${selected[0]})` : ''}`}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto min-w-max">
            <div 
              className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
              onClick={() => { onChange([]); setIsOpen(false); }}
            >
              <input type="checkbox" checked={isAll} readOnly className="mr-2" />
              <span className="text-sm font-medium text-blue-600">{label} 전체</span>
            </div>
            {options.map((opt, i) => {
              const val = getOptValue(opt);
              const suffix = getOptSuffix(opt);
              return (
                <div 
                  key={`${val}-${i}`}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 group"
                  onClick={() => toggle(val)}
                >
                  <div className="flex items-center min-w-[120px] max-w-[200px] pr-3">
                    <input type="checkbox" checked={selectedSet.has(val)} readOnly className="mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate" title={val}>{val}</span>
                  </div>
                  {suffix && <span className="text-[11px] font-semibold text-gray-400 group-hover:text-blue-500 whitespace-nowrap">{suffix}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

MultiSelectDropdownComponent.displayName = 'MultiSelectDropdown';
export const MultiSelectDropdown = React.memo(MultiSelectDropdownComponent);
