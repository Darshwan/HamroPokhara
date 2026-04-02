package handlers

import (
	"context"
	"fmt"
	"log"
	"time"

	"pratibimba/internal/database"

	"github.com/gofiber/fiber/v2"
)

// ── GET /citizen/profile/:nid ─────────────────────────────────
// Returns full citizen profile from database
func GetCitizenProfile(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		nid := c.Params("nid")
		if nid == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "NID required"})
		}

		ctx := context.Background()
		var profile struct {
			NID           string  `json:"nid"`
			CitizenshipNo string  `json:"citizenship_no"`
			FullName      string  `json:"full_name"`
			FullNameNE    string  `json:"full_name_ne"`
			DOB           *string `json:"dob"`
			Gender        string  `json:"gender"`
			FatherName    string  `json:"father_name"`
			MotherName    string  `json:"mother_name"`
			WardCode      string  `json:"ward_code"`
			WardNumber    int     `json:"ward_number"`
			District      string  `json:"district"`
			Province      string  `json:"province"`
			Phone         string  `json:"phone"`
		}

		err := db.Pool.QueryRow(ctx, `
            SELECT nid, citizenship_no, full_name, COALESCE(full_name_ne,''),
                   dob::text, COALESCE(gender,''), COALESCE(father_name,''),
                   COALESCE(mother_name,''), ward_code, COALESCE(ward_number,0),
                   COALESCE(district,''), COALESCE(province,''), COALESCE(phone,'')
            FROM citizen_profiles WHERE nid = $1 AND is_active = true
        `, nid).Scan(
			&profile.NID, &profile.CitizenshipNo, &profile.FullName, &profile.FullNameNE,
			&profile.DOB, &profile.Gender, &profile.FatherName, &profile.MotherName,
			&profile.WardCode, &profile.WardNumber, &profile.District, &profile.Province,
			&profile.Phone,
		)

		if err != nil {
			if err.Error() == "no rows in result set" {
				return c.Status(404).JSON(fiber.Map{"success": false, "message": "Citizen not found"})
			}
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}

		return c.JSON(fiber.Map{"success": true, "profile": profile})
	}
}

// ── GET /citizen/tax/:nid ─────────────────────────────────────
// Returns tax records for a citizen
func GetTaxRecords(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		nid := c.Params("nid")
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT id, tax_year, property_tax, business_tax,
                   total_amount, paid_amount, due_date::text,
                   status, COALESCE(payment_ref,''),
                   COALESCE(paid_at::text,'')
            FROM tax_records WHERE citizen_nid = $1
            ORDER BY tax_year DESC
        `, nid)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type TaxRecord struct {
			ID          int64   `json:"id"`
			TaxYear     int     `json:"tax_year"`
			PropertyTax float64 `json:"property_tax"`
			BusinessTax float64 `json:"business_tax"`
			TotalAmount float64 `json:"total_amount"`
			PaidAmount  float64 `json:"paid_amount"`
			DueDate     string  `json:"due_date"`
			Status      string  `json:"status"`
			PaymentRef  string  `json:"payment_ref"`
			PaidAt      string  `json:"paid_at"`
		}

		var records []TaxRecord
		for rows.Next() {
			var r TaxRecord
			if err := rows.Scan(&r.ID, &r.TaxYear, &r.PropertyTax, &r.BusinessTax,
				&r.TotalAmount, &r.PaidAmount, &r.DueDate, &r.Status,
				&r.PaymentRef, &r.PaidAt); err != nil {
				continue
			}
			records = append(records, r)
		}

		return c.JSON(fiber.Map{"success": true, "records": records})
	}
}

// ── GET /citizen/notices/:wardCode ───────────────────────────
// Returns notices relevant to a ward
func GetNotices(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		wardCode := c.Params("wardCode")
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
	     SELECT notice_id, title, title_ne, category,
		     content, is_urgent, published_at, ward_code
	     FROM (
		  SELECT n.notice_id,
			  n.title,
			  COALESCE(n.title_ne,'') AS title_ne,
			  n.category,
			  COALESCE(n.content,'') AS content,
			  n.is_urgent,
			  n.published_at,
			  COALESCE(n.ward_code,'') AS ward_code
		  FROM notices n
		  WHERE (n.ward_code = $1 OR n.ward_code IS NULL)
		    AND (n.expires_at IS NULL OR n.expires_at > NOW())

		  UNION ALL

		  SELECT wn.news_id AS notice_id,
			  wn.title,
			  COALESCE(wn.title_ne,'') AS title_ne,
			  wn.category,
			  COALESCE(wn.body,'') AS content,
			  (wn.priority >= 2) AS is_urgent,
			  wn.published_at,
			  wn.ward_code
		  FROM ward_news wn
		  WHERE (wn.ward_code = $1 OR wn.ward_code = 'ALL')
		    AND wn.is_published = true
		    AND (wn.expires_at IS NULL OR wn.expires_at > NOW())
	     ) merged
            ORDER BY is_urgent DESC, published_at DESC
            LIMIT 20
        `, wardCode)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type Notice struct {
			NoticeID    string    `json:"notice_id"`
			Title       string    `json:"title"`
			TitleNE     string    `json:"title_ne"`
			Category    string    `json:"category"`
			Content     string    `json:"content"`
			IsUrgent    bool      `json:"is_urgent"`
			PublishedAt time.Time `json:"published_at"`
			WardCode    string    `json:"ward_code"`
		}

		var notices []Notice
		for rows.Next() {
			var n Notice
			if err := rows.Scan(&n.NoticeID, &n.Title, &n.TitleNE, &n.Category,
				&n.Content, &n.IsUrgent, &n.PublishedAt, &n.WardCode); err != nil {
				continue
			}
			notices = append(notices, n)
		}

		return c.JSON(fiber.Map{"success": true, "notices": notices})
	}
}

