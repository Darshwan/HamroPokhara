package models

import "time"

// ── Document Types ──────────────────────────────────────────

type DocumentType string

const (
	DocSifaris          DocumentType = "SIFARIS"
	DocTaxClearance     DocumentType = "TAX_CLEARANCE"
	DocLandRegistration DocumentType = "LAND_REGISTRATION"
	DocBirthCert        DocumentType = "BIRTH_CERTIFICATE"
	DocDeathCert        DocumentType = "DEATH_CERTIFICATE"
	DocRelationship     DocumentType = "RELATIONSHIP_CERT"
	DocIncomeProof      DocumentType = "INCOME_PROOF"
	DocBusinessReg      DocumentType = "BUSINESS_REGISTRATION"
	DocContractAward    DocumentType = "CONTRACT_AWARD"
	DocBudgetAlloc      DocumentType = "BUDGET_ALLOCATION"
)

// ── Database Models ─────────────────────────────────────────

type Officer struct {
	OfficerID    string    `db:"officer_id"    json:"officer_id"`
	FullName     string    `db:"full_name"     json:"full_name"`
	WardCode     string    `db:"ward_code"     json:"ward_code"`
	DistrictCode int       `db:"district_code" json:"district_code"`
	ProvinceCode int       `db:"province_code" json:"province_code"`
	Designation  string    `db:"designation"   json:"designation"`
	IsActive     bool      `db:"is_active"     json:"is_active"`
	CreatedAt    time.Time `db:"created_at"    json:"created_at"`
}

// Ward represents ward office details for PDF generation
type Ward struct {
	WardCode     string `db:"ward_code"     json:"ward_code"`
	WardNumber   string `db:"ward_number"   json:"ward_number"`
	DistrictName string `db:"district_name" json:"district_name"`
	ProvinceName string `db:"province_name" json:"province_name"`
	OfficeName   string `db:"office_name"   json:"office_name"`
	OfficePhone  string `db:"office_phone"  json:"office_phone"`
	OfficeEmail  string `db:"office_email"  json:"office_email"`
}

type LedgerEntry struct {
	ID           int64        `db:"id"            json:"id"`
	DTID         string       `db:"dtid"          json:"dtid"`
	DocumentHash string       `db:"document_hash" json:"document_hash"`
	RecordHash   string       `db:"record_hash"   json:"-"` // never expose
	DocumentType DocumentType `db:"document_type" json:"document_type"`
	OfficerID    string       `db:"officer_id"    json:"officer_id"`
	WardCode     string       `db:"ward_code"     json:"ward_code"`
	DistrictCode int          `db:"district_code" json:"district_code"`
	ProvinceCode int          `db:"province_code" json:"province_code"`
	RequestID    string       `db:"request_id"    json:"request_id,omitempty"`
	Status       string       `db:"status"        json:"status"`
	SyncStatus   string       `db:"sync_status"   json:"sync_status"`
	CreatedAt    time.Time    `db:"created_at"    json:"created_at"`
	SyncedAt     *time.Time   `db:"synced_at"     json:"synced_at,omitempty"`
}

