'use client';

import { useState, useEffect } from 'react';
import type { Cell, Activity, ActivityFormData, Priority, Status, ScheduleType, AnchorType } from '@/types';

function formatOffsetLabel(anchor: AnchorType, offset: number): string {
  const prefix = anchor === 'polling' ? 'P' : 'C';
  return offset >= 0 ? `${prefix}+${offset}` : `${prefix}${offset}`;
}

interface ActivityFormProps {
  activity?: Activity | null;
  cells: Cell[];
  activities: Activity[]; // flattened for dependency selector
  parentActivity?: Activity | null;
  defaultCellId?: string;
  onSubmit: (data: ActivityFormData, id?: string) => Promise<void>;
  onCancel: () => void;
}

function flattenActivities(activities: Activity[]): Activity[] {
  const out: Activity[] = [];
  for (const a of activities) {
    out.push(a);
    if (a.sub_activities?.length) out.push(...flattenActivities(a.sub_activities));
  }
  return out;
}

export default function ActivityForm({
  activity,
  cells,
  activities,
  parentActivity,
  defaultCellId,
  onSubmit,
  onCancel,
}: ActivityFormProps) {
  const [form, setForm] = useState<ActivityFormData>({
    cell_id: defaultCellId || '',
    parent_activity_id: parentActivity?.id || null,
    depends_on_ids: [],
    schedule_type: 'absolute',
    anchor: null,
    start_offset_days: null,
    end_offset_days: null,
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    priority: 'medium',
    status: 'not_started',
    progress: 0,
    assigned_to: '',
    remarks: '',
    is_milestone: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activity) {
      setForm({
        cell_id: activity.cell_id,
        parent_activity_id: activity.parent_activity_id,
        depends_on_ids: activity.depends_on || [],
        schedule_type: (activity.schedule_type as ScheduleType) || 'absolute',
        anchor: (activity.anchor as AnchorType | null) || null,
        start_offset_days: activity.start_offset_days ?? null,
        end_offset_days: activity.end_offset_days ?? null,
        title: activity.title,
        description: activity.description || '',
        start_date: activity.start_date || '',
        end_date: activity.end_date || '',
        priority: activity.priority,
        status: activity.status,
        progress: activity.progress,
        assigned_to: activity.assigned_to || '',
        remarks: activity.remarks || '',
        is_milestone: activity.is_milestone,
      });
    }
  }, [activity]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.cell_id) return;
    if (form.schedule_type === 'relative' && (form.anchor == null || form.start_offset_days == null)) return;
    setSaving(true);
    try {
      await onSubmit(form, activity?.id);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const update = <K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isRelative = form.schedule_type === 'relative';
  const duration = isRelative
    ? form.start_offset_days != null && form.end_offset_days != null
      ? form.end_offset_days - form.start_offset_days + 1
      : form.start_offset_days != null
      ? 1
      : null
    : form.start_date && form.end_date
    ? Math.ceil(
        (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    : null;

  return (
    <div className="space-y-4">
      {/* Parent reference */}
      {parentActivity && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          <span className="text-blue-600 font-medium">Sub-activity of:</span>{' '}
          <span className="text-blue-800">{parentActivity.title}</span>
        </div>
      )}

      {/* Cell + Title */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cell *</label>
          <select
            value={form.cell_id}
            onChange={(e) => update('cell_id', e.target.value)}
            disabled={!!parentActivity}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white disabled:bg-gray-50"
          >
            <option value="">Select Cell</option>
            {cells.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_code} — {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Activity Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. First Level Checking of EVMs"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
          placeholder="Details about this activity"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
        />
      </div>

      {/* Schedule type + Dates / Relative */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-gray-600">Schedule by</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="schedule_type"
              checked={form.schedule_type === 'absolute'}
              onChange={() => update('schedule_type', 'absolute')}
              className="text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm">Fixed dates</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="schedule_type"
              checked={form.schedule_type === 'relative'}
              onChange={() => update('schedule_type', 'relative')}
              className="text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm">Relative to election (P-2, C-1)</span>
          </label>
        </div>

        {isRelative ? (
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-amber-50/50 border border-amber-100">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Anchor *</label>
              <select
                value={form.anchor || ''}
                onChange={(e) => update('anchor', (e.target.value || null) as AnchorType | null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
              >
                <option value="">Select</option>
                <option value="polling">Polling Day (P)</option>
                <option value="counting">Counting Day (C)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Start {form.anchor ? formatOffsetLabel(form.anchor, form.start_offset_days ?? 0) : ''}
              </label>
              <input
                type="number"
                value={form.start_offset_days ?? ''}
                onChange={(e) => update('start_offset_days', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="e.g. -2"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">Negative = before, positive = after</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                End {form.anchor && form.end_offset_days != null ? formatOffsetLabel(form.anchor, form.end_offset_days) : '(optional)'}
              </label>
              <input
                type="number"
                value={form.end_offset_days ?? ''}
                onChange={(e) => update('end_offset_days', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="Same as start if empty"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">Resolves when Polling/Counting date is set</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => update('end_date', e.target.value)}
                min={form.start_date || undefined}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
              <div className="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-600 tabular-nums">
                {duration ? `${duration} days` : '—'}
              </div>
            </div>
          </div>
        )}
        {!isRelative && (
          <div className="text-xs text-gray-500">
            Duration: {duration ? `${duration} days` : '—'}
          </div>
        )}
        {isRelative && duration != null && (
          <div className="text-xs text-gray-500">
            Duration: {duration} day{duration !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Priority, Status, Progress */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => update('priority', e.target.value as Priority)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          >
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🔵 Medium</option>
            <option value="low">⚪ Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value as Status)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Progress: {form.progress}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress}
            onChange={(e) => update('progress', parseInt(e.target.value))}
            className="w-full mt-1 accent-brand-500"
          />
        </div>
      </div>

      {/* Assigned To + Milestone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
          <input
            type="text"
            value={form.assigned_to}
            onChange={(e) => update('assigned_to', e.target.value)}
            placeholder="Officer / team name"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_milestone}
              onChange={(e) => update('is_milestone', e.target.checked)}
              className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600">Mark as milestone</span>
          </label>
        </div>
      </div>

      {/* Dependencies */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Depends on (activities that must complete first)
        </label>
        <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2 space-y-1">
          {flattenActivities(activities)
            .filter((a) => a.id !== activity?.id && a.id !== parentActivity?.id)
            .map((a) => {
              const checked = (form.depends_on_ids || []).includes(a.id);
              return (
                <label
                  key={a.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const ids = form.depends_on_ids || [];
                      const next = checked ? ids.filter((id) => id !== a.id) : [...ids, a.id];
                      update('depends_on_ids', next);
                    }}
                    className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-gray-700 truncate">
                    {a.cell?.short_code ? `[${a.cell.short_code}] ` : ''}{a.title}
                    {a.parent_activity_id ? ' (sub)' : ''}
                  </span>
                </label>
              );
            })}
          {flattenActivities(activities).filter((a) => a.id !== activity?.id && a.id !== parentActivity?.id).length === 0 && (
            <p className="text-xs text-gray-400 py-2">No other activities to depend on</p>
          )}
        </div>
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
        <textarea
          value={form.remarks}
          onChange={(e) => update('remarks', e.target.value)}
          rows={2}
          placeholder="Any additional notes"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.title.trim() || !form.cell_id || (isRelative && (form.anchor == null || form.start_offset_days == null))}
          className="px-5 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : activity ? 'Update Activity' : 'Create Activity'}
        </button>
      </div>
    </div>
  );
}
