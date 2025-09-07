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
import { supabase } from '../../utils/supabase';
import { useTenant } from '../../contexts/TenantContext';

const ManageClasses = ({ navigation }) => {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState(['A', 'B', 'C', 'D']);
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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Get all classes - as specified in easy.txt
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('class_name', { ascending: true });
      
      if (classError) throw classError;

      // Get student count and subjects count for each class
      const classesWithCounts = await Promise.all(
        classData.map(async (cls) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .eq('tenant_id', tenantId);
          
          const { count: subjectsCount } = await supabase
            .from('subjects')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .eq('tenant_id', tenantId);
          
          return {
            ...cls,
            students_count: count || 0,
            subjects_count: subjectsCount || 0
          };
        })
      );

      setClasses(classesWithCounts);

      // Get all teachers - as specified in easy.txt
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });
      
      if (teacherError) throw teacherError;
      setTeachers(teacherData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load classes and teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    try {
      if (!newClass.class_name || !newClass.section) {
        Alert.alert('Error', 'Please fill in class name and section');
        return;
      }

      // Insert a new class - as specified in easy.txt
      const { error } = await supabase
        .from('classes')
        .insert({
          class_name: newClass.class_name,
          academic_year: newClass.academic_year,
          section: newClass.section,
          class_teacher_id: newClass.class_teacher_id || null,
          tenant_id: tenantId,
        });

      if (error) {
        console.error('Database error adding class:', error);
        throw error;
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
      if (!selectedClass.class_name || !selectedClass.section) {
        Alert.alert('Error', 'Please fill in class name and section');
        return;
      }

      // Update a class - as specified in easy.txt
      const { error } = await supabase
        .from('classes')
        .update({
          class_name: selectedClass.class_name,
          academic_year: selectedClass.academic_year,
          section: selectedClass.section,
          class_teacher_id: selectedClass.class_teacher_id || null,
        })
        .eq('id', selectedClass.id);

      if (error) {
        console.error('Database error updating class:', error);
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
              console.log('Starting class deletion process for class ID:', classId);

              // Step 1: Get all subjects for this class to handle cascading deletes
              const { data: classSubjects } = await supabase
                .from('subjects')
                .select('id')
                .eq('class_id', classId);
              
              const subjectIds = classSubjects?.map(s => s.id) || [];
              console.log('Found subjects to delete:', subjectIds);

              // Step 2: Delete teacher_subjects assignments for these subjects
              if (subjectIds.length > 0) {
                const { error: teacherSubjectsError } = await supabase
                  .from('teacher_subjects')
                  .delete()
                  .in('subject_id', subjectIds);
                if (teacherSubjectsError) {
                  console.error('Error deleting teacher_subjects:', teacherSubjectsError);
                  throw teacherSubjectsError;
                }
              }

              // Step 3: Delete marks related to subjects in this class
              if (subjectIds.length > 0) {
                const { error: marksError } = await supabase
                  .from('marks')
                  .delete()
                  .in('subject_id', subjectIds);
                if (marksError) {
                  console.error('Error deleting marks:', marksError);
                  throw marksError;
                }
              }

              // Step 4: Delete timetable entries for this class
              const { error: timetableError } = await supabase
                .from('timetable_entries')
                .delete()
                .eq('class_id', classId);
              if (timetableError) {
                console.error('Error deleting timetable entries:', timetableError);
                throw timetableError;
              }

              // Step 5: Delete assignment submissions for assignments in this class
              const { data: classAssignments } = await supabase
                .from('assignments')
                .select('id')
                .eq('class_id', classId);
              
              const assignmentIds = classAssignments?.map(a => a.id) || [];
              if (assignmentIds.length > 0) {
                const { error: submissionsError } = await supabase
                  .from('assignment_submissions')
                  .delete()
                  .in('assignment_id', assignmentIds);
                if (submissionsError) {
                  console.error('Error deleting assignment submissions:', submissionsError);
                  throw submissionsError;
                }
              }

              // Step 6: Delete assignments for this class
              const { error: assignmentsError } = await supabase
                .from('assignments')
                .delete()
                .eq('class_id', classId);
              if (assignmentsError) {
                console.error('Error deleting assignments:', assignmentsError);
                throw assignmentsError;
              }

              // Step 7: Delete homeworks for this class
              const { error: homeworksError } = await supabase
                .from('homeworks')
                .delete()
                .eq('class_id', classId);
              if (homeworksError) {
                console.error('Error deleting homeworks:', homeworksError);
                throw homeworksError;
              }

              // Step 8: Delete exams for this class (marks are already deleted above)
              const { error: examsError } = await supabase
                .from('exams')
                .delete()
                .eq('class_id', classId);
              if (examsError) {
                console.error('Error deleting exams:', examsError);
                throw examsError;
              }

              // Step 9: Delete fee structures for this class
              const { error: feeStructureError } = await supabase
                .from('fee_structure')
                .delete()
                .eq('class_id', classId);
              if (feeStructureError) {
                console.error('Error deleting fee structures:', feeStructureError);
                throw feeStructureError;
              }

              // Step 10: Delete attendance records for this class
              const { error: attendanceError } = await supabase
                .from('student_attendance')
                .delete()
                .eq('class_id', classId);
              if (attendanceError) {
                console.error('Error deleting student attendance:', attendanceError);
                throw attendanceError;
              }

              // Step 11: Set class_id to null for all students in this class
              const { error: updateError } = await supabase
                .from('students')
                .update({ class_id: null })
                .eq('class_id', classId);
              if (updateError) {
                console.error('Error updating students:', updateError);
                throw updateError;
              }

              // Step 12: Delete subjects for this class
              const { error: subjectsError } = await supabase
                .from('subjects')
                .delete()
                .eq('class_id', classId);
              if (subjectsError) {
                console.error('Error deleting subjects:', subjectsError);
                throw subjectsError;
              }

              // Step 13: Finally, delete the class
              const { error: classDeleteError } = await supabase
                .from('classes')
                .delete()
                .eq('id', classId);
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
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select(`
          *,
          teacher_subjects(
            teachers(
              id,
              name
            )
          )
        `)
        .eq('class_id', classItem.id)
        .eq('tenant_id', tenantId);
      
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

  return (
    <View style={styles.container}>
      <Header title="Manage Classes" showBack={true} />
      
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading classes...</Text>
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
});

export default ManageClasses;
