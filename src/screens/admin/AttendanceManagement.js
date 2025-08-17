import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  FlatList,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { format } from 'date-fns';
import * as Animatable from 'react-native-animatable';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';

const AttendanceManagement = () => {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('student');
  const [classes, setClasses] = useState([]);

  const [teachers, setTeachers] = useState([]);

  const loadAllData = async () => {
    try {
      setLoading(true);

      // Load classes
      const { data: classData, error: classError } = await dbHelpers.getClasses();
      if (classError) throw classError;
      setClasses(classData || []);

      // Load teachers
      const { data: teachersData, error: teachersError } = await dbHelpers.getTeachers();
      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);

    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Load students for selected class
  const loadStudentsForClass = async (classId) => {
    try {
      if (!classId || classId === '' || classId === null) {
        setStudentsForClass([]);
        setAttendanceMark({});
        return;
      }

      console.log('Loading students for class:', classId);
      const { data: studentsData, error } = await dbHelpers.getStudentsByClass(classId);

      if (error) {
        console.error('Error loading students:', error);
        throw error;
      }

      console.log('Loaded students for class:', studentsData);
      setStudentsForClass(studentsData || []);

    } catch (error) {
      console.error('Error loading students for class:', error);
      Alert.alert('Error', 'Failed to load students for selected class');
      setStudentsForClass([]);
    }
  };

  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [teacherAttendanceRecords, setTeacherAttendanceRecords] = useState({});
  const [teacherAttendanceMark, setTeacherAttendanceMark] = useState({});
  const [teacherDate, setTeacherDate] = useState(new Date());
  const [teacherShowDatePicker, setTeacherShowDatePicker] = useState(false);
  const [teacherViewModalVisible, setTeacherViewModalVisible] = useState(false);
  const [teacherViewDate, setTeacherViewDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState(null);
  const [editMode, setEditMode] = useState({});
  const [teacherEditMode, setTeacherEditMode] = useState({});
  const [isEditable, setIsEditable] = useState(true);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceMark, setAttendanceMark] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewClass, setViewClass] = useState(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [studentsForClass, setStudentsForClass] = useState([]); // State for filtered students

  // Add Class Modal State
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSection, setNewClassSection] = useState('');
  const [newAcademicYear, setNewAcademicYear] = useState('2024-25');
  const [addingClass, setAddingClass] = useState(false);

  // Handle adding new class
  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      Alert.alert('Error', 'Please enter a class name');
      return;
    }

    if (!newClassSection.trim()) {
      Alert.alert('Error', 'Please enter a section');
      return;
    }

    if (!newAcademicYear.trim()) {
      Alert.alert('Error', 'Please enter an academic year');
      return;
    }

    try {
      setAddingClass(true);

      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .insert([
          {
            class_name: newClassName.trim(),
            section: newClassSection.trim(),
            academic_year: newAcademicYear,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;

      // Refresh classes list
      await loadAllData();

      // Select the newly created class
      if (data && data.length > 0) {
        setSelectedClass(data[0].id);
      }

      // Reset form and close modal
      setNewClassName('');
      setNewClassSection('');
      setNewAcademicYear('2024-25');
      setShowAddClassModal(false);

      Alert.alert('Success', 'Class added successfully!');

    } catch (error) {
      console.error('Error adding class:', error);
      Alert.alert('Error', `Failed to add class: ${error.message}`);
    } finally {
      setAddingClass(false);
    }
  };

  // Load students when selectedClass changes
  useEffect(() => {
    loadStudentsForClass(selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    loadAllData();
  }, []);

  // Helper function to validate date
  const isValidDate = (date) => {
    if (!date) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d) && d.toString() !== 'Invalid Date';
  };

  // Helper function to format date as dd-mm-yyyy
  const formatDateDMY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    try {
      const [y, m, d] = dateStr.split('-');
      if (!y || !m || !d) return '';
      return `${d}-${m}-${y}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  // Load existing attendance from database
  const loadExistingAttendance = async (classId, date) => {
    try {
      const { data: existingAttendance, error } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', date);

      if (error) throw error;

      const attendanceMap = {};
      existingAttendance?.forEach(record => {
        attendanceMap[record.student_id] = record.status;
      });

      return attendanceMap;
    } catch (error) {
      console.error('Error loading existing attendance:', error);
      return {};
    }
  };

  // Load existing teacher attendance from database
  const loadExistingTeacherAttendance = async (date) => {
    try {
      const { data: existingAttendance, error } = await supabase
        .from(TABLES.TEACHER_ATTENDANCE)
        .select('teacher_id, status')
        .eq('date', date);

      if (error) throw error;

      const attendanceMap = {};
      existingAttendance?.forEach(record => {
        attendanceMap[record.teacher_id] = record.status;
      });

      return attendanceMap;
    } catch (error) {
      console.error('Error loading existing teacher attendance:', error);
      return {};
    }
  };

  // When selectedClass or selectedDate changes, load attendanceMark from database
  useEffect(() => {
    if (!selectedClass || !selectedDate) return;

    const loadAttendance = async () => {
      const key = `${selectedClass}|${selectedDate.toISOString().split('T')[0]}`;
      const savedAttendance = attendanceRecords[key];

      if (savedAttendance) {
        setAttendanceMark(savedAttendance);
      } else {
        // Load from database
        const dbAttendance = await loadExistingAttendance(selectedClass, selectedDate.toISOString().split('T')[0]);
        setAttendanceMark(dbAttendance);
        // Cache it locally
        setAttendanceRecords(prev => ({
          ...prev,
          [key]: dbAttendance
        }));
      }
      setEditMode({});
    };

    loadAttendance();
  }, [selectedDate, selectedClass]);

  // When teacherDate changes, load teacherAttendanceMark from database
  useEffect(() => {
    const loadTeacherAttendance = async () => {
      const key = `${teacherDate.toISOString().split('T')[0]}`;
      const saved = teacherAttendanceRecords[key];

      if (saved) {
        setTeacherAttendanceMark(saved);
      } else {
        // Load from database
        const dbAttendance = await loadExistingTeacherAttendance(teacherDate.toISOString().split('T')[0]);
        setTeacherAttendanceMark(dbAttendance);
        // Cache it locally
        setTeacherAttendanceRecords(prev => ({
          ...prev,
          [key]: dbAttendance
        }));
      }
      setTeacherEditMode({});
    };

    loadTeacherAttendance();
  }, [teacherDate]);

  // Mark attendance for all students in modal
  const handleMarkAttendance = async () => {
    try {
      // Validate inputs before proceeding
      if (!selectedClass || selectedClass === '' || selectedClass === null) {
        Alert.alert('Error', 'Please select a class first.');
        return;
      }

      if (studentsForClass.length === 0) {
        Alert.alert('Error', 'No students found for the selected class.');
        return;
      }

      if (!isValidDate(selectedDate)) {
        Alert.alert('Error', 'Invalid date selected. Please select a valid date.');
        return;
      }

      const key = `${selectedClass}|${selectedDate.toISOString().split('T')[0]}`;
      const attendanceDate = selectedDate.toISOString().split('T')[0];

      console.log('Submitting attendance for:', {
        selectedClass,
        attendanceDate,
        studentsCount: studentsForClass.length,
        attendanceMarks: attendanceMark
      });

      // Delete existing attendance records for this class/date
      await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .delete()
        .eq('class_id', selectedClass)
        .eq('date', attendanceDate);

      // Insert new attendance records
      const records = Object.entries(attendanceMark).map(([studentId, status]) => ({
        class_id: selectedClass,
        student_id: studentId,
        date: attendanceDate,
        status: status,
        marked_by: null, // You can add current user ID here if needed
        created_at: new Date().toISOString()
      }));

      await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .insert(records);

      // Update local state
      setAttendanceRecords({
        ...attendanceRecords,
        [key]: { ...attendanceMark },
      });

      // Direct editing enabled - no edit mode needed

      // Show confirmation popup
      Alert.alert('Success', 'Attendance saved successfully! You can now edit individual records using the pencil icon.');
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance');
    }
  };

  // Handle teacher attendance marking
  const handleTeacherMarkAttendance = async () => {
    try {
      // Validate date before proceeding
      if (!isValidDate(teacherDate)) {
        Alert.alert('Error', 'Invalid date selected. Please select a valid date.');
        return;
      }

      const attendanceDate = teacherDate.toISOString().split('T')[0];

      // Delete existing teacher attendance records for this date
      await supabase
        .from(TABLES.TEACHER_ATTENDANCE)
        .delete()
        .eq('date', attendanceDate);

      // Insert new teacher attendance records
      const records = Object.entries(teacherAttendanceMark).map(([teacherId, status]) => ({
        teacher_id: teacherId,
        date: attendanceDate,
        status: status,
        marked_by: null, // You can add current user ID here if needed
        created_at: new Date().toISOString()
      }));

      await supabase
        .from(TABLES.TEACHER_ATTENDANCE)
        .insert(records);

      // Update local state
      const key = attendanceDate;
      setTeacherAttendanceRecords({
        ...teacherAttendanceRecords,
        [key]: { ...teacherAttendanceMark },
      });

      // Direct editing enabled - no edit mode needed

      // Show confirmation popup
      Alert.alert('Success', 'Teacher attendance saved successfully! You can now edit individual records using the pencil icon.');
    } catch (error) {
      console.error('Error saving teacher attendance:', error);
      Alert.alert('Error', 'Failed to save teacher attendance');
    }
  };

  // Handle date change for student attendance
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  // Handle date change for teacher attendance
  const handleTeacherDateChange = (event, selectedDate) => {
    setTeacherShowDatePicker(false);
    if (selectedDate) {
      setTeacherDate(selectedDate);
    }
  };

  // Toggle attendance status for a student
  const toggleStudentAttendance = (studentId, status) => {
    setAttendanceMark(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Toggle attendance status for a teacher
  const toggleTeacherAttendance = (teacherId, status) => {
    setTeacherAttendanceMark(prev => ({
      ...prev,
      [teacherId]: status
    }));
  };

  // Export to PDF function
  const exportToPDF = async () => {
    try {
      const attendanceDate = viewDate.toISOString().split('T')[0];
      const presentStudents = studentsForClass.filter(student => attendanceMark[student.id] === 'Present');
      const absentStudents = studentsForClass.filter(student => attendanceMark[student.id] === 'Absent');

      const presentHtml = presentStudents.map(student => 
        `<tr><td style="text-align:center;">${student.roll_no || '-'}</td><td style="text-align:center;">${student.full_name || student.name || '-'}</td></tr>`
      ).join('');

      const absentHtml = absentStudents.map(student => 
        `<tr><td style="text-align:center;">${student.roll_no || '-'}</td><td style="text-align:center;">${student.full_name || student.name || '-'}</td></tr>`
      ).join('');

      const formattedDate = formatDateDMY(attendanceDate);
      const html = `
        <h2 style="text-align:center;">Student Attendance on ${formattedDate}</h2>
        <h3 style="text-align:center;">Present Students</h3>
        <table border="1" style="border-collapse:collapse;width:100%">
          <tr><th style="text-align:center;">Roll No</th><th style="text-align:center;">Student Name</th></tr>
          ${presentHtml || '<tr><td style="text-align:center;">-</td><td style="text-align:center;">-</td></tr>'}
        </table>
        <h3 style="text-align:center;">Absent Students</h3>
        <table border="1" style="border-collapse:collapse;width:100%">
          <tr><th style="text-align:center;">Roll No</th><th style="text-align:center;">Student Name</th></tr>
          ${absentHtml || '<tr><td style="text-align:center;">-</td><td style="text-align:center;">-</td></tr>'}
        </table>
      `;

      await Print.printAsync({ html });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export attendance');
    }
  };

  // Export teacher attendance to PDF
  const exportTeacherToPDF = async () => {
    try {
      const attendanceDate = teacherViewDate.toISOString().split('T')[0];
      const presentTeachers = teachers.filter(teacher => teacherAttendanceMark[teacher.id] === 'Present');
      const absentTeachers = teachers.filter(teacher => teacherAttendanceMark[teacher.id] === 'Absent');

      const presentHtml = presentTeachers.map(teacher => 
        `<tr><td style="text-align:center;">${teacher.id || '-'}</td><td style="text-align:center;">${teacher.name || '-'}</td></tr>`
      ).join('');

      const absentHtml = absentTeachers.map(teacher => 
        `<tr><td style="text-align:center;">${teacher.id || '-'}</td><td style="text-align:center;">${teacher.name || '-'}</td></tr>`
      ).join('');

      const formattedDate = formatDateDMY(attendanceDate);
      const html = `
        <h2 style="text-align:center;">Teacher Attendance on ${formattedDate}</h2>
        <h3 style="text-align:center;">Present Teachers</h3>
        <table border="1" style="border-collapse:collapse;width:100%">
          <tr><th style="text-align:center;">Roll No</th><th style="text-align:center;">Teacher Name</th></tr>
          ${presentHtml || '<tr><td style="text-align:center;">-</td><td style="text-align:center;">-</td></tr>'}
        </table>
        <h3 style="text-align:center;">Absent Teachers</h3>
        <table border="1" style="border-collapse:collapse;width:100%">
          <tr><th style="text-align:center;">Roll No</th><th style="text-align:center;">Teacher Name</th></tr>
          ${absentHtml || '<tr><td style="text-align:center;">-</td><td style="text-align:center;">-</td></tr>'}
        </table>
      `;

      await Print.printAsync({ html });
    } catch (error) {
      console.error('Error exporting teacher attendance:', error);
      Alert.alert('Error', 'Failed to export teacher attendance');
    }
  };

  // Render student attendance item with enhanced UI
  const renderStudentItem = ({ item, index }) => {
    const currentStatus = attendanceMark[item.id];

    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 50}
        style={[
          styles.attendanceCard,
          currentStatus === 'Present' && styles.presentCard,
          currentStatus === 'Absent' && styles.absentCard
        ]}
      >
        <View style={styles.studentInfo}>
          <View style={[
            styles.studentAvatar,
            currentStatus === 'Present' && styles.presentAvatar,
            currentStatus === 'Absent' && styles.absentAvatar
          ]}>
            <Text style={styles.avatarText}>
              {(item.full_name || item.name || '').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>{item.full_name || item.name}</Text>
            <View style={styles.studentMetaInfo}>
              <Text style={styles.studentRoll}>Roll: {item.roll_no || index + 1}</Text>
              {item.admission_no && (
                <Text style={styles.studentAdmission}>ID: {item.admission_no}</Text>
              )}
            </View>
            {currentStatus && (
              <View style={[
                styles.statusBadge,
                currentStatus === 'Present' ? styles.presentBadge : styles.absentBadge
              ]}>
                <Ionicons
                  name={currentStatus === 'Present' ? 'checkmark-circle' : 'close-circle'}
                  size={12}
                  color="#fff"
                />
                <Text style={styles.statusBadgeText}>{currentStatus}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.attendanceActions}>
          {/* Present Button */}
          <Animatable.View animation={currentStatus === 'Present' ? 'pulse' : undefined}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.presentButton,
                currentStatus === 'Present' && styles.presentButtonActive
              ]}
              onPress={() => toggleStudentAttendance(item.id, 'Present')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentStatus === 'Present' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={20}
                color={currentStatus === 'Present' ? '#fff' : '#4CAF50'}
              />
              <Text style={[
                styles.buttonText,
                currentStatus === 'Present' && styles.activeButtonText
              ]}>
                Present
              </Text>
            </TouchableOpacity>
          </Animatable.View>

          {/* Absent Button */}
          <Animatable.View animation={currentStatus === 'Absent' ? 'pulse' : undefined}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.absentButton,
                currentStatus === 'Absent' && styles.absentButtonActive
              ]}
              onPress={() => toggleStudentAttendance(item.id, 'Absent')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentStatus === 'Absent' ? 'close-circle' : 'close-circle-outline'}
                size={20}
                color={currentStatus === 'Absent' ? '#fff' : '#F44336'}
              />
              <Text style={[
                styles.buttonText,
                currentStatus === 'Absent' && styles.activeButtonText
              ]}>
                Absent
              </Text>
            </TouchableOpacity>
          </Animatable.View>

        </View>
      </Animatable.View>
    );
  };

  // Render teacher attendance item with enhanced UI
  const renderTeacherItem = ({ item, index }) => {
    const currentStatus = teacherAttendanceMark[item.id];

    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 50}
        style={[
          styles.attendanceCard,
          currentStatus === 'Present' && styles.presentCard,
          currentStatus === 'Absent' && styles.absentCard
        ]}
      >
        <View style={styles.studentInfo}>
          <View style={[
            styles.studentAvatar,
            { backgroundColor: '#FF9800' },
            currentStatus === 'Present' && styles.presentAvatar,
            currentStatus === 'Absent' && styles.absentAvatar
          ]}>
            <Text style={styles.avatarText}>
              {(item.name || '').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>{item.name}</Text>
            <View style={styles.studentMetaInfo}>
              <Text style={styles.studentRoll}>Teacher ID: {item.teacher_id || index + 1}</Text>
              {item.subject && (
                <Text style={styles.studentAdmission}>Subject: {item.subject}</Text>
              )}
            </View>
            {currentStatus && (
              <View style={[
                styles.statusBadge,
                currentStatus === 'Present' ? styles.presentBadge : styles.absentBadge
              ]}>
                <Ionicons
                  name={currentStatus === 'Present' ? 'checkmark-circle' : 'close-circle'}
                  size={12}
                  color="#fff"
                />
                <Text style={styles.statusBadgeText}>{currentStatus}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.attendanceActions}>
          {/* Present Button */}
          <Animatable.View animation={currentStatus === 'Present' ? 'pulse' : undefined}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.presentButton,
                currentStatus === 'Present' && styles.presentButtonActive
              ]}
              onPress={() => toggleTeacherAttendance(item.id, 'Present')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentStatus === 'Present' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={20}
                color={currentStatus === 'Present' ? '#fff' : '#4CAF50'}
              />
              <Text style={[
                styles.buttonText,
                currentStatus === 'Present' && styles.activeButtonText
              ]}>
                Present
              </Text>
            </TouchableOpacity>
          </Animatable.View>

          {/* Absent Button */}
          <Animatable.View animation={currentStatus === 'Absent' ? 'pulse' : undefined}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                styles.absentButton,
                currentStatus === 'Absent' && styles.absentButtonActive,
                !isEditable && currentStatus !== 'Absent' && styles.disabledButton
              ]}
              onPress={() => toggleTeacherAttendance(item.id, 'Absent')}
              disabled={!isEditable && currentStatus !== 'Absent'}
              activeOpacity={0.8}
            >
              <Ionicons
                name={currentStatus === 'Absent' ? 'close-circle' : 'close-circle-outline'}
                size={20}
                color={currentStatus === 'Absent' ? '#fff' : '#F44336'}
              />
              <Text style={[
                styles.buttonText,
                currentStatus === 'Absent' && styles.activeButtonText
              ]}>
                Absent
              </Text>
            </TouchableOpacity>
          </Animatable.View>

        </View>
      </Animatable.View>
    );
  };

  // Render header for the list
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'student' && styles.tabActive]}
          onPress={() => setTab('student')}
        >
          <Ionicons
            name="people"
            size={20}
            color={tab === 'student' ? '#fff' : '#666'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, tab === 'student' && styles.tabTextActive]}>
            Student
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'teacher' && styles.tabActive]}
          onPress={() => setTab('teacher')}
        >
          <Ionicons
            name="person"
            size={20}
            color={tab === 'teacher' ? '#fff' : '#666'}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabText, tab === 'teacher' && styles.tabTextActive]}>
            Teacher
          </Text>
        </TouchableOpacity>
      </View>

      {/* Enhanced Selection Controls */}
      {tab === 'student' ? (
        <View style={styles.selectionContainer}>
          <Text style={styles.selectionTitle}>Select Class & Date</Text>
          <View style={styles.selectionCard}>
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Class</Text>
                <TouchableOpacity
                  style={styles.addClassButton}
                  onPress={() => setShowAddClassModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#1976d2" />
                  <Text style={styles.addClassButtonText}>Add Class</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerWrapper}>
                <Ionicons name="school-outline" size={20} color="#666" style={styles.inputIcon} />
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedClass}
                    onValueChange={(itemValue) => setSelectedClass(itemValue)}
                    style={styles.picker}
                    mode="dropdown"
                  >
                    <Picker.Item label="Select Class" value={null} />
                    {classes.map(cls => (
                      <Picker.Item key={cls.id} label={`${cls.class_name}${cls.section}`} value={cls.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateInputCard}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#1976d2" style={styles.inputIcon} />
                <Text style={styles.dateInputText}>
                  {format(selectedDate, 'dd MMM yyyy')}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>

            <Animatable.View animation="fadeInUp" delay={400}>
              <TouchableOpacity
                style={[
                  styles.submitButtonCard,
                  !selectedClass && styles.disabledSubmitButton
                ]}
                onPress={() => {
                  handleMarkAttendance();
                }}
                disabled={!selectedClass}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.submitButtonText}>
                  {selectedClass ? 'Load Students' : 'Select Class First'}
                </Text>
              </TouchableOpacity>
            </Animatable.View>
          </View>
        </View>
      ) : (
        <View style={styles.selectionContainer}>
          <Text style={styles.selectionTitle}>Select Date</Text>
          <View style={styles.selectionCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateInputCard}
                onPress={() => setTeacherShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#1976d2" style={styles.inputIcon} />
                <Text style={styles.dateInputText}>
                  {format(teacherDate, 'dd MMM yyyy')}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>

            <Animatable.View animation="fadeInUp" delay={400}>
              <TouchableOpacity
                style={styles.submitButtonCard}
                onPress={() => {
                  handleTeacherMarkAttendance();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.submitButtonText}>Load Teachers</Text>
              </TouchableOpacity>
            </Animatable.View>
          </View>
        </View>
      )}

      {/* Enhanced Attendance Cards */}
      <View style={styles.tableContainer}>
        {(tab === 'student' ? studentsForClass : teachers).length > 0 ? (
          <>
            <Text style={styles.listTitle}>
              {tab === 'student' ? 'Students' : 'Teachers'} ({(tab === 'student' ? studentsForClass : teachers).length})
            </Text>
            {(tab === 'student' ? studentsForClass : teachers).map((item, index) => (
              <View key={item.id}>
                {tab === 'student' ? renderStudentItem({ item, index }) : renderTeacherItem({ item, index })}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={tab === 'student' ? 'school-outline' : 'people-outline'}
              size={48}
              color="#ccc"
            />
            <Text style={styles.emptyStateText}>
              {tab === 'student'
                ? selectedClass
                  ? 'No students found in this class'
                  : 'Please select a class to view students'
                : 'No teachers found'
              }
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Calculate attendance analytics
  const calculateAnalytics = () => {
    if (tab === 'student') {
      const presentCount = studentsForClass.filter(student => attendanceMark[student.id] === 'Present').length;
      const absentCount = studentsForClass.filter(student => attendanceMark[student.id] === 'Absent').length;
      return { present: presentCount, absent: absentCount };
    } else {
      const presentCount = teachers.filter(teacher => teacherAttendanceMark[teacher.id] === 'Present').length;
      const absentCount = teachers.filter(teacher => teacherAttendanceMark[teacher.id] === 'Absent').length;
      return { present: presentCount, absent: absentCount };
    }
  };

  const analytics = calculateAnalytics();

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Attendance Management" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Attendance Management" showBack={true} />

      {/* Enhanced Header with Quick Stats */}
      <View style={styles.quickStatsHeader}>
        <View style={styles.quickStatItem}>
          <Ionicons name="calendar-outline" size={18} color="#1976d2" />
          <Text style={styles.quickStatText}>
            {format(tab === 'student' ? selectedDate : teacherDate, 'dd MMM yyyy')}
          </Text>
        </View>
        <View style={styles.quickStatItem}>
          <Ionicons name="people-outline" size={18} color="#4CAF50" />
          <Text style={styles.quickStatText}>
            {tab === 'student' ? studentsForClass.length : teachers.length} Total
          </Text>
        </View>
        <View style={styles.quickStatItem}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FF9800" />
          <Text style={styles.quickStatText}>
            {analytics.present} Present
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadAllData}
            colors={['#1976d2']}
          />
        }
      >
        {/* Header Section */}
        {renderHeader()}

        {/* View Attendance Button */}
        {tab === 'student' && selectedClass && studentsForClass.length > 0 && (
          <View style={styles.viewButtonContainer}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => {
                setViewClass(selectedClass);
                setViewDate(selectedDate);
                setViewModalVisible(true);
              }}
            >
              <Text style={styles.viewButtonText}>View Attendance</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'teacher' && teachers.length > 0 && (
          <View style={styles.viewButtonContainer}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => {
                setTeacherViewDate(teacherDate);
                setTeacherViewModalVisible(true);
              }}
            >
              <Text style={styles.viewButtonText}>View Attendance</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Enhanced Attendance Analytics */}
        {(analytics.present > 0 || analytics.absent > 0) && (
          <View style={styles.analyticsContainer}>
            <View style={styles.analyticsHeader}>
              <Ionicons name="analytics" size={24} color="#1976d2" />
              <Text style={styles.analyticsTitle}>Live Attendance Summary</Text>
            </View>

            {/* Quick Stats Cards */}
            <View style={styles.quickStatsContainer}>
              <Animatable.View animation="fadeInLeft" delay={200} style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.statNumber}>{analytics.present}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </Animatable.View>

              <Animatable.View animation="fadeInRight" delay={400} style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="close-circle" size={24} color="#F44336" />
                </View>
                <Text style={styles.statNumber}>{analytics.absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </Animatable.View>

              <Animatable.View animation="fadeInUp" delay={600} style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="people" size={24} color="#1976d2" />
                </View>
                <Text style={styles.statNumber}>{analytics.present + analytics.absent}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </Animatable.View>
            </View>

            {/* Attendance Percentage Bar */}
            {(analytics.present + analytics.absent) > 0 && (
              <View style={styles.percentageContainer}>
                <Text style={styles.percentageTitle}>Attendance Rate</Text>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <Animatable.View
                      animation="slideInLeft"
                      delay={800}
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${(analytics.present / (analytics.present + analytics.absent)) * 100}%`
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.percentageText}>
                    {Math.round((analytics.present / (analytics.present + analytics.absent)) * 100)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Pie Chart for larger screens */}
            {Platform.OS !== 'web' && Dimensions.get('window').width > 400 && (
              <View style={styles.pieChartWrapper}>
                <CrossPlatformPieChart
                      data={[
                        {
                          name: 'Present',
                          value: analytics.present,
                          color: '#4CAF50'
                        },
                        {
                          name: 'Absent',
                          value: analytics.absent,
                          color: '#F44336'
                        }
                      ].filter(item => item.value > 0)}
                      width={Math.min(Dimensions.get('window').width - 48, 300)}
                      height={200}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#f8f9fa',
                        backgroundGradientTo: '#ffffff',
                        backgroundGradientFromOpacity: 0.1,
                        backgroundGradientToOpacity: 0.1,
                        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                        strokeWidth: 2,
                        barPercentage: 0.5,
                        useShadowColorFromDataset: false,
                      }}
                      accessor="value"
                      backgroundColor="transparent"
                      paddingLeft="20"
                      center={[0, 0]}
                      absolute={false}
                      hasLegend={false}
                      style={{
                        borderRadius: 16,
                      }}
                    />
              </View>
            )}
          </View>
        )}

        {/* Show text analytics only when pie chart is not displayed (web or no data) */}
        {(Platform.OS === 'web' || (analytics.present === 0 && analytics.absent === 0)) && (
          <View style={styles.analyticsContainer}>
            <Text style={styles.analyticsTitle}>Attendance Analytics</Text>
            <View style={styles.analyticsContent}>
              <View style={styles.analyticsItem}>
                <View style={styles.analyticsDot} />
                <Text style={styles.analyticsText}>{analytics.present} Present</Text>
              </View>
              <View style={styles.analyticsItem}>
                <View style={[styles.analyticsDot, styles.absentDot]} />
                <Text style={styles.analyticsText}>{analytics.absent} Absent</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Date Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {teacherShowDatePicker && (
        <DateTimePicker
          value={teacherDate}
          mode="date"
          display="default"
          onChange={handleTeacherDateChange}
        />
      )}

      {/* View Attendance Modal */}
      <Modal
        visible={viewModalVisible}
        onRequestClose={() => setViewModalVisible(false)}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              View Student Attendance
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setViewModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <TextInput
              style={styles.modalDateInput}
              value={format(viewDate, 'dd-MM-yyyy')}
              placeholder="Select Date"
              editable={false}
            />
            
            <View style={styles.modalTableHeader}>
              <Text style={[styles.modalTableHeaderCell, { flex: 0.7 }]}>Roll No</Text>
              <Text style={[styles.modalTableHeaderCell, { flex: 2 }]}>Student Name</Text>
              <Text style={[styles.modalTableHeaderCell, { flex: 1 }]}>Date</Text>
              <Text style={[styles.modalTableHeaderCell, { flex: 1 }]}>Status</Text>
            </View>
            
            <FlatList
              data={studentsForClass}
              renderItem={({ item }) => (
                <View style={styles.modalTableRow}>
                  <Text style={[styles.modalTableCell, { flex: 0.7 }]}>{item.roll_no || '-'}</Text>
                  <Text style={[styles.modalTableCell, { flex: 2 }]}>{item.full_name || item.name}</Text>
                  <Text style={[styles.modalTableCell, { flex: 1 }]}>{format(viewDate, 'dd-MM-yyyy')}</Text>
                  <Text style={[styles.modalTableCell, { flex: 1 }]}>{attendanceMark[item.id] === 'Present' ? 'P' : 'A'}</Text>
                </View>
              )}
              keyExtractor={item => item.id}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={exportToPDF}
              >
                <Text style={styles.exportButtonText}>Export to PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setViewModalVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Teacher View Attendance Modal */}
      <Modal
        visible={teacherViewModalVisible}
        onRequestClose={() => setTeacherViewModalVisible(false)}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              View Teacher Attendance
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setTeacherViewModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <TextInput
              style={styles.modalDateInput}
              value={format(teacherViewDate, 'dd-MM-yyyy')}
              placeholder="Select Date"
              editable={false}
            />
            
            <View style={styles.modalTableHeader}>
              <Text style={[styles.modalTableHeaderCell, { flex: 0.7 }]}>Roll No</Text>
              <Text style={[styles.modalTableHeaderCell, { flex: 2 }]}>Teacher Name</Text>
              <Text style={[styles.modalTableHeaderCell, { flex: 1 }]}>Date</Text>
              <Text style={[styles.modalTableHeaderCell, { flex: 1 }]}>Status</Text>
            </View>
            
            <FlatList
              data={teachers}
              renderItem={({ item, index }) => (
                <View style={styles.modalTableRow}>
                  <Text style={[styles.modalTableCell, { flex: 0.7 }]}>{index + 1}</Text>
                  <Text style={[styles.modalTableCell, { flex: 2 }]}>{item.name}</Text>
                  <Text style={[styles.modalTableCell, { flex: 1 }]}>{format(teacherViewDate, 'dd-MM-yyyy')}</Text>
                  <Text style={[styles.modalTableCell, { flex: 1 }]}>{teacherAttendanceMark[item.id] === 'Present' ? 'P' : 'A'}</Text>
                </View>
              )}
              keyExtractor={item => item.id}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={exportTeacherToPDF}
              >
                <Text style={styles.exportButtonText}>Export to PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setTeacherViewModalVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Class Modal */}
      <Modal
        visible={showAddClassModal}
        onRequestClose={() => setShowAddClassModal(false)}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addClassModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Class</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowAddClassModal(false);
                  setNewClassName('');
                  setNewClassSection('');
                  setNewAcademicYear('2024-25');
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.addClassModalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Class Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newClassName}
                  onChangeText={setNewClassName}
                  placeholder="Enter class name (e.g., 10, 11, 12)"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Section *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newClassSection}
                  onChangeText={setNewClassSection}
                  placeholder="Enter section (e.g., A, B, C)"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Academic Year *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newAcademicYear}
                  onChangeText={setNewAcademicYear}
                  placeholder="Enter academic year (e.g., 2024-25)"
                />
              </View>

              <Text style={styles.requiredNote}>* Required fields</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddClassModal(false);
                  setNewClassName('');
                  setNewClassSection('');
                  setNewAcademicYear('2024-25');
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddClass}
                disabled={addingClass}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>
                  {addingClass ? 'Adding...' : 'Add Class'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AttendanceManagement;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  overviewContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#1976d2',
  },
  tabIcon: {
    marginRight: 8,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  selectionContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  selectionCard: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginRight: 12,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: '#fff',
    height: 56,
    justifyContent: 'center',
  },
  picker: {
    height: 56,
    width: '100%',
    fontSize: 18,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  dateInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  submitButtonCard: {
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledSubmitButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tableContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  attendanceCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#e9ecef',
  },
  presentCard: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  absentCard: {
    borderLeftColor: '#F44336',
    backgroundColor: '#fff8f8',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentRoll: {
    fontSize: 14,
    color: '#666',
  },
  attendanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attendanceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  presentButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
    shadowColor: '#4CAF50',
  },
  presentButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  absentButton: {
    borderColor: '#F44336',
    backgroundColor: '#fff8f8',
    shadowColor: '#F44336',
  },
  absentButtonActive: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeButtonText: {
    color: '#fff',
  },
  editButtonCard: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#495057',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  attendanceCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  presentCircle: {
    backgroundColor: '#4caf50',
  },
  absentCircle: {
    backgroundColor: '#f44336',
  },
  editButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonActive: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
  },
  disabledCircle: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewButtonContainer: {
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  analyticsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  percentageContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  percentageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  pieChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  chartContainer: {
    alignItems: 'center',
    marginRight: 30,
  },
  chartSummaryRight: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  chartSummaryBelow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  chartSummary: {
    marginTop: 16,
    width: '100%',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 6,
  },
  summaryDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
  },
  summaryNumber: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1976d2',
  },
  summaryLabel: {
    fontWeight: '500',
    color: '#555',
    fontSize: 14,
  },
  summaryTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  totalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  totalNumber: {
    fontWeight: 'bold',
    color: '#1976d2',
    fontSize: 18,
  },
  percentageText: {
    fontSize: 14,
    color: '#666',
  },
  percentageNumber: {
    fontWeight: 'bold',
    color: '#4CAF50',
    fontSize: 16,
  },
  analyticsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyticsDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4caf50',
    marginRight: 8,
  },
  absentDot: {
    backgroundColor: '#f44336',
  },
  analyticsText: {
    fontSize: 14,
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  modalTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 8,
  },
  modalTableHeaderCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalTableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTableCell: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  exportButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    marginHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  // Quick stats header styles
  quickStatsHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'space-between',
  },
  quickStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  quickStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  // Enhanced student/teacher card styles
  presentAvatar: {
    backgroundColor: '#4CAF50',
  },
  absentAvatar: {
    backgroundColor: '#F44336',
  },
  studentMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 12,
  },
  studentAdmission: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  presentBadge: {
    backgroundColor: '#4CAF50',
  },
  absentBadge: {
    backgroundColor: '#F44336',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  // Loading enhancement
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  // Add Class Button and Modal styles
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    gap: 4,
  },
  addClassButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addClassModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addClassModalContent: {
    padding: 24,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  requiredNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#1976d2',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
});
