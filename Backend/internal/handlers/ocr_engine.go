package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
)

type CitizenshipFields struct {
	FullNameNE string `json:"full_name_ne"`
	FullNameEN string `json:"full_name_en"`

	CitizenshipNo string `json:"citizenship_no"`
	DOB           string `json:"dob"`
	DOBNepali     string `json:"dob_ne"`
	Gender        string `json:"gender"`

	FatherNameNE string `json:"father_name_ne"`
	MotherNameNE string `json:"mother_name_ne"`
	SpouseNameNE string `json:"spouse_name_ne,omitempty"`

	DistrictNE     string `json:"district_ne"`
	MunicipalityNE string `json:"municipality_ne"`
	WardNo         string `json:"ward_no"`

	IssueDate      string `json:"issue_date"`
	IssuedDistrict string `json:"issued_district"`

	Confidence        map[string]int `json:"confidence"`
	OverallConfidence int            `json:"overall_confidence"`
}

type NIDFields struct {
	NIDNumber  string         `json:"nid_number"`
	FullName   string         `json:"full_name"`
	DOB        string         `json:"dob"`
	Gender     string         `json:"gender"`
	Confidence map[string]int `json:"confidence"`
}

type DrivingLicenseFields struct {
	LicenseNo  string         `json:"license_no"`
	FullName   string         `json:"full_name"`
	DOB        string         `json:"dob"`
	Categories []string       `json:"categories"`
	IssueDate  string         `json:"issue_date"`
	ExpiryDate string         `json:"expiry_date"`
	Confidence map[string]int `json:"confidence"`
}

type PassportFields struct {
	PassportNo   string         `json:"passport_no"`
	Surname      string         `json:"surname"`
	GivenNames   string         `json:"given_names"`
	Nationality  string         `json:"nationality"`
	DOB          string         `json:"dob"`
	Sex          string         `json:"sex"`
	PlaceOfBirth string         `json:"place_of_birth"`
	IssueDate    string         `json:"issue_date"`
	ExpiryDate   string         `json:"expiry_date"`
	MRZLine1     string         `json:"mrz_line_1"`
	MRZLine2     string         `json:"mrz_line_2"`
	Confidence   map[string]int `json:"confidence"`
}

