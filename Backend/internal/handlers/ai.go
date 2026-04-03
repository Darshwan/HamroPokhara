package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"

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

// TranslateText handles POST /ai/translate
// Translates notice text between English and Nepali
func TranslateText(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			Text     string `json:"text"`
			FromLang string `json:"from_lang"` // "en" or "ne"
			ToLang   string `json:"to_lang"`   // "en" or "ne"
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "invalid request body"})
		}

		text := strings.TrimSpace(req.Text)
		if text == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "text is required"})
		}

		// Normalize language codes
		fromLang := "en"
		toLang := "ne"
		if strings.Contains(req.FromLang, "ne") {
			fromLang = "ne"
		}
		if strings.Contains(req.ToLang, "en") {
			toLang = "en"
		}

		// If target is same as detected source, swap
		if fromLang == toLang {
			toLang = map[string]string{"en": "ne", "ne": "en"}[toLang]
		}

		apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
		if apiKey == "" {
			// Template-based translation fallback
			return c.JSON(fiber.Map{
				"success":      true,
				"translated":   text, // Echo back as fallback
				"source":       "template",
				"from_lang":    fromLang,
				"to_lang":      toLang,
				"message":      "Translation completed (fallback mode)",
				"original_len": len(text),
			})
		}

		var systemPrompt string
		if toLang == "ne" {
			systemPrompt = "You are an expert translator. Translate the notice text to fluent, natural Nepali. Keep formatting and structure. Reply ONLY with the translated text, no explanations."
		} else {
			systemPrompt = "You are an expert translator. Translate the notice text to fluent, natural English. Keep formatting and structure. Reply ONLY with the translated text, no explanations."
		}

		userPrompt := fmt.Sprintf("Translate this notice to %s:\n\n%s",
			map[string]string{"ne": "नेपाली", "en": "English"}[toLang], text)

		translated, err := callClaude(apiKey, systemPrompt, userPrompt, 1024)
		source := "ai"
		if err != nil {
			// Fallback on error
			return c.JSON(fiber.Map{
				"success":      true,
				"translated":   text,
				"source":       "fallback",
				"from_lang":    fromLang,
				"to_lang":      toLang,
				"message":      "Translation service temporarily unavailable",
				"error":        err.Error(),
				"original_len": len(text),
			})
		}

		return c.JSON(fiber.Map{
			"success":        true,
			"original":       text,
			"translated":     translated,
			"source":         source,
			"from_lang":      fromLang,
			"to_lang":        toLang,
			"message":        "Translation completed",
			"original_len":   len(text),
			"translated_len": len(translated),
		})
	}
}

type transcriptionStreamClientMessage struct {
	Type        string `json:"type"`
	SessionID   string `json:"session_id,omitempty"`
	ChunkIndex  int    `json:"chunk_index,omitempty"`
	AudioBase64 string `json:"audio_base64,omitempty"`
	MimeType    string `json:"mime_type,omitempty"`
	Final       bool   `json:"final,omitempty"`
}

type transcriptionStreamServerMessage struct {
	Type                 string `json:"type"`
	SessionID            string `json:"session_id,omitempty"`
	ChunkIndex           int    `json:"chunk_index,omitempty"`
	Transcript           string `json:"transcript,omitempty"`
	CumulativeTranscript string `json:"cumulative_transcript,omitempty"`
	Complete             bool   `json:"complete,omitempty"`
	Source               string `json:"source,omitempty"`
	Error                string `json:"error,omitempty"`
}

// TranscribeNepaliAudio handles POST /ai/transcribe/nepali.
// It accepts either a single uploaded chunk or a buffered list of base64 chunks.
// When final=true, it returns final_transcript assembled from all buffered chunks.
func TranscribeNepaliAudio() fiber.Handler {
	return func(c *fiber.Ctx) error {
		traceID := fmt.Sprintf("stt-%d", time.Now().UnixNano())
		finalFlag := parseFormBool(c.FormValue("final"))
		log.Printf("[STT][%s] request start ip=%s final=%v content_type=%s session_id=%s chunk_index=%s", traceID, c.IP(), finalFlag, c.Get("Content-Type"), c.FormValue("session_id"), c.FormValue("chunk_index"))

		result, err := transcribeNepaliAudioFromRequest(c, traceID)
		if err != nil {
			log.Printf("[STT][%s] request failed: %v", traceID, err)
			if isTranscriptionUnavailable(err) {
				log.Printf("[STT][%s] returning offline response final=%v", traceID, finalFlag)
				return c.Status(200).JSON(transcriptionUnavailableResponse(err.Error(), finalFlag))
			}

			return c.Status(400).JSON(fiber.Map{"success": false, "message": err.Error()})
		}

		log.Printf("[STT][%s] request complete final=%v transcript_len=%d final_transcript_len=%d chunks=%d", traceID, result.Final, len(result.Transcript), len(result.FinalTranscript), len(result.ChunkTranscripts))

		response := fiber.Map{
			"success":           true,
			"transcript":        result.Transcript,
			"final_transcript":  result.FinalTranscript,
			"chunk_transcripts": result.ChunkTranscripts,
			"final":             result.Final,
			"source":            "openai-whisper",
		}

		return c.JSON(response)
	}
}

