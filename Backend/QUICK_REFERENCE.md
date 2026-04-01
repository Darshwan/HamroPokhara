# ⚡ QUICK REFERENCE — KEEP THIS HANDY

## Your Stats Right Now
- **Backend Completion**: 50% (core done, citizen portal stubs)
- **Days to Deadline**: ~10 days
- **Critical Blockers**: 6 missing database tables, 7 endpoint stubs
- **Risk Level**: MEDIUM (tight timeline, but doable)

---

## What You're Building
A **Governmental Android App Backend** for Pokhara, Nepal enabling 20+ governance features:
- Citizens: Submit requests (Sifaris, tax clearance, etc.), track status, pay taxes, view notices, file grievances, book queue tokens, check social security
- Officers: Review requests, approve documents, manage grievances, generate compliance reports
- Ministry: Real-time dashboard, audit logs, tamper detection, integrity verification

**Core Differentiator**: All documents are cryptographically signed (SHA256) + append-only ledger = fraud-proof.

---

## 🚨 CRITICAL PATH (Do These First)

### 1. CREATE DATABASE TABLES (Copy-Paste Ready)
File: `migrations/002_citizen_portal.sql`
Tables: citizen_profiles, tax_records, notices, grievances, queue_tokens, social_security

**Command**: `psql -d pratibimba -f migrations/002_citizen_portal.sql`

**Time**: 30 minutes

---

### 2. FIX CORS (Security Critical)
File: `main.go` line 51

**Change**:
```go
AllowOrigins: "*"  // ❌ WRONG
```

**To**:
```go
AllowOrigins: "https://your-android-app.com,http://localhost:3000"  // ✅ CORRECT
```

**Time**: 5 minutes

---

### 3. IMPLEMENT 8 CITIZEN PORTAL HANDLERS
File: `internal/handlers/citizen_portal.go`

Functions (all currently stubs, now that tables exist):
1. GetCitizenProfile — fetch personal data
2. GetTaxRecords — payment history
3. GetNotices — ward announcements
4. SubmitGrievance — report issues
5. GetGrievances — track grievances
6. BookQueueToken — virtual queue
7. GetBhattaStatus — social security info
8. GetCitizenDocuments — issued documents

**Check**: Queries match table schemas created in step 1

**Time**: 4 hours (test as you go)

---

### 4. ADD INPUT VALIDATORS
File: `internal/validators/validators.go` (create new)

Validate:
- NID: 11 digits only
- Ward code: NPL-04-33-09 format
- Phone: 10-15 digits
- Document type: SIFARIS, TAX_CLEARANCE, etc.
- Grievance category: POTHOLE, STREETLIGHT, etc.

**Time**: 1.5 hours

---

### 5. TEST EVERYTHING (Manual + Load)
Terminal commands:
```bash
# Terminal 1: Start server
go run main.go

# Terminal 2: Test one endpoint
curl http://localhost:3000/citizen/profile/12345678901

# Load test (install ab if needed)
ab -n 1000 -c 100 http://localhost:3000/citizen/profile/12345678901
```

**Pass Criteria**:
- All endpoints return 200 OK (or expected error)
- Load test shows 0 failed requests
- Response time < 500ms for 100 concurrent requests

**Time**: 3 hours (including debugging)

---

## 🔐 Security Must-Haves

