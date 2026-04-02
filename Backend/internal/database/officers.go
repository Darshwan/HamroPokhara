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

// GetOfficer retrieves officer details by officer ID
func (db *DB) GetOfficer(ctx context.Context, officerID string) (*models.Officer, error) {
	return db.GetOfficerByID(ctx, officerID)
}

// GetWardDetails retrieves ward office information for PDF generation
// This queries citizen_profiles table to get ward metadata
// In production, you'd want a dedicated wards table
func (db *DB) GetWardDetails(ctx context.Context, wardCode string) (*models.Ward, error) {
	// For now, return hardcoded ward details based on ward code
	// In production, you'd query a wards table
	wardMap := map[string]*models.Ward{
		"NPL-04-33-09": {
			WardCode:     "NPL-04-33-09",
			WardNumber:   "९",
			DistrictName: "कास्की",
			ProvinceName: "गण्डकी प्रदेश",
			OfficeName:   "वडा कार्यालय",
			OfficePhone:  "०६१-५२०७४३",
			OfficeEmail:  "ward9@pokharamun.gov.np",
		},
		"NPL-04-33-05": {
			WardCode:     "NPL-04-33-05",
			WardNumber:   "५",
			DistrictName: "कास्की",
			ProvinceName: "गण्डकी प्रदेश",
			OfficeName:   "वडा कार्यालय",
			OfficePhone:  "०६१-५२०७४३",
			OfficeEmail:  "ward5@pokharamun.gov.np",
		},
		"NPL-04-33-01": {
			WardCode:     "NPL-04-33-01",
			WardNumber:   "१",
			DistrictName: "कास्की",
			ProvinceName: "गण्डकी प्रदेश",
			OfficeName:   "वडा कार्यालय",
			OfficePhone:  "०६१-५२०७४३",
			OfficeEmail:  "ward1@pokharamun.gov.np",
		},
	}

	if ward, ok := wardMap[wardCode]; ok {
		return ward, nil
	}

	// Return a default ward if not found
	return &models.Ward{
		WardCode:     wardCode,
		WardNumber:   "?",
		DistrictName: "कास्की",
		ProvinceName: "गण्डकी प्रदेश",
		OfficeName:   "वडा कार्यालय",
		OfficePhone:  "०६१-५२०७४३",
		OfficeEmail:  "ward@pokharamun.gov.np",
	}, nil
}
