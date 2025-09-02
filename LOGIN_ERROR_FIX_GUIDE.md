# Fix: "Role 'admin' not found in the system" Login Error

## Problem Description

You're encountering this error when trying to log into your VidyaSetu application:

```
Role 'admin' not found in the system. Please contact the administrator.
```

**Root Cause**: The `roles` table in your Supabase database is empty. The application is trying to validate user roles during login, but no roles exist in the database.

## 🔧 Solutions (Choose One)

### Solution 1: SQL Script (RECOMMENDED)

This is the easiest and most reliable method.

1. **Go to your Supabase dashboard**
2. **Navigate to the SQL Editor** (left sidebar)
3. **Copy the entire contents** of the `fix_roles_rls.sql` file
4. **Paste it into the SQL Editor** and click "Run"

The script will:
- ✅ Create the default tenant (school)
- ✅ Insert all required roles (Admin, Teacher, Parent, Student)
- ✅ Fix any existing users with invalid role_ids
- ✅ Show verification results

### Solution 2: Using Service Role Key

If you have access to your Supabase service role key:

1. **Get your Service Role Key**:
   - Go to Supabase Dashboard → Settings → API
   - Copy the "service_role" key (NOT the anon key)

2. **Update the script**:
   - Open `insert_roles_alternative.js`
   - Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service key
   - Run: `node insert_roles_alternative.js`

### Solution 3: Temporarily Disable RLS

⚠️ **Use with caution** - this temporarily reduces security:

1. **Go to Supabase Dashboard → Authentication → Policies**
2. **Find the "roles" table** and disable Row Level Security temporarily
3. **Run**: `node check_roles_fix.js`
4. **Re-enable RLS** after roles are created

## 🛠 What the Fix Does

The solution creates these roles in your database:

| Role ID | Role Name | Purpose |
|---------|-----------|---------|
| 1 | Admin | System administrators |
| 2 | Teacher | Teachers and faculty |
| 3 | Parent | Student parents/guardians |
| 4 | Student | Students |

## 🧪 Testing the Fix

After running the fix, test it:

```bash
node insert_roles_alternative.js
```

You should see:
```
📊 Current roles count: 4
  - Admin (ID: 1)
  - Teacher (ID: 2)
  - Parent (ID: 3)
  - Student (ID: 4)
🎉 Roles exist! The login should work now.
```

## 📱 Improved Error Handling

The login screen has been updated with better error messages:

- **Database Setup Detection**: Automatically detects if roles table is empty
- **Helpful Instructions**: Provides setup instructions to users
- **Available Roles Display**: Shows which roles are actually configured
- **Better Error Messages**: More descriptive error messages for troubleshooting

## 🔍 Verification Steps

1. **Check the database**:
   ```bash
   node insert_roles_alternative.js
   ```

2. **Try logging in** with the Admin role

3. **Check the app logs** for any remaining errors

## 📁 Files Created/Modified

- ✅ `fix_roles_rls.sql` - Main database fix script
- ✅ `insert_roles_alternative.js` - Node.js alternative with instructions
- ✅ `check_roles_fix.js` - Testing script
- ✅ `LOGIN_ERROR_FIX_GUIDE.md` - This guide
- ✅ Updated `LoginScreen.js` with better error handling

## 🚨 If You Still Have Issues

1. **Check your internet connection**
2. **Verify Supabase credentials** in your app
3. **Check the browser/app console** for additional error messages
4. **Ensure the tenant_id** matches across all database records

## 💡 Prevention

To prevent this issue in the future:

1. **Always run database migrations** when setting up new environments
2. **Include role creation** in your initial database setup scripts
3. **Test role validation** before deploying to production
4. **Keep backup scripts** for critical database setup steps

---

## Quick Fix Command

If you just want to fix it quickly, run this SQL in your Supabase SQL editor:

```sql
-- Quick fix: Insert required roles
INSERT INTO public.tenants (
  id, name, subdomain, status, subscription_plan, 
  max_students, max_teachers, max_classes, contact_email
) VALUES (
  'b8f8b5f0-1234-4567-8901-123456789000', 'Default School', 'default', 
  'active', 'enterprise', 1000, 100, 50, 'admin@school.com'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (role_name, tenant_id) VALUES 
  ('Admin', 'b8f8b5f0-1234-4567-8901-123456789000'),
  ('Teacher', 'b8f8b5f0-1234-4567-8901-123456789000'),
  ('Parent', 'b8f8b5f0-1234-4567-8901-123456789000'),
  ('Student', 'b8f8b5f0-1234-4567-8901-123456789000')
ON CONFLICT (role_name) DO NOTHING;
```

After running this, your login should work! 🎉
