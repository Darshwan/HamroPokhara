package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
)

// POST /citizen/ocr
// Accepts client-extracted OCR text and validates/parses it.
// The frontend performs OCR; the backend only parses and normalizes the text.
// Saves extracted data to citizen_profiles table
//
// Request JSON:
//
//	{
//	  "image_base64": "...",
//	  "extracted_text": "Name: Rajesh KC\nNID: 07-06-95-12345\nDOB: 1995-06-07\nGender: Male",  // REQUIRED for real extraction
//	  "ward_code": "NPL-04-33-09",   // optional
//	  "citizen_name": "Rajesh KC"    // optional override
//	}
//
// NOTE: extracted_text is required. OCR now happens on the client side.
func ProcessOCR(db interface{}) fiber.Handler {
	typedDB, ok := db.(*database.DB)
	if !ok {
		return func(c *fiber.Ctx) error {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "database type error"})
		}
	}

	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Log incoming request size
		contentLength := c.Get("Content-Length")
		body := c.Body()
		bodySize := len(body)
		log.Printf("[OCR] Incoming request - Content-Length header: %s, Actual body size: %d bytes (%.2f MB)", contentLength, bodySize, float64(bodySize)/(1024*1024))

		var req struct {
			ImageBase64   string `json:"image_base64"`   // optional client photo for UI preview
			ExtractedText string `json:"extracted_text"` // required client OCR output
			WardCode      string `json:"ward_code"`      // optional
			CitizenName   string `json:"citizen_name"`   // optional override
		}

		if err := c.BodyParser(&req); err != nil {
			log.Printf("[OCR] BodyParser error: %v", err)
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request",
			})
		}

		ocrText := strings.TrimSpace(req.ExtractedText)
		if ocrText == "" {
			log.Printf("[OCR] Error: extracted_text is empty")
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "extracted_text is required; OCR now runs on the client",
			})
		}
		ocrSource := "client_ocr"
		base64Size := len(strings.TrimSpace(req.ImageBase64))
		if base64Size > 0 {
			log.Printf("[OCR] Client provided image for UI preview: %d bytes (not processed server-side)", base64Size)
		}

		log.Printf("[OCR] Input OCR text length: %d chars", len(ocrText))
		if len(ocrText) > 100 {
			log.Printf("[OCR] OCR text preview: %s...", ocrText[:100])
		} else if ocrText != "" {
			log.Printf("[OCR] OCR text: %s", ocrText)
		}

		// Extract fields from OCR text using pattern matching
		fields := extractCitizenshipFields(ocrText)

		// Log extracted fields to console
		log.Printf("[OCR] ============ EXTRACTED DATA ============")
		log.Printf("[OCR] NID/Citizenship: %s", fields["nid"])
		log.Printf("[OCR] Name: %s", fields["full_name"])
		log.Printf("[OCR] Date of Birth: %s", fields["dob"])
		log.Printf("[OCR] Gender: %s", fields["gender"])
		log.Printf("[OCR] Father Name: %s", fields["father_name"])
		log.Printf("[OCR] Mother Name: %s", fields["mother_name"])
		log.Printf("[OCR] District: %s", fields["district"])
		log.Printf("[OCR] Ward: %s", fields["ward_no"])
		log.Printf("[OCR] Address: %s", fields["address"])
		log.Printf("[OCR] =========================================")

		// Diagnostic: Show which fields were empty to help tune extraction
		emptyFields := []string{}
		for key, val := range fields {
			if val == "" && key != "citizenship_no" && key != "address" { // these can be empty
				emptyFields = append(emptyFields, key)
			}
		}
		if len(emptyFields) > 0 {
			log.Printf("[OCR] ⚠️  Low confidence fields (empty): %v", emptyFields)
		}
		log.Printf("[OCR] Full extracted data: %+v", fields)

		// Save to database if NID is found
		nid := strings.TrimSpace(fields["nid"])
		if nid != "" {
			ctx := context.Background()

			wardCode := req.WardCode
			if wardCode == "" {
				wardCode = "NPL-04-33-09" // default ward
			}

			// Get full_name - prefer from extraction, then override, then use placeholder
			fullName := strings.TrimSpace(fields["full_name"])
			if req.CitizenName != "" {
				fullName = req.CitizenName
			}
			if fullName == "" {
				fullName = "OCR Scanned Citizen"
			}

			// UPSERT citizen profile
			insertQuery := `
				INSERT INTO citizen_profiles
					(nid, citizenship_no, full_name, dob, gender, ward_code, is_active, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
				ON CONFLICT (nid) DO UPDATE SET
					citizenship_no = COALESCE(EXCLUDED.citizenship_no, citizen_profiles.citizenship_no),
					full_name = COALESCE(EXCLUDED.full_name, citizen_profiles.full_name),
					dob = COALESCE(EXCLUDED.dob, citizen_profiles.dob),
					gender = COALESCE(EXCLUDED.gender, citizen_profiles.gender),
					ward_code = COALESCE(EXCLUDED.ward_code, citizen_profiles.ward_code)
			`

			_, err := typedDB.Pool.Exec(ctx, insertQuery,
				nid,
				fields["citizenship_no"],
				fullName,
				fields["dob"],
				fields["gender"],
				wardCode,
			)
			if err != nil {
				log.Printf("[OCR] Database save error: %v", err)
			} else {
				log.Printf("[OCR] ✓ Successfully saved to database - NID: %s | Name: %s | Ward: %s", nid, fullName, wardCode)
			}

			// Log OCR audit
			fieldsJSON, _ := json.Marshal(fields)
			_, _ = typedDB.Pool.Exec(ctx, `
				INSERT INTO ocr_audit (document_type, extracted_fields, processing_ms, ip_address)
				VALUES ($1, $2, $3, $4)
			`, "CITIZENSHIP", string(fieldsJSON), 0, c.IP())
		}

		processingMs := int(time.Since(start).Milliseconds())
		log.Printf(
			"[OCR] Successfully processed citizenship scan - Source: %s, Preview image: %.2f MB, Time: %dms",
			ocrSource,
			float64(base64Size)/(1024*1024),
			processingMs,
		)

		return c.Status(200).JSON(fiber.Map{
			"success":           true,
			"nid":               fields["nid"],
			"citizenship_no":    fields["citizenship_no"],
			"full_name":         fields["full_name"],
			"dob":               fields["dob"],
			"gender":            fields["gender"],
			"address":           fields["address"],
			"father":            fields["father_name"],
			"mother":            fields["mother_name"],
			"district":          fields["district"],
			"ward":              fields["ward_no"],
			"fields":            fields,
			"raw_text":          ocrText,
			"ocr_source":        ocrSource,
			"processing_ms":     processingMs,
			"ocr_text_provided": true,
			"message":           "Document processed via client OCR validation",
		})
	}
}

