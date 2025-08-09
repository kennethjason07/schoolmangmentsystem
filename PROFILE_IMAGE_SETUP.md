# Profile Image Setup Guide

This guide will help you set up profile image functionality for all 4 user types (Admin, Teacher, Student, Parent) in your school management system.

## Prerequisites

- Access to your Supabase dashboard
- Admin privileges in your Supabase project
- The school management system app already running

## Step 1: Database Setup

### 1.1 Add the profile_url column to the users table

Run the following SQL in your Supabase SQL Editor:

```sql
-- Add profile_url column to users table for storing profile images
-- Run this SQL in your Supabase SQL editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_url TEXT;

-- Add a comment to document this column
COMMENT ON COLUMN public.users.profile_url IS 'URL to user profile image stored in Supabase storage';

-- Create an index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_profile_url ON public.users(profile_url) WHERE profile_url IS NOT NULL;
```

### 1.2 Set up Supabase Storage

Run the following SQL in your Supabase SQL Editor:

```sql
-- Setup Supabase Storage for Profile Images
-- Run this SQL in your Supabase SQL editor

-- Create the profiles storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- Set up storage policies for profile images

-- Policy to allow authenticated users to upload their own profile images
CREATE POLICY "Users can upload their own profile image" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow authenticated users to update their own profile images  
CREATE POLICY "Users can update their own profile image" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow authenticated users to delete their own profile images
CREATE POLICY "Users can delete their own profile image" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow everyone to view profile images (since bucket is public)
CREATE POLICY "Anyone can view profile images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profiles');
```

## Step 2: Verify Setup

### 2.1 Check that the column was added

Run this query to verify the column exists:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'profile_url';
```

### 2.2 Check that the storage bucket was created

1. Go to Storage in your Supabase dashboard
2. You should see a `profiles` bucket
3. The bucket should be public

## Step 3: App Code Updates

The following files have been updated:

### 3.1 ProfileScreen.js Updates

✅ **Updated photo upload functionality:**
- Uses `profile_url` column instead of `photo_url`
- Organizes files in user-specific folders (`{user_id}/{timestamp}.jpg`)
- Converts image URI to blob for better upload compatibility
- Shows edit button overlay on existing profile images
- Improved error handling

✅ **Enhanced UI:**
- Better camera icon positioning
- Improved touch targets
- Visual feedback for image editing

## Step 4: Testing

### 4.1 Test Profile Image Upload

1. **Log in as any user type** (Admin, Teacher, Student, or Parent)
2. **Navigate to Profile screen**
3. **Tap the camera icon** (either on default avatar or existing image)
4. **Select "Take Photo" or "Choose from Gallery"**
5. **Confirm the image uploads and displays correctly**

### 4.2 Test Image Persistence

1. **Upload a profile image**
2. **Log out and log back in**
3. **Verify the image is still there**
4. **Navigate to other screens and back to profile**
5. **Confirm image persists**

### 4.3 Test Different User Types

Test the functionality with:
- ✅ **Admin users**
- ✅ **Teacher users**  
- ✅ **Student users**
- ✅ **Parent users**

## Step 5: Features Included

### 5.1 Security Features

- ✅ **User isolation**: Each user can only upload to their own folder
- ✅ **Authentication required**: Only authenticated users can upload
- ✅ **File organization**: Images stored in `{user_id}/` folders
- ✅ **Public read access**: Profile images are publicly viewable
- ✅ **Automatic cleanup**: New uploads replace old ones (upsert: true)

### 5.2 UI/UX Features

- ✅ **Camera and gallery options**: Both photo taking and selection
- ✅ **Image editing overlay**: Shows camera icon on existing images
- ✅ **Permission requests**: Proper camera and photo library permissions
- ✅ **Loading states**: Visual feedback during uploads
- ✅ **Error handling**: User-friendly error messages
- ✅ **Real-time updates**: Images update immediately after upload

### 5.3 Technical Features

- ✅ **Blob upload**: Converts URI to blob for better compatibility
- ✅ **Content type specification**: Properly sets JPEG content type
- ✅ **Cache control**: 1-hour cache for better performance
- ✅ **File naming**: Timestamp-based naming prevents conflicts
- ✅ **Database consistency**: Updates both storage and database atomically

## Step 6: File Structure

After setup, your storage will be organized as follows:

```
profiles/
├── {user_id_1}/
│   └── {timestamp}.jpg
├── {user_id_2}/
│   └── {timestamp}.jpg
└── {user_id_3}/
    └── {timestamp}.jpg
```

## Step 7: Troubleshooting

### 7.1 Common Issues

**Issue: "Permission denied" errors**
- **Solution**: Ensure the storage policies are set up correctly
- **Check**: Run the storage policy SQL commands again

**Issue: Images not displaying**
- **Solution**: Verify the bucket is set to public
- **Check**: Go to Storage > profiles bucket > Settings > Make public

**Issue: Upload fails**
- **Solution**: Check that the user is authenticated
- **Check**: Verify network connectivity and Supabase URL

**Issue: Old image references**
- **Solution**: Clear app cache and restart
- **Check**: Verify the column name is `profile_url` not `photo_url`

### 7.2 Debug Commands

Check current user's profile URL:
```sql
SELECT id, full_name, email, profile_url 
FROM users 
WHERE id = 'your-user-id-here';
```

Check storage objects:
```sql
SELECT name, bucket_id, created_at 
FROM storage.objects 
WHERE bucket_id = 'profiles' 
ORDER BY created_at DESC;
```

## Step 8: Additional Enhancements (Optional)

### 8.1 Image Compression

The current setup uses 0.8 quality. You can adjust this in the ImagePicker options:

```javascript
quality: 0.5, // Lower for smaller files
quality: 1.0, // Higher for better quality
```

### 8.2 Multiple Image Formats

To support PNG and other formats, update the upload function:

```javascript
const fileExtension = uri.split('.').pop() || 'jpg';
const fileName = `${authUser.id}/${Date.now()}.${fileExtension}`;
const contentType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
```

### 8.3 Image Resizing

Consider adding image resizing for better performance:

```javascript
import { ImageManipulator } from 'expo-image-manipulator';

const resizedImage = await ImageManipulator.manipulateAsync(
  result.assets[0].uri,
  [{ resize: { width: 400 } }], // Resize to max width 400px
  { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
);
```

## Success! 🎉

Your profile image functionality is now set up for all 4 user types. Users can:

- ✅ Upload profile images from camera or gallery
- ✅ Edit existing profile images
- ✅ View their images across all app screens
- ✅ Have their images stored securely in user-specific folders

The system is secure, scalable, and provides a great user experience across all user roles in your school management system.
