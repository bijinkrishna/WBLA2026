'use client';

import AppShell from '@/components/AppShell';
import { PageHeader, ProgressBar, StatusBadge } from '@/components/ui';
import { useCellSummary, useActivities } from '@/lib/hooks';
import { cn, STATUS_CONFIG, formatDate, formatRelativeLabel, isOverdue } from '@/lib/utils';
import type { CellProgressSummary, Status } from '@/types';
import {
  LayoutDashboard,
  Building2,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { summaries, loading: cellsLoading } = useCellSummary();
  const { activities, loading: activitiesLoading } = useActivities();

  const loading = cellsLoading || activitiesLoading;

  // Aggregate stats
  const totalActivities = summaries.reduce((s, c) => s + c.total_activities, 0);
  const totalSubActivities = summaries.reduce((s, c) => s + c.total_sub_activities, 0);
  const avgProgress = summaries.length > 0
    ? Math.round(summaries.reduce((s, c) => s + c.avg_progress, 0) / summaries.length)
    : 0;
  const totalCompleted = summaries.reduce((s, c) => s + c.completed, 0);
  const totalDelayed = summaries.reduce((s, c) => s + c.delayed, 0);
  const totalInProgress = summaries.reduce((s, c) => s + c.in_progress, 0);

  // Flatten all activities to find overdue and upcoming
  const allActivities = activities.flatMap(a => [a, ...(a.sub_activities || [])]);
  const overdueActivities = allActivities.filter(a => isOverdue(a.end_date, a.status));
  const upcomingActivities = allActivities
    .filter(a => a.status !== 'completed' && a.start_date)
    .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())
    .slice(0, 5);

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-[1400px]">
        {/* Title Band */}
        <div className="mb-8 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute right-20 bottom-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative z-10">
            <p className="text-white/60 text-xs font-medium tracking-widest uppercase mb-1">
              District Election Office &middot; Paschim Medinipur
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              WBLA 2026
            </h1>
            <p className="text-white/70 text-sm mt-1">
              West Bengal Legislative Assembly Elections &middot; {summaries.length} Cells Active
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
          <StatCard
            icon={<Building2 size={20} />}
            label="Active Cells"
            value={summaries.length}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={<ListChecks size={20} />}
            label="Total Activities"
            value={totalActivities}
            sub={`+ ${totalSubActivities} sub-activities`}
            color="bg-violet-50 text-violet-600"
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Completed"
            value={totalCompleted}
            sub={`${totalInProgress} in progress`}
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={<AlertTriangle size={20} />}
            label="Overdue / Delayed"
            value={overdueActivities.length + totalDelayed}
            color="bg-red-50 text-red-600"
            alert={overdueActivities.length + totalDelayed > 0}
          />
        </div>

        {/* Overall Progress */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-500" />
              <h3 className="font-semibold text-gray-900">Overall Election Readiness</h3>
            </div>
            <span className="text-2xl font-bold text-brand-500">{avgProgress}%</span>
          </div>
          <ProgressBar value={avgProgress} size="lg" showLabel={false} color="bg-brand-500" />
        </div>

        {/* Two-column: Cell Grid + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cell Progress Grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Cell-wise Progress</h3>
              <Link
                href="/cells"
                className="text-xs text-brand-500 hover:underline flex items-center gap-1"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
              {summaries.map((cell) => (
                <CellCard key={cell.cell_id} cell={cell} />
              ))}
            </div>
          </div>

          {/* Alerts & Upcoming */}
          <div className="space-y-6">
            {/* Overdue */}
            {overdueActivities.length > 0 && (
              <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm">
                <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} />
                  Overdue Activities ({overdueActivities.length})
                </h3>
                <div className="space-y-2">
                  {overdueActivities.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-sm">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: a.cell?.color || '#DC2626' }}
                      />
                      <div className="min-w-0">
                        <p className="text-gray-800 truncate font-medium">{a.title}</p>
                        <p className="text-xs text-gray-400">
                          Due: {a.schedule_type === 'relative' && a.anchor && a.end_offset_days != null
                            ? formatRelativeLabel(a.anchor, a.end_offset_days)
                            : formatDate(a.end_date)} &middot; {a.cell?.short_code}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Clock size={16} />
                Upcoming Activities
              </h3>
              <div className="space-y-2">
                {upcomingActivities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-sm">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: a.cell?.color || '#3B82F6' }}
                    />
                    <div className="min-w-0">
                      <p className="text-gray-800 truncate font-medium">{a.title}</p>
                      <p className="text-xs text-gray-400">
                        {a.schedule_type === 'relative' && a.anchor && a.start_offset_days != null
                          ? formatRelativeLabel(a.anchor, a.start_offset_days, a.end_offset_days ?? undefined)
                          : formatDate(a.start_date)} &middot; {a.progress}% &middot; {a.cell?.short_code}
                      </p>
                    </div>
                  </div>
                ))}
                {upcomingActivities.length === 0 && (
                  <p className="text-xs text-gray-400">No upcoming activities</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ============================================================
// Sub-components
// ============================================================
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 shadow-sm',
      alert ? 'border-red-200' : 'border-gray-100'
    )}>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', color)}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CellCard({ cell }: { cell: CellProgressSummary }) {
  return (
    <Link
      href={`/activities?cell=${cell.cell_id}`}
      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: cell.color }}
        >
          {cell.short_code.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-500 transition-colors">
            {cell.cell_name}
          </p>
          <p className="text-[11px] text-gray-400">
            {cell.total_activities} activities &middot; {cell.short_code}
          </p>
        </div>
      </div>
      <ProgressBar value={cell.avg_progress} size="sm" />
      <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {cell.completed} done
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          {cell.in_progress} active
        </span>
        {cell.delayed > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            {cell.delayed} delayed
          </span>
        )}
      </div>
    </Link>
  );
}
