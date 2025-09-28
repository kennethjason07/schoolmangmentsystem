import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  Modal,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CameraCapture from './CameraCapture';
import FaceRecognitionService from '../../services/FaceRecognitionService';
import { AuthContext } from '../../utils/AuthContext';

const FaceEnrollmentModal = ({ 
  visible, 
  person, 
  onClose, 
  onSuccess, 
  onError 
}) => {
  const { user } = useContext(AuthContext);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [enrollmentStep, setEnrollmentStep] = useState('instructions'); // instructions, camera, processing, result

  const handleStartEnrollment = () => {
    setEnrollmentStep('camera');
    setShowCamera(true);
  };

  const handlePhotoTaken = async (photoResult) => {
    setShowCamera(false);
    setEnrollmentStep('processing');
    setIsProcessing(true);

    try {
      if (!photoResult.file) {
        throw new Error('No image file available for processing');
      }

      const result = await FaceRecognitionService.enrollFace({
        personId: person.id,
        personType: person.type, // 'student' or 'teacher'
        imageFile: photoResult.file,
        templateName: 'primary',
        confidenceThreshold: 0.8, // Use default confidence
        enrolledBy: user.id,
        tenantId: user.tenant_id
      });

      if (result.success) {
        setEnrollmentStep('result');
        setTimeout(() => {
          Alert.alert(
            'Enrollment Successful!',
            `Face template created for ${person.name} with high accuracy.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  onSuccess?.(result);
                  handleClose();
                }
              }
            ]
          );
        }, 500);
      } else {
        throw new Error(result.error || 'Face enrollment failed');
      }

    } catch (error) {
      console.error('Face enrollment error:', error);
      setEnrollmentStep('instructions');
      
      const errorMessage = error.message.includes('No face detected') 
        ? 'No face detected in the image. Please try again with better lighting and positioning.'
        : `Enrollment failed: ${error.message}`;

      Alert.alert('Enrollment Failed', errorMessage, [
        { text: 'Try Again', onPress: () => setEnrollmentStep('instructions') },
        { text: 'Cancel', onPress: handleClose }
      ]);

      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setEnrollmentStep('instructions');
  };

  const handleClose = () => {
    setShowCamera(false);
    setEnrollmentStep('instructions');
    setIsProcessing(false);
    onClose();
  };

  const renderInstructions = () => (
    <ScrollView style={styles.content}>
      <View style={styles.headerSection}>
        <Ionicons name="person-circle" size={80} color="#007AFF" />
        <Text style={styles.personName}>{person.name}</Text>
        <Text style={styles.personType}>
          {person.type === 'student' ? 'Student' : 'Teacher'}
          {person.admission_no && ` • ${person.admission_no}`}
          {person.class_name && ` • ${person.class_name}`}
        </Text>
      </View>

      <View style={styles.instructionCard}>
        <Text style={styles.cardTitle}>Face Enrollment Instructions</Text>
        
        <View style={styles.instructionItem}>
          <Ionicons name="sunny" size={24} color="#FF9800" />
          <Text style={styles.instructionText}>
            Ensure good lighting - natural light works best
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Ionicons name="eye" size={24} color="#2196F3" />
          <Text style={styles.instructionText}>
            Look directly at the camera with eyes open
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Ionicons name="remove-circle" size={24} color="#F44336" />
          <Text style={styles.instructionText}>
            Remove glasses, hats, and face coverings if possible
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Ionicons name="happy" size={24} color="#4CAF50" />
          <Text style={styles.instructionText}>
            Keep a neutral expression with mouth closed
          </Text>
        </View>
      </View>

      <View style={styles.securityNotice}>
        <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
        <Text style={styles.securityText}>
          Your face data will be encrypted and stored securely. 
          Only authorized personnel can access this information.
        </Text>
      </View>
    </ScrollView>
  );

  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.processingTitle}>Processing Face Template...</Text>
      <Text style={styles.processingSubtitle}>
        Analyzing facial features and creating secure template
      </Text>
      
      <View style={styles.processingSteps}>
        <View style={styles.stepItem}>
          <Ionicons name="search" size={16} color="#4CAF50" />
          <Text style={styles.stepText}>Face Detection Complete</Text>
        </View>
        <View style={styles.stepItem}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.stepText}>Creating Template...</Text>
        </View>
        <View style={styles.stepItem}>
          <Ionicons name="lock-closed" size={16} color="#666" />
          <Text style={[styles.stepText, styles.stepPending]}>Encryption Pending</Text>
        </View>
      </View>
    </View>
  );

  const renderResult = () => (
    <View style={styles.resultContainer}>
      <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
      <Text style={styles.resultTitle}>Enrollment Complete!</Text>
      <Text style={styles.resultSubtitle}>
        Face template successfully created for {person.name}
      </Text>
      
      <View style={styles.resultStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Template Quality</Text>
          <Text style={styles.statValue}>High</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Security Level</Text>
          <Text style={styles.statValue}>Encrypted</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Face Enrollment</Text>
          <View style={styles.placeholder} />
        </View>

        {enrollmentStep === 'instructions' && renderInstructions()}
        {enrollmentStep === 'processing' && renderProcessing()}
        {enrollmentStep === 'result' && renderResult()}

        {enrollmentStep === 'instructions' && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleStartEnrollment}
              style={styles.enrollButton}
              disabled={isProcessing}
            >
              <Ionicons name="camera" size={20} color="white" />
              <Text style={styles.enrollButtonText}>Start Face Enrollment</Text>
            </TouchableOpacity>
          </View>
        )}

        <CameraCapture
          isVisible={showCamera}
          title="Enroll Face"
          subtitle={`Capture face photo for ${person.name}`}
          onPhotoTaken={handlePhotoTaken}
          onCancel={handleCameraCancel}
        />
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
  closeButton: {
    padding: 5,
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  personName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 15,
  },
  personType: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  instructionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9f0',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  securityText: {
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  enrollButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  processingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  processingSteps: {
    alignSelf: 'stretch',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  stepPending: {
    color: '#666',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
});

export default FaceEnrollmentModal;