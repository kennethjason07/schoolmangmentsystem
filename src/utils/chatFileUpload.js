import { supabase } from './supabase';

/**
 * Utility functions for handling chat file uploads to Supabase Storage
 */

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
    
    // Create file path: {messageId}/{senderId}_{timestamp}_{filename}
    const filePath = `${messageId}/${senderId}_${timestamp}_${cleanFileName}`;
    
    console.log('📁 Generated file path:', filePath);

    // Convert URI to blob for upload
    let fileBlob;
    if (file.uri) {
      console.log('🔄 Fetching file from URI:', file.uri);
      const response = await fetch(file.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      fileBlob = await response.blob();
    } else {
      throw new Error('No file URI provided');
    }

    console.log('📦 File blob created, size:', fileBlob.size, 'type:', fileBlob.type);

    // Try multiple upload approaches for better compatibility
    let uploadData = null;
    let uploadError = null;
    
    // Method 1: Standard upload with detailed options
    console.log('🚀 Attempting Method 1: Standard upload...');
    try {
      const result1 = await supabase.storage
        .from('chat-files')
        .upload(filePath, fileBlob, {
          contentType: file.mimeType || file.type || fileBlob.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false
        });
      
      if (!result1.error) {
        uploadData = result1.data;
        console.log('✅ Method 1 succeeded:', uploadData);
      } else {
        console.log('❌ Method 1 failed:', result1.error);
        uploadError = result1.error;
      }
    } catch (method1Error) {
      console.log('❌ Method 1 threw exception:', method1Error);
      uploadError = method1Error;
    }
    
    // Method 2: Simplified upload if Method 1 failed
    if (!uploadData && uploadError) {
      console.log('🚀 Attempting Method 2: Simplified upload...');
      try {
        const result2 = await supabase.storage
          .from('chat-files')
          .upload(filePath, fileBlob);
        
        if (!result2.error) {
          uploadData = result2.data;
          console.log('✅ Method 2 succeeded:', uploadData);
          uploadError = null; // Clear the error
        } else {
          console.log('❌ Method 2 also failed:', result2.error);
          uploadError = result2.error;
        }
      } catch (method2Error) {
        console.log('❌ Method 2 threw exception:', method2Error);
        uploadError = method2Error;
      }
    }
    
    // Method 3: Different path structure if both methods failed
    if (!uploadData && uploadError) {
      console.log('🚀 Attempting Method 3: Alternative path structure...');
      const altFilePath = `uploads/${senderId}/${timestamp}_${cleanFileName}`;
      console.log('📁 Alternative file path:', altFilePath);
      
      try {
        const result3 = await supabase.storage
          .from('chat-files')
          .upload(altFilePath, fileBlob, {
            contentType: file.mimeType || file.type || 'application/octet-stream'
          });
        
        if (!result3.error) {
          uploadData = result3.data;
          filePath = altFilePath; // Update the file path for URL generation
          console.log('✅ Method 3 succeeded:', uploadData);
          uploadError = null;
        } else {
          console.log('❌ Method 3 also failed:', result3.error);
          uploadError = result3.error;
        }
      } catch (method3Error) {
        console.log('❌ Method 3 threw exception:', method3Error);
        uploadError = method3Error;
      }
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
      file_size: file.size || fileBlob.size,
      file_type: file.mimeType || file.type || 'application/octet-stream'
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
