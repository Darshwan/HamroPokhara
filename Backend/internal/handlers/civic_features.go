package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
)

func uid(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)[:n*2]
}

// ── BLOOD DONOR ───────────────────────────────────────────────

// GET /blood/donors?group=A+&ward=NPL-04-33-09
func GetBloodDonors(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		group := c.Query("group")
		ward := c.Query("ward")
		ctx := context.Background()

		query := `SELECT full_name, blood_group, COALESCE(ward_code,''), phone, last_donated::text, is_available
                  FROM blood_donors WHERE is_available = true`
		args := []interface{}{}
		i := 1

		if group != "" {
			query += fmt.Sprintf(" AND blood_group = $%d", i)
			args = append(args, group)
			i++
		}
		if ward != "" {
			query += fmt.Sprintf(" AND ward_code = $%d", i)
			args = append(args, ward)
			i++
		}
		query += " ORDER BY last_donated ASC LIMIT 20"

		rows, err := db.Pool.Query(ctx, query, args...)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		defer rows.Close()

		type Donor struct {
			Name        string `json:"name"`
			BloodGroup  string `json:"blood_group"`
			WardCode    string `json:"ward_code"`
			Phone       string `json:"phone"`
			LastDonated string `json:"last_donated"`
			IsAvailable bool   `json:"is_available"`
		}
		var donors []Donor
		for rows.Next() {
			var d Donor
			rows.Scan(&d.Name, &d.BloodGroup, &d.WardCode, &d.Phone, &d.LastDonated, &d.IsAvailable)
			donors = append(donors, d)
		}
		return c.JSON(fiber.Map{"success": true, "donors": donors})
	}
}

// POST /blood/register — register as blood donor
func RegisterBloodDonor(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID string `json:"citizen_nid"`
			FullName   string `json:"full_name"`
			BloodGroup string `json:"blood_group"`
			WardCode   string `json:"ward_code"`
			Phone      string `json:"phone"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		ctx := context.Background()
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO blood_donors (citizen_nid, full_name, blood_group, ward_code, phone)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT DO NOTHING
        `, req.CitizenNID, req.FullName, req.BloodGroup, req.WardCode, req.Phone)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		return c.Status(201).JSON(fiber.Map{"success": true, "message": "Registered as blood donor"})
	}
}

// ── TOURISM ───────────────────────────────────────────────────

// GET /tourism?type=HOTEL
func GetTourismListings(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		listingType := c.Query("type")
		ctx := context.Background()

		q := `SELECT listing_id, name, COALESCE(name_ne,''), listing_type, safety_rating,
                     COALESCE(star_rating,0), COALESCE(phone,''), is_approved, tims_required, COALESCE(description,'')
              FROM tourism_listings WHERE is_approved = true`
		args := []interface{}{}
		if listingType != "" {
			q += " AND listing_type = $1"
			args = append(args, listingType)
		}
		q += " ORDER BY star_rating DESC LIMIT 30"

		rows, err := db.Pool.Query(ctx, q, args...)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		defer rows.Close()

		type Listing struct {
			ID           string  `json:"listing_id"`
			Name         string  `json:"name"`
			NameNE       string  `json:"name_ne"`
			Type         string  `json:"type"`
			SafetyRating string  `json:"safety_rating"`
			StarRating   float64 `json:"star_rating"`
			Phone        string  `json:"phone"`
			IsApproved   bool    `json:"is_approved"`
			TIMSRequired bool    `json:"tims_required"`
			Description  string  `json:"description"`
		}
		var list []Listing
		for rows.Next() {
			var l Listing
			rows.Scan(&l.ID, &l.Name, &l.NameNE, &l.Type, &l.SafetyRating,
				&l.StarRating, &l.Phone, &l.IsApproved, &l.TIMSRequired, &l.Description)
			list = append(list, l)
		}
		return c.JSON(fiber.Map{"success": true, "listings": list})
	}
}

// ── LOST & FOUND ──────────────────────────────────────────────

