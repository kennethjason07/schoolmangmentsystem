-- Test the exact queries that the useUnreadNotificationCount hook uses

-- First, find the admin user(s)
SELECT 'FINDING ADMIN USER(S)' as step;
SELECT id, email, role_id FROM users WHERE role_id = 1;

-- Replace 'ADMIN_USER_ID' with the actual admin user ID from above
-- For example, if admin user ID is 12345, replace it below:

-- Test the exact query that the hook runs for Admin recipient type
SELECT 'TESTING EXACT HOOK QUERY FOR ADMIN' as step;
-- Replace 'YOUR_ADMIN_USER_ID' with the actual admin user ID
SELECT 
    id, 
    recipient_id, 
    recipient_type, 
    is_read,
    COUNT(*) OVER() as total_count
FROM notification_recipients 
WHERE recipient_id = 'YOUR_ADMIN_USER_ID'  -- Replace with actual admin user ID
  AND recipient_type = 'Admin' 
  AND is_read = false;

-- Alternative count query to verify
SELECT 'ALTERNATIVE COUNT VERIFICATION' as step;
SELECT 
    COUNT(*) as unread_count
FROM notification_recipients 
WHERE recipient_id = 'YOUR_ADMIN_USER_ID'  -- Replace with actual admin user ID
  AND recipient_type = 'Admin' 
  AND is_read = false;

-- Check all notification data for admin user
SELECT 'ALL NOTIFICATION DATA FOR ADMIN USER' as step;
SELECT 
    nr.id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    n.message,
    n.type,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id
WHERE nr.recipient_id = 'YOUR_ADMIN_USER_ID'  -- Replace with actual admin user ID
ORDER BY n.created_at DESC;

-- Instructions:
-- 1. First run the first query to get the admin user ID
-- 2. Replace 'YOUR_ADMIN_USER_ID' in the queries above with the actual ID
-- 3. Run the remaining queries to see the exact data
