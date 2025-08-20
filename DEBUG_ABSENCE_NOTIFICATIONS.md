# Debug Guide: Absence Notifications Not Appearing in Parent Dashboard

## 🔍 Problem Analysis

**Symptoms:**
- ✅ Teacher gets popup confirmation when marking attendance
- ❌ Parent doesn't see notifications in dashboard
- ❌ Notifications not appearing in parent notification section

**Possible Causes:**
1. Database trigger not firing
2. Notifications created but not fetched by parent dashboard
3. Student-parent relationship issues
4. Parent user ID mismatch
5. Notification fetching query issues

## 🛠️ Debugging Steps

### Step 1: Check Parent Dashboard Debug Info

**In Parent App:**
1. Open parent dashboard
2. Click notifications icon
3. Click **"Debug"** button (orange)
4. Check console logs and popup message

**What to Look For:**
- Does parent have any students linked?
- Are there recent absence records?
- What's the parent user ID?

### Step 2: Check Database Trigger

**Run in Supabase SQL Editor:**
```sql
-- Check if trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%absence%';

-- Check recent attendance records
SELECT sa.*, s.name, s.parent_id 
FROM student_attendance sa
JOIN students s ON sa.student_id = s.id
WHERE sa.status = 'Absent' 
AND sa.date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY sa.created_at DESC;
```

### Step 3: Check Notifications Created

**Run in Supabase SQL Editor:**
```sql
-- Check if notifications are being created
SELECT n.*, nr.recipient_id, nr.recipient_type
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.type = 'Absentee'
AND n.created_at >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY n.created_at DESC;
```

### Step 4: Check Student-Parent Relationships

**Run in Supabase SQL Editor:**
```sql
-- Check student-parent links
SELECT s.id, s.name, s.parent_id, u.full_name as parent_name, u.email
FROM students s
LEFT JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
ORDER BY s.name;
```

### Step 5: Enhanced Debug Trigger

**Install Debug Trigger:**
1. Run `create_debug_absence_trigger.sql` in Supabase
2. Mark a student absent
3. Check debug logs:

```sql
-- Check debug logs
SELECT * FROM notification_debug_log 
ORDER BY created_at DESC 
LIMIT 10;

-- Get summary
SELECT * FROM get_notification_debug_summary();
```

## 🔧 Common Issues & Solutions

### Issue 1: No Student-Parent Relationship

**Symptoms:**
- Debug shows "No students found for this parent"
- Database shows `parent_id` is NULL

**Solution:**
```sql
-- Fix student-parent relationship
UPDATE students 
SET parent_id = 'parent-user-id-here'
WHERE id = 'student-id-here';
```

### Issue 2: Wrong Parent User ID

**Symptoms:**
- Student has parent_id but notifications not appearing
- Parent user ID doesn't match student's parent_id

**Check:**
```sql
-- Verify parent user ID
SELECT id, full_name, email FROM users 
WHERE email = 'parent-email@example.com';

-- Check what's in student record
SELECT parent_id FROM students WHERE name = 'Student Name';
```

### Issue 3: Trigger Not Firing

**Symptoms:**
- No entries in debug log
- No notifications created despite absent records

**Solution:**
```sql
-- Reinstall trigger
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
-- Then run create_debug_absence_trigger.sql
```

### Issue 4: Notifications Created But Not Fetched

**Symptoms:**
- Notifications exist in database
- Parent dashboard shows empty list

**Check Parent Dashboard Logs:**
- Look for `[PARENT DASHBOARD]` logs in console
- Check if notification fetching query returns data

**Solution:**
```javascript
// In parent dashboard, check user.id matches recipient_id
console.log('Parent user ID:', user.id);
console.log('Notifications for this ID:', notificationsData);
```

## 🧪 Manual Testing

### Test 1: Create Test Notification

**In Parent Dashboard:**
1. Click notifications icon
2. Click **"Test"** button (blue)
3. Should create and display test notification

### Test 2: Manual Database Test

**Run in Supabase:**
```sql
-- Replace with actual IDs
INSERT INTO student_attendance (
    student_id, class_id, date, status, created_at
) VALUES (
    'actual-student-id',
    'actual-class-id', 
    CURRENT_DATE,
    'Absent',
    NOW()
);
```

### Test 3: Direct Notification Creation

**Run in Supabase:**
```sql
-- Create notification manually
WITH new_notification AS (
    INSERT INTO notifications (type, message, delivery_mode, delivery_status, created_at)
    VALUES ('Absentee', 'Test: Your ward was absent today', 'InApp', 'Sent', NOW())
    RETURNING id
)
INSERT INTO notification_recipients (notification_id, recipient_id, recipient_type, delivery_status, sent_at, is_read)
SELECT id, 'parent-user-id-here', 'Parent', 'Sent', NOW(), false
FROM new_notification;
```

## 📊 Verification Checklist

### ✅ Database Level:
- [ ] Trigger exists and is active
- [ ] Student has valid parent_id
- [ ] Parent user exists in users table
- [ ] Notifications are being created
- [ ] Notification recipients are being created

### ✅ App Level:
- [ ] Parent dashboard fetches notifications correctly
- [ ] User ID matches between login and database
- [ ] Notification display logic works
- [ ] Console logs show data being fetched

### ✅ Data Flow:
- [ ] Attendance marked → Trigger fires → Notification created → Parent sees it

## 🚀 Quick Fix Commands

### Reset Everything:
```sql
-- 1. Clean up
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
DROP FUNCTION IF EXISTS notify_parent_absence();

-- 2. Reinstall debug version
-- Run create_debug_absence_trigger.sql

-- 3. Test immediately
INSERT INTO student_attendance (student_id, class_id, date, status)
SELECT s.id, s.class_id, CURRENT_DATE, 'Absent'
FROM students s WHERE s.parent_id IS NOT NULL LIMIT 1;

-- 4. Check results
SELECT * FROM notification_debug_log ORDER BY created_at DESC LIMIT 5;
```

## 📞 Next Steps

1. **Run Debug Button** in parent dashboard
2. **Check Console Logs** for detailed information
3. **Run Database Queries** to verify data flow
4. **Install Debug Trigger** for detailed logging
5. **Report Findings** based on debug output

The enhanced debugging system will help identify exactly where the notification flow is breaking down!
