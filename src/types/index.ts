// ============================================================
// WBLA 2026 Election Tracker - Type Definitions
// ============================================================

export interface Cell {
  id: string;
  name: string;
  short_code: string;
  description: string | null;
  head_officer: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
export type ScheduleType = 'absolute' | 'relative';
export type AnchorType = 'polling' | 'counting';

export interface ElectionSettings {
  id: string;
  polling_date: string | null;
  counting_date: string | null;
  updated_at: string;
}

export interface Activity {
  id: string;
  cell_id: string;
  parent_activity_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  schedule_type?: ScheduleType;
  anchor?: AnchorType | null;
  start_offset_days?: number | null;
  end_offset_days?: number | null;
  progress: number;
  priority: Priority;
  status: Status;
  assigned_to: string | null;
  remarks: string | null;
  sort_order: number;
  is_milestone: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  cell?: Cell;
  sub_activities?: Activity[];
  depends_on?: string[];   // activity IDs this activity depends on
  dependents?: string[];   // activity IDs that depend on this one
}

export interface ActivityDependency {
  id: string;
  activity_id: string;
  depends_on_activity_id: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  activity_id: string;
  old_progress: number | null;
  new_progress: number | null;
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  logged_by: string | null;
  created_at: string;
}

export interface CellProgressSummary {
  cell_id: string;
  cell_name: string;
  short_code: string;
  color: string;
  total_activities: number;
  total_sub_activities: number;
  avg_progress: number;
  completed: number;
  in_progress: number;
  delayed: number;
  not_started: number;
  earliest_start: string | null;
  latest_end: string | null;
}

export interface GanttItem {
  id: string;
  cell_id: string;
  cell_name: string;
  cell_code: string;
  cell_color: string;
  parent_activity_id: string | null;
  depends_on?: string[];
  schedule_type?: ScheduleType;
  anchor?: AnchorType | null;
  start_offset_days?: number | null;
  end_offset_days?: number | null;
  title: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  progress: number;
  status: Status;
  priority: Priority;
  is_milestone: boolean;
  sort_order: number;
  depth: number;
}

// Form types
export interface CellFormData {
  name: string;
  short_code: string;
  description: string;
  head_officer: string;
  contact_phone: string;
  contact_email: string;
  color: string;
}

export interface Complaint {
  id: string;
  complaint_code: string;
  complainant_name: string | null;
  complainant_mobile: string | null;
  complainant_email: string | null;
  assembly_constituency: string;
  block_municipality: string;
  original_bengali: string | null;
  english_summary: string | null;
  location_booth_block: string | null;
  category: string | null;
  urgency: string | null;
  status: string;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityFormData {
  cell_id: string;
  parent_activity_id: string | null;
  depends_on_ids?: string[];
  schedule_type: ScheduleType;
  anchor: AnchorType | null;
  start_offset_days: number | null;
  end_offset_days: number | null;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: Priority;
  status: Status;
  progress: number;
  assigned_to: string;
  remarks: string;
  is_milestone: boolean;
}
