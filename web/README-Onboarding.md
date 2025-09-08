# School Onboarding System

This directory contains the complete school onboarding system for the Education Management System. The system allows new schools to register and creates both a tenant account and an admin user account with proper multi-tenant isolation.

## Files Overview

### 1. `school-onboarding.html`
The main onboarding form with a 4-step wizard interface:
- **Step 1**: School Information (name, address, subdomain, contact details)
- **Step 2**: Admin Account Setup (admin user details and password)
- **Step 3**: Settings & Features (capacity limits, timezone, feature selection)
- **Step 4**: Review & Confirm (summary and final submission)

### 2. `school-onboarding.js`
JavaScript functionality for the onboarding process:
- **SchoolOnboardingForm**: Main form controller with validation and step navigation
- **EnhancedTenantService**: Extended tenant service with school details creation
- **AdminUserService**: Service for creating admin users with proper roles
- Real-time validation and password strength checking
- Complete onboarding flow with transaction-like behavior

### 3. `supabase-config.js`
Existing Supabase configuration and basic tenant service (already exists)

### 4. `test-onboarding.html`
Comprehensive testing interface for the onboarding system:
- Database connection testing
- Subdomain availability testing
- Tenant creation testing
- Admin user creation testing
- Complete onboarding flow testing
- Multi-tenant isolation testing

### 5. `README-Onboarding.md`
This documentation file

## Features

### Multi-Step Form
- **User-friendly wizard interface** with clear progress indication
- **Real-time validation** with immediate feedback
- **Step-by-step validation** preventing progression with invalid data
- **Responsive design** that works on desktop and mobile

### Comprehensive School Setup
- **Tenant Creation**: Creates isolated tenant account with unique subdomain
- **Admin User Creation**: Creates admin user with proper authentication and role assignment
- **School Details**: Creates school profile with institutional information
- **Feature Configuration**: Allows schools to enable/disable specific features

### Security & Validation
- **Password strength checking** with real-time feedback
- **Email validation** for admin and contact emails
- **Subdomain availability checking** in real-time
- **Phone number format validation**
- **Required field validation** with clear error messages

### Multi-tenant Architecture
- **Tenant Isolation**: Each school gets its own tenant_id for complete data isolation
- **Role Management**: Automatically creates admin role for each tenant
- **RLS Support**: Compatible with Row Level Security policies
- **Scalable Design**: Supports unlimited number of school tenants

## Usage

### For New Schools (End Users)
1. Navigate to `school-onboarding.html`
2. Fill out the 4-step wizard:
   - Provide school information and choose a unique subdomain
   - Set up the admin account with secure password
   - Configure school capacity and features
   - Review and confirm all details
3. Submit to create both tenant and admin accounts
4. Receive confirmation with login details

### For Developers/Testing
1. Open `test-onboarding.html` in a browser
2. Run individual tests to verify system functionality:
   - Test database connectivity
   - Test subdomain availability checking
   - Test tenant creation
   - Test admin user creation
   - Test complete onboarding flow
   - Test multi-tenant isolation
3. Use "Clear Test Data" to remove test records

## Technical Implementation

### Database Schema Requirements
The system requires these tables to be properly configured:
- `tenants` - Main tenant records
- `users` - User accounts linked to tenants
- `roles` - Role definitions per tenant
- `school_details` - Detailed school information

### Key Components

#### SchoolOnboardingForm Class
```javascript
// Main form controller
const form = new SchoolOnboardingForm();
```

#### AdminUserService Class
```javascript
// Service for creating admin users
const adminService = new AdminUserService();
const result = await adminService.createAdminUser(userData);
```

#### Enhanced TenantService
```javascript
// Extended tenant service
const tenantService = new EnhancedTenantService();
const result = await tenantService.registerTenant(tenantData);
```

### Data Flow
1. **Form Submission**: User completes all steps and submits
2. **Tenant Creation**: New tenant record created with unique subdomain
3. **Role Creation**: Admin role created for the new tenant
4. **Admin User Creation**: Auth user created with Supabase Auth
5. **User Record Creation**: User record created with admin role assignment
6. **School Details**: Additional school information stored
7. **Success Response**: User receives confirmation with login details