// TranscribeNepaliAudioStream handles websocket streaming for dictation.
// The client sends short audio chunks and receives interim transcript updates.
func TranscribeNepaliAudioStream() fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		sessionID := fmt.Sprintf("stt-%d", time.Now().UnixNano())
		cumulative := ""
		log.Printf("[STT-WS][%s] websocket connected", sessionID)

		_ = c.WriteJSON(transcriptionStreamServerMessage{
			Type:      "ready",
			SessionID: sessionID,
			Source:    "openai-whisper",
		})

		for {
			messageType, payload, err := c.ReadMessage()
			if err != nil {
				log.Printf("[STT-WS][%s] websocket read closed: %v", sessionID, err)
				return
			}

			if messageType != websocket.TextMessage {
				continue
			}

			var incoming transcriptionStreamClientMessage
			if err := json.Unmarshal(payload, &incoming); err != nil {
				log.Printf("[STT-WS][%s] invalid message payload: %v", sessionID, err)
				_ = c.WriteJSON(transcriptionStreamServerMessage{
					Type:  "error",
					Error: "invalid transcription message",
				})
				continue
			}

			log.Printf("[STT-WS][%s] message received type=%s chunk_index=%d final=%v audio_base64_len=%d mime_type=%s", sessionID, incoming.Type, incoming.ChunkIndex, incoming.Final, len(incoming.AudioBase64), incoming.MimeType)

			switch strings.ToLower(strings.TrimSpace(incoming.Type)) {
			case "start":
				if incoming.SessionID != "" {
					sessionID = incoming.SessionID
				}
				log.Printf("[STT-WS][%s] session started", sessionID)
				_ = c.WriteJSON(transcriptionStreamServerMessage{
					Type:      "started",
					SessionID: sessionID,
					Source:    "openai-whisper",
				})
			case "chunk":
				chunkBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(incoming.AudioBase64))
				if err != nil {
					log.Printf("[STT-WS][%s] chunk decode failed chunk_index=%d: %v", sessionID, incoming.ChunkIndex, err)
					_ = c.WriteJSON(transcriptionStreamServerMessage{
						Type:  "error",
						Error: "invalid audio chunk",
					})
					continue
				}
				log.Printf("[STT-WS][%s] chunk decoded chunk_index=%d bytes=%d", sessionID, incoming.ChunkIndex, len(chunkBytes))

				transcript, err := transcribeNepaliAudioBytes(chunkBytes, incoming.MimeType)
				if err != nil {
					log.Printf("[STT-WS][%s] chunk transcription failed chunk_index=%d: %v", sessionID, incoming.ChunkIndex, err)
					_ = c.WriteJSON(transcriptionStreamServerMessage{
						Type:  "error",
						Error: err.Error(),
					})
					continue
				}

				transcript = strings.TrimSpace(transcript)
				log.Printf("[STT-WS][%s] chunk transcription complete chunk_index=%d transcript_len=%d", sessionID, incoming.ChunkIndex, len(transcript))
				if transcript != "" {
					if cumulative != "" {
						cumulative += " "
					}
					cumulative += transcript
				}
				log.Printf("[STT-WS][%s] cumulative transcript len=%d", sessionID, len(cumulative))

				_ = c.WriteJSON(transcriptionStreamServerMessage{
					Type:                 "interim",
					SessionID:            sessionID,
					ChunkIndex:           incoming.ChunkIndex,
					Transcript:           transcript,
					CumulativeTranscript: cumulative,
					Complete:             false,
					Source:               "openai-whisper",
				})
			case "stop":
				log.Printf("[STT-WS][%s] stop received final_transcript_len=%d", sessionID, len(cumulative))
				_ = c.WriteJSON(transcriptionStreamServerMessage{
					Type:                 "final",
					SessionID:            sessionID,
					Transcript:           cumulative,
					CumulativeTranscript: cumulative,
					Complete:             true,
					Source:               "openai-whisper",
				})
				return
			}

			if incoming.Final {
				log.Printf("[STT-WS][%s] final flag received final_transcript_len=%d", sessionID, len(cumulative))
				_ = c.WriteJSON(transcriptionStreamServerMessage{
					Type:                 "final",
					SessionID:            sessionID,
					Transcript:           cumulative,
					CumulativeTranscript: cumulative,
					Complete:             true,
					Source:               "openai-whisper",
				})
				return
			}
		}
	})
}