// ── POST /citizen/grievance ───────────────────────────────────
// Submit a grievance (pothole, light, water leak, etc.)
func SubmitGrievance(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID   string  `json:"citizen_nid"`
			CitizenName  string  `json:"citizen_name"`
			WardCode     string  `json:"ward_code"`
			Category     string  `json:"category"`
			Description  string  `json:"description"`
			LocationLat  float64 `json:"location_lat"`
			LocationLng  float64 `json:"location_lng"`
			LocationDesc string  `json:"location_desc"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}
		if req.CitizenNID == "" || req.Description == "" {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "NID and description required"})
		}

		ctx := context.Background()
		seq, _ := db.NextSequence(ctx, "GRV-"+req.WardCode, time.Now().Year())
		grievanceID := fmt.Sprintf("GRV-%04d-%06d", time.Now().Year(), seq)

		_, err := db.Pool.Exec(ctx, `
            INSERT INTO grievances (grievance_id, citizen_nid, citizen_name, ward_code,
                category, description, location_lat, location_lng, location_desc, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN')
        `, grievanceID, req.CitizenNID, req.CitizenName, req.WardCode,
			req.Category, req.Description, req.LocationLat, req.LocationLng, req.LocationDesc)

		if err != nil {
			log.Printf("Grievance insert error: %v", err)
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Failed to submit grievance"})
		}

		return c.Status(201).JSON(fiber.Map{
			"success":      true,
			"grievance_id": grievanceID,
			"message":      "Grievance submitted. Ward office notified.",
		})
	}
}

// ── GET /citizen/grievances/:nid ──────────────────────────────
// Get all grievances filed by a citizen
func GetGrievances(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		nid := c.Params("nid")
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT grievance_id, category, description, COALESCE(location_desc,''),
                   status, created_at, COALESCE(resolution_note,'')
            FROM grievances WHERE citizen_nid = $1
            ORDER BY created_at DESC LIMIT 20
        `, nid)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type Grievance struct {
			GrievanceID    string    `json:"grievance_id"`
			Category       string    `json:"category"`
			Description    string    `json:"description"`
			LocationDesc   string    `json:"location_desc"`
			Status         string    `json:"status"`
			CreatedAt      time.Time `json:"created_at"`
			ResolutionNote string    `json:"resolution_note"`
		}

		var list []Grievance
		for rows.Next() {
			var g Grievance
			if err := rows.Scan(&g.GrievanceID, &g.Category, &g.Description,
				&g.LocationDesc, &g.Status, &g.CreatedAt, &g.ResolutionNote); err != nil {
				continue
			}
			list = append(list, g)
		}

		return c.JSON(fiber.Map{"success": true, "grievances": list})
	}
}