### Error Handling
- **Validation Errors**: Immediate feedback on form fields
- **Database Errors**: Proper error messages for constraint violations
- **Transaction Safety**: Attempts to rollback on partial failures
- **User-Friendly Messages**: Clear error communication to users

## Customization

### Adding New Features
To add new features to the onboarding process:

1. **Add HTML Elements**:
```html
<div class="feature-item" onclick="toggleFeature('newfeature', this)">
    <input type="checkbox" id="featureNewFeature" name="featureNewFeature" checked>
    <div class="feature-icon">🆕</div>
    <div class="feature-info">
        <div class="feature-name">New Feature</div>
        <div class="feature-desc">Description of new feature</div>
    </div>
</div>
```

2. **Update JavaScript**:
```javascript
// In collectFormData() method
features: {
    // existing features...
    newfeature: document.getElementById('featureNewFeature').checked
}
```

### Modifying Validation Rules
Update validation rules in the `initializeValidation()` method:

```javascript
this.validationRules = {
    // existing rules...
    newField: {
        required: true,
        minLength: 5,
        pattern: /^[a-zA-Z\s]+$/
    }
};
```

### Styling Customization
The CSS is contained within the HTML files and can be modified to match your design system. Key classes:
- `.container` - Main container
- `.form-step` - Individual wizard steps
- `.feature-item` - Feature selection items
- `.btn-primary` - Primary action buttons

## Testing

### Manual Testing
1. Use the main onboarding form to create test schools
2. Verify that each school gets unique tenant_id
3. Test admin login with created credentials
4. Verify that schools can only see their own data

### Automated Testing
Use the test interface (`test-onboarding.html`) to run comprehensive tests:
- Database connectivity
- Form validation
- End-to-end onboarding flow
- Multi-tenant isolation

### Database Testing
Verify in your database that:
- Tenants are created with unique subdomains
- Admin roles are created per tenant
- User records have correct tenant_id and role_id associations
- RLS policies properly isolate data

## Security Considerations

### Password Security
- Minimum 8 characters required
- Strength checking encourages complex passwords
- Passwords are hashed by Supabase Auth

### Data Validation
- All inputs are validated client-side and server-side
- SQL injection prevention through parameterized queries
- XSS prevention through proper data handling

### Multi-tenant Security
- Each tenant has isolated data access
- Admin users can only manage their own tenant
- RLS policies enforce data isolation

## Troubleshooting

### Common Issues

**Subdomain Already Taken**:
- Check if subdomain exists in tenants table
- Suggest alternative subdomains to user

**Admin User Creation Fails**:
- Check if email already exists in auth.users
- Verify tenant_id is valid
- Check role creation succeeded

**Database Connection Issues**:
- Verify Supabase credentials in `supabase-config.js`
- Check network connectivity
- Verify database is accessible

### Debugging
Enable browser developer tools and check:
- Console for JavaScript errors
- Network tab for API request failures
- Database logs for SQL errors

## Future Enhancements

### Potential Improvements
1. **Email Verification**: Send confirmation emails to admin users
2. **Payment Integration**: Add subscription payment processing
3. **Advanced Validation**: Server-side validation for enhanced security
4. **Bulk Import**: Allow importing existing school data
5. **Preview Mode**: Let users preview their school portal before finalizing

### Integration Points
- **SSO Integration**: Connect with existing authentication systems
- **Domain Verification**: Verify custom domain ownership
- **Analytics**: Track onboarding completion rates
- **Support Integration**: Direct connection to support systems

## Support

For technical support or questions about the onboarding system:
1. Check the test interface for system status
2. Review browser console for error messages
3. Verify database connectivity and permissions
4. Contact development team with specific error details

---

This onboarding system provides a complete solution for multi-tenant school registration with proper isolation, security, and user experience considerations.
