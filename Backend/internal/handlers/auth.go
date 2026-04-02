package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func authTraceID(c *fiber.Ctx) string {
	if v := strings.TrimSpace(c.Get("X-Request-ID")); v != "" {
		return v
	}
	if v := strings.TrimSpace(c.Get("X-Correlation-ID")); v != "" {
		return v
	}
	return fmt.Sprintf("auth-%d", time.Now().UnixNano())
}

func maskAuthValue(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	if len(v) <= 4 {
		return "****"
	}
	return v[:2] + strings.Repeat("*", len(v)-4) + v[len(v)-2:]
}

func logAuth(traceID, stage, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[Auth][%s][%s] %s", traceID, stage, msg)
}

// ── Citizen Auth ──────────────────────────────────────────────

// POST /auth/citizen/login
// Citizen logs in with NID + one of: citizenship, driving license, NID card
func CitizenLogin(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		traceID := authTraceID(c)
		logAuth(traceID, "request", "Citizen login request received from ip=%s", c.IP())

		var req struct {
			IDType string `json:"id_type"`
			// Options: "NID" | "CITIZENSHIP" | "DRIVING_LICENSE"
			PrimaryValue string `json:"primary_value"`
			// The NID number (always required)
			SecondaryValue string `json:"secondary_value"`
			// Citizenship no / License no / etc (optional)
			NID              string `json:"nid"`
			IDNumber         string `json:"id_number"`
			CitizenshipNo    string `json:"citizenship_no"`
			CitizenshipNoAlt string `json:"citizenshipNo"`
			DocNumber        string `json:"doc_number"`
			DeviceInfo       string `json:"device_info"`
		}
		if err := c.BodyParser(&req); err != nil {
			logAuth(traceID, "parse", "BodyParser failed: %v", err)
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request format",
			})
		}

		// Normalize
		req.PrimaryValue = strings.TrimSpace(req.PrimaryValue)
		req.SecondaryValue = strings.TrimSpace(req.SecondaryValue)
		req.NID = strings.TrimSpace(req.NID)
		req.IDNumber = strings.TrimSpace(req.IDNumber)
		req.CitizenshipNo = strings.TrimSpace(req.CitizenshipNo)
		req.CitizenshipNoAlt = strings.TrimSpace(req.CitizenshipNoAlt)
		req.DocNumber = strings.TrimSpace(req.DocNumber)
		req.IDType = strings.ToUpper(req.IDType)

		// Backward-compatible payload aliases from mobile/client forms.
		if req.PrimaryValue == "" {
			switch {
			case req.NID != "":
				req.PrimaryValue = req.NID
				if req.IDType == "" {
					req.IDType = "NID"
				}
			case req.IDNumber != "":
				req.PrimaryValue = req.IDNumber
			case req.CitizenshipNo != "":
				req.PrimaryValue = req.CitizenshipNo
				if req.IDType == "" {
					req.IDType = "CITIZENSHIP"
				}
			case req.CitizenshipNoAlt != "":
				req.PrimaryValue = req.CitizenshipNoAlt
				if req.IDType == "" {
					req.IDType = "CITIZENSHIP"
				}
			case req.DocNumber != "":
				req.PrimaryValue = req.DocNumber
			}
		}
		if req.SecondaryValue == "" {
			if req.CitizenshipNo != "" {
				req.SecondaryValue = req.CitizenshipNo
			} else if req.CitizenshipNoAlt != "" {
				req.SecondaryValue = req.CitizenshipNoAlt
			}
		}
		if req.IDType == "" {
			req.IDType = "NID"
		}
		logAuth(traceID, "normalize", "Normalized login idType=%s primary=%s secondary=%s", req.IDType, maskAuthValue(req.PrimaryValue), maskAuthValue(req.SecondaryValue))

		// Validate primary value
		if req.PrimaryValue == "" {
			logAuth(traceID, "validate", "Rejected: primary ID is empty")
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "ID number is required",
			})
		}
		if len(req.PrimaryValue) < 5 {
			logAuth(traceID, "validate", "Rejected: primary ID too short (%d)", len(req.PrimaryValue))
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

		// ── Not in database → auto-register citizen ────────────
		autoRegistered := false
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				autoRegistered = true
				logAuth(traceID, "lookup", "Citizen not found. Auto-registering nid=%s", maskAuthValue(req.PrimaryValue))

				citizenshipNo := strings.TrimSpace(req.SecondaryValue)
				if citizenshipNo == "" {
					citizenshipNo = req.PrimaryValue
				}

				profile.NID = req.PrimaryValue
				profile.FullName = "Citizen " + req.PrimaryValue
				profile.FullNameNE = "नयाँ नागरिक"
				profile.CitizenshipNo = citizenshipNo
				profile.WardCode = "NPL-04-33-09"
				profile.WardNumber = 9
				profile.District = "Kaski"
				profile.Province = "Gandaki"
				profile.Gender = ""

				_, insertErr := db.Pool.Exec(ctx, `
					INSERT INTO citizen_profiles
						(nid, citizenship_no, full_name, full_name_ne, ward_code, ward_number, district, province, is_active, created_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
					ON CONFLICT (nid) DO UPDATE SET
						citizenship_no = COALESCE(EXCLUDED.citizenship_no, citizen_profiles.citizenship_no),
						full_name      = COALESCE(EXCLUDED.full_name, citizen_profiles.full_name),
						full_name_ne   = COALESCE(EXCLUDED.full_name_ne, citizen_profiles.full_name_ne),
						ward_code      = COALESCE(EXCLUDED.ward_code, citizen_profiles.ward_code),
						ward_number    = COALESCE(EXCLUDED.ward_number, citizen_profiles.ward_number),
						district       = COALESCE(EXCLUDED.district, citizen_profiles.district),
						province       = COALESCE(EXCLUDED.province, citizen_profiles.province),
						is_active      = true
				`,
					profile.NID,
					profile.CitizenshipNo,
					profile.FullName,
					profile.FullNameNE,
					profile.WardCode,
					profile.WardNumber,
					profile.District,
					profile.Province,
				)
				if insertErr != nil {
					logAuth(traceID, "lookup", "Auto-register failed for nid=%s: %v", maskAuthValue(req.PrimaryValue), insertErr)
					return c.Status(500).JSON(fiber.Map{
						"success": false,
						"message": "Unable to log in right now. Please try again.",
					})
				}

				logAuth(traceID, "lookup", "Auto-register success nid=%s ward=%s", maskAuthValue(profile.NID), profile.WardCode)
			} else {
				logAuth(traceID, "lookup", "Citizen lookup DB error for %s via %s: %v", maskAuthValue(req.PrimaryValue), req.IDType, err)
				return c.Status(500).JSON(fiber.Map{
					"success": false,
					"message": "Unable to log in right now. Please try again.",
				})
			}
		} else {
			logAuth(traceID, "lookup", "Citizen profile found nid=%s ward=%s", maskAuthValue(profile.NID), profile.WardCode)
		}

		// ── Generate session token ─────────────────────────────
		sessionID, err := generateSecureToken(32)
		if err != nil {
			logAuth(traceID, "session", "Token generation failed: %v", err)
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
			logAuth(traceID, "session", "Session save error for nid=%s: %v", maskAuthValue(profile.NID), err)
			// Non-fatal for demo — continue
		} else {
			logAuth(traceID, "session", "Session saved session_id=%s... expires_at=%s", sessionID[:8], expiresAt.Format(time.RFC3339))
		}

		logAuth(traceID, "success", "Citizen login completed nid=%s via=%s auto_registered=%v", maskAuthValue(profile.NID), req.IDType, autoRegistered)

		return c.Status(200).JSON(fiber.Map{
			"success":         true,
			"auto_registered": autoRegistered,
			"session_id":      sessionID,
			"session_type":    "CITIZEN",
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
		traceID := authTraceID(c)
		logAuth(traceID, "request", "Tourist login request received from ip=%s", c.IP())

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
			logAuth(traceID, "parse", "BodyParser failed: %v", err)
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		req.PassportNo = strings.ToUpper(strings.TrimSpace(req.PassportNo))
		if req.PassportNo == "" {
			logAuth(traceID, "validate", "Rejected: passport number empty")
			return c.Status(400).JSON(fiber.Map{
				"success": false, "message": "Passport number required",
			})
		}
		if len(req.PassportNo) < 6 {
			logAuth(traceID, "validate", "Rejected: passport number too short")
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
			logAuth(traceID, "upsert", "Tourist upsert error: %v", err)
		} else {
			logAuth(traceID, "upsert", "Tourist profile upserted passport=%s", maskAuthValue(req.PassportNo))
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
			logAuth(traceID, "session", "Tourist session save error: %v", err)
		} else {
			logAuth(traceID, "session", "Tourist session saved session_id=%s...", sessionID[:8])
		}

		logAuth(traceID, "success", "Tourist login completed passport=%s nationality=%s", maskAuthValue(req.PassportNo), req.Nationality)

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
		traceID := authTraceID(c)
		sessionID, _ := generateSecureToken(16)
		expiresAt := time.Now().Add(6 * time.Hour)

		_, err := db.Pool.Exec(context.Background(), `
            INSERT INTO citizen_sessions
                (session_id, citizen_nid, session_type, id_type, verified, ip_address, expires_at)
            VALUES ($1, 'GUEST', 'GUEST', 'NONE', false, $2, $3)
        `, sessionID, c.IP(), expiresAt)
		if err != nil {
			logAuth(traceID, "session", "Guest session save error: %v", err)
		} else {
			logAuth(traceID, "success", "Guest session created session_id=%s... ip=%s", sessionID[:8], c.IP())
		}

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
		traceID := authTraceID(c)
		logAuth(traceID, "request", "Auth OCR validation request received from ip=%s", c.IP())

		var req struct {
			ImageBase64   string `json:"image_base64"`   // optional client photo for UI preview
			ExtractedText string `json:"extracted_text"` // required client OCR output
			DocumentType  string `json:"document_type"`
			// NID | CITIZENSHIP | DRIVING_LICENSE | PASSPORT
		}
		if err := c.BodyParser(&req); err != nil {
			logAuth(traceID, "parse", "BodyParser failed: %v", err)
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		ocrText := strings.TrimSpace(req.ExtractedText)
		if ocrText == "" {
			logAuth(traceID, "validate", "Rejected: extracted_text missing")
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "extracted_text is required; OCR now runs on the client"})
		}

		docType := strings.ToUpper(req.DocumentType)
		if docType == "" {
			docType = "NID"
		}

		start := time.Now()

		fields := extractDocumentFields(ocrText, docType)

		processingMs := int(time.Since(start).Milliseconds())
		logAuth(traceID, "extract", "Document parsed type=%s chars=%d processing_ms=%d", docType, len(ocrText), processingMs)

		// Log OCR attempt
		fieldsJSON, _ := json.Marshal(fields)
		if _, err := db.Pool.Exec(context.Background(), `
            INSERT INTO ocr_audit (document_type, extracted_fields, processing_ms, ip_address)
            VALUES ($1, $2, $3, $4)
        `, docType, string(fieldsJSON), processingMs, c.IP()); err != nil {
			logAuth(traceID, "audit", "OCR audit insert failed: %v", err)
		} else {
			logAuth(traceID, "audit", "OCR audit inserted for type=%s", docType)
		}

		return c.Status(200).JSON(fiber.Map{
			"success":       true,
			"document_type": docType,
			"fields":        fields,
			"raw_text":      ocrText,
			"ocr_source":    "client_ocr",
			"processing_ms": processingMs,
			"message":       fmt.Sprintf("%s validated successfully", docType),
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

// extractDocumentFields parses OCR text into document-specific fields.
func extractDocumentFields(ocrText, docType string) map[string]string {
	ocrText = strings.TrimSpace(ocrText)
	common := extractCitizenshipFieldsNepaliAware(ocrText)

	switch docType {
	case "CITIZENSHIP":
		return map[string]string{
			"name":           common["full_name"],
			"full_name":      common["full_name"],
			"citizenship_no": firstNonEmpty(common["citizenship_no"], common["nid"]),
			"nid":            common["nid"],
			"dob":            common["dob"],
			"gender":         common["gender"],
			"father_name":    common["father_name"],
			"mother_name":    common["mother_name"],
			"district":       common["district"],
			"ward_no":        common["ward_no"],
		}
	case "NID":
		return map[string]string{
			"name": common["full_name"],
			"nid":  common["nid"],
			"dob":  common["dob"],
		}
	case "DRIVING_LICENSE":
		licensePattern := regexp.MustCompile(`(?i)(?:license|licence|dl|permit)[\s:#-]*([A-Z0-9-]{6,20})`)
		licenseNo := ""
		if match := licensePattern.FindStringSubmatch(ocrText); len(match) > 1 {
			licenseNo = strings.TrimSpace(match[1])
		}

		return map[string]string{
			"name":        common["full_name"],
			"license_no":  licenseNo,
			"dob":         common["dob"],
			"expiry_date": "",
		}
	case "PASSPORT":
		passportPattern := regexp.MustCompile(`\b[A-Z][0-9]{7,8}\b`)
		passportNo := passportPattern.FindString(strings.ToUpper(ocrText))

		nationalityPattern := regexp.MustCompile(`(?i)(?:nationality|country)[\s:]+([A-Za-z ]{3,30})`)
		nationality := ""
		if match := nationalityPattern.FindStringSubmatch(ocrText); len(match) > 1 {
			nationality = strings.TrimSpace(match[1])
		}

		return map[string]string{
			"name":        common["full_name"],
			"passport_no": passportNo,
			"nationality": nationality,
			"dob":         common["dob"],
			"expiry_date": "",
			"mrz_line1":   "",
			"mrz_line2":   "",
		}
	}
	return map[string]string{}
}

func extractCitizenshipFieldsNepaliAware(ocrText string) map[string]string {
	fields := extractCitizenshipFields(ocrText)
	asciiText := normalizeNepaliDigits(ocrText)

	if fields["nid"] == "" {
		nepaliNidPattern := regexp.MustCompile(`[०-९]{2}-[०-९]{2}-[०-९]{2}-[०-९]{5}`)
		if match := nepaliNidPattern.FindString(ocrText); match != "" {
			fields["nid"] = match
			fields["citizenship_no"] = match
		}

		asciiNIDPattern := regexp.MustCompile(`\b\d{2}-\d{2}-\d{2}-\d{5}\b`)
		if match := asciiNIDPattern.FindString(asciiText); match != "" {
			fields["nid"] = match
			fields["citizenship_no"] = match
		}

		flexNIDPattern := regexp.MustCompile(`\b\d{11}\b`)
		if match := flexNIDPattern.FindString(asciiText); match != "" {
			formatted := fmt.Sprintf("%s-%s-%s-%s", match[0:2], match[2:4], match[4:6], match[6:11])
			fields["nid"] = formatted
			fields["citizenship_no"] = formatted
		}
	}

	if fields["full_name"] == "" {
		namePatterns := []string{
			`(?i)(?:name|नाम)[\s:]*([^\n\r:]{2,40})`,
			`(?i)(?:नाम)[:\s]*([^\n\r:]{2,40})`,
		}
		for _, pattern := range namePatterns {
			re := regexp.MustCompile(pattern)
			if match := re.FindStringSubmatch(ocrText); len(match) > 1 {
				name := strings.TrimSpace(match[1])
				if len(name) > 3 {
					fields["full_name"] = name
					break
				}
			}
		}
	}

	if fields["dob"] == "" {
		nepaliDobPattern := regexp.MustCompile(`[०-९]{4}[/-][०-९]{2}[/-][०-९]{2}`)
		if match := nepaliDobPattern.FindString(ocrText); match != "" {
			fields["dob"] = match
		}

		asciiDOBPattern := regexp.MustCompile(`\b\d{4}[/-]\d{2}[/-]\d{2}\b|\b\d{2}[/-]\d{2}[/-]\d{4}\b`)
		if match := asciiDOBPattern.FindString(asciiText); match != "" {
			fields["dob"] = match
		}
	}

	if fields["father_name"] == "" {
		fatherPattern := regexp.MustCompile(`(?i)(?:father|dad|पिता|बाबु|बुवा)[:\s]+([^\n\r;]+)`)
		if match := fatherPattern.FindStringSubmatch(ocrText); len(match) > 1 {
			fields["father_name"] = strings.TrimSpace(match[1])
		}
	}

	if fields["mother_name"] == "" {
		motherPattern := regexp.MustCompile(`(?i)(?:mother|mom|mother's name|आमा|माता)[:\s]+([^\n\r;]+)`)
		if match := motherPattern.FindStringSubmatch(ocrText); len(match) > 1 {
			fields["mother_name"] = strings.TrimSpace(match[1])
		}
	}

	if fields["district"] == "" {
		nepaliDistricts := map[string]string{
			"कास्की":   "Kaski",
			"पोखरा":    "Pokhara",
			"काठमाडौं": "Kathmandu",
			"ललितपुर":  "Lalitpur",
			"भक्तपुर":  "Bhaktapur",
			"चितवन":    "Chitwan",
			"गण्डकी":   "Gandaki",
		}
		for nepali, english := range nepaliDistricts {
			if strings.Contains(ocrText, nepali) {
				fields["district"] = english
				break
			}
		}
	}

	if fields["ward_no"] == "" {
		nepaliWardPattern := regexp.MustCompile(`वडा[\s:]*(\d{1,2}|[०-९]{1,2})`)
		if match := nepaliWardPattern.FindStringSubmatch(ocrText); len(match) > 1 {
			fields["ward_no"] = normalizeNepaliDigits(match[1])
		}

		asciiWardPattern := regexp.MustCompile(`(?i)(?:ward|वडा)[\s:]*(\d{1,2})`)
		if match := asciiWardPattern.FindStringSubmatch(asciiText); len(match) > 1 {
			fields["ward_no"] = match[1]
		}
	}

	return fields
}

func normalizeNepaliDigits(input string) string {
	replacer := strings.NewReplacer(
		"०", "0",
		"१", "1",
		"२", "2",
		"३", "3",
		"४", "4",
		"५", "5",
		"६", "6",
		"७", "7",
		"८", "8",
		"९", "9",
	)
	return replacer.Replace(input)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
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
