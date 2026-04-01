# 🚨 CRITICAL PATH — WEEK 1 SPRINT

**Deadline**: You have ~10 days left (based on your mention of "deadline coming very near")  
**Reality Check**: You're at 50% complete. To go from 50% → 100% production-ready in 10 days is TIGHT. This requires strict prioritization.

---

## 📋 WHAT MUST HAPPEN THIS WEEK (Days 1-5)

### DAY 1: Database & Handlers (Everything Functional)

**Duration**: 8 hours

#### TASK 1.1: Create Migration File `002_citizen_portal.sql`
**Time**: 30 minutes

Location: `migrations/002_citizen_portal.sql`

Copy this exactly:
```sql
-- ============================================================
-- MIGRATION 002: CITIZEN PORTAL TABLES
-- Run: psql -d pratibimba -f migrations/002_citizen_portal.sql
-- ============================================================

-- CITIZEN PROFILES
CREATE TABLE IF NOT EXISTS citizen_profiles (
    nid              VARCHAR(30) PRIMARY KEY,
    citizenship_no   VARCHAR(30) NOT NULL,
    full_name        VARCHAR(100) NOT NULL,
    full_name_ne     VARCHAR(100),
    dob              DATE,
    gender           VARCHAR(10),
    father_name      VARCHAR(100),
    mother_name      VARCHAR(100),
    ward_code        VARCHAR(20) NOT NULL,
    ward_number      SMALLINT,
    district         VARCHAR(50),
    province         VARCHAR(50),
    phone            VARCHAR(20),
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citizen_ward ON citizen_profiles(ward_code);
CREATE INDEX idx_citizen_active ON citizen_profiles(is_active);

INSERT INTO citizen_profiles (nid, citizenship_no, full_name, full_name_ne, dob, gender, father_name, mother_name, ward_code, ward_number, district, province, phone)
VALUES
('12345678901', '01-02-03-04567', 'Rajesh KC', 'राजेश के.सी.', '1985-06-15', 'Male', 'Hari Bahadur KC', 'Kamala KC', 'NPL-04-33-09', 9, 'Kaski', 'Gandaki', '9800000000'),
('98765432109', '05-06-07-08901', 'Anita Sharma', 'अनिता शर्मा', '1990-03-20', 'Female', 'Ram Prasad Sharma', 'Sunita Sharma', 'NPL-04-33-09', 9, 'Kaski', 'Gandaki', '9841234567')
ON CONFLICT (nid) DO NOTHING;

-- TAX RECORDS
CREATE TABLE IF NOT EXISTS tax_records (
    id              BIGSERIAL PRIMARY KEY,
    citizen_nid     VARCHAR(30) NOT NULL,
    tax_year        SMALLINT NOT NULL,
    property_tax    DECIMAL(12,2) DEFAULT 0,
    business_tax    DECIMAL(12,2) DEFAULT 0,
    total_amount    DECIMAL(12,2) NOT NULL,
    paid_amount     DECIMAL(12,2) DEFAULT 0,
    due_date        DATE,
    status          VARCHAR(20) DEFAULT 'UNPAID',
    payment_ref     VARCHAR(60),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_citizen ON tax_records(citizen_nid);
CREATE INDEX idx_tax_year ON tax_records(tax_year);
CREATE INDEX idx_tax_status ON tax_records(status);

INSERT INTO tax_records (citizen_nid, tax_year, property_tax, business_tax, total_amount, paid_amount, due_date, status)
VALUES
('12345678901', 2082, 8500.00, 0, 8500.00, 0, '2082-09-30', 'UNPAID'),
('12345678901', 2081, 8200.00, 0, 8200.00, 8200.00, '2081-09-30', 'PAID'),
('98765432109', 2082, 5000.00, 15000.00, 20000.00, 10000.00, '2082-09-30', 'PARTIAL');

-- NOTICES
CREATE TABLE IF NOT EXISTS notices (
    id              BIGSERIAL PRIMARY KEY,
    notice_id       VARCHAR(60) UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    title_ne        TEXT,
    category        VARCHAR(50) NOT NULL,
    content         TEXT,
    content_ne      TEXT,
    ward_code       VARCHAR(20),
    is_urgent       BOOLEAN DEFAULT false,
    published_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_notice_category ON notices(category);
CREATE INDEX idx_notice_ward ON notices(ward_code);
CREATE INDEX idx_notice_urgent ON notices(is_urgent);

INSERT INTO notices (notice_id, title, title_ne, category, content, is_urgent, ward_code, expires_at)
VALUES
('NTC-001', 'Water Supply Interruption', 'पानी आपूर्ति बन्द', 'URGENT', 'Water supply interrupted 2082/06/15 8AM-4PM for maintenance.', true, 'NPL-04-33-09', '2082-06-15 16:00:00+05:45'),
('NTC-002', 'Road Widening Project', 'सडक चौडाइ परियोजना', 'INFRASTRUCTURE', 'Prithvi Chowk to Airport road widening begins next week.', false, NULL, '2082-07-15 23:59:59+05:45');

-- GRIEVANCES
CREATE TABLE IF NOT EXISTS grievances (
    id              BIGSERIAL PRIMARY KEY,
    grievance_id    VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    citizen_name    VARCHAR(100) NOT NULL,
    ward_code       VARCHAR(20) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    location_lat    DECIMAL(10,7),
    location_lng    DECIMAL(10,7),
    location_desc   VARCHAR(200),
    photo_url       TEXT,
    status          VARCHAR(30) DEFAULT 'OPEN',
    assigned_officer VARCHAR(60),
    assigned_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_grv_ward ON grievances(ward_code);
CREATE INDEX idx_grv_status ON grievances(status);
CREATE INDEX idx_grv_citizen ON grievances(citizen_nid);

-- QUEUE TOKENS
CREATE TABLE IF NOT EXISTS queue_tokens (
    id              BIGSERIAL PRIMARY KEY,
    token_id        VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    ward_code       VARCHAR(20) NOT NULL,
    service_type    VARCHAR(50) NOT NULL,
    token_number    INTEGER NOT NULL,
    estimated_time  TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'WAITING',
    booked_at       TIMESTAMPTZ DEFAULT NOW(),
    called_at       TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_queue_ward_date ON queue_tokens(ward_code, booked_at DESC);
CREATE INDEX idx_queue_citizen ON queue_tokens(citizen_nid);

-- SOCIAL SECURITY (BHATTA)
CREATE TABLE IF NOT EXISTS social_security (
    id              BIGSERIAL PRIMARY KEY,
    citizen_nid     VARCHAR(30) NOT NULL,
    scheme_type     VARCHAR(50) NOT NULL,
    monthly_amount  DECIMAL(10,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'ACTIVE',
    last_disbursed  DATE,
    next_disbursal  DATE,
    bank_account    VARCHAR(30),
    bank_name       VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bhatta_citizen ON social_security(citizen_nid);
CREATE INDEX idx_bhatta_status ON social_security(status);

INSERT INTO social_security (citizen_nid, scheme_type, monthly_amount, status, last_disbursed, next_disbursal, bank_account)
VALUES
('12345678901', 'BRIDDHA_BHATTA', 2000.00, 'ACTIVE', '2082-06-01', '2082-07-01', '90010123456789'),
('98765432109', 'SINGLE_MOTHER', 3500.00, 'ACTIVE', '2082-06-05', '2082-07-05', '90010987654321');

SELECT 'Migration 002 complete.' AS status;
```

