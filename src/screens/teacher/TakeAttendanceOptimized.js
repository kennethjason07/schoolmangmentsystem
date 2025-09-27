import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  useTenantAccess, 
  tenantDatabase, 
  createTenantQuery,
  getCachedTenantId 
} from '../../utils/tenantHelpers';
import { debug, api, cache, error, success, tenant } from '../utils/logger';

function formatDateDMY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return '';
    return `${d}-${m}-${y}`;
  } catch (error) {
    error('Error formatting date:', error);
    return '';
  }
}

const TakeAttendanceOptimized = () => {
  // Core state
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateDMY(new Date().toISOString().split('T')[0]));
  const [attendanceMark, setAttendanceMark] = useState({});
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewClass, setViewClass] = useState(null);
  const [viewSection, setViewSection] = useState(null);
  const [viewDate, setViewDate] = useState(selectedDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearMode, setClearMode] = useState(false);
  
  // View attendance state
  const [viewAttendance, setViewAttendance] = useState([]);
  
  // Cached data
  const [teacherInfo, setTeacherInfo] = useState(null);
  const dataCache = useRef({
    students: new Map(),
    attendance: new Map()
  });
  
  const { user } = useAuth();
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // Refs for cleanup
  const subscriptionsRef = useRef([]);
  const abortControllerRef = useRef(null);
  
  // Tenant validation helper
  const validateTenantAccess = useCallback(() => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    return { valid: true, tenantId };
  }, [isReady]);

  // 🚀 OPTIMIZED: Single API call to get all initial data
  const fetchInitialData = useCallback(async () => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const validation = validateTenantAccess();
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      const tenantId = validation.tenantId;
      api('🚀 [OPTIMIZED] Fetching all initial data in single request...');
      
      // Single API call to get teacher info
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);
      
      if (teacherError || !teacherData) {
        throw new Error('Teacher profile not found. Please contact administrator.');
      }
      
      // Validate teacher tenant
      if (teacherData.tenant_id && teacherData.tenant_id !== tenantId) {
        throw new Error('Teacher data belongs to different tenant');
      }
      
      setTeacherInfo(teacherData);
      
      // Single API call to get all assigned subjects with classes
      const { data: assignedSubjects, error: subjectsError } = await tenantDatabase.read(
        TABLES.TEACHER_SUBJECTS,
        { teacher_id: teacherData.id },
        `
          *,
          subjects(
            id,
            name,
            class_id,
            classes(class_name, id, section)
          )
        `
      );

      if (subjectsError) {
        throw subjectsError;
      }

      // Process classes efficiently
      const classMap = new Map();
      assignedSubjects.forEach(subject => {
        if (subject.subjects?.classes) {
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
      
      // Set default selection only if none exists
      if (classList.length > 0 && !selectedClass) {
        const defaultClass = classList[0];
        setSelectedClass(defaultClass.id);
        setViewClass(defaultClass.id);
        setSelectedSection(defaultClass.section);
        setViewSection(defaultClass.section);
        
        // Preload students for default class
        await fetchStudentsForClass(defaultClass.id, tenantId);
      }
      
      success('✅ [OPTIMIZED] Initial data loaded successfully');
      
    } catch (err) {
      error('❌ Error in fetchInitialData:', err);
      setError(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, [user.id, validateTenantAccess, selectedClass]);

  // 🚀 OPTIMIZED: Cached student fetching
  const fetchStudentsForClass = useCallback(async (classId, tenantId) => {
    if (!classId) return;
    
    const cacheKey = `${classId}-${tenantId}`;
    
    // Check cache first
    if (dataCache.current.students.has(cacheKey)) {
      const cachedStudents = dataCache.current.students.get(cacheKey);
      setStudents(cachedStudents);
      cache('📱 [CACHE HIT] Using cached students for class:', classId);
      return cachedStudents;
    }
    
    try {
      api('📱 [API CALL] Fetching students for class:', classId);
      
      const { data: studentsData, error: studentsError } = await createTenantQuery(
        tenantId,
        TABLES.STUDENTS,
        'id, name, admission_no, classes(class_name, section)',
        { class_id: classId }
      ).order('admission_no');

      if (studentsError) {
        throw studentsError;
      }

      const students = studentsData || [];
      
      // Cache the result
      dataCache.current.students.set(cacheKey, students);
      
      // Set students only if this is still the selected class
      if (classId === selectedClass) {
        setStudents(students);
      }
      
      cache('✅ [OPTIMIZED] Cached', students.length, 'students for class:', classId);
      return students;
      
    } catch (err) {
      error('❌ Error fetching students:', err);
      setError(err.message || 'Failed to load students');
      return [];
    }
  }, [selectedClass]);

  // 🚀 OPTIMIZED: Debounced attendance fetching with caching
  const fetchAttendanceForDate = useCallback(async (classId, date, studentIds, tenantId) => {
    if (!classId || !date || !studentIds.length) return;
    
    const cacheKey = `${classId}-${date}-${tenantId}`;
    
    // Check cache first
    if (dataCache.current.attendance.has(cacheKey)) {
      const cachedAttendance = dataCache.current.attendance.get(cacheKey);
      setAttendanceMark(cachedAttendance);
      cache('📊 [CACHE HIT] Using cached attendance for:', cacheKey);
      return;
    }
    
    // Skip if in clear mode
    if (clearMode) {
      debug('Clear mode active - skipping attendance fetch');
      return;
    }
    
    try {
      api('📊 [API CALL] Fetching attendance for:', cacheKey);
      
      const { data: attendanceData, error: attendanceError } = await createTenantQuery(
        tenantId,
        TABLES.STUDENT_ATTENDANCE,
        'student_id, status',
        { 
          date: date,
          class_id: classId,
          student_id: { in: studentIds }
        }
      );

      if (attendanceError) {
        error('❌ Error fetching attendance:', attendanceError);
        return;
      }

      // Create attendance map
      const attendanceMap = {};
      attendanceData?.forEach(record => {
        attendanceMap[record.student_id] = record.status;
      });
      
      // Cache the result
      dataCache.current.attendance.set(cacheKey, attendanceMap);
      
      // Only update if this is still the current selection
      if (classId === selectedClass && date === selectedDate) {
        setAttendanceMark(attendanceMap);
      }
      
      cache('✅ [OPTIMIZED] Cached attendance for:', cacheKey);
      
    } catch (err) {
      error('❌ Error fetching attendance:', err);
    }
  }, [selectedClass, selectedDate, clearMode]);

  // 🚀 OPTIMIZED: Single effect for data loading with proper cleanup
  useEffect(() => {
    let isActive = true;
    
    const loadData = async () => {
      if (!isActive) return;
      
      if (!isReady || !user?.id) {
        debug('⏳ [OPTIMIZED] Waiting for tenant context and user...');
        return;
      }
      
      await fetchInitialData();
      
      if (!isActive) return;
      
      // Load students and attendance for selected class
      if (selectedClass) {
        const validation = validateTenantAccess();
        if (validation.valid) {
          const students = await fetchStudentsForClass(selectedClass, validation.tenantId);
          
          if (!isActive) return;
          
          if (students.length > 0) {
            const studentIds = students.map(s => s.id);
            await fetchAttendanceForDate(selectedClass, selectedDate, studentIds, validation.tenantId);
          }
        }
      }
    };
    
    loadData();
    
    return () => {
      isActive = false;
    };
  }, [isReady, user?.id, selectedClass, selectedDate, fetchInitialData, fetchStudentsForClass, fetchAttendanceForDate, validateTenantAccess]);

  // 🚀 OPTIMIZED: Single real-time subscription with proper cleanup
  useEffect(() => {
    // Clean up existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];
    
    if (!selectedClass || !selectedDate) {
      return;
    }
    
    debug('⚡ [OPTIMIZED] Setting up single real-time subscription...');
    
    // Single subscription for attendance changes
    const attendanceSubscription = supabase
      .channel(`optimized-attendance-${selectedClass}-${selectedDate}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.STUDENT_ATTENDANCE,
        filter: `class_id=eq.${selectedClass}`
      }, (payload) => {
        debug('⚡ [REAL-TIME] Attendance update received');
        
        // Invalidate cache and refetch only if relevant to current selection
        if (payload.new?.date === selectedDate || payload.old?.date === selectedDate) {
          const cacheKey = `${selectedClass}-${selectedDate}-${getCachedTenantId()}`;
          dataCache.current.attendance.delete(cacheKey);
          
          // Refetch attendance
          const validation = validateTenantAccess();
          if (validation.valid && students.length > 0) {
            const studentIds = students.map(s => s.id);
            fetchAttendanceForDate(selectedClass, selectedDate, studentIds, validation.tenantId);
          }
        }
      })
      .subscribe();
    
    subscriptionsRef.current.push(attendanceSubscription);
    
    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [selectedClass, selectedDate, students, validateTenantAccess, fetchAttendanceForDate]);

  // 🚀 OPTIMIZED: Memoized computed values
  const attendanceStats = useMemo(() => {
    const presentCount = Object.values(attendanceMark).filter(status => status === 'Present').length;
    const absentCount = Object.values(attendanceMark).filter(status => status === 'Absent').length;
    const markedCount = presentCount + absentCount;
    const totalCount = students.length;
    
    return {
      present: presentCount,
      absent: absentCount,
      marked: markedCount,
      total: totalCount,
      unmarked: totalCount - markedCount
    };
  }, [attendanceMark, students.length]);

  // 🚀 OPTIMIZED: Class change handler
  const handleClassChange = useCallback((classId) => {
    if (classId === selectedClass) return;
    
    setSelectedClass(classId);
    const selectedClassData = classes.find(c => c.id === classId);
    if (selectedClassData) {
      setSelectedSection(selectedClassData.section);
    }
    
    // Reset attendance and clear mode
    setAttendanceMark({});
    setClearMode(false);
  }, [selectedClass, classes]);

  // 🚀 OPTIMIZED: Date change handler
  const handleDateChange = useCallback((event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setSelectedDate(dateStr);
      setDisplayDate(formatDateDMY(dateStr));
      setViewDate(dateStr);
      
      // Reset attendance and clear mode
      setAttendanceMark({});
      setClearMode(false);
    }
  }, []);

  // 🚀 OPTIMIZED: Batch attendance submission
  const handleMarkAttendance = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      if (students.length === 0) {
        Alert.alert('No Students', 'No students found for the selected class and section.');
        return;
      }

      const explicitlyMarkedStudents = students.filter(student => {
        const status = attendanceMark[student.id];
        return status === 'Present' || status === 'Absent';
      });

      if (explicitlyMarkedStudents.length === 0) {
        Alert.alert('No Attendance Marked', 'Please mark at least one student as Present or Absent before submitting.');
        return;
      }

      const validation = validateTenantAccess();
      if (!validation.valid) {
        Alert.alert('Error', 'Unable to determine tenant context for saving attendance. Please contact support.');
        return;
      }
      
      const tenantId = validation.tenantId;

      if (!teacherInfo?.tenant_id || teacherInfo.tenant_id !== tenantId) {
        Alert.alert('Error', 'Teacher information not loaded properly or tenant mismatch. Please try again.');
        return;
      }

      // Batch prepare attendance records
      const attendanceRecords = explicitlyMarkedStudents.map(student => ({
        student_id: student.id,
        class_id: selectedClass,
        date: selectedDate,
        status: attendanceMark[student.id],
        marked_by: user.id,
        tenant_id: tenantId
      }));

      // Batch delete and insert operation
      const studentIds = attendanceRecords.map(record => record.student_id);
      
      // Delete existing records
      const { error: deleteError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .delete()
        .eq('date', selectedDate)
        .eq('class_id', selectedClass)
        .eq('tenant_id', tenantId)
        .in('student_id', studentIds);
        
      if (deleteError) {
        throw new Error(`Failed to delete existing records: ${deleteError.message}`);
      }
      
      // Insert new records
      const { error: insertError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .insert(attendanceRecords);
        
      if (insertError) {
        throw new Error(`Failed to insert new records: ${insertError.message}`);
      }

      // Update cache
      const cacheKey = `${selectedClass}-${selectedDate}-${tenantId}`;
      const newAttendanceMap = {...attendanceMark};
      dataCache.current.attendance.set(cacheKey, newAttendanceMap);

      Alert.alert('Success', 'Attendance saved successfully!');
      success('✅ [OPTIMIZED] Attendance submitted and cached');
      
    } catch (error) {
      error('❌ Error saving attendance:', error);
      Alert.alert('Error', `Failed to save attendance: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [loading, students, attendanceMark, validateTenantAccess, teacherInfo, selectedClass, selectedDate, user.id]);

  // 🚀 OPTIMIZED: Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Clear caches
      dataCache.current.students.clear();
      dataCache.current.attendance.clear();
      
      // Reload data
      await fetchInitialData();
      
    } catch (error) {
      error('❌ Error during refresh:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchInitialData]);

  // 🚀 OPTIMIZED: View attendance with caching
  const fetchViewAttendance = useCallback(async () => {
    if (!viewClass || !viewDate) return;
    
    try {
      const validation = validateTenantAccess();
      if (!validation.valid) {
        setViewAttendance([]);
        return;
      }
      
      const tenantId = validation.tenantId;
      
      // Get students from cache or fetch
      const studentCacheKey = `${viewClass}-${tenantId}`;
      let viewStudents = dataCache.current.students.get(studentCacheKey);
      
      if (!viewStudents) {
        const { data } = await createTenantQuery(
          tenantId,
          TABLES.STUDENTS,
          'id, name, admission_no',
          { class_id: viewClass }
        );
        viewStudents = data || [];
        dataCache.current.students.set(studentCacheKey, viewStudents);
      }

      if (viewStudents.length === 0) {
        setViewAttendance([]);
        return;
      }

      // Get attendance from cache or fetch
      const attendanceCacheKey = `${viewClass}-${viewDate}-${tenantId}`;
      let attendanceMap = dataCache.current.attendance.get(attendanceCacheKey);
      
      if (!attendanceMap) {
        const { data: attendanceData } = await createTenantQuery(
          tenantId,
          TABLES.STUDENT_ATTENDANCE,
          'student_id, status',
          { 
            date: viewDate,
            student_id: { in: viewStudents.map(s => s.id) }
          }
        );
        
        attendanceMap = {};
        attendanceData?.forEach(record => {
          attendanceMap[record.student_id] = record.status;
        });
        
        dataCache.current.attendance.set(attendanceCacheKey, attendanceMap);
      }

      // Combine data
      const combinedAttendance = viewStudents.map(student => ({
        student_id: student.id,
        student_name: student.name,
        roll_number: student.admission_no,
        date: viewDate,
        status: attendanceMap[student.id] || 'Not Marked'
      }));

      setViewAttendance(combinedAttendance);
      
    } catch (err) {
      error('❌ Error fetching view attendance:', err);
      setViewAttendance([]);
    }
  }, [viewClass, viewDate, validateTenantAccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Unsubscribe from real-time updates
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
      
      // Clear caches
      dataCache.current.students.clear();
      dataCache.current.attendance.clear();
    };
  }, []);

  // Loading states
  if (tenantLoading) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Initializing secure access...</Text>
        </View>
      </View>
    );
  }
  
  if (loading && students.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading optimized data...</Text>
          {tenantName && (
            <Text style={styles.loadingSubtext}>📚 {tenantName}</Text>
          )}
        </View>
      </View>
    );
  }

  // Error states
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Access Error</Text>
          <Text style={styles.errorMessage}>{tenantError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Loading Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Take Attendance (Optimized)" showBack={true} />
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
                onValueChange={handleClassChange}
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

          {/* Optimized Attendance Stats */}
          {students.length > 0 && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{attendanceStats.present}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{attendanceStats.absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{attendanceStats.unmarked}</Text>
                <Text style={styles.statLabel}>Unmarked</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{attendanceStats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          {students.length > 0 && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const newMark = {};
                  students.forEach(student => {
                    newMark[student.id] = 'Present';
                  });
                  setAttendanceMark(newMark);
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Mark All Present</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                onPress={() => {
                  setAttendanceMark({});
                  setClearMode(true);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Student List */}
          {students.length > 0 && (
            <View style={styles.studentList}>
              {students.map((student, index) => (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentRoll}>Roll: {student.admission_no}</Text>
                  </View>
                  
                  <View style={styles.attendanceButtons}>
                    <TouchableOpacity
                      style={[
                        styles.attendanceButton,
                        styles.presentButton,
                        attendanceMark[student.id] === 'Present' && styles.selectedButton
                      ]}
                      onPress={() => {
                        setAttendanceMark(prev => ({
                          ...prev,
                          [student.id]: prev[student.id] === 'Present' ? undefined : 'Present'
                        }));
                      }}
                    >
                      <Ionicons 
                        name={attendanceMark[student.id] === 'Present' ? "checkmark-circle" : "checkmark-circle-outline"} 
                        size={20} 
                        color={attendanceMark[student.id] === 'Present' ? "#fff" : "#4CAF50"} 
                      />
                      <Text style={[
                        styles.attendanceButtonText,
                        attendanceMark[student.id] === 'Present' && styles.selectedButtonText
                      ]}>P</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.attendanceButton,
                        styles.absentButton,
                        attendanceMark[student.id] === 'Absent' && styles.selectedButton
                      ]}
                      onPress={() => {
                        setAttendanceMark(prev => ({
                          ...prev,
                          [student.id]: prev[student.id] === 'Absent' ? undefined : 'Absent'
                        }));
                      }}
                    >
                      <Ionicons 
                        name={attendanceMark[student.id] === 'Absent' ? "close-circle" : "close-circle-outline"} 
                        size={20} 
                        color={attendanceMark[student.id] === 'Absent' ? "#fff" : "#F44336"} 
                      />
                      <Text style={[
                        styles.attendanceButtonText,
                        attendanceMark[student.id] === 'Absent' && styles.selectedButtonText
                      ]}>A</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Submit Button */}
          {students.length > 0 && attendanceStats.marked > 0 && (
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleMarkAttendance}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>
                    Save Attendance ({attendanceStats.marked} students)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date(selectedDate)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1976d2',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectionContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  dateContainer: {
    flex: 1,
  },
  dateButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  studentList: {
    marginBottom: 20,
  },
  studentCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  attendanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceButton: {
    padding: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    minWidth: 50,
    justifyContent: 'center',
  },
  presentButton: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
  },
  absentButton: {
    backgroundColor: '#fff',
    borderColor: '#F44336',
  },
  selectedButton: {
    borderColor: 'transparent',
  },
  attendanceButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedButtonText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#1976d2',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TakeAttendanceOptimized;


