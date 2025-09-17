import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, FlatList, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { createBulkMarksNotifications } from '../../utils/marksNotificationHelpers';
import { validateTenantAccess, createTenantQuery, validateDataTenancy, TENANT_ERROR_MESSAGES } from '../../utils/tenantValidation';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../utils/AuthContext';

const MarksEntry = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const inputRefs = useRef({});
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  // Get exam and class data from route params
  const { exam, examClass } = route.params || {};

  // Core data states
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [marksForm, setMarksForm] = useState({});
  const [changedCells, setChangedCells] = useState(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Modal states for adding new items
  const [addSubjectModalVisible, setAddSubjectModalVisible] = useState(false);
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkFillModalVisible, setBulkFillModalVisible] = useState(false);
  const [bulkFillValue, setBulkFillValue] = useState('');
  
  // UI states
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);
  const [averageMarks, setAverageMarks] = useState({});
  const [subjectMenuVisible, setSubjectMenuVisible] = useState(null);
  const [showAdmissionNumbers, setShowAdmissionNumbers] = useState(false);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      
      // 🛡️ Validate tenant access first
      const validation = await validateTenantAccess(tenantId, user?.id, 'MarksEntry - loadData');
      if (!validation.isValid) {
        console.error('❌ MarksEntry loadData: Tenant validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        setLoading(false);
        return;
      }

      // Load subjects for the class using tenant-aware query
      const { data: subjectsData, error: subjectsError } = await createTenantQuery(tenantId, 'subjects')
        .select('id, name, class_id, academic_year, is_optional, tenant_id, created_at')
        .eq('class_id', examClass.id)
        .execute();

      if (subjectsError) throw subjectsError;

      // Load students for the class using tenant-aware query
      const { data: studentsData, error: studentsError } = await createTenantQuery(tenantId, 'students')
        .select('id, admission_no, name, roll_no, class_id, academic_year, tenant_id, created_at')
        .eq('class_id', examClass.id)
        .execute();

      if (studentsError) throw studentsError;

      // Load existing marks for this exam using tenant-aware query
      const { data: marksData, error: marksError } = await createTenantQuery(tenantId, 'marks')
        .select('id, student_id, exam_id, subject_id, marks_obtained, grade, max_marks, remarks, tenant_id, created_at')
        .eq('exam_id', exam.id)
        .execute();

      if (marksError) throw marksError;

      // 🛡️ Validate all data belongs to correct tenant
      const dataValidations = [
        { data: subjectsData, name: 'MarksEntry - Subjects' },
        { data: studentsData, name: 'MarksEntry - Students' },
        { data: marksData, name: 'MarksEntry - Marks' }
      ];
      
      for (const { data, name } of dataValidations) {
        if (data && data.length > 0) {
          const isValid = validateDataTenancy(data, tenantId, name);
          if (!isValid) {
            Alert.alert('Data Security Alert', `${name.split(' - ')[1]} data validation failed. Please contact administrator.`);
            setSubjects([]);
            setStudents([]);
            setMarks([]);
            return;
          }
        }
      }
      
      // Set validated data
      let processedSubjects = subjectsData || [];
      
      // If no subjects exist, create default ones
      if (processedSubjects.length === 0) {
        const defaultSubjects = ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi'];
        processedSubjects = defaultSubjects.map((subjectName, index) => ({
          id: `temp-${Date.now()}-${index}`,
          name: subjectName,
          class_id: examClass.id,
          academic_year: '2024-25',
          is_optional: false
        }));
      }

      setSubjects(processedSubjects);
      setStudents(studentsData || []);
      setMarks(marksData || []);

      // Initialize marks form with existing marks
      const formData = {};
      (marksData || []).forEach(mark => {
        if (!formData[mark.student_id]) {
          formData[mark.student_id] = {};
        }
        formData[mark.student_id][mark.subject_id] = mark.marks_obtained.toString();
      });
      setMarksForm(formData);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (exam && examClass) {
      loadData();
    }
  }, [exam, examClass]);

  // Handle marks change with validation
  const handleMarksChange = (studentId, subjectId, value) => {
    // Get exam max marks for validation
    const maxMarks = exam?.max_marks || 100;
    
    // Allow empty string (user is typing) or valid numbers 0 to exam max_marks (inclusive)
    if (value !== '' && (isNaN(value) || parseFloat(value) < 0 || parseFloat(value) > maxMarks)) {
      Alert.alert('Error', `Please enter valid marks (0-${maxMarks})`);
      return;
    }
    
    setMarksForm(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: value
      }
    }));
  };

  // Save all marks
  const handleBulkSaveMarks = async () => {
    try {
      console.log('🚀 [MARKS DEBUG] Starting handleBulkSaveMarks...');
      console.log('🚀 [MARKS DEBUG] Current state:', {
        exam: exam ? { id: exam.id, name: exam.name, max_marks: exam.max_marks } : 'NO EXAM',
        examClass: examClass ? { id: examClass.id, class_name: examClass.class_name } : 'NO CLASS',
        tenantId: tenantId || 'NO TENANT',
        userId: user?.id || 'NO USER',
        marksFormKeys: Object.keys(marksForm),
        marksFormSize: Object.keys(marksForm).length
      });
      
      // 🛡️ Validate tenant access first
      const validation = await validateTenantAccess(tenantId, user?.id, 'MarksEntry - handleBulkSaveMarks');
      if (!validation.isValid) {
        console.error('❌ [MARKS DEBUG] Tenant validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        return;
      }
      console.log('✅ [MARKS DEBUG] Tenant validation passed');
      
      if (!exam) {
        console.error('❌ [MARKS DEBUG] No exam provided');
        Alert.alert('Error', 'Exam information is missing');
        return;
      }

      // Use already validated tenantId from context
      if (!tenantId) {
        console.error('❌ [Admin MarksEntry] No tenant_id available for marks saving');
        Alert.alert('Error', 'Unable to determine tenant information. Please try again.');
        return;
      }
      
      console.log('✅ [Admin MarksEntry] Using validated tenant_id for marks:', tenantId);

      const marksToSave = [];
      console.log('📝 [MARKS DEBUG] Processing marks form data...', {
        marksForm: marksForm,
        examMaxMarks: exam.max_marks || 100
      });

      Object.entries(marksForm).forEach(([studentId, subjectMarks]) => {
        console.log('📝 [MARKS DEBUG] Processing student:', studentId, 'subjects:', subjectMarks);
        Object.entries(subjectMarks).forEach(([subjectId, marksObtained]) => {
          console.log('📝 [MARKS DEBUG] Processing subject:', subjectId, 'marks:', marksObtained);
          if (marksObtained && !isNaN(parseFloat(marksObtained))) {
            const marksValue = parseFloat(marksObtained);
            const maxMarks = exam.max_marks || 100; // Use exam's max_marks
            const percentage = (marksValue / maxMarks) * 100;
            let grade = 'F';
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B';
            else if (percentage >= 60) grade = 'C';
            else if (percentage >= 40) grade = 'D';

            const markRecord = {
              student_id: studentId,
              exam_id: exam.id,
              subject_id: subjectId,
              marks_obtained: marksValue,
              grade: grade,
              max_marks: maxMarks, // Store exam's max_marks
              remarks: exam.name || 'Exam', // Store exam name as remarks
              tenant_id: tenantId
            };
            
            console.log('📝 [MARKS DEBUG] Adding mark record:', markRecord);
            marksToSave.push(markRecord);
          } else {
            console.log('⚠️ [MARKS DEBUG] Skipping invalid marks:', { studentId, subjectId, marksObtained });
          }
        });
      });

      console.log('💾 [MARKS DEBUG] Final marks to save:', {
        count: marksToSave.length,
        data: marksToSave
      });
      
      if (marksToSave.length > 0) {
        // Delete existing marks for this exam first with tenant validation
        console.log('🗚 [MARKS DEBUG] Deleting existing marks for exam:', exam.id, 'tenant:', tenantId);
        const deleteResult = await supabase
          .from('marks')
          .delete()
          .eq('exam_id', exam.id)
          .eq('tenant_id', tenantId);
        
        console.log('🗚 [MARKS DEBUG] Delete result:', deleteResult);
        if (deleteResult.error) {
          console.error('❌ [MARKS DEBUG] Delete error:', deleteResult.error);
          throw deleteResult.error;
        }

        // Insert new marks
        console.log('💾 [MARKS DEBUG] Inserting new marks:', marksToSave.length, 'records');
        const { data: insertData, error: insertError } = await supabase
          .from('marks')
          .insert(marksToSave)
          .select('*'); // Get back the inserted records
        
        console.log('💾 [MARKS DEBUG] Insert result:', {
          data: insertData,
          error: insertError,
          recordsInserted: insertData ? insertData.length : 0
        });

        if (insertError) {
          console.error('❌ [MARKS DEBUG] Insert error:', insertError);
          throw insertError;
        }

        // Send marks notifications to parents silently in background
        try {
          // Use the new bulk marks notification system
          await createBulkMarksNotifications(
            marksToSave,
            exam,
            user?.id // Pass the current user ID as admin user ID
          );
        } catch (notificationError) {
          // Log error but don't show to user - notifications are secondary
          console.error('❌ [ADMIN MARKS] Error sending bulk marks notifications:', notificationError);
        }

        // Show simple success message
        Alert.alert(
          'Success',
          'Marks added successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Info', 'No marks to save');
      }

    } catch (error) {
      console.error('Error saving marks:', error);
      Alert.alert('Error', 'Failed to save marks');
    }
  };

  // Add new subject
  const handleAddSubject = () => {
    setNewSubjectName('');
    setAddSubjectModalVisible(true);
  };

  const handleSaveNewSubject = () => {
    if (!newSubjectName?.trim()) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    const newSubject = {
      id: `temp-${Date.now()}`,
      name: newSubjectName.trim(),
      class_id: examClass.id,
      academic_year: '2024-25',
      is_optional: false
    };

    setSubjects(prev => [...prev, newSubject]);
    setAddSubjectModalVisible(false);
    setNewSubjectName('');
    Alert.alert('Success', `Subject "${newSubjectName}" added successfully!`);
  };

  // Add new student
  const handleAddStudent = () => {
    setNewStudentName('');
    setAddStudentModalVisible(true);
  };

  const handleSaveNewStudent = () => {
    if (!newStudentName?.trim()) {
      Alert.alert('Error', 'Please enter a student name');
      return;
    }

    const newStudent = {
      id: `temp-${Date.now()}`,
      name: newStudentName.trim(),
      class_id: examClass.id,
      roll_no: students.length + 1,
      date_of_birth: null,
      gender: null,
      address: null,
      phone: null,
      email: null,
      admission_date: new Date().toISOString().split('T')[0]
    };

    setStudents(prev => [...prev, newStudent]);
    setAddStudentModalVisible(false);
    setNewStudentName('');
    Alert.alert('Success', `Student "${newStudentName}" added successfully!`);
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

  // Generate report for student
  const handleGenerateReport = (student) => {
    const studentMarks = marksForm[student.id] || {};

    let reportText = `Report Card for ${student.name} (Roll #${student.roll_no || student.id})\n`;
    reportText += `Exam: ${exam?.name}\n`;
    reportText += `Class: ${examClass?.class_name}\n\n`;
    reportText += 'Subjects and Marks:\n';

    let totalMarks = 0;
    let subjectCount = 0;

    subjects.forEach(subject => {
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Enter Marks" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading marks data...</Text>
        </View>
      </View>
    );
  }

  // Helper functions for improved UX
  const getStudentInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const calculateAverage = () => {
    let total = 0;
    let count = 0;
    
    Object.values(marksForm).forEach(studentMarks => {
      Object.values(studentMarks).forEach(mark => {
        if (mark && !isNaN(parseFloat(mark))) {
          total += parseFloat(mark);
          count++;
        }
      });
    });
    
    return count > 0 ? (total / count).toFixed(1) : '0';
  };

  const isMarkInvalid = (value) => {
    return value && (isNaN(parseFloat(value)) || parseFloat(value) > 100 || parseFloat(value) < 0);
  };

  const handleMarksChangeImproved = (studentId, subjectId, value) => {
    // Update marks form
    setMarksForm(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: value
      }
    }));
    
    // Track changed cells
    const cellKey = `${studentId}-${subjectId}`;
    setChangedCells(prev => new Set(prev).add(cellKey));
    setHasUnsavedChanges(true);
  };

  const handleBulkFill = () => {
    setBulkFillValue('');
    setBulkFillModalVisible(true);
  };

  const applyBulkFill = () => {
    if (!bulkFillValue || isNaN(parseFloat(bulkFillValue))) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }

    const newMarksForm = { ...marksForm };
    students.forEach(student => {
      subjects.forEach(subject => {
        if (!newMarksForm[student.id]) {
          newMarksForm[student.id] = {};
        }
        if (!newMarksForm[student.id][subject.id]) { // Only fill empty cells
          newMarksForm[student.id][subject.id] = bulkFillValue;
          const cellKey = `${student.id}-${subject.id}`;
          setChangedCells(prev => new Set(prev).add(cellKey));
        }
      });
    });

    setMarksForm(newMarksForm);
    setHasUnsavedChanges(true);
    setBulkFillModalVisible(false);
    setBulkFillValue('');
  };

  const focusNextInput = (studentIndex, subjectIndex) => {
    const nextSubjectIndex = subjectIndex + 1;
    const nextStudentIndex = studentIndex + 1;
    
    if (nextSubjectIndex < subjects.length) {
      // Move to next subject for same student
      const nextKey = `${students[studentIndex].id}-${subjects[nextSubjectIndex].id}`;
      inputRefs.current[nextKey]?.focus();
    } else if (nextStudentIndex < students.length) {
      // Move to first subject of next student
      const nextKey = `${students[nextStudentIndex].id}-${subjects[0].id}`;
      inputRefs.current[nextKey]?.focus();
    }
  };

  // Handle subject menu (three dots)
  const handleSubjectMenu = (subject) => {
    Alert.alert(
      'Subject Options',
      `What would you like to do with "${subject.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit Name',
          onPress: () => {
            setNewSubjectName(subject.name);
            setAddSubjectModalVisible(true);
          }
        },
        {
          text: 'Delete Subject',
          style: 'destructive',
          onPress: () => handleDeleteSubject(subject.id)
        }
      ]
    );
  };

  // Format student display name for cleaner UI
  const formatStudentName = (name) => {
    const words = name.split(' ');
    if (words.length > 2) {
      return `${words[0]} ${words[1].charAt(0)}.`;
    }
    return name;
  };

  // Get shortened admission/roll number
  const getStudentRollDisplay = (student) => {
    if (showAdmissionNumbers && student.admission_no) {
      return `Adm: ${student.admission_no.slice(-4)}`; // Show last 4 digits only
    }
    return `Roll: ${student.roll_no || 'N/A'}`;
  };


  if (!exam || !examClass) {
    return (
      <View style={styles.container}>
        <Header title="Enter Marks" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#f44336" />
          <Text style={styles.errorText}>Missing exam or class information</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render horizontally scrollable table with performance optimizations
  const renderTable = () => (
    <View style={styles.tableContainer}>
      {/* Single Horizontal ScrollView containing entire table */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.mainHorizontalScroll}
        contentContainerStyle={styles.mainHorizontalContent}
        // Performance optimizations for smooth scrolling
        decelerationRate="fast"
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        overScrollMode="never"
        bounces={false}
        bouncesZoom={false}
        alwaysBounceHorizontal={false}
        directionalLockEnabled={true}
        automaticallyAdjustContentInsets={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <View style={styles.tableContent}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.studentNameColumn}>
              <Text style={styles.headerText}>Student Name</Text>
            </View>
            {subjects.map((subject) => (
              <View key={subject.id} style={styles.subjectColumn}>
                <Text style={styles.headerText} numberOfLines={2}>
                  {subject.name}
                </Text>
              </View>
            ))}
          </View>
          
          {/* Table Body with vertical scroll */}
          <ScrollView 
            style={styles.tableBody} 
            showsVerticalScrollIndicator={false}
            // Performance optimizations for vertical scrolling
            removeClippedSubviews={true}
            scrollEventThrottle={16}
            decelerationRate="fast"
            overScrollMode="never"
            bounces={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            getItemLayout={(data, index) => ({
              length: 60, // minHeight from tableRow style
              offset: 60 * index,
              index,
            })}
          >
            {students.map((student, studentIndex) => (
              <View key={student.id} style={styles.tableRow}>
                {/* Student Name Cell */}
                <View style={styles.studentNameCell}>
                  <Text style={styles.studentNameText} numberOfLines={2}>
                    {student.name}
                  </Text>
                </View>
                
                {/* Subject Mark Cells */}
                {subjects.map((subject, subjectIndex) => {
                  const cellKey = `${student.id}-${subject.id}`;
                  const value = marksForm[student.id]?.[subject.id] || '';
                  const isChanged = changedCells.has(cellKey);
                  const isInvalid = value && (isNaN(value) || value > 100 || value < 0);
                  
                  return (
                    <View key={subject.id} style={styles.subjectCell}>
                      <TextInput
                        ref={ref => {
                          if (ref) {
                            inputRefs.current[cellKey] = ref;
                          }
                        }}
                        style={styles.cellInput}
                        placeholder=""
                        value={value}
                        onChangeText={(newValue) => handleMarksChangeImproved(student.id, subject.id, newValue)}
                        keyboardType="numeric"
                        maxLength={3}
                        returnKeyType="next"
                        onSubmitEditing={() => focusNextInput(studentIndex, subjectIndex)}
                        selectTextOnFocus
                        // TextInput performance optimizations
                        autoCorrect={false}
                        spellCheck={false}
                        autoCapitalize="none"
                        blurOnSubmit={false}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Enter Marks" showBack={true} onBack={() => navigation.goBack()} />
      
      {/* Compact Header */}
      <View style={styles.compactHeader}>
        {/* Class Info Badge */}
        <View style={styles.classInfoBadge}>
          <Text style={styles.classInfoText}>
            {examClass.class_name} - {examClass.section || 'A'} | Students: {students.length} | Subjects: {subjects.length}
          </Text>
        </View>
      </View>

      {/* Table Layout */}
      {renderTable()}
      
      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, hasUnsavedChanges && styles.saveButtonHighlight]}
          onPress={handleBulkSaveMarks}
        >
          <Text style={styles.saveButtonText}>
            {hasUnsavedChanges ? "Save Changes" : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Subject Modal */}
      {addSubjectModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Add New Subject</Text>

            <Text style={styles.addLabel}>Subject Name</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., Mathematics, English, Science"
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddSubjectModalVisible(false);
                  setNewSubjectName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalButton, styles.saveButton]}
                onPress={handleSaveNewSubject}
              >
                <Text style={styles.saveButtonText}>Add Subject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Add Student Modal */}
      {addStudentModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Add New Student</Text>

            <Text style={styles.addLabel}>Student Name</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., John Doe, Mary Smith"
              value={newStudentName}
              onChangeText={setNewStudentName}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddStudentModalVisible(false);
                  setNewStudentName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalButton, styles.saveButton]}
                onPress={handleSaveNewStudent}
              >
                <Text style={styles.saveButtonText}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Bulk Fill Modal */}
      {bulkFillModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Fill Empty Cells</Text>
            <Text style={styles.bulkFillDescription}>
              This will fill all empty mark cells with the same value.
            </Text>

            <Text style={styles.addLabel}>Marks (0-100)</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., 75, 80, 90"
              value={bulkFillValue}
              onChangeText={setBulkFillValue}
              keyboardType="numeric"
              maxLength={3}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setBulkFillModalVisible(false);
                  setBulkFillValue('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalButton, { backgroundColor: '#FF9800' }]}
                onPress={applyBulkFill}
              >
                <Text style={styles.saveButtonText}>Fill Empty</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  goBackButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  examInfoContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classTitle: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tableContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 8,
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
  addButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  deleteButton: {
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
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  studentRollNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  addStudentButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addStudentText: {
    color: '#fff',
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
    marginHorizontal: 16,
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addModal: {
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
  addModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 24,
  },
  addModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  bulkFillDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // New improved UI styles
  classInfoPill: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  classInfoText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  quickActionsContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  
  subjectHeadersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  subjectHeaders: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  studentNameHeader: {
    width: 180,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  subjectHeader: {
    minWidth: 110,
    width: 110,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSubjectHeader: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  subjectHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  deleteSubjectBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  
  studentsList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  studentRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  evenRow: {
    backgroundColor: '#fff',
  },
  oddRow: {
    backgroundColor: '#fafafa',
  },
  
  studentInfo: {
    width: 180,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentAdmission: {
    fontSize: 12,
    color: '#666',
  },
  
  marksScrollView: {
    flex: 1,
  },
  markInputContainer: {
    minWidth: 110,
    width: 110,
    marginRight: 8,
    position: 'relative',
  },
  markInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 42,
  },
  changedMarkInput: {
    borderColor: '#ff9800',
    backgroundColor: '#fff3e0',
  },
  invalidMarkInput: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  changedIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff9800',
  },
  
  studentActionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  
  emptyStudentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStudentsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  addFirstStudentBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstStudentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  averageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginTop: 16,
  },
  averageLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  averageValue: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  unsavedIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff5722',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  // Compact redesigned styles
  compactHeader: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classInfoBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  compactActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  compactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    minWidth: 90,
    justifyContent: 'center',
  },
  compactActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  
  // Sticky header styles
  stickyHeaderContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stickyHeader: {
    maxHeight: 50,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  stickyStudentHeader: {
    width: 180,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  stickyHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  stickySubjectHeader: {
    minWidth: 110,
    width: 110,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedStickySubjectHeader: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  stickySubjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  subjectMenuBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  
  // Enhanced mark input with larger touch targets
  markInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 48,
  },
  
  // Table Layout Styles
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    overflow: 'hidden',
  },
  
  // Main horizontal scroll container with optimizations
  mainHorizontalScroll: {
    flex: 1,
  },
  mainHorizontalContent: {
    flexGrow: 1,
    // Hardware acceleration hints
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  tableContent: {
    minWidth: '100%',
    // Performance optimizations
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  
  // Table Header
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  studentNameColumn: {
    width: 160,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
  },
  subjectColumn: {
    width: 120,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  
  // Table Body with performance optimizations
  tableBody: {
    flex: 1,
    // Enable hardware acceleration
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    minHeight: 60,
    // Row performance optimizations
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  
  // Student Name Cell
  studentNameCell: {
    width: 160,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
  },
  studentNameText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
  },
  
  // Subject Mark Cells
  subjectCell: {
    width: 120,
    borderRightWidth: 2,
    borderRightColor: '#333',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cellInput: {
    width: '100%',
    minHeight: 44,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#333',
    // TextInput performance optimizations
    includeFontPadding: false,
    textAlignVertical: 'center',
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  
  // Cell States
  changedCell: {
    borderColor: '#FF9800',
    backgroundColor: '#fff8e1',
  },
  invalidCell: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  zeroCell: {
    borderColor: '#9c27b0',
    backgroundColor: '#f3e5f5',
  },
  
  // Changed indicator dot
  changedDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  
  // Save Button
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonHighlight: {
    backgroundColor: '#1976d2',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  
  // Horizontal Scrolling Table Layout Styles
  headerContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  
  // Fixed student name header
  fixedStudentNameHeader: {
    width: 160,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    zIndex: 1,
  },
  
  // Scrollable subjects header container
  scrollableHeaderContainer: {
    flex: 1,
  },
  scrollableHeaderContent: {
    flexDirection: 'row',
  },
  
  // Individual scrollable subject columns in header
  scrollableSubjectColumn: {
    width: 120,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  
  // Fixed student name cell in rows
  fixedStudentNameCell: {
    width: 160,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  
  // Scrollable row container
  scrollableRowContainer: {
    flex: 1,
  },
  scrollableRowContent: {
    flexDirection: 'row',
  },
  
  // Individual scrollable subject cells in rows
  scrollableSubjectCell: {
    width: 120,
    borderRightWidth: 2,
    borderRightColor: '#333',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
});

export default MarksEntry;