// ── POST /citizen/queue/book ──────────────────────────────────
// Book a queue token at ward office
func BookQueueToken(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			CitizenNID  string `json:"citizen_nid"`
			WardCode    string `json:"ward_code"`
			ServiceType string `json:"service_type"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"success": false, "message": "Invalid request"})
		}

		ctx := context.Background()

		// Get next token number for this ward today
		var nextToken int
		err := db.Pool.QueryRow(ctx, `
            SELECT COALESCE(MAX(token_number), 0) + 1
            FROM queue_tokens
            WHERE ward_code = $1
              AND booked_at::date = CURRENT_DATE
              AND status IN ('WAITING','CALLED')
        `, req.WardCode).Scan(&nextToken)
		if err != nil {
			nextToken = 1
		}

		seq, _ := db.NextSequence(ctx, "QUE-"+req.WardCode, time.Now().Year())
		tokenID := fmt.Sprintf("TKN-%04d-%06d", time.Now().Year(), seq)

		// Estimate 15 minutes per token
		estimatedTime := time.Now().Add(time.Duration(nextToken*15) * time.Minute)

		_, err = db.Pool.Exec(ctx, `
            INSERT INTO queue_tokens (token_id, citizen_nid, ward_code, service_type,
                token_number, estimated_time, status)
            VALUES ($1,$2,$3,$4,$5,$6,'WAITING')
        `, tokenID, req.CitizenNID, req.WardCode, req.ServiceType, nextToken, estimatedTime)

		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Failed to book token"})
		}

		return c.Status(201).JSON(fiber.Map{
			"success":        true,
			"token_id":       tokenID,
			"token_number":   nextToken,
			"estimated_time": estimatedTime,
			"message":        fmt.Sprintf("Token #%d booked. Estimated wait: %d minutes", nextToken, nextToken*15),
		})
	}
}

// ── GET /citizen/bhatta/:nid ──────────────────────────────────
// Get social security allowance status
func GetBhattaStatus(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		nid := c.Params("nid")
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT scheme_type, monthly_amount, status,
                   COALESCE(last_disbursed::text,''), COALESCE(next_disbursal::text,''),
                   COALESCE(bank_account,'')
            FROM social_security WHERE citizen_nid = $1
        `, nid)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type BhattaRecord struct {
			SchemeType    string  `json:"scheme_type"`
			MonthlyAmount float64 `json:"monthly_amount"`
			Status        string  `json:"status"`
			LastDisbursed string  `json:"last_disbursed"`
			NextDisbursal string  `json:"next_disbursal"`
			BankAccount   string  `json:"bank_account"`
		}

		var records []BhattaRecord
		for rows.Next() {
			var r BhattaRecord
			rows.Scan(&r.SchemeType, &r.MonthlyAmount, &r.Status,
				&r.LastDisbursed, &r.NextDisbursal, &r.BankAccount)
			records = append(records, r)
		}

		return c.JSON(fiber.Map{"success": true, "schemes": records})
	}
}

// ── GET /citizen/documents/:nid ───────────────────────────────
// All documents (from ledger) linked to this citizen's requests
func GetCitizenDocuments(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		nid := c.Params("nid")
		ctx := context.Background()

		rows, err := db.Pool.Query(ctx, `
            SELECT l.dtid, l.document_type, l.status, l.created_at,
                   l.ward_code, COALESCE(r.purpose,'')
            FROM ndo_ledger l
            JOIN service_requests r ON r.dtid = l.dtid
            WHERE r.citizen_nid = $1
            ORDER BY l.created_at DESC
        `, nid)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
		}
		defer rows.Close()

		type Doc struct {
			DTID         string    `json:"dtid"`
			DocumentType string    `json:"document_type"`
			Status       string    `json:"status"`
			CreatedAt    time.Time `json:"created_at"`
			WardCode     string    `json:"ward_code"`
			Purpose      string    `json:"purpose"`
			QRData       string    `json:"qr_data"`
		}

		var docs []Doc
		for rows.Next() {
			var d Doc
			if err := rows.Scan(&d.DTID, &d.DocumentType, &d.Status,
				&d.CreatedAt, &d.WardCode, &d.Purpose); err != nil {
				continue
			}
			d.QRData = fmt.Sprintf("verify.pratibimba.gov.np/%s", d.DTID)
			docs = append(docs, d)
		}

		return c.JSON(fiber.Map{"success": true, "documents": docs})
	}
}
