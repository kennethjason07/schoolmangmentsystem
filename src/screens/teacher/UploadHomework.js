import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { format } from 'date-fns';

const UploadHomework = () => {
  const [classes, setClasses] = useState([]);
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkDescription, setHomeworkDescription] = useState('');
  const [homeworkInstructions, setHomeworkInstructions] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingHomework, setEditingHomework] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [teacherData, setTeacherData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  // Fetch teacher's assigned classes and subjects
  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get teacher info using the helper function
      const { data: fetchedTeacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !fetchedTeacherData) throw new Error('Teacher not found');

      setTeacherData(fetchedTeacherData);

      // Get assigned classes and subjects
      const { data: assignedData, error: assignedError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('teacher_id', fetchedTeacherData.id);

      if (assignedError) throw assignedError;

      // Organize data by class
      const classMap = new Map();
      
      assignedData.forEach(assignment => {
        const classKey = assignment.subjects?.classes?.id;

        if (classKey && !classMap.has(classKey)) {
          classMap.set(classKey, {
            id: assignment.subjects.classes.id,
            name: `${assignment.subjects.classes.class_name} - ${assignment.subjects.classes.section}`,
            classId: assignment.subjects.classes.id,
            section: assignment.subjects.classes.section,
            subjects: [],
            students: []
          });
        }

        if (classKey) {
          const classData = classMap.get(classKey);
          if (!classData.subjects.find(s => s.id === assignment.subjects.id)) {
            classData.subjects.push({
              id: assignment.subjects.id,
              name: assignment.subjects.name
            });
          }
        }
      });

      // Get students for each class
      for (const [classKey, classData] of classMap) {
        const { data: studentsData, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no
          `)
          .eq('class_id', classData.classId)
          .order('roll_no');

        if (studentsError) throw studentsError;
        classData.students = studentsData || [];
      }

      setClasses(Array.from(classMap.values()));

    } catch (err) {
      setError(err.message);
      console.error('Error fetching teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch homework assignments
  const fetchHomework = async () => {
    try {
      const { data: homeworkData, error: homeworkError } = await supabase
        .from(TABLES.HOMEWORKS)
        .select(`
          *,
          classes(id, class_name, section),
          subjects(id, name)
        `)
        .order('created_at', { ascending: false });

      if (homeworkError) {
        // If table doesn't exist, just set empty array
        if (homeworkError.code === '42P01') {
          console.log('Homeworks table does not exist - using empty array');
          setHomework([]);
          return;
        }
        throw homeworkError;
      }

      setHomework(homeworkData || []);

    } catch (err) {
      console.error('Error fetching homework:', err);
      setHomework([]); // Fallback to empty array
    }
  };

  useEffect(() => {
    fetchTeacherData();
    fetchHomework();
  }, []);

  const handleClassSelect = (classId) => {
    setSelectedClass(classId);
    setSelectedSubject('');
    setSelectedStudents([]);
    
    const selectedClassData = classes.find(c => c.id === classId);
    if (selectedClassData) {
      setStudents(selectedClassData.students);
    }
  };

  const handleSubjectSelect = (subjectId) => {
    setSelectedSubject(subjectId);
  };

  const handleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllStudents = () => {
    setSelectedStudents(students.map(s => s.id));
  };

  const handleClearAllStudents = () => {
    setSelectedStudents([]);
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileInfo = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.mimeType,
        uri: file.uri,
      };

      setUploadedFiles(prev => [...prev, fileInfo]);
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleImageUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const fileInfo = {
        id: Date.now().toString(),
        name: `image_${Date.now()}.jpg`,
        size: asset.fileSize || 0,
        type: 'image/jpeg',
        uri: asset.uri,
      };

      setUploadedFiles(prev => [...prev, fileInfo]);
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleSubmitHomework = async () => {
    if (!selectedClass || !selectedSubject || !homeworkTitle.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (selectedStudents.length === 0) {
      Alert.alert('Error', 'Please select at least one student');
      return;
    }

    try {
      const selectedClassData = classes.find(c => c.id === selectedClass);
      if (!selectedClassData) {
        Alert.alert('Error', 'Selected class not found.');
        return;
      }

      const homeworkData = {
        title: homeworkTitle,
        description: homeworkDescription,
        instructions: homeworkInstructions,
        due_date: dueDate.toISOString().split('T')[0],
        class_id: selectedClassData.id,
        subject_id: selectedSubject,
        teacher_id: teacherData.id,
        assigned_students: selectedStudents,
        files: uploadedFiles
      };

      let error;

      if (editingHomework) {
        // Update existing homework
        const { error: updateError } = await supabase
          .from(TABLES.HOMEWORKS)
          .update({
            ...homeworkData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingHomework.id);
        error = updateError;
      } else {
        // Create new homework
        const { error: insertError } = await supabase
          .from(TABLES.HOMEWORKS)
          .insert(homeworkData);
        error = insertError;
      }

      if (error) {
        if (error.code === '42P01') {
          Alert.alert('Error', 'Homeworks table does not exist. Please contact your administrator to set up the database.');
          return;
        }
        throw error;
      }

      Alert.alert('Success', `Homework ${editingHomework ? 'updated' : 'assigned'} successfully!`);

      // Reset form
      setHomeworkTitle('');
      setHomeworkDescription('');
      setHomeworkInstructions('');
      setSelectedStudents([]);
      setUploadedFiles([]);
      setEditingHomework(null);
      setShowModal(false);

      // Refresh homework list
      await fetchHomework();

    } catch (err) {
      Alert.alert('Error', err.message);
      console.error('Error submitting homework:', err);
    }
  };

  const handleEditHomework = (homework) => {
    // Populate form with existing homework data
    setEditingHomework(homework);
    setHomeworkTitle(homework.title);
    setHomeworkDescription(homework.description || '');
    setHomeworkInstructions(homework.instructions || '');
    setDueDate(new Date(homework.due_date));
    setUploadedFiles(homework.files || []);

    // Set the class and subject
    setSelectedClass(homework.class_id);
    setSelectedSubject(homework.subject_id);

    // Set selected students
    setSelectedStudents(homework.assigned_students || []);

    // Find and set students for the class
    const classData = classes.find(c => c.id === homework.class_id);
    if (classData) {
      setStudents(classData.students);
    }

    setShowModal(true);
  };

  const handleNewHomework = () => {
    // Clear form for new homework
    setEditingHomework(null);
    setHomeworkTitle('');
    setHomeworkDescription('');
    setHomeworkInstructions('');
    setDueDate(new Date());
    setUploadedFiles([]);
    setShowModal(true);
  };

  const handleDeleteHomework = async (homeworkId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this homework assignment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(TABLES.HOMEWORKS)
                .delete()
                .eq('id', homeworkId);

              if (error) throw error;

              Alert.alert('Success', 'Homework deleted successfully!');
              await fetchHomework();

            } catch (err) {
              Alert.alert('Error', err.message);
              console.error('Error deleting homework:', err);
            }
          }
        }
      ]
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return 'document-text';
    if (fileType?.includes('image')) return 'image';
    if (fileType?.includes('word')) return 'document';
    return 'document';
  };

  const getHomeworkStatus = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    return today > due ? 'overdue' : 'active';
  };

  const getStatusColor = (status) => {
    return status === 'active' ? '#4CAF50' : '#f44336';
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchHomework();
    } catch (error) {
      console.error('Error refreshing homework:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Upload Homework" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Upload Homework" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTeacherData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Upload Homework" showBack={true} />
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
            tintColor={'#1976d2'}
            title="Pull to refresh homework list"
          />
        }
      >
        {classes.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="book-outline" size={48} color="#ccc" />
            <Text style={styles.noDataText}>No classes assigned</Text>
            <Text style={styles.noDataSubtext}>Contact administrator to assign classes</Text>
          </View>
        ) : (
          <>
            {/* Class Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Class</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={handleClassSelect}
                  style={styles.picker}
                >
                  <Picker.Item label="Select a class" value="" />
                  {classes.map(classItem => (
                    <Picker.Item 
                      key={classItem.id} 
                      label={classItem.name} 
                      value={classItem.id} 
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Subject Selection */}
            {selectedClass && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Subject</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedSubject}
                    onValueChange={handleSubjectSelect}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select a subject" value="" />
                    {classes.find(c => c.id === selectedClass)?.subjects.map(subject => (
                      <Picker.Item 
                        key={subject.id} 
                        label={subject.name} 
                        value={subject.id} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* Student Selection */}
            {selectedClass && students.length > 0 && (
              <View style={styles.studentSelectionCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.iconContainer}>
                      <Ionicons name="people" size={24} color="#fff" />
                    </View>
                    <View style={styles.headerTextContainer}>
                      <Text style={styles.cardTitle}>Select Students</Text>
                      <Text style={styles.cardSubtitle}>
                        Choose students for this homework assignment
                      </Text>
                    </View>
                  </View>
                  <View style={styles.studentCountContainer}>
                    <View style={styles.studentCountBadge}>
                      <Text style={styles.studentCountText}>
                        {selectedStudents.length}/{students.length}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.studentActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.selectAllButton]}
                      onPress={handleSelectAllStudents}
                      activeOpacity={0.8}
                    >
                      <View style={styles.buttonIconContainer}>
                        <Ionicons name="checkmark-done" size={14} color="#fff" />
                      </View>
                      <Text style={styles.actionButtonText}>Select All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.clearAllButton]}
                      onPress={handleClearAllStudents}
                      activeOpacity={0.8}
                    >
                      <View style={styles.buttonIconContainer}>
                        <Ionicons name="close-circle" size={14} color="#fff" />
                      </View>
                      <Text style={styles.actionButtonText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.studentListWrapper}>
                    <View style={styles.studentListContainer}>
                      <ScrollView
                        style={styles.studentList}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {students.map((student, index) => (
                          <TouchableOpacity
                            key={student.id}
                            style={[
                              styles.studentItem,
                              selectedStudents.includes(student.id) && styles.selectedStudentItem,
                              index === students.length - 1 && styles.lastStudentItem
                            ]}
                            onPress={() => handleStudentSelection(student.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.studentItemContent}>
                              <View style={[
                                styles.studentAvatar,
                                selectedStudents.includes(student.id) && styles.selectedStudentAvatar
                              ]}>
                                <Text style={styles.studentAvatarText}>
                                  {student.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.studentInfo}>
                                <Text style={[
                                  styles.studentName,
                                  selectedStudents.includes(student.id) && styles.selectedStudentName
                                ]}>
                                  {student.name}
                                </Text>
                                <Text style={styles.studentRoll}>Roll No: {student.roll_no}</Text>
                              </View>
                              <View style={styles.studentCheckbox}>
                                <Ionicons
                                  name={selectedStudents.includes(student.id) ? "checkmark-circle" : "ellipse-outline"}
                                  size={24}
                                  color={selectedStudents.includes(student.id) ? "#4CAF50" : "#ccc"}
                                />
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {students.length > 5 && (
                        <View style={styles.scrollIndicator}>
                          <Text style={styles.scrollIndicatorText}>
                            Scroll to see more students
                          </Text>
                          <Ionicons name="chevron-down" size={16} color="#666" />
                        </View>
                      )}
                    </View>
                  </View>

                  {selectedStudents.length > 0 && (
                    <View style={styles.selectionSummary}>
                      <View style={styles.summaryIcon}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                      </View>
                      <Text style={styles.summaryText}>
                        {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Upload Button */}
            {selectedClass && selectedSubject && selectedStudents.length > 0 && (
              <TouchableOpacity style={styles.uploadButton} onPress={handleNewHomework}>
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.uploadButtonText}>Upload Homework</Text>
              </TouchableOpacity>
            )}

            {/* Homework List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Homework</Text>
              {homework.length === 0 ? (
                <Text style={styles.noHomeworkText}>No homework assignments yet</Text>
              ) : (
                homework.map(hw => (
                  <View key={hw.id} style={styles.homeworkCard}>
                    <View style={styles.homeworkHeader}>
                      <Text style={styles.homeworkTitle}>{hw.title}</Text>
                      <View style={styles.homeworkActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEditHomework(hw)}
                        >
                          <Ionicons name="pencil" size={18} color="#1976d2" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleDeleteHomework(hw.id)}
                        >
                          <Ionicons name="trash" size={18} color="#f44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.homeworkDetails}>
                      {hw.classes?.class_name} - {hw.classes?.section} | {hw.subjects?.name}
                    </Text>
                    <Text style={styles.homeworkDescription}>{hw.description}</Text>
                    <Text style={styles.homeworkDueDate}>Due: {format(new Date(hw.due_date), 'dd-MM-yyyy')}</Text>
                    <View style={styles.homeworkStatus}>
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(getHomeworkStatus(hw.due_date)) }
                      ]}>
                        {getHomeworkStatus(hw.due_date)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingHomework ? 'Edit Homework' : 'Upload Homework'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#1976d2" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Homework Title:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter homework title"
                  value={homeworkTitle}
                  onChangeText={setHomeworkTitle}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description:</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter homework description"
                  value={homeworkDescription}
                  onChangeText={setHomeworkDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Instructions:</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter homework instructions"
                  value={homeworkInstructions}
                  onChangeText={setHomeworkInstructions}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#1976d2" />
                <Text style={styles.dateButtonText}>
                  Due Date: {dueDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDueDate(selectedDate);
                  }}
                />
              )}

              <View style={styles.fileSection}>
                <Text style={styles.fileSectionTitle}>Attachments</Text>
                <View style={styles.fileButtons}>
                  <TouchableOpacity style={styles.fileButton} onPress={handleFileUpload}>
                    <Ionicons name="document" size={20} color="#1976d2" />
                    <Text style={styles.fileButtonText}>Add Document</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fileButton} onPress={handleImageUpload}>
                    <Ionicons name="image" size={20} color="#1976d2" />
                    <Text style={styles.fileButtonText}>Add Image</Text>
                  </TouchableOpacity>
                </View>

                {uploadedFiles.map(file => (
                  <View key={file.id} style={styles.fileItem}>
                    <Ionicons name={getFileIcon(file.type)} size={20} color="#666" />
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName}>{file.name}</Text>
                      <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveFile(file.id)}>
                      <Ionicons name="close" size={20} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitHomework}>
                <Text style={styles.submitButtonText}>
                  {editingHomework ? 'Update Homework' : 'Submit Homework'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  picker: {
    height: 50,
  },
  // Enhanced Student Selection Card Layout
  studentSelectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  studentCountContainer: {
    alignItems: 'flex-end',
  },
  studentCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  studentCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardContent: {
    padding: 20,
  },
  studentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minWidth: 90,
  },
  selectAllButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#45a049',
  },
  clearAllButton: {
    backgroundColor: '#f44336',
    borderColor: '#da190b',
  },
  buttonIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  studentListWrapper: {
    marginBottom: 16,
  },
  studentListContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  studentList: {
    maxHeight: 240,
  },
  studentItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  lastStudentItem: {
    marginBottom: 0,
  },
  selectedStudentItem: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
    borderWidth: 2,
    elevation: 2,
  },
  studentItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedStudentAvatar: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  studentAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  selectedStudentName: {
    color: '#2e7d32',
  },
  studentRoll: {
    fontSize: 13,
    color: '#666',
  },
  studentCheckbox: {
    marginLeft: 8,
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    marginTop: 4,
  },
  scrollIndicatorText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  summaryIcon: {
    marginRight: 12,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  homeworkCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  homeworkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  homeworkTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  homeworkActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeworkDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  homeworkDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  homeworkDueDate: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  homeworkStatus: {
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '95%',
    height: '95%',
    maxHeight: '95%',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  dateButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#1976d2',
  },
  fileSection: {
    marginBottom: 4,
  },
  fileSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  fileButtons: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
  },
  fileButtonText: {
    marginLeft: 8,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    fontWeight: 'bold',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  noHomeworkText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    fontStyle: 'italic',
  },
});

export default UploadHomework; 