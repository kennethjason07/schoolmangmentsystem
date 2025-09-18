import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  FlatList,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import LogoDisplay from '../../components/LogoDisplay';
import NoSchoolDetailsState from '../../components/NoSchoolDetailsState';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import CrossPlatformBarChart from '../../components/CrossPlatformBarChart';
import { supabase, dbHelpers } from '../../utils/supabase';
import { format, addMonths } from 'date-fns';
import { getEventDisplayProps } from '../../utils/eventIcons';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../styles/webScrollFix';
import { useUniversalNotificationCount } from '../../hooks/useUniversalNotificationCount';
import useNavigateWithStatePreservation from '../../components/ui/SafeNavigate';

const { width } = Dimensions.get('window');

// Date formatting helper functions
const formatDateToDisplay = (dateString) => {
  // Convert YYYY-MM-DD to DD-MM-YYYY for display
  if (!dateString || typeof dateString !== 'string') return '';
  
  // Validate YYYY-MM-DD format
  if (!dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
  
  const [year, month, day] = dateString.split('-');
  
  // Basic validation
  if (!year || !month || !day || year.length !== 4 || month.length !== 2 || day.length !== 2) {
    return dateString;
  }
  
  return `${day}-${month}-${year}`;
};

const formatDateToStorage = (dateString) => {
  // Convert DD-MM-YYYY to YYYY-MM-DD for storage
  if (!dateString || typeof dateString !== 'string') return '';
  
  // Validate DD-MM-YYYY format
  if (!dateString.match(/^\d{2}-\d{2}-\d{4}$/)) return dateString;
  
  const [day, month, year] = dateString.split('-');
  
  // Basic validation
  if (!year || !month || !day || year.length !== 4 || month.length !== 2 || day.length !== 2) {
    return dateString;
  }
  
  return `${year}-${month}-${day}`;
};

const getCurrentDateString = () => {
  // Return current date in YYYY-MM-DD format
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentDateDisplayString = () => {
  // Return current date in DD-MM-YYYY format
  return formatDateToDisplay(getCurrentDateString());
};

const AdminDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schoolDetails, setSchoolDetails] = useState(null);

  // Safe navigation hook to prevent state loss
  const navigateSafely = useNavigateWithStatePreservation();

  // Component rendered

  // Load real-time data from Supabase using actual schema
  const loadDashboardData = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // 🚀 FIXED: Enhanced auth and tenant validation for web refresh
      console.log('🔄 [AdminDashboard] Starting data load, retry count:', retryCount);
      console.log('🔄 [AdminDashboard] User state:', { 
        hasUser: !!user, 
        userId: user?.id, 
        userEmail: user?.email,
        platform: Platform.OS
      });
      
      // Wait for user authentication to be ready
      if (!user || !user.id || !user.email) {
        console.warn('⚠️ [AdminDashboard] User not ready, delaying load...');
        
        if (retryCount < 3) {
          // Retry after a short delay
          setTimeout(() => {
            console.log('🔄 [AdminDashboard] Retrying dashboard load...');
            loadDashboardData(retryCount + 1);
          }, 1000 * (retryCount + 1)); // Progressive delay
          return;
        } else {
          throw new Error('User authentication not ready. Please refresh the page or log in again.');
        }
      }
      
      // Get current tenant for proper filtering with enhanced error handling
      console.log('🏢 [AdminDashboard] Attempting to get tenant for user:', user.email);
      
      let tenantResult;
      try {
        tenantResult = await getCurrentUserTenantByEmail();
      } catch (tenantError) {
        console.error('❌ [AdminDashboard] Tenant lookup error:', tenantError);
        throw new Error(`Failed to resolve tenant context: ${tenantError.message}. Please ensure you're logged in with the correct account.`);
      }
      
      if (!tenantResult || !tenantResult.success) {
        console.error('❌ [AdminDashboard] Tenant resolution failed:', tenantResult?.error);
        throw new Error(`Failed to get tenant: ${tenantResult?.error || 'Unknown tenant error'}. Please check your account setup.`);
      }
      
      if (!tenantResult.data?.tenant?.id) {
        console.error('❌ [AdminDashboard] Invalid tenant data:', tenantResult.data);
        throw new Error('Invalid tenant data received. Please contact support.');
      }
      
      const tenantId = tenantResult.data.tenant.id;
      const tenantName = tenantResult.data.tenant.name;
      console.log('✅ [AdminDashboard] Successfully resolved tenant:', { 
        tenantId, 
        tenantName,
        userEmail: user.email 
      });

      // Load school details
      const { data: schoolData, error: schoolError } = await dbHelpers.getSchoolDetails();
      setSchoolDetails(schoolData);

      // Load students count with gender breakdown
      const { data: studentsData, error: studentError, count: studentCount } = await supabase
        .from('students')
        .select('id, gender', { count: 'exact' })
        .eq('tenant_id', tenantId);

      if (studentError) {
        console.error('Error loading students:', studentError);
      }

      // Load teachers count with improved error handling
      let teacherCount = 0;
      try {
        const { data: teachersData, error: teacherError, count } = await supabase
          .from('teachers')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId);

        if (teacherError) {
          console.error('Error loading teachers:', teacherError);
          // If RLS is blocking access due to JWT issues, set count to 0
          if (teacherError.message?.includes('permission denied') || 
              teacherError.message?.includes('access denied') ||
              teacherError.message?.includes('tenant')) {
            console.log('💡 Teacher count blocked by RLS - user may need to re-authenticate');
            teacherCount = 0;
          } else {
            // For other errors, also default to 0 but log the issue
            console.error('🔍 Unexpected teacher query error:', teacherError);
            teacherCount = 0;
          }
        } else {
          teacherCount = count || 0;
        }
      } catch (teacherErr) {
        console.error('💥 Critical error loading teachers:', teacherErr);
        teacherCount = 0;
      }

      // Load today's student attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: studentAttendance, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('id, status')
        .eq('date', today)
        .eq('tenant_id', tenantId);

      if (attendanceError) {
        console.error('Error loading attendance:', attendanceError);
      }

      // Load classes count
      const { data: classesData, error: classesError, count: classesCount } = await supabase
        .from('classes')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId);

      if (classesError) {
        console.error('Error loading classes:', classesError);
      }

      // Load fee collection data for current month
      const now = new Date();
      const currentMonth = format(now, 'yyyy-MM');
      const nextMonth = format(addMonths(now, 1), 'yyyy-MM');
      const { data: feeData, error: feeError } = await supabase
        .from('student_fees')
        .select('amount_paid')
        .eq('tenant_id', tenantId)
        .gte('payment_date', `${currentMonth}-01`)
        .lt('payment_date', `${nextMonth}-01`);

      if (feeError) {
        console.error('Error loading fees:', feeError);
      }

      // Calculate statistics
      const totalStudents = studentCount || 0;
      const totalTeachers = teacherCount || 0;
      const totalClasses = classesCount || 0;

      // Calculate attendance percentage
      const presentToday = studentAttendance?.filter(att => att.status === 'Present').length || 0;
      const attendancePercentage = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

      // Calculate fee collection for current month
      const monthlyFeeCollection = feeData?.reduce((sum, fee) => sum + (fee.amount_paid || 0), 0) || 0;

      // Update stats
      setStats([
        {
          title: 'Total Students',
          value: totalStudents.toLocaleString(),
          icon: 'people',
          color: '#2196F3',
          subtitle: `${studentsData?.filter(s => s.gender === 'Male').length || 0} Male, ${studentsData?.filter(s => s.gender === 'Female').length || 0} Female`,
          trend: 0
        },
        {
          title: 'Total Teachers',
          value: totalTeachers.toString(),
          icon: 'person',
          color: '#4CAF50',
          subtitle: `${totalClasses} Classes`,
          trend: 0
        },
        {
          title: 'Attendance Today',
          value: `${attendancePercentage}%`,
          icon: 'checkmark-circle',
          color: '#FF9800',
          subtitle: `${presentToday} of ${totalStudents} present`,
          trend: 0
        },
        {
          title: 'Monthly Fees',
          value: `₹${(monthlyFeeCollection / 100000).toFixed(1)}L`,
          icon: 'card',
          color: '#9C27B0',
          subtitle: `Collected this month`,
          trend: 0
        }
      ]);


      // Load upcoming events from events table only
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('event_date', format(new Date(), 'yyyy-MM-dd'))
        .order('event_date', { ascending: true })
        .limit(10);

      if (eventsData && !eventsError) {
        setEvents(eventsData.map(event => {
          const { icon, color } = getEventDisplayProps(event.event_type || 'Event', event.title || '');
          return {
            id: event.id,
            type: event.event_type || 'Event',
            title: event.title,
            date: formatDateToDisplay(event.event_date), // Convert YYYY-MM-DD to DD-MM-YYYY for display
            icon: icon,
            color: color
          };
        }));
      } else if (eventsError && eventsError.code !== '42P01') {
        console.error('Error loading events:', eventsError);
        // Set empty events array if there's an error or no events
        setEvents([]);
      } else {
        // Set empty events array if events table doesn't exist
        setEvents([]);
      }

      // Load recent activities from various sources
      const recentActivities = [];

      // Recent student registrations
      const { data: recentStudents, error: studentsActivityError } = await supabase
        .from('students')
        .select('name, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentStudents && !studentsActivityError) {
        recentStudents.forEach(student => {
          recentActivities.push({
            text: `New student registered: ${student.name}`,
            time: format(new Date(student.created_at), 'PPp'),
            icon: 'person-add'
          });
        });
      }

      // Recent fee payments
      const { data: recentFees, error: feesActivityError } = await supabase
        .from('student_fees')
        .select('amount_paid, payment_date, students(name)')
        .eq('tenant_id', tenantId)
        .order('payment_date', { ascending: false })
        .limit(3);

      if (recentFees && !feesActivityError) {
        recentFees.forEach(fee => {
          recentActivities.push({
            text: `Fee payment received: ₹${fee.amount_paid} from ${fee.students?.name}`,
            time: format(new Date(fee.payment_date), 'PPp'),
            icon: 'card'
          });
        });
      }

      // Sort activities by time and take latest 5
      recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
      setActivities(recentActivities.slice(0, 5));

    } catch (error) {
      console.error('🏠 [AdminDashboard] Error loading dashboard data:', error);
      
      // 🚀 FIXED: Enhanced error handling with specific error types
      let errorMessage = 'Failed to load dashboard data';
      let shouldRetry = false;
      
      if (error.message.includes('User authentication not ready')) {
        errorMessage = 'Authentication is loading. Please wait...';
        shouldRetry = true;
      } else if (error.message.includes('Failed to resolve tenant')) {
        errorMessage = 'Unable to determine your school context. Please log out and log back in.';
      } else if (error.message.includes('Failed to get tenant')) {
        errorMessage = 'School context error. Please verify your account is properly configured.';
      } else if (error.message.includes('JWT') || error.message.includes('session')) {
        errorMessage = 'Session expired. Please refresh the page or log in again.';
        shouldRetry = true;
      } else if (error.message.includes('permission denied') || error.message.includes('RLS')) {
        errorMessage = 'Database permission error. Please refresh the page or contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your internet and try again.';
        shouldRetry = true;
      } else {
        // Use the original error message if it's descriptive
        errorMessage = error.message.length > 10 ? error.message : 'Failed to load dashboard data';
      }
      
      setError(errorMessage);
      console.log('🏠 [AdminDashboard] Set error state:', errorMessage);
      
      // Auto-retry for certain error types on web
      if (shouldRetry && Platform.OS === 'web' && retryCount < 2) {
        console.log('🔄 [AdminDashboard] Auto-retrying due to recoverable error...');
        setTimeout(() => {
          loadDashboardData(retryCount + 1);
        }, 2000);
        return;
      }
    } finally {
      setLoading(false);
      console.log('🏠 [AdminDashboard] Set loading to false');
    }
  };

  useEffect(() => {
    // 🚀 FIXED: Wait for user authentication before loading dashboard
    console.log('🔄 [AdminDashboard] useEffect triggered, user state:', { 
      hasUser: !!user, 
      userId: user?.id,
      userEmail: user?.email 
    });
    
    // Don't initialize dashboard if user isn't ready
    if (!user || !user.id || !user.email) {
      console.log('⚠️ [AdminDashboard] User not ready, skipping dashboard initialization');
      return;
    }
    
    const initializeDashboard = async () => {
      console.log('🚀 [AdminDashboard] Initializing dashboard for user:', user.email);
      try {
        await Promise.all([
          loadDashboardData(),
          loadChartData()
        ]);
        console.log('✅ [AdminDashboard] Dashboard initialization completed');
      } catch (error) {
        console.error('❌ [AdminDashboard] Dashboard initialization failed:', error);
      }
    };

    initializeDashboard();

    // Subscribe to Supabase real-time updates for multiple tables
    console.log('🔌 [AdminDashboard] Setting up real-time subscriptions');
    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students'
      }, () => {
        console.log('🔄 [AdminDashboard] Students table changed, refreshing dashboard');
        loadDashboardData();
        loadChartData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_attendance'
      }, () => {
        console.log('🔄 [AdminDashboard] Student attendance changed, refreshing dashboard');
        loadDashboardData();
        loadChartData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_fees'
      }, () => {
        console.log('🔄 [AdminDashboard] Student fees changed, refreshing dashboard');
        loadDashboardData();
        loadChartData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exams'
      }, () => {
        console.log('🔄 [AdminDashboard] Exams changed, refreshing dashboard');
        loadDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        console.log('🔄 [AdminDashboard] Events changed, refreshing dashboard');
        loadDashboardData();
      })
      .subscribe();

    return () => {
      console.log('🧽 [AdminDashboard] Cleaning up real-time subscriptions');
      subscription.unsubscribe();
    };
  }, [user?.id, user?.email]); // 🚀 FIXED: Added proper dependencies


  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadChartData()
      ]);
      // Universal notification system automatically handles refresh
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const quickActions = [
    { title: 'School Details', icon: 'business', color: '#673AB7', screen: 'SchoolDetails' }, // Stack screen
    { title: 'Manage Teachers', icon: 'person', color: '#FF9800', screen: 'Teachers' }, // Tab name
    { title: 'Teacher Accounts', icon: 'person-add', color: '#3F51B5', screen: 'TeacherAccountManagement' }, // Stack screen
    { title: 'Student Accounts', icon: 'people-circle', color: '#8BC34A', screen: 'StudentAccountManagement' }, // Stack screen
    { title: 'Parent Accounts', icon: 'people', color: '#9C27B0', screen: 'ParentAccountManagement' }, // Stack screen
    { title: 'Leave Management', icon: 'calendar-outline', color: '#4CAF50', screen: 'LeaveManagement' }, // Stack screen
    { title: 'Subjects Timetable', icon: 'calendar', color: '#607D8B', screen: 'SubjectsTimetable' }, // Stack screen
    { title: 'Attendance', icon: 'checkmark-circle', color: '#009688', screen: 'AttendanceManagement' }, // Stack screen
    { title: 'Fee Management', icon: 'card', color: '#9C27B0', screen: 'FeeManagement' }, // Stack screen
    { title: 'Stationary Management', icon: 'cube-outline', color: '#FF5722', screen: 'StationaryManagement' }, // Stack screen
    { title: 'Expense Management', icon: 'wallet', color: '#F44336', screen: 'ExpenseManagement' }, // Stack screen
    { title: 'Exams & Marks', icon: 'document-text', color: '#795548', screen: 'ExamsMarks' }, // Stack screen
    { title: 'Report Cards', icon: 'document-text', color: '#E91E63', screen: 'ReportCardGeneration' }, // Stack screen
    { title: 'Notifications', icon: 'notifications', color: '#FF5722', screen: 'NotificationManagement' }, // Stack screen
    { title: 'Hall Tickets', icon: 'card-outline', color: '#00BCD4', screen: 'HallTicketGeneration', banner: 'UPCOMING' }, // Stack screen
    { title: 'Auto Grading', icon: 'checkmark-done', color: '#4CAF50', screen: 'AutoGrading', banner: 'UPCOMING' }, // Stack screen
  ];

  // State for chart data (only fee collection data now)

  const [feeCollectionData, setFeeCollectionData] = useState([
    { name: 'Collected', population: 0, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 14 },
    { name: 'Due', population: 0, color: '#F44336', legendFontColor: '#333', legendFontSize: 14 },
  ]);

  // Load chart data
  const loadChartData = async () => {
    try {
      // 🚀 FIXED: Enhanced tenant validation for chart data
      if (!user || !user.id || !user.email) {
        console.warn('⚠️ [AdminDashboard] User not ready for chart data load');
        return;
      }
      
      // Get current tenant for proper filtering
      console.log('📈 [AdminDashboard] Loading chart data for user:', user.email);
      
      let tenantResult;
      try {
        tenantResult = await getCurrentUserTenantByEmail();
      } catch (tenantError) {
        console.error('❌ [AdminDashboard] Chart data tenant lookup error:', tenantError);
        return; // Fail silently for chart data
      }
      
      if (!tenantResult || !tenantResult.success) {
        console.error('❌ [AdminDashboard] Failed to get tenant for chart data:', tenantResult?.error);
        return; // Fail silently for chart data
      }
      
      const tenantId = tenantResult.data.tenant.id;
      console.log('✅ [AdminDashboard] Loading chart data for tenant:', tenantResult.data.tenant.name);
      
      // Load fee collection data
      const currentMonth = format(new Date(), 'yyyy-MM');
      const { data: feeData } = await supabase
        .from('student_fees')
        .select('amount_paid')
        .eq('tenant_id', tenantId)
        .gte('payment_date', `${currentMonth}-01`);

      const { data: feeStructureData } = await supabase
        .from('fee_structure')
        .select('amount')
        .eq('tenant_id', tenantId);

      const collected = feeData?.reduce((sum, fee) => sum + (fee.amount_paid || 0), 0) || 0;
      const totalDue = feeStructureData?.reduce((sum, fee) => sum + (fee.amount || 0), 0) || 0;
      const due = Math.max(0, totalDue - collected);

      setFeeCollectionData([
        { name: 'Collected', population: collected, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 14 },
        { name: 'Due', population: due, color: '#F44336', legendFontColor: '#333', legendFontSize: 14 },
      ]);

    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#2196F3',
    },
    propsForLabels: {
      fontSize: 12,
      fontWeight: '600',
    }
  };

  const [feeLoading, setFeeLoading] = useState(false);

  // Date picker state for Events
  const [showEventDatePicker, setShowEventDatePicker] = useState(false);
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);


  // Upcoming Events state - Initialize with empty array, load from database
  const [events, setEvents] = useState([]);
  const [isEventModalVisible, setIsEventModalVisible] = useState(false);
  // Upcoming Events Popup state
  const [showUpcomingEventsPopup, setShowUpcomingEventsPopup] = useState(false);
  const [hasShownPopupThisSession, setHasShownPopupThisSession] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [eventInput, setEventInput] = useState({ 
    type: 'Event', 
    title: '', 
    description: '',
    date: '', 
    icon: 'calendar', 
    color: '#FF9800',
    isSchoolWide: true,
    selectedClasses: []
  });
  
  // Debug eventInput changes (simplified)
  useEffect(() => {
    if (eventInput.date) {
      console.log('📅 Event date set to:', eventInput.date);
    }
  }, [eventInput.date]);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editEventIndex, setEditEventIndex] = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      
      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        console.error('Failed to get tenant for classes:', tenantResult.error);
        return;
      }
      
      const tenantId = tenantResult.data.tenant.id;
      
      const { data: classesData, error } = await supabase
        .from('classes')
        .select('id, class_name, section')
        .eq('tenant_id', tenantId)
        .order('class_name', { ascending: true })
        .order('section', { ascending: true });

      if (error) {
        console.error('Error loading classes:', error);
        return;
      }

      setAllClasses(classesData || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Helper function removed - using global getCurrentDateString instead

  // Function to ensure events table exists with proper schema
  const checkEventsTable = async () => {
    try {
      console.log('🔥 Checking events table existence...');
      
      // Just try to select from the table - if it fails, we'll know the table doesn't exist
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') {
        console.log('🔥 Events table does not exist. Table should be created via migration or Supabase dashboard.');
        console.log('🔥 Expected table schema:');
        console.log('🔥 - id: UUID (primary key)');
        console.log('🔥 - title: text');
        console.log('🔥 - description: text');
        console.log('🔥 - event_date: date');
        console.log('🔥 - event_type: text');
        console.log('🔥 - is_school_wide: boolean');
        console.log('🔥 - status: text');
        console.log('🔥 - created_at: timestamp');
        console.log('🔥 - updated_at: timestamp');
        return false;
      }
      
      if (error) {
        console.error('🔥 Error checking events table:', error);
        console.error('🔥 Error details:', { code: error.code, message: error.message, details: error.details });
        return false;
      }
      
      console.log('🔥 Events table exists and is accessible');
      return true;
    } catch (error) {
      console.error('🔥 Error checking events table:', error);
      return false;
    }
  };

  const openAddEventModal = async () => {
    console.log('🔧 === OPENING ADD EVENT MODAL ===');
    console.log('🔧 Current isEventModalVisible state:', isEventModalVisible);
    console.log('🔧 Current showUpcomingEventsPopup state:', showUpcomingEventsPopup);
    console.log('🔧 Current eventInput state:', eventInput);
    
    // Prevent multiple modal opens and avoid resetting eventInput if modal is already open
    if (isEventModalVisible) {
      console.log('🔧 Modal is already open, skipping reset');
      return;
    }
    
    try {
      // Close the upcoming events popup if it's open to prevent conflicts
      if (showUpcomingEventsPopup) {
        console.log('🔧 Closing upcoming events popup to prevent conflicts');
        setShowUpcomingEventsPopup(false);
        // Add a small delay to ensure the popup closes before opening the add modal
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Check if events table exists first with better error handling
      const tableExists = await checkEventsTable();
      if (!tableExists) {
        console.log('🔧 Events table does not exist, showing fallback modal');
        // Show a simple fallback modal for adding events without database
        Alert.alert(
          'Events Feature', 
          'The events database table is not set up yet. Please contact your system administrator to enable the events feature.',
          [
            { text: 'OK' },
            { 
              text: 'Continue Anyway', 
              onPress: () => {
                // Allow modal to open anyway for testing
                setEventInput({
                  type: 'Event', 
                  title: '', 
                  description: '',
                  date: getCurrentDateDisplayString(),
                  icon: 'calendar', 
                  color: '#FF9800',
                  isSchoolWide: true,
                  selectedClasses: []
                });
                setEditEventIndex(null);
                loadClasses();
                setIsEventModalVisible(true);
              }
            }
          ]
        );
        return;
      }
      
      // Only reset eventInput if this is a fresh modal open (not already open)
      const newEventInput = { 
        type: 'Event', 
        title: '', 
        description: '',
        date: getCurrentDateDisplayString(), // Use DD-MM-YYYY format for display
        icon: 'calendar', 
        color: '#FF9800',
        isSchoolWide: true,
        selectedClasses: [] 
      };
      console.log('🔧 Setting new event input:', newEventInput);
      setEventInput(newEventInput);
      
      setEditEventIndex(null);
      console.log('🔧 Reset edit index to null');
      
      console.log('🔧 Loading classes...');
      loadClasses(); // Load classes when opening modal
      
      console.log('🔧 Setting modal visibility to true');
      setIsEventModalVisible(true);
      
      // Verify state was set
      setTimeout(() => {
        console.log('🔧 Modal visibility after timeout:', isEventModalVisible);
      }, 100);
      
      console.log('🔧 === ADD EVENT MODAL OPEN COMPLETE ===');
    } catch (error) {
      console.error('🔧 Error opening add event modal:', error);
      Alert.alert('Error', 'Failed to open event creation form. Please try again.');
    }
  };

  const openEditEventModal = (item, idx) => {
    // Convert date from YYYY-MM-DD (storage) to DD-MM-YYYY (display) for editing
    const editableItem = { ...item };
    if (editableItem.date && editableItem.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      editableItem.date = formatDateToDisplay(editableItem.date);
    }
    
    setEventInput(editableItem);
    setEditEventIndex(idx);
    setIsEventModalVisible(true);
  };


  const saveEvent = async () => {
    console.log('🔥 SaveEvent called');
    console.log('🔥 Event input data:', eventInput);
    console.log('🔥 Title:', eventInput.title);
    console.log('🔥 Date:', eventInput.date);
    console.log('🔥 Type:', eventInput.type);
    console.log('🔥 Description:', eventInput.description);
    console.log('🔥 Edit index:', editEventIndex);
    
    // Prevent double-clicking
    if (savingEvent) {
      console.log('🔥 Already saving event, ignoring request');
      return;
    }
    
    // Improved validation
    if (!eventInput.title.trim()) {
      console.log('🔥 Validation failed - missing title');
      Alert.alert('Error', 'Please enter an event title.');
      return;
    }
    
    if (!eventInput.date) {
      console.log('🔥 Validation failed - missing date');
      Alert.alert('Error', 'Please select an event date.');
      return;
    }

    try {
      setSavingEvent(true);
      console.log('🔥 Starting save operation...');
      
      // Convert date from DD-MM-YYYY display format to YYYY-MM-DD storage format
      let formattedDate = eventInput.date;
      
      // Check if date is in DD-MM-YYYY format (our display format)
      if (typeof eventInput.date === 'string' && eventInput.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
        console.log('🔥 Converting DD-MM-YYYY to YYYY-MM-DD format');
        formattedDate = formatDateToStorage(eventInput.date);
        console.log('🔥 Converted date from', eventInput.date, 'to', formattedDate);
      } else if (typeof eventInput.date === 'string' && !eventInput.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try to parse other date formats as fallback
        const dateObj = new Date(eventInput.date);
        if (!isNaN(dateObj.getTime())) {
          // Date is valid, format it
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
          console.log('🔥 Fallback reformatted date:', formattedDate);
        }
      }
      
      // Additional validation for date format
      if (!formattedDate || formattedDate === '') {
        console.log('🔥 No date provided, using current date');
        formattedDate = getCurrentDateString(); // This should be YYYY-MM-DD for database storage
      }
      
      console.log('🔥 Final formatted date:', formattedDate);
      
      // Check if events table exists before attempting to save
      let tableExists = false;
      try {
        tableExists = await checkEventsTable();
        console.log('🔥 Table exists check result:', tableExists);
      } catch (tableCheckError) {
        console.error('🔥 Error checking table:', tableCheckError);
        // Continue with save attempt even if table check fails
        tableExists = true;
      }
      
      if (!tableExists) {
        console.log('🔥 Events table does not exist, showing warning and saving locally');
        
        // Save event locally for now
        const localEvent = {
          id: Date.now().toString(),
          title: eventInput.title.trim(),
          type: eventInput.type || 'Event',
          date: formattedDate,
          description: eventInput.description?.trim() || '',
          color: eventInput.color || '#FF9800',
          icon: eventInput.icon || 'calendar'
        };
        
        // Add to local events array
        setEvents(currentEvents => [...currentEvents, localEvent]);
        
        setIsEventModalVisible(false);
        setShowEventTypePicker(false);
        Alert.alert(
          'Event Added Locally', 
          'The event has been added to your local list. To save permanently, please set up the events database table.\n\nEvent: "' + eventInput.title + '"',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Get tenant ID and current user for multi-tenant support
      let tenantId = null;
      let currentUser = null;
      try {
        const userResponse = await supabase.auth.getUser();
        currentUser = userResponse;
        
        // Try multiple sources for tenant_id
        tenantId = currentUser?.data?.user?.app_metadata?.tenant_id || 
                   currentUser?.data?.user?.user_metadata?.tenant_id;
        
        // If no tenant_id found, try to get from users table or create default
        if (!tenantId && currentUser?.data?.user?.id) {
          console.log('🔥 No tenant_id in metadata, trying users table...');
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('tenant_id')
              .eq('id', currentUser.data.user.id)
              .single();
            
            if (userData?.tenant_id) {
              tenantId = userData.tenant_id;
              console.log('🔥 Found tenant_id in users table:', tenantId);
            }
          } catch (userTableError) {
            console.log('🔥 Could not get tenant_id from users table:', userTableError.message);
          }
        }
        
        // Final fallback: create a default tenant_id if still none found
        if (!tenantId) {
          tenantId = 'default-tenant'; // Use a default tenant ID
          console.log('🔥 Using default tenant_id:', tenantId);
        }
        
        console.log('🔥 Final tenant_id:', tenantId);
        console.log('🔥 Current user ID:', currentUser?.data?.user?.id);
      } catch (tenantError) {
        console.error('🔥 Error getting tenant/user info:', tenantError);
        // Use default tenant as final fallback
        tenantId = 'default-tenant';
      }
      
      // Basic event data to insert/update
      const eventData = {
        title: eventInput.title.trim(),
        description: eventInput.description?.trim() || '',
        event_date: formattedDate,
        event_type: eventInput.type || 'Event',
        is_school_wide: eventInput.isSchoolWide || true,
        status: 'Active'
      };
      
      // Always add tenant_id (required by database constraint)
      eventData.tenant_id = tenantId;
      
      // Add created_by if available and valid
      if (currentUser?.data?.user?.id) {
        try {
          // Check if the user exists in the users table before adding created_by
          const { data: userExists, error: userCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('id', currentUser.data.user.id)
            .single();
          
          if (userExists && !userCheckError) {
            eventData.created_by = currentUser.data.user.id;
            console.log('🔥 Added created_by field with valid user ID:', currentUser.data.user.id);
          } else {
            console.log('🔥 User ID not found in users table, skipping created_by field');
            // Don't add created_by if user doesn't exist in users table
          }
        } catch (userValidationError) {
          console.log('🔥 Error validating user for created_by field:', userValidationError.message);
          // Skip created_by field if there's an error validating the user
        }
      } else {
        console.log('🔥 No current user ID available, skipping created_by field');
      }
      
      console.log('🔥 Prepared event data:', eventData);
      
      if (editEventIndex !== null && events[editEventIndex]?.id) {
        console.log('🔥 Updating existing event with ID:', events[editEventIndex].id);
        // Add updated timestamp for updates
        const updateData = {
          ...eventData,
          updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
          .from('events')
          .update(updateData)
          .eq('id', events[editEventIndex].id)
          .select();

        if (error) {
          console.log('🔥 Update error:', error);
          console.log('🔥 Update error details:', { code: error.code, message: error.message, details: error.details });
          throw new Error(`Failed to update event: ${error.message}`);
        }
        console.log('🔥 Event updated successfully:', data);
      } else {
        console.log('🔥 Inserting new event');
        
        const { data, error } = await supabase
          .from('events')
          .insert(eventData)
          .select();

        if (error) {
          console.log('🔥 Insert error:', error);
          console.log('🔥 Insert error details:', { code: error.code, message: error.message, details: error.details });
          
          // Provide more specific error messages
          let errorMessage = 'Failed to create event';
          if (error.code === '23505') {
            errorMessage = 'An event with similar details already exists';
          } else if (error.code === '42703') {
            errorMessage = 'Database column error - please contact support';
          } else if (error.code === '42501' || error.message?.includes('row-level security')) {
            errorMessage = 'Permission denied: You do not have permission to create events. Please contact your administrator to set up proper user roles and database policies.';
          } else if (error.code === '23502') {
            errorMessage = 'Missing required field - please check tenant_id setup';
          } else if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
            if (error.message?.includes('created_by_fkey')) {
              errorMessage = 'User account error: Your user account is not properly set up in the system. Please contact your administrator to resolve this issue.';
            } else {
              errorMessage = 'Database relationship error - please contact support';
            }
          } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
          }
          
          throw new Error(errorMessage);
        }
        console.log('🔥 Event inserted successfully:', data);
      }

      console.log('🔥 Reloading dashboard data...');
      // Force load data to refresh events list
      await loadDashboardData();
      console.log('🔥 Dashboard data reloaded');
      
      // Close modal and show success message
      setIsEventModalVisible(false);
      console.log('🔥 Modal closed');
      
      // Show success message with event details
      const eventAction = editEventIndex !== null ? 'updated' : 'created';
      Alert.alert(
        'Success', 
        `Event "${eventInput.title}" has been ${eventAction} successfully!`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('🔥 Error saving event:', error);
      console.error('🔥 Error type:', typeof error);
      console.error('🔥 Error constructor:', error.constructor?.name);
      console.error('🔥 Error message:', error.message);
      console.error('🔥 Error stack:', error.stack);
      
      // Try to get more error details
      let errorDetails = 'Unknown error';
      try {
        errorDetails = JSON.stringify(error, null, 2);
      } catch (stringifyError) {
        errorDetails = error.toString();
      }
      console.error('🔥 Error details:', errorDetails);
      
      // Show user-friendly error message
      let errorMessage = 'An unexpected error occurred while saving the event';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Add local save option as fallback
      Alert.alert(
        'Save Failed', 
        errorMessage + '\n\nWould you like to save this event locally instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Save Locally',
            onPress: () => {
              try {
                const localEvent = {
                  id: Date.now().toString(),
                  title: eventInput.title.trim(),
                  type: eventInput.type || 'Event',
                  date: eventInput.date || getCurrentDateDisplayString(),
                  description: eventInput.description?.trim() || '',
                  color: eventInput.color || '#FF9800',
                  icon: eventInput.icon || 'calendar'
                };
                
                setEvents(currentEvents => [...currentEvents, localEvent]);
                setIsEventModalVisible(false);
                setShowEventTypePicker(false);
                
                Alert.alert(
                  'Event Saved Locally',
                  'Your event has been saved to the local list.',
                  [{ text: 'OK' }]
                );
              } catch (localSaveError) {
                console.error('🔥 Error saving locally:', localSaveError);
                Alert.alert('Error', 'Failed to save event even locally.');
              }
            }
          }
        ]
      );
    } finally {
      setSavingEvent(false);
      console.log('🔥 Save event operation completed');
    }
  };

  const deleteEvent = (id) => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

          if (error) throw error;
          await loadDashboardData();
          Alert.alert('Success', 'Event deleted successfully!');
        } catch (error) {
          console.error('Error deleting event:', error);
          Alert.alert('Error', 'Failed to delete event');
        }
      }},
    ]);
  };

  // Recent Activities state
  const [activities, setActivities] = useState([
    { text: 'New student registered: John Doe (Class 3A)', time: '2 hours ago', icon: 'person-add' },
    { text: 'Fee payment received: ₹15,000 from Class 5B', time: '4 hours ago', icon: 'card' },
    { text: 'Attendance marked for Class 2A (95% present)', time: '6 hours ago', icon: 'checkmark-circle' },
    { text: 'Exam scheduled: Mathematics for Class 4A', time: '1 day ago', icon: 'calendar' },
  ]);

  // Use universal notification system for consistent, real-time badge updates
  const { totalCount, notificationCount, messageCount } = useUniversalNotificationCount({
    autoRefresh: true,
    realTime: true,
    onCountChange: (counts) => {
      console.log('🔔 [AdminDashboard] Notification counts updated:', counts);
    }
  });
  
  // Use the total count for admin badge (includes messages + notifications)
  const unreadCount = totalCount;
  
  // Debug the notification count only when needed
  // console.log('📱 AdminDashboard - Universal notification count debug:', {
  //   totalCount,
  //   notificationCount,
  //   messageCount,
  //   userId: user?.id
  // });

  // Show upcoming events popup after dashboard loads
  useEffect(() => {
    const showPopupAfterDelay = () => {
      // Only show if:
      // 1. User is logged in
      // 2. Dashboard has finished loading
      // 3. Haven't shown popup this session
      // 4. There are upcoming events to show
      // 5. Add event modal is not already open
      // 6. User hasn't interacted with the dashboard yet
      if (user?.id && !loading && !hasShownPopupThisSession && events.length > 0 && !isEventModalVisible && !userHasInteracted) {
        // Show upcoming events popup
        setTimeout(() => {
          // Double check that add event modal is still not open before showing popup
          if (!isEventModalVisible) {
            setShowUpcomingEventsPopup(true);
            setHasShownPopupThisSession(true);
          }
        }, 2000); // 2 second delay after dashboard loads
      }
    };

    showPopupAfterDelay();
  }, [user?.id, loading, events.length, hasShownPopupThisSession, isEventModalVisible]);

  // Universal notification system automatically handles real-time updates
  // No manual refresh needed

  const openAddActivityModal = () => {
    // This function is not fully implemented in the original file,
    // so it's not added to the new_code.
    Alert.alert('Add Activity', 'This feature is not yet implemented.');
  };

  const deleteActivity = (idx) => {
    Alert.alert('Delete Activity', 'Are you sure you want to delete this activity?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setActivities(activities.filter((_, i) => i !== idx));
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Admin Dashboard" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Admin Dashboard" />
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={async () => {
            console.log('🔄 [AdminDashboard] Manual retry button pressed');
            setError(null);
            setLoading(true);
            
            try {
              await Promise.all([
                loadDashboardData(0), // Reset retry count
                loadChartData()
              ]);
              console.log('✅ [AdminDashboard] Manual retry completed successfully');
            } catch (error) {
              console.error('❌ [AdminDashboard] Manual retry failed:', error);
              // Error will be set by loadDashboardData
            }
          }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, webContainerStyle]}>
      <Header 
        title="Admin Dashboard" 
        showNotifications={true}
        unreadCount={unreadCount}
        onNotificationsPress={() => navigateSafely('AdminNotifications')}
      />

      <ScrollView
        style={[styles.scrollView, webScrollViewStyles.scrollView]}
        contentContainerStyle={webScrollViewStyles.scrollViewContent}
        {...getWebScrollProps()}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
      >
        
        {/* Welcome Section - Modern gradient design */}
        <View style={styles.welcomeSection}>
          {/* Decorative background elements */}
          <View style={styles.backgroundCircle1} />
          <View style={styles.backgroundCircle2} />
          <View style={styles.backgroundPattern} />
          
          <View style={styles.welcomeContent}>
            {schoolDetails ? (
              <View style={styles.schoolHeader}>
                <LogoDisplay 
                  logoUrl={schoolDetails.logo_url} 
                  onImageError={() => {
                    // Logo image failed to load, using placeholder
                  }}
                />
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>
                    {schoolDetails.name}
                  </Text>
                  <Text style={styles.schoolType}>
                    {schoolDetails.type}
                  </Text>
                </View>
              </View>
            ) : (
              <NoSchoolDetailsState
                onActionPress={() => navigateSafely('SchoolDetails')}
              />
            )}
            
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

        {/* Stats Cards - Teacher Dashboard Style */}
        <View style={styles.statsColumnContainer}>
          {stats[0] && (
            <StatCard
              title={stats[0].title}
              value={stats[0].value}
              icon={stats[0].icon}
              color={stats[0].color}
              subtitle={stats[0].subtitle}
              onPress={() => navigateSafely('Students')}
            />
          )}
          {stats[1] && (
            <StatCard
              title={stats[1].title}
              value={stats[1].value}
              icon={stats[1].icon}
              color={stats[1].color}
              subtitle={stats[1].subtitle}
              onPress={() => navigateSafely('Teachers')}
            />
          )}
          {stats[2] && (
            <StatCard
              title={stats[2].title}
              value={stats[2].value}
              icon={stats[2].icon}
              color={stats[2].color}
              subtitle={stats[2].subtitle}
              onPress={() => navigateSafely('AttendanceReport')}
            />
          )}
          {stats[3] && (
            <StatCard
              title={stats[3].title}
              value={stats[3].value}
              icon={stats[3].icon}
              color={stats[3].color}
              subtitle={stats[3].subtitle}
              onPress={() => navigateSafely('FeeManagement')}
            />
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={() => {
                  if (action.action) {
                    action.action(); // Call custom action function
                  } else {
                    navigateSafely(action.screen); // Navigate to screen
                  }
                }}
              >
                <View style={styles.actionIconContainer}>
                  <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                    <Ionicons name={action.icon} size={24} color="#fff" />
                  </View>
                  {action.banner && (
                    <View style={styles.bannerContainer}>
                      <Text style={styles.bannerText}>{action.banner}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>


        {/* Upcoming Events, Exams, or Deadlines */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => {
                console.log('🔧 Direct Add Event button pressed');
                console.log('🔧 Current state - isEventModalVisible:', isEventModalVisible);
                console.log('🔧 Current state - showUpcomingEventsPopup:', showUpcomingEventsPopup);
                console.log('🔧 Button touch detected, calling openAddEventModal');
                
                // Mark user as having interacted to prevent automatic popup
                setUserHasInteracted(true);
                
                // Prevent multiple modal opens
                if (!isEventModalVisible && !showUpcomingEventsPopup) {
                  openAddEventModal();
                } else {
                  console.log('🔧 Modal already open, ignoring button press');
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.upcomingList}>
            {events.slice().sort((a, b) => {
              // Convert DD-MM-YYYY back to YYYY-MM-DD for proper date sorting
              const dateA = formatDateToStorage(a.date);
              const dateB = formatDateToStorage(b.date);
              return new Date(dateA) - new Date(dateB);
            }).map((item, idx) => (
              <View key={item.id} style={styles.upcomingItem}>
                <View style={[styles.upcomingIcon, { backgroundColor: item.color }]}> 
                  <Ionicons name={item.icon} size={20} color="#fff" />
                </View>
                <View style={styles.upcomingContent}>
                  <Text style={styles.upcomingTitle}>{item.title}</Text>
                  <Text style={styles.upcomingSubtitle}>{item.type} • {item.date}</Text>
                </View>
                <TouchableOpacity onPress={() => openEditEventModal(item, events.findIndex(e => e.id === item.id))} style={{ marginRight: 8 }}>
                  <Ionicons name="create-outline" size={20} color="#2196F3" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteEvent(item.id)}>
                  <Ionicons name="trash" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>


        {/* Fee Collection Summary and Outstanding Dues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fee Collection Summary & Outstanding Dues</Text>
          {/* Overall Summary Pie Chart with loading animation */}
          <View style={{ alignItems: 'center', marginBottom: 16, width: '100%', flexDirection: 'column', justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 0, textAlign: 'center' }}></Text>
            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <CrossPlatformPieChart
                data={feeCollectionData}
                width={Math.min(width * 0.8, 350)}
                height={200}
                chartConfig={chartConfig}
                accessor={'population'}
                backgroundColor={'transparent'}
                paddingLeft={'70'}
                absolute
                style={[styles.chart, feeLoading ? { opacity: 0.5, alignSelf: 'center' } : null]}
                hasLegend={false}
              />
              {feeLoading && (
                <View style={styles.pieLoadingOverlay}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4, width: '100%' }}>
              <Text style={{ color: '#4CAF50', fontWeight: 'bold', marginRight: 16 }}>
                Collected: ₹{(feeCollectionData[0]?.population || 0).toLocaleString()}
              </Text>
              <Text style={{ color: '#F44336', fontWeight: 'bold' }}>
                Due: ₹{(feeCollectionData[1]?.population || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Activities - moved to bottom */}
        <View style={[styles.section, styles.recentActivitiesSection]}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <View style={styles.activitiesList}>
            {activities.map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name={activity.icon} size={16} color="#2196F3" />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{activity.text}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteActivity(index)} style={{ marginRight: 8 }}>
                  <Ionicons name="trash" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Upcoming Events Popup Modal */}
      <Modal
        visible={showUpcomingEventsPopup}
        animationType="fade"
        transparent
        onRequestClose={() => setShowUpcomingEventsPopup(false)}
      >
        <View style={styles.popupModalOverlay}>
          <View style={styles.popupModalContainer}>
            {/* Header */}
            <View style={styles.popupModalHeader}>
              <View style={styles.popupModalHeaderContent}>
                <View style={styles.popupModalIconContainer}>
                  <Ionicons name="calendar" size={28} color="#2196F3" />
                </View>
                <View style={styles.popupModalTitleContainer}>
                  <Text style={styles.popupModalTitle}>Upcoming Events</Text>
                  <Text style={styles.popupModalSubtitle}>Welcome back! Here's what's coming up</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.popupModalCloseButton}
                onPress={() => setShowUpcomingEventsPopup(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Events List */}
            <ScrollView 
              style={styles.popupModalScrollView}
              contentContainerStyle={styles.popupModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {events.length === 0 ? (
                <View style={styles.popupModalNoEvents}>
                  <Ionicons name="calendar-outline" size={48} color="#ccc" />
                  <Text style={styles.popupModalNoEventsText}>No upcoming events</Text>
                  <Text style={styles.popupModalNoEventsSubtext}>Your schedule is clear for now</Text>
                </View>
              ) : (
                events.slice(0, 5).sort((a, b) => {
                  // Convert DD-MM-YYYY back to YYYY-MM-DD for proper date sorting
                  const dateA = formatDateToStorage(a.date);
                  const dateB = formatDateToStorage(b.date);
                  return new Date(dateA) - new Date(dateB);
                }).map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.popupModalEventItem}
                    onPress={() => {
                      const eventDate = new Date(item.date);
                      const formattedDate = eventDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      });
                      
                      Alert.alert(
                        item.title,
                        `${item.type}\n\nDate: ${formattedDate}\n\nTap the event on the dashboard below for more options.`,
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <View style={[styles.popupModalEventIcon, { backgroundColor: item.color }]}>
                      <Ionicons name={item.icon} size={20} color="#fff" />
                    </View>
                    <View style={styles.popupModalEventContent}>
                      <Text style={styles.popupModalEventTitle}>{item.title}</Text>
                      <Text style={styles.popupModalEventType}>{item.type}</Text>
                      <View style={styles.popupModalEventDateContainer}>
                        <Ionicons name="calendar-outline" size={14} color="#666" />
                        <Text style={styles.popupModalEventDate}>
                          {item.date.replace(/-/g, '/')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.popupModalEventArrow}>
                      <Ionicons name="chevron-forward" size={16} color="#ccc" />
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {events.length > 5 && (
                <TouchableOpacity 
                  style={styles.popupModalViewAllButton}
                  onPress={() => {
                    setShowUpcomingEventsPopup(false);
                    // Scroll to events section on dashboard
                  }}
                >
                  <Text style={styles.popupModalViewAllText}>
                    View all {events.length} events on dashboard
                  </Text>
                  <Ionicons name="arrow-down" size={16} color="#2196F3" />
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.popupModalFooter}>
              <TouchableOpacity 
                style={styles.popupModalFooterButton}
                onPress={() => {
                  console.log('🔧 Add Event button in popup footer pressed');
                  setShowUpcomingEventsPopup(false);
                  // Add a longer delay to ensure the popup modal fully closes before opening the add event modal
                  setTimeout(() => {
                    console.log('🔧 Opening add event modal from popup footer');
                    openAddEventModal();
                  }, 500);
                }}
              >
                <Ionicons name="add" size={18} color="#2196F3" />
                <Text style={styles.popupModalFooterButtonText}>Add Event</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.popupModalFooterButton, styles.popupModalFooterButtonPrimary]}
                onPress={() => setShowUpcomingEventsPopup(false)}
              >
                <Text style={styles.popupModalFooterButtonTextPrimary}>Continue to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>



      {/* Event Modal using React Native Modal to hide tab bar */}
      <Modal
        visible={isEventModalVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          setIsEventModalVisible(false);
          setShowEventTypePicker(false);
          setShowEventDatePicker(false);
        }}
      >
        <View style={styles.modalOverlayFullscreen}>
          <View style={styles.simpleModalContainer}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="calendar-outline" size={20} color="#2196F3" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 2 }}>Add New Event</Text>
                <Text style={{ fontSize: 14, color: '#666' }}>Create a new event for your school</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  console.log('🔧 Close button pressed');
                  setIsEventModalVisible(false);
                  setShowEventTypePicker(false); // Close dropdown when modal closes
                  setShowEventDatePicker(false); // Close date picker when modal closes
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>Event Title *</Text>
              <TextInput
                placeholder="Enter event title"
                value={eventInput.title}
                onChangeText={text => setEventInput({ ...eventInput, title: text })}
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 16,
                  backgroundColor: '#fafafa'
                }}
              />
              
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>Description</Text>
              <TextInput
                placeholder="Enter event description (optional)"
                value={eventInput.description}
                onChangeText={text => setEventInput({ ...eventInput, description: text })}
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 16,
                  backgroundColor: '#fafafa',
                  minHeight: 60
                }}
                multiline
                numberOfLines={3}
              />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>Event Date *</Text>
              {Platform.OS === 'web' ? (
                <CrossPlatformDatePicker
                  value={(() => {
                    if (eventInput.date) {
                      // Convert DD-MM-YYYY to Date object for the picker (fix timezone issues)
                      if (eventInput.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
                        const [day, month, year] = eventInput.date.split('-');
                        // Use Date constructor with explicit time to avoid timezone issues
                        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
                        return dateObj;
                      }
                      return new Date(eventInput.date);
                    }
                    return new Date();
                  })()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      // Convert Date object to DD-MM-YYYY format
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const year = selectedDate.getFullYear();
                      const formattedDate = `${day}-${month}-${year}`;
                      
                      setEventInput(prevInput => ({ ...prevInput, date: formattedDate }));
                    }
                  }}
                  mode="date"
                  minimumDate={new Date()} // Prevent selecting past dates
                  placeholder="Select event date"
                  style={{
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    borderRadius: 8,
                    marginBottom: 16,
                    backgroundColor: '#fafafa'
                  }}
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setShowEventDatePicker(true)}
                  style={{
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    borderRadius: 8,
                    marginBottom: 16,
                    backgroundColor: '#fafafa',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    color: eventInput.date ? '#333' : '#999'
                  }}>
                    {eventInput.date || 'Select event date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#666" />
                </TouchableOpacity>
              )}
              
              {/* Mobile Date Picker Modal */}
              {showEventDatePicker && Platform.OS !== 'web' && (
                <CrossPlatformDatePicker
                  value={(() => {
                    if (eventInput.date) {
                      // Convert DD-MM-YYYY to Date object (fix timezone issues)
                      if (eventInput.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
                        const [day, month, year] = eventInput.date.split('-');
                        // Use Date constructor with explicit time to avoid timezone issues
                        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
                        return dateObj;
                      }
                      return new Date(eventInput.date);
                    }
                    return new Date();
                  })()}
                  onChange={(event, selectedDate) => {
                    setShowEventDatePicker(false);
                    
                    if (selectedDate && event.type === 'set') {
                      // Convert Date object to DD-MM-YYYY format
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const year = selectedDate.getFullYear();
                      const formattedDate = `${day}-${month}-${year}`;
                      
                      setEventInput(prevInput => ({ ...prevInput, date: formattedDate }));
                    }
                  }}
                  mode="date"
                  minimumDate={new Date()} // Prevent selecting past dates
                  display="default"
                />
              )}
              
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>Event Type</Text>
              <View style={{
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                marginBottom: 16,
                backgroundColor: '#fafafa'
              }}>
                <TouchableOpacity
                  onPress={() => setShowEventTypePicker(!showEventTypePicker)}
                  style={{
                    padding: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    color: eventInput.type ? '#333' : '#999'
                  }}>
                    {eventInput.type || 'Select event type'}
                  </Text>
                  <Ionicons 
                    name={showEventTypePicker ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
                
                {showEventTypePicker && (
                  <View style={{
                    borderTopWidth: 1,
                    borderTopColor: '#e0e0e0',
                    backgroundColor: 'white',
                    maxHeight: 200
                  }}>
                    <ScrollView>
                      {[
                        { value: 'Event', icon: 'calendar', color: '#FF9800' },
                        { value: 'Exam', icon: 'document-text', color: '#F44336' },
                        { value: 'Meeting', icon: 'people', color: '#9C27B0' },
                        { value: 'Sports', icon: 'trophy', color: '#4CAF50' },
                        { value: 'Cultural', icon: 'musical-notes', color: '#2196F3' },
                        { value: 'Academic', icon: 'school', color: '#FF5722' },
                        { value: 'Holiday', icon: 'sunny', color: '#FFC107' },
                        { value: 'Workshop', icon: 'construct', color: '#607D8B' },
                        { value: 'Field Trip', icon: 'bus', color: '#795548' },
                        { value: 'Parent Meeting', icon: 'people-circle', color: '#E91E63' }
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => {
                            setEventInput({ ...eventInput, type: option.value, color: option.color, icon: option.icon });
                            setShowEventTypePicker(false);
                          }}
                          style={{
                            padding: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: eventInput.type === option.value ? '#e3f2fd' : 'transparent'
                          }}
                        >
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: option.color,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12
                          }}>
                            <Ionicons name={option.icon} size={16} color="white" />
                          </View>
                          <Text style={{
                            fontSize: 16,
                            color: eventInput.type === option.value ? '#2196F3' : '#333',
                            fontWeight: eventInput.type === option.value ? 'bold' : 'normal'
                          }}>
                            {option.value}
                          </Text>
                          {eventInput.type === option.value && (
                            <Ionicons name="checkmark" size={20} color="#2196F3" style={{ marginLeft: 'auto' }} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
              <TouchableOpacity 
                onPress={() => {
                  console.log('🔧 Cancel button pressed');
                  setIsEventModalVisible(false);
                  setShowEventTypePicker(false); // Close dropdown when modal closes
                  setShowEventDatePicker(false); // Close date picker when modal closes
                }}
                style={{
                  backgroundColor: '#f5f5f5',
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  marginRight: 12,
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#ddd'
                }}
              > 
                <Text style={{ textAlign: 'center', color: '#666', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  console.log('🔧 Save button pressed');
                  if (eventInput.title.trim()) {
                    saveEvent();
                  } else {
                    Alert.alert('Error', 'Please enter an event title');
                  }
                }}
                style={{
                  backgroundColor: savingEvent ? '#ccc' : '#2196F3',
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  flex: 1,
                  shadowColor: '#2196F3',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4
                }}
                disabled={savingEvent}
              > 
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  {savingEvent ? (
                    <ActivityIndicator size={18} color="#fff" style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
                  )}
                  <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    {savingEvent ? 'Saving...' : 'Save Event'}
                  </Text>
                </View>
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
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statsColumnContainer: {
    paddingHorizontal: 8,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 24,
    color: '#2196F3',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#212529',
  },
  announcementsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  announcementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#212529',
  },
  announcementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  announcementIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  announcementText: {
    flex: 1,
    fontSize: 14,
    color: '#212529',
  },
  announcementDate: {
    fontSize: 12,
    color: '#6c757d',
  },
  addAnnouncementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#2196F3',
    borderRadius: 4,
    marginTop: 12,
  },
  addAnnouncementButtonText: {
    color: '#ffffff',
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#212529',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerContainer: {
    width: '100%',
    marginTop: 16,
  },
  datePickerButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  datePickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: '#dc3545',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
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
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCardWrapper: {
    marginRight: 16,
    width: 200,
    maxWidth: 220,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  actionIconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bannerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  chart: {
    borderRadius: 12,
  },
  activitiesList: {
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
  },
  upcomingList: {
    marginTop: 8,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  upcomingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upcomingContent: {
    flex: 1,
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  upcomingSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  feesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  feeSummary: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feeSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  feeSummaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  feePieWrapper: {
    marginRight: 12,
    alignItems: 'center',
    width: width > 600 ? 120 : 110,
  },
  feePieScroll: {
    paddingLeft: 4,
    paddingRight: 4,
    alignItems: 'center',
  },
  pieLoadingOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  announcementsList: {
    marginTop: 8,
  },
  announcementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  announcementIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  announcementContent: {
    flex: 1,
  },
  announcementText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  announcementDate: {
    fontSize: 13,
    color: '#666',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    // Ensure button is visible and clickable
    zIndex: 1,
    position: 'relative',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 999999,
    elevation: 999,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    elevation: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    alignSelf: 'center',
    zIndex: 1000000,
    position: 'relative',
  },
  modalOverlayFixed: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainerFixed: {
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25,
  },
  simpleModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 9999999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // Ensure it covers everything including tab bar
    ...Platform.select({
      ios: {
        paddingBottom: 0, // iOS handles safe areas differently
      },
      android: {
        paddingBottom: 0,
      },
      web: {
        position: 'fixed', // Use fixed positioning on web
        zIndex: 999999,
      },
    }),
  },
  simpleModalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 450,
    maxHeight: '85%',
    elevation: 10000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    zIndex: 10000000,
    position: 'relative',
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: 24,
    paddingBottom: 32,
    minHeight: 200,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  inputFocused: {
    borderColor: '#2196F3',
    backgroundColor: '#fff',
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },
  inputDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  modalButtonSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonPrimary: {
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  toggleButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  toggleButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  toggleText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  classOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  classOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  classOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  classOptionTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
  },
  visibilityOptionActive: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  visibilityOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visibilityOptionTitleActive: {
    color: '#2196F3',
  },
  visibilityOptionDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  classSelectionContainer: {
    marginTop: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  quickSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    marginBottom: 12,
  },
  quickSelectText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    fontWeight: '600',
  },
  classGridContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectionCountText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  classScrollView: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  classChipSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  classChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  classChipTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  noClassesContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noClassesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  recentActivitiesSection: {
    paddingBottom: 20,
  },
  modalOverlayFullscreen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Upcoming Events Popup Modal Styles
  popupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupModalContainer: {
    width: '95%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
    overflow: 'hidden',
  },
  popupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  popupModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  popupModalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  popupModalTitleContainer: {
    flex: 1,
  },
  popupModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  popupModalSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  popupModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  popupModalScrollView: {
    maxHeight: 360,
    paddingHorizontal: 20,
  },
  popupModalScrollContent: {
    paddingVertical: 16,
  },
  popupModalNoEvents: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  popupModalNoEventsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  popupModalNoEventsSubtext: {
    fontSize: 14,
    color: '#999',
  },
  popupModalEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  popupModalEventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  popupModalEventContent: {
    flex: 1,
  },
  popupModalEventTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  popupModalEventType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popupModalEventDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  popupModalEventDate: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  popupModalEventArrow: {
    marginLeft: 8,
  },
  popupModalViewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  popupModalViewAllText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    marginRight: 6,
  },
  popupModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  popupModalFooterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  popupModalFooterButtonPrimary: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  popupModalFooterButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 6,
  },
  popupModalFooterButtonTextPrimary: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

});

export default AdminDashboard;
