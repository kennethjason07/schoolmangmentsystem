-- SQL script to validate fee data structure for a student
-- Run this in your Supabase SQL editor or database console

-- Replace these values with actual IDs
-- SET student_id = 'your-student-uuid-here';
-- SET class_id = 'your-class-uuid-here'; 
-- SET tenant_id = 'your-tenant-uuid-here';

-- 1. Check if student exists and has correct tenant_id
SELECT 
  'STUDENT CHECK' as check_type,
  s.id,
  s.name,
  s.class_id,
  s.academic_year,
  s.tenant_id,
  c.class_name,
  c.section
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
WHERE s.id = 'student-id-here' 
AND s.tenant_id = 'tenant-id-here';

-- 2. Check fee structure for the student's class
SELECT 
  'FEE STRUCTURE CHECK' as check_type,
  fs.id,
  fs.fee_component,
  fs.amount,
  fs.due_date,
  fs.academic_year,
  fs.class_id,
  fs.student_id,
  fs.tenant_id
FROM fee_structure fs
WHERE fs.class_id = 'class-id-here'
AND fs.tenant_id = 'tenant-id-here'
AND fs.student_id IS NULL  -- Class-level fees
ORDER BY fs.fee_component;

-- 3. Check student payment records
SELECT 
  'PAYMENT RECORDS CHECK' as check_type,
  sf.id,
  sf.fee_component,
  sf.amount_paid,
  sf.payment_date,
  sf.academic_year,
  sf.status,
  sf.total_amount,
  sf.remaining_amount,
  sf.tenant_id
FROM student_fees sf
WHERE sf.student_id = 'student-id-here'
AND sf.tenant_id = 'tenant-id-here'
ORDER BY sf.payment_date DESC;

-- 4. Check student discounts
SELECT 
  'DISCOUNTS CHECK' as check_type,
  sd.id,
  sd.fee_component,
  sd.discount_type,
  sd.discount_value,
  sd.description,
  sd.is_active,
  sd.academic_year,
  sd.tenant_id
FROM student_discounts sd
WHERE sd.student_id = 'student-id-here'
AND sd.tenant_id = 'tenant-id-here'
AND sd.is_active = true;

-- 5. Summary calculation
WITH fee_summary AS (
  SELECT 
    COALESCE(SUM(fs.amount), 0) as total_fee_structure,
    COUNT(fs.id) as fee_structure_count
  FROM fee_structure fs
  WHERE fs.class_id = 'class-id-here'
    AND fs.tenant_id = 'tenant-id-here'
    AND fs.student_id IS NULL
),
payment_summary AS (
  SELECT 
    COALESCE(SUM(sf.amount_paid), 0) as total_payments,
    COUNT(sf.id) as payment_count
  FROM student_fees sf
  WHERE sf.student_id = 'student-id-here'
    AND sf.tenant_id = 'tenant-id-here'
),
discount_summary AS (
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN sd.discount_type = 'percentage' THEN (fs.total_fees * sd.discount_value / 100)
        WHEN sd.discount_type = 'fixed_amount' THEN sd.discount_value
        ELSE 0
      END
    ), 0) as total_discounts,
    COUNT(sd.id) as discount_count
  FROM student_discounts sd
  CROSS JOIN (SELECT COALESCE(SUM(amount), 0) as total_fees FROM fee_structure WHERE class_id = 'class-id-here' AND tenant_id = 'tenant-id-here' AND student_id IS NULL) fs
  WHERE sd.student_id = 'student-id-here'
    AND sd.tenant_id = 'tenant-id-here'
    AND sd.is_active = true
)
SELECT 
  'SUMMARY' as check_type,
  fs.total_fee_structure,
  fs.fee_structure_count,
  ps.total_payments,
  ps.payment_count,
  ds.total_discounts,
  ds.discount_count,
  (fs.total_fee_structure - ds.total_discounts) as net_amount_due,
  (fs.total_fee_structure - ds.total_discounts - ps.total_payments) as outstanding_amount
FROM fee_summary fs
CROSS JOIN payment_summary ps
CROSS JOIN discount_summary ds;

-- 6. Check for potential issues
SELECT 
  'POTENTIAL ISSUES' as check_type,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM fee_structure 
      WHERE class_id = 'class-id-here' 
      AND tenant_id = 'tenant-id-here' 
      AND student_id IS NULL
    ) THEN 'NO_FEE_STRUCTURE'
    WHEN EXISTS (
      SELECT 1 FROM student_fees sf
      WHERE sf.student_id = 'student-id-here'
      AND sf.tenant_id != 'tenant-id-here'
    ) THEN 'TENANT_MISMATCH_PAYMENTS'
    WHEN EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = 'student-id-here'
      AND s.tenant_id != 'tenant-id-here'
    ) THEN 'TENANT_MISMATCH_STUDENT'
    ELSE 'NO_ISSUES_DETECTED'
  END as issue_type;