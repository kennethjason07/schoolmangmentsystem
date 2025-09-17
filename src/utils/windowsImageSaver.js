/**
 * Windows-compatible image saving utility
 * Handles platform-specific image saving and file management
 */
import { Alert, Platform, Linking } from 'react-native';

// Optional imports with proper fallbacks for web compatibility
let FileSystem = null;
let Sharing = null;
let MediaLibrary = null;

try {
  // Use legacy API to avoid deprecation warnings
  FileSystem = require('expo-file-system/legacy');
} catch (e) {
  console.log('📱 expo-file-system not available on this platform (likely web)');
}

try {
  Sharing = require('expo-sharing');
} catch (e) {
  console.log('📱 expo-sharing not available on this platform');
}

try {
  MediaLibrary = require('expo-media-library');
} catch (e) {
  console.log('📱 MediaLibrary not available on this platform');
}

/**
 * Enhanced Windows-compatible image saver
 */
export class WindowsImageSaver {
  constructor() {
    this.isWindows = Platform.OS === 'windows' || Platform.OS === 'web';
    this.downloadDirectory = null;
    this.initializeDirectory();
  }

  /**
   * Initialize the download directory
   */
  async initializeDirectory() {
    try {
      // Check if FileSystem is available (not available on web)
      if (!FileSystem || Platform.OS === 'web') {
        console.log('🌐 FileSystem not available on web platform, skipping directory initialization');
        this.downloadDirectory = null; // Set to null for web
        return;
      }

      // Only proceed if we have FileSystem and not on web
      if (FileSystem && FileSystem.getInfoAsync) {
        // Use different paths based on platform
        if (this.isWindows) {
          // Windows-specific directory structure
          this.downloadDirectory = FileSystem.documentDirectory + 'SchoolApp_Images/';
        } else {
          // Mobile platforms
          this.downloadDirectory = FileSystem.documentDirectory + 'Downloads/';
        }

        const dirInfo = await FileSystem.getInfoAsync(this.downloadDirectory);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(this.downloadDirectory, { intermediates: true });
          console.log('📁 Created directory:', this.downloadDirectory);
        }
      }
    } catch (error) {
      console.warn('Failed to initialize directory:', error.message);
      // Fallback to document directory if available
      if (FileSystem && FileSystem.documentDirectory) {
        this.downloadDirectory = FileSystem.documentDirectory;
      } else {
        this.downloadDirectory = null;
      }
    }
  }

  /**
   * Save image with Windows-compatible approach
   * @param {Object} imageData - Image data with url, name, etc.
   * @returns {Promise<string>} - Path to saved file
   */
  async saveImage(imageData) {
    const { file_url: imageUrl, file_name: imageName } = imageData;

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    console.log('💾 Starting Windows-compatible image save:', { imageUrl, imageName });

    try {
      // Ensure directory exists
      await this.initializeDirectory();

      // Generate safe filename
      const timestamp = Date.now();
      const sanitizedName = this.sanitizeFileName(imageName || 'image.jpg');
      const extension = this.getFileExtension(sanitizedName);
      const baseName = sanitizedName.replace(/\.[^/.]+$/, '');
      const fileName = `${baseName}_${timestamp}${extension}`;
      const localPath = this.downloadDirectory + fileName;

      console.log('📍 Saving to:', localPath);

      // Download the image
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localPath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }

      // Verify file was created
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('File was not created after download');
      }

      console.log('✅ Image saved successfully:', {
        path: localPath,
        size: fileInfo.size,
        fileName
      });

      return {
        success: true,
        path: localPath,
        fileName,
        size: fileInfo.size,
        uri: downloadResult.uri
      };

    } catch (error) {
      console.error('💥 Save image error:', error);
      throw error;
    }
  }

  /**
   * Save to gallery with Windows compatibility
   * @param {Object} imageData - Image data
   * @returns {Promise<Object>} - Save result
   */
  async saveToGallery(imageData) {
    try {
      // Check if MediaLibrary is available (mainly for mobile)
      if (!this.isWindows && MediaLibrary) {
        return await this.saveToMobileGallery(imageData);
      } else {
        // Windows fallback - save to local directory and show options
        return await this.saveToWindowsLocation(imageData);
      }
    } catch (error) {
      console.error('Gallery save error:', error);
      throw error;
    }
  }

  /**
   * Save to mobile gallery (Android/iOS)
   * @param {Object} imageData - Image data
   */
  async saveToMobileGallery(imageData) {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Gallery permission not granted');
      }

      // Download to temp location
      const tempPath = FileSystem.documentDirectory + 'temp_' + Date.now() + '.jpg';
      const downloadResult = await FileSystem.downloadAsync(imageData.file_url, tempPath);

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

      // Clean up temp file
      await FileSystem.deleteAsync(tempPath, { idempotent: true });

      return {
        success: true,
        message: 'Image saved to gallery successfully!',
        asset
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Save to Windows-compatible location
   * @param {Object} imageData - Image data
   */
  async saveToWindowsLocation(imageData) {
    try {
      const result = await this.saveImage(imageData);

      return {
        success: true,
        message: 'Image saved successfully!',
        path: result.path,
        fileName: result.fileName,
        showFileManagerOption: true
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Open file manager to show saved file
   * @param {string} filePath - Path to the file
   */
  async openFileManager(filePath) {
    try {
      console.log('📂 Attempting to open file manager for:', filePath);

      if (this.isWindows) {
        // Windows-specific file manager opening
        await this.openWindowsExplorer(filePath);
      } else {
        // Mobile fallback - use sharing
        await this.shareFile(filePath);
      }

    } catch (error) {
      console.error('Failed to open file manager:', error);
      // Fallback to sharing
      await this.shareFile(filePath);
    }
  }

  /**
   * Open Windows Explorer to show file
   * @param {string} filePath - Path to the file
   */
  async openWindowsExplorer(filePath) {
    try {
      // Try different Windows approaches
      const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
      
      // Method 1: Try opening the containing folder
      const folderUri = `file:///${folderPath.replace(/\\/g, '/')}`;
      console.log('🔗 Trying to open folder:', folderUri);
      
      const canOpen = await Linking.canOpenURL(folderUri);
      if (canOpen) {
        await Linking.openURL(folderUri);
        return;
      }

      // Method 2: Try opening the file directly
      const fileUri = `file:///${filePath.replace(/\\/g, '/')}`;
      console.log('🔗 Trying to open file:', fileUri);
      
      const canOpenFile = await Linking.canOpenURL(fileUri);
      if (canOpenFile) {
        await Linking.openURL(fileUri);
        return;
      }

      throw new Error('Cannot open file manager');

    } catch (error) {
      console.error('Windows Explorer open failed:', error);
      throw error;
    }
  }

  /**
   * Share file using system share sheet
   * @param {string} filePath - Path to the file to share
   */
  async shareFile(filePath) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing not available');
      }

      await Sharing.shareAsync(filePath, {
        dialogTitle: 'Share Image'
      });

    } catch (error) {
      console.error('Share file error:', error);
      throw error;
    }
  }

  /**
   * Show comprehensive save options
   * @param {Object} imageData - Image data
   */
  async showSaveOptions(imageData) {
    return new Promise((resolve) => {
      // Check if we're on web where file system operations aren't available
      if (!FileSystem) {
        // On web, just provide a link to download the image
        Alert.alert(
          'Download Image',
          'On web, you can right-click the image and select "Save image as..." or click the link below to download.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            {
              text: 'Open Image',
              onPress: () => {
                Linking.openURL(imageData.file_url);
                resolve({ success: true, method: 'web_download' });
              }
            }
          ]
        );
        return;
      }

      const options = [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) }
      ];

      if (!this.isWindows && MediaLibrary) {
        options.push({
          text: 'Save to Gallery',
          onPress: async () => {
            try {
              const result = await this.saveToGallery(imageData);
              Alert.alert('Success', result.message);
              resolve(result);
            } catch (error) {
              Alert.alert('Error', `Failed to save to gallery: ${error.message}`);
              resolve({ success: false, error });
            }
          }
        });
      }

      options.push({
        text: 'Save to Files',
        onPress: async () => {
          try {
            const result = await this.saveImage(imageData);
            
            Alert.alert(
              'Image Saved',
              `Image saved as: ${result.fileName}\n\nLocation: ${result.path}`,
              [
                { text: 'OK' },
                {
                  text: 'Open Folder',
                  onPress: async () => {
                    try {
                      await this.openFileManager(result.path);
                    } catch (error) {
                      Alert.alert('Info', 'Could not open file manager. You can find the image in your downloads folder.');
                    }
                  }
                },
                {
                  text: 'Share',
                  onPress: async () => {
                    try {
                      await this.shareFile(result.path);
                    } catch (error) {
                      Alert.alert('Error', 'Could not share the file.');
                    }
                  }
                }
              ]
            );
            resolve(result);

          } catch (error) {
            Alert.alert('Error', `Failed to save image: ${error.message}`);
            resolve({ success: false, error });
          }
        }
      });

      Alert.alert('Save Image', 'Choose where to save the image:', options);
    });
  }

  /**
   * Sanitize filename for Windows compatibility
   * @param {string} filename - Original filename
   * @returns {string} - Sanitized filename
   */
  sanitizeFileName(filename) {
    if (!filename) return 'image.jpg';
    
    // Remove or replace Windows-invalid characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .substring(0, 100); // Limit length
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename
   * @returns {string} - File extension including dot
   */
  getFileExtension(filename) {
    if (!filename) return '.jpg';
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '.jpg';
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size string
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const windowsImageSaver = new WindowsImageSaver();

// Export convenient functions
export const saveImageToDevice = async (imageData) => {
  return await windowsImageSaver.saveImage(imageData);
};

export const saveImageToGallery = async (imageData) => {
  return await windowsImageSaver.saveToGallery(imageData);
};

export const showImageSaveOptions = async (imageData) => {
  return await windowsImageSaver.showSaveOptions(imageData);
};

export const openFileManager = async (filePath) => {
  return await windowsImageSaver.openFileManager(filePath);
};

export default WindowsImageSaver;
