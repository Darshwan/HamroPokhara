package database

import (
	"context"
	"fmt"
)

// ensureCoreAuthSchema creates auth-related tables that the app depends on.
// This is intentionally idempotent so older volumes can boot without a manual migration reset.
func (db *DB) ensureCoreAuthSchema(ctx context.Context) error {
	statements := []string{
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
	}

	for _, statement := range statements {
		if _, err := db.Pool.Exec(ctx, statement); err != nil {
			return fmt.Errorf("ensure auth schema: %w", err)
		}
	}

	return nil
}
