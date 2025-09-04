# Multi-Tenant Fix Plan for School Management System

## Issues Identified

### 1. **Schema vs Code Mismatch**
- **Problem**: Schema uses `tenant_id` but `supabaseService.js` uses `school_id`
- **Impact**: All queries fail because column doesn't exist
- **Fix**: Update service to use `tenant_id` consistently

### 2. **Missing Tenant Context in Queries**
- **Problem**: Many queries don't include tenant filtering
- **Impact**: Data leakage between tenants or empty results
- **Fix**: Add tenant-aware query helpers

### 3. **RLS Policies May Block Admin Access**
- **Problem**: Admin users can't access cross-tenant data
- **Impact**: Admins can't manage multiple schools/tenants
- **Fix**: Create admin-specific RLS policies

### 4. **Authentication Tenant Resolution**
- **Problem**: Inconsistent tenant_id handling during login
- **Impact**: Users can't access their tenant's data
- **Fix**: Ensure proper tenant context setting

## Fixes to Implement

### Fix 1: Update SupabaseService to use tenant_id
- Replace all `school_id` references with `tenant_id`
- Update query methods to use proper column names
- Fix the tenant context setting

### Fix 2: Create RLS Policies for Multi-Tenancy
- Create tenant-aware RLS policies for all tables
- Add admin bypass policies for cross-tenant access
- Ensure proper authentication context

### Fix 3: Update Authentication Flow
- Ensure tenant_id is properly set during login
- Add tenant context to user session
- Handle admin cross-tenant access

### Fix 4: Create Tenant-Aware Query Helpers
- Add helpers that automatically include tenant filtering
- Provide admin overrides for cross-tenant queries
- Ensure consistent tenant handling

## Implementation Order

1. **Fix SupabaseService.js** - Critical foundation fix
2. **Create/Update RLS Policies** - Security and data isolation
3. **Update Authentication Context** - Proper tenant resolution
4. **Test and Validate** - Ensure everything works correctly

## Expected Results

After implementing these fixes:
- Admin users can log in and access appropriate data
- Multi-tenant data isolation will work correctly
- Queries will return proper tenant-scoped results
- No more empty results due to column mismatches
