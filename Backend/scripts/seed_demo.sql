-- ============================================================
-- PRATIBIMBA DEMO DATA SEEDER
-- Run: psql -d pratibimba -f scripts/seed_demo.sql
-- Creates realistic demo data for hackathon presentation
-- ============================================================

-- ── Citizen profiles ─────────────────────────────────────────
INSERT INTO citizen_profiles 
  (nid, citizenship_no, full_name, full_name_ne, dob, gender, 
   father_name, mother_name, ward_code, ward_number, district, province, phone)
VALUES
  ('12345678901', '01-02-03-04567', 'Rajesh KC',         'राजेश के.सी.',      '1985-06-15', 'Male',   'Hari Bahadur KC',  'Kamala KC',      'NPL-04-33-09', 9,  'Kaski', 'Gandaki', '9800000000'),
  ('98765432101', '02-03-04-05678', 'Sita Devi Sharma',  'सीता देवी शर्मा',   '1990-03-22', 'Female', 'Ram Prasad Sharma','Sabitri Sharma', 'NPL-04-33-09', 9,  'Kaski', 'Gandaki', '9801111111'),
  ('11223344556', '03-04-05-06789', 'Hari Bahadur Gurung','हरि बहादुर गुरुङ', '1978-11-10', 'Male',   'Man Bahadur Gurung','Devi Gurung',  'NPL-04-33-05', 5,  'Kaski', 'Gandaki', '9802222222')
ON CONFLICT (nid) DO NOTHING;

-- ── Service requests (pending for demo queue) ─────────────────
INSERT INTO service_requests 
  (request_id, citizen_nid, citizen_name, citizen_phone, document_type, 
   purpose, ward_code, status, submitted_at)
VALUES
  ('MS-2082-000021', '12345678901', 'Rajesh KC',        '9800000000', 'SIFARIS',          'बैंक खाता खोल्न',              'NPL-04-33-09', 'PENDING',      NOW() - INTERVAL '2 hours'),
  ('MS-2082-000020', '98765432101', 'Sita Devi Sharma', '9801111111', 'TAX_CLEARANCE',    'व्यवसाय नवीकरणका लागि',        'NPL-04-33-09', 'PENDING',      NOW() - INTERVAL '4 hours'),
  ('MS-2082-000019', '11223344556', 'Hari B. Gurung',   '9802222222', 'BIRTH_CERTIFICATE','विद्यालय भर्नाका लागि',         'NPL-04-33-09', 'UNDER_REVIEW', NOW() - INTERVAL '6 hours'),
  ('MS-2082-000018', '12345678901', 'Rajesh KC',        '9800000000', 'INCOME_PROOF',     'बैंक ऋणका लागि आय प्रमाण',     'NPL-04-33-09', 'APPROVED',     NOW() - INTERVAL '1 day'),
  ('MS-2082-000017', '98765432101', 'Sita Devi Sharma', '9801111111', 'SIFARIS',          'सरकारी जागिरका लागि',           'NPL-04-33-09', 'REJECTED',     NOW() - INTERVAL '2 days')
ON CONFLICT (request_id) DO NOTHING;

-- ── Approved docs → ledger entries ───────────────────────────
-- For MS-2082-000018 (already approved above)
INSERT INTO dtid_sequences (ward_code, nepali_year, last_sequence)
VALUES ('NPL-04-33-09', 2082, 18)
ON CONFLICT (ward_code, nepali_year) DO UPDATE
  SET last_sequence = GREATEST(dtid_sequences.last_sequence, 18);

INSERT INTO ndo_ledger 
  (dtid, document_hash, record_hash, document_type, officer_id,
   ward_code, district_code, province_code, request_id, status, sync_status, created_at, synced_at)
VALUES (
  'NPL-04-33-09-2082-000018',
  'a3f8c2d9e1b4f6a8b2c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7',
  'f7e9d1c3b5a7f9e1d3c5b7a9f1e3d5c7b9a1f3e5d7c9b1a3f5e7d9c1b3a5f7',
  'INCOME_PROOF', 'WO-04-33-09-001',
  'NPL-04-33-09', 33, 4, 'MS-2082-000018', 'ACTIVE', 'CONFIRMED',
  NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
)
ON CONFLICT (dtid) DO NOTHING;

-- Update approved request with DTID
UPDATE service_requests 
SET dtid = 'NPL-04-33-09-2082-000018', completed_at = NOW() - INTERVAL '1 day'
WHERE request_id = 'MS-2082-000018';

-- ── Grievances ────────────────────────────────────────────────
INSERT INTO grievances
  (grievance_id, citizen_nid, citizen_name, ward_code, category, description, location_desc, status)
