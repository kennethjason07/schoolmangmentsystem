-- Check for triggers on student_discounts table
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'student_discounts';

-- Check for functions that reference fee_structure
SELECT routine_name, routine_type, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition ILIKE '%fee_structure%'
AND routine_definition ILIKE '%update%';

-- Check for any trigger functions
SELECT p.proname as function_name, 
       pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%trigger%'
OR p.proname LIKE '%discount%';

-- Check for any triggers on any tables that might affect fee_structure
SELECT trigger_name, event_object_table, event_manipulation, action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%fee_structure%';

-- Look for functions that update the base amount or amount of fee_structure
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition ILIKE '%UPDATE%fee_structure%'
AND (routine_definition ILIKE '%amount =%' OR routine_definition ILIKE '%base_amount =%');

-- Check if there's a trigger or function that directly sets discount_applied
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition ILIKE '%discount_applied =%';

-- Look at all triggers that might affect fee calculations
SELECT trigger_name, event_object_table, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('fee_structure', 'student_discounts', 'student_fees');

-- Check for triggers on fee_structure
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fee_structure';

-- Check for global database triggers that might modify fee_structure
SELECT pg_event_trigger.evtname as trigger_name, 
       pg_proc.proname as function_name,
       obj_description(pg_event_trigger.oid, 'pg_event_trigger') as description
FROM pg_event_trigger
JOIN pg_proc ON pg_proc.oid = pg_event_trigger.evtfoid;

-- Find trigger function named "calculate_fee_with_discounts"
SELECT routine_name, routine_type, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%calculate%fee%' OR routine_name LIKE '%discount%';