✅ **Test it**:
```bash
psql -d pratibimba -f migrations/002_citizen_portal.sql
# Should output: Migration 002 complete.
```

---

#### TASK 1.2: Fix All 8 Citizen Portal Handlers
**Time**: 4 hours

These handlers are currently querying non-existent tables. Now that the tables exist, let's make sure they return real data.

**File**: `internal/handlers/citizen_portal.go` (lines 16-420)

Your current code queries the right tables but has bugs:
1. Some queries reference non-existent columns
2. Error handling returns generic "Database error"
3. No null-coalescing for optional fields

**What you need to do**:
1. Review each handler function (GetCitizenProfile, GetTaxRecords, GetNotices, etc.)
2. Check column names match the schema you just created
3. Test each one manually

**I'll provide exact fixes below (TASK 1.3)**

---

#### TASK 1.3: Test Migration & Handlers
**Time**: 20 minutes

```bash
# Terminal 1: Start server
cd c:\Users\lamic\OneDrive\Desktop\NDO\backend
go run main.go

# Terminal 2: Test citizen endpoints
curl -X GET "http://localhost:3000/citizen/profile/12345678901"
# Should return citizen profile

curl -X GET "http://localhost:3000/citizen/tax/12345678901"
# Should return tax records array

curl -X GET "http://localhost:3000/citizen/notices/NPL-04-33-09"
# Should return notices array

curl -X POST "http://localhost:3000/citizen/grievance" \
  -H "Content-Type: application/json" \
  -d '{
    "citizen_nid": "12345678901",
    "citizen_name": "Rajesh KC",
    "ward_code": "NPL-04-33-09",
    "category": "POTHOLE",
    "description": "Pothole on Main Street",
    "location_lat": 28.2096,
    "location_lng": 83.9856,
    "location_desc": "Near City Hall"
  }'

# Check database directly
psql -d pratibimba -c "SELECT COUNT(*) FROM citizen_profiles;"
# Should return 2

psql -d pratibimba -c "SELECT COUNT(*) FROM tax_records;"
# Should return 3
```

