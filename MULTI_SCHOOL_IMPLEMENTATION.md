# Multi-School Support Implementation Guide

This guide explains how to implement multi-school support in your School Management System. The implementation allows a single application instance to manage multiple schools with proper data isolation and user access control.

## Overview

The multi-school feature includes:
- **Database Schema**: Adding `school_id` to all relevant tables
- **School Context**: React context for managing selected school
- **Data Services**: School-aware data fetching and filtering
- **UI Components**: School selector and updated screens
- **Row Level Security**: Database-level data isolation

## Implementation Steps

### 1. Database Migration

First, run the database migration scripts to add multi-school support:

```sql
-- Run database_migration_multi_school.sql
-- This adds school_id columns, foreign keys, RLS policies, and helper functions
```

Then populate existing data:

```sql
-- Run data_migration_populate_school_ids.sql
-- This populates school_id for existing records
```

### 2. Frontend Integration

#### Add Providers to App.js

```javascript
import { AuthProvider } from './src/contexts/AuthContext';
import { SchoolProvider } from './src/contexts/SchoolContext';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SchoolProvider>
          <AppNavigator />
        </SchoolProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

#### Update Screens to Use School Context

```javascript
import { useSchool } from '../contexts/SchoolContext';
import useSchoolData from '../hooks/useSchoolData';

const MyScreen = () => {
  const { selectedSchool, canManageSchool } = useSchool();
  const { schoolService } = useSchoolData();
  
  // Use schoolService for all data operations
  const loadData = async () => {
    const { data, error } = await schoolService.getStudents();
    // This will automatically filter by selected school
  };
  
  return (
    <View>
      <SchoolSelector />
      {/* Your existing UI */}
    </View>
  );
};
```

### 3. Key Components

#### SchoolContext (`src/contexts/SchoolContext.js`)
- Manages selected school state
- Provides school switching functionality
- Includes role-based access control
- Handles school data loading and caching

#### SchoolSelector (`src/components/SchoolSelector.js`)
- Dropdown component for school selection
- Shows school name and code
- Handles school switching UI

#### SupabaseService (`src/services/supabaseService.js`)
- School-aware data service layer
- Automatically adds school_id filters
- Provides consistent API across the app

#### useSchoolData Hook (`src/hooks/useSchoolData.js`)
- Syncs school context with data service
- Provides easy access to school-filtered data

### 4. Database Schema Changes

#### New Tables

```sql
-- Junction table for user-school relationships
CREATE TABLE school_users (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES school_details(id),
  user_id UUID REFERENCES users(id),
  role_in_school TEXT,
  is_primary_school BOOLEAN,
  joined_at TIMESTAMP
);
```

#### Modified Tables

All main entity tables now include:
```sql
-- Example for students table
ALTER TABLE students ADD COLUMN school_id UUID REFERENCES school_details(id);
```

Tables affected:
- `users`, `teachers`, `students`, `classes`, `subjects`
- `student_attendance`, `teacher_attendance`, `exams`, `marks`
- `assignments`, `homeworks`, `notifications`, `tasks`
- `fee_structure`, `student_fees`, `messages`, `timetable_entries`
- `personal_tasks`, `parents`

### 5. Row Level Security (RLS)

RLS policies ensure data isolation at the database level:

```sql
-- Example policy for students table
CREATE POLICY school_isolation_students ON students
  FOR ALL TO authenticated
  USING (school_id = ANY(get_user_school_ids(auth.uid())))
  WITH CHECK (school_id = ANY(get_user_school_ids(auth.uid())));
```

### 6. Usage Examples

#### Loading School-Filtered Data

```javascript
const MyComponent = () => {
  const { schoolService } = useSchoolData();
  const [students, setStudents] = useState([]);
  
  useEffect(() => {
    const loadStudents = async () => {
      const { data, error } = await schoolService.getStudents();
      if (data) setStudents(data);
    };
    
    loadStudents();
  }, []);
  
  return <StudentList students={students} />;
};
```

#### Creating New Records

```javascript
const createStudent = async (studentData) => {
  // school_id is automatically added by the service
  const { data, error } = await schoolService.createStudent(studentData);
  return { data, error };
};
```

#### Role-Based Access Control

```javascript
const AdminScreen = () => {
  const { canManageSchool, isAdmin, selectedSchool } = useSchool();
  
  if (!canManageSchool) {
    return <AccessDenied />;
  }
  
  return (
    <View>
      <Text>Managing {selectedSchool.name}</Text>
      {/* Admin controls */}
    </View>
  );
};
```

### 7. Migration from Single-School

To migrate from a single-school system:

1. **Backup Database**: Always backup before migration
2. **Run Migration Scripts**: Execute SQL migration files
3. **Test Data Integrity**: Verify all data is properly associated
4. **Update Frontend**: Add SchoolProvider and update screens
5. **Test Functionality**: Ensure all features work with school filtering

### 8. Additional Features

#### School Management

```javascript
// Get school details
const { data: school } = await schoolService.getSchoolDetails();

// Update school information
const { error } = await schoolService.updateSchoolDetails({
  name: 'Updated School Name',
  address: 'New Address'
});
```

#### User School Access

```javascript
// Switch user's primary school
await schoolService.switchUserSchool(userId, newSchoolId);

// Get all schools user has access to
const { data: schools } = await schoolService.getUserSchools(userId);
```

### 9. Security Considerations

- **RLS Policies**: Ensure all tables have proper RLS policies
- **API Validation**: Validate school_id in API calls
- **User Permissions**: Check user access to schools before operations
- **Data Encryption**: Consider encrypting sensitive school data

### 10. Testing

Test scenarios to verify implementation:

1. **Data Isolation**: Users can only see data from their schools
2. **School Switching**: Switching schools updates all data views
3. **Role Permissions**: Different roles have appropriate access levels
4. **Multi-School Users**: Users with access to multiple schools work correctly
5. **Data Creation**: New records are associated with correct school

### 11. Performance Optimization

- **Indexes**: Create indexes on school_id columns
- **Caching**: Cache school data to reduce API calls
- **Lazy Loading**: Load school-specific data only when needed
- **Query Optimization**: Use efficient queries with proper joins

## Troubleshooting

### Common Issues

1. **RLS Blocking Queries**: Ensure RLS policies allow proper access
2. **Missing School Context**: Verify SchoolProvider wraps the app
3. **Data Not Filtering**: Check schoolService.setSchoolContext() calls
4. **Permission Errors**: Verify user roles and school access

### Debugging

Enable debug logging:
```javascript
// In SchoolContext
console.log('Selected school:', selectedSchool);
console.log('User schools:', userSchools);

// In data operations
console.log('Querying with school_id:', selectedSchoolId);
```

## Conclusion

This multi-school implementation provides:
- **Scalability**: Support multiple schools in one system
- **Security**: Proper data isolation and access control
- **Flexibility**: Easy school switching and management
- **Maintainability**: Clean architecture with clear separation

The implementation is designed to be backward compatible and can be gradually adopted across your existing codebase.
