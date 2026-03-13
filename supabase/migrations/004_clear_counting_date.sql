-- Clear counting_date if it exists
UPDATE election_settings SET counting_date = NULL, updated_at = NOW() WHERE counting_date IS NOT NULL;
