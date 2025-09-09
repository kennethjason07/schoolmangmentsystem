# Teacher Dashboard Not Visible - Debug Guide

## Common Issues and Solutions

### 1. **Loading State Issues**
**Symptoms:** Dashboard shows loading spinner forever or blank screen
**Causes:** Database connection issues, authentication problems, or data fetching errors

**Debug Steps:**
1. Open browser console (F12)
2. Copy and paste the content of `debug_teacher_dashboard.js` into console
3. Look for error messages in console logs
4. Check if authentication is working properly

### 2. **Authentication Issues**
**Symptoms:** Redirected to login or blank dashboard
**Causes:** Invalid session, role mapping issues, or token expiration

**Quick Fix:**
```javascript
// Run in browser console to check auth status
localStorage.getItem('sb-access-token') || sessionStorage.getItem('supabase.auth.token')
```

**Solution:** Try logging out and logging back in as a teacher user.

### 3. **Database Connection Issues**
**Symptoms:** Loading forever, error messages about database
**Causes:** Supabase connection issues, missing teacher profile, or tenant validation errors

**Check these in console:**
- Look for "Tenant validation failed" messages
- Look for "Teacher profile not found" messages  
- Look for "Database timeout" errors

### 4. **Missing Teacher Profile**
**Symptoms:** Error message "Teacher profile not found"
**Cause:** Teacher user exists in auth but not in teachers table

**Database Fix:** Run this SQL in your database:
```sql
-- Check if teacher profile exists
SELECT * FROM teachers WHERE user_id = 'YOUR_USER_ID_HERE';

-- Check if user has correct role_id for teacher (should be 2)
SELECT * FROM users WHERE id = 'YOUR_USER_ID_HERE';

-- If missing, you may need to create teacher profile or fix role_id
```

### 5. **Missing Database Tables**
**Symptoms:** Errors about tables not existing
**Common missing tables:**
- `teachers` table
- `teacher_subjects` table  
- `timetable` table
- `personal_tasks` table

### 6. **Tenant Validation Issues**
**Symptoms:** "Access Denied" or "Invalid tenant data" errors
**Cause:** Multi-tenant setup with incorrect tenant_id associations

**Check in console:**
- Look for "Tenant validation failed" messages
- Check if user has correct tenant_id

## Step-by-Step Debug Process

### Step 1: Run the Debug Script
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Copy the entire content of `debug_teacher_dashboard.js`
4. Paste it in console and press Enter
5. Navigate to Teacher Dashboard
6. Watch console for error messages

### Step 2: Check Authentication
```javascript
// Run in console to check current user
console.log('Current user:', JSON.parse(localStorage.getItem('sb-access-token') || '{}'));
```

### Step 3: Check Network Tab
1. Go to Network tab in Developer Tools
2. Refresh the Teacher Dashboard page
3. Look for failed requests (red entries)
4. Check if any requests return 401, 403, or 500 errors

### Step 4: Check Database Data
Run these queries in your database:

```sql
-- 1. Check if your user exists and has teacher role
SELECT u.id, u.email, u.role_id, r.role_name 
FROM users u 
LEFT JOIN roles r ON u.role_id = r.id 
WHERE u.email = 'YOUR_TEACHER_EMAIL_HERE';

-- 2. Check if teacher profile exists
SELECT * FROM teachers WHERE user_id = 'YOUR_USER_ID_HERE';

-- 3. Check teacher subject assignments
SELECT ts.*, s.name as subject_name, c.class_name 
FROM teacher_subjects ts
LEFT JOIN subjects s ON ts.subject_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE ts.teacher_id = 'YOUR_TEACHER_ID_HERE';

-- 4. Check today's timetable
SELECT t.*, s.name as subject_name, c.class_name 
FROM timetable t
LEFT JOIN subjects s ON t.subject_id = s.id  
LEFT JOIN classes c ON t.class_id = c.id
WHERE t.teacher_id = 'YOUR_TEACHER_ID_HERE'
AND t.day_of_week = 'Monday'; -- Change to current day
```

## Quick Fixes

### Fix 1: Reset Authentication
```javascript
// Clear all auth data and refresh
localStorage.clear();
sessionStorage.clear();
window.location.reload();
```

### Fix 2: Force Data Refresh
```javascript
// If you can access the app's refresh function
window.location.href = window.location.href + '?refresh=' + Date.now();
```

### Fix 3: Check Required Environment Variables
Ensure your `.env` file has:
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_key
```

## Most Common Solutions

1. **Log out and log back in** - Fixes 70% of auth-related issues
2. **Clear browser cache and cookies** - Fixes cached data issues  
3. **Check database has required tables** - Many errors are from missing tables
4. **Verify teacher profile exists in database** - User might exist in auth but not in teachers table
5. **Check role_id is correct** - Should be 2 for teacher users

## Contact Points

If none of the above works, the issue is likely:
1. **Database schema missing tables** - Need to run database migrations
2. **Tenant configuration issue** - Multi-tenant setup problem
3. **Authentication service down** - Supabase connection issue
4. **Code deployment issue** - Latest code not deployed properly

## Emergency Fallback

If dashboard completely broken, you can create a minimal teacher view by adding this to your browser console:

```javascript
// Emergency teacher dashboard fallback
document.body.innerHTML = `
  <div style="padding: 20px; font-family: Arial, sans-serif;">
    <h1>Teacher Dashboard (Emergency Mode)</h1>
    <p>Main dashboard is experiencing issues. Basic functionality:</p>
    <div style="margin: 20px 0;">
      <button onclick="window.location.href='#/attendance'" style="margin: 10px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px;">Take Attendance</button>
      <button onclick="window.location.href='#/marks'" style="margin: 10px; padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px;">Enter Marks</button>
      <button onclick="window.location.href='#/timetable'" style="margin: 10px; padding: 10px 20px; background: #FF9800; color: white; border: none; border-radius: 5px;">View Timetable</button>
    </div>
    <p style="color: red;">Please contact administrator to fix main dashboard.</p>
  </div>
`;
```
