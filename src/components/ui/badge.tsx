import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-[var(--color-text-secondary)]',
  primary: 'bg-[rgba(74,108,247,0.1)] text-[var(--color-primary)]',
  success: 'bg-[rgba(16,185,129,0.1)] text-[var(--color-success)]',
  warning: 'bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)]',
  danger: 'bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)]',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
