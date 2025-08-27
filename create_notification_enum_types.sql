-- Create notification enum types for grade and homework notifications
-- Run this in Supabase SQL Editor

-- First, check what notification enum type exists
DO $$ 
BEGIN
    -- Check if enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
        -- If enum doesn't exist, create it with all required values
        CREATE TYPE public.notification_type_enum AS ENUM (
            'GRADE_ENTERED',
            'HOMEWORK_UPLOADED',
            'ANNOUNCEMENT',
            'ATTENDANCE_MARKED',
            'EVENT_CREATED',
            'LEAVE_APPLICATION',
            'TASK_ASSIGNED',
            'GENERAL',
            'PERSONAL_TASK',
            'EXAM_SCHEDULED'
        );
        RAISE NOTICE 'Created notification_type_enum with all required values';
    ELSE
        -- If enum exists, try to add missing values
        BEGIN
            -- Add GRADE_ENTERED if not exists
            BEGIN
                ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'GRADE_ENTERED';
                RAISE NOTICE 'Added GRADE_ENTERED to enum';
            EXCEPTION WHEN duplicate_object THEN
                RAISE NOTICE 'GRADE_ENTERED already exists in enum';
            END;
            
            -- Add HOMEWORK_UPLOADED if not exists  
            BEGIN
                ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'HOMEWORK_UPLOADED';
                RAISE NOTICE 'Added HOMEWORK_UPLOADED to enum';
            EXCEPTION WHEN duplicate_object THEN
                RAISE NOTICE 'HOMEWORK_UPLOADED already exists in enum';
            END;
            
            -- Add other common values if needed
            BEGIN
                ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'ATTENDANCE_MARKED';
                ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'EXAM_SCHEDULED';
                ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'EVENT_CREATED';
                ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';
                RAISE NOTICE 'Added additional notification types';
            EXCEPTION WHEN duplicate_object THEN
                RAISE NOTICE 'Some notification types already exist';
            END;
            
        END;
    END IF;
END $$;

-- Update notifications table to use the enum properly if needed
DO $$
BEGIN
    -- Check if notifications.type column exists and fix its type if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'type' 
        AND table_schema = 'public'
    ) THEN
        -- Check if it's not already using the enum
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'type' 
            AND udt_name = 'notification_type_enum'
            AND table_schema = 'public'
        ) THEN
            -- Try to convert to enum (this might fail if there's existing incompatible data)
            BEGIN
                ALTER TABLE public.notifications 
                ALTER COLUMN type TYPE public.notification_type_enum 
                USING type::public.notification_type_enum;
                
                RAISE NOTICE 'Successfully converted notifications.type to use enum';
            EXCEPTION WHEN others THEN
                RAISE NOTICE 'Could not convert notifications.type to enum. Consider cleaning data first.';
                -- Alternative: Change to text type for flexibility
                ALTER TABLE public.notifications 
                ALTER COLUMN type TYPE text;
                RAISE NOTICE 'Changed notifications.type to text type for flexibility';
            END;
        END IF;
    END IF;
END $$;

-- Verify the enum values
SELECT enumlabel as available_notification_types
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type_enum')
ORDER BY enumsortorder;
