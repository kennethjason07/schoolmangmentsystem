import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const StudentDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [summary, setSummary] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [notifications, setNotifications] = useState([]);

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

      // Get assignments count (active assignments)
      let assignmentsCount = 0;
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select('*')
          .contains('assigned_students', [studentData.id]);

        if (assignmentsError && assignmentsError.code === '42P01') {
          console.log('Homeworks table does not exist - using 0 assignments');
          assignmentsCount = 0;
        } else if (assignmentsError) {
          throw assignmentsError;
        } else {
          assignmentsCount = assignmentsData.length;
        }
      } catch (err) {
        console.log('Error fetching assignments:', err);
        assignmentsCount = 0;
      }

      // Get attendance percentage
      const { data: attendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', studentData.id);
      if (attendanceError) throw attendanceError;
      const totalDays = attendanceData.length;
      const presentDays = attendanceData.filter(a => a.status === 'Present').length;
      const attendancePercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

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

      // Get notifications (latest 5) - simplified approach
      let notificationsData = [];
      try {
        const { data: notifications, error: notificationsError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (notificationsError && notificationsError.code !== '42P01') {
          throw notificationsError;
        }
        notificationsData = notifications || [];
      } catch (err) {
        console.log('Notifications error:', err);
        notificationsData = [];
      }

      // Get deadlines (upcoming homework)
      let deadlinesData = [];
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: homeworkDeadlines, error: deadlinesError } = await supabase
          .from(TABLES.HOMEWORKS)
          .select('*')
          .contains('assigned_students', [studentData.id])
          .gte('due_date', today)
          .order('due_date', { ascending: true })
          .limit(5);

        if (deadlinesError && deadlinesError.code === '42P01') {
          console.log('Homeworks table does not exist - using empty deadlines');
          deadlinesData = [];
        } else if (deadlinesError) {
          throw deadlinesError;
        } else {
          deadlinesData = homeworkDeadlines || [];
        }
      } catch (err) {
        console.log('Error fetching deadlines:', err);
        deadlinesData = [];
      }

      setSummary([
        { key: 'assignments', label: 'Assignments', value: assignmentsCount, icon: 'book', color: '#1976d2' },
        { key: 'attendance', label: 'Attendance', value: attendancePercent + '%', icon: 'checkmark-circle', color: '#388e3c' },
        { key: 'marks', label: 'Marks', value: marksPercent + '%', icon: 'bar-chart', color: '#ff9800' },
        { key: 'notifications', label: 'Notifications', value: notificationsData.length, icon: 'notifications', color: '#9c27b0' },
      ]);
      setDeadlines(deadlinesData.map(hw => ({ id: hw.id, title: hw.title, date: hw.due_date })));
      setNotifications(notificationsData.map(n => ({ id: n.id, message: n.message, date: n.created_at.split('T')[0] })));
    } catch (err) {
      setError(err.message);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Real-time subscriptions (optional)
    const homeworkSub = supabase
      .channel('student-dashboard-homework')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.HOMEWORKS }, fetchDashboardData)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.NOTIFICATIONS }, fetchDashboardData)
      .subscribe();
    return () => {
      homeworkSub.unsubscribe();
      attendanceSub.unsubscribe();
      marksSub.unsubscribe();
      notificationsSub.unsubscribe();
    };
  }, []);

  // Combine deadlines and notifications into a single list with section headers
  const combinedData = [
    { type: 'section', title: 'Upcoming Deadlines & Events' },
    ...deadlines.map(item => ({ ...item, type: 'deadline' })),
    { type: 'section', title: 'Recent Notifications' },
    ...notifications.map(item => ({ ...item, type: 'notification' })),
  ];

  const renderItem = ({ item }) => {
    if (item.type === 'section') {
      return <Text style={styles.sectionTitle}>{item.title}</Text>;
    }
    if (item.type === 'deadline') {
      return (
        <View style={styles.deadlineRow}>
          <Ionicons name="calendar" size={18} color="#1976d2" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.deadlineTitle}>{item.title}</Text>
            <Text style={styles.deadlineDate}>{item.date}</Text>
          </View>
        </View>
      );
    }
    if (item.type === 'notification') {
      return (
        <View style={styles.notificationRow}>
          <Ionicons name="notifications" size={18} color="#9c27b0" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationMsg}>{item.message}</Text>
            <Text style={styles.notificationDate}>{item.date}</Text>
          </View>
        </View>
      );
    }
    return null;
  };

  const ListHeaderComponent = (
    <>
      <Header title="Student Dashboard" />
      {/* Student Profile */}
      {studentProfile && (
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { backgroundColor: studentProfile.avatarColor }]}>
            <Text style={styles.avatarText}>{studentProfile.name.split(' ').map(n => n[0]).join('').toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{studentProfile.name}</Text>
            <Text style={styles.profileDetails}>Class {studentProfile.class} • Roll No: {studentProfile.roll}</Text>
          </View>
        </View>
      )}
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        {summary.map(card => (
          <View key={card.key} style={[styles.summaryCard, { backgroundColor: card.color + '11', borderColor: card.color }]}> 
            <Ionicons name={card.icon} size={28} color={card.color} style={{ marginBottom: 6 }} />
            <Text style={styles.summaryValue}>{card.value}</Text>
            <Text style={styles.summaryLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Student Dashboard" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Student Dashboard" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 12 }}>Error: {error}</Text>
          <TouchableOpacity onPress={fetchDashboardData} style={{ backgroundColor: '#1976d2', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={combinedData}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id ? item.id : item.title + index}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={styles.scrollView}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { padding: 16, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
    marginBottom: 2,
  },
  summaryValue: { fontSize: 22, fontWeight: 'bold', color: '#222' },
  summaryLabel: { fontSize: 14, color: '#555', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976d2', marginBottom: 8, marginTop: 10 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, elevation: 1 },
  deadlineTitle: { fontSize: 15, color: '#333', fontWeight: 'bold' },
  deadlineDate: { fontSize: 13, color: '#888' },
  notificationRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, elevation: 1 },
  notificationMsg: { fontSize: 14, color: '#333' },
  notificationDate: { fontSize: 12, color: '#888' },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileDetails: {
    fontSize: 15,
    color: '#666',
    marginTop: 2,
  },
});

export default StudentDashboard; 