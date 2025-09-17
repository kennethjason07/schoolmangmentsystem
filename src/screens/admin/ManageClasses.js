import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { Picker } from '@react-native-picker/picker';
import { supabase, TABLES } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { useTenantAccess, tenantDatabase } from '../../utils/tenantHelpers';

const ManageClasses = ({ navigation }) => {
  const { user } = useAuth();
  
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // Debug enhanced tenant context
  console.log('🚀 ManageClasses: Enhanced tenant context:', {
    isReady,
    tenantName: tenantName || 'NULL',
    tenantId: getTenantId() || 'NULL',
    userEmail: user?.email || 'NULL',
    platform: Platform.OS
  });
  
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sections] = useState(['A', 'B', 'C', 'D']);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [newClass, setNewClass] = useState({
    class_name: '',
    academic_year: '2024-25',
    section: '',
    class_teacher_id: '',
  });
  const [classDetailsModal, setClassDetailsModal] = useState(false);
  const [selectedClassDetails, setSelectedClassDetails] = useState(null);
  const [classSubjects, setClassSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load data on component mount and when tenant changes
  useEffect(() => {
    console.log('🚀 ManageClasses: useEffect triggered:', {
      isReady,
      tenantId: getTenantId() || 'NULL',
      user: user?.email || 'NULL'
    });
    
    let timeoutId;
    
    // Wait for tenant context to be ready
    if (isReady && getTenantId() && user) {
      console.log('🏢 ManageClasses: Tenant ready, loading data...');
      loadAllData();
    } else if (tenantError) {
      console.error('❌ ManageClasses: Tenant error:', tenantError);
      setError(tenantError);
    } else if (!isReady) {
      console.log('⏳ ManageClasses: Waiting for tenant context to be ready...');
      // Add a timeout fallback in case tenant context never becomes ready
      timeoutId = setTimeout(() => {
        if (!isReady && !getTenantId()) {
          console.warn('⚠️ ManageClasses: Tenant context timeout - forcing load with possible limitations');
          setError('Tenant context is taking too long to initialize. Some features may be limited.');
          setLoading(false);
        }
      }, 10000); // 10 second timeout
    } else if (!user) {
      console.warn('🏢 ManageClasses: Waiting for user authentication...');
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isReady, getTenantId(), user, tenantError]);

  const loadAllData = async () => {
    const startTime = performance.now();
    setLoading(true);
    setError(null);
    
    try {
      const tenantId = getTenantId();
      console.log('🏢 ManageClasses: Loading data for tenant:', tenantId);
      
      if (!tenantId) {
        console.error('❌ ManageClasses: No tenant ID available');
        setError('No tenant context available. Please contact administrator.');
        setLoading(false);
        return;
      }
      
      // 🚀 Use enhanced tenant database for parallel loading
      console.log('🏢 ManageClasses: Fetching classes and teachers in parallel...');
      
      const [classesResult, teachersResult] = await Promise.all([
        tenantDatabase.read('classes', {}, '*', { orderBy: { column: 'class_name', ascending: true } }).catch(err => {
          console.error('❌ ManageClasses: Error loading classes:', err);
          return { data: null, error: err };
        }),
        tenantDatabase.read('teachers', {}, '*', { orderBy: { column: 'name', ascending: true } }).catch(err => {
          console.error('❌ ManageClasses: Error loading teachers:', err);
          return { data: null, error: err };
        })
      ]);
      
      const { data: classData, error: classError } = classesResult;
      const { data: teacherData, error: teacherError } = teachersResult;
      
      if (classError) {
        console.error('❌ ManageClasses: Classes query failed:', classError.message);
        throw new Error(`Failed to load classes: ${classError.message}`);
      }
      
      if (teacherError) {
        console.error('❌ ManageClasses: Teachers query failed:', teacherError.message);
        throw new Error(`Failed to load teachers: ${teacherError.message}`);
      }
      
      // Set data
      setClasses(classData || []);
      setTeachers(teacherData || []);
      
      console.log('📊 ManageClasses: Data loaded successfully:', {
        classes: classData?.length || 0,
        teachers: teacherData?.length || 0,
        tenantId
      });
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ ManageClasses: Data loaded in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ ManageClasses: Failed to load data:', error.message);
      setError(error.message || 'Failed to load classes and teachers');
      Alert.alert('Error', error.message || 'Failed to load classes and teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        Alert.alert('Access Denied', 'No tenant context available.');
        return;
      }

      if (!newClass.class_name || !newClass.section) {
        Alert.alert('Error', 'Please fill in class name and section');
        return;
      }

      console.log('🏫 ManageClasses: Creating new class');
      console.log('📍 ManageClasses: Insert will use tenant_id:', tenantId);
      
      // First, check if a class with the same name, section, and academic year already exists in this tenant
      console.log('🔍 ManageClasses: Checking for existing class in tenant');
      const { data: existingClass, error: checkError } = await tenantDatabase.read(
        'classes',
        {
          class_name: newClass.class_name,
          section: newClass.section,
          academic_year: newClass.academic_year
        }
      );
      
      if (checkError) {
        console.error('❌ ManageClasses: Error checking for existing class:', checkError);
        throw checkError;
      }
      
      if (existingClass && existingClass.length > 0) {
        console.log('⚠️ ManageClasses: Duplicate class found:', existingClass[0]);
        const errorMessage = `A class "${newClass.class_name}${newClass.section}" already exists for academic year "${newClass.academic_year}" in your school. Please choose a different class name, section, or academic year.`;
        Alert.alert('Duplicate Class', errorMessage);
        return; // Don't proceed with insert
      }
      
      console.log('✅ ManageClasses: No duplicate found, proceeding with insert');
      
      // Insert a new class
      const classData = {
        class_name: newClass.class_name,
        academic_year: newClass.academic_year,
        section: newClass.section,
        class_teacher_id: newClass.class_teacher_id || null,
        tenant_id: tenantId,
      };
      
      const { data: insertedData, error } = await tenantDatabase.create('classes', classData);
      
      if (error) {
        console.error('❌ ManageClasses: Database error adding class:', error);
        
        // Handle specific constraint violations with user-friendly messages
        if (error.code === '23505' && error.message.includes('unique_class_section_year')) {
          const errorMessage = `A class "${newClass.class_name}${newClass.section}" already exists for academic year "${newClass.academic_year}". Please choose a different class name, section, or academic year.`;
          Alert.alert('Duplicate Class', errorMessage);
          return; // Don't throw, just return to keep modal open
        }
        
        throw error;
      }
      
      console.log('✅ ManageClasses: Class created successfully!');
      console.log('📋 ManageClasses: Inserted class details:');
      if (insertedData && insertedData.length > 0) {
        insertedData.forEach((cls, index) => {
          console.log(`   [${index + 1}] New Class: ${cls.class_name} | tenant_id: ${cls.tenant_id} | id: ${cls.id}`);
          
          // Verify the inserted class has the correct tenant_id
          if (cls.tenant_id === tenantId) {
            console.log('✅ ManageClasses: New class has correct tenant_id');
          } else {
            console.error('❌ ManageClasses: NEW CLASS TENANT MISMATCH!');
            console.error('❌ Expected tenant_id:', tenantId);
            console.error('❌ Actual tenant_id:', cls.tenant_id);
          }
        });
      }

      // Refresh data
      await loadAllData();
      setNewClass({ 
        class_name: '', 
        academic_year: '2024-25', 
        section: '', 
        class_teacher_id: '' 
      });
      setIsAddModalVisible(false);
      Alert.alert('Success', 'Class added successfully!');
    } catch (error) {
      console.error('Error adding class:', error);
      Alert.alert('Error', `Failed to add class: ${error.message}`);
    }
  };

  const handleEditClass = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        Alert.alert('Access Denied', 'No tenant context available.');
        return;
      }

      if (!selectedClass.class_name || !selectedClass.section) {
        Alert.alert('Error', 'Please fill in class name and section');
        return;
      }

      // First, check if another class with the same name, section, and academic year already exists in this tenant
      console.log('🔍 ManageClasses: Checking for existing class in tenant (edit)');
      const { data: existingClass, error: checkError } = await tenantDatabase.read(
        'classes',
        {
          class_name: selectedClass.class_name,
          section: selectedClass.section,
          academic_year: selectedClass.academic_year
        }
      );
      
      if (checkError) {
        console.error('❌ ManageClasses: Error checking for existing class during edit:', checkError);
        throw checkError;
      }
      
      // Filter out the current class being edited
      const otherClasses = existingClass?.filter(cls => cls.id !== selectedClass.id) || [];
      
      if (otherClasses && otherClasses.length > 0) {
        console.log('⚠️ ManageClasses: Duplicate class found during edit:', otherClasses[0]);
        const errorMessage = `A class "${selectedClass.class_name}${selectedClass.section}" already exists for academic year "${selectedClass.academic_year}" in your school. Please choose a different class name, section, or academic year.`;
        Alert.alert('Duplicate Class', errorMessage);
        return; // Don't proceed with update
      }
      
      console.log('✅ ManageClasses: No duplicate found during edit, proceeding with update');

      // Update a class
      const classData = {
        class_name: selectedClass.class_name,
        academic_year: selectedClass.academic_year,
        section: selectedClass.section,
        class_teacher_id: selectedClass.class_teacher_id || null,
      };
      
      const { error } = await tenantDatabase.update('classes', { id: selectedClass.id }, classData);

      if (error) {
        console.error('Database error updating class:', error);
        
        // Handle specific constraint violations with user-friendly messages
        if (error.code === '23505' && error.message.includes('unique_class_section_year')) {
          const errorMessage = `A class "${selectedClass.class_name}${selectedClass.section}" already exists for academic year "${selectedClass.academic_year}". Please choose a different class name, section, or academic year.`;
          Alert.alert('Duplicate Class', errorMessage);
          return; // Don't throw, just return to keep modal open
        }
        
        throw error;
      }

      // Refresh data
      await loadAllData();
      setIsEditModalVisible(false);
      setSelectedClass(null);
      Alert.alert('Success', 'Class updated successfully!');
    } catch (error) {
      console.error('Error updating class:', error);
      Alert.alert('Error', `Failed to update class: ${error.message}`);
    }
  };

  const handleDeleteClass = async (classId) => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class? This will also delete all associated subjects, assignments, exams, and related data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const tenantId = getTenantId();
              if (!tenantId) {
                Alert.alert('Access Denied', 'No tenant context available.');
                return;
              }
              
              console.log('Starting class deletion process for class ID:', classId);

              // Step 1: Get all subjects for this class to handle cascading deletes
              const { data: classSubjects } = await tenantDatabase.read('subjects', { class_id: classId });
              
              const subjectIds = classSubjects?.map(s => s.id) || [];
              console.log('Found subjects to delete:', subjectIds);

              // Step 2: Delete teacher_subjects assignments for these subjects
              if (subjectIds.length > 0) {
                const { error: teacherSubjectsError } = await tenantDatabase.delete('teacher_subjects', { subject_id: { in: subjectIds } });
                if (teacherSubjectsError) {
                  console.error('Error deleting teacher_subjects:', teacherSubjectsError);
                  throw teacherSubjectsError;
                }
              }

              // Step 3: Delete marks related to subjects in this class
              if (subjectIds.length > 0) {
                const { error: marksError } = await tenantDatabase.delete('marks', { subject_id: { in: subjectIds } });
                if (marksError) {
                  console.error('Error deleting marks:', marksError);
                  throw marksError;
                }
              }

              // Step 4: Delete timetable entries for this class
              const { error: timetableError } = await tenantDatabase.delete('timetable_entries', { class_id: classId });
              if (timetableError) {
                console.error('Error deleting timetable entries:', timetableError);
                throw timetableError;
              }

              // Step 5: Delete assignment submissions for assignments in this class
              const { data: classAssignments } = await tenantDatabase.read('assignments', { class_id: classId });
              
              const assignmentIds = classAssignments?.map(a => a.id) || [];
              if (assignmentIds.length > 0) {
                const { error: submissionsError } = await tenantDatabase.delete('assignment_submissions', { assignment_id: { in: assignmentIds } });
                if (submissionsError) {
                  console.error('Error deleting assignment submissions:', submissionsError);
                  throw submissionsError;
                }
              }

              // Step 6: Delete assignments for this class
              const { error: assignmentsError } = await tenantDatabase.delete('assignments', { class_id: classId });
              if (assignmentsError) {
                console.error('Error deleting assignments:', assignmentsError);
                throw assignmentsError;
              }

              // Step 7: Delete homeworks for this class
              const { error: homeworksError } = await tenantDatabase.delete('homeworks', { class_id: classId });
              if (homeworksError) {
                console.error('Error deleting homeworks:', homeworksError);
                throw homeworksError;
              }

              // Step 8: Delete exams for this class (marks are already deleted above)
              const { error: examsError } = await tenantDatabase.delete('exams', { class_id: classId });
              if (examsError) {
                console.error('Error deleting exams:', examsError);
                throw examsError;
              }

              // Step 9: Delete fee structures for this class
              const { error: feeStructureError } = await tenantDatabase.delete('fee_structure', { class_id: classId });
              if (feeStructureError) {
                console.error('Error deleting fee structures:', feeStructureError);
                throw feeStructureError;
              }

              // Step 10: Delete attendance records for this class
              const { error: attendanceError } = await tenantDatabase.delete('student_attendance', { class_id: classId });
              if (attendanceError) {
                console.error('Error deleting student attendance:', attendanceError);
                throw attendanceError;
              }

              // Step 11: Set class_id to null for all students in this class
              const { error: updateError } = await tenantDatabase.update('students', { class_id: classId }, { class_id: null });
              if (updateError) {
                console.error('Error updating students:', updateError);
                throw updateError;
              }

              // Step 12: Delete subjects for this class
              const { error: subjectsError } = await tenantDatabase.delete('subjects', { class_id: classId });
              if (subjectsError) {
                console.error('Error deleting subjects:', subjectsError);
                throw subjectsError;
              }

              // Step 13: Finally, delete the class
              const { error: classDeleteError } = await tenantDatabase.delete('classes', { id: classId });
              if (classDeleteError) {
                console.error('Error deleting class:', classDeleteError);
                throw classDeleteError;
              }

              console.log('Class deletion completed successfully');
              await loadAllData();
              Alert.alert('Success', 'Class and all associated data deleted successfully.');
            } catch (error) {
              console.error('Failed to delete class:', error);
              Alert.alert('Error', `Failed to delete class: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const openEditModal = (classItem) => {
    // Find teacher name for display
    const teacher = teachers.find(t => t.id === classItem.class_teacher_id);
    setSelectedClass({ 
      ...classItem,
      teacher_name: teacher?.name || 'Unknown'
    });
    setIsEditModalVisible(true);
  };

  const openClassDetails = async (classItem) => {
    try {
      setSelectedClassDetails(classItem);
      
      // Fetch subjects for this class with their assigned teachers
      const { data: subjectsData, error: subjectsError } = await tenantDatabase.read(
        'subjects',
        { class_id: classItem.id },
        `*,
        teacher_subjects(
          teachers(
            id,
            name
          )
        )`
      );
      
      if (subjectsError) throw subjectsError;
      
      // Process the data to get teacher info for each subject
      const processedSubjects = subjectsData?.map(subject => ({
        ...subject,
        teacher: subject.teacher_subjects?.[0]?.teachers || null
      })) || [];
      
      setClassSubjects(processedSubjects);
      setClassDetailsModal(true);
    } catch (error) {
      console.error('Error loading class details:', error);
      Alert.alert('Error', 'Failed to load class details');
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAllData();
    } finally {
      setRefreshing(false);
    }
  };

  const renderClassItem = ({ item }) => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      );
    }

    // Find teacher name for display
    const teacher = teachers.find(t => t.id === item.class_teacher_id);

    return (
      <TouchableOpacity 
        style={styles.classCard}
        onPress={() => openClassDetails(item)}
      >
        <View style={styles.classHeader}>
          <View style={styles.classInfo}>
            <Text style={styles.className}>{item.class_name}</Text>
            <Text style={styles.classDetails}>
              Section {item.section}
            </Text>
            <Text style={styles.classTeacher}>
              Class Teacher: {teacher?.name || 'Not Assigned'}
            </Text>
          </View>
          <View style={styles.classStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.students_count || 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.subjects_count || 0}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.classActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.viewButton]}
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('StudentList', { 
                classId: item.id,
                className: item.class_name,
                section: item.section
              });
            }}
          >
            <Ionicons name="people" size={16} color="#2196F3" />
            <Text style={styles.viewButtonText}>View Students</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]}
            onPress={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
          >
            <Ionicons name="create" size={16} color="#FF9800" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteClass(item.id);
            }}
          >
            <Ionicons name="trash" size={16} color="#f44336" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModal = (isVisible, isEdit = false) => (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setIsAddModalVisible(false);
        setIsEditModalVisible(false);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.scrollWrapper}>
            <ScrollView 
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              keyboardShouldPersistTaps="handled"
              bounces={Platform.OS !== 'web'}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEdit ? 'Edit Class' : 'Add New Class'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddModalVisible(false);
                  setIsEditModalVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Class Name</Text>
                <TextInput
                  style={styles.input}
                  value={isEdit ? selectedClass?.class_name : newClass.class_name}
                  onChangeText={(text) => 
                    isEdit 
                      ? setSelectedClass({ ...selectedClass, class_name: text })
                      : setNewClass({ ...newClass, class_name: text })
                  }
                  placeholder="e.g., Class 1A"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Academic Year</Text>
                <TextInput
                  style={styles.input}
                  value={isEdit ? selectedClass?.academic_year : newClass.academic_year}
                  onChangeText={(text) => 
                    isEdit 
                      ? setSelectedClass({ ...selectedClass, academic_year: text })
                      : setNewClass({ ...newClass, academic_year: text })
                  }
                  placeholder="e.g., 2024-25"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Section</Text>
                <View style={styles.pickerDropdownContainer}>
                  <Picker
                    selectedValue={isEdit ? selectedClass?.section : newClass.section}
                    onValueChange={(itemValue) => 
                      isEdit 
                        ? setSelectedClass({ ...selectedClass, section: itemValue })
                        : setNewClass({ ...newClass, section: itemValue })
                    }
                    style={styles.pickerDropdown}
                  >
                    <Picker.Item label="Select Section" value="" />
                    {sections.map((section) => (
                      <Picker.Item key={section} label={section} value={section} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teacher (Optional)</Text>
                <View style={styles.pickerDropdownContainer}>
                  <Picker
                    selectedValue={isEdit ? selectedClass?.class_teacher_id : newClass.class_teacher_id}
                    onValueChange={(itemValue) => 
                      isEdit 
                        ? setSelectedClass({ ...selectedClass, class_teacher_id: itemValue })
                        : setNewClass({ ...newClass, class_teacher_id: itemValue })
                    }
                    style={styles.pickerDropdown}
                  >
                    <Picker.Item label="No Teacher Assigned" value="" />
                    {teachers.map((teacher) => (
                      <Picker.Item key={teacher.id} label={teacher.name} value={teacher.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={isEdit ? handleEditClass : handleAddClass}
              >
                <Text style={styles.submitButtonText}>
                  {isEdit ? 'Update Class' : 'Add Class'}
                </Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Add class details modal
  const renderClassDetailsModal = () => (
    <Modal
      visible={classDetailsModal}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setClassDetailsModal(false)}
    >
      <View style={styles.fullScreenModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {selectedClassDetails?.class_name} Details
          </Text>
          <TouchableOpacity onPress={() => setClassDetailsModal(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={[styles.scrollContainer, styles.detailsContent]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
          >
          <View style={styles.classInfoSection}>
            <Text style={styles.sectionTitle}>Class Information</Text>
            <Text style={styles.infoText}>Section: {selectedClassDetails?.section}</Text>
            <Text style={styles.infoText}>Academic Year: {selectedClassDetails?.academic_year}</Text>
            <Text style={styles.infoText}>
              Class Teacher: {teachers.find(t => t.id === selectedClassDetails?.class_teacher_id)?.name || 'Not Assigned'}
            </Text>
            <Text style={styles.infoText}>Students: {selectedClassDetails?.students_count || 0}</Text>
          </View>

          <View style={styles.subjectsSection}>
            <Text style={styles.sectionTitle}>Subjects & Teachers</Text>
            {classSubjects.length > 0 ? (
              classSubjects.map((subject, index) => (
                <View key={subject.id} style={styles.subjectItem}>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{subject.name}</Text>
                    {subject.is_optional && (
                      <Text style={styles.subjectCode}>Optional</Text>
                    )}
                  </View>
                  <Text style={styles.subjectTeacher}>
                    {subject.teacher?.name || 'No teacher assigned'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSubjectsText}>No subjects assigned to this class</Text>
            )}
          </View>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.timetableButton}
          onPress={() => {
            setClassDetailsModal(false);
            navigation.navigate('SubjectsTimetable', { classId: selectedClassDetails?.id });
          }}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.timetableButtonText}>View Timetable</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  // Render loading state
  if ((loading && classes.length === 0) || tenantLoading) {
    console.log('🔄 ManageClasses: Rendering loading state', { loading, tenantLoading, classesCount: classes.length });
    return (
      <View style={styles.fullScreenLoading}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="school-outline" size={48} color="#2196F3" style={styles.loadingIcon} />
            <ActivityIndicator size="large" color="#2196F3" style={styles.loadingSpinner} />
          </View>
          <Text style={styles.loadingTitle}>Manage Classes</Text>
          <Text style={styles.loadingText}>
            {tenantLoading ? 'Initializing tenant context...' : 'Loading classes data...'}
          </Text>
          <Text style={styles.loadingSubtext}>Please wait while we fetch the information</Text>
          {tenantName && (
            <Text style={styles.loadingTenant}>Tenant: {tenantName}</Text>
          )}
        </View>
      </View>
    );
  }
  
  // Render error state
  if (error && classes.length === 0) {
    console.log('❌ ManageClasses: Rendering error state', { error, classesCount: classes.length });
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Header title="Manage Classes" showBack={true} />
        <Text style={styles.errorText}>{error}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadAllData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: '#2196F3' }]} 
            onPress={() => {
              setError(null);
              setLoading(true);
              setTimeout(() => loadAllData(), 100);
            }}
          >
            <Text style={styles.retryButtonText}>Force Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Manage Classes" showBack={true} />
      
      {/* 🚀 Enhanced: Tenant Context Banner */}
      {tenantName && (
        <View style={styles.tenantBanner}>
          <View style={styles.tenantBannerContent}>
            <Ionicons name="business" size={16} color="#2196F3" />
            <Text style={styles.tenantBannerText}>
              Managing: {tenantName}
            </Text>
          </View>
          {tenantLoading && (
            <ActivityIndicator size={12} color="#2196F3" />
          )}
        </View>
      )}
      
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Total Classes: {classes.length}</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {(loading || tenantLoading) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>
            {tenantLoading ? 'Loading tenant context...' : 'Loading classes...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          renderItem={renderClassItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          nestedScrollEnabled={true}
          overScrollMode={Platform.OS === 'android' ? 'always' : 'never'}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshing={refreshing}
          onRefresh={onRefresh}
          getItemLayout={Platform.OS === 'web' ? undefined : (data, index) => ({
            length: 200, // Approximate item height for class cards
            offset: 200 * index,
            index,
          })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="school" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No classes found</Text>
              <Text style={styles.emptySubtext}>Add your first class to get started</Text>
            </View>
          }
        />
      )}

      {renderModal(isAddModalVisible, false)}
      {renderModal(isEditModalVisible, true)}
      {renderClassDetailsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'auto',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#2196F3',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  classTeacher: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  classStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  classActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  viewButton: {
    backgroundColor: '#e3f2fd',
  },
  viewButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  editButton: {
    backgroundColor: '#fff3e0',
  },
  editButtonText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    minHeight: 400,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  pickerDropdownContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  pickerDropdown: {
    width: '100%',
    backgroundColor: 'transparent',
    color: '#333',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  detailsContent: {
    flex: 1,
    paddingVertical: 10,
  },
  classInfoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  subjectsSection: {
    marginBottom: 20,
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  subjectCode: {
    fontSize: 12,
    color: '#666',
  },
  subjectTeacher: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  noSubjectsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  timetableButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
  },
  timetableButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Scroll wrapper styles to fix scrolling issues
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    ...Platform.select({
      web: {
        paddingBottom: 40,
      },
    }),
  },
  // Full Screen Loading Styles
  fullScreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingContent: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 48,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    minWidth: 280,
    maxWidth: 320,
  },
  loadingIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingIcon: {
    opacity: 0.3,
  },
  loadingSpinner: {
    position: 'absolute',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  errorText: {
    marginTop: 20,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  retryButton: {
    marginTop: 15,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 🚀 Enhanced: Tenant Banner Styles
  tenantBanner: {
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tenantBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginLeft: 8,
  },
  loadingTenant: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ManageClasses;