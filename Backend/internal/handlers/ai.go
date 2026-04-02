package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/database"
	"pratibimba/internal/models"
)

type aiSuggestion struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	LabelNE string `json:"label_ne"`
	Prompt  string `json:"prompt"`
}

// ExpandPurpose returns a handler for expanding short purpose text into formal text.
func ExpandPurpose(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			Purpose      string `json:"purpose"`
			DocumentType string `json:"document_type"`
			CitizenName  string `json:"citizen_name"`
			Language     string `json:"language"` // "ne" | "en"
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}
		if strings.TrimSpace(req.Purpose) == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "purpose is required"})
		}
		if req.Language == "" {
			req.Language = "ne"
		}

		var systemPrompt, userPrompt string
		if req.Language == "ne" {
			systemPrompt = "You are a government document expert. Expand a short Nepali purpose into a formal statement in Nepali. Keep it clear and under 40 words."
			userPrompt = fmt.Sprintf("Document type: %s\nCitizen: %s\nPurpose: %s", req.DocumentType, req.CitizenName, req.Purpose)
		} else {
			systemPrompt = "You are a government document expert. Expand a short purpose into a formal statement in English. Keep it clear and under 40 words."
			userPrompt = fmt.Sprintf("Document type: %s\nCitizen: %s\nPurpose: %s", req.DocumentType, req.CitizenName, req.Purpose)
		}

		apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
		if apiKey == "" {
			return c.JSON(fiber.Map{
				"success":  true,
				"expanded": expandWithoutAI(req.Purpose, req.DocumentType, req.CitizenName, req.Language),
				"source":   "template",
			})
		}

		expanded, err := callClaude(apiKey, systemPrompt, userPrompt, 200)
		if err != nil {
			return c.JSON(fiber.Map{
				"success":  true,
				"expanded": expandWithoutAI(req.Purpose, req.DocumentType, req.CitizenName, req.Language),
				"source":   "template",
			})
		}

		return c.JSON(fiber.Map{"success": true, "expanded": expanded, "source": "ai"})
	}
}

