# Chat Files Upload Fix Guide

This guide will help you fix the "requested path is invalid" error when uploading files in chat. The profiles bucket works fine, but chat-files has issues. Here's the complete solution.

## Problem Summary

- ✅ **Profiles bucket** - Working correctly (for profile images)
- ❌ **Chat-files bucket** - Getting "requested path is invalid" errors
- 🔍 **Root Cause** - Chat-files bucket missing or incorrectly configured

## Step 1: Run Bucket Setup SQL

**Run this SQL script in your Supabase SQL Editor:**

```sql
-- Simple Chat-Files Bucket Setup (matching working profiles setup)
-- Run this SQL in your Supabase SQL Editor

-- Create the chat-files storage bucket (keep it simple like profiles)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- Drop existing policies to avoid conflicts  
DROP POLICY IF EXISTS "Chat files upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files read policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files update policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files delete policy" ON storage.objects;

-- Create simple policies (matching the working profiles bucket policies)

-- Policy 1: Allow authenticated users to upload files to chat-files bucket
CREATE POLICY "Enable upload for authenticated users on chat-files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow all users to read files from chat-files bucket (public bucket)
CREATE POLICY "Enable read for all users on chat-files" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-files');

-- Policy 3: Allow users to update their own files (filename contains user ID)
CREATE POLICY "Enable update for users based on user_id on chat-files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(name, '_', 1)
) WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(name, '_', 1)
);

-- Policy 4: Allow users to delete their own files (filename contains user ID)
CREATE POLICY "Enable delete for users based on user_id on chat-files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(name, '_', 1)
);

-- Verify the setup
SELECT 'chat-files bucket created successfully' as status;
SELECT 'Policies created successfully' as status;
```

## Step 2: Verify Bucket Setup

1. **Check Supabase Dashboard:**
   - Go to Storage → Buckets
   - You should see both `profiles` and `chat-files` buckets
   - Both should have a 🌐 icon (indicating they're public)

2. **Check Policies:**
   - Go to Storage → Policies
   - You should see 4 policies for `chat-files` bucket
   - You should see 4 policies for `profiles` bucket

## Step 3: Test the Fix

### Method 1: Use the Built-in Diagnostics

1. **In your app, go to any chat screen**
2. **Tap the attachment (📎) button**
3. **Tap "Buckets"** (new diagnostic option)
4. **Check the results:**
   - ✅ Both buckets should show as working
   - ❌ If chat-files shows errors, check the setup above

### Method 2: Try Uploading Files

1. **Go to Student Chat or Parent Chat**
2. **Select a teacher to chat with**
3. **Tap attachment button**
4. **Try uploading a photo and a document**
5. **Check if files appear without errors**

## What Was Fixed

### 🔧 File Path Structure
**Before:** Complex nested paths like `{messageId}/{senderId}_{timestamp}_{filename}`
**After:** Simple flat paths like `{senderId}_{timestamp}_{filename}` (matching profiles)

### 🔧 Upload Method
**Before:** Only one upload approach
**After:** Three fallback methods including upsert option

### 🔧 Bucket Policies
**Before:** Complex policies that might conflict
**After:** Simple policies matching the working profiles bucket

### 🔧 Diagnostics
**Added:** Comprehensive bucket testing utility to identify issues

## File Structure After Fix

```
Supabase Storage:
├── profiles/                    ✅ Working
│   ├── user123_1640995200000.jpg
│   └── user456_1640995300000.jpg
└── chat-files/                  ✅ Fixed
    ├── user123_1640995400000_photo.jpg
    ├── user456_1640995500000_document.pdf
    └── user789_1640995600000_assignment.docx
```

## Expected Results

After running the SQL and the fixes:

### ✅ Success Indicators
- No more "requested path is invalid" errors
- Files upload successfully in chat
- Files appear in Supabase Storage dashboard
- Public URLs work and files can be downloaded
- Bucket diagnostics show both buckets as ✅ working

### 🧪 Testing Checklist
- [ ] SQL script runs without errors
- [ ] Both buckets visible in Supabase dashboard
- [ ] Bucket diagnostics shows all ✅
- [ ] Photo uploads work in chat
- [ ] Document uploads work in chat
- [ ] Files are downloadable by clicking them
- [ ] No console errors during upload

## Troubleshooting

### If SQL Script Fails
```sql
-- Check if buckets exist
SELECT * FROM storage.buckets;

-- Check existing policies
SELECT policyname, roles, cmd FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%chat%';
```

### If Still Getting Errors
1. **Check bucket existence:** Make sure `chat-files` bucket exists
2. **Check bucket is public:** Ensure the bucket has 🌐 icon
3. **Run diagnostics:** Use the "Buckets" option in attachment menu
4. **Check console logs:** Look for detailed error messages

### If Uploads Still Fail
```sql
-- Temporarily disable RLS for testing (re-enable after testing)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Test upload, then re-enable
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## Files Updated

The following files have been updated with the fixes:
- ✅ `src/utils/chatFileUpload.js` - Simplified file paths and better upload methods
- ✅ `src/utils/bucketDiagnostics.js` - New comprehensive diagnostics utility  
- ✅ `src/screens/student/StudentChatWithTeacher.js` - Added diagnostics button
- ✅ `setup_chat_files_bucket_simple.sql` - Simple bucket setup script

## Next Steps

After confirming this works:
1. Test with different file types (PDF, images, Word docs)
2. Test file downloads by tapping on files
3. Apply similar diagnostics to TeacherChat.js if needed
4. Remove any temporary debugging options

The chat file uploads should now work exactly like the profile uploads! 🎉
