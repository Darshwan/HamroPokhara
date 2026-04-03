package handlers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/crypto"
	"pratibimba/internal/database"
)

func verifyDocumentFromLedger(db *database.DB, dtid string, requesterID, requesterType, requesterAgency string, ip string) (int, fiber.Map) {
	ctx := context.Background()
	start := time.Now()

	entry, err := db.GetLedgerByDTID(ctx, dtid)
	if err != nil {
		return 500, fiber.Map{
			"status":  "SYSTEM_ERROR",
			"message": "Verification temporarily unavailable",
		}
	}

	elapsed := int(time.Since(start).Milliseconds())

	if entry == nil {
		db.LogAccess(ctx, dtid, requesterID, requesterType, requesterAgency, "NOT_FOUND", ip, elapsed)
		return 404, fiber.Map{
			"status":           "NOT_FOUND",
			"dtid":             dtid,
			"currently_active": false,
			"verification_id":  "N/A",
			"message":          "Document not found in National Registry. Report fraud at fraud.pratibimba.gov.np",
		}
	}

	intact := crypto.VerifyRecordIntegrity(
		entry.RecordHash,
		entry.DTID,
		entry.DocumentHash,
		string(entry.DocumentType),
		entry.OfficerID,
		entry.WardCode,
		entry.CreatedAt,
	)

	if !intact {
		log.Printf("🚨 TAMPER DETECTED: DTID=%s", dtid)
		db.LogAccess(ctx, dtid, requesterID, requesterType, requesterAgency, "TAMPERED", ip, elapsed)

		return 200, fiber.Map{
			"status":           "TAMPERED",
			"dtid":             dtid,
			"currently_active": false,
			"verification_id":  "ALERT-LOGGED",
			"message":          "⚠️ This document has been tampered with. Authorities notified. Do NOT accept.",
		}
	}

	logID, _ := db.LogAccess(ctx, dtid, requesterID, requesterType, requesterAgency, "VALID", ip, elapsed)
	vID := crypto.GenerateVerificationID(logID)

	return 200, fiber.Map{
		"status":           "VALID",
		"dtid":             entry.DTID,
		"document_type":    string(entry.DocumentType),
		"issued_date":      entry.CreatedAt.Format("2006-01-02"),
		"issuing_ward":     entry.WardCode,
		"currently_active": entry.Status == "ACTIVE",
		"verification_id":  vID,
		"message":          "Document verified in National Registry",
	}
}

// VerifyDocument handles GET /verify/:dtid
// Zero-Knowledge: returns VALID/TAMPERED/NOT_FOUND — never personal data.
func VerifyDocument(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		dtid := strings.TrimSpace(c.Params("dtid"))

		if len(dtid) < 10 || !strings.HasPrefix(dtid, "NPL-") {
			return c.Status(400).JSON(fiber.Map{
				"status":  "INVALID_FORMAT",
				"message": "Invalid DTID format. Must start with NPL-",
			})
		}

		status, payload := verifyDocumentFromLedger(db, dtid, "PUBLIC", "CITIZEN", "", c.IP())
		return c.Status(status).JSON(payload)
	}
}

// OfficerVerifyDocument handles GET /officer/verify/:dtid
// Returns the same ledger-backed verification result for ward portal use.
func OfficerVerifyDocument(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		dtid := strings.TrimSpace(c.Params("dtid"))
		if len(dtid) < 10 || !strings.HasPrefix(dtid, "NPL-") {
			return c.Status(400).JSON(fiber.Map{
				"status":  "INVALID_FORMAT",
				"message": "Invalid DTID format. Must start with NPL-",
			})
		}

		officerID, _ := c.Locals("officer_id").(string)
		wardCode, _ := c.Locals("ward_code").(string)
		agency := fmt.Sprintf("WARD:%s", wardCode)

		status, payload := verifyDocumentFromLedger(db, dtid, officerID, "OFFICER", agency, c.IP())
		return c.Status(status).JSON(payload)
	}
}
