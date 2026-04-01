package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
)

// ── Citizen Auth ──────────────────────────────────────────────

// POST /auth/citizen/login
// Citizen logs in with NID + one of: citizenship, driving license, NID card
func CitizenLogin(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			IDType string `json:"id_type"`
			// Options: "NID" | "CITIZENSHIP" | "DRIVING_LICENSE"
			PrimaryValue string `json:"primary_value"`
			// The NID number (always required)
			SecondaryValue string `json:"secondary_value"`
			// Citizenship no / License no / etc (optional)
			DeviceInfo string `json:"device_info"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request format",
			})
		}

		// Normalize
		req.PrimaryValue = strings.TrimSpace(req.PrimaryValue)
		req.SecondaryValue = strings.TrimSpace(req.SecondaryValue)
		req.IDType = strings.ToUpper(req.IDType)
		if req.IDType == "" {
			req.IDType = "NID"
		}

		// Validate primary value
		if req.PrimaryValue == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "ID number is required",
			})
		}
		if len(req.PrimaryValue) < 5 {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid ID number format",
			})
		}

		ctx := context.Background()

		// ── Look up citizen in database ────────────────────────
		var profile struct {
			NID           string `json:"nid"`
			FullName      string `json:"full_name"`
			FullNameNE    string `json:"full_name_ne"`
			CitizenshipNo string `json:"citizenship_no"`
			WardCode      string `json:"ward_code"`
			WardNumber    int    `json:"ward_number"`
			District      string `json:"district"`
			Province      string `json:"province"`
			Phone         string `json:"phone"`
			Gender        string `json:"gender"`
		}

		// Build query based on ID type
		var query string
		var queryArg string

		switch req.IDType {
		case "NID":
			query = `SELECT nid, full_name, COALESCE(full_name_ne,''), citizenship_no, ward_code, COALESCE(ward_number,9), COALESCE(district,'Kaski'), COALESCE(province,'Gandaki'), COALESCE(phone,''), COALESCE(gender,'') FROM citizen_profiles WHERE nid = $1 AND is_active = true`
			queryArg = req.PrimaryValue
		case "CITIZENSHIP":
			query = `SELECT nid, full_name, COALESCE(full_name_ne,''), citizenship_no, ward_code, COALESCE(ward_number,9), COALESCE(district,'Kaski'), COALESCE(province,'Gandaki'), COALESCE(phone,''), COALESCE(gender,'') FROM citizen_profiles WHERE citizenship_no = $1 AND is_active = true`
			queryArg = req.PrimaryValue
		case "DRIVING_LICENSE":
			// For driving license, use NID as fallback lookup
			query = `SELECT nid, full_name, COALESCE(full_name_ne,''), citizenship_no, ward_code, COALESCE(ward_number,9), COALESCE(district,'Kaski'), COALESCE(province,'Gandaki'), COALESCE(phone,''), COALESCE(gender,'') FROM citizen_profiles WHERE nid = $1 AND is_active = true`
			queryArg = req.PrimaryValue
		default:
			query = `SELECT nid, full_name, COALESCE(full_name_ne,''), citizenship_no, ward_code, COALESCE(ward_number,9), COALESCE(district,'Kaski'), COALESCE(province,'Gandaki'), COALESCE(phone,''), COALESCE(gender,'') FROM citizen_profiles WHERE nid = $1 AND is_active = true`
			queryArg = req.PrimaryValue
		}

		err := db.Pool.QueryRow(ctx, query, queryArg).Scan(
			&profile.NID, &profile.FullName, &profile.FullNameNE,
			&profile.CitizenshipNo, &profile.WardCode, &profile.WardNumber,
			&profile.District, &profile.Province, &profile.Phone, &profile.Gender,
		)

		// ── Not in database → DEMO MODE fallback ──────────────
		// For hackathon: if citizen not found, create a demo session
		// In production: return 401 immediately
		if err != nil {
			if os.Getenv("DEMO_MODE") == "true" || os.Getenv("ENV") == "development" {
				log.Printf("[Auth] Citizen not found, using demo mode for NID: %s", req.PrimaryValue)
				// Create demo profile
				profile.NID = req.PrimaryValue
				profile.FullName = "Demo Citizen"
				profile.FullNameNE = "डेमो नागरिक"
				profile.CitizenshipNo = req.SecondaryValue
				profile.WardCode = "NPL-04-33-09"
				profile.WardNumber = 9
				profile.District = "Kaski"
				profile.Province = "Gandaki"
			} else {
				return c.Status(401).JSON(fiber.Map{
					"success": false,
					"message": "Citizen not found. Please register at your ward office.",
				})
			}
		}

		// ── Generate session token ─────────────────────────────
		sessionID, err := generateSecureToken(32)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Session error"})
		}

		expiresAt := time.Now().Add(24 * time.Hour)

		// Save session
		_, err = db.Pool.Exec(ctx, `
            INSERT INTO citizen_sessions
                (session_id, citizen_nid, session_type, id_type, verified, device_info, ip_address, expires_at)
            VALUES ($1, $2, 'CITIZEN', $3, true, $4, $5, $6)
            ON CONFLICT (session_id) DO NOTHING
        `, sessionID, profile.NID, req.IDType, req.DeviceInfo, c.IP(), expiresAt)
		if err != nil {
			log.Printf("[Auth] Session save error: %v", err)
			// Non-fatal for demo — continue
		}

		log.Printf("[Auth] Citizen login: %s via %s", profile.NID, req.IDType)

		return c.Status(200).JSON(fiber.Map{
			"success":      true,
			"session_id":   sessionID,
			"session_type": "CITIZEN",
			"citizen": fiber.Map{
				"nid":            profile.NID,
				"name":           profile.FullName,
				"name_ne":        profile.FullNameNE,
				"citizenship_no": profile.CitizenshipNo,
				"ward_code":      profile.WardCode,
				"ward_number":    profile.WardNumber,
				"district":       profile.District,
				"province":       profile.Province,
				"phone":          profile.Phone,
				"gender":         profile.Gender,
			},
			"expires_at": expiresAt,
			"message":    "Login successful",
		})
	}
}

// ── Tourist Auth ──────────────────────────────────────────────

// POST /auth/tourist/login
// Tourist logs in via passport number (+ OCR verification)
func TouristLogin(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			PassportNo  string `json:"passport_no"`
			FullName    string `json:"full_name"`
			Nationality string `json:"nationality"`
			DOB         string `json:"dob"`
			DeviceInfo  string `json:"device_info"`
			OCRData     string `json:"ocr_data"`
			// Raw OCR output from passport scan (optional)
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		req.PassportNo = strings.ToUpper(strings.TrimSpace(req.PassportNo))
		if req.PassportNo == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false, "message": "Passport number required",
			})
		}
		if len(req.PassportNo) < 6 {
			return c.Status(400).JSON(fiber.Map{
				"success": false, "message": "Invalid passport number",
			})
		}

		ctx := context.Background()

		// Upsert tourist profile
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO tourist_profiles (passport_no, full_name, nationality, ocr_raw)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (passport_no) DO UPDATE
            SET full_name   = EXCLUDED.full_name,
                nationality = EXCLUDED.nationality,
                ocr_raw     = EXCLUDED.ocr_raw
        `, req.PassportNo, req.FullName, req.Nationality, req.OCRData)
		if err != nil {
			log.Printf("[Auth] Tourist upsert error: %v", err)
		}

		// Generate session
		sessionID, _ := generateSecureToken(32)
		expiresAt := time.Now().Add(72 * time.Hour) // 3 days for tourist

		_, err = db.Pool.Exec(ctx, `
            INSERT INTO citizen_sessions
                (session_id, citizen_nid, session_type, id_type, verified, device_info, ip_address, expires_at)
            VALUES ($1, $2, 'TOURIST', 'PASSPORT', true, $3, $4, $5)
        `, sessionID, req.PassportNo, req.DeviceInfo, c.IP(), expiresAt)
		if err != nil {
			log.Printf("[Auth] Tourist session error: %v", err)
		}

		log.Printf("[Auth] Tourist login: %s (%s)", req.PassportNo, req.Nationality)

		return c.Status(200).JSON(fiber.Map{
			"success":      true,
			"session_id":   sessionID,
			"session_type": "TOURIST",
			"tourist": fiber.Map{
				"passport_no": req.PassportNo,
				"name":        req.FullName,
				"nationality": req.Nationality,
			},
			"expires_at": expiresAt,
			"message":    "Welcome to Pokhara!",
		})
	}
}

