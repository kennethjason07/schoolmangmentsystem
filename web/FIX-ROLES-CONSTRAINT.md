# 🔧 Fix Role Constraint Error

You're seeing this error because the `roles` table has a global unique constraint on `role_name`, which prevents multiple tenants from having "Admin" roles. Here's how to fix it:

## Error Details
```
duplicate key value violates unique constraint "roles_role_name_key"
Key (role_name)=(Admin) already exists.
```

## ✅ **Quick Fix: Update Database Schema**

Run this SQL in your Supabase SQL Editor:

```sql
-- Fix the roles table to allow multiple Admin roles (one per tenant)

-- Step 1: Drop the existing global unique constraint on role_name
ALTER TABLE roles DROP CONSTRAINT roles_role_name_key;

-- Step 2: Add a composite unique constraint on (role_name, tenant_id)
-- This allows the same role name in different tenants
ALTER TABLE roles ADD CONSTRAINT roles_role_name_tenant_id_key UNIQUE (role_name, tenant_id);
```

## How This Fix Works

### **Before (Broken):**
- ❌ Only one "Admin" role allowed **globally**
- ❌ Second school trying to create "Admin" role fails
- ❌ Breaks multi-tenant architecture

### **After (Fixed):**
- ✅ Each tenant can have its own "Admin" role
- ✅ Constraint ensures uniqueness **within each tenant**
- ✅ Proper multi-tenant isolation

## Alternative: Manual Role Creation

If you don't want to change the schema, you can create roles with unique names:

```sql
-- Create tenant-specific role names
INSERT INTO roles (role_name, tenant_id) 
VALUES ('Admin_tenant_' || gen_random_uuid()::text, 'your-tenant-id');
```

But the schema fix is the better long-term solution.

## ✅ **After Running the Fix**

1. **Run the SQL** in Supabase SQL Editor
2. **Test the onboarding** again
3. **Should work perfectly** - each school gets its own Admin role

## 🧪 **Verification**

After the fix, you should be able to create multiple schools and each will have its own Admin role:

```sql
-- Check that multiple Admin roles can exist
SELECT role_name, tenant_id FROM roles WHERE role_name = 'Admin';
```

You should see multiple rows with different `tenant_id` values.

## 🔄 **What Happens Next**

1. ✅ **Tenant creation** works (already working)
2. ✅ **Role creation** works (will work after this fix)
3. ✅ **Admin user creation** works (will work after role fix)
4. ✅ **Complete onboarding** works end-to-end

This fix ensures proper multi-tenant role management! 🎉
