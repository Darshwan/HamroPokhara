package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(databaseURL string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse db url: %w", err)
	}

	cfg.MaxConns = 25
	cfg.MinConns = 5
	cfg.MaxConnLifetime = 1 * time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	db := &DB{Pool: pool}
	if err := db.ensureCoreAuthSchema(ctx); err != nil {
		return nil, err
	}

	log.Println("✅ PostgreSQL connected")
	return db, nil
}

func (db *DB) Close() {
	db.Pool.Close()
	log.Println("Database connection closed")
}

// NextSequence atomically increments and returns the next
// sequence number for a given ward + year combination.
// Safe under high concurrency — uses ON CONFLICT upsert.
func (db *DB) NextSequence(ctx context.Context, key string, year int) (int64, error) {
	var seq int64
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO dtid_sequences (ward_code, nepali_year, last_sequence)
		VALUES ($1, $2, 1)
		ON CONFLICT (ward_code, nepali_year)
		DO UPDATE SET last_sequence = dtid_sequences.last_sequence + 1
		RETURNING last_sequence
	`, key, year).Scan(&seq)
	if err != nil {
		return 0, fmt.Errorf("sequence gen: %w", err)
	}
	return seq, nil
}
