package database

import (
	"context"
	"fmt"

	"pratibimba/internal/models"
)

func (db *DB) GetOfficerByID(ctx context.Context, officerID string) (*models.Officer, error) {
	var o models.Officer
	err := db.Pool.QueryRow(ctx, `
		SELECT officer_id, full_name, ward_code, district_code,
		       province_code, designation, is_active, created_at
		FROM officers
		WHERE officer_id = $1 LIMIT 1
	`, officerID).Scan(
		&o.OfficerID, &o.FullName, &o.WardCode, &o.DistrictCode,
		&o.ProvinceCode, &o.Designation, &o.IsActive, &o.CreatedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get officer: %w", err)
	}
	return &o, nil
}

func (db *DB) VerifyOfficerPIN(ctx context.Context, officerID, pinHash string) (*models.Officer, error) {
	var o models.Officer
	err := db.Pool.QueryRow(ctx, `
		SELECT officer_id, full_name, ward_code, district_code,
		       province_code, designation, is_active, created_at
		FROM officers
		WHERE officer_id = $1
		  AND pin_hash   = $2
		  AND is_active  = true
		LIMIT 1
	`, officerID, pinHash).Scan(
		&o.OfficerID, &o.FullName, &o.WardCode, &o.DistrictCode,
		&o.ProvinceCode, &o.Designation, &o.IsActive, &o.CreatedAt,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil // wrong credentials — not a system error
		}
		return nil, fmt.Errorf("verify pin: %w", err)
	}
	return &o, nil
}
