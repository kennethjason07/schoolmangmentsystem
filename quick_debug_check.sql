-- Quick Debug Check for Absence Notifications
-- Run this in Supabase SQL Editor to check the current state

-- 1. Check if any triggers exist
SELECT 
    'TRIGGER CHECK' as check_type,
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'student_attendance'
ORDER BY trigger_name;

-- 2. Check student-parent relationships
SELECT 
    'STUDENT-PARENT RELATIONSHIPS' as check_type,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email
FROM students s
LEFT JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
ORDER BY s.name
LIMIT 10;

-- 3. Check recent attendance records
SELECT 
    'RECENT ATTENDANCE' as check_type,
    sa.id,
    sa.student_id,
    s.name as student_name,
    sa.date,
    sa.status,
    sa.created_at,
    s.parent_id
FROM student_attendance sa
JOIN students s ON sa.student_id = s.id
WHERE sa.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sa.created_at DESC
LIMIT 10;

-- 4. Check if any notifications exist
SELECT 
    'NOTIFICATIONS CHECK' as check_type,
    n.id,
    n.type,
    n.message,
    n.created_at,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read
FROM notifications n
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY n.created_at DESC
LIMIT 10;

-- 5. Check specifically for Absentee notifications
SELECT 
    'ABSENTEE NOTIFICATIONS' as check_type,
    n.id,
    n.message,
    n.created_at,
    nr.recipient_id,
    u.full_name as recipient_name,
    u.email as recipient_email
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
ORDER BY n.created_at DESC
LIMIT 5;

-- 6. Summary counts
SELECT 
    'SUMMARY COUNTS' as check_type,
    (SELECT COUNT(*) FROM students WHERE parent_id IS NOT NULL) as students_with_parents,
    (SELECT COUNT(*) FROM student_attendance WHERE status = 'Absent' AND date >= CURRENT_DATE - INTERVAL '7 days') as recent_absences,
    (SELECT COUNT(*) FROM notifications WHERE type = 'Absentee' AND created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_absence_notifications,
    (SELECT COUNT(*) FROM notification_recipients nr JOIN notifications n ON nr.notification_id = n.id WHERE n.type = 'Absentee' AND n.created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_notification_recipients;

-- 7. If no trigger exists, create a simple one
DO $$
BEGIN
    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'absence_notification_trigger'
        AND event_object_table = 'student_attendance'
    ) THEN
        -- Create the simple trigger
        EXECUTE '
        CREATE OR REPLACE FUNCTION notify_parent_absence()
        RETURNS TRIGGER AS $func$
        DECLARE
            student_name TEXT;
            student_admission_no TEXT;
            parent_id UUID;
            notification_msg TEXT;
            notification_id UUID;
        BEGIN
            -- Only process absent status
            IF NEW.status = ''Absent'' THEN
                -- Get student and parent info
                SELECT s.name, s.admission_no, s.parent_id
                INTO student_name, student_admission_no, parent_id
                FROM students s
                WHERE s.id = NEW.student_id;
                
                -- Check if we have valid data
                IF student_name IS NOT NULL AND parent_id IS NOT NULL THEN
                    -- Create message
                    notification_msg := ''Your ward '' || student_name;
                    
                    IF student_admission_no IS NOT NULL THEN
                        notification_msg := notification_msg || '' ('' || student_admission_no || '')'';
                    END IF;
                    
                    notification_msg := notification_msg || '' was absent today ('' || 
                        TO_CHAR(NEW.date, ''DD/MM/YYYY'') || ''). Please contact the school if this is incorrect.'';
                    
                    -- Check if notification already exists for today
                    IF NOT EXISTS (
                        SELECT 1 FROM notifications n
                        JOIN notification_recipients nr ON n.id = nr.notification_id
                        WHERE nr.recipient_id = parent_id
                        AND n.type = ''Absentee''
                        AND DATE(n.created_at) = NEW.date
                        AND n.message LIKE ''%'' || student_name || ''%''
                    ) THEN
                        -- Create notification
                        INSERT INTO notifications (
                            type, message, delivery_mode, delivery_status, created_at
                        ) VALUES (
                            ''Absentee'', notification_msg, ''InApp'', ''Sent'', NOW()
                        ) RETURNING id INTO notification_id;
                        
                        -- Create recipient
                        INSERT INTO notification_recipients (
                            notification_id, recipient_id, recipient_type, 
                            delivery_status, sent_at, is_read
                        ) VALUES (
                            notification_id, parent_id, ''Parent'', ''Sent'', NOW(), false
                        );
                    END IF;
                END IF;
            END IF;
            
            RETURN NEW;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don''t fail the attendance update
                RAISE WARNING ''Failed to send absence notification: %'', SQLERRM;
                RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
        
        CREATE TRIGGER absence_notification_trigger
            AFTER INSERT OR UPDATE ON student_attendance
            FOR EACH ROW
            EXECUTE FUNCTION notify_parent_absence();
        ';
        
        RAISE NOTICE 'Absence notification trigger created successfully!';
    ELSE
        RAISE NOTICE 'Absence notification trigger already exists.';
    END IF;
END $$;

-- 8. Final verification
SELECT 'FINAL CHECK - Trigger should now exist:' as status;
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';

-- Instructions for next steps
SELECT '
NEXT STEPS:
1. Check the results above
2. If no students have parent_id, you need to link students to parents
3. If no trigger exists after running this script, there may be permission issues
4. Test by marking a student absent in the app
5. Use the Debug button in parent dashboard to check relationships
' as instructions;
