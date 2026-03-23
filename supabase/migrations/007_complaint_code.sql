-- ============================================================
-- COMPLAINT REFERENCE CODE
-- Adds human-friendly unique complaint code for tracking
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS complaints_code_seq START 1;

ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS complaint_code TEXT;

ALTER TABLE complaints
ALTER COLUMN complaint_code
SET DEFAULT (
  'CMP-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('complaints_code_seq')::TEXT, 6, '0')
);

UPDATE complaints
SET complaint_code = 'CMP-' || to_char(created_at, 'YYYY') || '-' || LPAD(nextval('complaints_code_seq')::TEXT, 6, '0')
WHERE complaint_code IS NULL;

ALTER TABLE complaints
ALTER COLUMN complaint_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complaints_complaint_code_key'
  ) THEN
    ALTER TABLE complaints
      ADD CONSTRAINT complaints_complaint_code_key UNIQUE (complaint_code);
  END IF;
END $$;