| What | Status | Fix |
|------|--------|-----|
| CORS restricted | ❌ OPEN | Change "*" to specific domains |
| Input validation | ❌ MISSING | Add validators module |
| Rate limiting | ✅ EXISTS | Check: 30 req/min per /citizen/* → 429 after |
| JWT auth | ✅ EXISTS | Officer endpoints protected |
| Append-only ledger | ✅ EXISTS | Tamper-proof, SET UPDATE/DELETE rules |
| No PII in errors | ❌ LEAKY | Replace generic error messages |
| Secrets in .env | ❌ CHECK | Ensure DATABASE_URL, JWT_SECRET not in code |
| HTTPS/TLS | ❓ UNKNOWN | Setup reverse proxy (Nginx) before production |

---

## 📊 API Response Format (Standard)

All endpoints must return ONE OF these:

**Success**:
```json
{
    "success": true,
    "data": { ... },
    "message": "Operation successful"
}
```

**Error**:
```json
{
    "success": false,
    "message": "Invalid citizen NID format",
    "error_code": "VALIDATION_ERROR"
}
```

**Consistency**: No endpoint should return different formats.

---

## 🗄️ Database Tables (6 Created by Migration)

| Table | Purpose | Key Column |
|-------|---------|-----------|
| citizen_profiles | Personal data | nid (PK) |
| tax_records | Tax history | citizen_nid (FK) |
| notices | Ward announcements | notice_id (PK) |
| grievances | Issue reports | grievance_id (PK) |
| queue_tokens | Virtual queue | token_id (PK) |
| social_security | Allowance status | citizen_nid (FK) |

**Demo Data Seeded**: 2 citizens (nid: 12345678901, 98765432109)

---

## 📱 Endpoints Summary (18 Total)

### CITIZEN (10, Public, Rate Limited 30/min)
- POST /citizen/request — Submit document request
- GET /citizen/request/:id — Check status
- GET /citizen/profile/:nid — View personal data
- GET /citizen/tax/:nid — View tax records
- GET /citizen/notices/:ward — View announcements
- POST /citizen/grievance — File complaint
- GET /citizen/grievances/:nid — Track complaints
- POST /citizen/queue/book — Reserve queue token
- GET /citizen/bhatta/:nid — Check social security
- GET /citizen/documents/:nid — View approved documents

### OFFICER (4, Protected by JWT)
- POST /officer/login — Get token (PIN auth)
- GET /officer/queue — View pending requests
- POST /officer/approve — Approve request → Generate DTID
- POST /officer/reject — Reject with reason

### VERIFY (2, Public, Rate Limited 100/min)
- GET /verify/:dtid — Check document validity (VALID|TAMPERED|NOT_FOUND)
- GET /document/pdf/:dtid — Download Sifaris PDF

### ADMIN (1+)
- GET /ministry/stats — Dashboard stats
- GET /ministry/feed — Ledger entries (paginated)
- GET /ministry/live — Real-time SSE feed
- GET /ministry/integrity — Check for tampering

### UTILITY (1)
- GET /health — Server status

---

## 🧪 Quick Test Template

```bash
#!/bin/bash

echo "🧪 Testing Citizen Endpoints..."

# Test 1: Get profile
echo -n "Profile: "
curl -s http://localhost:3000/citizen/profile/12345678901 | grep -q "success" && echo "✅" || echo "❌"

# Test 2: Get tax records
echo -n "Tax: "
curl -s http://localhost:3000/citizen/tax/12345678901 | grep -q "success" && echo "✅" || echo "❌"

# Test 3: Get notices
echo -n "Notices: "
curl -s http://localhost:3000/citizen/notices/NPL-04-33-09 | grep -q "success" && echo "✅" || echo "❌"

# Test 4: Officer login
echo -n "Officer Login: "
curl -s -X POST http://localhost:3000/officer/login \
  -H "Content-Type: application/json" \
  -d '{"officer_id":"WO-04-33-09-001","pin":"1234"}' | grep -q "token" && echo "✅" || echo "❌"

# Test 5: Health check
echo -n "Health: "
curl -s http://localhost:3000/health | grep -q "operational" && echo "✅" || echo "❌"

echo "✅ All tests complete"
```

---

## 📚 File Reference

| What | Where | Status |
|------|-------|--------|
| Main logic | main.go | ✅ Complete |
| Database schema | migrations/001_init.sql | ✅ Complete |
| Citizen portal schema | migrations/002_citizen_portal.sql | ❌ YOU CREATE |
| Citizen handlers | internal/handlers/citizen_portal.go | 🟡 Stubs (fix) |
| Officer handlers | internal/handlers/officer.go | ✅ Complete |
| Validators | internal/validators/ | ❌ YOU CREATE |
| Tests | *_test.go | ❌ YOU CREATE |
| API docs | API_DOCS.md | ❌ YOU CREATE |
| Deployment | DEPLOYMENT.md | ❌ YOU CREATE |

---

## 💡 Pro Tips

### Tip 1: Test as You Code
Don't wait until everything is done. After each function, test it:
```bash
curl http://localhost:3000/citizen/profile/12345678901
```

### Tip 2: Use Postman for Complex Requests
Download Postman, import endpoints to test with GUI (easier than curl).

### Tip 3: Database Debugging
```bash
# Check if tables exist
psql -d pratibimba -c "\dt"

# Check data
psql -d pratibimba -c "SELECT * FROM citizen_profiles LIMIT 2;"

# Check indexes
psql -d pratibimba -c "\di"
```

### Tip 4: Server Logs
Watch server logs while testing:
```bash
go run main.go 2>&1 | grep -E "ERROR|200|400|500"
```

### Tip 5: Restart PostgreSQL if Connection Issues
```bash
# Windows: Restart service
net stop PostgreSQL15
net start PostgreSQL15

# Or restart via Services app
```

---

## ⚠️ Common Pitfalls to Avoid

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| Modify 001_init.sql | Rewrites baseline, breaks teammates | Create 002 instead |
| Leave CORS as "*" | Anyone can call your API (XSS risk) | Restrict to your domain |
| Catch all errors as "Database error" | Can't debug production issues | Log real errors, show generic to client |
| Don't validate input | Garbage data in DB, confusing errors | Add validators before queries |
| Hardcode secrets in code | Exposed in git history, bad for security | Use .env file |
| Don't test endpoint | Fails in production when frontend calls | Test with curl/Postman before handoff |

---

## 📋 Pre-Handoff Checklist (To Android Team)

- [ ] All 18 endpoints working, tested, documented
- [ ] All tables created + seeded with demo data
- [ ] CORS configured for Android app domain
- [ ] Input validation active (NID, ward code, etc.)
- [ ] Error messages descriptive (no SQL internals leaking)
- [ ] Load tested (100 concurrent → <500ms response)
- [ ] API documentation complete (API_DOCS.md)
- [ ] Environment variables documented (.env.example)
- [ ] Deployment steps documented (DEPLOYMENT.md)
- [ ] Database migration steps clear
- [ ] Android team has login credentials (DB + API)
- [ ] Response format consistent across all endpoints

---

## 🆘 If You Get Stuck

**Problem**: Endpoint returns 500 error  
**Debug**: 
1. Check server logs: `go run main.go` shows error details
2. Check database connected: `psql -d pratibimba -c "SELECT 1;"`
3. Check table exists: `psql -d pratibimba -c "\dt citizen_profiles"`
4. Try direct SQL: `SELECT * FROM citizen_profiles WHERE nid='12345678901';`

**Problem**: Load test shows slow response (<500ms)  
**Debug**:
1. Add database indexes: See WEEK1_SPRINT.md DATABASE OPTIMIZATION
2. Check query efficiency: `EXPLAIN ANALYZE SELECT * FROM citizen_profiles WHERE nid='12345678901';`
3. Factor: If query returns 1000+ rows, add LIMIT

**Problem**: Android app can't connect  
**Debug**:
1. Check CORS: `curl -H "Origin: https://android.app" http://localhost:3000/citizen/profile/123`
2. Check firewall: Port 3000 open? `netstat -an | grep 3000`
3. Check database: `psql -d pratibimba -c "SELECT COUNT(*) FROM officers;"`

---

## 📞 When to Ask for Help

- You're stuck on a Go syntax error for >30 mins
- Database query fails with cryptic error
- Endpoint works locally but not in Docker
- Load test consistently fails
- Security concern you're unsure about

**Don't**: Spend hours guessing. Ask early, fix fast.

---

## ✅ Definition of "Done"

Your backend is "launch-ready" when:

```
All 18 endpoints work ✅
All 6 tables created ✅
Input validation active ✅
Error messages helpful ✅
CORS restricted ✅
Load test passes ✅
API docs complete ✅
Deployment guide complete ✅
Android team can integrate ✅
No hardcoded secrets ✅
```

---

**Last Updated**: Today  
**Status**: 10 days to deadline, 50% complete, ON TRACK ✅  
**Next Step**: Create 002_citizen_portal.sql (30 min task)

