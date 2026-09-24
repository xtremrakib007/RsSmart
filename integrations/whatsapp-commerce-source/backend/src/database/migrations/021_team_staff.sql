-- Migration 021: Team & Staff Invitations
-- Part 23

CREATE TABLE IF NOT EXISTS staff_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_business ON staff_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON staff_invitations(business_id, email);

-- Add last_login_at to users for activity tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_login_ip INET,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Add deactivated fields to business_users
ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivated_reason TEXT;

DROP TRIGGER IF EXISTS update_staff_invitations_updated_at ON staff_invitations;
CREATE TRIGGER update_staff_invitations_updated_at
  BEFORE UPDATE ON staff_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
