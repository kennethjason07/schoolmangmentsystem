# Supabase Integration Setup

This document explains how Supabase is integrated into the School Management System.

## Configuration

The Supabase client is configured in `src/utils/supabase.js` with the following credentials:
- **Project URL**: `https://tzhedajejqandtrjkbkx.co`
- **Anonymous Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6aGVkYWplanFhbmR0cmprYmt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIzMzIxMywiZXhwIjoyMDY2ODA5MjEzfQ.QnAr7sl36nCHMiE8aHMEGHvfKwsKAOFvHVG5iJVx6PI`

## Database Tables

The following tables are expected in your Supabase database:

### Core Tables
- `users` - User authentication and profiles
- `students` - Student information
- `teachers` - Teacher information  
- `parents` - Parent information
- `admins` - Admin information
- `classes` - Class information
- `subjects` - Subject information

### Academic Tables
- `attendance` - Daily attendance records
- `marks` - Student marks and grades
- `homework` - Homework assignments
- `assignments` - Class assignments
- `timetable` - Class schedules

### Administrative Tables
- `fees` - Fee collection and payments
- `notifications` - System notifications
- `chat_messages` - Chat messages between users

## Authentication

The app uses Supabase Auth with the following features:
- Email/password authentication
- Role-based access (admin, teacher, parent, student)
- Session management
- Automatic navigation based on user role

## Usage Examples

### Authentication
```javascript
import { useAuth } from '../utils/AuthContext';

const { signIn, signOut, user, userType } = useAuth();

// Sign in
const handleLogin = async () => {
  const { data, error } = await signIn(email, password);
  if (error) {
    console.error('Login failed:', error);
  }
};

// Sign out
const handleLogout = async () => {
  await signOut();
};
```

### Database Operations
```javascript
import { dbHelpers, TABLES } from '../utils/supabase';

// Create a new student
const { data, error } = await dbHelpers.create(TABLES.STUDENTS, {
  name: 'John Doe',
  email: 'john@example.com',
  class_id: 1
});

// Get students by class
const { data: students, error } = await dbHelpers.getStudentsByClass(classId);

// Update student information
const { data, error } = await dbHelpers.update(TABLES.STUDENTS, studentId, {
  name: 'Jane Doe'
});

// Delete a record
const { error } = await dbHelpers.delete(TABLES.STUDENTS, studentId);
```

### Specific Queries
```javascript
// Get attendance for a specific date
const { data, error } = await dbHelpers.getAttendanceByDate('2024-01-15', classId);

// Get marks for a student
const { data, error } = await dbHelpers.getMarksByStudent(studentId, subjectId);

// Get notifications for a user
const { data, error } = await dbHelpers.getNotificationsByUser(userId, userType);

// Get chat messages between two users
const { data, error } = await dbHelpers.getChatMessages(senderId, receiverId);
```

## Installation

1. Install the Supabase client:
```bash
npm install @supabase/supabase-js
```

2. The configuration is already set up in `src/utils/supabase.js`

3. The AuthProvider is already integrated in `App.js`

## Database Schema (Recommended)

Here's a basic schema for the main tables:

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'teacher', 'parent', 'student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### students
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  class_id UUID REFERENCES classes(id),
  parent_id UUID REFERENCES parents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### teachers
```sql
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  subject_id UUID REFERENCES subjects(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### attendance
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Rules

Make sure to set up Row Level Security (RLS) policies in Supabase:

```sql
-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Example policy for students
CREATE POLICY "Students can view their own data" ON students
  FOR SELECT USING (auth.uid() = user_id);

-- Example policy for teachers
CREATE POLICY "Teachers can view their class students" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes 
      WHERE classes.id = students.class_id 
      AND classes.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );
```

## Testing

To test the integration:

1. Create test users in Supabase Auth
2. Add corresponding records in the database tables
3. Use the demo credentials in the login screen
4. Verify that role-based navigation works correctly

## Troubleshooting

- **Authentication errors**: Check if the user exists in Supabase Auth
- **Database errors**: Verify table names and column names match the expected schema
- **Permission errors**: Check RLS policies in Supabase
- **Network errors**: Verify the project URL and API key are correct 