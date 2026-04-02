package main

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"pratibimba/internal/config"
	"pratibimba/internal/database"
	"pratibimba/internal/handlers"
	"pratibimba/internal/middleware"
	"pratibimba/internal/sse"
	pdfhandlers "pratibimba/pdf/handlers"
)

func main() {
	// ── Config ─────────────────────────────────────────────
	cfg := config.Load()

	// ── Database ───────────────────────────────────────────
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database failed: %v", err)
	}
	defer db.Close()

	broker := sse.NewBroker()

	// ── Fiber App ──────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      cfg.AppName + " v" + cfg.AppVersion,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		BodyLimit:    100 * 1024 * 1024, // 100MB max (for OCR base64 images)
		ErrorHandler: handlers.GlobalErrorHandler,
	})

	// ── Global Middleware ──────────────────────────────────
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} | ${status} | ${latency} | ${ip} | ${method} ${path}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Authorization",
	}))

	// ── Health Check ───────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "operational",
			"service":   cfg.AppName,
			"version":   cfg.AppVersion,
			"timestamp": time.Now().UTC(),
		})
	})

	// ── AI Routes ───────────────────────────────────────────
	app.Post("/ai/expand-purpose", handlers.ExpandPurpose(db))
	app.Post("/ai/assistant", handlers.GovernmentAssistant(db))
	app.Get("/ai/suggestions", handlers.AssistantSuggestions())
	app.Post("/ai/translate", handlers.TranslateText(db))

	// ── Citizen Routes ─────────────────────────────────────
	citizen := app.Group("/citizen")
	citizen.Use(limiter.New(limiter.Config{
		Max: 30, Expiration: 60 * time.Second,
	}))
	citizen.Post("/request", handlers.SubmitRequest(db))
	citizen.Get("/request/:requestID", handlers.GetRequestStatus(db))
	citizen.Post("/ocr", handlers.ProcessOCR(db))
	citizen.Post("/preview-pdf", handlers.PreviewDocumentPDF(db))
	citizen.Get("/download-pdf/:request_id", handlers.DownloadDocumentPDF(db))

	// ── Officer Routes (JWT protected) ─────────────────────
	app.Post("/officer/login", handlers.OfficerLogin(db, cfg.JWTSecret))

	// ── Auth Routes ─────────────────────────────────────────
	auth := app.Group("/auth")
	auth.Post("/citizen/login", handlers.CitizenLogin(db))
	auth.Post("/tourist/login", handlers.TouristLogin(db))
	auth.Post("/guest", handlers.GuestSession(db))
	auth.Post("/ocr", handlers.ProcessDocumentOCR(db))
	auth.Post("/ocr/validate", handlers.ValidateOCRResult(db))

	// ── Tourist Routes ──────────────────────────────────────
	tourist := app.Group("/tourist")
	tourist.Post("/request", handlers.SubmitTouristRequest(db))
	tourist.Get("/requests/:passportNo", handlers.GetTouristRequests(db))

	officer := app.Group("/officer", middleware.RequireOfficer(cfg.JWTSecret))
	officer.Get("/queue", handlers.GetQueue(db))
	officer.Get("/request-pdf/:request_id", handlers.OfficerRequestPreviewPDF(db))
	officer.Post("/approve", handlers.ApproveRequest(db, broker))
	officer.Post("/reject", handlers.RejectRequest(db))
	officer.Get("/news", handlers.ListOfficerNews(db))

	// News routes
	app.Get("/news/:wardCode", handlers.GetWardNews(db))
	app.Get("/ward/:wardCode", handlers.GetWardInfo(db))
	app.Post("/sos", handlers.SubmitSOS(db))

	// Officer news posting (JWT protected)
	officer.Post("/news", handlers.PostNews(db, broker))

	// ── Verification Route (public) ────────────────────────
	app.Get("/verify/:dtid",
		limiter.New(limiter.Config{
			Max: 100, Expiration: 60 * time.Second,
		}),
		handlers.VerifyDocument(db),
	)
	app.Get("/document/pdf/:dtid", pdfhandlers.DownloadPDF(db))

	// ── Civic Feature Routes ──────────────────────────────────────
	app.Get("/blood/donors", handlers.GetBloodDonors(db))
	app.Post("/blood/register", handlers.RegisterBloodDonor(db))
	app.Get("/tourism", handlers.GetTourismListings(db))
	app.Get("/lost-found", handlers.GetLostFound(db))
	app.Post("/lost-found", handlers.ReportLostFound(db))
	app.Post("/volunteer/register", handlers.RegisterVolunteer(db))
	app.Post("/feedback", handlers.SubmitOfficerFeedback(db))
	app.Get("/feedback/officer/:officerID", handlers.GetOfficerRating(db))
	app.Get("/hearing/:wardCode", handlers.GetHearings(db))
	app.Post("/hearing/vote", handlers.VoteOnHearing(db))
	app.Post("/krishi/apply", handlers.ApplyKrishiAnudan(db))
	app.Post("/sign", handlers.SignDocument(db))
	app.Post("/tax/pay", handlers.InitiateTaxPayment(db))
	app.Post("/ai/chat", handlers.AIChat(db))

	// ── Ministry Routes ────────────────────────────────────
	ministry := app.Group("/ministry")
	ministry.Get("/stats", handlers.GetStats(db))
	ministry.Get("/feed", handlers.GetFeed(db))
	ministry.Get("/live", handlers.LiveFeed(broker))
	ministry.Get("/integrity", handlers.RunIntegrityCheck(db))

	citizen.Get("/profile/:nid", handlers.GetCitizenProfile(db))
	citizen.Get("/tax/:nid", handlers.GetTaxRecords(db))
	citizen.Get("/notices/:wardCode", handlers.GetNotices(db))
	citizen.Post("/grievance", handlers.SubmitGrievance(db))
	citizen.Get("/grievances/:nid", handlers.GetGrievances(db))
	citizen.Post("/queue/book", handlers.BookQueueToken(db))
	citizen.Get("/bhatta/:nid", handlers.GetBhattaStatus(db))
	citizen.Get("/documents/:nid", handlers.GetCitizenDocuments(db))

	// ── 404 ────────────────────────────────────────────────
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"message": "Route not found",
		})
	})

	// ── Start ──────────────────────────────────────────────
	log.Printf("🚀 %s starting on :%s", cfg.AppName, cfg.Port)
	log.Printf("📋 Routes:")
	log.Printf("   POST   /citizen/request")
	log.Printf("   GET    /citizen/request/:id")
	log.Printf("   GET    /citizen/profile/:nid")
	log.Printf("   GET    /citizen/tax/:nid")
	log.Printf("   GET    /citizen/notices/:wardCode")
	log.Printf("   POST   /citizen/grievance")
	log.Printf("   GET    /citizen/grievances/:nid")
	log.Printf("   POST   /citizen/queue/book")
	log.Printf("   GET    /citizen/bhatta/:nid")
	log.Printf("   GET    /citizen/documents/:nid")
	log.Printf("   POST   /officer/login")
	log.Printf("   GET    /officer/queue          [JWT]")
	log.Printf("   POST   /officer/approve        [JWT]")
	log.Printf("   POST   /officer/reject         [JWT]")
	log.Printf("   GET    /verify/:dtid")
	log.Printf("   GET    /ministry/stats")
	log.Printf("   GET    /ministry/feed")
	log.Printf("   GET    /ministry/live          [SSE]")
	log.Printf("   GET    /ministry/integrity")
	log.Fatal(app.Listen(":" + cfg.Port))
}
