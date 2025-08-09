import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';

const StudentDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [summary, setSummary] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [notifications, setNotifications] = useState([]);
  // Removed todayClasses as it's not used in the new design

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
      }
    } catch (err) {
      console.log('Student Dashboard - Notifications refresh fetch error:', err);
      setNotifications([]);
    }
  };

  // Add focus effect to refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Student Dashboard - Screen focused, refreshing notifications...');
      refreshNotifications();
    }, [user?.id])
  );

  // Also add navigation listener for when returning from notification screens
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Student Dashboard - Navigation focus event, refreshing...');
      if (user?.id) {
        // Add a small delay to ensure database changes are propagated
        setTimeout(() => {
          refreshNotifications();
          // Also refetch dashboard data to update summary counts
          fetchDashboardData();
        }, 500);
      }
    });

    return unsubscribe;
  }, [navigation, user?.id]);

  // Fetch student profile and dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

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

      setSummary([
        { key: 'attendance', label: 'Attendance', value: attendancePercent + '%', icon: 'checkmark-circle', color: '#48bb78' },
        { key: 'marks', label: 'Marks', value: marksPercent + '%', icon: 'trending-up', color: '#ed8936' },
        { key: 'assignments', label: 'Assignments', value: assignmentsCount, icon: 'book-outline', color: '#667eea' },
        { key: 'notifications', label: 'Notifications', value: notificationsData.filter(n => !n.is_read).length, icon: 'notifications', color: '#9f7aea' },
      ]);
      setDeadlines(deadlinesData.map(item => ({
        id: item.id,
        title: item.title || item.name,
        date: item.due_date || item.start_date,
        type: item.type || 'homework',
        name: item.name,
        start_date: item.start_date
      })));
      setNotifications(notificationsData.map(n => ({
        id: n.id,
        message: n.message,
        date: n.created_at ? n.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
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
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.NOTIFICATION_RECIPIENTS }, fetchDashboardData)
      .subscribe();
    const examsSub = supabase
      .channel('student-dashboard-exams')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.EXAMS }, fetchDashboardData)
      .subscribe();
    const feesSub = supabase
      .channel('student-dashboard-fees')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.STUDENT_FEES }, fetchDashboardData)
      .subscribe();

    return () => {
      homeworkSub.unsubscribe();
      assignmentsSub.unsubscribe();
      attendanceSub.unsubscribe();
      marksSub.unsubscribe();
      notificationsSub.unsubscribe();
      examsSub.unsubscribe();
      feesSub.unsubscribe();
    };
  }, []);

  // This code is no longer needed as we're using the new design

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
});

export default StudentDashboard; 