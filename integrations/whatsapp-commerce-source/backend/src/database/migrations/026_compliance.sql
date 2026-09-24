-- Migration 026: Legal & Compliance Foundation
-- Part 30

CREATE TABLE IF NOT EXISTS legal_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  page_type VARCHAR(50) NOT NULL CHECK (page_type IN ('privacy', 'terms', 'refund_policy', 'cookie_policy', 'data_processing', 'shipping_policy')),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(20) DEFAULT '1.0',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, page_type, version)
);

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('privacy', 'marketing', 'terms', 'cookies', 'data_processing')),
  version VARCHAR(20) NOT NULL,
  source VARCHAR(100) DEFAULT 'web',
  ip_address INET,
  user_agent TEXT,
  accepted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('export', 'deletion', 'correction')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  result_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_customer ON consent_records(business_id, customer_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_user ON consent_records(business_id, user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_export_requests(status);

DROP TRIGGER IF EXISTS update_legal_pages_updated_at ON legal_pages;
CREATE TRIGGER update_legal_pages_updated_at
  BEFORE UPDATE ON legal_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_export_requests_updated_at ON data_export_requests;
CREATE TRIGGER update_data_export_requests_updated_at
  BEFORE UPDATE ON data_export_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
