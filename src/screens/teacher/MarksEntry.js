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
import { createGradeNotification } from '../../utils/gradeNotificationHelpers';

export default function MarksEntry({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
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

      // Get students for each class with parent information
      for (const [classKey, classData] of classMap) {
        const { data: studentsData, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no,
            parent_id,
            classes(class_name, section)
          `)
          .eq('class_id', classData.classId)
          .order('roll_no');

        if (studentsError) throw studentsError;
        
        // Get parent records separately for this class (same approach as admin screen)
        const studentIds = (studentsData || []).map(s => s.id);
        const { data: parentRecords, error: parentRecordsError } = await supabase
          .from(TABLES.PARENTS)
          .select('id, name, relation, phone, email, student_id')
          .in('student_id', studentIds);

        if (parentRecordsError) {
          console.error('Error loading parent records:', parentRecordsError);
        }
        
        // Process students data to include parent information
        const processedStudents = (studentsData || []).map(student => {
          // Find parent records for this student and filter out placeholder names
          const studentParentRecords = (parentRecords || []).filter(parent => 
            parent.student_id === student.id && 
            parent.name &&
            parent.name.trim() !== '' &&
            parent.name.toLowerCase() !== 'n/a' &&
            !parent.name.toLowerCase().includes('placeholder') &&
            !parent.name.toLowerCase().includes('test') &&
            !parent.name.toLowerCase().includes('sample')
          );
          
          // Get the first valid parent record
          const primaryParent = studentParentRecords[0];
          
          // Get father, mother, guardian specifically
          const fatherRecord = studentParentRecords.find(p => p.relation && p.relation.toLowerCase() === 'father');
          const motherRecord = studentParentRecords.find(p => p.relation && p.relation.toLowerCase() === 'mother');
          const guardianRecord = studentParentRecords.find(p => p.relation && p.relation.toLowerCase() === 'guardian');
          
          // Determine which parent info to show (priority: Father > Mother > Guardian > Any)
          // Always prioritize Father if available
          let displayParent;
          if (fatherRecord) {
            displayParent = fatherRecord;
          } else if (motherRecord) {
            displayParent = motherRecord;
          } else if (guardianRecord) {
            displayParent = guardianRecord;
          } else {
            displayParent = primaryParent;
          }
          
          return {
            ...student,
            parentName: displayParent?.name || 'No Parent Info',
            parentEmail: displayParent?.email || null,
            parentPhone: displayParent?.phone || null,
            parentRelation: displayParent?.relation || null,
            allParentRecords: studentParentRecords,
            fatherRecord,
            motherRecord,
            guardianRecord
          };
        });
        
        classData.students = processedStudents;
        
        console.log(`✅ Loaded ${processedStudents.length} students for class ${classData.name}`);
        console.log('Students with parent info:', processedStudents.map(s => ({
          name: s.name,
          parentName: s.parentName,
          parentEmail: s.parentEmail
        })));
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
        // Reload marks if class, exam, and subject are already selected
        if (selectedClass && selectedExam && selectedSubject) {
          loadExistingMarks(selectedClass, selectedSubject, selectedExam);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load existing marks when class, exam, and subject are selected (including on reload)
  useEffect(() => {
    if (selectedClass && selectedExam && selectedSubject && classes.length > 0) {
      loadExistingMarks(selectedClass, selectedSubject, selectedExam);
    }
  }, [selectedClass, selectedExam, selectedSubject, classes]);

  const handleClassSelect = (classId) => {
    setSelectedClass(classId);
    setSelectedSubject(null);
    setSelectedExam(null);
    setMarks({});
    // Load exams for the selected class
    loadExamsForClass(classId);
  };

  const handleExamSelect = (examId) => {
    setSelectedExam(examId);
    setSelectedSubject(null); // Clear subject when exam changes
    setMarks({}); // Clear marks when exam changes
  };

  const handleSubjectSelect = (subjectId) => {
    setSelectedSubject(subjectId);
    setMarks({}); // Clear marks first, they will be loaded by useEffect
  };

  // Load exams for the selected class
  const loadExamsForClass = async (classId) => {
    if (!classId) return;
    
    try {
      console.log('Loading exams for class:', classId);
      
      // Load all exams for this class regardless of academic year for now
      // This ensures we see all available exams
      const { data: examsData, error: examsError } = await supabase
        .from(TABLES.EXAMS)
        .select('id, name, class_id, academic_year, start_date, end_date, remarks, max_marks, created_at')
        .eq('class_id', classId)
        .order('start_date', { ascending: false });
      
      if (examsError) {
        console.error('Error loading exams:', examsError);
        setExams([]);
        return;
      }
      
      console.log('Found exams for class', classId, ':', examsData?.length || 0);
      console.log('Exams data:', examsData);
      setExams(examsData || []);
      
    } catch (err) {
      console.error('Error loading exams:', err);
      setExams([]);
    }
  };
  
  // Load existing marks for the selected class, subject, and exam
  const loadExistingMarks = async (classId, subjectId, examId) => {
    if (!classId || !subjectId || !examId) {
      // Clear marks if any required parameter is missing
      setMarks({});
      return;
    }
    
    try {
      const selectedClassData = classes.find(c => c.id === classId);
      if (!selectedClassData || !selectedClassData.students) {
        setMarks({});
        return;
      }
      
      const studentIds = selectedClassData.students.map(s => s.id);
      
      console.log('Loading existing marks for class:', classId, 'subject:', subjectId, 'exam:', examId, 'students:', studentIds.length);
      
      // Get existing marks for this specific exam, subject, and students
      const { data: existingMarks, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select('student_id, marks_obtained, grade, created_at')
        .eq('exam_id', examId)
        .eq('subject_id', subjectId)
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });
        
      if (marksError) {
        console.error('Error loading existing marks:', marksError);
        setMarks({});
        return;
      }
      
      console.log('Found existing marks for this exam:', existingMarks?.length || 0);
      
      if (existingMarks && existingMarks.length > 0) {
        // Get the latest marks for each student for this specific exam
        const latestMarks = {};
        existingMarks.forEach(mark => {
          if (!latestMarks[mark.student_id] || new Date(mark.created_at) > new Date(latestMarks[mark.student_id].created_at)) {
            latestMarks[mark.student_id] = mark;
          }
        });
        
        // Convert to the format expected by the UI
        const marksMap = {};
        Object.entries(latestMarks).forEach(([studentId, mark]) => {
          marksMap[studentId] = mark.marks_obtained?.toString() || '';
        });
        
        console.log('Setting marks for', Object.keys(marksMap).length, 'students for exam:', examId);
        setMarks(marksMap);
      } else {
        // No existing marks found for this exam - clear the marks
        console.log('No existing marks found for this exam, clearing marks');
        setMarks({});
      }
      
    } catch (err) {
      console.error('Error loading existing marks:', err);
      setMarks({});
    }
  };


  const handleMarksEntry = async (studentId, marksValue) => {
    if (!selectedClass || !selectedSubject) {
      Alert.alert('Error', 'Please select class and subject first');
      return;
    }

    // Get exam max marks for validation
    const selectedExamData = exams.find(e => e.id === selectedExam);
    const maxMarks = selectedExamData?.max_marks || 100;
    
    // Allow empty string (user is typing) or valid numbers 0 to exam max_marks
    if (marksValue !== '' && (isNaN(marksValue) || marksValue < 0 || marksValue > maxMarks)) {
      Alert.alert('Error', `Please enter valid marks (0-${maxMarks})`);
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
    if (!selectedClass || !selectedSubject || !selectedExam) {
      Alert.alert('Error', 'Please select class, subject, and exam first');
      return;
    }

    const selectedClassData = classes.find(c => c.id === selectedClass);
    if (!selectedClassData) {
      Alert.alert('Error', 'Class not found');
      return;
    }

    const selectedExamData = exams.find(e => e.id === selectedExam);
    if (!selectedExamData) {
      Alert.alert('Error', 'Exam not found');
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

      // Prepare marks data with grade calculation
      // Note: tenant_id will be automatically handled by RLS triggers
      const marksData = studentsWithMarks.map(student => {
        const marksObtained = parseInt(marks[student.id]);
        const maxMarks = selectedExamData.max_marks || 100; // Use exam's max_marks
        const grade = calculateGrade(marksObtained, maxMarks);
        
        return {
          student_id: student.id,
          subject_id: selectedSubject,
          exam_id: selectedExam,
          marks_obtained: marksObtained,
          max_marks: maxMarks, // Store exam's max_marks
          grade: grade,
          remarks: selectedExamData.name
          // tenant_id will be automatically set by RLS trigger
        };
      });

      // Since marks table doesn't have a unique constraint (per schema.txt),
      // we need to manually handle upsert logic
      for (const markData of marksData) {
        // First, try to find existing record
        const { data: existingMark } = await supabase
          .from(TABLES.MARKS)
          .select('id')
          .eq('student_id', markData.student_id)
          .eq('exam_id', markData.exam_id)
          .eq('subject_id', markData.subject_id)
          .single();

        if (existingMark) {
          // Update existing record
          const { error: updateError } = await supabase
            .from(TABLES.MARKS)
            .update({
              marks_obtained: markData.marks_obtained,
              max_marks: markData.max_marks,
              grade: markData.grade,
              remarks: markData.remarks,
              tenant_id: markData.tenant_id
            })
            .eq('id', existingMark.id);

          if (updateError) throw updateError;
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from(TABLES.MARKS)
            .insert(markData);

          if (insertError) throw insertError;
        }
      }

      console.log('✅ Marks saved successfully, triggering parent notifications...');
      
      // Send notifications to parents silently in background
      try {
        const studentIds = studentsWithMarks.map(student => student.id);
        
        await createGradeNotification({
          classId: selectedClass,
          subjectId: selectedSubject,
          examId: selectedExam,
          teacherId: user.id, // Use user.id directly instead of teacherData
          studentIds: studentIds
        });
      } catch (notificationError) {
        // Log error but don't show to user - notifications are secondary
        console.error('⚠️ Notification error:', notificationError);
      }

      // Show simple success message
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
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
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

              {/* Exam Selection */}
              {selectedClass && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Select Exam</Text>
                  {exams.length === 0 ? (
                    <View style={styles.noExamsContainer}>
                      <Ionicons name="document-text-outline" size={48} color="#ccc" />
                      <Text style={styles.noExamsText}>No exams found</Text>
                      <Text style={styles.noExamsSubtext}>Contact administrator to create exams for this class</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {exams.map(exam => (
                        <TouchableOpacity
                          key={exam.id}
                          style={[
                            styles.examCard,
                            selectedExam === exam.id && styles.selectedExamCard
                          ]}
                          onPress={() => handleExamSelect(exam.id)}
                        >
                          <Text style={[
                            styles.examText,
                            selectedExam === exam.id && styles.selectedExamText
                          ]}>
                            {exam.name}
                          </Text>
                          <Text style={styles.examDate}>
                            {new Date(exam.start_date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Subject Selection */}
              {selectedClass && selectedExam && (
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

              {/* Students Marks Entry */}
              {selectedClass && selectedExam && selectedSubject && (() => {
                const selectedExamData = exams.find(e => e.id === selectedExam);
                const maxMarks = selectedExamData?.max_marks || 100;
                
                return (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Enter Marks</Text>
                    {classes.find(c => c.id === selectedClass)?.students.map(student => {
                      const studentMarks = marks[student.id];
                      const hasValidMarks = studentMarks !== '' && !isNaN(studentMarks) && studentMarks >= 0;
                      const grade = hasValidMarks ? calculateGrade(parseInt(studentMarks), maxMarks) : null;
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
                                style={styles.marksInput}
                                value={marks[student.id]?.toString() || ''}
                                onChangeText={(value) => handleMarksEntry(student.id, value)}
                                keyboardType="numeric"
                                maxLength={3}
                                placeholder={`0-${maxMarks}`}
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
                );
              })()}
            </>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 50 : 80, // Extra padding for keyboard
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
    backgroundColor: '#1976d2',
  },
  subjectText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedSubjectText: {
    color: '#fff',
  },
  examCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedExamCard: {
    backgroundColor: '#1976d2',
  },
  examText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedExamText: {
    color: '#fff',
  },
  examDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  noExamsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noExamsText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    fontWeight: 'bold',
  },
  noExamsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  parentName: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
    fontStyle: 'italic',
  },
  noParentInfo: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
    fontWeight: 'bold',
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
  hasExistingMarks: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#f1f8e9',
  },
  existingMarksIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
    elevation: 2,
  },
});
