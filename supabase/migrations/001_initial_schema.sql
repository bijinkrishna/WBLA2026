-- ============================================================
-- WBLa 2026 Election Activity Tracker
-- Paschim Medinipur District - Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CELLS TABLE - 13 Cells at District HQ
-- ============================================================
CREATE TABLE cells (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    short_code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    head_officer VARCHAR(200),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    color VARCHAR(7) DEFAULT '#3B82F6', -- hex color for UI
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITIES TABLE - Top activities under each cell
-- ============================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
    parent_activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    duration_days INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN start_date IS NOT NULL AND end_date IS NOT NULL 
            THEN (end_date - start_date) + 1
            ELSE NULL
        END
    ) STORED,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status VARCHAR(30) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'delayed', 'on_hold')),
    assigned_to VARCHAR(200),
    remarks TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_milestone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS - Track progress changes
-- ============================================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    old_progress INTEGER,
    new_progress INTEGER,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    note TEXT,
    logged_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_activities_cell_id ON activities(cell_id);
CREATE INDEX idx_activities_parent_id ON activities(parent_activity_id);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_dates ON activities(start_date, end_date);
CREATE INDEX idx_activity_logs_activity_id ON activity_logs(activity_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cells_updated_at
    BEFORE UPDATE ON cells
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-LOG PROGRESS CHANGES
-- ============================================================
CREATE OR REPLACE FUNCTION log_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.progress != NEW.progress OR OLD.status != NEW.status THEN
        INSERT INTO activity_logs (activity_id, old_progress, new_progress, old_status, new_status)
        VALUES (NEW.id, OLD.progress, NEW.progress, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_change_log
    AFTER UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION log_activity_change();

-- ============================================================
-- VIEW: Cell Progress Summary
-- ============================================================
CREATE OR REPLACE VIEW cell_progress_summary AS
SELECT 
    c.id AS cell_id,
    c.name AS cell_name,
    c.short_code,
    c.color,
    COUNT(a.id) FILTER (WHERE a.parent_activity_id IS NULL) AS total_activities,
    COUNT(a.id) FILTER (WHERE a.parent_activity_id IS NOT NULL) AS total_sub_activities,
    COALESCE(AVG(a.progress) FILTER (WHERE a.parent_activity_id IS NULL), 0)::INTEGER AS avg_progress,
    COUNT(a.id) FILTER (WHERE a.status = 'completed' AND a.parent_activity_id IS NULL) AS completed,
    COUNT(a.id) FILTER (WHERE a.status = 'in_progress' AND a.parent_activity_id IS NULL) AS in_progress,
    COUNT(a.id) FILTER (WHERE a.status = 'delayed' AND a.parent_activity_id IS NULL) AS delayed,
    COUNT(a.id) FILTER (WHERE a.status = 'not_started' AND a.parent_activity_id IS NULL) AS not_started,
    MIN(a.start_date) AS earliest_start,
    MAX(a.end_date) AS latest_end
FROM cells c
LEFT JOIN activities a ON a.cell_id = c.id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.short_code, c.color
ORDER BY c.sort_order;

-- ============================================================
-- VIEW: Gantt Data (activities with hierarchy)
-- ============================================================
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
    CASE WHEN a.parent_activity_id IS NULL THEN 0 ELSE 1 END AS depth
FROM activities a
JOIN cells c ON c.id = a.cell_id
WHERE a.start_date IS NOT NULL AND a.end_date IS NOT NULL
ORDER BY c.sort_order, a.sort_order, a.start_date;

-- ============================================================
-- SEED DATA: 13 Election Cells
-- ============================================================
INSERT INTO cells (name, short_code, description, color, sort_order) VALUES
('General Administration & Coordination', 'GAC', 'Overall coordination, inter-cell liaison, and general administration of election process', '#1E40AF', 1),
('Electoral Roll & Voter ID', 'ERVID', 'Electoral roll revision, voter ID card distribution, and voter list management', '#047857', 2),
('Polling Station & Infrastructure', 'PSI', 'Polling station setup, infrastructure readiness, and facility management', '#B45309', 3),
('EVM & VVPAT Management', 'EVM', 'Electronic Voting Machine and VVPAT preparation, testing, and deployment', '#7C3AED', 4),
('Law & Order / Security', 'SEC', 'Security planning, force deployment, and law & order arrangements', '#DC2626', 5),
('Transport & Logistics', 'TL', 'Vehicle requisition, route planning, and material transportation', '#0891B2', 6),
('Communication & IT', 'CIT', 'IT infrastructure, communication systems, and digital monitoring', '#4F46E5', 7),
('Training & Capacity Building', 'TCB', 'Training of polling personnel, BLOs, and other election staff', '#059669', 8),
('Media & MCMC', 'MCMC', 'Media certification, monitoring, paid news tracking, and social media surveillance', '#D97706', 9),
('Expenditure Monitoring', 'EM', 'Election expenditure monitoring, flying squads, and SST deployment', '#E11D48', 10),
('Accessibility & Inclusion', 'AI', 'PwD voter facilitation, women voter outreach, and inclusive election measures', '#8B5CF6', 11),
('Material Management & Supply', 'MMS', 'Election material procurement, storage, and distribution management', '#0D9488', 12),
('Counting & Result', 'CR', 'Counting center setup, result compilation, and post-election processes', '#BE185D', 13);

-- ============================================================
-- SEED DATA: Sample Activities for first few cells
-- ============================================================

-- General Administration & Coordination
INSERT INTO activities (cell_id, title, description, start_date, end_date, priority, status, progress, sort_order)
SELECT c.id, v.title, v.description, v.start_date::DATE, v.end_date::DATE, v.priority, v.status, v.progress, v.sort_order
FROM cells c,
(VALUES
    ('Appointment of key election officers', 'DEO, ARO, RO appointments and notification', '2026-01-15', '2026-02-01', 'critical', 'completed', 100, 1),
    ('Election calendar preparation', 'Prepare master timeline aligned with ECI schedule', '2026-01-20', '2026-02-10', 'critical', 'completed', 100, 2),
    ('Inter-cell coordination meetings', 'Weekly coordination meetings across all 13 cells', '2026-02-01', '2026-04-30', 'high', 'in_progress', 45, 3),
    ('Budget estimation & allocation', 'Prepare and submit election budget to state', '2026-01-25', '2026-02-20', 'high', 'completed', 100, 4),
    ('MCC implementation plan', 'Model Code of Conduct enforcement planning', '2026-02-15', '2026-03-15', 'critical', 'in_progress', 30, 5)
) AS v(title, description, start_date, end_date, priority, status, progress, sort_order)
WHERE c.short_code = 'GAC';

-- Electoral Roll & Voter ID
INSERT INTO activities (cell_id, title, description, start_date, end_date, priority, status, progress, sort_order)
SELECT c.id, v.title, v.description, v.start_date::DATE, v.end_date::DATE, v.priority, v.status, v.progress, v.sort_order
FROM cells c,
(VALUES
    ('Final electoral roll publication', 'Publish final electoral roll after revision', '2026-01-10', '2026-02-05', 'critical', 'completed', 100, 1),
    ('EPIC card distribution drive', 'Distribute pending voter ID cards across constituencies', '2026-02-01', '2026-03-20', 'high', 'in_progress', 60, 2),
    ('Special revision camp', 'Conduct camps for new voter registration and corrections', '2026-02-10', '2026-03-01', 'high', 'in_progress', 70, 3),
    ('BLO verification drive', 'Door-to-door verification by Booth Level Officers', '2026-02-15', '2026-03-30', 'high', 'in_progress', 40, 4),
    ('Voter helpline activation', 'Activate 1950 helpline and voter facilitation centers', '2026-02-20', '2026-04-15', 'medium', 'not_started', 0, 5)
) AS v(title, description, start_date, end_date, priority, status, progress, sort_order)
WHERE c.short_code = 'ERVID';

-- EVM & VVPAT Management
INSERT INTO activities (cell_id, title, description, start_date, end_date, priority, status, progress, sort_order)
SELECT c.id, v.title, v.description, v.start_date::DATE, v.end_date::DATE, v.priority, v.status, v.progress, v.sort_order
FROM cells c,
(VALUES
    ('EVM warehouse readiness', 'Prepare strong rooms and EVM storage facilities', '2026-01-20', '2026-02-28', 'critical', 'in_progress', 55, 1),
    ('First Level Checking (FLC)', 'Complete FLC of all EVMs and VVPATs', '2026-02-15', '2026-03-25', 'critical', 'not_started', 0, 2),
    ('Commissioning of EVMs', 'Commission EVMs for all polling stations', '2026-03-20', '2026-04-10', 'critical', 'not_started', 0, 3),
    ('Mock poll drill', 'Conduct mock polls at all booths on designated date', '2026-04-05', '2026-04-08', 'critical', 'not_started', 0, 4),
    ('VVPAT awareness campaign', 'Public awareness about VVPAT usage', '2026-03-01', '2026-04-10', 'medium', 'not_started', 0, 5)
) AS v(title, description, start_date, end_date, priority, status, progress, sort_order)
WHERE c.short_code = 'EVM';

-- Security Cell
INSERT INTO activities (cell_id, title, description, start_date, end_date, priority, status, progress, sort_order)
SELECT c.id, v.title, v.description, v.start_date::DATE, v.end_date::DATE, v.priority, v.status, v.progress, v.sort_order
FROM cells c,
(VALUES
    ('Vulnerability mapping', 'Identify critical, sensitive and hypersensitive booths', '2026-01-25', '2026-02-20', 'critical', 'completed', 100, 1),
    ('Force deployment plan', 'Plan central and state force deployment across constituencies', '2026-02-20', '2026-03-30', 'critical', 'in_progress', 35, 2),
    ('Arms license verification', 'Verify and deposit licensed arms in the district', '2026-03-01', '2026-03-31', 'high', 'not_started', 0, 3),
    ('Route march & flag march', 'Conduct route and flag marches in sensitive areas', '2026-04-01', '2026-04-12', 'high', 'not_started', 0, 4),
    ('Webcasting arrangement', 'Setup webcasting at identified polling stations', '2026-03-15', '2026-04-10', 'high', 'not_started', 0, 5)
) AS v(title, description, start_date, end_date, priority, status, progress, sort_order)
WHERE c.short_code = 'SEC';

-- ============================================================
-- ROW LEVEL SECURITY (optional, enable as needed)
-- ============================================================
-- ALTER TABLE cells ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow all for authenticated" ON cells FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all for authenticated" ON activities FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all for authenticated" ON activity_logs FOR ALL TO authenticated USING (true);
