# Features-All Implementation Guide

## Overview

The `features-all` functionality allows you to grant a user access to all admin features by setting a single flag in their `features` column. When a user has `{"features-all": true}` in their features column, they automatically get access to all admin features without needing to individually enable each one.

## How It Works

### 1. Database Setup

To grant a user access to all features, update their `features` column in the `users` table:

```sql
-- Grant all features to a specific user
UPDATE users 
SET features = '{"features-all": true}' 
WHERE email = 'admin@yourschool.com';

-- You can also combine with specific features
UPDATE users 
SET features = '{"features-all": true, "custom_feature": true}' 
WHERE email = 'admin@yourschool.com';
```

### 2. Feature Priority

The system follows this priority order:

1. **features-all check**: If `features-all` is `true`, grant access to ALL regular features
2. **specific feature check**: If `features-all` is not present or `false`, check the specific feature

```javascript
// Example user features in database:
{
  "features-all": true,
  "stationary_management": false  // This will be ignored - features-all overrides
}

// Result: User gets access to stationary_management (and all other features)
```

### 3. Code Implementation

The implementation is handled automatically in the `useTenantFeatures` hook:

```javascript
// In your components, just use the hook as normal:
const { hasFeature } = useTenantFeatures();

// This will return true if user has features-all OR specific feature
const canManageStudents = hasFeature('student_management');
```

## Testing the Implementation

### 1. Run the Test Script

```bash
# Run the comprehensive test
node test_features_all.js

# Or with database testing (set your environment variables first)
SUPABASE_URL=your_url SUPABASE_ANON_KEY=your_key node test_features_all.js
```

### 2. Manual Testing Steps

1. **Create a test user with features-all:**
   ```sql
   UPDATE users 
   SET features = '{"features-all": true}' 
   WHERE email = 'test-admin@example.com';
   ```

2. **Login as that user** and verify you can access all admin screens:
   - Manage Students
   - Manage Teachers
   - Fee Management
   - Stationary Management
   - All other admin features

3. **Check the console logs** - you should see messages like:
   ```
   🌟 useTenantFeatures: User has 'features-all' permission, granting access to 'student_management'
   ```

### 3. Verify Feature Guard Protection

Try accessing admin screens both with and without the `features-all` permission to ensure the protection works correctly.

## Migration Guide

### For Existing Super Admin Users

If you have existing users who should have access to all features:

```sql
-- Update all admin users to have features-all
UPDATE users 
SET features = COALESCE(features, '{}')::jsonb || '{"features-all": true}'::jsonb
WHERE role_id IN (
  SELECT id FROM roles WHERE role_name = 'admin'
) 
AND tenant_id = 'your-tenant-id';
```

### For New Admin Users

When creating new admin users, include the features-all permission:

```javascript
// When creating a new admin user
const newUserFeatures = {
  "features-all": true
};

await supabase
  .from('users')
  .update({ features: newUserFeatures })
  .eq('id', newUserId);
```

## Security Considerations

### 1. Use Sparingly

The `features-all` permission is powerful. Only grant it to:
- Super administrators
- Trusted school management personnel
- Testing/demo accounts

### 2. Audit Trail

Consider logging when `features-all` is used:

```javascript
// The system already logs feature access
console.log(`🌟 User has 'features-all' permission, granting access to '${featureKey}'`);
```

### 3. Regular Review

Periodically review who has `features-all` permission:

```sql
-- Find all users with features-all permission
SELECT 
  u.email,
  u.features,
  t.name as tenant_name,
  r.role_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.features->>'features-all' = 'true';
```

## Troubleshooting

### 1. Features Not Working

If a user with `features-all` still can't access features:

1. **Check the database:**
   ```sql
   SELECT email, features FROM users WHERE email = 'user@example.com';
   ```

2. **Check the console logs** for feature access messages

3. **Verify the hook is being used** - ensure the screen uses `FeatureGuard` or `useTenantFeatures`

### 2. Debug Mode

Enable debug logging by checking the console in development mode. You should see:
- `🌟` messages for features-all grants
- `🔍` messages for regular feature checks
- `🔒` messages for denied access

### 3. Cache Issues

If changes don't take effect immediately:
- The user may need to log out and back in
- The tenant context may need to refresh
- Check if there's any caching in your authentication system

## Examples

### Example 1: Super Admin User
```json
{
  "features-all": true
}
```
**Result:** Access to ALL admin features

### Example 2: Department Head
```json
{
  "student_management": true,
  "teacher_management": true,
  "class_management": true
}
```
**Result:** Access to specific features only

### Example 3: Full Admin with Custom Features
```json
{
  "features-all": true,
  "custom_reports": true,
  "advanced_settings": true
}
```
**Result:** Access to ALL standard features PLUS custom features

## Support

If you encounter any issues with the `features-all` functionality:

1. Run the test script: `node test_features_all.js`
2. Check the console logs for feature access messages
3. Verify the database `features` column contains the correct JSON
4. Ensure the user is properly authenticated and in the right tenant

The implementation is backward-compatible, so existing feature permissions will continue to work as before.