package database

import (
	"context"
	"fmt"

	"pratibimba/internal/models"
)

func (db *DB) InsertLedgerEntry(ctx context.Context, e *models.LedgerEntry) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO ndo_ledger (
			dtid, document_hash, record_hash, document_type,
			officer_id, ward_code, district_code, province_code,
			request_id, status, sync_status, created_at, synced_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`,
		e.DTID, e.DocumentHash, e.RecordHash, e.DocumentType,
		e.OfficerID, e.WardCode, e.DistrictCode, e.ProvinceCode,
		e.RequestID, e.Status, e.SyncStatus, e.CreatedAt, e.SyncedAt,
	)
	if err != nil {
		return fmt.Errorf("insert ledger: %w", err)
	}
	return nil
}

func (db *DB) GetLedgerByDTID(ctx context.Context, dtid string) (*models.LedgerEntry, error) {
	var e models.LedgerEntry
	err := db.Pool.QueryRow(ctx, `
		SELECT id, dtid, document_hash, record_hash, document_type,
		       officer_id, ward_code, district_code, province_code,
		       COALESCE(request_id,''), status, sync_status,
		       created_at, synced_at
		FROM ndo_ledger
		WHERE dtid = $1 LIMIT 1
	`, dtid).Scan(
		&e.ID, &e.DTID, &e.DocumentHash, &e.RecordHash, &e.DocumentType,
		&e.OfficerID, &e.WardCode, &e.DistrictCode, &e.ProvinceCode,
		&e.RequestID, &e.Status, &e.SyncStatus,
		&e.CreatedAt, &e.SyncedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get ledger: %w", err)
	}
	return &e, nil
}

func (db *DB) GetRecentLedgerEntries(ctx context.Context, limit int) ([]models.LedgerEntry, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, dtid, document_hash, record_hash, document_type,
		       officer_id, ward_code, district_code, province_code,
		       COALESCE(request_id,''), status, sync_status,
		       created_at, synced_at
		FROM ndo_ledger
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("get recent: %w", err)
	}
	defer rows.Close()

	var list []models.LedgerEntry
	for rows.Next() {
		var e models.LedgerEntry
		if err := rows.Scan(
			&e.ID, &e.DTID, &e.DocumentHash, &e.RecordHash, &e.DocumentType,
			&e.OfficerID, &e.WardCode, &e.DistrictCode, &e.ProvinceCode,
			&e.RequestID, &e.Status, &e.SyncStatus,
			&e.CreatedAt, &e.SyncedAt,
		); err != nil {
			return nil, fmt.Errorf("scan ledger: %w", err)
		}
		list = append(list, e)
	}
	return list, nil
}

func (db *DB) LogAccess(
	ctx context.Context,
	dtid, requesterID, requesterType, agency, result, ip string,
	responseMS int,
) (int64, error) {
	var id int64
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO access_log (
			queried_dtid, requester_id, requester_type,
			requester_agency, result, ip_address, response_ms
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id
	`, dtid, requesterID, requesterType, agency, result, ip, responseMS,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("log access: %w", err)
	}
	return id, nil
}
