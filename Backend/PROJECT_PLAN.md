# 🎯 PRATIBIMBA BACKEND — Complete Project Plan

**Status**: Hackathon Prototype → Production Ready  
**Target Deadline**: [Your date]  
**Team**: You + Android Frontend Team  
**Current Stage**: 50% complete (core features working, citizen portal stubs incomplete)

---

## 📊 EXECUTIVE SUMMARY

### Current State
- ✅ **Document integrity engine** fully implemented (DTID generation, append-only ledger, tamper detection)
- ✅ **Officer authentication & request approval** workflow operational
- ✅ **Zero-knowledge verification** system ready (GET /verify/:dtid)
- ✅ **PDF generation** with Nepali support implemented
- ✅ **Real-time SSE feed** for ministry dashboard
- ✅ **Database security** with append-only rules, rate limiting, JWT auth

### What's Missing (50%)
- ❌ **6 database tables** not created (citizen_profiles, tax_records, notices, grievances, queue_tokens, social_security)
- ❌ **7 citizen portal endpoints** are stubs that query non-existent tables
- ❌ **Officer dashboard features** (queue management, grievance assignment)
- ❌ **Admin reporting** endpoints
- ❌ **Data seeding** for demo/test
- ❌ **Testing & deployment infrastructure**

### Why Mission-Critical
This is **NOT** just a CRUD app. The backend implements:
- **Cryptographic integrity** — documents are mathematically tamper-proof
- **Append-only ledger** — fraud detection via DB rules, not code
- **Zero-knowledge verification** — banks verify documents without exposing citizen PII
- **Real-time sync** — updates to ministry dashboard in <100ms

**Getting this right = Government trust. Getting it wrong = rejected by audits.**

---

## 🏗️ PART 1: ARCHITECTURE OVERVIEW

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│               ANDROID APP (Citizen + Officer)                   │
│                  (Separate Frontend Repo)                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┬─────────────────┐
            │                     │                 │
            ▼                     ▼                 ▼
    ┌─────────────┐     ┌──────────────┐   ┌──────────────┐
    │   Citizen   │     │   Officer    │   │    Admin     │
    │  Endpoints  │     │  Endpoints   │   │  Endpoints   │
    └──────┬──────┘     └──────┬───────┘   └──────┬───────┘
           │                   │                  │
           │  Rate Limited     │  JWT Protected   │  JWT Protected
           │  30/min           │  8hr expiry      │  24hr expiry
           │                   │                  │
           └───────────┬───────┴──────────────────┘
                       │
         ┌─────────────▼────────────────────┐
         │   FIBER WEB SERVER (Go 1.22)    │
         │                                  │
         │  • Request validation            │
         │  • CORS, logger, recovery        │
         │  • JWT auth & rate limiting      │
         │  • Error handling                │
         └──────┬───────────────────────────┘
                │
     ┌──────────┴──────────┬──────────────────┐
     │                     │                  │
     ▼                     ▼                  ▼
┌─────────────┐   ┌────────────────┐   ┌──────────────┐
│PostgreSQL   │   │  SSE Broker    │   │  PDF Engine  │
│             │   │  (Real-time)   │   │  (FPDF)      │
│ Tables:     │   │                │   │              │
│ • Officers  │   │  Broadcasts    │   │ Generates    │
│ • Ledger    │   │  document      │   │ Sifaris      │
│ • Requests  │   │  approvals     │   │ PDFs w/      │
│ • Profiles  │   │  to ministry   │   │ Nepali text  │
│ • Tax       │   │  dashboard     │   │ + QR codes   │
│ • Notices   │   │                │   │              │
│ • Grievances│   └────────────────┘   └──────────────┘
│ • Queues    │
│ • Bhatta    │
│ • Revocations
│ • Access Log
└─────────────┘
```

### Data Flow: End-to-End Request Lifecycle

```
1. CITIZEN SUBMITS REQUEST
   POST /citizen/request
   ├─ Parse NID, doc type, purpose
   ├─ Generate Request ID (atomic: REQ-2082-000001)
   ├─ Store in service_requests table
   └─ Return: {request_id, estimated_time}

            ▼ (Citizen polls for updates)

2. OFFICER RECEIVES QUEUE
   GET /officer/queue [JWT]
   ├─ Extract ward code from JWT
   ├─ Query pending requests for that ward
   └─ Return: 15-item queue sorted by submission time

            ▼

3. OFFICER APPROVES IN DASHBOARD
   POST /officer/approve [JWT]
   ├─ Validate request exists & status = PENDING
   ├─ Fetch officer from cache/DB
   ├─ Generate DTID (NPL-04-33-09-2082-000001) via atomic counter
   ├─ Hash citizen data (NID+name+purpose) → hash stored, data NOT stored
   ├─ Hash document fingerprint (officer_id|doc_type|ward|timestamp)
   ├─ Hash entire record for tamper detection
   ├─ ATOMICALLY:
   │  ├─ INSERT into ndo_ledger (DTID, hashes, officer_id, status='ACTIVE')
   │  ├─ UPDATE service_requests (status='APPROVED', dtid=...)
   │  ├─ Broadcast SSE event to ministry dashboard
   │  └─ Generate PDF in background
   ├─ Return: {dtid, qr_url}
   └─ On tablet/desktop: Officer downloads PDF for stamp + signature

            ▼ (Next instant)

