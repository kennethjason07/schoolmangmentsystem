-- Check notification enum types and fix the issue
-- Run this SQL in your Supabase SQL editor

-- 1. Check what enum types exist
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%notification%'
ORDER BY t.typname, e.enumsortorder;

-- 2. Check the exact column definition for notifications.type
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'type'
AND table_schema = 'public';

-- 3. Check current data in notifications table
SELECT DISTINCT type FROM notifications;

-- 4. If the enum doesn't have the values we need, we can either:
-- Option A: Add missing values to the enum
-- Option B: Change the column to text type

-- Option A: Add missing enum values (uncomment if needed)
/*
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'announcement';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'task';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'event';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'personal_task';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'general';
*/

-- Option B: Change column to text type (uncomment if needed)
/*
-- First, change the column type to text
ALTER TABLE notifications 
ALTER COLUMN type TYPE text 
USING type::text;

-- Drop the enum type if no longer needed
-- DROP TYPE IF EXISTS notification_type_enum;
*/

-- 5. Check what values are currently allowed
SELECT 
    pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = 'notifications'::regclass
AND a.attname = 'type'
AND NOT a.attisdropped;