// POST /auth/ocr
// Android sends document image. The backend attempts Vision/Claude extraction,
// then falls back to regex parsing, and returns autofill-ready structured fields.
func ProcessDocumentOCR(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		traceID := authTraceID(c)
		start := time.Now()
		debugOCR := strings.EqualFold(strings.TrimSpace(os.Getenv("OCR_DEBUG")), "true")

		var req struct {
			ImageBase64   string `json:"image_base64"`
			ExtractedText string `json:"extracted_text"`
			DocumentType  string `json:"document_type"`
			Language      string `json:"language"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		req.DocumentType = strings.ToUpper(strings.TrimSpace(req.DocumentType))
		if req.DocumentType == "" {
			req.DocumentType = "CITIZENSHIP"
		}

		imageB64 := strings.TrimSpace(req.ImageBase64)
		ocrHint := strings.TrimSpace(req.ExtractedText)
		log.Printf("[OCR][%s] start doc_type=%s image_bytes=%d text_len=%d", traceID, req.DocumentType, len(imageB64), len(ocrHint))
		if debugOCR && ocrHint != "" {
			log.Printf("[OCR][%s][debug] extracted_text=%q", traceID, truncateForLog(ocrHint, 240))
		}

		if imageB64 == "" && ocrHint == "" {
			log.Printf("[OCR][%s] rejected: missing image_base64 and extracted_text", traceID)
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "image_base64 or extracted_text is required"})
		}

		ctx := context.Background()

		var rawText string
		var googleOK bool
		googleAttempted := false
		ocrReason := ""
		if imageB64 != "" {
			googleKey := strings.TrimSpace(os.Getenv("GOOGLE_VISION_API_KEY"))
			if googleKey != "" {
				googleAttempted = true
				text, err := callGoogleVision(ctx, googleKey, imageB64)
				if err == nil && len(strings.TrimSpace(text)) > 20 {
					rawText = text
					googleOK = true
					if debugOCR {
						log.Printf("[OCR][%s][debug] google raw_text_len=%d", traceID, len(rawText))
					}
				} else if debugOCR && err != nil {
					log.Printf("[OCR][%s][debug] google failed: %v", traceID, err)
					ocrReason = "google_vision_failed"
				}
			}
		}
		if debugOCR && !googleAttempted {
			log.Printf("[OCR][%s][debug] google skipped", traceID)
			if imageB64 != "" {
				ocrReason = "google_vision_not_configured"
			}
		}
		if !googleOK && ocrHint != "" {
			rawText = ocrHint
			if debugOCR {
				log.Printf("[OCR][%s][debug] using client extracted_text fallback", traceID)
			}
		}

		var structuredFields interface{}
		extractionSource := "manual_required"

		anthropicKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
		if imageB64 != "" && anthropicKey != "" {
			fields, err := extractWithClaude(ctx, anthropicKey, imageB64, req.DocumentType, rawText)
			if err == nil && fields != nil {
				structuredFields = fields
				extractionSource = "claude_vision"
				if debugOCR {
					log.Printf("[OCR][%s][debug] claude success", traceID)
				}
			} else if debugOCR && err != nil {
				log.Printf("[OCR][%s][debug] claude failed: %v", traceID, err)
				if ocrReason == "" {
					ocrReason = "claude_vision_failed"
				}
			}
		} else if imageB64 != "" {
			if ocrReason == "" {
				ocrReason = "claude_not_configured"
			}
		}

		if structuredFields == nil && rawText != "" {
			structuredFields = parseRawText(rawText, req.DocumentType)
			extractionSource = "ocr_parsed"
			if debugOCR {
				log.Printf("[OCR][%s][debug] parser fallback raw_text_len=%d", traceID, len(rawText))
			}
		}

		if structuredFields == nil {
			structuredFields = emptyFields(req.DocumentType)
			if debugOCR {
				log.Printf("[OCR][%s][debug] empty fields generated", traceID)
			}
			if ocrReason == "" {
				ocrReason = "manual_required"
			}
		}

		normalized := buildNormalizedAutofill(req.DocumentType, structuredFields)
		stored := normalized["full_name"] != "" && (normalized["nid"] != "" || normalized["citizenship_no"] != "" || normalized["passport_no"] != "" || normalized["license_no"] != "")

		processingMs := int(time.Since(start).Milliseconds())
		fieldsJSON, _ := json.Marshal(structuredFields)
		normJSON, _ := json.Marshal(normalized)
		if debugOCR {
			log.Printf("[OCR][%s][debug] structured_fields=%s", traceID, truncateForLog(string(fieldsJSON), 800))
			log.Printf("[OCR][%s][debug] normalized_fields=%s", traceID, truncateForLog(string(normJSON), 600))
		}
		log.Printf("[OCR][%s] done source=%s stored=%v processing_ms=%d", traceID, extractionSource, stored, processingMs)
		auditOCR(db, req.DocumentType, string(fieldsJSON), processingMs, c.IP())

		return c.Status(200).JSON(fiber.Map{
			"success":               true,
			"document_type":         req.DocumentType,
			"fields":                structuredFields,
			"normalized_fields":     normalized,
			"stored":                stored,
			"autofill_ready":        stored,
			"nid":                   normalized["nid"],
			"citizenship_no":        normalized["citizenship_no"],
			"full_name":             normalized["full_name"],
			"dob":                   normalized["dob"],
			"gender":                normalized["gender"],
			"father_name":           normalized["father_name"],
			"mother_name":           normalized["mother_name"],
			"district":              normalized["district"],
			"ward":                  normalized["ward"],
			"source":                extractionSource,
			"ocr_reason":            ocrReason,
			"processing_ms":         processingMs,
			"requires_verification": true,
			"message": map[string]string{
				"ne": "कृपया निकालिएको जानकारी जाँच गर्नुस् र गल्ती सच्याउनुस्",
				"en": "Please verify the extracted information and correct any errors",
			},
		})
	}
}

func truncateForLog(s string, max int) string {
	if max <= 0 {
		return ""
	}
	s = strings.TrimSpace(s)
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "..."
}

func callGoogleVision(ctx context.Context, apiKey, imageBase64 string) (string, error) {
	payload := map[string]interface{}{
		"requests": []map[string]interface{}{
			{
				"image": map[string]interface{}{"content": imageBase64},
				"features": []map[string]interface{}{
					{"type": "DOCUMENT_TEXT_DETECTION", "maxResults": 1},
				},
				"imageContext": map[string]interface{}{"languageHints": []string{"ne", "en"}},
			},
		},
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://vision.googleapis.com/v1/images:annotate?key=%s", apiKey)

	reqHTTP, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	reqHTTP.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(reqHTTP)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Responses []struct {
			FullTextAnnotation struct {
				Text string `json:"text"`
			} `json:"fullTextAnnotation"`
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		} `json:"responses"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Responses) == 0 {
		return "", fmt.Errorf("no response from Vision API")
	}
	if result.Responses[0].Error.Message != "" {
		return "", fmt.Errorf("vision API error: %s", result.Responses[0].Error.Message)
	}

	return result.Responses[0].FullTextAnnotation.Text, nil
}