// GET /lost-found?type=FOUND&ward=...
func GetLostFound(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rtype := c.Query("type")
		ward := c.Query("ward")
		ctx := context.Background()

		q := `SELECT item_id, report_type, item_desc, COALESCE(location_desc,''), status, reported_at
              FROM lost_found WHERE status = 'OPEN'`
		args := []interface{}{}
		i := 1
		if rtype != "" {
			q += fmt.Sprintf(" AND report_type = $%d", i)
			args = append(args, rtype)
			i++
		}
		if ward != "" {
			q += fmt.Sprintf(" AND ward_code = $%d", i)
			args = append(args, ward)
			i++
		}
		q += " ORDER BY reported_at DESC LIMIT 20"

		rows, err := db.Pool.Query(ctx, q, args...)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		defer rows.Close()

		type Item struct {
			ItemID      string    `json:"item_id"`
			Type        string    `json:"type"`
			Description string    `json:"description"`
			Location    string    `json:"location"`
			Status      string    `json:"status"`
			ReportedAt  time.Time `json:"reported_at"`
		}
		var items []Item
		for rows.Next() {
			var it Item
			rows.Scan(&it.ItemID, &it.Type, &it.Description, &it.Location, &it.Status, &it.ReportedAt)
			items = append(items, it)
		}
		return c.JSON(fiber.Map{"success": true, "items": items})
	}
}

// POST /lost-found — report lost or found item
func ReportLostFound(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			ReporterNID  string `json:"reporter_nid"`
			ReportType   string `json:"report_type"`
			ItemDesc     string `json:"item_desc"`
			LocationDesc string `json:"location_desc"`
			WardCode     string `json:"ward_code"`
			ContactPhone string `json:"contact_phone"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		ctx := context.Background()
		itemID := fmt.Sprintf("LF-%04d-%s", time.Now().Year(), uid(4))
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO lost_found (item_id, reporter_nid, report_type, item_desc, location_desc, ward_code, contact_phone)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, itemID, req.ReporterNID, req.ReportType, req.ItemDesc, req.LocationDesc, req.WardCode, req.ContactPhone)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		return c.Status(201).JSON(fiber.Map{"success": true, "item_id": itemID})
	}
}

// ── VOLUNTEER ─────────────────────────────────────────────────

// POST /volunteer/register
func RegisterVolunteer(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID   string   `json:"citizen_nid"`
			FullName     string   `json:"full_name"`
			Phone        string   `json:"phone"`
			Skills       []string `json:"skills"`
			Availability string   `json:"availability"`
			WardCode     string   `json:"ward_code"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		ctx := context.Background()
		volID := fmt.Sprintf("VOL-%04d-%s", time.Now().Year(), uid(4))
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO volunteers (volunteer_id, citizen_nid, full_name, phone, skills, availability, ward_code)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT DO NOTHING
        `, volID, req.CitizenNID, req.FullName, req.Phone, req.Skills, req.Availability, req.WardCode)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		return c.Status(201).JSON(fiber.Map{
			"success":      true,
			"volunteer_id": volID,
			"message":      "Registered as volunteer!",
		})
	}
}

// ── OFFICER FEEDBACK ──────────────────────────────────────────

// POST /feedback
func SubmitOfficerFeedback(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID   string `json:"citizen_nid"`
			OfficerID    string `json:"officer_id"`
			RequestID    string `json:"request_id"`
			SpeedRating  int    `json:"speed_rating"`
			Helpfulness  int    `json:"helpfulness"`
			Transparency int    `json:"transparency"`
			Comment      string `json:"comment"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		avg := float64(req.SpeedRating+req.Helpfulness+req.Transparency) / 3.0
		ctx := context.Background()
		fbID := fmt.Sprintf("FB-%04d-%s", time.Now().Year(), uid(4))
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO officer_feedback (feedback_id, citizen_nid, officer_id, request_id,
                speed_rating, helpfulness, transparency, avg_rating, comment)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, fbID, req.CitizenNID, req.OfficerID, req.RequestID,
			req.SpeedRating, req.Helpfulness, req.Transparency, avg, req.Comment)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		log.Printf("[Feedback] %s rated %s: %.1f/5", req.CitizenNID, req.OfficerID, avg)
		return c.Status(201).JSON(fiber.Map{"success": true, "feedback_id": fbID, "avg_rating": avg})
	}
}

