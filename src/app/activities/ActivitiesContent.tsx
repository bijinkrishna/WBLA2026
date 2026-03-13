'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import {
  PageHeader,
  Modal,
  StatusBadge,
  PriorityBadge,
  ProgressBar,
  EmptyState,
} from '@/components/ui';
import ActivityForm from '@/components/activities/ActivityForm';
import { useCells, useActivities } from '@/lib/hooks';
import { cn, formatDate, formatRelativeLabel, isOverdue } from '@/lib/utils';
import type { Activity, ActivityFormData } from '@/types';
import {
  Plus,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Plus as PlusIcon,
  Search,
  ArrowRight,
} from 'lucide-react';

export default function ActivitiesContent() {
  const searchParams = useSearchParams();
  const cellFilter = searchParams.get('cell') || '';

  const { cells } = useCells();
  const { activities, loading, upsert, remove, updateProgress } = useActivities(cellFilter || undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [parentForSub, setParentForSub] = useState<Activity | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCell, setSelectedCell] = useState(cellFilter);
  const [statusFilter, setStatusFilter] = useState('');

  // Filtered activities
  const filteredActivities = useMemo(() => {
    let result = activities;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.sub_activities?.some((s) => s.title.toLowerCase().includes(q))
      );
    }
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    return result;
  }, [activities, searchQuery, statusFilter]);

  // Map activity id -> activity (for dependency labels)
  const idToActivity = useMemo(() => {
    const map = new Map<string, Activity>();
    const add = (a: Activity) => {
      map.set(a.id, a);
      a.sub_activities?.forEach(add);
    };
    activities.forEach(add);
    return map;
  }, [activities]);

  // Group by cell for visual classification
  const groupedByCell = useMemo(() => {
    const cellMap = new Map(cells.map((c) => [c.id, c]));
    const map = new Map<string, { cell: typeof cells[0]; activities: Activity[] }>();
    filteredActivities.forEach((a) => {
      if (!a.cell) return;
      const cell = cellMap.get(a.cell_id) || a.cell;
      if (!map.has(a.cell_id)) {
        map.set(a.cell_id, { cell: cell as typeof cells[0], activities: [] });
      }
      map.get(a.cell_id)!.activities.push(a);
    });
    return Array.from(map.values()).sort((a, b) => a.cell.sort_order - b.cell.sort_order);
  }, [filteredActivities, cells]);

  const toggleExpand = (id: string) => {
    setExpandedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    setEditingActivity(null);
    setParentForSub(null);
    setModalOpen(true);
  };

  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setParentForSub(null);
    setModalOpen(true);
  };

  const handleAddSub = (parent: Activity) => {
    setEditingActivity(null);
    setParentForSub(parent);
    setModalOpen(true);
  };

  const handleSubmit = async (data: ActivityFormData, id?: string) => {
    await upsert(data, id);
    setModalOpen(false);
    setEditingActivity(null);
    setParentForSub(null);
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Delete activity "${title}" and all sub-activities?`)) {
      await remove(id);
    }
  };

  const currentCell = cells.find((c) => c.id === selectedCell);

  return (
    <AppShell>
      <div className="px-8 py-6 max-w-[1400px]">
        <PageHeader
          title="Activities"
          subtitle={currentCell ? `${currentCell.name} (${currentCell.short_code})` : 'All cells'}
          action={
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Add Activity
            </button>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activities..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>

          {/* Cell filter */}
          <select
            value={selectedCell}
            onChange={(e) => {
              setSelectedCell(e.target.value);
              // Update URL
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set('cell', e.target.value);
              else url.searchParams.delete('cell');
              window.history.replaceState({}, '', url.toString());
              window.location.reload();
            }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">All Cells</option>
            {cells.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_code} — {c.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">All Status</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
            <option value="on_hold">On Hold</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">
            {filteredActivities.length} activities
          </span>
        </div>

        {/* Activities Table */}
        {filteredActivities.length === 0 && !loading ? (
          <EmptyState
            icon={<ListChecks size={48} />}
            title="No activities found"
            description={searchQuery ? 'Try different search terms.' : 'Add your first activity to get started.'}
            action={
              !searchQuery && (
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
                >
                  Add Activity
                </button>
              )
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_90px_70px_130px_80px] gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Activity</span>
              <span>Start</span>
              <span>End</span>
              <span>Duration</span>
              <span>Priority</span>
              <span>Progress</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows grouped by cell */}
            <div className="divide-y divide-gray-50">
              {groupedByCell.map(({ cell, activities: cellActivities }) => (
                <div key={cell.id}>
                  {/* Cell header */}
                  <div
                    className="flex items-center gap-2 px-5 py-2.5 font-semibold text-sm"
                    style={{ backgroundColor: cell.color + '18', borderLeft: `4px solid ${cell.color}` }}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cell.color }}
                    />
                    <span className="text-gray-800">
                      {cell.short_code} — {cell.name}
                    </span>
                    <span className="text-xs font-normal text-gray-500">
                      {cellActivities.length} {cellActivities.length === 1 ? 'activity' : 'activities'}
                    </span>
                  </div>
                  {/* Cell activities */}
                  {cellActivities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      idToActivity={idToActivity}
                      expanded={expandedActivities.has(activity.id)}
                      onToggle={() => toggleExpand(activity.id)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onAddSub={handleAddSub}
                      onUpdateProgress={updateProgress}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <Modal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingActivity(null);
            setParentForSub(null);
          }}
          title={
            parentForSub
              ? `Add Sub-Activity`
              : editingActivity
              ? 'Edit Activity'
              : 'Add New Activity'
          }
          size="lg"
        >
          <ActivityForm
            activity={editingActivity}
            cells={cells}
            activities={activities}
            parentActivity={parentForSub}
            defaultCellId={parentForSub?.cell_id || selectedCell || cells[0]?.id}
            onSubmit={handleSubmit}
            onCancel={() => {
              setModalOpen(false);
              setEditingActivity(null);
              setParentForSub(null);
            }}
          />
        </Modal>
      </div>
    </AppShell>
  );
}

// ============================================================
// Activity Row
// ============================================================
function ActivityRow({
  activity,
  idToActivity,
  expanded,
  depth = 0,
  onToggle,
  onEdit,
  onDelete,
  onAddSub,
  onUpdateProgress,
}: {
  activity: Activity;
  idToActivity: Map<string, Activity>;
  expanded: boolean;
  depth?: number;
  onToggle: () => void;
  onEdit: (a: Activity) => void;
  onDelete: (id: string, title: string) => void;
  onAddSub: (parent: Activity) => void;
  onUpdateProgress: (id: string, progress: number, status?: string) => void;
}) {
  const hasSubs = activity.sub_activities && activity.sub_activities.length > 0;
  const overdue = isOverdue(activity.end_date, activity.status);

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-[1fr_100px_100px_90px_70px_130px_80px] gap-2 px-5 py-3 items-center hover:bg-gray-50/50 transition-colors',
          overdue && 'bg-red-50/30',
          depth > 0 && 'bg-gray-50/30'
        )}
      >
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 24 }}>
          {hasSubs ? (
            <button onClick={onToggle} className="p-0.5 text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          {!activity.parent_activity_id && activity.cell && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: activity.cell.color }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm truncate', depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700')}>
              {activity.title}
            </p>
            {depth === 0 && activity.cell && (
              <p className="text-[11px] text-gray-400">{activity.cell.short_code}</p>
            )}
            {activity.depends_on && activity.depends_on.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                <ArrowRight size={10} className="text-indigo-500 flex-shrink-0" />
                <span className="text-[10px] text-gray-500">Depends on:</span>
                {(activity.depends_on || [])
                  .map((id) => idToActivity.get(id))
                  .filter(Boolean)
                  .map((dep) => (
                    <span
                      key={dep!.id}
                      className="inline-flex items-center max-w-[140px] truncate px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                      title={dep!.title}
                    >
                      {dep!.cell?.short_code ? `[${dep!.cell.short_code}] ` : ''}{dep!.title}
                    </span>
                  ))}
              </div>
            )}
          </div>
          {activity.is_milestone && (
            <span className="text-amber-500 text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 rounded flex-shrink-0">
              ◆ MS
            </span>
          )}
          <StatusBadge status={activity.status} />
        </div>

        {/* Dates */}
        <span className={cn('text-xs tabular-nums', overdue ? 'text-red-600 font-medium' : 'text-gray-500')} title={activity.start_date ? formatDate(activity.start_date) : undefined}>
          {activity.schedule_type === 'relative' && activity.anchor != null && activity.start_offset_days != null
            ? formatRelativeLabel(activity.anchor, activity.start_offset_days, activity.end_offset_days ?? undefined)
            : formatDate(activity.start_date)}
        </span>
        <span className={cn('text-xs tabular-nums', overdue ? 'text-red-600 font-medium' : 'text-gray-500')} title={activity.end_date ? formatDate(activity.end_date) : undefined}>
          {activity.schedule_type === 'relative' && activity.anchor != null && activity.start_offset_days != null
            ? (activity.end_offset_days != null && activity.end_offset_days !== activity.start_offset_days
                ? (activity.anchor === 'polling' ? 'P' : 'C') + (activity.end_offset_days >= 0 ? `+${activity.end_offset_days}` : `${activity.end_offset_days}`)
                : '—')
            : formatDate(activity.end_date)}
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          {activity.duration_days ? `${activity.duration_days}d` : '—'}
        </span>

        {/* Priority */}
        <PriorityBadge priority={activity.priority} />

        {/* Progress */}
        <ProgressBar value={activity.progress} size="sm" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
          {depth === 0 && (
            <button
              onClick={() => onAddSub(activity)}
              title="Add sub-activity"
              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <PlusIcon size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(activity)}
            title="Edit"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(activity.id, activity.title)}
            title="Delete"
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Sub-activities */}
      {expanded &&
        hasSubs &&
        activity.sub_activities!.map((sub) => (
          <ActivityRow
            key={sub.id}
            activity={sub}
            idToActivity={idToActivity}
            expanded={false}
            depth={1}
            onToggle={() => {}}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddSub={onAddSub}
            onUpdateProgress={onUpdateProgress}
          />
        ))}
    </>
  );
}
