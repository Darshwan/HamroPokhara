package database

import (
	"context"
	"fmt"

	"pratibimba/internal/models"
)

func (db *DB) GetDashboardStats(ctx context.Context) (*models.DashboardStats, error) {
	s := &models.DashboardStats{
		DocumentsByType:     make(map[string]int64),
		DocumentsByProvince: make(map[string]int64),
	}

	queries := []struct {
		dest  *int64
		query string
	}{
		{&s.TotalDocuments, `SELECT COUNT(*) FROM ndo_ledger`},
		{&s.IssuedToday, `SELECT COUNT(*) FROM ndo_ledger WHERE created_at > NOW() - INTERVAL '24 hours'`},
		{&s.ActiveDocuments, `SELECT COUNT(*) FROM ndo_ledger WHERE status = 'ACTIVE'`},
		{&s.VerificationsToday, `SELECT COUNT(*) FROM access_log WHERE queried_at > NOW() - INTERVAL '24 hours'`},
		{&s.TamperedAlerts, `SELECT COUNT(*) FROM access_log WHERE result = 'TAMPERED' AND queried_at > NOW() - INTERVAL '24 hours'`},
		{&s.PendingRequests, `SELECT COUNT(*) FROM service_requests WHERE status IN ('PENDING','UNDER_REVIEW')`},
	}

	for _, q := range queries {
		if err := db.Pool.QueryRow(ctx, q.query).Scan(q.dest); err != nil {
			return nil, fmt.Errorf("stats query: %w", err)
		}
	}

	// Documents by type
	rows, err := db.Pool.Query(ctx,
		`SELECT document_type, COUNT(*) FROM ndo_ledger GROUP BY document_type`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t string
		var c int64
		if err := rows.Scan(&t, &c); err != nil {
			return nil, err
		}
		s.DocumentsByType[t] = c
	}

	// Documents by province
	rows2, err := db.Pool.Query(ctx,
		`SELECT province_code::text, COUNT(*) FROM ndo_ledger GROUP BY province_code`)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var p string
		var c int64
		if err := rows2.Scan(&p, &c); err != nil {
			return nil, err
		}
		s.DocumentsByProvince[p] = c
	}

	// Recent entries
	s.RecentEntries, err = db.GetRecentLedgerEntries(ctx, 10)
	if err != nil {
		return nil, err
	}

	return s, nil
}
