import { supabase } from './supabase';
import { File } from 'expo-file-system';
import { decode as atob } from 'base-64';

/**
 * Utility functions for handling assignment file uploads to Supabase Storage
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
    console.log('🔄 Using new Expo FileSystem v54 File class for assignment');
    
    // Create File instance from URI
    const file = new File(uri);
    
    // Check if file exists
    if (!file.exists) {
      throw new Error(`Assignment file does not exist at URI: ${uri}`);
    }
    
    // Use the new base64() method from File class
    const base64String = await file.base64();
    
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('Invalid base64 data received from File.base64()');
    }
    
    console.log('✅ Successfully read assignment file using File.base64() method');
    return base64String;
    
  } catch (error) {
    console.error('❌ Error reading assignment file with new FileSystem API:', error.message);
    throw new Error(`Failed to read assignment file using new FileSystem API: ${error.message}`);
  }
};

/**
 * Upload an assignment file to the homework-files bucket (unified bucket for all files)
 * @param {Object} file - File object from DocumentPicker or ImagePicker
 * @param {string} studentId - Student ID who is uploading
 * @param {string} assignmentId - Assignment ID the file is for
 * @param {string} assignmentType - 'assignment' or 'homework'
 * @returns {Object} - Upload result with file data or error
 */
export const uploadAssignmentFile = async (file, studentId, assignmentId, assignmentType = 'assignment') => {
  try {
    console.log('🔄 Starting assignment file upload:', { 
      fileName: file.name, 
      fileSize: file.size,
      studentId,
      assignmentId,
      assignmentType
    });

    const timestamp = Date.now();
    
    // Clean filename to prevent issues
    const cleanFileName = sanitizeFileName(file.name);
    
    // Create file path: assignments/{assignmentType}/{assignmentId}/student_{studentId}_{timestamp}_{filename}
    const filePath = `assignments/${assignmentType}/${assignmentId}/student_${studentId}_${timestamp}_${cleanFileName}`;
    
    console.log('📁 Generated assignment file path:', filePath);

    // Convert URI to Uint8Array for upload using Expo FileSystem (React Native compatible)
    let fileData;
    let contentType;
    if (file.uri) {
      console.log('🔄 Reading assignment file via FileSystem:', file.uri);
      
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
        
        console.log('📦 Assignment file data created via FileSystem, size:', fileData.length, 'type:', contentType);
      } catch (readError) {
        console.error('❌ Error reading assignment file:', readError);
        throw new Error(`Failed to read assignment file: ${readError.message}`);
      }
    } else {
      throw new Error('No file URI provided');
    }

    // Upload using Uint8Array (React Native compatible)
    let uploadData = null;
    let uploadError = null;
    
    console.log('🚀 Uploading assignment file using Uint8Array (React Native compatible)...');
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
        console.log('✅ Assignment upload succeeded:', uploadData);
      } else {
        console.log('❌ Assignment upload failed:', error);
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
      console.log('❌ Assignment upload threw exception:', uploadException);
      uploadError = uploadException;
    }

    if (!uploadData || uploadError) {
      console.error('❌ Assignment upload failed. Error:', uploadError);
      throw uploadError || new Error('Assignment upload failed');
    }

    console.log('✅ Assignment file uploaded successfully with path:', filePath);

    // Get public URL with error handling
    const { data: urlData } = supabase.storage
      .from('homework-files')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    
    if (!publicUrl) {
      console.error('❌ Failed to generate public URL for file:', filePath);
      throw new Error('Failed to generate public URL for uploaded file');
    }

    console.log('🔗 Generated assignment public URL:', publicUrl);

    // Prepare file data for database storage
    const fileRecord = {
      name: file.name,
      size: file.size || fileData.length,
      type: contentType,
      file_url: publicUrl,
      file_path: filePath,
      uploadTime: new Date().toISOString(),
      status: 'uploaded'
    };

    console.log('💾 Assignment file record prepared:', fileRecord);

    return {
      success: true,
      fileRecord,
      filePath,
      publicUrl
    };

  } catch (error) {
    console.error('❌ Assignment file upload failed:', error);
    return {
      success: false,
      error: error.message || 'Assignment file upload failed'
    };
  }
};

/**
 * Delete an assignment file from homework-files bucket
 * @param {string} filePath - Path to the file in storage
 * @returns {Object} - Delete result
 */
export const deleteAssignmentFile = async (filePath) => {
  try {
    console.log('🗑️ Deleting assignment file:', filePath);

    const { data, error } = await supabase.storage
      .from('homework-files')
      .remove([filePath]);

    if (error) {
      console.error('❌ Assignment delete error:', error);
      throw error;
    }

    console.log('✅ Assignment file deleted successfully:', data);
    return { success: true };

  } catch (error) {
    console.error('❌ Assignment file deletion failed:', error);
    return {
      success: false,
      error: error.message || 'Assignment file deletion failed'
    };
  }
};

/**
 * Upload multiple assignment files
 * @param {Array} files - Array of file objects
 * @param {string} studentId - Student ID who is uploading
 * @param {string} assignmentId - Assignment ID the files are for
 * @param {string} assignmentType - 'assignment' or 'homework'
 * @returns {Object} - Upload results
 */
export const uploadMultipleAssignmentFiles = async (files, studentId, assignmentId, assignmentType = 'assignment') => {
  try {
    console.log('🔄 Starting multiple assignment files upload:', files.length, 'files');
    
    const uploadResults = [];
    const errors = [];

    // Upload files sequentially to avoid overwhelming the storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📤 Uploading file ${i + 1}/${files.length}:`, file.name);
      
      const result = await uploadAssignmentFile(file, studentId, assignmentId, assignmentType);

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
    console.error('❌ Multiple assignment files upload failed:', error);
    return {
      success: false,
      error: error.message || 'Multiple assignment files upload failed',
      uploadedFiles: [],
      errors: [],
      totalFiles: files.length,
      successfulUploads: 0,
      failedUploads: files.length
    };
  }
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
 * Get assignment file type based on file extension and mime type
 * @param {Object} file - File object
 * @returns {string} - File category ('image', 'document', 'video', 'audio', 'other')
 */
export const getAssignmentFileType = (file) => {
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
export const getAssignmentFileIcon = (file) => {
  const fileType = getAssignmentFileType(file);
  
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
 * Check if file type is supported for assignment uploads
 * @param {string} mimeType - File mime type
 * @returns {boolean} - Whether the file type is supported
 */
export const isSupportedFileType = (mimeType) => {
  const supportedTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed'
  ];
  
  return supportedTypes.includes(mimeType);
};
