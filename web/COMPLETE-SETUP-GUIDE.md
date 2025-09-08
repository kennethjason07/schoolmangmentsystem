# 🎯 Complete Web Onboarding Setup Guide

This guide ensures your web onboarding creates **both** Supabase Auth users AND records in the `users` table, as required by your schema.

## 🛠️ What Was Updated

### **Files Modified:**
1. **`simple-onboarding.js`** - Now creates both auth user AND users table record
2. **`reenable-rls.sql`** - Includes policies for users table
3. **`test-complete-onboarding.html`** - Test page to verify complete flow

### **Database Schema Integration:**
The onboarding now properly integrates with your `users` table schema:
```sql
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role_id integer,
  linked_student_id uuid,
  linked_teacher_id uuid,
  linked_parent_of uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  password text,
  full_name text NOT NULL DEFAULT ''::text,
  phone text,
  profile_url text,
  tenant_id uuid NOT NULL,
  -- Foreign key constraints...
);
```

## 📋 Setup Steps

### **Step 1: Fix Roles Constraint (if not done)**
```sql
-- Allow multiple Admin roles (one per tenant)
ALTER TABLE roles DROP CONSTRAINT roles_role_name_key;
ALTER TABLE roles ADD CONSTRAINT roles_role_name_tenant_id_key UNIQUE (role_name, tenant_id);
```

### **Step 2: Re-enable RLS with Users Table Support**
Run the updated `reenable-rls.sql`:
```sql
-- Re-enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous tenant creation
CREATE POLICY "Allow anon to create tenants" ON tenants
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to create roles" ON roles
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to create school details" ON school_details
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to create users" ON users
    FOR INSERT TO anon WITH CHECK (true);

-- Create policies for authenticated users
CREATE POLICY "Users can read their own profile" ON users
    FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can read users in their tenant" ON users
    FOR SELECT TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));
```

### **Step 3: Test the Complete Flow**
1. **Open** `web/test-complete-onboarding.html`
2. **Click** "Test Complete Flow"
3. **Verify** all records are created:
   - ✅ Tenant record
   - ✅ Role record
   - ✅ School details record
   - ✅ Supabase Auth user
   - ✅ Users table record
4. **Test login** with the created credentials

## 🔄 Complete Onboarding Flow

### **What Happens Now:**
1. **User fills form** (email + password)
2. **Tenant created** with auto-generated school name/subdomain
3. **Admin role created** for the tenant
4. **School details created**
5. **Supabase Auth user created** with email/password
6. **Users table record created** with:
   - Same ID as auth user
   - Email, full_name, phone
   - Linked to tenant_id and role_id
   - Ready for your app to use

### **Key Improvements:**
- ✅ **Auth user** created in Supabase Auth (for login)
- ✅ **Users table record** created (for your app logic)
- ✅ **Proper linking** between auth and users table
- ✅ **Multi-tenant isolation** maintained
- ✅ **Admin can login** and manage their school

## 🧪 Testing

### **Manual Test:**
1. Open `simple-onboarding.html`
2. Enter email/password
3. Submit form
4. Check success message

### **Comprehensive Test:**
1. Open `test-complete-onboarding.html`
2. Run all test scenarios
3. Verify database records
4. Test login functionality

### **Database Verification:**
```sql
-- Check tenant was created
SELECT * FROM tenants ORDER BY created_at DESC LIMIT 1;

-- Check role was created
SELECT * FROM roles ORDER BY id DESC LIMIT 1;

-- Check users table record
SELECT * FROM users ORDER BY created_at DESC LIMIT 1;

-- Check auth user exists
SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 1;
```

## 🎯 What This Solves

### **Before (Incomplete):**
- ❌ Only created tenant/role/school_details
- ❌ No auth user for login
- ❌ No users table record
- ❌ Admin couldn't actually use the system

### **After (Complete):**
- ✅ Creates tenant/role/school_details
- ✅ Creates Supabase Auth user
- ✅ Creates users table record
- ✅ Admin can login and manage school
- ✅ Proper multi-tenant architecture
- ✅ Ready for teachers/parents/students to be added

## 🚀 Next Steps

Once this is working:
1. **Test login** with created admin credentials
2. **Build admin dashboard** that reads from users table
3. **Add user management** features for teachers/parents/students
4. **Implement role-based permissions** using role_id
5. **Add profile management** using the users table data

Your onboarding system now creates **complete user accounts** that integrate properly with your schema! 🎉
