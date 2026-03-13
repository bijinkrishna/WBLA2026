'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { Cell, Activity, CellProgressSummary, GanttItem, ActivityFormData, CellFormData, ElectionSettings } from '@/types';

const supabase = createClient();

// ============================================================
// Cells
// ============================================================
export function useCells() {
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cells')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (!error && data) setCells(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (cell: CellFormData, id?: string) => {
    if (id) {
      const { error } = await supabase.from('cells').update(cell).eq('id', id);
      if (error) throw error;
    } else {
      const maxOrder = cells.length > 0 ? Math.max(...cells.map(c => c.sort_order)) + 1 : 0;
      const { error } = await supabase.from('cells').insert({ ...cell, sort_order: maxOrder });
      if (error) throw error;
    }
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('cells').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { cells, loading, refetch: fetch, upsert, remove };
}

// ============================================================
// Election Settings
// ============================================================
export function useElectionSettings() {
  const [settings, setSettings] = useState<ElectionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('election_settings').select('*').limit(1).single();
    if (!error && data) setSettings(data);
    else setSettings(null);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const update = async (polling_date: string | null, counting_date: string | null) => {
    const { data } = await supabase.from('election_settings').select('id').limit(1).single();
    if (data) {
      await supabase.from('election_settings').update({ polling_date, counting_date }).eq('id', data.id);
    } else {
      await supabase.from('election_settings').insert({ polling_date, counting_date });
    }
    await supabase.rpc('resolve_relative_activities');
    await fetch();
  };

  return { settings, loading, refetch: fetch, update };
}

// ============================================================
// Cell Progress Summary
// ============================================================
export function useCellSummary() {
  const [summaries, setSummaries] = useState<CellProgressSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cell_progress_summary')
      .select('*');
    if (!error && data) setSummaries(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { summaries, loading, refetch: fetch };
}

// ============================================================
// Activities (with sub-activities)
// ============================================================
export function useActivities(cellId?: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('activities')
      .select('*, cell:cells(id, name, short_code, color)')
      .order('sort_order')
      .order('start_date');

    if (cellId) {
      query = query.eq('cell_id', cellId);
    }

    const { data, error } = await query;
    const { data: deps } = await supabase.from('activity_dependencies').select('activity_id, depends_on_activity_id');

    if (!error && data) {
      const depMap = new Map<string, string[]>();
      (deps || []).forEach((d: { activity_id: string; depends_on_activity_id: string }) => {
        if (!depMap.has(d.activity_id)) depMap.set(d.activity_id, []);
        depMap.get(d.activity_id)!.push(d.depends_on_activity_id);
      });

      const withDeps = data.map((a: Activity) => ({
        ...a,
        depends_on: depMap.get(a.id) || [],
      }));

      // Build hierarchy: nest sub-activities under parents
      const parentActivities = withDeps.filter((a: Activity) => !a.parent_activity_id);
      const subActivities = withDeps.filter((a: Activity) => a.parent_activity_id);

      const hierarchical = parentActivities.map((parent: Activity) => ({
        ...parent,
        sub_activities: subActivities
          .filter((sub: Activity) => sub.parent_activity_id === parent.id)
          .map((s: Activity) => ({ ...s, depends_on: depMap.get(s.id) || [] })),
      }));

      setActivities(hierarchical);
    }
    setLoading(false);
  }, [cellId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = async (data: ActivityFormData, id?: string) => {
    const { depends_on_ids, schedule_type, anchor, start_offset_days, end_offset_days, start_date, end_date, ...rest } = data;
    const isRelative = schedule_type === 'relative';
    const payload: Record<string, unknown> = {
      ...rest,
      schedule_type: schedule_type || 'absolute',
      anchor: isRelative ? anchor : null,
      start_offset_days: isRelative ? start_offset_days : null,
      end_offset_days: isRelative ? end_offset_days : null,
      start_date: isRelative ? null : start_date || null,
      end_date: isRelative ? null : end_date || null,
    };
    let activityId = id;

    if (id) {
      const { error } = await supabase.from('activities').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { data: existing } = await supabase
        .from('activities')
        .select('sort_order')
        .eq('cell_id', data.cell_id)
        .is('parent_activity_id', data.parent_activity_id || null)
        .order('sort_order', { ascending: false })
        .limit(1);
      const maxOrder = existing?.length ? existing[0].sort_order + 1 : 0;
      const { data: inserted, error } = await supabase
        .from('activities')
        .insert({ ...payload, sort_order: maxOrder })
        .select('id')
        .single();
      if (error) throw error;
      activityId = inserted?.id;
    }

    if (isRelative) {
      await supabase.rpc('resolve_relative_activities');
    }

    if (activityId && Array.isArray(depends_on_ids)) {
      await supabase.from('activity_dependencies').delete().eq('activity_id', activityId);
      if (depends_on_ids.length > 0) {
        await supabase.from('activity_dependencies').insert(
          depends_on_ids
            .filter((depId) => depId !== activityId)
            .map((depends_on_activity_id) => ({ activity_id: activityId, depends_on_activity_id }))
        );
      }
    }
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const updateProgress = async (id: string, progress: number, status?: string) => {
    const update: any = { progress };
    if (status) update.status = status;
    else if (progress === 100) update.status = 'completed';
    else if (progress > 0) update.status = 'in_progress';
    const { error } = await supabase.from('activities').update(update).eq('id', id);
    if (error) throw error;
    await fetch();
  };

  return { activities, loading, refetch: fetch, upsert, remove, updateProgress };
}

// ============================================================
// Gantt Data
// ============================================================
export function useGanttData() {
  const [items, setItems] = useState<GanttItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('gantt_data').select('*');
    const { data: deps } = await supabase.from('activity_dependencies').select('activity_id, depends_on_activity_id');
    if (!error && data) {
      const depMap = new Map<string, string[]>();
      (deps || []).forEach((d: { activity_id: string; depends_on_activity_id: string }) => {
        if (!depMap.has(d.activity_id)) depMap.set(d.activity_id, []);
        depMap.get(d.activity_id)!.push(d.depends_on_activity_id);
      });
      setItems(data.map((i: GanttItem) => ({ ...i, depends_on: depMap.get(i.id) || [] })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { items, loading, refetch: fetch };
}
