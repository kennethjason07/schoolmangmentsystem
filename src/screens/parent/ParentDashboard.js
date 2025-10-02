import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import StudentSwitchBanner from '../../components/StudentSwitchBanner';
import StudentFeeCard from '../../components/StudentFeeCard';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantAccess } from '../../utils/tenantHelpers';
import { 
  getParentStudents, 
  getStudentForParent, 
  getStudentNotificationsForParent,
  getStudentAttendanceForParent,
  isUserParent
} from '../../utils/parentAuthHelper';
import { testParentAuth, quickParentAuthTest } from '../../utils/testParentAuth';
import { useSelectedStudent } from '../../contexts/SelectedStudentContext';
import { useFocusEffect } from '@react-navigation/native';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { useUnreadMessageCount } from '../../hooks/useUnreadMessageCount';
import { badgeNotifier } from '../../utils/badgeNotifier';
import DebugBadge from '../../components/DebugBadge';
import NotificationTester from '../../components/NotificationTester';
import universalNotificationService from '../../services/UniversalNotificationService';

const ParentDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  const { selectedStudent, hasMultipleStudents, availableStudents, loading: studentLoading } = useSelectedStudent();
  const [studentData, setStudentData] = useState(null);
  // Declare parent auth flags before any effect uses them to avoid TDZ errors
  const [useDirectParentAuth, setUseDirectParentAuth] = useState(false);
  const [parentAuthChecked, setParentAuthChecked] = useState(false);
  
  // Enhanced tenant debugging following EMAIL_BASED_TENANT_SYSTEM.md
  const DEBUG_MODE = process.env.NODE_ENV === 'development';
  
  if (DEBUG_MODE && typeof window !== 'undefined') {
    // Add global test functions for development debugging (silent mode)
    window.runParentDashboardTenantTests = async () => {
      const { runAllParentDashboardTenantTests } = await import('../../utils/parentDashboardTenantTests');
      return await runAllParentDashboardTenantTests();
    };
    
    window.quickTenantCheck = async () => {
      const { quickTenantCheck } = await import('../../utils/parentDashboardTenantTests');
      return await quickTenantCheck();
    };
    
    window.debugTenantContext = () => {
      return {
        tenantId,
        tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
        tenantLoading,
        user: user ? { id: user.id, email: user.email } : null,
        isReady: !tenantLoading && !!tenantId && !!user
      };
    };
    
    // Add parent auth test functions
    window.testParentAuth = testParentAuth;
    window.quickParentAuthTest = quickParentAuthTest;
  }
  
  // Check if user should use direct parent authentication
  useEffect(() => {
    const checkParentAuthMode = async () => {
      if (!user || parentAuthChecked) return;
      
      try {
        const parentCheck = await isUserParent(user.id);
        
        if (parentCheck.success && parentCheck.isParent) {
          setUseDirectParentAuth(true);
        } else {
          setUseDirectParentAuth(false);
        }
      } catch (error) {
        setUseDirectParentAuth(false);
      } finally {
        setParentAuthChecked(true);
      }
    };
    
    checkParentAuthMode();
  }, [user, parentAuthChecked]);
  
  const [notifications, setNotifications] = useState([]);
  const [exams, setExams] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);

  // Early guard: if there are no linked students, redirect to StudentSelection
  useEffect(() => {
    if (parentAuthChecked && !studentLoading && (!availableStudents || availableStudents.length === 0)) {
      try {
        navigation.replace('StudentSelection');
      } catch (e) {
        navigation.navigate('StudentSelection');
      }
    }
  }, [parentAuthChecked, studentLoading, availableStudents?.length]);

  // Academic year helper to align with FeePayment logic and avoid hard-coding
  const getCurrentAcademicYear = () => {
    // Prefer student's academic year if present
    if (selectedStudent?.academic_year) return selectedStudent.academic_year;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    // Typical academic year in India: starts in April (4)
    if (month >= 4) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  };

  // Utility function to format date from yyyy-mm-dd to dd-mm-yyyy
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Handle different date formats
      let date;
      if (dateString.includes('T')) {
        // ISO date format (2024-01-15T00:00:00.000Z)
        date = new Date(dateString);
      } else if (dateString.includes('-') && dateString.split('-').length === 3) {
        // yyyy-mm-dd format
        const [year, month, day] = dateString.split('-');
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        // Fallback to Date constructor
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      
      // Format to dd-mm-yyyy
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      
      return dateString; // Return original if error
    }
  };

  // Modal states
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [showQuickNotificationsModal, setShowQuickNotificationsModal] = useState(false);

  // Function to refresh notifications
  const refreshNotifications = async () => {
    try {
      // Check if we should use direct parent authentication
      if (useDirectParentAuth && selectedStudent) {
        const result = await getStudentNotificationsForParent(user.id, selectedStudent.id);
        
        if (result.success) {
          setNotifications(result.notifications);
        } else {
          setNotifications([]);
        }
        return;
      }
      
      // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md patterns
      
      // Check if tenant is still loading
      if (tenantLoading) {
        return;
      }
      
      // For parents, we don\'t require tenant filtering
      // Parents can access their children\'s data without tenant restrictions
      if (!tenantId) {
        // Check if user is authenticated first
        if (!user) {
          return;
        }
        
        // Try to get tenant information using email lookup for parents
        try {
          const { getTenantIdByEmail } = await import('../../utils/getTenantByEmail');
          const tenantResult = await getTenantIdByEmail(user.email);
          
          if (tenantResult.success) {
            // We can proceed with the tenant information if needed, but parents don't require strict tenant filtering
          } else {
            // Proceeding as parent access is more flexible
          }
        } catch (emailLookupError) {
          // Email lookup failed, but proceeding as parent access is more flexible
        }
      } else {
        // If tenantId is available, validate it
        const tenantValidation = await validateTenantAccess(tenantId, user.id, 'Parent Dashboard Notifications');
        if (!tenantValidation.isValid) {
          setNotifications([]);
          return;
        }
      }
      
      // Fetch notifications without strict tenant filtering for parents
      
      // Get parent's student data first
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          id,
          email,
          full_name,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('id', user.id)
        // Note: Not filtering by tenant_id for parents
        .single();

      if (parentError) {
        setNotifications([]);
        return;
      }

      if (!parentData?.linked_parent_of) {
        setNotifications([]);
        return;
      }

      // Fetch notifications for the parent's student
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notification_recipients')
        .select(`
          id,
          is_read,
          sent_at,
          notifications (
            id,
            message,
            type,
            created_at,
            sent_by,
            users!sent_by (
              full_name
            )
          )
        `)
        .eq('recipient_id', parentData.linked_parent_of)
        .eq('recipient_type', 'Student')
        .order('sent_at', { ascending: false })
        .limit(10);

      if (notificationsError) {
        setNotifications([]);
        return;
      }

      // Transform the data to match expected format
      // Note: notifications table doesn't have a title column, using type as title
      const formattedNotifications = notificationsData.map(item => ({
        id: item.notifications.id,
        title: item.notifications.type || 'Notification',
        message: item.notifications.message,
        type: item.notifications.type,
        created_at: item.notifications.created_at,
        sender_name: item.notifications.users?.full_name || 'System',
        is_read: item.is_read,
        sent_at: item.sent_at,
      }));

      setNotifications(formattedNotifications);
    } catch (err) {
      setNotifications([]);
    }
  };

  // Function to refresh exams
  const refreshExams = async () => {
    try {
      // Check if we should use direct parent authentication
      if (useDirectParentAuth && selectedStudent) {
        // Direct parent authentication logic here
        return;
      }
      
      // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md patterns
      
      // Check if tenant is still loading
      if (tenantLoading) {
        return;
      }
      
      // For parents, we don\'t require tenant filtering
      // Parents can access their children\'s data without tenant restrictions
      if (!tenantId) {
        // Check if user is authenticated first
        if (!user) {
          return;
        }
        
        // Try to get tenant information using email lookup for parents
        try {
          const { getTenantIdByEmail } = await import('../../utils/getTenantByEmail');
          const tenantResult = await getTenantIdByEmail(user.email);
          
          if (tenantResult.success) {
            // We can proceed with the tenant information if needed, but parents don't require strict tenant filtering
          } else {
            // Proceeding as parent access is more flexible
          }
        } catch (emailLookupError) {
          // Email lookup failed, but proceeding as parent access is more flexible
        }
      } else {
        // If tenantId is available, validate it
        const tenantValidation = await validateTenantAccess(tenantId, user.id, 'Parent Dashboard Exams');
        if (!tenantValidation.isValid) {
          setExams([]);
          return;
        }
      }
      
      // Fetch exams without strict tenant filtering for parents
      
      // Get parent's student data first
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          id,
          email,
          full_name,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('id', user.id)
        // Note: Not filtering by tenant_id for parents
        .single();

      if (parentError) {
        
        setExams([]);
        return;
      }

      if (!parentData?.linked_parent_of) {
        
        setExams([]);
        return;
      }

      // Fetch exams for the parent's student
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select(`
          id,
          name,
          date,
          subject,
          type,
          marks_obtained,
          total_marks,
          students!exam_students_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('students.id', parentData.linked_parent_of)
        .order('date', { ascending: false })
        .limit(10);

      if (examsError) {
        
        setExams([]);
        return;
      }

      // Transform the data to match expected format
      const formattedExams = examsData.map(item => ({
        id: item.id,
        name: item.name,
        date: item.date,
        subject: item.subject,
        type: item.type,
        marks_obtained: item.marks_obtained,
        total_marks: item.total_marks,
        student_name: item.students.name,
        student_admission_no: item.students.admission_no,
      }));

      setExams(formattedExams);
    } catch (err) {
      
      setExams([]);
    }
  };

  // Function to refresh events
  const refreshEvents = async () => {
    try {
      // Check if we should use direct parent authentication
      if (useDirectParentAuth && selectedStudent) {
        
        // Direct parent authentication logic here
        return;
      }
      
      // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md patterns
      
      // Check if tenant is still loading
      if (tenantLoading) {
        
        return;
      }
      
      // For parents, we don\'t require tenant filtering
      // Parents can access their children\'s data without tenant restrictions
      if (!tenantId) {
        // Check if user is authenticated first
        if (!user) {
          
          return;
        }
        
        
        // Try to get tenant information using email lookup for parents
        try {
          const { getTenantIdByEmail } = await import('../../utils/getTenantByEmail');
          const tenantResult = await getTenantIdByEmail(user.email);
          
          if (tenantResult.success) {
            
            // We can proceed with the tenant information if needed, but parents don't require strict tenant filtering
          } else {
            
          }
        } catch (emailLookupError) {
          
        }
      } else {
        // If tenantId is available, validate it
        const tenantValidation = await validateTenantAccess(tenantId, user.id, 'Parent Dashboard Events');
        if (!tenantValidation.isValid) {
          
          setEvents([]);
          return;
        }
      }
      
      // Fetch events without strict tenant filtering for parents
      
      
      // Get parent's student data first
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          id,
          email,
          full_name,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('id', user.id)
        // Note: Not filtering by tenant_id for parents
        .single();

      if (parentError) {
        
        setEvents([]);
        return;
      }

      if (!parentData?.linked_parent_of) {
        
        setEvents([]);
        return;
      }

      // Fetch events for the parent's student
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          description,
          location,
          students!event_students_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('students.id', parentData.linked_parent_of)
        .order('date', { ascending: false })
        .limit(10);

      if (eventsError) {
        
        setEvents([]);
        return;
      }

      // Transform the data to match expected format
      const formattedEvents = eventsData.map(item => ({
        id: item.id,
        name: item.name,
        date: item.date,
        description: item.description,
        location: item.location,
        student_name: item.students.name,
        student_admission_no: item.students.admission_no,
      }));

      setEvents(formattedEvents);
    } catch (err) {
      
      setEvents([]);
    }
  };

  // Function to refresh attendance
  const refreshAttendance = async () => {
    try {
      // Check if we should use direct parent authentication
      if (useDirectParentAuth && selectedStudent) {
        
        // Direct parent authentication logic here
        return;
      }
      
      // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md patterns
      
      // Check if tenant is still loading
      if (tenantLoading) {
        
        return;
      }
      
      // For parents, we don\'t require tenant filtering
      // Parents can access their children\'s data without tenant restrictions
      if (!tenantId) {
        // Check if user is authenticated first
        if (!user) {
          
          return;
        }
        
        
        // Try to get tenant information using email lookup for parents
        try {
          const { getTenantIdByEmail } = await import('../../utils/getTenantByEmail');
          const tenantResult = await getTenantIdByEmail(user.email);
          
          if (tenantResult.success) {
            
            // We can proceed with the tenant information if needed, but parents don't require strict tenant filtering
          } else {
            
          }
        } catch (emailLookupError) {
          
        }
      } else {
        // If tenantId is available, validate it
        const tenantValidation = await validateTenantAccess(tenantId, user.id, 'Parent Dashboard Attendance');
        if (!tenantValidation.isValid) {
          
          setAttendance([]);
          return;
        }
      }
      
      // Fetch attendance without strict tenant filtering for parents
      
      
      // Get parent's student data first
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          id,
          email,
          full_name,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('id', user.id)
        // Note: Not filtering by tenant_id for parents
        .single();

      if (parentError) {
        
        setAttendance([]);
        return;
      }

      if (!parentData?.linked_parent_of) {
        
        setAttendance([]);
        return;
      }

      // Fetch attendance for the parent's student
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          students!attendance_students_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('students.id', parentData.linked_parent_of)
        .order('date', { ascending: false })
        .limit(10);

      if (attendanceError) {
        
        setAttendance([]);
        return;
      }

      // Transform the data to match expected format
      const formattedAttendance = attendanceData.map(item => ({
        id: item.id,
        date: item.date,
        status: item.status,
        student_name: item.students.name,
        student_admission_no: item.students.admission_no,
      }));

      setAttendance(formattedAttendance);
    } catch (err) {
      
      setAttendance([]);
    }
  };

  // Function to refresh marks
  const refreshMarks = async () => {
    try {
      // Check if we should use direct parent authentication
      if (useDirectParentAuth && selectedStudent) {
        
        // Direct parent authentication logic here
        return;
      }
      
      // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md patterns
      
      // Check if tenant is still loading
      if (tenantLoading) {
        
        return;
      }
      
      // For parents, we don\'t require tenant filtering
      // Parents can access their children\'s data without tenant restrictions
      if (!tenantId) {
        // Check if user is authenticated first
        if (!user) {
          
          return;
        }
        
        
        // Try to get tenant information using email lookup for parents
        try {
          const { getTenantIdByEmail } = await import('../../utils/getTenantByEmail');
          const tenantResult = await getTenantIdByEmail(user.email);
          
          if (tenantResult.success) {
            
            // We can proceed with the tenant information if needed, but parents don't require strict tenant filtering
          } else {
            
          }
        } catch (emailLookupError) {
          
        }
      } else {
        // If tenantId is available, validate it
        const tenantValidation = await validateTenantAccess(tenantId, user.id, 'Parent Dashboard Marks');
        if (!tenantValidation.isValid) {
          
          setMarks([]);
          return;
        }
      }
      
      // Fetch marks without strict tenant filtering for parents
      
      
      // Get parent's student data first
      const { data: parentData, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          id,
          email,
          full_name,
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('id', user.id)
        // Note: Not filtering by tenant_id for parents
        .single();

      if (parentError) {
        
        setMarks([]);
        return;
      }

      if (!parentData?.linked_parent_of) {
        
        setMarks([]);
        return;
      }

      // Fetch marks for the parent's student
      const { data: marksData, error: marksError } = await supabase
        .from('marks')
        .select(`
          id,
          subject,
          marks_obtained,
          total_marks,
          students!marks_students_fkey(
            id,
            name,
            admission_no
          )
        `)
        .eq('students.id', parentData.linked_parent_of)
        .order('created_at', { ascending: false })
        .limit(10);

      if (marksError) {
        
        setMarks([]);
        return;
      }

      // Transform the data to match expected format
      const formattedMarks = marksData.map(item => ({
        id: item.id,
        subject: item.subject,
        marks_obtained: item.marks_obtained,
        total_marks: item.total_marks,
        student_name: item.students.name,
        student_admission_no: item.students.admission_no,
      }));

      setMarks(formattedMarks);
    } catch (err) {
      
      setMarks([]);
    }
  };

  // Function to refresh fees - DISABLED: Now using student_fee_summary view consistently
  const refreshFees = async () => {
    
    // This function is disabled to prevent conflicts with the student_fee_summary view approach
    // All fee data loading now goes through fetchStudentFees which uses student_fee_summary view
    return;
  };

  // Effect to load notifications when context becomes available
  useEffect(() => {
    if (user && parentAuthChecked) {
      if (useDirectParentAuth && selectedStudent) {
        
        refreshNotifications();
      } else if (!useDirectParentAuth && tenantId && !tenantLoading) {
        
        refreshNotifications();
      }
    }
  }, [user, tenantId, tenantLoading, useDirectParentAuth, parentAuthChecked, selectedStudent?.id]);

  // Add focus effect to refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && parentAuthChecked) {
        if (useDirectParentAuth && selectedStudent) {
          refreshNotifications();
        } else if (!useDirectParentAuth && !tenantLoading && tenantId) {
          refreshNotifications();
        } else if (!useDirectParentAuth && tenantLoading) {
          
        }
      }
    }, [user, tenantLoading, tenantId, useDirectParentAuth, parentAuthChecked, selectedStudent?.id])
  );

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    // Fetch all dashboard data when refreshing
    const { data: parentUserData, error: parentError } = await dbHelpers.getParentByUserId(user.id);
    if (!parentError && parentUserData) {
      let studentDetails = null;
      
      if (parentUserData.students && parentUserData.students.length > 0) {
        studentDetails = parentUserData.students[0];
      } else if (parentUserData.linked_parent_of) {
        const { data: linkedStudentData, error: linkedStudentError } = await supabase
          .from(TABLES.STUDENTS)
          .select('*')
          .eq('id', parentUserData.linked_parent_of)
          .single();
        if (!linkedStudentError) {
          studentDetails = linkedStudentData;
        }
      }
      
      if (studentDetails) {
        // Refresh all data
        await Promise.all([
          refreshNotifications(),
          // Refresh other data as needed
        ]);
      }
    }
  });

  // Effect to refetch data when selected student changes
  useEffect(() => {
    
    
    if (selectedStudent && !studentLoading && parentAuthChecked) {
      if (useDirectParentAuth) {
        // Use direct parent authentication
        
        fetchDashboardDataForStudent(selectedStudent);
      } else if (!tenantLoading && tenantId) {
        // Use tenant-based authentication
        
        fetchDashboardDataForStudent(selectedStudent);
      } else if (tenantLoading) {
        
      }
    }
  }, [selectedStudent?.id, studentLoading, tenantLoading, tenantId, useDirectParentAuth, parentAuthChecked]);

  // Force re-render counter to ensure StatCards update immediately
  const [updateCounter, setUpdateCounter] = useState(0);
  
  // Force StatCard update function
  const forceStatCardUpdate = () => {
    
    setUpdateCounter(prev => {
      const newCounter = prev + 1;
      
      return newCounter;
    });
  };

  // Individual fetch functions for real-time updates
  const fetchUpcomingExams = React.useCallback(async (classId) => {
    if (!classId) return;
    
    try {
      
      
      const today = new Date().toISOString().split('T')[0];
      const { data: examsData, error: examsError } = await supabase
        .from(TABLES.EXAMS)
        .select(`
          id,
          name,
          start_date,
          end_date,
          remarks,
          class_id,
          academic_year
        `)
        .eq('class_id', classId)
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(5);

      if (!examsError) {
        
        setExams(examsData || []);
        // Force StatCard update immediately
        forceStatCardUpdate();
      } else {
        
      }
    } catch (err) {
      
    }
  }, []);
  
  const fetchStudentAttendance = React.useCallback(async (studentId) => {
    if (!studentId) return;
    
    try {
      
      
      // Multiple strategies to fetch attendance data
      let allAttendanceData = null;
      let attendanceError = null;
      
      // Try the configured table name first
      try {
        const { data, error } = await supabase
          .from(TABLES.STUDENT_ATTENDANCE)
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
          .order('date', { ascending: false });
          
        if (!error) {
          allAttendanceData = data;
        } else {
          attendanceError = error;
        }
      } catch (err) {
        attendanceError = err;
      }
      
      // Fallback to 'student_attendance' directly if TABLES.STUDENT_ATTENDANCE fails
      if (!allAttendanceData) {
        try {
          const { data, error } = await supabase
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
            .order('date', { ascending: false });
            
          if (!error) {
            allAttendanceData = data;
          } else {
            attendanceError = error;
          }
        } catch (err) {
          attendanceError = err;
        }
      }
        
      if (!attendanceError && allAttendanceData) {
        // Filter to current month records
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const currentMonthRecords = (allAttendanceData || []).filter(record => {
          if (!record.date || typeof record.date !== 'string') return false;
          
          try {
            let recordDate;
            let recordYear, recordMonth;
            
            if (record.date.includes('T')) {
              recordDate = new Date(record.date);
              recordYear = recordDate.getFullYear();
              recordMonth = recordDate.getMonth() + 1;
            } else if (record.date.includes('-')) {
              const parts = record.date.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  recordYear = parseInt(parts[0], 10);
                  recordMonth = parseInt(parts[1], 10);
                } else if (parts[2].length === 4) {
                  recordYear = parseInt(parts[2], 10);
                  recordMonth = parseInt(parts[1], 10);
                } else {
                  return false;
                }
              } else {
                return false;
              }
            } else {
              recordDate = new Date(record.date);
              if (isNaN(recordDate.getTime())) return false;
              recordYear = recordDate.getFullYear();
              recordMonth = recordDate.getMonth() + 1;
            }
            
            if (isNaN(recordYear) || isNaN(recordMonth)) return false;
            
            return recordYear === year && recordMonth === month;
          } catch (err) {
            return false;
          }
        });
        
        
        setAttendance(currentMonthRecords);
        // Force StatCard update immediately
        forceStatCardUpdate();
      } else {
        
      }
    } catch (err) {
      
    }
  }, []);
  
  const fetchStudentFees = React.useCallback(async (studentId, classId) => {
    if (!studentId) return;
    
    try {
      
      
      // 🎯 Use exact same data source as parent FeePayment for consistency (REAL-TIME)
      const { data: feeData, error: feeError } = await supabase
        .from('student_fee_summary')
        .select('*')
        .eq('student_id', studentId)
        .single();

      if (feeError) {
        
        if (feeError.code === 'PGRST116') {
          
          setFees([]);
          // Clear view totals as well
          window.parentDashboardFeeViewTotals = null;
          return;
        }
        throw feeError;
      }

      
      
      // Store view totals globally for dashboard fee distribution summary (REAL-TIME UPDATE)
      window.parentDashboardFeeViewTotals = {
        total_final_fees: feeData.total_final_fees,
        total_paid: feeData.total_paid,
        total_outstanding: feeData.total_outstanding,
        total_base_fees: feeData.total_base_fees,
        total_discounts: feeData.total_discounts
      };
      

      // Transform fee components from JSON to array format (EXACT SAME AS PARENT FEEPAYMENT)
      const transformedFees = (feeData.fee_components || []).map((component, index) => {
        // Determine category based on fee component name
        let category = 'general';
        if (component.fee_component) {
          const componentName = component.fee_component.toLowerCase();
          if (componentName.includes('tuition') || componentName.includes('academic')) {
            category = 'tuition';
          } else if (componentName.includes('book') || componentName.includes('library')) {
            category = 'books';
          } else if (componentName.includes('transport') || componentName.includes('bus')) {
            category = 'transport';
          } else if (componentName.includes('exam') || componentName.includes('test')) {
            category = 'examination';
          } else if (componentName.includes('activity') || componentName.includes('sport')) {
            category = 'activities';
          } else if (componentName.includes('facility') || componentName.includes('lab')) {
            category = 'facilities';
          }
        }

        return {
          id: `fee-${component.fee_component}-${index}`,
          name: component.fee_component,
          totalAmount: Number(component.base_amount) || 0,
          discountAmount: Number(component.discount_amount) || 0,
          amount: Number(component.final_amount) || 0,
          dueDate: component.due_date || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
          status: component.status || 'unpaid',
          paidAmount: Number(component.paid_amount) || 0,
          remainingAmount: Number(component.outstanding_amount) || 0,
          description: component.has_discount ? 
            `${component.fee_component} - Base: ₹${component.base_amount}, Discount: ₹${component.discount_amount}` :
            `${component.fee_component} - Standard Fee`,
          category: category,
          academicYear: feeData.academic_year,
          hasDiscount: component.has_discount,
          discountType: component.discount_type,
          paymentCount: component.payment_count || 0,
          lastPaymentDate: component.last_payment_date,
          due_date: component.due_date, // Add for compatibility
          academic_year: feeData.academic_year // Add for compatibility
        };
      });
      
      setFees(transformedFees);
      
      // Force StatCard update immediately
      
      forceStatCardUpdate();
      
      // Additional forced re-render after a short delay to ensure state propagation
      setTimeout(() => {
        forceStatCardUpdate();
      }, 50);
      
    } catch (err) {
      
    }
  }, []);

  // Set up real-time subscriptions for data changes
  useEffect(() => {
    let examSubscription = null;
    let attendanceSubscription = null;
    let feeSubscription = null;
    let feeStructureSubscription = null;
    
    const setupRealTimeSubscriptions = async () => {
      if (!selectedStudent?.class_id || !selectedStudent?.id) return;
      
      
      // Subscribe to exams changes
      try {
        
        examSubscription = supabase
          .channel(`exam-changes-${selectedStudent.class_id}`)
          .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: TABLES.EXAMS,
            filter: `class_id=eq.${selectedStudent.class_id}`
          }, (payload) => {
            
            fetchUpcomingExams(selectedStudent.class_id);
          })
          .subscribe((status) => {
            
          });
      } catch (err) {
        
      }
      
      // Subscribe to attendance changes
      try {
        
        attendanceSubscription = supabase
          .channel(`attendance-changes-${selectedStudent.id}`)
          .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: TABLES.STUDENT_ATTENDANCE,
            filter: `student_id=eq.${selectedStudent.id}`
          }, (payload) => {
            
            fetchStudentAttendance(selectedStudent.id);
          })
          .subscribe((status) => {
            
          });
      } catch (err) {
        
      }
      
      // Subscribe to fee payment changes - CRITICAL for immediate StatCard updates
      try {
        
        feeSubscription = supabase
          .channel(`fee-payment-changes-${selectedStudent.id}`)
          .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: 'student_fees',
            filter: `student_id=eq.${selectedStudent.id}`
          }, (payload) => {
            // Immediate fetch to update StatCard optimistically
            
            fetchStudentFees(selectedStudent.id, selectedStudent.class_id);
            // Follow-up fetch to ensure consistency after DB commit propagation
            setTimeout(() => {
              fetchStudentFees(selectedStudent.id, selectedStudent.class_id);
            }, 200);
          })
          .subscribe((status) => {
            
          });
      } catch (err) {
        
      }
      
      // Subscribe to fee structure changes
      try {
        
        feeStructureSubscription = supabase
          .channel(`fee-structure-changes-${selectedStudent.class_id}`)
          .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: 'fee_structure',
            filter: `class_id=eq.${selectedStudent.class_id}`
          }, (payload) => {
            
            // Immediate fee data refresh
            setTimeout(() => {
              
              fetchStudentFees(selectedStudent.id, selectedStudent.class_id);
            }, 100);
          })
          .subscribe((status) => {
            
          });
      } catch (err) {
        
      }

      // Also subscribe to student-specific fee structure changes
      try {
        
        const studentFeeStructureSubscription = supabase
          .channel(`student-fee-structure-changes-${selectedStudent.id}`)
          .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: 'fee_structure',
            filter: `student_id=eq.${selectedStudent.id}`
          }, (payload) => {
            
            // Immediate fee data refresh
            setTimeout(() => {
              
              fetchStudentFees(selectedStudent.id, selectedStudent.class_id);
            }, 100);
          })
          .subscribe((status) => {
            
          });
      } catch (err) {
        
      }
    };
    
    if (selectedStudent && !studentLoading) {
      setupRealTimeSubscriptions();
    }
    
    // Cleanup subscriptions when component unmounts or student changes
    return () => {
      
      if (examSubscription) {
        
        supabase.removeChannel(examSubscription);
      }
      if (attendanceSubscription) {
        
        supabase.removeChannel(attendanceSubscription);
      }
      if (feeSubscription) {
        
        supabase.removeChannel(feeSubscription);
      }
      if (feeStructureSubscription) {
        
        supabase.removeChannel(feeStructureSubscription);
      }
    };
  }, [selectedStudent?.id, selectedStudent?.class_id, studentLoading, fetchUpcomingExams, fetchStudentAttendance, fetchStudentFees]);

  // Function to fetch dashboard data using direct parent authentication
  const fetchDashboardDataWithDirectAuth = async (student) => {
    try {
      
      
      // Fetch notifications
      const notificationsResult = await getStudentNotificationsForParent(user.id, student.id);
      if (notificationsResult.success) {
        setNotifications(notificationsResult.notifications);
        
      } else {
        
        setNotifications([]);
      }
      
      // Fetch attendance
      const attendanceResult = await getStudentAttendanceForParent(user.id, student.id);
      if (attendanceResult.success) {
        // Filter to current month records
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const currentMonthRecords = (attendanceResult.attendance || []).filter(record => {
          if (!record.date || typeof record.date !== 'string') return false;
          
          try {
            let recordYear, recordMonth;
            
            if (record.date.includes('T')) {
              const recordDate = new Date(record.date);
              recordYear = recordDate.getFullYear();
              recordMonth = recordDate.getMonth() + 1;
            } else if (record.date.includes('-')) {
              const parts = record.date.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  recordYear = parseInt(parts[0], 10);
                  recordMonth = parseInt(parts[1], 10);
                } else if (parts[2].length === 4) {
                  recordYear = parseInt(parts[2], 10);
                  recordMonth = parseInt(parts[1], 10);
                } else {
                  return false;
                }
              } else {
                return false;
              }
            } else {
              const recordDate = new Date(record.date);
              if (isNaN(recordDate.getTime())) return false;
              recordYear = recordDate.getFullYear();
              recordMonth = recordDate.getMonth() + 1;
            }
            
            return recordYear === year && recordMonth === month;
          } catch (err) {
            return false;
          }
        });
        
        setAttendance(currentMonthRecords);
        
      } else {
        
        setAttendance([]);
      }
      
      // Fetch exams (no tenant filtering needed)
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: examsData, error: examsError } = await supabase
          .from(TABLES.EXAMS)
          .select(`
            id,
            name,
            start_date,
            end_date,
            remarks,
            class_id,
            academic_year
          `)
          .eq('class_id', student.class_id)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(5);
        
        if (!examsError) {
          setExams(examsData || []);
          
        } else {
          
          setExams([]);
        }
      } catch (err) {
        
        setExams([]);
      }
      
      // Fetch events (no tenant filtering needed)
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'Active')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(10);
        
        if (!eventsError) {
          const mappedEvents = (eventsData || []).map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            event_date: event.event_date,
            event_time: event.start_time || '09:00',
            icon: event.icon || 'calendar',
            color: event.color || '#FF9800',
            location: event.location,
            organizer: event.organizer
          }));
          
          setEvents(mappedEvents.slice(0, 5));
          
        } else {
          
          setEvents([]);
        }
      } catch (err) {
        
        setEvents([]);
      }
      
      // Fetch marks (no tenant filtering needed)
      try {
        const { data: marksData, error: marksError } = await supabase
          .from(TABLES.MARKS)
          .select(`
            *,
            subjects(name),
            exams(name, start_date)
          `)
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!marksError) {
          setMarks(marksData || []);
          
        } else {
          
          setMarks([]);
        }
      } catch (err) {
        
        setMarks([]);
      }
      
      // Fetch fees - DISABLED: Now using student_fee_summary view consistently
      
      // Fee loading is now handled by the main data loading and fetchStudentFees functions
      // which use the student_fee_summary view for consistency
      
      /*
      // OLD CODE DISABLED TO PREVENT CONFLICTS:
      try {
        const currentYear = getCurrentAcademicYear();
        
        const [feeResult, paymentResult] = await Promise.all([
          supabase
            .from('fee_structure')
            .select(`
              id,
              academic_year,
              class_id,
              student_id,
              fee_component,
              amount,
              base_amount,
              due_date,
              created_at,
              classes(id, class_name, section, academic_year)
            `)
            .or(`class_id.eq.${student.class_id},student_id.eq.${student.id}`)
            .eq('academic_year', currentYear)
            .order('due_date', { ascending: true }),
          
          supabase
            .from('student_fees')
            .select(`
              id,
              student_id,
              academic_year,
              fee_component,
              amount_paid,
              payment_date,
              payment_mode,
              receipt_number,
              remarks,
              created_at
            `)
            .eq('student_id', student.id)
            .eq('academic_year', currentYear)
            .order('payment_date', { ascending: false })
        ]);
        
        const feeStructureData = feeResult.data;
        const studentPayments = paymentResult.data;
        
        let feesToProcess = feeStructureData || [];
        if (feesToProcess.length === 0) {
          // Use sample data for development
          feesToProcess = [
            {
              id: 'sample-fee-1',
              fee_component: 'Tuition Fee',
              amount: 15000,
              due_date: '2024-12-31',
              academic_year: currentYear,
              class_id: student.class_id,
              created_at: '2024-08-01T00:00:00.000Z'
            },
            {
              id: 'sample-fee-2',
              fee_component: 'Library Fee', 
              amount: 2000,
              due_date: '2024-10-31',
              academic_year: currentYear,
              class_id: student.class_id,
              created_at: '2024-08-01T00:00:00.000Z'
            }
          ];
        }
        
        // Transform fee data
        const transformedFees = feesToProcess.map(fee => {
          const feeComponent = fee.fee_component || fee.name || 'General Fee';
          
          let payments = [];
          if (studentPayments?.length > 0) {
            payments = studentPayments.filter(p => {
              const paymentComponent = (p.fee_component || '').trim();
              const feeComponentStr = feeComponent.trim();
              const yearMatch = p.academic_year === fee.academic_year;
              
              const exactMatch = paymentComponent === feeComponentStr;
              const caseInsensitiveMatch = paymentComponent.toLowerCase() === feeComponentStr.toLowerCase();
              const containsMatch = paymentComponent.toLowerCase().includes(feeComponentStr.toLowerCase()) || 
                                  feeComponentStr.toLowerCase().includes(paymentComponent.toLowerCase());
              
              const componentMatch = exactMatch || caseInsensitiveMatch || containsMatch;
              return componentMatch && yearMatch;
            }) || [];
          }
          
          const totalPaidAmount = payments.reduce((sum, payment) => {
            return sum + Number(payment.amount_paid || 0);
          }, 0);
          
          const feeAmount = Number(fee.amount || 0);
          const remainingAmount = Math.max(0, feeAmount - totalPaidAmount);
          
          let status = 'unpaid';
          if (totalPaidAmount >= feeAmount - 0.01) {
            status = 'paid';
          } else if (totalPaidAmount > 0.01) {
            status = 'partial';
          }
          
          let category = 'general';
          if (feeComponent) {
            const component = feeComponent.toLowerCase();
            if (component.includes('tuition') || component.includes('academic')) {
              category = 'tuition';
            } else if (component.includes('book') || component.includes('library')) {
              category = 'books';
            } else if (component.includes('transport') || component.includes('bus')) {
              category = 'transport';
            }
          }
          
          return {
            id: fee.id,
            name: feeComponent,
            amount: feeAmount,
            status: status,
            due_date: fee.due_date,
            paidAmount: totalPaidAmount,
            remainingAmount: remainingAmount,
            academic_year: fee.academic_year,
            category: category,
            payments: payments
          };
        });
        
        setFees(transformedFees);
        
        
      } catch (err) {
        
        setFees([]);
      }
      */ // END OF DISABLED OLD FEE LOADING CODE
      
      // Load fees using the correct student_fee_summary view
      await fetchStudentFees(student.id, student.class_id);
      
      // Get school details (no filtering needed)
      try {
        const schoolData = await dbHelpers.getSchoolDetails();
        if (schoolData && schoolData.data) {
          setSchoolDetails(schoolData.data);
        }
      } catch (err) {
        
        setSchoolDetails(null);
      }
      
    } catch (error) {
      
      setError(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch dashboard data for a specific student
  const fetchDashboardDataForStudent = async (student) => {
    if (!student) return;
    
    
    
    
    // Use direct parent authentication if enabled
    if (useDirectParentAuth) {
      
      
      setLoading(true);
      setError(null);
      
      try {
        // Verify parent access to student
        const studentResult = await getStudentForParent(user.id, student.id);
        
        if (!studentResult.success) {
          
          setError(studentResult.error);
          setLoading(false);
          return;
        }
        
        // Set the verified student data
        setStudentData(studentResult.student);
        
        
        // Use direct parent authentication for all data fetching
        await fetchDashboardDataWithDirectAuth(student);
        return;
        
      } catch (error) {
        
        setError(`Failed to load student data: ${error.message}`);
        setLoading(false);
        return;
      }
    }
    
    // Enhanced tenant validation following EMAIL_BASED_TENANT_SYSTEM.md
    
    // Check if tenant is still loading
    if (tenantLoading) {
      
      setLoading(true);
      return;
    }
    
    if (!tenantId || !tenant) {
      
      
      setError(TENANT_ERROR_MESSAGES.NO_TENANT);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Validate tenant access
      if (tenantError) {
        
        setError(tenantError);
        setLoading(false);
        return;
      }
      
      
      
      
      // Validate that student belongs to current tenant
      if (student.tenant_id && student.tenant_id !== tenantId) {
        setError(TENANT_ERROR_MESSAGES.WRONG_TENANT_DATA);
        setLoading(false);
        return;
      }
      
      // Set the student data from the selected student context
      // Ensure profile_url is preserved from the context
      setStudentData({
        ...student,
        profile_url: student.profile_url // Explicitly preserve the profile URL from context
      });
      
      // Get notifications for parent (independent of student)
      await refreshNotifications();
      
        // Get upcoming exams for student's class using tenant-aware query
        try {
          
          
          const today = new Date().toISOString().split('T')[0];
          
          
          // Use direct tenant-aware query
          const { data: examsData, error: examsError } = await supabase
            .from(TABLES.EXAMS)
            .select(`
              id,
              name,
              start_date,
              end_date,
              remarks,
              class_id,
              academic_year,
              tenant_id
            `)
            .eq('tenant_id', tenantId)
            .eq('class_id', student.class_id)
            .order('start_date', { ascending: true })
            .limit(5);
          
          // Filter for upcoming dates
          const filteredExamsData = examsData?.filter(exam => exam.start_date >= today) || [];

        
        
        if (filteredExamsData && filteredExamsData.length > 0) {
          
          filteredExamsData.forEach((exam, index) => {
            
          });
        }

        if (examsError) {
          
        }
        setExams(filteredExamsData);
      } catch (err) {
        
        setExams([]);
      }

      // Get upcoming events from the events table using tenant-aware query
      try {
        const today = new Date().toISOString().split('T')[0];
        
        
        // Use direct tenant-aware query for events
        const { data: allEventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'Active')
          .order('event_date', { ascending: true })
          .limit(10);
        
        // Filter for upcoming events
        const upcomingEventsData = allEventsData?.filter(event => event.event_date >= today) || [];
          
        
        
        if (eventsError) {
          
        }
        
        // Map the events to the format expected by the UI
        const mappedEvents = (upcomingEventsData || []).map(event => ({
          id: event.id,
          title: event.title,
          description: event.description || '',
          event_date: event.event_date,
          event_time: event.start_time || '09:00',
          icon: event.icon || 'calendar',
          color: event.color || '#FF9800',
          location: event.location,
          organizer: event.organizer
        }));
        
        setEvents(mappedEvents.slice(0, 5)); // Show top 5 events
      } catch (err) {
        
        setEvents([]);
      }

      // COMPREHENSIVE ATTENDANCE CALCULATION - FIXED FOR ALL DATE FORMATS
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, so add 1
      const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`;

      try {
        
        

        // Multiple strategies to fetch attendance data - same as AttendanceSummary.js
        let allAttendanceData = null;
        let attendanceError = null;
        
        // Strategy 1: Try the configured table name
        try {
          
          const { data, error } = await supabase
            .from(TABLES.STUDENT_ATTENDANCE)
            .select(`
              id,
              student_id,
              class_id,
              date,
              status,
              marked_by,
              created_at
            `)
            .eq('student_id', student.id)
            .order('date', { ascending: false });
            
          if (!error) {
            allAttendanceData = data;
            
          } else {
            attendanceError = error;
            
          }
        } catch (err) {
          
          attendanceError = err;
        }
        
        // Strategy 2: Try 'student_attendance' directly
        if (!allAttendanceData) {
          try {
            const { data, error } = await supabase
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
              .eq('student_id', student.id)
              .order('date', { ascending: false });
              
            if (!error) {
              allAttendanceData = data;
              
            } else {
              attendanceError = error;
              
            }
          } catch (err) {
            
            attendanceError = err;
          }
        }
        
        // Strategy 3: Try alternative table names
        if (!allAttendanceData) {
          const alternativeNames = ['attendance', 'student_attendances', 'attendance_records'];
          
          for (const tableName of alternativeNames) {
            try {
              const { data, error } = await supabase
                .from(tableName)
                .select(`
                  id,
                  student_id,
                  class_id,
                  date,
                  status,
                  marked_by,
                  created_at
                `)
                .eq('student_id', student.id)
                .order('date', { ascending: false });
                
              if (!error && data) {
                allAttendanceData = data;
                
                break;
              }
            } catch (err) {
              
            }
          }
        }

        if (attendanceError && !allAttendanceData) {
          throw attendanceError;
        }

        // COMPREHENSIVE date filtering for current month records
        const currentMonthRecords = (allAttendanceData || []).filter(record => {
          // Safety check for valid date format
          if (!record.date || typeof record.date !== 'string') {
            
            return false;
          }
          
          try {
            let recordDate;
            let recordYear, recordMonth;
            
            // Handle multiple date formats
            if (record.date.includes('T')) {
              // ISO format: 2025-08-01T00:00:00.000Z
              recordDate = new Date(record.date);
              recordYear = recordDate.getFullYear();
              recordMonth = recordDate.getMonth() + 1;
              
            } else if (record.date.includes('-')) {
              // Check if it's YYYY-MM-DD or DD-MM-YYYY
              const parts = record.date.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY-MM-DD format
                  recordYear = parseInt(parts[0], 10);
                  recordMonth = parseInt(parts[1], 10);
                  
                } else if (parts[2].length === 4) {
                  // DD-MM-YYYY format
                  recordYear = parseInt(parts[2], 10);
                  recordMonth = parseInt(parts[1], 10);
                  
                } else {
                  
                  return false;
                }
              } else {
                
                return false;
              }
            } else {
              // Try to parse as a general date
              recordDate = new Date(record.date);
              if (isNaN(recordDate.getTime())) {
                
                return false;
              }
              recordYear = recordDate.getFullYear();
              recordMonth = recordDate.getMonth() + 1;
              
            }
            
            // Check if parsing was successful (not NaN)
            if (isNaN(recordYear) || isNaN(recordMonth)) {
              
              return false;
            }
            
            const isCurrentMonth = recordYear === year && recordMonth === month;
            
            if (isCurrentMonth) {
              // Record matches current month
            } else {
              // Record doesn't match current month
            }
            
            return isCurrentMonth;
          } catch (err) {
            
            return false;
          }
        });

        
        
        
        
        // Calculate statistics
        const presentCount = currentMonthRecords.filter(r => r.status === 'Present').length;
        const absentCount = currentMonthRecords.filter(r => r.status === 'Absent').length;
        const totalDays = currentMonthRecords.length;
        const attendancePercentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
        
        

        // Use the filtered records
        const attendanceData = currentMonthRecords;
        setAttendance(attendanceData || []);
      } catch (err) {
        
        setAttendance([]);
      }

      // Get student marks
      try {
        const { data: marksData, error: marksError } = await supabase
          .from(TABLES.MARKS)
          .select(`
            *,
            subjects(name),
            exams(name, start_date)
          `)
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (marksError && marksError.code !== '42P01') {
          
        }
        setMarks(marksData || []);
      } catch (err) {
        
        setMarks([]);
      }


      // Fee loading is now handled by fetchStudentFees function which uses student_fee_summary view
      // This prevents conflicts and ensures consistency with the FeePayment screen
      // The fetchStudentFees function will be called after the main data loading completes

      // Get school details (independent of student)
      try {
        const schoolData = await dbHelpers.getSchoolDetails();
        if (schoolData && schoolData.data) {
          setSchoolDetails(schoolData.data);
        }
      } catch (err) {
        
        setSchoolDetails(null);
      }
      
      // Load fees using the correct student_fee_summary view
      await fetchStudentFees(student.id, student.class_id);
      
    } catch (err) {
      
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Skip data loading entirely if no students are linked
      if (!studentLoading && (!availableStudents || availableStudents.length === 0)) {
        
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Get parent's student data - improved approach with multiple fallback methods
        
        
        let studentDetails = null;
        let studentProfilePhoto = null;
        
        try {
          // Method 1: Check if user has linked_parent_of (new structure)
          if (user.linked_parent_of) {
            
            const { data: linkedStudentData, error: linkedStudentError } = await supabase
              .from(TABLES.STUDENTS)
              .select(`
                *,
                classes(id, class_name, section)
              `)
              .eq('id', user.linked_parent_of)
              .single();
            
            if (!linkedStudentError && linkedStudentData) {
              
              
              studentDetails = {
                ...linkedStudentData,
                roll_number: linkedStudentData.roll_no || linkedStudentData.roll_number,
                admission_number: linkedStudentData.admission_no || linkedStudentData.admission_number,
                date_of_birth: linkedStudentData.dob || linkedStudentData.date_of_birth,
                class_name: linkedStudentData.classes?.class_name || linkedStudentData.class_name,
                section: linkedStudentData.classes?.section || linkedStudentData.section,
                full_class_name: linkedStudentData.classes ? `${linkedStudentData.classes.class_name} ${linkedStudentData.classes.section}` : (linkedStudentData.class_name || ''),
                aadhar_no: linkedStudentData.aadhar_no,
                place_of_birth: linkedStudentData.place_of_birth,
                nationality: linkedStudentData.nationality,
                religion: linkedStudentData.religion,
                caste: linkedStudentData.caste,
                pin_code: linkedStudentData.pin_code,
                mother_tongue: linkedStudentData.mother_tongue,
                identification_mark_1: linkedStudentData.identification_mark_1,
                identification_mark_2: linkedStudentData.identification_mark_2,
                academic_year: linkedStudentData.academic_year,
                general_behaviour: linkedStudentData.general_behaviour,
                remarks: linkedStudentData.remarks,
                parent_id: linkedStudentData.parent_id,
                school_id: linkedStudentData.school_id,
                created_at: linkedStudentData.created_at
              };
            } else {
              
            }
          }
          
          // Method 2: SECURE - Only use SelectedStudentContext to get student
          // This prevents showing the wrong student by using the secure context logic
          if (!studentDetails && selectedStudent) {
            
            
            
            // Get full student details for the selected student
            const { data: contextStudentData, error: contextStudentError } = await supabase
              .from(TABLES.STUDENTS)
              .select(`
                *,
                classes(id, class_name, section)
              `)
              .eq('id', selectedStudent.id)
              .single();
            
            if (!contextStudentError && contextStudentData) {
              
              
              studentDetails = {
                ...contextStudentData,
                roll_number: contextStudentData.roll_no || contextStudentData.roll_number,
                admission_number: contextStudentData.admission_no || contextStudentData.admission_number,
                date_of_birth: contextStudentData.dob || contextStudentData.date_of_birth,
                class_id: contextStudentData.class_id,
                class_name: contextStudentData.classes?.class_name || contextStudentData.class_name,
                section: contextStudentData.classes?.section || contextStudentData.section,
                full_class_name: contextStudentData.classes ? `${contextStudentData.classes.class_name} ${contextStudentData.classes.section}` : (contextStudentData.class_name || ''),
                aadhar_no: contextStudentData.aadhar_no,
                place_of_birth: contextStudentData.place_of_birth,
                nationality: contextStudentData.nationality,
                religion: contextStudentData.religion,
                caste: contextStudentData.caste,
                pin_code: contextStudentData.pin_code,
                mother_tongue: contextStudentData.mother_tongue,
                identification_mark_1: contextStudentData.identification_mark_1,
                identification_mark_2: contextStudentData.identification_mark_2,
                academic_year: contextStudentData.academic_year,
                general_behaviour: contextStudentData.general_behaviour,
                remarks: contextStudentData.remarks,
                parent_id: contextStudentData.parent_id,
                school_id: contextStudentData.school_id,
                created_at: contextStudentData.created_at
              };
            } else {
              
            }
          }
          
          // Method 3: REMOVED - Email-based search was causing security issues
          // (showing wrong students from different families with same email)
          // We now rely only on secure linked_parent_of and SelectedStudentContext
        } catch (err) {
          
        }
        
        // Method 4: REMOVED - Incorrect parent_id query was causing security issues
        // (students.parent_id should reference parents.id, not user.id)
        // We now rely only on secure linked_parent_of and SelectedStudentContext
        
        // Final fallback: Show error if no student found
        if (!studentDetails) {
          
          
          
        }
        
        // After getting student details, fetch the student's profile photo from users table and parent information
        if (studentDetails) {
          try {
            
            
            // Find the user account linked to this student
            const { data: studentUserData, error: studentUserError } = await supabase
              .from(TABLES.USERS)
              .select('id, profile_url, full_name')
              .eq('linked_student_id', studentDetails.id)
              .maybeSingle();
            
            if (!studentUserError && studentUserData) {
              
              
              studentProfilePhoto = studentUserData.profile_url;
              
              // Add profile photo to student details
              studentDetails.profile_url = studentUserData.profile_url;
            } else {
              
            }
          } catch (err) {
            
          }
          
          // Fetch parent information using the junction table approach
          try {
            
            
            // Method 1: Try the new junction table approach first
            const { data: relationshipsData, error: relationshipsError } = await supabase
              .from('parent_student_relationships')
              .select(`
                id,
                relationship_type,
                is_primary_contact,
                is_emergency_contact,
                notes,
                parents!parent_student_relationships_parent_id_fkey(
                  id,
                  name,
                  phone,
                  email
                )
              `)
              .eq('student_id', studentDetails.id);
            
            let parentDataFound = false;
            
            if (!relationshipsError && relationshipsData && relationshipsData.length > 0) {
              
              
              // Process relationships to extract parent information
              let fatherInfo = null;
              let motherInfo = null;
              let guardianInfo = null;
              let primaryContactInfo = null;
              
              relationshipsData.forEach(rel => {
                if (rel.parents && rel.parents.name) {
                  const parent = rel.parents;
                  const relation = rel.relationship_type;
                  
                  
                  // Skip invalid or placeholder parent names (more lenient filtering)
                  const isValidParentName = parent.name && 
                    parent.name.trim() !== '' && 
                    parent.name.toLowerCase() !== 'n/a' &&
                    !parent.name.toLowerCase().includes('placeholder') &&
                    !parent.name.toLowerCase().includes('test') &&
                    !parent.name.toLowerCase().includes('sample') &&
                    parent.name.toLowerCase() !== 'parent';
                  
                  if (isValidParentName) {
                    const parentData = {
                      id: parent.id,
                      name: parent.name,
                      phone: parent.phone,
                      email: parent.email,
                      relation: relation,
                      photo_url: parent.photo_url,
                      is_primary_contact: rel.is_primary_contact,
                      is_emergency_contact: rel.is_emergency_contact,
                      notes: rel.notes
                    };
                    
                    // Organize by relationship type
                    if (relation === 'Father') {
                      fatherInfo = parentData;
                      
                    } else if (relation === 'Mother') {
                      motherInfo = parentData;
                      
                    } else if (relation === 'Guardian') {
                      guardianInfo = parentData;
                      
                    }
                    
                    // Track primary contact
                    if (rel.is_primary_contact) {
                      primaryContactInfo = parentData;
                    }
                    
                    parentDataFound = true;
                  } else {
                    
                  }
                }
              });
              
              if (parentDataFound) {
                // Create combined parent info with priority: Father > Mother > Guardian
                const parentInfo = {
                  father: fatherInfo,
                  mother: motherInfo,
                  guardian: guardianInfo,
                  primary_contact: primaryContactInfo,
                  // For backward compatibility, use primary contact first, then father, mother, guardian
                  name: primaryContactInfo?.name || fatherInfo?.name || motherInfo?.name || guardianInfo?.name || 'N/A',
                  phone: primaryContactInfo?.phone || fatherInfo?.phone || motherInfo?.phone || guardianInfo?.phone || 'N/A',
                  email: primaryContactInfo?.email || fatherInfo?.email || motherInfo?.email || guardianInfo?.email || 'N/A',
                  relation: primaryContactInfo?.relation || fatherInfo?.relation || motherInfo?.relation || guardianInfo?.relation || 'N/A'
                };
                
                // Add parent information to student details
                studentDetails.father_name = fatherInfo?.name || 'N/A';
                studentDetails.mother_name = motherInfo?.name || 'N/A';
                studentDetails.guardian_name = guardianInfo?.name || 'N/A';
                studentDetails.father_phone = fatherInfo?.phone || 'N/A';
                studentDetails.mother_phone = motherInfo?.phone || 'N/A';
                studentDetails.guardian_phone = guardianInfo?.phone || 'N/A';
                studentDetails.father_email = fatherInfo?.email || 'N/A';
                studentDetails.mother_email = motherInfo?.email || 'N/A';
                studentDetails.guardian_email = guardianInfo?.email || 'N/A';
                studentDetails.parent_phone = parentInfo.phone;
                studentDetails.parent_email = parentInfo.email;
                
                // Override student fields with parent data if available and student data is missing
                if (parentInfo.phone && parentInfo.phone !== 'N/A' && !studentDetails.phone) {
                  studentDetails.phone = parentInfo.phone;
                }
                if (parentInfo.email && parentInfo.email !== 'N/A' && !studentDetails.email) {
                  studentDetails.email = parentInfo.email;
                }
                
                
              }
            } else {
              
            }
            
            // Method 2: Fallback to direct parents table query if junction table fails or no data
            if (!parentDataFound) {
              
              
              // Query parents table using exact schema fields
              const { data: directParentsData, error: directParentsError } = await supabase
                .from('parents')
                .select('id, name, phone, email, relation, student_id, created_at')
                .eq('student_id', studentDetails.id);
              
              if (!directParentsError && directParentsData && directParentsData.length > 0) {
                
                
                
                // Process all found parents and try to categorize by relation if available
                let fatherInfo = null;
                let motherInfo = null;
                let guardianInfo = null;
                
                directParentsData.forEach(parent => {
                  
                  
                  
                  
                  
                  
                  
                  
                  // Filter out placeholder/invalid parent names (more lenient filtering)
                  const isValidParentName = parent.name && 
                    parent.name.trim() !== '' && 
                    parent.name.toLowerCase() !== 'n/a' &&
                    !parent.name.toLowerCase().includes('placeholder') &&
                    !parent.name.toLowerCase().includes('test') &&
                    !parent.name.toLowerCase().includes('sample') &&
                    parent.name.toLowerCase() !== 'parent';
                  
                  
                  
                  if (isValidParentName) {
                    const relation = parent.relation ? parent.relation.toLowerCase().trim() : null;
                    
                    
                    const parentData = {
                      id: parent.id,
                      name: parent.name,
                      phone: parent.phone || 'N/A',
                      email: parent.email || 'N/A',
                      relation: parent.relation || 'Parent'
                    };
                    
                    
                    
                    // Match case-insensitive relation types
                    if (relation === 'father') {
                      fatherInfo = parentData;
                      
                    } else if (relation === 'mother') {
                      motherInfo = parentData;
                      
                    } else if (relation === 'guardian') {
                      guardianInfo = parentData;
                      
                    } else {
                      
                    }
                    
                    parentDataFound = true;
                  } else {
                    
                  }
                  
                });
                
                if (parentDataFound) {
                  // Assign parent information to student details
                  studentDetails.father_name = fatherInfo?.name || 'N/A';
                  studentDetails.mother_name = motherInfo?.name || 'N/A';
                  studentDetails.guardian_name = guardianInfo?.name || 'N/A';
                  studentDetails.father_phone = fatherInfo?.phone || 'N/A';
                  studentDetails.mother_phone = motherInfo?.phone || 'N/A';
                  studentDetails.guardian_phone = guardianInfo?.phone || 'N/A';
                  studentDetails.father_email = fatherInfo?.email || 'N/A';
                  studentDetails.mother_email = motherInfo?.email || 'N/A';
                  studentDetails.guardian_email = guardianInfo?.email || 'N/A';
                  
                  // Set primary contact info (prioritize father, then mother, then guardian)
                  const primaryParent = fatherInfo || motherInfo || guardianInfo;
                  studentDetails.parent_phone = primaryParent?.phone || 'N/A';
                  studentDetails.parent_email = primaryParent?.email || 'N/A';
                  
                  // Add address and pin code if available
                  if (primaryParent?.address) {
                    studentDetails.parent_address = primaryParent.address;
                  }
                  if (primaryParent?.pin_code) {
                    studentDetails.parent_pin_code = primaryParent.pin_code;
                  }
                  
                }
              } else {
                
              }
            }
            
            // If still no parent data found, set defaults
            if (!parentDataFound) {
              
              studentDetails.father_name = 'N/A';
              studentDetails.mother_name = 'N/A';
              studentDetails.guardian_name = 'N/A';
              studentDetails.father_phone = 'N/A';
              studentDetails.mother_phone = 'N/A';
              studentDetails.guardian_phone = 'N/A';
              studentDetails.father_email = 'N/A';
              studentDetails.mother_email = 'N/A';
              studentDetails.guardian_email = 'N/A';
              studentDetails.parent_phone = 'N/A';
              studentDetails.parent_email = 'N/A';
            }
          } catch (err) {
            
            // Set default values on error
            studentDetails.father_name = 'N/A';
            studentDetails.mother_name = 'N/A';
            studentDetails.guardian_name = 'N/A';
            studentDetails.father_phone = 'N/A';
            studentDetails.mother_phone = 'N/A';
            studentDetails.guardian_phone = 'N/A';
            studentDetails.father_email = 'N/A';
            studentDetails.mother_email = 'N/A';
            studentDetails.guardian_email = 'N/A';
            studentDetails.parent_phone = 'N/A';
            studentDetails.parent_email = 'N/A';
          }
        }
        
        // If still no student data found, throw error instead of using sample data
        if (!studentDetails) {
          
          throw new Error(`No student linked to this parent account. Please contact the school administration to link your child's account. User ID: ${user.id}, Email: ${user.email}`);
        }
        setStudentData(studentDetails);

        // Get notifications for parent
        try {
          
          
          // Get notifications with recipients for this parent
          const { data: notificationsData, error: notificationsError } = await supabase
            .from(TABLES.NOTIFICATION_RECIPIENTS)
            .select(`
              id,
              is_read,
              sent_at,
              read_at,
              notifications!inner(
                id,
                message,
                type,
                created_at
              )
            `)
            .eq('recipient_type', 'Parent')
            .eq('recipient_id', user.id)
            .order('sent_at', { ascending: false })
            .limit(10);

          if (notificationsError && notificationsError.code !== '42P01') {
            
          } else {
            const mappedNotifications = (notificationsData || []).map(n => {
              // Create proper title and message for absence notifications
              let title, message;
              if (n.notifications.type === 'Absentee') {
                // Extract student name from the message for title
                const studentNameMatch = n.notifications.message.match(/Student (\w+)/);
                const studentName = studentNameMatch ? studentNameMatch[1] : 'Student';
                title = `${studentName} - Absent`;
                message = n.notifications.message.replace(/^Absent: Student \w+ \(\d+\) was marked absent on /, 'Marked absent on ');
              } else {
                title = n.notifications.type || 'Notification';
                message = n.notifications.message;
              }

              return {
                id: n.id,
                title: title,
                message: message,
                type: n.notifications.type || 'general',
                created_at: n.notifications.created_at,
                is_read: n.is_read || false,
                read_at: n.read_at
              };
            });
            setNotifications(mappedNotifications);
          }
        } catch (err) {
          
          setNotifications([]);
        }

        // Get upcoming exams for student's class (consistent with fetchDashboardDataForStudent)
        try {
          const today = new Date().toISOString().split('T')[0];
          
          // First, let's see ALL exams for this class without date filtering
          const { data: allClassExams, error: allExamsError } = await supabase
            .from(TABLES.EXAMS)
            .select(`
              id,
              name,
              start_date,
              end_date,
              remarks,
              class_id,
              academic_year
            `)
            .eq('class_id', studentDetails.class_id)
            .order('start_date', { ascending: true });
            
          if (!allExamsError && allClassExams) {
            // Process all class exams
            allClassExams.forEach((exam, index) => {
              const examDate = exam.start_date;
              const isUpcoming = examDate >= today;
            });
          }
          
          const { data: examsData, error: examsError } = await supabase
            .from(TABLES.EXAMS)
            .select(`
              id,
              name,
              start_date,
              end_date,
              remarks,
              class_id,
              academic_year
            `)
            .eq('class_id', studentDetails.class_id)
            .gte('start_date', today)
            .order('start_date', { ascending: true })
            .limit(5);

          if (examsData && examsData.length > 0) {
            // Process exam details
            examsData.forEach((exam, index) => {
              // Process each exam
            });
          }

          if (examsError && examsError.code !== '42P01') {
            // Handle exams error
          }
          setExams(examsData || []);
        } catch (err) {
          
          setExams([]);
        }

        // Get upcoming events from the events table
        try {
          const today = new Date().toISOString().split('T')[0];
          
          
          // Get all upcoming events (today and future) that are active
          const { data: upcomingEventsData, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .eq('status', 'Active')
            .gte('event_date', today)
            .order('event_date', { ascending: true });
            
          
          if (upcomingEventsData && upcomingEventsData.length > 0) {
            upcomingEventsData.forEach((event, index) => {
              // Process each event
            });
          }
          
          if (eventsError) {
            
          }
          
          // Map the events to the format expected by the UI
          const mappedEvents = (upcomingEventsData || []).map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            event_date: event.event_date,
            event_time: event.start_time || '09:00',
            icon: event.icon || 'calendar',
            color: event.color || '#FF9800',
            location: event.location,
            organizer: event.organizer
          }));
          
          
          
          if (mappedEvents.length > 0) {
            // Events found
          } else {
            // No events found
          }
          
          setEvents(mappedEvents.slice(0, 5)); // Show top 5 events
        } catch (err) {
          
          setEvents([]);
        }

        // SIMPLE ATTENDANCE CALCULATION - MATCHES StudentAttendanceMarks
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, so add 1

        try {
          // Get ALL attendance records for this student
          const { data: allAttendanceData, error: attendanceError } = await supabase
            .from(TABLES.STUDENT_ATTENDANCE)
            .select('*')
            .eq('student_id', studentDetails.id)
            .order('date', { ascending: false });

          if (attendanceError) throw attendanceError;

          // Filter to current month records
          const currentMonthRecords = (allAttendanceData || []).filter(record => {
            // Safety check for valid date format
            if (!record.date || typeof record.date !== 'string') {
              
              return false;
            }
            
            const dateParts = record.date.split('-');
            if (dateParts.length < 2) {
              return false;
            }
            
            const recordYear = parseInt(dateParts[0], 10);
            const recordMonth = parseInt(dateParts[1], 10);
            
            // Check if parsing was successful (not NaN)
            if (isNaN(recordYear) || isNaN(recordMonth)) {
              
              return false;
            }
            
            return recordYear === year && recordMonth === month;
          });


          // Use the filtered records
          const attendanceData = currentMonthRecords;

          if (attendanceError && attendanceError.code !== '42P01') {
            
          }
          setAttendance(attendanceData || []);
        } catch (err) {
          
          setAttendance([]);
        }

        // Get student marks
        try {
          const { data: marksData, error: marksError } = await supabase
            .from(TABLES.MARKS)
            .select(`
              *,
              subjects(name),
              exams(name, start_date)
            `)
            .eq('student_id', studentDetails.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (marksError && marksError.code !== '42P01') {
            
          }
          setMarks(marksData || []);
        } catch (err) {
          
          setMarks([]);
        }

        // Get fee information from fee_structure table (aligned with FeePayment component)
        try {
          
          
          
          
          // 🎯 Use exact same data source as parent FeePayment for consistency
          const { data: feeData, error: feeError } = await supabase
            .from('student_fee_summary')
            .select('*')
            .eq('student_id', studentDetails.id)
            .single();

          if (feeError) {
            
            if (feeError.code === 'PGRST116') {
              
              setFees([]);
              return;
            }
            throw feeError;
          }

          
          
          // Store view totals globally for dashboard fee distribution summary
          window.parentDashboardFeeViewTotals = {
            total_final_fees: feeData.total_final_fees,
            total_paid: feeData.total_paid,
            total_outstanding: feeData.total_outstanding,
            total_base_fees: feeData.total_base_fees,
            total_discounts: feeData.total_discounts
          };
          

          // Transform fee components from JSON to array format (EXACT SAME AS PARENT FEEPAYMENT)
          const transformedFees = (feeData.fee_components || []).map((component, index) => {
            // Determine category based on fee component name
            let category = 'general';
            if (component.fee_component) {
              const componentName = component.fee_component.toLowerCase();
              if (componentName.includes('tuition') || componentName.includes('academic')) {
                category = 'tuition';
              } else if (componentName.includes('book') || componentName.includes('library')) {
                category = 'books';
              } else if (componentName.includes('transport') || componentName.includes('bus')) {
                category = 'transport';
              } else if (componentName.includes('exam') || componentName.includes('test')) {
                category = 'examination';
              } else if (componentName.includes('activity') || componentName.includes('sport')) {
                category = 'activities';
              } else if (componentName.includes('facility') || componentName.includes('lab')) {
                category = 'facilities';
              }
            }

            return {
              id: `fee-${component.fee_component}-${index}`,
              name: component.fee_component,
              totalAmount: Number(component.base_amount) || 0,
              discountAmount: Number(component.discount_amount) || 0,
              amount: Number(component.final_amount) || 0,
              dueDate: component.due_date || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
              status: component.status || 'unpaid',
              paidAmount: Number(component.paid_amount) || 0,
              remainingAmount: Number(component.outstanding_amount) || 0,
              description: component.has_discount ? 
                `${component.fee_component} - Base: ₹${component.base_amount}, Discount: ₹${component.discount_amount}` :
                `${component.fee_component} - Standard Fee`,
              category: category,
              academicYear: feeData.academic_year,
              hasDiscount: component.has_discount,
              discountType: component.discount_type,
              paymentCount: component.payment_count || 0,
              lastPaymentDate: component.last_payment_date,
              due_date: component.due_date, // Add for compatibility
              academic_year: feeData.academic_year // Add for compatibility
            };
          });
          
          
          
          setFees(transformedFees || []);
        } catch (err) {
          
          setFees([]);
        }

        // Get school details
        try {
          const schoolData = await dbHelpers.getSchoolDetails();
          if (schoolData && schoolData.data) {
            setSchoolDetails(schoolData.data);
          }
        } catch (err) {
          
          setSchoolDetails(null);
        }

      } catch (err) {
        
        setError(err.message);
        Alert.alert('Error', 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Use universal notification service for proper count display
  const [unreadCount, setUnreadCount] = useState(0);
  const [universalCounts, setUniversalCounts] = useState({ messageCount: 0, notificationCount: 0, totalCount: 0 });
  
  // Fetch universal notification counts for bell icon
  const refreshUniversalCounts = useCallback(async () => {
    if (!user?.id || !user) return;
    
    try {
      
      
      // Use the universal notification service to get accurate counts
      const counts = await universalNotificationService.getUnreadCounts(user.id, 'parent');
      
      
      setUniversalCounts(counts);
      setUnreadCount(counts.totalCount);
      
    } catch (error) {
      
      setUniversalCounts({ messageCount: 0, notificationCount: 0, totalCount: 0 });
      setUnreadCount(0);
    }
  }, [user?.id]);
  
  // Set up real-time subscription for notification updates
  useEffect(() => {
    if (!user?.id) return;
    
    
    
    // Initial fetch
    refreshUniversalCounts();
    
    // Set up real-time subscription
    const unsubscribe = universalNotificationService.subscribeToUpdates(
      user.id,
      'parent',
      (reason) => {
        
        // Small delay to ensure database consistency
        setTimeout(refreshUniversalCounts, 100);
      }
    );
    
    return () => {
      
      unsubscribe();
    };
  }, [user?.id, refreshUniversalCounts]);
  

  // Calculate attendance percentage with useMemo for better performance and updates
  const attendanceStats = React.useMemo(() => {
    
    // Filter out any Sunday records as they shouldn't count in attendance
    const validAttendanceRecords = attendance.filter(record => {
      if (!record.date) return false;
      try {
        const recordDate = new Date(record.date);
        const dayOfWeek = recordDate.getDay(); // 0 = Sunday
        return dayOfWeek !== 0; // Exclude Sundays from attendance calculation
      } catch (err) {
        return true; // Keep records with invalid dates for safety
      }
    });
    
    const totalRecords = validAttendanceRecords.length;
    // Handle case sensitivity (status might be 'Present', 'present', etc.)
    const presentOnlyCount = validAttendanceRecords.filter(a => {
      const status = a.status ? a.status.toLowerCase() : '';
      return status === 'present';
    }).length;
    const absentCount = validAttendanceRecords.filter(item => {
      const status = item.status ? item.status.toLowerCase() : '';
      return status === 'absent';
    }).length;
    const attendancePercentage = totalRecords > 0 ? Math.round((presentOnlyCount / totalRecords) * 100) : 0;
    
    
    return {
      totalRecords,
      presentOnlyCount,
      absentCount,
      attendancePercentage,
      validAttendanceRecords
    };
  }, [attendance]);

  // Calculate fee stats with useMemo - EXACTLY matching fee distribution summary calculation
  const feeStats = React.useMemo(() => {
    
    if (fees.length === 0) {
      
      return {
        status: '₹0',
        subtitle: '',
        color: '#4CAF50',
        unpaidCount: 0,
        outstandingAmount: 0,
        formattedOutstanding: '₹0'
      };
    }

    // EXACT SAME calculation as fee distribution summary "Outstanding" card
    const totalOutstanding = fees.reduce((sum, fee) => sum + (fee.remainingAmount || 0), 0);
    const formattedOutstanding = `₹${totalOutstanding.toLocaleString()}`;
    
    // Count fees by status (for potential subtitle use)
    const paidCount = fees.filter(f => f.status === 'paid').length;
    const partialCount = fees.filter(f => f.status === 'partial').length;
    const unpaidCount = fees.filter(f => f.status === 'unpaid').length;

    // Use same color logic as fee distribution summary
    const color = totalOutstanding > 0 ? '#FF5722' : '#4CAF50';
    
    return {
      status: formattedOutstanding,
      subtitle: '',
      color,
      unpaidCount,
      partialCount,
      paidCount,
      outstandingAmount: totalOutstanding,
      formattedOutstanding
    };
  }, [fees, updateCounter]); // Add updateCounter to dependencies

  // Calculate marks stats with useMemo for better performance and updates
  const marksStats = React.useMemo(() => {
    
    if (marks.length === 0) {
      
      return {
        average: 'No marks',
        subtitle: 'No exams taken',
        color: '#2196F3'
      };
    }

    // Filter out marks with invalid data
    const validMarks = marks.filter(mark => 
      mark.marks_obtained !== null && 
      mark.marks_obtained !== undefined && 
      mark.max_marks !== null && 
      mark.max_marks !== undefined &&
      mark.max_marks > 0
    );

    if (validMarks.length === 0) {
      
      return {
        average: 'No marks',
        subtitle: 'No valid marks',
        color: '#2196F3'
      };
    }

    // Calculate percentage for each subject and then average them
    const subjectPercentages = validMarks.map(mark => {
      const percentage = (parseFloat(mark.marks_obtained) / parseFloat(mark.max_marks)) * 100;
      return isNaN(percentage) ? 0 : percentage;
    });

    const averagePercentage = subjectPercentages.reduce((sum, percentage) => sum + percentage, 0) / subjectPercentages.length;
    const average = `${Math.round(averagePercentage)}%`;
    
    // Calculate subtitle based on recent performance
    const recentMarks = validMarks.slice(0, 3);
    const avgRecent = recentMarks.reduce((sum, mark) => {
      const percentage = (mark.marks_obtained / mark.max_marks) * 100;
      return sum + percentage;
    }, 0) / recentMarks.length;

    let subtitle = 'No exams taken';
    if (avgRecent >= 90) subtitle = 'Excellent performance';
    else if (avgRecent >= 75) subtitle = 'Good performance';
    else if (avgRecent >= 60) subtitle = 'Average performance';
    else subtitle = 'Needs improvement';
    
    
    return {
      average,
      subtitle,
      color: '#2196F3'
    };
  }, [marks]);

  // Calculate exam stats with useMemo
  const examStats = React.useMemo(() => {
    
    const count = String(exams.length);
    const subtitle = exams.length > 0 ? `Next: ${exams[0]?.name || 'TBA'}` : 'No upcoming exams';
    
    
    return {
      count,
      subtitle
    };
  }, [exams]);

  // Calculate attendance data for pie chart with safe values
  const attendancePieData = React.useMemo(() => {
    const safeAttendanceData = [
      {
        name: 'Present',
        population: Number.isFinite(attendanceStats.presentOnlyCount) ? attendanceStats.presentOnlyCount : 0,
        color: '#4CAF50',
        legendFontColor: '#333',
        legendFontSize: 14
      },
      {
        name: 'Absent',
        population: Number.isFinite(attendanceStats.absentCount) ? attendanceStats.absentCount : 0,
        color: '#F44336',
        legendFontColor: '#333',
        legendFontSize: 14
      },
    ];

    // Only show chart if we have valid data
    return safeAttendanceData.filter(item => item.population > 0).length > 0
      ? safeAttendanceData
      : [{ name: 'No Data', population: 1, color: '#E0E0E0', legendFontColor: '#999', legendFontSize: 14 }];
  }, [attendanceStats]);

  // Memoized StatCard data to ensure proper updates
  const childStats = React.useMemo(() => {
    
    return [
      {
        title: 'Attendance',
        value: `${attendanceStats.attendancePercentage}%`,
        icon: 'checkmark-circle',
        color: attendanceStats.attendancePercentage >= 75 ? '#4CAF50' : attendanceStats.attendancePercentage >= 60 ? '#FF9800' : '#F44336',
        subtitle: `${attendanceStats.presentOnlyCount}/${attendanceStats.totalRecords} days present`,
        onPress: () => navigation.navigate('Attendance')
      },
      {
        title: 'Outstanding Fee',
        value: feeStats.formattedOutstanding || feeStats.status,
        icon: 'card',
        color: feeStats.color,
        subtitle: '',
        onPress: () => navigation.navigate('Fees')
      },
      {
        title: 'Average Marks',
        value: marksStats.average,
        icon: 'document-text',
        color: marksStats.color,
        subtitle: marksStats.subtitle,
        onPress: () => navigation.navigate('Marks')
      },
      {
        title: 'Upcoming Exams',
        value: examStats.count,
        icon: 'calendar',
        color: '#9C27B0',
        subtitle: examStats.subtitle,
        onPress: () => setShowExamsModal(true)
      },
    ];
  }, [attendanceStats, feeStats, marksStats, examStats, navigation, updateCounter]); // Add updateCounter to dependencies

  // Debug logging for StatCard updates

  // Find the next upcoming event
  const nextEvent = events && events.length > 0 ? events[0] : null;

  const renderExamItem = ({ item, index }) => (
    <View style={styles.examItem}>
      <View style={styles.examIcon}>
        <Ionicons name="calendar" size={24} color="#9C27B0" />
      </View>
      <View style={styles.examInfo}>
        <Text style={styles.examSubject}>{item.subjects?.name || item.name || 'Exam'}</Text>
        <Text style={styles.examDetails}>{formatDateToDDMMYYYY(item.start_date)} • 09:00</Text>
        <Text style={styles.examClass}>{item.class_name || 'N/A'}</Text>
      </View>
      <TouchableOpacity style={styles.examAction}>
        <Ionicons name="chevron-forward" size={20} color="#9C27B0" />
      </TouchableOpacity>
    </View>
  );

  const renderEventItem = ({ item, index }) => (
    <View style={styles.eventItem}>
      <View style={[styles.eventIcon, { backgroundColor: item.color || '#FF9800' }]}>
        <Ionicons name={item.icon || 'calendar'} size={24} color="#fff" />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventDetails}>{formatDateToDDMMYYYY(item.event_date)} • {item.event_time}</Text>
        <Text style={styles.eventDescription}>{item.description}</Text>
      </View>
    </View>
  );

  // Function to mark notification as read
  const markNotificationAsRead = async (notificationRecipientId, notificationId) => {
    if (!notificationRecipientId || !user?.id) return;
    
    
    try {
      // Update the notification recipient record
      const { error } = await supabase
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationRecipientId)
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'Parent');
      
      if (error) {
        
        return;
      }
      
      
      
      // Update local state to reflect the change immediately
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => {
          if (notification.recipientId === notificationRecipientId || notification.id === notificationId) {
            return { ...notification, is_read: true, read_at: new Date().toISOString() };
          }
          return notification;
        })
      );
      
      // Refresh universal counts to update bell icon
      await refreshUniversalCounts();
      
    } catch (error) {
      
    }
  };

  const renderNotificationItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.notificationItem, 
        { 
          borderLeftColor: getNotificationColor(item.type),
          opacity: item.is_read ? 0.8 : 1.0,
          backgroundColor: item.is_read ? '#f8f9fa' : '#fff'
        }
      ]}
      onPress={() => {
        if (!item.is_read) {
          markNotificationAsRead(item.recipientId || item.id, item.id);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.notificationIcon, { backgroundColor: item.is_read ? '#f0f0f0' : '#fff' }]}>
        <Ionicons name={getNotificationIcon(item.type)} size={20} color={getNotificationColor(item.type)} />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, { color: item.is_read ? '#666' : '#333' }]}>{item.title}</Text>
          {!item.is_read && (
            <View style={styles.unreadIndicator}>
              <View style={styles.unreadDot} />
            </View>
          )}
        </View>
        <Text style={[styles.notificationMessage, { color: item.is_read ? '#888' : '#666' }]}>{item.message}</Text>
        <View style={styles.notificationFooter}>
          <Text style={styles.notificationTime}>{formatDateToDDMMYYYY(item.created_at)}</Text>
          {item.is_read && (
            <Text style={styles.readStatus}>Read</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const getNotificationColor = (type) => {
    switch (type) {
      case 'fee': return '#FF9800';
      case 'exam': return '#9C27B0';
      case 'attendance': return '#f44336';
      case 'homework': return '#2196F3';
      case 'event': return '#FF9800';
      case 'sports': return '#4CAF50';
      case 'meeting': return '#9C27B0';
      default: return '#666';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'fee': return 'card';
      case 'exam': return 'calendar';
      case 'attendance': return 'checkmark-circle';
      case 'homework': return 'library';
      case 'event': return 'trophy';
      case 'sports': return 'football';
      case 'meeting': return 'people';
      default: return 'notifications';
    }
  };

  const renderExamCard = ({ item, index }) => (
    <View style={styles.eventItem}>
      <View style={[styles.eventIcon, { backgroundColor: '#9C27B0' }]}> 
        <Ionicons name="calendar" size={24} color="#fff" />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.subjects?.name || item.name || 'Exam'}</Text>
        <Text style={styles.eventDetails}>{formatDateToDDMMYYYY(item.start_date)} • 09:00</Text>
        <Text style={styles.eventDescription}>{item.remarks || 'Exam scheduled'}</Text>
      </View>
    </View>
  );

  if (loading || tenantLoading) {
    return (
      <View style={styles.container}>
        <Header 
          title="Parent Dashboard" 
          showBack={false} 
          showNotifications={true}
          unreadCount={unreadCount}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>
            {tenantLoading ? 'Loading tenant context...' : 'Loading dashboard...'}
          </Text>
          {DEBUG_MODE && tenantLoading && (
            <Text style={styles.debugText}>
              Waiting for email-based tenant resolution...
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header 
          title="Parent Dashboard" 
          showBack={false} 
          showNotifications={true}
          unreadCount={unreadCount}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>Failed to load dashboard</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.replace('ParentDashboard')}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Use student profile photo if available, otherwise fallback to default
  
  const studentImage = studentData?.profile_url ? { uri: studentData.profile_url } : require('../../../assets/icon.png');
  
  

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Header 
          title="Parent Dashboard" 
          showBack={false} 
          showNotifications={true}
          unreadCount={unreadCount}
          onNotificationsPress={() => setShowQuickNotificationsModal(true)}
        />
      
      {/* Student Switch Banner - Show when parent has multiple children */}
      {hasMultipleStudents && (
        <StudentSwitchBanner />
      )}
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF9800']}
            progressBackgroundColor="#fff"
          />
        }
      >
        {/* Welcome Section - Modern gradient design */}
        {schoolDetails && (
          <View style={styles.welcomeSection}>
            {/* Decorative background elements */}
            <View style={styles.backgroundCircle1} />
            <View style={styles.backgroundCircle2} />
            <View style={styles.backgroundPattern} />
            
            <View style={styles.welcomeContent}>
              <View style={styles.schoolHeader}>
                {schoolDetails?.logo_url ? (
                  <Image source={{ uri: schoolDetails.logo_url }} style={styles.schoolLogo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="school" size={40} color="#fff" />
                  </View>
                )}
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>
                    {schoolDetails?.name || 'Maximus School'}
                  </Text>
                  <Text style={styles.schoolType}>
                    {schoolDetails?.type || 'Educational Institution'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Student Details Card */}
        <TouchableOpacity style={styles.studentCard} onPress={() => setShowStudentDetailsModal(true)} activeOpacity={0.85}>
          <View style={styles.studentCardRow}>
            <Image source={studentImage} style={styles.studentAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.studentCardName}>{studentData?.name || 'Student Name'}</Text>
              <Text style={styles.studentCardClass}>{studentData?.full_class_name || studentData?.class_name || 'N/A'} • Roll No: {studentData?.roll_number || 'N/A'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={28} color="#bbb" />
          </View>
        </TouchableOpacity>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {childStats.map((stat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCardWrapper}
              onPress={stat.onPress}
              activeOpacity={0.7}
            >
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                subtitle={stat.subtitle}
              />
            </TouchableOpacity>
          ))}
          
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ParentViewHomework')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="library" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Homework</Text>
              <Text style={styles.actionSubtitle}>View assignments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.jumpTo('Attendance')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Attendance</Text>
              <Text style={styles.actionSubtitle}>View attendance details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.jumpTo('Marks')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="document-text" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Report Card</Text>
              <Text style={styles.actionSubtitle}>View marks & grades</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.jumpTo('Fees')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="card" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Fee Payment</Text>
              <Text style={styles.actionSubtitle}>Pay school fees</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.jumpTo('Chat')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E91E63' }]}>
                <Ionicons name="chatbubbles" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Chat</Text>
              <Text style={styles.actionSubtitle}>Contact teachers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ParentNotifications')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#607D8B' }]}>
                <Ionicons name="notifications" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Notifications</Text>
              <Text style={styles.actionSubtitle}>View all messages</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* This Week's Attendance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week's Attendance</Text>
            <TouchableOpacity onPress={() => setShowAttendanceModal(true)}>
              <Text style={styles.viewAllText}>View Details</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Attendance Analytics</Text>
            <CrossPlatformPieChart
              data={attendancePieData}
              width={350}
              height={180}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
            <View style={styles.chartSummary}>
              <Text style={styles.chartSummaryText}>
                Present: {attendanceStats.presentOnlyCount} days | Absent: {attendanceStats.absentCount} days
              </Text>
            </View>
          </View>
        </View>

        
        
        
        {/* Recent Marks */}
        {marks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Marks</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Marks')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.marksContainer}>
              {marks.slice(0, 3).map((mark, index) => (
                <View key={index} style={styles.markCard}>
                  <View style={styles.markHeader}>
                    <Text style={styles.markSubject}>{mark.subjects?.name || 'Subject'}</Text>
                    <View style={[
                      styles.markGrade,
                      { backgroundColor: (mark.marks_obtained / mark.max_marks) >= 0.9 ? '#4CAF50' :
                                        (mark.marks_obtained / mark.max_marks) >= 0.75 ? '#FF9800' : '#F44336' }
                    ]}>
                      <Text style={styles.markGradeText}>
                        {Math.round((mark.marks_obtained / mark.max_marks) * 100)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.markDetails}>
                    {mark.marks_obtained}/{mark.max_marks} marks
                  </Text>
                  <Text style={styles.markExam}>
                    {mark.exams?.name || 'Exam'} • {formatDateToDDMMYYYY(mark.exams?.start_date || mark.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}


        {/* Upcoming Exams */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Exams</Text>
            <TouchableOpacity onPress={() => setShowExamsModal(true)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={exams.slice(0, 4)}
            renderItem={renderExamCard}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => setShowEventsModal(true)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={events.slice(0, 4)}
            renderItem={renderEventItem}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

      </ScrollView>

      {/* Attendance Details Modal */}
      {showAttendanceModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>This Week's Attendance</Text>
              <TouchableOpacity onPress={() => setShowAttendanceModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 300 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              <View style={styles.attendanceTableHeader}>
                <Text style={styles.attendanceTableColHeader}>Date</Text>
                <Text style={styles.attendanceTableColHeader}>Day</Text>
                <Text style={styles.attendanceTableColHeader}>Status</Text>
              </View>
              {attendance.map((item, idx) => (
                <View key={idx} style={styles.attendanceTableRow}>
                  <Text style={styles.attendanceTableCol}>{formatDateToDDMMYYYY(item.date)}</Text>
                  <Text style={styles.attendanceTableCol}>{new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}</Text>
                  <Text style={[styles.attendanceTableCol, { color: item.status === 'present' ? '#4CAF50' : '#F44336', fontWeight: 'bold' }]}>{item.status}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Events Modal */}
      {showEventsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Upcoming Events</Text>
              <TouchableOpacity onPress={() => setShowEventsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 400 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {events.map((item, idx) => (
                <View key={idx} style={styles.modalEventItem}>
                  <View style={[styles.modalEventIcon, { backgroundColor: item.color || '#FF9800' }]}>
                    <Ionicons name={item.icon || 'calendar'} size={24} color="#fff" />
                  </View>
                  <View style={styles.modalEventInfo}>
                    <Text style={styles.modalEventTitle}>{item.title}</Text>
                    <Text style={styles.modalEventDetails}>{formatDateToDDMMYYYY(item.event_date)} • {item.event_time}</Text>
                    <Text style={styles.modalEventDescription}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Exams Modal */}
      {showExamsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Upcoming Exams</Text>
              <TouchableOpacity onPress={() => setShowExamsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 400 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {exams.map((item, idx) => (
                <View key={idx} style={styles.modalEventItem}>
                  <View style={[styles.modalEventIcon, { backgroundColor: '#9C27B0' }]}>
                    <Ionicons name="calendar" size={24} color="#fff" />
                  </View>
                  <View style={styles.modalEventInfo}>
                    <Text style={styles.modalEventTitle}>{item.subjects?.name || item.name || 'Exam'}</Text>
                    <Text style={styles.modalEventDetails}>{formatDateToDDMMYYYY(item.start_date)} • 09:00</Text>
                    <Text style={styles.modalEventDescription}>{item.remarks || 'Exam scheduled'}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 400 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {notifications.map((item, idx) => (
                <View key={idx} style={styles.notificationItem}>
                  {renderNotificationItem({ item, index: idx })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Quick Notifications Modal - Scrollable (Web-optimized) */}
      {showQuickNotificationsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Notifications</Text>
              <TouchableOpacity onPress={() => setShowQuickNotificationsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.notificationScrollContainer}>
              <ScrollView 
                style={styles.notificationScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
                contentContainerStyle={styles.notificationScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {notifications.length > 0 ? (
                  notifications.map((item, idx) => (
                    <View key={idx} style={[styles.notificationModalItem, { borderLeftWidth: 4, borderLeftColor: getNotificationColor(item.type) }]}>
                      <View style={styles.notificationIcon}>
                        <Ionicons name={getNotificationIcon(item.type)} size={20} color={getNotificationColor(item.type)} />
                      </View>
                      <View style={styles.notificationContent}>
                        <View style={styles.notificationHeader}>
                          <Text style={styles.notificationTitle}>{item.title}</Text>
                          {!item.is_read && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>NEW</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.notificationMessage}>{item.message}</Text>
                        <Text style={styles.notificationTime}>{formatDateToDDMMYYYY(item.created_at)}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyNotifications}>
                    <Ionicons name="notifications-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyNotificationsText}>No notifications yet</Text>
                    <Text style={styles.emptyNotificationsSubtext}>You'll see important updates here</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      )}

      {/* Student Details Modal */}
      {showStudentDetailsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Student Details</Text>
              <TouchableOpacity onPress={() => setShowStudentDetailsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={true}>
              <View style={{ alignItems: 'center', marginBottom: 18 }}>
                <Image source={studentImage} style={styles.studentAvatarLarge} />
              </View>
              {/* Basic Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Name:</Text><Text style={styles.detailsValue}>{studentData?.name || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Admission No:</Text><Text style={styles.detailsValue}>{studentData?.admission_number || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Roll No:</Text><Text style={styles.detailsValue}>{studentData?.roll_number || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Class:</Text><Text style={styles.detailsValue}>{studentData?.full_class_name || studentData?.class_name || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Academic Year:</Text><Text style={styles.detailsValue}>{studentData?.academic_year || 'N/A'}</Text></View>
              
              {/* Personal Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>DOB:</Text><Text style={styles.detailsValue}>{formatDateToDDMMYYYY(studentData?.date_of_birth) || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Gender:</Text><Text style={styles.detailsValue}>{studentData?.gender || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Blood Group:</Text><Text style={styles.detailsValue}>{studentData?.blood_group || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Aadhar No:</Text><Text style={styles.detailsValue}>{studentData?.aadhar_no || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Place of Birth:</Text><Text style={styles.detailsValue}>{studentData?.place_of_birth || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Nationality:</Text><Text style={styles.detailsValue}>{studentData?.nationality || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Religion:</Text><Text style={styles.detailsValue}>{studentData?.religion || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Caste:</Text><Text style={styles.detailsValue}>{studentData?.caste || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Mother Tongue:</Text><Text style={styles.detailsValue}>{studentData?.mother_tongue || 'N/A'}</Text></View>
              
              {/* Contact Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Address:</Text><Text style={styles.detailsValue}>{studentData?.address || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Pin Code:</Text><Text style={styles.detailsValue}>{studentData?.pin_code || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Mobile:</Text><Text style={styles.detailsValue}>{studentData?.phone || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Email:</Text><Text style={styles.detailsValue}>{studentData?.email || 'N/A'}</Text></View>
              
              {/* Family Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Father's Name:</Text><Text style={styles.detailsValue}>{studentData?.father_name || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Mother's Name:</Text><Text style={styles.detailsValue}>{studentData?.mother_name || 'N/A'}</Text></View>
              {studentData?.guardian_name && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Guardian Name:</Text><Text style={styles.detailsValue}>{studentData.guardian_name}</Text></View>
              )}
              {studentData?.parent_phone && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Parent Phone:</Text><Text style={styles.detailsValue}>{studentData.parent_phone}</Text></View>
              )}
              {studentData?.parent_email && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Parent Email:</Text><Text style={styles.detailsValue}>{studentData.parent_email}</Text></View>
              )}
              
              {/* Physical Characteristics */}
              {(studentData?.identification_mark_1 || studentData?.identification_mark_2) && (
                <>
                  {studentData?.identification_mark_1 && (
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>ID Mark 1:</Text><Text style={styles.detailsValue}>{studentData.identification_mark_1}</Text></View>
                  )}
                  {studentData?.identification_mark_2 && (
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>ID Mark 2:</Text><Text style={styles.detailsValue}>{studentData.identification_mark_2}</Text></View>
                  )}
                </>
              )}
              
              {/* Behavioral Information */}
              {studentData?.general_behaviour && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Behaviour:</Text><Text style={styles.detailsValue}>{studentData.general_behaviour}</Text></View>
              )}
              
              {/* Additional Notes */}
              {studentData?.remarks && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Remarks:</Text><Text style={styles.detailsValue}>{studentData.remarks}</Text></View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statCardWrapper: {
    width: '48%',
    height: 130, // Fixed height for uniform card sizes
    marginBottom: 12,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartSummary: {
    marginTop: 12,
    alignItems: 'center',
  },
  chartSummaryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  chart: {
    borderRadius: 12,
  },

  examItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  examIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  examInfo: {
    flex: 1,
  },
  examSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  examDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  examClass: {
    fontSize: 12,
    color: '#999',
  },
  examAction: {
    padding: 8,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  eventAction: {
    padding: 8,
  },
  modalEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalEventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modalEventInfo: {
    flex: 1,
  },
  modalEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modalEventDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalEventDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#ddd',
    backgroundColor: '#fff',
    marginBottom: 2,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  attendanceTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  attendanceTableColHeader: {
    flex: 1,
    fontWeight: 'bold',
    color: '#1976d2',
    fontSize: 15,
    textAlign: 'center',
  },
  attendanceTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attendanceTableCol: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  studentCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentCardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  studentCardClass: {
    fontSize: 15,
    color: '#888',
    marginTop: 2,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#eee',
  },
  studentAvatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  detailsLabel: {
    fontWeight: 'bold',
    color: '#1976d2',
    width: 120,
    fontSize: 15,
  },
  detailsValue: {
    flex: 1,
    color: '#333',
    fontSize: 15,
    marginLeft: 8,
    flexWrap: 'wrap',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Marks Section Styles
  marksContainer: {
    paddingHorizontal: 4,
  },
  markCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  markHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  markSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  markGrade: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  markGradeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  markDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  markExam: {
    fontSize: 12,
    color: '#999',
  },

  // Fee Section Styles
  feesContainer: {
    paddingHorizontal: 4,
  },
  feeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  feeStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  feeStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  feeDueDate: {
    fontSize: 12,
    color: '#999',
  },

  // Fee Distribution Styles (matching FeePayment component)
  feeDistributionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  feeDistributionCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  feeDistributionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  feeDistributionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feeDistributionSubtitle: {
    fontSize: 11,
    color: '#888',
  },
  feeProgressContainer: {
    marginTop: 8,
  },
  feeProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeProgressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  feeProgressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  feeProgressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  feeProgressFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },

  // Detailed Fee Structure Styles
  feeStructureContainer: {
    marginTop: 8,
  },
  feeStructureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  feeStructureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  feeComponentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  feeCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  feeNameContainer: {
    flex: 1,
  },
  feeComponentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  feeComponentCategory: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  feeStatusContainer: {
    alignItems: 'flex-end',
  },
  feeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  feeStatusBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  feeAmountDetails: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  feeAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeAmountLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  feeAmountValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  feeDueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  feeDueDateText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  feePaymentHistory: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  feePaymentHistoryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feePaymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 6,
  },
  feePaymentInfo: {
    flex: 1,
  },
  feePaymentAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  feePaymentDate: {
    fontSize: 12,
    color: '#666',
  },
  feePaymentMode: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewMorePaymentsButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  viewMorePaymentsText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  feeQuickPayButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  feeQuickPayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },

  // Welcome Section - AdminDashboard Style
  welcomeSection: {
    marginVertical: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -50,
    right: -30,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -20,
    left: -20,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(118, 75, 162, 0.6)',
  },
  welcomeContent: {
    padding: 24,
    zIndex: 1,
  },
  schoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  schoolLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  schoolType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  dateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Debug Section Styles
  debugContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  debugLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    marginTop: 5,
    fontStyle: 'italic',
  },

  // Web-optimized Notification Modal Styles
  notificationScrollContainer: {
    height: 450,
    maxHeight: 450,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  notificationScrollView: {
    flex: 1,
    height: '100%',
    maxHeight: 450,
  },
  notificationScrollContent: {
    paddingBottom: 20,
    paddingTop: 8,
    paddingHorizontal: 4,
    minHeight: 450,
  },
  notificationModalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  unreadBadge: {
    backgroundColor: '#FF5722',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    elevation: 1,
  },
  unreadBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyNotificationsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyNotificationsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Notification read/unread indicator styles
  unreadIndicator: {
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5722',
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  readStatus: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default ParentDashboard;
