import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import { supabase } from '../../utils/supabase';
import CameraCapture from '../../components/FacialRecognition/CameraCapture';
import FaceRecognitionService from '../../services/FaceRecognitionService';
// Using Alert.alert instead of unavailable showUniversalNotification

const { width, height } = Dimensions.get('window');

const FaceAttendanceScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [presentStudents, setPresentStudents] = useState(new Set());
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });

  // Recognition results
  const [lastRecognition, setLastRecognition] = useState(null);
  const recognitionTimeoutRef = useRef(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadTodayAttendance();
    }
  }, [selectedClass]);

  useEffect(() => {
    // Clear recognition result after 3 seconds
    if (lastRecognition && recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
    
    if (lastRecognition) {
      recognitionTimeoutRef.current = setTimeout(() => {
        setLastRecognition(null);
      }, 3000);
    }

    return () => {
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, [lastRecognition]);

  const loadClasses = async () => {
    try {
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      const { data: classesData, error } = await supabase
        .from('classes')
        .select('id, class_name')
        .eq('tenant_id', tenantId)
        .order('class_name');

      if (error) {
        throw error;
      }

      setClasses(classesData || []);
      
      // Auto-select first class if available
      if (classesData && classesData.length > 0 && !selectedClass) {
        setSelectedClass(classesData[0]);
      }

    } catch (error) {
      console.error('❌ [FaceAttendanceScreen] Error loading classes:', error);
      Alert.alert('Error', 'Failed to load classes');
    }
  };

  const loadTodayAttendance = async () => {
    if (!selectedClass) return;

    try {
      setLoading(true);

      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      // Load all students in the selected class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, roll_no')
        .eq('class_id', selectedClass.id)
        .eq('tenant_id', tenantId)
        .order('roll_no');

      if (studentsError) {
        throw studentsError;
      }

      // Load today's attendance for this class
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('student_id, status, marked_by, created_at')
        .eq('date', today)
        .eq('class_id', selectedClass.id)
        .eq('tenant_id', tenantId);

      if (attendanceError) {
        throw attendanceError;
      }

      // Create attendance map
      const attendanceMap = {};
      const presentIds = new Set();
      
      attendanceData?.forEach(record => {
        attendanceMap[record.student_id] = record;
        if (record.status === 'Present') {
          presentIds.add(record.student_id);
        }
      });

      // Combine student data with attendance
      const attendanceList = studentsData?.map(student => ({
        ...student,
        attendance: attendanceMap[student.id] || null,
        status: attendanceMap[student.id]?.status || 'Absent'
      })) || [];

      setTodayAttendance(attendanceList);
      setPresentStudents(presentIds);

      // Calculate stats
      const total = attendanceList.length;
      const present = presentIds.size;
      const absent = total - present;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      setStats({ total, present, absent, percentage });

    } catch (error) {
      console.error('❌ [FaceAttendanceScreen] Error loading attendance:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecognition = () => {
    if (!selectedClass) {
      Alert.alert('No Class Selected', 'Please select a class first');
      return;
    }
    setCameraVisible(true);
  };

  const handlePhotoTaken = async (photoData) => {
    if (!photoData?.file || !selectedClass) {
      setCameraVisible(false);
      return;
    }

    try {
      setRecognizing(true);
      console.log('🔍 [FaceAttendanceScreen] Starting face recognition...');

      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      // Recognize face using FaceRecognitionService
      const recognitionResult = await FaceRecognitionService.recognizeFace({
        imageFile: photoData.file,
        tenantId,
        personType: 'student',
        performedBy: user?.id
      });

      console.log('🔍 [FaceAttendanceScreen] Recognition result:', recognitionResult);

      if (recognitionResult.success && recognitionResult.matched) {
        const matchedStudent = recognitionResult.person;
        
        // Check if the student is in the selected class
        const studentInClass = todayAttendance.find(s => s.id === matchedStudent.id);
        
        if (!studentInClass) {
          setLastRecognition({
            success: false,
            message: `Student is not in the selected class (${selectedClass.class_name})`,
            student: null
          });
          return;
        }

        // Check if already marked present
        if (presentStudents.has(matchedStudent.id)) {
          setLastRecognition({
            success: false,
            message: `${studentInClass.name} is already marked present`,
            student: studentInClass
          });
          return;
        }

        // Mark attendance
        await markAttendance(matchedStudent.id, 'Present', 'facial_recognition');
        
        setLastRecognition({
          success: true,
          message: `${studentInClass.name} marked present`,
          student: studentInClass,
          confidence: recognitionResult.confidence
        });

      } else {
        // Face not recognized - show fallback options
        setLastRecognition({
          success: false,
          message: 'Face not recognized. Please try manual attendance.',
          student: null
        });
      }

    } catch (error) {
      console.error('❌ [FaceAttendanceScreen] Recognition error:', error);
      
      let errorMessage = 'Recognition failed. Please try again.';
      if (error.message.includes('No face detected')) {
        errorMessage = 'No face detected. Please position your face clearly in the frame.';
      } else if (error.message.includes('Multiple faces')) {
        errorMessage = 'Multiple faces detected. Please ensure only one person is in the frame.';
      }

      setLastRecognition({
        success: false,
        message: errorMessage,
        student: null
      });

    } finally {
      setRecognizing(false);
      // Keep camera open for continuous recognition
    }
  };

  const markAttendance = async (studentId, status, verificationMethod = 'manual') => {
    try {
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      // Check if attendance already exists
      const { data: existingAttendance, error: checkError } = await supabase
        .from('student_attendance')
        .select('id, status')
        .eq('student_id', studentId)
        .eq('date', today)
        .eq('tenant_id', tenantId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingAttendance) {
        // Update existing attendance
        const { error: updateError } = await supabase
          .from('student_attendance')
          .update({
            status
          })
          .eq('id', existingAttendance.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Insert new attendance record
        const { error: insertError } = await supabase
          .from('student_attendance')
          .insert({
            student_id: studentId,
            class_id: selectedClass.id,
            date: today,
            status,
            marked_by: user.id,
            tenant_id: tenantId
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Reload attendance data
      await loadTodayAttendance();

      // Show success message using Alert (could be replaced with toast/notification later)
      console.log('✅ Attendance updated successfully:', `Student marked as ${status.toLowerCase()}`);

    } catch (error) {
      console.error('❌ [FaceAttendanceScreen] Mark attendance error:', error);
      throw error;
    }
  };

  const handleManualAttendance = (student) => {
    const currentStatus = student.status;
    const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present';
    
    Alert.alert(
      'Manual Attendance',
      `Mark ${student.name} as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await markAttendance(student.id, newStatus, 'manual');
            } catch (error) {
              Alert.alert('Error', 'Failed to update attendance');
            }
          }
        }
      ]
    );
  };

  const renderStudentItem = ({ item: student }) => {
    const isPresent = student.status === 'Present';

    return (
      <View style={[styles.studentCard, isPresent && styles.presentCard]}>
        <View style={styles.studentInfo}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {student.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={[
              styles.statusBadge, 
              isPresent ? styles.presentBadge : styles.absentBadge
            ]}>
              <Ionicons 
                name={isPresent ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color="#fff" 
              />
            </View>
          </View>

          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>{student.name}</Text>
            {student.roll_no && (
              <Text style={styles.studentRoll}>Roll: {student.roll_no}</Text>
            )}
            <Text style={[
              styles.statusText,
              isPresent ? styles.presentText : styles.absentText
            ]}>
              {student.status}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => handleManualAttendance(student)}
        >
          <Ionicons 
            name={isPresent ? "remove-circle-outline" : "add-circle-outline"} 
            size={24} 
            color={isPresent ? "#F44336" : "#4CAF50"} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderClassPicker = () => (
    <Modal
      visible={classPickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setClassPickerVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.classPickerContainer}>
          <Text style={styles.pickerTitle}>Select Class</Text>
          <FlatList
            data={classes}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.classItem,
                  selectedClass?.id === item.id && styles.selectedClassItem
                ]}
                onPress={() => {
                  setSelectedClass(item);
                  setClassPickerVisible(false);
                }}
              >
                <Text style={[
                  styles.classItemText,
                  selectedClass?.id === item.id && styles.selectedClassItemText
                ]}>
                  {item.class_name}
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setClassPickerVisible(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Attendance</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Class Selector */}
      <TouchableOpacity
        style={styles.classSelector}
        onPress={() => setClassPickerVisible(true)}
      >
        <Text style={styles.classSelectorText}>
          {selectedClass ? selectedClass.class_name : 'Select Class'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
            {stats.present}
          </Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F44336' }]}>
            {stats.absent}
          </Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#2196F3' }]}>
            {stats.percentage}%
          </Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
      </View>

      {/* Recognition Button */}
      <TouchableOpacity
        style={[styles.recognitionButton, recognizing && styles.recognitionButtonDisabled]}
        onPress={handleStartRecognition}
        disabled={!selectedClass || recognizing}
      >
        <Ionicons name="camera" size={24} color="#fff" />
        <Text style={styles.recognitionButtonText}>
          {recognizing ? 'Recognizing...' : 'Start Face Recognition'}
        </Text>
      </TouchableOpacity>

      {/* Last Recognition Result */}
      {lastRecognition && (
        <View style={[
          styles.recognitionResult,
          lastRecognition.success ? styles.successResult : styles.errorResult
        ]}>
          <Ionicons 
            name={lastRecognition.success ? "checkmark-circle" : "alert-circle"} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.recognitionResultText}>
            {lastRecognition.message}
          </Text>
        </View>
      )}

      {/* Students List */}
      {selectedClass && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {selectedClass.name} - {format(new Date(), 'MMM dd, yyyy')}
          </Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          ) : (
            <FlatList
              data={todayAttendance}
              keyExtractor={item => item.id}
              renderItem={renderStudentItem}
              contentContainerStyle={styles.studentsList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* Camera Modal */}
      <CameraCapture
        isVisible={cameraVisible}
        title="Face Recognition Attendance"
        subtitle="Position student's face in the frame"
        onPhotoTaken={handlePhotoTaken}
        onCancel={() => setCameraVisible(false)}
      />

      {/* Class Picker Modal */}
      {renderClassPicker()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a'
  },
  headerRight: {
    width: 40
  },
  classSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9'
  },
  classSelectorText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500'
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9'
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2196F3'
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  recognitionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 8
  },
  recognitionButtonDisabled: {
    backgroundColor: '#999'
  },
  recognitionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  recognitionResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8
  },
  successResult: {
    backgroundColor: '#4CAF50'
  },
  errorResult: {
    backgroundColor: '#F44336'
  },
  recognitionResultText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1
  },
  listContainer: {
    flex: 1,
    marginTop: 12
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  studentsList: {
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  studentCard: {
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  presentCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8'
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarPlaceholder: {
    backgroundColor: '#e1e5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666'
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 8,
    padding: 2
  },
  presentBadge: {
    backgroundColor: '#4CAF50'
  },
  absentBadge: {
    backgroundColor: '#F44336'
  },
  studentDetails: {
    flex: 1
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2
  },
  studentRoll: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500'
  },
  presentText: {
    color: '#4CAF50'
  },
  absentText: {
    color: '#F44336'
  },
  toggleButton: {
    padding: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  classPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.8,
    maxHeight: height * 0.6
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20
  },
  classItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8
  },
  selectedClassItem: {
    backgroundColor: '#2196F3'
  },
  classItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center'
  },
  selectedClassItemText: {
    color: '#fff'
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  }
});

export default FaceAttendanceScreen;