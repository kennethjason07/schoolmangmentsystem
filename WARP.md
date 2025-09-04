# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**VidyaSethu** is a comprehensive School Management System built with React Native/Expo, supporting multi-platform deployment (iOS, Android, Web). The system implements multi-tenant architecture with row-level security (RLS) and role-based access control for admins, teachers, parents, and students.

## Development Commands

### Core Development
```bash
# Start development server
npm start
# or
expo start

# Start for specific platforms
npm run android    # Android development
npm run ios        # iOS development  
npm run web        # Web development

# Install dependencies
npm install
```

### Platform-Specific Development
```bash
# Android
expo start --android
npx react-native run-android

# iOS  
expo start --ios
npx react-native run-ios

# Web
expo start --web
```

### Build Commands
```bash
# Build for production
expo build:android
expo build:ios
expo build:web

# EAS Build (recommended)
eas build --platform android
eas build --platform ios
eas build --platform all
```

### Database Operations
```bash
# Test database connectivity (Node.js scripts)
node debug_database_content.js
node test_user_access.js
node check_data.js

# Run database migrations/fixes
# Execute SQL files in Supabase SQL Editor:
# - fix_rls_policies_complete.sql
# - IMPLEMENT_TENANT_RLS_FIXED.sql
```

## Architecture Overview

### Multi-Tenant Architecture
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS)
- **Tenant Isolation**: Each school/organization is a separate tenant
- **Authentication**: Supabase Auth with JWT tokens containing tenant context
- **Data Access**: All tables include `tenant_id` for strict data isolation

### Role-Based Access Control
Four primary user roles:
- **Admin** (role_id: 1): Full system access, multi-tenant management
- **Teacher** (role_id: 2): Class management, student data, attendance, marks
- **Student** (role_id: 3): View assignments, marks, attendance, chat with teachers
- **Parent** (role_id: 4): Child's academic data, fee payments, communication

### Application Structure
```
src/
├── screens/
│   ├── admin/          # Admin dashboard, student/teacher management
│   ├── teacher/        # Class management, attendance, marks entry
│   ├── parent/         # Child tracking, fee payments, communication
│   ├── student/        # Assignments, marks, attendance viewing
│   ├── auth/           # Login, signup, password reset
│   └── universal/      # Profile, settings (shared screens)
├── navigation/         # Role-based tab/stack navigation
├── components/         # Reusable UI components
├── utils/             # Authentication, Supabase client, helpers
└── services/          # API services, database operations
```

### Key Technologies
- **Framework**: React Native with Expo SDK 53
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Navigation**: React Navigation v7 (Stack + Bottom Tabs)
- **State Management**: React Context API
- **Charts**: react-native-chart-kit, Chart.js
- **Icons**: @expo/vector-icons (Ionicons)
- **Styling**: StyleSheet, cross-platform responsive design

## Development Patterns

### Database Access Pattern
```javascript
// Tenant-aware queries automatically filter by tenant_id
const students = await dbHelpers.read('students', { class_id: classId });

// Admin queries can bypass tenant filtering
const allStudents = await dbHelpers.read('students', {}, { skipTenantId: true });
```

### Authentication Flow
```javascript
// Login sets tenant context automatically
const result = await signIn(email, password, role);
// User profile includes tenant_id, role_id
// JWT token contains tenant metadata
```

### Navigation Structure
- **Role-based** tab navigators (AdminTabs, TeacherTabs, ParentTabs, StudentTabs)
- **Conditional rendering** based on user role
- **Deep linking** support for notifications and external references

### Component Architecture
- **Header component** with role-specific actions and navigation
- **Reusable cards** for consistent UI across dashboards
- **Platform-specific** styling for web, iOS, Android
- **Cross-platform** date pickers, modals, and input components

## Multi-Tenant Implementation

### Database Schema
All tables include `tenant_id UUID` column referencing the `tenants` table:
- `users`, `students`, `teachers`, `parents`, `classes`
- `subjects`, `exams`, `marks`, `attendance`
- `fee_structure`, `student_fees`, `notifications`
- `assignments`, `timetable_entries`, `events`

