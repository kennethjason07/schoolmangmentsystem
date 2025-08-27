-- Notification Helper Functions
-- Run this in Supabase SQL Editor

-- Function to get all parent user IDs for a given class
CREATE OR REPLACE FUNCTION get_class_parent_ids(p_class_id UUID)
RETURNS TABLE(parent_user_id UUID, parent_name TEXT, parent_email TEXT) AS $$
BEGIN
    -- Return parent user IDs for all students in the class
    -- Uses multiple methods to find parent relationships
    RETURN QUERY
    WITH class_students AS (
        SELECT s.id as student_id, s.name as student_name
        FROM students s
        WHERE s.class_id = p_class_id
    ),
    parent_relationships AS (
        -- Method 1: Direct parent_id in students table
        SELECT DISTINCT 
            u.id as parent_user_id,
            u.full_name as parent_name,
            u.email as parent_email,
            s.student_id
        FROM class_students s
        JOIN students st ON s.student_id = st.id
        JOIN parents p ON st.parent_id = p.id
        JOIN users u ON p.email = u.email AND u.role_id = 3
        
        UNION
        
        -- Method 2: Through parents table with student_id reference
        SELECT DISTINCT 
            u.id as parent_user_id,
            u.full_name as parent_name,
            u.email as parent_email,
            s.student_id
        FROM class_students s
        JOIN parents p ON s.student_id = p.student_id
        JOIN users u ON p.email = u.email AND u.role_id = 3
        
        UNION
        
        -- Method 3: Through users.linked_parent_of field
        SELECT DISTINCT 
            u.id as parent_user_id,
            u.full_name as parent_name,
            u.email as parent_email,
            s.student_id
        FROM class_students s
        JOIN users u ON s.student_id = u.linked_parent_of AND u.role_id = 3
    )
    SELECT DISTINCT 
        pr.parent_user_id,
        pr.parent_name,
        pr.parent_email
    FROM parent_relationships pr;
END;
$$ LANGUAGE plpgsql;

