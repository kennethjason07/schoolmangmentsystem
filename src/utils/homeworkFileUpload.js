import { supabase } from './supabase';
import { File } from 'expo-file-system';
import { decode as atob } from 'base-64';

/**
 * Utility functions for handling homework file uploads to Supabase Storage
 * Updated for Expo FileSystem API v54 (using File class)
 */

// Validate expo-file-system import
if (!File) {
  console.error('❌ expo-file-system File class is not properly imported or unavailable');
}

/**
 * Modern file reading utility using Expo FileSystem v54 File class
 * @param {string} uri - File URI to read
 * @returns {Promise<string>} - Base64 encoded string
 */
const readFileAsBase64 = async (uri) => {
  try {
    console.log('🔄 Using new Expo FileSystem v54 File class');
    
    // Create File instance from URI
    const file = new File(uri);
    
    // Check if file exists
    if (!file.exists) {
      throw new Error(`File does not exist at URI: ${uri}`);
    }
    
    // Use the new base64() method from File class
    const base64String = await file.base64();
    
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('Invalid base64 data received from File.base64()');
    }
    
    console.log('✅ Successfully read file using File.base64() method');
    return base64String;
    
  } catch (error) {
    console.error('❌ Error reading file with new FileSystem API:', error.message);
    throw new Error(`Failed to read file using new FileSystem API: ${error.message}`);
  }
};

/**
 * Upload a homework file to the homework-files bucket
 * @param {Object} file - File object from DocumentPicker or ImagePicker
 * @param {string} teacherId - Teacher ID who is uploading
 * @param {string} classId - Class ID the homework is for
 * @param {string} subjectId - Subject ID (optional)
 * @param {Object} homeworkData - Homework metadata (title, description, due_date, etc.)
 * @returns {Object} - Upload result with file data or error
 */
