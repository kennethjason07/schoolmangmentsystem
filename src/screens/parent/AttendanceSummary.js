import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import { WebView } from 'react-native-webview'; // Optional - using simple preview instead
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers, isValidUUID, safeQuery } from '../../utils/supabase';
import { getCurrentMonthAttendance, calculateAttendanceStats, generateSampleAttendanceData } from '../../services/attendanceService';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../styles/webScrollFix';
import { useParentAuth } from '../../hooks/useParentAuth';
import { 
  getParentStudents, 
  getStudentForParent, 
  getStudentAttendanceForParent
} from '../../utils/parentAuthHelper';

// Debug mode configuration
const DEBUG_MODE = __DEV__ && true; // Enable debug logging and UI elements

const { width } = Dimensions.get('window');

// Attendance data will be fetched from Supabase

const SUBJECTS = ['All', 'Maths', 'Science', 'English', 'History', 'Geography'];
// Generate terms dynamically
const generateTerms = () => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const terms = ['All Terms', 'Term 1', 'Term 2', 'Term 3', 'Term 4'];

  // Add year-specific terms
  years.forEach(year => {
    terms.push(`Term 1 ${year}`, `Term 2 ${year}`, `Term 3 ${year}`, `Term 4 ${year}`);
  });

  return terms;
};

const TERMS = generateTerms();



// Generate months dynamically - include all months for navigation
const generateMonths = () => {
  const months = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1]; // Previous, current, and next year

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  years.forEach(year => {
    monthNames.forEach((monthName, index) => {
      const monthValue = `${year}-${String(index + 1).padStart(2, '0')}`;
      months.push({
        label: `${monthName} ${year}`,
        value: monthValue
      });
    });
  });

  return months;
};

const MONTHS = generateMonths();

// Generate term months dynamically based on academic year
const generateTermMonths = () => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const termMonths = {};

  years.forEach(year => {
    // Academic year typically runs from April to March
    const academicYearStart = year;
    const academicYearEnd = year + 1;

    termMonths[`Term 1 ${year}`] = [
      `${academicYearStart}-04`, `${academicYearStart}-05`,
      `${academicYearStart}-06`, `${academicYearStart}-07`
    ];
    termMonths[`Term 2 ${year}`] = [
      `${academicYearStart}-08`, `${academicYearStart}-09`,
      `${academicYearStart}-10`, `${academicYearStart}-11`
    ];
    termMonths[`Term 3 ${year}`] = [
      `${academicYearStart}-12`, `${academicYearEnd}-01`
    ];
    termMonths[`Term 4 ${year}`] = [
      `${academicYearEnd}-02`, `${academicYearEnd}-03`
    ];
  });

  // Also keep simple terms for current year
  const currentAcademicYear = currentYear;
  termMonths['Term 1'] = termMonths[`Term 1 ${currentAcademicYear}`];
  termMonths['Term 2'] = termMonths[`Term 2 ${currentAcademicYear}`];
  termMonths['Term 3'] = termMonths[`Term 3 ${currentAcademicYear}`];
  termMonths['Term 4'] = termMonths[`Term 4 ${currentAcademicYear}`];

  return termMonths;
};

const TERM_MONTHS = generateTermMonths();

const MONTH_BG_COLORS = ['#f3f8fd', '#fdf7f3', '#f7fdf3']; // Light blue, light orange, light green

