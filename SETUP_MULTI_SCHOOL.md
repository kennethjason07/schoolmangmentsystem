# Multi-School System Setup Instructions

## Overview
Your database already has multi-school infrastructure in place! Here's what you need to do to link all your existing data to the Maximus school and get the multi-school system working.

## Step 1: Run the Data Migration Script

### In your Supabase Dashboard:
1. **Go to SQL Editor**
2. **Copy and paste the entire contents of `migrate_existing_to_maximus.sql`**
3. **Run the script**

This will:
✅ Create the "Maximus" school in your `school_details` table
✅ Link ALL your existing data to Maximus school:
- Students
- Classes  
- Users
- Teachers
- Subjects
- Attendance records
- Marks
- Assignments
- And all other data

## Step 2: Set Up Your User Access

### Find Your User ID:
```sql
SELECT id, email, full_name FROM users WHERE email = 'your-actual-email@example.com';
```

### Grant Admin Access:
```sql
INSERT INTO school_users (user_id, school_id, role_in_school, is_primary_school)
VALUES (
  'your-user-id-from-above-query',
  (SELECT id FROM school_details WHERE school_code = 'MAX001'),
  'Admin',
  true
) ON CONFLICT (user_id, school_id) DO UPDATE SET
  role_in_school = EXCLUDED.role_in_school,
  is_primary_school = EXCLUDED.is_primary_school;
```

## Step 3: Verify Everything Works

After the migration, your app should:
✅ Show a school selector in the header
✅ Display "Maximus" as the selected school
✅ Show all your existing data properly
✅ Allow you to add new students/data linked to Maximus school

## What the Migration Script Does

### Creates Maximus School:
- Name: "Maximus"
- School Code: "MAX001"
- Type: "Primary School"
- Status: Active

### Links All Data Tables:
- `students` → Maximus school
- `classes` → Maximus school
- `users` → Maximus school
- `teachers` → Maximus school
- `subjects` → Maximus school
- `student_attendance` → Maximus school
- `teacher_attendance` → Maximus school
- `marks` → Maximus school
- `assignments` → Maximus school
- `exams` → Maximus school
- `homeworks` → Maximus school
- `fee_structure` → Maximus school
- `student_fees` → Maximus school
- `parents` → Maximus school
- `messages` → Maximus school
- `notifications` → Maximus school
- `tasks` → Maximus school
- `personal_tasks` → Maximus school
- `timetable_entries` → Maximus school

## Current Status

✅ **Database Schema**: Your database already has all the multi-school tables and columns
✅ **App Code**: Updated with multi-school context and filtering
✅ **Migration Script**: Ready to run and link all your data
✅ **Dependencies**: All required packages installed

## After Migration

Once you run the migration script and set up user access:

1. **Your existing data will be preserved** - nothing is deleted or lost
2. **All data will be properly linked** to Maximus school
3. **The app will show the school selector** and work with multi-school features
4. **You can add more schools later** if needed
5. **All new data will automatically** be linked to the selected school

## Troubleshooting

If you encounter any issues:

1. **Check the migration results** - the script shows a summary of updated records
2. **Verify school creation** - ensure Maximus school appears in `school_details`
3. **Confirm user access** - check that your user is in `school_users` table
4. **Test data visibility** - ensure you can see students, classes, etc. in the app

## Ready to Go!

Your multi-school system is ready! Just run the migration script and you'll have:
- All existing data preserved and linked to Maximus
- Full multi-school functionality
- Ability to add more schools in the future
- School-scoped data management

The migration is safe and reversible - your data is protected throughout the process.