export const uploadHomeworkFile = async (file, teacherId, classId, subjectId = null, homeworkData = {}) => {
  try {
    console.log('🔄 Starting homework file upload:', { 
      fileName: file.name, 
      fileSize: file.size,
      teacherId,
      classId,
      subjectId,
      homeworkData
    });

    // Generate unique homework ID for file organization
    const homeworkId = generateHomeworkId();
    const timestamp = Date.now();
    
    // Clean filename to prevent issues
    const cleanFileName = sanitizeFileName(file.name);
    
    // Create file path using homework bucket structure: teacher_{teacherId}/class_{classId}/{timestamp}_{filename}
    // This allows teachers to organize files by class
    const filePath = `teacher_${teacherId}/class_${classId}/${timestamp}_${cleanFileName}`;
    
    console.log('📁 Generated homework file path:', filePath);

    // Convert URI to Uint8Array for upload using Expo FileSystem (React Native compatible)
    let fileData;
    let contentType;
    if (file.uri) {
      console.log('🔄 Reading homework file via FileSystem:', file.uri);
      
      try {
        // Use robust file reading utility
        const base64 = await readFileAsBase64(file.uri);
        
        // Validate base64 string
        if (!base64 || typeof base64 !== 'string') {
          throw new Error('Invalid base64 data received from file reading');
        }
        
        // Convert base64 → Uint8Array (React Native Blob polyfill doesn't support ArrayBuffer)
        fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        contentType = file.mimeType || file.type || 'application/octet-stream';
        
        console.log('📦 Homework file data created via FileSystem, size:', fileData.length, 'type:', contentType);
      } catch (readError) {
        console.error('❌ Error reading homework file:', readError);
        throw new Error(`Failed to read homework file: ${readError.message}`);
      }
    } else {
      throw new Error('No file URI provided');
    }

    // Upload using Uint8Array (React Native compatible)
    let uploadData = null;
    let uploadError = null;
    
    console.log('🚀 Uploading homework file using Uint8Array (React Native compatible)...');
    console.log('🔍 Upload details:', {
      bucketName: 'homework-files',
      filePath,
      fileSize: fileData.length,
      contentType
    });
    
    try {
      // First, let's check if the bucket exists and is accessible
      const { data: bucketData, error: bucketError } = await supabase.storage
        .from('homework-files')
        .list('', { limit: 1 });
      
      if (bucketError) {
        console.log('❌ Bucket access error:', bucketError);
        if (bucketError.message.includes('not found')) {
          throw new Error('Bucket homework-files does not exist. Please create it in Supabase Dashboard.');
        }
      } else {
        console.log('✅ Bucket access confirmed');
      }
      
      const { data, error } = await supabase.storage
        .from('homework-files')
        .upload(filePath, fileData, {
          contentType: contentType,
          cacheControl: '3600',
          upsert: true // Allow replacing existing files
        });
      
      if (!error) {
        uploadData = data;
        console.log('✅ Homework upload succeeded:', uploadData);
      } else {
        console.log('❌ Homework upload failed:', error);
        console.log('❌ Error details:', {
          message: error.message,
          code: error.statusCode,
          details: error
        });
        
        // Provide more specific error messages
        if (error.message.includes('row-level security')) {
          throw new Error('Storage permission denied. Please make the homework-files bucket public or add proper RLS policies.');
        } else if (error.message.includes('not found')) {
          throw new Error('Bucket homework-files not found. Please create it in Supabase Dashboard.');
        }
        
        uploadError = error;
      }
    } catch (uploadException) {
      console.log('❌ Homework upload threw exception:', uploadException);
      uploadError = uploadException;
    }

    if (!uploadData || uploadError) {
      console.error('❌ Homework upload failed. Error:', uploadError);
      throw uploadError || new Error('Homework upload failed');
    }

    console.log('✅ Homework file uploaded successfully with path:', filePath);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('homework-files')
      .getPublicUrl(filePath);

    console.log('🔗 Generated homework public URL:', publicUrl);

    // Prepare homework data for database
    const homeworkRecord = {
      id: homeworkId,
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      title: homeworkData.title || 'Homework Assignment',
      description: homeworkData.description || '',
      due_date: homeworkData.due_date || null,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size || fileData.length,
      file_type: contentType,
      file_path: filePath,
      created_at: new Date().toISOString(),
      status: 'active'
    };

    console.log('💾 Homework record prepared:', homeworkRecord);

    return {
      success: true,
      homeworkRecord,
      filePath,
      publicUrl,
      homeworkId
    };

  } catch (error) {
    console.error('❌ Homework file upload failed:', error);
    return {
      success: false,
      error: error.message || 'Homework file upload failed'
    };
  }
};

/**
 * Delete a homework file from homework-files bucket
 * @param {string} filePath - Path to the file in storage
 * @returns {Object} - Delete result
 */
export const deleteHomeworkFile = async (filePath) => {
  try {
    console.log('🗑️ Deleting homework file:', filePath);

    const { data, error } = await supabase.storage
      .from('homework-files')
      .remove([filePath]);

    if (error) {
      console.error('❌ Homework delete error:', error);
      throw error;
    }

    console.log('✅ Homework file deleted successfully:', data);
    return { success: true };

  } catch (error) {
    console.error('❌ Homework file deletion failed:', error);
    return {
      success: false,
      error: error.message || 'Homework file deletion failed'
    };
  }
};

/**
 * Upload multiple homework files
 * @param {Array} files - Array of file objects
 * @param {string} teacherId - Teacher ID who is uploading
 * @param {string} classId - Class ID the homework is for
 * @param {string} subjectId - Subject ID (optional)
 * @param {Object} homeworkData - Homework metadata
 * @returns {Object} - Upload results
 */
