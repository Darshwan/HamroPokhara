package handlers

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/database"
	"pratibimba/internal/models"
	"pratibimba/pdf"
)

// PreviewDocumentPDF handles POST /citizen/preview-pdf
// Generates a PDF preview before citizen submits their actual request
// Allows them to see exactly how the document will look
//
// Request JSON:
//
//	{
//	  "citizen_nid": "46-02-81-04132",
//	  "citizen_name": "थर शर्मा",
//	  "citizen_dob": "2000-05-15",
//	  "citizen_gender": "Male",
//	  "citizen_address": "वडा ९, कास्की",
//	  "father_name": "राम शर्मा",
//	  "mother_name": "सीता शर्मा",
//	  "document_type": "CITIZENSHIP_LETTER",
//	  "purpose": "विदेश यात्रा",
//	  "additional_info": "भारत यात्रा गर्न आवश्यक",
//	  "ward_code": "NPL-04-33-09"
//	}
//
// Response: PDF as base64 encoded string or direct download
func PreviewDocumentPDF(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {

		var req struct {
			CitizenNID     string `json:"citizen_nid"`
			CitizenName    string `json:"citizen_name"`
			CitizenDOB     string `json:"citizen_dob"`    // YYYY-MM-DD
			CitizenGender  string `json:"citizen_gender"` // Male/Female/Other
			CitizenAddress string `json:"citizen_address"`
			FatherName     string `json:"father_name"`
			MotherName     string `json:"mother_name"`
			DocumentType   string `json:"document_type"`
			Purpose        string `json:"purpose"`
			AdditionalInfo string `json:"additional_info"`
			WardCode       string `json:"ward_code"`
			ReturnBase64   bool   `json:"return_base64"` // If true, return base64; else stream PDF
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
		}

		// Validate required fields
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

		// Fetch ward office details from database
		ctx := context.Background()
		ward, err := db.GetWardDetails(ctx, req.WardCode)
		if err != nil {
			log.Printf("[PDF] Error fetching ward details: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Could not fetch ward details",
				"error":   err.Error(),
			})
		}

		// Generate DTID (Document Tracking ID) for preview
		// Format: DTID-PREVIEW-{timestamp}
		previewDTID := fmt.Sprintf("DTID-PREVIEW-%d", time.Now().UnixNano())

		// Parse citizen DOB to Nepali date
		dobNepali := convertToNepaliDate(req.CitizenDOB)
		if dobNepali == "" {
			dobNepali = req.CitizenDOB // Fallback to provided date
		}

		// Generate Nepali BS dates for issue and validity
		now := time.Now()
		issuedBS := "२०८२ भाद्र १५"    // Placeholder - should be calculated
		validUntilBS := "२०८२ असोज १५" // 30 days later
		issueTimeNP := "दिउसो २:३५"

		// Construct PDF request
		pdfReq := &models.PDFRequest{
			DTID:         previewDTID,
			DocumentHash: previewDTID[:16],
			DocumentType: req.DocumentType,
			RequestID:    "", // Not submitted yet

			CitizenName:    req.CitizenName,
			CitizenNID:     req.CitizenNID,
			CitizenDOB:     dobNepali,
			CitizenGender:  convertGenderToNepali(req.CitizenGender),
			CitizenAddress: req.CitizenAddress,
			FatherName:     req.FatherName,
			MotherName:     req.MotherName,

			Purpose:        req.Purpose,
			AdditionalInfo: req.AdditionalInfo,

			OfficerName:  "प्रिभ्यु मोड", // Preview Mode
			OfficerDesig: "अधिकृत",
			WardCode:     req.WardCode,
			WardNumber:   ward.WardNumber,
			DistrictName: ward.DistrictName,
			ProvinceName: ward.ProvinceName,
			OfficeName:   ward.OfficeName,
			OfficePhone:  ward.OfficePhone,
			OfficeEmail:  ward.OfficeEmail,

			IssuedDateBS: issuedBS,
			IssuedTimeNP: issueTimeNP,
			ValidUntilBS: validUntilBS,
			IssuedAtUTC:  now,

			VerifyURL: fmt.Sprintf("verify.pratibimba.gov.np/%s", previewDTID),
		}

		// Generate PDF
		pdfResult, err := pdf.Generate(pdfReq)
		if err != nil {
			log.Printf("[PDF] Error generating PDF: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to generate PDF preview",
				"error":   err.Error(),
			})
		}

		// Response options
		if req.ReturnBase64 {
			// Return as base64 JSON (for web preview)
			b64 := base64.StdEncoding.EncodeToString(pdfResult.Bytes)
			return c.JSON(fiber.Map{
				"success":    true,
				"message":    "PDF preview generated successfully",
				"pdf_base64": b64,
				"filename":   pdfResult.Filename,
				"dtid":       previewDTID,
				"page_count": pdfResult.PageCount,
			})
		}

		// Return as downloadable PDF file
		c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, pdfResult.Filename))
		c.Set("Content-Type", "application/pdf")
		return c.Send(pdfResult.Bytes)
	}
}

