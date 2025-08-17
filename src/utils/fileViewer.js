import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getFileIcon } from './chatFileUpload';

// Optional MediaLibrary import with fallback
let MediaLibrary = null;
try {
  MediaLibrary = require('expo-media-library');
} catch (e) {
  console.log('📱 MediaLibrary not available, will use fallback methods');
}

/**
 * Handle file viewing/downloading based on file type and platform
 * @param {Object} file - File object containing url, name, type, etc.
 * @param {string} file.file_url - URL to the file
 * @param {string} file.file_name - Name of the file
 * @param {string} file.file_type - MIME type of the file
 * @param {number} file.file_size - Size of the file in bytes
 */
export const handleFileView = async (file) => {
  try {
    console.log('📁 Opening file:', file);
    
    if (!file.file_url) {
      Alert.alert('Error', 'File URL not available');
      return;
    }

    const fileType = file.file_type || '';
    const fileName = file.file_name || 'file';
    
    // For images, show them in a native image viewer
    if (fileType.startsWith('image/')) {
      await handleImageView(file);
      return;
    }
    
    // For other files, show options
    showFileOptions(file);
    
  } catch (error) {
    console.error('Error opening file:', error);
    Alert.alert('Error', 'Failed to open file: ' + error.message);
  }
};

/**
 * Handle image viewing
 */
const handleImageView = async (file) => {
  Alert.alert(
    'View Image',
    `${file.file_name}`,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Open in Browser', 
        onPress: () => Linking.openURL(file.file_url) 
      },
      { 
        text: 'Save to Gallery', 
        onPress: () => saveImageToGallery(file) 
      }
    ]
  );
};

/**
 * Show file options for non-image files
 */
const showFileOptions = (file) => {
  const options = [
    { text: 'Cancel', style: 'cancel' }
  ];
  
  // Add view option for supported types
  if (canViewInBrowser(file.file_type)) {
    options.push({
      text: 'View',
      onPress: () => Linking.openURL(file.file_url)
    });
  }
  
  // Add download option
  options.push({
    text: 'Download',
    onPress: () => downloadFile(file)
  });
  
  // Add share option
  options.push({
    text: 'Share',
    onPress: () => shareFile(file)
  });
  
  Alert.alert(
    'File Options',
    `${file.file_name}\nSize: ${formatFileSize(file.file_size)}`,
    options
  );
};

/**
 * Check if file type can be viewed in browser
 */
const canViewInBrowser = (fileType) => {
  const browserViewableTypes = [
    'application/pdf',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  return browserViewableTypes.some(type => fileType?.includes(type));
};

/**
 * Download file to device
 */
const downloadFile = async (file) => {
  try {
    console.log('⬇️ Downloading file:', file.file_name);
    
    // Create downloads directory if it doesn't exist
    const downloadDir = FileSystem.documentDirectory + 'Downloads/';
    const dirInfo = await FileSystem.getInfoAsync(downloadDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    }
    
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const fileExtension = getFileExtension(file.file_name);
    const baseName = file.file_name.replace(/\.[^/.]+$/, ""); // Remove extension
    const localFileName = `${baseName}_${timestamp}${fileExtension}`;
    const localUri = downloadDir + localFileName;
    
    // Show progress
    Alert.alert('Downloading', 'Please wait while the file is being downloaded...');
    
    // Download the file
    const downloadResult = await FileSystem.downloadAsync(file.file_url, localUri);
    
    console.log('✅ File downloaded to:', downloadResult.uri);
    
    // Success message with options
    Alert.alert(
      'Download Complete',
      `File saved as: ${localFileName}`,
      [
        { text: 'OK' },
        { 
          text: 'Share', 
          onPress: () => shareLocalFile(downloadResult.uri) 
        }
      ]
    );
    
  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Download Failed', 'Failed to download file: ' + error.message);
  }
};

/**
 * Save image to device gallery
 */
const saveImageToGallery = async (file) => {
  try {
    // Check if MediaLibrary is available
    if (!MediaLibrary) {
      Alert.alert('Feature Not Available', 'Gallery saving is not available on this device. You can download the image instead.');
      downloadFile(file);
      return;
    }
    
    // Request permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to save images to your gallery.');
      return;
    }
    
    console.log('💾 Saving image to gallery:', file.file_name);
    
    // Download to temp location first
    const tempUri = FileSystem.documentDirectory + 'temp_' + Date.now() + getFileExtension(file.file_name);
    const downloadResult = await FileSystem.downloadAsync(file.file_url, tempUri);
    
    // Save to media library
    const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
    
    console.log('✅ Image saved to gallery');
    Alert.alert('Success', 'Image saved to gallery!');
    
    // Clean up temp file
    await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
    
  } catch (error) {
    console.error('Save to gallery error:', error);
    Alert.alert('Save Failed', 'Failed to save image: ' + error.message);
  }
};

/**
 * Share file using system share sheet
 */
const shareFile = async (file) => {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing Not Available', 'Sharing is not available on this device');
      return;
    }
    
    console.log('🔗 Sharing file:', file.file_name);
    
    // For small files, download and share locally for better experience
    if (!file.file_size || file.file_size < 10 * 1024 * 1024) { // Less than 10MB
      await shareLocalFile(file.file_url, file.file_name);
    } else {
      // For large files, just share the URL
      await Sharing.shareAsync(file.file_url, {
        mimeType: file.file_type,
        dialogTitle: `Share ${file.file_name}`,
        UTI: file.file_type
      });
    }
    
  } catch (error) {
    console.error('Share error:', error);
    Alert.alert('Share Failed', 'Failed to share file: ' + error.message);
  }
};

/**
 * Share local file
 */
const shareLocalFile = async (uri, fileName) => {
  try {
    await Sharing.shareAsync(uri, {
      dialogTitle: `Share ${fileName || 'File'}`,
    });
  } catch (error) {
    console.error('Local share error:', error);
    // Fallback to opening the file URL
    Linking.openURL(uri);
  }
};

/**
 * Get file extension from filename
 */
const getFileExtension = (filename) => {
  if (!filename) return '';
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
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
 * Get appropriate color for file type
 */
export const getFileTypeColor = (fileType) => {
  if (!fileType) return '#666';
  
  if (fileType.startsWith('image/')) return '#4CAF50';
  if (fileType.includes('pdf')) return '#f44336';
  if (fileType.includes('word') || fileType.includes('document')) return '#2196F3';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '#4CAF50';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '#FF9800';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '#9C27B0';
  if (fileType.startsWith('text/')) return '#607D8B';
  
  return '#666';
};
