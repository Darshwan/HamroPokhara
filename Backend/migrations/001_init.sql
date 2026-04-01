-- ============================================================
-- PRATIBIMBA — Complete Database Schema
-- Run once: psql -d pratibimba -f migrations/001_init.sql
-- ============================================================

-- Clean slate for development re-runs
DROP TABLE IF EXISTS access_log CASCADE;
DROP TABLE IF EXISTS revocations CASCADE;
DROP TABLE IF EXISTS ndo_ledger CASCADE;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS dtid_sequences CASCADE;
DROP TABLE IF EXISTS officers CASCADE;
DROP TABLE IF EXISTS citizens CASCADE;
DROP VIEW  IF EXISTS ledger_summary CASCADE;
DROP VIEW  IF EXISTS request_summary CASCADE;

-- ============================================================
-- OFFICERS
-- ============================================================
CREATE TABLE officers (
    officer_id      VARCHAR(60)  PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    ward_code       VARCHAR(20)  NOT NULL,
    district_code   SMALLINT     NOT NULL,
    province_code   SMALLINT     NOT NULL CHECK (province_code BETWEEN 1 AND 7),
    designation     VARCHAR(100) NOT NULL,
    pin_hash        VARCHAR(64)  NOT NULL,
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Demo officers — all have PIN: 1234
-- SHA256("1234") = 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
INSERT INTO officers VALUES
('WO-04-33-09-001', 'Ram Bahadur Thapa',    'NPL-04-33-09', 33, 4, 'Ward Officer',    '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', true, NOW()),
('WO-04-33-05-001', 'Sita Devi Shrestha',   'NPL-04-33-05', 33, 4, 'Ward Officer',    '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', true, NOW()),
('WO-04-33-01-001', 'Hari Prasad Poudel',   'NPL-04-33-01', 33, 4, 'Ward Officer',    '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', true, NOW()),
('ADMIN-04-33-001', 'Kamala Devi Gurung',   'NPL-04-33-00', 33, 4, 'District Admin',  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', true, NOW()),
('MIN-04-001',      'Bishnu Prasad Sharma', 'NPL-04-00-00', 0,  4, 'Ministry Officer','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', true, NOW());

-- ============================================================
-- DTID SEQUENCE — atomic counter per ward per year
-- ============================================================
CREATE TABLE dtid_sequences (
    ward_code       VARCHAR(20) NOT NULL,
    nepali_year     SMALLINT    NOT NULL,
    last_sequence   BIGINT      DEFAULT 0,
    PRIMARY KEY (ward_code, nepali_year)
);

-- ============================================================
-- NDO LEDGER — append-only, tamper-proof
-- ============================================================
CREATE TABLE ndo_ledger (
    id              BIGSERIAL    PRIMARY KEY,
    dtid            VARCHAR(80)  UNIQUE NOT NULL,
    document_hash   VARCHAR(64)  NOT NULL,
    record_hash     VARCHAR(64)  NOT NULL,
    document_type   VARCHAR(50)  NOT NULL,
    officer_id      VARCHAR(60)  NOT NULL REFERENCES officers(officer_id),
    ward_code       VARCHAR(20)  NOT NULL,
    district_code   SMALLINT     NOT NULL,
    province_code   SMALLINT     NOT NULL,
    request_id      VARCHAR(60),
    status          VARCHAR(20)  DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','EXPIRED','REVOKED')),
    sync_status     VARCHAR(20)  DEFAULT 'CONFIRMED',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    synced_at       TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT dtid_format CHECK (dtid LIKE 'NPL-%')
);

-- APPEND-ONLY ENFORCEMENT
-- UPDATE and DELETE are physically blocked at DB rule level
-- Even a compromised application cannot alter records
CREATE OR REPLACE RULE ledger_no_update
    AS ON UPDATE TO ndo_ledger DO INSTEAD NOTHING;
CREATE OR REPLACE RULE ledger_no_delete
    AS ON DELETE TO ndo_ledger DO INSTEAD NOTHING;

CREATE INDEX idx_ledger_dtid     ON ndo_ledger(dtid);
CREATE INDEX idx_ledger_officer  ON ndo_ledger(officer_id);
CREATE INDEX idx_ledger_ward     ON ndo_ledger(ward_code);
CREATE INDEX idx_ledger_created  ON ndo_ledger(created_at DESC);
CREATE INDEX idx_ledger_type     ON ndo_ledger(document_type);
CREATE INDEX idx_ledger_province ON ndo_ledger(province_code);

-- ============================================================
-- SERVICE REQUESTS — citizen → officer workflow
-- ============================================================
CREATE TABLE service_requests (
    id              BIGSERIAL    PRIMARY KEY,
    request_id      VARCHAR(60)  UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30)  NOT NULL,
    citizen_name    VARCHAR(100) NOT NULL,
    citizen_phone   VARCHAR(20),
    document_type   VARCHAR(50)  NOT NULL,
    purpose         VARCHAR(200) NOT NULL,
    additional_info TEXT,
    ward_code       VARCHAR(20)  NOT NULL,
    assigned_officer VARCHAR(60) REFERENCES officers(officer_id),
    status          VARCHAR(30)  DEFAULT 'PENDING'
                    CHECK (status IN (
                        'PENDING','UNDER_REVIEW',
                        'APPROVED','REJECTED','CANCELLED'
                    )),
    rejection_reason TEXT,
    dtid            VARCHAR(80),
    submitted_at    TIMESTAMPTZ  DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    ocr_raw_data    TEXT,
    ip_address      VARCHAR(45)
);

CREATE INDEX idx_req_request_id  ON service_requests(request_id);
CREATE INDEX idx_req_ward        ON service_requests(ward_code);
CREATE INDEX idx_req_status      ON service_requests(status);
CREATE INDEX idx_req_officer     ON service_requests(assigned_officer);
CREATE INDEX idx_req_submitted   ON service_requests(submitted_at DESC);
CREATE INDEX idx_req_nid         ON service_requests(citizen_nid);

-- ============================================================
-- ACCESS LOG — every verification recorded
-- ============================================================
CREATE TABLE access_log (
    id               BIGSERIAL    PRIMARY KEY,
    queried_dtid     VARCHAR(80)  NOT NULL,
    requester_id     VARCHAR(100) NOT NULL,
    requester_type   VARCHAR(30)  NOT NULL
                     CHECK (requester_type IN ('AGENCY','CITIZEN','OFFICER','SYSTEM')),
    requester_agency VARCHAR(100),
    result           VARCHAR(20)  NOT NULL
                     CHECK (result IN ('VALID','INVALID','TAMPERED','NOT_FOUND')),
    ip_address       VARCHAR(45)  NOT NULL,
    response_ms      INTEGER,
    queried_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE RULE access_log_no_update
    AS ON UPDATE TO access_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE access_log_no_delete
    AS ON DELETE TO access_log DO INSTEAD NOTHING;

CREATE INDEX idx_access_dtid   ON access_log(queried_dtid);
CREATE INDEX idx_access_time   ON access_log(queried_at DESC);
CREATE INDEX idx_access_result ON access_log(result);

-- ============================================================
-- REVOCATIONS
-- ============================================================
CREATE TABLE revocations (
    id                BIGSERIAL    PRIMARY KEY,
    dtid              VARCHAR(80)  NOT NULL,
    reason            TEXT         NOT NULL,
    revoked_by        VARCHAR(60)  NOT NULL REFERENCES officers(officer_id),
    authorization_ref VARCHAR(100) NOT NULL,
    revoked_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE OR REPLACE RULE revocations_no_update
    AS ON UPDATE TO revocations DO INSTEAD NOTHING;
CREATE OR REPLACE RULE revocations_no_delete
    AS ON DELETE TO revocations DO INSTEAD NOTHING;

-- ============================================================
-- VIEWS
-- ============================================================
CREATE OR REPLACE VIEW ledger_summary AS
SELECT
    province_code,
    ward_code,
    document_type,
    status,
    COUNT(*)                                              AS total_issued,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS issued_today,
    MAX(created_at)                                       AS last_issued_at
FROM ndo_ledger
GROUP BY province_code, ward_code, document_type, status;

CREATE OR REPLACE VIEW request_summary AS
SELECT
    ward_code,
    status,
    document_type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE submitted_at > NOW() - INTERVAL '24 hours') AS today,
    AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at))/3600)
        FILTER (WHERE reviewed_at IS NOT NULL) AS avg_hours_to_review
FROM service_requests
GROUP BY ward_code, status, document_type;

-- Done
SELECT 'PRATIBIMBA schema ready.' AS result;