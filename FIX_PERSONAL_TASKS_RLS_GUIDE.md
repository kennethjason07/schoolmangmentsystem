# Fix Personal Tasks RLS Insertion Issues

## Problem
Users are getting a **42501 error** when trying to add personal tasks in the TeacherDashboard. This is caused by overly restrictive RLS (Row Level Security) policies.

## Root Cause
The original RLS policies used JWT token claims for tenant isolation:
```sql
FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
```

This failed because:
1. JWT tokens might not contain the 'tenant_id' claim
2. String comparison between `tenant_id::text` and JWT claim was failing
3. No fallback mechanism for when JWT claims are missing

## Solution
Replace the restrictive tenant-based policies with user-ownership based policies that are more reliable.

## Steps to Fix

### Step 1: Run the Personal Tasks Fix
Copy and paste the contents of `fix_personal_tasks_rls.sql` into Supabase SQL Editor and execute it.

This will:
- Drop the problematic `personal_tasks_tenant_isolation` policy
- Create a new `personal_tasks_user_owned` policy based on `user_id = auth.uid()`
- This is more reliable because `auth.uid()` always works for authenticated users

### Step 2: Run the Tasks Table Fix (Fallback)
Copy and paste the contents of `fix_tasks_table_rls_corrected.sql` into Supabase SQL Editor and execute it.

This will:
- Fix the `tasks` table policies (used as fallback in TeacherDashboard code)
- Handle the `assigned_teacher_ids` array properly
- Create triggers to automatically set `tenant_id` and `assigned_teacher_ids`

## Expected Result
After running both scripts:

✅ **Personal tasks insertion should work**
✅ **No more 42501 RLS policy violation errors**
✅ **Users can only access their own tasks (security maintained)**
✅ **Fallback to tasks table will also work if needed**

## Test
1. Go to TeacherDashboard
2. Try adding a new personal task
3. It should work without errors

## Files to Run
1. `fix_personal_tasks_rls.sql` (run first)
2. `fix_tasks_table_rls_corrected.sql` (run second)

## Verification
You can verify the fix worked by checking if the new policies exist:
```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('personal_tasks', 'tasks') 
  AND schemaname = 'public'
ORDER BY tablename, policyname;
```

You should see:
- `personal_tasks_user_owned` policy for personal_tasks table
- `tasks_teacher_access_*` policies for tasks table

## Security Note
The new policies maintain security by ensuring:
- Users can only access tasks where `user_id = auth.uid()` (personal_tasks)
- Teachers can only access tasks in their `assigned_teacher_ids` array (tasks)
- No loss of data isolation between users
