import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import DateTimePicker from '@react-native-community/datetimepicker';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import CrossPlatformBarChart from '../../components/CrossPlatformBarChart';
import { supabase, dbHelpers } from '../../utils/supabase';
import { format, addMonths } from 'date-fns';

const { width } = Dimensions.get('window');

const AdminDashboard = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schoolDetails, setSchoolDetails] = useState(null);

  // Load real-time data from Supabase using actual schema
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load school details
      const { data: schoolData } = await dbHelpers.getSchoolDetails();
      setSchoolDetails(schoolData);

      // Load students count with gender breakdown
      const { data: studentsData, error: studentError, count: studentCount } = await supabase
        .from('students')
        .select('id, gender', { count: 'exact' });

      if (studentError) {
        console.error('Error loading students:', studentError);
      }

      // Load teachers count
      const { data: teachersData, error: teacherError, count: teacherCount } = await supabase
        .from('teachers')
        .select('id', { count: 'exact' });

      if (teacherError) {
        console.error('Error loading teachers:', teacherError);
      }

      // Load today's student attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: studentAttendance, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('id, status')
        .eq('date', today);

      if (attendanceError) {
        console.error('Error loading attendance:', attendanceError);
      }

      // Load classes count
      const { data: classesData, error: classesError, count: classesCount } = await supabase
        .from('classes')
        .select('id', { count: 'exact' });

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
        .gte('payment_date', `${currentMonth}-01`)
        .lt('payment_date', `${nextMonth}-01`);

      if (feeError) {
        console.error('Error loading fees:', feeError);
      }

      // Calculate statistics
      const totalStudents = studentCount || 0;
      const totalTeachers = teacherCount || 0;
      const totalClasses = classesCount || 0;

      // Calculate attendance percentage (FIXED: with debugging)
      const presentToday = studentAttendance?.filter(att => att.status === 'Present').length || 0;
      const attendancePercentage = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

      console.log('=== ADMIN DASHBOARD ATTENDANCE DEBUG ===');
      console.log('Today:', new Date().toISOString().split('T')[0]);
      console.log('Total students in system:', totalStudents);
      console.log('Students marked present today:', presentToday);
      console.log('Total attendance records today:', studentAttendance?.length || 0);
      console.log('Today\'s attendance percentage:', attendancePercentage);
      console.log('========================================');

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
        .gte('event_date', format(new Date(), 'yyyy-MM-dd'))
        .order('event_date', { ascending: true })
        .limit(10);

      if (eventsData && !eventsError) {
        setEvents(eventsData.map(event => ({
          id: event.id,
          type: event.event_type || 'Event',
          title: event.title,
          date: event.event_date,
          icon: event.icon || 'calendar',
          color: event.color || '#FF9800'
        })));
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
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      await loadDashboardData();
      await loadChartData();
    };

    initializeDashboard();

    // Subscribe to Supabase real-time updates for multiple tables
    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students'
      }, () => {
        loadDashboardData();
        loadChartData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_attendance'
      }, () => {
        loadDashboardData();
        loadChartData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_fees'
      }, () => {
        loadDashboardData();
        loadChartData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications'
      }, () => {
        loadDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'exams'
      }, () => {
        loadDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        loadDashboardData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadChartData()
      ]);
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
    { title: 'Subjects Timetable', icon: 'calendar', color: '#607D8B', screen: 'SubjectsTimetable' }, // Stack screen
    { title: 'Attendance', icon: 'checkmark-circle', color: '#009688', screen: 'AttendanceManagement' }, // Stack screen
    { title: 'Fee Management', icon: 'card', color: '#9C27B0', screen: 'FeeManagement' }, // Stack screen
    { title: 'Expense Management', icon: 'wallet', color: '#F44336', screen: 'ExpenseManagement' }, // Stack screen
    { title: 'Exams & Marks', icon: 'document-text', color: '#795548', screen: 'ExamsMarks' }, // Stack screen
    { title: 'Report Cards', icon: 'document-text', color: '#E91E63', screen: 'ReportCardGeneration' }, // Stack screen
    { title: 'Notifications', icon: 'notifications', color: '#FF5722', screen: 'NotificationManagement' }, // Stack screen
  ];

  // State for chart data (only fee collection data now)

  const [feeCollectionData, setFeeCollectionData] = useState([
    { name: 'Collected', population: 0, color: '#4CAF50', legendFontColor: '#333', legendFontSize: 14 },
    { name: 'Due', population: 0, color: '#F44336', legendFontColor: '#333', legendFontSize: 14 },
  ]);

  // Load chart data
  const loadChartData = async () => {
    try {
      // Load fee collection data
      const currentMonth = format(new Date(), 'yyyy-MM');
      const { data: feeData } = await supabase
        .from('student_fees')
        .select('amount_paid')
        .gte('payment_date', `${currentMonth}-01`);

      const { data: feeStructureData } = await supabase
        .from('fee_structure')
        .select('amount');

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


  // Upcoming Events state - Initialize with empty array, load from database
  const [events, setEvents] = useState([]);
  const [isEventModalVisible, setIsEventModalVisible] = useState(false);
  const [eventInput, setEventInput] = useState({ 
    type: 'Event', 
    title: '', 
    description: '',
    date: '', 
    icon: 'trophy', 
    color: '#FF9800',
    isSchoolWide: true,
    selectedClasses: []
  });
  const [editEventIndex, setEditEventIndex] = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      const { data: classesData, error } = await supabase
        .from('classes')
        .select('id, class_name, section')
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

  const openAddEventModal = () => {
    setEventInput({ 
      type: 'Event', 
      title: '', 
      description: '',
      date: '', 
      icon: 'trophy', 
      color: '#FF9800',
      isSchoolWide: true,
      selectedClasses: [] 
    });
    setEditEventIndex(null);
    loadClasses(); // Load classes when opening modal
    setIsEventModalVisible(true);
  };

  const openEditEventModal = (item, idx) => {
    setEventInput(item);
    setEditEventIndex(idx);
    setIsEventModalVisible(true);
  };

  const saveEvent = async () => {
    if (!eventInput.title || !eventInput.date) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      if (editEventIndex !== null) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update({
            title: eventInput.title,
            event_date: eventInput.date,
            event_type: eventInput.type,
            icon: eventInput.icon,
            color: eventInput.color,
            is_school_wide: true,
            status: 'Active',
            updated_at: new Date().toISOString()
          })
          .eq('id', events[editEventIndex].id);

        if (error) throw error;
      } else {
        // Insert new event
        const { error } = await supabase
          .from('events')
          .insert({
            title: eventInput.title,
            event_date: eventInput.date,
            event_type: eventInput.type,
            icon: eventInput.icon,
            color: eventInput.color,
            is_school_wide: true,
            status: 'Active'
          });

        if (error) throw error;
      }

      await loadDashboardData();
      setIsEventModalVisible(false);
      Alert.alert('Success', 'Event saved successfully!');
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event');
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
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            setError(null);
            loadDashboardData();
            loadChartData();
          }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Admin Dashboard" />

      <ScrollView
        style={styles.scrollView}
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

        {/* Stats Cards - Teacher Dashboard Style */}
        <View style={styles.statsColumnContainer}>
          {stats[0] && (
            <StatCard
              title={stats[0].title}
              value={stats[0].value}
              icon={stats[0].icon}
              color={stats[0].color}
              subtitle={stats[0].subtitle}
              onPress={() => navigation.navigate('Students')}
            />
          )}
          {stats[1] && (
            <StatCard
              title={stats[1].title}
              value={stats[1].value}
              icon={stats[1].icon}
              color={stats[1].color}
              subtitle={stats[1].subtitle}
              onPress={() => navigation.navigate('Teachers')}
            />
          )}
          {stats[2] && (
            <StatCard
              title={stats[2].title}
              value={stats[2].value}
              icon={stats[2].icon}
              color={stats[2].color}
              subtitle={stats[2].subtitle}
              onPress={() => navigation.navigate('AttendanceReport')}
            />
          )}
          {stats[3] && (
            <StatCard
              title={stats[3].title}
              value={stats[3].value}
              icon={stats[3].icon}
              color={stats[3].color}
              subtitle={stats[3].subtitle}
              onPress={() => navigation.navigate('FeeManagement')}
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
                onPress={() => navigation.navigate(action.screen)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={24} color="#fff" />
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
            <TouchableOpacity style={styles.addButton} onPress={openAddEventModal}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.upcomingList}>
            {events.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, idx) => (
              <View key={item.id} style={styles.upcomingItem}>
                <View style={[styles.upcomingIcon, { backgroundColor: item.color }]}> 
                  <Ionicons name={item.icon} size={20} color="#fff" />
                </View>
                <View style={styles.upcomingContent}>
                  <Text style={styles.upcomingTitle}>{item.title}</Text>
                  <Text style={styles.upcomingSubtitle}>{item.type} • {(() => { const [y, m, d] = item.date.split('-'); return `${d}-${m}-${y}`; })()}</Text>
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
          {/* Event Modal */}
          <Modal
            visible={isEventModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setIsEventModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <ScrollView 
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={true}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>{editEventIndex !== null ? 'Edit Event' : 'Add Event'}</Text>
                <TextInput
                  placeholder="Event title"
                  value={eventInput.title}
                  onChangeText={text => setEventInput({ ...eventInput, title: text })}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Event description (optional)"
                  value={eventInput.description}
                  onChangeText={text => setEventInput({ ...eventInput, description: text })}
                  style={[styles.input, { minHeight: 60 }]}
                  multiline
                  numberOfLines={3}
                />
                {/* Date Picker Button for Events */}
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={eventInput.date}
                    onChange={e => setEventInput({ ...eventInput, date: e.target.value })}
                    style={{ ...styles.input, padding: 10, fontSize: 15, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 12 }}
                  />
                ) : (
                  <TouchableOpacity style={styles.input} onPress={() => setShowEventDatePicker(true)}>
                  <Text style={{ color: eventInput.date ? '#333' : '#aaa' }}>
                    {eventInput.date ? (() => { const [y, m, d] = eventInput.date.split('-'); return `${d}-${m}-${y}`; })() : 'Select Date'}
                  </Text>
                </TouchableOpacity>
                )}
                {showEventDatePicker && Platform.OS !== 'web' && (
                  <DateTimePicker
                    value={eventInput.date ? new Date(eventInput.date) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowEventDatePicker(false);
                      if (selectedDate) {
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const yyyy = selectedDate.getFullYear();
                        setEventInput({ ...eventInput, date: `${yyyy}-${mm}-${dd}` }); // keep storage as yyyy-mm-dd
                      }
                    }}
                  />
                )}
                <TextInput
                  placeholder="Type (Event/Exam)"
                  value={eventInput.type}
                  onChangeText={text => setEventInput({ ...eventInput, type: text })}
                  style={styles.input}
                />
                
                {/* Class Selection Section */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>Who can see this event?</Text>
                  
                  {/* School-wide option */}
                  <TouchableOpacity 
                    style={[styles.visibilityOption, eventInput.isSchoolWide && styles.visibilityOptionActive]}
                    onPress={() => {
                      setEventInput({ 
                        ...eventInput, 
                        isSchoolWide: true,
                        selectedClasses: (allClasses || []).map(c => c.id)
                      });
                    }}
                  >
                    <View style={styles.radioButton}>
                      {eventInput.isSchoolWide && <View style={styles.radioButtonInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.visibilityOptionTitle, eventInput.isSchoolWide && styles.visibilityOptionTitleActive]}>
                        Everyone in the school
                      </Text>
                      <Text style={styles.visibilityOptionDesc}>
                        All students, teachers and parents will see this event
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Specific classes option */}
                  <TouchableOpacity 
                    style={[styles.visibilityOption, !eventInput.isSchoolWide && styles.visibilityOptionActive]}
                    onPress={() => {
                      setEventInput({ 
                        ...eventInput, 
                        isSchoolWide: false,
                        selectedClasses: [] 
                      });
                    }}
                  >
                    <View style={styles.radioButton}>
                      {!eventInput.isSchoolWide && <View style={styles.radioButtonInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.visibilityOptionTitle, !eventInput.isSchoolWide && styles.visibilityOptionTitleActive]}>
                        Specific classes only
                      </Text>
                      <Text style={styles.visibilityOptionDesc}>
                        Only selected classes will see this event
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {!eventInput.isSchoolWide && (
                    <View style={styles.classSelectionContainer}>
                      <View style={styles.instructionContainer}>
                        <Ionicons name="information-circle" size={16} color="#2196F3" />
                        <Text style={styles.instructionText}>
                          Tap the classes you want to include in this event
                        </Text>
                      </View>
                      
                      {loadingClasses ? (
                        <View style={{ alignItems: 'center', padding: 20 }}>
                          <ActivityIndicator color="#2196F3" />
                          <Text style={{ color: '#666', marginTop: 8 }}>Loading classes...</Text>
                        </View>
                      ) : (
                        <View>
                          {/* Quick select all button */}
                          <TouchableOpacity
                            style={[styles.quickSelectButton]}
                            onPress={() => {
                              if ((eventInput.selectedClasses || []).length === (allClasses || []).length) {
                                setEventInput({ ...eventInput, selectedClasses: [] });
                              } else {
                                setEventInput({ ...eventInput, selectedClasses: (allClasses || []).map(c => c.id) });
                              }
                            }}
                          >
                            <Ionicons 
                              name={(eventInput.selectedClasses || []).length === (allClasses || []).length ? "checkbox" : "square-outline"} 
                              size={16} 
                              color="#2196F3" 
                            />
                            <Text style={styles.quickSelectText}>
                              {(eventInput.selectedClasses || []).length === (allClasses || []).length ? 'Unselect All' : 'Select All Classes'}
                            </Text>
                          </TouchableOpacity>
                          
                          {/* Class selection area */}
                          <View style={styles.classGridContainer}>
                            <Text style={styles.selectionCountText}>
                              {(eventInput.selectedClasses || []).length} of {(allClasses || []).length} classes selected
                            </Text>
                            <ScrollView 
                              style={styles.classScrollView} 
                              showsVerticalScrollIndicator={true}
                              nestedScrollEnabled={true}
                              bounces={false}
                              keyboardShouldPersistTaps="handled"
                              contentContainerStyle={{ paddingBottom: 8 }}
                            >
                              {(allClasses || []).map((classItem) => {
                                const isSelected = (eventInput.selectedClasses || []).includes(classItem.id);
                                return (
                                  <TouchableOpacity
                                    key={classItem.id}
                                    style={[styles.classChip, isSelected && styles.classChipSelected]}
                                    onPress={() => {
                                      if (isSelected) {
                                        setEventInput({
                                          ...eventInput,
                                          selectedClasses: (eventInput.selectedClasses || []).filter(id => id !== classItem.id)
                                        });
                                      } else {
                                        setEventInput({
                                          ...eventInput,
                                          selectedClasses: [...(eventInput.selectedClasses || []), classItem.id]
                                        });
                                      }
                                    }}
                                  >
                                    <Ionicons 
                                      name={isSelected ? "checkbox" : "square-outline"} 
                                      size={16} 
                                      color={isSelected ? "#2196F3" : "#999"} 
                                      style={{ marginRight: 8 }}
                                    />
                                    <Text style={[styles.classChipText, isSelected && styles.classChipTextSelected]}>
                                      {classItem.class_name} {classItem.section}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                              {(allClasses || []).length === 0 && (
                                <View style={styles.noClassesContainer}>
                                  <Ionicons name="school-outline" size={24} color="#ccc" />
                                  <Text style={styles.noClassesText}>No classes found</Text>
                                </View>
                              )}
                            </ScrollView>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                  {/* Optionally, icon/color pickers can be added here */}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                    <TouchableOpacity onPress={() => setIsEventModalVisible(false)} style={[styles.modalButton, { backgroundColor: '#ccc' }]}> 
                      <Text style={{ color: '#333', fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={saveEvent} style={[styles.modalButton, { backgroundColor: '#2196F3', marginLeft: 8 }]}> 
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{editEventIndex !== null ? 'Save' : 'Add'}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 30,
    minHeight: 200,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
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

});

export default AdminDashboard;
