-- Migration 001: manager_number, company article, tour cancellation_terms

ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_number VARCHAR(5) DEFAULT '00';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS article VARCHAR(100) DEFAULT '';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS cancellation_terms TEXT[] DEFAULT '{}';
