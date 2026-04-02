package database

import (
	"context"
	"fmt"
	"time"

	"pratibimba/internal/models"
)

func (db *DB) InsertRequest(ctx context.Context, r *models.ServiceRequest) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO service_requests (
			request_id, citizen_nid, citizen_name, citizen_phone,
			document_type, purpose, additional_info,
			ward_code, status, submitted_at, ip_address, ocr_raw_data
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`,
		r.RequestID, r.CitizenNID, r.CitizenName, r.CitizenPhone,
		r.DocumentType, r.Purpose, r.AdditionalInfo,
		r.WardCode, "PENDING", r.SubmittedAt, r.IPAddress, r.OCRRawData,
	)
	if err != nil {
		return fmt.Errorf("insert request: %w", err)
	}
	return nil
}

func (db *DB) GetRequestByID(ctx context.Context, requestID string) (*models.ServiceRequest, error) {
	var r models.ServiceRequest
	err := db.Pool.QueryRow(ctx, `
		SELECT id, request_id, citizen_nid, citizen_name, citizen_phone,
		       COALESCE(citizen_dob,''), COALESCE(citizen_gender,''), COALESCE(citizen_address,''),
		       COALESCE(father_name,''), COALESCE(mother_name,''),
		       document_type, purpose, additional_info, ward_code,
		       COALESCE(assigned_officer,''), COALESCE(approved_by_officer_id,''), status,
		       COALESCE(rejection_reason,''), COALESCE(dtid,''), COALESCE(document_hash,''),
		       COALESCE(issued_date_bs,''), COALESCE(issued_time_np,''), COALESCE(valid_until_bs,''),
		       submitted_at, reviewed_at, approved_at, completed_at, COALESCE(issued_at, NOW()),
		       COALESCE(ip_address,'')
		FROM service_requests
		WHERE request_id = $1 LIMIT 1
	`, requestID).Scan(
		&r.ID, &r.RequestID, &r.CitizenNID, &r.CitizenName, &r.CitizenPhone,
		&r.CitizenDOB, &r.CitizenGender, &r.CitizenAddress,
		&r.FatherName, &r.MotherName,
		&r.DocumentType, &r.Purpose, &r.AdditionalInfo, &r.WardCode,
		&r.AssignedOfficer, &r.ApprovedByOfficerID, &r.Status,
		&r.RejectionReason, &r.DTID, &r.DocumentHash,
		&r.IssuedDateBS, &r.IssuedTimeNP, &r.ValidUntilBS,
		&r.SubmittedAt, &r.ReviewedAt, &r.ApprovedAt, &r.CompletedAt, &r.IssuedAt,
		&r.IPAddress,
	)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, nil
		}
		return nil, fmt.Errorf("get request: %w", err)
	}
	return &r, nil
}

// GetServiceRequest is an alias for GetRequestByID for consistency
func (db *DB) GetServiceRequest(ctx context.Context, requestID string) (*models.ServiceRequest, error) {
	return db.GetRequestByID(ctx, requestID)
}

func (db *DB) GetPendingRequestsByWard(ctx context.Context, wardCode string) ([]models.ServiceRequest, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, request_id, citizen_nid, citizen_name, citizen_phone,
		       document_type, purpose, additional_info, ward_code,
		       COALESCE(assigned_officer,''), status,
		       COALESCE(rejection_reason,''), COALESCE(dtid,''),
		       submitted_at, reviewed_at, completed_at,
		       COALESCE(ip_address,'')
		FROM service_requests
		WHERE ward_code = $1
		  AND status IN ('PENDING','UNDER_REVIEW')
		ORDER BY submitted_at ASC
	`, wardCode)
	if err != nil {
		return nil, fmt.Errorf("get pending: %w", err)
	}
	defer rows.Close()

	var list []models.ServiceRequest
	for rows.Next() {
		var r models.ServiceRequest
		if err := rows.Scan(
			&r.ID, &r.RequestID, &r.CitizenNID, &r.CitizenName, &r.CitizenPhone,
			&r.DocumentType, &r.Purpose, &r.AdditionalInfo, &r.WardCode,
			&r.AssignedOfficer, &r.Status,
			&r.RejectionReason, &r.DTID,
			&r.SubmittedAt, &r.ReviewedAt, &r.CompletedAt,
			&r.IPAddress,
		); err != nil {
			return nil, fmt.Errorf("scan request: %w", err)
		}
		list = append(list, r)
	}
	return list, nil
}

func (db *DB) MarkRequestUnderReview(ctx context.Context, requestID, officerID string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE service_requests
		SET status = 'UNDER_REVIEW',
		    assigned_officer = $2,
		    reviewed_at = $3
		WHERE request_id = $1
	`, requestID, officerID, time.Now().UTC())
	return err
}

func (db *DB) MarkRequestApproved(ctx context.Context, requestID, dtid string) error {
	now := time.Now().UTC()
	_, err := db.Pool.Exec(ctx, `
		UPDATE service_requests
		SET status       = 'APPROVED',
		    dtid         = $2,
		    completed_at = $3
		WHERE request_id = $1
	`, requestID, dtid, now)
	return err
}

func (db *DB) MarkRequestRejected(ctx context.Context, requestID, reason string) error {
	now := time.Now().UTC()
	_, err := db.Pool.Exec(ctx, `
		UPDATE service_requests
		SET status           = 'REJECTED',
		    rejection_reason = $2,
		    completed_at     = $3
		WHERE request_id = $1
	`, requestID, reason, now)
	return err
}
