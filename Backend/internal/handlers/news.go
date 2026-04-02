package handlers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"pratibimba/internal/database"
	"pratibimba/internal/sse"

	"github.com/gofiber/fiber/v2"
)

// GET /news/:wardCode — get news for a ward (citizen app)
func GetWardNews(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wardCode := c.Params("wardCode")
		limit := c.QueryInt("limit", 20)
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT news_id, title, COALESCE(title_ne,''), body, COALESCE(body_ne,''),
                   category, priority, COALESCE(image_url,''), published_at,
                   COALESCE(expires_at, NOW()+INTERVAL '30 days'),
                   view_count, officer_id, ward_code
            FROM ward_news
            WHERE (ward_code = $1 OR ward_code = 'ALL')
              AND is_published = true
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY priority DESC, published_at DESC
            LIMIT $2
        `, wardCode, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type NewsItem struct {
			NewsID      string    `json:"news_id"`
			Title       string    `json:"title"`
			TitleNE     string    `json:"title_ne"`
			Body        string    `json:"body"`
			BodyNE      string    `json:"body_ne"`
			Category    string    `json:"category"`
			Priority    int       `json:"priority"`
			ImageURL    string    `json:"image_url"`
			PublishedAt time.Time `json:"published_at"`
			ExpiresAt   time.Time `json:"expires_at"`
			ViewCount   int       `json:"view_count"`
			OfficerID   string    `json:"officer_id"`
			WardCode    string    `json:"ward_code"`
		}

		var items []NewsItem
		for rows.Next() {
			var n NewsItem
			rows.Scan(&n.NewsID, &n.Title, &n.TitleNE, &n.Body, &n.BodyNE,
				&n.Category, &n.Priority, &n.ImageURL, &n.PublishedAt,
				&n.ExpiresAt, &n.ViewCount, &n.OfficerID, &n.WardCode)
			items = append(items, n)
		}

		// Increment view counts async
		go func() {
			for _, item := range items {
				db.Pool.Exec(context.Background(),
					`UPDATE ward_news SET view_count = view_count + 1 WHERE news_id = $1`,
					item.NewsID)
			}
		}()

		return c.JSON(fiber.Map{"success": true, "news": items, "count": len(items)})
	}
}

// POST /officer/news — officer posts a news item
func PostNews(db *database.DB, broker *sse.Broker) fiber.Handler {
	return func(c *fiber.Ctx) error {
		officerID, ok := c.Locals("officer_id").(string)
		if !ok || officerID == "" {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "Invalid officer context"})
		}
		wardCode, ok := c.Locals("ward_code").(string)
		if !ok || wardCode == "" {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "Invalid ward context"})
		}

		var req struct {
			Title     string `json:"title"`
			TitleNE   string `json:"title_ne"`
			Body      string `json:"body"`
			BodyNE    string `json:"body_ne"`
			Category  string `json:"category"`
			Priority  int    `json:"priority"`
			ImageURL  string `json:"image_url"`
			ExpiresIn int    `json:"expires_in_days"`
			// 0 = no expiry
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		req.Title = strings.TrimSpace(req.Title)
		req.TitleNE = strings.TrimSpace(req.TitleNE)
		req.Body = strings.TrimSpace(req.Body)
		req.BodyNE = strings.TrimSpace(req.BodyNE)
		req.Category = strings.ToUpper(strings.TrimSpace(req.Category))
		req.ImageURL = strings.TrimSpace(req.ImageURL)

		if req.Title == "" || req.Body == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Title and body required"})
		}
		if len(req.Title) > 200 {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Title too long"})
		}
		if len(req.Body) > 5000 {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Body too long"})
		}
		if req.Category == "" {
			req.Category = "GENERAL"
		}
		allowedCategory := map[string]struct{}{
			"URGENT": {}, "INFRASTRUCTURE": {}, "HEALTH": {}, "CULTURE": {}, "TOURISM": {},
			"GENERAL": {}, "WATER": {}, "ELECTRICITY": {}, "ROAD": {},
		}
		if _, ok := allowedCategory[req.Category]; !ok {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid category"})
		}
		if req.Priority < 0 || req.Priority > 3 {
			req.Priority = 0
		}
		if req.ExpiresIn < 0 || req.ExpiresIn > 365 {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid expiry window"})
		}

		ctx := context.Background()
		seq, _ := db.NextSequence(ctx, "NWS", time.Now().Year())
		newsID := fmt.Sprintf("NWS-%04d-%06d", time.Now().Year(), seq)

		var expiresAt *time.Time
		if req.ExpiresIn > 0 {
			t := time.Now().AddDate(0, 0, req.ExpiresIn)
			expiresAt = &t
		}

		_, err := db.Pool.Exec(ctx, `
            INSERT INTO ward_news
                (news_id, officer_id, ward_code, title, title_ne, body, body_ne,
                 category, priority, image_url, is_published, expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)
        `, newsID, officerID, wardCode, req.Title, req.TitleNE,
			req.Body, req.BodyNE, req.Category, req.Priority, req.ImageURL, expiresAt)

		if err != nil {
			log.Printf("[News] Insert error: %v", err)
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Failed to post news"})
		}

		if broker != nil {
			broker.Publish("WARD_NEWS_PUBLISHED", map[string]interface{}{
				"news_id":    newsID,
				"ward_code":  wardCode,
				"officer_id": officerID,
				"category":   req.Category,
				"priority":   req.Priority,
				"published":  time.Now().UTC(),
			})
		}

		log.Printf("[News] Posted: %s by %s (priority %d)", newsID, officerID, req.Priority)
		return c.Status(201).JSON(fiber.Map{
			"success": true,
			"news_id": newsID,
			"message": "News published to ward",
		})
	}
}

// GET /officer/news — list recent ward news created by this officer's ward.
func ListOfficerNews(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wardCode, ok := c.Locals("ward_code").(string)
		if !ok || wardCode == "" {
			return c.Status(401).JSON(fiber.Map{"success": false, "message": "Invalid ward context"})
		}
		limit := c.QueryInt("limit", 30)
		if limit < 1 {
			limit = 1
		}
		if limit > 100 {
			limit = 100
		}

		ctx := context.Background()
		rows, err := db.Pool.Query(ctx, `
            SELECT news_id, title, COALESCE(title_ne,''), body, COALESCE(body_ne,''),
                   category, priority, COALESCE(image_url,''), is_published,
                   published_at, expires_at, COALESCE(view_count,0), officer_id, ward_code
            FROM ward_news
            WHERE ward_code = $1 OR ward_code = 'ALL'
            ORDER BY published_at DESC
            LIMIT $2
        `, wardCode, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type OfficerNews struct {
			NewsID      string     `json:"news_id"`
			Title       string     `json:"title"`
			TitleNE     string     `json:"title_ne"`
			Body        string     `json:"body"`
			BodyNE      string     `json:"body_ne"`
			Category    string     `json:"category"`
			Priority    int        `json:"priority"`
			ImageURL    string     `json:"image_url"`
			IsPublished bool       `json:"is_published"`
			PublishedAt time.Time  `json:"published_at"`
			ExpiresAt   *time.Time `json:"expires_at"`
			ViewCount   int        `json:"view_count"`
			OfficerID   string     `json:"officer_id"`
			WardCode    string     `json:"ward_code"`
		}

		items := make([]OfficerNews, 0, limit)
		for rows.Next() {
			var n OfficerNews
			if err := rows.Scan(&n.NewsID, &n.Title, &n.TitleNE, &n.Body, &n.BodyNE,
				&n.Category, &n.Priority, &n.ImageURL, &n.IsPublished, &n.PublishedAt,
				&n.ExpiresAt, &n.ViewCount, &n.OfficerID, &n.WardCode); err != nil {
				continue
			}
			items = append(items, n)
		}

		return c.JSON(fiber.Map{"success": true, "news": items, "count": len(items)})
	}
}

// GET /ward/:wardCode — get ward registry info
func GetWardInfo(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wardCode := c.Params("wardCode")
		ctx := context.Background()

		var w struct {
			WardCode       string  `json:"ward_code"`
			WardNumber     int     `json:"ward_number"`
			WardName       string  `json:"ward_name"`
			WardNameNE     string  `json:"ward_name_ne"`
			District       string  `json:"district"`
			DistrictNE     string  `json:"district_ne"`
			Province       string  `json:"province"`
			ProvinceNE     string  `json:"province_ne"`
			Municipality   string  `json:"municipality"`
			MunicipalityNE string  `json:"municipality_ne"`
			OfficePhone    string  `json:"office_phone"`
			OfficeEmail    string  `json:"office_email"`
			OfficeAddress  string  `json:"office_address"`
			Lat            float64 `json:"lat"`
			Lng            float64 `json:"lng"`
			TotalPop       int     `json:"total_population"`
			TotalHH        int     `json:"total_households"`
		}

		err := db.Pool.QueryRow(ctx, `
            SELECT ward_code, ward_number,
                   COALESCE(ward_name,''), COALESCE(ward_name_ne,''),
                   district, COALESCE(district_ne,''),
                   province, COALESCE(province_ne,''),
                   municipality, COALESCE(municipality_ne,''),
                   COALESCE(office_phone,''), COALESCE(office_email,''),
                   COALESCE(office_address,''),
                   COALESCE(lat,0), COALESCE(lng,0),
                   COALESCE(total_population,0), COALESCE(total_households,0)
            FROM ward_registry WHERE ward_code = $1
        `, wardCode).Scan(
			&w.WardCode, &w.WardNumber, &w.WardName, &w.WardNameNE,
			&w.District, &w.DistrictNE, &w.Province, &w.ProvinceNE,
			&w.Municipality, &w.MunicipalityNE,
			&w.OfficePhone, &w.OfficeEmail, &w.OfficeAddress,
			&w.Lat, &w.Lng, &w.TotalPop, &w.TotalHH,
		)
		if err != nil {
			// Return minimal data if ward not in registry
			return c.JSON(fiber.Map{
				"success":         true,
				"ward_code":       wardCode,
				"ward_number":     9,
				"district":        "Kaski",
				"district_ne":     "कास्की",
				"province":        "Gandaki",
				"province_ne":     "गण्डकी",
				"municipality":    "Pokhara Metropolitan City",
				"municipality_ne": "पोखरा महानगरपालिका",
			})
		}

		return c.JSON(fiber.Map{"success": true, "ward": w})
	}
}

// POST /sos — citizen/tourist sends SOS
func SubmitSOS(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID      string  `json:"citizen_nid"`
			TouristPassport string  `json:"tourist_passport"`
			SessionType     string  `json:"session_type"`
			FullName        string  `json:"full_name"`
			Phone           string  `json:"phone"`
			LocationLat     float64 `json:"location_lat"`
			LocationLng     float64 `json:"location_lng"`
			LocationDesc    string  `json:"location_desc"`
			WardCode        string  `json:"ward_code"`
			EmergencyType   string  `json:"emergency_type"`
			Message         string  `json:"message"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		if req.EmergencyType == "" {
			req.EmergencyType = "GENERAL"
		}

		ctx := context.Background()
		seq, _ := db.NextSequence(ctx, "SOS", time.Now().Year())
		sosID := fmt.Sprintf("SOS-%04d-%06d", time.Now().Year(), seq)

		_, err := db.Pool.Exec(ctx, `
            INSERT INTO sos_events
                (sos_id, citizen_nid, tourist_passport, session_type, full_name,
                 phone, location_lat, location_lng, location_desc, ward_code,
                 emergency_type, message, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ACTIVE')
        `, sosID, req.CitizenNID, req.TouristPassport, req.SessionType,
			req.FullName, req.Phone, req.LocationLat, req.LocationLng,
			req.LocationDesc, req.WardCode, req.EmergencyType, req.Message)

		if err != nil {
			log.Printf("[SOS] Insert error: %v", err)
			// Still return success — don't fail an SOS
		}

		log.Printf("🚨 SOS: %s | Type: %s | Ward: %s | Name: %s",
			sosID, req.EmergencyType, req.WardCode, req.FullName)

		return c.Status(201).JSON(fiber.Map{
			"success": true,
			"sos_id":  sosID,
			"message": "Emergency alert sent. Help is on the way.",
			"helplines": fiber.Map{
				"police":            "100",
				"ambulance":         "102",
				"fire":              "101",
				"pokhara_emergency": "061-520100",
			},
		})
	}
}