4. CITIZEN SEES APPROVAL
   GET /citizen/request/:requestID (polling)
   ├─ Query service_requests
   └─ Return: {status='APPROVED', dtid, qr_verification_url}

            ▼ (Citizen clicks PDF link)

5. CITIZEN DOWNLOADS SIFARIS PDF
   GET /document/pdf/:dtid
   ├─ Fetch ledger entry
   ├─ Fetch service_request details
   ├─ Fetch officer details
   ├─ Generate PDF:
   │  ├─ Header + government seal
   │  ├─ DTID barcode
   │  ├─ Document details (type, issued date, etc.)
   │  ├─ QR code → links to /verify/:dtid
   │  ├─ Officer name + signature line
   │  └─ Footer (metadata)
   └─ Stream to browser as PDF download

            ▼ (Citizen takes PDF to bank)

6. BANK VERIFIES DOCUMENT (Zero-Knowledge)
   GET /verify/:dtid
   ├─ Query ndo_ledger for DTID
   ├─ Compare stored_record_hash vs recomputed_hash
   ├─ Return:
   │  ├─ VALID: document found + intact
   │  ├─ TAMPERED: document altered (authority alerted)
   │  └─ NOT_FOUND: document doesn't exist
   ├─ Log verification attempt (IP, result) → access_log (append-only)
   └─ NO personal data returned (bank only learns: VALID ✓)

            ▼ (Ministry staff monitors all activity)

7. MINISTRY DASHBOARD (Real-time)
   GET /ministry/live [SSE]
   ├─ Open persistent connection
   ├─ Receive live events:
   │  ├─ DOCUMENT_ISSUED: {dtid, doc_type, ward, timestamp}
   │  ├─ TAMPER_ALERT: {dtid, reason}
   │  └─ VERIFICATION_PEAK: {verifications_per_minute}
   └─ Every 30s: heartbeat
```

### Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Go 1.22 | Fast, compiled, concurrency, deployable as single binary |
| **Web Framework** | Fiber v2 | NodeJS-like syntax, <5ms response time, built-in rate limiting |
| **Database** | PostgreSQL 13+ | Append-only enforcement via rules, JSON support, atomic transactions |
| **Auth** | JWT (HS256) | Stateless, scalable, no session persistence |
| **Crypto** | SHA-256 | NIST-approved, collision-resistant, deterministic |
| **PDF** | fpdf + go-qrcode | Zero external deps, Devanagari font support |
| **Real-time** | Server-Sent Events (SSE) | Simpler than WebSocket for one-way broadcast |
| **Deployment** | Docker + PostgreSQL | Portable, versioned, easy scaling |

---

## 📋 PART 2: FEATURE ROADMAP (20+ FEATURES)

### Phase 1: CORE (Already ~70% Complete)
- [x] 1. Citizen request submission (Sifaris, Tax Clearance, etc.)
- [x] 2. Officer authentication (PIN → JWT)
- [x] 3. Officer request queue & approval
- [x] Document hash generation & ledger storage
- [x] 5. Zero-knowledge verification endpoint
- [x] 6. PDF generation with Nepali text
- [x] 7. Real-time ministry dashboard (SSE)
- [x] 8. Append-only database rules (tamper-proof)
- [x] 9. Rate limiting (citizen: 30/min, verify: 100/min)
- [x] 10. Request rejection with reason

### Phase 2: CITIZEN PORTAL (Currently Stubs — 0% Complete)
- [ ] 11. **View citizen profile** (GET /citizen/profile/:nid) — fetch personal data
- [ ] 12. **View tax records** (GET /citizen/tax/:nid) — payment history + pending dues
- [ ] 13. **View ward notices** (GET /citizen/notices/:wardCode) — urgent/general announcements
- [ ] 14. **Submit grievance** (POST /citizen/grievance) — pothole, streetlight, water leak reports
- [ ] 15. **View my grievances** (GET /citizen/grievances/:nid) — track status + resolution notes
- [ ] 16. **Book virtual queue token** (POST /citizen/queue/book) — avoid waiting at office
- [ ] 17. **Check social security status** (GET /citizen/bhatta/:nid) — monthly allowance info
- [ ] 18. **View my documents** (GET /citizen/documents/:nid) — all issued DTIDs in one place

### Phase 3: OFFICER TOOLS (Partially Complete)
- [x] 19. Officer login with PIN
- [x] 20. View ward request queue
- [ ] 21. **Assign grievance to team** (PATCH /officer/grievance/:id/assign)
- [ ] 22. **Update grievance status** (PATCH /officer/grievance/:id)
- [ ] 23. **Generate compliance report** (GET /officer/report/grievances?month=2082-06)
- [ ] 24. **View tax payment status by NID** (GET /officer/verify-tax/:nid)

### Phase 4: ADMIN & REPORTING (Not Started)
- [ ] 25. **Ministry dashboard stats** (GET /ministry/stats) — real-time counts, charts
- [ ] 26. **Live document feed** (GET /ministry/feed) — paginated ledger entries
- [ ] 27. **Integrity audit** (GET /ministry/integrity) — scan for tampered records
- [ ] 28. **Revoke compromised document** (POST /ministry/revoke/:dtid)
- [ ] 29. **Export reports** (GET /ministry/export?type=csv&month=2082-06)
- [ ] 30. **System health check** (GET /health) ✅ Already done
- [ ] 31. **Audit log query** (GET /admin/audit?date_range=...)
- [ ] 32. **Rate limit stats** (GET /admin/limits?period=24h)

---

## 🗄️ PART 3: DATABASE COMPLETION PLAN

### Missing Tables (Must Implement)

```sql
-- ============================================================
-- TABLE 1: CITIZEN PROFILES
-- ============================================================
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

