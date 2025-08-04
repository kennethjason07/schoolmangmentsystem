import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../utils/supabase';
// Helper functions for date formatting
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const formatDateForDb = (date) => {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
};

// Helper function to get grade color
const getGradeColor = (grade) => {
  switch (grade) {
    case 'A+': return '#4CAF50';
    case 'A': return '#8BC34A';
    case 'B+': return '#CDDC39';
    case 'B': return '#FFEB3B';
    case 'C': return '#FF9800';
    case 'D': return '#FF5722';
    case 'F': return '#F44336';
    default: return '#666';
  }
};

const ExamsMarks = () => {
  const navigation = useNavigation();

  // Core data states
  const [exams, setExams] = useState([]);
  const [marks, setMarks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  // Modal states
  const [addExamModalVisible, setAddExamModalVisible] = useState(false);
  const [editExamModalVisible, setEditExamModalVisible] = useState(false);
  const [marksModalVisible, setMarksModalVisible] = useState(false);
  const [classSelectionModalVisible, setClassSelectionModalVisible] = useState(false);
  const [selectedClassForMarks, setSelectedClassForMarks] = useState(null);
  const [allReportCardsModalVisible, setAllReportCardsModalVisible] = useState(false);
  const [reportCardsData, setReportCardsData] = useState([]);

  // Form states
  const [examForm, setExamForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    class_id: '',
    description: ''
  });
  const [marksForm, setMarksForm] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('start'); // 'start' or 'end'





  // Load data using schema.txt structure
  const loadAllData = async () => {
    try {
      setLoading(true);

      // Load exams (schema.txt: exams table)
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('id, name, class_id, academic_year, start_date, end_date, remarks, created_at');

      if (examsError) throw examsError;

      // Load classes (schema.txt: classes table)
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, class_name, section, academic_year, class_teacher_id, created_at');

      if (classesError) throw classesError;

      // Load subjects (schema.txt: subjects table)
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, class_id, academic_year, is_optional, created_at');

      if (subjectsError) throw subjectsError;

      // Load students (schema.txt: students table)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, admission_no, name, roll_no, class_id, academic_year, created_at');

      if (studentsError) throw studentsError;

      // Load marks (schema.txt: marks table)
      const { data: marksData, error: marksError } = await supabase
        .from('marks')
        .select('id, student_id, exam_id, subject_id, marks_obtained, grade, max_marks, remarks, created_at');

      if (marksError) throw marksError;

      // Set data
      setExams(examsData || []);
      setClasses(classesData || []);
      setSubjects(subjectsData || []);
      setStudents(studentsData || []);
      setMarks(marksData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Load data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Helper functions
  const getStudentsForClass = (classId) => {
    return students.filter(student => student.class_id === classId);
  };

  const getMarksForExam = (examId) => {
    return marks.filter(mark => mark.exam_id === examId);
  };



  // Add exam (schema.txt: exams table)
  const handleAddExam = async () => {
    try {
      if (!examForm.name || !examForm.class_id || !examForm.start_date || !examForm.end_date) {
        Alert.alert('Error', 'Please fill required fields');
        return;
      }

      const { error } = await supabase
        .from('exams')
        .insert({
          name: examForm.name,
          class_id: examForm.class_id,
          academic_year: examForm.academic_year || '2024-25',
          start_date: examForm.start_date,
          end_date: examForm.end_date,
          remarks: examForm.remarks
        });

      if (error) throw error;

      Alert.alert('Success', 'Exam created');
      setAddExamModalVisible(false);
      setExamForm({
        name: '',
        class_id: '',
        academic_year: '',
        start_date: '',
        end_date: '',
        remarks: ''
      });
      loadAllData();

    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Edit exam (using schema: exams table)
  const handleEditExam = async () => {
    try {
      if (!selectedExam || !examForm.name || !examForm.start_date || !examForm.class_id) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const examData = {
        name: examForm.name,
        class_id: examForm.class_id,
        start_date: examForm.start_date,
        end_date: examForm.end_date || examForm.start_date,
        remarks: examForm.description || null
      };

      const { error } = await supabase
        .from('exams')
        .update(examData)
        .eq('id', selectedExam.id);

      if (error) throw error;

      Alert.alert('Success', 'Exam updated successfully!');
      setEditExamModalVisible(false);
      setSelectedExam(null);
      await loadAllData();

    } catch (error) {
      console.error('Error updating exam:', error);
      Alert.alert('Error', 'Failed to update exam: ' + error.message);
    }
  };

  // Delete exam (schema.txt: exams and marks tables)
  const handleDeleteExam = (exam) => {
    Alert.alert(
      'Delete Exam',
      `Delete "${exam.name}"?`,
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              // Delete marks first (schema.txt: marks table)
              await supabase
                .from('marks')
                .delete()
                .eq('exam_id', exam.id);

              // Delete exam (schema.txt: exams table)
              const { error } = await supabase
                .from('exams')
                .delete()
                .eq('id', exam.id);

              if (error) throw error;

              Alert.alert('Success', 'Exam deleted');
              loadAllData();

            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  // Save marks (schema.txt: marks table)
  const handleBulkSaveMarks = async () => {
    try {
      if (!selectedExam) {
        Alert.alert('Error', 'Please select an exam');
        return;
      }

      const marksToSave = [];

      Object.entries(marksForm).forEach(([studentId, subjectMarks]) => {
        Object.entries(subjectMarks).forEach(([subjectId, marksObtained]) => {
          if (marksObtained && !isNaN(parseFloat(marksObtained))) {
            const marksValue = parseFloat(marksObtained);
            const maxMarks = 100;
            const percentage = (marksValue / maxMarks) * 100;
            let grade = 'F';
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B';
            else if (percentage >= 60) grade = 'C';
            else if (percentage >= 40) grade = 'D';

            marksToSave.push({
              student_id: studentId,
              exam_id: selectedExam.id,
              subject_id: subjectId,
              marks_obtained: marksValue,
              grade: grade,
              max_marks: maxMarks,
              remarks: null
            });
          }
        });
      });

      if (marksToSave.length > 0) {
        const { error } = await supabase
          .from('marks')
          .insert(marksToSave);

        if (error) throw error;

        Alert.alert('Success', `Saved marks for ${marksToSave.length} entries`);
        setMarksModalVisible(false);
        setMarksForm({});
        loadAllData();
      }

    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // UI helper functions
  const openEditExamModal = (exam) => {
    setSelectedExam(exam);
    setExamForm({
      name: exam.name,
      start_date: exam.start_date,
      end_date: exam.end_date,
      class_id: exam.class_id,
      description: exam.description || ''
    });
    setEditExamModalVisible(true);
  };

  const openMarksModal = (exam) => {
    setSelectedExam(exam);
    setClassSelectionModalVisible(true);
  };

  const selectClassForMarks = (classItem) => {
    setSelectedClassForMarks(classItem);
    setClassSelectionModalVisible(false);

    // Check if class has subjects, if not create default ones
    const classSubjects = subjects.filter(subject => subject.class_id === classItem.id);

    if (classSubjects.length === 0) {
      // Create default subjects for the class
      const defaultSubjects = ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi'];
      const newSubjects = [];

      for (const subjectName of defaultSubjects) {
        const newSubject = {
          id: `${Date.now()}-${Math.random()}`,
          name: subjectName,
          class_id: classItem.id,
          academic_year: '2024-25',
          is_optional: false,
          created_at: new Date().toISOString()
        };
        newSubjects.push(newSubject);
      }

      setSubjects(prev => [...prev, ...newSubjects]);
    }

    // Load existing marks for this exam and class
    const examMarks = getMarksForExam(selectedExam.id);
    const formData = {};

    // Filter marks for the selected class
    examMarks
      .filter(mark => {
        const student = students.find(s => s.id === mark.student_id);
        return student && student.class_id === classItem.id;
      })
      .forEach(mark => {
        if (!formData[mark.student_id]) {
          formData[mark.student_id] = {};
        }
        formData[mark.student_id][mark.subject_id] = mark.marks_obtained.toString();
      });

    setMarksForm(formData);
    setMarksModalVisible(true);
  };

  const handleDateChange = (_, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formattedDate = formatDateForDb(selectedDate);
      setExamForm(prev => ({
        ...prev,
        [datePickerType === 'start' ? 'start_date' : 'end_date']: formattedDate
      }));
    }
  };

  const handleMarksChange = (studentId, subjectId, value) => {
    setMarksForm(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: value
      }
    }));
  };

  // Add new subject
  const handleAddSubject = () => {
    console.log('Add Subject button clicked');
    setNewSubjectName('');
    setAddSubjectModalVisible(true);
  };

  // Save new subject
  const handleSaveNewSubject = () => {
    if (!newSubjectName?.trim()) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    try {
      const newSubject = {
        id: `subject-${Date.now()}`,
        name: newSubjectName.trim(),
        class_id: selectedClassForMarks?.id,
        academic_year: '2024-25',
        is_optional: false,
        created_at: new Date().toISOString()
      };

      setSubjects(prev => [...prev, newSubject]);
      setAddSubjectModalVisible(false);
      setNewSubjectName('');
      Alert.alert('Success', `Subject "${newSubjectName}" added successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add subject');
    }
  };

  // Add new student
  const handleAddStudent = () => {
    console.log('Add Student button clicked');
    setNewStudentName('');
    setAddStudentModalVisible(true);
  };

  // Save new student
  const handleSaveNewStudent = () => {
    if (!newStudentName?.trim()) {
      Alert.alert('Error', 'Please enter a student name');
      return;
    }

    try {
      const classStudents = students.filter(s => s.class_id === selectedClassForMarks?.id);
      const newStudent = {
        id: `student-${Date.now()}`,
        name: newStudentName.trim(),
        class_id: selectedClassForMarks?.id,
        roll_no: classStudents.length + 1,
        date_of_birth: null,
        gender: null,
        address: null,
        phone: null,
        email: null,
        admission_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };

      setStudents(prev => [...prev, newStudent]);
      setAddStudentModalVisible(false);
      setNewStudentName('');
      Alert.alert('Success', `Student "${newStudentName}" added successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add student');
    }
  };

  // Generate report for student
  const handleGenerateReport = (student) => {
    const studentMarks = marksForm[student.id] || {};
    const classSubjects = subjects.filter(subject => subject.class_id === selectedClassForMarks?.id);

    let reportText = `Report Card for ${student.name} (Roll #${student.roll_number || student.id})\n`;
    reportText += `Exam: ${selectedExam?.name}\n`;
    reportText += `Class: ${selectedClassForMarks?.class_name}\n\n`;
    reportText += 'Subjects and Marks:\n';

    let totalMarks = 0;
    let subjectCount = 0;

    classSubjects.forEach(subject => {
      const mark = studentMarks[subject.id] || 'Not entered';
      reportText += `${subject.name}: ${mark}\n`;
      if (mark && !isNaN(mark)) {
        totalMarks += parseInt(mark);
        subjectCount++;
      }
    });

    if (subjectCount > 0) {
      const average = (totalMarks / subjectCount).toFixed(2);
      reportText += `\nTotal: ${totalMarks}\nAverage: ${average}%`;
    }

    Alert.alert('Report Card', reportText);
  };

  // Delete subject
  const handleDeleteSubject = (subjectId) => {
    Alert.alert(
      'Delete Subject',
      'Are you sure you want to delete this subject?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSubjects(prev => prev.filter(subject => subject.id !== subjectId));
            // Also remove marks for this subject
            setMarksForm(prev => {
              const updated = { ...prev };
              Object.keys(updated).forEach(studentId => {
                if (updated[studentId][subjectId]) {
                  delete updated[studentId][subjectId];
                }
              });
              return updated;
            });
          }
        }
      ]
    );
  };

  // View all report cards
  const handleViewAllReportCards = () => {
    if (!selectedExam) {
      Alert.alert('Error', 'Please select an exam first');
      return;
    }

    const allClasses = [...new Set(students.map(s => s.class_id))];
    const reportData = [];

    allClasses.forEach(classId => {
      const classStudents = getStudentsForClass(classId);
      const className = classes.find(c => c.id === classId)?.class_name || `Class ${classId}`;
      const classSubjects = subjects.filter(subject => subject.class_id === classId);

      if (classStudents.length === 0) return;

      const classData = {
        classId,
        className,
        students: []
      };

      classStudents.forEach(student => {
        const studentMarks = marksForm[student.id] || {};
        const studentData = {
          id: student.id,
          name: student.name,
          rollNumber: student.roll_number || student.id,
          subjects: [],
          totalMarks: 0,
          maxMarks: 0,
          percentage: 0,
          grade: 'N/A'
        };

        let totalObtained = 0;
        let totalMax = 0;
        let subjectCount = 0;

        classSubjects.forEach(subject => {
          const mark = studentMarks[subject.id];
          const obtainedMarks = mark && !isNaN(mark) ? parseInt(mark) : 0;
          const maxMarks = 100; // Default max marks per subject

          studentData.subjects.push({
            id: subject.id,
            name: subject.name,
            obtainedMarks: mark || 'N/A',
            maxMarks,
            percentage: mark && !isNaN(mark) ? ((obtainedMarks / maxMarks) * 100).toFixed(1) : 'N/A'
          });

          if (mark && !isNaN(mark)) {
            totalObtained += obtainedMarks;
            totalMax += maxMarks;
            subjectCount++;
          }
        });

        if (subjectCount > 0) {
          studentData.totalMarks = totalObtained;
          studentData.maxMarks = totalMax;
          studentData.percentage = ((totalObtained / totalMax) * 100).toFixed(1);

          // Calculate grade based on percentage
          const percentage = parseFloat(studentData.percentage);
          if (percentage >= 90) studentData.grade = 'A+';
          else if (percentage >= 80) studentData.grade = 'A';
          else if (percentage >= 70) studentData.grade = 'B+';
          else if (percentage >= 60) studentData.grade = 'B';
          else if (percentage >= 50) studentData.grade = 'C';
          else if (percentage >= 40) studentData.grade = 'D';
          else studentData.grade = 'F';
        }

        classData.students.push(studentData);
      });

      // Sort students by roll number
      classData.students.sort((a, b) => {
        const rollA = parseInt(a.rollNumber) || 0;
        const rollB = parseInt(b.rollNumber) || 0;
        return rollA - rollB;
      });

      reportData.push(classData);
    });

    // Sort classes by name
    reportData.sort((a, b) => a.className.localeCompare(b.className));

    setReportCardsData(reportData);
    setAllReportCardsModalVisible(true);
  };

  // State for selected classes for marks entry
  const [selectedClassesForMarks, setSelectedClassesForMarks] = useState([]);

  // Add class to marks entry
  const handleAddClassToMarks = () => {
    const availableClasses = classes.filter(c =>
      !selectedClassesForMarks.find(sc => sc.id === c.id)
    );

    if (availableClasses.length === 0) {
      Alert.alert('Info', 'All classes are already selected');
      return;
    }

    // For now, just add the first available class
    // In a real app, you might show a picker
    const classToAdd = availableClasses[0];
    setSelectedClassesForMarks(prev => [...prev, classToAdd]);
  };

  // Remove class from marks entry
  const handleRemoveClassFromMarks = (classId) => {
    setSelectedClassesForMarks(prev => prev.filter(c => c.id !== classId));
  };

  // State for add class modal
  const [addClassModalVisible, setAddClassModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  // State for add student modal
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');

  // State for add subject modal
  const [addSubjectModalVisible, setAddSubjectModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // Add new class
  const handleAddClass = () => {
    setNewClassName('');
    setAddClassModalVisible(true);
  };

  // Save new class
  const handleSaveNewClass = () => {
    if (!newClassName?.trim()) {
      Alert.alert('Error', 'Please enter a class name');
      return;
    }

    try {
      const newClass = {
        id: `class-${Date.now()}`,
        class_name: newClassName.trim(),
        section: 'A', // Default section
        academic_year: '2024-25',
        class_teacher_id: null,
        created_at: new Date().toISOString()
      };

      setClasses(prev => [...prev, newClass]);
      setAddClassModalVisible(false);
      setNewClassName('');
      Alert.alert('Success', `Class "${newClassName}" added successfully!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add class');
    }
  };

  // Delete class
  const handleDeleteClass = (classId, className) => {
    Alert.alert(
      'Delete Class',
      `Are you sure you want to delete "${className}"? This will also remove all associated students, subjects, and marks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Remove class
            setClasses(prev => prev.filter(c => c.id !== classId));

            // Remove associated students
            setStudents(prev => prev.filter(s => s.class_id !== classId));

            // Remove associated subjects
            setSubjects(prev => prev.filter(s => s.class_id !== classId));

            // Remove associated marks
            setMarks(prev => prev.filter(m => {
              const student = students.find(s => s.id === m.student_id);
              return !student || student.class_id !== classId;
            }));

            // Clear selected class if it was deleted
            if (selectedClassForMarks?.id === classId) {
              setSelectedClassForMarks(null);
              setMarksForm({});
            }

            Alert.alert('Success', `Class "${className}" deleted successfully`);
          }
        }
      ]
    );
  };

  // Render exam item
  const renderExamItem = ({ item: exam }) => {
    const examMarks = getMarksForExam(exam.id);
    const studentsInClass = getStudentsForClass(exam.class_id);
    const marksEntered = examMarks.length;
    const totalStudents = studentsInClass.length;
    const isUpcoming = new Date(exam.start_date) > new Date();
    const isCompleted = new Date(exam.end_date) < new Date();

    return (
      <View style={styles.examCard}>
        <View style={styles.examHeader}>
          <View style={styles.examInfo}>
            <Text style={styles.examName}>{exam.name}</Text>
            <Text style={styles.examClass}>
              Class: {exam.classes?.class_name}-{exam.classes?.section}
            </Text>
            <Text style={styles.examDate}>
              {formatDate(exam.start_date)} - {formatDate(exam.end_date)}
            </Text>
            {exam.description && (
              <Text style={styles.examDescription}>{exam.description}</Text>
            )}
          </View>
          <View style={styles.examStats}>
            <View style={[styles.statusBadge,
              isUpcoming ? styles.upcomingBadge :
              isCompleted ? styles.completedBadge : styles.ongoingBadge
            ]}>
              <Text style={styles.statusText}>
                {isUpcoming ? 'Upcoming' : isCompleted ? 'Completed' : 'Ongoing'}
              </Text>
            </View>
            <Text style={styles.marksProgress}>
              Marks: {marksEntered}/{totalStudents} students
            </Text>
          </View>
        </View>

        <View style={styles.examActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.marksButton]}
            onPress={() => openMarksModal(exam)}
          >
            <Ionicons name="create" size={16} color="#4CAF50" />
            <Text style={styles.marksButtonText}>Enter Marks</Text>
          </TouchableOpacity>



          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditExamModal(exam)}
          >
            <Ionicons name="create-outline" size={16} color="#FF9800" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteExam(exam)}
          >
            <Ionicons name="trash" size={16} color="#f44336" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Clean up and simplify - remove unused functions



  // ... rest of the component logic remains unchanged, but ensure no duplicate or mock data blocks exist ...

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Exams & Marks" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading exams and marks...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Exams & Marks" showBack={true} onBack={() => navigation.goBack()} />



      <FlatList
        data={exams}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExamItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No exams found</Text>
            <Text style={styles.emptySubtext}>Create your first exam to get started</Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => setAddExamModalVisible(true)}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.emptyActionText}>Create First Exam</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Exam Floating Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddExamModalVisible(true)}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
      {/* Add Exam Modal */}
      <Modal
        visible={addExamModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddExamModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Exam</Text>
            <ScrollView>
              <Text style={styles.inputLabel}>Exam Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter exam name"
                value={examForm.name}
                onChangeText={text => setExamForm(prev => ({ ...prev, name: text }))}
              />

              <Text style={styles.inputLabel}>Class *</Text>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerButton}>
                  <Picker
                    selectedValue={examForm.class_id}
                    style={styles.picker}
                    onValueChange={(value) => setExamForm(prev => ({ ...prev, class_id: value }))}
                  >
                    <Picker.Item label="Select Class & Section" value="" />
                    {classes.map(classItem => (
                      <Picker.Item
                        key={classItem.id}
                        label={`${classItem.class_name} - ${classItem.section}`}
                        value={classItem.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <Text style={styles.inputLabel}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {examForm.start_date ? formatDate(examForm.start_date) : 'Select Start Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('end');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {examForm.end_date ? formatDate(examForm.end_date) : 'Select End Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter exam description (optional)"
                value={examForm.description}
                onChangeText={text => setExamForm(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />

              {showDatePicker && (
                <DateTimePicker
                  value={examForm[datePickerType === 'start' ? 'start_date' : 'end_date']
                    ? new Date(examForm[datePickerType === 'start' ? 'start_date' : 'end_date'])
                    : new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={handleAddExam}>
                <Text style={styles.modalButtonText}>Create Exam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => {
                  setAddExamModalVisible(false);
                  setExamForm({
                    name: '',
                    start_date: '',
                    end_date: '',
                    class_id: '',
                    description: ''
                  });
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Edit Exam Modal */}
      <Modal
        visible={editExamModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditExamModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Exam</Text>
            <ScrollView>
              <Text style={styles.inputLabel}>Exam Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter exam name"
                value={examForm.name}
                onChangeText={text => setExamForm(prev => ({ ...prev, name: text }))}
              />

              <Text style={styles.inputLabel}>Class *</Text>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerButton}>
                  <Picker
                    selectedValue={examForm.class_id}
                    style={styles.picker}
                    onValueChange={(value) => setExamForm(prev => ({ ...prev, class_id: value }))}
                  >
                    <Picker.Item label="Select Class & Section" value="" />
                    {classes.map(classItem => (
                      <Picker.Item
                        key={classItem.id}
                        label={`${classItem.class_name} - ${classItem.section}`}
                        value={classItem.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <Text style={styles.inputLabel}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {examForm.start_date ? formatDate(examForm.start_date) : 'Select Start Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('end');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {examForm.end_date ? formatDate(examForm.end_date) : 'Select End Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter exam description (optional)"
                value={examForm.description}
                onChangeText={text => setExamForm(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />

              {showDatePicker && (
                <DateTimePicker
                  value={examForm[datePickerType === 'start' ? 'start_date' : 'end_date']
                    ? new Date(examForm[datePickerType === 'start' ? 'start_date' : 'end_date'])
                    : new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={handleEditExam}>
                <Text style={styles.modalButtonText}>Update Exam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => {
                  setEditExamModalVisible(false);
                  setSelectedExam(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>




      {/* Edit Exam Modal - Similar to Add Modal */}
      <Modal
        visible={editExamModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditExamModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Exam</Text>
            <ScrollView>
              <Text style={styles.inputLabel}>Exam Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter exam name"
                value={examForm.name}
                onChangeText={text => setExamForm(prev => ({ ...prev, name: text }))}
              />

              <Text style={styles.inputLabel}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {examForm.start_date ? formatDate(examForm.start_date) : 'Select Start Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerType('end');
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>
                  {examForm.end_date ? formatDate(examForm.end_date) : 'Select End Date'}
                </Text>
                <Ionicons name="calendar" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter exam description (optional)"
                value={examForm.description}
                onChangeText={text => setExamForm(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />

              {showDatePicker && (
                <DateTimePicker
                  value={examForm[datePickerType === 'start' ? 'start_date' : 'end_date']
                    ? new Date(examForm[datePickerType === 'start' ? 'start_date' : 'end_date'])
                    : new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={handleEditExam}>
                <Text style={styles.modalButtonText}>Update Exam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => {
                  setEditExamModalVisible(false);
                  setSelectedExam(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Marks Entry Modal */}
      <Modal
        visible={marksModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMarksModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>
              Marks for {selectedExam?.name}
            </Text>

            {/* View All Report Cards Button */}
            <TouchableOpacity style={styles.viewReportCardsButton} onPress={handleViewAllReportCards}>
              <Ionicons name="list" size={16} color="#fff" />
              <Text style={styles.viewReportCardsButtonText}>View All Report Cards</Text>
            </TouchableOpacity>

            {selectedClassForMarks ? (
              <>
                {/* Class Selection Row */}
                <View style={styles.classSelectionRow}>
                  <View style={styles.classChip}>
                    <Ionicons name="school" size={16} color="#fff" />
                    <Text style={styles.classChipText}>{selectedClassForMarks.class_name}</Text>
                    <TouchableOpacity
                      style={styles.deleteClassButton}
                      onPress={() => {
                        setSelectedClassForMarks(null);
                        setMarksForm({});
                      }}
                    >
                      <Ionicons name="close" size={14} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noClassSelected}>
                <Text style={styles.noClassText}>Please select a class to enter marks</Text>
                <View style={styles.noClassActions}>
                  <TouchableOpacity
                    style={styles.selectClassButton}
                    onPress={() => setClassSelectionModalVisible(true)}
                  >
                    <Text style={styles.selectClassButtonText}>Select Class</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addClassButtonSmall}
                    onPress={handleAddClass}
                  >
                    <Ionicons name="add" size={16} color="#4CAF50" />
                    <Text style={styles.addClassButtonSmallText}>Add Class</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {selectedClassForMarks && (
              <>
                {/* Debug Info */}
                <View style={styles.debugInfo}>
                  <Text style={styles.debugText}>
                    Class: {selectedClassForMarks.class_name} |
                    Students: {getStudentsForClass(selectedClassForMarks?.id).length} |
                    Subjects: {subjects.filter(subject => subject.class_id === selectedClassForMarks?.id).length}
                  </Text>
                </View>

                {/* Table Container with Horizontal Scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
                  <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                      <View style={styles.studentHeaderCell}>
                        <Text style={styles.tableHeaderText}>Student</Text>
                        <TouchableOpacity style={styles.addStudentButton} onPress={handleAddStudent}>
                          <Ionicons name="add" size={16} color="#4CAF50" />
                        </TouchableOpacity>
                      </View>

                      {subjects
                        .filter(subject => subject.class_id === selectedClassForMarks?.id)
                        .map(subject => (
                          <View key={subject.id} style={styles.subjectHeaderCell}>
                            <Text style={styles.tableHeaderText} numberOfLines={1}>{subject.name}</Text>
                            <TouchableOpacity
                              style={styles.deleteSubjectButton}
                              onPress={() => handleDeleteSubject(subject.id)}
                            >
                              <Ionicons name="trash" size={14} color="#f44336" />
                            </TouchableOpacity>
                          </View>
                        ))}

                      <View style={styles.addSubjectHeaderCell}>
                        <TouchableOpacity style={styles.addSubjectButton} onPress={handleAddSubject}>
                          <Ionicons name="add" size={16} color="#4CAF50" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Table Body */}
                    <ScrollView style={{ maxHeight: 400 }}>
                      {getStudentsForClass(selectedClassForMarks?.id).length === 0 ? (
                        <View style={styles.noDataContainer}>
                          <Text style={styles.noDataText}>No students found for this class</Text>
                          <TouchableOpacity style={styles.addStudentButton} onPress={handleAddStudent}>
                            <Text style={styles.addStudentText}>Add Student</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        getStudentsForClass(selectedClassForMarks?.id).map(student => (
                          <View key={student.id} style={styles.tableRow}>
                            <View style={styles.studentCell}>
                              <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                              <Text style={styles.studentRollNumber}>(#{student.roll_no || student.id})</Text>
                            </View>

                            {subjects
                              .filter(subject => subject.class_id === selectedClassForMarks?.id)
                              .map(subject => (
                                <View key={subject.id} style={styles.markCell}>
                                  <TextInput
                                    style={styles.markInput}
                                    placeholder="0"
                                    value={marksForm[student.id]?.[subject.id] || ''}
                                    onChangeText={(value) => handleMarksChange(student.id, subject.id, value)}
                                    keyboardType="numeric"
                                    maxLength={3}
                                  />
                                </View>
                              ))}

                            <View style={styles.actionCell}>
                              <TouchableOpacity
                                style={styles.reportButton}
                                onPress={() => handleGenerateReport(student)}
                              >
                                <Ionicons name="document-text" size={16} color="#fff" />
                                <Text style={styles.reportButtonText}>Report</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </ScrollView>

                {subjects.filter(subject => subject.class_id === selectedClassForMarks?.id).length === 0 && (
                  <View style={styles.noSubjectsContainer}>
                    <Text style={styles.noSubjectsText}>No subjects found for this class</Text>
                    <TouchableOpacity style={styles.addSubjectButton} onPress={handleAddSubject}>
                      <Text style={styles.addSubjectText}>Add Subject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleBulkSaveMarks}
              >
                <Text style={styles.modalButtonText}>Save All Marks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => {
                  setMarksModalVisible(false);
                  setMarksForm({});
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Class Selection Modal */}
      <Modal
        visible={classSelectionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setClassSelectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>
              Marks for {selectedExam?.name}
            </Text>

            {/* View All Report Cards Button */}
            <TouchableOpacity style={styles.viewReportCardsButton} onPress={handleViewAllReportCards}>
              <Ionicons name="list" size={16} color="#fff" />
              <Text style={styles.viewReportCardsButtonText}>View All Report Cards</Text>
            </TouchableOpacity>

            {/* Add Class Button */}
            <TouchableOpacity style={styles.addClassButtonLarge} onPress={handleAddClass}>
              <Ionicons name="add" size={20} color="#4CAF50" />
              <Text style={styles.addClassButtonLargeText}>Add New Class</Text>
            </TouchableOpacity>

            {/* Classes List */}
            <ScrollView style={styles.classesScrollView}>
              {classes.length === 0 ? (
                <View style={styles.noClassesContainer}>
                  <Text style={styles.noClassesText}>No classes found</Text>
                  <Text style={styles.noClassesSubText}>Add a class to get started</Text>
                </View>
              ) : (
                classes.map((classItem) => (
                  <TouchableOpacity
                    key={classItem.id}
                    style={styles.classSelectionItem}
                    onPress={() => selectClassForMarks(classItem)}
                  >
                    <View style={styles.classChipLarge}>
                      <Ionicons name="school" size={20} color="#fff" />
                      <Text style={styles.classChipLargeText}>
                        {classItem.class_name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteClassButton}
                      onPress={() => handleDeleteClass(classItem.id, classItem.class_name)}
                    >
                      <Ionicons name="trash" size={16} color="#f44336" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => setClassSelectionModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Class Modal */}
      <Modal
        visible={addClassModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addClassModal}>
            <Text style={styles.addClassModalTitle}>Add New Class</Text>

            <Text style={styles.addClassLabel}>Class Name</Text>
            <TextInput
              style={styles.addClassInput}
              placeholder="e.g., Class 1, Grade 5, 10th Standard"
              value={newClassName}
              onChangeText={setNewClassName}
              autoFocus={true}
            />

            <View style={styles.addClassModalButtons}>
              <TouchableOpacity
                style={[styles.addClassModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddClassModalVisible(false);
                  setNewClassName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addClassModalButton, styles.saveButton]}
                onPress={handleSaveNewClass}
              >
                <Text style={styles.saveButtonText}>Add Class</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Student Modal */}
      <Modal
        visible={addStudentModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addClassModal}>
            <Text style={styles.addClassModalTitle}>Add New Student</Text>

            <Text style={styles.addClassLabel}>Student Name</Text>
            <TextInput
              style={styles.addClassInput}
              placeholder="e.g., John Doe, Mary Smith"
              value={newStudentName}
              onChangeText={setNewStudentName}
              autoFocus={true}
            />

            <View style={styles.addClassModalButtons}>
              <TouchableOpacity
                style={[styles.addClassModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddStudentModalVisible(false);
                  setNewStudentName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addClassModalButton, styles.saveButton]}
                onPress={handleSaveNewStudent}
              >
                <Text style={styles.saveButtonText}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        visible={addSubjectModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addClassModal}>
            <Text style={styles.addClassModalTitle}>Add New Subject</Text>

            <Text style={styles.addClassLabel}>Subject Name</Text>
            <TextInput
              style={styles.addClassInput}
              placeholder="e.g., Mathematics, English, Science"
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus={true}
            />

            <View style={styles.addClassModalButtons}>
              <TouchableOpacity
                style={[styles.addClassModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddSubjectModalVisible(false);
                  setNewSubjectName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addClassModalButton, styles.saveButton]}
                onPress={handleSaveNewSubject}
              >
                <Text style={styles.saveButtonText}>Add Subject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* All Report Cards Modal */}
      <Modal
        visible={allReportCardsModalVisible}
        animationType="slide"
        transparent={false}
      >
        <View style={styles.reportCardsContainer}>
          <View style={styles.reportCardsHeader}>
            <Text style={styles.reportCardsTitle}>
              All Report Cards - {selectedExam?.name}
            </Text>
            <TouchableOpacity
              style={styles.closeReportCardsButton}
              onPress={() => setAllReportCardsModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.reportCardsScrollView}>
            {reportCardsData.map((classData, classIndex) => (
              <View key={classData.classId} style={styles.classReportCard}>
                <View style={styles.classReportHeader}>
                  <Ionicons name="school" size={20} color="#2196F3" />
                  <Text style={styles.classReportTitle}>{classData.className}</Text>
                  <Text style={styles.studentCount}>
                    {classData.students.length} Students
                  </Text>
                </View>

                {classData.students.map((student, studentIndex) => (
                  <View key={student.id} style={styles.studentReportCard}>
                    <View style={styles.studentReportHeader}>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentReportName}>{student.name}</Text>
                        <Text style={styles.studentReportRoll}>Roll #{student.rollNumber}</Text>
                      </View>
                      <View style={styles.studentGrade}>
                        <Text style={[styles.gradeText, { color: getGradeColor(student.grade) }]}>
                          {student.grade}
                        </Text>
                        <Text style={styles.percentageText}>{student.percentage}%</Text>
                      </View>
                    </View>

                    <View style={styles.subjectsGrid}>
                      {student.subjects.map((subject, subjectIndex) => (
                        <View key={subject.id} style={styles.subjectCard}>
                          <Text style={styles.subjectName}>{subject.name}</Text>
                          <View style={styles.marksContainer}>
                            <Text style={styles.obtainedMarks}>
                              {subject.obtainedMarks}
                            </Text>
                            <Text style={styles.maxMarks}>/{subject.maxMarks}</Text>
                          </View>
                          <Text style={styles.subjectPercentage}>
                            {subject.percentage}%
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.studentSummary}>
                      <Text style={styles.totalMarksText}>
                        Total: {student.totalMarks}/{student.maxMarks}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {reportCardsData.length === 0 && (
              <View style={styles.noReportCardsContainer}>
                <Ionicons name="document-text" size={64} color="#ccc" />
                <Text style={styles.noReportCardsText}>No report cards available</Text>
                <Text style={styles.noReportCardsSubText}>
                  Add some marks to generate report cards
                </Text>
              </View>
            )}
          </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  // Statistics Section
  statsSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
  },
  buttonContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  addExamButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  printButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 5,
  },
  listContainer: {
    padding: 10,
  },
  examItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  examDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  examClass: {
    fontSize: 14,
    color: '#666',
  },
  examActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  datePickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  classSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  classLabel: {
    marginRight: 10,
    fontSize: 16,
  },
  classButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
  },
  classButtonText: {
    fontSize: 16,
  },
  marksContainer: {
    maxHeight: '80%',
  },
  studentCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  subjectLabel: {
    width: 100,
    fontSize: 14,
  },
  markInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    fontSize: 14,
  },
  marksList: {
    marginTop: 20,
  },
  markValue: {
    marginLeft: 10,
    fontSize: 14,
  },
  statsContainer: {
    marginTop: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentRoll: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  studentClass: {
    fontSize: 14,
    color: '#666',
  },
  // List styles
  listContainer: {
    padding: 16,
    paddingBottom: 100,
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
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyActionButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Exam card styles
  examCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  examClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  examDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  examDescription: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  examStats: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  upcomingBadge: {
    backgroundColor: '#E3F2FD',
  },
  ongoingBadge: {
    backgroundColor: '#E8F5E8',
  },
  completedBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  marksProgress: {
    fontSize: 12,
    color: '#666',
  },
  examActions: {
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
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  marksButton: {
    backgroundColor: '#e8f5e8',
  },
  marksButtonText: {
    color: '#4CAF50',
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginLeft: 8,
  },
  actionBtnText: {
    color: '#1976d2',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#2196F3',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fullWidthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  fullWidthButtonText: {
    color: '#1976d2',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  marksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  marksStudent: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  marksInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    width: 70,
    fontSize: 15,
    marginLeft: 10,
    backgroundColor: '#f5f5f5',
  },
  classTabsContainer: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  classTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#b3e5fc',
  },
  classTabActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  classTabText: {
    color: '#1976d2',
    fontWeight: 'bold',
    fontSize: 15,
  },
  classTabTextActive: {
    color: '#fff',
  },
  addClassTab: {
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addClassInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    padding: 8,
    marginLeft: 8,
  },
  reportButtonText: {
    color: '#1976d2',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  // Marks modal styles
  classInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
  },
  studentMarksRow: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subjectMarksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  marksInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    width: 80,
    textAlign: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 8,
  },
  maxMarks: {
    fontSize: 14,
    color: '#666',
    width: 40,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  // New layout styles
  classSubjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  classChipText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  subjectTabsContainer: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  subjectTabs: {
    paddingHorizontal: 12,
  },
  subjectTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  subjectTabText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 14,
  },
  deleteSubjectButton: {
    padding: 2,
  },
  addSubjectButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
  },
  studentRow: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  studentInfo: {
    marginBottom: 8,
  },
  studentNameChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    alignSelf: 'flex-start',
  },
  subjectMarksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  subjectMarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  subjectLabel: {
    fontSize: 14,
    color: '#333',
  },
  deleteMarkButton: {
    padding: 2,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-end',
    gap: 4,
  },
  reportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  viewReportCardsButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  viewReportCardsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  classesScrollView: {
    maxHeight: 400,
    marginBottom: 20,
  },
  classSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  classChipLarge: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  classChipLargeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteClassButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffebee',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  studentHeaderText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 16,
    flex: 1,
  },
  subjectHeaderText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
    minWidth: 80,
    textAlign: 'center',
  },
  addStudentButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#e8f5e8',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  studentRollNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  classSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    gap: 12,
  },
  deleteClassButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    marginLeft: 8,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  table: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  studentHeaderCell: {
    width: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  subjectHeaderCell: {
    minWidth: 100,
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginRight: 4,
  },
  addSubjectHeaderCell: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#2196F3',
  },
  addStudentButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  deleteSubjectButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  addSubjectButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 60,
  },
  studentCell: {
    width: 140,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  markCell: {
    minWidth: 100,
    width: 100,
    paddingHorizontal: 8,
    marginRight: 4,
  },
  actionCell: {
    width: 100,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  markInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 44,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    minHeight: 36,
  },
  reportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  studentRollNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  addClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 4,
  },
  addClassButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  noClassSelected: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noClassText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  selectClassButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  selectClassButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  debugInfo: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  addStudentText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  noSubjectsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 16,
  },
  noSubjectsText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  addSubjectText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  addClassButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    marginBottom: 16,
    gap: 8,
  },
  addClassButtonLargeText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 16,
  },
  noClassesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noClassesText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noClassesSubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  noClassActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  addClassButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 4,
  },
  addClassButtonSmallText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addClassModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addClassModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  addClassLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addClassInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 24,
  },
  addClassModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addClassModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  // Report Cards Modal Styles
  reportCardsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  reportCardsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reportCardsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeReportCardsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  reportCardsScrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  classReportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  classReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  classReportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  studentCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  studentReportCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  studentReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentReportName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentReportRoll: {
    fontSize: 14,
    color: '#666',
  },
  studentGrade: {
    alignItems: 'center',
  },
  gradeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  percentageText: {
    fontSize: 14,
    color: '#666',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  subjectCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  subjectName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
    textAlign: 'center',
  },
  marksContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  obtainedMarks: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  maxMarks: {
    fontSize: 12,
    color: '#666',
  },
  subjectPercentage: {
    fontSize: 11,
    color: '#666',
  },
  studentSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  totalMarksText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  noReportCardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noReportCardsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noReportCardsSubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default ExamsMarks;