# Facial Recognition Attendance System Setup Guide

This guide will help you set up the facial recognition system for attendance verification in your school management system.

## 🎯 System Overview

The facial recognition system works alongside your existing attendance system as an additional verification method with the following features:

- **Offline Capability**: Uses face-api.js for client-side processing
- **High Accuracy**: Configurable confidence thresholds (default 80%, high accuracy 90%)
- **Security**: Encrypted face templates and audit logging
- **Multi-Role Support**: Works for both admin and teacher logins
- **Fallback**: Manual verification when face recognition fails
- **Multi-Tenant**: Tenant isolation for data security

## 📋 Prerequisites

1. Node.js and npm installed
2. Supabase project configured
3. Existing school management system database

## 🗄️ Step 1: Database Setup

### Run the Migration

Execute the SQL migration to create the facial recognition tables:

```bash
# In your Supabase SQL Editor, run:
# C:\Users\kened\Desktop\school_xyz\schoolmangmentsystem\database\migrations\add_facial_recognition_system.sql
```

This creates:
- `facial_templates` - Stores encrypted face data
- `facial_recognition_events` - Audit trail for all recognition activities
- Adds verification columns to existing attendance tables
- Creates indexes and RLS policies for performance and security

### Verify Tables Created

After running the migration, verify these tables exist:
- ✅ `facial_templates`
- ✅ `facial_recognition_events`
- ✅ `facial_recognition_stats` (view)
- ✅ Updated `student_attendance` with verification columns
- ✅ Updated `teacher_attendance` with verification columns

## 🗂️ Step 2: Supabase Storage Setup

### Create Storage Buckets

In your Supabase dashboard, create these storage buckets:

1. **facial-templates**
   - Purpose: Store enrollment photos
   - Public: No (private bucket)
   - Allowed file types: image/jpeg, image/png, image/webp
   - File size limit: 2MB

2. **facial-events**
   - Purpose: Store recognition attempt photos for audit
   - Public: No (private bucket)  
   - Allowed file types: image/jpeg, image/png, image/webp
   - File size limit: 2MB

### Storage Policies

Add these RLS policies to your buckets:

```sql
-- Policy for facial-templates bucket
CREATE POLICY "Users can upload to their tenant folder" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'facial-templates' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

CREATE POLICY "Users can view their tenant files" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'facial-templates' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for facial-events bucket
CREATE POLICY "Users can upload to their tenant folder" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'facial-events' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

CREATE POLICY "Users can view their tenant files" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'facial-events' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);
```

## 🔧 Step 3: Environment Configuration

### Add Environment Variables

Add these to your `.env` file:

```env
# Facial Recognition Configuration
REACT_APP_FACE_RECOGNITION_PROVIDER=offline
REACT_APP_FACE_ENCRYPTION_KEY=your-strong-encryption-key-32-chars-long

# Optional: Cloud provider credentials (if not using offline)
# AWS Rekognition
REACT_APP_AWS_ACCESS_KEY_ID=your-aws-key
REACT_APP_AWS_SECRET_ACCESS_KEY=your-aws-secret
REACT_APP_AWS_REGION=your-region

# Azure Face API
REACT_APP_AZURE_FACE_ENDPOINT=your-azure-endpoint
REACT_APP_AZURE_FACE_KEY=your-azure-key

# Google Cloud Vision
REACT_APP_GOOGLE_CLOUD_PROJECT_ID=your-project-id
REACT_APP_GOOGLE_CLOUD_KEY_FILE=path-to-service-account.json
```

### Generate Encryption Key

Generate a strong encryption key for face data:

```javascript
// Run this in Node.js console to generate a random key
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
```

## 📦 Step 4: Install Dependencies

Install required packages:

```bash
# Core facial recognition library (for offline processing)
npm install face-api.js

# Encryption for security
npm install crypto-js

# Optional: Cloud provider SDKs (only install if using cloud providers)
npm install aws-sdk @azure/cognitiveservices-face @google-cloud/vision
```

## 📁 Step 5: Download Face Recognition Models

For offline processing, download the face-api.js models:

```bash
# Create models directory
mkdir -p public/models/face-recognition

# Download models (you'll need to get these from face-api.js GitHub)
# Place these files in public/models/face-recognition/:
# - tiny_face_detector_model-weights_manifest.json
# - tiny_face_detector_model-shard1
# - face_landmark_68_model-weights_manifest.json
# - face_landmark_68_model-shard1
# - face_recognition_model-weights_manifest.json
# - face_recognition_model-shard1
# - face_expression_model-weights_manifest.json
# - face_expression_model-shard1
```

