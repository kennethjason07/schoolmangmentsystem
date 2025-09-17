import React, { useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, Platform, Dimensions, Animated, PanResponder, Modal, StatusBar, Share } from 'react-native';
// Use legacy API to avoid deprecation warnings
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { showImageSaveOptions } from '../utils/windowsImageSaver';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ImageViewer = ({ visible, imageData, onClose }) => {
  // Extract data from imageData prop
  const imageUrl = imageData?.file_url;
  const imageName = imageData?.file_name || 'image.jpg';
  const fileSize = imageData?.file_size;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Animation values for zoom, pan, and rotation
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  // Pan responder for handling gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Toggle controls on single tap
        setShowControls(!showControls);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Handle pan gestures
        translateX.setValue(gestureState.dx);
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Animate back to center if not dragged too far
        if (Math.abs(gestureState.dx) < 50 && Math.abs(gestureState.dy) < 50) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle image download
  const handleDownload = async () => {
    try {
      setLoading(true);
      console.log('⬇️ Starting download process...');
      console.log('🔗 Image URL:', imageUrl);
      console.log('📄 Image Name:', imageName);
      
      // Check if we have the new API or need to use legacy
      const hasLegacyAPI = FileSystem.getInfoAsync && typeof FileSystem.getInfoAsync === 'function';
      
      // Create downloads directory
      const downloadDir = FileSystem.documentDirectory + 'Downloads/';
      console.log('📁 Download directory:', downloadDir);
      
      let dirInfo;
      if (hasLegacyAPI) {
        dirInfo = await FileSystem.getInfoAsync(downloadDir);
      } else {
        // Use the new API approach if available
        try {
          dirInfo = await FileSystem.getInfoAsync(downloadDir);
        } catch (fallbackError) {
          // Fallback to legacy if new API fails
          dirInfo = await FileSystem.getInfoAsync(downloadDir);
        }
      }
      console.log('📁 Directory info:', dirInfo);
      
      if (!dirInfo.exists) {
        console.log('📁 Creating downloads directory...');
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }
      
      // Generate unique filename
      const timestamp = Date.now();
      const extension = imageName.split('.').pop() || 'jpg';
      const fileName = `${imageName.replace(/\.[^/.]+$/, '')}_${timestamp}.${extension}`;
      const localUri = downloadDir + fileName;
      console.log('📝 Generated filename:', fileName);
      console.log('📍 Local URI:', localUri);
      
      // Download the image
      console.log('⬇️ Starting download from:', imageUrl);
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
      console.log('✅ Download result:', downloadResult);
      
      // Verify the file was downloaded
      let fileInfo;
      if (hasLegacyAPI) {
        fileInfo = await FileSystem.getInfoAsync(localUri);
      } else {
        // Use the new API approach if available
        try {
          fileInfo = await FileSystem.getInfoAsync(localUri);
        } catch (fallbackError) {
          // Fallback to legacy if new API fails
          fileInfo = await FileSystem.getInfoAsync(localUri);
        }
      }
      console.log('📄 Downloaded file info:', fileInfo);
      
      if (fileInfo.exists) {
        console.log('✅ File successfully downloaded!');
        Alert.alert(
          'Download Complete',
          `Image saved successfully!

File: ${fileName}
Size: ${fileInfo.size ? formatFileSize(fileInfo.size) : 'Unknown'}
Location: ${localUri}`,
          [
            { text: 'OK' },
            {
              text: 'Share',
              onPress: () => handleShare(downloadResult.uri)
            }
          ]
        );
      } else {
        throw new Error('File was not created after download');
      }
    } catch (error) {
      console.error('💥 Download error:', error);
      console.error('💥 Error details:', {
        message: error.message,
        stack: error.stack,
        imageUrl,
        imageName
      });
      Alert.alert(
        'Download Failed', 
        `Failed to download image: ${error.message}\n\nImage: ${imageName}\nURL: ${imageUrl}`,
        [
          { text: 'OK' },
          {
            text: 'Retry',
            onPress: handleDownload
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle save to gallery with Windows compatibility
  const handleSaveToGallery = async () => {
    try {
      setLoading(true);
      
      // Use the new Windows-compatible image saver
      await showImageSaveOptions({
        file_url: imageUrl,
        file_name: imageName,
        file_size: fileSize
      });
      
    } catch (error) {
      console.error('Save to gallery error:', error);
      Alert.alert('Save Failed', 'Failed to save image: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle share
  const handleShare = async (customUri = null) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device');
        return;
      }

      setLoading(true);
      
      let shareUri = customUri;
      
      // If no custom URI provided, download the image to temp location first
      if (!shareUri) {
        const tempUri = FileSystem.documentDirectory + 'temp_share_' + Date.now() + '.jpg';
        const downloadResult = await FileSystem.downloadAsync(imageUrl, tempUri);
        shareUri = downloadResult.uri;
      }

      // Always try Expo Sharing first - it's the most reliable for actual file sharing
      try {
        console.log('📤 Trying Expo Sharing with:', shareUri);
        await Sharing.shareAsync(shareUri, {
          mimeType: 'image/jpeg',
          dialogTitle: `Share ${imageName}`,
          UTI: 'public.jpeg'
        });
        console.log('✅ Expo Sharing successful');
      } catch (shareError) {
        console.log('❌ Expo Sharing failed:', shareError.message);
        console.log('🔄 Trying alternative sharing methods...');
        
        // If Expo sharing fails, it's usually because the file path or permissions are wrong
        // Let's try a different approach - copy to a more accessible location first
        try {
          // Copy to a more standard temp location
          const timestamp = Date.now();
          const extension = imageName.split('.').pop() || 'jpg';
          const tempFileName = `shared_image_${timestamp}.${extension}`;
          const tempPath = FileSystem.cacheDirectory + tempFileName;
          
          console.log('📁 Copying file to cache directory:', tempPath);
          await FileSystem.copyAsync({
            from: shareUri,
            to: tempPath
          });
          
          // Verify the copied file exists
          const fileInfo = await FileSystem.getInfoAsync(tempPath);
          console.log('📄 Copied file info:', fileInfo);
          
          if (fileInfo.exists) {
            // Try Expo sharing again with the cached file
            try {
              console.log('📤 Retrying Expo Sharing with cached file:', tempPath);
              await Sharing.shareAsync(tempPath, {
                mimeType: 'image/jpeg',
                dialogTitle: `Share ${imageName}`,
                UTI: 'public.jpeg'
              });
              console.log('✅ Expo Sharing with cached file successful');
              
              // Clean up the cached copy
              await FileSystem.deleteAsync(tempPath, { idempotent: true });
            } catch (cachedShareError) {
              console.log('❌ Cached file sharing also failed:', cachedShareError.message);
              
              // Clean up the cached copy before trying other methods
              await FileSystem.deleteAsync(tempPath, { idempotent: true });
              
              // Final fallback: try to save to MediaLibrary first, then share
              if (MediaLibrary) {
                try {
                  console.log('📱 Trying MediaLibrary approach...');
                  const { status } = await MediaLibrary.requestPermissionsAsync();
                  if (status === 'granted') {
                    const asset = await MediaLibrary.createAssetAsync(shareUri);
                    console.log('📸 Asset created:', asset.uri);
                    
                    // Now try to share the media library asset
                    await Sharing.shareAsync(asset.uri, {
                      mimeType: 'image/jpeg',
                      dialogTitle: `Share ${imageName}`
                    });
                    console.log('✅ MediaLibrary sharing successful');
                  } else {
                    throw new Error('MediaLibrary permission denied');
                  }
                } catch (mediaError) {
                  console.log('❌ MediaLibrary approach failed:', mediaError.message);
                  
                  // Absolute last resort: share the original URL
                  console.log('🆘 Using URL sharing as last resort');
                  await Share.share({
                    message: `Check out this image: ${imageName}\n\nView at: ${imageUrl}`,
                    title: `Share ${imageName}`
                  });
                }
              } else {
                // No MediaLibrary, just share URL
                console.log('🆘 Using URL sharing as last resort');
                await Share.share({
                  message: `Check out this image: ${imageName}\n\nView at: ${imageUrl}`,
                  title: `Share ${imageName}`
                });
              }
            }
          } else {
            throw new Error('Failed to copy file to cache directory');
          }
        } catch (copyError) {
          console.log('❌ File copy failed:', copyError.message);
          
          // Ultimate fallback: share URL only
          console.log('🆘 Using URL sharing as ultimate fallback');
          await Share.share({
            message: `Check out this image: ${imageName}\n\nView at: ${imageUrl}`,
            title: `Share ${imageName}`
          });
        }
      }

      // Clean up temp file if we created one
      if (!customUri && shareUri && shareUri.includes('temp_share_')) {
        try {
          await FileSystem.deleteAsync(shareUri, { idempotent: true });
          console.log('🧹 Cleaned up temp file');
        } catch (deleteError) {
          console.log('⚠️ Failed to delete temp file:', deleteError);
        }
      }
    } catch (error) {
      console.error('💥 Share error:', error);
      Alert.alert('Share Failed', 'Failed to share image: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle zoom in
  const handleZoomIn = () => {
    Animated.spring(scale, {
      toValue: 2,
      useNativeDriver: true,
    }).start();
  };

  // Handle zoom out
  const handleZoomOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    // Also center the image
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  // Handle rotation
  const handleRotate = () => {
    rotation.setValue(rotation._value + 90);
    Animated.spring(rotation, {
      toValue: rotation._value,
      useNativeDriver: true,
    }).start();
  };

  // Reset image position, zoom, and rotation
  const resetImage = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      Animated.spring(rotation, { toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  // Early return if no valid image data or not visible
  if (!visible || !imageData || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        {/* Image Container */}
        <View style={styles.imageContainer} {...panResponder.panHandlers}>
          <Animated.Image
            source={{ uri: imageUrl }}
            style={[
              styles.image,
              {
                transform: [
                  { scale },
                  { translateX },
                  { translateY },
                  { rotate: rotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg']
                  }) },
                ],
              },
            ]}
            resizeMode="contain"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
          
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
          
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#fff" />
              <Text style={styles.errorText}>Failed to load image</Text>
            </View>
          )}
        </View>

        {/* Top Controls */}
        {showControls && (
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.imageInfo}>
              <Text style={styles.imageName} numberOfLines={1}>
                {imageName}
              </Text>
              {fileSize && (
                <Text style={styles.fileSize}>
                  {formatFileSize(fileSize)}
                </Text>
              )}
            </View>
            
            <TouchableOpacity style={styles.controlButton} onPress={() => {
              const currentRotation = Math.round(rotation._value % 360);
              const dimensions = `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`;
              const fileInfo = [
                `📁 Name: ${imageName}`,
                fileSize ? `📏 Size: ${formatFileSize(fileSize)}` : '',
                `📱 Screen: ${dimensions}`,
                `🔄 Rotation: ${currentRotation}°`,
                `🔍 Zoom: ${Math.round(scale._value * 100)}%`,
                `📍 Position: X:${Math.round(translateX._value)}, Y:${Math.round(translateY._value)}`,
              ].filter(Boolean).join('\n\n');
              
              Alert.alert(
                'Image Information',
                fileInfo,
                [{ text: 'OK' }]
              );
            }}>
              <Ionicons name="information-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Controls */}
        {showControls && (
          <View style={styles.bottomControls}>
            {/* Zoom and Rotation Controls */}
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.controlButton} onPress={handleZoomOut}>
                <Ionicons name="remove" size={20} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={handleRotate}>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={resetImage}>
                <Ionicons name="reload" size={20} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={handleZoomIn}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Action Controls */}
            <View style={styles.actionControls}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => handleShare()}
                disabled={loading}
              >
                <Ionicons name="share" size={20} color="#fff" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleDownload}
                disabled={loading}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.actionText}>Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleSaveToGallery}
                disabled={loading}
              >
                <Ionicons name="image" size={20} color="#fff" />
                <Text style={styles.actionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  imageInfo: {
    flex: 1,
    marginHorizontal: 15,
  },
  imageName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    color: '#ccc',
    fontSize: 12,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  actionControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 5,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 60,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ImageViewer;
