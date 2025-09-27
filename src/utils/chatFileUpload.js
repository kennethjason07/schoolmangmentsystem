import { supabase } from './supabase';
import { File } from 'expo-file-system';
import { decode as atob } from 'base-64';

/**
 * Utility functions for handling chat file uploads to Supabase Storage
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
    console.log('🔄 Using new Expo FileSystem v54 File class for chat');
    
    // Create File instance from URI
    const file = new File(uri);
    
    // Check if file exists
    if (!file.exists) {
      throw new Error(`Chat file does not exist at URI: ${uri}`);
    }
    
    // Use the new base64() method from File class
    const base64String = await file.base64();
    
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('Invalid base64 data received from File.base64()');
    }
    
    console.log('✅ Successfully read chat file using File.base64() method');
    return base64String;
    
  } catch (error) {
    console.error('❌ Error reading chat file with new FileSystem API:', error.message);
    throw new Error(`Failed to read chat file using new FileSystem API: ${error.message}`);
  }
};

/**
 * Upload a file to the chat-files bucket
 * @param {Object} file - File object from DocumentPicker or ImagePicker
 * @param {string} senderId - User ID of the sender
 * @param {string} receiverId - User ID of the receiver
 * @param {string} studentId - Student ID (for parent-teacher context)
 * @returns {Object} - Upload result with file data or error
 */
export const uploadChatFile = async (file, senderId, receiverId, studentId = null) => {
  try {
    console.log('🔄 Starting chat file upload:', { 
      fileName: file.name, 
      fileSize: file.size,
      senderId,
      receiverId,
      studentId 
    });

    // Generate unique message ID for file organization
    const messageId = generateMessageId();
    const timestamp = Date.now();
    
    // Clean filename to prevent issues
    const cleanFileName = sanitizeFileName(file.name);
    
    // Create file path using profiles bucket structure: {senderId}/{timestamp}_{filename}
    // This matches the profiles bucket policy that expects (storage.foldername(name))[1] = auth.uid()::text
    const filePath = `${senderId}/${timestamp}_${cleanFileName}`;
    
    console.log('📁 Generated file path:', filePath);

    // Convert URI to Uint8Array for upload using Expo FileSystem (React Native compatible)
    let fileData;
    let contentType;
    if (file.uri) {
      console.log('🔄 Reading file via FileSystem:', file.uri);
      
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
        
        console.log('📦 Chat file data created via FileSystem, size:', fileData.length, 'type:', contentType);
      } catch (readError) {
        console.error('❌ Error reading chat file:', readError);
        throw new Error(`Failed to read chat file: ${readError.message}`);
      }
    } else {
      throw new Error('No file URI provided');
    }

    // Upload using Uint8Array (React Native compatible)
    let uploadData = null;
    let uploadError = null;
    
    console.log('🚀 Uploading file using Uint8Array (React Native compatible)...');
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(filePath, fileData, {
          contentType: contentType,
          cacheControl: '3600',
          upsert: true // Allow replacing existing files
        });
      
      if (!error) {
        uploadData = data;
        console.log('✅ Upload succeeded:', uploadData);
      } else {
        console.log('❌ Upload failed:', error);
        uploadError = error;
      }
    } catch (uploadException) {
      console.log('❌ Upload threw exception:', uploadException);
      uploadError = uploadException;
    }

    if (!uploadData || uploadError) {
      console.error('❌ All upload methods failed. Last error:', uploadError);
      throw uploadError || new Error('All upload methods failed');
    }

    console.log('✅ File uploaded successfully with path:', filePath);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath);

    console.log('🔗 Generated public URL:', publicUrl);

    // Prepare message data for database
    const messageData = {
      sender_id: senderId,
      receiver_id: receiverId,
      student_id: studentId,
      message: getFileTypeMessage(file),
      message_type: getMessageType(file),
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size || fileData.length,
      file_type: contentType
    };

    console.log('💾 Message data prepared:', messageData);

    return {
      success: true,
      messageData,
      filePath,
      publicUrl
    };

  } catch (error) {
    console.error('❌ Chat file upload failed:', error);
    return {
      success: false,
      error: error.message || 'File upload failed'
    };
  }
};

/**
 * Delete a file from chat-files bucket
 * @param {string} filePath - Path to the file in storage
 * @returns {Object} - Delete result
 */
export const deleteChatFile = async (filePath) => {
  try {
    console.log('🗑️ Deleting chat file:', filePath);

    const { data, error } = await supabase.storage
      .from('chat-files')
      .remove([filePath]);

    if (error) {
      console.error('❌ Delete error:', error);
      throw error;
    }

    console.log('✅ File deleted successfully:', data);
    return { success: true };

  } catch (error) {
    console.error('❌ Chat file deletion failed:', error);
    return {
      success: false,
      error: error.message || 'File deletion failed'
    };
  }
};

/**
 * Generate a unique message ID
 * @returns {string} - Unique message ID
 */
const generateMessageId = () => {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Sanitize filename to prevent issues
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFileName = (filename) => {
  // Remove special characters and replace spaces with underscores
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100); // Limit length
};

/**
 * Get message type based on file type
 * @param {Object} file - File object
 * @returns {string} - Message type ('image', 'file')
 */
const getMessageType = (file) => {
  const mimeType = file.mimeType || file.type || '';
  
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  return 'file';
};

/**
 * Get display message for file type
 * @param {Object} file - File object
 * @returns {string} - Display message
 */
const getFileTypeMessage = (file) => {
  const messageType = getMessageType(file);
  
  if (messageType === 'image') {
    return '📷 Photo';
  }
  
  return `📎 ${file.name}`;
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get file icon based on file type
 * @param {string} fileType - MIME type of the file
 * @returns {string} - Ionicons icon name
 */
export const getFileIcon = (fileType) => {
  if (!fileType) return 'document';
  
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.includes('pdf')) return 'document-text';
  if (fileType.includes('word') || fileType.includes('document')) return 'document-text';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'grid';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'easel';
  if (fileType.includes('zip') || fileType.includes('compressed')) return 'archive';
  if (fileType.startsWith('text/')) return 'document-text';
  
  return 'document';
};

/**
 * Check if file type is supported
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} - Whether file type is supported
 */
export const isSupportedFileType = (fileType) => {
  const supportedTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed'
  ];
  
  return supportedTypes.includes(fileType);
};
