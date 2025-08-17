# Fix Chat-Files Bucket - Final Solution

## Problem
The `chat-files` bucket has upload failures with "Network request failed" errors, while the `profiles` bucket works perfectly.

## Root Cause
🔑 **The real issue**: In React Native/Expo, `fetch(file.uri)` with file:// paths almost always fails when you try to `.blob()` it. This causes the "Network request failed" error - it's not actually a network issue, but a file system access problem.

## Solution
1. **Fix the file reading mechanism**: Use `expo-file-system` instead of `fetch()` 
2. **Apply profiles bucket policies**: Use the same proven policies that work for profiles

## Step 1: Apply New Bucket Policies

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Run the setup_chat_files_bucket_like_profiles.sql file
```

Or copy and paste the contents of `setup_chat_files_bucket_like_profiles.sql` directly.

## Step 2: Verify the Changes

After running the SQL, verify in your Supabase Dashboard:

### Storage Settings:
- Go to Storage > Buckets
- Verify `chat-files` bucket exists and is **public: true** (like profiles)

### Check Policies:
- Go to Storage > Policies
- You should see 4 new policies for `chat-files`:
  1. "Users can upload their own chat files" (INSERT)
  2. "Users can update their own chat files" (UPDATE) 
  3. "Users can delete their own chat files" (DELETE)
  4. "Anyone can view chat files" (SELECT)

## Step 3: Test File Upload

The app code has been updated to use the same folder structure as profiles:
- **Old structure**: `{senderId}_{timestamp}_{filename}` (flat)
- **New structure**: `{senderId}/{timestamp}_{filename}` (folder-based)

## Key Changes Made

### 1. Bucket Configuration
- Set `public: true` (same as profiles)
- Applied identical policies that work for profiles

### 2. Upload File Path Structure
- Changed from flat naming to folder structure
- Uses `{senderId}/{timestamp}_{filename}` format
- Matches profiles bucket pattern: `{user_id}/{filename}`

### 3. File Reading Fix (Critical)
- **OLD**: `fetch(file.uri)` → `.blob()` (fails in React Native/Expo)
- **NEW**: `expo-file-system` → base64 → Uint8Array → Supabase
- **Avoids**: React Native Blob polyfill issues (doesn't support ArrayBuffer)
- **Uses**: Direct Uint8Array upload (supported by Supabase)
- This fixes the root cause of "Network request failed" errors

### 4. Policy Logic
- Uses `(storage.foldername(name))[1] = auth.uid()::text` 
- Same permission logic as profiles bucket
- Allows users to only upload/manage their own files

## Why This Works

The `profiles` bucket uses folder-based policies that check if the first folder in the path matches the authenticated user's ID:
- `storage.foldername('user123/photo.jpg')` returns `['user123']`
- `(storage.foldername(name))[1]` gets `'user123'`
- Policy checks if this equals `auth.uid()::text`

## Expected Result

After applying these changes:
1. ✅ File uploads should work immediately
2. ✅ Files will be organized by user ID in folders
3. ✅ Security maintained - users can only access their own files
4. ✅ Public bucket allows viewing shared files

## Testing

1. Try uploading a photo in TeacherChat
2. Try uploading a document in StudentChatWithTeacher  
3. Check file appears in Supabase Storage under `chat-files/{user_id}/`
4. Verify file is accessible via the generated public URL

## Rollback Plan

If there are any issues, you can rollback by running:
```sql
DROP POLICY IF EXISTS "Users can upload their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat files" ON storage.objects;
```

Then re-apply the original policies from `setup_chat_files_bucket_simple.sql`.