// GovernmentAssistant handles citizen questions with Claude fallback templates.
func GovernmentAssistant(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			Message     string `json:"message"`
			Question    string `json:"question"`
			Query       string `json:"query"`
			Language    string `json:"language"` // ne | en | auto
			Topic       string `json:"topic"`
			SessionID   string `json:"session_id"`
			CitizenNID  string `json:"citizen_nid"`
			CitizenName string `json:"citizen_name"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		message := firstNonEmptyString(req.Message, req.Question, req.Query)
		message = strings.TrimSpace(message)
		if message == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "message is required"})
		}

		language := normalizeAILanguage(req.Language, message)
		topic := detectAITopic(req.Topic, message)
		suggestions := assistantSuggestions(language)
		answer := templateAssistantAnswer(topic, language, message, req.CitizenName)
		source := "template"
		modelName := ""

		if apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY")); apiKey != "" {
			systemPrompt := assistantSystemPrompt(language)
			userPrompt := assistantUserPrompt(language, topic, message)
			if aiAnswer, err := callClaude(apiKey, systemPrompt, userPrompt, 500); err == nil {
				aiAnswer = strings.TrimSpace(aiAnswer)
				if aiAnswer != "" {
					answer = aiAnswer
					source = "ai"
					modelName = "claude-sonnet-4-5"
				}
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if db != nil {
			_ = db.InsertAIChatLog(ctx, &models.AIChatLog{
				SessionID:  req.SessionID,
				CitizenNID: req.CitizenNID,
				Query:      message,
				Response:   answer,
				Language:   language,
				CreatedAt:  time.Now().UTC(),
			})
		}

		return c.JSON(fiber.Map{
			"success":     true,
			"language":    language,
			"category":    topic,
			"source":      source,
			"model":       modelName,
			"answer":      answer,
			"suggestions": suggestions,
		})
	}
}

// AssistantSuggestions returns quick-suggest button definitions.
func AssistantSuggestions() fiber.Handler {
	return func(c *fiber.Ctx) error {
		language := normalizeAILanguage(c.Query("language"), c.Query("q"))
		return c.JSON(fiber.Map{
			"success":     true,
			"language":    language,
			"suggestions": assistantSuggestions(language),
		})
	}
}

func callClaude(apiKey, system, user string, maxTokens int) (string, error) {
	payload := map[string]interface{}{
		"model":      "claude-sonnet-4-5",
		"max_tokens": maxTokens,
		"system":     system,
		"messages": []map[string]string{{
			"role":    "user",
			"content": user,
		}},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("anthropic error status: %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	for _, part := range result.Content {
		if part.Type == "text" {
			return strings.TrimSpace(part.Text), nil
		}
	}

	return "", fmt.Errorf("no text content in anthropic response")
}

func assistantSystemPrompt(lang string) string {
	if lang == "ne" {
		return strings.TrimSpace(`
You are Pratibimba's AI Government Assistant for Nepali citizens.
Answer in clear, natural Nepali.
Focus on public-service guidance for building permits, citizenship, sifaris, taxes, queues, grievances, and office process.
Be concise, practical, and step-by-step.
If the question needs official verification or legal judgment, tell the user to contact the relevant ward office.
Do not invent fees, laws, or approvals.
`)
	}

	return strings.TrimSpace(`
You are Pratibimba's AI Government Assistant for Nepali citizens.
Answer in clear, natural English.
Focus on public-service guidance for building permits, citizenship, sifaris, taxes, queues, grievances, and office process.
Be concise, practical, and step-by-step.
If the question needs official verification or legal judgment, tell the user to contact the relevant ward office.
Do not invent fees, laws, or approvals.
`)
}

func assistantUserPrompt(lang, topic, message string) string {
	if lang == "ne" {
		return fmt.Sprintf("Topic: %s\nCitizen question: %s\nRespond in Nepali. Give a helpful answer with 3-5 short bullet points if useful.", topic, message)
	}
	return fmt.Sprintf("Topic: %s\nCitizen question: %s\nRespond in English. Give a helpful answer with 3-5 short bullet points if useful.", topic, message)
}

func assistantSuggestions(lang string) []aiSuggestion {
	if lang == "ne" {
		return []aiSuggestion{
			{ID: "building_permit", Label: "भवन अनुमति", LabelNE: "भवन निर्माण अनुमति कसरी लिने?", Prompt: "भवन निर्माण अनुमति लिन के कागजात चाहिन्छ?"},
			{ID: "citizenship", Label: "नागरिकता", LabelNE: "नागरिकताको प्रक्रिया के हो?", Prompt: "नागरिकता बनाउन के प्रक्रिया हुन्छ?"},
			{ID: "sifaris", Label: "सिफारिस", LabelNE: "सिफारिस कसरी माग्ने?", Prompt: "सिफारिस पत्र कसरी लिन सकिन्छ?"},
			{ID: "tax_clearance", Label: "कर चुक्ता", LabelNE: "कर चुक्ता कसरी गर्ने?", Prompt: "कर चुक्ता प्रमाणपत्र कसरी निकाल्ने?"},
			{ID: "queue", Label: "लाइन टोकन", LabelNE: "लाइन टोकन कसरी बुक गर्ने?", Prompt: "सेवा लिन लाइन टोकन कसरी बुक गर्ने?"},
		}
	}

	return []aiSuggestion{
		{ID: "building_permit", Label: "Building permit", LabelNE: "भवन निर्माण अनुमति", Prompt: "What documents do I need for a building permit?"},
		{ID: "citizenship", Label: "Citizenship", LabelNE: "नागरिकता", Prompt: "What is the citizenship application process?"},
		{ID: "sifaris", Label: "Sifaris letter", LabelNE: "सिफारिस", Prompt: "How do I get a sifaris letter?"},
		{ID: "tax_clearance", Label: "Tax clearance", LabelNE: "कर चुक्ता", Prompt: "How do I apply for tax clearance?"},
		{ID: "queue", Label: "Queue token", LabelNE: "लाइन टोकन", Prompt: "How do I book a queue token?"},
	}
}

func detectAITopic(explicitTopic, message string) string {
	if explicitTopic != "" {
		return strings.ToLower(strings.TrimSpace(explicitTopic))
	}

	text := strings.ToLower(message)
	switch {
	case strings.Contains(text, "building permit") || strings.Contains(text, "construction") || strings.Contains(text, "house plan") || strings.Contains(text, "नक्सा") || strings.Contains(text, "भवन") || strings.Contains(text, "निर्माण") || strings.Contains(text, "permit"):
		return "building_permit"
	case strings.Contains(text, "citizenship") || strings.Contains(text, "national id") || strings.Contains(text, "nid") || strings.Contains(text, "नागरिकता") || strings.Contains(text, "प्रमाणपत्र"):
		return "citizenship"
	case strings.Contains(text, "sifaris") || strings.Contains(text, "recommendation") || strings.Contains(text, "सिफारिस"):
		return "sifaris"
	case strings.Contains(text, "tax clearance") || strings.Contains(text, "कर") || strings.Contains(text, "चुक्ता"):
		return "tax_clearance"
	case strings.Contains(text, "queue") || strings.Contains(text, "token") || strings.Contains(text, "लाइन") || strings.Contains(text, "टोकन"):
		return "queue"
	default:
		return "general"
	}
}

func templateAssistantAnswer(topic, lang, message, citizenName string) string {
	if lang == "ne" {
		switch topic {
		case "building_permit":
			return strings.TrimSpace(`भवन निर्माण अनुमति लिन सामान्यतया यी चरणहरू पालना गर्नुहोस्:
1) नक्सा/ड्रइङ तयार गर्नुहोस्
2) जग्गा कागजात, नागरिकता, कर तिरेको रसिद, र आवश्यक फारम संलग्न गर्नुहोस्
3) वडा कार्यालय वा सम्बन्धित प्राविधिक शाखामा बुझाउनुहोस्
4) प्राविधिक जाँचपछि अनुमति/सुझाव प्राप्त गर्नुहोस्`)
		case "citizenship":
			return strings.TrimSpace(`नागरिकता सम्बन्धी कामका लागि प्रायः नागरिकता, जन्म/विवाह कागजात, फोटो, र अभिभावक सम्बन्धित प्रमाण चाहिन्छ।