---

### DAY 2: Security Fix & Input Validation (3 hours)

#### TASK 2.1: Fix CORS (Security Critical)
**Time**: 15 minutes

**File**: `main.go` (line 51)

**Current** (❌ WRONG):
```go
app.Use(cors.New(cors.Config{
    AllowOrigins: "*",  // ❌ Anyone can call your API
    ...
}))
```

**New** (✅ CORRECT):
```go
app.Use(cors.New(cors.Config{
    AllowOrigins: "https://pratibimba-android.app,http://localhost:3000",  // ✅ Only your apps
    AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    AllowHeaders: "Origin,Content-Type,Authorization",
    MaxAge:       3600,
    AllowCredentials: false,
}))
```

Replace this in main.go and restart server.

---

#### TASK 2.2: Add Input Validators
**Time**: 1.5 hours

Create new file: `internal/validators/validators.go`

```go
package validators

import (
    "fmt"
    "regexp"
    "strings"
)

// ValidateNID checks Nepal ID format: 11 digits
func ValidateNID(nid string) error {
    if len(nid) != 11 {
        return fmt.Errorf("nid must be 11 digits, got %d", len(nid))
    }
    if !regexp.MustCompile(`^\d{11}$`).MatchString(nid) {
        return fmt.Errorf("nid must contain only digits")
    }
    return nil
}

// ValidateWardCode checks format: NPL-04-33-09
func ValidateWardCode(code string) error {
    parts := strings.Split(code, "-")
    if len(parts) != 4 || parts[0] != "NPL" {
        return fmt.Errorf("invalid ward code format")
    }
    return nil
}

// ValidatePhoneNumber checks Nepal phone format
func ValidatePhoneNumber(phone string) error {
    if len(phone) < 10 || len(phone) > 15 {
        return fmt.Errorf("phone must be 10-15 digits")
    }
    if !regexp.MustCompile(`^\d+$`).MatchString(phone) {
        return fmt.Errorf("phone must contain only digits")
    }
    return nil
}

// ValidateDocumentType checks valid document types
func ValidateDocumentType(docType string) error {
    valid := map[string]bool{
        "SIFARIS": true,
        "TAX_CLEARANCE": true,
        "LAND_REGISTRATION": true,
        "BIRTH_CERTIFICATE": true,
        "DEATH_CERTIFICATE": true,
        "RELATIONSHIP_CERT": true,
        "INCOME_PROOF": true,
        "BUSINESS_REGISTRATION": true,
        "CONTRACT_AWARD": true,
        "BUDGET_ALLOCATION": true,
    }
    if !valid[docType] {
        return fmt.Errorf("invalid document type: %s", docType)
    }
    return nil
}

// ValidateGrievanceCategory checks valid categories
func ValidateGrievanceCategory(category string) error {
    valid := map[string]bool{
        "POTHOLE": true,
        "STREETLIGHT": true,
        "WATER_LEAK": true,
        "GARBAGE": true,
        "SEWAGE": true,
        "OTHER": true,
    }
    if !valid[category] {
        return fmt.Errorf("invalid grievance category: %s", category)
    }
    return nil
}
```

Now update handlers to use these validators. Example:

**File**: `internal/handlers/citizen_portal.go`

Find this function:
```go
func GetCitizenProfile(db *database.DB) fiber.Handler {
    return func(c *fiber.Ctx) error {
        nid := c.Params("nid")
        if nid == "" {
            return c.Status(400).JSON(fiber.Map{"success": false, "message": "NID required"})
        }
        // ... rest of code
```

