# Multi-Tenant Implementation Guide

This guide provides step-by-step instructions for implementing multi-tenancy in your School Management System.

## Overview

The multi-tenancy implementation uses the **shared database with tenant isolation** approach, where:
- All tenants share the same database
- Each table has a `tenant_id` column for data isolation
- Row Level Security (RLS) enforces data access policies
- JWT tokens carry tenant context for authorization

## Implementation Steps

### 1. Database Changes

#### Run Migration Scripts
Execute the following SQL scripts in order:

1. **Multi-Tenant Migration** (`database/multi_tenant_migration.sql`)
   ```bash
   # Run this in your Supabase SQL editor
   ```

2. **RLS Policies** (`database/rls_policies.sql`)
   ```bash
   # Run this after the migration completes
   ```

#### Key Changes Made:
- Added `tenant_id UUID` column to all tables
- Created `tenants` table for organization management
- Created indexes for performance
- Added utility functions for tenant management
- Implemented RLS policies for data isolation

### 2. Application Changes

#### Update App.js to Include Tenant Context
```javascript
import { TenantProvider } from './src/contexts/TenantContext';

export default function App() {
  return (
    <TenantProvider>
      <AuthProvider>
        {/* Your existing app content */}
      </AuthProvider>
    </TenantProvider>
  );
}
```

#### Update Main Navigation
Add tenant management to admin navigation:

```javascript
// In your admin drawer/tab navigator
{
  name: 'TenantManagement',
  component: TenantManagement,
  options: { title: 'Tenant Management' }
}
```

### 3. Environment Configuration

#### Update Supabase Configuration
Ensure your `src/utils/supabase.js` includes tenant context:

```javascript
import { useTenant } from '../contexts/TenantContext';

// The updated file already includes multi-tenant support
```

#### Update Database Helper Functions
The existing `dbHelpers` in `supabase.js` need to be updated to include tenant filtering. Here's the pattern:

```javascript
// Before (single tenant)
const { data, error } = await supabase
  .from('students')
  .select('*');

// After (multi-tenant)
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('tenant_id', currentTenantId);
```

### 4. User Interface Updates

#### Login Screen Enhancement
Update login to support tenant selection:

```javascript
// Add tenant subdomain input
<TextInput
  placeholder="Tenant (optional)"
  value={tenantSubdomain}
  onChangeText={setTenantSubdomain}
  autoCapitalize="none"
/>

// Update sign in call
const result = await signIn(email, password, role, tenantSubdomain);
```

#### Add Tenant Selector Component
Create a tenant selector for users with access to multiple tenants:

```javascript
const TenantSelector = () => {
  const { currentTenant, availableTenants, switchTenant } = useTenant();
  
  return (
    <Picker
      selectedValue={currentTenant?.id}
      onValueChange={switchTenant}
    >
      {availableTenants.map(tenant => (
        <Picker.Item key={tenant.id} label={tenant.name} value={tenant.id} />
      ))}
    </Picker>
  );
};
```

### 5. Feature-Specific Updates

#### Student Management
```javascript
// Update student creation to include tenant_id
const createStudent = async (studentData) => {
  const { tenantId } = useTenant();
  
  const newStudent = {
    ...studentData,
    tenant_id: tenantId
  };
  
  return await dbHelpers.create('students', newStudent);
};
```

#### Reports and Analytics
All reports must be filtered by tenant:

```javascript
const getStudentReport = async () => {
  const { tenantId } = useTenant();
  
  return await supabase
    .from('students')
    .select('*, classes(*)')
    .eq('tenant_id', tenantId);
};
```

### 6. Testing Multi-Tenancy

#### Test Data Isolation
1. Create two test tenants
2. Create test data for each tenant
3. Verify users can only access their tenant's data

#### Test Scripts
```sql
-- Create test tenants
SELECT public.create_tenant('Test School A', 'school-a', 'admin@schoola.com');
SELECT public.create_tenant('Test School B', 'school-b', 'admin@schoolb.com');

-- Test RLS policies
-- Should return only tenant-specific data
SELECT * FROM students WHERE tenant_id = 'school-a-id';
```

## Configuration Options

### Tenant Features
Configure tenant-specific features in the `tenants` table:

```json
{
  "messaging": true,
  "attendance": true,
  "fees": true,
  "exams": true,
  "reports": true,
  "homework": true
}
```

### Tenant Limits
Set resource limits per tenant:

```javascript
{
  max_students: 500,
  max_teachers: 50,
  max_classes: 20
}
```

### Subscription Plans
Support different subscription tiers:

- **Basic**: Limited features, 100 students
- **Standard**: All features, 500 students  
- **Premium**: All features + analytics, 1000 students
- **Enterprise**: Custom limits and features

## Best Practices

### Security
1. **Always use RLS policies** - Never rely on application-level filtering alone
2. **Validate tenant access** - Ensure users belong to the tenant they're accessing
3. **Audit tenant access** - Log tenant switches and administrative actions

### Performance
1. **Index tenant_id** - All tables should have indexes on tenant_id
2. **Composite indexes** - Create indexes on (tenant_id, frequently_queried_column)
3. **Connection pooling** - Configure proper database connection limits

### Maintenance
1. **Backup per tenant** - Consider tenant-specific backup strategies
2. **Monitoring** - Track resource usage per tenant
3. **Migration scripts** - Always test migrations with multi-tenant data

## Troubleshooting

### Common Issues

#### RLS Policies Not Working
- Check if RLS is enabled on tables
- Verify JWT token contains tenant_id
- Test policies with `explain (analyze, buffers)` 

#### Performance Issues
- Add missing indexes on tenant_id
- Check query plans for tenant-aware queries
- Consider partitioning for very large datasets

#### Data Isolation Failures
- Audit all database queries for tenant filtering
- Check for missing RLS policies
- Verify application code uses tenant context

### Debug Queries
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'students';

-- Check current tenant context
SELECT public.current_tenant_id();

-- Test tenant isolation
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM students WHERE tenant_id = 'test-tenant-id';
```

## Migration from Single Tenant

### Data Migration
1. Assign existing data to default tenant
2. Update all foreign key relationships
3. Test data integrity after migration

### User Migration  
1. Create tenant for existing school
2. Update user records with tenant_id
3. Test authentication and access

### Code Migration
1. Update all database queries
2. Add tenant context to UI components
3. Test all features with tenant isolation

## Monitoring and Analytics

### Tenant Metrics
- Number of active users per tenant
- Resource usage (students, teachers, classes)
- Feature usage statistics
- Performance metrics per tenant

### Alerts
- Tenant resource limits exceeded
- Unusual access patterns
- Performance degradation
- Failed tenant operations

## Backup and Recovery

### Tenant-Specific Backups
```sql
-- Backup specific tenant data
pg_dump --table=students --where="tenant_id='tenant-uuid'" mydb
```

### Disaster Recovery
1. Document tenant-specific recovery procedures
2. Test restoration processes
3. Maintain tenant metadata backups

## Conclusion

This multi-tenant implementation provides:
- ✅ Strong data isolation through RLS
- ✅ Scalable architecture for multiple schools
- ✅ Configurable features per tenant
- ✅ Resource limiting and monitoring
- ✅ Administrative tools for tenant management

The implementation follows industry best practices and provides a solid foundation for scaling your school management system to serve multiple educational institutions.

## Next Steps

1. Run the migration scripts in your development environment
2. Test the tenant management interface
3. Update your application code to include tenant filtering
4. Set up monitoring and alerting
5. Plan your production deployment strategy

For support or questions, refer to the code comments or create an issue in your repository.