func extractWithClaude(ctx context.Context, apiKey, imageBase64, docType, ocrHint string) (interface{}, error) {
	var systemPrompt, userPrompt string

	switch docType {
	case "CITIZENSHIP":
		systemPrompt = `You are an expert at extracting information from Nepali citizenship certificates (नागरिकता प्रमाणपत्र).
Extract ALL visible text accurately, including Devanagari script.
Return ONLY valid JSON, no markdown, no explanation.
If a field is not visible or unclear, use empty string "".
For confidence, use 0-100 where 100 = perfectly clear.`
		userPrompt = fmt.Sprintf(`Extract all fields from this Nepali citizenship certificate image.
%s

Return this exact JSON structure:
{
  "full_name_ne": "नाम देवनागरी",
  "full_name_en": "Name in English if present",
  "citizenship_no": "01-02-03-04567",
  "dob": "YYYY/MM/DD",
  "dob_ne": "२०४२/०३/१५",
  "gender": "पुरुष or महिला",
  "father_name_ne": "बाबुको नाम",
  "mother_name_ne": "आमाको नाम",
  "spouse_name_ne": "पतिपत्नीको नाम if present",
  "district_ne": "जिल्ला",
  "municipality_ne": "नगरपालिका/गाउँपालिका",
  "ward_no": "वडा नं.",
  "issue_date": "YYYY/MM/DD",
  "issued_district": "जारी गर्ने जिल्ला",
  "confidence": {
    "full_name_ne": 95,
    "citizenship_no": 98,
    "dob": 90,
    "gender": 99,
    "father_name_ne": 88,
    "mother_name_ne": 85,
    "district_ne": 92,
    "municipality_ne": 87,
    "ward_no": 95
  },
  "overall_confidence": 92
}`,
			conditionalOCRHint(ocrHint))

	case "NID":
		systemPrompt = `You are an expert at extracting information from Nepal's National Identity Card (राष्ट्रिय परिचय पत्र).
Return ONLY valid JSON.`
		userPrompt = `Extract all fields from this Nepal NID card.
Return JSON: {"nid_number":"","full_name":"","dob":"","gender":"","confidence":{}}`

	case "DRIVING_LICENSE":
		systemPrompt = `You are an expert at extracting information from Nepal Driving Licenses.
Return ONLY valid JSON.`
		userPrompt = `Extract: {"license_no":"","full_name":"","dob":"","categories":[],"issue_date":"","expiry_date":"","confidence":{}}`

	case "PASSPORT":
		systemPrompt = `You are an expert at extracting information from passports, including Machine Readable Zone (MRZ).
Parse BOTH the visual data AND the MRZ lines accurately.
Return ONLY valid JSON.`
		userPrompt = fmt.Sprintf(`Extract all passport fields including MRZ.
%s

Return: {
  "passport_no":"",
  "surname":"",
  "given_names":"",
  "nationality":"",
  "dob":"YYYY/MM/DD",
  "sex":"M or F",
  "place_of_birth":"",
  "issue_date":"YYYY/MM/DD",
  "expiry_date":"YYYY/MM/DD",
  "mrz_line_1":"",
  "mrz_line_2":"",
  "confidence":{}
}`,
			conditionalOCRHint(ocrHint))

	default:
		return nil, fmt.Errorf("unknown document type: %s", docType)
	}

	payload := map[string]interface{}{
		"model":      "claude-opus-4-5",
		"max_tokens": 1000,
		"system":     systemPrompt,
		"messages": []map[string]interface{}{
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]interface{}{
							"type":       "base64",
							"media_type": "image/jpeg",
							"data":       imageBase64,
						},
					},
					{"type": "text", "text": userPrompt},
				},
			},
		},
	}

	body, _ := json.Marshal(payload)
	reqHTTP, _ := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	reqHTTP.Header.Set("Content-Type", "application/json")
	reqHTTP.Header.Set("x-api-key", apiKey)
	reqHTTP.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(reqHTTP)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var claudeResp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		return nil, err
	}

	for _, block := range claudeResp.Content {
		if block.Type != "text" || strings.TrimSpace(block.Text) == "" {
			continue
		}
		text := strings.TrimSpace(block.Text)
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)

		var result interface{}
		if err := json.Unmarshal([]byte(text), &result); err != nil {
			return nil, fmt.Errorf("JSON parse error: %w", err)
		}
		return result, nil
	}

	return nil, fmt.Errorf("no text in Claude response")
}