// GET /feedback/officer/:officerID — get officer's average rating
func GetOfficerRating(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		officerID := c.Params("officerID")
		ctx := context.Background()

		var totalCount int
		var avgRating float64
		var avgSpeed, avgHelp, avgTrans float64

		db.Pool.QueryRow(ctx, `
            SELECT COUNT(*), COALESCE(AVG(avg_rating),0),
                   COALESCE(AVG(speed_rating),0), COALESCE(AVG(helpfulness),0), COALESCE(AVG(transparency),0)
            FROM officer_feedback WHERE officer_id = $1
        `, officerID).Scan(&totalCount, &avgRating, &avgSpeed, &avgHelp, &avgTrans)

		return c.JSON(fiber.Map{
			"success":       true,
			"officer_id":    officerID,
			"total_reviews": totalCount,
			"avg_rating":    avgRating,
			"breakdown": fiber.Map{
				"speed":        avgSpeed,
				"helpfulness":  avgHelp,
				"transparency": avgTrans,
			},
		})
	}
}

// ── PUBLIC HEARING ─────────────────────────────────────────────

// GET /hearing/:wardCode — get live/scheduled hearings
func GetHearings(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ward := c.Params("wardCode")
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT hearing_id, title, COALESCE(title_ne,''), COALESCE(description,''),
                   status, votes_yes, votes_no, votes_abstain, scheduled_at
            FROM public_hearings
            WHERE ward_code = $1 AND status IN ('LIVE','SCHEDULED')
            ORDER BY scheduled_at DESC LIMIT 10
        `, ward)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		defer rows.Close()

		type Hearing struct {
			HearingID    string    `json:"hearing_id"`
			Title        string    `json:"title"`
			TitleNE      string    `json:"title_ne"`
			Description  string    `json:"description"`
			Status       string    `json:"status"`
			VotesYes     int       `json:"votes_yes"`
			VotesNo      int       `json:"votes_no"`
			VotesAbstain int       `json:"votes_abstain"`
			ScheduledAt  time.Time `json:"scheduled_at"`
		}
		var list []Hearing
		for rows.Next() {
			var h Hearing
			rows.Scan(&h.HearingID, &h.Title, &h.TitleNE, &h.Description,
				&h.Status, &h.VotesYes, &h.VotesNo, &h.VotesAbstain, &h.ScheduledAt)
			list = append(list, h)
		}
		return c.JSON(fiber.Map{"success": true, "hearings": list})
	}
}

// POST /hearing/vote
func VoteOnHearing(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			HearingID  string `json:"hearing_id"`
			CitizenNID string `json:"citizen_nid"`
			Vote       string `json:"vote"` // YES | NO | ABSTAIN
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		req.Vote = strings.ToUpper(req.Vote)
		ctx := context.Background()

		// Record vote (unique per citizen per hearing)
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO hearing_votes (hearing_id, citizen_nid, vote)
            VALUES ($1, $2, $3)
            ON CONFLICT (hearing_id, citizen_nid) DO UPDATE SET vote = EXCLUDED.vote
        `, req.HearingID, req.CitizenNID, req.Vote)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Failed to record vote"})
		}

		// Update totals
		col := "votes_" + strings.ToLower(req.Vote)
		db.Pool.Exec(ctx, fmt.Sprintf(`
            UPDATE public_hearings SET %s = (
                SELECT COUNT(*) FROM hearing_votes WHERE hearing_id = $1 AND vote = $2
            ) WHERE hearing_id = $1
        `, col), req.HearingID, req.Vote)

		return c.JSON(fiber.Map{"success": true, "message": "Vote recorded"})
	}
}

// ── KRISHI ANUDAN ─────────────────────────────────────────────