// cleanExtractedText removes garbage characters from extracted text
// Handles pipe chars (||, ॥), excessive spaces, and special OCR artifacts
func cleanExtractedText(text string) string {
	cleaned := strings.TrimSpace(text)

	// Remove pipe and danda characters (can appear from OCR errors)
	cleaned = strings.ReplaceAll(cleaned, "||", " ")
	cleaned = strings.ReplaceAll(cleaned, "॥", " ")
	cleaned = strings.ReplaceAll(cleaned, "|", " ")

	// Replace multiple spaces with single space
	spaceRegex := regexp.MustCompile(`\s+`)
	cleaned = spaceRegex.ReplaceAllString(cleaned, " ")

	return strings.TrimSpace(cleaned)
}

// extractCitizenshipFields extracts structured data from citizenship card text
// Uses regex patterns common on Nepal citizenship documents
// Added common sense validation and separate NID/Citizenship_no extraction
func extractCitizenshipFields(ocrText string) map[string]string {
	fields := map[string]string{
		"nid":            "",
		"citizenship_no": "",
		"full_name":      "",
		"dob":            "",
		"gender":         "",
		"father_name":    "",
		"mother_name":    "",
		"district":       "",
		"ward_no":        "",
		"address":        "",
	}

	asciiText := normalizeNepaliDigits(ocrText)

	// === NID EXTRACTION (primary 11-digit ID) ===
	// First try: ASCII digits with dashes XX-XX-XX-XXXXX
	nidPattern := regexp.MustCompile(`\b(\d{2})-(\d{2})-(\d{2})-(\d{5})\b`)
	if match := nidPattern.FindString(ocrText); match != "" {
		fields["nid"] = match
	}

	// Second try: Nepali numerals (e.g. १२-३४-५६-७८९०१)
	if fields["nid"] == "" {
		nepaliNIDPattern := regexp.MustCompile(`[०-९]{2}-[०-९]{2}-[०-९]{2}-[०-९]{5}`)
		if match := nepaliNIDPattern.FindString(ocrText); match != "" {
			normalized := normalizeNepaliDigits(match)
			fields["nid"] = normalized
		}
	}

	// Third try: Compact 11 consecutive digits without dashes
	if fields["nid"] == "" {
		compactPattern := regexp.MustCompile(`\b\d{11}\b`)
		if match := compactPattern.FindString(asciiText); match != "" {
			formatted := fmt.Sprintf("%s-%s-%s-%s", match[0:2], match[2:4], match[4:6], match[6:11])
			fields["nid"] = formatted
		}
	}

	// === CITIZENSHIP NUMBER EXTRACTION (separate from NID) ===
	// Look for label like "Certificate No:", "Citizenship No:", "Registration No:"
	citizenshipLabels := []string{
		`(?i)(?:certificate|citizenship|registration)[\s]*no\.?[\s:]*([0-9०-९-]+)`,
		`(?i)(?:cert|cit)[\.\s]*no[\s:]*([0-9०-९-]+)`,
	}
	for _, pattern := range citizenshipLabels {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(ocrText); len(match) > 1 {
			certNum := normalizeNepaliDigits(strings.TrimSpace(match[1]))
			if certNum != "" && len(certNum) >= 8 { // Basic validation
				fields["citizenship_no"] = certNum
				break
			}
		}
	}

	// Fallback: if citizenship_no not found but NID exists, they might be the same
	// But don't force them to be identical - keep them separate
	if fields["citizenship_no"] == "" && fields["nid"] != "" {
		// Check if there's a second ID-like number before or after the NID
		allIDsPattern := regexp.MustCompile(`(\d{2})-(\d{2})-(\d{2})-(\d{5})`)
		allMatches := allIDsPattern.FindAllString(ocrText, -1)
		if len(allMatches) > 1 {
			// Multiple ID numbers found - use the second one as citizenship_no
			fields["citizenship_no"] = allMatches[1]
		}
		// If still empty, it's okay - don't duplicate NID
	}

	// === NAME EXTRACTION (with cleanup for Nepali text quality) ===
	// Strategy: Extract by line or by label, preferring full multi-word names
	namePatterns := []string{
		// Pattern 1: After NAME/नाम label, capture until next label or line break
		`(?im)(?:name|नाम)[\s:]*([^\n\r|]+?)(?=\s*(?:(?:father|dad|पिता|mother|आमा)\s?(?:name)?|dob|gender|date of birth|जन्म)|$)`,
		// Pattern 2: Pure Nepali after नाम label
		`(?im)(?:नाम)[\s:]*([^\n\r|;:]+?)(?=\s*(?:पिता|आमा|जन्म|लिङ्ग)|$)`,
		// Pattern 3: Capitalized name on its own line or after colon
		`(?im)(?:^|\n)(?:name|नाम)?\s*:?\s*([A-Z][A-Za-z]{2,}\s+[A-Za-z]{2,})(?:\s|$|\n)`,
		// Pattern 4: Nepali text that looks like a name (2+ Devanagari words)
		`(?im)([ा-हॉ\s]{3,40})(?=\s*(?:पिता|आमा|जन्म|लिङ्ग))`,
	}
	for _, pattern := range namePatterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(ocrText); len(match) > 1 {
			name := cleanExtractedText(match[1])
			// Common sense: name should be reasonable length, contain multiple words/chars
			if len(name) > 3 && len(name) < 100 && !isGarbageText(name) && strings.Count(name, " ") >= 0 {
				// Check if it's a reasonable name (has at least one letter)
				hasLetters := 0
				for _, ch := range name {
					if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
						(ch >= 'अ' && ch <= 'ह') { // Devanagari
						hasLetters++
					}
				}
				if hasLetters > 3 {
					fields["full_name"] = name
					break
				}
			}
		}
	}

	// === DOB EXTRACTION ===
	// Priority: label-based patterns (more reliable)
	dobLabelPattern := regexp.MustCompile(`(?i)(?:dob|date\s*of\s*birth|birth\s*date|जन्म\s*मिति)[:\s]*([0-9०-९]{2,4}[/-][0-9०-९]{2}[/-][0-9०-९]{2,4})`)
	if match := dobLabelPattern.FindStringSubmatch(ocrText); len(match) > 1 {
		dob := normalizeNepaliDigits(strings.TrimSpace(match[1]))
		if isValidDateFormat(dob) {
			fields["dob"] = dob
		}
	}

	// Fallback: generic date patterns
	if fields["dob"] == "" {
		dobPattern := regexp.MustCompile(`\b(\d{4})[/-](\d{2})[/-](\d{2})\b|\b(\d{2})[/-](\d{2})[/-](\d{4})\b`)
		if match := dobPattern.FindString(asciiText); match != "" {
			if isValidDateFormat(match) {
				fields["dob"] = match
			}
		}
	}

	// === GENDER EXTRACTION ===
	// Check female before male (avoid "female" substring false-positives with "male")
	lowerText := strings.ToLower(ocrText)
	if strings.Contains(lowerText, "female") ||
		strings.Contains(ocrText, "महिला") ||
		strings.Contains(ocrText, "स्त्री") {
		fields["gender"] = "Female"
	} else if strings.Contains(lowerText, "male") ||
		strings.Contains(ocrText, "पुरुष") {
		fields["gender"] = "Male"
	} else if strings.Contains(strings.ToLower(ocrText), "other") ||
		strings.Contains(ocrText, "अन्य") {
		fields["gender"] = "Other"
	}

	// === FATHER NAME EXTRACTION ===
	fatherPatterns := []string{
		`(?i)(?:father|dad|father's|पिता|बाबु|बुवा)[\s:]+([^\n\r;|]+?)(?=\s*(?:mother|आमा|dob|nid)|$)`,
		`(?i)(?:पिता)[\s:]*([^\n\r;|]+)`,
	}
	for _, pattern := range fatherPatterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(ocrText); len(match) > 1 {
			father := cleanExtractedText(match[1])
			if father != "" && len(father) > 2 && !isGarbageText(father) {
				fields["father_name"] = father
				break
			}
		}
	}

	// === MOTHER NAME EXTRACTION ===
	motherPatterns := []string{
		`(?i)(?:mother|mom|mother's|आमा|माता|अइको|अइकी)[\s:]+([^\n\r;|]+?)(?=\s*(?:dob|nid|district)|$)`,
		`(?i)(?:आमा)[\s:]*([^\n\r;|]+)`,
	}
	for _, pattern := range motherPatterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(ocrText); len(match) > 1 {
			mother := cleanExtractedText(match[1])
			if mother != "" && len(mother) > 2 && !isGarbageText(mother) {
				fields["mother_name"] = mother
				break
			}
		}
	}

	// === ADDRESS EXTRACTION ===
	addressPatterns := []string{
		`(?i)(?:address|location|addr|पता)[\s:]*([^\n\r]+?)(?=\n|$)`,
		`(?i)(?:पता)[\s:]*([^\n\r]+)`,
	}
	for _, pattern := range addressPatterns {
		re := regexp.MustCompile(pattern)
		if match := re.FindStringSubmatch(ocrText); len(match) > 1 {
			addr := cleanExtractedText(match[1])
			if addr != "" && len(addr) > 3 {
				fields["address"] = addr
				break
			}
		}
	}

	// === DISTRICT EXTRACTION ===
	districts := []string{"Kaski", "Pokhara", "Kathmandu", "Lalitpur", "Bhaktapur", "Chitwan", "Gandaki"}
	for _, dist := range districts {
		if strings.Contains(ocrText, dist) {
			fields["district"] = dist
			break
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

	// === WARD NUMBER EXTRACTION ===
	wardPattern := regexp.MustCompile(`(?i)(?:ward|वडा)[\s:]*(\d{1,2})`)
	if match := wardPattern.FindStringSubmatch(ocrText); len(match) > 1 {
		fields["ward_no"] = match[1]
	}
	if fields["ward_no"] == "" {
		wardNepPattern := regexp.MustCompile(`वडा[\s:]*(\d{1,2}|[०-९]{1,2})`)
		if match := wardNepPattern.FindStringSubmatch(ocrText); len(match) > 1 {
			fields["ward_no"] = normalizeNepaliDigits(match[1])
		}
	}

	return fields
}

// isGarbageText checks if extracted text looks like OCR noise
// Returns true if text contains excessive special chars or repeated characters
func isGarbageText(text string) bool {
	// Too many repeating characters (e.g., "aaaaaaa" or "||||")
	repeatCount := 0
	for i := 1; i < len(text); i++ {
		if text[i] == text[i-1] {
			repeatCount++
			if repeatCount > 4 { // More than 5 consecutive same chars
				return true
			}
		} else {
			repeatCount = 0
		}
	}

	// Count special/non-letter characters
	letterCount := 0
	specialCount := 0
	for _, ch := range text {
		if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
			(ch >= '0' && ch <= '9') || (ch >= '०' && ch <= '९') ||
			(ch >= 'अ' && ch <= 'ह') { // Devanagari range
			letterCount++
		} else if ch != ' ' && ch != '-' && ch != '.' {
			specialCount++
		}
	}

	// If more than 30% special chars, likely garbage
	if letterCount > 0 && float64(specialCount)/float64(letterCount) > 0.3 {
		return true
	}

	return false
}

// isValidDateFormat checks if text looks like a valid date
func isValidDateFormat(dateStr string) bool {
	// YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD formats
	dateRegex := regexp.MustCompile(`^(\d{4})[/-](\d{2})[/-](\d{2})$|^(\d{2})[/-](\d{2})[/-](\d{4})$`)
	return dateRegex.MatchString(dateStr)
}