### RLS Security Policies
Row-Level Security ensures data isolation:
```sql
-- Example policy: users can only access their tenant's data
CREATE POLICY tenant_access ON students
  FOR ALL TO authenticated 
  USING (tenant_id = get_user_tenant_id());
```

### Tenant Context Management
```javascript
// Set tenant context on login
const tenantId = await tenantHelpers.getCurrentTenantId();
supabaseService.setTenantContext(tenantId);

// All subsequent queries automatically filter by tenant
```

## Common Development Tasks

### Adding New Screens
1. Create screen component in appropriate role folder (`src/screens/{role}/`)
2. Add to navigation in `src/navigation/AppNavigator.js`
3. Import and register in role-specific tab/stack navigator
4. Follow existing styling patterns and responsive design

### Database Operations
1. Use `dbHelpers` for tenant-aware CRUD operations
2. Add new tables to schema with `tenant_id` column
3. Create RLS policies for proper access control
4. Test with different user roles and tenants

### Adding Role-Specific Features
1. Implement feature in appropriate screen folder
2. Add role-based navigation and access control
3. Update authentication context if needed
4. Test with different user roles

### Debugging Authentication Issues
1. Check console for tenant context logs: `🏢 Setting tenant context`
2. Verify user profile has correct `role_id` and `tenant_id`
3. Test RLS policies with SQL queries
4. Use debug scripts: `node debug_all_accounts.js`

## Performance Considerations

### Optimizations Applied
- **Tenant-specific indexing** on frequently queried columns
- **Lazy loading** for large data sets (students, marks, attendance)
- **Real-time subscriptions** only for critical data updates
- **Image optimization** for logos and assets
- **Platform-specific** optimizations for web scrolling

### Known Issues & Solutions
- **Web scrolling performance**: Implemented custom scroll wrappers
- **Large tenant data**: Pagination and filtering implemented
- **RLS policy complexity**: Simplified with helper functions
- **Cross-platform styling**: Platform-specific style overrides

## Security Considerations

### Implemented Security Features
- **Row-Level Security (RLS)** enforces tenant data isolation
- **JWT token validation** with tenant context
- **Role-based access control** at UI and database level
- **Input validation** and sanitization
- **Secure authentication flow** with Supabase Auth

### Development Security Notes
- Never bypass tenant filtering without proper authorization
- Always validate user roles before sensitive operations
- Use parameterized queries to prevent SQL injection
- Implement proper error handling to avoid data leaks
- Test security policies with different user roles and tenants

## Testing

### Manual Testing Approach
- **Multi-tenant testing**: Create test tenants and verify data isolation
- **Role-based testing**: Login as different roles and verify access
- **Cross-platform testing**: Test on iOS, Android, and web
- **Authentication testing**: Test login, logout, session management

### Debug Scripts Available
- `debug_database_content.js` - Check database accessibility
- `test_user_access.js` - Test user authentication access  
- `debug_all_accounts.js` - Debug all user accounts
- `check_data.js` - Verify data integrity

## Deployment

### Web Deployment
- Build with `expo build:web` or `npm run web`
- Deploy static files to hosting service
- Configure environment variables for production

### Mobile App Deployment  
- Use EAS Build for managed workflow: `eas build`
- Configure app signing and certificates
- Submit to app stores using EAS Submit

### Database Setup
- Use provided SQL scripts to setup RLS policies
- Configure Supabase environment variables
- Set up tenant data and initial admin users

## File Structure Notes

### Key Files
- `App.js` - Main application entry point with providers
- `src/navigation/AppNavigator.js` - Role-based navigation logic
- `src/utils/AuthContext.js` - Authentication state management
- `src/utils/supabase.js` - Database client and tenant-aware helpers
- `package.json` - Expo SDK 53 with React Native 0.79

### Configuration Files
- `app.json` - Expo app configuration
- `metro.config.js` - Metro bundler configuration  
- `assets/` - App icons, splash screens, and images
- `web/` - Contains school registration system for tenant onboarding

### Database Files
- SQL files for RLS setup, tenant management, and debugging
- Markdown files documenting multi-tenant implementation
- Debug scripts for testing authentication and data access

This architecture provides a secure, scalable, and maintainable school management system with proper multi-tenant isolation and role-based access control.