// ── Guest (no verification) ───────────────────────────────────

// POST /auth/guest
func GuestSession(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		sessionID, _ := generateSecureToken(16)
		expiresAt := time.Now().Add(6 * time.Hour)

		_, _ = db.Pool.Exec(context.Background(), `
            INSERT INTO citizen_sessions
                (session_id, citizen_nid, session_type, id_type, verified, ip_address, expires_at)
            VALUES ($1, 'GUEST', 'GUEST', 'NONE', false, $2, $3)
        `, sessionID, c.IP(), expiresAt)

		return c.Status(200).JSON(fiber.Map{
			"success":      true,
			"session_id":   sessionID,
			"session_type": "GUEST",
			"message":      "Browsing as guest",
		})
	}
}

// ── OCR Processing ────────────────────────────────────────────

// POST /auth/ocr
// Process a scanned document image and return extracted fields
func ProcessDocumentOCR(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			ImageBase64  string `json:"image_base64"`
			DocumentType string `json:"document_type"`
			// NID | CITIZENSHIP | DRIVING_LICENSE | PASSPORT
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		if req.ImageBase64 == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Image required"})
		}

		docType := strings.ToUpper(req.DocumentType)
		if docType == "" {
			docType = "NID"
		}

		start := time.Now()

		// ── In production: call Google Vision or Tesseract ────
		// fields, err := callGoogleVision(req.ImageBase64, docType)
		// For hackathon: return structured demo extraction
		fields := extractDocumentFields(req.ImageBase64, docType)

		processingMs := int(time.Since(start).Milliseconds())

		// Log OCR attempt
		fieldsJSON, _ := json.Marshal(fields)
		_, _ = db.Pool.Exec(context.Background(), `
            INSERT INTO ocr_audit (document_type, extracted_fields, processing_ms, ip_address)
            VALUES ($1, $2, $3, $4)
        `, docType, string(fieldsJSON), processingMs, c.IP())

		return c.Status(200).JSON(fiber.Map{
			"success":       true,
			"document_type": docType,
			"fields":        fields,
			"processing_ms": processingMs,
			"message":       fmt.Sprintf("%s scanned successfully", docType),
		})
	}
}

