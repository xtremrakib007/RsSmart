-- Migration 020: Business Onboarding Progress
-- Part 22

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step VARCHAR(50) NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, step)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_business ON onboarding_progress(business_id);

-- Add onboarding status to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(50);

-- Add country support with defaults
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT 'MY';

-- Update existing businesses to have onboarding completed
UPDATE businesses SET onboarding_completed = true WHERE onboarding_completed IS NULL;