const AttendanceSummary = () => {
  const { user } = useAuth();
  const { 
    isParent, 
    parentStudents, 
    directParentMode, 
    loading: parentLoading, 
    error: parentError 
  } = useParentAuth();
  
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'summary'
  const [showFilters, setShowFilters] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showTermPicker, setShowTermPicker] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showTermSelect, setShowTermSelect] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  
  // New state for Supabase data
  const [attendanceData, setAttendanceData] = useState({});
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Add dashboard-style attendance state
  const [dashboardAttendance, setDashboardAttendance] = useState([]);
  
  // Debug state variables
  const [debugInfo, setDebugInfo] = useState({
    parentContext: null,
    studentResolution: null,
    dataFetchStatus: null
  });

  // Pull-to-refresh functionality with enhanced reload
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    console.log('🔄 Pull-to-refresh triggered - Reloading attendance data...');
    setError(null);
    await fetchAttendanceData();
    
    // Only show real data - no generated attendance
    
    console.log('✅ Pull-to-refresh completed');
  });

  // Fetch attendance data with improved error handling and EMAIL_BASED_TENANT_SYSTEM
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we're in direct parent mode
      if (!directParentMode || !isParent) {
        console.log('⚠️ [PARENT AUTH] Not in direct parent mode or user is not a parent');
        setError('This screen is only available for parents.');
        setLoading(false);
        return;
      }
      
      // Get the first (primary) student for the parent
      if (!parentStudents || parentStudents.length === 0) {
        console.log('❌ [PARENT AUTH] No students found for parent');
        setError('No students linked to this parent account. Please contact school administration.');
        setLoading(false);
        return;
      }
      
      const student = parentStudents[0]; // Use the first student
      console.log('🎯 [PARENT AUTH] Using student:', student.name, '(ID:', student.id, ')');
      
      if (DEBUG_MODE) {
        console.log('📊 === [PARENT AUTH] ATTENDANCE SUMMARY DEBUG ===');
        console.log('🔍 Debug Mode: ENABLED');
        console.log('👨‍👩‍👧 Parent Mode:', directParentMode);
        console.log('👤 Parent User ID:', user?.id);
        console.log('📚 Student:', student.name, '(ID:', student.id, ')');
        console.log('⏰ Fetch Time:', new Date().toISOString());
        console.log('📧 User Email:', user?.email);
        
        setDebugInfo(prev => ({
          ...prev,
          parentContext: {
            user_id: user?.id,
            student_id: student.id,
            student_name: student.name,
            email: user?.email,
            fetch_time: new Date().toISOString()
          }
        }));
      }

      console.log('🔍 [DEBUG] AttendanceSummary - Starting data fetch for user:', user?.id);
      console.log('🔍 [DEBUG] Current time:', new Date().toISOString());

      if (!user?.id) {
        throw new Error('No user logged in');
      }

      // Set student data
      setStudentData(student);

      // Fetch attendance data using parent auth helper
      const attendanceResult = await getStudentAttendanceForParent(user.id, student.id);
      
      if (!attendanceResult.success) {
        console.log('❌ [PARENT AUTH] Failed to fetch attendance:', attendanceResult.error);
        setError(attendanceResult.error);
        setLoading(false);
        return;
      }

      console.log('✅ [PARENT AUTH] Successfully fetched attendance records:', attendanceResult.attendance.length);

      // Process attendance data into calendar format - Skip Sundays entirely
      const processedAttendanceData = {};
      const monthlyStats = {};

      (attendanceResult.attendance || []).forEach((record, index) => {
        console.log(`🔄 [PROCESSING] Record ${index + 1}/${attendanceResult.attendance.length}:`, {
          date: record.date,
          status: record.status,
          student_id: record.student_id
        });
        
        // Safety check for valid date format
        if (!record.date || typeof record.date !== 'string') {
          console.warn('❌ Invalid date format in attendance record:', record.date);
          return;
        }
        
        try {
          const recordDate = new Date(record.date + 'T00:00:00'); // Add time to avoid timezone issues
          const dayOfWeek = recordDate.getDay(); // 0 = Sunday, 6 = Saturday
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
          
          console.log(`📅 [DATE ANALYSIS] ${record.date} is a ${dayName} (dayOfWeek: ${dayOfWeek})`);
          
          // Skip Sundays completely - they shouldn't be in attendance records
          if (dayOfWeek === 0) {
            console.warn(`⚠️ Sunday attendance record found (${record.date}). This should not exist in the database.`);
            return; // Skip Sundays entirely
          }

          const monthKey = format(recordDate, 'yyyy-MM');
          const dateKey = record.date;
          
          console.log(`🗂️ [GROUPING] Adding to monthKey: ${monthKey}, dateKey: ${dateKey}`);
          
          // Initialize month data if not exists
          if (!processedAttendanceData[monthKey]) {
            processedAttendanceData[monthKey] = {};
            console.log(`📁 [NEW MONTH] Created new month data for ${monthKey}`);
          }
          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { present: 0, absent: 0, total: 0 };
            console.log(`📊 [NEW STATS] Created new stats for ${monthKey}`);
          }
          
          // Store attendance record - status from schema is 'Present' or 'Absent' (capitalized)
          const processedRecord = {
            status: record.status.toLowerCase(), // Convert to lowercase for UI consistency
            time: record.created_at ? format(new Date(record.created_at), 'HH:mm') : 'N/A',
            marked_by: record.marked_by,
            record_id: record.id
          };
          
          processedAttendanceData[monthKey][dateKey] = processedRecord;
          console.log(`✅ [STORED] Record stored:`, {
            monthKey,
            dateKey,
            originalStatus: record.status,
            processedStatus: processedRecord.status,
            time: processedRecord.time
          });

          // Update monthly stats (excluding Sundays) - check capitalized status as per schema
          monthlyStats[monthKey].total++;
          if (record.status === 'Present') {
            monthlyStats[monthKey].present++;
            console.log(`📈 [STATS] Incremented present count for ${monthKey}:`, monthlyStats[monthKey]);
          } else if (record.status === 'Absent') {
            monthlyStats[monthKey].absent++;
            console.log(`📉 [STATS] Incremented absent count for ${monthKey}:`, monthlyStats[monthKey]);
          }
        } catch (err) {
          console.warn('❌ Error processing attendance record:', record.date, err);
        }
      });

      // Calculate percentages for each month
      Object.keys(monthlyStats).forEach(monthKey => {
        const stats = monthlyStats[monthKey];
        stats.percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      });

      console.log('=== PROCESSED ATTENDANCE DATA ===');
      console.log('Months with data:', Object.keys(processedAttendanceData));
      console.log('Monthly stats:', monthlyStats);
      
      const currentDate = new Date();
      const currentMonthKey = format(currentDate, 'yyyy-MM');
      console.log(`📅 [CURRENT MONTH] Looking for data in month: ${currentMonthKey}`);
      console.log('Current month data sample:', processedAttendanceData[currentMonthKey]);
      
      // Log detailed breakdown of processed data
      Object.keys(processedAttendanceData).forEach(monthKey => {
        const monthData = processedAttendanceData[monthKey];
        const dateKeys = Object.keys(monthData);
        console.log(`📊 [MONTH DETAIL] ${monthKey}:`, {
          totalDays: dateKeys.length,
          dates: dateKeys.sort(),
          stats: monthlyStats[monthKey]
        });
        
        // Show first few records for this month
        dateKeys.slice(0, 3).forEach(dateKey => {
          console.log(`  📝 [SAMPLE] ${dateKey}:`, monthData[dateKey]);
        });
      });
      
      console.log('=================================');

      // Set processed data
      setAttendanceData(processedAttendanceData);
      
      // Set current month records for dashboard display (excluding Sundays)
      const dashboardMonthKey = format(currentDate, 'yyyy-MM');
      const currentMonthRecords = (attendanceResult.attendance || []).filter(record => {
        if (!record.date) return false;
        
        try {
          const recordDate = new Date(record.date + 'T00:00:00');
          const dayOfWeek = recordDate.getDay();
          
          // Skip Sundays
          if (dayOfWeek === 0) return false;
          
          const recordMonthKey = format(recordDate, 'yyyy-MM');
          return recordMonthKey === currentMonthKey;
        } catch (err) {
          return false;
        }
      });

      setDashboardAttendance(currentMonthRecords || []);

    } catch (err) {
      console.error('AttendanceSummary - Error fetching attendance data:', err);
      setError('Failed to load attendance data. Please check your connection and try again.');
      setDashboardAttendance([]);
      setAttendanceData({});
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount with parent auth
  useEffect(() => {
    // Wait for both authentication and parent loading to complete
    if (!user || parentLoading) {
      console.log('🔄 [PARENT AUTH] Waiting for auth and parent loading to complete...');
      return;
    }
    
    // Check if user is a parent
    if (!isParent) {
      console.log('⚠️ [PARENT AUTH] User is not a parent, redirecting...');
      setError('This screen is only available for parents.');
      setLoading(false);
      return;
    }
    
    fetchAttendanceData();
  }, [user, parentLoading, isParent, directParentMode]);
  
  // Fetch dashboard-style attendance data using proper schema
  const fetchDashboardAttendanceData = async (studentId) => {
    try {
      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      console.log('AttendanceSummary - Fetching dashboard attendance for student:', studentId);
      console.log('AttendanceSummary - Date range:', monthStart.toISOString().split('T')[0], 'to', monthEnd.toISOString().split('T')[0]);

      // Validate student ID before making database query
      if (!isValidUUID(studentId)) {
        console.log('AttendanceSummary - Invalid student ID:', studentId);
        setDashboardAttendance([]);
        return;
      }

      // Query student_attendance table as per schema (without joins to avoid complexity)
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('student_attendance')
        .select(`
          id,
          student_id,
          class_id,
          date,
          status,
          marked_by,
          created_at
        `)
        .eq('student_id', studentId)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (attendanceError) {
        console.log('AttendanceSummary - Database error:', attendanceError);
        setDashboardAttendance([]);
        return;
      }

      console.log('AttendanceSummary - Loaded', attendanceData?.length || 0, 'attendance records from database');

      if (attendanceData && attendanceData.length > 0) {
        setDashboardAttendance(attendanceData);
      } else {
        console.log('AttendanceSummary - No attendance records found');
        setDashboardAttendance([]);
      }
    } catch (err) {
      console.log('AttendanceSummary - Error fetching dashboard attendance:', err);
      setDashboardAttendance([]);
    }
  };

  // Fetch attendance records using proper schema
  const fetchAttendanceRecords = async (studentId, classId) => {
    try {
      console.log('AttendanceSummary - Fetching attendance records for student:', studentId);

      // Validate student ID before making database query
      if (!isValidUUID(studentId)) {
        console.log('AttendanceSummary - Invalid student ID:', studentId);
        setAttendanceData({});
        return;
      }

      // Query using proper schema: student_attendance table
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('student_attendance')
        .select(`
          id,
          student_id,
          class_id,
          date,
          status,
          marked_by,
          created_at,
          students!inner (
            id,
            name,
            admission_no
          ),
          classes!inner (
            id,
            class_name,
            section
          )
        `)
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (attendanceError) {
        console.log('AttendanceSummary - Database error fetching records:', attendanceError);
        setAttendanceData({});
        return;
      }

      console.log('AttendanceSummary - Loaded', attendanceRecords?.length || 0, 'attendance records from database');

      // Organize attendance data by month
      const organizedData = {};
      if (attendanceRecords && attendanceRecords.length > 0) {
        attendanceRecords.forEach(record => {
          const date = new Date(record.date);
          const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

          // Skip Sunday records as they are holidays (no school)
          if (dayOfWeek === 0) {
            console.warn(`⚠️ Invalid attendance record found for Sunday (${record.date}). Skipping...`);
            return;
          }

          // Allow Saturday records (dayOfWeek === 6) for display
          const monthKey = format(date, 'yyyy-MM');
          const dateKey = format(date, 'yyyy-MM-dd');

          if (!organizedData[monthKey]) {
            organizedData[monthKey] = {};
          }

          // Map database status to UI status
          let uiStatus = 'absent';
          if (record.status === 'Present') {
            uiStatus = 'present';
          } else if (record.status === 'Absent') {
            uiStatus = 'absent';
          }

          organizedData[monthKey][dateKey] = {
            status: uiStatus,
            subject: 'All', // No subject-wise attendance in current schema
            reason: null,
            marked_by: record.marked_by,
            record_id: record.id,
            created_at: record.created_at
          };

          // Debug logging for Saturday records
          if (dayOfWeek === 6) {
            console.log(`🎯 Processing Saturday record: ${dateKey} - ${uiStatus}`);
          }
        });
      }

      setAttendanceData(organizedData);

    } catch (err) {
      console.error('Error fetching attendance records:', err);
      setAttendanceData({});
    }
  };

  // Fetch subjects for the student's class
  const fetchSubjectsData = async (classId) => {
    try {
      // Validate class ID before making database query
      if (!isValidUUID(classId)) {
        console.log('AttendanceSummary - Invalid class ID, skipping subjects fetch:', classId);
        return [];
      }

      const { data: subjectsData, error: subjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select(`
          id,
          name,
          class_id,
          academic_year,
          is_optional
        `)
        .eq('class_id', classId)
        .order('name');

      if (subjectsError) {
        console.error('Subjects fetch error:', subjectsError);
        return [];
      }

      return subjectsData || [];
    } catch (err) {
      console.error('Error fetching subjects:', err);
      return [];
    }
  };

  // Get attendance statistics for a specific date range
  const getAttendanceStatsForRange = async (studentId, startDate, endDate) => {
    try {
      // Validate student ID before making database query
      if (!isValidUUID(studentId)) {
        console.log('AttendanceSummary - Invalid student ID for stats range:', studentId);
        return { present: 0, absent: 0, total: 0, percentage: 0 };
      }

      const { data: attendanceRecords, error } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('status, date')
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Error fetching attendance stats:', error);
        return { present: 0, absent: 0, total: 0, percentage: 0 };
      }

      const stats = { present: 0, absent: 0, total: 0 };

      if (attendanceRecords) {
        attendanceRecords.forEach(record => {
          if (record.status === 'Present') {
            stats.present++;
          } else if (record.status === 'Absent') {
            stats.absent++;
          }
          stats.total++;
        });
      }

      return {
        ...stats,
        percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
      };
    } catch (err) {
      console.error('Error calculating attendance stats:', err);
      return { present: 0, absent: 0, total: 0, percentage: 0 };
    }
  };

  // Get monthly attendance summary
  const getMonthlyAttendanceSummary = async (studentId, year = '2024') => {
    try {
      // Validate student ID before making database query
      if (!isValidUUID(studentId)) {
        console.log('AttendanceSummary - Invalid student ID for monthly summary:', studentId);
        return Array(12).fill(null).map((_, index) => ({
          month: index + 1,
          present: 0,
          absent: 0,
          total: 0,
          percentage: 0
        }));
      }

      const { data: attendanceRecords, error } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('status, date')
        .eq('student_id', studentId)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('date');

      if (error) {
        console.error('Error fetching monthly summary:', error);
        return {};
      }

      const monthlySummary = {};

      if (attendanceRecords) {
        attendanceRecords.forEach(record => {
          const date = new Date(record.date);
          const monthKey = format(date, 'yyyy-MM');

          if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = { present: 0, absent: 0, total: 0 };
          }

          if (record.status === 'Present') {
            monthlySummary[monthKey].present++;
          } else if (record.status === 'Absent') {
            monthlySummary[monthKey].absent++;
          }
          monthlySummary[monthKey].total++;
        });
      }

      // Calculate percentages
      Object.keys(monthlySummary).forEach(month => {
        const stats = monthlySummary[month];
        stats.percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      });

      return monthlySummary;
    } catch (err) {
      console.error('Error getting monthly summary:', err);
      return {};
    }
  };

  // Remove Saturday attendance generation - only show real data

  // Fetch data on component mount with parent auth
  useEffect(() => {
    // Wait for both authentication and parent loading to complete
    if (!user || parentLoading) {
      console.log('🔄 [PARENT AUTH] Waiting for auth and parent loading to complete...');
      return;
    }
    
    // Check if user is a parent
    if (!isParent) {
      console.log('⚠️ [PARENT AUTH] User is not a parent, redirecting...');
      setError('This screen is only available for parents.');
      setLoading(false);
      return;
    }
    
    fetchAttendanceData();
  }, [user, parentLoading, isParent, directParentMode]);
  
  // Set up real-time subscription when student data is available
  useEffect(() => {
    if (!studentData?.id) return;
    
    console.log('🔄 Setting up real-time subscription for student:', studentData.id);
    
    // Set up real-time subscription to listen for attendance updates
    const attendanceSubscription = supabase
      .channel('parent-attendance-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_attendance'
      }, (payload) => {
        console.log('🔄 Real-time attendance update received:', payload);
        
        // Check if this update is for our student
        if (payload.new && payload.new.student_id === studentData.id) {
          console.log('📊 Refreshing attendance data due to real-time update');
          // Refresh attendance data when our student's attendance changes
          fetchAttendanceData();
        } else if (payload.old && payload.old.student_id === studentData.id) {
          console.log('📊 Refreshing attendance data due to real-time update (deleted record)');
          // Also refresh for deleted records
          fetchAttendanceData();
        }
      })
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up attendance subscription for student:', studentData.id);
      attendanceSubscription.unsubscribe();
    };
  }, [studentData?.id]);

  // Removed Saturday attendance generation - only show real data from database

  // Fetch subjects when student data is available
  useEffect(() => {
    if (studentData && studentData.class_id) {
      fetchSubjectsData(studentData.class_id).then(subjects => {
        // Update SUBJECTS array with actual subjects from database
        const subjectNames = ['All', ...subjects.map(s => s.name)];
        // You can set this to state if needed for dynamic subject filtering
      });
    }
  }, [studentData]);

  // Update displayMonth when selectedMonth changes (for specific months)
  useEffect(() => {
    if (selectedMonth !== 'all') {
      setDisplayMonth(new Date(selectedMonth));
    }
  }, [selectedMonth]);

  // Get data based on selected month or all months
  const getCurrentData = () => {
    if (selectedMonth === 'all') {
      // Combine all months data
      const allData = {};
      Object.keys(attendanceData).forEach(month => {
        Object.assign(allData, attendanceData[month]);
      });
      return allData;
    } else {
      // For specific month, use displayMonth to get the correct month data
      const monthKey = format(displayMonth, 'yyyy-MM');
      return attendanceData[monthKey] || {};
    }
  };

  const currentMonthData = getCurrentData();
  
  // Helper to get month label from value
  const getMonthLabel = (value) => {
    const m = MONTHS.find(m => m.value === value);
    if (m) {
      return m.label;
    }

    // Fallback: generate label from value if not found in MONTHS array
    try {
      const date = new Date(value + '-01');
      return format(date, 'MMMM yyyy');
    } catch (err) {
      return value;
    }
  };

  // Helper to get month range label for a term
  const getTermRangeLabel = (term) => {
    const months = TERM_MONTHS[term];
    if (months && months.length > 0) {
      const first = getMonthLabel(months[0]).split(' ')[0];
      const last = getMonthLabel(months[months.length - 1]).split(' ')[0];
      return `${first} to ${last}`;
    }
    return '';
  };

  // Helper to get next/previous term
  const getNextTerm = (current) => {
    const idx = TERMS.indexOf(current);
    if (idx > 0 && idx < TERMS.length - 1) return TERMS[idx + 1];
    if (idx === TERMS.length - 1) return TERMS[1]; // wrap to first term
    return TERMS[1];
  };
  const getPrevTerm = (current) => {
    const idx = TERMS.indexOf(current);
    if (idx > 1) return TERMS[idx - 1];
    if (idx === 1) return TERMS[TERMS.length - 1]; // wrap to last term
    return TERMS[TERMS.length - 1];
  };

  // Get month days for calendar view - proper calendar grid with correct alignment
  const getMonthDays = () => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();

    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Get last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Create calendar grid - always 6 weeks (42 days)
    const calendarDays = [];

    // Add days from previous month to fill the first week
    const prevMonth = new Date(year, month - 1, 0);
    const daysFromPrevMonth = firstDayOfWeek;
    for (let i = daysFromPrevMonth; i > 0; i--) {
      calendarDays.push(new Date(year, month - 1, prevMonth.getDate() - i + 1));
    }

    // Add all days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(new Date(year, month, day));
    }

    // Add days from next month to complete 6 weeks (42 days total)
    const remainingDays = 42 - calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      calendarDays.push(new Date(year, month + 1, day));
    }

    return calendarDays;
  };

  const monthDays = getMonthDays();

  // Calendar title logic
  let calendarTitle = '';
  if (selectedTerm && selectedTerm !== 'All Terms') {
    const months = TERM_MONTHS[selectedTerm];
    if (months && months.length > 0) {
      calendarTitle = `Term Calendar: ${getMonthLabel(months[0]).split(' ')[0]} to ${getMonthLabel(months[months.length - 1]).split(' ')[0]}`;
    } else {
      calendarTitle = 'Term Calendar';
    }
  } else {
    calendarTitle = `Monthly Calendar: ${getMonthLabel(format(displayMonth, 'yyyy-MM'))}`;
  }

  // EXACT SAME calculation variables as Parent Dashboard for consistency - Exclude Sundays but allow Saturdays
  const schoolDaysAttendance = dashboardAttendance.filter(record => {
    if (record.date) {
      const date = new Date(record.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      return dayOfWeek !== 0; // Exclude Sundays (holidays) but keep Saturdays
    }
    return true;
  });

  const totalRecords = schoolDaysAttendance.length;
  const presentOnlyCount = schoolDaysAttendance.filter(a => a.status === 'Present').length;
  const absentCount = schoolDaysAttendance.filter(item => item.status === 'Absent').length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentOnlyCount / totalRecords) * 100) : 0;

  // Calculate stats from current month data (includes Saturday attendance)
  const currentMonthStats = {
    present: Object.values(currentMonthData).filter(day => day.status === 'present').length,
    absent: Object.values(currentMonthData).filter(day => day.status === 'absent').length,
    total: Object.values(currentMonthData).length
  };
  const currentMonthPercentage = currentMonthStats.total > 0 ? Math.round((currentMonthStats.present / currentMonthStats.total) * 100) : 0;
  
  // Log current month data analysis
  console.log('🔍 [CURRENT MONTH ANALYSIS] Current month data keys:', Object.keys(currentMonthData));
  console.log('🔍 [CURRENT MONTH ANALYSIS] Current month data values:', Object.values(currentMonthData));
  console.log('🔍 [CURRENT MONTH ANALYSIS] Filtering for present:', Object.values(currentMonthData).filter(day => day.status === 'present'));
  console.log('🔍 [CURRENT MONTH ANALYSIS] Filtering for absent:', Object.values(currentMonthData).filter(day => day.status === 'absent'));

  console.log('=== ATTENDANCE SUMMARY CALCULATION (INCLUDES SATURDAY) ===');
  console.log('Dashboard records (Mon-Sat):', totalRecords);
  console.log('Current month data records:', currentMonthStats.total);
  console.log('Current month present:', currentMonthStats.present);
  console.log('Current month absent:', currentMonthStats.absent);
  console.log('Current month percentage:', currentMonthPercentage);
  console.log('Saturday records in current month:', Object.keys(currentMonthData).filter(date => new Date(date).getDay() === 6));
  console.log('=======================================================');

  const getAttendanceStats = () => {
    return {
      present: presentOnlyCount,
      absent: absentCount,
      total: totalRecords,
      percentage: attendancePercentage
    };
  };

  const getAttendanceColor = (status) => {
    switch (status) {
      case 'present': return '#4CAF50';
      case 'absent': return '#F44336';
      case 'late': return '#FF9800';
      case 'excused': return '#9C27B0';
      default: return '#E0E0E0';
    }
  };

  // Refresh attendance data
  const refreshAttendanceData = async () => {
    if (studentData) {
      setLoading(true);
      await fetchAttendanceRecords(studentData.id, studentData.class_id);
      await fetchDashboardAttendanceData(studentData.id);
      setLoading(false);
    }
  };


  // Get current month attendance data (same calculation as dashboard)
  const getCurrentMonthAttendanceData = () => {
    const currentDate = new Date();
    const monthKey = format(currentDate, 'yyyy-MM');
    return attendanceData[monthKey] || {};
  };

  // Calculate attendance percentage for current month (same as dashboard)
  const getCurrentMonthAttendancePercentage = () => {
    const currentMonthData = getCurrentMonthAttendanceData();
    const attendanceArray = Object.values(currentMonthData);

    if (attendanceArray.length === 0) return 0;

    const presentCount = attendanceArray.filter(item => item.status === 'present').length;
    const totalCount = attendanceArray.length;

    return totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  };

  // Use shared calculation service for consistency
  const getDashboardAttendanceStats = () => {
    return calculateAttendanceStats(dashboardAttendance);
  };

  // Get attendance data for chart visualization
  const getChartData = () => {
    const monthlyStats = {};

    // Process attendance data for chart
    Object.keys(attendanceData).forEach(monthKey => {
      const monthData = attendanceData[monthKey];
      const stats = { present: 0, absent: 0, total: 0 };

      Object.values(monthData).forEach(day => {
        if (day.status === 'present') {
          stats.present++;
        } else if (day.status === 'absent') {
          stats.absent++;
        }
        stats.total++;
      });

      monthlyStats[monthKey] = {
        ...stats,
        percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
      };
    });

    return monthlyStats;
  };

  // Get term-wise attendance statistics
  const getTermStats = (termName) => {
    if (termName === 'All Terms') {
      return getAttendanceStats();
    }

    const termMonths = TERM_MONTHS[termName] || [];
    const stats = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };

    termMonths.forEach(monthKey => {
      const monthData = attendanceData[monthKey] || {};
      Object.entries(monthData).forEach(([dateStr, day]) => {
        // Skip Sundays (holidays) from term statistics
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay(); // 0 = Sunday

        if (dayOfWeek === 0) {
          console.log(`📅 Skipping Sunday (${dateStr}) from term statistics`);
          return; // Skip holidays
        }

        if (day.status) {
          if (day.status === 'present') {
            stats.present++;
          } else if (day.status === 'absent') {
            stats.absent++;
          } else if (day.status === 'late') {
            stats.late++;
          } else if (day.status === 'excused') {
            stats.excused++;
          }
          stats.total++;
        }
      });
    });

    return {
      ...stats,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    };
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

  // Get actual school info from the database
  const [schoolInfo, setSchoolInfo] = useState({
    name: 'School Name',
    address: 'School Address',
    logoUrl: '',
  });

  // Fetch school info when component mounts
  useEffect(() => {
    const fetchSchoolInfo = async () => {
      try {
        const schoolData = await dbHelpers.getSchoolDetails();
        if (schoolData && schoolData.data) {
          setSchoolInfo({
            name: schoolData.data.name || 'Maximus School',
            address: schoolData.data.address || 'School Address',
            logoUrl: schoolData.data.logo_url || '',
          });
        }
      } catch (error) {
        console.log('Error fetching school info:', error);
      }
    };
    fetchSchoolInfo();
  }, []);
  
  // Student info from database with better field mapping
  const STUDENT_INFO = studentData ? {
    name: studentData.name || 'Student Name',
    class: studentData.classes?.class_name || studentData.class_name || 'N/A',
    rollNo: studentData.roll_no || studentData.roll_number || 'N/A',
    section: studentData.classes?.section || studentData.section || 'N/A',
    profilePicUrl: studentData.profile_url || '',
    fullClassName: studentData.classes ? `${studentData.classes.class_name} ${studentData.classes.section}` : (studentData.full_class_name || studentData.class_name || 'N/A'),
    admissionNo: studentData.admission_no || studentData.admission_number || 'N/A',
  } : {
    name: 'Loading...',
    class: 'N/A',
    rollNo: 'N/A',
    section: 'N/A',
    profilePicUrl: '',
    fullClassName: 'N/A',
    admissionNo: 'N/A',
  };

  // Helper to generate a calendar table for a given month
  function getCalendarTableHtml(month, year, attendanceData) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();
    let html = '<table class="calendar-table"><tr>';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
      html += `<th>${d}</th>`;
    });
    html += '</tr><tr>';
    for (let i = 0; i < startWeekday; i++) html += '<td></td>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const att = attendanceData[dateStr];
      const statusClass = att ? att.status : '';
      html += `<td class="${statusClass}">${day}</td>`;
      if ((startWeekday + day) % 7 === 0) html += '</tr><tr>';
    }
    html += '</tr></table>';
    return html;
  }

  // Update generateAttendanceReport to accept a mode parameter
  const generateAttendanceReport = async (mode = 'month', value = null) => {
    console.log('Download report:', { mode, value }); // TEST LOG
    const stats = getAttendanceStats();
    const monthName = format(new Date(selectedMonth), 'MMMM yyyy');
    const profilePic = STUDENT_INFO.profilePicUrl
      ? `<img src="${STUDENT_INFO.profilePicUrl}" class="profile-img" />`
      : `<div class="profile-placeholder"></div>`;

    let dataToInclude = {};
    let calendarHtml = '';
    if (mode === 'month' && value) {
      dataToInclude = attendanceData[value] || {};
      const [year, month] = value.split('-').map(Number);
      calendarHtml = getCalendarTableHtml(month - 1, year, dataToInclude);
    } else if (mode === 'term' && value) {
      const months = TERM_MONTHS[value];
      if (months && months.length > 0) {
        calendarHtml = months.map(m => {
          const [year, month] = m.split('-').map(Number);
          const monthData = attendanceData[m] || {};
          return `<div style="margin-bottom:24px"><div style="font-weight:bold;margin-bottom:4px;">${getMonthLabel(m)}</div>${getCalendarTableHtml(month - 1, year, monthData)}</div>`;
        }).join('');
      }
    } else if (mode === 'overall') {
      // Only render the first two months for performance testing
      const months = Object.keys(attendanceData).slice(0, 2);
      console.log('Rendering months in overall report:', months);
      calendarHtml = months.map(m => {
        const [year, month] = m.split('-').map(Number);
        const monthData = attendanceData[m] || {};
        return `<div style="margin-bottom:24px"><div style="font-weight:bold;margin-bottom:4px;">${getMonthLabel(m)}</div>${getCalendarTableHtml(month - 1, year, monthData)}</div>`;
      }).join('');
    } else {
      // Default to current month
      dataToInclude = currentMonthData;
      const [year, month] = format(displayMonth, 'yyyy-MM').split('-').map(Number);
      calendarHtml = getCalendarTableHtml(month - 1, year, dataToInclude);
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .school-header { display: flex; align-items: center; margin-bottom: 16px; }
            .school-logo { width: 60px; height: 60px; border-radius: 8px; margin-right: 16px; }
            .student-info { display: flex; align-items: center; margin-bottom: 16px; }
            .profile-pic { width: 60px; height: 60px; border-radius: 30px; background: #eee; margin-right: 16px; display: flex; align-items: center; justify-content: center; }
            .profile-img { width: 60px; height: 60px; border-radius: 30px; }
            .profile-placeholder { width: 60px; height: 60px; border-radius: 30px; background: #ccc; }
            .student-details { font-size: 15px; color: #333; }
            .student-name { font-size: 20px; font-weight: bold; color: #1976d2; margin-bottom: 2px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 90px; }
            .calendar-table { border-collapse: collapse; width: 100%; margin-top: 16px; }
            .calendar-table th, .calendar-table td { width: 40px; height: 40px; text-align: center; border: 1px solid #ddd; }
            .calendar-table th { background: #f5f5f5; color: #1976d2; }
            .present { background: #4CAF50; color: #fff; }
            .absent { background: #F44336; color: #fff; }
            .late { background: #FF9800; color: #fff; }
            .excused { background: #9C27B0; color: #fff; }
          </style>
        </head>
        <body>
          <div class="school-header">
            <img src="${schoolInfo.logoUrl}" class="school-logo" />
            <div>
              <h1 style="margin:0;">${schoolInfo.name}</h1>
              <p style="margin:0;">${schoolInfo.address}</p>
            </div>
          </div>
          <div class="student-info">
            <div class="profile-pic">${profilePic}</div>
            <div class="student-details">
              <div class="student-name">${STUDENT_INFO.name}</div>
              <div>Class: ${STUDENT_INFO.class} &nbsp; Roll No: ${STUDENT_INFO.rollNo}</div>
              <div>Section: ${STUDENT_INFO.section}</div>
            </div>
          </div>
          <div class="stats">
            <div class="stat-box">
              <h3>Present</h3>
              <p>${stats.present}</p>
            </div>
            <div class="stat-box">
              <h3>Absent</h3>
              <p>${stats.absent}</p>
            </div>
            <div class="stat-box">
              <h3>Attendance %</h3>
              <p>${stats.percentage}%</p>
            </div>
          </div>
          <div class="calendar">
            <h3>Attendance Calendar</h3>
            ${calendarHtml}
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Attendance Report'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate report');
    }
  };

  const chartData = {
    labels: ['Present', 'Absent'],
    datasets: [{
      data: [
        getAttendanceStats().present,
        getAttendanceStats().absent
      ]
    }]
  };

  const trendData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      data: [95, 88, 92, 96],
      color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
      strokeWidth: 2
    }]
  };

  // Since we're showing single month, no need to group by month
  // Just create a single array with all days of the current month

  if (loading || parentLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Attendance Summary" showBack={true} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>
              Loading attendance data...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Attendance Summary" showBack={true} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchAttendanceData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.container, webContainerStyle]}>
        <Header title="Attendance Summary" showBack={true} />
      
      <ScrollView
        style={[styles.content, webScrollViewStyles.scrollView]}
        contentContainerStyle={webScrollViewStyles.scrollViewContent}
        {...getWebScrollProps()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
      >
        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity 
            style={[styles.viewModeButton, viewMode === 'calendar' && styles.activeViewModeButton]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons name="calendar" size={20} color={viewMode === 'calendar' ? '#fff' : '#666'} />
            <Text style={[styles.viewModeButtonText, viewMode === 'calendar' && styles.activeViewModeText]}>
              Calendar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.viewModeButton, viewMode === 'summary' && styles.activeViewModeButton]}
            onPress={() => setViewMode('summary')}
          >
            <Ionicons name="stats-chart" size={20} color={viewMode === 'summary' ? '#fff' : '#666'} />
            <Text style={[styles.viewModeButtonText, viewMode === 'summary' && styles.activeViewModeText]}>
              Summary
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <TouchableOpacity 
            style={styles.filterButton} 
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={20} color="#2196F3" />
            <View style={styles.filterButtonTextContainer}>
              <Text style={styles.filterButtonText}>Filters</Text>
              <Text style={styles.filterButtonSubtext}>
                {selectedMonth === 'all' ? 'All Months' : format(new Date(selectedMonth), 'MMM yyyy')}
              </Text>
            </View>
            <Ionicons 
              name={showFilters ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#2196F3" 
            />
          </TouchableOpacity>

          {showFilters && (
            <View style={styles.filtersContainer}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Month:</Text>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowMonthPicker(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {selectedMonth === 'all' ? 'All Months' : MONTHS.find(m => m.value === selectedMonth)?.label || 'Select Month'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Enhanced Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.mainStatCard]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="trending-up" size={24} color="#2196F3" />
            </View>
            <Text style={styles.statNumber}>{currentMonthPercentage}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
            <Text style={styles.statSubtext}>Including Saturday</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${currentMonthPercentage}%` }]} />
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.statNumber}>{currentMonthStats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
            <Text style={styles.statSubtext}>Days</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="close-circle" size={24} color="#F44336" />
            </View>
            <Text style={styles.statNumber}>{currentMonthStats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
            <Text style={styles.statSubtext}>Days</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="calendar" size={24} color="#FF9800" />
            </View>
            <Text style={styles.statNumber}>{currentMonthStats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statSubtext}>Days</Text>
          </View>
        </View>

        {viewMode === 'calendar' ? (
          /* Calendar View */
          <View style={styles.calendarContainer}>
            <Text style={styles.sectionTitle}>Monthly Calendar</Text>
            {/* Enhanced Modern Navigation Header */}
            <View style={styles.modernCalendarNavHeader}>
              <TouchableOpacity
                style={styles.modernNavButton}
                onPress={() => {
                  const newMonth = new Date(displayMonth);
                  newMonth.setMonth(newMonth.getMonth() - 1);
                  setDisplayMonth(newMonth);
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
                  {format(displayMonth, 'MMMM yyyy')}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#5f6368" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modernNavButton}
                onPress={() => {
                  const newMonth = new Date(displayMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setDisplayMonth(newMonth);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.navButtonContent}>
                  <Text style={styles.navButtonText}>Next</Text>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color="#4285F4"
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
              {Array.from({ length: 6 }, (_, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.googleCalendarWeek}>
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const dayArrayIndex = weekIndex * 7 + dayIndex;
                    const day = monthDays[dayArrayIndex];
                    const uniqueKey = `day-${weekIndex}-${dayIndex}-${dayArrayIndex}`;

                    if (!day) {
                      return (
                        <View key={uniqueKey} style={styles.googleCalendarDay}>
                          <Text style={styles.googleDayNumber}></Text>
                        </View>
                      );
                    }

                    const dateStr = format(day, 'yyyy-MM-dd');
                    const attendance = currentMonthData[dateStr];
                    const isCurrentDay = isToday(day);
                    const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                    const isSunday = day.getDay() === 0;
                    const isSaturday = day.getDay() === 6;
                    const dayNumber = format(day, 'd');
                    const dayKey = `${dateStr}-${uniqueKey}`; // Ensure absolute uniqueness
                    
                    // Log calendar day processing for current month only
                    if (isCurrentMonth && (attendance || isSunday)) {
                      console.log(`📅 [CALENDAR DAY] ${dateStr}:`, {
                        dayNumber,
                        isCurrentDay,
                        isSunday,
                        isSaturday,
                        hasAttendance: !!attendance,
                        attendanceData: attendance
                      });
                    }

                    return (
                      <TouchableOpacity
                        key={dayKey}
                        style={[
                          styles.googleCalendarDay,
                          isCurrentDay && styles.googleTodayDay,
                          !isCurrentMonth && styles.googleOtherMonthDay,
                          // Add background colors based on attendance status
                          attendance && isCurrentMonth && !isSunday && attendance.status === 'present' && styles.presentDay,
                          attendance && isCurrentMonth && !isSunday && attendance.status === 'absent' && styles.absentDay,
                          isSunday && isCurrentMonth && styles.holidayDay,
                        ]}
                        onPress={() => {
                          if (attendance && isCurrentMonth) {
                            Alert.alert(
                              format(day, 'EEEE, MMMM d, yyyy'),
                              `Status: ${attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)}\nTime: ${attendance.time || 'N/A'}`,
                              [{ text: 'OK', style: 'default' }]
                            );
                          } else if (isCurrentMonth && !isSunday) {
                            Alert.alert(
                              format(day, 'EEEE, MMMM d, yyyy'),
                              'No attendance record for this day.',
                              [{ text: 'OK' }]
                            );
                          } else if (isSunday) {
                            Alert.alert(
                              format(day, 'EEEE, MMMM d, yyyy'),
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
                        {attendance && isCurrentMonth && !isSunday && (
                          <View style={[
                            styles.googleAttendanceDot,
                            {
                              backgroundColor: attendance.status === 'present' 
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
            </View>
            
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
              <View style={styles.googleLegendItem}>
                <View style={[styles.googleLegendDot, { backgroundColor: '#9AA0A6' }]} />
                <Text style={styles.googleLegendText}>Holiday</Text>
              </View>
            </View>
            
            {/* Quick Stats for Calendar View */}
            <View style={styles.calendarStats}>
              <View style={styles.calendarStatItem}>
                <Text style={styles.calendarStatNumber}>{getAttendanceStats().total}</Text>
                <Text style={styles.calendarStatLabel}>Total Days</Text>
              </View>
              <View style={styles.calendarStatItem}>
                <Text style={styles.calendarStatNumber}>{getAttendanceStats().percentage}%</Text>
                <Text style={styles.calendarStatLabel}>Attendance</Text>
              </View>
              <View style={styles.calendarStatItem}>
                <Text style={styles.calendarStatNumber}>{getAttendanceStats().present}</Text>
                <Text style={styles.calendarStatLabel}>Present</Text>
              </View>
            </View>
          </View>
        ) : (
          /* Summary View */
          <View style={styles.summaryContainer}>
            <Text style={styles.sectionTitle}>Attendance Summary</Text>
            
            {/* Bar Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Attendance Distribution</Text>
              <BarChart
                data={chartData}
                width={width - 40}
                height={220}
                yAxisLabel=""
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  barPercentage: 0.7,
                }}
                style={styles.chart}
              />
            </View>
            
            {/* Trend Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Weekly Attendance Trend</Text>
              <LineChart
                data={trendData}
                width={width - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#4CAF50'
                  }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        )}

        {/* Download Button at the bottom */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowMonthSelect(true)}
          >
            <Ionicons name="download" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Download Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50', marginLeft: 12 }]}
            onPress={async () => {
              console.log('🔄 Manual refresh requested');
              console.log('Current student data:', {
                id: studentData?.id,
                name: studentData?.name,
                class_id: studentData?.class_id
              });
              
              setLoading(true);
              await fetchAttendanceData();
              setLoading(false);
              
              Alert.alert(
                'Refresh Complete',
                `Student: ${studentData?.name || 'Unknown'}\nID: ${studentData?.id || 'Unknown'}\nAttendance records: ${Object.keys(attendanceData).length} months`,
                [{ text: 'OK' }]
              );
            }}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Refresh Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={MONTHS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedMonth === item.value && styles.selectedModalItem
                  ]}
                  onPress={() => {
                    setSelectedMonth(item.value);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedMonth === item.value && styles.selectedModalItemText
                  ]}>
                    {item.label}
                  </Text>
                  {selectedMonth === item.value && (
                    <Ionicons name="checkmark" size={20} color="#2196F3" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Subject Picker Modal */}
      <Modal
        visible={showSubjectPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSubjectPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Subject</Text>
              <TouchableOpacity onPress={() => setShowSubjectPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SUBJECTS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedSubject === item && styles.selectedModalItem
                  ]}
                  onPress={() => {
                    setSelectedSubject(item);
                    setShowSubjectPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedSubject === item && styles.selectedModalItemText
                  ]}>
                    {item}
                  </Text>
                  {selectedSubject === item && (
                    <Ionicons name="checkmark" size={20} color="#2196F3" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Term Picker Modal */}
      <Modal
        visible={showTermPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTermPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Term</Text>
              <TouchableOpacity onPress={() => setShowTermPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TERMS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedTerm === item && styles.selectedModalItem
                  ]}
                  onPress={() => {
                    setSelectedTerm(item);
                    setShowTermPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedTerm === item && styles.selectedModalItemText
                  ]}>
                    {item}
                  </Text>
                  {selectedTerm === item && (
                    <Ionicons name="checkmark" size={20} color="#2196F3" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Month selection modal */}
      <Modal
        visible={showMonthSelect}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthSelect(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.downloadModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month for Report</Text>
              <TouchableOpacity onPress={() => setShowMonthSelect(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={MONTHS}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={true}
              style={styles.monthScrollList}
              renderItem={({ item: m }) => (
                <TouchableOpacity
                  style={styles.downloadOption}
                  onPress={() => {
                    setShowMonthSelect(false);
                    setTimeout(async () => {
                      // Generate HTML content for preview
                      const monthLabel = m.label;
                      const [year, month] = m.value.split('-').map(Number);
                      const monthData = attendanceData[m.value] || {};
                      const firstDay = new Date(year, month - 1, 1);
                      const lastDay = new Date(year, month, 0);
                      const startWeekday = firstDay.getDay();
                      const daysInMonth = lastDay.getDate();
                      let calendarTable = '<table border="1"><tr>';
                      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { calendarTable += `<th>${d}</th>`; });
                      calendarTable += '</tr><tr>';
                      for (let i = 0; i < startWeekday; i++) calendarTable += '<td></td>';
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const att = monthData[dateStr];
                        const statusClass = att ? att.status : '';
                        calendarTable += `<td class="${statusClass}">${day}</td>`;
                        if ((startWeekday + day) % 7 === 0) calendarTable += '</tr><tr>';
                      }
                      calendarTable += '</tr></table>';
                      
                      const legendHtml = `
                        <div style="display:flex;gap:16px;margin-top:16px;align-items:center;justify-content:center;">
                          <span style="display:flex;align-items:center;"><span style="display:inline-block;width:16px;height:16px;background:#4CAF50;border-radius:4px;margin-right:6px;"></span>Present</span>
                          <span style="display:flex;align-items:center;"><span style="display:inline-block;width:16px;height:16px;background:#F44336;border-radius:4px;margin-right:6px;"></span>Absent</span>
                        </div>
                      `;
                      
                      const profilePic = STUDENT_INFO.profilePicUrl && STUDENT_INFO.profilePicUrl.trim()
                        ? `<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid #2196F3;margin-right:16px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;">
                             <img src="${STUDENT_INFO.profilePicUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\"font-size:24px;color:#666;font-weight:bold;\">${STUDENT_INFO.name.charAt(0).toUpperCase()}</div>';"/>
                           </div>`
                        : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#2196F3,#1976D2);margin-right:16px;display:flex;align-items:center;justify-content:center;border:3px solid #e3f2fd;">
                             <span style="color:white;font-size:28px;font-weight:bold;">${STUDENT_INFO.name.charAt(0).toUpperCase()}</span>
                           </div>`;
                      
                      const schoolLogo = schoolInfo.logoUrl && schoolInfo.logoUrl.trim()
                        ? `<div style="width:70px;height:70px;border-radius:12px;overflow:hidden;border:2px solid #ddd;margin-right:20px;display:flex;align-items:center;justify-content:center;background:#fff;">
                             <img src="${schoolInfo.logoUrl}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\"font-size:16px;color:#666;font-weight:bold;text-align:center;\">LOGO</div>';"/>
                           </div>`
                        : `<div style="width:70px;height:70px;border-radius:12px;background:linear-gradient(135deg,#FF9800,#F57C00);margin-right:20px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                             <span style="color:white;font-size:18px;font-weight:bold;">📚</span>
                           </div>`;
                      
                      const htmlContent = `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Attendance Report - ${STUDENT_INFO.name}</title>
                            <style>
                              body { 
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                                margin: 20px; 
                                background: #f8f9fa;
                                color: #333;
                                line-height: 1.6;
                              }
                              .header-container {
                                background: white;
                                padding: 24px;
                                border-radius: 12px;
                                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                                margin-bottom: 24px;
                              }
                              .school-info {
                                display: flex;
                                align-items: center;
                                margin-bottom: 20px;
                                padding-bottom: 20px;
                                border-bottom: 2px solid #e3f2fd;
                              }
                              .student-info {
                                display: flex;
                                align-items: center;
                              }
                              .student-details {
                                font-size: 16px;
                                line-height: 1.6;
                              }
                              .student-name {
                                font-size: 24px;
                                font-weight: bold;
                                color: #1976d2;
                                margin-bottom: 8px;
                              }
                              .info-row {
                                margin-bottom: 4px;
                                color: #555;
                              }
                              .school-name {
                                font-size: 28px;
                                font-weight: bold;
                                color: #2196F3;
                                margin: 0 0 8px 0;
                              }
                              .school-address {
                                color: #666;
                                margin: 0;
                                font-size: 14px;
                              }
                              table { 
                                border-collapse: collapse; 
                                width: 100%; 
                                margin: 20px 0;
                                background: white;
                                border-radius: 8px;
                                overflow: hidden;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                              }
                              th, td { 
                                width: 40px; 
                                height: 40px; 
                                text-align: center; 
                                border: 1px solid #e0e0e0;
                                font-weight: 500;
                                vertical-align: middle;
                              }
                              th { 
                                background: linear-gradient(135deg, #2196F3, #1976D2);
                                color: white;
                                font-weight: 600;
                                font-size: 14px;
                              }
                              .present { background: #4CAF50; color: #fff; font-weight: bold; }
                              .absent { background: #F44336; color: #fff; font-weight: bold; }
                              .report-title {
                                text-align: center;
                                color: #1976d2;
                                font-size: 32px;
                                font-weight: bold;
                                margin-bottom: 24px;
                                text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                              }
                              .calendar-section {
                                background: white;
                                padding: 20px;
                                border-radius: 12px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                              }
                              .calendar-title {
                                color: #1976d2;
                                margin-top: 0;
                                margin-bottom: 16px;
                              }
                            </style>
                          </head>
                          <body>
                            <h1 class="report-title">📊 Attendance Report</h1>
                            <div class="header-container">
                              <div class="school-info">
                                ${schoolLogo}
                                <div>
                                  <h2 class="school-name">${schoolInfo.name}</h2>
                                  <p class="school-address">${schoolInfo.address || 'School Address'}</p>
                                </div>
                              </div>
                              <div class="student-info">
                                ${profilePic}
                                <div class="student-details">
                                  <div class="student-name">${STUDENT_INFO.name}</div>
                                  <div class="info-row"><strong>Class:</strong> ${STUDENT_INFO.class} | <strong>Section:</strong> ${STUDENT_INFO.section}</div>
                                  <div class="info-row"><strong>Roll No:</strong> ${STUDENT_INFO.rollNo} | <strong>Admission No:</strong> ${STUDENT_INFO.admissionNo}</div>
                                  <div class="info-row"><strong>Report Period:</strong> ${monthLabel}</div>
                                </div>
                              </div>
                            </div>
                            <div class="calendar-section">
                              <h3 class="calendar-title">📅 Attendance Calendar</h3>
                              ${calendarTable}
                              ${legendHtml}
                            </div>
                          </body>
                        </html>
                      `;
                      
                      // Show preview first
                      setPreviewHtml(htmlContent);
                      setShowPreview(true);
                    }, 300);
                  }}
                >
                  <Text style={styles.downloadOptionText}>{m.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.downloadCancel}
              onPress={() => setShowMonthSelect(false)}
            >
              <Text style={styles.downloadCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Simple Report Preview Modal without WebView */}
      <Modal
        visible={showPreview}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity 
              style={styles.previewCloseButton}
              onPress={() => setShowPreview(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
              <Text style={styles.previewHeaderText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Attendance Report Preview</Text>
            <TouchableOpacity 
              style={styles.previewDownloadButton}
              onPress={async () => {
                try {
                  const { uri } = await Print.printToFileAsync({ html: previewHtml });
                  await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Share Attendance Report',
                  });
                  setShowPreview(false);
                } catch (error) {
                  Alert.alert('Error', 'Failed to generate PDF');
                }
              }}
            >
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.previewDownloadText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
          
          {/* Simple preview content without WebView */}
          <ScrollView style={styles.simplePreview} showsVerticalScrollIndicator={true}>
            <View style={styles.previewCard}>
              <View style={styles.previewSchoolHeader}>
                <View style={styles.previewSchoolLogo}>
                  <Ionicons name="school" size={24} color="#2196F3" />
                </View>
                <View>
                  <Text style={styles.previewSchoolName}>{schoolInfo.name}</Text>
                  <Text style={styles.previewSchoolAddress}>{schoolInfo.address}</Text>
                </View>
              </View>
              
              <View style={styles.previewStudentInfo}>
                <View style={styles.previewStudentAvatar}>
                  <Text style={styles.previewAvatarText}>{STUDENT_INFO.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.previewStudentName}>{STUDENT_INFO.name}</Text>
                  <Text style={styles.previewStudentDetails}>Class: {STUDENT_INFO.class} | Roll: {STUDENT_INFO.rollNo}</Text>
                  <Text style={styles.previewStudentDetails}>Section: {STUDENT_INFO.section} | Admission: {STUDENT_INFO.admissionNo}</Text>
                </View>
              </View>
              
              <View style={styles.previewStatsSection}>
                <Text style={styles.previewSectionTitle}>📊 Attendance Statistics</Text>
                <View style={styles.previewStatsGrid}>
                  <View style={styles.previewStatBox}>
                    <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                    <Text style={styles.previewStatNumber}>{getAttendanceStats().present}</Text>
                    <Text style={styles.previewStatLabel}>Present</Text>
                  </View>
                  <View style={styles.previewStatBox}>
                    <Ionicons name="close-circle" size={32} color="#F44336" />
                    <Text style={styles.previewStatNumber}>{getAttendanceStats().absent}</Text>
                    <Text style={styles.previewStatLabel}>Absent</Text>
                  </View>
                  <View style={styles.previewStatBox}>
                    <Ionicons name="trending-up" size={32} color="#2196F3" />
                    <Text style={styles.previewStatNumber}>{getAttendanceStats().percentage}%</Text>
                    <Text style={styles.previewStatLabel}>Attendance</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.previewCalendarSection}>
                <Text style={styles.previewSectionTitle}>📅 Current Month Overview</Text>
                <View style={styles.previewCalendarInfo}>
                  <Text style={styles.previewCalendarText}>Month: {format(displayMonth, 'MMMM yyyy')}</Text>
                  <Text style={styles.previewCalendarText}>School Days: {currentMonthStats.total}</Text>
                  <Text style={styles.previewCalendarText}>Present Days: {currentMonthStats.present}</Text>
                  <Text style={styles.previewCalendarText}>Absent Days: {currentMonthStats.absent}</Text>
                  <Text style={styles.previewCalendarText}>Monthly Percentage: {currentMonthPercentage}%</Text>
                </View>
              </View>
              
              <View style={styles.previewNotesSection}>
                <Text style={styles.previewSectionTitle}>📝 Report Notes</Text>
                <Text style={styles.previewNoteText}>• This report includes Saturday attendance as working days</Text>
                <Text style={styles.previewNoteText}>• Sundays are marked as holidays (no school)</Text>
                <Text style={styles.previewNoteText}>• PDF will include detailed calendar with all attendance records</Text>
                <Text style={styles.previewNoteText}>• Report generated on {format(new Date(), 'dd/MM/yyyy')} at {format(new Date(), 'HH:mm')}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filtersSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterButtonTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  filterButtonSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filtersContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  filterLabel: {
    width: 70,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  viewModeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 8,
  },
  activeViewModeButton: {
    backgroundColor: '#007bff',
    elevation: 3,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  viewModeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  activeViewModeText: {
    color: '#fff',
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: '#2196F3',
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeToggleText: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 16,
    rowGap: 12,
    columnGap: 12,
  },
  statCard: {
    flexGrow: 1,
    minWidth: (width - 64) / 3,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 6,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  mainStatCard: {
    minWidth: (width - 64) / 1.5,
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
    marginHorizontal: 6,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f3f4',
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  calendarNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  disabledNavButton: {
    backgroundColor: '#e0e0e0',
    borderColor: '#bdbdbd',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    elevation: 1,
  },
  navButtonContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  navButtonLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  currentMonthLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#1976d2',
    letterSpacing: 0.5,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    flex: 1,
    textAlign: 'center',
  },
  calendarNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  // Standardized Calendar Styles
  calendarHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
    overflow: 'hidden',
  },
  calendarHeaderCell: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#dee2e6',
  },
  calendarHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#495057',
    letterSpacing: 1,
  },
  sundayHeaderText: {
    color: '#dc3545',
  },
  // Removed saturdayHeaderText styling - Saturday is now treated as regular working day
  calendarGrid: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#dee2e6',
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDay: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: '#f1f3f4',
    borderBottomColor: '#f1f3f4',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  // Day States
  currentDay: {
    backgroundColor: '#1976d2',
    borderWidth: 4,
    borderColor: '#0d47a1',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    transform: [{ scale: 1.05 }], // Slightly larger
  },
  otherMonthDay: {
    backgroundColor: '#f8f9fa',
  },
  hasAttendanceDay: {
    backgroundColor: '#fff',
  },
  sundayDay: {
    backgroundColor: '#ffebee', // Light red background for holidays (Sundays)
  },
  // Removed saturdayDay styling - Saturday is now treated as regular working day

  // Day Text
  dayNumber: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '600',
    textAlign: 'center',
  },
  currentDayText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  otherMonthText: {
    color: '#adb5bd',
    fontWeight: '400',
  },
  sundayText: {
    color: '#dc3545',
    fontWeight: '700',
  },
  // Removed saturdayText styling - Saturday is now treated as regular working day

  // Attendance and Status Indicators
  attendanceDot: {
    position: 'absolute',
    bottom: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
  },


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
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedModalItem: {
    backgroundColor: '#e3f2fd',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedModalItemText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  monthLabelContainer: {
    width: '100%',
    paddingVertical: 4,
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 8,
  },
  monthLabelText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1976d2',
    letterSpacing: 1,
  },
  // New styles for download modal
  downloadModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    height: 600,
  },
  downloadModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  downloadOption: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  downloadOptionText: {
    fontSize: 16,
    color: '#333',
  },
  downloadCancel: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  downloadCancelText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
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
  monthScrollList: {
    maxHeight: 500,
    flex: 1,
  },

  // Modern Calendar Styles with Enhanced Design
  modernCalendarGrid: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  modernCalendarWeek: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  modernCalendarDay: {
    flex: 1,
    height: 64,
    margin: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modernDayContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modernDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },

  // Modern Day Status Styles
  modernDay_normal: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  modernDay_otherMonth: {
    backgroundColor: '#f8f9fa',
    opacity: 0.4,
  },
  modernDay_today: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  modernDay_present: {
    backgroundColor: '#e8f5e8',
    borderWidth: 2,
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modernDay_absent: {
    backgroundColor: '#ffebee',
    borderWidth: 2,
    borderColor: '#f44336',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  modernDay_holiday: {
    backgroundColor: '#fff3e0',
    borderWidth: 2,
    borderColor: '#ff9800',
    shadowColor: '#ff9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  // Modern Day Text Styles
  modernDayText_normal: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  modernDayText_otherMonth: {
    color: '#bdc3c7',
    fontWeight: '400',
  },
  modernDayText_today: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modernDayText_present: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  modernDayText_absent: {
    color: '#c62828',
    fontWeight: '700',
  },
  modernDayText_holiday: {
    color: '#f57c00',
    fontWeight: '700',
  },

  // Today Glow Effect
  todayGlow: {
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },

  // Pulse Overlay for Today
  pulseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
  },

  // Modern Attendance Indicators
  modernAttendanceIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  presentIndicator: {
    backgroundColor: '#4CAF50',
  },
  absentIndicator: {
    backgroundColor: '#f44336',
  },
  indicatorIcon: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Holiday and Weekend Indicators
  holidayIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holidayIcon: {
    fontSize: 10,
  },
  weekendIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekendIcon: {
    fontSize: 10,
  },

  // Google Calendar-inspired Clean Styles
  googleCalendarHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  googleHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleHeaderText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5f6368',
    textTransform: 'uppercase',
  },
  googleCalendarGrid: {
    backgroundColor: '#ffffff',
  },
  googleCalendarWeek: {
    flexDirection: 'row',
  },
  googleCalendarDay: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: '#f1f3f4',
    borderBottomColor: '#f1f3f4',
    position: 'relative',
  },
  googleTodayDay: {
    backgroundColor: '#e8f0fe',
  },
  googleOtherMonthDay: {
    backgroundColor: '#f8f9fa',
  },
  googleDayNumber: {
    fontSize: 14,
    fontWeight: '400',
    color: '#3c4043',
  },
  googleTodayText: {
    color: '#1a73e8',
    fontWeight: '600',
  },
  googleOtherMonthText: {
    color: '#9aa0a6',
  },
  googleSundayText: {
    color: '#ea4335',
  },
  googleAttendanceDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  googleLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 24,
  },
  googleLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  googleLegendText: {
    fontSize: 12,
    color: '#5f6368',
    fontWeight: '400',
  },

  // Background color styles for attendance status
  presentDay: {
    backgroundColor: '#e8f5e8', // Light green background for present days
  },
  absentDay: {
    backgroundColor: '#ffebee', // Light red background for absent days
  },
  holidayDay: {
    backgroundColor: '#fff3e0', // Light orange background for holidays (Sundays)
  },

  // Modern Navigation Header Styles
  modernCalendarNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modernNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    minWidth: 70,
    maxWidth: 80,
  },
  disabledModernNavButton: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e8eaed',
    shadowOpacity: 0.05,
  },
  navButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4285F4',
  },
  disabledNavText: {
    color: '#bdc1c6',
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dadce0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    gap: 6,
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3c4043',
    textAlign: 'center',
  },

  // Preview Modal Styles
  previewContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 6,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  previewDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  previewDownloadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  previewWebView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  webViewLoadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },

  // Simple Preview Styles (without WebView)
  simplePreview: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  previewCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewSchoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  previewSchoolLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  previewSchoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  previewSchoolAddress: {
    fontSize: 14,
    color: '#666',
  },
  previewStudentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  previewStudentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  previewAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  previewStudentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  previewStudentDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  previewStatsSection: {
    marginBottom: 24,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  previewStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  previewStatBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    minWidth: 80,
  },
  previewStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  previewStatLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  previewCalendarSection: {
    marginBottom: 24,
  },
  previewCalendarInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  previewCalendarText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  previewNotesSection: {
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  previewNoteText: {
    fontSize: 13,
    color: '#5d4037',
    marginBottom: 6,
    lineHeight: 18,
  },
  
  // Debug Section Styles
  debugText: {
    fontSize: 12,
    color: '#1976d2',
    marginTop: 5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  debugContainer: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  debugLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0d47a1',
    marginBottom: 8,
  },
});

export default AttendanceSummary;
