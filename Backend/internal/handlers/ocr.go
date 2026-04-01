package handlers

import (
	"encoding/base64"
	"log"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// POST /citizen/ocr
// Accepts base64 image of citizenship card
// Returns extracted fields
// In production: integrate Google Vision API or Tesseract
func ProcessOCR(db interface{}) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			ImageBase64 string `json:"image_base64"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request",
			})
		}

		if req.ImageBase64 == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "image_base64 required",
			})
		}

		// Decode base64 to verify it's valid
		_, err := base64.StdEncoding.DecodeString(req.ImageBase64)
		if err != nil {
			// Try without padding
			_, err = base64.RawStdEncoding.DecodeString(req.ImageBase64)
			if err != nil {
				return c.Status(400).JSON(fiber.Map{
					"success": false,
					"message": "Invalid base64 image",
				})
			}
		}

		// ── Production: Call Google Vision API ────────────────────
		// fields, err := callGoogleVisionOCR(req.ImageBase64)

		// ── Demo: Return mock extracted fields ────────────────────
		// In real implementation: parse the OCR text to extract fields
		// Nepali citizenship cards have fixed field positions
		fields := extractCitizenshipFields("")

		log.Printf("[OCR] Processed citizenship scan")

		return c.Status(200).JSON(fiber.Map{
			"success": true,
			"fields":  fields,
			"message": "Document processed",
		})
	}
}

// extractCitizenshipFields parses OCR text from citizenship card
// Nepal citizenship cards have standardized field layout
func extractCitizenshipFields(ocrText string) map[string]string {
	fields := map[string]string{}

	// NID pattern: digits with dashes
	nidPattern := regexp.MustCompile(`\b\d{2}-\d{2}-\d{2}-\d{5}\b`)
	if match := nidPattern.FindString(ocrText); match != "" {
		fields["citizenship_no"] = match
	}

	// Name after "Name:" or "नाम:"
	namePattern := regexp.MustCompile(`(?i)(?:name|नाम)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)`)
	if match := namePattern.FindStringSubmatch(ocrText); len(match) > 1 {
		fields["name"] = strings.TrimSpace(match[1])
	}

	// DOB pattern
	dobPattern := regexp.MustCompile(`\b\d{4}[/-]\d{2}[/-]\d{2}\b`)
	if match := dobPattern.FindString(ocrText); match != "" {
		fields["dob"] = match
	}

	// Gender
	if strings.Contains(strings.ToLower(ocrText), "male") ||
		strings.Contains(ocrText, "पुरुष") {
		fields["gender"] = "Male"
	} else if strings.Contains(strings.ToLower(ocrText), "female") ||
		strings.Contains(ocrText, "महिला") {
		fields["gender"] = "Female"
	}

	return fields
}

// Add to main.go routes:
// citizen.Post("/ocr", handlers.ProcessOCR(db))
