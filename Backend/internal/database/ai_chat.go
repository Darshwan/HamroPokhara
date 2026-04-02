package database

import (
	"context"
	"fmt"

	"pratibimba/internal/models"
)

func (db *DB) InsertAIChatLog(ctx context.Context, entry *models.AIChatLog) error {
	_, err := db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS ai_chat_log (
			id           BIGSERIAL   PRIMARY KEY,
			session_id   VARCHAR(40),
			citizen_nid  VARCHAR(30),
			query        TEXT NOT NULL,
			response     TEXT NOT NULL,
			language     VARCHAR(5)  DEFAULT 'ne',
			created_at   TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("ensure ai chat log table: %w", err)
	}

	_, err = db.Pool.Exec(ctx, `
		INSERT INTO ai_chat_log (session_id, citizen_nid, query, response, language, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, entry.SessionID, entry.CitizenNID, entry.Query, entry.Response, entry.Language, entry.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert ai chat log: %w", err)
	}

	return nil
}
