import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import StatCard from '../../components/StatCard';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import { Platform } from 'react-native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import MessageBadge from '../../components/MessageBadge';
import { useUniversalNotificationCount } from '../../hooks/useUniversalNotificationCount';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';
import { useGlobalRefresh } from '../../contexts/GlobalRefreshContext';

const screenWidth = Dimensions.get('window').width;


const TeacherDashboard = ({ navigation }) => {
  const [personalTasks, setPersonalTasks] = useState([]);
  const [adminTaskList, setAdminTaskList] = useState([]);
  const [allAdminTasks, setAllAdminTasks] = useState([]); // Store all admin tasks
  const [allPersonalTasks, setAllPersonalTasks] = useState([]); // Store all personal tasks
  const [showAllAdminTasks, setShowAllAdminTasks] = useState(false);
  const [showAllPersonalTasks, setShowAllPersonalTasks] = useState(false);
  const [showAddTaskBar, setShowAddTaskBar] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', type: 'attendance', due: '', priority: 'medium' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addTaskModalVisible, setAddTaskModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherStats, setTeacherStats] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState({ attendanceRate: 0, marksDistribution: [] });
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
const [teacherProfile, setTeacherProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date()); // Add current time state
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  
  // Global refresh hook for cross-screen refresh functionality
  const { registerRefreshCallback, triggerScreenRefresh } = useGlobalRefresh();

// Helper to extract class order key
function getClassOrderKey(className) {
  if (!className) return 9999;
  if (className.startsWith('Nursery')) return 0;
  if (className.startsWith('KG')) return 1;
  const match = className.match(/(\d+)/);
  if (match) return 2 + Number(match[1]);
  return 9999;
}

// Helper to format time from database format (HH:MM:SS) to user-friendly format
function formatTimeForDisplay(timeString) {
  if (!timeString) return 'N/A';
  
  try {
    // Handle different time formats
    let timePart = timeString;
    
    // If it includes date, extract time part
    if (timeString.includes('T')) {
      timePart = timeString.split('T')[1].split('.')[0];
    }
    
    // Split time into components
    const [hours, minutes, seconds] = timePart.split(':');
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    
    // Convert to 12-hour format
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    
    // Format minutes with leading zero if needed
    const displayMinute = minute.toString().padStart(2, '0');
    
    return `${displayHour}:${displayMinute} ${period}`;
  } catch (error) {
    console.log('Error formatting time:', timeString, error);
    return timeString; // Return original if formatting fails
  }
}

// Helper to determine the next upcoming class
function getNextClass(schedule) {
  if (!schedule || schedule.length === 0) return null;
  
  const now = new Date();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  
  console.log('🕐 [NEXT_CLASS] Current time:', now.toLocaleTimeString());
  console.log('🕐 [NEXT_CLASS] Current time in minutes:', currentTimeMinutes);
  
  // Convert schedule times to minutes for comparison
  const scheduleWithMinutes = schedule.map(cls => {
    try {
      let timeString = cls.start_time;
      
      // Handle different time formats
      if (timeString.includes('T')) {
        timeString = timeString.split('T')[1].split('.')[0];
      }
      
      const [hours, minutes] = timeString.split(':');
      const classTimeMinutes = parseInt(hours, 10) * 60 + parseInt(minutes, 10);
      
      console.log(`🕐 [NEXT_CLASS] Class "${cls.subject}" at ${cls.start_time} = ${classTimeMinutes} minutes`);
      
      return {
        ...cls,
        timeInMinutes: classTimeMinutes
      };
    } catch (error) {
      console.log('🕐 [NEXT_CLASS] Error parsing time for class:', cls, error);
      return {
        ...cls,
        timeInMinutes: 0
      };
    }
  });
  
  // Find the next upcoming class (after current time)
  const upcomingClasses = scheduleWithMinutes
    .filter(cls => cls.timeInMinutes > currentTimeMinutes)
    .sort((a, b) => a.timeInMinutes - b.timeInMinutes);
  
  if (upcomingClasses.length > 0) {
    console.log('🕐 [NEXT_CLASS] Next upcoming class:', upcomingClasses[0].subject, 'at', upcomingClasses[0].start_time);
    return upcomingClasses[0];
  }
  
  // If no upcoming classes today, return the first class (earliest in the day)
  const sortedClasses = scheduleWithMinutes
    .sort((a, b) => a.timeInMinutes - b.timeInMinutes);
  
  if (sortedClasses.length > 0) {
    console.log('🕐 [NEXT_CLASS] No more classes today, showing first class:', sortedClasses[0].subject, 'at', sortedClasses[0].start_time);
    return sortedClasses[0];
  }
  
  return null;
}

// Group and sort schedule by class
function groupAndSortSchedule(schedule) {
  const groups = {};
  schedule.forEach(item => {
    const classKey = item.class;
    if (!groups[classKey]) groups[classKey] = [];
    groups[classKey].push(item);
  });
  const sortedClassKeys = Object.keys(groups).sort((a, b) => {
    const orderA = getClassOrderKey(a);
    const orderB = getClassOrderKey(b);
    if (orderA !== orderB) return orderA - orderB;
    const secA = a.replace(/\d+/g, '');
    const secB = b.replace(/\d+/g, '');
    return secA.localeCompare(secB);
  });
  return sortedClassKeys.map(classKey => ({ classKey, items: groups[classKey] }));
}

  // Fetch all dashboard data with optimized loading
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate tenant access before proceeding
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        setError(tenantValidation.error);
        setLoading(false);
        return;
      }
      
      // Initialize empty stats with loading state instead of null
      setTeacherStats([
        { title: 'My Students', value: '0', icon: 'people', color: '#2196F3', subtitle: 'Loading...', isLoading: true },
        { title: 'My Subjects', value: '0', icon: 'book', color: '#4CAF50', subtitle: 'Loading...', isLoading: true },
        { title: "Today's Classes", value: '0', icon: 'time', color: '#FF9800', subtitle: 'Loading...', isLoading: true },
        { title: 'Upcoming Events', value: '0', icon: 'calendar', color: '#9E9E9E', subtitle: 'Loading...', isLoading: true }
      ]);
      
      // Declare variables at function level to avoid scope issues
      let currentNotifications = [];
      let currentAdminTasks = [];

      // Run critical initial queries in parallel
      const [schoolResponse, teacherResponse] = await Promise.all([
        dbHelpers.getSchoolDetails(),
        dbHelpers.getTeacherByUserId(user.id)
      ]);
      
      const schoolData = schoolResponse.data;
      const teacherData = teacherResponse.data;
      const teacherError = teacherResponse.error;
      
      setSchoolDetails(schoolData);

      if (teacherError || !teacherData) {
        throw new Error('Teacher profile not found. Please contact administrator.');
      }
      
      // Validate teacher data belongs to correct tenant
      if (teacherData && teacherData.tenant_id) {
        const teacherValidation = validateDataTenancy([{ 
          id: teacherData.id, 
          tenant_id: teacherData.tenant_id 
        }], tenantId, 'Teacher data validation');
        
        if (!teacherValidation) {
          console.error('❌ Teacher data validation failed: undefined');
          Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
          setError('Data validation failed');
          setLoading(false);
          return;
        }
      }

      const teacher = teacherData;
      setTeacherProfile(teacher);

      // Start fetching multiple data sources in parallel for better performance with tenant isolation
      const tenantSubjectQuery = createTenantQuery(tenantId, TABLES.TEACHER_SUBJECTS);
      const tenantClassQuery = createTenantQuery(tenantId, TABLES.CLASSES);
      const tenantNotificationQuery = createTenantQuery(tenantId, TABLES.NOTIFICATIONS);
      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.PERSONAL_TASKS);
      
      const [
        subjectsResponse,
        classTeacherResponse,
        notificationsResponse,
        personalTasksResponse
      ] = await Promise.all([
        // Get assigned subjects with tenant isolation
        tenantSubjectQuery
          .select(`
            *,
            tenant_id,
            subjects(
              name,
              class_id,
              classes(class_name, section)
            )
          `)
          .eq('teacher_id', teacher.id)
          .execute(),
        
        // Get class teacher assignments with tenant isolation
        tenantClassQuery
          .select(`
            id,
            class_name,
            section,
            academic_year,
            tenant_id
          `)
          .eq('class_teacher_id', teacher.id)
          .execute(),
          
        // Get notifications with tenant isolation
        tenantNotificationQuery
          .select('*, tenant_id')
          .order('created_at', { ascending: false })
          .limit(5)
          .execute(),
          
        // Get personal tasks with tenant isolation
        tenantTaskQuery
          .select('*, tenant_id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true })
          .execute()
      ]);
      
      // Process subject assignments
      const assignedSubjects = subjectsResponse.data || [];
      const subjectsError = subjectsResponse.error;
      if (subjectsError) throw subjectsError;
      
      // Validate subject assignments belong to correct tenant
      const subjectValidation = validateDataTenancy(
        assignedSubjects?.map(s => ({ 
          id: s.id, 
          tenant_id: s.tenant_id 
        })) || [],
        tenantId,
        'Subject data validation'
      );
      
      if (!subjectValidation) {
        console.error('❌ Subject data validation failed');
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
        return;
      }
      
      // Process class teacher assignments
      const classTeacherClasses = classTeacherResponse.data || [];
      const classTeacherError = classTeacherResponse.error;
      if (classTeacherError) throw classTeacherError;
      
      // Validate class teacher assignments belong to correct tenant
      if (classTeacherClasses && classTeacherClasses.length > 0) {
        const classValidation = validateDataTenancy(
          classTeacherClasses?.map(c => ({ 
            id: c.id, 
            tenant_id: c.tenant_id 
          })) || [],
          tenantId,
          'Class teacher data validation'
        );
        
        if (!classValidation) {
          console.error('❌ Class teacher data validation failed');
          Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
          return;
        }
      }

      console.log('🏫 Class teacher assignments found:', classTeacherClasses?.length || 0);
      if (classTeacherClasses && classTeacherClasses.length > 0) {
        classTeacherClasses.forEach((cls, index) => {
          console.log(`   ${index + 1}. Class Teacher of: ${cls.class_name} - ${cls.section}`);
        });
      }

      // Process assigned classes (both subject and class teacher)
      const classMap = {};
      
      // Add subject classes
      assignedSubjects.forEach(subject => {
        const className = `${subject.subjects?.classes?.class_name} - ${subject.subjects?.classes?.section}`;
        if (className && className !== 'undefined - undefined') {
          if (!classMap[className]) classMap[className] = [];
          classMap[className].push(subject.subjects?.name || 'Unknown Subject');
        }
      });
      
      // Add class teacher classes
      classTeacherClasses.forEach(cls => {
        const className = `${cls.class_name} - ${cls.section}`;
        if (!classMap[className]) classMap[className] = [];
        if (!classMap[className].includes('Class Teacher')) {
          classMap[className].push('Class Teacher');
        }
      });
      
      console.log('📊 Final class map:', classMap);
      setAssignedClasses(classMap);

      // Get today's schedule (timetable) - optimized version
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[today];

      // Start another parallel fetch for the timetable with tenant isolation
      const tenantTimetableQuery = createTenantQuery(tenantId, TABLES.TIMETABLE);
      const timetableResponse = await tenantTimetableQuery
        .select(`
          id, start_time, end_time, period_number, day_of_week, academic_year, tenant_id,
          subjects(id, name),
          classes(id, class_name, section)
        `)
        .eq('teacher_id', teacher.id)
        .eq('day_of_week', todayName)
        .order('start_time')
        .execute();
        
      // Process notifications from parallel fetch
      const notificationsData = notificationsResponse.data || [];
      setNotifications(notificationsData);
      currentNotifications = notificationsData;
      
      // Process personal tasks from parallel fetch
      const personalTasksData = personalTasksResponse.data || [];
      const allPersonalTasks = personalTasksData || [];
      
      // Debug: Log the actual task data to understand the "Happy" issue
      console.log('🔍 [DEBUG] Personal tasks data:', allPersonalTasks);
      allPersonalTasks.forEach((task, index) => {
        console.log(`📝 [DEBUG] Task ${index + 1}:`, {
          id: task.id,
          task_title: task.task_title,
          task_description: task.task_description,
          task_type: task.task_type,
          priority: task.priority,
          due_date: task.due_date,
          status: task.status
        });
      });
      
      setAllPersonalTasks(allPersonalTasks);
      setPersonalTasks(allPersonalTasks.slice(0, 3)); // Show first 3
      
      // Process timetable data
      try {     
        // Reset schedule to empty first
        setSchedule([]);
        
        const timetableData = timetableResponse.data;
        const timetableError = timetableResponse.error;
        
        if (timetableError) {
          if (timetableError.code === '42P01') {
            setSchedule([]);
          } else {
            throw timetableError;
          }
        }
        
        // Validate timetable data belongs to correct tenant
        if (timetableData && timetableData.length > 0) {
          const timetableValidation = validateDataTenancy(
            timetableData?.map(t => ({ 
              id: t.id, 
              tenant_id: t.tenant_id 
            })) || [],
            tenantId,
            'Timetable data validation'
          );
          
          if (!timetableValidation) {
            console.error('❌ Timetable data validation failed');
            // Don't throw error, just set empty schedule for better UX
            setSchedule([]);
            return;
          }
          
          const processedSchedule = timetableData.map(entry => {
            return {
              id: entry.id,
              subject: entry.subjects?.name || 'Unknown Subject',
              class: entry.classes ? `${entry.classes.class_name} ${entry.classes.section}` : 'Unknown Class',
              start_time: entry.start_time,
              end_time: entry.end_time,
              period_number: entry.period_number,
              day_of_week: entry.day_of_week,
              academic_year: entry.academic_year
            };
          });

          setSchedule(processedSchedule);
        } else {
          setSchedule([]);
        }
        
      } catch (err) {
        console.error('💥 [TIMETABLE] Critical error in timetable fetch:', err);
        console.error('💥 [TIMETABLE] Error details:', {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint
        });
        setSchedule([]);
      }

      // Use announcements from notifications (they come from the same table)
      // This eliminates redundant queries to the same table
      setAnnouncements(notificationsData?.slice(0, 3) || []);
      
      // Start fetching admin tasks and events in parallel with tenant isolation
      const tenantAdminTaskQuery = createTenantQuery(tenantId, TABLES.TASKS);
      const tenantEventQuery = createTenantQuery(tenantId, 'events');
      
      const [adminTasksResponse, eventsResponse] = await Promise.all([
        // Get admin tasks with tenant isolation
        tenantAdminTaskQuery
          .select('*, tenant_id')
          .overlaps('assigned_teacher_ids', [teacher.id])
          .eq('status', 'Pending')
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true })
          .execute(),
          
        // Get events with tenant isolation
        tenantEventQuery
          .select('*, tenant_id')
          .eq('status', 'Active')
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(5)
          .execute()
      ]);

      // Process events data from parallel fetch
      const eventsData = eventsResponse.data || [];
      
      // Map events with minimal processing
      const mappedEvents = eventsData.map(event => {
        return {
          id: event.id,
          type: event.event_type || 'Event',
          title: event.title,
          description: event.description || 'No description available',
          date: event.event_date,
          time: event.start_time || '09:00',
          icon: event.icon || 'calendar',
          color: event.color || '#FF9800',
          priority: event.event_type === 'Exam' ? 'high' : 'medium',
          location: event.location,
          organizer: event.organizer
        };
      });
      
      // Set upcoming events directly
      setUpcomingEvents(mappedEvents.slice(0, 5));
      // Process admin tasks from parallel fetch
      const adminTasksData = adminTasksResponse.data || [];
      const adminTasksError = adminTasksResponse.error;
      
      // Set admin tasks
      if (adminTasksError) {
        currentAdminTasks = [
          {
            id: 't1',
            title: 'Submit monthly attendance report',
            description: 'Please submit your monthly attendance report',
            task_type: 'report',
            priority: 'High',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        ];
      } else {
        currentAdminTasks = adminTasksData || [];
      }
      
      // Update admin task states
      setAllAdminTasks(currentAdminTasks);
      setAdminTaskList(currentAdminTasks.slice(0, 3)); // Show first 3

      // Set a default attendance rate instead of calculating it during initial load
      // This complex calculation can be done later after dashboard loads or on-demand
      setAnalytics({ 
        attendanceRate: 92, // Use a default value initially for faster loading
        marksDistribution: [
          { label: 'Excellent', value: 45 },
          { label: 'Good', value: 30 },
          { label: 'Average', value: 20 },
          { label: 'Poor', value: 5 }
        ]
      });
      
      // Lazy load the actual attendance stats after dashboard is shown
      setTimeout(() => {
        fetchAttendanceAnalytics(classMap, assignedSubjects, classTeacherClasses);
      }, 2000);

      // Recent activities (using function-level variables with unique IDs)
      const recentActivities = [
        ...currentNotifications.slice(0, 3).map((n, index) => ({
          activity: n.message,
          date: n.created_at,
          id: `recent-notification-${n.id || index}`
        })),
        ...currentAdminTasks.slice(0, 2).map((t, index) => ({
          activity: t.message,
          date: t.created_at,
          id: `recent-task-${t.id || index}`
        }))
      ];
      setRecentActivities(recentActivities);

      // Calculate and set teacher stats (moved AFTER events processing to use current data)
      const uniqueClasses = Object.keys(classMap).length;
      const totalSubjects = assignedSubjects.length;
      const todayClasses = schedule.length;

      // Calculate total students from assigned classes - improved version
      let totalStudents = 0;
      const uniqueStudentIds = new Set();
      
      try {
        // Get unique class IDs from both subject assignments and class teacher assignments
        const subjectClassIds = assignedSubjects
          .filter(assignment => assignment.subjects?.class_id)
          .map(assignment => assignment.subjects.class_id);
          
        const classTeacherClassIds = classTeacherClasses
          .map(cls => cls.id);
        
        const uniqueClassIds = [...new Set([...subjectClassIds, ...classTeacherClassIds])];
        
        console.log('💼 Subject class IDs:', subjectClassIds);
        console.log('🏫 Class teacher class IDs:', classTeacherClassIds);
        console.log('📋 Combined unique class IDs:', uniqueClassIds);
        
        if (uniqueClassIds.length > 0) {
          // Get all students from these classes with tenant isolation
          const tenantStudentQuery = createTenantQuery(tenantId, TABLES.STUDENTS);
          const { data: allStudentsData, error: studentsError } = await tenantStudentQuery
            .select('id, class_id, name, tenant_id')
            .in('class_id', uniqueClassIds)
            .execute();

          if (!studentsError && allStudentsData) {
            // Validate student data belongs to correct tenant
            const studentValidation = validateDataTenancy(
              allStudentsData?.map(s => ({ 
                id: s.id, 
                tenant_id: s.tenant_id 
              })) || [],
              tenantId,
              'TeacherDashboard-Students'
            );
            
            if (studentValidation) {
              console.log('👥 Total students found across all classes:', allStudentsData.length);
              allStudentsData.forEach(student => {
                uniqueStudentIds.add(student.id);
                console.log(`📚 Student: ${student.name} (ID: ${student.id}, Class: ${student.class_id})`);
              });
              totalStudents = allStudentsData.length;
            } else {
              console.error('❌ Student data validation failed: Students do not belong to tenant', tenantId);
            }
          } else {
            console.log('❌ Error fetching students:', studentsError);
          }
        } else {
          console.log('⚠️ No class assignments found for teacher');
        }
      } catch (error) {
        console.log('💥 Error calculating students:', error);
      }

      const uniqueStudentCount = uniqueStudentIds.size;
      console.log('📊 Final student count - Total:', totalStudents, 'Unique:', uniqueStudentCount);
      
      // Get current events data with tenant isolation
      let currentEventsForStats = [];
      try {
        const today = new Date().toISOString().split('T')[0];
        const tenantStatsEventQuery = createTenantQuery(tenantId, 'events');
        const { data: statsEventsData } = await tenantStatsEventQuery
          .select('*, tenant_id')
          .eq('status', 'Active')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(5)
          .execute();
        
        currentEventsForStats = statsEventsData || [];
        console.log('📊 Using current events for stats calculation:', currentEventsForStats.length);
      } catch (error) {
        console.log('Error fetching events for stats:', error);
        currentEventsForStats = [];
      }

      // Set enhanced teacher stats using current events data
      setTeacherStats([
        {
          title: 'My Students',
          value: (uniqueStudentCount || 0).toString(),
          icon: 'people',
          color: '#2196F3',
          subtitle: `Across ${uniqueClasses || 0} class${(uniqueClasses || 0) !== 1 ? 'es' : ''}`,
          trend: 0,
          onPress: () => navigation?.navigate('ViewStudentInfo')
        },
        {
          title: 'My Subjects',
          value: (totalSubjects || 0).toString(),
          icon: 'book',
          color: '#4CAF50',
          subtitle: `${uniqueClasses || 0} class${(uniqueClasses || 0) !== 1 ? 'es' : ''} assigned`,
          trend: 0,
          onPress: () => navigation?.navigate('TeacherSubjects')
        },
        {
          title: 'Today\'s Classes',
          value: (todayClasses || 0).toString(),
          icon: 'time',
          color: '#FF9800',
          subtitle: (() => {
            if (schedule?.length === 0) return 'No classes today';
            
            const nextClass = getNextClass(schedule);
            if (!nextClass) return 'No more classes today';
            
            const formattedTime = formatTimeForDisplay(nextClass.start_time);
            return `Next: ${formattedTime}`;
          })(),
          trend: 0,
          onPress: () => navigation?.navigate('TeacherTimetable')
        },
        {
          title: 'Upcoming Events',
          value: (currentEventsForStats?.length || 0).toString(),
          icon: 'calendar',
          color: (currentEventsForStats?.length || 0) > 0 ? '#E91E63' : '#9E9E9E',
          subtitle: (currentEventsForStats?.length || 0) > 0 ?
            `Next: ${currentEventsForStats[0]?.title || 'Event'}` :
            'No events scheduled',
          trend: (currentEventsForStats?.filter(e => e.event_type === 'Exam')?.length || 0) > 0 ? 1 : 0,
          onPress: () => {
            // Scroll to events section or show events modal
            Alert.alert(
              'Upcoming Events',
              (currentEventsForStats?.length || 0) > 0 ?
                currentEventsForStats.map(e => `• ${e.title} (${new Date(e.event_date).toLocaleDateString('en-GB')})`).join('\n') :
                'No upcoming events scheduled.',
              [{ text: 'OK' }]
            );
          }
        }
      ]);
      
      console.log('✅ Teacher stats updated with', currentEventsForStats.length, 'events');
      console.log('📋 Stats card will show:', currentEventsForStats.length, 'upcoming events');

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Register dashboard refresh callback with global refresh context
    registerRefreshCallback('TeacherDashboard', fetchDashboardData);
    
    // Set up real-time subscriptions for dashboard updates
    const dashboardSubscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.PERSONAL_TASKS
      }, () => {
        // Refresh dashboard data when personal tasks change
        console.log('🔄 Personal tasks changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.TASKS
      }, () => {
        // Refresh dashboard data when admin tasks change
        console.log('🔄 Admin tasks changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.NOTIFICATIONS
      }, () => {
        // Refresh dashboard data when notifications change
        console.log('🔄 Notifications changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.STUDENT_ATTENDANCE
      }, () => {
        // Refresh analytics when attendance changes
        console.log('🔄 Student attendance changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.MARKS
      }, () => {
        // Refresh analytics when marks change
        console.log('🔄 Marks changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        // Refresh dashboard when events change
        console.log('🔄 Events changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.TEACHER_SUBJECTS
      }, () => {
        // Refresh dashboard when teacher subject assignments change
        console.log('🔄 Teacher subject assignments changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.CLASSES
      }, () => {
        // Refresh dashboard when class teacher assignments change
        console.log('🔄 Class teacher assignments changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.TIMETABLE
      }, () => {
        // Refresh dashboard when timetable changes (affects Today's Classes)
        console.log('🔄 Timetable changed, refreshing dashboard...');
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      dashboardSubscription.unsubscribe();
    };
  }, []);
  
  // Additional effect to ensure data loads when user is available
  useEffect(() => {
    if (user?.id) {
      console.log('👤 User ready, triggering dashboard data load...');
      // Don't check loading state here - we want to load immediately when user becomes available
      fetchDashboardData();
    }
  }, [user?.id]);

  // Effect to handle data updates when schedule changes
  useEffect(() => {
    if (schedule.length > 0 && !loading) {
      console.log('📅 Schedule loaded, updating stat cards immediately...');
      // Force an immediate update of stat cards when schedule is loaded
      setTeacherStats(prevStats => {
        if (prevStats.length === 0) return prevStats; // Skip if stats not loaded yet
        
        const updatedStats = [...prevStats];
        const todayClasses = schedule.length;
        
        // Update the "Today's Classes" card (index 2) immediately
        if (updatedStats[2]) {
          updatedStats[2] = {
            ...updatedStats[2],
            value: todayClasses.toString(),
            subtitle: (() => {
              if (schedule?.length === 0) return 'No classes today';
              
              const nextClass = getNextClass(schedule);
              if (!nextClass) return 'No more classes today';
              
              const formattedTime = formatTimeForDisplay(nextClass.start_time);
              return `Next: ${formattedTime}`;
            })()
          };
        }
        
        return updatedStats;
      });
    }
  }, [schedule, loading]);

  // Pull-to-refresh handler with cross-screen refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh dashboard data
      await fetchDashboardData();
      
      // Trigger refresh on TeacherNotifications screen to keep notifications in sync
      console.log('🔄 [TeacherDashboard] Triggering cross-screen refresh for TeacherNotifications...');
      triggerScreenRefresh('TeacherNotifications');
      
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  async function handleCompletePersonalTask(id) {
    try {
      // Validate tenant access before completing task
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ [COMPLETE_TASK] Tenant validation failed:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.ACCESS_DENIED);
        return;
      }
      
      console.log('🔄 [COMPLETE_TASK] Completing personal task:', { id, user_id: user.id, tenantId });
      
      const tenantTaskQuery = createTenantQuery(tenantId, TABLES.PERSONAL_TASKS);
      const { data, error } = await tenantTaskQuery
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .execute();

      if (error) {
        console.error('❌ [COMPLETE_TASK] Database error:', error);
        Alert.alert('Error', 'Failed to complete task. Please try again.');
        return;
      }

      console.log('✅ [COMPLETE_TASK] Task completed successfully:', data);
      
      // Remove the task from local state
      setPersonalTasks(tasks => tasks.filter(t => t.id !== id));
      setAllPersonalTasks(tasks => tasks.filter(t => t.id !== id)); // Also remove from all tasks list
      Alert.alert('Success', 'Task completed successfully!');
    } catch (error) {
      console.error('❌ [COMPLETE_TASK] Unexpected error:', error);
      Alert.alert('Error', 'Failed to complete task. Please try again.');
    }
  }
  async function handleAddTask() {
    if (!newTask.title || !newTask.due) {
      Alert.alert('Missing Fields', 'Please enter both a task title and due date.');
      return;
    }

    try {
      // Validate tenant access before adding task
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ [ADD_TASK] Tenant validation failed:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.ACCESS_DENIED);
        return;
      }

      console.log('🔄 [ADD_TASK] Creating new task with data:', {
        title: newTask.title,
        description: newTask.description,
        type: newTask.type,
        priority: newTask.priority,
        due: newTask.due,
        user_id: user.id,
        tenant_id: tenantId
      });
      
      // Validate required fields
      if (!user.id || !tenantId) {
        console.error('❌ [ADD_TASK] Missing required IDs:', { user_id: user.id, tenant_id: tenantId });
        Alert.alert('Error', 'Missing user or tenant information. Please log in again.');
        return;
      }
      
      // Check if personal_tasks table exists, if not, use the tasks table as fallback
      let tableToUse = TABLES.PERSONAL_TASKS;
      let insertData = {
        user_id: user.id,
        task_title: newTask.title,
        task_description: newTask.description || newTask.title,
        task_type: newTask.type,
        priority: newTask.priority.toLowerCase(), // Match constraint (low, medium, high)
        due_date: newTask.due,
        status: 'pending', // Match constraint (pending, in progress, completed)
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Try personal_tasks table first
      console.log('🔄 [ADD_TASK] Attempting insert with data:', insertData);
      console.log('🔄 [ADD_TASK] Using table:', tableToUse);
      
      let { data, error } = await supabase
        .from(tableToUse)
        .insert(insertData)
        .select();
        
      console.log('🔄 [ADD_TASK] Insert response:', { data, error });
      
      // If personal_tasks table doesn't exist or has issues, try the tasks table
      if (error && (error.code === '42P01' || error.message.includes('relation "personal_tasks" does not exist'))) {
        console.warn('⚠️ [ADD_TASK] personal_tasks table not found, using tasks table as fallback');
        tableToUse = TABLES.TASKS;
        // Adjust data format for tasks table which uses assigned_teacher_ids array
        insertData = {
          title: newTask.title,
          description: newTask.description || newTask.title,
          task_type: newTask.type,
          priority: newTask.priority.charAt(0).toUpperCase() + newTask.priority.slice(1),
          due_date: newTask.due,
          status: 'Pending',
          assigned_teacher_ids: [user.id], // Use array for tasks table
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const result = await supabase
          .from(tableToUse)
          .insert(insertData)
          .select();
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ [ADD_TASK] Database error:', error);
        console.error('❌ [ADD_TASK] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          table_used: tableToUse
        });
        Alert.alert('Error', `Failed to add task: ${error.message}`);
        return;
      }

      // Add the new task to the local state
      if (data && data[0]) {
        console.log('✅ [ADD_TASK] Task created successfully in table:', tableToUse, data[0]);
        
        // Normalize the data structure for display
        const normalizedTask = {
          ...data[0],
          task_title: data[0].task_title || data[0].title,
          task_description: data[0].task_description || data[0].description,
          task_type: data[0].task_type,
          user_id: data[0].user_id || (data[0].assigned_teacher_ids && data[0].assigned_teacher_ids[0])
        };
        
        setPersonalTasks(tasks => [normalizedTask, ...tasks]);
        setAllPersonalTasks(tasks => [normalizedTask, ...tasks]);
        
        // Reset form and close modal
        setNewTask({ title: '', description: '', type: 'attendance', due: '', priority: 'medium' });
        setAddTaskModalVisible(false);
        Alert.alert('Success', 'Personal task created successfully!');
      } else {
        console.error('❌ [ADD_TASK] No data returned from insert operation');
        Alert.alert('Error', 'Task creation failed - no data returned.');
      }
    } catch (error) {
      console.error('❌ [ADD_TASK] Unexpected error:', error);
      Alert.alert('Error', 'Failed to add task. Please try again.');
    }
  }
  async function handleCompleteAdminTask(id) {
    try {
      // Validate tenant access before completing admin task
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for complete admin task:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        return;
      }
      
      const tenantAdminTaskQuery = createTenantQuery(tenantId, TABLES.TASKS);
      const { error } = await tenantAdminTaskQuery
        .update({
          status: 'Completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .overlaps('assigned_teacher_ids', [teacherProfile?.id])
        .execute();

      if (error) {
        console.error('Error completing admin task:', error);
        Alert.alert('Error', 'Failed to complete task. Please try again.');
        return;
      }

      // Remove the task from local state
      setAdminTaskList(tasks => tasks.filter(t => t.id !== id));
      Alert.alert('Success', 'Task completed successfully!');
    } catch (error) {
      console.error('Error completing admin task:', error);
      Alert.alert('Error', 'Failed to complete task. Please try again.');
    }
  }

  const groupedSchedule = groupAndSortSchedule(schedule);

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  // Helper function to get priority colors and labels
  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'high':
        return { color: '#f44336', label: 'High', bgColor: '#ffebee' };
      case 'medium':
        return { color: '#ff9800', label: 'Medium', bgColor: '#fff3e0' };
      case 'low':
        return { color: '#4caf50', label: 'Low', bgColor: '#e8f5e8' };
      default:
        return { color: '#ff9800', label: 'Medium', bgColor: '#fff3e0' };
    }
  };

  // Helper function to get task type information
  const getTaskTypeInfo = (type) => {
    switch (type) {
      case 'attendance':
        return {
          icon: 'people',
          color: '#388e3c',
          label: 'Attendance',
          bgColor: '#e8f5e8'
        };
      case 'marks':
        return {
          icon: 'document-text',
          color: '#1976d2',
          label: 'Marks & Grades',
          bgColor: '#e3f2fd'
        };
      case 'homework':
        return {
          icon: 'school',
          color: '#ff9800',
          label: 'Homework',
          bgColor: '#fff3e0'
        };
      case 'meeting':
        return {
          icon: 'people-circle',
          color: '#9c27b0',
          label: 'Meeting',
          bgColor: '#f3e5f5'
        };
      case 'report':
        return {
          icon: 'bar-chart',
          color: '#f44336',
          label: 'Report',
          bgColor: '#ffebee'
        };
      case 'planning':
        return {
          icon: 'calendar',
          color: '#00bcd4',
          label: 'Planning',
          bgColor: '#e0f2f1'
        };
      default:
        return {
          icon: 'clipboard',
          color: '#666',
          label: 'General',
          bgColor: '#f5f5f5'
        };
    }
  };

  // Helper function to sort tasks by priority
  const sortTasksByPriority = (tasks) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return [...tasks].sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;
      return bPriority - aPriority;
    });
  };

  // Use universal notification count hook for real-time badge updates
  // IMPORTANT: Using notificationCount for bell icon (system notifications ONLY)
  const { 
    totalCount = 0, 
    notificationCount = 0, 
    messageCount = 0, 
    loading: notificationLoading, 
    refresh: refreshNotificationCount 
  } = useUniversalNotificationCount({
    autoRefresh: true,
    realTime: true,
    context: 'TeacherDashboard-BellIcon', // For debugging purposes
    onCountChange: (counts) => {
      console.log('🔔 [TeacherDashboard] Notification counts updated:', counts);
      console.log('📊 [TeacherDashboard] Count usage: Bell icon shows notificationCount =', counts.notificationCount);
    }
  }) || {};
  
  // Use notificationCount for bell icon (EXCLUDES chat messages - system notifications only)
  const unreadCount = notificationCount;
  
  // Debug the notification count separation with clear explanation
  console.log('📱 TeacherDashboard - Notification counts breakdown:', {
    totalCount: totalCount + ' (messages + notifications combined)',
    notificationCount: notificationCount + ' (system notifications only - USED IN BELL ICON)',
    messageCount: messageCount + ' (chat messages only - NOT used in bell)',
    unreadCount: unreadCount + ' (what actually shows in bell icon)',
    notificationLoading,
    userId: user?.id,
    '⚠️ NOTE': 'Bell icon should ONLY show system notifications, NOT chat messages'
  });

  // No need for manual refresh - universal hook handles everything automatically
  
  // Function to fetch attendance analytics separately after dashboard loads
  const fetchAttendanceAnalytics = async (classMap, assignedSubjects, classTeacherClasses) => {
    if (!classMap) return;
    
    try {
      // Validate tenant access before fetching analytics
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for attendance analytics:', tenantValidation.error);
        return; // Silent return for better UX
      }
      
      let totalAttendance = 0, totalDays = 0;
      let attendanceDataFetched = false;
      
      // Get attendance data for a sample of students for quicker loading with tenant isolation
      const tenantStudentQuery = createTenantQuery(tenantId, TABLES.STUDENTS);
      const tenantAttendanceQuery = createTenantQuery(tenantId, TABLES.STUDENT_ATTENDANCE);
      
      // Get class IDs from the class map for analytics
      const classIds = uniqueClassIds.slice(0, 2); // Only check first 2 classes for performance
      
      if (classIds.length > 0) {
        const { data: studentsData } = await tenantStudentQuery
          .select('id, tenant_id, class_id')
          .in('class_id', classIds)
          .limit(10) // Check up to 10 students total
          .execute();

        console.log(`📊 [ANALYTICS] Found ${studentsData?.length || 0} students in class ${classId}`);

        if (studentsData && studentsData.length > 0) {
          // Validate student data belongs to correct tenant
          const studentValidation = await validateDataTenancy(
            studentsData?.map(s => ({ 
              id: s.id, 
              tenant_id: s.tenant_id 
            })) || [],
            tenantId
          );
          
          if (!studentValidation) {
            console.error('❌ Student data validation failed in analytics: Students do not belong to tenant', tenantId);
            return; // Exit analytics function since validation failed
          }
          
          for (const student of studentsData) {
            const { data: attendanceData } = await tenantAttendanceQuery
              .select('status, tenant_id')
              .eq('student_id', student.id)
              .limit(10)
              .execute(); // Only check 10 most recent attendance records

            if (attendanceData && attendanceData.length > 0) {
              attendanceDataFetched = true;
              totalAttendance += attendanceData.filter(a => a.status === 'Present').length;
              totalDays += attendanceData.length;
              console.log(`📊 [ANALYTICS] Student ${student.name}: ${attendanceData.filter(a => a.status === 'Present').length}/${attendanceData.length} present`);
            }
          }
        }
      }
      
      if (attendanceDataFetched) {
        const calculatedRate = totalDays ? Math.round((totalAttendance / totalDays) * 100) : 92;
        console.log(`📊 [ANALYTICS] Calculated attendance rate: ${calculatedRate}% (${totalAttendance}/${totalDays})`);
        setAnalytics(prev => ({ 
          ...prev,
          attendanceRate: calculatedRate
        }));
      } else {
        console.log('📊 [ANALYTICS] No attendance data found, keeping default rate');
      }
    } catch (error) {
      console.log('📊 [ANALYTICS] Error calculating attendance analytics:', error);
    }
  };

  // Add real-time clock updates for time-sensitive stat cards
  useEffect(() => {
    // Update current time every minute to refresh next class logic
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Only update stats if we have schedule data and teacher stats
      if (schedule.length > 0 && teacherStats.length >= 3) {
        console.log('🔄 [REAL_TIME] Updating next class display...');
        
        // Update just the Today's Classes stat card with new time calculation
        setTeacherStats(prevStats => {
          const updatedStats = [...prevStats];
          
          // Update the "Today's Classes" card (index 2)
          if (updatedStats[2]) {
            updatedStats[2] = {
              ...updatedStats[2],
              subtitle: (() => {
                if (schedule?.length === 0) return 'No classes today';
                
                const nextClass = getNextClass(schedule);
                if (!nextClass) return 'No more classes today';
                
                const formattedTime = formatTimeForDisplay(nextClass.start_time);
                return `Next: ${formattedTime}`;
              })()
            };
          }
          
          return updatedStats;
        });
      }
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [schedule]); // Re-setup timer when schedule changes

  if (loading) {
    return (
      <View style={styles.container}>
        <Header 
          title="Teacher Dashboard" 
          showNotifications={true}
          unreadCount={unreadCount}
          onNotificationsPress={() => navigation.navigate('TeacherNotifications')}
        />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Welcome Section with skeleton loading */}
          <View style={styles.welcomeSection}>
            <View style={[styles.skeletonText, { width: '60%', height: 24, marginBottom: 8 }]} />
            <View style={[styles.skeletonText, { width: '40%', height: 16 }]} />
          </View>
          
          {/* School Details Card with skeleton loading */}
          <View style={styles.schoolDetailsSection}>
            <View style={styles.backgroundCircle1} />
            <View style={styles.backgroundCircle2} />
            <View style={styles.backgroundPattern} />
            
            <View style={styles.welcomeContent}>
              <View style={styles.schoolHeader}>
                <View style={[styles.logoPlaceholder, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                  <View style={styles.skeletonImage} />
                </View>
                <View style={styles.schoolInfo}>
                  <View style={[styles.skeletonText, { width: '80%', height: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} />
                  <View style={[styles.skeletonText, { width: '50%', height: 14, backgroundColor: 'rgba(255, 255, 255, 0.2)', marginTop: 4 }]} />
                </View>
              </View>
              
              <View style={styles.dateContainer}>
                <View style={[styles.skeletonText, { width: '70%', height: 16, backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} />
              </View>
            </View>
          </View>
          
          {/* Stats Card Skeletons */}
          <View style={styles.statsSection}>
            <View style={styles.statsSectionHeader}>
              <Ionicons name="analytics" size={20} color="#1976d2" />
              <Text style={styles.statsSectionTitle}>Quick Overview</Text>
            </View>
            
            <View style={styles.statsColumnContainer}>
              {teacherStats.map((stat, index) => (
                <StatCard key={index} {...stat} loading={loading} />
              ))}
            </View>
          </View>
          
          {/* Quick Actions Skeleton */}
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIcon}>
                <Ionicons name="flash" size={20} color="#1976d2" />
              </View>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <View style={styles.quickActionsGrid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.quickActionCard, styles.skeletonCard]}>
                  <View style={[styles.skeletonCircle, { marginBottom: 10 }]} />
                  <View style={[styles.skeletonText, { width: '70%', height: 14 }]} />
                  <View style={[styles.skeletonText, { width: '90%', height: 12, marginTop: 4 }]} />
                </View>
              ))}
            </View>
          </View>
          
          {/* Loading message at bottom */}
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={{ marginTop: 10, color: '#1976d2', fontSize: 16 }}>Loading your dashboard...</Text>
            <Text style={{ marginTop: 4, color: '#666', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 }}>Preparing your personalized dashboard with the latest data</Text>
          </View>
        </ScrollView>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <Header 
          title="Teacher Dashboard" 
          showNotifications={true}
          onNotificationsPress={() => navigation.navigate('TeacherNotifications')}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 20 }}>Error: {error}</Text>
          <TouchableOpacity style={{ backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }} onPress={fetchDashboardData}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Header 
          title="Teacher Dashboard" 
          showNotifications={true}
          unreadCount={unreadCount}
          onNotificationsPress={() => navigation.navigate('TeacherNotifications')}
        />
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF9800']}
              progressBackgroundColor="#fff"
            />
          }
        >
        {/* Welcome Section at the very top */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Welcome back, {teacherProfile?.name || teacherProfile?.full_name || 'Teacher'}!
          </Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>

        {/* School Details Card - AdminDashboard Style */}
        {schoolDetails && (
          <View style={styles.schoolDetailsSection}>
            {/* Decorative background elements */}
            <View style={styles.backgroundCircle1} />
            <View style={styles.backgroundCircle2} />
            <View style={styles.backgroundPattern} />
            
            <View style={styles.welcomeContent}>
              <View style={styles.schoolHeader}>
                {schoolDetails.logo_url ? (
                  <Image source={{ uri: schoolDetails.logo_url }} style={styles.schoolLogo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="school" size={40} color="#fff" />
                  </View>
                )}
                <View style={styles.schoolInfo}>
                  <Text style={styles.schoolName}>
                    {schoolDetails.name || 'Maximus School'}
                  </Text>
                  <Text style={styles.schoolType}>
                    {schoolDetails.type || 'Educational Institution'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.schoolDateText}>{new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</Text>
              </View>
            </View>
          </View>
        )}
        {/* Enhanced Stats Cards Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Ionicons name="analytics" size={20} color="#1976d2" />
            <Text style={styles.statsSectionTitle}>Quick Overview</Text>
          </View>

          <View style={styles.statsColumnContainer}>
            {teacherStats[0] ? (
              <StatCard {...teacherStats[0]} loading={loading} />
            ) : (
              <StatCard
                title="My Students"
                value="0"
                icon="people"
                color="#2196F3"
                subtitle="Loading..."
                loading={loading}
              />
            )}

            {teacherStats[1] ? (
              <StatCard {...teacherStats[1]} loading={loading} />
            ) : (
              <StatCard
                title="My Subjects"
                value="0"
                icon="book"
                color="#4CAF50"
                subtitle="Loading..."
                loading={loading}
              />
            )}

            {teacherStats[2] ? (
              <StatCard {...teacherStats[2]} loading={loading} />
            ) : (
              <StatCard
                title="Today's Classes"
                value="0"
                icon="time"
                color="#FF9800"
                subtitle="Loading..."
                loading={loading}
              />
            )}

            {teacherStats[3] ? (
              <StatCard {...teacherStats[3]} loading={loading} />
            ) : (
              <StatCard
                title="Attendance Rate"
                value="0%"
                icon="checkmark-circle"
                color="#4CAF50"
                subtitle="Loading..."
                loading={loading}
              />
            )}
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
              onPress={() => navigation.navigate('TeacherTimetable')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#1976d2' }]}>
                <Ionicons name="calendar" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>My Timetable</Text>
              <Text style={styles.actionSubtitle}>View weekly schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Attendance')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4caf50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Attendance</Text>
              <Text style={styles.actionSubtitle}>Mark student attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Marks')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#ff9800' }]}>
                <Ionicons name="document-text" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Marks & Exams</Text>
              <Text style={styles.actionSubtitle}>Manage assessments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ViewStudentInfo')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9c27b0' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Students</Text>
              <Text style={styles.actionSubtitle}>View student info</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ViewSubmissions')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#e91e63' }]}>
                <Ionicons name="document-text-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Submissions</Text>
              <Text style={styles.actionSubtitle}>Grade assignments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('LeaveApplication')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="calendar-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Leave Request</Text>
              <Text style={styles.actionSubtitle}>Apply for leave</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Today's Schedule below stats */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="calendar" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Today's Schedule & Upcoming Classes</Text>
          </View>
          <View style={{ marginHorizontal: 4, marginTop: 8 }}>
            {schedule.length === 0 ? (
              <View style={styles.emptyScheduleContainer}>
                <Ionicons name="calendar-outline" size={48} color="#ccc" />
                <Text style={styles.emptyScheduleText}>No classes scheduled for today</Text>
                <Text style={styles.emptyScheduleSubtext}>Enjoy your free day!</Text>
              </View>
            ) : (
              groupedSchedule.map(group => (
                <View key={group.classKey} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#1976d2', marginBottom: 4, marginLeft: 4 }}>
                    Class: {group.classKey}
                  </Text>
                  {group.items.map((item, index) => (
                    <TouchableOpacity
                      key={`schedule-${group.classKey}-${item.id || index}`}
                      style={styles.scheduleItem}
                      onPress={() => navigation.navigate('TeacherTimetable')}
                    >
                      <View style={styles.scheduleItemIcon}>
                        <Ionicons name="time" size={20} color="#1976d2" />
                      </View>
                      <View style={styles.scheduleItemContent}>
                        <Text style={styles.scheduleSubjectText}>{item.subject}</Text>
                        <Text style={styles.scheduleTimeText}>
                          {item.start_time} - {item.end_time} | Period {item.period_number}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </View>
        </View>
        {/* Enhanced Tasks Section */}
        <View style={styles.section}>
          <View style={styles.tasksHeader}>
            <View style={styles.tasksHeaderLeft}>
              <View style={styles.tasksIconContainer}>
                <Ionicons name="list-circle" size={24} color="#1976d2" />
              </View>
              <View>
                <Text style={styles.tasksTitle}>My Tasks</Text>
                <Text style={styles.tasksSubtitle}>
                  {(adminTaskList.length + personalTasks.length)} pending tasks
                </Text>
              </View>
            </View>
          </View>
          {/* Admin Tasks Section */}
          <View style={styles.tasksCategorySection}>
            <View style={styles.tasksCategoryHeader}>
              <View style={styles.tasksCategoryBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#1976d2" />
                <Text style={styles.tasksCategoryTitle}>Admin Tasks</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.tasksCategoryCount}>
                  <Text style={styles.tasksCategoryCountText}>
                    {showAllAdminTasks ? allAdminTasks.length : adminTaskList.length}
                  </Text>
                </View>
                {allAdminTasks.length > 3 && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowAllAdminTasks(!showAllAdminTasks);
                      setAdminTaskList(showAllAdminTasks ? allAdminTasks.slice(0, 3) : allAdminTasks);
                    }}
                    style={styles.viewAllButton}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewAllText}>
                      {showAllAdminTasks ? 'Show Less' : 'View All'}
                    </Text>
                    <Ionicons 
                      name={showAllAdminTasks ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      color="#1976d2" 
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.tasksContainer}>
              {adminTaskList.length === 0 && (
                <View style={styles.emptyTasksContainer}>
                  <Ionicons name="checkmark-done-circle" size={48} color="#e0e0e0" />
                  <Text style={styles.emptyTasksText}>All admin tasks completed!</Text>
                  <Text style={styles.emptyTasksSubtext}>Great job staying on top of your responsibilities</Text>
                </View>
              )}
              {sortTasksByPriority(adminTaskList).map((task, index) => {
                const priorityInfo = getPriorityInfo(task.priority);
                const typeInfo = getTaskTypeInfo(task.task_type || task.type);
                return (
                  <View key={`admin-task-${task.id || index}`} style={[styles.taskCard, { borderLeftColor: priorityInfo.color }]}>
                    <View style={styles.taskCardHeader}>
                      <View style={styles.taskCardContent}>
                        <View style={[styles.taskTypeIcon, { backgroundColor: typeInfo.color }]}>
                          <Ionicons
                            name={typeInfo.icon}
                            size={20}
                            color="#fff"
                          />
                        </View>
                        <View style={styles.taskInfo}>
                          <View style={styles.taskTitleRow}>
                            <Text style={styles.taskTitle}>{task.title || task.task_title || task.task || task.message}</Text>
                            <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.bgColor }]}>
                              <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                                {priorityInfo.label}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.taskMeta}>
                            <Ionicons name="calendar-outline" size={14} color="#666" />
                            <Text style={styles.taskDueDate}>
                              Due: {task.due_date || task.due ?
                                new Date(task.due_date || task.due).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }) :
                                new Date(task.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })
                              }
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCompleteAdminTask(task.id)}
                      style={styles.completeTaskButton}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.completeTaskButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
          {/* Personal Tasks Section */}
          <View style={styles.tasksCategorySection}>
            <View style={styles.tasksCategoryHeader}>
              <View style={styles.tasksCategoryBadge}>
                <Ionicons name="person-circle" size={16} color="#4CAF50" />
                <Text style={[styles.tasksCategoryTitle, { color: '#4CAF50' }]}>Personal Tasks</Text>
              </View>
              <View style={styles.personalTasksHeaderRight}>
                <View style={[styles.tasksCategoryCount, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.tasksCategoryCountText}>
                    {showAllPersonalTasks ? allPersonalTasks.length : personalTasks.length}
                  </Text>
                </View>
                {allPersonalTasks.length > 3 && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowAllPersonalTasks(!showAllPersonalTasks);
                      setPersonalTasks(showAllPersonalTasks ? allPersonalTasks.slice(0, 3) : allPersonalTasks);
                    }}
                    style={[styles.viewAllButton, { backgroundColor: '#e8f5e8', marginLeft: 8, marginRight: 8 }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.viewAllText, { color: '#4CAF50' }]}>
                      {showAllPersonalTasks ? 'Show Less' : 'View All'}
                    </Text>
                    <Ionicons 
                      name={showAllPersonalTasks ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      color="#4CAF50" 
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setAddTaskModalVisible(true)}
                  style={styles.addPersonalTaskButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.addPersonalTaskButtonText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            </View>
          {/* Inline Add Task Bar */}
          {/* This section is now redundant as the modal is rendered outside */}
          {/* {addTaskModalVisible && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.18)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}>
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 14,
                padding: 20,
                width: '85%',
                elevation: 4,
                maxWidth: 400,
              }}>
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Add New Task</Text>
                <TextInput
                  placeholder="Task description"
                  value={newTask.task}
                  onChangeText={text => setNewTask(t => ({ ...t, task: text }))}
                  style={{ borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 15 }}
                />
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <TouchableOpacity onPress={() => setNewTask(t => ({ ...t, type: 'attendance' }))} style={{ backgroundColor: newTask.type === 'attendance' ? '#388e3c' : '#eee', borderRadius: 8, padding: 8, marginRight: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color={newTask.type === 'attendance' ? '#fff' : '#888'} />
                    <Text style={{ color: newTask.type === 'attendance' ? '#fff' : '#333', marginLeft: 4 }}>Attendance</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNewTask(t => ({ ...t, type: 'marks' }))} style={{ backgroundColor: newTask.type === 'marks' ? '#1976d2' : '#eee', borderRadius: 8, padding: 8, marginRight: 8 }}>
                    <Ionicons name="document-text" size={18} color={newTask.type === 'marks' ? '#fff' : '#888'} />
                    <Text style={{ color: newTask.type === 'marks' ? '#fff' : '#333', marginLeft: 4 }}>Marks</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNewTask(t => ({ ...t, type: 'homework' }))} style={{ backgroundColor: newTask.type === 'homework' ? '#ff9800' : '#eee', borderRadius: 8, padding: 8 }}>
                    <Ionicons name="cloud-upload" size={18} color={newTask.type === 'homework' ? '#fff' : '#888'} />
                    <Text style={{ color: newTask.type === 'homework' ? '#fff' : '#333', marginLeft: 4 }}>Homework</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    fontSize: 15,
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Text style={{ color: newTask.due ? '#333' : '#aaa', fontSize: 15 }}>
                    {newTask.due ? newTask.due : 'Select Due Date'}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={newTask.due ? new Date(newTask.due) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const yyyy = selectedDate.getFullYear();
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        setNewTask(t => ({ ...t, due: `${yyyy}-${mm}-${dd}` }));
                      }
                    }}
                  />
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => { setAddTaskModalVisible(false); setNewTask({ task: '', type: 'attendance', due: '' }); }}
                    style={{
                      backgroundColor: '#aaa',
                      borderRadius: 24,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      marginRight: 10,
                      elevation: 2,
                      shadowColor: '#aaa',
                      shadowOpacity: 0.10,
                      shadowRadius: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddTask}
                    style={{
                      backgroundColor: '#1976d2',
                      borderRadius: 24,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      elevation: 2,
                      shadowColor: '#1976d2',
                      shadowOpacity: 0.10,
                      shadowRadius: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )} */}

            <View style={styles.tasksContainer}>
              {personalTasks.length === 0 && (
                <View style={styles.emptyTasksContainer}>
                  <Ionicons name="happy" size={48} color="#e0e0e0" />
                  <Text style={styles.emptyTasksText}>No personal tasks!</Text>
                  <Text style={styles.emptyTasksSubtext}>Add a task to get started with your personal organization</Text>
                </View>
              )}
              {sortTasksByPriority(personalTasks).map((task, index) => {
                const priorityInfo = getPriorityInfo(task.priority);
                const typeInfo = getTaskTypeInfo(task.task_type || task.type);
                return (
                  <View key={`personal-task-${task.id || index}`} style={[styles.taskCard, { borderLeftColor: priorityInfo.color }]}>
                    <View style={styles.taskCardHeader}>
                      <View style={styles.taskCardContent}>
                        <View style={[styles.taskTypeIcon, { backgroundColor: typeInfo.color }]}>
                          <Ionicons
                            name={typeInfo.icon}
                            size={20}
                            color="#fff"
                          />
                        </View>
                        <View style={styles.taskInfo}>
                          <View style={styles.taskTitleRow}>
                            <View style={styles.taskTitleContainer}>
                              <Text style={styles.taskTitle}>
                                {task.task_title || 'Untitled Task'}
                              </Text>
                              {task.task_description && task.task_description !== task.task_title && (
                                <Text style={styles.taskDescription} numberOfLines={2}>
                                  {task.task_description}
                                </Text>
                              )}
                            </View>
                            <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.bgColor }]}>
                              <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                                {priorityInfo.label}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.taskMeta}>
                            <Ionicons name="calendar-outline" size={14} color="#666" />
                            <Text style={styles.taskDueDate}>
                              Due: {task.due_date || task.due ?
                                new Date(task.due_date || task.due).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }) :
                                new Date(task.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })
                              }
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCompletePersonalTask(task.id)}
                      style={[styles.completeTaskButton, { backgroundColor: '#4CAF50' }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.completeTaskButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        {/* Recent Notifications and Messages */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="notifications" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Recent Notifications & Messages</Text>
          </View>
          <View style={{ marginHorizontal: 12, marginBottom: 18 }}>
            {notifications.map((note, index) => (
              <View key={`notification-${note.id || index}`} style={styles.notificationCard}>
                <Text style={{ color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>{note.message}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Ionicons name="calendar" size={14} color="#888" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#888', fontSize: 13 }}>
                    {note.created_at ? new Date(note.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }) : 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        {/* Analytics */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="analytics" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Analytics</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 8, marginBottom: 18 }}>
            <View style={styles.analyticsCard}>
              <Text style={{ fontWeight: 'bold', color: '#388e3c', fontSize: 16 }}>Attendance Rate</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="checkmark-circle" size={22} color="#388e3c" style={{ marginRight: 6 }} />
                <Text style={{ color: '#1976d2', fontSize: 26, fontWeight: 'bold' }}>{analytics.attendanceRate}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 10 }}>
                <View style={{ width: `${analytics.attendanceRate}%`, height: 6, backgroundColor: '#388e3c', borderRadius: 3 }} />
              </View>
            </View>
            <View style={[styles.analyticsCard, { borderColor: '#fff3e0' }]}>
              <Text style={{ fontWeight: 'bold', color: '#ff9800', fontSize: 16 }}>Marks Distribution</Text>
              {analytics.marksDistribution.map(dist => (
                <View key={dist.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff9800', marginRight: 6 }} />
                  <Text style={{ color: '#333', fontSize: 15 }}>{dist.label}: {dist.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        {/* Assigned Classes & Subjects Summary */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="school" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Assigned Classes & Subjects</Text>
          </View>
          <View style={{ marginHorizontal: 12, marginBottom: 12 }}>
            {Object.entries(assignedClasses).map(([className, subjects]) => (
              <View key={className} style={styles.classSubjectCard}>
                <Text style={{ fontWeight: 'bold', color: '#388e3c', fontSize: 15, marginBottom: 4 }}>Class {className}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {subjects.map((subject, index) => (
                    <View key={`${className}-subject-${subject}-${index}`} style={{ backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8, marginBottom: 6 }}>
                      <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>{subject}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="calendar-outline" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity
              style={styles.addEventButton}
              onPress={() => Alert.alert('Add Event', 'Event management feature coming soon!')}
            >
              <Ionicons name="add-circle" size={24} color="#1976d2" />
            </TouchableOpacity>
          </View>

          {upcomingEvents.length === 0 ? (
            <View style={styles.emptyEventsContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.emptyEventsText}>No upcoming events</Text>
              <Text style={styles.emptyEventsSubtext}>Your schedule is clear for now</Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {upcomingEvents.map((event, index) => (
                <TouchableOpacity
                  key={`event-${event.id || index}`}
                  style={[styles.eventCard, { borderLeftColor: event.color }]}
                  onPress={() => {
                    Alert.alert(
                      event.title,
                      `${event.description}\n\nDate: ${new Date(event.date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}\nTime: ${event.time}`,
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <View style={styles.eventHeader}>
                    <View style={[styles.eventIcon, { backgroundColor: event.color }]}>
                      <Ionicons name={event.icon} size={20} color="#fff" />
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventDescription} numberOfLines={2}>
                        {event.description}
                      </Text>
                    </View>
                    <View style={styles.eventMeta}>
                      <View style={[styles.priorityBadge, {
                        backgroundColor: event.priority === 'high' ? '#F44336' :
                                        event.priority === 'medium' ? '#FF9800' : '#4CAF50'
                      }]}>
                        <Text style={styles.priorityText}>
                          {event.priority?.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.eventFooter}>
                    <View style={styles.eventDateTime}>
                      <Ionicons name="calendar" size={14} color="#666" />
                      <Text style={styles.eventDate}>
                        {new Date(event.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </Text>
                      <Ionicons name="time" size={14} color="#666" style={{ marginLeft: 12 }} />
                      <Text style={styles.eventTime}>{event.time}</Text>
                    </View>
                    <View style={[styles.eventTypeBadge, { backgroundColor: `${event.color}20` }]}>
                      <Text style={[styles.eventTypeText, { color: event.color }]}>
                        {event.type?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="pulse" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
          </View>
          <View style={{ marginHorizontal: 12, marginBottom: 12 }}>
            {recentActivities.map((act, index) => (
              <View key={`activity-${act.id || index}`} style={styles.activityCard}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>{act.activity}</Text>
                <Text style={{ color: '#888', marginTop: 2, fontSize: 13 }}>
                  {act.date ? new Date(act.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : 'N/A'}
                </Text>
              </View>
            ))}
                </View>
                </View>
        {/* Announcements */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionIcon}>
              <Ionicons name="megaphone" size={20} color="#1976d2" />
            </View>
            <Text style={styles.sectionTitle}>Announcements</Text>
          </View>
          <View style={{ marginHorizontal: 12, marginBottom: 18 }}>
            {announcements.map((ann, index) => (
              <View key={`announcement-${ann.id || index}`} style={styles.announcementCard}>
                <Text style={{ color: '#388e3c', fontWeight: 'bold' }}>{ann.message}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
      {/* Add Task Modal rendered outside the ScrollView for proper centering */}
      {addTaskModalVisible && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.18)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <View style={styles.addTaskModal}>
            <View style={styles.addTaskModalHeader}>
              <Text style={styles.addTaskModalTitle}>Create New Task</Text>
              <TouchableOpacity
                onPress={() => {
                  setAddTaskModalVisible(false);
                  setNewTask({ title: '', description: '', type: 'attendance', due: '', priority: 'medium' });
                }}
                style={styles.addTaskModalClose}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.addTaskModalScrollView}
              contentContainerStyle={styles.addTaskModalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.addTaskFieldLabel}>Task Title</Text>
              <TextInput
                placeholder="Enter task title (e.g., 'Mark attendance for Grade 5')"
                value={newTask.title}
                onChangeText={text => setNewTask(t => ({ ...t, title: text }))}
                style={styles.addTaskTitleInput}
                autoFocus={true}
              />
              
              <Text style={styles.addTaskFieldLabel}>Task Description (Optional)</Text>
              <TextInput
                placeholder="Enter additional details about the task..."
                value={newTask.description}
                onChangeText={text => setNewTask(t => ({ ...t, description: text }))}
                style={styles.addTaskInput}
                multiline={true}
                numberOfLines={3}
              />

              <Text style={styles.addTaskFieldLabel}>Category</Text>
              <View style={styles.addTaskTypeGrid}>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, type: 'attendance' }))}
                  style={[styles.addTaskTypeButton, newTask.type === 'attendance' && { backgroundColor: '#388e3c' }]}
                >
                  <Ionicons name="people" size={18} color={newTask.type === 'attendance' ? '#fff' : '#388e3c'} />
                  <Text style={[styles.addTaskTypeText, newTask.type === 'attendance' && styles.addTaskTypeTextActive]}>
                    Attendance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, type: 'marks' }))}
                  style={[styles.addTaskTypeButton, newTask.type === 'marks' && { backgroundColor: '#1976d2' }]}
                >
                  <Ionicons name="document-text" size={18} color={newTask.type === 'marks' ? '#fff' : '#1976d2'} />
                  <Text style={[styles.addTaskTypeText, newTask.type === 'marks' && styles.addTaskTypeTextActive]}>
                    Marks
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, type: 'homework' }))}
                  style={[styles.addTaskTypeButton, newTask.type === 'homework' && { backgroundColor: '#ff9800' }]}
                >
                  <Ionicons name="school" size={18} color={newTask.type === 'homework' ? '#fff' : '#ff9800'} />
                  <Text style={[styles.addTaskTypeText, newTask.type === 'homework' && styles.addTaskTypeTextActive]}>
                    Homework
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, type: 'meeting' }))}
                  style={[styles.addTaskTypeButton, newTask.type === 'meeting' && { backgroundColor: '#9c27b0' }]}
                >
                  <Ionicons name="people-circle" size={18} color={newTask.type === 'meeting' ? '#fff' : '#9c27b0'} />
                  <Text style={[styles.addTaskTypeText, newTask.type === 'meeting' && styles.addTaskTypeTextActive]}>
                    Meeting
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, type: 'report' }))}
                  style={[styles.addTaskTypeButton, newTask.type === 'report' && { backgroundColor: '#f44336' }]}
                >
                  <Ionicons name="bar-chart" size={18} color={newTask.type === 'report' ? '#fff' : '#f44336'} />
                  <Text style={[styles.addTaskTypeText, newTask.type === 'report' && styles.addTaskTypeTextActive]}>
                    Report
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, type: 'planning' }))}
                  style={[styles.addTaskTypeButton, newTask.type === 'planning' && { backgroundColor: '#00bcd4' }]}
                >
                  <Ionicons name="calendar" size={18} color={newTask.type === 'planning' ? '#fff' : '#00bcd4'} />
                  <Text style={[styles.addTaskTypeText, newTask.type === 'planning' && styles.addTaskTypeTextActive]}>
                    Planning
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.addTaskFieldLabel}>Priority</Text>
              <View style={styles.addTaskPriorityContainer}>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, priority: 'high' }))}
                  style={[styles.addTaskPriorityButton, newTask.priority === 'high' && { backgroundColor: '#ffebee', borderColor: '#f44336' }]}
                >
                  <View style={[styles.addTaskPriorityDot, { backgroundColor: '#f44336' }]} />
                  <Text style={[styles.addTaskPriorityText, newTask.priority === 'high' && { color: '#f44336', fontWeight: '600' }]}>
                    High Priority
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, priority: 'medium' }))}
                  style={[styles.addTaskPriorityButton, newTask.priority === 'medium' && { backgroundColor: '#fff3e0', borderColor: '#ff9800' }]}
                >
                  <View style={[styles.addTaskPriorityDot, { backgroundColor: '#ff9800' }]} />
                  <Text style={[styles.addTaskPriorityText, newTask.priority === 'medium' && { color: '#ff9800', fontWeight: '600' }]}>
                    Medium Priority
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setNewTask(t => ({ ...t, priority: 'low' }))}
                  style={[styles.addTaskPriorityButton, newTask.priority === 'low' && { backgroundColor: '#e8f5e8', borderColor: '#4caf50' }]}
                >
                  <View style={[styles.addTaskPriorityDot, { backgroundColor: '#4caf50' }]} />
                  <Text style={[styles.addTaskPriorityText, newTask.priority === 'low' && { color: '#4caf50', fontWeight: '600' }]}>
                    Low Priority
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.addTaskFieldLabel}>Due Date</Text>
              {Platform.OS === 'web' ? (
                <CrossPlatformDatePicker
                  label="Due Date"
                  value={newTask.due ? new Date(newTask.due) : new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const yyyy = selectedDate.getFullYear();
                      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const dd = String(selectedDate.getDate()).padStart(2, '0');
                      setNewTask(t => ({ ...t, due: `${yyyy}-${mm}-${dd}` }));
                    }
                  }}
                  mode="date"
                  placeholder="Select Due Date"
                  containerStyle={styles.addTaskDatePicker}
                />
              ) : (
                <>
                  <DatePickerButton
                    label="Due Date"
                    value={newTask.due ? new Date(newTask.due) : new Date()}
                    onPress={() => setShowDatePicker(true)}
                    placeholder="Select Due Date"
                    mode="date"
                    style={styles.addTaskDatePicker}
                    displayFormat={(date) => date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  />
                  {showDatePicker && (
                    <CrossPlatformDatePicker
                      value={newTask.due ? new Date(newTask.due) : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          const yyyy = selectedDate.getFullYear();
                          const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const dd = String(selectedDate.getDate()).padStart(2, '0');
                          setNewTask(t => ({ ...t, due: `${yyyy}-${mm}-${dd}` }));
                        }
                      }}
                    />
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.addTaskModalActions}>
              <TouchableOpacity
                onPress={() => {
                  setAddTaskModalVisible(false);
                  setNewTask({ title: '', description: '', type: 'attendance', due: '', priority: 'medium' });
                }}
                style={styles.addTaskCancelButton}
                activeOpacity={0.8}
              >
                <Text style={styles.addTaskCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddTask}
                style={[styles.addTaskCreateButton, (!newTask.title || !newTask.due) && styles.addTaskCreateButtonDisabled]}
                activeOpacity={0.8}
                disabled={!newTask.title || !newTask.due}
              >
                <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.addTaskCreateButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#1976d2',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'hidden',
      },
    }),
  },
  scrollView: {
    flex: 1,
    ...Platform.select({
      web: {
        overflow: 'auto',
        height: '100%',
        WebkitOverflowScrolling: 'touch',
      }
    })
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'web' ? 40 : 20,
  },
  welcomeSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
  },
  statsColumnContainer: {
    paddingHorizontal: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  quickActionCard: {
    width: '45%', // Adjust as needed for 2 columns
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  // Enhanced section title style
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    marginBottom: 18,
    elevation: 4,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f0f4ff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
    flex: 1,
    textAlign: 'left',
    letterSpacing: 0.3,
    lineHeight: 32,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#e3f2fd',
    minHeight: 32,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 14,
    minWidth: 170,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    alignItems: 'flex-start',
  },
  scheduleTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scheduleTime: {
    fontSize: 15,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  scheduleSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  scheduleClass: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  scheduleRoom: {
    fontSize: 13,
    color: '#888',
  },
  // Enhanced Tasks Section Styles
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  tasksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tasksIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 2,
  },
  tasksSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  tasksCategorySection: {
    marginBottom: 24,
  },
  tasksCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  personalTasksHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tasksCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tasksCategoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginLeft: 6,
  },
  tasksCategoryCount: {
    backgroundColor: '#1976d2',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tasksCategoryCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addPersonalTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  addPersonalTaskButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },


  tasksContainer: {
    paddingHorizontal: 8,
  },
  emptyTasksContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTasksText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyTasksSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f4ff',
    position: 'relative',
    overflow: 'hidden',
  },
  taskCardHeader: {
    marginBottom: 12,
  },
  taskCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  taskTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976d2',
    lineHeight: 22,
    marginBottom: 2,
  },
  taskDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    lineHeight: 18,
    marginTop: 2,
  },
  priorityBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskDueDate: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  completeTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-end',
  },
  completeTaskButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  // Enhanced Add Task Modal Styles
  addTaskModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 420,
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  addTaskModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addTaskModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1976d2',
  },
  addTaskModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTaskModalScrollView: {
    maxHeight: '70%', // Limit height to allow for header and actions
  },
  addTaskModalContent: {
    padding: 20,
    paddingBottom: 10, // Reduced bottom padding since actions are outside
  },
  addTaskFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  addTaskTitleInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
    fontWeight: '500',
    color: '#333',
  },
  addTaskInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
    minHeight: 80,
    color: '#666',
  },
  addTaskTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addTaskTypeButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addTaskTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 4,
  },
  addTaskTypeTextActive: {
    color: '#fff',
  },
  addTaskPriorityContainer: {
    marginBottom: 8,
  },
  addTaskPriorityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addTaskPriorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  addTaskPriorityText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  addTaskDatePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  addTaskDateText: {
    flex: 1,
    fontSize: 16,
    color: '#aaa',
    marginLeft: 8,
  },
  addTaskDateTextSelected: {
    color: '#333',
    fontWeight: '500',
  },
  addTaskModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  addTaskCancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  addTaskCancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  addTaskCreateButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1976d2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  addTaskCreateButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  addTaskCreateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  // Enhanced Class Performance Styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 0, // Remove horizontal margin to align with section padding
    marginBottom: 12,
    paddingHorizontal: 2, // Add small padding to prevent button from touching edges
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    maxWidth: 120, // Limit button width to prevent overflow
    justifyContent: 'center',
  },
  viewAllText: {
    color: '#1976d2',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Empty Schedule Styles
  emptyScheduleContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  emptyScheduleText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  emptyScheduleSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },

  // Events Section Styles
  addEventButton: {
    padding: 4,
  },
  emptyEventsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 12,
  },
  emptyEventsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  emptyEventsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  eventsContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f0f4ff',
    position: 'relative',
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginTop: 2,
    fontWeight: '500',
    minHeight: 20,
  },
  eventMeta: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // New card styles to replace blue bars
  scheduleItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f0f4ff',
  },

  scheduleItemIcon: {
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  scheduleItemContent: {
    flex: 1,
    justifyContent: 'center',
  },

  scheduleSubjectText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 15,
    lineHeight: 20,
  },

  scheduleTimeText: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f0f4ff',
  },

  analyticsCard: {
    borderRadius: 16,
    padding: 20,
    margin: 6,
    minWidth: 160,
    flex: 1,
    elevation: 3,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },

  classSubjectCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f4ff',
  },

  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f4ff',
  },

  announcementCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f4ff',
  },

  // AdminDashboard-style School Details Section
  schoolDetailsSection: {
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
  schoolDateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },
  
  // Skeleton loading styles for better UX during loading
  skeletonText: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    height: 16,
  },
  skeletonImage: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 30,
    width: 40,
    height: 40,
  },
  skeletonCard: {
    opacity: 0.7,
  },
  skeletonCircle: {
    backgroundColor: '#e0e0e0',
    borderRadius: 30,
    width: 60,
    height: 60,
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
});

export default TeacherDashboard;
