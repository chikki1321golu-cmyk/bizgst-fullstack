-- ============================================================
-- BizGST — PostgreSQL Schema (Raw SQL)
-- Run this if you prefer not to use Prisma migrations
-- psql -d bizgst_db -f schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE business_type    AS ENUM ('RETAIL','WHOLESALE','MANUFACTURER','SERVICE');
CREATE TYPE party_type       AS ENUM ('CUSTOMER','VENDOR');
CREATE TYPE invoice_type     AS ENUM ('SALE','PURCHASE');
CREATE TYPE supply_type      AS ENUM ('B2B','B2CS','B2C','EXPORT','SEZ');
CREATE TYPE invoice_status   AS ENUM ('ACTIVE','CANCELLED','CREDIT_NOTE','DEBIT_NOTE');
CREATE TYPE gst_return_type  AS ENUM ('GSTR1','GSTR3B');
CREATE TYPE gst_return_status AS ENUM ('DRAFT','READY','FILED','ACCEPTED');

-- ── Users ────────────────────────────────────────────────────

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mobile      VARCHAR(10) UNIQUE,
  email       VARCHAR(255) UNIQUE,
  name        VARCHAR(255),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT  chk_user_contact CHECK (mobile IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_email  ON users(email);

-- ── OTP Codes ────────────────────────────────────────────────

CREATE TABLE otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       CHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_user ON otp_codes(user_id, used, expires_at);

-- ── Businesses ───────────────────────────────────────────────

CREATE TABLE businesses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  gstin         CHAR(15) NOT NULL UNIQUE,
  state_code    CHAR(2) NOT NULL,
  state_name    VARCHAR(100) NOT NULL,
  address       TEXT,
  business_type business_type NOT NULL DEFAULT 'RETAIL',
  pan           CHAR(10),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_businesses_user ON businesses(user_id);
CREATE UNIQUE INDEX idx_businesses_gstin ON businesses(gstin);

-- ── Parties (Customers & Vendors) ────────────────────────────

CREATE TABLE parties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  mobile      VARCHAR(10),
  email       VARCHAR(255),
  gstin       CHAR(15),
  state_code  CHAR(2),
  state_name  VARCHAR(100),
  address     TEXT,
  type        party_type NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parties_business_type ON parties(business_id, type);
CREATE INDEX idx_parties_gstin ON parties(gstin) WHERE gstin IS NOT NULL;

-- ── Products ─────────────────────────────────────────────────

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  hsn_code    VARCHAR(8) NOT NULL,    -- HSN/SAC code — mandatory for GST
  gst_rate    NUMERIC(4,2) NOT NULL   -- Must be 0, 5, 12, 18, or 28
              CHECK (gst_rate IN (0, 5, 12, 18, 28)),
  unit        VARCHAR(20) NOT NULL DEFAULT 'Nos',
  base_price  NUMERIC(12,2) DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_business ON products(business_id) WHERE is_active = TRUE;

-- ── Invoices ─────────────────────────────────────────────────
-- NOTE: Tax amounts (cgst, sgst, igst) are stored here and
-- NEVER re-computed from items. This ensures a locked, audit-proof
-- record — GST rates can change, but historical invoices remain unchanged.

CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  party_id       UUID REFERENCES parties(id),
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date   DATE NOT NULL,
  invoice_type   invoice_type NOT NULL,
  supply_type    supply_type NOT NULL,
  is_interstate  BOOLEAN NOT NULL DEFAULT FALSE,
  is_rcm         BOOLEAN NOT NULL DEFAULT FALSE, -- Reverse Charge Mechanism

  -- Tax amounts (immutable after creation)
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  cgst           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Central GST
  sgst           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- State GST
  igst           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Integrated GST
  cess           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Additional cess (luxury goods)
  total_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- ITC fields (only for purchase invoices)
  itc_eligible   BOOLEAN,                  -- NULL for sales
  itc_cgst       NUMERIC(12,2) DEFAULT 0,  -- Claimable CGST
  itc_sgst       NUMERIC(12,2) DEFAULT 0,  -- Claimable SGST
  itc_igst       NUMERIC(12,2) DEFAULT 0,  -- Claimable IGST

  notes          TEXT,
  status         invoice_status NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (business_id, invoice_number, invoice_type)
);

