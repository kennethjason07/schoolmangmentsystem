# Automated Absence Notification System Setup

## Overview
This system automatically sends notifications to parents whenever their child is marked absent, using a database trigger that works regardless of which interface is used to mark attendance.

## 🚀 Quick Setup

### Step 1: Create the Database Trigger
Run the SQL script to create the automated notification trigger:

```sql
-- Execute this in your Supabase SQL editor or database console
-- File: create_simple_absence_trigger.sql

CREATE OR REPLACE FUNCTION notify_parent_absence()
RETURNS TRIGGER AS $$
DECLARE
    student_name TEXT;
    student_admission_no TEXT;
    parent_id UUID;
    notification_msg TEXT;
    notification_id UUID;
BEGIN
    -- Only process absent status
    IF NEW.status = 'Absent' THEN
        -- Get student and parent info
        SELECT s.name, s.admission_no, s.parent_id
        INTO student_name, student_admission_no, parent_id
        FROM students s
        WHERE s.id = NEW.student_id;
        
        -- Check if we have valid data
        IF student_name IS NOT NULL AND parent_id IS NOT NULL THEN
            -- Create message
            notification_msg := 'Your ward ' || student_name;
            
            IF student_admission_no IS NOT NULL THEN
                notification_msg := notification_msg || ' (' || student_admission_no || ')';
            END IF;
            
            notification_msg := notification_msg || ' was absent today (' || 
                TO_CHAR(NEW.date, 'DD/MM/YYYY') || '). Please contact the school if this is incorrect.';
            
            -- Check if notification already exists for today
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                JOIN notification_recipients nr ON n.id = nr.notification_id
                WHERE nr.recipient_id = parent_id
                AND n.type = 'Absentee'
                AND DATE(n.created_at) = NEW.date
                AND n.message LIKE '%' || student_name || '%'
            ) THEN
                -- Create notification
                INSERT INTO notifications (
                    type, message, delivery_mode, delivery_status, created_at
                ) VALUES (
                    'Absentee', notification_msg, 'InApp', 'Sent', NOW()
                ) RETURNING id INTO notification_id;
                
                -- Create recipient
                INSERT INTO notification_recipients (
                    notification_id, recipient_id, recipient_type, 
                    delivery_status, sent_at, is_read
                ) VALUES (
                    notification_id, parent_id, 'Parent', 'Sent', NOW(), false
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the attendance update
        RAISE WARNING 'Failed to send absence notification: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
CREATE TRIGGER absence_notification_trigger
    AFTER INSERT OR UPDATE ON student_attendance
    FOR EACH ROW
    EXECUTE FUNCTION notify_parent_absence();

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_parent_absence() TO authenticated;
```

### Step 2: Verify Setup
Run the test script to verify the trigger is working:

```sql
-- Check if trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';

-- Find test student
SELECT s.id, s.name, s.parent_id, u.full_name as parent_name
FROM students s
JOIN users u ON s.parent_id = u.id
LIMIT 5;
```

### Step 3: Test the System
1. **Manual Test**: Mark a student absent in any attendance interface
2. **Check Notifications**: Verify notification appears in parent dashboard
3. **Automated Test**: Use the test function provided in test script

## 📱 How It Works

### Trigger Flow:
1. **Teacher/Admin marks student absent** → `student_attendance` table updated
2. **Database trigger fires** → `notify_parent_absence()` function executes
3. **Function checks conditions** → Student exists, has parent, not duplicate
4. **Notification created** → `notifications` and `notification_recipients` tables
5. **Parent sees notification** → Appears in parent dashboard automatically

### Message Format:
```
"Your ward [Student Name] ([Admission No]) was absent today (DD/MM/YYYY). Please contact the school if this is incorrect."
```

### Duplicate Prevention:
- Checks if notification already sent for same student on same date
- Prevents spam from multiple attendance updates

## 🔧 Features

### ✅ **Automatic Operation**
- Works with all attendance interfaces (Teacher, Admin, Individual updates)
- No manual intervention required
- Triggers on INSERT or UPDATE of attendance records

### ✅ **Smart Detection**
- Only triggers for 'Absent' status
- Validates student-parent relationships
- Prevents duplicate notifications

### ✅ **Error Handling**
- Graceful failure (doesn't break attendance marking)
- Logs errors for debugging
- Continues operation even if notification fails

### ✅ **Performance Optimized**
- Minimal database queries
- Efficient duplicate checking
- No impact on attendance marking speed

## 🧪 Testing

### Manual Testing:
1. Open any attendance marking interface
2. Mark a student as 'Absent'
3. Check parent dashboard for notification
4. Verify message content and formatting

### Automated Testing:
```sql
-- Run test function
SELECT * FROM test_absence_trigger();
```

### Verification Queries:
```sql
-- Check recent notifications
SELECT n.message, n.created_at, nr.recipient_id
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.type = 'Absentee'
ORDER BY n.created_at DESC
LIMIT 10;

-- Check specific student notifications
SELECT n.message, n.created_at
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
JOIN students s ON s.parent_id = nr.recipient_id
WHERE s.name = 'Student Name Here'
AND n.type = 'Absentee';
```

## 🛠️ Maintenance

### To Update the Trigger:
1. Run cleanup script: `cleanup_absence_trigger.sql`
2. Run setup script: `create_simple_absence_trigger.sql`

### To Remove the System:
```sql
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
DROP FUNCTION IF EXISTS notify_parent_absence();
```

### Monitoring:
- Check database logs for trigger warnings
- Monitor notification delivery rates
- Verify parent feedback on notification accuracy

## 📊 Benefits

### For Parents:
- ✅ Immediate notification of child's absence
- ✅ Ability to verify attendance accuracy
- ✅ Better communication with school

### For Teachers/Admins:
- ✅ Automatic notification system
- ✅ No manual notification work
- ✅ Consistent communication

### For School:
- ✅ Improved parent engagement
- ✅ Better attendance tracking
- ✅ Reduced manual administrative work

## 🔍 Troubleshooting

### If Notifications Don't Appear:
1. Check if trigger exists (use verification queries)
2. Verify student-parent relationships in database
3. Check parent dashboard notification fetching
4. Review database logs for errors

### Common Issues:
- **Missing parent_id**: Ensure students have valid parent relationships
- **Duplicate notifications**: Trigger includes duplicate prevention
- **Permission errors**: Ensure proper database permissions granted

The system is now fully automated and will send absence notifications whenever any student is marked absent through any interface!
