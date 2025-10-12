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
  Linking,
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
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { format, addMonths } from 'date-fns';
import { getEventDisplayProps } from '../../utils/eventIcons';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import { useTenantAccess, tenantDatabase, getCachedTenantId } from '../../utils/tenantHelpers';
import { useTenant } from '../../contexts/TenantContext';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../styles/webScrollFix';
import { useUniversalNotificationCount } from '../../hooks/useUniversalNotificationCount';
import useNavigateWithStatePreservation from '../../components/ui/SafeNavigate';
import { useTenantFeatures } from '../../hooks/useTenantFeatures';
import { getFeatureForQuickAction } from '../../constants/featureMapping';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';

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
  
  // 🚀 ENHANCED: Use the same tenant access hook as ManageClasses
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // Access current tenant data for study_url
  const { currentTenant } = useTenant();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState([]);
  const [monthlyCollection, setMonthlyCollection] = useState(0);
  const refreshTimerRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schoolDetails, setSchoolDetails] = useState(null);

  // Safe navigation hook to prevent state loss
  const navigateSafely = useNavigateWithStatePreservation();
  
  // Feature access hook for quick action protection
  const { hasFeature, loading: featuresLoading, isReady: featuresReady, debugFeatureAccess } = useTenantFeatures();
  
  // Feature-protected navigation handler
  const navigateWithFeatureCheck = (actionTitle, screenName, actionFunction = null) => {
    const featureKey = getFeatureForQuickAction(actionTitle);
    
    if (featureKey) {
      debugFeatureAccess(featureKey, `QuickAction:${actionTitle}`);
      
      if (!hasFeature(featureKey)) {
        Alert.alert(
          'Access Restricted',
          'Contact your service provider',
          [
            {
              text: 'OK',
              style: 'default'
            }
          ]
        );
        return;
      }
    }
    
    // Feature access granted or no feature check needed
    if (actionFunction) {
      // Handle custom actions
      if (actionFunction === 'openStudyCertificate') {
        openStudyCertificate();
      } else if (actionFunction === 'openHallTicket') {
        openHallTicket();
      } else if (actionFunction === 'openMarksCard') {
        openMarksCard();
      } else if (typeof actionFunction === 'function') {
        actionFunction();
      }
    } else {
      navigateSafely(screenName);
    }
  };

  // Study Certificate URL handler
  const openStudyCertificate = async () => {
    try {
      const studyUrl = currentTenant?.study_url;
      
      if (!studyUrl || studyUrl.trim() === '') {
        Alert.alert(
          'Study Certificate',
          'Study Certificate URL not configured. Contact your service provider Maximus Consultancy Services',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Ensure URL has proper protocol
      let finalUrl = studyUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      
      // Open URL in browser
      if (Platform.OS === 'web') {
        window.open(finalUrl, '_blank');
      } else {
        const supported = await Linking.canOpenURL(finalUrl);
        if (supported) {
          await Linking.openURL(finalUrl);
        } else {
          Alert.alert(
            'Error',
            'Study Certificate URL not configured. Contact your service provider Maximus Consultancy Services',
            [{ text: 'OK', style: 'default' }]
          );
        }
      }
    } catch (error) {
      console.error('Error opening study certificate URL:', error);
      Alert.alert(
        'Error',
        'Study Certificate URL not configured. Contact your service provider Maximus Consultancy Services',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Hall Tickets URL handler
  const openHallTicket = async () => {
    try {
      const hallTicketUrl = currentTenant?.hallticket_url;
      
      if (!hallTicketUrl || hallTicketUrl.trim() === '') {
        Alert.alert(
          'Hall Tickets',
          'Hall Tickets URL not configured. Contact your service provider Maximus Consultancy Services',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Ensure URL has proper protocol
      let finalUrl = hallTicketUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      
      // Open URL in browser
      if (Platform.OS === 'web') {
        window.open(finalUrl, '_blank');
      } else {
        const supported = await Linking.canOpenURL(finalUrl);
        if (supported) {
          await Linking.openURL(finalUrl);
        } else {
          Alert.alert(
            'Error',
            'Hall Tickets URL not configured. Contact your service provider Maximus Consultancy Services',
            [{ text: 'OK', style: 'default' }]
          );
        }
      }
    } catch (error) {
      console.error('Error opening hall tickets URL:', error);
      Alert.alert(
        'Error',
        'Hall Tickets URL not configured. Contact your service provider Maximus Consultancy Services',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Marks Card URL handler
  const openMarksCard = async () => {
    try {
      const marksCardUrl = currentTenant?.markscard_url;
      
      if (!marksCardUrl || marksCardUrl.trim() === '') {
        Alert.alert(
          'Marks Card',
          'Marks Card URL not configured. Contact your service provider Maximus Consultancy Services',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // Ensure URL has proper protocol
      let finalUrl = marksCardUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      
      // Open URL in browser
      if (Platform.OS === 'web') {
        window.open(finalUrl, '_blank');
      } else {
        const supported = await Linking.canOpenURL(finalUrl);
        if (supported) {
          await Linking.openURL(finalUrl);
        } else {
          Alert.alert(
            'Error',
            'Marks Card URL not configured. Contact your service provider Maximus Consultancy Services',
            [{ text: 'OK', style: 'default' }]
          );
        }
      }
    } catch (error) {
      console.error('Error opening marks card URL:', error);
      Alert.alert(
        'Error',
        'Marks Card URL not configured. Contact your service provider Maximus Consultancy Services',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Component rendered

  // Load real-time data from Supabase using actual schema
  const loadDashboardData = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);

      if (!user || !user.id || !user.email) {
        if (retryCount < 3) {
          setTimeout(() => {
            loadDashboardData(retryCount + 1);
          }, 1000 * (retryCount + 1));
          return;
        }
        throw new Error('User authentication not ready. Please refresh the page or log in again.');
      }

      // Resolve tenant via hook/cached value
      let tenantId = typeof getTenantId === 'function' ? getTenantId() : null;
      if (!tenantId) {
        tenantId = typeof getCachedTenantId === 'function' ? getCachedTenantId() : null;
      }
      if (!tenantId) {
        if (!isReady && retryCount < 3) {
          setTimeout(() => loadDashboardData(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw new Error('Unable to determine tenant context. Please log out and log back in.');
      }

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const currentMonth = format(now, 'yyyy-MM');
      const nextMonth = format(addMonths(now, 1), 'yyyy-MM');

      // Fetch all required resources in parallel
      const [
        schoolRes,
        studentsRes,
        teachersRes,
        attendanceRes,
        classesRes,
        monthlyFeesRes,
        eventsRes,
        recentStudentsRes,
        recentFeesRes,
      ] = await Promise.all([
        dbHelpers.getSchoolDetails(),
        supabase.from('students').select('gender', { count: 'exact' }).eq('tenant_id', tenantId),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('student_attendance').select('status').eq('date', today).eq('tenant_id', tenantId),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase
          .from('student_fees')
          .select('amount_paid')
          .eq('tenant_id', tenantId)
          .gte('payment_date', `${currentMonth}-01`)
          .lt('payment_date', `${nextMonth}-01`),
        supabase
          .from('events')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(10),
        supabase
          .from('students')
          .select('name, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('student_fees')
          .select('amount_paid, payment_date, students(name)')
          .eq('tenant_id', tenantId)
          .order('payment_date', { ascending: false })
          .limit(3),
      ]);

      // School details
      setSchoolDetails(schoolRes.data || null);

      // Counts and derived values
      const totalStudents = studentsRes.count || 0;
      const totalTeachers = teachersRes.count || 0; // head:true, count available
      const totalClasses = classesRes.count || 0;   // head:true, count available
      const presentToday = (attendanceRes.data || []).filter(att => att.status === 'Present').length;
      const attendancePercentage = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

      // Monthly fees
      const monthlyFeeCollectionValue = (monthlyFeesRes.data || []).reduce((sum, fee) => sum + (fee.amount_paid || 0), 0);
      setMonthlyCollection(monthlyFeeCollectionValue);

      // Stats block
      const maleCount = (studentsRes.data || []).filter(s => s.gender === 'Male').length;
      const femaleCount = (studentsRes.data || []).filter(s => s.gender === 'Female').length;
      setStats([
        {
          title: 'Total Students',
          value: totalStudents.toLocaleString(),
          icon: 'people',
          color: '#2196F3',
          subtitle: `${maleCount} Male, ${femaleCount} Female`,
          trend: 0,
        },
        {
          title: 'Total Teachers',
          value: totalTeachers.toString(),
          icon: 'person',
          color: '#4CAF50',
          subtitle: `${totalClasses} Classes`,
          trend: 0,
        },
        {
          title: 'Attendance Today',
          value: `${attendancePercentage}%`,
          icon: 'checkmark-circle',
          color: '#FF9800',
          subtitle: `${presentToday} of ${totalStudents} present`,
          trend: 0,
        },
        {
          title: 'Monthly Fees',
          value: `₹${(monthlyFeeCollectionValue / 100000).toFixed(1)}L`,
          icon: 'card',
          color: '#9C27B0',
          subtitle: `Collected this month`,
          trend: 0,
        },
      ]);

      // Events
      if (eventsRes.data && !eventsRes.error) {
        setEvents(
          eventsRes.data.map(event => {
            const { icon, color } = getEventDisplayProps(event.event_type || 'Event', event.title || '');
            return {
              id: event.id,
              type: event.event_type || 'Event',
              title: event.title,
              date: formatDateToDisplay(event.event_date),
              icon,
              color,
            };
          })
        );
      } else if (eventsRes.error && eventsRes.error.code !== '42P01') {
        console.error('Error loading events:', eventsRes.error);
        setEvents([]);
      } else {
        setEvents([]);
      }

      // Recent activities - with proper timezone handling
      const recentActivities = [];
      
      // Helper function to format dates with timezone awareness
      const formatActivityDate = (dateString) => {
        try {
          if (!dateString) return 'Unknown time';
          
          // Parse the date from database (usually UTC)
          const date = new Date(dateString);
          
          // Check if date is valid
          if (isNaN(date.getTime())) {
            console.warn('Invalid date received:', dateString);
            return 'Invalid date';
          }
          
          // Get current time for relative formatting
          const now = new Date();
          const diffInSeconds = Math.floor((now - date) / 1000);
          const diffInMinutes = Math.floor(diffInSeconds / 60);
          const diffInHours = Math.floor(diffInMinutes / 60);
          const diffInDays = Math.floor(diffInHours / 24);
          
          // Format as relative time for recent activities
          if (diffInSeconds < 60) {
            return 'Just now';
          } else if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
          } else if (diffInHours < 24) {
            return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
          } else if (diffInDays < 7) {
            return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
          } else {
            // For older dates, show full date in user's timezone
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          }
        } catch (error) {
          console.error('Error formatting activity date:', error, dateString);
          return 'Unknown time';
        }
      };
      
      if (recentStudentsRes.data && !recentStudentsRes.error) {
        recentStudentsRes.data.forEach(student => {
          if (student.created_at && student.name) {
            recentActivities.push({
              text: `New student registered: ${student.name}`,
              time: formatActivityDate(student.created_at),
              rawDate: student.created_at, // Keep raw date for sorting
              icon: 'person-add',
            });
          }
        });
      }
      
      if (recentFeesRes.data && !recentFeesRes.error) {
        recentFeesRes.data.forEach(fee => {
          if (fee.payment_date && fee.amount_paid && fee.students?.name) {
            recentActivities.push({
              text: `Fee payment received: ₹${fee.amount_paid} from ${fee.students.name}`,
              time: formatActivityDate(fee.payment_date),
              rawDate: fee.payment_date, // Keep raw date for sorting
              icon: 'card',
            });
          }
        });
      }
      
      // Sort by actual date objects for accurate chronological ordering
      recentActivities.sort((a, b) => {
        const dateA = new Date(a.rawDate);
        const dateB = new Date(b.rawDate);
        return dateB - dateA; // Most recent first
      });
      
      // Remove rawDate before setting state (not needed in UI)
      const cleanedActivities = recentActivities.slice(0, 5).map(({ rawDate, ...activity }) => activity);
      setActivities(cleanedActivities);
    } catch (error) {
      console.error('🏠 [AdminDashboard] Error loading dashboard data:', error);
      let errorMessage = 'Failed to load dashboard data';
      let shouldRetry = false;
      if (error.message.includes('User authentication not ready')) {
        errorMessage = 'Authentication is loading. Please wait...';
        shouldRetry = true;
      } else if (error.message.includes('Unable to determine tenant')) {
        errorMessage = 'Unable to determine your school context. Please log out and log back in.';
      } else if (error.message.includes('JWT') || error.message.includes('session')) {
        errorMessage = 'Session expired. Please refresh the page or log in again.';
        shouldRetry = true;
      } else if (error.message.includes('permission denied') || error.message.includes('RLS')) {
        errorMessage = 'Database permission error. Please refresh the page or contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your internet and try again.';
        shouldRetry = true;
      } else {
        errorMessage = error.message.length > 10 ? error.message : 'Failed to load dashboard data';
      }
      setError(errorMessage);
      if (shouldRetry && Platform.OS === 'web' && retryCount < 2) {
        setTimeout(() => loadDashboardData(retryCount + 1), 2000);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 🚀 FIXED: Wait for user authentication before loading dashboard
    
    // Don't initialize dashboard if user isn't ready
    if (!user || !user.id || !user.email) {
      return;
    }
    
    const initializeDashboard = async () => {
      try {
        await loadDashboardData();
        await loadChartData({ reuseMonthlyFromDashboard: true });
      } catch (error) {
        console.error('❌ [AdminDashboard] Dashboard initialization failed:', error);
      }
    };

    initializeDashboard();

    // Debounced refresh helper
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(async () => {
        await loadDashboardData();
        await loadChartData({ reuseMonthlyFromDashboard: true });
      }, 500);
    };

    // Subscribe to Supabase real-time updates with tenant filter
    let tenantForFilter = typeof getTenantId === 'function' ? getTenantId() : null;
    if (!tenantForFilter) tenantForFilter = typeof getCachedTenantId === 'function' ? getCachedTenantId() : null;

    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: tenantForFilter ? `tenant_id=eq.${tenantForFilter}` : undefined }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_attendance', filter: tenantForFilter ? `tenant_id=eq.${tenantForFilter}` : undefined }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_fees', filter: tenantForFilter ? `tenant_id=eq.${tenantForFilter}` : undefined }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams', filter: tenantForFilter ? `tenant_id=eq.${tenantForFilter}` : undefined }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: tenantForFilter ? `tenant_id=eq.${tenantForFilter}` : undefined }, scheduleRefresh)
      .subscribe();

    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [user?.id, user?.email]); // 🚀 FIXED: Added proper dependencies


  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
      await loadChartData({ reuseMonthlyFromDashboard: true });
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
    { title: 'Photo Upload', icon: 'camera', color: '#2196F3', screen: 'PhotoUpload' }, // Stack screen
    { title: 'Leave Management', icon: 'calendar-outline', color: '#4CAF50', screen: 'LeaveManagement' }, // Stack screen
    { title: 'Subjects Timetable', icon: 'calendar', color: '#607D8B', screen: 'SubjectsTimetable' }, // Stack screen
    { title: 'Attendance', icon: 'checkmark-circle', color: '#009688', screen: 'AttendanceManagement' }, // Stack screen
    { title: 'Fee Management', icon: 'card', color: '#9C27B0', screen: 'FeeManagement' }, // Stack screen
    { title: 'Stationary Management', icon: 'cube-outline', color: '#FF5722', screen: 'StationaryManagement' }, // Stack screen
    { title: 'Expense Management', icon: 'wallet', color: '#F44336', screen: 'ExpenseManagement' }, // Stack screen
    { title: 'Exams & Marks', icon: 'document-text', color: '#795548', screen: 'ExamsMarks' }, // Stack screen
    { title: 'Notifications', icon: 'notifications', color: '#FF5722', screen: 'NotificationManagement' }, // Stack screen
    { title: 'Test Push Notifications', icon: 'notifications-outline', color: '#9C27B0', screen: 'TestPushNotifications' }, // Stack screen
    { title: 'Study Certificate', icon: 'document-text', color: '#607D8B', action: 'openStudyCertificate' }, // Custom action
    { title: 'Marks Card', icon: 'bar-chart', color: '#2196F3', action: 'openMarksCard' }, // Custom action
    { title: 'Hall Tickets', icon: 'card-outline', color: '#2196F3', action: 'openHallTicket' }, // Custom action
    { title: 'Auto Grading', icon: 'checkmark-done', color: '#4CAF50', screen: 'AutoGrading', banner: 'UPCOMING' }, // Stack screen
  ];

  // State for chart data (only fee collection data now)

  const [feeCollectionData, setFeeCollectionData] = useState([
    { name: 'Collected', population: 0, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 14 },
    { name: 'Due', population: 0, color: '#F44336', legendFontColor: '#333', legendFontSize: 14 },
  ]);

  // Load chart data
  const loadChartData = async ({ reuseMonthlyFromDashboard = false, collectedOverride = null } = {}) => {
    try {
      if (!user || !user.id || !user.email) {
        return;
      }

      let tenantId = typeof getTenantId === 'function' ? getTenantId() : null;
      if (!tenantId) {
        tenantId = typeof getCachedTenantId === 'function' ? getCachedTenantId() : null;
      }
      if (!tenantId) return;

      let collected;
      if (reuseMonthlyFromDashboard && (collectedOverride !== null || monthlyCollection !== null)) {
        collected = collectedOverride !== null ? collectedOverride : monthlyCollection;
      } else {
        const currentMonth = format(new Date(), 'yyyy-MM');
        const { data: feeData } = await supabase
          .from('student_fees')
          .select('amount_paid')
          .eq('tenant_id', tenantId)
          .gte('payment_date', `${currentMonth}-01`);
        collected = feeData?.reduce((sum, fee) => sum + (fee.amount_paid || 0), 0) || 0;
      }

      const { data: feeStructureData } = await supabase
        .from('fee_structure')
        .select('amount')
        .eq('tenant_id', tenantId);

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
    }
  }, [eventInput.date]);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editEventIndex, setEditEventIndex] = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      let tenantId = typeof getTenantId === 'function' ? getTenantId() : null;
      if (!tenantId) tenantId = typeof getCachedTenantId === 'function' ? getCachedTenantId() : null;
      if (!tenantId) return;

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
      
      // Just try to select from the table - if it fails, we'll know the table doesn't exist
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') {
        return false;
      }
      
      if (error) {
        console.error('🔥 Error checking events table:', error);
        console.error('🔥 Error details:', { code: error.code, message: error.message, details: error.details });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('🔥 Error checking events table:', error);
      return false;
    }
  };

  const openAddEventModal = async () => {
    
    // Prevent multiple modal opens and avoid resetting eventInput if modal is already open
    if (isEventModalVisible) {
      return;
    }
    
    try {
      
      // Check if events table exists first with better error handling
      const tableExists = await checkEventsTable();
      if (!tableExists) {
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
      setEventInput(newEventInput);
      
      setEditEventIndex(null);
      
      loadClasses(); // Load classes when opening modal
      
      setIsEventModalVisible(true);
      
      // Verify state was set
      
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
    
    // Prevent double-clicking
    if (savingEvent) {
      return;
    }
    
    // 🚀 SIMPLE validation
    if (!eventInput.title?.trim()) {
      const errorMsg = 'Please enter an event title.';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
      return;
    }
    
    if (!eventInput.date) {
      const errorMsg = 'Please select an event date.';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
      return;
    }

    try {
      setSavingEvent(true);
      
      // Tenant ID from hook/cached
      let currentTenantId = typeof getTenantId === 'function' ? getTenantId() : null;
      if (!currentTenantId) currentTenantId = typeof getCachedTenantId === 'function' ? getCachedTenantId() : null;
      if (!currentTenantId) {
        throw new Error('Unable to get tenant context. Please refresh and try again.');
      }
      
      // 🚀 SIMPLIFIED: Format date
      let formattedDate = eventInput.date;
      if (typeof eventInput.date === 'string' && eventInput.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
        formattedDate = formatDateToStorage(eventInput.date);
      } else if (!eventInput.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        formattedDate = getCurrentDateString();
      }
      
      
      // 🚀 SIMPLIFIED: Create event data
      const eventData = {
        title: eventInput.title.trim(),
        description: eventInput.description?.trim() || '',
        event_date: formattedDate,
        event_type: eventInput.type || 'Event',
        is_school_wide: true,
        status: 'Active',
        tenant_id: currentTenantId
      };
      
      if (user?.id) {
        eventData.created_by = user.id;
      }
      
      
      // 🚀 SIMPLIFIED: Direct database insert (no complex update logic)
      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select();

      if (error) {
        console.error('🏢 Insert error:', error);
        throw new Error(`Failed to create event: ${error.message}`);
      }
      
      

      // 🚀 SIMPLIFIED: Update local events list immediately
      const newEvent = {
        id: data[0]?.id || Date.now().toString(),
        title: eventInput.title.trim(),
        type: eventInput.type || 'Event',
        date: eventInput.date,
        description: eventInput.description?.trim() || '',
        color: eventInput.color || '#FF9800',
        icon: eventInput.icon || 'calendar'
      };
      
      setEvents(currentEvents => [...currentEvents, newEvent]);
      
      // Close modal and show success message
      setIsEventModalVisible(false);
      setShowEventTypePicker(false);
      
      const successMsg = `Event \"${eventInput.title}\" created successfully!`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
    } catch (error) {
      console.error('🏢 Error saving event:', error);
      
      const errorMsg = error.message || 'Failed to save event';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setSavingEvent(false);
    }
  };
  const deleteEvent = async (eventItem) => {
    // 🚀 FIXED: Web-compatible confirmation dialog (same pattern as ManageClasses)
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm(`Are you sure you want to delete the event "${eventItem.title}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Event',
            `Are you sure you want to delete the event "${eventItem.title}"?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });
    
    if (!confirmDelete) {
      return;
    }
    
    try {
      
      // Tenant id via hook or cached
      let currentTenantId = typeof getTenantId === 'function' ? getTenantId() : null;
      if (!currentTenantId) currentTenantId = typeof getCachedTenantId === 'function' ? getCachedTenantId() : null;
      if (!currentTenantId) {
        throw new Error('Unable to determine tenant context. Please refresh the page and try again.');
      }
      
      
      // Use direct Supabase call with explicit tenant validation as fallback
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventItem.id)
        .eq('tenant_id', currentTenantId);

      if (error) {
        console.error('Error deleting event:', error);
        throw new Error(`Failed to delete event: ${error.message}`);
      }
      
      
      // 🚀 FIXED: Update local state immediately for better UX
      setEvents(prevEvents => {
        const updatedEvents = prevEvents.filter(e => e.id !== eventItem.id);
        return updatedEvents;
      });
      
      // 🚀 FIXED: Web-compatible success message
      const successMsg = `Successfully deleted event: ${eventItem.title}`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      
      // 🚀 FIXED: Web-compatible error message
      const errorMsg = `Could not delete "${eventItem.title}": ${error.message}`;
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  // Recent Activities state - Initialize with empty array, will be populated from database
  const [activities, setActivities] = useState([]);

  // Use universal notification system for consistent, real-time badge updates
  const { totalCount, notificationCount, messageCount } = useUniversalNotificationCount({
    autoRefresh: true,
    realTime: true
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

  // Upcoming events popup has been disabled - no automatic popup after login

  // Universal notification system automatically handles real-time updates
  // No manual refresh needed

  const openAddActivityModal = () => {
    // 🚀 FIXED: Web-compatible alert
    const message = 'Add Activity feature is not yet implemented.';
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Add Activity', message);
    }
  };

  const deleteActivity = (idx) => {
    // 🚀 FIXED: Web-compatible confirmation dialog with proper deletion logic
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm('Are you sure you want to delete this activity?');
      if (confirmDelete) {
        setActivities(prevActivities => {
          const updatedActivities = prevActivities.filter((_, i) => i !== idx);
          return updatedActivities;
        });
      }
    } else {
      // Mobile version with Alert.alert
      Alert.alert(
        'Delete Activity', 
        'Are you sure you want to delete this activity?', 
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
              onPress: () => {
              setActivities(prevActivities => {
                const updatedActivities = prevActivities.filter((_, i) => i !== idx);
                return updatedActivities;
              });
            }
          }
        ]
      );
    }
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
            setError(null);
            setLoading(true);
            
            try {
              await Promise.all([
                loadDashboardData(0), // Reset retry count
                loadChartData()
              ]);
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
      
      {/* Floating Refresh Button - Web Only */}
      <FloatingRefreshButton
        onPress={onRefresh}
        refreshing={refreshing}
        bottom={80}
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
          {!featuresReady ? (
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ color: '#666' }}>Loading permissions…</Text>
            </View>
          ) : (
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => {
                const featureKey = getFeatureForQuickAction(action.title);
                const hasAccess = !featureKey || hasFeature(featureKey);
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.quickActionCard,
                      !hasAccess && styles.quickActionCardDisabled
                    ]}
                    onPress={() => {
                      navigateWithFeatureCheck(
                        action.title, 
                        action.screen, 
                        action.action
                      );
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
                  <Text style={[styles.actionTitle, !hasAccess && styles.actionTitleDisabled]}>{action.title}</Text>
                </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>


        {/* Upcoming Events, Exams, or Deadlines */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => {
                
                // Prevent multiple modal opens
                if (!isEventModalVisible) {
                  openAddEventModal();
                } else {
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
                <TouchableOpacity 
                  onPress={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    if (e && e.preventDefault) e.preventDefault();
                    deleteEvent(item);
                  }}
                  style={Platform.OS === 'web' && { cursor: 'pointer' }}
                  activeOpacity={0.7}
                >
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
            {activities.length > 0 ? (
              activities.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Ionicons name={activity.icon} size={16} color="#2196F3" />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>{activity.text}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={(e) => {
                      if (e && e.stopPropagation) e.stopPropagation();
                      if (e && e.preventDefault) e.preventDefault();
                      deleteActivity(index);
                    }}
                    style={[
                      { marginRight: 8 },
                      Platform.OS === 'web' && { cursor: 'pointer' }
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivitiesContainer}>
                <Ionicons name="time-outline" size={48} color="#ddd" />
                <Text style={styles.emptyActivitiesText}>No recent activities</Text>
                <Text style={styles.emptyActivitiesSubtext}>
                  Activities will appear here when students register or make payments
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>


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
  
  // Feature-based access control styles
  quickActionCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  actionTitleDisabled: {
    color: '#999999',
  },
  
  // Empty activities state styles
  emptyActivitiesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyActivitiesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyActivitiesSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },

});

export default AdminDashboard;
