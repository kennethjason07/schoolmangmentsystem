import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const CameraCapture = ({ 
  onPhotoTaken, 
  onCancel, 
  isVisible, 
  title = "Capture Face Photo",
  subtitle = "Position face clearly in good lighting" 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  const requestCameraPermissions = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permission to use facial recognition.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    try {
      setIsProcessing(true);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for faces
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCapturedImage(asset);
        
        // Create React Native compatible file object
        const imageFile = {
          uri: asset.uri,
          type: 'image/jpeg',
          size: asset.fileSize || null,
          name: 'face-photo.jpg'
        };
        
        onPhotoTaken({ ...asset, file: imageFile });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      setIsProcessing(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCapturedImage(asset);
        
        // Create React Native compatible file object
        const imageFile = {
          uri: asset.uri,
          type: 'image/jpeg',
          size: asset.fileSize || null,
          name: 'face-photo.jpg'
        };
        
        onPhotoTaken({ ...asset, file: imageFile });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const handleCancel = () => {
    setCapturedImage(null);
    onCancel();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        {capturedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedImage.uri }} style={styles.previewImage} />
            <Text style={styles.subtitle}>Photo captured successfully!</Text>
            
            <View style={styles.previewActions}>
              <TouchableOpacity 
                onPress={retakePhoto} 
                style={[styles.actionButton, styles.retakeButton]}
                disabled={isProcessing}
              >
                <Ionicons name="camera" size={20} color="#007AFF" />
                <Text style={[styles.buttonText, styles.retakeText]}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleCancel}
                style={[styles.actionButton, styles.confirmButton]}
                disabled={isProcessing}
              >
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={[styles.buttonText, styles.confirmText]}>
                  {isProcessing ? 'Processing...' : 'Use Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.captureContainer}>
            <View style={styles.instructionContainer}>
              <Ionicons name="face-recognition" size={80} color="#007AFF" />
              <Text style={styles.subtitle}>{subtitle}</Text>
              <Text style={styles.instructions}>
                • Face should be clearly visible{'\n'}
                • Ensure good lighting{'\n'}
                • Look directly at camera{'\n'}
                • Remove glasses if possible
              </Text>
            </View>

            <View style={styles.captureActions}>
              <TouchableOpacity 
                onPress={pickFromGallery} 
                style={[styles.actionButton, styles.galleryButton]}
                disabled={isProcessing}
              >
                <Ionicons name="image" size={20} color="#666" />
                <Text style={[styles.buttonText, styles.galleryText]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={takePhoto} 
                style={[styles.actionButton, styles.cameraButton]}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="camera" size={24} color="white" />
                    <Text style={[styles.buttonText, styles.cameraText]}>Take Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cancelButton: {
    padding: 5,
  },
  placeholder: {
    width: 34,
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  captureContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  instructionContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    textAlign: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  captureActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 120,
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#007AFF',
  },
  galleryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  retakeButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cameraText: {
    color: 'white',
  },
  galleryText: {
    color: '#666',
  },
  retakeText: {
    color: '#007AFF',
  },
  confirmText: {
    color: 'white',
  },
});

export default CameraCapture;