import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar, Alert, Animated, RefreshControl, Image, FlatList, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
// 🚀 ENHANCED TENANT SYSTEM IMPORTS
import { 
  useTenantAccess, 
  tenantDatabase, 
  createTenantQuery,
  getCachedTenantId 
} from '../../utils/tenantHelpers';
// Legacy imports - can be removed after full migration
import { 
  validateTenantAccess, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';
import { StudentTenantFix } from '../../utils/studentTenantFix';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import StudentFeeCard from '../../components/StudentFeeCard';
import LogoDisplay from '../../components/LogoDisplay';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import NotificationPopup from '../../components/NotificationPopup';
import usePullToRefresh from '../../hooks/usePullToRefresh';

import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';
import { getTenantIdByEmail } from '../../utils/getTenantByEmail';

const StudentDashboard = ({ navigation }) => {
  const { user } = useAuth();
  // Legacy tenant context - keeping for backwards compatibility during migration
  const { tenantId, currentTenant } = useTenantContext();
  
  // 🚀 ENHANCED TENANT SYSTEM - Use reliable cached tenant access
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [fallbackTenantId, setFallbackTenantId] = useState(null);
  
  // 🚀 ENHANCED TENANT SYSTEM - Tenant validation helper
  const validateTenantAccess = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    return { valid: true, tenantId };
  };
  const [summary, setSummary] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [fees, setFees] = useState([]);
  const [feeStructure, setFeeStructure] = useState(null);
  const [todayClasses, setTodayClasses] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  
  // Ref for enhanced scroll functionality
  const scrollViewRef = useRef(null);

  // Hook for notification count with auto-refresh
  const { unreadCount: hookUnreadCount, refresh: refreshNotificationCount } = useUnreadNotificationCount('Student');
  
  // Helper function to get effective tenant ID (from context or fallback)
  const getEffectiveTenantId = () => {
    return tenantId || fallbackTenantId;
  };
  
  // Initialize fallback tenant ID if context tenant is missing
  const initializeTenantContext = async () => {
    if (!tenantId && user && !fallbackTenantId) {
      console.log('🔧 StudentDashboard: Tenant context missing, attempting fallback initialization...');
      try {
        const tenantContext = await StudentTenantFix.getStudentTenantContext(user);
        if (tenantContext.tenantId) {
          console.log('✅ StudentDashboard: Fallback tenant initialized:', tenantContext.tenantId);
          setFallbackTenantId(tenantContext.tenantId);
          return tenantContext.tenantId;
        } else {
          console.error('❌ StudentDashboard: Fallback tenant initialization failed:', tenantContext.error);
          setError(tenantContext.error);
          return null;
        }
      } catch (error) {
        console.error('💥 StudentDashboard: Error in fallback tenant initialization:', error);
        setError('Failed to initialize tenant context. Please contact administrator.');
        return null;
      }
    }
    return tenantId;
  };
  
  // Enhanced scroll event handler (simplified for smooth scrolling only)
  const handleScroll = (event) => {
    // This can be used for future scroll-based features if needed
    // Currently just enables smooth scrolling behavior
  };
  
  // Quick navigation to specific sections (enhanced for web)
  const scrollToSection = (yOffset) => {
    if (scrollViewRef.current) {
      if (Platform.OS === 'web') {
        // For web, use a more reliable scrolling method
        try {
          scrollViewRef.current.scrollTo({ 
            y: yOffset, 
            animated: true
          });
        } catch (error) {
          console.warn('Web scroll error:', error);
          // Fallback for web - use native DOM scrolling
          const scrollElement = scrollViewRef.current?.getScrollableNode?.();
          if (scrollElement) {
            scrollElement.scrollTo({ 
              top: yOffset, 
              behavior: 'smooth' 
            });
          }
        }
      } else {
        // Mobile scrolling
        scrollViewRef.current.scrollTo({ 
          y: yOffset, 
          animated: true
        });
      }
    }
  };

  // Utility function to format date from yyyy-mm-dd to dd-mm-yyyy
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      let date;
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else if (dateString.includes('-') && dateString.split('-').length === 3) {
        const [year, month, day] = dateString.split('-');
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return dateString;
    }
  };

  // Handle navigation for stat cards
  const handleCardNavigation = (cardKey) => {
    switch (cardKey) {
      case 'assignments':
        navigation.navigate('Assignments');
        break;
      case 'attendance':
        navigation.navigate('Attendance');
        break;
      case 'marks':
        navigation.navigate('Marks', { activeTab: 'marks' });
        break;
      case 'notifications':
        navigation.navigate('StudentNotifications');
        break;
      case 'fees':
        navigation.navigate('StudentFeePayment');
        break;
      case 'events':
        Alert.alert('Events', events.length > 0 ?
          events.map(e => `• ${e.title} (${formatDateToDDMMYYYY(e.date)})`).join('\n') :
          'No upcoming events scheduled.'
        );
        break;
      default:
        Alert.alert('Coming Soon', `${cardKey} feature is under development.`);
    }
  };

  // Handle notification bell icon press
  const handleNotificationsPress = () => {
    navigation.navigate('StudentNotifications');
  };

  // Handle individual notification press from popup
  const handleNotificationPress = (notification) => {
    console.log('Notification pressed:', notification);
    // You can add custom navigation or action based on notification type
    switch (notification.type) {
      case 'assignment':
        navigation.navigate('Assignments');
        break;
      case 'grade':
        navigation.navigate('Marks', { activeTab: 'marks' });
        break;
      case 'attendance':
        navigation.navigate('Attendance');
        break;
      case 'fee':
        navigation.navigate('StudentFeePayment');
        break;
      case 'announcement':
        navigation.navigate('StudentNotifications');
        break;
      default:
        navigation.navigate('StudentNotifications');
    }
  };

  // Custom right component for header with NotificationPopup and Profile
  const renderRightComponent = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <NotificationPopup
        userType="Student"
        onNotificationPress={handleNotificationPress}
        iconSize={24}
        iconColor="#333"
      />
      {user && (
        <TouchableOpacity 
          onPress={() => {
            try {
              navigation.navigate('Profile');
            } catch (error) {
              console.warn('Profile navigation failed:', error);
              try {
                navigation.navigate('Settings');
              } catch (settingsError) {
                console.warn('Settings navigation also failed:', settingsError);
              }
            }
          }} 
          style={styles.profileButtonCustom}
          activeOpacity={0.7}
        >
          {studentProfile?.profile_url ? (
            <Image 
              source={{ uri: studentProfile.profile_url }} 
              style={styles.profileImageCustom}
              onError={() => setStudentProfile(prev => ({ ...prev, profile_url: null }))}
            />
          ) : (
            <Ionicons name="person-circle" size={32} color="#2196F3" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // Function to fetch only assignments data (for focus refresh)
  const fetchAssignmentsData = async () => {
    try {
      if (!user?.linked_student_id) {
        console.log('Student Dashboard - No linked student ID available');
        return;
      }

      // Check if tenant context is available, if not try to resolve it
      let effectiveTenantId = tenantId;
      if (!effectiveTenantId) {
        console.log('🔍 Student Dashboard - No tenant context, attempting to resolve from user email...');
        
        try {
          // Using regular import declared at the top of the file
          const emailTenantResult = await getTenantIdByEmail(user.email);
          
          if (emailTenantResult.success) {
            effectiveTenantId = emailTenantResult.data.tenant.id;
            console.log('✅ Student Dashboard - Successfully resolved tenant via email:', effectiveTenantId);
          } else {
            console.error('❌ Student Dashboard - Email-based tenant resolution failed:', emailTenantResult.error);
            return;
          }
        } catch (emailLookupError) {
          console.error('❌ Student Dashboard - Error during email-based tenant lookup:', emailLookupError);
          return;
        }
      }

      // Validate tenant access before proceeding (with resolved tenant ID)
      const tenantValidation = await validateTenantAccess(effectiveTenantId, user.id, 'StudentDashboard-FetchAssignments');
      if (!tenantValidation.isValid) {
        console.error('❌ Student dashboard tenant validation failed:', tenantValidation.error);
        return; // Silent return for better UX
      }

      // Get student data with direct Supabase query
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, class_id, tenant_id')
        .eq('tenant_id', effectiveTenantId)
        .eq('id', user.linked_student_id)
        .single();

      if (studentError) {
        console.log('Dashboard - Student fetch error for assignments:', studentError);
        return;
      }
      
      // Validate student data belongs to correct tenant
      const studentValidation = validateDataTenancy([{ 
        id: studentData.id, 
        tenant_id: studentData.tenant_id 
      }], effectiveTenantId, 'StudentDashboard-FetchAssignments');
      
      if (!studentValidation) {
        console.error('❌ Student data validation failed: Student data does not belong to tenant', effectiveTenantId);
        return;
      }

      let allAssignments = [];

      // Get assignments from assignments table with direct query
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from(TABLES.ASSIGNMENTS)
        .select('*, tenant_id')
        .eq('tenant_id', effectiveTenantId)
        .eq('class_id', studentData.class_id)
        .order('due_date', { ascending: true });

      if (assignmentsError && assignmentsError.code !== '42P01') {
        console.log('Dashboard - Assignments refresh error:', assignmentsError);
      } else if (assignmentsData) {
        allAssignments = [...allAssignments, ...assignmentsData];
      }

      // Get homeworks from homeworks table with direct query
      const { data: homeworksData, error: homeworksError } = await supabase
        .from(TABLES.HOMEWORKS)
        .select('*, tenant_id')
        .eq('tenant_id', effectiveTenantId)
        .or(`class_id.eq.${studentData.class_id},assigned_students.cs.{${studentData.id}}`)
        .order('due_date', { ascending: true });

      if (homeworksError && homeworksError.code !== '42P01') {
        console.log('Dashboard - Homeworks refresh error:', homeworksError);
      } else if (homeworksData) {
        allAssignments = [...allAssignments, ...homeworksData];
      }

      // Get existing submissions for this student with direct query
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*, tenant_id')
        .eq('tenant_id', effectiveTenantId)
        .eq('student_id', studentData.id);

      if (submissionsError && submissionsError.code !== '42P01') {
        console.log('Dashboard - Submissions refresh error:', submissionsError);
      }

      // Filter assignments to only include pending ones
      const submittedAssignmentIds = new Set();
      if (submissionsData) {
        submissionsData.forEach(submission => {
          submittedAssignmentIds.add(submission.assignment_id);
        });
      }

      // Filter to only include pending assignments
      const pendingAssignments = allAssignments.filter(assignment => 
        !submittedAssignmentIds.has(assignment.id) && 
        new Date(assignment.due_date) >= new Date()
      );

      console.log('Dashboard - Focus refresh pending assignments count:', pendingAssignments.length);
      setAssignments(pendingAssignments);
    } catch (err) {
      console.log('Dashboard - Assignments focus refresh error:', err);
      setAssignments([]);
    }
  };

  // Function to refresh notifications for badge count
  const refreshNotifications = async () => {
    try {
      if (!user?.id) {
        console.log('Student Dashboard - No user ID available');
        return;
      }
      
      // Check if tenant context is available, if not try to resolve it
      let effectiveTenantId = tenantId;
      if (!effectiveTenantId) {
        console.log('🔍 Student Dashboard - No tenant context for notifications, attempting to resolve from user email...');
        
        try {
          // Using regular import declared at the top of the file
          const emailTenantResult = await getTenantIdByEmail(user.email);
          
          if (emailTenantResult.success) {
            effectiveTenantId = emailTenantResult.data.tenant.id;
            console.log('✅ Student Dashboard - Successfully resolved tenant via email for notifications:', effectiveTenantId);
          } else {
            console.error('❌ Student Dashboard - Email-based tenant resolution failed for notifications:', emailTenantResult.error);
            return;
          }
        } catch (emailLookupError) {
          console.error('❌ Student Dashboard - Error during email-based tenant lookup for notifications:', emailLookupError);
          return;
        }
      }
      
      // Validate tenant access before refreshing notifications (with resolved tenant ID)
      const tenantValidation = await validateTenantAccess(effectiveTenantId, user.id, 'StudentDashboard-RefreshNotifications');
      if (!tenantValidation.isValid) {
        console.error('❌ Student dashboard notification validation failed:', tenantValidation.error);
        return; // Silent return for better UX
      }
      
      console.log('Dashboard: Refreshing notifications for user:', user.id);
      
      // Fetch notifications with recipient info using tenant-aware query
      const tenantNotificationQuery = createTenantQuery(effectiveTenantId, 'notification_recipients');
      const { data: notificationsData, error: notifError } = await tenantNotificationQuery
        .select(`
          id,
          is_read,
          read_at,
          tenant_id,
          notifications!inner (
            id,
            message,
            type,
            created_at,
            sent_by,
            delivery_status,
            delivery_mode,
            tenant_id
          )
        `)
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'Student')
        .order('created_at', { ascending: false, foreignTable: 'notifications' })
        .limit(10);
      
      if (notifError && notifError.code !== '42P01') {
        console.log('Dashboard - Notifications fetch error:', notifError);
        setNotifications([]);
        return;
      }

      if (!notificationsData || notificationsData.length === 0) {
        console.log('Dashboard - No notifications found');
        setNotifications([]);
        return;
      }

      // Update delivery status to 'Sent' for any InApp notifications that are still 'Pending'
      const pendingNotifications = notificationsData.filter(n => 
        n.notifications.delivery_status === 'Pending' && n.notifications.delivery_mode === 'InApp'
      );
      
      if (pendingNotifications.length > 0) {
        console.log(`Dashboard - Updating ${pendingNotifications.length} notifications from Pending to Sent status`);
        
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            delivery_status: 'Sent',
            sent_at: new Date().toISOString()
          })
          .in('id', pendingNotifications.map(n => n.notifications.id))
          .eq('delivery_mode', 'InApp');
        
        if (updateError) {
          console.error('Dashboard - Error updating notification status:', updateError);
        } else {
          console.log('Dashboard - Successfully updated notification delivery status');
          // Update the local data to reflect the change
          notificationsData.forEach(n => {
            if (pendingNotifications.some(p => p.notifications.id === n.notifications.id)) {
              n.notifications.delivery_status = 'Sent';
              n.notifications.sent_at = new Date().toISOString();
            }
          });
        }
      }

      // Filter out leave notifications (same logic as StudentNotifications screen)
      const filteredNotifications = notificationsData.filter(notification => {
        const message = notification.notifications.message.toLowerCase();
        const isLeaveNotification = message.includes('leave') || 
                                   message.includes('absent') || 
                                   message.includes('vacation') || 
                                   message.includes('sick') ||
                                   message.includes('time off');
        return !isLeaveNotification;
      });

      // Transform notifications for dashboard display
      const transformedNotifications = filteredNotifications.map(notification => {
        const notif = notification.notifications;
        return {
          id: notif.id,
          title: notif.message.substring(0, 50) + (notif.message.length > 50 ? '...' : ''),
          message: notif.message,
          type: notif.type || 'General',
          created_at: notif.created_at,
          is_read: notification.is_read || false,
          read_at: notification.read_at,
          sender: null // No sender info in this simplified approach
        };
      });

      console.log(`Dashboard - Found ${transformedNotifications.length} notifications, unread: ${transformedNotifications.filter(n => !n.is_read).length}`);
      setNotifications(transformedNotifications);
    } catch (err) {
      console.log('Dashboard - Notifications refresh fetch error:', err);
      setNotifications([]);
    }
  };

  // Add focus effect to refresh notifications and assignments when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('Student Dashboard - Screen focused, refreshing data...');
        refreshNotifications();
        // Only refresh assignments data without full dashboard reload
        fetchAssignmentsData();
      }
    }, [user])
  );

  // Add broadcast listener for notification updates
  useEffect(() => {
    if (!user?.id) return;
    
    // Listen for notification update broadcasts
    const notificationUpdateChannel = supabase
      .channel('notification-update')
      .on('broadcast', { event: 'notification-read' }, (payload) => {
        console.log('📣 StudentDashboard received notification update broadcast:', payload);
        if (payload.payload.user_id === user.id) {
          console.log('📣 Notification update is for current user, refreshing dashboard notifications');
          // Refresh notifications when a notification is marked as read
          setTimeout(() => {
            refreshNotifications();
          }, 300); // Small delay to ensure database is updated
        }
      })
      .subscribe();
    
    return () => {
      notificationUpdateChannel.unsubscribe();
    };
  }, [user?.id, refreshNotifications]);

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchDashboardData();
  });

  // 🚀 ENHANCED: Fetch all dashboard data with enhanced tenant system
  const fetchDashboardData = async () => {
    try {
      console.log('🚀 Enhanced StudentDashboard - Starting data fetch...');
      console.log('🚀 User data:', { id: user?.id, email: user?.email, linked_student_id: user?.linked_student_id });
      
      setLoading(true);
      setError(null);

      // Check if tenant context is available, if not try to resolve it
      let effectiveTenantId = tenantId;
      if (!effectiveTenantId) {
        console.log('🔍 Student Dashboard - No tenant context for main data fetch, attempting to resolve from user email...');
        
        try {
          // Using regular import declared at the top of the file
          const emailTenantResult = await getTenantIdByEmail(user.email);
          
          if (emailTenantResult.success) {
            effectiveTenantId = emailTenantResult.data.tenant.id;
            console.log('✅ Student Dashboard - Successfully resolved tenant via email for main data fetch:', effectiveTenantId);
          } else {
            console.error('❌ Student Dashboard - Email-based tenant resolution failed for main data fetch:', emailTenantResult.error);
            setError('Unable to determine school context. Please contact administrator.');
            Alert.alert('Access Error', 'Unable to determine school context. Please contact administrator.');
            return;
          }
        } catch (emailLookupError) {
          console.error('❌ Student Dashboard - Error during email-based tenant lookup for main data fetch:', emailLookupError);
          setError('Unable to determine school context. Please contact administrator.');
          Alert.alert('Access Error', 'Unable to determine school context. Please contact administrator.');
          return;
        }
      }

      // Validate tenant access before proceeding (with resolved tenant ID)
      const tenantValidation = await validateTenantAccess(effectiveTenantId, user.id, 'StudentDashboard-MainDataFetch');
      if (!tenantValidation.isValid) {
        console.error('❌ Student dashboard tenant validation failed:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        setError(tenantValidation.error);
        setLoading(false);
        return;
      }
      
      const tenantId = validation.tenantId;
      console.log('🚀 Enhanced tenant system: Using cached tenant ID:', tenantId);

      // Get school details
      const { data: schoolData } = await dbHelpers.getSchoolDetails();
      setSchoolDetails(schoolData);

      // Get student profile with user data for profile picture and email using direct Supabase query
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section),
          parents:parent_id(name, phone, email),
          tenant_id
        `)
        .eq('tenant_id', effectiveTenantId)
        .eq('id', user.linked_student_id)
        .single();

      // Also get the student's own user account for profile picture using direct Supabase query
      const { data: studentUserData, error: studentUserError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, phone, profile_url, full_name, tenant_id')
        .eq('tenant_id', effectiveTenantId)
        .eq('linked_student_id', user.linked_student_id)
        .maybeSingle();

      if (studentError) {
        throw new Error('Student profile not found. Please contact administrator.');
      }
      
      // Validate student data belongs to correct tenant
      const studentValidation = validateDataTenancy([{ 
        id: studentData.id, 
        tenant_id: studentData.tenant_id 
      }], effectiveTenantId, 'StudentDashboard');
      
      if (!studentValidation) {
        console.error('❌ Student profile data validation failed: Student data does not belong to tenant', effectiveTenantId);
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.WRONG_TENANT_DATA);
        setLoading(false);
        return;
      }

      // Merge student data with user data for complete profile
      const completeStudentProfile = {
        ...studentData,
        // Use student's own user account data if available, otherwise use parent data
        profile_url: studentUserData?.profile_url || studentData.users?.profile_url,
        email: studentUserData?.email || studentData.users?.email,
        user_phone: studentUserData?.phone || studentData.users?.phone,
        user_full_name: studentUserData?.full_name || studentData.users?.full_name
      };

      setStudentProfile(completeStudentProfile);

      // Get notifications
      await refreshNotifications();

      // Get upcoming events using direct Supabase query
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: upcomingEventsData, error: eventsError } = await supabase
          .from('events')
          .select('*, tenant_id')
          .eq('tenant_id', effectiveTenantId)
          .eq('status', 'Active')
          .gte('event_date', today)
          .order('event_date', { ascending: true });

        if (eventsError) {
          console.error('Events query error:', eventsError);
        }

        const mappedEvents = (upcomingEventsData || []).map(event => ({
          id: event.id,
          title: event.title,
          description: event.description || '',
          date: event.event_date,
          time: event.start_time || '09:00',
          icon: event.icon || 'calendar',
          color: event.color || '#FF9800',
          location: event.location,
          organizer: event.organizer
        }));

        setEvents(mappedEvents.slice(0, 5));
      } catch (err) {
        console.log('Events fetch error:', err);
        setEvents([]);
      }

      // Get attendance data
      try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        console.log(`Dashboard - Fetching attendance for ${year}-${month.toString().padStart(2, '0')}`);

        const { data: allAttendanceData, error: attendanceError } = await supabase
          .from(TABLES.STUDENT_ATTENDANCE)
          .select('*, tenant_id')
          .eq('tenant_id', effectiveTenantId)
          .eq('student_id', studentData.id)
          .order('date', { ascending: false });

      if (attendanceError) {
          console.log('Attendance fetch error:', attendanceError);
          setAttendance([]);
        } else {
          // Filter for current month records
          const currentMonthRecords = (allAttendanceData || []).filter(record => {
            if (!record.date || typeof record.date !== 'string') return false;
            
            const dateParts = record.date.split('-');
            if (dateParts.length < 3) return false;
            
            const recordYear = parseInt(dateParts[0], 10);
            const recordMonth = parseInt(dateParts[1], 10);
            
            if (isNaN(recordYear) || isNaN(recordMonth)) return false;
            
            return recordYear === year && recordMonth === month;
          });

          console.log(`Dashboard - Found ${currentMonthRecords.length} attendance records for current month`);
          console.log('Sample attendance records:', currentMonthRecords.slice(0, 3));
          setAttendance(currentMonthRecords);
        }
      } catch (err) {
        console.log('Attendance fetch error:', err);
        setAttendance([]);
      }

      // Get marks data
      try {
        const { data: marksData, error: marksError } = await supabase
          .from(TABLES.MARKS)
          .select(`
            *,
            subjects(name),
            exams(name, start_date),
            tenant_id
          `)
          .eq('tenant_id', effectiveTenantId)
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (marksError && marksError.code !== '42P01') {
          console.log('Marks error:', marksError);
          setMarks([]);
        } else {
          console.log(`Dashboard - Found ${marksData?.length || 0} marks records`);
          console.log('Sample marks data:', marksData?.slice(0, 3));
          
          // Validate marks data
          const validMarks = (marksData || []).filter(mark => {
            const marksObtained = Number(mark.marks_obtained);
            const maxMarks = Number(mark.max_marks);
            const isValid = !isNaN(marksObtained) && !isNaN(maxMarks) && maxMarks > 0 && marksObtained >= 0;
            
            if (!isValid) {
              console.log('Invalid mark record:', {
                id: mark.id,
                marks_obtained: mark.marks_obtained,
                max_marks: mark.max_marks,
                subject: mark.subjects?.name
              });
            }
            
            return isValid;
          });
          
          console.log(`Dashboard - Valid marks: ${validMarks.length}/${marksData?.length || 0}`);
          setMarks(validMarks);
        }
      } catch (err) {
        console.log('Marks fetch error:', err);
        setMarks([]);
      }

      // Get fee information using student_fee_summary view (same as Fee Payment screen)
      try {
        console.log('StudentDashboard - Loading fee data from student_fee_summary view...');
        
        const { data: feeData, error: feeError } = await supabase
          .from('student_fee_summary')
          .select('*')
          .eq('student_id', user.linked_student_id)
          .single();

        if (feeError) {
          console.error('StudentDashboard - Error loading fee data:', feeError);
          // Check if student has no fee data vs actual error
          if (feeError.code === 'PGRST116') {
            console.log('StudentDashboard - No fee data found for student, showing empty state');
            setFeeStructure({
              studentName: studentData.name,
              class: `${studentData.classes?.class_name || 'N/A'} ${studentData.classes?.section || ''}`.trim(),
              academicYear: studentData.academic_year || '2024-2025',
              totalDue: 0,
              totalPaid: 0,
              outstanding: 0,
              fees: [],
              metadata: { source: 'no-fee-data' }
            });
            setFees([]);
          } else {
            throw feeError;
          }
        } else {
          console.log('StudentDashboard - Fee data loaded from view:', feeData);

          // Transform fee components from JSON to array format (same as Fee Payment screen)
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
              lastPaymentDate: component.last_payment_date
            };
          });

          // Set fee structure using data from student_fee_summary view (SAME AS FEE PAYMENT SCREEN)
          setFeeStructure({
            studentName: feeData.student_name,
            class: `${feeData.class_name || 'N/A'} ${feeData.section || ''}`.trim(),
            academicYear: feeData.academic_year || '2024-2025',
            admissionNo: feeData.admission_no,
            rollNo: feeData.roll_no,
            // Fee totals from view
            totalBaseFees: Number(feeData.total_base_fees) || 0,
            totalDiscounts: Number(feeData.total_discounts) || 0,
            totalDue: Number(feeData.total_final_fees) || 0,
            totalPaid: Number(feeData.total_paid) || 0,
            outstanding: Number(feeData.total_outstanding) || 0, // THIS IS THE CORRECT VALUE!
            fees: transformedFees,
            // Status and metadata
            overallStatus: feeData.overall_status,
            hasDiscounts: feeData.has_any_discounts,
            totalFeeComponents: feeData.total_fee_components || 0,
            calculatedAt: feeData.calculated_at,
            metadata: { source: 'student_fee_summary_view', tenantId: feeData.tenant_id }
          });
          
          setFees(transformedFees);
          console.log('StudentDashboard - Fee structure set with outstanding:', feeData.total_outstanding);
        }
      } catch (err) {
        console.error('StudentDashboard - Fee calculation error:', err);
        setFeeStructure(null);
        setFees([]);
      }

      // Get today's classes using enhanced tenant system
      try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const timetableQuery = createTenantQuery(effectiveTenantId, TABLES.TIMETABLE)
          .select(`
            *,
            subjects(name),
            classes(class_name, section)
          `)
          .eq('class_id', studentData.class_id)
          .eq('day', today)
          .order('start_time', { ascending: true });

        const { data: timetableData, error: timetableError } = await timetableQuery;
        if (timetableError && timetableError.code !== '42P01') {
          console.log('Timetable error:', timetableError);
        }
        setTodayClasses(timetableData || []);
        console.log('Dashboard - Enhanced tenant-aware today\'s classes loaded:', timetableData?.length || 0);
      } catch (err) {
        console.log('Timetable fetch error:', err);
        setTodayClasses([]);
      }

      // Get recent activities using enhanced tenant system
      try {
        const activitiesQuery = createTenantQuery(effectiveTenantId, TABLES.NOTIFICATIONS)
          .select('*')
          .eq('status', 'Active')
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: activitiesData, error: activitiesError } = await activitiesQuery;
        if (activitiesError && activitiesError.code !== '42P01') {
          console.log('Activities error:', activitiesError);
        }
        setRecentActivities(activitiesData || []);
        console.log('Dashboard - Enhanced tenant-aware activities loaded:', activitiesData?.length || 0);
      } catch (err) {
        console.log('Activities fetch error:', err);
        setRecentActivities([]);
      }

      // Get assignments for student
      try {
        let allAssignments = [];

        // Get assignments from assignments table using enhanced tenant system
        const assignmentsQuery = createTenantQuery(effectiveTenantId, TABLES.ASSIGNMENTS)
          .select('*')
          .eq('class_id', studentData.class_id)
          .order('due_date', { ascending: true });

        const { data: assignmentsData, error: assignmentsError } = await assignmentsQuery;
        if (assignmentsError && assignmentsError.code !== '42P01') {
          console.log('Dashboard - Assignments error:', assignmentsError);
        } else if (assignmentsData) {
          allAssignments = [...allAssignments, ...assignmentsData];
        }

        // Get homeworks from homeworks table using enhanced tenant system
        const homeworksQuery = createTenantQuery(effectiveTenantId, TABLES.HOMEWORKS)
          .select('*')
          .or(`class_id.eq.${studentData.class_id},assigned_students.cs.{${studentData.id}}`)
          .order('due_date', { ascending: true });

        const { data: homeworksData, error: homeworksError } = await homeworksQuery;
        if (homeworksError && homeworksError.code !== '42P01') {
          console.log('Dashboard - Homeworks error:', homeworksError);
        } else if (homeworksData) {
          allAssignments = [...allAssignments, ...homeworksData];
        }

        // Get existing submissions for this student using enhanced tenant system
        const submissionsQuery = createTenantQuery(effectiveTenantId, 'assignment_submissions')
          .select('*')
          .eq('student_id', studentData.id);

        const { data: submissionsData, error: submissionsError } = await submissionsQuery;

        if (submissionsError && submissionsError.code !== '42P01') {
          console.log('Dashboard - Submissions error:', submissionsError);
        }

        // Filter assignments to only include pending ones
        const submittedAssignmentIds = new Set();
        if (submissionsData) {
          submissionsData.forEach(submission => {
            submittedAssignmentIds.add(submission.assignment_id);
          });
        }

        // Filter to only include pending assignments
        const pendingAssignments = allAssignments.filter(assignment => 
          !submittedAssignmentIds.has(assignment.id) && 
          new Date(assignment.due_date) >= new Date() // Only include assignments not past due date
        );

        console.log('Dashboard - Enhanced tenant-aware pending assignments count:', pendingAssignments.length);
        setAssignments(pendingAssignments);
      } catch (err) {
        console.log('Dashboard - Assignments fetch error:', err);
        setAssignments([]);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // 🚀 ENHANCED: Wait for both user and tenant readiness
  useEffect(() => {
    console.log('🚀 Enhanced StudentDashboard useEffect triggered');
    console.log('🚀 User state:', user);
    console.log('🚀 Tenant ready:', isReady);
    if (user && isReady) {
      console.log('🚀 User and tenant ready, starting enhanced dashboard data fetch...');
      fetchDashboardData();
    } else {
      console.log('⚠️ Waiting for user and tenant context...');
    }
  }, [user, isReady]);

  // Use the hook's unread count instead of calculating from local state
  const unreadCount = hookUnreadCount;
  
  // Debug unread count from hook
  console.log('Dashboard - Using hook unread count:', {
    hookUnreadCount: hookUnreadCount,
    localNotificationsCount: notifications.length,
    localUnreadCount: notifications.filter(notification => !notification.is_read).length
  });
  
  // Calculate attendance percentage
  const totalRecords = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'Present').length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  // Calculate attendance data for pie chart
  const attendancePieData = [
    {
      name: 'Present',
      population: presentCount,
      color: '#4CAF50',
      legendFontColor: '#333',
      legendFontSize: 14
    },
    {
      name: 'Absent',
      population: totalRecords - presentCount,
      color: '#F44336',
      legendFontColor: '#333',
      legendFontSize: 14
    },
  ];

  // Get fee status using feeStructure (same as Fee Payment screen)
  const getFeeStatus = () => {
    if (!feeStructure) {
      return 'Loading...';
    }
    
    if (feeStructure.totalDue === 0) {
      return 'No fees';
    }
    
    // Use the outstanding amount directly from the view (same as Fee Payment screen)
    return `₹${feeStructure.outstanding.toLocaleString()}`;
  };

  // Get fee status color for UI
  const getFeeStatusColorForUI = () => {
    if (!feeStructure || feeStructure.totalDue === 0) {
      return '#4CAF50'; // Green for no fees or paid
    }
    
    if (feeStructure.outstanding > 0) {
      return '#F44336'; // Red for outstanding
    }
    
    return '#4CAF50'; // Green for paid
  };

  // Get average marks
  const getAverageMarks = () => {
    if (marks.length === 0) return 'No marks';
    
    // Calculate average of individual percentages rather than total marks
    const validMarks = marks.filter(mark => {
      const marksObtained = Number(mark.marks_obtained);
      const maxMarks = Number(mark.max_marks);
      return !isNaN(marksObtained) && !isNaN(maxMarks) && maxMarks > 0 && marksObtained >= 0;
    });
    
    if (validMarks.length === 0) return 'No valid marks';
    
    const percentages = validMarks.map(mark => {
      const marksObtained = Number(mark.marks_obtained);
      const maxMarks = Number(mark.max_marks);
      return (marksObtained / maxMarks) * 100;
    });
    
    const averagePercentage = percentages.reduce((sum, perc) => sum + perc, 0) / percentages.length;
    
    console.log('Dashboard - Average marks calculation:', {
      totalMarks: validMarks.length,
      percentages: percentages.slice(0, 3),
      average: averagePercentage
    });
    
    return `${Math.round(averagePercentage)}%`;
  };

  // Student stats for the dashboard
  const studentStats = [
    {
      title: 'Attendance',
      value: `${attendancePercentage}%`,
      icon: 'checkmark-circle',
      color: attendancePercentage >= 75 ? '#4CAF50' : attendancePercentage >= 60 ? '#FF9800' : '#F44336',
      subtitle: `${presentCount}/${totalRecords} days present`,
      onPress: () => handleCardNavigation('attendance')
    },
    {
      title: 'Fee Status',
      value: getFeeStatus(),
      icon: 'card',
      color: getFeeStatusColorForUI(),
      subtitle: (() => {
        if (!feeStructure) return 'Loading fee data...';
        if (feeStructure.totalDue === 0) return 'No fees assigned';
        
        const totalOutstanding = feeStructure.outstanding || 0;
        
        if (totalOutstanding > 0) {
          return 'Outstanding amount';
        }
        
        return 'All fees paid';
      })(),
      onPress: () => handleCardNavigation('fees')
    },
    {
      title: 'Average Marks',
      value: getAverageMarks(),
      icon: 'document-text',
      color: '#2196F3',
      subtitle: marks.length > 0 ? `${marks.length} subjects` : 'No marks',
      onPress: () => handleCardNavigation('marks')
    },
    {
      title: 'Assignments',
      value: assignments.length.toString(),
      icon: 'library',
      color: '#9C27B0',
      subtitle: assignments.length === 0 ? 'No pending assignments' : 
                assignments.length === 1 ? '1 pending assignment' : 
                `${assignments.length} pending assignments`,
      onPress: () => handleCardNavigation('assignments')
    },
  ];

  if (loading) {
    console.log('🔄 StudentDashboard - Showing loading state');
    return (
    <View style={styles.container}>
        <Header
          title="Student Dashboard"
          showBack={false}
          showNotifications={true}
          unreadCount={unreadCount}
          onNotificationsPress={handleNotificationsPress}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    console.log('❌ StudentDashboard - Showing error state:', error);
    return (
      <View style={styles.container}>
        <Header title="Student Dashboard" showBack={false} showNotifications={true} unreadCount={unreadCount} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>Failed to load dashboard</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Student Dashboard"
        showBack={false}
        rightComponent={renderRightComponent}
      />

      <View style={styles.scrollWrapper}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1976d2', '#4CAF50']}
              tintColor="#1976d2"
              title="Pull to refresh dashboard"
              titleColor="#666"
            />
          }
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
          scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
          onScroll={handleScroll}
          decelerationRate={Platform.OS === 'ios' ? 0.998 : 'normal'}
          // Enhanced accessibility
          accessible={true}
          accessibilityLabel="Student dashboard scroll view"
          accessibilityHint="Scroll to view your academic information and activities"
          // Web-specific optimizations
          {...(Platform.OS === 'web' && {
            style: {
              ...styles.scrollContainer,
              scrollBehavior: 'smooth',
            }
          })}
        >

        {/* School Details Card */}
        {schoolDetails && (
          <View style={styles.schoolDetailsSection}>
          <View style={styles.backgroundCircle1} />
          <View style={styles.backgroundCircle2} />
          <View style={styles.backgroundPattern} />
          
          <View style={styles.welcomeContent}>
            <View style={styles.schoolHeader}>
              <LogoDisplay 
                logoUrl={schoolDetails?.logo_url} 
                onImageError={() => {
                  console.log('🗓️ Logo image failed to load, using placeholder');
                }}
              />
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
                <Text style={styles.schoolDateText}>
                  {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
                  })}
                </Text>
            </View>
          </View>
        </View>
        )}

        {/* Student Profile Card */}
        <TouchableOpacity style={styles.studentCard} onPress={() => setShowStudentDetailsModal(true)} activeOpacity={0.85}>
          <View style={styles.studentCardRow}>
            <Image 
              source={studentProfile?.profile_url ? { uri: studentProfile.profile_url } : require('../../../assets/icon.png')} 
              style={styles.studentAvatar} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.studentCardName}>
                {studentProfile?.name || 'Student Name'}
              </Text>
              <Text style={styles.studentCardClass}>
                {studentProfile?.classes ? 
                  `${studentProfile.classes.class_name} ${studentProfile.classes.section}` : 
                  'Class N/A'
                } • Roll No: {studentProfile?.roll_no || 'N/A'}
              </Text>
              </View>
            <Ionicons name="chevron-forward" size={28} color="#bbb" />
              </View>
        </TouchableOpacity>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="analytics" size={20} color="#1976d2" />
            <Text style={styles.statsSectionTitle}>Quick Overview</Text>
            </View>

          <View style={styles.statsColumnContainer}>
            {studentStats.map((stat, index) => (
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
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="flash" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
              <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleCardNavigation('assignments')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="library" size={24} color="#fff" />
                </View>
              <Text style={styles.actionTitle}>Assignments</Text>
              <Text style={styles.actionSubtitle}>View homework</Text>
              </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleCardNavigation('attendance')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
        </View>
              <Text style={styles.actionTitle}>Attendance</Text>
              <Text style={styles.actionSubtitle}>View records</Text>
            </TouchableOpacity>

              <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleCardNavigation('marks')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="document-text" size={24} color="#fff" />
                </View>
              <Text style={styles.actionTitle}>Marks</Text>
              <Text style={styles.actionSubtitle}>View grades</Text>
              </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleCardNavigation('notifications')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="notifications" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Notifications</Text>
              <Text style={styles.actionSubtitle}>View updates</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Classes */}
        {todayClasses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIcon}>
                <Ionicons name="time" size={20} color="#1976d2" />
            </View>
              <Text style={styles.sectionTitle}>Today's Classes</Text>
            </View>
            <View style={styles.classesContainer}>
              {todayClasses.map((classItem, index) => (
                <View key={index} style={styles.classItem}>
                  <View style={[styles.classIcon, { backgroundColor: '#e3f2fd' }]}>
                    <Ionicons name="book" size={20} color="#1976d2" />
                  </View>
                  <View style={styles.classInfo}>
                    <Text style={styles.classSubject}>
                      {classItem.subjects?.name || 'Subject'}
                    </Text>
                    <Text style={styles.classTime}>
                      {classItem.start_time} - {classItem.end_time}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Attendance Analytics */}
        {attendance.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIcon}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              </View>
              <Text style={styles.sectionTitle}>This Month's Attendance</Text>
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
                  Present: {presentCount} days | Absent: {totalRecords - presentCount} days
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Marks */}
        {marks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIcon}>
                <Ionicons name="document-text" size={20} color="#2196F3" />
              </View>
              <Text style={styles.sectionTitle}>Recent Marks</Text>
              <TouchableOpacity onPress={() => handleCardNavigation('marks')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.marksContainer}>
              {marks.slice(0, 3).map((mark, index) => {
                const marksObtained = Number(mark.marks_obtained) || 0;
                const maxMarks = Number(mark.max_marks) || 1;
                const percentage = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100) : 0;
                const ratio = maxMarks > 0 ? (marksObtained / maxMarks) : 0;
                
                return (
                  <View key={index} style={styles.markCard}>
                    <View style={styles.markHeader}>
                      <Text style={styles.markSubject}>
                        {mark.subjects?.name || 'Subject'}
                      </Text>
                      <View style={[
                        styles.markGrade,
                        { backgroundColor: ratio >= 0.9 ? '#4CAF50' :
                                          ratio >= 0.75 ? '#FF9800' : '#F44336' }
                      ]}>
                        <Text style={styles.markGradeText}>
                          {percentage}%
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.markDetails}>
                      {marksObtained}/{maxMarks} marks
                    </Text>
                    <Text style={styles.markExam}>
                      {mark.exams?.name || 'Exam'} • {formatDateToDDMMYYYY(mark.exams?.start_date || mark.created_at)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Upcoming Events */}
        {events.length > 0 && (
          <View style={[styles.section, { marginBottom: 28 }]}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIcon}>
                <Ionicons name="calendar" size={20} color="#FF9800" />
              </View>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
            </View>
            <View style={styles.eventsContainer}>
              {events.map((event, index) => (
                <View key={index} style={styles.eventCard}>
                  <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
                    <Ionicons name={event.icon} size={20} color="#fff" />
        </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{event.title || 'Not available'}</Text>
                    <Text style={styles.eventDescription}>{event.description || 'Not available'}</Text>
                    <Text style={styles.eventDateTime}>
                      {event.date ? formatDateToDDMMYYYY(event.date) : 'Not available'} • {event.time || 'Not available'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
        {/* Recent Activities */}
        {recentActivities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIcon}>
                <Ionicons name="activity" size={20} color="#4CAF50" />
              </View>
              <Text style={styles.sectionTitle}>Recent Activities</Text>
            </View>
            <View style={styles.activitiesContainer}>
              {recentActivities.map((activity, index) => (
                <View key={index} style={styles.activityCard}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="megaphone" size={20} color="#1976d2" />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{activity.title || 'Announcement'}</Text>
                    <Text style={styles.activityDescription}>{activity.message}</Text>
                    <Text style={styles.activityTime}>
                      {formatDateToDDMMYYYY(activity.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        </ScrollView>
      </View>

      {/* Student Details Modal */}
      {showStudentDetailsModal && (
        <Modal
          visible={showStudentDetailsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowStudentDetailsModal(false)}
        >
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
                  <Image
                    source={studentProfile?.profile_url ? { uri: studentProfile.profile_url } : require('../../../assets/icon.png')}
                    style={styles.studentAvatarLarge}
                  />
                </View>
                {/* Basic Information */}
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Name:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.name || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Student ID:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.id || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Admission Number:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.admission_no || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Roll Number:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.roll_no || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Class:</Text>
                  <Text style={styles.detailsValue}>
                    {studentProfile?.classes ?
                      `${studentProfile.classes.class_name} ${studentProfile.classes.section}` :
                      'N/A'
                    }
                  </Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Academic Year:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.academic_year || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Gender:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.gender || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Date of Birth:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.dob ? formatDateToDDMMYYYY(studentProfile.dob) : 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Address:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.address || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Pin Code:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.pin_code || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Phone:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.user_phone || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Email:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.email || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Blood Group:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.blood_group || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Nationality:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.nationality || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Religion:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.religion || 'N/A'}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsLabel}>Mother Tongue:</Text>
                  <Text style={styles.detailsValue}>{studentProfile?.mother_tongue || 'N/A'}</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
      </View>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...Platform.select({
      ios: {
        paddingTop: 0,
      },
      android: {
        paddingTop: 0,
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        // Enhanced scrolling for web
        scrollBehavior: 'smooth',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.select({
      ios: 34, // Extra padding for iOS home indicator
      android: 20,
      default: 20,
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
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
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Welcome Section
  welcomeSection: {
    backgroundColor: '#1976d2',
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // School Details Section
  schoolDetailsSection: {
    marginVertical: 12,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
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
  schoolDateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Student Card
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
    }),
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
    marginRight: 12,
    backgroundColor: '#eee',
  },

  // Stats Section
  statsSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  statsColumnContainer: {
    flexDirection: 'column',
  },
  statCardWrapper: {
    width: '100%',
    marginBottom: 12,
  },

  // Section Styles
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
    }),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  viewAllText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },

  // Classes Container
  classesContainer: {
    marginTop: 8,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  classInfo: {
    flex: 1,
  },
  classSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  classTime: {
    fontSize: 14,
    color: '#666',
  },

  // Chart Container
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

  // Marks Container
  marksContainer: {
    marginTop: 8,
  },
  markCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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

  // Events Container
  eventsContainer: {
    marginTop: 8,
  },
  eventCard: {
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
    justifyContent: 'center',
    alignItems: 'center',
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
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  eventDateTime: {
    fontSize: 12,
    color: '#999',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16, // Increased for better touch target
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: Platform.select({
      ios: 100, // Minimum touch target for iOS
      android: 90,
      default: 90,
    }),
    justifyContent: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8, // Increased spacing
  },
  actionTitle: {
    fontSize: Platform.select({
      ios: 15, // Slightly larger for iOS
      android: 14,
      default: 14,
    }),
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 3,
  },
  actionSubtitle: {
    fontSize: Platform.select({
      ios: 13, // Slightly larger for iOS
      android: 12,
      default: 12,
    }),
    color: '#666',
    textAlign: 'center',
  },

  // Activities Container
  activitiesContainer: {
    marginTop: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  studentAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  detailsValue: {
    fontSize: 16,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
  
  // Quick Navigation Bar Styles
  quickNavBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingVertical: 8,
  },
  quickNavContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  quickNavButton: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 70,
  },
  quickNavText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginTop: 4,
  },
  
  // Custom Profile Button Styles
  profileButtonCustom: {
    padding: 4,
    marginLeft: 12,
    flexShrink: 0,
  },
  profileImageCustom: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  
});

export default StudentDashboard;