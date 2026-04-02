package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"pratibimba/internal/crypto"
	"pratibimba/internal/database"
	"pratibimba/internal/middleware"
	"pratibimba/internal/models"
	"pratibimba/internal/sse"
)

// OfficerLogin handles POST /officer/login
func OfficerLogin(db *database.DB, jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req models.LoginPayload
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request",
			})
		}

		if req.OfficerID == "" || req.PIN == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Officer ID and PIN required",
			})
		}

		ctx := context.Background()
		pinHash := crypto.HashPIN(req.PIN)

		officer, err := db.VerifyOfficerPIN(ctx, req.OfficerID, pinHash)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Authentication system error",
			})
		}
		if officer == nil {
			return c.Status(401).JSON(models.LoginResponse{
				Success: false,
				Message: "Invalid Officer ID or PIN",
			})
		}

		// Generate JWT
		claims := middleware.Claims{
			OfficerID:    officer.OfficerID,
			WardCode:     officer.WardCode,
			ProvinceCode: officer.ProvinceCode,
			Role:         "officer",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenStr, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Token generation failed",
			})
		}

		log.Printf("🔑 Officer login: %s", officer.OfficerID)

		return c.Status(200).JSON(models.LoginResponse{
			Success: true,
			Token:   tokenStr,
			Officer: officer,
			Message: "Login successful",
		})
	}
}

// GetQueue handles GET /officer/queue
// Returns all pending requests for this officer's ward.
func GetQueue(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wardCode := c.Locals("ward_code").(string)

		ctx := context.Background()
		requests, err := db.GetPendingRequestsByWard(ctx, wardCode)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to fetch queue",
			})
		}

		return c.Status(200).JSON(fiber.Map{
			"success":  true,
			"count":    len(requests),
			"requests": requests,
		})
	}
}

// ApproveRequest handles POST /officer/approve
// This is the core action — officer approves → PRATIBIMBA fires.
func ApproveRequest(db *database.DB, broker *sse.Broker) fiber.Handler {
	return func(c *fiber.Ctx) error {
		officerID := c.Locals("officer_id").(string)

		var req models.OfficerApprovePayload
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request body",
			})
		}

		if req.RequestID == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Request ID is required",
			})
		}

		ctx := context.Background()

		// Get the service request
		sr, err := db.GetRequestByID(ctx, req.RequestID)
		if err != nil || sr == nil {
			return c.Status(404).JSON(fiber.Map{
				"success": false,
				"message": "Request not found",
			})
		}

		if sr.Status != "PENDING" && sr.Status != "UNDER_REVIEW" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Request is already %s", sr.Status),
			})
		}

		// Get officer details
		officer, err := db.GetOfficerByID(ctx, officerID)
		if err != nil || officer == nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Officer lookup failed",
			})
		}

		// ── PRATIBIMBA ENGINE FIRES HERE ─────────────────────

		// PostgreSQL timestamptz stores microsecond precision; normalize before hashing
		// so verification recomputation sees the exact same timestamp bytes.
		issuedAt := time.Now().UTC().Truncate(time.Microsecond)
		nepaliYear := issuedAt.Year() + 57

		// Hash citizen personal data — never stored in ledger
		citizenDataHash := crypto.HashPersonalData(
			sr.CitizenNID,
			sr.CitizenName,
			sr.Purpose,
		)

		// Generate document fingerprint
		documentHash := crypto.HashDocument(
			officer.OfficerID,
			sr.DocumentType,
			officer.WardCode,
			officer.ProvinceCode,
			citizenDataHash,
			issuedAt,
		)

		// Generate DTID
		seq, err := db.NextSequence(ctx, officer.WardCode, nepaliYear)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "DTID generation failed",
			})
		}

		wardNum := extractWardNum(officer.WardCode)
		dtid := fmt.Sprintf("NPL-%02d-%02d-%s-%04d-%06d",
			officer.ProvinceCode,
			officer.DistrictCode,
			wardNum,
			nepaliYear,
			seq,
		)

		// Generate record hash for tamper detection
		recordHash := crypto.HashRecord(
			dtid, documentHash, sr.DocumentType,
			officer.OfficerID, officer.WardCode, issuedAt,
		)

		// Write to append-only ledger
		now := time.Now().UTC()
		ledgerEntry := &models.LedgerEntry{
			DTID:         dtid,
			DocumentHash: documentHash,
			RecordHash:   recordHash,
			DocumentType: models.DocumentType(sr.DocumentType),
			OfficerID:    officer.OfficerID,
			WardCode:     officer.WardCode,
			DistrictCode: officer.DistrictCode,
			ProvinceCode: officer.ProvinceCode,
			RequestID:    sr.RequestID,
			Status:       "ACTIVE",
			SyncStatus:   "CONFIRMED",
			CreatedAt:    issuedAt,
			SyncedAt:     &now,
		}

		if err := db.InsertLedgerEntry(ctx, ledgerEntry); err != nil {
			log.Printf("Ledger insert error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to register in national ledger",
			})
		}

		// Send SMS to citizen if phone number available
		if sr.CitizenPhone != "" {
			SMSDocumentReady(sr.CitizenPhone, sr.CitizenName, dtid)
		}

		// Update request status
		if err := db.MarkRequestApproved(ctx, sr.RequestID, dtid); err != nil {
			log.Printf("Request update error: %v", err)
			// Non-fatal — ledger entry already created
		}

		// ── BROADCAST TO MINISTRY DASHBOARD ──────────────────
		broker.Publish("DOCUMENT_ISSUED", map[string]interface{}{
			"dtid":          dtid,
			"document_type": sr.DocumentType,
			"ward_code":     officer.WardCode,
			"province_code": officer.ProvinceCode,
			"officer_id":    officer.OfficerID,
			"issued_at":     issuedAt,
		})

		qrData := verificationURLForDTID(dtid)
		qrCode, qrErr := verificationQRCodeDataURL(qrData)
		if qrErr != nil {
			log.Printf("QR generation warning for %s: %v", dtid, qrErr)
		}

		log.Printf("✅ Approved: %s → DTID: %s by %s", sr.RequestID, dtid, officerID)

		return c.Status(200).JSON(models.ApproveResponse{
			Success:      true,
			RequestID:    sr.RequestID,
			DTID:         dtid,
			DocumentHash: documentHash,
			QRData:       qrData,
			QRCode:       qrCode,
			Message:      "Document approved and registered in National Ledger",
			IssuedAt:     issuedAt.Format(time.RFC3339),
		})
	}
}

// RejectRequest handles POST /officer/reject
func RejectRequest(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req models.OfficerRejectPayload
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request body",
			})
		}

		if req.RequestID == "" || req.RejectionReason == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Request ID and rejection reason are required",
			})
		}

		ctx := context.Background()
		sr, err := db.GetRequestByID(ctx, req.RequestID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to fetch request",
			})
		}
		if sr == nil {
			return c.Status(404).JSON(fiber.Map{
				"success": false,
				"message": "Request not found",
			})
		}

		if err := db.MarkRequestRejected(ctx, req.RequestID, req.RejectionReason); err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to reject request",
			})
		}

		if sr.CitizenPhone != "" {
			SMSRequestRejected(sr.CitizenPhone, sr.CitizenName, req.RejectionReason)
		}

		return c.Status(200).JSON(fiber.Map{
			"success":    true,
			"request_id": req.RequestID,
			"message":    "Request rejected",
		})
	}
}

func extractWardNum(wardCode string) string {
	if len(wardCode) >= 11 {
		return wardCode[len(wardCode)-2:]
	}
	return "00"
}