type ServiceRequest struct {
	ID                  int64      `db:"id"               json:"id"`
	RequestID           string     `db:"request_id"       json:"request_id"`
	CitizenNID          string     `db:"citizen_nid"      json:"citizen_nid"`
	CitizenName         string     `db:"citizen_name"     json:"citizen_name"`
	CitizenPhone        string     `db:"citizen_phone"    json:"citizen_phone,omitempty"`
	CitizenDOB          string     `db:"citizen_dob"      json:"citizen_dob,omitempty"`
	CitizenGender       string     `db:"citizen_gender"   json:"citizen_gender,omitempty"`
	CitizenAddress      string     `db:"citizen_address"  json:"citizen_address,omitempty"`
	FatherName          string     `db:"father_name"      json:"father_name,omitempty"`
	MotherName          string     `db:"mother_name"      json:"mother_name,omitempty"`
	DocumentType        string     `db:"document_type"    json:"document_type"`
	Purpose             string     `db:"purpose"          json:"purpose"`
	AdditionalInfo      string     `db:"additional_info"  json:"additional_info,omitempty"`
	WardCode            string     `db:"ward_code"        json:"ward_code"`
	OCRRawData          string     `db:"ocr_raw_data"     json:"ocr_raw_data,omitempty"`
	AssignedOfficer     string     `db:"assigned_officer" json:"assigned_officer,omitempty"`
	ApprovedByOfficerID string     `db:"approved_by_officer_id" json:"approved_by_officer_id,omitempty"`
	Status              string     `db:"status"           json:"status"`
	RejectionReason     string     `db:"rejection_reason" json:"rejection_reason,omitempty"`
	DTID                string     `db:"dtid"             json:"dtid,omitempty"`
	DocumentHash        string     `db:"document_hash"    json:"document_hash,omitempty"`
	IssuedDateBS        string     `db:"issued_date_bs"   json:"issued_date_bs,omitempty"`
	IssuedTimeNP        string     `db:"issued_time_np"   json:"issued_time_np,omitempty"`
	ValidUntilBS        string     `db:"valid_until_bs"   json:"valid_until_bs,omitempty"`
	SubmittedAt         time.Time  `db:"submitted_at"     json:"submitted_at"`
	ReviewedAt          *time.Time `db:"reviewed_at"      json:"reviewed_at,omitempty"`
	ApprovedAt          *time.Time `db:"approved_at"      json:"approved_at,omitempty"`
	CompletedAt         *time.Time `db:"completed_at"     json:"completed_at,omitempty"`
	IssuedAt            time.Time  `db:"issued_at"        json:"issued_at"`
	IPAddress           string     `db:"ip_address"       json:"ip_address,omitempty"`
}

type AccessLogEntry struct {
	ID              int64     `db:"id"               json:"id"`
	QueriedDTID     string    `db:"queried_dtid"     json:"queried_dtid"`
	RequesterID     string    `db:"requester_id"     json:"requester_id"`
	RequesterType   string    `db:"requester_type"   json:"requester_type"`
	RequesterAgency string    `db:"requester_agency" json:"requester_agency,omitempty"`
	Result          string    `db:"result"           json:"result"`
	IPAddress       string    `db:"ip_address"       json:"ip_address"`
	ResponseMS      int       `db:"response_ms"      json:"response_ms"`
	QueriedAt       time.Time `db:"queried_at"       json:"queried_at"`
}