type transcriptionResult struct {
	Transcript       string
	FinalTranscript  string
	ChunkTranscripts []string
	Final            bool
}

var errTranscriptionUnavailable = errors.New("transcription unavailable")

func transcribeNepaliAudioFromRequest(c *fiber.Ctx, traceID string) (*transcriptionResult, error) {
	finalFlag := parseFormBool(c.FormValue("final"))
	log.Printf("[STT][%s] parsing request final=%v session_id=%s chunk_index=%s buffered_audio_present=%v audio_base64_present=%v", traceID, finalFlag, c.FormValue("session_id"), c.FormValue("chunk_index"), strings.TrimSpace(c.FormValue("buffered_audio_base64")) != "", strings.TrimSpace(c.FormValue("audio_base64")) != "")
	bufferedChunks, err := parseBufferedAudioBase64(c.FormValue("buffered_audio_base64"))
	if err != nil {
		log.Printf("[STT][%s] buffered chunk parse failed: %v", traceID, err)
		return nil, err
	}
	log.Printf("[STT][%s] buffered chunk count=%d", traceID, len(bufferedChunks))

	if len(bufferedChunks) > 0 {
		result, err := transcribeNepaliBufferedChunks(bufferedChunks, finalFlag, traceID)
		if err != nil {
			log.Printf("[STT][%s] buffered transcription failed: %v", traceID, err)
			return nil, err
		}
		log.Printf("[STT][%s] buffered transcription complete transcript_len=%d final_transcript_len=%d", traceID, len(result.Transcript), len(result.FinalTranscript))
		return result, nil
	}

	if audioBase64 := strings.TrimSpace(c.FormValue("audio_base64")); audioBase64 != "" {
		log.Printf("[STT][%s] base64 audio payload detected len=%d", traceID, len(audioBase64))
		transcript, err := transcribeNepaliAudioBytesFromBase64(audioBase64, c.FormValue("mime_type"))
		if err != nil {
			log.Printf("[STT][%s] base64 transcription failed: %v", traceID, err)
			return nil, err
		}
		log.Printf("[STT][%s] base64 transcription complete transcript_len=%d", traceID, len(transcript))
		return &transcriptionResult{
			Transcript:       transcript,
			FinalTranscript:  transcript,
			ChunkTranscripts: []string{transcript},
			Final:            finalFlag,
		}, nil
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		log.Printf("[STT][%s] no audio source found", traceID)
		return nil, fmt.Errorf("audio file or buffered_audio_base64 is required")
	}
	log.Printf("[STT][%s] uploaded file detected filename=%s size=%d content_type=%s", traceID, fileHeader.Filename, fileHeader.Size, fileHeader.Header.Get("Content-Type"))

	file, err := fileHeader.Open()
	if err != nil {
		log.Printf("[STT][%s] unable to open uploaded audio: %v", traceID, err)
		return nil, fmt.Errorf("unable to open uploaded audio")
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		log.Printf("[STT][%s] unable to read uploaded audio: %v", traceID, err)
		return nil, fmt.Errorf("unable to read uploaded audio")
	}
	log.Printf("[STT][%s] uploaded audio bytes read=%d", traceID, len(data))

	transcript, err := transcribeNepaliAudioBytes(data, fileHeader.Header.Get("Content-Type"))
	if err != nil {
		log.Printf("[STT][%s] file transcription failed: %v", traceID, err)
		return nil, err
	}
	log.Printf("[STT][%s] file transcription complete transcript_len=%d", traceID, len(transcript))

	return &transcriptionResult{
		Transcript:       transcript,
		FinalTranscript:  transcript,
		ChunkTranscripts: []string{transcript},
		Final:            finalFlag,
	}, nil
}