func conditionalOCRHint(ocrText string) string {
	if ocrText == "" {
		return ""
	}
	if len(ocrText) > 500 {
		ocrText = ocrText[:500]
	}
	return fmt.Sprintf("\nOCR hint text: %s", ocrText)
}

func parseRawText(text, docType string) interface{} {
	lines := strings.Split(text, "\n")
	switch docType {
	case "CITIZENSHIP":
		return parseCitizenshipText(text, lines)
	case "PASSPORT":
		return parsePassportText(text, lines)
	case "NID":
		return parseNIDText(text, lines)
	case "DRIVING_LICENSE":
		return parseDrivingLicenseText(text)
	default:
		return map[string]string{"raw_text": text}
	}
}

func parseDrivingLicenseText(text string) *DrivingLicenseFields {
	f := &DrivingLicenseFields{Confidence: map[string]int{}}

	licensePattern := regexp.MustCompile(`(?i)(?:license\s*no\s*[:\-]?\s*|\b)([A-Z0-9\-]{8,20})`)
	if match := licensePattern.FindStringSubmatch(text); len(match) > 1 {
		f.LicenseNo = strings.TrimSpace(match[1])
		f.Confidence["license_no"] = 85
	}

	namePattern := regexp.MustCompile(`(?i)name\s*[:\-]\s*([A-Za-z\s]{4,60})`)
	if match := namePattern.FindStringSubmatch(text); len(match) > 1 {
		f.FullName = strings.TrimSpace(match[1])
		f.Confidence["full_name"] = 75
	}

	dobPattern := regexp.MustCompile(`\d{4}[/\-]\d{1,2}[/\-]\d{1,2}`)
	if match := dobPattern.FindString(text); match != "" {
		f.DOB = match
		f.Confidence["dob"] = 78
	}

	return f
}

func parseCitizenshipText(text string, lines []string) *CitizenshipFields {
	f := &CitizenshipFields{Confidence: map[string]int{}}

	citizenshipPattern := regexp.MustCompile(`\d{2}[-–]\d{2}[-–]\d{2}[-–]\d{5}`)
	if match := citizenshipPattern.FindString(text); match != "" {
		f.CitizenshipNo = normalizeHyphen(match)
		f.Confidence["citizenship_no"] = 90
	}

	nepaliCitizenPattern := regexp.MustCompile(`[०-९]{2}[-–][०-९]{2}[-–][०-९]{2}[-–][०-९]{5}`)
	if match := nepaliCitizenPattern.FindString(text); match != "" {
		f.CitizenshipNo = match
		f.Confidence["citizenship_no"] = 92
	}

	datePattern := regexp.MustCompile(`\d{4}[/\-]\d{1,2}[/\-]\d{1,2}`)
	nepaliDatePat := regexp.MustCompile(`[०-९]{4}[/\-][०-९]{1,2}[/\-][०-९]{1,2}`)

	if match := datePattern.FindString(text); match != "" {
		f.DOB = match
		f.Confidence["dob"] = 80
	}
	if match := nepaliDatePat.FindString(text); match != "" {
		f.DOBNepali = match
		f.Confidence["dob_ne"] = 82
	}

	if strings.Contains(text, "पुरुष") {
		f.Gender = "पुरुष"
		f.Confidence["gender"] = 99
	} else if strings.Contains(text, "महिला") {
		f.Gender = "महिला"
		f.Confidence["gender"] = 99
	}

	nepaliNames := extractNepaliNames(lines)
	if len(nepaliNames) > 0 {
		f.FullNameNE = nepaliNames[0]
		f.Confidence["full_name_ne"] = 65
	}
	if len(nepaliNames) > 1 {
		f.FatherNameNE = nepaliNames[1]
		f.Confidence["father_name_ne"] = 55
	}
	if len(nepaliNames) > 2 {
		f.MotherNameNE = nepaliNames[2]
		f.Confidence["mother_name_ne"] = 50
	}

	total, count := 0, 0
	for _, v := range f.Confidence {
		total += v
		count++
	}
	if count > 0 {
		f.OverallConfidence = total / count
	}

	return f
}

