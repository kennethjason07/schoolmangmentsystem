# 🛡️ Re-enable RLS with Proper Security Policies

This guide will help you re-enable Row Level Security (RLS) while maintaining the ability to create new tenants through the onboarding system.

## 🎯 **What This Does**

- ✅ **Enables RLS** on all important tables
- ✅ **Allows anonymous tenant creation** (for onboarding)
- ✅ **Enforces tenant isolation** for authenticated users
- ✅ **Maintains security** through proper policies
- ✅ **Uses secure function** with `SECURITY DEFINER`

## 📋 **Step-by-Step Instructions**

### Step 1: Run the RLS Setup Script

1. **Go to Supabase Dashboard**
2. **Click "SQL Editor"** in the sidebar
3. **Create a new query**
4. **Copy the entire contents** of `enable-rls-with-policies.sql`
5. **Paste it** into the SQL editor
6. **Click "Run"**

### Step 2: Verify the Setup

After running the script, you should see:
- ✅ **RLS enabled** on tenants, roles, users, school_details tables
- ✅ **Policies created** for each table
- ✅ **New secure function** created (`create_tenant_with_admin_secure`)

### Step 3: Test the Onboarding

1. **Open** `simple-onboarding.html`
2. **Enter** email and password
3. **Submit** - should work with RLS enabled!

## 🔐 **Security Model**

### **For Anonymous Users (Onboarding):**
- ✅ **Can create** tenants, roles, users, school_details
- ❌ **Cannot read** existing data
- ❌ **Cannot update** existing data
- ❌ **Cannot delete** anything

### **For Authenticated Users:**
- ✅ **Can read/update** their own tenant data
- ✅ **Can read** users in their tenant only
- ✅ **Can read** their own profile
- ❌ **Cannot access** other tenants' data

## 🧪 **Verification Queries**

After running the setup, you can verify with these queries:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('tenants', 'roles', 'users', 'school_details') 
AND schemaname = 'public';
```

```sql
-- Check policies exist
SELECT tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename IN ('tenants', 'roles', 'users', 'school_details')
ORDER BY tablename, policyname;
```

## 🔧 **What Changed**

### **Files Updated:**
1. **`enable-rls-with-policies.sql`** - Complete RLS setup script
2. **`supabase-config.js`** - Updated to use secure function
3. **`ENABLE-RLS-INSTRUCTIONS.md`** - This instruction file

### **Database Changes:**
1. **RLS enabled** on all tables
2. **Secure policies** created for tenant isolation
3. **New function** `create_tenant_with_admin_secure` with proper privileges
4. **Anonymous INSERT** allowed only for onboarding

## ⚡ **Quick Test**

After setup, test the function directly in SQL Editor:

```sql
SELECT create_tenant_with_admin_secure(
    'Test RLS School',
    'testrlsschool123',
    'test@rlsschool.com',
    '+1234567890',
    '123 RLS Test Street'
);
```

Should return `{"success": true, ...}`.

## 🚨 **Troubleshooting**

### Function Not Found Error
- Make sure you ran the **entire SQL script**
- Check for any red error messages in SQL Editor

### RLS Still Blocking
- Make sure the **policies were created**
- Check that the function has `SECURITY DEFINER`
- Verify the function has proper `GRANT EXECUTE` permissions

### Onboarding Fails
- Check browser console for errors
- Verify the function name in `supabase-config.js` matches
- Test the function directly in SQL Editor first

## ✅ **Success Criteria**

After completing this setup:

1. ✅ **RLS is enabled** on all tables
2. ✅ **Onboarding form works** for new schools
3. ✅ **Tenant isolation** is enforced for authenticated users
4. ✅ **Anonymous users** can only create tenants, not read existing data
5. ✅ **Security is maintained** while allowing legitimate onboarding

Your system now has **proper multi-tenant security** with RLS enabled! 🎉
