-- ============================================================
-- MIGRATION 002: CITIZEN PORTAL TABLES
-- Run: psql -d pratibimba -f migrations/002_citizen_portal.sql
-- ============================================================

-- CITIZEN PROFILES
CREATE TABLE IF NOT EXISTS citizen_profiles (
    nid              VARCHAR(30) PRIMARY KEY,
    citizenship_no   VARCHAR(30) NOT NULL,
    full_name        VARCHAR(100) NOT NULL,
    full_name_ne     VARCHAR(100),
    dob              DATE,
    gender           VARCHAR(10),
    father_name      VARCHAR(100),
    mother_name      VARCHAR(100),
    ward_code        VARCHAR(20) NOT NULL,
    ward_number      SMALLINT,
    district         VARCHAR(50),
    province         VARCHAR(50),
    phone            VARCHAR(20),
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citizen_ward ON citizen_profiles(ward_code);
CREATE INDEX idx_citizen_active ON citizen_profiles(is_active);

INSERT INTO citizen_profiles (nid, citizenship_no, full_name, full_name_ne, dob, gender, father_name, mother_name, ward_code, ward_number, district, province, phone)
VALUES
('12345678901', '01-02-03-04567', 'Rajesh KC', 'राजेश के.सी.', '1985-06-15', 'Male', 'Hari Bahadur KC', 'Kamala KC', 'NPL-04-33-09', 9, 'Kaski', 'Gandaki', '9800000000'),
('98765432109', '05-06-07-08901', 'Anita Sharma', 'अनिता शर्मा', '1990-03-20', 'Female', 'Ram Prasad Sharma', 'Sunita Sharma', 'NPL-04-33-09', 9, 'Kaski', 'Gandaki', '9841234567')
ON CONFLICT (nid) DO NOTHING;

-- TAX RECORDS
CREATE TABLE IF NOT EXISTS tax_records (
    id              BIGSERIAL PRIMARY KEY,
    citizen_nid     VARCHAR(30) NOT NULL,
    tax_year        SMALLINT NOT NULL,
    property_tax    DECIMAL(12,2) DEFAULT 0,
    business_tax    DECIMAL(12,2) DEFAULT 0,
    total_amount    DECIMAL(12,2) NOT NULL,
    paid_amount     DECIMAL(12,2) DEFAULT 0,
    due_date        DATE,
    status          VARCHAR(20) DEFAULT 'UNPAID',
    payment_ref     VARCHAR(60),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_citizen ON tax_records(citizen_nid);
CREATE INDEX idx_tax_year ON tax_records(tax_year);
CREATE INDEX idx_tax_status ON tax_records(status);

INSERT INTO tax_records (citizen_nid, tax_year, property_tax, business_tax, total_amount, paid_amount, due_date, status)
VALUES
('12345678901', 2082, 8500.00, 0, 8500.00, 0, '2082-09-30', 'UNPAID'),
('12345678901', 2081, 8200.00, 0, 8200.00, 8200.00, '2081-09-30', 'PAID'),
('98765432109', 2082, 5000.00, 15000.00, 20000.00, 10000.00, '2082-09-30', 'PARTIAL');

-- NOTICES
CREATE TABLE IF NOT EXISTS notices (
    id              BIGSERIAL PRIMARY KEY,
    notice_id       VARCHAR(60) UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    title_ne        TEXT,
    category        VARCHAR(50) NOT NULL,
    content         TEXT,
    content_ne      TEXT,
    ward_code       VARCHAR(20),
    is_urgent       BOOLEAN DEFAULT false,
    published_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_notice_category ON notices(category);
CREATE INDEX idx_notice_ward ON notices(ward_code);
CREATE INDEX idx_notice_urgent ON notices(is_urgent);

INSERT INTO notices (notice_id, title, title_ne, category, content, is_urgent, ward_code, expires_at)
VALUES
('NTC-001', 'Water Supply Interruption', 'पानी आपूर्ति बन्द', 'URGENT', 'Water supply interrupted 2082/06/15 8AM-4PM for maintenance.', true, 'NPL-04-33-09', '2082-06-15 16:00:00+05:45'),
('NTC-002', 'Road Widening Project', 'सडक चौडाइ परियोजना', 'INFRASTRUCTURE', 'Prithvi Chowk to Airport road widening begins next week.', false, NULL, '2082-07-15 23:59:59+05:45');

-- GRIEVANCES
CREATE TABLE IF NOT EXISTS grievances (
    id              BIGSERIAL PRIMARY KEY,
    grievance_id    VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    citizen_name    VARCHAR(100) NOT NULL,
    ward_code       VARCHAR(20) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    location_lat    DECIMAL(10,7),
    location_lng    DECIMAL(10,7),
    location_desc   VARCHAR(200),
    photo_url       TEXT,
    status          VARCHAR(30) DEFAULT 'OPEN',
    assigned_officer VARCHAR(60),
    assigned_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_grv_ward ON grievances(ward_code);
CREATE INDEX idx_grv_status ON grievances(status);
CREATE INDEX idx_grv_citizen ON grievances(citizen_nid);

-- QUEUE TOKENS
CREATE TABLE IF NOT EXISTS queue_tokens (
    id              BIGSERIAL PRIMARY KEY,
    token_id        VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    ward_code       VARCHAR(20) NOT NULL,
    service_type    VARCHAR(50) NOT NULL,
    token_number    INTEGER NOT NULL,
    estimated_time  TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'WAITING',
    booked_at       TIMESTAMPTZ DEFAULT NOW(),
    called_at       TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_queue_ward_date ON queue_tokens(ward_code, booked_at DESC);
CREATE INDEX idx_queue_citizen ON queue_tokens(citizen_nid);

-- SOCIAL SECURITY (BHATTA)
CREATE TABLE IF NOT EXISTS social_security (
    id              BIGSERIAL PRIMARY KEY,
    citizen_nid     VARCHAR(30) NOT NULL,
    scheme_type     VARCHAR(50) NOT NULL,
    monthly_amount  DECIMAL(10,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'ACTIVE',
    last_disbursed  DATE,
    next_disbursal  DATE,
    bank_account    VARCHAR(30),
    bank_name       VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bhatta_citizen ON social_security(citizen_nid);
CREATE INDEX idx_bhatta_status ON social_security(status);

INSERT INTO social_security (citizen_nid, scheme_type, monthly_amount, status, last_disbursed, next_disbursal, bank_account)
VALUES
('12345678901', 'BRIDDHA_BHATTA', 2000.00, 'ACTIVE', '2082-06-01', '2082-07-01', '90010123456789'),
('98765432109', 'SINGLE_MOTHER', 3500.00, 'ACTIVE', '2082-06-05', '2082-07-05', '90010987654321');

SELECT 'Migration 002 complete.' AS status;
