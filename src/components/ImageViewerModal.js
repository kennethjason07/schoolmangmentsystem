import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ImageViewerModal = ({ 
  visible, 
  imageUrl, 
  imageName = 'Image', 
  onClose 
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(false);
    }
  }, [visible, imageUrl]);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = (errorEvent) => {
    setLoading(false);
    setError(true);
    console.error('Image load error:', errorEvent);
  };

  const handleClose = () => {
    setLoading(true);
    setError(false);
    onClose();
  };

  const showErrorAlert = () => {
    Alert.alert(
      'Image Error',
      'Unable to load this image. The file may be corrupted or no longer available.',
      [{ text: 'OK', onPress: handleClose }]
    );
  };

  React.useEffect(() => {
    if (error) {
      showErrorAlert();
    }
  }, [error]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      {/* Status bar overlay for Android */}
      {Platform.OS === 'android' && (
        <StatusBar backgroundColor="rgba(0,0,0,0.9)" barStyle="light-content" />
      )}
      
      <View style={styles.overlay}>
        {/* Header with filename and close button */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.fileName} numberOfLines={1}>
              {imageName}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Image container */}
        <View style={styles.imageContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading image...</Text>
            </View>
          )}

          {!error && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="image-outline" size={64} color="#666" />
              <Text style={styles.errorText}>Failed to load image</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => {
                setError(false);
                setLoading(true);
              }}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footer with image info */}
        <View style={styles.footer}>
          <Text style={styles.imageInfo}>
            Tap and hold to save image (if supported by your device)
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  titleContainer: {
    flex: 1,
    marginRight: 15,
  },
  fileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  image: {
    width: width - 20,
    height: height * 0.7,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 15,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#666',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  imageInfo: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default ImageViewerModal;
