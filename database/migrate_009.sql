-- migrate_009: Agent commission tracking
-- Adds columns for tracking agent commission payments

-- Add agent_commission_paid flag to vouchers
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS agent_commission_paid BOOLEAN DEFAULT false;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS agent_commission_paid_date DATE;

-- Add agent_id to accounting_entries so we can track payments TO agents
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id);

-- Index for fast agent lookups
CREATE INDEX IF NOT EXISTS idx_accounting_entries_agent_id ON accounting_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_agent_commission_paid ON vouchers(agent_commission_paid) WHERE agent_commission_paid = false;