-- Function to get all student user IDs for a given class
CREATE OR REPLACE FUNCTION get_class_student_ids(p_class_id UUID)
RETURNS TABLE(student_user_id UUID, student_name TEXT, student_email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as student_user_id,
        u.full_name as student_name,
        u.email as student_email
    FROM students s
    JOIN users u ON s.id::text = u.linked_student_of::text OR u.email LIKE '%' || s.admission_no || '%'
    WHERE s.class_id = p_class_id 
    AND u.role_id = 4; -- Assuming role_id 4 is student
END;
$$ LANGUAGE plpgsql;

-- Function to get both students and parents for a class
CREATE OR REPLACE FUNCTION get_class_students_and_parents(p_class_id UUID)
RETURNS TABLE(
    user_id UUID, 
    user_name TEXT, 
    user_email TEXT, 
    recipient_type TEXT,
    student_id UUID,
    student_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH class_students AS (
        SELECT s.id as student_id, s.name as student_name
        FROM students s
        WHERE s.class_id = p_class_id
    )
    -- Get parents
    SELECT 
        p.parent_user_id as user_id,
        p.parent_name as user_name,
        p.parent_email as user_email,
        'Parent'::text as recipient_type,
        cs.student_id,
        cs.student_name
    FROM class_students cs
    CROSS JOIN LATERAL get_class_parent_ids(p_class_id) p
    
    UNION ALL
    
    -- Get students  
    SELECT 
        s.student_user_id as user_id,
        s.student_name as user_name,
        s.student_email as user_email,
        'Student'::text as recipient_type,
        cs.student_id,
        cs.student_name
    FROM class_students cs
    CROSS JOIN LATERAL get_class_student_ids(p_class_id) s;
END;
$$ LANGUAGE plpgsql;

-- Function to create bulk notification with recipients
CREATE OR REPLACE FUNCTION create_bulk_notification(
    p_notification_type TEXT,
    p_message TEXT,
    p_sent_by UUID,
    p_class_id UUID,
    p_recipient_types TEXT[] DEFAULT ARRAY['Parent'], -- 'Parent', 'Student', or both
    p_delivery_mode TEXT DEFAULT 'InApp'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    recipient_record RECORD;
    recipient_count INTEGER := 0;
BEGIN
    -- Create the main notification record
    INSERT INTO notifications (type, message, sent_by, delivery_mode, created_at)
    VALUES (p_notification_type, p_message, p_sent_by, p_delivery_mode, CURRENT_TIMESTAMP)
    RETURNING id INTO notification_id;
    
    -- Insert recipients based on specified types
    FOR recipient_record IN 
        SELECT user_id, user_name, user_email, recipient_type
        FROM get_class_students_and_parents(p_class_id)
        WHERE recipient_type = ANY(p_recipient_types)
    LOOP
        INSERT INTO notification_recipients (
            notification_id,
            recipient_id,
            recipient_type,
            delivery_status,
            sent_at
        ) VALUES (
            notification_id,
            recipient_record.user_id,
            recipient_record.recipient_type,
            'Pending',
            NULL
        );
        
        recipient_count := recipient_count + 1;
    END LOOP;
    
    -- Log the notification creation
    RAISE NOTICE 'Created notification % with % recipients for class %', 
        notification_id, recipient_count, p_class_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create grade entry notification
CREATE OR REPLACE FUNCTION notify_grade_entry(
    p_class_id UUID,
    p_subject_id UUID,
    p_exam_id UUID,
    p_teacher_id UUID
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    class_name TEXT;
    subject_name TEXT;
    exam_name TEXT;
    teacher_name TEXT;
    message_text TEXT;
BEGIN
    -- Get details for the message
    SELECT c.class_name || ' - ' || c.section INTO class_name
    FROM classes c WHERE c.id = p_class_id;
    
    SELECT s.name INTO subject_name
    FROM subjects s WHERE s.id = p_subject_id;
    
    SELECT e.name INTO exam_name
    FROM exams e WHERE e.id = p_exam_id;
    
    SELECT t.name INTO teacher_name
    FROM teachers t WHERE t.id = p_teacher_id;
    
    -- Create message
    message_text := format(
        'New marks have been entered for %s - %s by %s. Check your child''s progress in the marks section.',
        subject_name,
        exam_name,
        teacher_name
    );
    
    -- Create notification for parents only
    SELECT create_bulk_notification(
        'GRADE_ENTERED',
        message_text,
        (SELECT u.id FROM users u JOIN teachers t ON u.id::text = t.id::text WHERE t.id = p_teacher_id LIMIT 1),
        p_class_id,
        ARRAY['Parent'],
        'InApp'
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create homework upload notification  
CREATE OR REPLACE FUNCTION notify_homework_upload(
    p_homework_id UUID,
    p_class_id UUID,
    p_subject_id UUID,
    p_teacher_id UUID
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    class_name TEXT;
    subject_name TEXT;
    teacher_name TEXT;
    homework_title TEXT;
    homework_due_date DATE;
    message_text TEXT;
    teacher_user_id UUID;
BEGIN
    -- Get details for the message
    SELECT c.class_name || ' - ' || c.section INTO class_name
    FROM classes c WHERE c.id = p_class_id;
    
    SELECT s.name INTO subject_name
    FROM subjects s WHERE s.id = p_subject_id;
    
    SELECT t.name INTO teacher_name
    FROM teachers t WHERE t.id = p_teacher_id;
    
    SELECT h.title, h.due_date INTO homework_title, homework_due_date
    FROM homeworks h WHERE h.id = p_homework_id;
    
    -- Get teacher's user ID
    SELECT u.id INTO teacher_user_id
    FROM users u 
    JOIN teachers t ON u.email LIKE '%' || t.name || '%' OR u.full_name = t.name
    WHERE t.id = p_teacher_id
    LIMIT 1;
    
    -- Create message
    message_text := format(
        'New homework assigned for %s: "%s" by %s. Due date: %s. Check the homework section for details.',
        subject_name,
        homework_title,
        teacher_name,
        homework_due_date::text
    );
    
    -- Create notification for both parents and students
    SELECT create_bulk_notification(
        'HOMEWORK_UPLOADED',
        message_text,
        COALESCE(teacher_user_id, (SELECT id FROM users WHERE role_id = 2 LIMIT 1)), -- Fallback to any teacher
        p_class_id,
        ARRAY['Parent', 'Student'],
        'InApp'
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID,
    p_recipient_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE notification_recipients
    SET is_read = true,
        read_at = CURRENT_TIMESTAMP
    WHERE notification_id = p_notification_id
    AND recipient_id = p_recipient_id
    AND is_read = false;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get user notifications
CREATE OR REPLACE FUNCTION get_user_notifications(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_unread_only BOOLEAN DEFAULT false
)
RETURNS TABLE(
    notification_id UUID,
    notification_type TEXT,
    message TEXT,
    delivery_mode TEXT,
    sent_by_name TEXT,
    sent_at TIMESTAMP,
    is_read BOOLEAN,
    read_at TIMESTAMP,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id as notification_id,
        n.type::text as notification_type,
        n.message,
        n.delivery_mode,
        u.full_name as sent_by_name,
        nr.sent_at,
        nr.is_read,
        nr.read_at,
        n.created_at
    FROM notifications n
    JOIN notification_recipients nr ON n.id = nr.notification_id
    LEFT JOIN users u ON n.sent_by = u.id
    WHERE nr.recipient_id = p_user_id
    AND (NOT p_unread_only OR nr.is_read = false)
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Test the functions (commented out - uncomment to test)
/*
-- Test getting class parents
SELECT * FROM get_class_parent_ids('your-class-id-here');

-- Test getting class students  
SELECT * FROM get_class_student_ids('your-class-id-here');

-- Test creating a notification
SELECT create_bulk_notification(
    'ANNOUNCEMENT', 
    'Test notification message',
    'your-user-id-here',
    'your-class-id-here',
    ARRAY['Parent'],
    'InApp'
);
*/