// DownloadDocumentPDF handles GET /citizen/download-pdf/:request_id
// Downloads the confirmed/approved PDF of a submitted request
func DownloadDocumentPDF(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {

		requestID := c.Params("request_id")
		if requestID == "" {
			return c.Status(400).JSON(fiber.Map{
				"success": false,
				"message": "Request ID is required",
			})
		}

		ctx := context.Background()

		// Fetch request from database
		req, err := db.GetServiceRequest(ctx, requestID)
		if err != nil {
			log.Printf("[PDF] Request not found: %s, error: %v", requestID, err)
			return c.Status(404).JSON(fiber.Map{
				"success": false,
				"message": "Request not found",
			})
		}

		// Check if request is approved
		if req.Status != "APPROVED" && req.Status != "COMPLETED" {
			return c.Status(403).JSON(fiber.Map{
				"success": false,
				"message": fmt.Sprintf("Cannot download PDF — request status is %s (must be APPROVED)", req.Status),
			})
		}

		// Fetch ward details
		ward, err := db.GetWardDetails(ctx, req.WardCode)
		if err != nil {
			log.Printf("[PDF] Error fetching ward details: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Could not fetch ward details",
			})
		}

		// Fetch officer details
		officer, err := db.GetOfficer(ctx, req.ApprovedByOfficerID)
		if err != nil {
			officer = &models.Officer{
				FullName:    "अधिकृत",
				Designation: "कार्यालय",
			}
		}

		// Parse citizen DOB to Nepali date
		dobNepali := req.CitizenDOB
		if !strings.Contains(dobNepali, "०") && !strings.Contains(dobNepali, "१") {
			dobNepali = convertToNepaliDate(req.CitizenDOB)
		}

		// Construct PDF request from database record
		pdfReq := &models.PDFRequest{
			DTID:         req.DTID,
			DocumentHash: req.DocumentHash,
			DocumentType: req.DocumentType,
			RequestID:    requestID,

			CitizenName:    req.CitizenName,
			CitizenNID:     req.CitizenNID,
			CitizenDOB:     dobNepali,
			CitizenGender:  req.CitizenGender,
			CitizenAddress: req.CitizenAddress,
			FatherName:     req.FatherName,
			MotherName:     req.MotherName,

			Purpose:        req.Purpose,
			AdditionalInfo: req.AdditionalInfo,

			OfficerName:  officer.FullName,
			OfficerDesig: officer.Designation,
			WardCode:     req.WardCode,
			WardNumber:   ward.WardNumber,
			DistrictName: ward.DistrictName,
			ProvinceName: ward.ProvinceName,
			OfficeName:   ward.OfficeName,
			OfficePhone:  ward.OfficePhone,
			OfficeEmail:  ward.OfficeEmail,

			IssuedDateBS: req.IssuedDateBS,
			IssuedTimeNP: req.IssuedTimeNP,
			ValidUntilBS: req.ValidUntilBS,
			IssuedAtUTC:  req.IssuedAt,

			VerifyURL: fmt.Sprintf("verify.pratibimba.gov.np/%s", req.DTID),
		}

		// Generate PDF
		pdfResult, err := pdf.Generate(pdfReq)
		if err != nil {
			log.Printf("[PDF] Error generating PDF for request %s: %v", requestID, err)
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to generate PDF",
				"error":   err.Error(),
			})
		}

		// Stream PDF directly
		c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, pdfResult.Filename))
		c.Set("Content-Type", "application/pdf")
		c.Set("Cache-Control", "public, max-age=3600")
		return c.Send(pdfResult.Bytes)
	}
}

// convertGenderToNepali converts English gender to Nepali
func convertGenderToNepali(english string) string {
	switch strings.ToLower(english) {
	case "male":
		return "पुरुष"
	case "female":
		return "महिला"
	case "other":
		return "अन्य"
	default:
		return english
	}
}

// convertToNepaliDate converts YYYY-MM-DD to Nepali BS date string
// This is a simplified version — in production, use a proper date library
func convertToNepaliDate(englishDate string) string {
	// Parse: YYYY-MM-DD
	if len(englishDate) < 10 {
		return ""
	}

	parts := strings.Split(englishDate, "-")
	if len(parts) != 3 {
		return ""
	}

	// Simple conversion: AD year + 57 = BS year
	// This is approximate; real conversion needs a library
	// For now, just convert digits to Nepali
	year := parts[0]
	month := parts[1]
	day := parts[2]

	// Convert ASCII digits to Nepali numerals
	nepaliYear := convertToNepaliNumerals(year)
	nepaliMonth := convertToNepaliNumerals(month)
	nepaliDay := convertToNepaliNumerals(day)

	monthNames := map[string]string{
		"01": "जनवरी",
		"02": "फेब्रुअरी",
		"03": "मार्च",
		"04": "अप्रिल",
		"05": "मे",
		"06": "जुन",
		"07": "जुलाई",
		"08": "अगस्ट",
		"09": "सेप्टेम्बर",
		"10": "अक्टोबर",
		"11": "नोभेम्बर",
		"12": "डिसेम्बर",
	}

	monthName := monthNames[month]
	if monthName == "" {
		monthName = nepaliMonth
	}

	return fmt.Sprintf("%s %s %s", nepaliDay, monthName, nepaliYear)
}

// convertToNepaliNumerals converts ASCII digits to Nepali Devanagari numerals
func convertToNepaliNumerals(asciiDigits string) string {
	nepaliDigits := map[rune]string{
		'0': "०",
		'1': "१",
		'2': "२",
		'3': "३",
		'4': "४",
		'5': "५",
		'6': "६",
		'7': "७",
		'8': "८",
		'9': "९",
	}

	result := ""
	for _, ch := range asciiDigits {
		if nep, ok := nepaliDigits[ch]; ok {
			result += nep
		} else {
			result += string(ch)
		}
	}
	return result
}
