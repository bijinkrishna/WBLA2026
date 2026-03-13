-- ============================================================
-- Election Relative Scheduling - P-2, C-1, etc.
-- ============================================================

-- Election settings (singleton: Polling Day, Counting Day)
CREATE TABLE election_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    polling_date DATE,
    counting_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO election_settings (id) VALUES (uuid_generate_v4());

CREATE TRIGGER election_settings_updated_at
    BEFORE UPDATE ON election_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Activity columns for relative scheduling
ALTER TABLE activities
    ADD COLUMN schedule_type VARCHAR(20) DEFAULT 'absolute' CHECK (schedule_type IN ('absolute', 'relative')),
    ADD COLUMN anchor VARCHAR(20) CHECK (anchor IN ('polling', 'counting')),
    ADD COLUMN start_offset_days INTEGER,
    ADD COLUMN end_offset_days INTEGER;

-- Function to resolve relative activities to actual dates
CREATE OR REPLACE FUNCTION resolve_relative_activities()
RETURNS INTEGER AS $$
DECLARE
    es RECORD;
    act RECORD;
    anchor_dt DATE;
    resolved_count INTEGER := 0;
BEGIN
    SELECT polling_date, counting_date INTO es FROM election_settings LIMIT 1;
    
    FOR act IN 
        SELECT id, anchor, start_offset_days, end_offset_days 
        FROM activities 
        WHERE schedule_type = 'relative' AND anchor IS NOT NULL
    LOOP
        anchor_dt := CASE act.anchor 
            WHEN 'polling' THEN es.polling_date 
            WHEN 'counting' THEN es.counting_date 
            ELSE NULL 
        END;
        
        IF anchor_dt IS NOT NULL AND act.start_offset_days IS NOT NULL THEN
            UPDATE activities SET
                start_date = anchor_dt + act.start_offset_days,
                end_date = anchor_dt + COALESCE(act.end_offset_days, act.start_offset_days),
                updated_at = NOW()
            WHERE id = act.id;
            resolved_count := resolved_count + 1;
        END IF;
    END LOOP;
    
    RETURN resolved_count;
END;
$$ LANGUAGE plpgsql;

-- Allow anon/authenticated to call resolve (Supabase RPC)
GRANT EXECUTE ON FUNCTION resolve_relative_activities() TO anon;
GRANT EXECUTE ON FUNCTION resolve_relative_activities() TO authenticated;

-- Update gantt_data view to include relative schedule info
DROP VIEW IF EXISTS gantt_data;
CREATE OR REPLACE VIEW gantt_data AS
SELECT 
    a.id,
    a.cell_id,
    c.name AS cell_name,
    c.short_code AS cell_code,
    c.color AS cell_color,
    a.parent_activity_id,
    a.title,
    a.start_date,
    a.end_date,
    a.duration_days,
    a.progress,
    a.status,
    a.priority,
    a.is_milestone,
    a.sort_order,
    a.schedule_type,
    a.anchor,
    a.start_offset_days,
    a.end_offset_days,
    CASE WHEN a.parent_activity_id IS NULL THEN 0 ELSE 1 END AS depth
FROM activities a
JOIN cells c ON c.id = a.cell_id
WHERE a.start_date IS NOT NULL AND a.end_date IS NOT NULL;