type AIChatLog struct {
	ID         int64     `db:"id" json:"id"`
	SessionID  string    `db:"session_id" json:"session_id"`
	CitizenNID string    `db:"citizen_nid" json:"citizen_nid"`
	Query      string    `db:"query" json:"query"`
	Response   string    `db:"response" json:"response"`
	Language   string    `db:"language" json:"language"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// ── Request Payloads (citizen → backend) ────────────────────

type CitizenRequestPayload struct {
	CitizenNID     string `json:"citizen_nid"`
	CitizenName    string `json:"citizen_name"`
	CitizenPhone   string `json:"citizen_phone"`
	DocumentType   string `json:"document_type"`
	Purpose        string `json:"purpose"`
	AdditionalInfo string `json:"additional_info"`
	WardCode       string `json:"ward_code"`
	OCRRawData     string `json:"ocr_raw_data"`
}

type OfficerApprovePayload struct {
	RequestID string `json:"request_id"`
	OfficerID string `json:"officer_id"`
}

type OfficerRejectPayload struct {
	RequestID       string `json:"request_id"`
	OfficerID       string `json:"officer_id"`
	RejectionReason string `json:"rejection_reason"`
}

type LoginPayload struct {
	OfficerID string `json:"officer_id"`
	PIN       string `json:"pin"`
}

// ── Response Payloads (backend → client) ────────────────────

type CitizenRequestResponse struct {
	Success     bool   `json:"success"`
	RequestID   string `json:"request_id"`
	Message     string `json:"message"`
	WardCode    string `json:"ward_code"`
	SubmittedAt string `json:"submitted_at"`
	EstimatedAt string `json:"estimated_at"`
}

type RequestStatusResponse struct {
	Success      bool   `json:"success"`
	RequestID    string `json:"request_id"`
	Status       string `json:"status"`
	DocumentType string `json:"document_type"`
	Purpose      string `json:"purpose"`
	WardCode     string `json:"ward_code"`
	SubmittedAt  string `json:"submitted_at"`
	UpdatedAt    string `json:"updated_at,omitempty"`
	DTID         string `json:"dtid,omitempty"`
	QRData       string `json:"qr_data,omitempty"`
	Message      string `json:"message"`
}

type ApproveResponse struct {
	Success      bool   `json:"success"`
	RequestID    string `json:"request_id"`
	DTID         string `json:"dtid"`
	DocumentHash string `json:"document_hash"`
	QRData       string `json:"qr_data"`
	Message      string `json:"message"`
	IssuedAt     string `json:"issued_at"`
}

type VerifyResponse struct {
	Status          string `json:"status"`
	DTID            string `json:"dtid"`
	DocumentType    string `json:"document_type,omitempty"`
	IssuedDate      string `json:"issued_date,omitempty"`
	IssuingWard     string `json:"issuing_ward,omitempty"`
	CurrentlyActive bool   `json:"currently_active"`
	VerificationID  string `json:"verification_id"`
	Message         string `json:"message"`
	// Deliberately no personal data fields
}

type LoginResponse struct {
	Success bool     `json:"success"`
	Token   string   `json:"token,omitempty"`
	Officer *Officer `json:"officer,omitempty"`
	Message string   `json:"message"`
}

type DashboardStats struct {
	TotalDocuments      int64            `json:"total_documents"`
	IssuedToday         int64            `json:"issued_today"`
	ActiveDocuments     int64            `json:"active_documents"`
	TamperedAlerts      int64            `json:"tampered_alerts"`
	VerificationsToday  int64            `json:"verifications_today"`
	PendingRequests     int64            `json:"pending_requests"`
	DocumentsByType     map[string]int64 `json:"documents_by_type"`
	DocumentsByProvince map[string]int64 `json:"documents_by_province"`
	RecentEntries       []LedgerEntry    `json:"recent_entries"`
}

// SSEEvent — for real-time ministry live feed
type SSEEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// ── PDF Generation Models ────────────────────────────────────

// PDFRequest — full data needed to generate a Sifaris PDF
// This is assembled by the handler from DB data
type PDFRequest struct {
	// Document identity
	DTID         string
	DocumentHash string // first 16 chars shown on PDF
	DocumentType string
	RequestID    string

	// Citizen details
	CitizenName    string
	CitizenNID     string
	CitizenDOB     string // "२०१५/०४/१२" — Nepali BS date
	CitizenGender  string // "पुरुष" / "महिला" / "अन्य"
	CitizenAddress string // "वडा ९, कास्की, गण्डकी"
	FatherName     string // "श्री ..." or "श्रीमती ..."
	MotherName     string

	// Purpose
	Purpose        string
	AdditionalInfo string

	// Office details
	OfficerName  string
	OfficerDesig string
	WardCode     string
	WardNumber   string // "९"
	DistrictName string // "कास्की"
	ProvinceName string // "गण्डकी प्रदेश"
	OfficeName   string // "पोखरा महानगरपालिका"
	OfficePhone  string // "०६१-५२०७४३"
	OfficeEmail  string // "ward9@pokharamun.gov.np"

	// Dates and validity
	IssuedDateBS string // "२०८२ भाद्र १५"
	IssuedTimeNP string // "दिउसो २:३५"
	ValidUntilBS string // "२०८२ असोज १५" (30 days)
	IssuedAtUTC  time.Time

	// Verification
	VerifyURL string // "verify.pratibimba.gov.np/NPL-..."
}

// PDFResult — what the generator returns
type PDFResult struct {
	Bytes     []byte
	Filename  string
	PageCount int
}
