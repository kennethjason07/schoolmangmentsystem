# Check and Clean Up Existing Storage Policies

You mentioned there are already 8 policies setup. This might be causing conflicts. Let's diagnose and fix this:

## Step 1: Review Existing Policies

1. Go to **Storage → Policies** in your Supabase dashboard
2. Look at all the policies for the `profiles` bucket
3. Check what operations they cover (INSERT, SELECT, UPDATE, DELETE)
4. Note the policy definitions - look for overly restrictive ones

## Step 2: Common Problematic Policies

Look for policies that might be blocking uploads:

### ❌ Too Restrictive (DELETE THESE):
- Policies that check folder ownership like: `auth.uid()::text = (storage.foldername(name))[1]`
- Policies with complex path matching
- Policies that require specific file naming patterns

### ✅ Good Policies (KEEP THESE):
- Simple INSERT policy: `bucket_id = 'profiles'`
- Simple SELECT policy: `bucket_id = 'profiles'`

## Step 3: Clean Up Process

### Option A: Delete All and Recreate
1. **Delete ALL existing policies** for the profiles bucket
2. Create just these 2 simple policies:

**Policy 1 - Upload:**
```
Name: Allow uploads
Operation: INSERT
Role: authenticated
Definition: bucket_id = 'profiles'
```

**Policy 2 - Read:**
```
Name: Allow reads
Operation: SELECT
Role: public
Definition: bucket_id = 'profiles'
```

### Option B: SQL Cleanup (if you can access SQL Editor)
```sql
-- Drop all existing policies for profiles bucket
DROP POLICY IF EXISTS "Users can insert their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
-- Add more DROP statements for any other policies you see

-- Create simple policies
CREATE POLICY "Simple upload policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.role() = 'authenticated');

CREATE POLICY "Simple read policy" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');
```

## Step 4: Test After Cleanup

1. After cleaning up, try the profile upload again
2. If it still fails, check the exact error message
3. The error should be different now if policies were the issue

## What to Look For:

- **Error 403 "RLS policy"**: Still a policy issue
- **Error 400 "bucket not found"**: Bucket setup issue
- **Success**: Policies are now working!

Please try Option A first (delete all policies via dashboard, then create the 2 simple ones).