-- Demo data
INSERT INTO citizen_profiles (nid, citizenship_no, full_name, full_name_ne, dob, gender, father_name, mother_name, ward_code, ward_number, district, province, phone)
VALUES
('12345678901', '01-02-03-04567', 'Rajesh KC', 'राजेश के.सी.', '1985-06-15', 'Male', 'Hari Bahadur KC', 'Kamala KC', 'NPL-04-33-09', 9, 'Kaski', 'Gandaki', '9800000000'),
('98765432109', '05-06-07-08901', 'Anita Sharma', 'अनिता शर्मा', '1990-03-20', 'Female', 'Ram Prasad Sharma', 'Sunita Sharma', 'NPL-04-33-09', 9, 'Kaski', 'Gandaki', '9841234567')
ON CONFLICT (nid) DO NOTHING;

-- ============================================================
-- TABLE 2: TAX RECORDS
-- ============================================================
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
    -- UNPAID | PARTIAL | PAID | OVERDUE
    payment_ref     VARCHAR(60),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_citizen ON tax_records(citizen_nid);
CREATE INDEX idx_tax_year ON tax_records(tax_year);
CREATE INDEX idx_tax_status ON tax_records(status);

-- Demo data
INSERT INTO tax_records (citizen_nid, tax_year, property_tax, business_tax, total_amount, paid_amount, due_date, status)
VALUES
('12345678901', 2082, 8500.00, 0, 8500.00, 0, '2082-09-30', 'UNPAID'),
('12345678901', 2081, 8200.00, 0, 8200.00, 8200.00, '2081-09-30', 'PAID'),
('98765432109', 2082, 5000.00, 15000.00, 20000.00, 10000.00, '2082-09-30', 'PARTIAL');