func transcribeNepaliBufferedChunks(chunks []string, finalFlag bool, traceID string) (*transcriptionResult, error) {
	chunkTranscripts := make([]string, 0, len(chunks))
	for index, encoded := range chunks {
		encoded = strings.TrimSpace(encoded)
		if encoded == "" {
			log.Printf("[STT][%s] buffered chunk skipped index=%d reason=empty", traceID, index)
			continue
		}

		log.Printf("[STT][%s] buffered chunk start index=%d encoded_len=%d", traceID, index, len(encoded))
		transcript, err := transcribeNepaliAudioBytesFromBase64(encoded, "")
		if err != nil {
			log.Printf("[STT][%s] buffered chunk failed index=%d: %v", traceID, index, err)
			return nil, err
		}
		log.Printf("[STT][%s] buffered chunk complete index=%d transcript_len=%d", traceID, index, len(strings.TrimSpace(transcript)))
		if trimmed := strings.TrimSpace(transcript); trimmed != "" {
			chunkTranscripts = append(chunkTranscripts, trimmed)
		}
	}

	finalTranscript := strings.TrimSpace(strings.Join(chunkTranscripts, " "))
	if !finalFlag {
		if len(chunkTranscripts) > 0 {
			finalTranscript = chunkTranscripts[len(chunkTranscripts)-1]
		}
	}
	log.Printf("[STT][%s] buffered final assembly final=%v chunk_count=%d final_transcript_len=%d", traceID, finalFlag, len(chunkTranscripts), len(finalTranscript))

	return &transcriptionResult{
		Transcript:       finalTranscript,
		FinalTranscript:  finalTranscript,
		ChunkTranscripts: chunkTranscripts,
		Final:            finalFlag,
	}, nil
}

func transcribeNepaliAudioBytesFromBase64(audioBase64, mimeType string) (string, error) {
	audioBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(audioBase64))
	if err != nil {
		return "", fmt.Errorf("invalid base64 audio payload")
	}
	return transcribeNepaliAudioBytes(audioBytes, mimeType)
}

func parseFormBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "final":
		return true
	default:
		return false
	}
}

func parseBufferedAudioBase64(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var chunks []string
	if err := json.Unmarshal([]byte(raw), &chunks); err == nil {
		return chunks, nil
	}

	if strings.HasPrefix(raw, "[") && strings.HasSuffix(raw, "]") {
		return nil, fmt.Errorf("buffered_audio_base64 is invalid")
	}

	return []string{raw}, nil
}

func transcribeNepaliAudioBytes(audioBytes []byte, mimeType string) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		log.Printf("[STT] transcription unavailable: OPENAI_API_KEY missing")
		return "", fmt.Errorf("%w: OPENAI_API_KEY is not configured", errTranscriptionUnavailable)
	}

	model := strings.TrimSpace(os.Getenv("OPENAI_TRANSCRIBE_MODEL"))
	if model == "" {
		model = "whisper-1"
	}

	contentType := strings.TrimSpace(mimeType)
	if contentType == "" {
		contentType = "audio/m4a"
	}
	log.Printf("[STT] upstream transcription start audio_bytes=%d mime_type=%s model=%s", len(audioBytes), contentType, model)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("model", model); err != nil {
		return "", err
	}
	if err := writer.WriteField("language", "ne"); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("file", "chunk.m4a")
	if err != nil {
		return "", err
	}
	if _, err := part.Write(audioBytes); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.openai.com/v1/audio/transcriptions", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Accept", "application/json")
	req.Header.Set("OpenAI-Organization", strings.TrimSpace(os.Getenv("OPENAI_ORG_ID")))
	_ = contentType

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[STT] upstream transcription request failed: %v", err)
		return "", fmt.Errorf("%w: transcription request failed: %w", errTranscriptionUnavailable, err)
	}
	defer resp.Body.Close()
	log.Printf("[STT] upstream transcription response status=%s", resp.Status)

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[STT] upstream transcription non-2xx body_len=%d body=%s", len(bodyBytes), strings.TrimSpace(string(bodyBytes)))
		return "", fmt.Errorf("%w: transcription failed: %s", errTranscriptionUnavailable, strings.TrimSpace(string(bodyBytes)))
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[STT] upstream transcription decode failed: %v", err)
		return "", fmt.Errorf("%w: unable to parse transcription response: %w", errTranscriptionUnavailable, err)
	}
	log.Printf("[STT] upstream transcription complete text_len=%d", len(strings.TrimSpace(result.Text)))

	return strings.TrimSpace(result.Text), nil
}

func isTranscriptionUnavailable(err error) bool {
	return errors.Is(err, errTranscriptionUnavailable)
}

func transcriptionUnavailableResponse(message string, finalFlag bool) fiber.Map {
	return fiber.Map{
		"success":           false,
		"offline":           true,
		"final":             finalFlag,
		"transcript":        "",
		"final_transcript":  "",
		"chunk_transcripts": []string{},
		"source":            "unavailable",
		"message":           message,
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