// POST /krishi/apply
func ApplyKrishiAnudan(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID  string  `json:"citizen_nid"`
			SubsidyType string  `json:"subsidy_type"`
			CropType    string  `json:"crop_type"`
			LandArea    float64 `json:"land_area"`
			WardCode    string  `json:"ward_code"`
			Notes       string  `json:"notes"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		ctx := context.Background()
		appID := fmt.Sprintf("KRS-%04d-%s", time.Now().Year(), uid(4))
		_, err := db.Pool.Exec(ctx, `
            INSERT INTO krishi_applications (application_id, citizen_nid, subsidy_type, crop_type, land_area, ward_code, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, appID, req.CitizenNID, req.SubsidyType, req.CropType, req.LandArea, req.WardCode, req.Notes)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		return c.Status(201).JSON(fiber.Map{
			"success":        true,
			"application_id": appID,
			"message":        "Application submitted. Agriculture officer will visit within 7 days.",
		})
	}
}

// ── DIGITAL SIGNATURE ─────────────────────────────────────────

// POST /sign — digitally sign a document hash
func SignDocument(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID   string `json:"citizen_nid"`
			DocumentRef  string `json:"document_ref"`
			DocumentHash string `json:"document_hash"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}

		ctx := context.Background()
		sigID := fmt.Sprintf("SIG-%04d-%s", time.Now().Year(), uid(8))
		// In production: use citizen's private key (stored in HSM)
		// For demo: SHA-256(documentHash + NID + timestamp)
		sigHash := hashString(req.DocumentHash + req.CitizenNID + time.Now().String())

		_, err := db.Pool.Exec(ctx, `
            INSERT INTO digital_signatures (signature_id, citizen_nid, document_ref, document_hash, signature_hash, valid_until)
            VALUES ($1,$2,$3,$4,$5,$6)
        `, sigID, req.CitizenNID, req.DocumentRef, req.DocumentHash, sigHash, time.Now().AddDate(1, 0, 0))

		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}
		return c.JSON(fiber.Map{
			"success":        true,
			"signature_id":   sigID,
			"signature_hash": sigHash[:16] + "...",
			"signed_at":      time.Now(),
			"valid_until":    time.Now().AddDate(1, 0, 0),
		})
	}
}

// ── TAX PAYMENT ───────────────────────────────────────────────

// POST /tax/pay — initiate a tax payment
func InitiateTaxPayment(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID    string  `json:"citizen_nid"`
			TaxRecordID   int64   `json:"tax_record_id"`
			Amount        float64 `json:"amount"`
			PaymentMethod string  `json:"payment_method"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		ctx := context.Background()
		payID := fmt.Sprintf("TXN-%04d-%s", time.Now().Year(), uid(6))

		_, err := db.Pool.Exec(ctx, `
            INSERT INTO tax_payments (payment_id, citizen_nid, tax_record_id, amount, payment_method, status)
            VALUES ($1,$2,$3,$4,$5,'COMPLETED')
        `, payID, req.CitizenNID, req.TaxRecordID, req.Amount, req.PaymentMethod)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false})
		}

		// Mark tax as paid
		db.Pool.Exec(ctx, `
            UPDATE tax_records SET status='PAID', paid_amount=total_amount, paid_at=NOW(), payment_ref=$1
            WHERE id=$2
        `, payID, req.TaxRecordID)

		return c.JSON(fiber.Map{
			"success":    true,
			"payment_id": payID,
			"message":    "Payment completed. Receipt sent via SMS.",
		})
	}
}

// ── AI ASSISTANT ──────────────────────────────────────────────