func parsePassportText(text string, _ []string) *PassportFields {
	f := &PassportFields{Confidence: map[string]int{}}

	pportPattern := regexp.MustCompile(`[A-Z]{1,2}\d{7,8}`)
	if match := pportPattern.FindString(text); match != "" {
		f.PassportNo = match
		f.Confidence["passport_no"] = 90
	}

	mrzPattern := regexp.MustCompile(`[A-Z0-9<]{44}`)
	mrzMatches := mrzPattern.FindAllString(text, -1)
	if len(mrzMatches) >= 2 {
		f.MRZLine1 = mrzMatches[0]
		f.MRZLine2 = mrzMatches[1]
		f.Confidence["mrz_line_1"] = 88
		f.Confidence["mrz_line_2"] = 88

		if len(f.MRZLine2) >= 27 {
			dob := f.MRZLine2[13:19]
			expiry := f.MRZLine2[19:25]
			f.DOB = parseMRZDate(dob)
			f.ExpiryDate = parseMRZDate(expiry)
			f.Confidence["dob"] = 92
			f.Confidence["expiry_date"] = 92
		}

		if len(f.MRZLine1) >= 44 && strings.HasPrefix(f.MRZLine1, "P") {
			nameSection := f.MRZLine1[5:44]
			parts := strings.SplitN(nameSection, "<<", 2)
			if len(parts) >= 1 {
				f.Surname = strings.TrimSpace(strings.ReplaceAll(parts[0], "<", " "))
				f.Confidence["surname"] = 88
			}
			if len(parts) >= 2 {
				f.GivenNames = strings.TrimSpace(strings.ReplaceAll(parts[1], "<", " "))
				f.Confidence["given_names"] = 85
			}
		}
	}

	if strings.Contains(text, "NEPALI") || strings.Contains(text, "NPL") {
		f.Nationality = "Nepali"
		f.Confidence["nationality"] = 95
	}

	return f
}

func parseNIDText(text string, lines []string) *NIDFields {
	f := &NIDFields{Confidence: map[string]int{}}

	nidPattern := regexp.MustCompile(`\d{11}`)
	if match := nidPattern.FindString(text); match != "" {
		f.NIDNumber = match
		f.Confidence["nid_number"] = 88
	}

	nepaliNIDPat := regexp.MustCompile(`[०-९]{11}`)
	if match := nepaliNIDPat.FindString(text); match != "" {
		f.NIDNumber = match
		f.Confidence["nid_number"] = 90
	}

	names := extractNepaliNames(lines)
	if len(names) > 0 {
		f.FullName = names[0]
		f.Confidence["full_name"] = 60
	}

	if strings.Contains(text, "पुरुष") {
		f.Gender = "पुरुष"
		f.Confidence["gender"] = 95
	}
	if strings.Contains(text, "महिला") {
		f.Gender = "महिला"
		f.Confidence["gender"] = 95
	}

	datePattern := regexp.MustCompile(`\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|[०-९]{4}[/\-][०-९]{1,2}[/\-][०-९]{1,2}`)
	if match := datePattern.FindString(text); match != "" {
		f.DOB = match
		f.Confidence["dob"] = 75
	}

	return f
}

func extractNepaliNames(lines []string) []string {
	var names []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) < 3 {
			continue
		}

		devanagariCount := 0
		for _, r := range line {
			if r >= '\u0900' && r <= '\u097F' {
				devanagariCount++
			}
		}
		totalChars := len([]rune(line))
		if totalChars == 0 {
			continue
		}

		if float64(devanagariCount)/float64(totalChars) > 0.6 {
			rlen := len([]rune(line))
			if rlen >= 4 && rlen <= 40 {
				names = append(names, line)
			}
		}
	}
	return names
}

func normalizeHyphen(s string) string {
	return strings.ReplaceAll(s, "–", "-")
}