export const uploadMultipleHomeworkFiles = async (files, teacherId, classId, subjectId = null, homeworkData = {}) => {
  try {
    console.log('🔄 Starting multiple homework files upload:', files.length, 'files');
    
    const uploadResults = [];
    const errors = [];

    // Upload files sequentially to avoid overwhelming the storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📤 Uploading file ${i + 1}/${files.length}:`, file.name);
      
      const result = await uploadHomeworkFile(file, teacherId, classId, subjectId, {
        ...homeworkData,
        title: `${homeworkData.title || 'Homework'} - File ${i + 1}`
      });

      if (result.success) {
        uploadResults.push(result);
      } else {
        errors.push({ file: file.name, error: result.error });
      }
    }

    return {
      success: errors.length === 0,
      uploadedFiles: uploadResults,
      errors: errors,
      totalFiles: files.length,
      successfulUploads: uploadResults.length,
      failedUploads: errors.length
    };

  } catch (error) {
    console.error('❌ Multiple homework files upload failed:', error);
    return {
      success: false,
      error: error.message || 'Multiple homework files upload failed',
      uploadedFiles: [],
      errors: [],
      totalFiles: files.length,
      successfulUploads: 0,
      failedUploads: files.length
    };
  }
};

/**
 * Generate a unique homework ID
 * @returns {string} - Unique homework ID
 */
const generateHomeworkId = () => {
  return 'hw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Sanitize filename to prevent issues
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFileName = (filename) => {
  // Handle undefined/null filename
  if (!filename) {
    return `file_${Date.now()}.bin`; // Default filename if none provided
  }
  
  // Remove special characters and replace spaces with underscores
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // Limit length
};

/**
 * Get homework file type based on file extension and mime type
 * @param {Object} file - File object
 * @returns {string} - File category ('image', 'document', 'video', 'audio', 'other')
 */
export const getHomeworkFileType = (file) => {
  const mimeType = file.mimeType || file.type || '';
  const fileName = file.name || '';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Image types
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
    return 'image';
  }
  
  // Document types
  if (mimeType.startsWith('application/pdf') || 
      mimeType.includes('document') || 
      mimeType.includes('spreadsheet') || 
      mimeType.includes('presentation') ||
      ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'].includes(extension)) {
    return 'document';
  }
  
  // Video types
  if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
    return 'video';
  }
  
  // Audio types
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'aac', 'ogg', 'wma'].includes(extension)) {
    return 'audio';
  }
  
  return 'other';
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get file icon name based on file type
 * @param {Object} file - File object
 * @returns {string} - Ionicons icon name
 */
export const getHomeworkFileIcon = (file) => {
  const fileType = getHomeworkFileType(file);
  
  switch (fileType) {
    case 'image':
      return 'image';
    case 'document':
      return 'document-text';
    case 'video':
      return 'videocam';
    case 'audio':
      return 'musical-notes';
    default:
      return 'document';
  }
};

/**
 * Check if file type is supported for homework uploads
 * @param {string} mimeType - File mime type
 * @returns {boolean} - Whether the file type is supported
 */
export const isSupportedHomeworkFileType = (mimeType) => {
  const supportedTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/rtf',
    // Videos (limited)
    'video/mp4', 'video/quicktime', 'video/webm',
    // Audio (limited)
    'audio/mpeg', 'audio/wav', 'audio/aac',
    // Archives
    'application/zip', 'application/x-rar-compressed'
  ];
  
  return supportedTypes.includes(mimeType) || !mimeType; // Allow if no mime type specified
};

/**
 * Get file type color for UI display
 * @param {Object} file - File object
 * @returns {string} - Color hex code
 */
export const getHomeworkFileTypeColor = (file) => {
  const fileType = getHomeworkFileType(file);
  
  switch (fileType) {
    case 'image':
      return '#4CAF50'; // Green
    case 'document':
      return '#2196F3'; // Blue
    case 'video':
      return '#FF9800'; // Orange
    case 'audio':
      return '#9C27B0'; // Purple
    default:
      return '#757575'; // Gray
  }
};
