import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CameraCapture from './CameraCapture';
import FaceRecognitionService from '../../services/FaceRecognitionService';
import { AuthContext } from '../../utils/AuthContext';

// Demo flag: FORCE ON for prototype (always show recognized/marked behavior). Revert to env-based after demo.
const DEMO_FORCE_RECOGNIZED = true; // TODO: After demo, switch back to env-based toggle below
// const DEMO_FORCE_RECOGNIZED = (
//   (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_FACE_DEMO_FORCE_RECOGNIZED === 'true') ||
//   (typeof process !== 'undefined' && process.env && process.env.REACT_APP_FACE_DEMO_FORCE_RECOGNIZED === 'true')
// );

const FaceAttendanceModal = ({
  isVisible,
  onClose,
  onStudentRecognized,
  selectedClass,
  selectedDate,
  tenantId
}) => {
  const { user } = useContext(AuthContext);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [recognitionStep, setRecognitionStep] = useState('instructions'); // instructions, camera, processing, result

  const handleStartRecognition = () => {
    setRecognitionStep('camera');
    setShowCamera(true);
  };

  const handlePhotoTaken = async (photoResult) => {
    setShowCamera(false);

    // DEMO: If forced, skip recognition entirely and show recognized/marked message, without DB writes
    if (DEMO_FORCE_RECOGNIZED) {
      setIsProcessing(false);
      setRecognitionStep('instructions');
      setTimeout(() => {
        Alert.alert(
          'Attendance Marked',
          'Face recognized — Attendance marked (demo).',
          [
            { text: 'OK', onPress: onClose }
          ]
        );
      }, 200);
      return;
    }

    setRecognitionStep('processing');
    setIsProcessing(true);

    try {
      if (!photoResult.file) {
        throw new Error('No image file available for processing');
      }

      // Recognize face
      const recognitionResult = await FaceRecognitionService.recognizeFace({
        imageFile: photoResult.file,
        personType: 'student', // Looking for students only
        recognitionMethod: 'camera',
        performedBy: user.id,
        tenantId: tenantId,
        deviceInfo: {
          platform: 'mobile',
          userAgent: 'VidyaSetu-Mobile'
        },
        locationInfo: {
          context: 'classroom-attendance'
        }
      });

      if (recognitionResult.success && recognitionResult.matched) {
        // Found a matching student
        setRecognitionStep('result');
        
        const studentInfo = {
          id: recognitionResult.person.id,
          confidence: recognitionResult.confidence,
          template: recognitionResult.template,
          recognitionDuration: recognitionResult.recognitionDuration
        };

        setTimeout(() => {
          Alert.alert(
            'Student Recognized!',
            `Student identified with ${Math.round(recognitionResult.confidence * 100)}% confidence. Mark as present?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setRecognitionStep('instructions');
                  setIsProcessing(false);
                }
              },
              {
                text: 'Mark Present',
                onPress: async () => {
                  try {
                    // Mark attendance using facial recognition
                    await markAttendanceWithFaceRecognition(studentInfo, recognitionResult);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to mark attendance: ' + error.message);
                    setRecognitionStep('instructions');
                    setIsProcessing(false);
                  }
                }
              }
            ]
          );
        }, 1000);

      } else {
        // No match found
        // In non-demo mode, keep current behavior
        setRecognitionStep('instructions');

        const message = recognitionResult.error 
          ? `Recognition failed: ${recognitionResult.error}`
          : 'No matching student found in the enrolled faces.';

        Alert.alert(
          'Student Not Recognized',
          message + '\n\nWould you like to try again or mark attendance manually?',
          [
            { text: 'Try Again', onPress: () => setRecognitionStep('instructions') },
            { text: 'Manual Entry', onPress: onClose }
          ]
        );
      }

    } catch (error) {
      console.error('Face recognition error:', error);
      setRecognitionStep('instructions');
      
      Alert.alert(
        'Recognition Error',
        error.message || 'Failed to process face recognition. Please try again.',
        [
          { text: 'Try Again', onPress: () => setRecognitionStep('instructions') },
          { text: 'Cancel', onPress: onClose }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const markAttendanceWithFaceRecognition = async (studentInfo, recognitionResult) => {
    try {
      setIsProcessing(true);

      const attendanceResult = await FaceRecognitionService.markAttendanceWithFaceRecognition({
        recognitionResult: {
          ...recognitionResult,
          eventId: recognitionResult.eventId // This will be set by the recognition service
        },
        date: selectedDate,
        status: 'Present',
        markedBy: user.id,
        tenantId: tenantId,
        classId: selectedClass?.id,
        verificationNotes: `Face recognition with ${Math.round(recognitionResult.confidence * 100)}% confidence`
      });

      if (attendanceResult.success) {
        onStudentRecognized({
          studentId: studentInfo.id,
          confidence: studentInfo.confidence,
          attendance: attendanceResult.attendance
        });

        Alert.alert(
          'Attendance Marked',
          `Student marked present with ${Math.round(recognitionResult.confidence * 100)}% confidence.`,
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        throw new Error('Failed to save attendance record');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setRecognitionStep('instructions');
  };

  const handleClose = () => {
    setShowCamera(false);
    setRecognitionStep('instructions');
    setIsProcessing(false);
    onClose();
  };

  const renderInstructions = () => (
    <View style={styles.content}>
      <View style={styles.headerSection}>
        <Ionicons name="scan" size={80} color="#007AFF" />
        <Text style={styles.title}>Face Recognition Attendance</Text>
        <Text style={styles.subtitle}>
          Point camera at student's face to automatically mark attendance
        </Text>
      </View>

      <View style={styles.instructionCard}>
        <Text style={styles.cardTitle}>Instructions</Text>
        
        <View style={styles.instructionItem}>
          <Ionicons name="person" size={20} color="#4CAF50" />
          <Text style={styles.instructionText}>
            Student should look directly at the camera
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Ionicons name="sunny" size={20} color="#FF9800" />
          <Text style={styles.instructionText}>
            Ensure good lighting conditions
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Ionicons name="checkmark-circle" size={20} color="#2196F3" />
          <Text style={styles.instructionText}>
            System will automatically identify enrolled students
          </Text>
        </View>
      </View>

      <View style={styles.classInfo}>
        <Text style={styles.classInfoText}>
          Class: {selectedClass?.class_name} {selectedClass?.section}
        </Text>
        <Text style={styles.classInfoText}>
          Date: {selectedDate}
        </Text>
      </View>
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.processingTitle}>Recognizing Student...</Text>
      <Text style={styles.processingSubtitle}>
        Analyzing face and matching with enrolled students
      </Text>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Face Attendance</Text>
          <View style={styles.placeholder} />
        </View>

        {recognitionStep === 'instructions' && renderInstructions()}
        {recognitionStep === 'processing' && renderProcessing()}

        {recognitionStep === 'instructions' && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleStartRecognition}
              style={styles.startButton}
              disabled={isProcessing}
            >
              <Ionicons name="camera" size={20} color="white" />
              <Text style={styles.startButtonText}>Start Face Recognition</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onClose}
              style={styles.manualButton}
            >
              <Text style={styles.manualButtonText}>Use Manual Entry</Text>
            </TouchableOpacity>
          </View>
        )}

        <CameraCapture
          isVisible={showCamera}
          title="Face Recognition"
          subtitle="Capture student's face for attendance"
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
  headerTitle: {
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
    paddingTop: 20,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  classInfo: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  classInfoText: {
    fontSize: 14,
    color: '#1565C0',
    marginBottom: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  manualButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  manualButtonText: {
    color: '#666',
    fontSize: 14,
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
  },
});

export default FaceAttendanceModal;