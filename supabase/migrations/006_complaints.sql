-- ============================================================
-- COMPLAINTS TABLE - Election complaint intake & tracking
-- ============================================================

CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complainant_name VARCHAR(200),
    complainant_mobile VARCHAR(20),
    complainant_email VARCHAR(200),
    assembly_constituency VARCHAR(200) NOT NULL,
    block_municipality VARCHAR(200) NOT NULL,
    original_bengali TEXT,
    english_summary TEXT,
    location_booth_block VARCHAR(200),
    category VARCHAR(20),
    urgency VARCHAR(20),
    status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_progress', 'escalated', 'resolved', 'closed')),
    recorded_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_complaints_assembly_constituency ON complaints(assembly_constituency);
CREATE INDEX idx_complaints_block_municipality ON complaints(block_municipality);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_created_at ON complaints(created_at DESC);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE TRIGGER complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
