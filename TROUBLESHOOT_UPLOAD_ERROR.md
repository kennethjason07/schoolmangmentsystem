# Troubleshooting Profile Image Upload Error

## Error Description
```
StorageApiError: new row violates row-level security policy
```

This error occurs when the Row Level Security (RLS) policies on Supabase storage are preventing file uploads.

## Step-by-Step Fix

### Step 1: Run the Fixed Storage Policies

1. **Open your Supabase dashboard**
2. **Go to SQL Editor**
3. **Copy and paste the contents of `fix_storage_policies.sql`**
4. **Click "Run"**

### Step 2: Verify Storage Bucket Setup

1. **Go to Storage in your Supabase dashboard**
2. **Check that the `profiles` bucket exists**
3. **Click on the `profiles` bucket**
4. **Go to Settings tab**
5. **Make sure "Public bucket" is enabled**

### Step 3: Check Authentication

1. **Verify that the user is properly authenticated**
2. **In the app, check the console logs when trying to upload**
3. **Look for the log messages showing user ID and authentication status**

### Step 4: Test with Simplified Policies

If the above doesn't work, run this super-permissive policy (temporary for testing):

```sql
-- TEMPORARY: Very permissive policies for testing
-- Only use this temporarily to verify upload works

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read of profile images" ON storage.objects;

-- Create super permissive policies (TEMPORARY)
CREATE POLICY "Temp full access" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'profiles')
  WITH CHECK (bucket_id = 'profiles');

CREATE POLICY "Temp public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profiles');
```

### Step 5: Test the Upload

1. **Try uploading a profile image**
2. **Check the console logs for detailed error information**
3. **The logs will show:**
   - User ID
   - Generated filename
   - Upload status
   - Any specific error messages

### Step 6: Alternative Storage Approach (If policies still don't work)

If the policies continue to cause issues, we can temporarily disable RLS on the storage.objects table:

```sql
-- ONLY use this as a last resort for testing
-- This disables RLS entirely on storage.objects (less secure)

ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning:** Only use this temporarily for testing. Re-enable RLS after confirming uploads work:

```sql
-- Re-enable RLS after testing
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

### Step 7: Check File Permissions in Supabase Dashboard

1. **Go to Storage → profiles bucket**
2. **Try uploading a file manually through the dashboard**
3. **If manual upload fails, the issue is with bucket configuration**
4. **If manual upload works, the issue is with the policies**

### Step 8: Debug the Exact Error

The updated ProfileScreen.js now includes detailed logging. Check the console for:

```
Starting photo upload for user: [user-id]
Image URI: [file-path]
Generated filename: [filename]
Blob created, size: [size]
Upload error details: [detailed error]
```

### Step 9: Common Solutions

#### Solution A: Simplify the filename
The updated code now uses a simpler filename format: `{user-id}_{timestamp}.jpg` instead of `{user-id}/{timestamp}.jpg`

#### Solution B: Check bucket policies in dashboard
1. Go to Storage → profiles → Policies
2. Make sure policies are listed and active
3. Delete conflicting policies if any exist

#### Solution C: Recreate the bucket
If all else fails:
1. Delete the `profiles` bucket
2. Run the fixed storage setup SQL again
3. Test upload

### Step 10: Verify the Fix

After applying the fix:

1. **Upload should work without errors**
2. **Check Storage → profiles bucket to see uploaded files**
3. **Verify the profile image displays in the app**
4. **Test with different user types (Admin, Teacher, Student, Parent)**

## Expected File Structure After Fix

```
profiles/
├── uuid1_1234567890.jpg
├── uuid2_1234567891.jpg
└── uuid3_1234567892.jpg
```

## Success Indicators

✅ **Upload completes without errors**
✅ **File appears in Supabase Storage**
✅ **Profile image displays in the app**
✅ **Public URL is accessible**
✅ **Database is updated with profile_url**

## If Still Having Issues

1. **Check Supabase project URL and anon key are correct**
2. **Verify user is authenticated (not anonymous)**
3. **Try uploading from Supabase dashboard directly**
4. **Contact me with the exact error message from console logs**

The simplified filename approach and more permissive policies should resolve the RLS policy error.
