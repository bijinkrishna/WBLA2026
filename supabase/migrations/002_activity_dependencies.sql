-- ============================================================
-- Activity Dependencies - Activity B depends on Activity A
-- ============================================================

CREATE TABLE activity_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    depends_on_activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(activity_id, depends_on_activity_id),
    CONSTRAINT no_self_dependency CHECK (activity_id != depends_on_activity_id)
);

CREATE INDEX idx_activity_deps_activity ON activity_dependencies(activity_id);
CREATE INDEX idx_activity_deps_depends_on ON activity_dependencies(depends_on_activity_id);