VALUES
  ('GRV-2082-000001', '12345678901', 'Rajesh KC',        'NPL-04-33-09', 'POTHOLE',     'ठूलो खाल्डो छ, साइकल दुर्घटना भयो',    'वडा ९ कार्यालय नजिकै',     'OPEN'),
  ('GRV-2082-000002', '98765432101', 'Sita Devi Sharma', 'NPL-04-33-09', 'STREETLIGHT', 'बत्ती जलेन, राति अँध्यारो हुन्छ',       'प्रधान पथ, वडा ९',          'IN_PROGRESS'),
  ('GRV-2082-000003', '12345678901', 'Rajesh KC',        'NPL-04-33-09', 'GARBAGE',     'ढल थुनिएको छ, फोहोर जम्यो',             'माछापोखरी क्षेत्र',         'RESOLVED')
ON CONFLICT (grievance_id) DO NOTHING;

-- ── Tax records ───────────────────────────────────────────────
INSERT INTO tax_records
  (citizen_nid, tax_year, property_tax, business_tax, total_amount, paid_amount, due_date, status)
VALUES
  ('12345678901', 2082, 8500.00, 0.00,    8500.00,  0.00,    '2082-09-30', 'UNPAID'),
  ('12345678901', 2081, 8200.00, 0.00,    8200.00,  8200.00, '2081-09-30', 'PAID'),
  ('98765432101', 2082, 6200.00, 4500.00, 10700.00, 5000.00, '2082-09-30', 'PARTIAL'),
  ('98765432101', 2081, 5900.00, 4200.00, 10100.00, 10100.00,'2081-09-30', 'PAID')
ON CONFLICT DO NOTHING;

-- ── Notices ───────────────────────────────────────────────────
INSERT INTO notices
  (notice_id, title, title_ne, category, content, is_urgent, ward_code)
VALUES
  ('NTC-001', 'Water Supply Interruption',    'पानी आपूर्ति बन्द',       'URGENT',          'Water supply will be interrupted on 2082/06/15 from 8AM-4PM for maintenance work on main pipeline.', true,  'NPL-04-33-09'),
  ('NTC-002', 'Road Widening Project',        'सडक चौडाइ परियोजना',      'INFRASTRUCTURE',  'Prithvi Chowk to Airport road widening project begins next week. Expect traffic delays.', false, NULL),
  ('NTC-003', 'Free Health Camp',             'नि:शुल्क स्वास्थ्य शिविर', 'HEALTH',          'Free health checkup camp at Ward 9 community hall on 2082/06/20. Includes blood pressure, diabetes, eye checkup.', false, 'NPL-04-33-09'),
  ('NTC-004', 'Tax Payment Deadline',         'कर तिर्ने अन्तिम मिति',    'URGENT',          'Last date to pay property and business tax without fine: 2082/09/30.', true,  NULL),
  ('NTC-005', 'Cultural Program',             'सांस्कृतिक कार्यक्रम',     'CULTURE',         'Annual Teej festival cultural program at Pokhara Municipal Hall on 2082/06/25.', false, NULL)
ON CONFLICT (notice_id) DO NOTHING;

-- ── Additional ledger entries for ministry dashboard ──────────
DO $$
DECLARE
  i INTEGER;
  doc_types TEXT[] := ARRAY['SIFARIS','TAX_CLEARANCE','BIRTH_CERTIFICATE','SIFARIS','SIFARIS','INCOME_PROOF','LAND_REGISTRATION','SIFARIS'];
  ward_codes TEXT[] := ARRAY['NPL-04-33-09','NPL-04-33-05','NPL-04-33-01','NPL-04-33-07','NPL-04-33-11'];
  officer_ids TEXT[] := ARRAY['WO-04-33-09-001','WO-04-33-05-001','WO-04-33-01-001'];
BEGIN
  FOR i IN 1..50 LOOP
    INSERT INTO ndo_ledger (
      dtid, document_hash, record_hash, document_type,
      officer_id, ward_code, district_code, province_code,
      status, sync_status, created_at, synced_at
    ) VALUES (
      'NPL-04-33-DEMO-2082-' || LPAD(i::TEXT, 6, '0'),
      md5(random()::TEXT || i::TEXT),
      md5(random()::TEXT || i::TEXT || 'RECORD'),
      doc_types[1 + (i % array_length(doc_types, 1))],
      officer_ids[1 + (i % array_length(officer_ids, 1))],
      ward_codes[1 + (i % array_length(ward_codes, 1))],
      33, 4, 'ACTIVE', 'CONFIRMED',
      NOW() - (random() * INTERVAL '7 days'),
      NOW() - (random() * INTERVAL '7 days')
    )
    ON CONFLICT (dtid) DO NOTHING;
  END LOOP;
END $$;

-- Verify seed
SELECT 
  (SELECT COUNT(*) FROM citizen_profiles) AS citizens,
  (SELECT COUNT(*) FROM service_requests) AS requests,
  (SELECT COUNT(*) FROM ndo_ledger)       AS ledger_entries,
  (SELECT COUNT(*) FROM grievances)       AS grievances,
  (SELECT COUNT(*) FROM notices)          AS notices,
  (SELECT COUNT(*) FROM tax_records)      AS tax_records;