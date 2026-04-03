package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	Port        string
	JWTSecret   string
	CORSOrigins string
	Env         string
	AppName     string
	AppVersion  string
}

// Load reads environment variables and returns Config.
// Call this once in main.go.
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file — using system environment")
	}

	databaseURL := firstSet(
		"DATABASE_URL",
		"DATABASE_PRIVATE_URL",
		"POSTGRES_URL",
		"POSTGRESQL_URL",
	)
	if databaseURL == "" {
		log.Fatalf("Required database connection variable is not set (tried DATABASE_URL, DATABASE_PRIVATE_URL, POSTGRES_URL, POSTGRESQL_URL)")
	}

	cfg := &Config{
		DatabaseURL: databaseURL,
		Port:        getOrDefault("PORT", "8080"),
		JWTSecret:   mustGet("JWT_SECRET"),
		CORSOrigins: getOrDefault("CORS_ALLOW_ORIGINS", "*"),
		Env:         getOrDefault("ENV", "development"),
		AppName:     getOrDefault("APP_NAME", "PRATIBIMBA"),
		AppVersion:  getOrDefault("APP_VERSION", "1.0.0"),
	}

	return cfg
}

func mustGet(key string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return val
}

func getOrDefault(key, defaultVal string) string {
	if val := strings.TrimSpace(os.Getenv(key)); val != "" {
		return val
	}
	return defaultVal
}

func firstSet(keys ...string) string {
	for _, key := range keys {
		if val := strings.TrimSpace(os.Getenv(key)); val != "" {
			return val
		}
	}
	return ""
}
