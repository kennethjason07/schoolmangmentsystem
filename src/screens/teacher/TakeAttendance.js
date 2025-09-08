import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import Header from '../../components/Header';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import { useAuth } from '../../utils/AuthContext';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { createBulkAttendanceNotifications } from '../../utils/attendanceNotificationHelpers';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';

function formatDateDMY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return '';
    return `${d}-${m}-${y}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

const TakeAttendance = () => {
  const today = new Date();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateDMY(new Date().toISOString().split('T')[0]));
  const [attendanceMark, setAttendanceMark] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewClass, setViewClass] = useState(null);
  const [viewSection, setViewSection] = useState(null);
  const [viewDate, setViewDate] = useState(selectedDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearMode, setClearMode] = useState(false); // Track if user manually cleared attendance
  const { user } = useAuth();
  const { tenantId } = useTenantContext();

  // Fetch teacher's assigned classes and students
  const fetchClassesAndStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate tenant access before proceeding
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        return;
      }
      
      // Get teacher info using the helper function
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) throw new Error('Teacher not found');
      setTeacherInfo(teacherData);

      // Get assigned classes and subjects with tenant isolation
      const tenantQuery = createTenantQuery(supabase.from(TABLES.TEACHER_SUBJECTS), tenantId);
      const { data: assignedSubjects, error: subjectsError } = await tenantQuery
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            classes(class_name, id, section)
          )
        `)
        .eq('teacher_id', teacherData.id);

      if (subjectsError) throw subjectsError;

      // Validate fetched data belongs to correct tenant
      const validationResult = await validateDataTenancy(
        assignedSubjects?.map(s => ({ 
          id: s.id, 
          tenant_id: s.tenant_id 
        })) || [],
        tenantId
      );
      
      if (!validationResult.isValid) {
        console.error('❌ Tenant data validation failed:', validationResult.error);
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
        return;
      }

      // Extract unique classes
      const classMap = new Map();

      assignedSubjects.forEach(subject => {
        if (subject.subjects?.classes) {
          // Create a unique key combining class_name and section to avoid duplicates
          const uniqueKey = `${subject.subjects.classes.class_name}-${subject.subjects.classes.section}`;
          if (!classMap.has(uniqueKey)) {
            classMap.set(uniqueKey, {
              id: subject.subjects.classes.id,
              class_name: subject.subjects.classes.class_name,
              section: subject.subjects.classes.section
            });
          }
        }
      });

      const classList = Array.from(classMap.values());
      
      setClasses(classList);
      
      // Only set default selection if no class is currently selected
      if (classList.length > 0 && !selectedClass) {
        setSelectedClass(classList[0].id);
        setViewClass(classList[0].id);
        setSelectedSection(classList[0].section);
        setViewSection(classList[0].section);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch students when class or section changes
  const fetchStudents = async () => {
    if (!selectedClass) return;
    
    try {
      setLoading(true);
      
      // Validate tenant access before fetching students
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for students:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        return;
      }
      
      // Get students for the selected class with tenant isolation
      const tenantQuery = createTenantQuery(supabase.from(TABLES.STUDENTS), tenantId);
      const { data: studentsData, error: studentsError } = await tenantQuery
        .select(`
          id,
          name,
          admission_no,
          classes(class_name, section),
          tenant_id
        `)
        .eq('class_id', selectedClass)
        .order('admission_no');

      if (studentsError) throw studentsError;
      
      // Validate fetched students belong to correct tenant
      const validationResult = await validateDataTenancy(
        studentsData?.map(s => ({ 
          id: s.id, 
          tenant_id: s.tenant_id 
        })) || [],
        tenantId
      );
      
      if (!validationResult.isValid) {
        console.error('❌ Student data validation failed:', validationResult.error);
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
        return;
      }
      
      setStudents(studentsData || []);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  // OPTIMIZED: Fetch existing attendance with minimal data
  const fetchExistingAttendance = async () => {
    if (!selectedClass || !selectedDate || students.length === 0) return;
    
    // Skip fetching if user has manually cleared attendance
    if (clearMode) {
      console.log('Clear mode active - skipping attendance fetch');
      return;
    }
    
    try {
      // Validate tenant access before fetching attendance
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for attendance:', tenantValidation.error);
        return; // Silent return for better UX on attendance fetch
      }
      
      console.log('🔍 [DEBUG] Fetching existing attendance...');
      console.log('🔍 [DEBUG] Class ID:', selectedClass);
      console.log('🔍 [DEBUG] Date:', selectedDate);
      console.log('🔍 [DEBUG] Student IDs:', students.map(s => s.id));
      
      // Get existing attendance records with tenant isolation
      const tenantQuery = createTenantQuery(supabase.from(TABLES.STUDENT_ATTENDANCE), tenantId);
      const { data: attendanceData, error: attendanceError } = await tenantQuery
        .select('student_id, status, tenant_id')  // Include tenant_id for validation
        .eq('date', selectedDate)
        .eq('class_id', selectedClass);

      if (attendanceError) throw attendanceError;

      // Validate fetched attendance data belongs to correct tenant
      const validationResult = await validateDataTenancy(
        attendanceData?.map(a => ({ 
          id: a.student_id, 
          tenant_id: a.tenant_id 
        })) || [],
        tenantId
      );
      
      if (!validationResult.isValid) {
        console.error('❌ Attendance data validation failed:', validationResult.error);
        return; // Silent return for better UX
      }

      console.log('🔍 [DEBUG] Found attendance records:', attendanceData?.length || 0);
      console.log('🔍 [DEBUG] Attendance data:', JSON.stringify(attendanceData, null, 2));

      // Create attendance mark object
      const mark = {};
      attendanceData?.forEach(record => {
        mark[record.student_id] = record.status;
        console.log('🔍 [DEBUG] Mapping student_id', record.student_id, 'to status', record.status);
      });
      
      console.log('🔍 [DEBUG] Final attendance mark object:', JSON.stringify(mark, null, 2));
      setAttendanceMark(mark);

    } catch (err) {
      console.error('❌ [ERROR] Error fetching attendance:', err);
    }
  };

  useEffect(() => {
    fetchClassesAndStudents();
    
    // OPTIMIZED: Set up targeted real-time subscription for attendance updates
    let attendanceSubscription = null;
    
    if (selectedClass && selectedDate) {
      console.log('⚡ [OPTIMIZED] Setting up real-time subscription for attendance updates...');
      attendanceSubscription = supabase
        .channel(`attendance-updates-${selectedClass}-${selectedDate}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLES.STUDENT_ATTENDANCE,
          filter: `class_id=eq.${selectedClass}`
        }, (payload) => {
          console.log('⚡ [OPTIMIZED] Real-time attendance update received:', payload);
          // Only refresh if the update is for current date and class
          if (payload.new?.date === selectedDate || payload.old?.date === selectedDate) {
            console.log('⚡ [OPTIMIZED] Refreshing attendance data due to real-time update');
            fetchExistingAttendance();
          }
        })
        .subscribe();
    }

    return () => {
      if (attendanceSubscription) {
        attendanceSubscription.unsubscribe();
        console.log('⚡ [OPTIMIZED] Unsubscribed from real-time attendance updates');
      }
    };
  }, [selectedClass, selectedDate]); // Re-subscribe when class or date changes

  useEffect(() => {
    fetchStudents();
    
    // OPTIMIZED: Set up targeted real-time subscription for student updates
    let studentSubscription = null;
    
    if (selectedClass) {
      console.log('⚡ [OPTIMIZED] Setting up real-time subscription for student updates...');
      studentSubscription = supabase
        .channel(`student-updates-${selectedClass}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLES.STUDENTS,
          filter: `class_id=eq.${selectedClass}`
        }, (payload) => {
          console.log('⚡ [OPTIMIZED] Real-time student update received:', payload);
          // Only refresh if the update is for current class
          if (payload.new?.class_id === selectedClass || payload.old?.class_id === selectedClass) {
            console.log('⚡ [OPTIMIZED] Refreshing student data due to real-time update');
            fetchStudents();
          }
        })
        .subscribe();
    }

    return () => {
      if (studentSubscription) {
        studentSubscription.unsubscribe();
        console.log('⚡ [OPTIMIZED] Unsubscribed from real-time student updates');
      }
    };
  }, [selectedClass]);

  useEffect(() => {
    fetchExistingAttendance();
  }, [selectedClass, selectedSection, selectedDate, students]);

  // Reset clear mode when date or class changes
  useEffect(() => {
    if (clearMode) {
      setClearMode(false);
      console.log('Clear mode deactivated - date/class changed');
    }
  }, [selectedClass, selectedDate]);

  const handleMarkAttendance = async () => {
    try {
      if (loading) return;
      
      setLoading(true);
      
      // Validate tenant access before saving attendance
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for saving attendance:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        return;
      }
      
      if (students.length === 0) {
        Alert.alert('No Students', 'No students found for the selected class and section.');
        return;
      }

      // Get explicitly marked students (those with Present/Absent status)
      const explicitlyMarkedStudents = students.filter(student => {
        const status = attendanceMark[student.id];
        return status === 'Present' || status === 'Absent';
      });

      if (explicitlyMarkedStudents.length === 0) {
        Alert.alert('No Attendance Marked', 'Please mark at least one student as Present or Absent before submitting.');
        return;
      }

      // Ensure we have teacher info with tenant_id
      if (!teacherInfo?.tenant_id) {
        Alert.alert('Error', 'Teacher information not loaded properly. Please try again.');
        return;
      }

      // Prepare attendance records only for explicitly marked students
      const attendanceRecords = explicitlyMarkedStudents.map(student => ({
        student_id: student.id,
        class_id: selectedClass,
        date: selectedDate,
        status: attendanceMark[student.id], // No fallback - we know it's defined
        marked_by: user.id,
        tenant_id: teacherInfo.tenant_id // Include tenant_id for multi-tenant support
      }));

      // 🔍 DEBUG: Log what we're about to submit
      console.log('🔍 [DEBUG] About to submit attendance records:');
      console.log('🔍 [DEBUG] Selected Class:', selectedClass);
      console.log('🔍 [DEBUG] Selected Date:', selectedDate);
      console.log('🔍 [DEBUG] Tenant ID:', teacherInfo.tenant_id);
      console.log('🔍 [DEBUG] Records to submit:', JSON.stringify(attendanceRecords, null, 2));
      console.log('🔍 [DEBUG] Current attendanceMark state:', JSON.stringify(attendanceMark, null, 2));

      // WORKAROUND: Since there's no unique constraint in the database yet,
      // we'll delete existing records for these students on this date, then insert new ones
      console.log('🔄 [WORKAROUND] Delete existing records then insert new ones (no unique constraint available)');
      
      // Step 1: Delete existing attendance records for these students on this date with tenant isolation
      // Use tenant-aware query to ensure only records from the current tenant are affected
      const studentIds = attendanceRecords.map(record => record.student_id);
      console.log('🗑️ [DELETE] Removing existing records for students with tenant isolation:', studentIds);
      
      const tenantDeleteQuery = createTenantQuery(supabase.from(TABLES.STUDENT_ATTENDANCE), tenantId);
      const { error: deleteError } = await tenantDeleteQuery
        .delete()
        .eq('date', selectedDate)
        .eq('class_id', selectedClass)
        .in('student_id', studentIds);
        
      if (deleteError) {
        console.error('❌ [DELETE ERROR]:', deleteError);
        throw new Error(`Failed to delete existing records: ${deleteError.message}`);
      }
      
      console.log('✅ [DELETE] Successfully deleted existing records');
      
      // Step 2: Insert the new attendance records with tenant isolation
      console.log('➕ [INSERT] Inserting new attendance records with tenant isolation');
      
      const tenantInsertQuery = createTenantQuery(supabase.from(TABLES.STUDENT_ATTENDANCE), tenantId);
      const { error: insertError } = await tenantInsertQuery
        .insert(attendanceRecords);
        
      if (insertError) {
        console.error('❌ [INSERT ERROR]:', insertError);
        throw new Error(`Failed to insert new records: ${insertError.message}`);
      }
      
      console.log('✅ [INSERT] Successfully inserted new records');

      console.log('✅ [SUCCESS] Attendance submitted successfully!');
      
      // 🔄 REFRESH: Immediately refresh attendance data to show updated state
      console.log('🔄 [REFRESH] Refreshing attendance data after submission...');
      await fetchExistingAttendance();
      console.log('🔄 [REFRESH] Attendance data refreshed!');

      // Show simple success message
      Alert.alert('Success', 'Attendance saved successfully!');

      // Send absence notifications in the background (non-blocking)
      const absentStudents = attendanceRecords.filter(record => record.status === 'Absent');
      if (absentStudents.length > 0) {
        console.log(`📧 Sending absence notifications for ${absentStudents.length} students`);
        // TODO: Add notification sending logic here
      }
      
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', `Failed to save attendance: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // For viewing attendance in modal
  const [viewAttendance, setViewAttendance] = useState([]);
  
  const fetchViewAttendance = async () => {
    if (!viewClass || !viewDate) return;
    
    try {
      // Validate tenant access before fetching view attendance
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for view attendance:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        return;
      }
      
      // Get students for the view class with tenant isolation
      const tenantStudentQuery = createTenantQuery(supabase.from(TABLES.STUDENTS), tenantId);
      const { data: viewStudents } = await tenantStudentQuery
        .select('id, name, admission_no, tenant_id')
        .eq('class_id', viewClass);

      if (!viewStudents || viewStudents.length === 0) {
        setViewAttendance([]);
        return;
      }
      
      // Validate students belong to correct tenant
      const studentValidation = await validateDataTenancy(
        viewStudents?.map(s => ({ 
          id: s.id, 
          tenant_id: s.tenant_id 
        })) || [],
        tenantId
      );
      
      if (!studentValidation.isValid) {
        console.error('❌ Student validation failed for view:', studentValidation.error);
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
        return;
      }

      // Get attendance records with tenant isolation
      const tenantAttendanceQuery = createTenantQuery(supabase.from(TABLES.STUDENT_ATTENDANCE), tenantId);
      const { data: attendanceData, error: attendanceError } = await tenantAttendanceQuery
        .select(`
          *,
          students(name, admission_no),
          tenant_id
        `)
        .eq('date', viewDate)
        .in('student_id', viewStudents.map(s => s.id));

      if (attendanceError) throw attendanceError;
      
      // Validate attendance data belongs to correct tenant
      const attendanceValidation = await validateDataTenancy(
        attendanceData?.map(a => ({ 
          id: a.id, 
          tenant_id: a.tenant_id 
        })) || [],
        tenantId
      );
      
      if (!attendanceValidation.isValid) {
        console.error('❌ Attendance validation failed for view:', attendanceValidation.error);
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
        return;
      }

      // Combine student info with attendance
      const combinedAttendance = viewStudents.map(student => {
        const attendance = attendanceData.find(a => a.student_id === student.id);
        return {
          student_id: student.id,
          student_name: student.name,
          roll_number: student.admission_no,
          date: viewDate,
          status: attendance ? attendance.status : 'Not Marked'
        };
      });

      setViewAttendance(combinedAttendance);

    } catch (err) {
      console.error('Error fetching view attendance:', err);
      setViewAttendance([]);
    }
  };

  useEffect(() => {
    if (viewModalVisible) {
      fetchViewAttendance();
    }
  }, [viewClass, viewDate, viewModalVisible]);

  const exportToPDF = async () => {
    try {
      const present = viewAttendance.filter(r => r.status === 'Present');
      const absent = viewAttendance.filter(r => r.status === 'Absent');
      const notMarked = viewAttendance.filter(r => r.status === 'Not Marked');
      
      let html = `
        <h2 style="text-align:center;">Attendance Report</h2>
        <h3 style="text-align:center;">Class: ${viewClass} | Date: ${formatDateDMY(viewDate)}</h3>
        
        <h4 style="text-align:center; color: #4CAF50;">Present Students (${present.length})</h4>
        <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background-color:#f5f5f5;"><th style="text-align:center;padding:8px;">Admission No</th><th style="text-align:center;padding:8px;">Student Name</th></tr>
          ${present.map(r => `<tr><td style="text-align:center;padding:8px;">${r.roll_number || '-'}</td><td style="text-align:center;padding:8px;">${r.student_name || '-'}</td></tr>`).join('') || '<tr><td style="text-align:center;padding:8px;">-</td><td style="text-align:center;padding:8px;">-</td></tr>'}
        </table>
        
        <h4 style="text-align:center; color: #F44336;">Absent Students (${absent.length})</h4>
        <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background-color:#f5f5f5;"><th style="text-align:center;padding:8px;">Admission No</th><th style="text-align:center;padding:8px;">Student Name</th></tr>
          ${absent.map(r => `<tr><td style="text-align:center;padding:8px;">${r.roll_number || '-'}</td><td style="text-align:center;padding:8px;">${r.student_name || '-'}</td></tr>`).join('') || '<tr><td style="text-align:center;padding:8px;">-</td><td style="text-align:center;padding:8px;">-</td></tr>'}
        </table>
        
        ${notMarked.length > 0 ? `
        <h4 style="text-align:center; color: #FF9800;">Not Marked (${notMarked.length})</h4>
        <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background-color:#f5f5f5;"><th style="text-align:center;padding:8px;">Admission No</th><th style="text-align:center;padding:8px;">Student Name</th></tr>
          ${notMarked.map(r => `<tr><td style="text-align:center;padding:8px;">${r.roll_number || '-'}</td><td style="text-align:center;padding:8px;">${r.student_name || '-'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        <div style="margin-top:20px;text-align:center;">
          <p><strong>Total Students:</strong> ${viewAttendance.length}</p>
          <p><strong>Present:</strong> ${present.length} (${Math.round((present.length / viewAttendance.length) * 100)}%)</p>
          <p><strong>Absent:</strong> ${absent.length} (${Math.round((absent.length / viewAttendance.length) * 100)}%)</p>
        </div>
      `;
      
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
      console.error('PDF generation error:', error);
    }
  };

  // Toggle attendance status for a student
  const toggleStudentAttendance = (studentId, status) => {
    setAttendanceMark(prev => {
      const currentStatus = prev[studentId];
      // If clicking the same status, clear it (unmark)
      if (currentStatus === status) {
        const newState = { ...prev };
        delete newState[studentId];
        return newState;
      }
      // Otherwise, set the new status
      return {
        ...prev,
        [studentId]: status
      };
    });
  };

  // Mark all students as present
  const markAllAsPresent = () => {
    if (students.length === 0) {
      Alert.alert('No Students', 'No students found to mark as present.');
      return;
    }

    Alert.alert(
      'Mark All as Present',
      `Are you sure you want to mark all ${students.length} students as Present for ${displayDate || formatDateDMY(selectedDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All Present',
          style: 'default',
          onPress: () => {
            const newAttendanceMark = {};
            students.forEach(student => {
              newAttendanceMark[student.id] = 'Present';
            });
            setAttendanceMark(newAttendanceMark);
            
            // Show success message
            Alert.alert('Success', `All ${students.length} students have been marked as Present.`);
            console.log(`✅ Marked all ${students.length} students as Present`);
          }
        }
      ]
    );
  };

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Store current selection before refreshing
      const currentSelectedClass = selectedClass;
      const currentSelectedSection = selectedSection;
      
      // Refresh all data
      await Promise.all([
        fetchClassesAndStudents(),
        selectedClass ? fetchStudents() : Promise.resolve(),
        (selectedClass && selectedDate && students.length > 0) ? fetchExistingAttendance() : Promise.resolve()
      ]);
      
      // Restore selection if it was lost during refresh
      if (currentSelectedClass && !selectedClass) {
        setSelectedClass(currentSelectedClass);
        setSelectedSection(currentSelectedSection);
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 10, color: '#1976d2' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 20 }}>Error: {error}</Text>
          <TouchableOpacity style={{ backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }} onPress={fetchClassesAndStudents}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Take Attendance" showBack={true} />
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
      >
        <View style={{ padding: 20 }}>
          {/* Class and Date Selection */}
          <View style={styles.selectionContainer}>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Select Class</Text>
              <Picker
                selectedValue={selectedClass}
                onValueChange={(itemValue) => {
                  setSelectedClass(itemValue);
                  const selectedClassData = classes.find(c => c.id === itemValue);
                  if (selectedClassData) {
                    setSelectedSection(selectedClassData.section);
                  }
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select Class" value={null} />
                {classes.map(cls => (
                  <Picker.Item 
                    key={cls.id} 
                    label={`${cls.class_name} ${cls.section}`} 
                    value={cls.id} 
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.dateContainer}>
              <Text style={styles.pickerLabel}>Select Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {displayDate || formatDateDMY(selectedDate)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Attendance Count Summary */}
          {students.length > 0 && (
            <View style={styles.countContainer}>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {Object.values(attendanceMark).filter(status => status === 'Present').length}
                </Text>
                <Text style={styles.countLabel}>Present</Text>
              </View>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {Object.values(attendanceMark).filter(status => status === 'Absent').length}
                </Text>
                <Text style={styles.countLabel}>Absent</Text>
              </View>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {students.length - Object.keys(attendanceMark).length}
                </Text>
                <Text style={styles.countLabel}>Not Marked</Text>
              </View>
            </View>
          )}

          {showDatePicker && Platform.OS !== 'web' && (
            <DateTimePicker 
              value={selectedDate ? new Date(selectedDate) : new Date()} 
              mode="date" 
              display="default" 
              onChange={(event, selected) => { 
                setShowDatePicker(false); 
                if (selected) { 
                  const dd = String(selected.getDate()).padStart(2, '0'); 
                  const mm = String(selected.getMonth() + 1).padStart(2, '0'); 
                  const yyyy = selected.getFullYear(); 
                  const isoDate = `${yyyy}-${mm}-${dd}`;
                  const displayDate = `${dd}-${mm}-${yyyy}`;
                  
                  // Reset clear mode when date is changed via picker
                  if (clearMode) {
                    setClearMode(false);
                    console.log('Clear mode deactivated - date changed via picker');
                  }
                  
                  setSelectedDate(isoDate); 
                  setDisplayDate(displayDate);
                } 
              }}
            />
          )}

          {/* Instruction Message */}
          {students.length > 0 && (
            <View style={styles.instructionContainer}>
              <Ionicons name="information-circle" size={20} color="#2196F3" />
              <Text style={styles.instructionText}>
                Tap Present (P) or Absent (A) to mark students. Tap again to unmark. Only explicitly marked students will be saved.
              </Text>
            </View>
          )}

          {/* Students List */}
          {students.length > 0 ? (
            <View style={styles.studentsContainer}>
              <View style={styles.tableHeader}>
                <View style={[styles.headerCellContainer, { flex: 3.5 }]}>
                  <Ionicons name="person" size={16} color="#1976d2" style={{ marginRight: 4 }} />
                  <Text style={styles.headerCell}>Student Details</Text>
                  <View style={styles.headerButtonsContainer}>
                    <TouchableOpacity 
                      style={styles.markAllPresentButton}
                      onPress={markAllAsPresent}
                    >
                      <Ionicons name="checkmark-done" size={14} color="#4caf50" />
                      <Text style={styles.markAllPresentButtonText}>All Present</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.clearButton}
                      onPress={() => {
                        Alert.alert(
                          'Clear Attendance',
                          'Are you sure you want to clear all attendance marks? This will permanently delete the attendance records for this date.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Clear All', 
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  setLoading(true);
                                  
                                  // Delete attendance records from database
                                  const { error: deleteError } = await supabase
                                    .from(TABLES.STUDENT_ATTENDANCE)
                                    .delete()
                                    .eq('date', selectedDate)
                                    .eq('class_id', selectedClass);
                                  
                                  if (deleteError) {
                                    console.error('Error deleting attendance records:', deleteError);
                                    Alert.alert('Error', 'Failed to clear attendance records from database.');
                                    return;
                                  }
                                  
                                  // Clear local state
                                  setAttendanceMark({});
                                  setClearMode(true);
                                  
                                  Alert.alert('Success', 'Attendance records cleared successfully!');
                                  console.log('Attendance records cleared from database and local state');
                                  
                                } catch (error) {
                                  console.error('Error clearing attendance:', error);
                                  Alert.alert('Error', 'Failed to clear attendance records.');
                                } finally {
                                  setLoading(false);
                                }
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="refresh" size={14} color="#ff9800" />
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={[styles.headerCellContainer, { flex: 1 }]}>
                  <Ionicons name="close" size={18} color="#f44336" style={{ marginRight: 4 }} />
                  <Text style={[styles.headerCell, { color: '#f44336' }]}>A</Text>
                </View>
                <View style={[styles.headerCellContainer, { flex: 1 }]}>
                  <Ionicons name="checkmark" size={18} color="#4caf50" style={{ marginRight: 4 }} />
                  <Text style={[styles.headerCell, { color: '#4caf50' }]}>P</Text>
                </View>
              </View>
              
              {students.map(student => {
                const currentStatus = attendanceMark[student.id];
                
                return (
                  <View key={student.id} style={[
                    styles.studentRow,
                    currentStatus === 'Present' && styles.presentRowHighlight,
                    currentStatus === 'Absent' && styles.absentRowHighlight
                  ]}>
                    <View style={[styles.nameCell, { flex: 3.5 }]}>
                      <View style={styles.studentDetailsContainer}>
                        <Text 
                          style={styles.studentName} 
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {student.name}
                        </Text>
                        <Text style={styles.admissionNumberBelow}>#{student.admission_no}</Text>
                      </View>
                      {currentStatus && (
                        <View style={[
                          styles.statusBadge,
                          currentStatus === 'Present' ? styles.presentBadge : styles.absentBadge
                        ]}>
                          <Text style={styles.statusBadgeText}>{currentStatus}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Absent Button */}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[
                          styles.attendanceCircle,
                          currentStatus === 'Absent' && styles.absentCircle
                        ]}
                        onPress={() => toggleStudentAttendance(student.id, 'Absent')}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={currentStatus === 'Absent' ? '#fff' : '#ccc'}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Present Button */}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[
                          styles.attendanceCircle,
                          currentStatus === 'Present' && styles.presentCircle
                        ]}
                        onPress={() => toggleStudentAttendance(student.id, 'Present')}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={currentStatus === 'Present' ? '#fff' : '#ccc'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No students found for the selected class and section.</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleMarkAttendance}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : 'Submit Attendance'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.viewButton} 
              onPress={() => { 
                setViewClass(selectedClass); 
                setViewSection(selectedSection);
                setViewDate(selectedDate); 
                setViewModalVisible(true); 
              }}
            >
              <Text style={styles.viewButtonText}>View Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* View Attendance Modal */}
      <Modal 
        visible={viewModalVisible} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>View Attendance</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1976d2" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalFilters}>
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Class:</Text>
                {Platform.OS === 'web' ? (
                  <select 
                    value={viewClass} 
                    onChange={e => setViewClass(e.target.value)} 
                    style={styles.webSelect}
                  >
                    {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.class_name} - {cls.section}</option>)}
                  </select>
                ) : (
                  <Picker 
                    selectedValue={viewClass} 
                    onValueChange={setViewClass} 
                    style={styles.modalPicker}
                  >
                    {classes.map(cls => <Picker.Item key={cls.id} label={`${cls.class_name} - ${cls.section}`} value={cls.id} />)}
                  </Picker>
                )}
              </View>
              
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Date:</Text>
                {Platform.OS === 'web' ? (
                  <input 
                    type="date" 
                    value={viewDate} 
                    onChange={e => {
                      // Reset clear mode when date is changed via web input
                      if (clearMode) {
                        setClearMode(false);
                        console.log('Clear mode deactivated - date changed via web input');
                      }
                      setViewDate(e.target.value);
                    }} 
                    style={styles.webInput}
                  />
                ) : (
                  <TouchableOpacity 
                    style={styles.dateButton} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {viewDate ? formatDateDMY(viewDate) : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalTableHeader}>
                <Text style={styles.modalHeaderCell}>Admission No</Text>
                <Text style={styles.modalHeaderCell}>Student Name</Text>
                <Text style={styles.modalHeaderCell}>Status</Text>
              </View>
              
              {viewAttendance.map(record => (
                <View key={record.student_id} style={styles.modalStudentRow}>
                  <Text style={styles.modalStudentCell}>{record.roll_number || '-'}</Text>
                  <Text style={styles.modalStudentCell}>{record.student_name || '-'}</Text>
                  <Text style={[
                    styles.modalStudentCell, 
                    styles.statusText,
                    record.status === 'Present' ? styles.presentStatus : 
                    record.status === 'Absent' ? styles.absentStatus : 
                    styles.notMarkedStatus
                  ]}>
                    {record.status}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={exportToPDF} style={styles.exportButton}>
                <Text style={styles.exportButtonText}>Export to PDF</Text>
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
  scrollView: {
    flex: 1,
  },
  selectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  dateContainer: {
    marginBottom: 0,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  webSelect: {
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  webInput: {
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    color: '#333',
    fontSize: 15,
  },
  countContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'space-around',
  },
  countBox: {
    alignItems: 'center',
    flex: 1,
  },
  countNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  countLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  studentsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerCellContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerCell: {
    fontWeight: '700',
    textAlign: 'center',
    color: '#333333',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 16,
    paddingHorizontal: 8,
    minHeight: 70,
  },
  studentCell: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
  },
  attendanceButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  noDataContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  noDataText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flex: 1,
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  viewButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flex: 1,
    marginLeft: 8,
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalFilters: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  modalPickerContainer: {
    flex: 1,
    marginHorizontal: 4,
    minWidth: 100,
  },
  modalPickerLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  modalPicker: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    fontSize: 14,
  },
  modalStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 8,
  },
  modalStudentCell: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
    fontSize: 14,
  },
  statusText: {
    fontWeight: 'bold',
  },
  presentStatus: {
    color: '#4CAF50',
  },
  absentStatus: {
    color: '#F44336',
  },
  notMarkedStatus: {
    color: '#FF9800',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginRight: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  attendanceCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    transform: [{ scale: 1 }],
  },
  presentCircle: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
    elevation: 4,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    transform: [{ scale: 1.1 }],
  },
  absentCircle: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
    elevation: 4,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    transform: [{ scale: 1.1 }],
  },
  disabledCircle: {
    opacity: 0.5,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  presentButton: {
    backgroundColor: '#e8f5e8',
  },
  absentButton: {
    backgroundColor: '#ffebee',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Enhanced row highlighting styles
  presentRowHighlight: {
    backgroundColor: '#f8fffe',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    elevation: 1,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  absentRowHighlight: {
    backgroundColor: '#fff8f8',
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
    elevation: 1,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // Enhanced cell styles
  admissionCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  admissionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 60,
  },
  nameCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    minHeight: 50,
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#212529',
    textAlign: 'left',
    lineHeight: 20,
    paddingVertical: 2,
  },
  // Status badge styles
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  presentBadge: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  absentBadge: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#495057',
  },
  // New styles for integrated student details
  studentDetailsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 4,
  },
  admissionNumberBelow: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginTop: 2,
    alignSelf: 'flex-start',
    textAlign: 'center',
  },
  // Header buttons container
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  // Mark All as Present button styles
  markAllPresentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#81c784',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    elevation: 1,
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  markAllPresentButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4caf50',
    marginLeft: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Clear button styles
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffb74d',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: '#ff9800',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  clearButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff9800',
    marginLeft: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Instruction container styles
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: '#1976d2',
    marginLeft: 8,
    lineHeight: 18,
  },
});

export default TakeAttendance;
