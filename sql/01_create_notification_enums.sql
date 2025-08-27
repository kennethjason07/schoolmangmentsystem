-- Step 1: Create notification enum types (run this first)
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
            
        END;
    END IF;
END $$;
