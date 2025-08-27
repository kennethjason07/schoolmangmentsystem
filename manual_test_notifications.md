# Manual Test Guide for Grade Entry Notifications

## ✅ **Step 1: Setup Database (Run in Supabase SQL Editor)**

### 1.1 Create Notification Enum Types
```sql
-- Copy and paste this into Supabase SQL Editor and run:

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
            
        END;
    END IF;
END $$;
```

### 1.2 Create Helper Functions  
```sql
-- Copy and paste this into Supabase SQL Editor and run:

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
    parent_record RECORD;
    recipient_count INTEGER := 0;
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
    
    -- Create notification
    INSERT INTO notifications (type, message, sent_by, delivery_mode, created_at)
    VALUES ('GRADE_ENTERED', message_text, (SELECT u.id FROM users u JOIN teachers t ON u.id::text = t.id::text WHERE t.id = p_teacher_id LIMIT 1), 'InApp', CURRENT_TIMESTAMP)
    RETURNING id INTO notification_id;
    
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
    
    -- Log the notification creation
    RAISE NOTICE 'Created notification % with % recipients for class %', 
        notification_id, recipient_count, p_class_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;
```

## ✅ **Step 2: Manual Test Process**

### 2.1 Test Grade Entry with Notifications
1. **Login as Teacher** in your app
2. **Navigate** to "Marks Entry" screen
3. **Select** a class that has students
4. **Select** an exam
5. **Select** a subject  
6. **Enter marks** for some students (any values)
7. **Click "Save Marks"**

### 2.2 Expected Results
- ✅ You should see success message: **"Marks saved successfully and X parents notified!"**
- ✅ The success message should include the number of parents notified
- ✅ Check console logs for: "✅ Parent notifications sent successfully"

### 2.3 Check Parent Notifications
1. **Login as Parent** (if you have a parent account)
2. **Navigate** to notifications section
3. **Look for notification**: "New marks have been entered for [Subject] - [Exam] by [Teacher Name]. Check your child's progress in the marks section."

## ✅ **Step 3: Troubleshooting**

### If you see "0 parents notified":
This means the notification system is working, but no parents were found for the class.

**Check parent-student relationships:**
```sql
-- Run this query in Supabase to check parent relationships for a class:
-- Replace 'your-class-id' with actual class ID

SELECT 
    s.name as student_name,
    p.name as parent_name,
    p.email as parent_email,
    u.id as parent_user_id,
    u.full_name as parent_user_name
FROM students s
LEFT JOIN parents p ON s.parent_id = p.id OR p.student_id = s.id
LEFT JOIN users u ON p.email = u.email AND u.role_id = 3
WHERE s.class_id = 'your-class-id'
ORDER BY s.name;
```

### If you see "Parent notifications may have failed to send":
Check the console logs for specific error messages.

### If no notification message appears:
The integration might not be working. Check:
1. Did you restart your app after adding the integration?
2. Are there any errors in the console?
3. Did you run the SQL scripts successfully?

## ✅ **Step 4: Verify Database Changes**

### Check if notifications were created:
```sql
-- Run this in Supabase to see recent notifications
SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    nr.recipient_type,
    COUNT(nr.id) as recipient_count
FROM notifications n
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.created_at > NOW() - INTERVAL '1 hour'
AND n.type = 'GRADE_ENTERED'
GROUP BY n.id, n.type, n.message, n.created_at, nr.recipient_type
ORDER BY n.created_at DESC;
```

## ✅ **Step 5: Success Criteria**

The system is working correctly if:
- ✅ Marks save successfully
- ✅ Success message shows "X parents notified" (X > 0 if parents exist)
- ✅ Notifications appear in database
- ✅ Parents can see notifications in their dashboard
- ✅ No errors in console logs

---

## 🆘 **If Still Having Issues**

If notifications still aren't working after following these steps:

1. **Check parent-student relationships** - Make sure students have parents linked in the database
2. **Verify SQL scripts ran successfully** - Look for success messages in Supabase SQL editor  
3. **Check console logs** - Look for error messages when saving marks
4. **Verify app restart** - Make sure you restarted the app after adding the notification integration

The most common issue is missing parent-student relationships in the database. Parents need to:
- Exist in the `parents` table
- Be linked to students (either via `students.parent_id` or `parents.student_id`)
- Have user accounts in the `users` table with `role_id = 3` (parent role)
- Have matching email addresses between `parents.email` and `users.email`
