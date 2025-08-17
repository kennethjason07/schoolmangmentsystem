# Chat Files Integration Setup Guide

This guide will help you integrate the new `chat-files` bucket into your school management system's chat functionality.

## What's Been Added

✅ **New chat-files bucket storage system**
- Secure file uploads for chat messages
- Support for images, documents, PDFs, and more
- 100MB file size limit per file
- Organized file structure with message IDs

✅ **Updated ChatWithTeacher.js (Parent Chat)**
- Real file upload to Supabase storage
- File type validation and size checking
- Upload progress indicators
- Error handling and user feedback

✅ **Utility functions for file handling**
- `uploadChatFile()` - Handles file uploads
- `formatFileSize()` - Displays file sizes nicely
- `getFileIcon()` - Shows appropriate icons for file types
- `isSupportedFileType()` - Validates file types

## Setup Instructions

### Step 1: Create the Chat-Files Bucket

1. **Open your Supabase Dashboard**
2. **Go to Storage section**
3. **Run the SQL script** in your Supabase SQL Editor:

```bash
# Run this file in Supabase SQL Editor:
setup_chat_files_storage.sql
```

This will:
- Create a `chat-files` bucket (public)
- Set up proper security policies
- Configure file type restrictions
- Set 100MB size limit

### Step 2: Verify Bucket Setup

1. **Check Storage → Buckets** in Supabase Dashboard
2. You should see a `chat-files` bucket with a 🌐 public icon
3. **Test the policies**:
   - Go to Storage → Policies
   - Verify 4 policies exist for the `chat-files` bucket

### Step 3: Test the Integration

1. **Parent Chat Screen**:
   - Open the parent app
   - Go to "Chat With Teacher" 
   - Try uploading both photos and documents
   - Verify files appear in Supabase Storage

2. **Check file organization**:
   - Files should appear in `chat-files/` bucket
   - Structure: `{message_id}/{sender_user_id}_{timestamp}_{filename}`
   - Example: `chat-files/msg_1640995200000_abc123/user_456_1640995200000_photo.jpg`

## Features Included

### 🔒 Security Features
- **User authentication required** for all uploads
- **File type validation** (only safe file types allowed)
- **Size limits** (100MB per file)
- **Organized storage** (files organized by message ID)

### 📁 Supported File Types
- **Images**: JPEG, PNG, WebP, GIF
- **Documents**: PDF, Word, Excel, PowerPoint
- **Text files**: TXT, CSV
- **Archives**: ZIP files

### 🎨 UI/UX Features
- **Upload progress indicators** ("Uploading photo...")
- **Error handling** with user-friendly messages
- **File size display** (automatically formatted)
- **File type icons** (different icons for different file types)
- **Tap to download** (files open in default app)

## File Structure After Setup

```
Supabase Storage:
├── profiles/               (existing - profile images)
│   └── user_123_timestamp.jpg
└── chat-files/             (new - chat attachments)
    ├── msg_abc123_def456/
    │   └── user789_1640995200000_document.pdf
    ├── msg_xyz789_ghi012/
    │   └── user456_1640995300000_photo.jpg
    └── msg_pqr345_stu678/
        └── user123_1640995400000_assignment.docx
```

## Database Integration

The system automatically updates your existing `messages` table with:
- `message_type`: 'image', 'file', or 'text'
- `file_url`: Public URL to the uploaded file
- `file_name`: Original filename
- `file_size`: File size in bytes
- `file_type`: MIME type (e.g., 'image/jpeg')

No database changes needed - uses existing schema!

## What's Working Now

✅ **Parent → Teacher File Sharing**
- Parents can send photos and documents to teachers
- Files are securely stored in Supabase
- Teachers can download and view files
- Proper file organization and naming

## Still To Do

The following screens need similar integration:

🔄 **TeacherChat.js** - Teacher → Parent/Student file sharing
🔄 **StudentChatWithTeacher.js** - Student → Teacher file sharing

These will be updated with the same functionality in the next steps.

## Troubleshooting

### Common Issues:

**"Upload Failed: File upload failed"**
- Check that you ran the SQL setup script
- Verify the `chat-files` bucket exists and is public
- Check file size (must be < 100MB)

**"Unsupported File Type"**
- Only specific file types are allowed for security
- Check the supported types list above

**"Permission denied"**
- Ensure user is logged in
- Check that storage policies are set up correctly

### Testing Commands:

Check if bucket exists:
```sql
SELECT * FROM storage.buckets WHERE id = 'chat-files';
```

Check policies:
```sql
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%chat%';
```

## Success Indicators

✅ Files upload without errors
✅ Files appear in Supabase Storage dashboard  
✅ Files are downloadable by clicking them
✅ File info displays correctly (name, size)
✅ Database `messages` table gets updated with file data

## Next Steps

After confirming the parent chat works:
1. Test with different file types (PDF, images, Word docs)
2. Test with different file sizes
3. Verify files can be downloaded
4. Update TeacherChat.js and StudentChatWithTeacher.js with similar functionality

The chat-files bucket integration is now ready for the parent chat screen! 🎉
