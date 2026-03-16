import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ value, color = 'var(--color-primary)', height = 6, showLabel = false, className = '' }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const barColor = clampedValue >= 90 ? 'var(--color-danger)' : clampedValue >= 70 ? 'var(--color-warning)' : color;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height, backgroundColor: 'rgba(0,0,0,0.04)' }}>
        <div
          className="rounded-full progress-fill"
          style={{ width: `${clampedValue}%`, height: '100%', backgroundColor: barColor }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-[var(--color-text-secondary)] min-w-[32px] text-right">
          {clampedValue}%
        </span>
      )}
    </div>
  );
}
