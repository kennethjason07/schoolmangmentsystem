-- Step 2: Create notification helper functions (run this second)

-- Function to get all parent user IDs for a given class (simplified email-based approach)
CREATE OR REPLACE FUNCTION get_class_parent_ids(p_class_id UUID)
RETURNS TABLE(parent_user_id UUID, parent_name TEXT, parent_email TEXT) AS $$
BEGIN
    -- Simplified approach: Find parents by matching emails between parents and users tables
    RETURN QUERY
    SELECT DISTINCT 
        u.id as parent_user_id,
        u.full_name as parent_name,
        u.email as parent_email
    FROM students s
    JOIN parents p ON (s.parent_id = p.id OR p.student_id = s.id)
    JOIN users u ON p.email = u.email AND u.role_id = 3
    WHERE s.class_id = p_class_id
    AND p.email IS NOT NULL 
    AND u.email IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to create bulk notifications for a class
CREATE OR REPLACE FUNCTION create_bulk_notification(
    p_class_id UUID,
    p_notification_type TEXT,
    p_message TEXT,
    p_delivery_mode TEXT DEFAULT 'InApp',
    p_recipient_types TEXT[] DEFAULT ARRAY['Parent']
)
RETURNS JSON AS $$
DECLARE
    notification_id UUID;
    parent_record RECORD;
    recipient_count INTEGER := 0;
    result_json JSON;
BEGIN
    -- Create the main notification
    INSERT INTO notifications (type, message, delivery_mode, created_at)
    VALUES (p_notification_type::notification_type_enum, p_message, p_delivery_mode, CURRENT_TIMESTAMP)
    RETURNING id INTO notification_id;
    
    -- Add recipients based on type
    IF 'Parent' = ANY(p_recipient_types) THEN
        -- Get parents for the class and add them as recipients
        FOR parent_record IN 
            SELECT parent_user_id, parent_name, parent_email
            FROM get_class_parent_ids(p_class_id)
        LOOP
            INSERT INTO notification_recipients (
                notification_id,
                recipient_id,
                recipient_type,
                delivery_status,
                sent_at
            ) VALUES (
                notification_id,
                parent_record.parent_user_id,
                'Parent',
                'Sent',
                CURRENT_TIMESTAMP
            );
            
            recipient_count := recipient_count + 1;
        END LOOP;
    END IF;
    
    -- Create result JSON
    result_json := json_build_object(
        'notification_id', notification_id,
        'recipient_count', recipient_count,
        'success', true
    );
    
    -- Log the notification creation
    RAISE NOTICE 'Created notification % with % recipients for class %', 
        notification_id, recipient_count, p_class_id;
    
    RETURN result_json;
EXCEPTION WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'notification_id', null,
        'recipient_count', 0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create grade entry notification (specific function)
CREATE OR REPLACE FUNCTION notify_grade_entry(
    p_class_id UUID,
    p_subject_id UUID,
    p_exam_id UUID,
    p_teacher_id UUID
)
RETURNS JSON AS $$
DECLARE
    class_name TEXT;
    subject_name TEXT;
    exam_name TEXT;
    teacher_name TEXT;
    message_text TEXT;
    result_json JSON;
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
        COALESCE(subject_name, 'Unknown Subject'),
        COALESCE(exam_name, 'Unknown Exam'),
        COALESCE(teacher_name, 'Teacher')
    );
    
    -- Use the bulk notification function
    SELECT create_bulk_notification(
        p_class_id,
        'GRADE_ENTERED',
        message_text,
        'InApp',
        ARRAY['Parent']
    ) INTO result_json;
    
    RETURN result_json;
EXCEPTION WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'notification_id', null,
        'recipient_count', 0
    );
END;
$$ LANGUAGE plpgsql;
