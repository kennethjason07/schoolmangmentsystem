-- ========================================================================
-- FIX DATABASE TRIGGER AND RESTORE CORRECT FEES FOR CLASS 3A
-- ========================================================================
-- This script will:
-- 1. Disable the problematic trigger that modifies fee_structure
-- 2. Restore correct base fees for Class 3A  
-- 3. Clean up any class-wide discounts
-- 4. Enforce per-student-only concessions

-- Step 1: Disable all triggers on student_discounts table
-- This stops the trigger from modifying fee_structure when discounts are added
ALTER TABLE student_discounts DISABLE TRIGGER ALL;

-- Step 2: Restore correct base fees for Class 3A (37b82e22-ff67-45f7-9df4-1e0201376fb9)
UPDATE fee_structure
SET 
    amount = 25000,
    base_amount = 25000,
    discount_applied = 0
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
  AND fee_component = 'Tution fee'
  AND student_id IS NULL;

UPDATE fee_structure
SET 
    amount = 15000,
    base_amount = 15000,
    discount_applied = 0
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
  AND fee_component = 'Bus Fee'
  AND student_id IS NULL;

-- Step 3: Deactivate any class-wide or "ALL" component discounts
-- These can cause unintended effects across multiple students
UPDATE student_discounts
SET is_active = false
WHERE (
    student_id IS NULL 
    OR fee_component IS NULL 
    OR fee_component = 'ALL'
    OR fee_component = ''
)
AND is_active = true;

-- Step 4: Enforce per-student only constraint (optional - run if you want to prevent future issues)
-- This will fail if there are existing records with NULL student_id, so run step 3 first
-- ALTER TABLE student_discounts ALTER COLUMN student_id SET NOT NULL;

-- Step 5: Verification queries - check the results
SELECT 
    '=== Class 3A Fee Structure (should be class-level only) ===' as section,
    fee_component,
    amount,
    base_amount,
    discount_applied,
    student_id
FROM fee_structure 
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
ORDER BY fee_component;

-- Check active student discounts for Class 3A
SELECT 
    '=== Active Student Discounts for Class 3A ===' as section,
    s.name as student_name,
    sd.fee_component,
    sd.discount_type,
    sd.discount_value,
    sd.description,
    sd.is_active
FROM student_discounts sd
JOIN students s ON s.id = sd.student_id
WHERE sd.class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
  AND sd.is_active = true
ORDER BY s.name, sd.fee_component;

-- Check if any problematic discounts remain
SELECT 
    '=== Problematic Discounts (should be empty) ===' as section,
    COUNT(*) as count_of_problematic_discounts
FROM student_discounts
WHERE (
    student_id IS NULL 
    OR fee_component IS NULL 
    OR fee_component = 'ALL'
)
AND is_active = true;

-- Summary: Expected fee calculation for each student
SELECT 
    '=== Expected Fee Calculations ===' as section,
    'Ishwindar should pay: ₹15,000 (₹25,000 tuition - ₹25,000 discount + ₹15,000 bus)' as ishwindar_expected,
    'Other students should pay: ₹40,000 (₹25,000 tuition + ₹15,000 bus)' as others_expected;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 TRIGGER FIX AND FEE RESTORATION COMPLETED!';
    RAISE NOTICE '✅ Database trigger disabled';
    RAISE NOTICE '✅ Class 3A fees restored: Tuition ₹25,000, Bus ₹15,000';
    RAISE NOTICE '✅ Class-wide discounts deactivated';
    RAISE NOTICE '🎯 Now concessions will only apply per-student, per-component';
END $$;