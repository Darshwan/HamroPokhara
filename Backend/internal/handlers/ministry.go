package handlers

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"

	"pratibimba/internal/crypto"
	"pratibimba/internal/database"
	"pratibimba/internal/sse"
)

// GetStats handles GET /ministry/stats
func GetStats(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := context.Background()
		stats, err := db.GetDashboardStats(ctx)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to load stats",
			})
		}
		return c.Status(200).JSON(fiber.Map{
			"success": true,
			"stats":   stats,
		})
	}
}

// GetFeed handles GET /ministry/feed
// Returns recent ledger entries for ministry dashboard
func GetFeed(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		limit := c.QueryInt("limit", 20)
		if limit > 100 {
			limit = 100
		}

		ctx := context.Background()
		entries, err := db.GetRecentLedgerEntries(ctx, limit)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Failed to fetch feed",
			})
		}

		return c.Status(200).JSON(fiber.Map{
			"success": true,
			"count":   len(entries),
			"entries": entries,
		})
	}
}

// LiveFeed handles GET /ministry/live
// Server-Sent Events — ministry dashboard connects here
// and receives real-time document approval events.
func LiveFeed(broker *sse.Broker) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("Access-Control-Allow-Origin", "*")

		ch := broker.Subscribe()
		defer broker.Unsubscribe(ch)

		log.Printf("Ministry SSE connected from %s", c.IP())

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			// Send initial connected event
			fmt.Fprintf(w, "data: {\"type\":\"CONNECTED\",\"message\":\"PRATIBIMBA Live Feed\"}\n\n")
			w.Flush()

			// Keep-alive ticker
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()

			for {
				select {
				case data, ok := <-ch:
					if !ok {
						return
					}
					fmt.Fprintf(w, "data: %s\n\n", data)
					if err := w.Flush(); err != nil {
						return
					}

				case <-ticker.C:
					// Heartbeat — keeps connection alive through proxies
					fmt.Fprintf(w, ": heartbeat\n\n")
					if err := w.Flush(); err != nil {
						return
					}
				}
			}
		})

		return nil
	}
}

// RunIntegrityCheck handles GET /ministry/integrity
// Scans entire ledger for tampered records.
// Demo this LIVE during presentation.
func RunIntegrityCheck(db *database.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := context.Background()
		start := time.Now()

		entries, err := db.GetRecentLedgerEntries(ctx, 10000)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"success": false,
				"message": "Integrity check failed",
			})
		}

		var intact, tampered int
		var tamperedList []string

		for _, e := range entries {
			ok := crypto.VerifyRecordIntegrity(
				e.RecordHash,
				e.DTID,
				e.DocumentHash,
				string(e.DocumentType),
				e.OfficerID,
				e.WardCode,
				e.CreatedAt,
			)
			if ok {
				intact++
			} else {
				tampered++
				tamperedList = append(tamperedList, e.DTID)
				log.Printf("🚨 INTEGRITY VIOLATION: %s", e.DTID)
			}
		}

		verdict := "✅ ALL RECORDS INTACT"
		if tampered > 0 {
			verdict = fmt.Sprintf("🚨 %d TAMPERED RECORDS DETECTED", tampered)
		}

		return c.Status(200).JSON(fiber.Map{
			"success":        true,
			"total_checked":  len(entries),
			"intact":         intact,
			"tampered":       tampered,
			"tampered_dtids": tamperedList,
			"scan_ms":        time.Since(start).Milliseconds(),
			"scanned_at":     time.Now().UTC(),
			"verdict":        verdict,
		})
	}
}
