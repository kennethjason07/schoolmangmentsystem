# Profile Image Setup Verification

## Quick Steps to Test

### Step 1: Run the Database Updates

1. **Add the profile_url column** - Run `add_profile_image_column.sql` in Supabase SQL Editor
2. **Fix storage policies** - Run `fix_storage_policies.sql` in Supabase SQL Editor  
3. **Verify bucket exists** - Check Storage → profiles bucket is public

### Step 2: Test the Upload

1. **Open your app**
2. **Navigate to Profile screen**
3. **Try uploading an image**
4. **Check console logs** for detailed debugging info

### Step 3: Expected Console Output

When you try to upload, you should see logs like:
```
Starting photo upload for user: [uuid]
Image URI: [local-file-path]
Generated filename: [uuid]_[timestamp].jpg
Blob created, size: [number]
Upload successful: [upload-data]
Generated public URL: https://dmagnsbdjsnzsddxqrwd.supabase.co/storage/v1/object/public/profiles/[filename]
Database update successful: [update-data]
```

### Step 4: Verification Checklist

✅ **Database column added**: Run this query in Supabase SQL Editor:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'profile_url';
```

✅ **Storage bucket exists**: Go to Storage → should see `profiles` bucket

✅ **Bucket is public**: Click profiles bucket → Settings → "Public bucket" enabled

✅ **File uploaded**: After upload, check Storage → profiles → should see files like `uuid_timestamp.jpg`

✅ **Database updated**: Run this to check profile URL:
```sql
SELECT id, full_name, profile_url FROM users WHERE profile_url IS NOT NULL;
```

✅ **Image displays**: Profile image should appear in the app

### Step 5: Troubleshooting Commands

**Check storage policies:**
```sql
SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'objects';
```

**Check recent uploads:**
```sql
SELECT name, bucket_id, created_at FROM storage.objects 
WHERE bucket_id = 'profiles' 
ORDER BY created_at DESC;
```

**Manual URL test**: Try accessing this URL in browser:
```
https://dmagnsbdjsnzsddxqrwd.supabase.co/storage/v1/object/public/profiles/[filename]
```

## What's Fixed

✅ **getPublicUrl error**: Now uses manual URL construction instead of the problematic API method
✅ **RLS policy issues**: Simplified storage policies that should work
✅ **File naming**: Uses simple `userid_timestamp.jpg` format
✅ **Detailed logging**: Shows exactly what's happening during upload
✅ **Error handling**: Better error messages to help debug issues

## Success Indicators

- ✅ No `getPublicUrl` errors
- ✅ No RLS policy errors  
- ✅ Files appear in Supabase Storage
- ✅ Database profile_url column gets populated
- ✅ Images display in the app
- ✅ Works for all user types (Admin, Teacher, Student, Parent)

The profile image functionality should now work properly! 🎉