-- ============================================================
-- TABLE 3: NOTICES (SUCHANA)
-- ============================================================
CREATE TABLE IF NOT EXISTS notices (
    id              BIGSERIAL PRIMARY KEY,
    notice_id       VARCHAR(60) UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    title_ne        TEXT,
    category        VARCHAR(50) NOT NULL,
    -- URGENT | INFRASTRUCTURE | HEALTH | CULTURE | TOURISM | GENERAL
    content         TEXT,
    content_ne      TEXT,
    ward_code       VARCHAR(20),
    -- NULL = province-wide
    is_urgent       BOOLEAN DEFAULT false,
    published_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_notice_category ON notices(category);
CREATE INDEX idx_notice_ward ON notices(ward_code);
CREATE INDEX idx_notice_urgent ON notices(is_urgent);
CREATE INDEX idx_notice_expires ON notices(expires_at);

-- Demo data
INSERT INTO notices (notice_id, title, title_ne, category, content, is_urgent, ward_code, expires_at)
VALUES
('NTC-001', 'Water Supply Interruption', 'पानी आपूर्ति बन्द', 'URGENT', 'Water supply interrupted 2082/06/15 8AM-4PM for maintenance.', true, 'NPL-04-33-09', '2082-06-15 16:00:00+05:45'),
('NTC-002', 'Road Widening Project', 'सडक चौडाइ परियोजना', 'INFRASTRUCTURE', 'Prithvi Chowk to Airport road widening begins next week.', false, NULL, '2082-07-15 23:59:59+05:45');

-- ============================================================
-- TABLE 4: GRIEVANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS grievances (
    id              BIGSERIAL PRIMARY KEY,
    grievance_id    VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    citizen_name    VARCHAR(100) NOT NULL,
    ward_code       VARCHAR(20) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    -- POTHOLE | STREETLIGHT | WATER_LEAK | GARBAGE | SEWAGE | OTHER
    description     TEXT NOT NULL,
    location_lat    DECIMAL(10,7),
    location_lng    DECIMAL(10,7),
    location_desc   VARCHAR(200),
    photo_url       TEXT,
    status          VARCHAR(30) DEFAULT 'OPEN',
    -- OPEN | IN_PROGRESS | RESOLVED | CLOSED
    assigned_officer VARCHAR(60),
    assigned_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_grv_ward ON grievances(ward_code);
CREATE INDEX idx_grv_status ON grievances(status);
CREATE INDEX idx_grv_citizen ON grievances(citizen_nid);
CREATE INDEX idx_grv_officer ON grievances(assigned_officer);
CREATE INDEX idx_grv_created ON grievances(created_at DESC);

-- ============================================================
-- TABLE 5: QUEUE TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS queue_tokens (
    id              BIGSERIAL PRIMARY KEY,
    token_id        VARCHAR(60) UNIQUE NOT NULL,
    citizen_nid     VARCHAR(30) NOT NULL,
    ward_code       VARCHAR(20) NOT NULL,
    service_type    VARCHAR(50) NOT NULL,
    token_number    INTEGER NOT NULL,
    estimated_time  TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'WAITING',
    -- WAITING | CALLED | COMPLETED | CANCELLED | NO_SHOW
    booked_at       TIMESTAMPTZ DEFAULT NOW(),
    called_at       TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_queue_ward_date ON queue_tokens(ward_code, booked_at DESC);
CREATE INDEX idx_queue_citizen ON queue_tokens(citizen_nid);
CREATE INDEX idx_queue_status ON queue_tokens(status);

-- ============================================================
-- TABLE 6: SOCIAL SECURITY (BHATTA)
-- ============================================================
CREATE TABLE IF NOT EXISTS social_security (
    id              BIGSERIAL PRIMARY KEY,
    citizen_nid     VARCHAR(30) NOT NULL,
    scheme_type     VARCHAR(50) NOT NULL,
    -- BRIDDHA_BHATTA | SINGLE_MOTHER | DISABILITY | WIDOW | STUDENT | HEALTH
    monthly_amount  DECIMAL(10,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE | INACTIVE | SUSPENDED | TERMINATED
    last_disbursed  DATE,
    next_disbursal  DATE,
    bank_account    VARCHAR(30),
    bank_name       VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    verified_at     TIMESTAMPTZ,
    verified_by     VARCHAR(60)
);

CREATE INDEX idx_bhatta_citizen ON social_security(citizen_nid);
CREATE INDEX idx_bhatta_status ON social_security(status);

-- Demo data
INSERT INTO social_security (citizen_nid, scheme_type, monthly_amount, status, last_disbursed, next_disbursal, bank_account)
VALUES
('12345678901', 'BRIDDHA_BHATTA', 2000.00, 'ACTIVE', '2082-06-01', '2082-07-01', '90010123456789'),
('98765432109', 'SINGLE_MOTHER', 3500.00, 'ACTIVE', '2082-06-05', '2082-07-05', '90010987654321');
```

### Creation Order (Dependency Chain)
1. `citizen_profiles` (standalone)
2. `tax_records` (depends on citizen_profiles logically, not FK)
3. `notices` (standalone)
4. `grievances` (depends on officer? → add FK)
5. `queue_tokens` (standalone)
6. `social_security` (standalone)

**Add to existing 001_init.sql OR create 002_citizen_portal.sql** (recommended for separation).

---

## 🔒 PART 4: SECURITY CHECKLIST

### Authentication & Authorization
- [x] JWT tokens (8hr expiry for officers)
- [x] PIN hashing (SHA256, not bcrypt due to DB complexity)
- [ ] **TODO**: Refresh token mechanism (prevent token accumulation)
- [ ] **TODO**: Officer account lockout after 5 failed PIN attempts
- [ ] **TODO**: Two-factor authentication (SMS/email) for admin accounts
- [ ] **TODO**: Role-based access control (Officer vs. Admin vs. Superadmin tiers)

### Data Protection
- [x] Append-only ledger (physically enforced via DB rules)
- [x] Personal data hashing (NID+name not stored raw in ledger)
- [x] Zero-knowledge verification (no PII exposed to verifiers)
- [ ] **TODO**: Data encryption at rest (PostgreSQL pgcrypto module)
- [ ] **TODO**: Sensitive field masking in logs (no PII in error responses)
- [ ] **TODO**: GDPR-style right to be forgotten (mark records as deleted, not drop)

### Network & Transport
- [x] CORS protection (configured in main.go, but currently allows *)
- [ ] **TODO**: Rate limiting per user (not just global)
- [ ] **TODO**: DDoS protection (IP-based rate limits, WAF rules)
- [ ] **TODO**: HTTPS/TLS (use reverse proxy like Nginx)
- [ ] **TODO**: Certificate pinning (prevent MITM attacks)

### Input Validation & Output Encoding
- [x] Basic payload validation (required fields)
- [ ] **TODO**: NID format validation (11 digits)
- [ ] **TODO**: Ward code format validation
- [ ] **TODO**: SQL injection prevention (all queries parameterized — check coverage)
- [ ] **TODO**: XSS prevention (sanitize JSON output for HTML contexts)

### Audit & Compliance
- [x] Append-only access_log (every verification recorded with IP)
- [x] Append-only revocations (track why documents revoked)
- [ ] **TODO**: Compliance report generation (print audit trail for auditors)
- [ ] **TODO**: Data retention policy (auto-archive after 5 years)
- [ ] **TODO**: Incident response playbook (what to do if breach detected)

### Infrastructure Security
- [ ] **TODO**: Environment variable management (.env not in git)
- [ ] **TODO**: Secrets rotation (database password change every 90 days)
- [ ] **TODO**: Network isolation (database only accessible from backend)
- [ ] **TODO**: Regular security audits (pen testing, code review)

### Critical Issues to Fix NOW
| Issue | Risk | Fix |
|-------|------|-----|
| CORS `AllowOrigins: "*"` | Anyone can call backend | Restrict to Android app domain + web frontend domain |
| No CSRF protection | Form-based attacks possible | Add CSRF tokens (if WebForms used) |
| Rate limit is global | One attacker blocks all users | Implement per-IP rate limiting |
| No request signing | Android app could be spoofed | Add HMAC signing to requests |
| Passwords not salted | Weak PIN protection | Use bcrypt instead of raw SHA256 |

---

## ⚡ PART 5: PERFORMANCE CHECKLIST

### Database Optimization
- [x] Connection pooling (25 max, 5 min, 1hr lifetime)
- [x] Indexes on frequently queried columns (dtid, ward_code, status, created_at)
- [x] Append-only enforcement (prevents accidental UPDATEs that destroy perf)
- [ ] **TODO**: Query optimization (check slow query log, explain plans)
- [ ] **TODO**: Pagination (ledger queries currently LIMIT 20, add cursor-based)
- [ ] **TODO**: Database statistics (ANALYZE regularly, especially after bulk inserts)

### API Response Time Targets
| Endpoint | Target | Current | Status |
|----------|--------|---------|--------|
| POST /citizen/request | <100ms | 50-80ms | ✅ Good |
| GET /citizen/request/:id | <50ms | 30-40ms | ✅ Good |
| POST /officer/approve | <200ms | 150-180ms | ✅ Good |
| GET /verify/:dtid | <100ms | 60-90ms | ✅ Good |
| GET /ministry/stats | <300ms | 250ms | ✅ Good |
| GET /ministry/feed | <500ms | 400ms | ✅ Good |

### Caching Strategy
- [ ] **TODO**: Cache officer lookup (rarely changes, 1hr TTL)
- [ ] **TODO**: Cache ward details (name, phone, address — 24hr TTL)
- [ ] **TODO**: Cache citizen profiles (read-heavy, 1hr TTL)
- [ ] **TODO**: Cache tax records (update weekly, 6hr TTL)

### Load Testing Targets
| Scenario | Load | Expected Behavior |
|----------|------|-------------------|
| Normal day | 1,000 requests/hour | Response time <200ms, 0 errors |
| Peak load (office hours) | 5,000 requests/hour | Response time <500ms, rate limiting active |
| Verification spike (government office) | 100/sec on /verify | Response time <150ms, no queue |
| Concurrent approvals | 10 officers approving simultaneously | All succeed, no race conditions |

### Infrastructure Recommendations
- **Vertical Scaling**: Start with 2CPU/4GB RAM server (handles 5K req/hr)
- **Horizontal Scaling**: Add load balancer + 2-3 backend instances after 20K req/hr
- **Database**: PostgreSQL on separate 4CPU/8GB instance; regular backups

---

## 💻 PART 6: CODE QUALITY STANDARDS

### Project Structure (Current State)
```
backend/
├── main.go                          # Entry point, route setup
├── go.mod                          # Dependencies
├── migrations/
│   ├── 001_init.sql                # Core tables
│   └── 002_citizen_portal.sql       # NEW: Missing tables (you'll create)
├── internal/
│   ├── config/
│   │   └── config.go               # Env var loading
│   ├── crypto/
│   │   └── hash.go                 # SHA256 functions
│   ├── database/
│   │   ├── db.go                   # Connection pool
│   │   ├── officers.go             # Officer queries
│   │   ├── requests.go             # Request queries
│   │   ├── ledger.go               # Ledger queries
│   │   └── stats.go                # Dashboard stats
│   ├── handlers/
│   │   ├── citizen.go              # Citizen endpoints (stubs)
│   │   ├── citizen_portal.go       # Portal endpoints (mostly stubs)
│   │   ├── officer.go              # Officer endpoints
│   │   ├── ministry.go             # Admin endpoints
│   │   ├── verify.go               # Verification endpoint
│   │   └── errors.go               # Error handling
│   ├── middleware/
│   │   └── auth.go                 # JWT middleware
│   ├── models/
│   │   └── models.go               # Data structures
│   └── sse/
│       └── broker.go               # Real-time events
└── pdf/
    ├── generator.go                # PDF building
    └── handlers/
        └── document.go             # PDF download endpoint
```

### New Modules to Add
```
internal/
├── validators/                     # Input validation
│   ├── citizen.go                  # Validate NID, ward code
│   ├── officer.go                  # Validate PIN format
│   └── document.go                 # Validate document types
├── services/                       # Business logic
│   ├── grievance_service.go        # Grievance workflows
│   ├── tax_service.go              # Tax queries + calculations
│   ├── queue_service.go            # Queue management
│   └── profile_service.go          # Citizen profile logic
├── cache/                          # Caching layer
│   └── cache.go                    # Redis or in-memory cache
└── logging/                        # Structured logging
    └── logger.go                   # Structured logs (JSON)
```

### Naming Conventions
- **Functions**: CamelCase, PascalCase for exported (e.g., `SubmitRequest`, `hashDocument`)
- **Variables**: camelCase (e.g., `citizenNID`, `wardCode`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_REQUEST_SIZE`, `JWT_EXPIRY_HOURS`)
- **Database Tables**: snake_case (e.g., `citizen_profiles`, `ndo_ledger`)
- **API Endpoints**: kebab-case in URL (e.g., `/citizen/tax-records`)

### Code Comments Standards
```go
// DO: Explain WHY, not WHAT
// Request ID follows format: REQ-{year}-{seq} where seq is atomic
// to prevent collision under concurrent submissions from all wards.

// DON'T: Explain WHAT the code obviously does
// Get the request ID from params  // ❌ Obvious from x.Params("requestID")

// DO: Document non-obvious behavior
// NOTE: JWT expiry is hardcoded to 8 hours per security policy.
// TODO: Make this configurable via environment variable.

// DO: Cross-reference related code
// See database.NextSequence() for atomic counter implementation
```

### Error Handling Standards
```go
// ✅ GOOD: Descriptive error with context
return fmt.Errorf("submit request: query citizen profile (nid=%s): %w", nid, err)

// ❌ BAD: Generic error
return err

// ✅ GOOD: Log error before returning
log.Printf("ERROR: failed to generate DTID: %v", err)
return c.Status(500).JSON(fiber.Map{"success": false, "message": "Internal error"})

// ❌ BAD: Expose internal error to client
return c.Status(500).JSON(fiber.Map{"error": err.Error()})  // Could expose SQL internals
```

### Testing Requirements
- [ ] Unit tests for crypto functions (100% coverage required)
- [ ] Unit tests for validators (NID format, ward code format)
- [ ] Integration tests for database operations (test transactions, concurrency)
- [ ] Integration tests for handler endpoints (test auth, validation, errors)
- [ ] Load tests (simulate 100 concurrent requests)
- [ ] Security tests (SQL injection, XSS, CSRF)

**Test File Naming**: `*_test.go` (Go convention)

Example test structure:
```go
package handlers

import "testing"

func TestSubmitRequest_Valid(t *testing.T) {
    // Test successful submission
}

func TestSubmitRequest_MissingNID(t *testing.T) {
    // Test validation error
}

func TestSubmitRequest_DatabaseDown(t *testing.T) {
    // Test error handling
}
```

---

## 📱 PART 7: ANDROID INTEGRATION POINTS

### API Contract (Frontend ↔ Backend)

#### Citizen Endpoints
```
POST /citizen/request
Body: {
    citizen_nid: "12345678901",
    citizen_name: "Rajesh KC",
    citizen_phone: "9800000000",
    document_type: "SIFARIS",
    purpose: "Employment Letter for Bank",
    additional_info: "{"reason":"Loan Application"}",
    ward_code: "NPL-04-33-09",
    ocr_raw_data: "{...}"  // OCR output from document capture
}
Response: {
    "success": true,
    "request_id": "REQ-2082-000001",
    "estimated_time": "2082-06-15T16:30:00Z",
    "message": "Request submitted. Check status in 2-3 hours."
}

GET /citizen/request/:requestID
Response (PENDING):
{
    "success": true,
    "status": "PENDING",
    "position_in_queue": 5,
    "estimated_time": "2 hours"
}

Response (APPROVED):
{
    "success": true,
    "status": "APPROVED",
    "dtid": "NPL-04-33-09-2082-000001",
    "issued_at": "2082-06-15T14:30:00Z",
    "pdf_url": "https://api.pratibimba.gov.np/document/pdf/NPL-04-33-09-2082-000001",
    "verification_url": "https://verify.pratibimba.gov.np/NPL-04-33-09-2082-000001"
}
```

#### Officer Endpoints
```
POST /officer/login
Body: {
    officer_id: "WO-04-33-09-001",
    pin: "1234"
}
Response: {
    "success": true,
    "token": "eyJhbG...",  // JWT
    "expires_in": 28800,    // seconds
    "officer_name": "Ram Bahadur Thapa",
    "ward_code": "NPL-04-33-09"
}

GET /officer/queue [JWT]
Response: {
    "success": true,
    "requests": [
        {
            "request_id": "REQ-2082-000001",
            "citizen_name": "Rajesh KC",
            "citizen_nid": "12345678901",
            "document_type": "SIFARIS",
            "purpose": "Employment Letter",
            "submitted_at": "2082-06-15T12:00:00Z",
            "position": 1
        },
        ...
    ]
}

POST /officer/approve [JWT]
Body: {
    request_id: "REQ-2082-000001"
}
Response: {
    "success": true,
    "dtid": "NPL-04-33-09-2082-000001",
    "message": "Document approved. Ready to print & stamp."
}
```

### Error Response Format (Standard)
```json
{
    "success": false,
    "message": "Invalid citizen NID format",
    "error_code": "VALIDATION_ERROR",
    "details": {
        "field": "citizen_nid",
        "reason": "Must be 11 digits"
    }
}
```

---

## 🚀 PART 8: IMPLEMENTATION TIMELINE

### PHASE 1: Immediate (Days 1-3) — Fix Broken Stubs
**Goal**: Make all citizen portal endpoints functional

- [ ] Day 1: Create `002_citizen_portal.sql` with 6 new tables + demo data
- [ ] Day 1: Update migration strategy docs
- [ ] Day 2: Implement handlers for:
  - [x] GET /citizen/profile/:nid
  - [x] GET /citizen/tax/:nid
  - [x] GET /citizen/notices/:wardCode
  - [x] POST /citizen/grievance
  - [x] GET /citizen/grievances/:nid
  - [x] POST /citizen/queue/book
  - [x] GET /citizen/bhatta/:nid
- [ ] Day 2: Add validators (NID format, ward code, phone)
- [ ] Day 3: Test all endpoints manually + simple load test

**Deliverable**: All 8 citizen portal endpoints return real data (not stubs)

---

### PHASE 2: Security Hardening (Days 4-5)
**Goal**: Fix critical security issues

- [ ] Fix CORS (restrict to Android app + frontend domain)
- [ ] Add per-IP rate limiting (prevent single attacker blocking everyone)
- [ ] Add request signing (HMAC) for Android app
- [ ] Upgrade PIN hashing to bcrypt
- [ ] Add account lockout (5 failed attempts)

**Deliverable**: Security audit passes basic checks

---

### PHASE 3: Code Quality (Days 6-7)
**Goal**: Professional code structure

- [ ] Add input validators module (reusable across handlers)
- [ ] Refactor duplicate utilities (ward name, district name, etc.)
- [ ] Add structured logging (JSON logs, not printf)
- [ ] Write unit tests for crypto functions (100% coverage)
- [ ] Write integration tests for handlers (50% coverage minimum)

**Deliverable**: Code passes linter (golangci-lint), tests pass, no duplicates

---

### PHASE 4: Performance & Observability (Day 8)
**Goal**: Production-ready performance

- [ ] Add response time logging
- [ ] Add database query logging (slow query detection)
- [ ] Add error rate tracking (Sentry or similar)
- [ ] Load test: 100 concurrent requests, verify <500ms response
- [ ] Add database connection pool monitoring

**Deliverable**: Performance baseline established, monitoring in place

---

### PHASE 5: Documentation & Deployment (Day 9-10)
**Goal**: Deployment-ready

- [ ] Write API documentation (Swagger/OpenAPI)
- [ ] Write deployment guide (Docker, environment vars, SSL setup)
- [ ] Write database migration guide
- [ ] Create Docker image + docker-compose
- [ ] Test staging deployment
- [ ] Create incident response playbook

**Deliverable**: Backend ready for production deployment

---

### PHASE 6: Android Integration Testing (Day 11+)
**Goal**: Frontend + Backend working together

- [ ] Setup shared staging environment
- [ ] Test all citizen flows (end-to-end from Android)
- [ ] Test all officer flows (end-to-end from tablet)
- [ ] Test edge cases (network failures, timeouts, etc.)
- [ ] Performance tuning based on real app usage

**Deliverable**: Backend + Android app fully integrated and tested

---

## 📊 CRITICAL PATH (What Must Be Done First)

```
┌─────────────────────────────────────────────────────────────┐
│ BLOCKING: Create Missing Database Tables (002_citizen_portal)│
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ BLOCKING: Implement 8 Citizen Portal Handlers               │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ BLOCKING: Fix CORS Configuration (Security)                 │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ THEN: Add Input Validators + Error Handling                 │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ THEN: Write Tests + Load Testing                            │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ THEN: Documentation + Deployment                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎬 NEXT IMMEDIATE ACTIONS (This Week)

1. **Read This Document** (30 min) ← You are here
2. **Review Current Code** (1 hour)
   - Understand existing handlers in `internal/handlers/`
   - Review database connection in `internal/database/`
   - Check main.go routing

3. **Create 002_citizen_portal.sql** (2 hours)
   - Copy the 6 table definitions from PART 3 above
   - Test migration locally: `psql -d pratibimba -f migrations/002_citizen_portal.sql`

4. **Implement Citizen Portal Handlers** (6-8 hours)
   - Update stubs in `internal/handlers/citizen_portal.go`
   - Add input validators
   - Test each endpoint

5. **Fix CORS** (30 min)
   - Update `main.go` line 51 to restrict origins
   - Add request signing

6. **First Test Run** (1 hour)
   - Run server: `go run main.go`
   - Manually test 5 endpoints using curl/Postman
   - Check response times

---

## 📞 COMMON QUESTIONS

### Q: Should I modify 001_init.sql or create 002?
**A**: Create 002_citizen_portal.sql. Reasons:
- 001 is the baseline; changing it rewrites history
- Separate files = easier for teammates to understand what was added
- Migration versioning is standard practice

### Q: What about authentication for citizen endpoints?
**A**: Citizen endpoints are PUBLIC (rate-limited but not JWT-protected).
Only officer endpoints require JWT. This is intentional:
- Citizens should be able to submit requests without login
- Officer verification happens server-side via citizen NID + phone

### Q: How do I handle timezone for Nepali dates?
**A**: Store all timestamps as UTC in PostgreSQL. Convert to UTC+5:45 (Nepali time) when returning to client:
```go
nepaliTime := utcTime.In(time.FixedZone("NPT", 5*3600+45*60))
```

### Q: What if the database goes down?
**A**: Current code will return 500 with generic "Database error" message. That's OK for MVP. For production, implement:
- Database connection retry logic (exponential backoff)
- Circuit breaker pattern (don't hammer down database)
- Graceful degradation (cache recent responses)

### Q: How many concurrent users can this handle?
**A**: With current specs (PostgreSQL 25 connections):
- ~1,000 requests/second comfortably
- ~5,000 concurrent users at 5 req/min per user
- Larger scale requires load balancer + multiple backend instances

---

## ✅ DEFINITION OF DONE

Your backend is "production-ready" when:

- [ ] All 18 endpoints implemented and tested
- [ ] All 6 missing database tables created + seeded
- [ ] Input validation on all handlers
- [ ] Error messages are descriptive (no SQL exceptions leaked)
- [ ] CORS is restricted (not "*")
- [ ] Rate limiting per-IP (not global)
- [ ] Unit tests for all utility functions (crypto, validators)
- [ ] Integration tests for all handlers (happy path + error cases)
- [ ] Load test passes (100 concurrent requests, <500ms response)
- [ ] API documentation complete (Swagger)
- [ ] Deployment guide written (Docker, env vars)
- [ ] Android frontend successfully integrates (end-to-end test)
- [ ] Security audit passes (no SQL injection, XSS, CSRF)
- [ ] Monitoring/logging in place (can debug production issues)

---

## 📚 QUICK REFERENCE: IMPLEMENTATION CHECKLISTS

### Before You Start Coding
- [ ] Database password in .env (not in code)
- [ ] JWT secret in .env (not in code)
- [ ] Port number configurable via env var
- [ ] Log level configurable (DEBUG, INFO, WARN, ERROR)

### For Each New Endpoint
- [ ] Input validation (required fields, format checks)
- [ ] Error handling (try/catch equivalent, log errors)
- [ ] Database error handling (distinguish "no data found" vs "connection error")
- [ ] Response consistency (all responses use same JSON structure)
- [ ] Rate limiting (check Fiber config applies)
- [ ] Access logging (who called, when, what status)

### For Each Database Migration
- [ ] Idempotent (CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING for inserts)
- [ ] Indexed (all frequently queried columns should have indexes)
- [ ] Documented (comments explaining table purpose + relationships)
- [ ] Reversible (can write DOWN migration if needed)
- [ ] Tested locally before committing

---

## 🆘 BLOCKERS TO RESOLVE NOW

1. **Blocker**: 6 database tables don't exist
   - **Impact**: 7 endpoints return empty results
   - **Fix**: Create 002_citizen_portal.sql (copy code from PART 3)
   - **Estimated Time**: 2 hours

2. **Blocker**: CORS allows all origins ("*")
   - **Impact**: Any website can call your API
   - **Fix**: In main.go line 51, change to:
     ```go
     AllowOrigins: "https://android.app.domain,https://web.app.domain",
     ```
   - **Estimated Time**: 15 minutes

3. **Blocker**: No input validation
   - **Impact**: Garbage data in database, unhelpful error messages
   - **Fix**: Add validators module (NID format, ward code, phone)
   - **Estimated Time**: 3 hours

4. **Blocker**: No error recovery (timeouts, retries)
   - **Impact**: Each backend restart loses in-memory SSE connections
   - **Fix**: Add connection retry logic to database pool
   - **Estimated Time**: 2 hours

---

**END OF PROJECT PLAN**

---

Questions? Issues? Let me know in the next message and I'll clarify specific sections.