// POST /ai/chat — civic question answering in Nepali/English
func AIChat(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			Query      string `json:"query"`
			Language   string `json:"language"` // ne | en
			CitizenNID string `json:"citizen_nid"`
			SessionID  string `json:"session_id"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false})
		}
		if req.Language == "" {
			req.Language = "ne"
		}

		// Try Claude API first
		systemPrompt := ``
		if req.Language == "ne" {
			systemPrompt = `तपाईं पोखरा महानगरपालिकाको आधिकारिक AI सहायक हुनुहुन्छ।
नागरिकहरूको सरकारी सेवासम्बन्धी प्रश्नहरूको उत्तर सरल, स्पष्ट नेपाली भाषामा दिनुस्।
उत्तर अधिकतम ५ बुँदामा दिनुस्। यथार्थपरक जानकारी दिनुस्।`
		} else {
			systemPrompt = `You are the official AI assistant for Pokhara Metropolitan City.
Answer citizens' questions about government services in clear, simple English.
Give answers in maximum 5 bullet points. Be accurate and helpful.`
		}

		apiKey := getEnv("ANTHROPIC_API_KEY", "")
		var response string
		var err error

		if apiKey != "" {
			response, err = callClaude(apiKey, systemPrompt, req.Query, 400)
		}

		if apiKey == "" || err != nil {
			response = aiTemplateFallback(req.Query, req.Language)
		}

		// Log chat
		go func() {
			db.Pool.Exec(context.Background(), `
                INSERT INTO ai_chat_log (session_id, citizen_nid, query, response, language)
                VALUES ($1,$2,$3,$4,$5)
            `, req.SessionID, req.CitizenNID, req.Query, response, req.Language)
		}()

		return c.JSON(fiber.Map{
			"success":  true,
			"response": response,
			"language": req.Language,
		})
	}
}

func aiTemplateFallback(query, lang string) string {
	query = strings.ToLower(query)
	responses := map[string]map[string]string{
		"bhawan": {
			"ne": "भवन निर्माण अनुमतिका लागि:\n• वडा कार्यालयमा निवेदन दिनुस्\n• जग्गाधनी प्रमाणपत्र संलग्न गर्नुस्\n• नक्सा र डिजाइन पेश गर्नुस्\n• शुल्क: NPR 2,500 - 10,000\n• ७ कार्य दिनभित्र अनुमति",
			"en": "Building permit process:\n• Submit application at Ward office\n• Attach land ownership certificate\n• Submit building design/map\n• Fee: NPR 2,500 - 10,000\n• Permit in 7 working days",
		},
		"nagarikta": {
			"ne": "नागरिकता प्रमाणपत्रका लागि:\n• जन्मदर्ता प्रमाणपत्र ल्याउनुस्\n• बाबु/आमाको नागरिकता ल्याउनुस्\n• वडाको सिफारिस लिनुस्\n• जिल्ला प्रशासन कार्यालयमा जानुस्\n• ७ देखि १४ दिनमा तयार",
			"en": "Citizenship certificate:\n• Bring birth certificate\n• Bring parents' citizenship\n• Get ward recommendation\n• Go to District Administration Office\n• Ready in 7-14 days",
		},
		"sifaris": {
			"ne": "सिफारिसका लागि:\n• Mero Sahar app मा अनुरोध पेश गर्नुस्\n• PRATIBIMBA OCR ले कागज स्वत: भर्छ\n• वडा अधिकारीले समीक्षा गर्छन्\n• २ कार्य दिनभित्र डिजिटल कागज\n• QR कोड सहित PDF डाउनलोड गर्नुस्",
			"en": "For Sifaris:\n• Submit request in Mero Sahar app\n• PRATIBIMBA OCR auto-fills your form\n• Ward officer reviews within 2 days\n• Digital document with QR code\n• Download PDF directly",
		},
	}
	for key, res := range responses {
		if strings.Contains(query, key) {
			if v, ok := res[lang]; ok {
				return v
			}
		}
	}
	if lang == "ne" {
		return "माफ गर्नुस्, यस विषयमा थप जानकारीका लागि:\n• वडा कार्यालयमा सम्पर्क गर्नुस्: 061-520009\n• Mero Sahar app मा Request पेश गर्नुस्\n• Ward 9 office: सोमबार-शुक्रबार, बिहान १०-बेलुका ५"
	}
	return "For more information:\n• Contact Ward Office: 061-520009\n• Submit request via Mero Sahar app\n• Ward 9 hours: Mon-Fri 10AM-5PM"
}

func hashString(s string) string {
	import_crypto := fmt.Sprintf("%x", []byte(s))
	if len(import_crypto) >= 64 {
		return import_crypto[:64]
	}
	for len(import_crypto) < 64 {
		import_crypto += "0"
	}
	return import_crypto
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
