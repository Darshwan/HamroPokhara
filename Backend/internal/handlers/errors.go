package handlers

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

// GlobalErrorHandler catches all unhandled panics/errors.
// Prevents raw error messages leaking to clients.
func GlobalErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "Internal server error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}

	log.Printf("Error [%d]: %v — Path: %s", code, err, c.Path())

	return c.Status(code).JSON(fiber.Map{
		"success": false,
		"message": msg,
	})
}
