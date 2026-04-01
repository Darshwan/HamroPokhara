package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	OfficerID    string `json:"officer_id"`
	WardCode     string `json:"ward_code"`
	ProvinceCode int    `json:"province_code"`
	Role         string `json:"role"`
	jwt.RegisteredClaims
}

// RequireOfficer validates JWT token on officer routes.
func RequireOfficer(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "Authorization header required",
			})
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "Bearer token required",
			})
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims,
			func(t *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			},
		)

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{
				"success": false,
				"message": "Invalid or expired token",
			})
		}

		// Store claims in context for handlers to use
		c.Locals("officer_id", claims.OfficerID)
		c.Locals("ward_code", claims.WardCode)
		c.Locals("province_code", claims.ProvinceCode)
		c.Locals("role", claims.Role)

		return c.Next()
	}
}
