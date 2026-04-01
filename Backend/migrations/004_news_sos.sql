-- ============================================================
-- MIGRATION 004: News/Notices from Ward + SOS Emergency
-- Run: psql -d pratibimba -f migrations/004_news_sos.sql
-- ============================================================

-- ── Ward News / Notices (posted by officers) ─────────────────
CREATE TABLE IF NOT EXISTS ward_news (
    id              BIGSERIAL     PRIMARY KEY,
    news_id         VARCHAR(60)   UNIQUE NOT NULL,
    officer_id      VARCHAR(60)   NOT NULL REFERENCES officers(officer_id),
    ward_code       VARCHAR(20)   NOT NULL,
    title           VARCHAR(200)  NOT NULL,
    title_ne        VARCHAR(200),
    body            TEXT          NOT NULL,
    body_ne         TEXT,
    category        VARCHAR(30)   NOT NULL DEFAULT 'GENERAL'
                    CHECK (category IN ('URGENT','INFRASTRUCTURE','HEALTH','CULTURE','TOURISM','GENERAL','WATER','ELECTRICITY','ROAD')),
    priority        SMALLINT      DEFAULT 0,
    -- 0=normal, 1=important, 2=urgent, 3=critical
    image_url       TEXT,
    is_published    BOOLEAN       DEFAULT true,
    published_at    TIMESTAMPTZ   DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    view_count      INTEGER       DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_news_ward     ON ward_news(ward_code, is_published);
CREATE INDEX IF NOT EXISTS idx_news_priority ON ward_news(priority DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON ward_news(category);

-- ── SOS Emergency Events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_events (
    id              BIGSERIAL     PRIMARY KEY,
    sos_id          VARCHAR(60)   UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30),
    tourist_passport VARCHAR(30),
    session_type    VARCHAR(20)   NOT NULL,
    full_name       VARCHAR(100),
    phone           VARCHAR(20),
    location_lat    DECIMAL(10,7),
    location_lng    DECIMAL(10,7),
    location_desc   VARCHAR(200),
    ward_code       VARCHAR(20),
    emergency_type  VARCHAR(50)   DEFAULT 'GENERAL'
                    CHECK (emergency_type IN ('MEDICAL','FIRE','CRIME','FLOOD','LANDSLIDE','TREKKING','GENERAL')),
    message         TEXT,
    status          VARCHAR(20)   DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','RESPONDED','RESOLVED','FALSE_ALARM')),
    responded_by    VARCHAR(60),
    response_note   TEXT,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sos_status  ON sos_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_ward    ON sos_events(ward_code);

-- ── Ward Registry (real ward data) ───────────────────────────
CREATE TABLE IF NOT EXISTS ward_registry (
    ward_code       VARCHAR(20)   PRIMARY KEY,
    ward_number     SMALLINT      NOT NULL,
    ward_name       VARCHAR(100),
    ward_name_ne    VARCHAR(100),
    district        VARCHAR(50)   NOT NULL,
    district_ne     VARCHAR(50),
    province        VARCHAR(50)   NOT NULL,
    province_ne     VARCHAR(50),
    municipality    VARCHAR(100)  NOT NULL,
    municipality_ne VARCHAR(100),
    office_phone    VARCHAR(20),
    office_email    VARCHAR(100),
    office_address  VARCHAR(200),
    lat             DECIMAL(10,7),
    lng             DECIMAL(10,7),
    total_population INTEGER,
    total_households INTEGER
);

-- Insert Pokhara Metro wards
INSERT INTO ward_registry VALUES
('NPL-04-33-01', 1,  'Ward 1',  'वडा १',  'Kaski','कास्की','Gandaki','गण्डकी','Pokhara Metropolitan City','पोखरा महानगरपालिका','061-520001','ward1@pokharamun.gov.np','Pokhara-1', 28.2096, 83.9856, 12400, 2800),
('NPL-04-33-05', 5,  'Ward 5',  'वडा ५',  'Kaski','कास्की','Gandaki','गण्डकी','Pokhara Metropolitan City','पोखरा महानगरपालिका','061-520005','ward5@pokharamun.gov.np','Pokhara-5', 28.2150, 83.9920, 15200, 3400),
('NPL-04-33-06', 6,  'Ward 6',  'वडा ६',  'Kaski','कास्की','Gandaki','गण्डकी','Pokhara Metropolitan City','पोखरा महानगरपालिका','061-520006','ward6@pokharamun.gov.np','Baidam',    28.2200, 83.9980, 18900, 4200),
('NPL-04-33-09', 9,  'Ward 9',  'वडा ९',  'Kaski','कास्की','Gandaki','गण्डकी','Pokhara Metropolitan City','पोखरा महानगरपालिका','061-520009','ward9@pokharamun.gov.np','Pokhara-9', 28.2380, 84.0100, 22100, 5100),
('NPL-04-33-17', 17, 'Ward 17', 'वडा १७', 'Kaski','कास्की','Gandaki','गण्डकी','Pokhara Metropolitan City','पोखरा महानगरपालिका','061-520017','ward17@pokharamun.gov.np','Lekhnath',  28.2050, 84.0200, 19800, 4600)
ON CONFLICT (ward_code) DO NOTHING;

-- Demo news items
INSERT INTO ward_news (news_id, officer_id, ward_code, title, title_ne, body, body_ne, category, priority)
VALUES
('NWS-001','WO-04-33-09-001','NPL-04-33-09',
 'Water Supply Interruption – 2082/06/15',
 'पानी आपूर्ति बन्द – २०८२/०६/१५',
 'Water supply will be interrupted on 2082/06/15 from 8AM to 4PM for pipeline maintenance work on Prithvi Path section.',
 'मिति २०८२/०६/१५ मा बिहान ८ बजेदेखि बेलुका ४ बजेसम्म पृथ्वी पथ खण्डमा पाइपलाइन मर्मत कार्यका लागि पानी आपूर्ति बन्द हुनेछ।',
 'WATER', 2),
('NWS-002','WO-04-33-09-001','NPL-04-33-09',
 'Road Widening Begins Next Week',
 'सडक चौडाइ आउँदो हप्ता सुरु हुँदैछ',
 'The road widening project from Prithvi Chowk to the Airport will commence next Monday. Expect traffic delays.',
 'पृथ्वी चोकदेखि विमानस्थलसम्मको सडक चौडाइ परियोजना आउँदो सोमबारदेखि सुरु हुनेछ। यातायातमा ढिलाइ हुन सक्छ।',
 'ROAD', 1),
('NWS-003','WO-04-33-09-001','NPL-04-33-09',
 'Free Health Camp – 2082/06/20',
 'नि:शुल्क स्वास्थ्य शिविर – २०८२/०६/२०',
 'A free health checkup camp will be held at Ward 9 Community Hall. Services: blood pressure, diabetes screening, eye checkup.',
 'वडा ९ सामुदायिक भवनमा नि:शुल्क स्वास्थ्य जाँच शिविर आयोजना गरिनेछ। सेवाहरू: रक्तचाप, मधुमेह, आँखा जाँच।',
 'HEALTH', 1)
ON CONFLICT (news_id) DO NOTHING;

SELECT 'Migration 004 complete!' AS status,
  (SELECT COUNT(*) FROM ward_news)     AS news_items,
  (SELECT COUNT(*) FROM sos_events)    AS sos_events,
  (SELECT COUNT(*) FROM ward_registry) AS wards;