func parseMRZDate(mrzDate string) string {
	if len(mrzDate) != 6 {
		return ""
	}
	yy := mrzDate[0:2]
	mm := mrzDate[2:4]
	dd := mrzDate[4:6]

	var yyInt int
	_, _ = fmt.Sscanf(yy, "%d", &yyInt)
	if yyInt < 30 {
		return fmt.Sprintf("20%s/%s/%s", yy, mm, dd)
	}
	return fmt.Sprintf("19%s/%s/%s", yy, mm, dd)
}

func emptyFields(docType string) interface{} {
	switch docType {
	case "CITIZENSHIP":
		return &CitizenshipFields{Confidence: map[string]int{}, OverallConfidence: 0}
	case "PASSPORT":
		return &PassportFields{Confidence: map[string]int{}}
	case "NID":
		return &NIDFields{Confidence: map[string]int{}}
	case "DRIVING_LICENSE":
		return &DrivingLicenseFields{Confidence: map[string]int{}}
	default:
		return map[string]interface{}{"raw_fields": map[string]string{}}
	}
}

// POST /auth/ocr/validate
// Android calls this after user confirms/corrects OCR fields.
func ValidateOCRResult(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			OriginalFields  interface{} `json:"original_fields"`
			CorrectedFields interface{} `json:"corrected_fields"`
			DocumentType    string      `json:"document_type"`
			WasCorrect      bool        `json:"was_correct"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		docType := strings.ToUpper(strings.TrimSpace(req.DocumentType))
		if docType == "" {
			docType = "UNKNOWN"
		}

		origJSON, _ := json.Marshal(req.OriginalFields)
		corrJSON, _ := json.Marshal(req.CorrectedFields)

		auditOCR(db, docType+"_VALIDATED", string(corrJSON), 0, c.IP())

		if !req.WasCorrect {
			payload := fmt.Sprintf(`{"original":%s,"corrected":%s}`, string(origJSON), string(corrJSON))
			auditOCR(db, docType+"_CORRECTED", payload, -1, c.IP())
		}

		return c.JSON(fiber.Map{"success": true, "message": "Validation recorded"})
	}
}

func auditOCR(db *database.DB, documentType, extractedFields string, processingMs int, ipAddress string) {
	if db == nil || db.Pool == nil {
		return
	}
	_, _ = db.Pool.Exec(context.Background(), `
		INSERT INTO ocr_audit (document_type, extracted_fields, processing_ms, ip_address)
		VALUES ($1, $2, $3, $4)
	`, documentType, extractedFields, processingMs, ipAddress)
}

func buildNormalizedAutofill(docType string, fields interface{}) map[string]string {
	result := map[string]string{
		"nid":            "",
		"citizenship_no": "",
		"full_name":      "",
		"dob":            "",
		"gender":         "",
		"father_name":    "",
		"mother_name":    "",
		"district":       "",
		"ward":           "",
		"passport_no":    "",
		"license_no":     "",
	}

	m := toStringMap(fields)
	if len(m) == 0 {
		return result
	}

	get := func(key string) string {
		v, _ := m[key].(string)
		return strings.TrimSpace(v)
	}

	switch docType {
	case "CITIZENSHIP":
		result["citizenship_no"] = get("citizenship_no")
		result["full_name"] = ocrFirstNonEmpty(get("full_name_ne"), get("full_name_en"))
		result["dob"] = ocrFirstNonEmpty(get("dob_ne"), get("dob"))
		result["gender"] = get("gender")
		result["father_name"] = get("father_name_ne")
		result["mother_name"] = get("mother_name_ne")
		result["district"] = get("district_ne")
		result["ward"] = get("ward_no")
	case "NID":
		result["nid"] = get("nid_number")
		result["full_name"] = get("full_name")
		result["dob"] = get("dob")
		result["gender"] = get("gender")
	case "PASSPORT":
		result["passport_no"] = get("passport_no")
		result["full_name"] = strings.TrimSpace(ocrFirstNonEmpty(get("surname"), "") + " " + ocrFirstNonEmpty(get("given_names"), ""))
		result["dob"] = get("dob")
		result["gender"] = get("sex")
		result["district"] = get("place_of_birth")
	case "DRIVING_LICENSE":
		result["license_no"] = get("license_no")
		result["full_name"] = get("full_name")
		result["dob"] = get("dob")
	}

	return result
}

func toStringMap(v interface{}) map[string]interface{} {
	if v == nil {
		return map[string]interface{}{}
	}
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	b, err := json.Marshal(v)
	if err != nil {
		return map[string]interface{}{}
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return map[string]interface{}{}
	}
	return m
}

func ocrFirstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
