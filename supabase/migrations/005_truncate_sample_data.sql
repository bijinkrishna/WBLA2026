-- Truncate all transactional/sample data
-- Order: child tables first (dependencies, logs), then activities, then cells

TRUNCATE activity_dependencies, activity_logs, activities, cells RESTART IDENTITY CASCADE;
