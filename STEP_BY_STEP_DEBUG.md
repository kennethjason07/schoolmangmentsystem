# Step-by-Step Debug Guide: Absence Notifications Not Showing

## 🚨 IMMEDIATE STEPS TO FOLLOW

### Step 1: Check if Debug Buttons Are Visible

1. **Open Parent App**
2. **Login as a parent**
3. **Click the notification bell icon** (top right)
4. **Look for 3 colored buttons**: Debug (Orange), Test (Blue), Refresh (Green)

**If you DON'T see these buttons:**
- The app code changes haven't been applied
- Restart the app completely
- Clear cache if needed

**If you DO see these buttons, proceed to Step 2**

### Step 2: Run Debug Button

1. **Click the "Debug" button** (Orange)
2. **Check the popup message**
3. **Check the console logs** (if you have access)

**Expected Results:**
- **SUCCESS**: Shows "Parent has X student(s)" with student names
- **ISSUE**: Shows "No students found for this parent"

### Step 3: Database Setup (CRITICAL)

**Run this in your Supabase SQL Editor:**

```sql
-- 1. First, check current state
SELECT 'Checking current setup...' as status;

-- Check if trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%absence%';

-- Check student-parent relationships
SELECT s.name as student_name, s.parent_id, u.full_name as parent_name
FROM students s
LEFT JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
LIMIT 5;

-- 2. Create the trigger (if it doesn't exist)
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

-- 3. Verify trigger was created
SELECT 'Trigger created successfully!' as result;
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';
```

### Step 4: Test the System

**Option A: Use Test Button**
1. **Click "Test" button** (Blue) in parent app
2. **Should create a test notification**
3. **Click "Refresh" button** (Green)
4. **Check if test notification appears**

**Option B: Manual Database Test**
```sql
-- Replace 'STUDENT_ID' with actual student ID that has a parent
INSERT INTO student_attendance (
    student_id, 
    class_id, 
    date, 
    status, 
    created_at
) 
SELECT 
    s.id,
    s.class_id,
    CURRENT_DATE,
    'Absent',
    NOW()
FROM students s 
WHERE s.parent_id IS NOT NULL 
LIMIT 1;

-- Check if notification was created
SELECT n.message, nr.recipient_id
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.type = 'Absentee'
ORDER BY n.created_at DESC
LIMIT 1;
```

### Step 5: Fix Student-Parent Relationships (If Needed)

**If Debug button shows "No students found":**

```sql
-- Check all students
SELECT id, name, parent_id FROM students LIMIT 10;

-- Check all parent users
SELECT id, full_name, email FROM users 
WHERE role_id = (SELECT id FROM roles WHERE name = 'Parent')
LIMIT 10;

-- Link a student to a parent (replace with actual IDs)
UPDATE students 
SET parent_id = 'PARENT_USER_ID_HERE'
WHERE id = 'STUDENT_ID_HERE';
```

## 🔍 TROUBLESHOOTING CHECKLIST

### ✅ App Level Issues:
- [ ] Debug buttons visible in parent app
- [ ] Debug button shows student relationships
- [ ] Test button creates notifications
- [ ] Refresh button fetches notifications

### ✅ Database Level Issues:
- [ ] Trigger exists and is active
- [ ] Students have valid parent_id
- [ ] Parent users exist in users table
- [ ] Notifications table accessible

### ✅ Data Flow Issues:
- [ ] Attendance marking triggers notification creation
- [ ] Notifications appear in database
- [ ] Parent dashboard fetches notifications correctly

## 🚀 QUICK FIX COMMANDS

**If nothing works, run these in order:**

```sql
-- 1. Clean slate
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
DROP FUNCTION IF EXISTS notify_parent_absence();

-- 2. Recreate trigger (copy from Step 3 above)

-- 3. Test immediately
INSERT INTO student_attendance (student_id, class_id, date, status)
SELECT s.id, s.class_id, CURRENT_DATE, 'Absent'
FROM students s WHERE s.parent_id IS NOT NULL LIMIT 1;

-- 4. Check result
SELECT COUNT(*) as notifications_created
FROM notifications 
WHERE type = 'Absentee' 
AND created_at >= CURRENT_DATE;
```

## 📞 REPORT BACK

After following these steps, please report:

1. **Can you see the Debug/Test/Refresh buttons?**
2. **What does the Debug button popup say?**
3. **Did the database trigger get created successfully?**
4. **Does the Test button create a notification?**
5. **Any error messages in console or database?**

This will help identify exactly where the issue is occurring!
