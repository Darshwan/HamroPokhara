-- migrations/005_civic_features.sql
-- Run: psql -d pratibimba -f migrations/005_civic_features.sql

-- ── Blood Donor Registry ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS blood_donors (
    id            BIGSERIAL   PRIMARY KEY,
    citizen_nid   VARCHAR(30) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    blood_group   VARCHAR(5)  NOT NULL
                  CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
    ward_code     VARCHAR(20),
    phone         VARCHAR(20) NOT NULL,
    last_donated  DATE,
    is_available  BOOLEAN     DEFAULT true,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blood_group ON blood_donors(blood_group, is_available);

-- ── Tourist Guide (Hotels/Trails) ─────────────────────────────
CREATE TABLE IF NOT EXISTS tourism_listings (
    id            BIGSERIAL   PRIMARY KEY,
    listing_id    VARCHAR(40) UNIQUE NOT NULL,
    name          VARCHAR(100) NOT NULL,
    name_ne       VARCHAR(100),
    listing_type  VARCHAR(30) NOT NULL
                  CHECK (listing_type IN ('HOTEL','TRAIL','RESTAURANT','ADVENTURE','GUIDE_AGENCY')),
    safety_rating VARCHAR(5)  DEFAULT 'B',
    star_rating   DECIMAL(2,1),
    ward_code     VARCHAR(20),
    address       VARCHAR(200),
    phone         VARCHAR(20),
    is_approved   BOOLEAN     DEFAULT false,
    tims_required BOOLEAN     DEFAULT false,
    description   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tourism_type ON tourism_listings(listing_type, is_approved);

-- ── Lost & Found ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lost_found (
    id            BIGSERIAL   PRIMARY KEY,
    item_id       VARCHAR(40) UNIQUE NOT NULL,
    reporter_nid  VARCHAR(30),
    report_type   VARCHAR(10) NOT NULL CHECK (report_type IN ('LOST','FOUND')),
    item_desc     VARCHAR(200) NOT NULL,
    location_desc VARCHAR(200),
    ward_code     VARCHAR(20),
    status        VARCHAR(20) DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN','CLAIMED','CLOSED')),
    contact_phone VARCHAR(20),
    reported_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Volunteer Registry ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS volunteers (
    id            BIGSERIAL   PRIMARY KEY,
    volunteer_id  VARCHAR(40) UNIQUE NOT NULL,
    citizen_nid   VARCHAR(30) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    phone         VARCHAR(20) NOT NULL,
    skills        TEXT[],     -- ['CLEANUP','FIRST_AID','PLANTING','TECH','DISASTER']
    availability  VARCHAR(30) DEFAULT 'WEEKENDS',
    ward_code     VARCHAR(20),
    is_active     BOOLEAN     DEFAULT true,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Officer Feedback / Ratings ────────────────────────────────
CREATE TABLE IF NOT EXISTS officer_feedback (
    id              BIGSERIAL   PRIMARY KEY,
    feedback_id     VARCHAR(40) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    officer_id      VARCHAR(60) NOT NULL,
    request_id      VARCHAR(60),
    speed_rating    SMALLINT    CHECK (speed_rating BETWEEN 1 AND 5),
    helpfulness     SMALLINT    CHECK (helpfulness BETWEEN 1 AND 5),
    transparency    SMALLINT    CHECK (transparency BETWEEN 1 AND 5),
    avg_rating      DECIMAL(3,2),
    comment         TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_officer ON officer_feedback(officer_id);

-- ── Public Hearing / Votes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_hearings (
    id            BIGSERIAL   PRIMARY KEY,
    hearing_id    VARCHAR(40) UNIQUE NOT NULL,
    title         VARCHAR(200) NOT NULL,
    title_ne      VARCHAR(200),
    description   TEXT,
    ward_code     VARCHAR(20),
    status        VARCHAR(20) DEFAULT 'SCHEDULED'
                  CHECK (status IN ('SCHEDULED','LIVE','CLOSED')),
    votes_yes     INTEGER     DEFAULT 0,
    votes_no      INTEGER     DEFAULT 0,
    votes_abstain INTEGER     DEFAULT 0,
    scheduled_at  TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hearing_votes (
    id         BIGSERIAL   PRIMARY KEY,
    hearing_id VARCHAR(40) NOT NULL,
    citizen_nid VARCHAR(30) NOT NULL,
    vote       VARCHAR(10) NOT NULL CHECK (vote IN ('YES','NO','ABSTAIN')),
    voted_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hearing_id, citizen_nid)
);

-- ── Tax Payments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_payments (
    id           BIGSERIAL   PRIMARY KEY,
    payment_id   VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid  VARCHAR(30) NOT NULL,
    tax_record_id BIGINT,
    amount       DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL
                 CHECK (payment_method IN ('ESEWA','KHALTI','CONNECTIPS','BANK')),
    transaction_ref VARCHAR(60),
    status       VARCHAR(20) DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','COMPLETED','FAILED','REFUNDED')),
    paid_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Krishi Anudan Applications ────────────────────────────────
CREATE TABLE IF NOT EXISTS krishi_applications (
    id            BIGSERIAL   PRIMARY KEY,
    application_id VARCHAR(40) UNIQUE NOT NULL,
    citizen_nid   VARCHAR(30) NOT NULL,
    subsidy_type  VARCHAR(50) NOT NULL,
    -- SEEDS | FERTILIZER_CHEMICAL | FERTILIZER_ORGANIC | MACHINERY | IRRIGATION
    crop_type     VARCHAR(50),
    land_area     DECIMAL(8,2),
    status        VARCHAR(20) DEFAULT 'PENDING',
    ward_code     VARCHAR(20),
    submitted_at  TIMESTAMPTZ DEFAULT NOW(),
    approved_at   TIMESTAMPTZ,
    notes         TEXT
);

-- ── Digital Signatures ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_signatures (
    id              BIGSERIAL   PRIMARY KEY,
    signature_id    VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    document_ref    VARCHAR(60),
    document_hash   VARCHAR(64) NOT NULL,
    signature_hash  VARCHAR(64) NOT NULL,
    signed_at       TIMESTAMPTZ DEFAULT NOW(),
    valid_until     TIMESTAMPTZ
);

-- ── AI Chat Log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_chat_log (
    id           BIGSERIAL   PRIMARY KEY,
    session_id   VARCHAR(40),
    citizen_nid  VARCHAR(30),
    query        TEXT NOT NULL,
    response     TEXT NOT NULL,
    language     VARCHAR(5)  DEFAULT 'ne',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed tourism listings
INSERT INTO tourism_listings (listing_id, name, name_ne, listing_type, safety_rating, star_rating, ward_code, is_approved, tims_required, description)
VALUES
('TL-001','Fishtail Lodge','फिशटेल लज','HOTEL','A',4.8,'NPL-04-33-06',true,false,'Lakeside premium lodge with Machhapuchhre views'),
('TL-002','Hotel Barahi','बाराही होटल','HOTEL','A',4.5,'NPL-04-33-06',true,false,'5-star on Phewa Lake shore'),
('TL-003','Annapurna Base Camp Trail','अन्नपूर्ण बेस क्याम्प ट्रेल','TRAIL','A',4.7,'NPL-04-33-09',true,true,'5-day classic trek to 4,130m'),
('TL-004','Poon Hill Trek','पुन हिल ट्रेक','TRAIL','A',4.9,'NPL-04-33-09',true,true,'3-day sunrise viewpoint trek'),
('TL-005','Paragliding Point','प्याराग्लाइडिङ','ADVENTURE','A',4.6,'NPL-04-33-09',true,false,'World-class tandem paragliding')
ON CONFLICT (listing_id) DO NOTHING;

-- Seed blood donors
INSERT INTO blood_donors (citizen_nid, full_name, blood_group, ward_code, phone, last_donated)
VALUES
('12345678901','Ram Kumar Sharma','A+','NPL-04-33-09','9800000001','2024-04-10'),
('98765432101','Sita Devi Gurung','A+','NPL-04-33-06','9800000002','2024-03-15'),
('11223344556','Hari B. Thapa','O+','NPL-04-33-09','9800000003','2024-02-20'),
('44556677889','Maya Rana','B+','NPL-04-33-01','9800000004','2024-05-01'),
('55667788990','Prakash KC','AB-','NPL-04-33-17','9800000005','2024-01-30')
ON CONFLICT DO NOTHING;

-- Seed a public hearing
INSERT INTO public_hearings (hearing_id, title, title_ne, description, ward_code, status, votes_yes, votes_no, votes_abstain, scheduled_at)
VALUES (
    'PH-2082-001',
    'New Park at Phewa North Shoreline',
    'फेवा उत्तर किनारामा नयाँ पार्क',
    'Proposed landscape design and environmental impact for a 2-hectare public park at Phewa Lake north shore. Budget: NPR 45 Lakh.',
    'NPL-04-33-09',
    'LIVE',
    847, 267, 133,
    NOW() - INTERVAL '2 hours'
)
ON CONFLICT (hearing_id) DO NOTHING;

SELECT 'Migration 005 complete!' AS status,
  (SELECT COUNT(*) FROM blood_donors)        AS blood_donors,
  (SELECT COUNT(*) FROM tourism_listings)    AS tourism_listings,
  (SELECT COUNT(*) FROM public_hearings)     AS hearings;