// ── Tourist Service Requests ──────────────────────────────────

// POST /tourist/request
func SubmitTouristRequest(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			PassportNo    string `json:"passport_no"`
			TouristName   string `json:"tourist_name"`
			ServiceType   string `json:"service_type"`
			Destination   string `json:"destination"`
			TrekStartDate string `json:"trek_start_date"`
			TrekEndDate   string `json:"trek_end_date"`
			GroupSize     int    `json:"group_size"`
			Details       string `json:"details"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		if req.PassportNo == "" || req.ServiceType == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Passport number and service type required",
			})
		}
		if req.GroupSize < 1 {
			req.GroupSize = 1
		}

		ctx := context.Background()
		seq, _ := db.NextSequence(ctx, "TRQ", time.Now().Year())
		requestID := fmt.Sprintf("TRQ-%04d-%06d", time.Now().Year(), seq)

		// Set fee based on service type
		fee := touristServiceFee(req.ServiceType)

		_, err := db.Pool.Exec(ctx, `
            INSERT INTO tourist_requests
                (request_id, passport_no, tourist_name, service_type,
                 destination, group_size, details, status, fee_amount)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8)
        `, requestID, req.PassportNo, req.TouristName, req.ServiceType,
			req.Destination, req.GroupSize, req.Details, fee*float64(req.GroupSize))
		if err != nil {
			log.Printf("[Tourist] Request error: %v", err)
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Failed to submit"})
		}

		return c.Status(201).JSON(fiber.Map{
			"success":    true,
			"request_id": requestID,
			"fee_amount": fee * float64(req.GroupSize),
			"message":    fmt.Sprintf("%s request submitted", req.ServiceType),
		})
	}
}

// GET /tourist/requests/:passportNo
func GetTouristRequests(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		passportNo := strings.ToUpper(c.Params("passportNo"))
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT request_id, service_type, COALESCE(destination,''),
                   group_size, status, COALESCE(fee_amount,0), fee_paid, submitted_at
            FROM tourist_requests WHERE passport_no = $1
            ORDER BY submitted_at DESC LIMIT 20
        `, passportNo)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type TReq struct {
			RequestID   string    `json:"request_id"`
			ServiceType string    `json:"service_type"`
			Destination string    `json:"destination"`
			GroupSize   int       `json:"group_size"`
			Status      string    `json:"status"`
			FeeAmount   float64   `json:"fee_amount"`
			FeePaid     bool      `json:"fee_paid"`
			SubmittedAt time.Time `json:"submitted_at"`
		}

		var list []TReq
		for rows.Next() {
			var r TReq
			rows.Scan(&r.RequestID, &r.ServiceType, &r.Destination,
				&r.GroupSize, &r.Status, &r.FeeAmount, &r.FeePaid, &r.SubmittedAt)
			list = append(list, r)
		}

		return c.JSON(fiber.Map{"success": true, "requests": list})
	}
}

