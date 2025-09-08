# Onboarding Setup Fix

## Current Issues:
1. **404 Error**: Stored function `create_tenant_with_admin_secure` doesn't exist (fixed in code)
2. **RLS Violation**: Row Level Security is blocking user record creation

## Quick Fix Steps:

### Step 1: Run the Database Setup
Copy and paste the entire contents of `complete-database-setup.sql` into your Supabase SQL Editor and run it. This will:

- ✅ Create the correct `create_tenant_with_admin` function
- ✅ Create a new `create_user_record` function to bypass RLS
- ✅ Add proper RLS policies for user record creation
- ✅ Grant necessary permissions

### Step 2: Test the Onboarding
1. Open `simple-onboarding.html` in your browser
2. Try creating an account with:
   - Email: `test@example.com`
   - Password: `123` (or any simple password)
   - Confirm password: `123`

### Step 3: What Should Happen Now:
- ✅ Tenant creation will use the stored function (no more 404 error)
- ✅ User record creation will use the secure stored function to bypass RLS
- ✅ If stored functions fail, fallback methods will still work
- ✅ No more RLS violation errors

## Alternative Quick Fix (If Step 1 doesn't work):

If you prefer to temporarily disable RLS for testing:

```sql
-- Run this in Supabase SQL Editor (TEMPORARY FIX)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
```

⚠️ **WARNING**: Only use this for development/testing. In production, use the stored function approach above.

## Code Changes Made:
1. Fixed function name from `create_tenant_with_admin_secure` to `create_tenant_with_admin`
2. Updated `AdminUserService.createUserRecord()` to use stored function with fallback
3. Added comprehensive RLS policies for user management

## Testing:
After running the SQL setup, your onboarding should work without any 404 or RLS errors. The system will:
- Create tenants securely
- Create admin users without RLS violations
- Generate school names automatically from email domains
- Set up proper role assignments

## Files Updated:
- ✅ `supabase-config.js` - Fixed function name
- ✅ `simple-onboarding.js` - Added stored function support for user records
- ✅ `complete-database-setup.sql` - New comprehensive database setup

## Need Help?
If you still get errors after running the SQL setup, please share:
1. Any error messages from the browser console
2. Any error messages from the Supabase SQL Editor
3. Your Supabase dashboard RLS policy settings for the `users` and `tenants` tables
