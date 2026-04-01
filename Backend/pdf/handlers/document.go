package handlers

import (
	"context"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/database"
	"pratibimba/internal/models"
	internalpdf "pratibimba/pdf"
)

// DownloadPDF handles GET /document/pdf/:dtid
// Fetches the ledger entry + request data,
// builds the PDFRequest struct, generates PDF, streams to client.
func DownloadPDF(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		dtid := c.Params("dtid")

		if dtid == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "DTID is required",
			})
		}

		ctx := context.Background()

		// ── Fetch ledger entry ───────────────────────────────
		entry, err := db.GetLedgerByDTID(ctx, dtid)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Database error",
			})
		}
		if entry == nil {
			return c.Status(404).JSON(fiber.Map{
				"success": false,
				"message": "Document not found in national registry",
			})
		}

		// Only ACTIVE documents can be downloaded
		if entry.Status != "ACTIVE" {
			return c.Status(403).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Document is %s and cannot be downloaded", entry.Status),
			})
		}

		// ── Fetch service request for citizen details ────────
		var sr *models.ServiceRequest
		if entry.RequestID != "" {
			sr, err = db.GetRequestByID(ctx, entry.RequestID)
			if err != nil {
				log.Printf("Request fetch error for PDF: %v", err)
			}
		}

		// ── Fetch officer details ────────────────────────────
		officer, err := db.GetOfficerByID(ctx, entry.OfficerID)
		if err != nil || officer == nil {
			log.Printf("Officer fetch error for PDF: %v", err)
		}

		// ── Build PDFRequest ─────────────────────────────────
		// Assemble all available data
		pdfReq := buildPDFRequest(entry, sr, officer)

		// ── Generate PDF ─────────────────────────────────────
		result, err := internalpdf.Generate(pdfReq)
		if err != nil {
			log.Printf("PDF generation error for %s: %v", dtid, err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "PDF generation failed",
			})
		}

		log.Printf("📄 PDF generated: %s (%d bytes)", dtid, len(result.Bytes))

		// ── Stream PDF to client ─────────────────────────────
		c.Set("Content-Type", "application/pdf")
		c.Set("Content-Disposition",
			fmt.Sprintf(`attachment; filename="%s"`, result.Filename))
		c.Set("Content-Length", fmt.Sprintf("%d", len(result.Bytes)))
		c.Set("Cache-Control", "no-cache")

		return c.Send(result.Bytes)
	}
}

// buildPDFRequest assembles a PDFRequest from DB data.
// Handles missing data gracefully — PDF generates even if
// some optional fields are absent.
func buildPDFRequest(
	entry *models.LedgerEntry,
	sr *models.ServiceRequest,
	officer *models.Officer,
) *models.PDFRequest {

	req := &models.PDFRequest{
		// Document identity
		DTID:         entry.DTID,
		DocumentHash: entry.DocumentHash,
		DocumentType: string(entry.DocumentType),
		RequestID:    entry.RequestID,
		IssuedAtUTC:  entry.CreatedAt,

		// Dates
		IssuedDateBS: internalpdf.FormatNepaliDate(entry.CreatedAt),
		IssuedTimeNP: internalpdf.FormatNepaliTime(entry.CreatedAt),
		ValidUntilBS: internalpdf.FormatValidUntil(entry.CreatedAt),

		// Verification
		VerifyURL: fmt.Sprintf("verify.pratibimba.gov.np/%s", entry.DTID),

		// Ward info from entry
		WardCode:     entry.WardCode,
		WardNumber:   extractWardNum(entry.WardCode),
		DistrictName: districtName(entry.DistrictCode),
		ProvinceName: provinceName(entry.ProvinceCode),
		OfficeName:   officeName(entry.WardCode),
	}

	// Fill citizen details from service request if available
	if sr != nil {
		req.CitizenName = sr.CitizenName
		req.CitizenNID = sr.CitizenNID
		req.Purpose = sr.Purpose
		req.AdditionalInfo = sr.AdditionalInfo

		// Parse extended citizen data from OCR/additional info
		extended := parseExtendedData(sr.AdditionalInfo)
		req.CitizenDOB = extended["dob"]
		req.CitizenGender = extended["gender"]
		req.CitizenAddress = extended["address"]
		req.FatherName = extended["father"]
		req.MotherName = extended["mother"]
	}

	// Fill officer details
	if officer != nil {
		req.OfficerName = officer.FullName
		req.OfficerDesig = officer.Designation
		req.OfficePhone = officePhone(officer.WardCode)
		req.OfficeEmail = officeEmail(officer.WardCode)
	}

	// Fallbacks for empty required fields
	if req.CitizenName == "" {
		req.CitizenName = "—"
	}
	if req.CitizenNID == "" {
		req.CitizenNID = "—"
	}
	if req.CitizenDOB == "" {
		req.CitizenDOB = "—"
	}
	if req.CitizenGender == "" {
		req.CitizenGender = "—"
	}
	if req.CitizenAddress == "" {
		req.CitizenAddress = req.WardCode
	}
	if req.FatherName == "" {
		req.FatherName = "—"
	}
	if req.MotherName == "" {
		req.MotherName = "—"
	}
	if req.Purpose == "" {
		req.Purpose = "सामान्य सिफारिस"
	}
	if req.OfficerName == "" {
		req.OfficerName = "वडा अधिकृत"
	}
	if req.OfficerDesig == "" {
		req.OfficerDesig = "Ward Officer"
	}

	return req
}