Add validation:
```go
func GetCitizenProfile(db *database.DB) fiber.Handler {
    return func(c *fiber.Ctx) error {
        nid := c.Params("nid")
        
        // Add this validation
        if err := validators.ValidateNID(nid); err != nil {
            return c.Status(400).JSON(fiber.Map{
                "success": false,
                "message": err.Error(),
            })
        }
        
        // ... rest of code unchanged
```

Do the same for:
- `SubmitGrievance`: validate citizen_nid, category, ward_code
- `SubmitRequest` in citizen.go: validate nid, document_type

---

#### TASK 2.3: Improve Error Messages
**Time**: 20 minutes

Find all instances of:
```go
return c.Status(500).JSON(fiber.Map{"success": false, "message": "Database error"})
```

Change to:
```go
log.Printf("ERROR: GetCitizenProfile query failed (nid=%s): %v", nid, err)
return c.Status(500).JSON(fiber.Map{
    "success": false,
    "message": "Unable to fetch profile. Please try again.",
})
```

This prevents SQL internals leaking to the client while logging the real error.

---

### DAY 3: Testing & Load Test (4 hours)

#### TASK 3.1: Manual Endpoint Testing
**Time**: 1 hour

Create a test file: `TEST_ENDPOINTS.md`

```markdown
# Endpoint Test Checklist

## CITIZEN ENDPOINTS

### GET /citizen/profile/:nid
```bash
curl http://localhost:3000/citizen/profile/12345678901
# Expected: 200 OK with citizen profile
curl http://localhost:3000/citizen/profile/invalid
# Expected: 400 Bad Request (invalid NID)
curl http://localhost:3000/citizen/profile/00000000000
# Expected: 404 Not Found (no such citizen)
```

### GET /citizen/tax/:nid
```bash
curl http://localhost:3000/citizen/tax/12345678901
# Expected: 200 OK with tax_records array
```

### GET /citizen/notices/:wardCode
```bash
curl http://localhost:3000/citizen/notices/NPL-04-33-09
# Expected: 200 OK with notices array
```

### POST /citizen/grievance
```bash
curl -X POST http://localhost:3000/citizen/grievance \
  -H "Content-Type: application/json" \
  -d '{
    "citizen_nid": "12345678901",
    "citizen_name": "Rajesh KC",
    "ward_code": "NPL-04-33-09",
    "category": "POTHOLE",
    "description": "Big pothole on Main Street"
  }'
# Expected: 201 Created with grievance_id
```

### GET /citizen/grievances/:nid
```bash
curl http://localhost:3000/citizen/grievances/12345678901
# Expected: 200 OK with grievances array
```

### POST /citizen/queue/book
```bash
curl -X POST http://localhost:3000/citizen/queue/book \
  -H "Content-Type: application/json" \
  -d '{
    "citizen_nid": "12345678901",
    "ward_code": "NPL-04-33-09",
    "service_type": "DOCUMENT_REQUEST"
  }'
# Expected: 201 Created with token_id, token_number
```

### GET /citizen/bhatta/:nid
```bash
curl http://localhost:3000/citizen/bhatta/12345678901
# Expected: 200 OK with social security schemes array
```

## VERIFY ENDPOINT

### GET /verify/:dtid
```bash
curl http://localhost:3000/verify/NPL-04-33-09-2082-000001
# Expected: 200 OK OR 404 Not Found (if not approved yet)
```
```

Test each endpoint and mark ✅ or ❌.

---

#### TASK 3.2: Load Test (Concurrent Requests)
**Time**: 1.5 hours

Install Apache Bench (if not already installed):
```bash
# Windows: choco install apache-2.4-httpd
# Or download standalone ab.exe
```

Run load test:
```bash
# Test endpoint with 100 concurrent requests
ab -n 1000 -c 100 http://localhost:3000/citizen/profile/12345678901
# Should show:
# - Requests per second: > 500
# - Failed requests: 0
# - P99 response time: < 500ms
```

If response time > 500ms, add indexes (see DATABASE OPTIMIZATION section).

---

#### TASK 3.3: Simple Integration Test
**Time**: 1 hour

Create file: `main_test.go`

