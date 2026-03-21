'use client';

import { cn, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/utils';
import { Status, Priority } from '@/types';
import { X } from 'lucide-react';

// ============================================================
// Status Badge
// ============================================================
export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

// ============================================================
// Priority Badge
// ============================================================
export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.bg, config.color)}>
      {config.label}
    </span>
  );
}

// ============================================================
// Progress Bar
// ============================================================
export function ProgressBar({
  value,
  size = 'md',
  showLabel = true,
  color,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: string;
}) {
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
  const barColor =
    value === 100
      ? 'bg-emerald-500'
      : value >= 70
      ? 'bg-blue-500'
      : value >= 40
      ? 'bg-amber-500'
      : value > 0
      ? 'bg-orange-500'
      : 'bg-gray-300';

  return (
    <div className="flex items-center gap-2 w-full">
      <div className={cn('flex-1 bg-gray-100 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 animate-progress', color || barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-gray-500 w-10 text-right tabular-nums">
          {value}%
        </span>
      )}
    </div>
  );
}

// ============================================================
// Modal
// ============================================================
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full max-h-[85vh] flex flex-col animate-fade-in', widths[size])}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// Page Header
// ============================================================
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-gray-300 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-400 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