// ── Helpers ───────────────────────────────────────────────────

func generateSecureToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// extractDocumentFields — demo OCR extraction
// In production: replace with Google Vision API call
func extractDocumentFields(imageBase64, docType string) map[string]string {
	// Return empty fields — user fills manually
	// The mobile app shows a form pre-filled from OCR
	// For production: integrate Google Cloud Vision API
	// Cost: ~$1.50 per 1000 images
	switch docType {
	case "CITIZENSHIP":
		return map[string]string{
			"name":           "",
			"citizenship_no": "",
			"dob":            "",
			"gender":         "",
			"father_name":    "",
			"mother_name":    "",
			"district":       "",
			"ward_no":        "",
		}
	case "NID":
		return map[string]string{
			"name": "",
			"nid":  "",
			"dob":  "",
		}
	case "DRIVING_LICENSE":
		return map[string]string{
			"name":        "",
			"license_no":  "",
			"dob":         "",
			"expiry_date": "",
		}
	case "PASSPORT":
		return map[string]string{
			"name":        "",
			"passport_no": "",
			"nationality": "",
			"dob":         "",
			"expiry_date": "",
			"mrz_line1":   "",
			"mrz_line2":   "",
		}
	}
	return map[string]string{}
}

func touristServiceFee(serviceType string) float64 {
	fees := map[string]float64{
		"TIMS_PERMIT":            2000,
		"ANNAPURNA_PERMIT":       3000,
		"MANASLU_PERMIT":         5000,
		"MUSTANG_PERMIT":         50000,
		"LANGTANG_PERMIT":        3000,
		"RESTRICTED_AREA_PERMIT": 50000,
		"NATIONAL_PARK_FEE":      1500,
		"GUIDE_REQUEST":          0,
		"PORTER_REQUEST":         0,
		"EMERGENCY_EVACUATION":   0,
	}
	if fee, ok := fees[serviceType]; ok {
		return fee
	}
	return 0
}