यदि तपाईँलाई नयाँ नागरिकता, प्रतिलिपि, वा संशोधन चाहिएको हो भने सम्बन्धित वडा कार्यालयमा कागजात जाँच गराएर बुझाउनुहोस्।`)
		case "sifaris":
			return strings.TrimSpace(`सिफारिस पत्रका लागि सामान्यतया निवेदन, नागरिकता/पहिचान कागजात, र आवश्यक समर्थन कागजात चाहिन्छ।
कार्यालयले तपाईंको कारण र प्रमाण हेरेर सिफारिस जारी गर्छ।`)
		case "tax_clearance":
			return strings.TrimSpace(`कर चुक्ता प्रमाणपत्रका लागि तपाईंले आफ्नो कर विवरण र तिरेको रसिद बुझाउनुपर्छ।
यदि विवरण मिल्छ भने कार्यालयले प्रमाणपत्र जारी गर्छ।`)
		case "queue":
			return strings.TrimSpace(`लाइन टोकन वा अपोइन्टमेन्टका लागि उपलब्ध सेवा छनोट गर्नुहोस्, आवश्यक विवरण भर्नुहोस्, र समय बुक गर्नुहोस्।
बुकिङ सफल भएपछि टोकन नम्बर सुरक्षित राख्नुहोस्।`)
		default:
			if strings.TrimSpace(citizenName) != "" {
				return fmt.Sprintf("%s, तपाईंको प्रश्नका लागि सम्बन्धित वडा कार्यालयमा आवश्यक कागजात सहित सम्पर्क गर्नुहोस्। म तपाईंलाई चाहिने प्रक्रिया वा कागजातहरूको सूची पनि दिन सक्छु।", citizenName)
			}
			return "तपाईंको प्रश्न बुझिएको छ। कृपया कुन सेवा चाहिएको हो भनेर स्पष्ट गर्नुहोस्, म प्रक्रिया र कागजातहरू बताइदिन्छु।"
		}
	}

	switch topic {
	case "building_permit":
		return strings.TrimSpace(`To get a building permit, usually follow these steps:
1) Prepare the building plan/drawing
2) Attach land documents, citizenship, tax receipts, and required forms
3) Submit it to the ward office or technical branch
4) Receive review feedback and permit approval after inspection`)
	case "citizenship":
		return strings.TrimSpace(`For citizenship-related work, you usually need citizenship or ID documents, birth/marriage records, photos, and parent-related proof.
If you need a new citizenship, duplicate copy, or correction, contact the relevant ward office with your documents.`)
	case "sifaris":
		return strings.TrimSpace(`For a sifaris letter, you usually need an application, identity document, and supporting papers for your request.
The office issues the letter after reviewing your purpose and documents.`)
	case "tax_clearance":
		return strings.TrimSpace(`For tax clearance, submit your tax details and proof of payment.
If the records match, the office can issue the clearance certificate.`)
	case "queue":
		return strings.TrimSpace(`For queue tokens or appointments, select the service, fill in the required details, and book a time slot.
After booking, keep the token number safe.`)
	default:
		if strings.TrimSpace(citizenName) != "" {
			return fmt.Sprintf("%s, please contact the relevant ward office with the required documents. I can also help you with the process or document checklist.", citizenName)
		}
		return "I understand your question. Please tell me which service you need, and I will explain the process and required documents."
	}
}

func normalizeAILanguage(requested, message string) string {
	lang := strings.ToLower(strings.TrimSpace(requested))
	if lang == "en" || lang == "ne" {
		return lang
	}

	for _, r := range message {
		if r >= 'अ' && r <= 'ह' {
			return "ne"
		}
	}
	return "en"
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func expandWithoutAI(purpose, docType, name, lang string) string {
	if lang == "ne" {
		templates := map[string]string{
			"SIFARIS":           fmt.Sprintf("%s लाई आधिकारिक प्रक्रियाका लागि सिफारिस आवश्यक छ।", name),
			"TAX_CLEARANCE":     fmt.Sprintf("%s लाई कर चुक्ता प्रमाणपत्र आवश्यक छ।", name),
			"BIRTH_CERTIFICATE": fmt.Sprintf("%s लाई जन्म दर्ता प्रमाण आवश्यक छ।", name),
			"INCOME_PROOF":      fmt.Sprintf("%s लाई आय प्रमाणपत्र आवश्यक छ।", name),
		}
		if t, ok := templates[strings.ToUpper(strings.TrimSpace(docType))]; ok {
			return t
		}
		return fmt.Sprintf("%s लाई %s प्रयोजनका लागि यो कागजात आवश्यक छ।", name, purpose)
	}

	return fmt.Sprintf("This is to certify that %s requires this document for %s purposes.", name, purpose)
}
