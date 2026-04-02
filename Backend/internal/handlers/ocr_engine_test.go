package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
)

func TestProcessDocumentOCR_AllDocumentTypes(t *testing.T) {
	t.Setenv("GOOGLE_VISION_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")

	app := fiber.New()
	app.Post("/auth/ocr", ProcessDocumentOCR(&database.DB{}))

	tests := []struct {
		name          string
		documentType  string
		extractedText string
	}{
		{
			name:          "citizenship payload",
			documentType:  "CITIZENSHIP",
			extractedText: "नाम: राजेश कुमार\nनागरिकता नं: 12-34-56-78901\nजन्म मिति: 2042/03/15\nलिङ्ग: पुरुष\nबाबु: राम कुमार",
		},
		{
			name:          "nid payload",
			documentType:  "NID",
			extractedText: "राष्ट्रिय परिचयपत्र\n12345678901\nराम बहादुर\nपुरुष\n1992/12/05",
		},
		{
			name:          "driving license payload",
			documentType:  "DRIVING_LICENSE",
			extractedText: "Nepal Driving License\nLicense No: 01-02-123456\nName: Sita Gurung\nIssue: 2023/01/01",
		},
		{
			name:          "passport payload",
			documentType:  "PASSPORT",
			extractedText: "Passport No: PA1234567\nNationality: NPL\nP<NPLDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nA12345678NPL9001011M3001012<<<<<<<<<<<<<<00",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]interface{}{
				"document_type":  tt.documentType,
				"extracted_text": tt.extractedText,
			}
			resp := postJSON(t, app, "/auth/ocr", body)
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var out map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
				t.Fatalf("decode response: %v", err)
			}

			if success, _ := out["success"].(bool); !success {
				t.Fatalf("expected success=true, got %+v", out)
			}

			if gotType, _ := out["document_type"].(string); gotType != tt.documentType {
				t.Fatalf("expected document_type=%s, got %q", tt.documentType, gotType)
			}

			if source, _ := out["source"].(string); source != "ocr_parsed" {
				t.Fatalf("expected source=ocr_parsed, got %q", source)
			}

			if _, ok := out["fields"].(map[string]interface{}); !ok {
				t.Fatalf("expected fields object, got %+v", out["fields"])
			}

			norm, ok := out["normalized_fields"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected normalized_fields object, got %+v", out["normalized_fields"])
			}

			if _, ok := out["stored"].(bool); !ok {
				t.Fatalf("expected stored boolean in response")
			}

			if _, ok := out["autofill_ready"].(bool); !ok {
				t.Fatalf("expected autofill_ready boolean in response")
			}

			switch tt.documentType {
			case "CITIZENSHIP":
				if v, _ := norm["citizenship_no"].(string); v == "" {
					t.Fatalf("expected normalized citizenship_no for CITIZENSHIP")
				}
			case "NID":
				if v, _ := norm["nid"].(string); v == "" {
					t.Fatalf("expected normalized nid for NID")
				}
			case "PASSPORT":
				if v, _ := norm["passport_no"].(string); v == "" {
					t.Fatalf("expected normalized passport_no for PASSPORT")
				}
			case "DRIVING_LICENSE":
				if v, _ := norm["license_no"].(string); v == "" {
					t.Fatalf("expected normalized license_no for DRIVING_LICENSE")
				}
			}

			if requiresVerification, _ := out["requires_verification"].(bool); !requiresVerification {
				t.Fatalf("expected requires_verification=true")
			}
		})
	}
}

func TestValidateOCRResult_RecordsCorrection(t *testing.T) {
	app := fiber.New()
	app.Post("/auth/ocr/validate", ValidateOCRResult(&database.DB{}))

	body := map[string]interface{}{
		"document_type": "CITIZENSHIP",
		"was_correct":   false,
		"original_fields": map[string]interface{}{
			"full_name_ne": "राजेस",
		},
		"corrected_fields": map[string]interface{}{
			"full_name_ne": "राजेश",
		},
	}

	resp := postJSON(t, app, "/auth/ocr/validate", body)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var out map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if success, _ := out["success"].(bool); !success {
		t.Fatalf("expected success=true, got %+v", out)
	}
}

func postJSON(t *testing.T, app *fiber.App, path string, payload interface{}) *http.Response {
	t.Helper()

	buf, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app test request failed: %v", err)
	}
	return resp
}