```go
package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "testing"
)

func TestCitizenProfile(t *testing.T) {
    resp, err := http.Get("http://localhost:3000/citizen/profile/12345678901")
    if err != nil {
        t.Fatalf("Request failed: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        t.Errorf("Expected status 200, got %d", resp.StatusCode)
    }

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)

    if !result["success"].(bool) {
        t.Error("Response success should be true")
    }
}

func TestInvalidNID(t *testing.T) {
    resp, err := http.Get("http://localhost:3000/citizen/profile/invalid")
    if err != nil {
        t.Fatalf("Request failed: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != 400 {
        t.Errorf("Expected status 400 for invalid NID, got %d", resp.StatusCode)
    }
}
```

Run: `go test -v`

---

### DAY 4: Documentation (2 hours)

#### TASK 4.1: API Documentation (Swagger/OpenAPI)
**Time**: 1.5 hours

Create file: `API_DOCS.md`

```markdown
# PRATIBIMBA Backend API Documentation

## Base URL
`https://api.pratibimba.gov.np` (production)
`http://localhost:3000` (local development)

## Authentication
Most endpoints are public. Officer endpoints require JWT token.

### Officer Login
```
POST /officer/login
Content-Type: application/json

{
    "officer_id": "WO-04-33-09-001",
    "pin": "1234"
}

Response: 200 OK
{
    "success": true,
    "token": "eyJhbGc...",
    "expires_in": 28800
}
```

All subsequent officer requests include header:
```
Authorization: Bearer <token>
```

## Endpoints Reference

### 1. Citizen Profile
**GET** `/citizen/profile/:nid`
- **Parameters**: `nid` (string, 11 digits)
- **Response**: 200 OK
  ```json
  {
    "success": true,
    "profile": {
      "nid": "12345678901",
      "full_name": "Rajesh KC",
      "ward_code": "NPL-04-33-09",
      "phone": "9800000000"
    }
  }
  ```
- **Errors**: 400 (invalid NID), 404 (not found), 500 (database error)

### 2. Tax Records
**GET** `/citizen/tax/:nid`
- **Parameters**: `nid` (string, 11 digits)
- **Response**: 200 OK
  ```json
  {
    "success": true,
    "records": [
      {
        "tax_year": 2082,
        "property_tax": 8500.00,
        "total_amount": 8500.00,
        "paid_amount": 0,
        "status": "UNPAID"
      }
    ]
  }
  ```

... (continue for all endpoints)
```

---

#### TASK 4.2: Deployment Guide
**Time**: 30 minutes

Create file: `DEPLOYMENT.md`

```markdown
# Deployment Guide

## Prerequisites
- PostgreSQL 13+
- Go 1.22+
- Docker (optional)

## Local Development
```bash
# 1. Clone repository
git clone <repo-url>
cd backend

# 2. Setup environment
cp .env.example .env
# Edit .env with your database URL and JWT secret

# 3. Run migrations
psql -d pratibimba -f migrations/001_init.sql
psql -d pratibimba -f migrations/002_citizen_portal.sql

# 4. Start server
go run main.go
# Server listens on http://localhost:3000

# 5. Test health
curl http://localhost:3000/health
```

## Production Deployment (Docker)
```bash
# 1. Build Docker image
docker build -t pratibimba-backend .

# 2. Run with docker-compose
docker-compose up -d

# 3. Check logs
docker logs -f <container-id>
```

## .env Configuration
```
DATABASE_URL=postgres://user:password@localhost:5432/pratibimba
JWT_SECRET=your-secret-key-at-least-32-chars-long
PORT=3000
APP_VERSION=1.0.0
APP_NAME=PRATIBIMBA
```
```

---

### DAY 5: Final Integration Check (2 hours)

#### TASK 5.1: End-to-End Flow Test
**Time**: 1 hour

Simulate a complete citizen request flow:

1. Citizen submits request
   ```bash
   curl -X POST http://localhost:3000/citizen/request \
     -H "Content-Type: application/json" \
     -d '{
       "citizen_nid": "12345678901",
       "citizen_name": "Rajesh KC",
       "citizen_phone": "9800000000",
       "document_type": "SIFARIS",
       "purpose": "Bank Loan Letter",
       "ward_code": "NPL-04-33-09"
     }'
   # Note: request_id returned (e.g., REQ-2082-000001)
   ```

2. Citizen checks status
   ```bash
   curl http://localhost:3000/citizen/request/REQ-2082-000001
   # Should return PENDING
   ```

3. Officer logs in
   ```bash
   curl -X POST http://localhost:3000/officer/login \
     -H "Content-Type: application/json" \
     -d '{
       "officer_id": "WO-04-33-09-001",
       "pin": "1234"
     }'
   # Note: token returned
   ```

4. Officer views queue
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/officer/queue
   # Should show pending request
   ```

