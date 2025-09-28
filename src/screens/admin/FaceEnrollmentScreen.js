import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import { supabase } from '../../utils/supabase';
import CameraCapture from '../../components/FacialRecognition/CameraCapture';
import FaceRecognitionService from '../../services/FaceRecognitionService';
// Using Alert.alert instead of unavailable showUniversalNotification

const { width, height } = Dimensions.get('window');

const FaceEnrollmentScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState(new Set());
  const [selectedClass, setSelectedClass] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  
  // Camera state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  
  // View enrollment state
  const [viewEnrollmentVisible, setViewEnrollmentVisible] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [loadingEnrollment, setLoadingEnrollment] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    // Filter students based on search text
    if (searchText.trim() === '') {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchText.toLowerCase()) ||
        student.roll_no?.toString().toLowerCase().includes(searchText.toLowerCase()) ||
        student.class_name?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchText, students]);

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
      console.error('❌ [FaceEnrollmentScreen] Error loading classes:', error);
      Alert.alert('Error', 'Failed to load classes');
    }
  };

  const loadStudents = async () => {
    if (!selectedClass) return;
    
    try {
      setLoading(true);

      // Get tenant
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      // Load students with class information for selected class only
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          roll_no,
          class_id
        `)
        .eq('tenant_id', tenantId)
        .eq('class_id', selectedClass.id)
        .order('roll_no');

      if (studentsError) {
        throw studentsError;
      }

      // Format students data
      const formattedStudents = studentsData?.map(student => ({
        ...student,
        class_name: selectedClass.class_name
      })) || [];

      // Load enrollment status for all students
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('facial_templates')
        .select('person_id')
        .eq('tenant_id', tenantId)
        .eq('person_type', 'student');

      if (!enrollmentError && enrollmentData) {
        const enrolledIds = new Set(enrollmentData.map(item => item.person_id));
        setEnrolledStudents(enrolledIds);
      }

      setStudents(formattedStudents);
      setFilteredStudents(formattedStudents);

    } catch (error) {
      console.error('❌ [FaceEnrollmentScreen] Error loading students:', error);
      Alert.alert(
        'Load Error',
        'Failed to load students. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  const handleEnrollFace = (student) => {
    setSelectedStudent(student);
    setCameraVisible(true);
  };

  const handlePhotoTaken = async (photoData) => {
    if (!selectedStudent || !photoData?.file) {
      setCameraVisible(false);
      return;
    }

    try {
      setEnrolling(true);
      console.log('📸 [FaceEnrollmentScreen] Starting enrollment for:', selectedStudent.name);

      // Get tenant
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      // Initialize face service (no forced provider; allow service to resolve or fall back)
      await FaceRecognitionService.initialize();
      try {
        const config = await FaceRecognitionService.getConfigStatus(tenantId);
        // If Azure is selected but not configured, switch to offline provider for this session
        if (config.providerResolved === 'azure' && !config.azure.configured) {
          console.warn('⚠️ [FaceEnrollmentScreen] Azure not configured. Switching to offline provider for enrollment.');
          await FaceRecognitionService.setProviderOverride('offline');
          await FaceRecognitionService.initialize();
        }

        // If Azure creds exist but provider isn't azure, force override to azure
        if (config.azure.configured && config.providerResolved !== 'azure') {
          console.warn('⚠️ [FaceEnrollmentScreen] Azure creds detected but provider is', config.providerResolved, '- forcing provider override to azure');
          await FaceRecognitionService.setProviderOverride('azure');
          await FaceRecognitionService.initialize();
        }

        // If an Azure endpoint is set but key is missing, continue with offline provider (no blocking)
        if (config.azure.endpointHost && !config.azure.configured) {
          console.warn('⚠️ [FaceEnrollmentScreen] Azure endpoint present but key missing. Continuing with offline provider.');
        }

        const postConfig = await FaceRecognitionService.getConfigStatus(tenantId);

        if (postConfig.providerResolved === 'azure' && postConfig.azure.configured) {
          // Ensure person group exists for this tenant
          try {
            const ensureRes = await FaceRecognitionService.ensureAzurePersonGroup(tenantId);
            console.log('✅ [FaceEnrollmentScreen] Azure person group ready:', ensureRes.groupId);
          } catch (groupErr) {
            console.warn('⚠️ [FaceEnrollmentScreen] Failed to ensure Azure person group:', groupErr?.message);
          }
        }
      } catch (cfgErr) {
        console.warn('⚠️ [FaceEnrollmentScreen] Face config check:', cfgErr?.message);
      }

      // Enroll the face using FaceRecognitionService
      const enrollmentResult = await FaceRecognitionService.enrollFace({
        personId: selectedStudent.id,
        personType: 'student',
        imageFile: photoData.file,
        enrolledBy: user?.id,
        tenantId
      });

      if (enrollmentResult.success) {
        // Update enrolled students set
        setEnrolledStudents(prev => new Set([...prev, selectedStudent.id]));
        
        Alert.alert(
          'Enrollment Successful',
          `${selectedStudent.name}'s face has been enrolled successfully`,
          [{ text: 'OK' }]
        );

        console.log('✅ [FaceEnrollmentScreen] Enrollment successful for:', selectedStudent.name);
      } else {
        throw new Error(enrollmentResult.error || 'Enrollment failed');
      }

    } catch (error) {
      console.error('❌ [FaceEnrollmentScreen] Enrollment error:', error);
      
      let errorMessage = 'Failed to enroll face. Please try again.';
      if (error.message.includes('No face detected')) {
        errorMessage = 'No face detected in the photo. Please ensure your face is clearly visible and try again.';
      } else if (error.message.includes('Multiple faces')) {
        errorMessage = 'Multiple faces detected. Please ensure only one face is visible in the photo.';
      } else if (error.message.includes('Low quality')) {
        errorMessage = 'Photo quality is too low. Please take a clearer photo with better lighting.';
      }

      Alert.alert('Enrollment Failed', errorMessage, [{ text: 'OK' }]);
      
    } finally {
      setEnrolling(false);
      setCameraVisible(false);
      setSelectedStudent(null);
    }
  };

  const handleCameraCancel = () => {
    setCameraVisible(false);
    setSelectedStudent(null);
  };

  const handleViewEnrollment = async (student) => {
    try {
      setLoadingEnrollment(true);
      console.log('🔍 [FaceEnrollmentScreen] Loading enrollment for:', student.name);

      // Get tenant
      const tenantResult = await getCurrentUserTenantByEmail();
      if (!tenantResult?.success) {
        throw new Error('Failed to get tenant information');
      }

      const tenantId = tenantResult.data.tenant.id;

      // Fetch facial template data
      const { data: template, error } = await supabase
        .from('facial_templates')
        .select('*')
        .eq('person_id', student.id)
        .eq('person_type', 'student')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (error) {
        throw error;
      }

      if (!template) {
        throw new Error('No face enrollment found for this student');
      }

      // Get signed URL for the face image
      let signedUrl = null;
      if (template.face_image_url) {
        try {
          console.log('🔗 [ViewEnrollment] Getting signed URL for:', template.face_image_url);
          
          // Extract the file path from the URL (remove domain part)
          let filePath = '';
          
          if (template.face_image_url.includes('/storage/v1/object/public/')) {
            // Standard Supabase storage URL format
            const urlParts = template.face_image_url.split('/');
            const bucketIndex = urlParts.findIndex(part => part === 'facial-templates');
            if (bucketIndex !== -1) {
              filePath = urlParts.slice(bucketIndex + 1).join('/');
            }
          } else if (template.face_image_url.includes('facial-templates/')) {
            // Already a path format
            const pathIndex = template.face_image_url.indexOf('facial-templates/');
            filePath = template.face_image_url.substring(pathIndex + 'facial-templates/'.length);
          } else if (template.face_image_url.startsWith('https://mock-storage.local/')) {
            // Mock URL from development - try to extract tenant path
            const mockPath = template.face_image_url.replace('https://mock-storage.local/', '');
            filePath = mockPath;
            console.log('🎨 [ViewEnrollment] Mock URL detected, extracted path:', filePath);
          }
          
          console.log('🔗 [ViewEnrollment] Extracted file path:', filePath);
          
          if (filePath) {
            const { data, error: urlError } = await supabase.storage
              .from('facial-templates')
              .createSignedUrl(filePath, 300); // 5 minute expiry
            
            if (!urlError && data?.signedUrl) {
              signedUrl = data.signedUrl;
              console.log('✅ [ViewEnrollment] Successfully created signed URL');
            } else {
              console.warn('⚠️ [ViewEnrollment] Failed to create signed URL:', urlError?.message);
            }
          } else {
            console.warn('⚠️ [ViewEnrollment] Could not extract file path from URL');
          }
        } catch (urlError) {
          console.warn('⚠️ Failed to get signed URL for face image:', urlError);
        }
      }

      setSelectedEnrollment({
        ...template,
        student: student,
        signedImageUrl: signedUrl
      });
      setViewEnrollmentVisible(true);

    } catch (error) {
      console.error('❌ [FaceEnrollmentScreen] View enrollment error:', error);
      Alert.alert(
        'View Enrollment Failed',
        'Failed to load face enrollment data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingEnrollment(false);
    }
  };

  const handleCloseViewEnrollment = () => {
    setViewEnrollmentVisible(false);
    setSelectedEnrollment(null);
  };

  const handleRemoveEnrollment = async (student) => {
    Alert.alert(
      'Remove Face Data',
      `Are you sure you want to remove face enrollment for ${student.name}? This will disable facial recognition for this student.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get tenant
              const tenantResult = await getCurrentUserTenantByEmail();
              if (!tenantResult?.success) {
                throw new Error('Failed to get tenant information');
              }

              const tenantId = tenantResult.data.tenant.id;

              // 1) Find the template to delete to get its storage path
              const { data: templates, error: fetchError } = await supabase
                .from('facial_templates')
                .select('id, face_image_url')
                .eq('person_id', student.id)
                .eq('person_type', 'student')
                .eq('tenant_id', tenantId);

              if (fetchError) {
                throw fetchError;
              }

              const templateToRemove = Array.isArray(templates) && templates.length > 0 ? templates[0] : null;

              // 2) If we have a URL, try to remove the file from storage first
              if (templateToRemove?.face_image_url) {
                try {
                  let filePath = '';
                  const url = templateToRemove.face_image_url;
                  if (url.includes('/storage/v1/object/public/')) {
                    const urlParts = url.split('/');
                    const bucketIndex = urlParts.findIndex(part => part === 'facial-templates');
                    if (bucketIndex !== -1) {
                      filePath = urlParts.slice(bucketIndex + 1).join('/');
                    }
                  } else if (url.includes('facial-templates/')) {
                    const pathIndex = url.indexOf('facial-templates/');
                    filePath = url.substring(pathIndex + 'facial-templates/'.length);
                  } else if (url.startsWith('https://mock-storage.local/')) {
                    filePath = url.replace('https://mock-storage.local/', '');
                  } else if (!url.startsWith('http')) {
                    // Looks like it's already a relative path (tenantId/...) 
                    filePath = url;
                  }

                  if (filePath) {
                    const { error: removeError } = await supabase.storage
                      .from('facial-templates')
                      .remove([filePath]);
                    if (removeError) {
                      console.warn('⚠️ [RemoveEnrollment] Failed to remove storage object:', removeError.message);
                    } else {
                      console.log('🗑️ [RemoveEnrollment] Storage object removed:', filePath);
                    }
                  } else {
                    console.warn('⚠️ [RemoveEnrollment] Could not extract storage path from face_image_url');
                  }
                } catch (storageRemoveErr) {
                  console.warn('⚠️ [RemoveEnrollment] Storage removal error:', storageRemoveErr);
                }
              }

              // 3) Remove facial template row(s) from DB
              const { error } = await supabase
                .from('facial_templates')
                .delete()
                .eq('person_id', student.id)
                .eq('person_type', 'student')
                .eq('tenant_id', tenantId);

              if (error) {
                throw error;
              }

              // Update enrolled students set
              setEnrolledStudents(prev => {
                const newSet = new Set(prev);
                newSet.delete(student.id);
                return newSet;
              });

              Alert.alert(
                'Face Data Removed',
                `Face enrollment removed for ${student.name}`,
                [{ text: 'OK' }]
              );

            } catch (error) {
              console.error('❌ [FaceEnrollmentScreen] Remove enrollment error:', error);
              Alert.alert(
                'Remove Failed',
                'Failed to remove face enrollment. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const renderStudentItem = ({ item: student }) => {
    const isEnrolled = enrolledStudents.has(student.id);

    return (
      <View style={styles.studentCard}>
        <View style={styles.studentInfo}>
          <View style={styles.avatarContainer}>
            {student.profile_image ? (
              <Image 
                source={{ uri: student.profile_image }} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {student.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isEnrolled && (
              <View style={styles.enrolledBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              </View>
            )}
          </View>

          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.studentClass}>{student.class_name}</Text>
            {student.roll_no && (
              <Text style={styles.studentRoll}>Roll: {student.roll_no}</Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          {isEnrolled ? (
            <View style={styles.enrolledActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.viewButton]}
                onPress={() => handleViewEnrollment(student)}
                disabled={loadingEnrollment}
              >
                {loadingEnrollment ? (
                  <ActivityIndicator size={16} color="#2196F3" />
                ) : (
                  <Ionicons name="eye" size={18} color="#2196F3" />
                )}
                <Text style={[styles.actionButtonText, styles.viewButtonText]}>
                  View
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => handleRemoveEnrollment(student)}
              >
                <Ionicons name="trash-outline" size={18} color="#F44336" />
                <Text style={[styles.actionButtonText, styles.removeButtonText]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.enrollButton]}
              onPress={() => handleEnrollFace(student)}
            >
              <Ionicons name="camera" size={18} color="#2196F3" />
              <Text style={[styles.actionButtonText, styles.enrollButtonText]}>
                Enroll Face
              </Text>
            </TouchableOpacity>
          )}
        </View>
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading students...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Face Enrollment</Text>
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

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          value={searchText}
          onChangeText={setSearchText}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
            {enrolledStudents.size}
          </Text>
          <Text style={styles.statLabel}>Enrolled</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#FF9800' }]}>
            {students.length - enrolledStudents.size}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Students List */}
      <FlatList
        data={filteredStudents}
        keyExtractor={item => item.id}
        renderItem={renderStudentItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {!selectedClass ? 'Please select a class' : searchText ? 'No students found' : 'No students in this class'}
            </Text>
            {searchText && selectedClass && (
              <Text style={styles.emptySubtext}>
                Try adjusting your search terms
              </Text>
            )}
          </View>
        )}
      />

      {/* Camera Modal */}
      <CameraCapture
        isVisible={cameraVisible}
        title="Enroll Face"
        subtitle={selectedStudent ? `Enrolling face for ${selectedStudent.name}` : ""}
        onPhotoTaken={handlePhotoTaken}
        onCancel={handleCameraCancel}
      />

      {/* Loading Overlay */}
      {enrolling && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingCardText}>
              Processing face enrollment...
            </Text>
          </View>
        </View>
      )}

      {/* Class Picker Modal */}
      {renderClassPicker()}
      
      {/* View Enrollment Modal */}
      <Modal
        visible={viewEnrollmentVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseViewEnrollment}
      >
        <View style={styles.viewEnrollmentContainer}>
          <View style={styles.viewEnrollmentHeader}>
            <TouchableOpacity onPress={handleCloseViewEnrollment} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.viewEnrollmentTitle}>Face Enrollment</Text>
            <View style={styles.placeholder} />
          </View>
          
          {selectedEnrollment && (
            <ScrollView style={styles.viewEnrollmentContent}>
              {/* Student Info */}
              <View style={styles.viewStudentInfo}>
                <View style={styles.viewStudentHeader}>
                  <Ionicons name="person-circle" size={60} color="#2196F3" />
                  <View style={styles.viewStudentDetails}>
                    <Text style={styles.viewStudentName}>{selectedEnrollment.student.name}</Text>
                    <Text style={styles.viewStudentClass}>{selectedEnrollment.student.class_name}</Text>
                    {selectedEnrollment.student.roll_no && (
                      <Text style={styles.viewStudentRoll}>Roll: {selectedEnrollment.student.roll_no}</Text>
                    )}
                  </View>
                </View>
              </View>
              
              {/* Face Image */}
              <View style={styles.viewFaceImageContainer}>
                <Text style={styles.sectionTitle}>Enrolled Face Photo</Text>
                <View style={styles.faceImageWrapper}>
                  {selectedEnrollment.signedImageUrl ? (
                    <Image 
                      source={{ uri: selectedEnrollment.signedImageUrl }}
                      style={styles.enrolledFaceImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.noImageContainer}>
                      <Ionicons name="image-outline" size={48} color="#ccc" />
                      <Text style={styles.noImageText}>Image not available</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Enrollment Details */}
              <View style={styles.enrollmentDetails}>
                <Text style={styles.sectionTitle}>Enrollment Information</Text>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Template Name:</Text>
                  <Text style={styles.detailValue}>{selectedEnrollment.template_name || 'primary'}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Confidence Threshold:</Text>
                  <Text style={styles.detailValue}>{(selectedEnrollment.confidence_threshold * 100).toFixed(1)}%</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Enrolled On:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedEnrollment.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={styles.statusContainer}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.detailValue, { color: '#4CAF50' }]}>Active</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
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
    marginVertical: 12,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9'
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  studentCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9'
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25
  },
  avatarPlaceholder: {
    backgroundColor: '#e1e5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666'
  },
  enrolledBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 1
  },
  studentDetails: {
    flex: 1
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2
  },
  studentClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2
  },
  studentRoll: {
    fontSize: 12,
    color: '#888'
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  enrolledActions: {
    flexDirection: 'row',
    gap: 8
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1
  },
  enrollButton: {
    borderColor: '#2196F3',
    backgroundColor: '#f8f9ff'
  },
  viewButton: {
    borderColor: '#2196F3',
    backgroundColor: '#f8f9ff'
  },
  removeButton: {
    borderColor: '#F44336',
    backgroundColor: '#fff8f8'
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6
  },
  enrollButtonText: {
    color: '#2196F3'
  },
  viewButtonText: {
    color: '#2196F3'
  },
  removeButtonText: {
    color: '#F44336'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderRadius: 12,
    alignItems: 'center'
  },
  loadingCardText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333'
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
  },
  // View Enrollment Modal Styles
  viewEnrollmentContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  viewEnrollmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9'
  },
  viewEnrollmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a'
  },
  viewEnrollmentContent: {
    flex: 1,
    paddingHorizontal: 20
  },
  viewStudentInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 16
  },
  viewStudentHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  viewStudentDetails: {
    marginLeft: 16,
    flex: 1
  },
  viewStudentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4
  },
  viewStudentClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2
  },
  viewStudentRoll: {
    fontSize: 12,
    color: '#888'
  },
  viewFaceImageContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16
  },
  faceImageWrapper: {
    alignItems: 'center'
  },
  enrolledFaceImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0'
  },
  noImageContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed'
  },
  noImageText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8
  },
  enrollmentDetails: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right'
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1
  }
});

export default FaceEnrollmentScreen;