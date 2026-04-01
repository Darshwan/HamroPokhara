package crypto

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"time"
)

// HashDocument generates the document fingerprint.
// Field order is fixed — NEVER change this.
// Changing field order breaks all existing verifications.
func HashDocument(
	officerID string,
	documentType string,
	wardCode string,
	provinceCode int,
	citizenDataHash string,
	timestamp time.Time,
) string {
	payload := fmt.Sprintf("%s|%s|%s|%d|%s|%s",
		officerID,
		documentType,
		wardCode,
		provinceCode,
		citizenDataHash,
		timestamp.UTC().Format(time.RFC3339Nano),
	)
	h := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(h[:])
}

// HashPersonalData creates a one-way hash of citizen data.
// Raw personal data NEVER enters the ledger.
// Only this hash is stored.
func HashPersonalData(nid, name, purpose string) string {
	payload := fmt.Sprintf("CITIZEN|%s|%s|%s", nid, name, purpose)
	h := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(h[:])
}

// HashPIN hashes an officer PIN.
func HashPIN(pin string) string {
	h := sha256.Sum256([]byte(pin))
	return hex.EncodeToString(h[:])
}

// HashRecord creates a hash of the entire ledger row.
// Used by tamper detection to verify record integrity.
func HashRecord(
	dtid string,
	documentHash string,
	documentType string,
	officerID string,
	wardCode string,
	createdAt time.Time,
) string {
	createdAt = createdAt.UTC().Truncate(time.Microsecond)
	payload := fmt.Sprintf("RECORD|%s|%s|%s|%s|%s|%s",
		dtid,
		documentHash,
		documentType,
		officerID,
		wardCode,
		createdAt.Format(time.RFC3339Nano),
	)
	h := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(h[:])
}

// VerifyRecordIntegrity re-computes the record hash and compares
// it with the stored hash using constant-time comparison.
// Returns true if intact, false if tampered.
func VerifyRecordIntegrity(
	storedHash string,
	dtid string,
	documentHash string,
	documentType string,
	officerID string,
	wardCode string,
	createdAt time.Time,
) bool {
	recomputed := HashRecord(
		dtid, documentHash, documentType,
		officerID, wardCode, createdAt,
	)
	return subtle.ConstantTimeCompare(
		[]byte(storedHash),
		[]byte(recomputed),
	) == 1
}

// GenerateRequestID creates a unique citizen request ID.
// Format: MS-{YEAR}-{6-digit-sequence}
func GenerateRequestID(year int, seq int64) string {
	return fmt.Sprintf("MS-%04d-%06d", year, seq%1000000)
}

// GenerateVerificationID creates a unique verification event ID.
func GenerateVerificationID(seq int64) string {
	return fmt.Sprintf("VRF-%d-%06d", time.Now().Year(), seq%1000000)
}
