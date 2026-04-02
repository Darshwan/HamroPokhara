package database

import (
	"context"
	"fmt"
)

// ensureCoreAuthSchema creates auth-related tables that the app depends on.
// This is intentionally idempotent so older volumes can boot without a manual migration reset.
func (db *DB) ensureCoreAuthSchema(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS citizen_profiles (
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
		)`,
		`CREATE INDEX IF NOT EXISTS idx_citizen_ward ON citizen_profiles(ward_code)`,
		`CREATE INDEX IF NOT EXISTS idx_citizen_active ON citizen_profiles(is_active)`,
		`CREATE TABLE IF NOT EXISTS citizen_sessions (
			id              BIGSERIAL    PRIMARY KEY,
			session_id      VARCHAR(80)  UNIQUE NOT NULL,
			citizen_nid     VARCHAR(30)  NOT NULL,
			session_type    VARCHAR(20)  NOT NULL
			                CHECK (session_type IN ('CITIZEN', 'TOURIST', 'GUEST')),
			id_type         VARCHAR(30)  NOT NULL,
			verified        BOOLEAN      DEFAULT false,
			device_info     TEXT,
			ip_address      VARCHAR(45),
			expires_at      TIMESTAMPTZ  NOT NULL,
			created_at      TIMESTAMPTZ  DEFAULT NOW(),
			last_used_at    TIMESTAMPTZ  DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_nid     ON citizen_sessions(citizen_nid)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_id      ON citizen_sessions(session_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON citizen_sessions(expires_at)`,
		`CREATE TABLE IF NOT EXISTS tourist_profiles (
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
			raw_text        TEXT,
			ocr_raw         TEXT,
			created_at      TIMESTAMPTZ  DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS tourist_requests (
			id              BIGSERIAL    PRIMARY KEY,
			request_id      VARCHAR(60)  UNIQUE NOT NULL,
			passport_no     VARCHAR(30)  NOT NULL,
			tourist_name    VARCHAR(100) NOT NULL,
			service_type    VARCHAR(80)  NOT NULL,
			destination     VARCHAR(100),
			trek_start_date DATE,
			trek_end_date   DATE,
			group_size      SMALLINT     DEFAULT 1,
			details         TEXT,
			status          VARCHAR(30)  DEFAULT 'PENDING',
			fee_amount      DECIMAL(10,2),
			fee_paid        BOOLEAN      DEFAULT false,
			submitted_at    TIMESTAMPTZ  DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ocr_audit (
			id               BIGSERIAL     PRIMARY KEY,
			session_id       VARCHAR(80),
			document_type    VARCHAR(30)   NOT NULL,
			extracted_fields JSONB,
			confidence       DECIMAL(5,2),
			processing_ms    INTEGER,
			ip_address       VARCHAR(45),
			created_at       TIMESTAMPTZ   DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ward_news (
			id              BIGSERIAL     PRIMARY KEY,
			news_id         VARCHAR(60)   UNIQUE NOT NULL,
			officer_id      VARCHAR(60)   NOT NULL,
			ward_code       VARCHAR(20)   NOT NULL,
			title           VARCHAR(200)  NOT NULL,
			title_ne        VARCHAR(200),
			body            TEXT          NOT NULL,
			body_ne         TEXT,
			category        VARCHAR(30)   NOT NULL DEFAULT 'GENERAL'
			                CHECK (category IN ('URGENT','INFRASTRUCTURE','HEALTH','CULTURE','TOURISM','GENERAL','WATER','ELECTRICITY','ROAD')),
			priority        SMALLINT      DEFAULT 0,
			image_url       TEXT,
			is_published    BOOLEAN       DEFAULT true,
			published_at    TIMESTAMPTZ   DEFAULT NOW(),
			expires_at      TIMESTAMPTZ,
			view_count      INTEGER       DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_news_ward     ON ward_news(ward_code, is_published)`,
		`CREATE INDEX IF NOT EXISTS idx_news_priority ON ward_news(priority DESC, published_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_news_category ON ward_news(category)`,
		`CREATE TABLE IF NOT EXISTS notices (
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
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notice_category ON notices(category)`,
		`CREATE INDEX IF NOT EXISTS idx_notice_ward ON notices(ward_code)`,
		`CREATE INDEX IF NOT EXISTS idx_notice_urgent ON notices(is_urgent)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS citizen_dob VARCHAR(30)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS citizen_gender VARCHAR(20)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS citizen_address VARCHAR(200)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS father_name VARCHAR(100)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS approved_by_officer_id VARCHAR(60)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS issued_date_bs VARCHAR(40)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS issued_time_np VARCHAR(40)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS valid_until_bs VARCHAR(40)`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
		`ALTER TABLE IF EXISTS service_requests ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ`,
	}

	for _, statement := range statements {
		if _, err := db.Pool.Exec(ctx, statement); err != nil {
			return fmt.Errorf("ensure auth schema: %w", err)
		}
	}

	return nil
}
