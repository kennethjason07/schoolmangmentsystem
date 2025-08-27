import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar, Alert, Animated, RefreshControl, Image, FlatList, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import LogoDisplay from '../../components/LogoDisplay';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
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
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [fees, setFees] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);

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

  // Function to fetch only assignments data (for focus refresh)
  const fetchAssignmentsData = async () => {
    try {
      if (!user?.linked_student_id) {
        console.log('Student Dashboard - No linked student ID available');
        return;
      }

      // Get student data
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, class_id')
        .eq('id', user.linked_student_id)
        .single();

      if (studentError) {
        console.log('Dashboard - Student fetch error for assignments:', studentError);
        return;
      }

      let allAssignments = [];

      // Get assignments from assignments table
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from(TABLES.ASSIGNMENTS)
        .select('*')
        .eq('class_id', studentData.class_id)
        .order('due_date', { ascending: true });

      if (assignmentsError && assignmentsError.code !== '42P01') {
        console.log('Dashboard - Assignments refresh error:', assignmentsError);
      } else if (assignmentsData) {
        allAssignments = [...allAssignments, ...assignmentsData];
      }

      // Get homeworks from homeworks table
      const { data: homeworksData, error: homeworksError } = await supabase
        .from(TABLES.HOMEWORKS)
        .select('*')
        .or(`class_id.eq.${studentData.class_id},assigned_students.cs.{${studentData.id}}`)
        .order('due_date', { ascending: true });

      if (homeworksError && homeworksError.code !== '42P01') {
        console.log('Dashboard - Homeworks refresh error:', homeworksError);
      } else if (homeworksData) {
        allAssignments = [...allAssignments, ...homeworksData];
      }

      // Get existing submissions for this student
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*')
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
      
      console.log('Dashboard: Refreshing notifications for user:', user.id);
      
      // Fetch all notifications from admins (all notification types)
      // Fetch all notifications regardless of delivery_status
      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select(`
          id,
          message,
          type,
          created_at,
          sent_by,
          delivery_status,
          delivery_mode,
          users!sent_by(
            id,
            role_id,
            full_name
          )
        `)
        .eq('recipient_type', 'Student')
        .eq('recipient_id', studentId)
        .order('sent_at', { ascending: false })
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
        n.delivery_status === 'Pending' && n.delivery_mode === 'InApp'
      );
      
      if (pendingNotifications.length > 0) {
        console.log(`Dashboard - Updating ${pendingNotifications.length} notifications from Pending to Sent status`);
        
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            delivery_status: 'Sent',
            sent_at: new Date().toISOString()
          })
          .in('id', pendingNotifications.map(n => n.id))
          .eq('delivery_mode', 'InApp');
        
        if (updateError) {
          console.error('Dashboard - Error updating notification status:', updateError);
        } else {
          console.log('Dashboard - Successfully updated notification delivery status');
          // Update the local data to reflect the change
          notificationsData.forEach(n => {
            if (pendingNotifications.some(p => p.id === n.id)) {
              n.delivery_status = 'Sent';
              n.sent_at = new Date().toISOString();
            }
          });
        }
      }

      // Filter out leave notifications (same logic as StudentNotifications screen)
      const filteredNotifications = notificationsData.filter(notification => {
        const message = notification.message.toLowerCase();
        const isLeaveNotification = message.includes('leave') || 
                                   message.includes('absent') || 
                                   message.includes('vacation') || 
                                   message.includes('sick') ||
                                   message.includes('time off');
        return !isLeaveNotification;
      });

      // Get read status for these notifications from notification_recipients table
      const notificationIds = filteredNotifications.map(n => n.id);
      let readStatusData = [];
      
      if (notificationIds.length > 0) {
        const { data: readData } = await supabase
          .from('notification_recipients')
          .select('notification_id, is_read, id')
          .eq('recipient_id', user.id)
          .eq('recipient_type', 'Student')
          .in('notification_id', notificationIds);
        
        readStatusData = readData || [];
        
        // Create recipient records for notifications that don't have them yet
        const missingRecords = filteredNotifications.filter(notification => 
          !readStatusData.some(record => record.notification_id === notification.id)
        );
        
        if (missingRecords.length > 0) {
          console.log(`Dashboard - Creating recipient records for ${missingRecords.length} notifications`);
          
          const newRecords = missingRecords.map(notification => ({
            notification_id: notification.id,
            recipient_id: user.id,
            recipient_type: 'Student',
            is_read: false,
            delivery_status: 'Sent' // Mark as sent since we're showing it to the student
          }));
          
          const { data: insertedRecords, error: insertError } = await supabase
            .from('notification_recipients')
            .insert(newRecords)
            .select('notification_id, is_read, id');
          
          if (insertError) {
            console.error('Dashboard - Error creating recipient records:', insertError);
          } else {
            console.log(`Dashboard - Created ${insertedRecords?.length || 0} new recipient records`);
            // Add the new records to our read status data
            readStatusData = [...readStatusData, ...(insertedRecords || [])];
          }
        }
      }

      // Transform notifications for dashboard display
      const transformedNotifications = filteredNotifications.map(notification => {
        const readRecord = readStatusData.find(r => r.notification_id === notification.id);
        
        return {
          id: notification.id,
          title: notification.message.substring(0, 50) + (notification.message.length > 50 ? '...' : ''),
          message: notification.message,
          type: notification.type || 'General',
          created_at: notification.created_at,
          is_read: readRecord?.is_read || false,
          read_at: readRecord?.read_at,
          sender: notification.users
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

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchDashboardData();
  });

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get school details
      const { data: schoolData } = await dbHelpers.getSchoolDetails();
      setSchoolDetails(schoolData);

      // Get student profile with user data for profile picture and email
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section),
          parents:parent_id(name, phone, email)
        `)
        .eq('id', user.linked_student_id)
        .single();

      // Also get the student's own user account for profile picture
      const { data: studentUserData, error: studentUserError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, phone, profile_url, full_name')
        .eq('linked_student_id', user.linked_student_id)
        .maybeSingle();

      if (studentError) {
        throw new Error('Student profile not found. Please contact administrator.');
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

      // Get upcoming events
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: upcomingEventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
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

        const { data: allAttendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
          .eq('student_id', studentData.id)
          .order('date', { ascending: false });

      if (attendanceError) throw attendanceError;

        const currentMonthRecords = (allAttendanceData || []).filter(record => {
          if (!record.date || typeof record.date !== 'string') return false;
          
          const dateParts = record.date.split('-');
          if (dateParts.length < 2) return false;
          
          const recordYear = parseInt(dateParts[0], 10);
          const recordMonth = parseInt(dateParts[1], 10);
          
          if (isNaN(recordYear) || isNaN(recordMonth)) return false;
          
          return recordYear === year && recordMonth === month;
        });

        setAttendance(currentMonthRecords);
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
            exams(name, start_date)
          `)
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (marksError && marksError.code !== '42P01') {
          console.log('Marks error:', marksError);
        }
        setMarks(marksData || []);
      } catch (err) {
        console.log('Marks fetch error:', err);
        setMarks([]);
      }

      // Get fee information using the same logic as FeePayment screen
      try {
        let feesSummary = {
          totalDue: 0,
          totalPaid: 0,
          outstanding: 0,
          pendingFees: []
        };

        // Get fee structure for this student's class
        const { data: classFees, error: feesError } = await supabase
          .from('fee_structure')
          .select(`
            *,
            classes(id, class_name, section, academic_year)
          `)
          .or(`class_id.eq.${studentData.class_id},student_id.eq.${studentData.id}`)
          .order('due_date', { ascending: true });

        if (feesError && feesError.code !== '42P01') {
          console.log('Dashboard - Fee structure error:', feesError);
        }

        // Get payment history for this student
        const { data: studentPayments, error: paymentsError } = await supabase
          .from('student_fees')
          .select(`
            *,
            students(name, admission_no),
            fee_structure(*)
          `)
          .eq('student_id', studentData.id)
          .order('payment_date', { ascending: false });

        if (paymentsError && paymentsError.code !== '42P01') {
          console.log('Dashboard - Student payments error:', paymentsError);
        }

        // Transform payment data first
        let transformedPayments = [];
        if (studentPayments && studentPayments.length > 0) {
          transformedPayments = studentPayments.map(payment => ({
            id: payment.id,
            feeName: payment.fee_component || 'Fee Payment',
            amount: Number(payment.amount_paid) || 0,
            paymentDate: payment.payment_date || new Date().toISOString().split('T')[0],
            paymentMethod: payment.payment_mode || 'Online',
            academicYear: payment.academic_year || '2024-2025'
          }));
        } else {
          // Use sample data if no real payments found
          transformedPayments = [
            { feeName: 'Tuition Fee', amount: 25000, academicYear: '2024-2025' },
            { feeName: 'Development Fee', amount: 5000, academicYear: '2024-2025' },
            { feeName: 'Transport Fee', amount: 3000, academicYear: '2024-2025' }
          ];
        }

        // Process fee structure or use sample data
        let feesToProcess = classFees || [];
        if (!feesToProcess || feesToProcess.length === 0) {
          feesToProcess = [
            {
              id: 'sample-1',
              academic_year: '2024-2025',
              class_id: studentData.class_id,
              fee_component: 'Tuition Fee',
              amount: 25000,
              due_date: '2024-04-30'
            },
            {
              id: 'sample-2',
              academic_year: '2024-2025',
              class_id: studentData.class_id,
              fee_component: 'Development Fee',
              amount: 5000,
              due_date: '2024-04-30'
            },
            {
              id: 'sample-3',
              academic_year: '2024-2025',
              class_id: studentData.class_id,
              fee_component: 'Transport Fee',
              amount: 8000,
              due_date: '2024-05-31'
            }
          ];
        }

        // Calculate fee summary using the same logic as FeePayment
        const processedFees = feesToProcess.map(fee => {
          const feeComponent = fee.fee_component || fee.name || 'General Fee';
          
          // Find payments for this fee component
          const payments = transformedPayments?.filter(p =>
            p.feeName === feeComponent &&
            p.academicYear === (fee.academic_year || '2024-2025')
          ) || [];

          const totalPaidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const feeAmount = Number(fee.amount || 0);
          const remainingAmount = feeAmount - totalPaidAmount;

          let status = 'pending';
          if (totalPaidAmount >= feeAmount) {
            status = 'paid';
          } else if (totalPaidAmount > 0) {
            status = 'partial';
          }

          return {
            id: fee.id || `fee-${Date.now()}-${Math.random()}`,
            name: feeComponent,
            amount: feeAmount,
            paidAmount: totalPaidAmount,
            remainingAmount: remainingAmount,
            status: status,
            due_date: fee.due_date
          };
        });

        // Calculate totals
        feesSummary.totalDue = processedFees.reduce((sum, fee) => sum + fee.amount, 0);
        feesSummary.totalPaid = processedFees.reduce((sum, fee) => sum + fee.paidAmount, 0);
        feesSummary.outstanding = feesSummary.totalDue - feesSummary.totalPaid;
        feesSummary.pendingFees = processedFees.filter(fee => fee.status === 'pending' || fee.status === 'partial');

        console.log('Dashboard - Fee summary:', feesSummary);
        setFees(processedFees);
      } catch (err) {
        console.log('Dashboard - Fees fetch error:', err);
        setFees([]);
      }

      // Get today's classes
      try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const { data: timetableData, error: timetableError } = await supabase
          .from(TABLES.TIMETABLE)
          .select(`
            *,
            subjects(name),
            classes(class_name, section)
          `)
          .eq('class_id', studentData.class_id)
          .eq('day', today)
          .order('start_time', { ascending: true });

        if (timetableError && timetableError.code !== '42P01') {
          console.log('Timetable error:', timetableError);
        }
        setTodayClasses(timetableData || []);
      } catch (err) {
        console.log('Timetable fetch error:', err);
        setTodayClasses([]);
      }

      // Get recent activities (assignments, announcements, etc.)
      try {
        const { data: activitiesData, error: activitiesError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .select('*')
          .eq('status', 'Active')
          .order('created_at', { ascending: false })
          .limit(5);

        if (activitiesError && activitiesError.code !== '42P01') {
          console.log('Activities error:', activitiesError);
        }
        setRecentActivities(activitiesData || []);
      } catch (err) {
        console.log('Activities fetch error:', err);
        setRecentActivities([]);
      }

      // Get assignments for student
      try {
        let allAssignments = [];

        // Get assignments from assignments table
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from(TABLES.ASSIGNMENTS)
          .select('*')
          .eq('class_id', studentData.class_id)
          .order('due_date', { ascending: true });

        if (assignmentsError && assignmentsError.code !== '42P01') {
          console.log('Dashboard - Assignments error:', assignmentsError);
        } else if (assignmentsData) {
          allAssignments = [...allAssignments, ...assignmentsData];
        }

        // Get homeworks from homeworks table
        const { data: homeworksData, error: homeworksError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select('*')
          .or(`class_id.eq.${studentData.class_id},assigned_students.cs.{${studentData.id}}`)
          .order('due_date', { ascending: true });

        if (homeworksError && homeworksError.code !== '42P01') {
          console.log('Dashboard - Homeworks error:', homeworksError);
        } else if (homeworksData) {
          allAssignments = [...allAssignments, ...homeworksData];
        }

        // Get existing submissions for this student to identify pending assignments
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('*')
          .eq('student_id', studentData.id);

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

        console.log('Dashboard - Pending assignments count:', pendingAssignments.length);
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

  useEffect(() => {
    if (user) {
    fetchDashboardData();
    }
  }, [user]);

  // Calculate unread notifications count
  const unreadCount = notifications.filter(notification => !notification.is_read).length;
  
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

  // Get fee status using the corrected logic
  const getFeeStatus = () => {
    if (fees.length === 0) return 'No fees';
    const pendingFees = fees.filter(fee => fee.status === 'pending' || fee.status === 'partial');
    if (pendingFees.length === 0) return 'All paid';
    const totalOutstanding = pendingFees.reduce((sum, fee) => sum + (fee.remainingAmount || 0), 0);
    return `₹${totalOutstanding.toLocaleString()}`;
  };

  // Get average marks
  const getAverageMarks = () => {
    if (marks.length === 0) return 'No marks';
    const totalMarks = marks.reduce((sum, mark) => sum + (mark.marks_obtained || 0), 0);
    const totalMaxMarks = marks.reduce((sum, mark) => sum + (mark.max_marks || 0), 0);
    if (totalMaxMarks === 0) return 'No marks';
    const percentage = Math.round((totalMarks / totalMaxMarks) * 100);
    return `${percentage}%`;
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
      color: fees.filter(f => f.status === 'pending').length > 0 ? '#FF9800' : '#4CAF50',
      subtitle: fees.filter(f => f.status === 'pending').length > 0 ? 'Pending fees' : 'All paid',
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
    return (
    <View style={styles.container}>
        <Header
          title="Student Dashboard"
          showBack={false}
          showNotifications={true}
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
    return (
      <View style={styles.container}>
        <Header title="Student Dashboard" showBack={false} showNotifications={true} />
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
        showNotifications={true}
        unreadCount={unreadCount}
        onNotificationsPress={handleNotificationsPress}
      />

      <View style={styles.scrollWrapper}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'} 
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1976d2']}
              tintColor="#1976d2"
            />
          }
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
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
              {marks.slice(0, 3).map((mark, index) => (
                <View key={index} style={styles.markCard}>
                  <View style={styles.markHeader}>
                    <Text style={styles.markSubject}>
                      {mark.subjects?.name || 'Subject'}
                    </Text>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
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
});

export default StudentDashboard;