package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/crypto"
	"pratibimba/internal/database"
	"pratibimba/internal/models"
)

// SubmitRequest handles POST /citizen/request
// Citizen submits a service request from the mobile app.
func SubmitRequest(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {

		var req models.CitizenRequestPayload
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request body",
			})
		}

		// Validate
		if req.CitizenNID == "" || req.CitizenName == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Citizen NID and name are required",
			})
		}
		if req.DocumentType == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Document type is required",
			})
		}
		if req.Purpose == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Purpose is required",
			})
		}
		if req.WardCode == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Ward code is required",
			})
		}

		ctx := context.Background()
		now := time.Now().UTC()
		nepaliYear := now.Year() + 57

		// Generate unique request ID
		seq, err := db.NextSequence(ctx, "REQ-"+req.WardCode, nepaliYear)
		if err != nil {
			log.Printf("Sequence error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to generate request ID",
			})
		}

		requestID := crypto.GenerateRequestID(nepaliYear, seq)

		// Build service request
		sr := &models.ServiceRequest{
			RequestID:      requestID,
			CitizenNID:     req.CitizenNID,
			CitizenName:    req.CitizenName,
			CitizenPhone:   req.CitizenPhone,
			DocumentType:   req.DocumentType,
			Purpose:        req.Purpose,
			AdditionalInfo: req.AdditionalInfo,
			WardCode:       req.WardCode,
			Status:         "PENDING",
			SubmittedAt:    now,
			IPAddress:      c.IP(),
			OCRRawData:     req.OCRRawData,
		}

		if err := db.InsertRequest(ctx, sr); err != nil {
			log.Printf("Insert request error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to submit request",
			})
		}

		log.Printf("📥 New request: %s | %s | %s", requestID, req.DocumentType, req.WardCode)

		return c.Status(201).JSON(models.CitizenRequestResponse{
			Success:     true,
			RequestID:   requestID,
			Message:     "Request submitted successfully. You will be notified when ready.",
			WardCode:    req.WardCode,
			SubmittedAt: now.Format(time.RFC3339),
			EstimatedAt: now.Add(48 * time.Hour).Format(time.RFC3339),
		})
	}
}

// GetRequestStatus handles GET /citizen/request/:requestID
// Citizen polls this to see their request status.
func GetRequestStatus(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.Params("requestID")
		if requestID == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Request ID is required",
			})
		}

		ctx := context.Background()
		req, err := db.GetRequestByID(ctx, requestID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Lookup failed",
			})
		}
		if req == nil {
			return c.Status(404).JSON(fiber.Map{
				"success": false,
				"message": "Request not found",
			})
		}

		resp := models.RequestStatusResponse{
			Success:      true,
			RequestID:    req.RequestID,
			Status:       req.Status,
			DocumentType: req.DocumentType,
			Purpose:      req.Purpose,
			WardCode:     req.WardCode,
			SubmittedAt:  req.SubmittedAt.Format(time.RFC3339),
			Message:      statusMessage(req.Status),
		}

		if req.ReviewedAt != nil {
			resp.UpdatedAt = req.ReviewedAt.Format(time.RFC3339)
		}

		// If approved — include DTID and QR data
		if req.Status == "APPROVED" && req.DTID != "" {
			resp.DTID = req.DTID
			resp.QRData = verificationURLForDTID(req.DTID)
			resp.QRCode, _ = verificationQRCodeDataURL(resp.QRData)
		}

		return c.Status(200).JSON(resp)
	}
}

func statusMessage(status string) string {
	switch status {
	case "PENDING":
		return "Your request has been received and is waiting for officer review."
	case "UNDER_REVIEW":
		return "Your request is currently being reviewed by the ward officer."
	case "APPROVED":
		return "Your document is ready. Download it from the app."
	case "REJECTED":
		return "Your request was rejected. Please check the reason and resubmit."
	default:
		return "Status unknown."
	}
}
