package handlers

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/crypto"
	"pratibimba/internal/database"
	"pratibimba/internal/models"
)

// VerifyDocument handles GET /verify/:dtid
// Zero-Knowledge: returns VALID/TAMPERED/NOT_FOUND — never personal data.
func VerifyDocument(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		dtid := strings.TrimSpace(c.Params("dtid"))

		if len(dtid) < 10 || !strings.HasPrefix(dtid, "NPL-") {
			return c.Status(400).JSON(fiber.Map{
				"status":  "INVALID_FORMAT",
				"message": "Invalid DTID format. Must start with NPL-",
			})
		}

		ctx := context.Background()

		entry, err := db.GetLedgerByDTID(ctx, dtid)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"status":  "SYSTEM_ERROR",
				"message": "Verification temporarily unavailable",
			})
		}

		elapsed := int(time.Since(start).Milliseconds())
		ip := c.IP()

		if entry == nil {
			db.LogAccess(ctx, dtid, "PUBLIC", "CITIZEN", "", "NOT_FOUND", ip, elapsed)
			return c.Status(404).JSON(models.VerifyResponse{
				Status:          "NOT_FOUND",
				DTID:            dtid,
				CurrentlyActive: false,
				VerificationID:  "N/A",
				Message:         "Document not found in National Registry. Report fraud at fraud.pratibimba.gov.np",
			})
		}

		// Tamper detection — re-compute and compare
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
			db.LogAccess(ctx, dtid, "SYSTEM", "SYSTEM", "TAMPER_DETECTION", "TAMPERED", ip, elapsed)

			return c.Status(200).JSON(models.VerifyResponse{
				Status:          "TAMPERED",
				DTID:            dtid,
				CurrentlyActive: false,
				VerificationID:  "ALERT-LOGGED",
				Message:         "⚠️ This document has been tampered with. Authorities notified. Do NOT accept.",
			})
		}

		logID, _ := db.LogAccess(ctx, dtid, "PUBLIC", "CITIZEN", "", "VALID", ip, elapsed)
		vID := crypto.GenerateVerificationID(logID)

		return c.Status(200).JSON(models.VerifyResponse{
			Status:          "VALID",
			DTID:            entry.DTID,
			DocumentType:    string(entry.DocumentType),
			IssuedDate:      entry.CreatedAt.Format("2006-01-02"),
			IssuingWard:     entry.WardCode,
			CurrentlyActive: entry.Status == "ACTIVE",
			VerificationID:  vID,
			Message:         "Document verified in National Registry",
		})
	}
}
