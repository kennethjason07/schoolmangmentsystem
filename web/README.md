# School Registration System

This folder contains a complete school registration/onboarding system for your School Management System application.

## Files

- `register-school.html` - Complete HTML registration form with embedded CSS styling
- `register-school.js` - JavaScript functionality for form validation, submission, and user interactions
- `README.md` - This documentation file

## Features

### Form Fields (Based on Tenants Schema)
- **School Name** (required) - Maps to `name` field
- **Subdomain** (required) - Maps to `subdomain` field with availability checking
- **Custom Domain** (optional) - Maps to `domain` field
- **Contact Email** (required) - Maps to `contact_email` field
- **Contact Phone** (required) - Maps to `contact_phone` field
- **School Address** (required) - Maps to `address` field
- **Subscription Plan** (required) - Maps to `subscription_plan` field (basic, standard, premium, enterprise)
- **Timezone** (required) - Maps to `timezone` field
- **Maximum Students** - Maps to `max_students` field (default: 500)
- **Maximum Teachers** - Maps to `max_teachers` field (default: 50)
- **Maximum Classes** - Maps to `max_classes` field (default: 20)
- **Academic Year Start Month** - Maps to `academic_year_start_month` field (default: April)
- **Features** - Maps to `features` JSONB field (fees, exams, messaging, attendance)
- **Logo URL** (optional) - Maps to `logo_url` field

### JavaScript Functionality
- Real-time form validation
- Subdomain availability checking (simulated)
- Auto-suggestion of subdomain based on school name
- Form submission handling
- Loading states and success/error messages
- Responsive design

## Supabase Integration ✅

This registration form is **fully integrated with Supabase** and ready to use! The form will:

- ✅ **Register new schools directly** to your `tenants` table
- ✅ **Check subdomain availability** in real-time
- ✅ **Validate domain uniqueness** before registration
- ✅ **Handle all database operations** through Supabase client

### Files Created
- `supabase-config.js` - Supabase client setup and database operations
- `register-school.html` - Updated to include Supabase SDK
- `register-school.js` - Updated to use real Supabase calls

### How It Works

1. **Supabase Client**: Automatically initializes using your project credentials
2. **Real-time Validation**: Checks subdomain availability as you type
3. **Database Insert**: Directly inserts new tenants into your database
4. **Error Handling**: Provides meaningful error messages for database conflicts

### Configuration

The form uses your existing Supabase configuration:
- **URL**: `https://dmagnsbdjsnzsddxqrwd.supabase.co`
- **Anon Key**: Configured from your `credentials.txt`

### Database Operations

The `TenantService` class provides:

```javascript
// Check if subdomain is available
const isAvailable = await tenantService.checkSubdomainAvailability('schoolname');

// Register new tenant
const result = await tenantService.registerTenant(formData);

// Check domain availability (optional)
const isDomainFree = await tenantService.checkDomainAvailability('school.edu');
```

### 4. Validation Rules

The form includes client-side validation for:
- Required fields
- Email format
- Phone number format
- Subdomain format (alphanumeric only)
- Field length limits
- Subdomain uniqueness

### 5. Default Values

The form sets these defaults (matching schema defaults):
- `status`: 'active'
- `subscription_plan`: 'basic' (user selectable)
- `max_students`: 500
- `max_teachers`: 50
- `max_classes`: 20
- `academic_year_start_month`: 4 (April)
- `timezone`: 'UTC'
- `features`: All features enabled by default

## Usage

1. **Open** `register-school.html` in a web browser
2. **Fill out** the school information
3. **Submit** the form
4. The system will:
   - Validate all inputs in real-time
   - Check subdomain availability against your database
   - Register the school directly to your `tenants` table
   - Show success message or specific error details

## Customization

### Styling
All CSS is embedded in the HTML file. You can:
- Modify colors in the CSS variables
- Adjust the gradient backgrounds
- Change typography and spacing
- Modify the responsive breakpoints

### Features
To add or modify features:
1. Update the features grid in the HTML
2. Update the feature collection logic in JavaScript
3. Ensure your backend handles the new features in the JSONB field

### Validation
To add new validation rules:
1. Update the `validationRules` object in the JavaScript
2. Add corresponding error elements in the HTML
3. Update the `validateField` method if needed

## Security Considerations

- Always validate data on the server-side as well
- Sanitize inputs before storing in the database
- Implement rate limiting for registration attempts
- Use CSRF protection
- Validate subdomain uniqueness on the backend
- Consider implementing email verification for new registrations

## Testing

**The form is now connected to your live Supabase database!** To test:

1. **Open** `register-school.html` in a web browser
2. **Fill out** the form with valid data
3. **Try different subdomains** to see real-time availability checking
4. **Submit** the form to register a real tenant in your database
5. **Check** your Supabase dashboard to see the new tenant record

### Test Data Examples
- Try subdomain: `testschool123` (likely available)
- Try subdomain: `test` (might be taken)
- Use a valid email and phone number
- Choose any subscription plan

**Warning**: This will create real records in your database. Use test data only!
