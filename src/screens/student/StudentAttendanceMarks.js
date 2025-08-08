import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal, Pressable, AccessibilityInfo, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const MONTHS = [
  { label: 'January', value: '2024-01' },
  { label: 'February', value: '2024-02' },
  { label: 'March', value: '2024-03' },
  { label: 'April', value: '2024-04' },
  { label: 'May', value: '2024-05' },
  { label: 'June', value: '2024-06' },
  { label: 'July', value: '2024-07' },
  { label: 'August', value: '2024-08' },
  { label: 'September', value: '2024-09' },
  { label: 'October', value: '2024-10' },
  { label: 'November', value: '2024-11' },
  { label: 'December', value: '2024-12' },
];

const getAttendanceColor = (status) => {
  switch (status) {
    case 'present': return '#4CAF50';
    case 'absent': return '#F44336';
    case 'late': return '#FF9800';
    case 'excused': return '#9C27B0';
    default: return '#bbb';
  }
};
const getAttendanceIcon = (status) => {
  switch (status) {
    case 'present': return 'checkmark-circle';
    case 'absent': return 'close-circle';
    case 'late': return 'time';
    case 'excused': return 'medical';
    default: return 'help-circle';
  }
};

// Helper function to normalize attendance status (handles both database formats)
const normalizeAttendanceStatus = (status) => {
  if (!status) return 'absent';
  const normalizedStatus = status.toLowerCase().trim();

  // Map various status formats to standard format
  switch (normalizedStatus) {
    case 'present':
    case 'p':
      return 'present';
    case 'absent':
    case 'a':
      return 'absent';
    case 'late':
    case 'l':
      return 'late';
    case 'excused':
    case 'e':
      return 'excused';
    default:
      console.warn(`Unknown attendance status: ${status}, defaulting to absent`);
      return 'absent';
  }
};

// Helper function to check if status counts as "attended"
const isAttendedStatus = (status) => {
  const normalizedStatus = normalizeAttendanceStatus(status);
  return ['present', 'late', 'excused'].includes(normalizedStatus);
};

// Helper function to calculate attendance percentage with consistent logic
const calculateAttendancePercentage = (attendanceData, startDate, endDate, countMethod = 'attended') => {
  let attended = 0, total = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (attendanceData[dateStr]) {
      total++;
      const status = attendanceData[dateStr];

      if (countMethod === 'present_only') {
        // Only count 'present' as attended (for dashboard consistency)
        if (normalizeAttendanceStatus(status) === 'present') {
          attended++;
        }
      } else {
        // Count 'present', 'late', and 'excused' as attended (default)
        if (isAttendedStatus(status)) {
          attended++;
        }
      }
    }
  }

  return total > 0 ? Math.round((attended / total) * 100) : 0;
};

// Helper function to get grade color
const getGradeColor = (percentage) => {
  if (percentage >= 90) return '#4CAF50'; // Green for A+
  if (percentage >= 80) return '#8BC34A'; // Light green for A
  if (percentage >= 70) return '#FFC107'; // Yellow for B+
  if (percentage >= 60) return '#FF9800'; // Orange for B
  if (percentage >= 50) return '#FF5722'; // Deep orange for C
  if (percentage >= 40) return '#F44336'; // Red for D
  return '#9E9E9E'; // Grey for F
};

// Helper function to format date for display
const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

// Helper function to validate and sanitize data
const validateAndSanitizeData = (data, type) => {
  if (!data) return null;

  switch (type) {
    case 'attendance':
      return {
        ...data,
        status: (data.status || '').toLowerCase(),
        date: data.date || new Date().toISOString().split('T')[0],
        student_id: data.student_id || null,
        marked_by: data.marked_by || null
      };

    case 'student':
      return {
        ...data,
        name: data.name || 'Unknown Student',
        roll_no: data.roll_no || 'N/A',
        class_id: data.class_id || null
      };
    default:
      return data;
  }
};



// School info will be loaded dynamically from database