You can download these from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

## 🎨 Step 6: UI Integration Points

The system is ready to be integrated into your existing UI. Here are the key integration points:

### Admin Dashboard
- Add "Facial Recognition Settings" section
- Enroll student/teacher faces
- View recognition statistics
- Manage face templates

### Attendance Management  
- Add "Face Recognition" toggle to attendance marking
- Show verification method in attendance records
- Display confidence scores for face-verified attendance

### Take Attendance (Teachers)
- Add camera capture button
- Face recognition before marking attendance
- Fallback to manual entry if recognition fails

## 🚀 Step 7: Testing the System

### Test Face Enrollment

```javascript
import FaceRecognitionService from './src/services/FaceRecognitionService';

// Test enrollment
const testEnrollment = async () => {
  const imageFile = /* get image file from input */;
  
  const result = await FaceRecognitionService.enrollFace({
    personId: 'student-uuid',
    personType: 'student',
    imageFile,
    enrolledBy: 'admin-user-uuid',
    tenantId: 'tenant-uuid'
  });
  
  console.log('Enrollment result:', result);
};
```

### Test Face Recognition

```javascript
// Test recognition
const testRecognition = async () => {
  const imageFile = /* get image file from camera */;
  
  const result = await FaceRecognitionService.recognizeFace({
    imageFile,
    personType: 'student',
    performedBy: 'teacher-user-uuid',
    tenantId: 'tenant-uuid'
  });
  
  console.log('Recognition result:', result);
};
```

## 📊 Step 8: Monitoring and Analytics

### View Recognition Statistics

```sql
-- Check system performance
SELECT * FROM facial_recognition_stats 
WHERE tenant_id = 'your-tenant-id';
```

### Audit Recognition Events

```sql
-- View recent recognition attempts
SELECT 
  event_type,
  person_type,
  confidence_score,
  performed_at,
  error_message
FROM facial_recognition_events 
WHERE tenant_id = 'your-tenant-id'
ORDER BY performed_at DESC
LIMIT 50;
```

## 🔧 Configuration Options

### Recognition Providers

1. **offline** (Recommended for privacy)
   - Uses face-api.js
   - No external API calls
   - Good accuracy with proper models

2. **aws** (High accuracy, requires AWS account)
   - Uses Amazon Rekognition
   - Very high accuracy
   - Pay-per-use pricing

3. **azure** (Enterprise features)
   - Uses Azure Face API
   - Good accuracy with additional features
   - Subscription-based pricing

4. **google** (Fast processing)
   - Uses Google Cloud Vision
   - Fast recognition
   - Pay-per-use pricing

### Confidence Thresholds

- **0.6-0.7**: Lower security, more matches
- **0.8**: Default balanced setting
- **0.9+**: High security, fewer false positives

## 🛡️ Security Best Practices

1. **Encryption**: All face templates are encrypted before storage
2. **Audit Logging**: Every recognition attempt is logged
3. **Tenant Isolation**: RLS policies prevent cross-tenant access
4. **Data Retention**: Old recognition events are automatically cleaned up
5. **Access Control**: Only authorized users can enroll/manage templates

## 🐛 Troubleshooting

### Common Issues

**Face not detected:**
- Ensure good lighting
- Face should be clearly visible
- Supported formats: JPEG, PNG, WebP

**Low recognition accuracy:**
- Increase confidence threshold
- Enroll multiple photos per person
- Ensure enrollment photos are high quality

**Storage errors:**
- Check Supabase storage bucket policies
- Verify environment variables
- Ensure sufficient storage quota

**Model loading errors:**
- Verify face-api.js models are in `/public/models/face-recognition/`
- Check network connectivity for model downloads
- Ensure models are the correct version for face-api.js

## 🔄 Next Steps

After completing the setup:

1. **Integrate with UI**: Add camera components to attendance screens
2. **Bulk Enrollment**: Create tools for enrolling multiple students at once  
3. **Mobile Support**: Test on mobile devices and optimize camera capture
4. **Performance Tuning**: Monitor and optimize recognition speed
5. **User Training**: Train admin and teachers on using the system

## 📞 Support

For technical support or questions about the facial recognition system, refer to:

- FaceRecognitionService.js documentation
- Supabase storage documentation  
- face-api.js GitHub repository
- Your system administrator

---

✅ **Setup Complete!** Your facial recognition attendance system is now ready for integration.