5. Officer approves
   ```bash
   curl -X POST http://localhost:3000/officer/approve \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"request_id": "REQ-2082-000001"}'
   # Note: DTID returned (e.g., NPL-04-33-09-2082-000001)
   ```

6. Citizen checks status again
   ```bash
   curl http://localhost:3000/citizen/request/REQ-2082-000001
   # Should return APPROVED with DTID
   ```

7. Bank verifies document
   ```bash
   curl http://localhost:3000/verify/NPL-04-33-09-2082-000001
   # Should return {"status": "VALID"}
   ```

✅ If all 7 steps succeed, **your backend is ready for handoff to Android team!**

---

#### TASK 5.2: Checklist Before Handing to Android Team
**Time**: 1 hour

- [ ] All 8 citizen portal endpoints tested & working
- [ ] All responses use standard format: `{"success": true/false, "data": {...}, "message": "..."}`
- [ ] All errors return descriptive messages (no SQL leaks)
- [ ] CORS configured correctly (not "*")
- [ ] Rate limiting active (verify: 100 rapid requests = 429 Too Many Requests)
- [ ] Input validation active (test invalid NID = 400 Bad Request)
- [ ] Database migration files created & documented
- [ ] API documentation exists (API_DOCS.md)
- [ ] Deployment guide exists (DEPLOYMENT.md)
- [ ] Load test passed (100 concurrent requests, <500ms response)
- [ ] All demo data seeded (test with predefined NIDs)
- [ ] Health endpoint working: `GET /health` → 200 OK

---

## 🎬 WEEK 1 IMPLEMENTATION CHECKLIST

### Monday (Day 1)
- [ ] Create `002_citizen_portal.sql` migration
- [ ] Run migration locally & verify tables exist
- [ ] Test all 8 citizen endpoints manually
- [ ] Document any errors

### Tuesday (Day 2)
- [ ] Fix CORS in main.go
- [ ] Create validators package
- [ ] Add NID/ward code/category validation to handlers
- [ ] Improve error messages (no SQL leaks)
- [ ] Test validators

### Wednesday (Day 3)
- [ ] Create TEST_ENDPOINTS.md test checklist
- [ ] Run each endpoint via curl/Postman, mark pass/fail
- [ ] Run load test (ab -n 1000 -c 100)
- [ ] Create integration tests (_test.go files)

### Thursday (Day 4)
- [ ] Write API documentation (API_DOCS.md)
- [ ] Write deployment guide (DEPLOYMENT.md)
- [ ] Document environment variables
- [ ] Create simple README for Android team

### Friday (Day 5)
- [ ] Run complete end-to-end flow (7 steps: submit → approve → verify)
- [ ] Verify all endpoints return correct data types
- [ ] Final security check (no hardcoded secrets, validator coverage)
- [ ] Prepare deliverable packages
- [ ] Hand off to Android team with clear API docs

---

## 📊 SUCCESS CRITERIA FOR WEEK 1

By end of week, your backend should have:

✅ **Functionality**: All 18 endpoints working (0 broken stubs)  
✅ **Database**: All 6 citizen portal tables created + seeded  
✅ **Validation**: NID, ward code, categories validated on input  
✅ **Security**: CORS restricted, validators active, no SQL injection  
✅ **Testing**: Manual tests pass, load test passes, integration tests written  
✅ **Documentation**: API docs complete, deployment guide complete  
✅ **Handoff**: Ready for Android team integration  

---

## 🚨 IF YOU RUN OUT OF TIME

**Priority 1 (MUST DO)**: Database tables + handlers (Day 1-2)
**Priority 2 (SHOULD DO)**: Validators + error messages (Day 2)
**Priority 3 (NICE TO HAVE)**: Tests + documentation (Day 3-4)
**Priority 4 (POSTPONE)**: Advanced logging, caching (after launch)

If you have to cut something, cut the tests and documentation, but **NEVER** cut database creation or CORS fixes.

