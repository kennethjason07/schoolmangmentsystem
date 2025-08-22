import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
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



// Generate months dynamically up to current month only
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
  
  // New state for Supabase data
  const [attendanceData, setAttendanceData] = useState({});
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Add dashboard-style attendance state
  const [dashboardAttendance, setDashboardAttendance] = useState([]);
  const { user } = useAuth();

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchAttendanceData();
  });

  // Fetch attendance data from Supabase (using EXACT SAME method as ParentDashboard)
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('AttendanceSummary - Starting data fetch for user:', user.id);

      // Use the same method as ParentDashboard to get student data
      const { data: parentUserData, error: parentError } = await dbHelpers.getParentByUserId(user.id);

      let studentDetails = null;

      // The structure returned by getParentByUserId has students data in a different location
      // Based on the query, it should be in parentUserData.students (from the join)
      
      console.log('AttendanceSummary - Parent user data structure:', JSON.stringify(parentUserData, null, 2));
      
      if (parentError || !parentUserData) {
        console.log('AttendanceSummary - Parent error or no data:', parentError);
        studentDetails = null;
      } else if (parentUserData.students && parentUserData.students.length > 0) {
        // Students data is available in the joined response
        studentDetails = parentUserData.students[0];
        console.log('AttendanceSummary - Using real student data from students array:', studentDetails?.name || 'Unnamed Student');
        console.log('AttendanceSummary - Full student data:', JSON.stringify(studentDetails, null, 2));
      } else if (parentUserData.linked_parent_of) {
        // Fallback: try to get student data from linked_parent_of field
        console.log('AttendanceSummary - Trying to get student from linked_parent_of:', parentUserData.linked_parent_of);
        try {
          const { data: studentData, error: studentError } = await supabase
            .from(TABLES.STUDENTS)
            .select(`
              id,
              name,
              admission_no,
              roll_no,
              dob,
              gender,
              address,
              profile_url,
              class_id,
              classes(id, class_name, section)
            `)
            .eq('id', parentUserData.linked_parent_of)
            .single();
            
          if (!studentError && studentData) {
            studentDetails = studentData;
            console.log('AttendanceSummary - Using real student data from direct query:', studentDetails?.name || 'Unnamed Student');
          }
        } catch (err) {
          console.log('AttendanceSummary - Error fetching student data:', err);
        }
      }
      
  // If we still don't have student data, use sample data
  if (!studentDetails) {
    console.log('AttendanceSummary - No student data found, using sample data');
    studentDetails = {
      id: 'sample-student-id',
      name: 'Sample Student',
      admission_no: 'ADM2024001',
      roll_no: 42,
      profile_url: null, // Add profile picture field
      class_id: 'sample-class-id',
      academic_year: '2024-2025',
      classes: {
        id: 'sample-class-id',
        class_name: 'Class 10',
        section: 'A',
        academic_year: '2024-2025'
      }
    };
  }

      setStudentData(studentDetails);

      // EXACT SAME ATTENDANCE FETCHING AS PARENT DASHBOARD
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, so add 1

      try {
        // Get ALL attendance records for this student - SAME AS PARENT DASHBOARD
        const { data: allAttendanceData, error: attendanceError } = await supabase
          .from(TABLES.STUDENT_ATTENDANCE)
          .select('*')
          .eq('student_id', studentDetails.id)
          .order('date', { ascending: false });

        if (attendanceError) throw attendanceError;

        // Filter to current month records - SAME AS PARENT DASHBOARD
        const currentMonthRecords = (allAttendanceData || []).filter(record => {
          // Safety check for valid date format
          if (!record.date || typeof record.date !== 'string') {
            console.warn('Invalid date format in attendance record:', record.date);
            return false;
          }
          
          const dateParts = record.date.split('-');
          if (dateParts.length < 2) {
            console.warn('Date does not contain expected format (YYYY-MM-DD):', record.date);
            return false;
          }
          
          const recordYear = parseInt(dateParts[0], 10);
          const recordMonth = parseInt(dateParts[1], 10);
          
          // Check if parsing was successful (not NaN)
          if (isNaN(recordYear) || isNaN(recordMonth)) {
            console.warn('Failed to parse date components:', record.date, 'year:', dateParts[0], 'month:', dateParts[1]);
            return false;
          }
          
          return recordYear === year && recordMonth === month;
        });

        console.log('=== ATTENDANCE SUMMARY EXACT SAME CALCULATION AS PARENT DASHBOARD ===');
        console.log('Current month:', `${year}-${String(month).padStart(2, '0')}`);
        console.log('Current month records:', currentMonthRecords.length);
        console.log('Records:', currentMonthRecords.map(r => `${r.date}: ${r.status}`));
        console.log('===============================================================');

        // Use the filtered records - SAME AS PARENT DASHBOARD
        const attendanceData = currentMonthRecords;
        setDashboardAttendance(attendanceData || []);

      } catch (err) {
        console.log('AttendanceSummary - Attendance fetch error:', err);
        setDashboardAttendance([]);
      }

      // Get attendance records for all months for organized data
      await fetchAttendanceRecords(studentDetails.id, studentDetails.class_id);

    } catch (err) {
      console.error('AttendanceSummary - Error fetching attendance data:', err);

      // Use sample data on error
      const sampleStudent = {
        id: 'sample-student-id',
        name: 'Sample Student',
        admission_no: 'ADM2024001',
        class_id: 'sample-class-id',
        roll_no: 42,
        academic_year: '2024-2025',
        classes: {
          id: 'sample-class-id',
          class_name: 'Class 10',
          section: 'A',
          academic_year: '2024-2025'
        }
      };

      setStudentData(sampleStudent);

      // Generate sample attendance data
      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const sampleAttendance = generateSampleAttendanceData(monthStart, monthEnd);

      setDashboardAttendance(sampleAttendance);

      // Set sample monthly data
      const monthKey = format(currentDate, 'yyyy-MM');
      const sampleMonthlyData = {};
      sampleMonthlyData[monthKey] = sampleAttendance.reduce((acc, record) => {
        acc[record.date] = record.status;
        return acc;
      }, {});
      setAttendanceData(sampleMonthlyData);

      setError('Using sample data - connection issue');
    } finally {
      setLoading(false);
    }
  };

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
        console.log('AttendanceSummary - Invalid student ID, using sample data:', studentId);
        const sampleAttendance = generateSampleAttendanceData(monthStart, monthEnd);
        setDashboardAttendance(sampleAttendance);
        return;
      }

      // Query using proper schema: student_attendance table with joins
      const { data: attendanceData, error: attendanceError } = await supabase
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
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (attendanceError) {
        console.log('AttendanceSummary - Database error:', attendanceError);
        // Use sample data on database error
        const sampleAttendance = generateSampleAttendanceData(monthStart, monthEnd);
        setDashboardAttendance(sampleAttendance);
        return;
      }

      console.log('AttendanceSummary - Loaded', attendanceData?.length || 0, 'attendance records from database');

      if (attendanceData && attendanceData.length > 0) {
        setDashboardAttendance(attendanceData);
      } else {
        // No real data found, use sample data
        console.log('AttendanceSummary - No attendance records found, using sample data');
        const sampleAttendance = generateSampleAttendanceData(monthStart, monthEnd);
        setDashboardAttendance(sampleAttendance);
      }
    } catch (err) {
      console.log('AttendanceSummary - Error fetching dashboard attendance:', err);
      // Use sample data on error
      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const sampleAttendance = generateSampleAttendanceData(monthStart, monthEnd);
      setDashboardAttendance(sampleAttendance);
    }
  };

  // Fetch attendance records using proper schema
  const fetchAttendanceRecords = async (studentId, classId) => {
    try {
      console.log('AttendanceSummary - Fetching attendance records for student:', studentId);

      // Validate student ID before making database query
      if (!isValidUUID(studentId)) {
        console.log('AttendanceSummary - Invalid student ID, using sample data:', studentId);
        // Generate sample data for the past 6 months
        const organizedData = {};
        const currentDate = new Date();

        for (let i = 0; i < 6; i++) {
          const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
          const monthKey = format(monthDate, 'yyyy-MM');

          const sampleAttendance = generateSampleAttendanceData(monthDate, monthEnd);
          organizedData[monthKey] = {};

          sampleAttendance.forEach(record => {
            organizedData[monthKey][record.date] = {
              status: record.status === 'Present' ? 'present' : 'absent',
              subject: 'All',
              reason: null,
              marked_by: record.marked_by,
              record_id: record.id,
              raw_record: record
            };
          });
        }

        setAttendanceData(organizedData);
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
        // Use sample data on error
        const organizedData = {};
        const currentDate = new Date();

        for (let i = 0; i < 6; i++) {
          const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
          const monthKey = format(monthDate, 'yyyy-MM');

          const sampleAttendance = generateSampleAttendanceData(monthDate, monthEnd);
          organizedData[monthKey] = {};

          sampleAttendance.forEach(record => {
            organizedData[monthKey][record.date] = {
              status: record.status === 'Present' ? 'present' : 'absent',
              subject: 'All',
              reason: null,
              marked_by: record.marked_by,
              record_id: record.id,
              raw_record: record
            };
          });
        }

        setAttendanceData(organizedData);
        return;
      }

      console.log('AttendanceSummary - Loaded', attendanceRecords?.length || 0, 'attendance records from database');

      // Organize attendance data by month
      const organizedData = {};
      if (attendanceRecords && attendanceRecords.length > 0) {
        attendanceRecords.forEach(record => {
          const date = new Date(record.date);
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

  // Fetch data on component mount
  useEffect(() => {
    fetchAttendanceData();
  }, []);

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

  // Get month days for calendar view - always show single month with proper calendar grid
  const getMonthDays = () => {
    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);
    
    // Get the first day of the week for the month (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = monthStart.getDay();
    
    // Calculate the start date to show (may include days from previous month)
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(monthStart.getDate() - firstDayOfWeek);
    
    // Calculate the end date to show (may include days from next month)
    const calendarEnd = new Date(monthEnd);
    const lastDayOfWeek = monthEnd.getDay();
    const daysToAdd = 6 - lastDayOfWeek; // Days needed to complete the week
    calendarEnd.setDate(monthEnd.getDate() + daysToAdd);
    
    // Return all days needed for a complete calendar grid
    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd
    });
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

  // EXACT SAME calculation variables as Parent Dashboard for consistency
  const totalRecords = dashboardAttendance.length;
  const presentOnlyCount = dashboardAttendance.filter(a => a.status === 'Present').length;
  const absentCount = dashboardAttendance.filter(item => item.status === 'Absent').length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentOnlyCount / totalRecords) * 100) : 0;

  console.log('=== ATTENDANCE SUMMARY CALCULATION (SAME AS DASHBOARD) ===');
  console.log('Total records:', totalRecords);
  console.log('Present records:', presentOnlyCount);
  console.log('Absent records:', absentCount);
  console.log('Calculated percentage:', attendancePercentage);
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
      Object.values(monthData).forEach(day => {
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
            <img src="${SCHOOL_INFO.logoUrl}" class="school-logo" />
            <div>
              <h1 style="margin:0;">${SCHOOL_INFO.name}</h1>
              <p style="margin:0;">${SCHOOL_INFO.address}</p>
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

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Attendance Summary" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading attendance data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Attendance Summary" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAttendanceData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Attendance Summary" showBack={true} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
      >
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

        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'calendar' && styles.activeToggle]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons name="calendar" size={20} color={viewMode === 'calendar' ? '#fff' : '#666'} />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.activeToggleText]}>
              Calendar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'summary' && styles.activeToggle]}
            onPress={() => setViewMode('summary')}
          >
            <Ionicons name="stats-chart" size={20} color={viewMode === 'summary' ? '#fff' : '#666'} />
            <Text style={[styles.toggleText, viewMode === 'summary' && styles.activeToggleText]}>
              Summary
            </Text>
          </TouchableOpacity>
        </View>

        {/* Enhanced Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.mainStatCard]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="trending-up" size={24} color="#2196F3" />
            </View>
            <Text style={styles.statNumber}>{getAttendanceStats().percentage}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
            <Text style={styles.statSubtext}>Overall</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${getAttendanceStats().percentage}%` }]} />
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.statNumber}>{getAttendanceStats().present}</Text>
            <Text style={styles.statLabel}>Present</Text>
            <Text style={styles.statSubtext}>Days</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="close-circle" size={24} color="#F44336" />
            </View>
            <Text style={styles.statNumber}>{getAttendanceStats().absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
            <Text style={styles.statSubtext}>Days</Text>
          </View>
        </View>

        {viewMode === 'calendar' ? (
          /* Calendar View */
          <View style={styles.calendarContainer}>
            <Text style={styles.sectionTitle}>Monthly Calendar</Text>
            <View style={styles.calendarHeaderRow}>
              <View style={styles.navButtonContainer}>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => {
                    const newMonth = new Date(displayMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    setDisplayMonth(newMonth);
                  }}
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.currentMonthLabel}>
                {format(displayMonth, 'MMMM yyyy')}
              </Text>
              <View style={styles.navButtonContainer}>
                <TouchableOpacity
                  style={styles.calendarNavButton}
                  onPress={() => {
                    const newMonth = new Date(displayMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    setDisplayMonth(newMonth);
                  }}
                >
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Calendar Header */}
            <View style={styles.calendarHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={styles.calendarHeaderText}>
                  {day}
                </Text>
              ))}
            </View>
            
            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {monthDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const attendance = currentMonthData[dateStr];
                const isCurrentDay = isToday(day);
                const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
                const isSunday = day.getDay() === 0; // Sunday is 0 - ALWAYS HOLIDAY
                const isSaturday = day.getDay() === 6; // Saturday is 6
                const isWeekend = isSunday || isSaturday;
                
                return (
                  <View key={dateStr} style={[
                    styles.calendarDay,
                    isCurrentDay && styles.currentDay,
                    !isCurrentMonth && styles.otherMonthDay,
                    isSunday && styles.holidayDay, // Special styling for holidays (Sundays)
                    isSaturday && styles.weekendDay, // Special styling for weekends
                  ]}>
                    <Text style={[
                      styles.dayNumber,
                      isCurrentDay && styles.currentDayText,
                      !isCurrentMonth && styles.otherMonthText,
                      isSunday && styles.sundayText, // Holiday text styling for all Sundays
                      isSaturday && styles.saturdayText,
                    ]}>
                      {format(day, 'd')}
                    </Text>
                    
                    {/* Holiday/Weekend indicators */}
                    {isSunday && isCurrentMonth && (
                      <View style={styles.holidayIndicator}>
                        <Ionicons name="star" size={10} color="#FF5722" />
                      </View>
                    )}
                    
                    {/* Attendance indicator - only for non-holiday days */}
                    {attendance && !isSunday && (
                      <View style={[styles.attendanceIndicator, { backgroundColor: getAttendanceColor(attendance.status) }]}>
                        <Ionicons
                          name={getAttendanceIcon(attendance.status)}
                          size={12}
                          color="#fff"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            
            {/* Enhanced Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                <Text style={styles.legendText}>Absent</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FFE5E5', borderWidth: 1, borderColor: '#FF6B6B' }]} />
                <Text style={styles.legendText}>Holiday</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#E5F3FF', borderWidth: 1, borderColor: '#4A90E2' }]} />
                <Text style={styles.legendText}>Weekend</Text>
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
                      // Use actual school and student info
                      const schoolName = schoolInfo.name;
                      const schoolLogoUrl = schoolInfo.logoUrl;
                      const studentName = STUDENT_INFO.name;
                      const profilePicUrl = STUDENT_INFO.profilePicUrl;
                      console.log('DEBUG PDF - STUDENT_INFO values:', {
                        name: STUDENT_INFO.name,
                        rollNo: STUDENT_INFO.rollNo,
                        admissionNo: STUDENT_INFO.admissionNo,
                        profilePicUrl: STUDENT_INFO.profilePicUrl
                      });
                      const monthLabel = m.label;
                      // Attendance data for the selected month
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
                      // Legend HTML - Only show Present and Absent (no late/excused)
                      const legendHtml = `
                        <div style="display:flex;gap:16px;margin-top:16px;align-items:center;justify-content:center;">
                          <span style="display:flex;align-items:center;"><span style="display:inline-block;width:16px;height:16px;background:#4CAF50;border-radius:4px;margin-right:6px;"></span>Present</span>
                          <span style="display:flex;align-items:center;"><span style="display:inline-block;width:16px;height:16px;background:#F44336;border-radius:4px;margin-right:6px;"></span>Absent</span>
                        </div>
                      `;
                      // Enhanced Profile picture HTML - using base64 or placeholder with better styling
                      const profilePic = STUDENT_INFO.profilePicUrl && STUDENT_INFO.profilePicUrl.trim()
                        ? `<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid #2196F3;margin-right:16px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;">
                             <img src="${STUDENT_INFO.profilePicUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\"font-size:24px;color:#666;font-weight:bold;\">${STUDENT_INFO.name.charAt(0).toUpperCase()}</div>';"/>
                           </div>`
                        : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#2196F3,#1976D2);margin-right:16px;display:flex;align-items:center;justify-content:center;border:3px solid #e3f2fd;">
                             <span style="color:white;font-size:28px;font-weight:bold;">${STUDENT_INFO.name.charAt(0).toUpperCase()}</span>
                           </div>`;
                      
                      // Enhanced School logo HTML with better placeholder
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
                            <title>Attendance Report - ${STUDENT_INFO.name}</title>
                            <style>
                              body { 
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                                margin: 20px; 
                                background: #f8f9fa;
                                color: #333;
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
                            <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                              <h3 style="color:#1976d2;margin-top:0;">📅 Attendance Calendar</h3>
                              ${calendarTable}
                              ${legendHtml}
                            </div>
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
                        Alert.alert('Error', 'Failed to generate PDF');
                      }
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
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
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
  calendarHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: (width - 64) / 7,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  currentDay: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  otherMonthDay: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  dayNumber: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  currentDayText: {
    color: '#2196F3',
    fontWeight: 'bold',
    fontSize: 16,
  },
  otherMonthText: {
    color: '#bbb',
    fontWeight: '400',
  },
  attendanceIndicator: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
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
  // Weekend and Holiday styles - Enhanced UI
  sundayText: {
    color: '#FF0000', // Simple red color for Sunday (Holiday)
    fontWeight: 'bold',
    fontSize: 13,
  },
  saturdayText: {
    color: '#2196F3', // Blue color for Saturday
    fontWeight: 'bold',
    fontSize: 14,
  },
  holidayDay: {
    backgroundColor: '#FFE5E5', // Light red background for holidays (Sundays)
  },
  weekendDay: {
    backgroundColor: '#E5F3FF', // Light blue background for weekends (Saturdays)
  },
  holidayIndicator: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AttendanceSummary;
