# Cloud File Upload System for Assignments

This document outlines the implementation of the cloud file upload system for student assignment submissions and teacher homework uploads using Supabase Storage.

## Overview

The system enables:
- **Students**: Upload assignment submissions to cloud storage
- **Teachers**: Upload homework files to cloud storage
- **Both**: View and access files from cloud storage with proper fallbacks

## Components Created

### 1. Supabase Storage Buckets

#### Assignment Files Bucket (`assignment-files`)
- **Purpose**: Store student assignment submissions
- **Structure**: `assignments/{type}/{assignmentId}/student_{studentId}_{timestamp}_{filename}`
- **Setup Script**: `database/create_assignment_files_bucket.sql`
- **Policies**: 
  - Authenticated users can upload/read/update/delete their own files
  - Public read access for viewing submissions

#### Homework Files Bucket (`homework-files`)
- **Purpose**: Store teacher homework files (already exists)
- **Structure**: `teacher_{teacherId}/class_{classId}/{timestamp}_{filename}`
- **Used by**: Teachers for uploading homework attachments

### 2. Database Schema

#### Assignment Submissions Table
- **File**: `database/create_assignment_submissions_table.sql`
- **Purpose**: Track student submissions with file metadata
- **Key Features**:
  - Stores file URLs, paths, and metadata
  - Supports both assignment and homework submissions
  - Row Level Security (RLS) policies
  - Grade and feedback tracking

### 3. Upload Utilities

#### Assignment File Upload (`src/utils/assignmentFileUpload.js`)
**Functions:**
- `uploadAssignmentFile()` - Upload single file to assignment-files bucket
- `uploadMultipleAssignmentFiles()` - Bulk upload
- `deleteAssignmentFile()` - Remove files from storage
- `getAssignmentFileType()` - Determine file category
- `getAssignmentFileIcon()` - Get appropriate UI icon
- `formatFileSize()` - Human-readable file sizes
- `isSupportedFileType()` - Validate file types

**Supported File Types:**
- Images: JPEG, PNG, WebP, GIF
- Documents: PDF, Word, Excel, PowerPoint, Plain Text
- Archives: ZIP

#### Homework File Upload (`src/utils/homeworkFileUpload.js`)
- Similar functionality for teacher uploads
- Pre-existing utility enhanced for cloud storage

### 4. Updated Screens

#### Student ViewAssignments (`src/screens/student/ViewAssignments.js`)
**New Features:**
- Real-time cloud upload with progress indicators
- File status tracking (uploaded/local)
- Upload validation and error handling
- Visual indicators for cloud vs local files
- Graceful fallbacks for upload failures

**UI Improvements:**
- Cloud/local status badges
- Upload progress feedback
- File type icons
- Size and accessibility indicators

#### Teacher ViewSubmissions (`src/screens/teacher/ViewSubmissions.js`)
**New Features:**
- Enhanced file viewing with cloud/local detection
- Detailed file information display
- Improved error messages for inaccessible files
- File type and size information
- Status indicators for file accessibility

**UI Improvements:**
- Color-coded file items (green for cloud, orange for local)
- File accessibility indicators
- Detailed error messages
- File metadata display

## How It Works

### Student Upload Process

1. **File Selection**: Student selects file via DocumentPicker or ImagePicker
2. **Validation**: System checks file type and size
3. **Cloud Upload**: File uploaded to Supabase `assignment-files` bucket
4. **URL Generation**: Public URL generated for file access
5. **Database Storage**: File metadata saved to submission record
6. **Fallback**: If cloud upload fails, file stored locally with warning

### Teacher File Viewing

1. **File Request**: Teacher clicks to open submitted file
2. **URL Detection**: System checks for cloud URL, fallback to local URI
3. **Accessibility Check**: Determines if file is accessible remotely
4. **Action**: 
   - **Cloud files**: Opens in default app
   - **Local files**: Shows helpful error message
   - **No URL**: Explains possible issues

### File Status Indicators

- **🟢 Cloud (Uploaded)**: File accessible from cloud storage
- **🟠 Local**: File stored locally, not accessible remotely
- **❌ Unavailable**: No valid URL found

## Setup Instructions

### 1. Database Setup