// parseExtendedData parses key:value pairs from additional_info field.
// Format expected: "dob:2015/04/12|gender:पुरुष|address:वडा ९|father:Ram|mother:Sita"
func parseExtendedData(raw string) map[string]string {
	result := map[string]string{
		"dob":     "",
		"gender":  "",
		"address": "",
		"father":  "",
		"mother":  "",
	}

	if raw == "" {
		return result
	}

	// Parse pipe-separated key:value pairs
	pairs := splitString(raw, "|")
	for _, pair := range pairs {
		kv := splitString(pair, ":")
		if len(kv) == 2 {
			key := trimString(kv[0])
			val := trimString(kv[1])
			if _, ok := result[key]; ok {
				result[key] = val
			}
		}
	}

	return result
}

// ── Ward/District/Province Lookup Helpers ────────────────────
// In production: fetch from a municipalities table in DB
// For prototype: hardcoded for Pokhara Metro

func officeName(wardCode string) string {
	return "पोखरा महानगरपालिका"
}

func districtName(code int) string {
	districts := map[int]string{
		33: "कास्की",
		34: "स्याङ्जा",
		35: "तनहुँ",
		36: "लम्जुङ",
		37: "गोर्खा",
		38: "मनाङ",
		39: "मुस्ताङ",
		40: "म्याग्दी",
		41: "पर्वत",
		42: "बाग्लुङ",
	}
	if name, ok := districts[code]; ok {
		return name
	}
	return fmt.Sprintf("जिल्ला %d", code)
}

func provinceName(code int) string {
	provinces := map[int]string{
		1: "कोशी प्रदेश",
		2: "मधेश प्रदेश",
		3: "बागमती प्रदेश",
		4: "गण्डकी प्रदेश",
		5: "लुम्बिनी प्रदेश",
		6: "कर्णाली प्रदेश",
		7: "सुदूरपश्चिम प्रदेश",
	}
	if name, ok := provinces[code]; ok {
		return name
	}
	return fmt.Sprintf("प्रदेश %d", code)
}

func officePhone(wardCode string) string {
	// In production: fetch from ward registry DB table
	return "०६१-५२०७४३"
}

func officeEmail(wardCode string) string {
	wardNum := extractWardNum(wardCode)
	return fmt.Sprintf("ward%s@pokharamun.gov.np", wardNum)
}

func extractWardNum(wardCode string) string {
	if len(wardCode) >= 11 {
		return wardCode[len(wardCode)-2:]
	}
	return "00"
}

// ── String Helpers ───────────────────────────────────────────

func splitString(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if string(s[i]) == sep {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}

func trimString(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