CREATE INDEX idx_invoices_business_type ON invoices(business_id, invoice_type);
CREATE INDEX idx_invoices_date          ON invoices(business_id, invoice_date);
CREATE INDEX idx_invoices_party         ON invoices(party_id) WHERE party_id IS NOT NULL;
CREATE INDEX idx_invoices_supply_type   ON invoices(business_id, supply_type);

-- ── Invoice Line Items ────────────────────────────────────────
-- HSN code and GST rate are DENORMALIZED here intentionally.
-- If you later change a product's rate, historical invoices
-- must remain accurate with the rate at time of billing.

CREATE TABLE invoice_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES products(id),
  description    VARCHAR(500) NOT NULL,
  hsn_code       VARCHAR(8) NOT NULL,   -- Snapshot at time of invoice
  quantity       NUMERIC(10,3) NOT NULL,
  unit           VARCHAR(20) NOT NULL DEFAULT 'Nos',
  unit_price     NUMERIC(12,2) NOT NULL,
  discount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(14,2) NOT NULL,
  gst_rate       NUMERIC(4,2) NOT NULL, -- Snapshot at time of invoice
  cgst           NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst           NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(14,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON invoice_items(product_id) WHERE product_id IS NOT NULL;

-- ── GST Returns ───────────────────────────────────────────────

CREATE TABLE gst_returns (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  return_type  gst_return_type NOT NULL,
  period       CHAR(6) NOT NULL,         -- "032025" = March 2025
  status       gst_return_status NOT NULL DEFAULT 'DRAFT',
  json_payload JSONB,                    -- Full GST portal payload
  filed_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (business_id, return_type, period)
);

CREATE INDEX idx_gst_returns_business ON gst_returns(business_id);
CREATE INDEX idx_gst_returns_period   ON gst_returns(business_id, period);

-- ── Triggers: auto-update updated_at ─────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_businesses_updated_at    BEFORE UPDATE ON businesses    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_parties_updated_at       BEFORE UPDATE ON parties       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated_at      BEFORE UPDATE ON products      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at      BEFORE UPDATE ON invoices      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_gst_returns_updated_at   BEFORE UPDATE ON gst_returns   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Views (convenience) ───────────────────────────────────────

-- Monthly GST summary view
CREATE OR REPLACE VIEW v_monthly_gst_summary AS
SELECT
  business_id,
  TO_CHAR(invoice_date, 'MMYYYY') AS period,
  SUM(CASE WHEN invoice_type = 'SALE' THEN taxable_amount ELSE 0 END)   AS total_taxable_sales,
  SUM(CASE WHEN invoice_type = 'SALE' THEN cgst + sgst + igst ELSE 0 END) AS output_gst,
  SUM(CASE WHEN invoice_type = 'PURCHASE' AND itc_eligible = TRUE THEN itc_cgst + itc_sgst + itc_igst ELSE 0 END) AS itc_available,
  SUM(CASE WHEN invoice_type = 'PURCHASE' AND itc_eligible = FALSE THEN cgst + sgst + igst ELSE 0 END) AS itc_blocked,
  COUNT(CASE WHEN invoice_type = 'SALE' THEN 1 END)     AS sales_count,
  COUNT(CASE WHEN invoice_type = 'PURCHASE' THEN 1 END) AS purchases_count
FROM invoices
WHERE status = 'ACTIVE'
GROUP BY business_id, TO_CHAR(invoice_date, 'MMYYYY');

COMMENT ON VIEW v_monthly_gst_summary IS 'Pre-computed monthly GST summary for fast dashboard queries';
