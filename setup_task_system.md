# Task Management System Setup Guide

## Overview
This guide will help you set up the new task management system for the teacher dashboard. The system uses the existing `tasks` table for admin-assigned tasks and creates a new `personal_tasks` table for teacher's personal tasks.

## Prerequisites
- Access to your Supabase database
- Admin privileges to create tables and functions
- Existing `tasks` table (already present in your schema)

## Step 1: Run the SQL Script

### Recommended: Run the Personal Tasks Setup Script
Execute the `create_personal_tasks_only.sql` file in your Supabase SQL editor:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `create_personal_tasks_only.sql`
4. Click "Run"

### Alternative: Run the Complete Setup Script
If you want all enhancements, use `complete_tasks_system.sql` instead.

## Step 2: Verify Table Creation

Check that the personal_tasks table was created and tasks table exists:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('personal_tasks', 'tasks');
```

## Step 3: Test the System

### Add Sample Personal Task
```sql
INSERT INTO personal_tasks (user_id, task_title, task_description, task_type, priority, due_date) 
VALUES (
    'your-teacher-user-id-here',
    'Test Personal Task',
    'This is a test task to verify the system works',
    'planning',
    'medium',
    '2025-08-15'
);
```

### Add Sample Admin Task (using existing tasks table)
```sql
INSERT INTO tasks (title, description, task_type, priority, due_date, assigned_teacher_ids)
VALUES (
    'Test Admin Task',
    'This is a test task assigned by admin',
    'report',
    'High',
    '2025-08-10',
    ARRAY['teacher-user-id-here']
);
```

## Step 4: Update App Configuration

The app has been updated to use the new tables. Make sure your app includes the latest changes:

1. Updated `src/utils/supabase.js` with new table references
2. Updated `src/screens/teacher/TeacherDashboard.js` with new database queries
3. Enhanced task management features are now active

## Features Included

### Personal Tasks
- ✅ Create, read, update, delete personal tasks
- ✅ Priority levels (High, Medium, Low)
- ✅ Task categories (Attendance, Marks, Homework, Meeting, Report, Planning)
- ✅ Due date tracking
- ✅ Status management (Pending, In Progress, Completed, Cancelled)

### Admin Tasks (using existing tasks table)
- ✅ Tasks assigned by administrators to teachers via existing tasks table
- ✅ Multiple teachers can be assigned to same task (array field)
- ✅ Priority and status tracking
- ✅ Enhanced with task_type categorization

### Enhanced UI
- ✅ Modern card-based design
- ✅ Priority color coding
- ✅ Category icons and colors
- ✅ Improved add task modal
- ✅ Better empty states
- ✅ Real-time updates

## Database Schema

### Personal Tasks Table
```sql
personal_tasks (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    task_title VARCHAR(255),
    task_description TEXT,
    task_type VARCHAR(50),
    priority VARCHAR(20),
    status VARCHAR(20),
    due_date DATE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### Existing Tasks Table (Enhanced)
```sql
tasks (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    assigned_teacher_ids UUID[], -- Array of teacher IDs
    task_type VARCHAR(50), -- Added by our script
    completed_at TIMESTAMP, -- Added by our script
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)
```

## Security

- ✅ Row Level Security (RLS) enabled
- ✅ Users can only see their own personal tasks
- ✅ Teachers can only see tasks assigned to them
- ✅ Admins can manage tasks they assigned
- ✅ Proper authentication checks

## Troubleshooting

### Common Issues

1. **Tables not created**: Check if you have admin privileges
2. **RLS errors**: Ensure you're authenticated when testing
3. **Missing data**: Check if user IDs in sample data match your actual users
4. **App not updating**: Clear app cache and restart

### Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify database connections in Supabase
3. Ensure all SQL scripts ran successfully
4. Check that user authentication is working

## Next Steps

After setup is complete:
1. Test creating personal tasks in the teacher dashboard
2. Have an admin create test tasks for teachers
3. Verify task completion functionality
4. Customize task categories if needed
5. Set up any additional notifications or integrations

The task management system is now ready for use! 🚀
