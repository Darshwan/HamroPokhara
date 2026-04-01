package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	Port        string
	JWTSecret   string
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

	cfg := &Config{
		DatabaseURL: mustGet("DATABASE_URL"),
		Port:        getOrDefault("PORT", "8080"),
		JWTSecret:   mustGet("JWT_SECRET"),
		Env:         getOrDefault("ENV", "development"),
		AppName:     getOrDefault("APP_NAME", "PRATIBIMBA"),
		AppVersion:  getOrDefault("APP_VERSION", "1.0.0"),
	}

	return cfg
}

func mustGet(key string) string {
	val := os.Getenv(key)
	if val == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return val
}

func getOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
