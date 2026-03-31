-- migrate_003.sql
-- 1. Add 'editor' to role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('manager', 'hotline', 'accountant', 'admin', 'editor'));

-- 2. Ensure roles[] column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- 3. Backfill roles[] for users that don't have it
UPDATE users SET roles = ARRAY[role] WHERE roles IS NULL OR array_length(roles, 1) IS NULL OR array_length(roles, 1) = 0;

-- 4. Link tours to a primary company
ALTER TABLE tours ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