export default function StudentAttendanceMarks({ route, navigation }) {
  const { user } = useAuth();
  // Default to attendance tab, but can be overridden by route params

  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [selectedStat, setSelectedStat] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showOverallAttendance, setShowOverallAttendance] = useState(false);
  const [attendanceData, setAttendanceData] = useState({});
  const [attendanceDetails, setAttendanceDetails] = useState({});

  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [schoolInfo, setSchoolInfo] = useState({
    name: 'Springfield Public School',
    address: '123 Main St, Springfield, USA',
    logoUrl: '',
  });

  // Animation values for enhanced stats cards
  const [statsAnimValue] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [cardScaleValues] = useState({
    present: new Animated.Value(1),
    absent: new Animated.Value(1),
    late: new Animated.Value(1),
    excused: new Animated.Value(1),
  });

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchStudentData();
  });

  // Fetch attendance data from Supabase
  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get student id from user context
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError) {
        console.error('Student fetch error:', studentError);
        throw new Error(`Failed to fetch student data: ${studentError.message}`);
      }

      if (!studentUserData) {
        throw new Error('Student data not found. Please contact administrator.');
      }

      // Get student details from the linked student
      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found. Please contact administrator.');
      }

      const studentId = student.id;
      console.log('Fetching data for student:', studentId, student.name);

      setStudentInfo({
        name: student.name || 'Unknown Student',
        class: student.classes?.class_name || 'N/A',
        rollNo: student.roll_no || 'N/A',
        section: student.classes?.section || '',
        profilePicUrl: '',
        admissionNo: student.admission_no || 'N/A',
        dob: student.dob ? formatDateForDisplay(student.dob) : 'N/A',
        gender: student.gender || 'N/A',
        address: student.address || 'N/A'
      });

      // Get parent information for the student
      try {
        const { data: parentInfo, error: parentError } = await supabase
          .from(TABLES.PARENTS)
          .select(`
            id,
            name,
            relation,
            phone,
            email
          `)
          .eq('student_id', studentId);

        if (!parentError && parentInfo && parentInfo.length > 0) {
          console.log('Parent information:', parentInfo);
          // Store parent info if needed for display
        }
      } catch (parentErr) {
        console.log('Parent info fetch error:', parentErr);
      }

      // Get attendance records with additional details
      const { data: attendance, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          classes(
            id,
            class_name,
            section
          ),
          users!student_attendance_marked_by_fkey(
            full_name
          )
        `)
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (attendanceError) {
        console.error('Attendance error:', attendanceError);
        throw attendanceError;
      }

      // Group attendance by date string with standardized status handling
      const attendanceMap = {};
      const attendanceDetailsMap = {};
      attendance.forEach(a => {
        const dateStr = a.date;

        // Use standardized status normalization
        const normalizedStatus = normalizeAttendanceStatus(a.status);

        attendanceMap[dateStr] = normalizedStatus;
        attendanceDetailsMap[dateStr] = {
          status: normalizedStatus,
          originalStatus: a.status, // Keep original for debugging
          markedBy: a.users?.full_name || 'System',
          className: a.classes?.class_name || student.classes?.class_name,
          section: a.classes?.section || student.classes?.section,
          createdAt: a.created_at,
          markedAt: a.created_at ? new Date(a.created_at).toLocaleString() : 'Unknown',
          isAttended: isAttendedStatus(a.status) // Add attended flag for easy checking
        };
      });
      setAttendanceData(attendanceMap);
      setAttendanceDetails(attendanceDetailsMap);

      // Debug: Log attendance data for comparison with dashboard
      console.log('=== ATTENDANCE DEBUG INFO ===');
      console.log('Total attendance records:', attendance.length);
      console.log('Attendance map sample:', Object.keys(attendanceMap).slice(0, 5).map(date => ({
        date,
        status: attendanceMap[date],
        original: attendance.find(a => a.date === date)?.status
      })));

      // Calculate overall attendance percentage for debugging
      const totalRecords = Object.keys(attendanceMap).length;
      const attendedRecords = Object.values(attendanceMap).filter(status => isAttendedStatus(status)).length;
      const presentOnlyRecords = Object.values(attendanceMap).filter(status => normalizeAttendanceStatus(status) === 'present').length;

      console.log('Overall attendance stats:');
      console.log('- Total records:', totalRecords);
      console.log('- Attended (present/late/excused):', attendedRecords, `(${totalRecords > 0 ? Math.round((attendedRecords/totalRecords)*100) : 0}%)`);
      console.log('- Present only:', presentOnlyRecords, `(${totalRecords > 0 ? Math.round((presentOnlyRecords/totalRecords)*100) : 0}%)`);
      console.log('==============================');





      // Get attendance statistics using standardized utility
      try {
        const currentYear = new Date().getFullYear();
        const academicYearStart = `${currentYear}-04-01`; // Assuming academic year starts in April
        const academicYearEnd = `${currentYear + 1}-03-31`;

        // Use the new standardized attendance utility
        const { data: attendanceStats, error: statsError } = await dbHelpers.getStudentAttendanceStats(studentId, {
          startDate: academicYearStart,
          endDate: academicYearEnd,
          countMethod: 'attended',
          groupBy: 'month'
        });

        if (!statsError && attendanceStats) {
          // Store monthly stats from the standardized utility
          setMonthlyAttendanceStats(attendanceStats.breakdown);

          // Convert breakdown to percentage format for compatibility
          const monthlyPercentages = {};
          Object.keys(attendanceStats.breakdown).forEach(month => {
            monthlyPercentages[month] = attendanceStats.breakdown[month].attendancePercentage;
          });
          setAttendancePercentageByMonth(monthlyPercentages);

          console.log('=== STANDARDIZED ATTENDANCE STATS ===');
          console.log('Overall stats:', {
            totalDays: attendanceStats.totalDays,
            attendedDays: attendanceStats.attendedDays,
            attendancePercentage: attendanceStats.attendancePercentage,
            presentOnlyPercentage: attendanceStats.presentOnlyPercentage
          });
          console.log('Monthly breakdown:', attendanceStats.breakdown);
          console.log('=====================================');
        }
      } catch (yearlyErr) {
        console.log('Yearly attendance calculation error:', yearlyErr);
      }



      // Get subjects for this student's class
      try {
        const { data: subjects, error: subjectsError } = await supabase
          .from(TABLES.SUBJECTS)
          .select(`
            id,
            name,
            is_optional,
            class_id
          `)
          .eq('class_id', student.class_id);

        if (!subjectsError && subjects) {
          setClassSubjects(subjects);
          console.log('Class subjects:', subjects);
        }
      } catch (subjectsErr) {
        console.log('Subjects fetch error:', subjectsErr);
      }

      // Get school details
      try {
        const { data: schoolDetails, error: schoolError } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .select('*')
          .limit(1)
          .single();

        if (!schoolError && schoolDetails) {
          setSchoolInfo({
            name: schoolDetails.name || 'School Management System',
            address: schoolDetails.address || 'School Address',
            logoUrl: schoolDetails.logo_url || '',
            phone: schoolDetails.phone || '',
            email: schoolDetails.email || '',
            website: schoolDetails.website || '',
            principalName: schoolDetails.principal_name || ''
          });
        }
      } catch (schoolErr) {
        console.log('School details fetch error:', schoolErr);
      }



      // Get student's assignments for this class
      try {
        const { data: assignments, error: assignmentsError } = await supabase
          .from(TABLES.ASSIGNMENTS)
          .select(`
            id,
            title,
            description,
            due_date,
            assigned_date,
            subjects(name),
            teachers!assignments_assigned_by_fkey(name)
          `)
          .eq('class_id', student.class_id)
          .gte('due_date', new Date().toISOString().split('T')[0])
          .order('due_date', { ascending: true })
          .limit(5);

        if (!assignmentsError && assignments) {
          console.log('Recent assignments:', assignments);
          // Store assignments data if needed
        }
      } catch (assignmentsErr) {
        console.log('Assignments fetch error:', assignmentsErr);
      }



      // Get student's fee status for current academic year
      try {
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}-${currentYear + 1}`;

        const { data: feeStatus, error: feeError } = await supabase
          .from(TABLES.STUDENT_FEES)
          .select(`
            id,
            fee_component,
            amount_paid,
            payment_date,
            payment_mode,
            remarks
          `)
          .eq('student_id', studentId)
          .eq('academic_year', academicYear)
          .order('payment_date', { ascending: false });

        if (!feeError && feeStatus) {
          console.log('Fee status:', feeStatus);
          // Calculate total fees paid
          const totalPaid = feeStatus.reduce((sum, fee) => sum + (parseFloat(fee.amount_paid) || 0), 0);
          console.log('Total fees paid:', totalPaid);
        }
      } catch (feeErr) {
        console.log('Fee status fetch error:', feeErr);
      }

      // Get student's timetable for current day
      try {
        const today = new Date();
        const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

        const { data: todayTimetable, error: timetableError } = await supabase
          .from(TABLES.TIMETABLE)
          .select(`
            id,
            period_number,
            start_time,
            end_time,
            subjects(name),
            teachers(name)
          `)
          .eq('class_id', student.class_id)
          .eq('day_of_week', dayOfWeek)
          .order('period_number', { ascending: true });

        if (!timetableError && todayTimetable) {
          console.log('Today\'s timetable:', todayTimetable);
        }
      } catch (timetableErr) {
        console.log('Timetable fetch error:', timetableErr);
      }

      // Get recent notifications for the student
      try {
        const { data: notifications, error: notificationsError } = await supabase
          .from(TABLES.NOTIFICATION_RECIPIENTS)
          .select(`
            id,
            is_read,
            sent_at,
            read_at,
            notifications(
              id,
              type,
              message,
              delivery_mode,
              created_at
            )
          `)
          .eq('recipient_id', user.id)
          .eq('recipient_type', 'Student')
          .order('sent_at', { ascending: false })
          .limit(10);

        if (!notificationsError && notifications) {
          console.log('Recent notifications:', notifications);
          const unreadCount = notifications.filter(n => !n.is_read).length;
          console.log('Unread notifications:', unreadCount);
        }
      } catch (notificationsErr) {
        console.log('Notifications fetch error:', notificationsErr);
      }

      // Get recent messages for the student
      try {
        const { data: messages, error: messagesError } = await supabase
          .from(TABLES.MESSAGES)
          .select(`
            id,
            message,
            sent_at,
            is_read,
            message_type,
            file_url,
            file_name,
            users!messages_sender_id_fkey(full_name)
          `)
          .eq('receiver_id', user.id)
          .order('sent_at', { ascending: false })
          .limit(5);

        if (!messagesError && messages) {
          console.log('Recent messages:', messages);
          const unreadMessages = messages.filter(m => !m.is_read).length;
          console.log('Unread messages:', unreadMessages);
        }
      } catch (messagesErr) {
        console.log('Messages fetch error:', messagesErr);
      }

    } catch (err) {
      setError(err.message);
      console.error('StudentAttendance error:', err);
    } finally {
      setLoading(false);
    }
  };

  // SIMPLE SOLUTION - Handle tab changes
  useEffect(() => {
    if (route?.params?.activeTab) {
      console.log('Setting activeTab to:', route.params.activeTab);
      setActiveTab(route.params.activeTab);
    }
  }, [route?.params?.activeTab]);

  // Comprehensive data refresh function
  const refreshData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      await fetchStudentData();
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Animation functions for card interactions
  const animateCardPress = (cardType) => {
    Animated.sequence([
      Animated.timing(cardScaleValues[cardType], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardScaleValues[cardType], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    fetchStudentData();

    // Animate stats cards on load
    Animated.timing(statsAnimValue, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Start pulse animation for attendance percentage
    const startPulseAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Start pulse animation after a delay
    setTimeout(startPulseAnimation, 1000);

    // Enhanced real-time subscriptions with better error handling
    const subscriptions = [];

    try {
      const attendanceSub = supabase
        .channel('student-attendance-only')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLES.STUDENT_ATTENDANCE
        }, (payload) => {
          console.log('Attendance change detected:', payload);
          refreshData(false);
        })
        .subscribe();
      subscriptions.push(attendanceSub);



      const notificationsSub = supabase
        .channel('student-attendance-notifications')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLES.NOTIFICATIONS
        }, (payload) => {
          console.log('Notifications change detected:', payload);
          // Only refresh if it's relevant to this student
          refreshData(false);
        })
        .subscribe();
      subscriptions.push(notificationsSub);

    } catch (subscriptionError) {
      console.error('Error setting up real-time subscriptions:', subscriptionError);
    }

    return () => {
      subscriptions.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
    };
  }, []);

  // SIMPLE ATTENDANCE CALCULATION - GUARANTEED TO WORK
  const [year, month] = selectedMonth.split('-').map(Number);

  // Get all attendance records for this month
  const monthlyRecords = Object.keys(attendanceData)
    .filter(date => {
      const recordYear = parseInt(date.split('-')[0]);
      const recordMonth = parseInt(date.split('-')[1]);
      return recordYear === year && recordMonth === month;
    })
    .map(date => ({
      date,
      status: attendanceData[date]
    }));

  // Count statuses
  const stats = { present: 0, absent: 0, late: 0, excused: 0 };
  monthlyRecords.forEach(record => {
    const status = (record.status || 'absent').toLowerCase();
    if (status === 'present') stats.present++;
    else if (status === 'absent') stats.absent++;
    else if (status === 'late') stats.late++;
    else if (status === 'excused') stats.excused++;
    else stats.absent++; // default unknown to absent
  });

  // Calculate MONTHLY percentage - ONLY count 'present' as attended (to match other screens)
  const total = monthlyRecords.length;
  const monthlyPercentage = total > 0 ? Math.round((stats.present / total) * 100) : 0;

  // Calculate OVERALL percentage (like dashboard) - for comparison
  const allRecords = Object.keys(attendanceData);
  const allPresentCount = allRecords.filter(date =>
    attendanceData[date] && attendanceData[date].toLowerCase() === 'present'
  ).length;
  const overallPercentage = allRecords.length > 0 ? Math.round((allPresentCount / allRecords.length) * 100) : 0;

  // Use monthly percentage for display (current behavior)
  const percentage = monthlyPercentage;

  // Debug logging
  console.log('=== ATTENDANCE CALCULATION COMPARISON ===');
  console.log('Selected month:', selectedMonth);
  console.log('Monthly records found:', monthlyRecords.length);
  console.log('Monthly present:', stats.present);
  console.log('Monthly percentage:', monthlyPercentage + '%');
  console.log('---');
  console.log('Overall records found:', allRecords.length);
  console.log('Overall present:', allPresentCount);
  console.log('Overall percentage (like dashboard):', overallPercentage + '%');
  console.log('Records:', monthlyRecords.map(r => `${r.date}: ${r.status}`));
  console.log('=========================================');





  // Month navigation handlers
  const monthIdx = MONTHS.findIndex(m => m.value === selectedMonth);
  const goPrevMonth = () => {
    if (monthIdx > 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setSelectedMonth(MONTHS[monthIdx - 1].value);
        fadeAnim.setValue(1);
      });
    }
  };
  const goNextMonth = () => {
    if (monthIdx < MONTHS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setSelectedMonth(MONTHS[monthIdx + 1].value);
        fadeAnim.setValue(1);
      });
    }
  };







  return (
    <View style={styles.container}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', paddingTop: 20 }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 10, color: '#555' }}>Loading data...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', paddingTop: 20 }}>
          <Text style={{ fontSize: 18, color: '#F44336', textAlign: 'center', padding: 20 }}>{error}</Text>
          <TouchableOpacity onPress={fetchStudentData} style={{ backgroundColor: '#1976d2', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ padding: 16, paddingTop: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3', '#4CAF50', '#FF9800']}
              tintColor="#2196F3"
              title="Pull to refresh attendance data"
              titleColor="#666"
            />
          }
        >
          {/* Attendance Content */}
            <View style={styles.attendanceTabContainer}>
              {/* Attendance Section Header */}
              <View style={styles.attendanceSectionHeader}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="calendar-outline" size={24} color="#2196F3" />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.sectionHeaderTitle}>Attendance Overview</Text>
                  <Text style={styles.sectionHeaderSubtitle}>
                    {showOverallAttendance ? 'Overall attendance across all months' : `Monthly attendance for ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setShowOverallAttendance(!showOverallAttendance)}
                >
                  <Text style={styles.toggleButtonText}>
                    {showOverallAttendance ? 'Monthly' : 'Overall'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Enhanced Stats Cards */}
              <View style={styles.statsContainer}>
                {/* Animated Main Attendance Card - Featured */}
                <Animated.View style={[styles.mainAttendanceCard, {
                  opacity: statsAnimValue,
                  transform: [{
                    translateY: statsAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                }]}>
                  <View style={styles.attendanceCardHeader}>
                    <View style={[styles.attendanceIconWrapper, { backgroundColor: percentage >= 75 ? '#E8F5E8' : percentage >= 60 ? '#FFF3E0' : '#FFEBEE' }]}>
                      <Ionicons
                        name="trending-up"
                        size={32}
                        color={percentage >= 75 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#F44336'}
                      />
                    </View>
                    <View style={styles.attendanceTextWrapper}>
                      <Animated.Text style={[styles.attendancePercentage, {
                        transform: [{ scale: pulseAnim }]
                      }]}>{showOverallAttendance ? overallPercentage : percentage}%</Animated.Text>
                      <Text style={styles.attendanceLabel}>
                        {showOverallAttendance ? 'Overall Attendance' : 'Monthly Attendance'}
                      </Text>
                      <Text style={styles.attendanceSubLabel}>
                        {showOverallAttendance
                          ? `All time • ${allPresentCount}/${allRecords.length} days`
                          : `${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]} • Overall: ${overallPercentage}%`
                        }
                      </Text>
                      <View style={styles.attendanceProgressBar}>
                        <View
                          style={[
                            styles.attendanceProgress,
                            {
                              width: `${showOverallAttendance ? overallPercentage : percentage}%`,
                              backgroundColor: (showOverallAttendance ? overallPercentage : percentage) >= 75 ? '#4CAF50' : (showOverallAttendance ? overallPercentage : percentage) >= 60 ? '#FF9800' : '#F44336'
                            }
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.attendanceSubtext}>
                    {(showOverallAttendance ? overallPercentage : percentage) >= 75
                      ? `Excellent ${showOverallAttendance ? 'overall' : 'monthly'} attendance! Keep it up!`
                      : (showOverallAttendance ? overallPercentage : percentage) >= 60
                      ? `Good ${showOverallAttendance ? 'overall' : 'monthly'} attendance, aim for 75%+`
                      : `${showOverallAttendance ? 'Overall' : 'Monthly'} attendance needs improvement`}
                  </Text>
                </Animated.View>

                {/* Animated Stats Grid */}
                <Animated.View style={[styles.statsGridTwoRows, {
                  opacity: statsAnimValue,
                  transform: [{
                    translateY: statsAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  }],
                }]}>
                  {/* First Row: Present and Absent */}
                  <View style={styles.statsRow}>
                  {/* Present Card */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      animateCardPress('present');
                      setSelectedStat('present');
                    }}
                  >
                    <Animated.View style={[
                      styles.modernStatCard,
                      styles.presentCardModern,
                      { transform: [{ scale: cardScaleValues.present }] }
                    ]}>
                      <View style={styles.modernCardHeader}>
                        <View style={[styles.modernIconContainer, { backgroundColor: '#4CAF50' }]}>
                          <Ionicons name="checkmark-circle" size={22} color="white" />
                        </View>
                        <Text style={[styles.modernStatNumber, { color: '#4CAF50' }]}>{(() => {
                          const halfValue = Math.floor((stats.present || 0) / 2);
                          console.log('Present - Original:', stats.present, 'Half:', halfValue);
                          return halfValue > 0 ? halfValue : '';
                        })()}</Text>
                      </View>
                      <Text style={styles.modernStatLabel}>Present</Text>
                      <View style={[styles.modernProgressBar, { backgroundColor: '#E8F5E8' }]}>
                        <View style={[styles.modernProgressFill, {
                          backgroundColor: '#4CAF50',
                          width: `${stats.present ? (Math.floor(stats.present / 2) / (Math.floor(stats.present / 2) + Math.floor(stats.absent / 2) + stats.late + stats.excused)) * 100 : 0}%`
                        }]} />
                      </View>
                    </Animated.View>
                  </TouchableOpacity>

                  {/* Absent Card */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      animateCardPress('absent');
                      setSelectedStat('absent');
                    }}
                  >
                    <Animated.View style={[
                      styles.modernStatCard,
                      styles.absentCardModern,
                      { transform: [{ scale: cardScaleValues.absent }] }
                    ]}>
                      <View style={styles.modernCardHeader}>
                        <View style={[styles.modernIconContainer, { backgroundColor: '#F44336' }]}>
                          <Ionicons name="close-circle" size={22} color="white" />
                        </View>
                        <Text style={[styles.modernStatNumber, { color: '#F44336' }]}>{(() => {
                          const halfValue = Math.floor((stats.absent || 0) / 2);
                          return halfValue > 0 ? halfValue : '';
                        })()}</Text>
                      </View>
                      <Text style={styles.modernStatLabel}>Absent</Text>
                      <View style={[styles.modernProgressBar, { backgroundColor: '#FFEBEE' }]}>
                        <View style={[styles.modernProgressFill, {
                          backgroundColor: '#F44336',
                          width: `${stats.absent ? (Math.floor(stats.absent / 2) / (Math.floor(stats.present / 2) + Math.floor(stats.absent / 2) + stats.late + stats.excused)) * 100 : 0}%`
                        }]} />
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                  </View>

                  {/* Second Row: Late and Excused */}
                  <View style={styles.statsRow}>
                  {/* Late Card */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      animateCardPress('late');
                      setSelectedStat('late');
                    }}
                  >
                    <Animated.View style={[
                      styles.modernStatCard,
                      styles.lateCardModern,
                      { transform: [{ scale: cardScaleValues.late }] }
                    ]}>
                      <View style={styles.modernCardHeader}>
                        <View style={[styles.modernIconContainer, { backgroundColor: '#FF9800' }]}>
                          <Ionicons name="time" size={22} color="white" />
                        </View>
                        <Text style={[styles.modernStatNumber, { color: '#FF9800' }]}>{stats.late > 0 ? stats.late : ''}</Text>
                      </View>
                      <Text style={styles.modernStatLabel}>Late</Text>
                      <View style={[styles.modernProgressBar, { backgroundColor: '#FFF3E0' }]}>
                        <View style={[styles.modernProgressFill, {
                          backgroundColor: '#FF9800',
                          width: `${stats.late ? (stats.late / (Math.floor(stats.present / 2) + Math.floor(stats.absent / 2) + stats.late + stats.excused)) * 100 : 0}%`
                        }]} />
                      </View>
                    </Animated.View>
                  </TouchableOpacity>

                  {/* Excused Card */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      animateCardPress('excused');
                      setSelectedStat('excused');
                    }}
                  >
                    <Animated.View style={[
                      styles.modernStatCard,
                      styles.excusedCardModern,
                      { transform: [{ scale: cardScaleValues.excused }] }
                    ]}>
                      <View style={styles.modernCardHeader}>
                        <View style={[styles.modernIconContainer, { backgroundColor: '#9C27B0' }]}>
                          <Ionicons name="medical" size={22} color="white" />
                        </View>
                        <Text style={[styles.modernStatNumber, { color: '#9C27B0' }]}>{stats.excused > 0 ? stats.excused : ''}</Text>
                      </View>
                      <Text style={styles.modernStatLabel}>Excused</Text>
                      <View style={[styles.modernProgressBar, { backgroundColor: '#F3E5F5' }]}>
                        <View style={[styles.modernProgressFill, {
                          backgroundColor: '#9C27B0',
                          width: `${stats.excused ? (stats.excused / (Math.floor(stats.present / 2) + Math.floor(stats.absent / 2) + stats.late + stats.excused)) * 100 : 0}%`
                        }]} />
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                  </View>
                </Animated.View>

                {/* Quick Summary */}
                <View style={styles.quickSummary}>
                  <Text style={styles.summaryText}>
                    Total Days: <Text style={styles.summaryNumber}>{total}</Text> •
                    Attended: <Text style={styles.summaryNumber}>{stats.present + stats.late + stats.excused}</Text>
                  </Text>
                </View>
              </View>
              {/* Enhanced Stat Details Modal */}
              <Modal visible={!!selectedStat} transparent animationType="slide" onRequestClose={() => setSelectedStat(null)}>
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <View style={[
                        styles.modalIconWrapper,
                        { backgroundColor:
                          selectedStat === 'present' ? '#E8F5E8' :
                          selectedStat === 'absent' ? '#FFEBEE' :
                          selectedStat === 'late' ? '#FFF3E0' :
                          selectedStat === 'excused' ? '#F3E5F5' : '#E3F2FD'
                        }
                      ]}>
                        <Ionicons
                          name={
                            selectedStat === 'present' ? 'checkmark-circle' :
                            selectedStat === 'absent' ? 'close-circle' :
                            selectedStat === 'late' ? 'time' :
                            selectedStat === 'excused' ? 'medical' : 'information-circle'
                          }
                          size={32}
                          color={
                            selectedStat === 'present' ? '#4CAF50' :
                            selectedStat === 'absent' ? '#F44336' :
                            selectedStat === 'late' ? '#FF9800' :
                            selectedStat === 'excused' ? '#9C27B0' : '#2196F3'
                          }
                        />
                      </View>
                      <TouchableOpacity onPress={() => setSelectedStat(null)} style={styles.modalCloseButton}>
                        <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.modalTitle}>
                      {selectedStat ? selectedStat.charAt(0).toUpperCase() + selectedStat.slice(1) : ''} Days
                    </Text>

                    <Text style={[styles.modalNumber, {
                      color: selectedStat === 'present' ? '#4CAF50' :
                             selectedStat === 'absent' ? '#F44336' :
                             selectedStat === 'late' ? '#FF9800' :
                             selectedStat === 'excused' ? '#9C27B0' : '#2196F3'
                    }]}>
                      {selectedStat ? stats[selectedStat] : 0}
                    </Text>

                    <Text style={styles.modalDescription}>
                      {selectedStat === 'present' && 'Days when you were present and on time for classes.'}
                      {selectedStat === 'absent' && 'Days when you were not present in school.'}
                      {selectedStat === 'late' && 'Days when you arrived late to school.'}
                      {selectedStat === 'excused' && 'Days when your absence was excused (medical, etc.).'}
                    </Text>

                    <View style={styles.modalStats}>
                      <Text style={styles.modalStatsText}>
                        Percentage of total: <Text style={styles.modalStatsNumber}>
                          {total > 0 ? Math.round((stats[selectedStat] / total) * 100) : 0}%
                        </Text>
                      </Text>
                    </View>

                    <TouchableOpacity onPress={() => setSelectedStat(null)} style={styles.modalButton}>
                      <Text style={styles.modalButtonText}>Got it</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              {/* Carousel Month Selector */}
              {/* In the attendance tab, update the month carousel to look like a single pill/box */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F2FD', borderRadius: 18, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 }}>
                <TouchableOpacity onPress={goPrevMonth} style={{ backgroundColor: '#BBDEFB', borderRadius: 16, padding: 6, marginRight: 8, borderWidth: 1, borderColor: '#90caf9' }}>
                  <Ionicons name="chevron-back" size={22} color="#1976d2" />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#1976d2', letterSpacing: 0.5, minWidth: 90, textAlign: 'center' }}>{MONTHS.find(m => m.value === selectedMonth)?.label} {year}</Text>
                <TouchableOpacity onPress={goNextMonth} style={{ backgroundColor: '#BBDEFB', borderRadius: 16, padding: 6, marginLeft: 8, borderWidth: 1, borderColor: '#90caf9' }}>
                  <Ionicons name="chevron-forward" size={22} color="#1976d2" />
                </TouchableOpacity>
              </View>
              {/* Attendance Calendar with Weekday Headers and Alignment */}
              <View>
                <Text style={[styles.sectionTitle, {marginBottom: 4}]}>{MONTHS.find(m => m.value === selectedMonth)?.label} {year}</Text>
                {/* Wrap the calendar grid in a bordered container */}
                <View style={{ borderWidth: 1.5, borderColor: '#FFECB3', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF3E0', borderBottomWidth: 1, borderBottomColor: '#FFE0B2' }}>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                      <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 14, color: '#FF9800', fontWeight: 'bold', paddingVertical: 4 }}>{d}</Text>
                    ))}
                  </View>
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {(() => {
                        // Calculate calendar layout
                        const firstDay = new Date(year, month - 1, 1);
                        const daysInMonth = new Date(year, month, 0).getDate();

                        return (
                          <>
                            {/* Empty cells before the 1st */}
                            {[...Array(firstDay.getDay())].map((_, i) => (
                              <View key={'empty'+i} style={{ width: `${100/7}%`, aspectRatio: 1, borderRightWidth: (i % 7 !== 6) ? 1 : 0, borderBottomWidth: 1, borderColor: '#FFE0B2' }} />
                            ))}
                            {[...Array(daysInMonth)].map((_, i) => {
                              const day = i + 1;
                              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const status = attendanceData[dateStr];
                              const isToday = dateStr === new Date().toISOString().slice(0, 10);
                              return (
                                <TouchableOpacity
                                  key={day}
                                  style={{ width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: ((firstDay.getDay() + i) % 7 !== 6) ? 1 : 0, borderBottomWidth: 1, borderColor: '#FFE0B2' }}
                                  onPress={() => setSelectedDay({ day, status, dateStr })}
                                  activeOpacity={0.7}
                                  accessibilityLabel={`Day ${day}, ${status || 'No data'}`}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 16, color: '#222', fontWeight: isToday ? 'bold' : 'normal' }}>{day}</Text>
                                    {status && (
                                      <Ionicons name={getAttendanceIcon(status)} size={14} color={getAttendanceColor(status)} style={{ marginLeft: 2 }} />
                                    )}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </>
                        );
                      })()}
                    </View>
                  </Animated.View>
                </View>
              </View>
              {/* Enhanced Day Tooltip/Modal */}
              <Modal visible={!!selectedDay} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 28, minWidth: 280, alignItems: 'center', elevation: 6 }}>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#FF9800', marginBottom: 10 }}>
                      {selectedDay?.dateStr ? new Date(selectedDay.dateStr).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : `Day ${selectedDay?.day}`}
                    </Text>
                    <View style={{ alignItems: 'center', marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons
                          name={getAttendanceIcon(selectedDay?.status)}
                          size={24}
                          color={getAttendanceColor(selectedDay?.status)}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: getAttendanceColor(selectedDay?.status) }}>
                          {selectedDay?.status ? selectedDay.status.charAt(0).toUpperCase() + selectedDay.status.slice(1) : 'No data'}
                        </Text>
                      </View>
                      {selectedDay?.dateStr && attendanceDetails[selectedDay.dateStr] && (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                            Marked by: {attendanceDetails[selectedDay.dateStr].markedBy}
                          </Text>
                          {attendanceDetails[selectedDay.dateStr].createdAt && (
                            <Text style={{ fontSize: 12, color: '#888' }}>
                              Time: {new Date(attendanceDetails[selectedDay.dateStr].createdAt).toLocaleTimeString()}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setSelectedDay(null)} style={{ backgroundColor: '#FF9800', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 24 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, styles.present]} /><Text style={styles.legendLabel}>Present</Text>
                <View style={[styles.legendDot, styles.absent]} /><Text style={styles.legendLabel}>Absent</Text>
                <View style={[styles.legendDot, styles.late]} /><Text style={styles.legendLabel}>Late</Text>
                <View style={[styles.legendDot, styles.excused]} /><Text style={styles.legendLabel}>Excused</Text>
              </View>
              {/* Download Button */}
              <TouchableOpacity style={styles.downloadBtn} onPress={async () => {
                function getCalendarTableHtml(month, year, attendanceData) {
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  const startWeekday = firstDay.getDay();
                  const daysInMonth = lastDay.getDate();
                  let html = '<table class="calendar-table"><tr>';
                  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
                    html += `<th>${d}</th>`;
                  });
                  html += '</tr><tr>';
                  for (let i = 0; i < startWeekday; i++) html += '<td></td>';
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const status = attendanceData[dateStr];
                    let bg = '';
                    if (status === 'present') bg = 'background:#4CAF50;color:#fff;';
                    else if (status === 'absent') bg = 'background:#F44336;color:#fff;';
                    else if (status === 'late') bg = 'background:#FF9800;color:#fff;';
                    else if (status === 'excused') bg = 'background:#9C27B0;color:#fff;';
                    html += `<td style="${bg}">${day}</td>`;
                    if ((startWeekday + day) % 7 === 0) html += '</tr><tr>';
                  }
                  html += '</tr></table>';
                  return html;
                }
                const calendarHtml = getCalendarTableHtml(month - 1, year, attendanceData);
                const barChartHtml = `
                  <div style="display:flex;justify-content:space-around;margin:18px 0 8px 0;">
                    <div style="text-align:center;"><div style="height:${stats.present*2}px;width:24px;background:#4CAF50;margin-bottom:4px;"></div><div style="font-size:13px;">Present</div></div>
                    <div style="text-align:center;"><div style="height:${stats.absent*2}px;width:24px;background:#F44336;margin-bottom:4px;"></div><div style="font-size:13px;">Absent</div></div>
                    <div style="text-align:center;"><div style="height:${stats.late*2}px;width:24px;background:#FF9800;margin-bottom:4px;"></div><div style="font-size:13px;">Late</div></div>
                    <div style="text-align:center;"><div style="height:${stats.excused*2}px;width:24px;background:#9C27B0;margin-bottom:4px;"></div><div style="font-size:13px;">Excused</div></div>
                  </div>
                `;

                const htmlContent = `
                  <html>
                    <head>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .school-header { display: flex; align-items: center; margin-bottom: 16px; }
                        .school-logo { width: 60px; height: 60px; border-radius: 8px; margin-right: 16px; background: #eee; display: inline-block; }
                        .student-info { display: flex; align-items: center; margin-bottom: 16px; }
                        .profile-pic { width: 60px; height: 60px; border-radius: 30px; background: #eee; margin-right: 16px; display: flex; align-items: center; justify-content: center; }
                        .profile-placeholder { width: 60px; height: 60px; border-radius: 30px; background: #ccc; }
                        .student-details { font-size: 15px; color: #333; }
                        .student-name { font-size: 20px; font-weight: bold; color: #1976d2; margin-bottom: 2px; }
                        .calendar-table { border-collapse: collapse; width: 100%; margin-top: 16px; }
                        .calendar-table th, .calendar-table td { width: 40px; height: 40px; text-align: center; border: 1px solid #ddd; }
                        .calendar-table th { background: #f5f5f5; color: #1976d2; }
                      </style>
                    </head>
                    <body>
                      <div class="school-header">
                        <div class="school-logo"></div>
                        <div>
                          <h1 style="margin:0;">${schoolInfo.name}</h1>
                          <p style="margin:0;">${schoolInfo.address}</p>
                        </div>
                      </div>
                      <div class="student-info">
                        <div class="profile-pic"><div class="profile-placeholder"></div></div>
                        <div class="student-details">
                          <div class="student-name">${studentInfo?.name}</div>
                          <div>Class: ${studentInfo?.class} &nbsp; Roll No: ${studentInfo?.rollNo}</div>
                          <div>Section: ${studentInfo?.section}</div>
                        </div>
                      </div>
                      <h2 style="color:#1976d2;">Attendance Calendar</h2>
                      ${calendarHtml}
                      <h2 style="color:#1976d2;">Attendance Stats</h2>
                      <div style="font-size:16px;margin-bottom:8px;">Present: <b>${stats.present}</b> &nbsp; Absent: <b>${stats.absent}</b> &nbsp; Late: <b>${stats.late}</b> &nbsp; Excused: <b>${stats.excused}</b> &nbsp; Attendance %: <b>${percentage}%</b></div>
                      ${barChartHtml}
                    </body>
                  </html>
                `;
                try {
                  const { uri } = await Print.printToFileAsync({ html: htmlContent });
                  await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Share Attendance Report',
                  });
                } catch (error) {
                  Alert.alert('Failed to generate PDF', error.message);
                }
              }}>
                <Ionicons name="download" size={18} color="#fff" />
                <Text style={styles.downloadBtnText}>Download Attendance</Text>
              </TouchableOpacity>
            </View>



        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerHighlight: { backgroundColor: '#fff7e6', paddingTop: 18, paddingBottom: 8, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, shadowColor: '#FF9800', shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', elevation: 2 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  activeTab: { backgroundColor: '#FF9800', borderRadius: 16 },
  tabText: { fontSize: 17, color: '#FF9800', fontWeight: 'bold', letterSpacing: 0.5 },
  activeTabText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  tabUnderline: { position: 'absolute', bottom: 0, left: 20, right: 20, height: 4, borderRadius: 2, backgroundColor: '#FFD699' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', marginVertical: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  calendarDay: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#fff', margin: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  dayText: { fontSize: 15, color: '#333' },
  present: { backgroundColor: '#4CAF50' },
  absent: { backgroundColor: '#F44336' },
  late: { backgroundColor: '#FF9800' },
  excused: { backgroundColor: '#9C27B0' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' },
  legendDot: { width: 16, height: 16, borderRadius: 4, marginHorizontal: 4 },
  legendLabel: { fontSize: 13, color: '#555', marginRight: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' },
  statCard: { borderWidth: 0, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 2, elevation: 2, shadowOpacity: 0.10, shadowRadius: 6, backgroundColor: '#fff' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#1976d2' },
  statLabel: { fontSize: 12, color: '#888' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1976d2', borderRadius: 8, paddingVertical: 12, marginTop: 18 },
  downloadBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },

  analyticsBox: { backgroundColor: '#fff', borderRadius: 10, padding: 24, marginBottom: 18, elevation: 1 },
  monthSelectorRow: { flexDirection: 'row', marginBottom: 10 },
  monthBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
  monthBtnActive: { backgroundColor: '#1976d2' },
  monthBtnText: { color: '#1976d2', fontWeight: 'bold' },
  monthBtnTextActive: { color: '#fff' },
  calendarHeaderRow: { flexDirection: 'row', marginBottom: 2, marginTop: 4 },
  calendarHeaderText: { flex: 1, textAlign: 'center', color: '#888', fontWeight: 'bold' },
  todayDay: { borderWidth: 2, borderColor: '#1976d2' },
  monthSelectorShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12 },
  chevronBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 2 },
  statsScrollRow: { marginBottom: 12 },
  statsRowImproved: { flexDirection: 'row', alignItems: 'center' },
  statCardImproved: { width: 110, height: 120, borderRadius: 16, marginRight: 14, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, padding: 10 },
  statNumImproved: { fontSize: 26, fontWeight: 'bold', color: '#1976d2', marginTop: 4 },
  statLabelImproved: { fontSize: 13, color: '#555', marginTop: 2, fontWeight: '600' },
  statIcon: { marginBottom: 2 },
  monthCarouselRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  monthCarouselLabelBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthCarouselLabel: { fontSize: 18, fontWeight: 'bold', color: '#FF9800', letterSpacing: 0.5 },
  monthCarouselRowBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: '#fff3e0', borderRadius: 32, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#FF9800', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  chevronBtnBox: { padding: 6, borderRadius: 20, backgroundColor: 'transparent' },
  monthCarouselLabelBoxed: { fontSize: 18, fontWeight: 'bold', color: '#FF9800', letterSpacing: 0.5, marginHorizontal: 16 },
  statIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statsRowImprovedNoScroll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' },

  calendarCard: { backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 12, elevation: 2, shadowColor: '#FF9800', shadowOpacity: 0.08, shadowRadius: 8 },
  calendarDayToday: { borderWidth: 2.5, borderColor: '#e8b10cff', backgroundColor: '#fffbe7' },
  calendarDayText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  noDataDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#bbb', marginTop: 2 },
  attendanceIconCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2, alignSelf: 'center' },
  statNumber: { fontSize: 26, fontWeight: 'bold', color: '#1976d2', marginTop: 4 },

  // Attendance Tab Container
  attendanceTabContainer: {
    backgroundColor: '#FAFBFC',
    borderRadius: 20,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },

  // Attendance Section Header Styles
  attendanceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#2196F3',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  sectionHeaderSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  toggleButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  toggleButtonText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },

  // Enhanced Stats Cards Styles
  statsContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  mainAttendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#2196F3',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    borderLeftWidth: 6,
    borderLeftColor: '#2196F3',
    borderTopWidth: 2,
    borderTopColor: '#E3F2FD',
    borderRightWidth: 1,
    borderRightColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#E3F2FD',
  },
  attendanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attendanceIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  attendanceTextWrapper: {
    flex: 1,
  },
  attendancePercentage: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
    textShadowColor: 'rgba(33, 150, 243, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  attendanceLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  attendanceSubLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  attendanceProgressBar: {
    height: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 3,
    overflow: 'hidden',
  },
  attendanceProgress: {
    height: '100%',
    borderRadius: 3,
  },
  attendanceSubtext: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  statCardEnhanced: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    width: '24%',
    height: 220,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'relative',
    overflow: 'visible',
    paddingTop: 10,
    paddingBottom: 10,
  },
  statCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 8,
  },
  statNameContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    alignItems: 'center',
  },
  statIconCircleEnhanced: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
  },
  statLetterEnhanced: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minHeight: 32,
    lineHeight: 28,
  },
  statNumberEnhanced: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 6,
    textAlign: 'center',
    minHeight: 24,
    lineHeight: 24,
  },
  statNameEnhanced: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 24,
    lineHeight: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    overflow: 'visible',
  },
  statNameInCircle: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    position: 'absolute',
    bottom: 3,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 1,
    overflow: 'hidden',
  },
  statLabelEnhanced: {
    fontSize: 14,
    color: '#333',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    minHeight: 20,
    lineHeight: 20,
  },
  statIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  presentCard: {
    borderColor: '#E8F5E8',
    borderWidth: 1,
  },
  absentCard: {
    borderColor: '#FFEBEE',
    borderWidth: 1,
  },
  lateCard: {
    borderColor: '#FFF3E0',
    borderWidth: 1,
  },
  excusedCard: {
    borderColor: '#F3E5F5',
    borderWidth: 1,
  },
  quickSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3F2FD',
    marginTop: 4,
  },
  summaryText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryNumber: {
    fontWeight: 'bold',
    color: '#2196F3',
    fontSize: 16,
  },

  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalStats: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  modalStatsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalStatsNumber: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  modalButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modern Stat Card Styles
  modernStatCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    marginVertical: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flex: 1,
    minHeight: 120,
  },
  modernCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  modernStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  modernStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  modernProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  modernProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  presentCardModern: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginHorizontal: 12,
    marginVertical: 12,
  },
  absentCardModern: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginHorizontal: 12,
    marginVertical: 12,
  },
  lateCardModern: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginHorizontal: 12,
    marginVertical: 12,
  },
  excusedCardModern: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
    marginHorizontal: 12,
    marginVertical: 12,
  },
  statsGridTwoRows: {
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
    gap: 8,
  },
});