-- ============================================================
-- MIGRATION 003: Complete Auth System
-- Run: psql -d pratibimba -f migrations/003_auth_system.sql
-- ============================================================

-- ── Citizen Auth Sessions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS citizen_sessions (
    id              BIGSERIAL    PRIMARY KEY,
    session_id      VARCHAR(80)  UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30)  NOT NULL,
    session_type    VARCHAR(20)  NOT NULL
                    CHECK (session_type IN ('CITIZEN', 'TOURIST', 'GUEST')),
    id_type         VARCHAR(30)  NOT NULL,
    -- NID | CITIZENSHIP | DRIVING_LICENSE | PASSPORT
    verified        BOOLEAN      DEFAULT false,
    device_info     TEXT,
    ip_address      VARCHAR(45),
    expires_at      TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_nid     ON citizen_sessions(citizen_nid);
CREATE INDEX IF NOT EXISTS idx_sessions_id      ON citizen_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON citizen_sessions(expires_at);

-- ── Tourist Profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tourist_profiles (
    id              BIGSERIAL    PRIMARY KEY,
    passport_no     VARCHAR(30)  UNIQUE NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    nationality     VARCHAR(60),
    dob             DATE,
    gender          VARCHAR(10),
    visa_no         VARCHAR(30),
    visa_type       VARCHAR(50),
    visa_expires    DATE,
    entry_date      DATE,
    ocr_raw         TEXT,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tourist_passport ON tourist_profiles(passport_no);

-- ── Tourist Service Requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tourist_requests (
    id              BIGSERIAL    PRIMARY KEY,
    request_id      VARCHAR(60)  UNIQUE NOT NULL,
    passport_no     VARCHAR(30)  NOT NULL,
    tourist_name    VARCHAR(100) NOT NULL,
    service_type    VARCHAR(80)  NOT NULL,
    -- TIMS_PERMIT | ANNAPURNA_PERMIT | MANASLU_PERMIT | MUSTANG_PERMIT
    -- LANGTANG_PERMIT | RESTRICTED_AREA_PERMIT | NATIONAL_PARK_FEE
    -- GUIDE_REQUEST | PORTER_REQUEST | EMERGENCY_EVACUATION
    destination     VARCHAR(100),
    trek_start_date DATE,
    trek_end_date   DATE,
    group_size      SMALLINT     DEFAULT 1,
    details         TEXT,
    status          VARCHAR(30)  DEFAULT 'PENDING',
    fee_amount      DECIMAL(10,2),
    fee_paid        BOOLEAN      DEFAULT false,
    submitted_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tourist_req_passport ON tourist_requests(passport_no);
CREATE INDEX IF NOT EXISTS idx_tourist_req_status   ON tourist_requests(status);

-- ── OCR Audit Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ocr_audit (
    id              BIGSERIAL    PRIMARY KEY,
    session_id      VARCHAR(80),
    document_type   VARCHAR(30)  NOT NULL,
    -- NID | CITIZENSHIP | DRIVING_LICENSE | PASSPORT
    extracted_fields JSONB,
    confidence      DECIMAL(5,2),
    processing_ms   INTEGER,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Demo tourist
INSERT INTO tourist_profiles (passport_no, full_name, nationality, dob, gender)
VALUES ('A12345678', 'John Smith', 'American', '1990-05-20', 'Male')
ON CONFLICT (passport_no) DO NOTHING;

SELECT 'Migration 003 complete!' AS status,
  (SELECT COUNT(*) FROM citizen_sessions)  AS sessions,
  (SELECT COUNT(*) FROM tourist_profiles)  AS tourists,
  (SELECT COUNT(*) FROM tourist_requests)  AS tourist_requests;