import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal, Pressable, AccessibilityInfo, ActivityIndicator, Alert, RefreshControl, FlatList } from 'react-native';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { 
  useTenantAccess,
  tenantDatabase,
  createTenantQuery,
  getCachedTenantId
} from '../../utils/tenantHelpers';
import Header from '../../components/Header';

// Generate months dynamically up to current month only (same as parent)
const generateMonths = () => {
  const months = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed (0 = January)
  const years = [currentYear - 1, currentYear]; // Previous and current year only

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  years.forEach(year => {
    monthNames.forEach((monthName, index) => {
      // Only include months up to current month
      if (year < currentYear || (year === currentYear && index <= currentMonth)) {
        const monthValue = `${year}-${String(index + 1).padStart(2, '0')}`;
        months.push({
          label: `${monthName} ${year}`,
          value: monthValue
        });
      }
    });
  });

  return months;
};

const MONTHS = generateMonths();

// Get current month value for default selection
const getCurrentMonthValue = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // Convert to 1-indexed
  return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
};

// Helper function to format month-year for display
const formatMonthYearForDisplay = (monthValue) => {
  if (!monthValue) return 'N/A';
  const [year, month] = monthValue.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]} ${year}`;
};

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
  // 🚀 ENHANCED: Use enhanced tenant system
  const { tenantId, isReady, error: tenantError } = useTenantAccess();
  
  // 🚀 ENHANCED: Tenant validation helper
  const validateTenant = async () => {
    const cachedTenantId = await getCachedTenantId();
    if (!cachedTenantId) {
      throw new Error('Tenant context not available');
    }
    return { valid: true, tenantId: cachedTenantId };
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [fadeAnim] = useState(new Animated.Value(1));
  const [selectedStat, setSelectedStat] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showOverallAttendance, setShowOverallAttendance] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
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

  // Missing state variables
  const [monthlyAttendanceStats, setMonthlyAttendanceStats] = useState({});
  const [attendancePercentageByMonth, setAttendancePercentageByMonth] = useState({});
  const [classSubjects, setClassSubjects] = useState([]);

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

  // 🚀 ENHANCED: Fetch attendance data with tenant validation
  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 === ENHANCED ATTENDANCE DATA FETCH ===');
      
      // 🚀 ENHANCED: Validate tenant access
      const { valid, tenantId: effectiveTenantId } = await validateTenant();
      if (!valid) {
        console.error('❌ Tenant validation failed');
        setError('Tenant context not available');
        return;
      }

      console.log('🚀 Using effective tenant ID:', effectiveTenantId);

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get student data using enhanced tenant query via users table
      const userQuery = createTenantQuery(effectiveTenantId, TABLES.USERS)
        .select(`
          id,
          email,
          linked_student_id,
          students!users_linked_student_id_fkey(
            *,
            classes(class_name, section)
          )
        `)
        .eq('email', user.email)
        .single();

      const { data: userData, error: userError } = await userQuery;
      if (userError || !userData || !userData.linked_student_id) {
        console.error('Student data error:', userError);
        throw new Error(`Failed to fetch student data: ${userError?.message || 'Student not found or user not linked to student'}`);
      }

      const student = userData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      const studentId = student.id;
      console.log('🚀 Enhanced tenant-aware student data:', { id: studentId, name: student.name });

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

      // Get parent information using enhanced tenant system
      try {
        const parentQuery = createTenantQuery(effectiveTenantId, TABLES.PARENTS)
          .select(`
            id,
            name,
            relation,
            phone,
            email
          `)
          .eq('student_id', studentId);

        const { data: parentInfo, error: parentError } = await parentQuery;

        if (!parentError && parentInfo && parentInfo.length > 0) {
          console.log('Parent information:', parentInfo);
          // Store parent info if needed for display
        }
      } catch (parentErr) {
        console.log('Parent info fetch error:', parentErr);
      }

      // Get attendance records using enhanced tenant system
      const attendanceQuery = createTenantQuery(effectiveTenantId, TABLES.STUDENT_ATTENDANCE)
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

      const { data: attendance, error: attendanceError } = await attendanceQuery;

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



      // Get subjects using enhanced tenant system
      try {
        const subjectsQuery = createTenantQuery(effectiveTenantId, TABLES.SUBJECTS)
          .select(`
            id,
            name,
            is_optional,
            class_id
          `)
          .eq('class_id', student.class_id);

        const { data: subjects, error: subjectsError } = await subjectsQuery;

        if (!subjectsError && subjects) {
          setClassSubjects(subjects);
          console.log('Class subjects:', subjects);
        }
      } catch (subjectsErr) {
        console.log('Subjects fetch error:', subjectsErr);
      }

      // Get school details using enhanced tenant system
      try {
        const schoolQuery = await tenantDatabase.read({
          table: TABLES.SCHOOL_DETAILS,
          select: '*',
          single: true,
          tenantId: effectiveTenantId
        });

        const { data: schoolDetails, error: schoolError } = { data: schoolQuery.data, error: schoolQuery.error };

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



      // Get student's assignments using enhanced tenant system
      try {
        const assignmentsQuery = createTenantQuery(effectiveTenantId, TABLES.ASSIGNMENTS)
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

        const { data: assignments, error: assignmentsError } = await assignmentsQuery;

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

        const feeQuery = createTenantQuery(effectiveTenantId, TABLES.STUDENT_FEES)
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

        const { data: feeStatus, error: feeError } = await feeQuery;

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

        const timetableQuery = createTenantQuery(effectiveTenantId, TABLES.TIMETABLE)
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

        const { data: todayTimetable, error: timetableError } = await timetableQuery;

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

  // SIMPLE SOLUTION - Handle tab changes (removed as not needed in this screen)
  // useEffect(() => {
  //   if (route?.params?.activeTab) {
  //     console.log('Setting activeTab to:', route.params.activeTab);
  //     setActiveTab(route.params.activeTab);
  //   }
  // }, [route?.params?.activeTab]);

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

  // 🚀 ENHANCED: Wait for both user and tenant readiness
  useEffect(() => {
    console.log('🚀 Enhanced StudentAttendanceMarks useEffect triggered');
    console.log('🚀 User state:', user);
    console.log('🚀 Tenant ready:', isReady);
    if (user && isReady) {
      console.log('🚀 User and tenant ready, starting enhanced attendance data fetch...');
      fetchStudentData();
      
      // Animate stats cards on load
      Animated.timing(statsAnimValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } else {
      console.log('⚠️ Waiting for user and tenant context...');
    }
  }, [user, isReady]);

  // 🚀 ENHANCED: Set up real-time subscriptions with tenant readiness
  useEffect(() => {
    if (!user || !isReady) {
      console.log('⚠️ Real-time subscriptions waiting for user and tenant readiness');
      return;
    }

    console.log('🚀 Setting up enhanced tenant-aware real-time subscriptions');
    const subscriptions = [];

    try {
      const attendanceSub = supabase
        .channel('student-attendance-only')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLES.STUDENT_ATTENDANCE
        }, (payload) => {
          console.log('🚀 Attendance change detected:', payload);
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
          console.log('🚀 Notifications change detected:', payload);
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
          supabase.removeChannel(sub);
        } catch (error) {
          console.error('Error removing channel:', error);
        }
      });
    };
  }, [user, isReady]);

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

  // Progress bar should show a minimum visible width when percentage > 0
  const barPercent = showOverallAttendance ? overallPercentage : percentage;
  const displayedBarPercent = barPercent > 0 ? Math.max(barPercent, 20) : 0;

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
      <Header 
        title="Attendance Report" 
        showBack={true} 
        showProfile={true}
        studentInfo={studentInfo}
        onRefresh={() => refreshData(true)}
      />
      {/* 🚀 ENHANCED: Show tenant loading states */}
      {(!isReady || loading) ? (
        <View style={[styles.loadingContainer, { backgroundColor: '#f5f5f5' }]}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>
            {!isReady ? 'Initializing secure tenant context...' : 'Loading attendance data...'}
          </Text>
          <Text style={styles.loadingSubText}>
            {!isReady ? 'Setting up secure access to your attendance records' : 'Please wait while we fetch your attendance data'}
          </Text>
        </View>
      ) : (error || tenantError) ? (
        <View style={[styles.errorContainer, { backgroundColor: '#f5f5f5' }]}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorTitle}>
            {tenantError ? 'Tenant Access Error' : 'Failed to Load Attendance'}
          </Text>
          <Text style={styles.errorText}>{tenantError || error}</Text>
          {tenantError && (
            <View style={styles.tenantErrorInfo}>
              <Text style={styles.tenantErrorText}>Tenant ID: {tenantId || 'Not available'}</Text>
              <Text style={styles.tenantErrorText}>Status: {isReady ? 'Ready' : 'Not Ready'}</Text>
            </View>
          )}
          <TouchableOpacity onPress={fetchStudentData} style={styles.retryButton}>
            <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Retry</Text>
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
                    {showOverallAttendance ? 'Overall attendance across all months' : `Monthly attendance for ${formatMonthYearForDisplay(selectedMonth)}`}
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
                {/* Clean Unified Attendance Card */}
                <Animated.View style={[styles.unifiedAttendanceCard, {
                  opacity: statsAnimValue,
                  transform: [{
                    translateY: statsAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                }]}>
                  <View style={styles.unifiedCardHeader}>
                    <View style={styles.unifiedTitleSection}>
                      <View style={styles.unifiedIconContainer}>
                        <Ionicons name="analytics" size={20} color="#2196F3" />
                      </View>
                      <View>
                        <Text style={styles.unifiedCardTitle}>
                          {showOverallAttendance ? 'Overall Attendance' : 'Monthly Attendance'}
                        </Text>
                        <Text style={styles.unifiedCardSubtitle}>
                          {showOverallAttendance
                            ? `All time • ${allPresentCount} of ${allRecords.length} days`
                            : `${formatMonthYearForDisplay(selectedMonth)} • ${stats.present} of ${total} days`
                          }
                        </Text>
                      </View>
                    </View>
                    <View style={styles.unifiedPercentageBadge}>
                      <Text style={styles.unifiedPercentageText}>
                        {barPercent}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.unifiedProgressSection}>
                    <View style={styles.unifiedProgressBarContainer}>
                      <View
                        style={[
                          styles.unifiedProgressBar,
                          {
                            width: `${displayedBarPercent}%`,
                            backgroundColor: (barPercent) >= 75 ? '#4CAF50' : (barPercent) >= 60 ? '#FF9800' : '#F44336'
                          }
                        ]}
                      />
                    </View>
                    <View style={styles.unifiedProgressLabels}>
                      <Text style={styles.unifiedProgressStartLabel}>0%</Text>
                      <Text style={styles.unifiedProgressEndLabel}>100%</Text>
                    </View>
                  </View>

                  <View style={styles.unifiedBottomSection}>
                    <View style={styles.unifiedStatsRow}>
                      <View style={styles.unifiedStatItem}>
                        <Text style={styles.unifiedStatNumber}>{total}</Text>
                        <Text style={styles.unifiedStatLabel}>Total Days</Text>
                      </View>
                      <View style={styles.unifiedStatItem}>
                        <Text style={styles.unifiedStatNumber}>{showOverallAttendance ? allPresentCount : stats.present}</Text>
                        <Text style={styles.unifiedStatLabel}>Present</Text>
                      </View>
                      <View style={styles.unifiedStatItem}>
                        <Text style={styles.unifiedStatNumber}>{showOverallAttendance ? (allRecords.length - allPresentCount) : (total - stats.present)}</Text>
                        <Text style={styles.unifiedStatLabel}>Absent</Text>
                      </View>
                    </View>
                    
                    <View style={[
                      styles.unifiedStatusIndicator,
                      {
                        backgroundColor: (showOverallAttendance ? overallPercentage : percentage) >= 75 ? '#E8F5E8' : (showOverallAttendance ? overallPercentage : percentage) >= 60 ? '#FFF3E0' : '#FFEBEE'
                      }
                    ]}>
                      <Ionicons
                        name={
                          (showOverallAttendance ? overallPercentage : percentage) >= 75 ? 'checkmark-circle' :
                          (showOverallAttendance ? overallPercentage : percentage) >= 60 ? 'warning' : 'alert-circle'
                        }
                        size={16}
                        color={
                          (showOverallAttendance ? overallPercentage : percentage) >= 75 ? '#4CAF50' :
                          (showOverallAttendance ? overallPercentage : percentage) >= 60 ? '#FF9800' : '#F44336'
                        }
                      />
                      <Text style={[
                        styles.unifiedStatusText,
                        {
                          color: (showOverallAttendance ? overallPercentage : percentage) >= 75 ? '#4CAF50' :
                                 (showOverallAttendance ? overallPercentage : percentage) >= 60 ? '#FF9800' : '#F44336'
                        }
                      ]}>
                        {(showOverallAttendance ? overallPercentage : percentage) >= 75
                          ? 'Excellent Performance'
                          : (showOverallAttendance ? overallPercentage : percentage) >= 60
                          ? 'Good Performance'
                          : 'Needs Improvement'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
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
              
              {/* Month/Year Picker Modal */}
              <Modal visible={showMonthPicker} transparent animationType="slide" onRequestClose={() => setShowMonthPicker(false)}>
                <View style={styles.monthPickerModalOverlay}>
                  <View style={styles.monthPickerModalContent}>
                    <View style={styles.monthPickerHeader}>
                      <Text style={styles.monthPickerTitle}>Select Month & Year</Text>
                      <TouchableOpacity onPress={() => setShowMonthPicker(false)} style={styles.monthPickerCloseButton}>
                        <Ionicons name="close" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>
                    
                    <ScrollView 
                      style={styles.monthPickerList} 
                      contentContainerStyle={styles.monthPickerScrollContent}
                      showsVerticalScrollIndicator={true}
                      bounces={true}
                    >
                      {MONTHS.map((month, index) => {
                        const isSelected = selectedMonth === month.value;
                        const isCurrent = month.value === getCurrentMonthValue();
                        const isLast = index === MONTHS.length - 1;
                        
                        return (
                          <TouchableOpacity
                            key={month.value}
                            style={[
                              styles.monthPickerItem,
                              isSelected && styles.monthPickerItemSelected,
                              isCurrent && styles.monthPickerItemCurrent,
                              isLast && styles.monthPickerItemLast
                            ]}
                            onPress={() => {
                              setSelectedMonth(month.value);
                              setShowMonthPicker(false);
                            }}
                          >
                            <View style={styles.monthPickerItemContent}>
                              <Text style={[
                                styles.monthPickerItemText,
                                isSelected && styles.monthPickerItemTextSelected,
                                isCurrent && styles.monthPickerItemTextCurrent
                              ]}>
                                {month.label}
                              </Text>
                              {isCurrent && (
                                <View style={styles.currentMonthBadge}>
                                  <Text style={styles.currentMonthBadgeText}>Current</Text>
                                </View>
                              )}
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={20} color="#4285F4" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    
                    <TouchableOpacity 
                      style={styles.monthPickerDoneButton}
                      onPress={() => setShowMonthPicker(false)}
                    >
                      <Text style={styles.monthPickerDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              
              {/* Modern Google Calendar-style Navigation Header */}
              <View style={styles.modernCalendarNavHeader}>
                <TouchableOpacity
                  style={styles.modernNavButton}
                  onPress={() => {
                    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                      if (monthIdx > 0) {
                        setSelectedMonth(MONTHS[monthIdx - 1].value);
                      }
                      fadeAnim.setValue(1);
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.navButtonContent}>
                    <Ionicons name="chevron-back" size={20} color="#4285F4" />
                    <Text style={styles.navButtonText}>Prev</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.monthYearSelector}
                  onPress={() => setShowMonthPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.monthYearText}>
                    {MONTHS.find(m => m.value === selectedMonth)?.label}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#5f6368" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modernNavButton,
                    monthIdx >= MONTHS.length - 1 && styles.disabledModernNavButton
                  ]}
                  onPress={() => {
                    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                      if (monthIdx < MONTHS.length - 1) {
                        setSelectedMonth(MONTHS[monthIdx + 1].value);
                      }
                      fadeAnim.setValue(1);
                    });
                  }}
                  disabled={monthIdx >= MONTHS.length - 1}
                  activeOpacity={0.7}
                >
                  <View style={styles.navButtonContent}>
                    <Text style={[
                      styles.navButtonText,
                      monthIdx >= MONTHS.length - 1 && styles.disabledNavText
                    ]}>Next</Text>
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={monthIdx >= MONTHS.length - 1 ? "#bdc1c6" : "#4285F4"} 
                    />
                  </View>
                </TouchableOpacity>
              </View>
              {/* Google Calendar-style Header */}
              <View style={styles.googleCalendarHeader}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <View key={index} style={styles.googleHeaderCell}>
                    <Text style={styles.googleHeaderText}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Google Calendar-inspired Clean Grid */}
              <View style={styles.googleCalendarGrid}>
                <Animated.View style={{ opacity: fadeAnim }}>
                  {Array.from({ length: 6 }, (_, weekIndex) => (
                    <View key={`week-${weekIndex}`} style={styles.googleCalendarWeek}>
                      {Array.from({ length: 7 }, (_, dayIndex) => {
                        const dayArrayIndex = weekIndex * 7 + dayIndex;
                        
                        // Calculate calendar layout
                        const firstDay = new Date(year, month - 1, 1);
                        const daysInMonth = new Date(year, month, 0).getDate();
                        const firstDayOfWeek = firstDay.getDay();
                        
                        // Create full calendar grid
                        const calendarDays = [];
                        
                        // Add days from previous month
                        const prevMonth = new Date(year, month - 2, 0);
                        for (let i = firstDayOfWeek; i > 0; i--) {
                          calendarDays.push(new Date(year, month - 2, prevMonth.getDate() - i + 1));
                        }
                        
                        // Add all days of current month
                        for (let day = 1; day <= daysInMonth; day++) {
                          calendarDays.push(new Date(year, month - 1, day));
                        }
                        
                        // Add days from next month to complete 6 weeks
                        const remainingDays = 42 - calendarDays.length;
                        for (let day = 1; day <= remainingDays; day++) {
                          calendarDays.push(new Date(year, month, day));
                        }
                        
                        const day = calendarDays[dayArrayIndex];
                        const uniqueKey = `day-${weekIndex}-${dayIndex}-${dayArrayIndex}`;

                        if (!day) {
                          return (
                            <View key={uniqueKey} style={styles.googleCalendarDay}>
                              <Text style={styles.googleDayNumber}></Text>
                            </View>
                          );
                        }

                        const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const status = attendanceData[dateStr];
                        const isCurrentDay = dateStr === new Date().toISOString().slice(0, 10);
                        const isCurrentMonth = day.getMonth() === month - 1;
                        const isSunday = day.getDay() === 0;
                        const dayNumber = day.getDate();
                        const dayKey = `${dateStr}-${uniqueKey}`;

                        return (
                          <TouchableOpacity
                            key={dayKey}
                            style={[
                              styles.googleCalendarDay,
                              isCurrentDay && styles.googleTodayDay,
                              !isCurrentMonth && styles.googleOtherMonthDay,
                            ]}
                            onPress={() => {
                              if (status && isCurrentMonth) {
                                const dayStr = new Date(dateStr).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                });
                                const details = attendanceDetails[dateStr];
                                Alert.alert(
                                  dayStr,
                                  `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}\nMarked by: ${details?.markedBy || 'N/A'}\nTime: ${details?.markedAt || 'N/A'}`,
                                  [{ text: 'OK', style: 'default' }]
                                );
                              } else if (isCurrentMonth && !isSunday) {
                                Alert.alert(
                                  new Date(dateStr).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  }),
                                  'No attendance record for this day.',
                                  [{ text: 'OK' }]
                                );
                              } else if (isSunday) {
                                Alert.alert(
                                  new Date(dateStr).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  }),
                                  'Holiday - No school',
                                  [{ text: 'OK' }]
                                );
                              }
                            }}
                            disabled={!isCurrentMonth}
                            activeOpacity={0.6}
                          >
                            {/* Day Number */}
                            <Text style={[
                              styles.googleDayNumber,
                              isCurrentDay && styles.googleTodayText,
                              !isCurrentMonth && styles.googleOtherMonthText,
                              isSunday && isCurrentMonth && styles.googleSundayText,
                            ]}>
                              {dayNumber}
                            </Text>

                            {/* Google-style attendance dot */}
                            {status && isCurrentMonth && !isSunday && (
                              <View style={[
                                styles.googleAttendanceDot,
                                {
                                  backgroundColor: status === 'present' 
                                    ? '#4285F4' // Google Blue for present
                                    : '#EA4335' // Google Red for absent
                                }
                              ]} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </Animated.View>
              </View>
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
              {/* Google Calendar-style Legend */}
              <View style={styles.googleLegend}>
                <View style={styles.googleLegendItem}>
                  <View style={[styles.googleLegendDot, { backgroundColor: '#4285F4' }]} />
                  <Text style={styles.googleLegendText}>Present</Text>
                </View>
                <View style={styles.googleLegendItem}>
                  <View style={[styles.googleLegendDot, { backgroundColor: '#EA4335' }]} />
                  <Text style={styles.googleLegendText}>Absent</Text>
                </View>
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
  // Unified Clean Attendance Card Styles
  unifiedAttendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  unifiedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  unifiedTitleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  unifiedIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unifiedCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 4,
    lineHeight: 22,
  },
  unifiedCardSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  unifiedPercentageBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  unifiedPercentageText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 24,
  },
  unifiedProgressSection: {
    marginBottom: 20,
  },
  unifiedProgressBarContainer: {
    height: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  unifiedProgressBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  unifiedProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unifiedProgressStartLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  unifiedProgressEndLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  unifiedBottomSection: {
    gap: 16,
  },
  unifiedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  unifiedStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  unifiedStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  unifiedStatLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  unifiedStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  unifiedStatusText: {
    fontSize: 14,
    fontWeight: '600',
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
  
  // Google Calendar-style Navigation Header
  modernCalendarNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  modernNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 60,
  },
  disabledModernNavButton: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  navButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4285F4',
  },
  disabledNavText: {
    color: '#bdc1c6',
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    gap: 8,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
  },
  
  // Google Calendar-style Header
  googleCalendarHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    elevation: 1,
  },
  googleHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5f6368',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Google Calendar Grid
  googleCalendarGrid: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  googleCalendarWeek: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  googleCalendarDay: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f3f4',
    backgroundColor: '#fff',
    position: 'relative',
    minHeight: 48,
  },
  googleTodayDay: {
    backgroundColor: '#e8f0fe',
  },
  googleOtherMonthDay: {
    backgroundColor: '#fafafa',
  },
  googleDayNumber: {
    fontSize: 14,
    fontWeight: '400',
    color: '#202124',
    textAlign: 'center',
    lineHeight: 20,
  },
  googleTodayText: {
    fontWeight: '600',
    color: '#1a73e8',
  },
  googleOtherMonthText: {
    color: '#9aa0a6',
    fontWeight: '300',
  },
  googleSundayText: {
    color: '#ea4335',
  },
  googleAttendanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
  },
  
  // Google Calendar-style Legend
  googleLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    gap: 16,
  },
  googleLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  googleLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  googleLegendText: {
    fontSize: 12,
    color: '#5f6368',
    fontWeight: '500',
  },
  
  // Calendar Stats (like parent)
  calendarStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  calendarStatItem: {
    alignItems: 'center',
  },
  calendarStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  calendarStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  
  // Month Picker Modal Styles
  monthPickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  monthPickerModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  monthPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
  },
  monthPickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerList: {
    maxHeight: 320,
    paddingHorizontal: 20,
  },
  monthPickerScrollContent: {
    paddingVertical: 10,
    paddingBottom: 20,
  },
  monthPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 2,
    backgroundColor: '#fff',
  },
  monthPickerItemSelected: {
    backgroundColor: '#e8f0fe',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  monthPickerItemCurrent: {
    borderWidth: 1,
    borderColor: '#34A853',
    backgroundColor: '#e6f4ea',
  },
  monthPickerItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthPickerItemText: {
    fontSize: 16,
    color: '#202124',
    fontWeight: '500',
  },
  monthPickerItemTextSelected: {
    color: '#4285F4',
    fontWeight: '600',
  },
  monthPickerItemTextCurrent: {
    color: '#34A853',
    fontWeight: '600',
  },
  currentMonthBadge: {
    backgroundColor: '#34A853',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  currentMonthBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  monthPickerDoneButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    margin: 20,
    marginTop: 10,
  },
  monthPickerDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthPickerItemLast: {
    marginBottom: 10,
  },

  // 🚀 ENHANCED: Loading and error state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#1976d2',
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    color: '#F44336',
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  tenantErrorInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  tenantErrorText: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
    marginVertical: 2,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
