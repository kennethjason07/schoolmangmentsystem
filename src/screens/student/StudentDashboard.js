import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar, Alert, Animated, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import usePullToRefresh from '../../hooks/usePullToRefresh';

const StudentDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [summary, setSummary] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [schoolDetails, setSchoolDetails] = useState(null);
  // Removed todayClasses as it's not used in the new design

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
      console.warn('Error formatting date:', dateString, error);
      return dateString; // Return original if error
    }
  };

  // Handle navigation for stat cards - SIMPLE SOLUTION
  const handleCardNavigation = (cardKey) => {
    switch (cardKey) {
      case 'assignments':
        navigation.navigate('Assignments');
        break;
      case 'attendance':
        console.log('Navigating to attendance screen');
        navigation.navigate('Attendance');
        break;
      case 'marks':
        console.log('Navigating to marks tab');
        navigation.navigate('Marks', { activeTab: 'marks' });
        break;
      case 'notifications':
        navigation.navigate('StudentNotifications');
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

  // Function to refresh notifications for badge count
  const refreshNotifications = async () => {
    try {
      if (!user?.id) {
        console.log('Student Dashboard - No user ID available');
        return;
      }
      
      console.log('=== STUDENT DASHBOARD NOTIFICATION DEBUG ===');
      console.log('User ID:', user.id);
      console.log('User object:', JSON.stringify(user, null, 2));
      
      // First, let's check if there are any notification recipients at all
      const { data: allRecipients, error: allError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select('*')
        .limit(5);
      
      console.log('All notification recipients (first 5):', allRecipients);
      console.log('All recipients error:', allError);
      
      // Now check specifically for this user
      const { data: userRecipients, error: userError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select('*')
        .eq('recipient_id', user.id);
      
      console.log('User recipients (all types):', userRecipients);
      console.log('User recipients error:', userError);
      
      // Check for Student type specifically
      const { data: studentRecipients, error: studentError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select('*')
        .eq('recipient_type', 'Student')
        .eq('recipient_id', user.id);
      
      console.log('Student recipients:', studentRecipients);
      console.log('Student recipients error:', studentError);
      
      const { data: notificationsData, error } = await supabase
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
        .eq('recipient_type', 'Student')
        .eq('recipient_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(10);

      console.log('Final query result - notificationsData:', notificationsData);
      console.log('Final query result - error:', error);

      if (error && error.code !== '42P01') {
        console.log('Student Dashboard - Notifications refresh error:', error);
        setNotifications([]);
      } else {
        const mappedNotifications = (notificationsData || []).map(n => ({
          id: n.id,
          title: n.notifications.message || 'Notification', // Use message as title since title doesn't exist
          message: n.notifications.message,
          type: n.notifications.type || 'general',
          date: n.sent_at ? n.sent_at.split('T')[0] : new Date().toISOString().split('T')[0],
          created_at: n.notifications.created_at,
          is_read: n.is_read || false,
          read_at: n.read_at
        }));
        console.log('Student Dashboard - Mapped notifications:', mappedNotifications);
        console.log('Student Dashboard - Mapped notifications count:', mappedNotifications.length);
        console.log('Student Dashboard - Unread notifications count:', mappedNotifications.filter(n => !n.is_read).length);
        console.log('============================================');
        setNotifications(mappedNotifications);
        
        // Update the summary card with new notification count WITHOUT reloading everything
        const unreadCount = mappedNotifications.filter(n => !n.is_read).length;
        setSummary(prevSummary => 
          prevSummary.map(item => 
            item.key === 'notifications' 
              ? { ...item, value: unreadCount }
              : item
          )
        );
      }
    } catch (err) {
      console.log('Student Dashboard - Notifications refresh fetch error:', err);
      setNotifications([]);
    }
  };

  // Add focus effect to refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Student Dashboard - Screen focused, refreshing notifications only...');
      // Only refresh notifications, don't reload the entire dashboard
      refreshNotifications();
    }, [user?.id])
  );

  // Navigation listener specifically for notification-related screens
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Student Dashboard - Navigation focus event, checking if notification refresh needed...');
      if (user?.id) {
        // Only refresh notifications when coming back from notification screens
        // Don't reload the entire dashboard data
        refreshNotifications();
      }
    });

    return unsubscribe;
  }, [navigation, user?.id]);

  // Fetch student profile and dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load school details
      const { data: schoolData } = await dbHelpers.getSchoolDetails();
      setSchoolDetails(schoolData);

      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      // Get student details from the linked student
      const studentData = studentUserData.students;
      if (!studentData) {
        throw new Error('Student profile not found');
      }

      setStudentProfile({
        name: studentData.name,
        class: studentData.classes?.class_name || 'N/A',
        roll: studentData.roll_no,
        avatarColor: '#9C27B0',
      });

      // Get assignments count from both homeworks and assignments tables
      let assignmentsCount = 0;
      try {
        // Get homeworks assigned to this student
        const { data: homeworksData, error: homeworksError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select('*')
          .contains('assigned_students', [studentData.id]);

        if (homeworksError && homeworksError.code === '42P01') {
          console.log('Homeworks table does not exist - using 0 homeworks');
        } else if (homeworksError) {
          console.log('Error fetching homeworks:', homeworksError);
        } else {
          assignmentsCount += homeworksData?.length || 0;
        }

        // Get assignments for this student's class
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from(TABLES.ASSIGNMENTS)
          .select('*')
          .eq('class_id', studentData.class_id);

        if (assignmentsError && assignmentsError.code === '42P01') {
          console.log('Assignments table does not exist - using 0 assignments');
        } else if (assignmentsError) {
          console.log('Error fetching assignments:', assignmentsError);
        } else {
          assignmentsCount += assignmentsData?.length || 0;
        }
      } catch (err) {
        console.log('Error fetching assignments:', err);
        assignmentsCount = 0;
      }

      // Get attendance percentage (FIXED: consistent calculation)
      const { data: attendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', studentData.id);
      if (attendanceError) throw attendanceError;

      const totalDays = attendanceData.length;
      const presentDays = attendanceData.filter(a => a.status === 'Present').length;
      const attendancePercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      console.log('=== STUDENT DASHBOARD ATTENDANCE DEBUG ===');
      console.log('Total attendance records:', totalDays);
      console.log('Present days:', presentDays);
      console.log('Attendance percentage:', attendancePercent);
      console.log('Recent records:', attendanceData.slice(0, 3).map(r => `${r.date}: ${r.status}`));
      console.log('==========================================');

      // Get marks percentage (average percentage of all marks)
      let marksPercent = 0;
      try {
        const { data: marksData, error: marksError } = await supabase
          .from(TABLES.MARKS)
          .select('*')
          .eq('student_id', studentData.id);

        if (marksError && marksError.code !== '42P01') {
          throw marksError;
        }

        if (marksData && marksData.length > 0) {
          const totalPercentage = marksData.reduce((sum, mark) => {
            const percentage = (mark.marks_obtained / mark.max_marks) * 100;
            return sum + (percentage || 0);
          }, 0);
          marksPercent = Math.round(totalPercentage / marksData.length);
        }
      } catch (err) {
        console.log('Marks error:', err);
        marksPercent = 0;
      }

      // Get notifications for this student
      let notificationsData = [];
      try {
        console.log('=== FETCHING DASHBOARD NOTIFICATIONS ===');
        console.log('User ID:', user.id);

        // Get notifications with recipients for this student
        const { data: studentNotifications, error: notificationsError } = await supabase
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
          .eq('recipient_type', 'Student')
          .eq('recipient_id', user.id)
          .order('sent_at', { ascending: false })
          .limit(10);

        console.log('Student notifications query result:', { studentNotifications, notificationsError });

        if (notificationsError && notificationsError.code !== '42P01') {
          console.log('Notifications error:', notificationsError);
          notificationsData = [];
        } else if (studentNotifications && studentNotifications.length > 0) {
          notificationsData = studentNotifications.map(notification => ({
            id: notification.id,
            title: notification.notifications.message || 'Notification', // Use message as title since title doesn't exist
            message: notification.notifications.message,
            type: notification.notifications.type || 'general',
            date: new Date(notification.notifications.created_at).toLocaleDateString(),
            created_at: notification.notifications.created_at,
            is_read: notification.is_read || false,
            read_at: notification.read_at
          }));
        } else {
          console.log('No notifications found for this student');
          notificationsData = [];
        }

        console.log('Final dashboard notifications:', notificationsData.length);
        console.log('Unread notifications:', notificationsData.filter(n => !n.is_read).length);
      } catch (err) {
        console.log('Notifications error:', err);
        notificationsData = [];
      }

      // Get deadlines (upcoming homework and assignments)
      let deadlinesData = [];
      try {
        const today = new Date().toISOString().split('T')[0];

        // Get homework deadlines
        const { data: homeworkDeadlines, error: homeworkDeadlinesError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select('id, title, due_date, description')
          .contains('assigned_students', [studentData.id])
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(3);

        if (homeworkDeadlinesError && homeworkDeadlinesError.code !== '42P01') {
          console.log('Error fetching homework deadlines:', homeworkDeadlinesError);
        } else if (homeworkDeadlines) {
          deadlinesData = [...deadlinesData, ...homeworkDeadlines.map(hw => ({
            ...hw,
            type: 'homework'
          }))];
        }

        // Get assignment deadlines
        const { data: assignmentDeadlines, error: assignmentDeadlinesError } = await supabase
          .from(TABLES.ASSIGNMENTS)
          .select('id, title, due_date, description')
          .eq('class_id', studentData.class_id)
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(3);

        if (assignmentDeadlinesError && assignmentDeadlinesError.code !== '42P01') {
          console.log('Error fetching assignment deadlines:', assignmentDeadlinesError);
        } else if (assignmentDeadlines) {
          deadlinesData = [...deadlinesData, ...assignmentDeadlines.map(assignment => ({
            ...assignment,
            type: 'assignment'
          }))];
        }

        // Sort by due date and limit to 5
        deadlinesData = deadlinesData
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, 5);

      } catch (err) {
        console.log('Error fetching deadlines:', err);
        deadlinesData = [];
      }

      // Get upcoming exams
      let upcomingExams = [];
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: examsData, error: examsError } = await supabase
          .from(TABLES.EXAMS)
          .select('id, name, start_date, end_date, remarks')
          .eq('class_id', studentData.class_id)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(3);

        if (examsError && examsError.code !== '42P01') {
          console.log('Error fetching exams:', examsError);
        } else if (examsData) {
          upcomingExams = examsData.map(exam => ({
            ...exam,
            type: 'exam'
          }));
          // Add exams to deadlines
          deadlinesData = [...deadlinesData, ...upcomingExams];
          deadlinesData = deadlinesData
            .sort((a, b) => new Date(a.due_date || a.start_date) - new Date(b.due_date || b.start_date))
            .slice(0, 5);
        }
      } catch (err) {
        console.log('Error fetching exams:', err);
      }

      // Get fee status
      let feeStatus = { paid: 0, pending: 0 };
      try {
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

        // Get fee structure for this student's class
        const { data: feeStructure, error: feeStructureError } = await supabase
          .from(TABLES.FEE_STRUCTURE)
          .select('amount, fee_component')
          .eq('class_id', studentData.class_id)
          .eq('academic_year', academicYear);

        if (feeStructureError && feeStructureError.code !== '42P01') {
          console.log('Error fetching fee structure:', feeStructureError);
        } else if (feeStructure) {
          const totalFees = feeStructure.reduce((sum, fee) => sum + (fee.amount || 0), 0);

          // Get paid fees
          const { data: paidFees, error: paidFeesError } = await supabase
            .from(TABLES.STUDENT_FEES)
            .select('amount_paid')
            .eq('student_id', studentData.id)
            .eq('academic_year', academicYear);

          if (paidFeesError && paidFeesError.code !== '42P01') {
            console.log('Error fetching paid fees:', paidFeesError);
          } else if (paidFees) {
            const totalPaid = paidFees.reduce((sum, fee) => sum + (fee.amount_paid || 0), 0);
            feeStatus = {
              paid: totalPaid,
              pending: Math.max(0, totalFees - totalPaid),
              total: totalFees
            };
          }
        }
      } catch (err) {
        console.log('Error fetching fee status:', err);
      }

      // Removed today's timetable code as not needed for this design
      // Removed today's classes and messages code as not needed for this design

      // Get upcoming events from the events table - ENHANCED VERSION WITH DEBUG LOGGING
      let mappedEvents = [];
      try {
        const today = new Date().toISOString().split('T')[0];
        console.log('🔍 Student Dashboard - Fetching upcoming events from date:', today);
        
        // FIRST: Try to get ALL active events to see what's available
        console.log('🔍 Step 1: Checking all active events in database...');
        const { data: allActiveEvents, error: allActiveError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'Active')
          .order('event_date', { ascending: true });
          
        console.log('📊 All active events in database:', allActiveEvents?.length || 0);
        if (allActiveEvents && allActiveEvents.length > 0) {
          console.log('📋 Active events details:');
          allActiveEvents.forEach((event, index) => {
            console.log(`   ${index + 1}. "${event.title}" - Date: ${event.event_date}, School-wide: ${event.is_school_wide}`);
          });
        }
        
        // SECOND: Try to get upcoming events (today and future)
        console.log('🔍 Step 2: Checking upcoming events (today and future)...');
        const { data: upcomingEventsData, error: upcomingError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'Active')
          .gte('event_date', today)
          .order('event_date', { ascending: true });
          
        console.log('📊 Upcoming events found:', upcomingEventsData?.length || 0);
        if (upcomingEventsData && upcomingEventsData.length > 0) {
          console.log('📋 Upcoming events details:');
          upcomingEventsData.forEach((event, index) => {
            console.log(`   ${index + 1}. "${event.title}" - Date: ${event.event_date}, School-wide: ${event.is_school_wide}`);
          });
        }
        
        // THIRD: For now, let's show ALL upcoming events to the student (we can filter later if needed)
        console.log('🔍 Step 3: Using upcoming events for student dashboard...');
        
        if (upcomingError) {
          console.error('❌ Events query error:', upcomingError);
        }
        
        // Map the events to the format expected by the UI
        mappedEvents = (upcomingEventsData || []).map(event => ({
          id: event.id,
          type: event.event_type || 'Event',
          title: event.title,
          description: event.description || '',
          date: event.event_date,
          startTime: event.start_time || '09:00',
          endTime: event.end_time || '17:00',
          location: event.location,
          organizer: event.organizer,
          icon: event.icon || 'calendar',
          color: event.color || '#FF9800'
        }));
        
        console.log('✅ Student Dashboard - Mapped events for dashboard:', mappedEvents.length);
        
        if (mappedEvents.length > 0) {
          console.log('🎉 Student Dashboard - SUCCESS: Events will be shown on dashboard!');
        } else {
          console.log('⚠️  Student Dashboard - WARNING: No events to show on dashboard!');
        }
        
        setEvents(mappedEvents.slice(0, 10)); // Show top 10 events
      } catch (err) {
        console.log('❌ Student Dashboard - Events fetch error:', err);
        mappedEvents = [];
        setEvents([]);
      }

      setSummary([
        { key: 'attendance', label: 'Attendance', value: attendancePercent + '%', icon: 'checkmark-circle', color: '#48bb78' },
        { key: 'marks', label: 'Marks', value: marksPercent + '%', icon: 'trending-up', color: '#ed8936' },
        { key: 'assignments', label: 'Assignments', value: assignmentsCount, icon: 'book-outline', color: '#667eea' },
        { key: 'notifications', label: 'Notifications', value: notificationsData.filter(n => !n.is_read).length, icon: 'notifications', color: '#9f7aea' },
        { key: 'events', label: 'Events', value: mappedEvents.length, icon: 'calendar', color: '#ff6b35' },
      ]);
      setDeadlines(deadlinesData.map(item => ({
        id: item.id,
        title: item.title || item.name,
        date: formatDateToDDMMYYYY(item.due_date || item.start_date),
        type: item.type || 'homework',
        name: item.name,
        start_date: item.start_date
      })));
      setNotifications(notificationsData.map(n => ({
        id: n.id,
        message: n.message,
        date: formatDateToDDMMYYYY(n.created_at ? n.created_at.split('T')[0] : new Date().toISOString().split('T')[0])
      })));
    } catch (err) {
      setError(err.message);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Real-time subscriptions for all relevant tables
    const homeworkSub = supabase
      .channel('student-dashboard-homework')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.HOMEWORKS }, fetchDashboardData)
      .subscribe();
    const assignmentsSub = supabase
      .channel('student-dashboard-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.ASSIGNMENTS }, fetchDashboardData)
      .subscribe();
    const attendanceSub = supabase
      .channel('student-dashboard-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.STUDENT_ATTENDANCE }, fetchDashboardData)
      .subscribe();
    const marksSub = supabase
      .channel('student-dashboard-marks')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.MARKS }, fetchDashboardData)
      .subscribe();
    const notificationsSub = supabase
      .channel('student-dashboard-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.NOTIFICATION_RECIPIENTS }, refreshNotifications)
      .subscribe();
    const examsSub = supabase
      .channel('student-dashboard-exams')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.EXAMS }, fetchDashboardData)
      .subscribe();
    const feesSub = supabase
      .channel('student-dashboard-fees')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.STUDENT_FEES }, fetchDashboardData)
      .subscribe();
    const eventsSub = supabase
      .channel('student-dashboard-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchDashboardData)
      .subscribe();

    return () => {
      homeworkSub.unsubscribe();
      assignmentsSub.unsubscribe();
      attendanceSub.unsubscribe();
      marksSub.unsubscribe();
      notificationsSub.unsubscribe();
      examsSub.unsubscribe();
      feesSub.unsubscribe();
      eventsSub.unsubscribe();
    };
  }, []);

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    console.log('Pull-to-refresh triggered on Student Dashboard');
    await fetchDashboardData();
    await refreshNotifications();
  });

  // Calculate unread notifications count
  const unreadCount = notifications.filter(notification => !notification.is_read).length;

  // Render the new dashboard design
  const renderDashboard = () => (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <Header 
        title="Student Dashboard" 
        showBack={false} 
        showNotifications={true}
        showProfile={true}
        unreadCount={unreadCount}
        onNotificationsPress={() => navigation.navigate('StudentNotifications')}
        onProfilePress={() => navigation.navigate('Profile')}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
            title="Pull to refresh..."
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

        {/* Student Dashboard Card */}
        <View style={styles.dashboardCard}>

          {/* Student Profile */}
          {studentProfile && (
            <View style={styles.studentProfile}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {studentProfile.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{studentProfile.name}</Text>
                <Text style={styles.studentDetails}>Class {studentProfile.class} • Roll No: {studentProfile.roll}</Text>
              </View>
            </View>
          )}

          {/* Summary Cards Grid - SIMPLE FIXED VERSION */}
          <View style={styles.summaryContainer}>
            {/* First Row */}
            <View style={styles.summaryRow}>
              {/* Attendance Card */}
              <TouchableOpacity
                style={[styles.summaryCard, { backgroundColor: '#48bb78' }]}
                onPress={() => handleCardNavigation('attendance')}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={28} color="#fff" style={styles.cardIcon} />
                <Text style={styles.cardValue}>{summary.find(s => s.key === 'attendance')?.value || '0%'}</Text>
                <Text style={styles.cardLabel}>Attendance</Text>
              </TouchableOpacity>

              {/* Marks Card */}
              <TouchableOpacity
                style={[styles.summaryCard, { backgroundColor: '#ed8936' }]}
                onPress={() => handleCardNavigation('marks')}
                activeOpacity={0.8}
              >
                <Ionicons name="trending-up" size={28} color="#fff" style={styles.cardIcon} />
                <Text style={styles.cardValue}>{summary.find(s => s.key === 'marks')?.value || '0%'}</Text>
                <Text style={styles.cardLabel}>Marks</Text>
              </TouchableOpacity>
            </View>

            {/* Second Row */}
            <View style={styles.summaryRow}>
              {/* Assignments Card */}
              <TouchableOpacity
                style={[styles.summaryCard, { backgroundColor: '#667eea' }]}
                onPress={() => handleCardNavigation('assignments')}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={28} color="#fff" style={styles.cardIcon} />
                <Text style={styles.cardValue}>{summary.find(s => s.key === 'assignments')?.value || '0'}</Text>
                <Text style={styles.cardLabel}>Assignments</Text>
              </TouchableOpacity>

              {/* Notifications Card */}
              <TouchableOpacity
                style={[styles.summaryCard, { backgroundColor: '#9f7aea' }]}
                onPress={() => handleCardNavigation('notifications')}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications" size={28} color="#fff" style={styles.cardIcon} />
                <Text style={styles.cardValue}>{summary.find(s => s.key === 'notifications')?.value || '0'}</Text>
                <Text style={styles.cardLabel}>Notifications</Text>
              </TouchableOpacity>
            </View>

            {/* Third Row */}
            <View style={styles.summaryRow}>
              {/* Events Card */}
              <TouchableOpacity
                style={[styles.summaryCard, { backgroundColor: '#ff6b35', width: '100%' }]}
                onPress={() => handleCardNavigation('events')}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={28} color="#fff" style={styles.cardIcon} />
                <Text style={styles.cardValue}>{summary.find(s => s.key === 'events')?.value || '0'}</Text>
                <Text style={styles.cardLabel}>Upcoming Events</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Upcoming Deadlines Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Deadlines & Events</Text>
          {deadlines.length > 0 ? (
            deadlines.map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                style={styles.deadlineItem}
                onPress={() => navigation.navigate('Assignments')}
                activeOpacity={0.7}
              >
                <View style={styles.deadlineIcon}>
                  <Ionicons name="calendar" size={20} color="#2196F3" />
                </View>
                <View style={styles.deadlineContent}>
                  <Text style={styles.deadlineTitle}>{item.title || item.name}</Text>
                  <Text style={styles.deadlineDate}>{item.date || item.start_date}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              style={styles.emptyState}
              onPress={() => navigation.navigate('Assignments')}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyText}>No upcoming deadlines</Text>
              <Text style={styles.emptySubtext}>Tap to view all assignments</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          {notifications.length > 0 ? (
            notifications.map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                style={styles.notificationItem}
                onPress={() => navigation.navigate('StudentNotifications')}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons name="notifications" size={20} color="#9C27B0" />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationMessage}>{item.message}</Text>
                  <Text style={styles.notificationDate}>{item.date}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              style={styles.emptyState}
              onPress={() => navigation.navigate('StudentNotifications')}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyText}>No recent notifications</Text>
              <Text style={styles.emptySubtext}>Tap to view all notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upcoming Events Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {events.length > 0 ? (
            events.slice(0, 5).map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                style={styles.eventItem}
                onPress={() => Alert.alert(
                  item.title,
                  `Date: ${formatDateToDDMMYYYY(item.date)}\nTime: ${item.startTime}${item.endTime ? ' - ' + item.endTime : ''}${item.location ? '\nLocation: ' + item.location : ''}${item.description ? '\n\n' + item.description : ''}`
                )}
                activeOpacity={0.7}
              >
                <View style={[styles.eventItemIcon, { backgroundColor: item.color || '#FF9800' }]}>
                  <Ionicons name={item.icon || 'calendar'} size={20} color="#fff" />
                </View>
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventDate}>
                    {formatDateToDDMMYYYY(item.date)} • {item.startTime}
                    {item.location ? ` • ${item.location}` : ''}
                  </Text>
                  {item.description && (
                    <Text style={styles.eventDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              style={styles.emptyState}
              onPress={() => handleCardNavigation('events')}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyText}>No upcoming events</Text>
              <Text style={styles.emptySubtext}>Tap to view all events</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="alert-circle" size={48} color="#F44336" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchDashboardData} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return renderDashboard();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationIcon: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dashboardCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileIcon: {
    padding: 4,
  },
  studentProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#9C27B0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
  },
  summaryContainer: {
    marginTop: 20,
    paddingHorizontal: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    width: '48%',
    height: 120,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardIcon: {
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: 11,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.95,
  },

  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 12,
    marginLeft: 4,
  },
  deadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  deadlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deadlineContent: {
    flex: 1,
  },
  deadlineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  deadlineDate: {
    fontSize: 13,
    color: '#888',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  notificationDate: {
    fontSize: 13,
    color: '#888',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 4,
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  eventItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  eventDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
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
  dateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Modern UI styles
  quickStatsContainer: {
    marginHorizontal: 16,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  attendanceCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00b894',
  },
  performanceCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#e17055',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  statIndicator: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },

  actionCardsContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  actionCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionCardIcon: {
    marginBottom: 12,
  },
  actionCardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  actionCardLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  actionCardArrow: {
    position: 'absolute',
    top: 16,
    right: 16,
  },

  contentSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  seeAllText: {
    fontSize: 14,
    color: '#6c5ce7',
    fontWeight: '600',
  },

  // Deadlines styles
  deadlinesList: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 4,
  },
  modernDeadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  deadlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernDeadlineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deadlineInfo: {
    flex: 1,
  },
  modernDeadlineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modernDeadlineDate: {
    fontSize: 12,
    color: '#888',
  },
  deadlineType: {
    marginLeft: 12,
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    minWidth: 50,
  },

  // Notifications styles
  notificationsList: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 4,
  },
  modernNotificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernNotificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(162, 155, 254, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  modernNotificationMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modernNotificationDate: {
    fontSize: 12,
    color: '#888',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c5ce7',
    marginLeft: 8,
  },

  // Events styles
  eventsList: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 4,
  },
  modernEventItem: {
    backgroundColor: '#2a2a4a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernEventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  modernEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modernEventDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 11,
    color: '#666',
  },

  // Modern empty state
  modernEmptyState: {
    backgroundColor: '#1e1e3f',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderStyle: 'dashed',
  },
  modernEmptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
    fontWeight: '600',
  },
  modernEmptySubtext: {
    fontSize: 14,
    color: '#6c5ce7',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default StudentDashboard;