```sql
-- Run these SQL scripts in your Supabase SQL editor:

-- 1. Create assignment-files bucket and policies
\i database/create_assignment_files_bucket.sql

-- 2. Create assignment submissions table
\i database/create_assignment_submissions_table.sql
```

### 2. Environment Configuration

Ensure your Supabase configuration includes storage permissions:

```javascript
// src/utils/supabase.js
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  storage: {
    endpoint: `${SUPABASE_URL}/storage/v1`,
  }
});
```

### 3. Permissions Setup

Verify in Supabase Dashboard:
- **Storage → assignment-files**: Bucket exists and is public
- **Authentication → Users**: Users can authenticate
- **Database → RLS**: Policies are active for assignment_submissions table

## File Organization

### Assignment Files Structure
```
assignment-files/
├── assignments/
│   ├── assignment/
│   │   └── {assignmentId}/
│   │       └── student_{studentId}_{timestamp}_{filename}
│   └── homework/
│       └── {homeworkId}/
│           └── student_{studentId}_{timestamp}_{filename}
```

### Homework Files Structure  
```
homework-files/
├── teacher_{teacherId}/
│   └── class_{classId}/
│       └── {timestamp}_{filename}
```

## Error Handling

### Upload Failures
- **Network Issues**: Files stored locally with retry option
- **Permission Errors**: Clear error messages with setup instructions
- **File Type Issues**: Validation with supported type list
- **Size Limits**: Configurable limits with user feedback

### File Access Issues
- **Local Files**: Helpful message explaining remote access limitations
- **Missing URLs**: Detailed troubleshooting information
- **Broken URLs**: Error handling with retry options

## Security Features

### Storage Policies
- **Upload**: Only authenticated users can upload to their designated paths
- **Read**: Public read access for viewing submissions
- **Update/Delete**: Only file owners can modify their uploads

### File Validation
- **Type Checking**: Only allowed file types can be uploaded
- **Size Limits**: Configurable maximum file sizes
- **Content Scanning**: Future enhancement for malware detection

## Performance Considerations

### Optimization
- **Chunked Uploads**: For large files (future enhancement)
- **Compression**: Image optimization before upload
- **Caching**: Browser caching for frequently accessed files
- **CDN**: Supabase CDN for global file delivery

### Monitoring
- **Upload Success Rate**: Track successful vs failed uploads
- **File Access Patterns**: Monitor frequently accessed files
- **Storage Usage**: Track storage consumption per user/class

## Troubleshooting

### Common Issues

1. **"Bucket not found"**
   - Run the bucket creation SQL script
   - Verify bucket exists in Supabase Dashboard

2. **"Permission denied"**  
   - Check RLS policies are correctly configured
   - Verify user authentication status

3. **"File URL not available"**
   - Student may have submitted locally stored file
   - Ask student to re-submit with internet connection

4. **Upload failures**
   - Check internet connection
   - Verify file type is supported
   - Ensure file size is within limits

### Debug Mode

Enable detailed logging in development:

```javascript
// Add to upload utilities
const DEBUG_MODE = __DEV__ || process.env.NODE_ENV === 'development';

if (DEBUG_MODE) {
  console.log('🔄 Upload details:', uploadDetails);
}
```

## Future Enhancements

### Planned Features
1. **Batch Upload**: Multiple file selection and upload
2. **File Previews**: In-app file previews without external apps  
3. **Version Control**: Track file upload history
4. **Compression**: Automatic file compression for large uploads
5. **Offline Support**: Queue uploads for when connection returns
6. **File Sharing**: Share files between students/teachers
7. **Analytics**: Upload/download statistics

### Integration Opportunities
1. **Push Notifications**: Notify when files are uploaded/graded
2. **Email Integration**: Send file links via email
3. **Calendar Integration**: Link files to assignment due dates
4. **Backup System**: Automatic backup to additional cloud providers

## Cost Optimization

### Storage Management
- **Cleanup Policies**: Remove old submissions after academic year
- **Compression**: Reduce file sizes automatically
- **Tiering**: Move old files to cheaper storage tiers
- **Monitoring**: Track storage usage and costs

## Conclusion

This cloud file upload system provides a robust, scalable solution for assignment file management with proper fallbacks and user-friendly error handling. The implementation ensures files are accessible across devices while providing clear feedback when files cannot be accessed remotely.

The system gracefully handles both cloud and local file scenarios, making it suitable for various network conditions and user workflows.
