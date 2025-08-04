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
  const [teacherEditMode, setTeacherEditMode] = useState({});
  const [teacherDate, setTeacherDate] = useState(new Date());
  const [teacherShowDatePicker, setTeacherShowDatePicker] = useState(false);
  const [teacherViewModalVisible, setTeacherViewModalVisible] = useState(false);
  const [teacherViewDate, setTeacherViewDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState(null);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceMark, setAttendanceMark] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editMode, setEditMode] = useState({});
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewClass, setViewClass] = useState(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [studentsForClass, setStudentsForClass] = useState([]); // State for filtered students

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

      // Reset edit modes - enable editing for all students after successful submit
      const newEditMode = {};
      studentsForClass.forEach(student => {
        if (attendanceMark[student.id]) {
          newEditMode[student.id] = false; // Allow editing after submit
        }
      });
      setEditMode(newEditMode);

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

      // Reset edit modes - enable editing for all teachers after successful submit
      const newEditMode = {};
      teachers.forEach(teacher => {
        if (teacherAttendanceMark[teacher.id]) {
          newEditMode[teacher.id] = false; // Allow editing after submit
        }
      });
      setTeacherEditMode(newEditMode);

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
    // Check if student is in edit mode or if no attendance is marked yet
    const isInEditMode = editMode[studentId] || !attendanceMark[studentId];

    if (isInEditMode) {
      setAttendanceMark(prev => ({
        ...prev,
        [studentId]: status
      }));

      // After marking attendance, disable edit mode for this student
      setEditMode(prev => ({
        ...prev,
        [studentId]: false
      }));
    }
  };

  // Enable edit mode for a specific student
  const enableEditMode = (studentId) => {
    setEditMode(prev => ({
      ...prev,
      [studentId]: true
    }));
  };

  // Check if student can be edited (either in edit mode or no attendance marked)
  const canEditStudent = (studentId) => {
    return editMode[studentId] || !attendanceMark[studentId];
  };

  // Toggle attendance status for a teacher
  const toggleTeacherAttendance = (teacherId, status) => {
    // Check if teacher is in edit mode or if no attendance is marked yet
    const isInEditMode = teacherEditMode[teacherId] || !teacherAttendanceMark[teacherId];

    if (isInEditMode) {
      setTeacherAttendanceMark(prev => ({
        ...prev,
        [teacherId]: status
      }));

      // After marking attendance, disable edit mode for this teacher
      setTeacherEditMode(prev => ({
        ...prev,
        [teacherId]: false
      }));
    }
  };

  // Enable edit mode for a specific teacher
  const enableTeacherEditMode = (teacherId) => {
    setTeacherEditMode(prev => ({
      ...prev,
      [teacherId]: true
    }));
  };

  // Check if teacher can be edited (either in edit mode or no attendance marked)
  const canEditTeacher = (teacherId) => {
    return teacherEditMode[teacherId] || !teacherAttendanceMark[teacherId];
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

  // Render student attendance item
  const renderStudentItem = ({ item, index }) => {
    const isEditable = canEditStudent(item.id);
    const currentStatus = attendanceMark[item.id];

    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { flex: 0.7 }]}>{item.roll_no || index + 1}</Text>
        <Text style={[styles.tableCell, { flex: 2 }]}>{item.full_name || item.name}</Text>

        {/* Present Button */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            style={[
              styles.attendanceCircle,
              currentStatus === 'Present' && styles.presentCircle,
              !isEditable && currentStatus !== 'Present' && styles.disabledCircle
            ]}
            onPress={() => toggleStudentAttendance(item.id, 'Present')}
            disabled={!isEditable && currentStatus !== 'Present'}
          >
            <Ionicons
              name="checkmark"
              size={16}
              color={currentStatus === 'Present' ? '#fff' : (isEditable ? '#ccc' : '#ddd')}
            />
          </TouchableOpacity>
        </View>

        {/* Absent Button */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            style={[
              styles.attendanceCircle,
              currentStatus === 'Absent' && styles.absentCircle,
              !isEditable && currentStatus !== 'Absent' && styles.disabledCircle
            ]}
            onPress={() => toggleStudentAttendance(item.id, 'Absent')}
            disabled={!isEditable && currentStatus !== 'Absent'}
          >
            <Ionicons
              name="close"
              size={16}
              color={currentStatus === 'Absent' ? '#fff' : (isEditable ? '#ccc' : '#ddd')}
            />
          </TouchableOpacity>
        </View>

        {/* Edit Button */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            style={[
              styles.editButton,
              currentStatus && !editMode[item.id] && styles.editButtonActive
            ]}
            onPress={() => enableEditMode(item.id)}
            disabled={!currentStatus}
          >
            <Ionicons
              name="pencil"
              size={16}
              color={currentStatus && !editMode[item.id] ? "#1976d2" : "#ccc"}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render teacher attendance item
  const renderTeacherItem = ({ item, index }) => {
    const isEditable = canEditTeacher(item.id);
    const currentStatus = teacherAttendanceMark[item.id];

    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { flex: 0.7 }]}>{index + 1}</Text>
        <Text style={[styles.tableCell, { flex: 2 }]}>{item.name}</Text>

        {/* Present Button */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            style={[
              styles.attendanceCircle,
              currentStatus === 'Present' && styles.presentCircle,
              !isEditable && currentStatus !== 'Present' && styles.disabledCircle
            ]}
            onPress={() => toggleTeacherAttendance(item.id, 'Present')}
            disabled={!isEditable && currentStatus !== 'Present'}
          >
            <Ionicons
              name="checkmark"
              size={16}
              color={currentStatus === 'Present' ? '#fff' : (isEditable ? '#ccc' : '#ddd')}
            />
          </TouchableOpacity>
        </View>

        {/* Absent Button */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            style={[
              styles.attendanceCircle,
              currentStatus === 'Absent' && styles.absentCircle,
              !isEditable && currentStatus !== 'Absent' && styles.disabledCircle
            ]}
            onPress={() => toggleTeacherAttendance(item.id, 'Absent')}
            disabled={!isEditable && currentStatus !== 'Absent'}
          >
            <Ionicons
              name="close"
              size={16}
              color={currentStatus === 'Absent' ? '#fff' : (isEditable ? '#ccc' : '#ddd')}
            />
          </TouchableOpacity>
        </View>

        {/* Edit Button */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            style={[
              styles.editButton,
              currentStatus && !teacherEditMode[item.id] && styles.editButtonActive
            ]}
            onPress={() => enableTeacherEditMode(item.id)}
            disabled={!currentStatus}
          >
            <Ionicons
              name="pencil"
              size={16}
              color={currentStatus && !teacherEditMode[item.id] ? "#1976d2" : "#ccc"}
            />
          </TouchableOpacity>
        </View>
      </View>
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
          <Text style={[styles.tabText, tab === 'student' && styles.tabTextActive]}>
            Student Attendance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'teacher' && styles.tabActive]}
          onPress={() => setTab('teacher')}
        >
          <Text style={[styles.tabText, tab === 'teacher' && styles.tabTextActive]}>
            Teacher Attendance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selection Controls */}
      {tab === 'student' ? (
        <View style={styles.selectionContainer}>
          <View style={styles.selectionRow}>
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
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateInputText}>
                {format(selectedDate, 'dd-MM-yyyy')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                handleMarkAttendance();
              }}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.selectionContainer}>
          <View style={styles.selectionRow}>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setTeacherShowDatePicker(true)}
            >
              <Text style={styles.dateInputText}>
                {format(teacherDate, 'dd-MM-yyyy')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                handleTeacherMarkAttendance();
              }}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Beautiful Attendance Table */}
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Roll No</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{
            tab === 'student' ? 'Student Name' : 'Teacher Name'
          }</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Present</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Absent</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Edit</Text>
        </View>

        {/* Table Rows */}
        {(tab === 'student' ? studentsForClass : teachers).map((item, index) => (
          <View key={item.id}>
            {tab === 'student' ? renderStudentItem({ item, index }) : renderTeacherItem({ item, index })}
          </View>
        ))}
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

        {/* Attendance Analytics - Centered */}
        {Platform.OS !== 'web' && (analytics.present > 0 || analytics.absent > 0) && (
          <View style={styles.analyticsContainer}>
            <Text style={styles.analyticsTitle}>Attendance Analytics</Text>
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
                    ].filter(item => item.value > 0)} // Only show non-zero values
                    width={Dimensions.get('window').width - 48}
                    height={220}
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

            {/* Summary Below Chart */}
            <View style={styles.chartSummaryBelow}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.summaryText}>
                  <Text style={styles.summaryNumber}>{analytics.present}</Text>
                  <Text style={styles.summaryLabel}> Present</Text>
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryDot, { backgroundColor: '#F44336' }]} />
                <Text style={styles.summaryText}>
                  <Text style={styles.summaryNumber}>{analytics.absent}</Text>
                  <Text style={styles.summaryLabel}> Absent</Text>
                </Text>
              </View>
            </View>
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
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#1976d2',
    backgroundColor: '#f0f8ff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: '#1976d2',
  },
  selectionContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
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
  dateInputText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tableContainer: {
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
    paddingVertical: 16,
    paddingHorizontal: 8,
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
    alignItems: 'center',
  },
  analyticsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
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
});