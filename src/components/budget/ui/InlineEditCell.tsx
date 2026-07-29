'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface InlineEditCellProps {
  value: string | number;
  onSave: (newValue: string) => void;
  onCancel?: () => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
  type?: 'text' | 'number' | 'date';
  className?: string;
  placeholder?: string;
  cellId?: string;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  inputClassName?: string;
  displayFormatter?: (val: string | number) => React.ReactNode;
}

export const InlineEditCell = React.memo<InlineEditCellProps>(({
  value,
  onSave,
  onCancel,
  onNavigate,
  type = 'text',
  className = '',
  placeholder = '',
  cellId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  inputClassName = '',
  displayFormatter
}) => {
  const [isInternalEditing, setIsInternalEditing] = useState(false);
  const editing = isEditing !== undefined ? isEditing : isInternalEditing;
  const [prevValue, setPrevValue] = useState(value);
  const [tempValue, setTempValue] = useState<string>(
    value !== undefined && value !== null ? String(value) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommittedRef = useRef(false);

  if (prevValue !== value) {
    setPrevValue(value);
    setTempValue(value !== undefined && value !== null ? String(value) : '');
  }

  useEffect(() => {
    if (editing) {
      isCommittedRef.current = false;
      if (inputRef.current) {
        inputRef.current.focus();
        if (typeof inputRef.current.select === 'function') {
          inputRef.current.select();
        }
      }
    }
  }, [editing, value]);

  const exitEditMode = () => {
    if (onCancelEdit) {
      onCancelEdit();
    }
    if (onCancel) {
      onCancel();
    }
    setIsInternalEditing(false);
  };

  const handleCommit = () => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;

    const cleanStr = type === 'number' ? tempValue.replace(/,/g, '').trim() : tempValue;
    if (cleanStr !== String(value !== undefined && value !== null ? value : '')) {
      onSave(tempValue);
    }
    exitEditMode();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleCommit();
      if (onNavigate) {
        onNavigate(e.shiftKey ? 'prev' : 'next');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCommittedRef.current = true;
      setTempValue(value !== undefined && value !== null ? String(value) : '');
      exitEditMode();
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartEdit) {
      onStartEdit();
    }
    setIsInternalEditing(true);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-cell-id={cellId}
        type={type === 'date' ? 'date' : 'text'}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`px-2 py-0.5 text-xs border-2 border-indigo-500 rounded-md outline-none bg-white font-mono shadow-inner text-slate-800 transition-all ${inputClassName || className}`}
      />
    );
  }

  return (
    <div
      data-cell-id={cellId}
      onDoubleClick={handleStartEdit}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={`cursor-pointer hover:bg-indigo-50/70 hover:outline hover:outline-1 hover:outline-indigo-300 rounded px-1.5 py-0.5 transition-colors select-none ${className}`}
      title="더블클릭하여 빠르게 수정"
    >
      {displayFormatter
        ? displayFormatter(value)
        : (value !== undefined && value !== null && value !== ''
            ? value
            : placeholder || '-')}
    </div>
  );
});

InlineEditCell.displayName = 'InlineEditCell';
