import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Status, Priority } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  delayed: { label: 'Delayed', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  medium: { label: 'Medium', color: 'text-blue-700', bg: 'bg-blue-100' },
  low: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function isOverdue(endDate: string | null, status: Status): boolean {
  if (!endDate || status === 'completed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(endDate + 'T00:00:00');
  return due < today; // Overdue only if due date (start of day) is before today
}

export function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d >= today;
}

export function formatRelativeLabel(
  anchor: 'polling' | 'counting',
  startOffset: number,
  endOffset?: number | null
): string {
  const prefix = anchor === 'polling' ? 'P' : 'C';
  const start = startOffset >= 0 ? `${prefix}+${startOffset}` : `${prefix}${startOffset}`;
  if (endOffset != null && endOffset !== startOffset) {
    const end = endOffset >= 0 ? `${prefix}+${endOffset}` : `${prefix}${endOffset}`;
    return `${start} → ${end}`;
  }
  return start;
}
