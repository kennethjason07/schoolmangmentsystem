import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { format } from 'date-fns';
import * as Animatable from 'react-native-animatable';

export default function MarksEntry({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [examDate, setExamDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Load teacher's assigned classes and subjects
  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get teacher info using the helper function
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) throw new Error('Teacher not found');

      // Get assigned classes and subjects
      const { data: assignedData, error: assignedError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          classes(id, class_name),
          subjects(id, name)
        `)
        .eq('teacher_id', teacherData.id);

      if (assignedError) throw assignedError;

      // Organize data by class
      const classMap = new Map();
      
      assignedData.forEach(assignment => {
        const classKey = assignment.classes.id;
        
        if (!classMap.has(classKey)) {
          classMap.set(classKey, {
            id: assignment.classes.id,
            name: `${assignment.classes.class_name} - ${assignment.classes.section}`,
            classId: assignment.classes.id,
            subjects: [],
            students: []
          });
        }
        
        const classData = classMap.get(classKey);
        if (!classData.subjects.find(s => s.id === assignment.subjects.id)) {
          classData.subjects.push({
            id: assignment.subjects.id,
            name: assignment.subjects.name
          });
        }
      });

      // Get students for each class
      for (const [classKey, classData] of classMap) {
        const { data: studentsData, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no,
            classes(class_name, section)
          `)
          .eq('class_id', classData.classId)
          .order('roll_no');

        if (studentsError) throw studentsError;
        classData.students = studentsData || [];
      }

      setClasses(Array.from(classMap.values()));
      
    } catch (err) {
      setError(err.message);
      console.error('Error loading teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    loadTeacherData();

    const subscription = supabase
      .channel('marks-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.MARKS
      }, () => {
        loadTeacherData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleClassSelect = (classId) => {
    setSelectedClass(classId);
    setSelectedSubject(null);
    setMarks({});
  };

  const handleSubjectSelect = (subjectId) => {
    setSelectedSubject(subjectId);
    setMarks({});
  };

  const handleExamDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExamDate(selectedDate);
    }
  };

  const handleMarksEntry = async (studentId, marksValue) => {
    if (!selectedClass || !selectedSubject) {
      Alert.alert('Error', 'Please select class and subject first');
      return;
    }

    if (!marksValue || isNaN(marksValue) || marksValue < 0 || marksValue > 100) {
      Alert.alert('Error', 'Please enter valid marks (0-100)');
      return;
    }

    setMarks(prev => ({ ...prev, [studentId]: marksValue }));
  };

  const handleSaveMarks = async () => {
    if (!selectedClass || !selectedSubject) {
      Alert.alert('Error', 'Please select class and subject first');
      return;
    }

    const selectedClassData = classes.find(c => c.id === selectedClass);
    if (!selectedClassData) {
      Alert.alert('Error', 'Class not found');
      return;
    }

    const studentsWithMarks = selectedClassData.students.filter(student => 
      marks[student.id] && marks[student.id] > 0
    );

    if (studentsWithMarks.length === 0) {
      Alert.alert('Error', 'Please enter marks for at least one student');
      return;
    }

    try {
      setSaving(true);

      const marksData = studentsWithMarks.map(student => ({
        student_id: student.id,
        subject_id: selectedSubject,
        marks_obtained: parseInt(marks[student.id]),
        total_marks: 100,
        exam_name: 'Class Test',
        exam_date: format(examDate, 'yyyy-MM-dd'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: upsertError } = await supabase
        .from(TABLES.MARKS)
        .upsert(marksData, { 
          onConflict: 'student_id,subject_id,exam_name',
          ignoreDuplicates: false 
        });

      if (upsertError) throw upsertError;

      Alert.alert('Success', 'Marks saved successfully!');
      setMarks({});
      
    } catch (err) {
      Alert.alert('Error', err.message);
      console.error('Error saving marks:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Marks Entry" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading classes...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Marks Entry" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTeacherData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Marks Entry" showBack={true} />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTeacherData().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <View style={styles.content}>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {classes.map(classItem => (
                    <TouchableOpacity
                      key={classItem.id}
                      style={[
                        styles.classCard,
                        selectedClass === classItem.id && styles.selectedClassCard
                      ]}
                      onPress={() => handleClassSelect(classItem.id)}
                    >
                      <Text style={[
                        styles.classText,
                        selectedClass === classItem.id && styles.selectedClassText
                      ]}>
                        {classItem.name}
                      </Text>
                      <Text style={styles.studentCount}>
                        {classItem.students.length} students
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Subject Selection */}
              {selectedClass && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Select Subject</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {classes.find(c => c.id === selectedClass)?.subjects.map(subject => (
                      <TouchableOpacity
                        key={subject.id}
                        style={[
                          styles.subjectCard,
                          selectedSubject === subject.id && styles.selectedSubjectCard
                        ]}
                        onPress={() => handleSubjectSelect(subject.id)}
                      >
                        <Text style={[
                          styles.subjectText,
                          selectedSubject === subject.id && styles.selectedSubjectText
                        ]}>
                          {subject.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Exam Date */}
              {selectedClass && selectedSubject && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Exam Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={20} color="#1976d2" />
                    <Text style={styles.dateText}>
                      {format(examDate, 'dd MMM yyyy')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Students Marks Entry */}
              {selectedClass && selectedSubject && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Enter Marks</Text>
                  {classes.find(c => c.id === selectedClass)?.students.map(student => (
                    <View key={student.id} style={styles.studentRow}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentRoll}>Roll: {student.roll_no}</Text>
                      </View>
                      <TextInput
                        style={styles.marksInput}
                        value={marks[student.id]?.toString() || ''}
                        onChangeText={(value) => handleMarksEntry(student.id, value)}
                        keyboardType="numeric"
                        maxLength={3}
                        placeholder="0-100"
                      />
                    </View>
                  ))}
                  
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveMarks}
                    disabled={saving}
                  >
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Saving...' : 'Save Marks'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
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
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedClassCard: {
    backgroundColor: '#1976d2',
  },
  classText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedClassText: {
    color: '#fff',
  },
  studentCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedSubjectCard: {
    backgroundColor: '#4CAF50',
  },
  subjectText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedSubjectText: {
    color: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  studentRoll: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  marksInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 8,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
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
});