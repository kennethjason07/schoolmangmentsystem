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
          subjects(
            id, 
            name,
            classes(
              id, 
              class_name, 
              section
            )
          )
        `)
        .eq('teacher_id', teacherData.id);

      if (assignedError) throw assignedError;

      // Organize data by class
      const classMap = new Map();
      
      assignedData.forEach(assignment => {
        // Now the class data is nested under subjects
        const classData = assignment.subjects?.classes;
        if (!classData) return; // Skip if no class data
        
        const classKey = classData.id;
        
        if (!classMap.has(classKey)) {
          classMap.set(classKey, {
            id: classData.id,
            name: `${classData.class_name} - ${classData.section}`,
            classId: classData.id,
            subjects: [],
            students: []
          });
        }
        
        const classDataMap = classMap.get(classKey);
        if (!classDataMap.subjects.find(s => s.id === assignment.subjects.id)) {
          classDataMap.subjects.push({
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

    // Allow empty string (user is typing) or valid numbers 0-100
    if (marksValue !== '' && (isNaN(marksValue) || marksValue < 0 || marksValue > 100)) {
      Alert.alert('Error', 'Please enter valid marks (0-100)');
      return;
    }

    setMarks(prev => ({ ...prev, [studentId]: marksValue }));
  };

  // Helper function to calculate grade based on marks
  const calculateGrade = (marksObtained, maxMarks = 100) => {
    const percentage = (marksObtained / maxMarks) * 100;
    
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };

  // Helper function to get grade color
  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return '#4CAF50'; // Green
      case 'B+':
      case 'B':
        return '#2196F3'; // Blue
      case 'C+':
      case 'C':
        return '#FF9800'; // Orange
      case 'D':
        return '#FF5722'; // Deep Orange
      case 'F':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
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
      marks[student.id] !== undefined && marks[student.id] !== '' && !isNaN(marks[student.id]) && parseInt(marks[student.id]) >= 0
    );

    if (studentsWithMarks.length === 0) {
      Alert.alert('Error', 'Please enter marks for at least one student');
      return;
    }

    try {
      setSaving(true);

      // First, create or find the exam record
      const examName = `Class Test - ${format(examDate, 'dd MMM yyyy')}`;
      const academicYear = new Date().getFullYear() + '-' + (new Date().getFullYear() + 1).toString().slice(-2);
      
      let examId = null;
      
      // Check if exam already exists
      const { data: existingExam, error: examSearchError } = await supabase
        .from(TABLES.EXAMS)
        .select('id')
        .eq('name', examName)
        .eq('class_id', selectedClass)
        .eq('academic_year', academicYear)
        .single();

      if (examSearchError && examSearchError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned", which is expected if exam doesn't exist
        throw examSearchError;
      }

      if (existingExam) {
        examId = existingExam.id;
      } else {
        // Create new exam record
        const { data: newExam, error: examInsertError } = await supabase
          .from(TABLES.EXAMS)
          .insert({
            name: examName,
            class_id: selectedClass,
            academic_year: academicYear,
            start_date: format(examDate, 'yyyy-MM-dd'),
            end_date: format(examDate, 'yyyy-MM-dd'),
            remarks: 'Auto-created for marks entry'
          })
          .select('id')
          .single();

        if (examInsertError) throw examInsertError;
        examId = newExam.id;
      }

      // Prepare marks data with grade calculation
      const marksData = studentsWithMarks.map(student => {
        const marksObtained = parseInt(marks[student.id]);
        const maxMarks = 100;
        const grade = calculateGrade(marksObtained, maxMarks);
        
        return {
          student_id: student.id,
          subject_id: selectedSubject,
          exam_id: examId,
          marks_obtained: marksObtained,
          max_marks: maxMarks,
          grade: grade,
          remarks: `Class Test - ${format(examDate, 'dd MMM yyyy')}`,
          created_at: new Date().toISOString()
        };
      });

      const { error: upsertError } = await supabase
        .from(TABLES.MARKS)
        .upsert(marksData, { 
          onConflict: 'student_id,exam_id,subject_id',
          ignoreDuplicates: false 
        });

      if (upsertError) throw upsertError;

      Alert.alert('Success', `Marks saved successfully!\n\nExam: ${examName}\nStudents: ${studentsWithMarks.length}`);
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
                  {classes.find(c => c.id === selectedClass)?.students.map(student => {
                    const studentMarks = marks[student.id];
                    const hasValidMarks = studentMarks !== '' && !isNaN(studentMarks) && studentMarks >= 0;
                    const grade = hasValidMarks ? calculateGrade(parseInt(studentMarks)) : null;
                    const isZeroMark = studentMarks === '0' || studentMarks === 0;
                    
                    return (
                      <View key={student.id} style={styles.studentRowContainer}>
                        {isZeroMark && (
                          <View style={styles.warningMessage}>
                            <Ionicons name="warning" size={14} color="#ff9800" />
                            <Text style={styles.warningText}>Zero marks - Student was absent or failed</Text>
                          </View>
                        )}
                        <View style={styles.studentRow}>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{student.name}</Text>
                            <Text style={styles.studentRoll}>Roll: {student.roll_no}</Text>
                          </View>
                          <View style={styles.marksInputContainer}>
                            <TextInput
                              style={[
                                styles.marksInput,
                                isZeroMark && styles.zeroMarksInput
                              ]}
                              value={marks[student.id]?.toString() || ''}
                              onChangeText={(value) => handleMarksEntry(student.id, value)}
                              keyboardType="numeric"
                              maxLength={3}
                              placeholder="0-100"
                            />
                            {grade && (
                              <View style={[
                                styles.gradeDisplay,
                                { backgroundColor: getGradeColor(grade) }
                              ]}>
                                <Text style={styles.gradeText}>{grade}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  
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
  marksInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  gradeDisplay: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  studentRowContainer: {
    marginBottom: 8,
  },
  warningMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#ff9800',
    marginLeft: 6,
    fontWeight: '500',
  },
  zeroMarksInput: {
    borderColor: '#ff9800',
    borderWidth: 2,
    backgroundColor: '#fff3e0',
  },
});
