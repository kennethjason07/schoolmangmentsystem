import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import { formatDate } from '../../utils/helpers';

const ManageStudents = () => {
  const navigation = useNavigation();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('All');

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState('');

  // Form state for adding/editing students
  const [form, setForm] = useState({
    admission_no: '',
    name: '',
    dob: '',
    aadhar_no: '',
    place_of_birth: '',
    nationality: 'Indian',
    gender: 'Male',
    religion: '',
    caste: 'OC',
    address: '',
    pin_code: '',
    blood_group: '',
    mother_tongue: '',
    identification_mark_1: '',
    identification_mark_2: '',
    academic_year: '2024-25',
    general_behaviour: 'Normal',
    remarks: '',
    roll_no: '',
    parent_id: '',
    class_id: ''
  });

  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    maleStudents: 0,
    femaleStudents: 0,
    averageAttendance: 0,
    totalClasses: 0
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadAllData();
  }, [selectedClass, selectedSection, selectedGender, selectedAcademicYear]);

  // Load all data
  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStudents(),
        loadClasses(),
        loadParents()
      ]);
    } catch (error) {
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

  // Load students with full details - OPTIMIZED VERSION
  const loadStudents = async () => {
    const startTime = performance.now(); // 📊 Performance monitoring
    try {
      console.log('🚀 Loading students with optimized query...');
      
      // Use a single JOIN query to get all student data with related information
      const { data: studentsData, error } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes:class_id (
            id,
            class_name,
            section
          ),
          parents:parent_id (
            id,
            name,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setStats({
          totalStudents: 0,
          maleStudents: 0,
          femaleStudents: 0,
          averageAttendance: 0,
          totalClasses: 0
        });
        return;
      }

      // Get attendance data for all students in a single query
      const studentIds = studentsData.map(s => s.id);
      
      // Use last 3 months for more comprehensive attendance data
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = threeMonthsAgo.toISOString().split('T')[0];
      
      console.log(`🔍 Fetching attendance data from ${startDate} for ${studentIds.length} students...`);
      console.log(`📋 Student IDs:`, studentIds.slice(0, 3), '... (showing first 3)');
      
      const { data: allAttendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('student_id, status, date')
        .in('student_id', studentIds)
        .gte('date', startDate)
        .order('date', { ascending: false });
      
      console.log(`📊 Attendance query result:`, {
        error: attendanceError,
        recordCount: allAttendanceData?.length || 0,
        sampleData: allAttendanceData?.slice(0, 3) || []
      });

      // Get fees data for all students
      const { data: allFeesData } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('student_id, amount_paid, academic_year')
        .in('student_id', studentIds);

      // Get academic marks data for all students
      const { data: allMarksData } = await supabase
        .from('marks')
        .select('student_id, marks, subject_id')
        .in('student_id', studentIds);

      // Create attendance lookup map for O(1) access
      const attendanceLookup = {};
      console.log(`📋 Processing ${allAttendanceData?.length || 0} attendance records...`);
      
      (allAttendanceData || []).forEach((record, index) => {
        if (index < 5) { // Log first 5 records
          console.log(`Record ${index}:`, record);
        }
        
        if (!attendanceLookup[record.student_id]) {
          attendanceLookup[record.student_id] = { total: 0, present: 0 };
        }
        attendanceLookup[record.student_id].total++;
        if (record.status === 'Present') {
          attendanceLookup[record.student_id].present++;
        }
      });
      
      console.log(`📊 Attendance lookup summary:`, {
        studentsWithAttendance: Object.keys(attendanceLookup).length,
        sampleCalculations: Object.keys(attendanceLookup).slice(0, 3).map(studentId => ({
          studentId,
          ...attendanceLookup[studentId],
          percentage: Math.round((attendanceLookup[studentId].present / attendanceLookup[studentId].total) * 100)
        }))
      });

      // Create fees lookup map for O(1) access
      const feesLookup = {};
      (allFeesData || []).forEach(record => {
        if (!feesLookup[record.student_id]) {
          feesLookup[record.student_id] = { records: [], totalPaid: 0, latestStatus: 'Unpaid' };
        }
        feesLookup[record.student_id].records.push(record);
        // Add to total amount paid
        if (record.amount_paid) {
          feesLookup[record.student_id].totalPaid += parseFloat(record.amount_paid);
        }
      });

      // Determine fee status based on total amount paid
      Object.keys(feesLookup).forEach(studentId => {
        const totalPaid = feesLookup[studentId].totalPaid;
        // If student has paid any amount, consider it as 'Paid'
        // You can modify this logic based on your requirements
        // For example, you might want to check against a minimum fee amount
        feesLookup[studentId].latestStatus = totalPaid > 0 ? 'Paid' : 'Unpaid';
      });

      // Create academic marks lookup map for O(1) access
      const marksLookup = {};
      (allMarksData || []).forEach(record => {
        if (!marksLookup[record.student_id]) {
          marksLookup[record.student_id] = { marks: [], totalMarks: 0, subjectCount: 0, average: 0 };
        }
        if (record.marks != null) {
          marksLookup[record.student_id].marks.push(record.marks);
          marksLookup[record.student_id].totalMarks += parseFloat(record.marks);
          marksLookup[record.student_id].subjectCount++;
        }
      });

      // Calculate academic average for each student
      Object.keys(marksLookup).forEach(studentId => {
        const studentMarks = marksLookup[studentId];
        if (studentMarks.subjectCount > 0) {
          studentMarks.average = Math.round(studentMarks.totalMarks / studentMarks.subjectCount);
        }
      });

      // Process students data - no async operations needed
      const studentsWithDetails = studentsData.map(student => {
        const classInfo = student.classes || { class_name: 'N/A', section: 'N/A' };
        const parentInfo = student.parents || { name: 'N/A', phone: 'N/A' };
        const attendance = attendanceLookup[student.id] || { total: 0, present: 0 };
        const attendancePercentage = attendance.total > 0 
          ? Math.round((attendance.present / attendance.total) * 100) 
          : 0;
        
        // Get fees status for the student
        const feesInfo = feesLookup[student.id] || { latestStatus: 'Unpaid' };
        const feesStatus = feesInfo.latestStatus;

        // Get academic marks data
        const academicInfo = marksLookup[student.id] || { average: 0, subjectCount: 0 };
        const academicPercentage = academicInfo.average;
        const hasMarks = academicInfo.subjectCount > 0;

        return {
          ...student,
          attendancePercentage,
          className: classInfo.class_name,
          section: classInfo.section,
          parentName: parentInfo.name,
          parentPhone: parentInfo.phone,
          feesStatus: feesStatus,
          academicPercentage,
          hasMarks
        };
      });

      // Sort students by academic percentage (highest to lowest)
      // Students with no marks will appear at the end
      const sortedStudents = studentsWithDetails.sort((a, b) => {
        if (!a.hasMarks && !b.hasMarks) return 0; // Both have no marks, keep original order
        if (!a.hasMarks) return 1; // a has no marks, move to end
        if (!b.hasMarks) return -1; // b has no marks, move to end
        return b.academicPercentage - a.academicPercentage; // Sort by academic percentage descending
      });

      setStudents(sortedStudents);

      // Calculate statistics
      const totalStudents = studentsWithDetails.length;
      const maleStudents = studentsWithDetails.filter(s => s.gender === 'Male').length;
      const femaleStudents = studentsWithDetails.filter(s => s.gender === 'Female').length;
      const avgAttendance = totalStudents > 0
        ? Math.round(studentsWithDetails.reduce((sum, s) => sum + s.attendancePercentage, 0) / totalStudents)
        : 0;

      setStats({
        totalStudents,
        maleStudents,
        femaleStudents,
        averageAttendance: avgAttendance,
        totalClasses: [...new Set(studentsWithDetails.map(s => s.class_id))].filter(Boolean).length
      });

      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ Students loaded successfully in ${loadTime}ms`);
      console.log(`📈 Performance: ${totalStudents} students, ${studentsWithDetails.length} processed`);
      
      if (loadTime > 1000) {
        console.warn('⚠️ Slow loading detected. Consider adding more database indexes.');
      } else {
        console.log('🚀 Fast loading achieved!');
      }

    } catch (error) {
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.error(`❌ Error loading students after ${loadTime}ms:`, error);
      throw error;
    }
  };

  // Load classes
  const loadClasses = async () => {
    try {
      const { data: classData, error } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .order('class_name');

      if (error) throw error;
      setClasses(classData || []);
    } catch (error) {
      throw error;
    }
  };

  // Load parents (users with parent role)
  const loadParents = async () => {
    try {
      const { data: parentData, error } = await supabase
        .from(TABLES.USERS)
        .select('id, full_name, phone')
        .eq('role_id', 3) // Assuming role_id 3 is for parents
        .order('full_name');

      if (error) throw error;
      setParents(parentData || []);
    } catch (error) {
      throw error;
    }
  };

  // Helper function to format date
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN');
    } catch (error) {
      return dateStr;
    }
  };

  // Helper function to calculate age
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (error) {
      return 'N/A';
    }
  };

  const loadStudentDetails = async (studentId) => {
    try {
      // Load attendance history
      const { data: attendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      if (attendanceError) throw attendanceError;
      setAttendanceHistory(attendanceData || []);

      // Load marks history
      const { data: marksData, error: marksError } = await supabase
        .from('marks')
        .select('*')
        .eq('student_id', studentId)
        .order('exam_date', { ascending: false });
      if (marksError) throw marksError;
      setMarksHistory(marksData || []);

      // Load documents
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('student_id', studentId);
      if (docsError) throw docsError;
      setDocuments(docsData || []);

      // Load achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      if (achievementsError) throw achievementsError;
      setAchievements(achievementsData || []);

      // Load communication history
      const { data: commData, error: commError } = await supabase
        .from('communication_history')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      if (commError) throw commError;
      setCommunicationHistory(commData || []);
    } catch (error) {
      // Error loading student details
    }
  };

  const loadClassesAndSections = async () => {
    try {
      const { data: classData, error: classError } = await dbHelpers.getClasses();
      if (classError) throw classError;

      setClasses(classData || []);
    } catch (error) {
      // Error loading classes and sections
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setForm({
      admission_no: '',
      name: '',
      dob: '',
      aadhar_no: '',
      place_of_birth: '',
      nationality: 'Indian',
      gender: 'Male',
      religion: '',
      caste: 'OC',
      address: '',
      pin_code: '',
      blood_group: '',
      mother_tongue: '',
      identification_mark_1: '',
      identification_mark_2: '',
      academic_year: '2024-25',
      general_behaviour: 'Normal',
      remarks: '',
      roll_no: '',
      parent_id: '',
      class_id: ''
    });
  };

  const handleAddStudent = () => {
    resetForm();
    setModalVisible(true);
  };

  // Debug function to add a test student
  const addTestStudent = async () => {
    try {
      const testStudent = {
        admission_no: `TEST${Date.now()}`,
        name: 'Test Student',
        dob: '2010-01-01',
        gender: 'Male',
        nationality: 'Indian',
        academic_year: '2024-25',
        general_behaviour: 'Normal'
      };

      const { error } = await supabase
        .from(TABLES.STUDENTS)
        .insert(testStudent);

      if (error) throw error;

      Alert.alert('Success', 'Test student added successfully');
      await loadAllData();
    } catch (error) {
      Alert.alert('Error', 'Failed to add test student: ' + error.message);
    }
  };

  const handleFormChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  // Date picker handler
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate && datePickerField) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setForm({ ...form, [datePickerField]: formattedDate });
    }
    setDatePickerField('');
  };

  const openDatePicker = (field) => {
    setDatePickerField(field);
    setShowDatePicker(true);
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!form.admission_no || !form.name || !form.dob || !form.gender || !form.academic_year) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const { error } = await supabase
        .from(TABLES.STUDENTS)
        .insert({
          admission_no: form.admission_no,
          name: form.name,
          dob: form.dob,
          aadhar_no: form.aadhar_no || null,
          place_of_birth: form.place_of_birth || null,
          nationality: form.nationality,
          gender: form.gender,
          religion: form.religion || null,
          caste: form.caste,
          address: form.address || null,
          pin_code: form.pin_code || null,
          blood_group: form.blood_group || null,
          mother_tongue: form.mother_tongue || null,
          identification_mark_1: form.identification_mark_1 || null,
          identification_mark_2: form.identification_mark_2 || null,
          academic_year: form.academic_year,
          general_behaviour: form.general_behaviour,
          remarks: form.remarks || null,
          roll_no: form.roll_no ? parseInt(form.roll_no) : null,
          parent_id: form.parent_id || null,
          class_id: form.class_id || null
        });

      if (error) throw error;

      Alert.alert('Success', 'Student added successfully');
      await loadAllData();
      resetForm();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add student: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert(
      'Delete Student',
      'Are you sure you want to delete this student? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(TABLES.STUDENTS)
                .delete()
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Success', 'Student deleted successfully');
              await loadAllData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete student: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const handleEdit = (student) => {
    setSelectedStudent(student);
    setForm({
      admission_no: student.admission_no || '',
      name: student.name || '',
      dob: student.dob || '',
      aadhar_no: student.aadhar_no || '',
      place_of_birth: student.place_of_birth || '',
      nationality: student.nationality || 'Indian',
      gender: student.gender || 'Male',
      religion: student.religion || '',
      caste: student.caste || 'OC',
      address: student.address || '',
      pin_code: student.pin_code || '',
      blood_group: student.blood_group || '',
      mother_tongue: student.mother_tongue || '',
      identification_mark_1: student.identification_mark_1 || '',
      identification_mark_2: student.identification_mark_2 || '',
      academic_year: student.academic_year || '2024-25',
      general_behaviour: student.general_behaviour || 'Normal',
      remarks: student.remarks || '',
      roll_no: student.roll_no?.toString() || '',
      parent_id: student.parent_id || '',
      class_id: student.class_id || ''
    });
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    try {
      // Validate required fields
      if (!form.admission_no || !form.name || !form.dob || !form.gender || !form.academic_year) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const { error } = await supabase
        .from(TABLES.STUDENTS)
        .update({
          admission_no: form.admission_no,
          name: form.name,
          dob: form.dob,
          aadhar_no: form.aadhar_no || null,
          place_of_birth: form.place_of_birth || null,
          nationality: form.nationality,
          gender: form.gender,
          religion: form.religion || null,
          caste: form.caste,
          address: form.address || null,
          pin_code: form.pin_code || null,
          blood_group: form.blood_group || null,
          mother_tongue: form.mother_tongue || null,
          identification_mark_1: form.identification_mark_1 || null,
          identification_mark_2: form.identification_mark_2 || null,
          academic_year: form.academic_year,
          general_behaviour: form.general_behaviour,
          remarks: form.remarks || null,
          roll_no: form.roll_no ? parseInt(form.roll_no) : null,
          parent_id: form.parent_id || null,
          class_id: form.class_id || null
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      Alert.alert('Success', 'Student updated successfully');
      await loadAllData();
      setEditModalVisible(false);
      setSelectedStudent(null);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to update student: ' + error.message);
    }
  };

  const handleViewProfile = (student) => {
    // Navigate to StudentDetails screen instead of showing modal
    navigation.navigate('StudentDetails', { student });
  };

  const handleViewDocuments = (student) => {
    setSelectedStudent(student);
    setShowDocumentModal(true);
  };

  const exportStudentData = async () => {
    try {
      const html = `
        <h2 style="text-align:center;">Student Profile - ${selectedStudent.name}</h2>
        <h3 style="text-align:center;">Roll No: ${selectedStudent.roll}</h3>
        <h3 style="text-align:center;">Class: ${selectedStudent.class}</h3>
        
        <div style="margin:20px 0;">
          <h3>Basic Information</h3>
          <table border="1" style="border-collapse:collapse;width:100%;margin-top:10px;">
            <tr>
              <th style="text-align:left;padding:8px;">Parent Name</th>
              <td style="text-align:left;padding:8px;">${selectedStudent.parent}</td>
            </tr>
            <tr>
              <th style="text-align:left;padding:8px;">Contact</th>
              <td style="text-align:left;padding:8px;">${selectedStudent.contact}</td>
            </tr>
            <tr>
              <th style="text-align:left;padding:8px;">Behavior</th>
              <td style="text-align:left;padding:8px;">${selectedStudent.behavior}</td>
            </tr>
          </table>
        </div>

        <div style="margin:20px 0;">
          <h3>Academic History</h3>
          <table border="1" style="border-collapse:collapse;width:100%;margin-top:10px;">
            <tr>
              <th style="text-align:center;padding:8px;">Subject</th>
              <th style="text-align:center;padding:8px;">Marks</th>
              <th style="text-align:center;padding:8px;">Grade</th>
              <th style="text-align:center;padding:8px;">Exam Date</th>
            </tr>
            ${marksHistory
              .map(record => `
                <tr>
                  <td style="text-align:center;padding:8px;">${record.subject_name}</td>
                  <td style="text-align:center;padding:8px;">${record.marks}</td>
                  <td style="text-align:center;padding:8px;">${calculateGrade(record.marks)}</td>
                  <td style="text-align:center;padding:8px;">${formatDateDMY(record.exam_date)}</td>
                </tr>
              `)
              .join('')}
          </table>
        </div>

        <div style="margin:20px 0;">
          <h3>Attendance History</h3>
          <table border="1" style="border-collapse:collapse;width:100%;margin-top:10px;">
            <tr>
              <th style="text-align:center;padding:8px;">Date</th>
              <th style="text-align:center;padding:8px;">Status</th>
            </tr>
            ${attendanceHistory
              .map(record => `
                <tr>
                  <td style="text-align:center;padding:8px;">${formatDateDMY(record.attendance_date)}</td>
                  <td style="text-align:center;padding:8px;">${record.status}</td>
                </tr>
              `)
              .join('')}
          </table>
        </div>

        <div style="margin:20px 0;">
          <h3>Achievements</h3>
          <ul style="margin-top:10px;">
            ${achievements
              .map(achievement => `
                <li style="margin:5px 0;">${achievement.description} (${formatDateDMY(achievement.date)})</li>
              `)
              .join('')}
          </ul>
        </div>
      `;

      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'Failed to export student data');
    }
  };

  const calculateGrade = (marks) => {
    if (marks >= 90) return 'A+';
    if (marks >= 80) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 50) return 'D';
    return 'F';
  };

  // Get unique sections for the selected class
  const getAvailableSections = () => {
    if (selectedClass === 'All') {
      // Return all unique sections from all classes
      const sections = [...new Set(classes.map(cls => cls.section).filter(Boolean))];
      return sections.sort();
    } else {
      // Return sections only for the selected class
      const sections = classes
        .filter(cls => cls.id === selectedClass)
        .map(cls => cls.section)
        .filter(Boolean);
      return [...new Set(sections)].sort();
    }
  };

  // Filter students based on selected criteria
  const filteredStudents = students.filter(student => {
    const matchesSearch = search === '' ||
      student.name?.toLowerCase().includes(search.toLowerCase()) ||
      student.admission_no?.toLowerCase().includes(search.toLowerCase()) ||
      ((student.roll_no ?? '').toString().includes(search));

    const matchesClass = selectedClass === 'All' || student.class_id === selectedClass;
    
    // Section filter - match based on the student's section
    const matchesSection = selectedSection === 'All' || student.section === selectedSection;
    
    const matchesGender = selectedGender === 'All' || student.gender === selectedGender;
    // Make academic year filter more flexible - show all if no academic year is set
    const matchesAcademicYear = selectedAcademicYear === 'All' ||
      !student.academic_year ||
      student.academic_year === selectedAcademicYear;

    return matchesSearch && matchesClass && matchesSection && matchesGender && matchesAcademicYear;
  });



  // Academic year options
  const academicYearOptions = ['All', '2024-25', '2023-24', '2022-23'];

  // Gender options
  const genderOptions = ['All', 'Male', 'Female'];

  // Caste options
  const casteOptions = ['OC', 'BC', 'SC', 'ST', 'Other'];

  // Behaviour options
  const behaviourOptions = ['Mild', 'Normal', 'Hyperactive'];

  // Blood group options
  const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const renderStudent = ({ item, index }) => {
    // Only show top student badge if the student has marks and is first in the sorted list
    const isTopStudent = index === 0 && item.hasMarks && item.academicPercentage > 0;
    const cardStyle = isTopStudent ? [styles.studentCard, styles.topStudentCard] : styles.studentCard;

    return (
      <TouchableOpacity 
        style={cardStyle}
        onPress={() => handleViewProfile(item)}
        activeOpacity={0.7}
      >
        {/* Top Student Badge */}
        {isTopStudent && (
          <View style={styles.topStudentBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.topStudentText}>Top Student</Text>
          </View>
        )}

        {/* Student Header */}
        <View style={styles.studentHeader}>
          <Text style={styles.studentNumber}>#{item.admission_no || '101'}</Text>
          <Text style={styles.studentName}>{item.name}</Text>
        </View>

        {/* Student Info Row */}
        <View style={styles.studentInfoRow}>
          <View style={styles.leftSection}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={24} color="#2196F3" />
            </View>

            <View style={styles.studentDetails}>
              <View style={styles.classInfo}>
                <Ionicons name="school" size={16} color="#2196F3" />
                <Text style={styles.classText}>
                  {item.className || 'Class 5'} | Section {item.section || 'A'}
                </Text>
              </View>

              <Text style={styles.parentText}>
                Parent: {item.parentName || 'Not Assigned'}
              </Text>
              <Text style={styles.contactText}>
                Contact: {item.parentPhone || 'Not Available'}
              </Text>
              <Text style={styles.feesText}>
                Fees: <Text style={item.feesStatus === 'Paid' ? styles.paidText : styles.unpaidText}>
                  {item.feesStatus || 'Unpaid'}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.rightSection}>
            <View style={styles.academicContainer}>
              <Text style={[
                styles.academicPercentage,
                { color: item.academicPercentage >= 80 ? '#4CAF50' : item.academicPercentage >= 60 ? '#FF9800' : '#f44336' }
              ]}>{item.hasMarks ? item.academicPercentage : '0'}%</Text>
              <Text style={styles.academicLabel}>Academic</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.viewScoreBtn}
            onPress={() => handleViewProfile(item)}
          >
            <Ionicons name="eye" size={16} color="#FF9800" />
            <Text style={styles.viewScoreText}>View Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="create" size={16} color="#FF9800" />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
          >
            <Ionicons name="trash" size={16} color="#f44336" />
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Manage Students" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Use the proper Header component for consistent profile photo loading */}
      <Header title="Manage Students" showBack={true} />

      {/* Filters Section */}
      <View style={styles.filtersSection}>
        <View style={styles.filterRow}>
          <View style={styles.filterDropdown}>
            <Text style={styles.filterLabel}>Class</Text>
            <View style={styles.dropdownContainer}>
              <Picker
                selectedValue={selectedClass}
                onValueChange={setSelectedClass}
                style={styles.picker}
              >
                <Picker.Item label="All Classes" value="All" />
                {classes.map(cls => (
                  <Picker.Item
                    key={cls.id}
                    label={`Class ${cls.class_name}`}
                    value={cls.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.filterDropdown}>
            <Text style={[styles.filterLabel, styles.sectionLabel]}>Section</Text>
            <View style={[styles.dropdownContainer, styles.sectionDropdown]}>
              <Picker
                selectedValue={selectedSection}
                onValueChange={setSelectedSection}
                style={styles.picker}
              >
                <Picker.Item label="All Sections" value="All" />
                {getAvailableSections().map(section => (
                  <Picker.Item
                    key={section}
                    label={`Section ${section}`}
                    value={section}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* Additional Filters Row */}
        <View style={styles.filterRow}>
          <View style={styles.filterDropdown}>
            <Text style={styles.filterLabel}>Gender</Text>
            <View style={styles.dropdownContainer}>
              <Picker
                selectedValue={selectedGender}
                onValueChange={setSelectedGender}
                style={styles.picker}
              >
                {genderOptions.map(gender => (
                  <Picker.Item key={gender} label={gender === 'All' ? 'All Genders' : gender} value={gender} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.filterDropdown}>
            <Text style={styles.filterLabel}>Academic Year</Text>
            <View style={styles.dropdownContainer}>
              <Picker
                selectedValue={selectedAcademicYear}
                onValueChange={setSelectedAcademicYear}
                style={styles.picker}
              >
                {academicYearOptions.map(year => (
                  <Picker.Item key={year} label={year === 'All' ? 'All Years' : year} value={year} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or roll number"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#999"
          />
        </View>
      </View>



      {/* Students List */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="school-outline" size={80} color="#e0e0e0" />
            </View>
            <Text style={styles.emptyTitle}>
              {students.length === 0 ? 'No Students Yet' : 'No Results Found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {students.length === 0
                ? 'Start building your student database by adding your first student.'
                : 'Try adjusting your search terms or filters to find students.'
              }
            </Text>

            {/* Action Buttons */}
            <View style={styles.emptyActions}>
              {students.length === 0 ? (
                <>
                  <TouchableOpacity
                    style={styles.emptyActionButton}
                    onPress={handleAddStudent}
                  >
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.emptyActionText}>Add First Student</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.emptySecondaryButton}
                    onPress={addTestStudent}
                  >
                    <Ionicons name="flask" size={16} color="#2196F3" />
                    <Text style={styles.emptySecondaryText}>Add Test Data</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={() => {
                    setSearch('');
                    setSelectedClass('All');
                    setSelectedSection('All');
                    setSelectedGender('All');
                    setSelectedAcademicYear('All');
                  }}
                >
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={styles.emptyActionText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Debug Info */}
            <Text style={styles.debugText}>
              Total: {students.length} • Filtered: {filteredStudents.length}
            </Text>
          </View>
        }
      />

      {/* Simple FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleAddStudent}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
      {/* Add/Edit Student Modal */}
      <Modal
        visible={modalVisible || editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setEditModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editModalVisible ? 'Edit Student' : 'Add New Student'}
            </Text>
            <ScrollView style={styles.modalScrollView}>
              {/* Basic Information */}
              <Text style={styles.sectionTitle}>Basic Information</Text>

              <Text style={styles.inputLabel}>Admission Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Admission Number"
                value={form.admission_no}
                onChangeText={(text) => handleFormChange('admission_no', text)}
              />

              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Student Full Name"
                value={form.name}
                onChangeText={(text) => handleFormChange('name', text)}
              />

              <Text style={styles.inputLabel}>Date of Birth *</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => openDatePicker('dob')}
              >
                <Text style={form.dob ? styles.dateText : styles.datePlaceholder}>
                  {form.dob ? formatDateForDisplay(form.dob) : 'Select Date of Birth'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Gender *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.gender}
                  style={styles.picker}
                  onValueChange={(value) => handleFormChange('gender', value)}
                >
                  <Picker.Item label="Male" value="Male" />
                  <Picker.Item label="Female" value="Female" />
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Academic Year *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.academic_year}
                  style={styles.picker}
                  onValueChange={(value) => handleFormChange('academic_year', value)}
                >
                  {academicYearOptions.map(year => (
                    <Picker.Item key={year} label={year} value={year} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Class</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.class_id}
                  style={styles.picker}
                  onValueChange={(value) => handleFormChange('class_id', value)}
                >
                  <Picker.Item label="Select Class" value="" />
                  {classes.map(cls => (
                    <Picker.Item
                      key={cls.id}
                      label={`${cls.class_name} - ${cls.section}`}
                      value={cls.id}
                    />
                  ))}
                </Picker>
              </View>

              {/* Personal Details */}
              <Text style={styles.sectionTitle}>Personal Details</Text>

              <Text style={styles.inputLabel}>Aadhar Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Aadhar Number"
                value={form.aadhar_no}
                onChangeText={(text) => handleFormChange('aadhar_no', text)}
                keyboardType="number-pad"
                maxLength={12}
              />

              <Text style={styles.inputLabel}>Place of Birth</Text>
              <TextInput
                style={styles.input}
                placeholder="Place of Birth"
                value={form.place_of_birth}
                onChangeText={(text) => handleFormChange('place_of_birth', text)}
              />

              <Text style={styles.inputLabel}>Nationality</Text>
              <TextInput
                style={styles.input}
                placeholder="Nationality"
                value={form.nationality}
                onChangeText={(text) => handleFormChange('nationality', text)}
              />

              <Text style={styles.inputLabel}>Religion</Text>
              <TextInput
                style={styles.input}
                placeholder="Religion"
                value={form.religion}
                onChangeText={(text) => handleFormChange('religion', text)}
              />

              <Text style={styles.inputLabel}>Caste</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.caste}
                  style={styles.picker}
                  onValueChange={(value) => handleFormChange('caste', value)}
                >
                  {casteOptions.map(caste => (
                    <Picker.Item key={caste} label={caste} value={caste} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Mother Tongue</Text>
              <TextInput
                style={styles.input}
                placeholder="Mother Tongue"
                value={form.mother_tongue}
                onChangeText={(text) => handleFormChange('mother_tongue', text)}
              />

              <Text style={styles.inputLabel}>Blood Group</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.blood_group}
                  style={styles.picker}
                  onValueChange={(value) => handleFormChange('blood_group', value)}
                >
                  <Picker.Item label="Select Blood Group" value="" />
                  {bloodGroupOptions.map(bg => (
                    <Picker.Item key={bg} label={bg} value={bg} />
                  ))}
                </Picker>
              </View>
            </ScrollView>

            {/* Date Picker */}
            {showDatePicker && (
              <DateTimePicker
                value={form.dob ? new Date(form.dob) : new Date()}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={editModalVisible ? handleEditSave : handleSubmit}
              >
                <Text style={styles.modalButtonText}>
                  {editModalVisible ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => {
                  setModalVisible(false);
                  setEditModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* View Student Profile Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Student Details</Text>
            
            {selectedStudent && (
              <ScrollView style={styles.modalScrollView}>
                <Text style={styles.studentInfoText}>Name: {selectedStudent.name}</Text>
                <Text style={styles.studentInfoText}>Admission No: {selectedStudent.admission_no || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Gender: {selectedStudent.gender || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Date of Birth: {formatDateForDisplay(selectedStudent.dob) || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Age: {calculateAge(selectedStudent.dob)} years</Text>
                <Text style={styles.studentInfoText}>Class: {selectedStudent.className || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Section: {selectedStudent.section || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Roll No: {selectedStudent.roll_no || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Academic Year: {selectedStudent.academic_year || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Academic Performance: {selectedStudent.hasMarks ? selectedStudent.academicPercentage : '0'}%</Text>
                <Text style={styles.studentInfoText}>Attendance: {selectedStudent.attendancePercentage || '0'}%</Text>
                <Text style={styles.studentInfoText}>Nationality: {selectedStudent.nationality || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Religion: {selectedStudent.religion || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Caste: {selectedStudent.caste || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Blood Group: {selectedStudent.blood_group || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Mother Tongue: {selectedStudent.mother_tongue || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Place of Birth: {selectedStudent.place_of_birth || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Aadhar No: {selectedStudent.aadhar_no || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Address: {selectedStudent.address || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Pin Code: {selectedStudent.pin_code || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Parent Name: {selectedStudent.parentName || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>Parent Phone: {selectedStudent.parentPhone || 'N/A'}</Text>
                <Text style={styles.studentInfoText}>General Behaviour: {selectedStudent.general_behaviour || 'N/A'}</Text>
                {selectedStudent.remarks && (
                  <Text style={styles.studentInfoText}>Remarks: {selectedStudent.remarks}</Text>
                )}
                {selectedStudent.identification_mark_1 && (
                  <Text style={styles.studentInfoText}>Identification Mark 1: {selectedStudent.identification_mark_1}</Text>
                )}
                {selectedStudent.identification_mark_2 && (
                  <Text style={styles.studentInfoText}>Identification Mark 2: {selectedStudent.identification_mark_2}</Text>
                )}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#aaa' }]}
                onPress={() => setViewModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddStudent}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
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
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Manage Students Card
  manageCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  manageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  profileIcon: {
    padding: 5,
  },
  // Filters Section
  filtersSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterDropdown: {
    flex: 1,
    marginHorizontal: 5,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
    backgroundColor: '#fff',
    position: 'relative',
    minHeight: 36,
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    color: '#333',
    fontSize: 14,
  },

  // Section dropdown specific styles
  sectionLabel: {
    color: '#4CAF50',
  },
  sectionDropdown: {
    borderColor: '#4CAF50',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  // Student Card Styles
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 180,
  },
  topStudentCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#FFFBF0',
  },
  topStudentBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  topStudentText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  studentHeader: {
    marginBottom: 16,
    alignItems: 'flex-start',
    marginTop: 8,
    paddingRight: 100, // Ensure space for Top Student badge
  },
  studentNumber: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
    maxWidth: '60%', // Prevent overlap with Top Student badge
  },
  studentName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    lineHeight: 24,
  },
  studentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  classInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  classText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 6,
  },
  parentText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  behaviorText: {
    fontSize: 12,
    color: '#666',
  },
  feesText: {
    fontSize: 12,
    color: '#666',
  },
  normalBehavior: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  paidText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  unpaidText: {
    color: '#f44336',
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'center',
  },
  attendanceContainer: {
    alignItems: 'center',
  },
  attendancePercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  attendanceLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  academicContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  academicPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  academicLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  secondaryContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  secondaryLabel: {
    fontSize: 8,
    color: '#999',
    marginTop: 2,
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  viewScoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  viewScoreText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: 4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  editText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '500',
    marginLeft: 4,
  },
  // Enhanced Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyActions: {
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
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
  emptySecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  emptySecondaryText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  // Modern FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#2196F3',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginTop: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    height: 48,
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  // Profile Modal Styles
  profileSection: {
    marginBottom: 20,
  },
  profileSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  profileValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  // Floating Action Button
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Futuristic Modal Styles
  futuristicModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackgroundGradient: {
    flex: 1,
    width: '100%',
    backgroundColor: 'linear-gradient(135deg, rgba(106, 17, 203, 0.1) 0%, rgba(37, 117, 252, 0.1) 100%)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  futuristicModalContainer: {
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  glassModalHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    position: 'relative',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(103, 126, 234, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  futuristicModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  futuristicModalSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  futuristicScrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  glassInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(255, 255, 255, 0.1)',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardIconContainer: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statPercent: {
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  remarksSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  remarksText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  addressSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  addressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  modalFabContainer: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    flexDirection: 'row',
  },
  modalFab: {
    marginLeft: 15,
  },
  modalFabGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#4ECDC4',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.6,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },

  // Clean Modal Styles
  cleanModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cleanModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  cleanModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  cleanAvatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cleanAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    elevation: 3,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cleanAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cleanHeaderInfo: {
    flex: 1,
  },
  cleanStudentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cleanStudentClass: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  cleanCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  cleanScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cleanInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    marginBottom: 15,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  cleanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cleanCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cleanCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cleanInfoGrid: {
    gap: 12,
  },
  cleanInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  cleanInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  cleanInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  cleanStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  cleanStatItem: {
    alignItems: 'center',
  },
  cleanStatCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cleanStatNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  cleanStatLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  cleanActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 5,
    gap: 15,
  },
  cleanActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cleanActionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Simple Modal Styles for View Profile
  studentModalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  modalIconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  modalIconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  // Simple student info text style
  studentInfoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    paddingVertical: 4,
  },
});

export default ManageStudents;
