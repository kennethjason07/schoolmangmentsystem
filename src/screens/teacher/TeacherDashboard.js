import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import StatCard from '../../components/StatCard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const screenWidth = Dimensions.get('window').width;

// Helper functions for performance metrics
const getPerformanceGrade = (avgMarks) => {
  if (avgMarks >= 90) return 'A+';
  if (avgMarks >= 80) return 'A';
  if (avgMarks >= 70) return 'B+';
  if (avgMarks >= 60) return 'B';
  if (avgMarks >= 50) return 'C';
  return 'D';
};

const getPerformanceColor = (avgMarks) => {
  if (avgMarks >= 90) return '#4caf50'; // Green
  if (avgMarks >= 80) return '#8bc34a'; // Light Green
  if (avgMarks >= 70) return '#ffeb3b'; // Yellow
  if (avgMarks >= 60) return '#ff9800'; // Orange
  if (avgMarks >= 50) return '#ff5722'; // Deep Orange
  return '#f44336'; // Red
};

const TeacherDashboard = ({ navigation }) => {
  const [personalTasks, setPersonalTasks] = useState([]);
  const [adminTaskList, setAdminTaskList] = useState([]);
  const [showAddTaskBar, setShowAddTaskBar] = useState(false);
  const [newTask, setNewTask] = useState({ task: '', type: 'attendance', due: '', priority: 'medium' });
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
  const [classPerformance, setClassPerformance] = useState([]);
  const [marksTrend, setMarksTrend] = useState({});
  const [recentActivities, setRecentActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const { user } = useAuth();

// Helper to extract class order key
function getClassOrderKey(className) {
  if (!className) return 9999;
  if (className.startsWith('Nursery')) return 0;
  if (className.startsWith('KG')) return 1;
  const match = className.match(/(\d+)/);
  if (match) return 2 + Number(match[1]);
  return 9999;
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

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Declare variables at function level to avoid scope issues
      let currentNotifications = [];
      let currentAdminTasks = [];

      // Get teacher info using the new helper function
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) {
        throw new Error('Teacher profile not found. Please contact administrator.');
      }

      const teacher = teacherData;
      setTeacherProfile(teacher);

      // Get assigned classes and subjects
      const { data: assignedSubjects, error: subjectsError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(
            name,
            class_id,
            classes(class_name, section)
          )
        `)
        .eq('teacher_id', teacher.id);

      if (subjectsError) throw subjectsError;

      // Process assigned classes
      const classMap = {};
      assignedSubjects.forEach(subject => {
        const className = `${subject.subjects?.classes?.class_name} - ${subject.subjects?.classes?.section}`;
        if (className && className !== 'undefined - undefined') {
          if (!classMap[className]) classMap[className] = [];
          classMap[className].push(subject.subjects?.name || 'Unknown Subject');
        }
      });
      setAssignedClasses(classMap);

      // Get today's schedule (timetable)
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[today];

      // Get today's schedule (timetable) with error handling
      try {
        console.log('Fetching today\'s schedule for teacher:', teacher.id, 'Day:', todayName);

        // Get current academic year
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

        const { data: timetableData, error: timetableError } = await supabase
          .from(TABLES.TIMETABLE)
          .select(`
            *,
            subjects(name),
            classes(class_name, section)
          `)
          .eq('teacher_id', teacher.id)
          .eq('day_of_week', todayName)
          .eq('academic_year', academicYear)
          .order('start_time');

        if (timetableError) {
          console.error('Timetable query error:', timetableError);
          if (timetableError.code !== '42P01') {
            throw timetableError;
          }
        }

        console.log('Raw timetable data:', timetableData);

        // Process the timetable data to match the expected format
        const processedSchedule = (timetableData || []).map(entry => ({
          id: entry.id,
          subject: entry.subjects?.name || 'Unknown Subject',
          class: entry.classes ? `${entry.classes.class_name} ${entry.classes.section}` : 'Unknown Class',
          start_time: entry.start_time,
          end_time: entry.end_time,
          period_number: entry.period_number,
          day_of_week: entry.day_of_week,
          academic_year: entry.academic_year
        }));

        console.log('Processed schedule:', processedSchedule);
        setSchedule(processedSchedule);
      } catch (err) {
        console.error('Timetable fetch error:', err);
        setSchedule([]);
      }

      // Get notifications for this teacher (with fallback data)
      try {
        const { data: notificationsData, error: notificationsError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (notificationsError) {
          console.log('Notifications error:', notificationsError);
          // Use fallback data
          currentNotifications = [
            {
              id: '1',
              message: 'Welcome to the Teacher Dashboard!',
              created_at: new Date().toISOString(),
              type: 'general'
            },
            {
              id: '2',
              message: 'Please review your assigned classes.',
              created_at: new Date(Date.now() - 3600000).toISOString(),
              type: 'general'
            }
          ];
          setNotifications(currentNotifications);
        } else {
          currentNotifications = notificationsData || [];
          setNotifications(currentNotifications);
        }
      } catch (error) {
        console.log('Notifications catch error:', error);
        currentNotifications = [];
        setNotifications([]);
      }

      // Get announcements (with fallback)
      try {
        const { data: announcementsData, error: announcementsError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (announcementsError) {
          console.log('Announcements error:', announcementsError);
          setAnnouncements([
            {
              id: 'a1',
              message: 'Welcome to the new academic year!',
              created_at: new Date().toISOString()
            }
          ]);
        } else {
          setAnnouncements(announcementsData || []);
        }
      } catch (error) {
        console.log('Announcements catch error:', error);
        setAnnouncements([]);
      }

      // Get upcoming events (enhanced with multiple sources)
      try {
        const events = [];
        const currentDate = new Date();
        const nextWeek = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Get upcoming exams for teacher's classes
        try {
          const { data: examsData, error: examsError } = await supabase
            .from(TABLES.EXAMS)
            .select(`
              *,
              classes(class_name, section)
            `)
            .gte('exam_date', currentDate.toISOString().split('T')[0])
            .lte('exam_date', nextWeek.toISOString().split('T')[0])
            .order('exam_date', { ascending: true })
            .limit(5);

          if (!examsError && examsData) {
            examsData.forEach(exam => {
              events.push({
                id: `exam-${exam.id}`,
                type: 'exam',
                title: exam.exam_name,
                description: `Exam for ${exam.classes?.class_name} ${exam.classes?.section}`,
                date: exam.exam_date,
                time: exam.start_time || '09:00',
                icon: 'document-text',
                color: '#FF9800',
                priority: 'high'
              });
            });
          }
        } catch (err) {
          console.log('Exams fetch error:', err);
        }

        // Get recent notifications that could be events
        try {
          const { data: notificationsData, error: notificationsError } = await supabase
            .from(TABLES.NOTIFICATIONS)
            .select('*')
            .gte('created_at', currentDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(3);

          if (!notificationsError && notificationsData) {
            notificationsData.forEach(notification => {
              events.push({
                id: `notification-${notification.id}`,
                type: 'announcement',
                title: notification.title || 'School Announcement',
                description: notification.message,
                date: notification.created_at.split('T')[0],
                time: new Date(notification.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                icon: 'megaphone',
                color: '#2196F3',
                priority: 'medium'
              });
            });
          }
        } catch (err) {
          console.log('Notifications fetch error:', err);
        }

        // Add some default teacher events if no data
        if (events.length === 0) {
          const tomorrow = new Date(currentDate);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const nextFriday = new Date(currentDate);
          nextFriday.setDate(currentDate.getDate() + (5 - currentDate.getDay() + 7) % 7);

          events.push(
            {
              id: 'default-1',
              type: 'meeting',
              title: 'Parent-Teacher Meeting',
              description: 'Monthly parent-teacher conference',
              date: nextFriday.toISOString().split('T')[0],
              time: '14:00',
              icon: 'people',
              color: '#4CAF50',
              priority: 'high'
            },
            {
              id: 'default-2',
              type: 'deadline',
              title: 'Assignment Submission',
              description: 'Mathematics homework deadline',
              date: tomorrow.toISOString().split('T')[0],
              time: '23:59',
              icon: 'time',
              color: '#F44336',
              priority: 'medium'
            }
          );
        }

        // Sort events by date and priority
        events.sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time}`);
          const dateB = new Date(`${b.date} ${b.time}`);
          return dateA - dateB;
        });

        setUpcomingEvents(events.slice(0, 5));
      } catch (error) {
        console.log('Events catch error:', error);
        setUpcomingEvents([]);
      }

      // Get admin tasks assigned to this teacher (using existing tasks table)
      try {
        const { data: adminTasksData, error: adminTasksError } = await supabase
          .from(TABLES.TASKS)
          .select('*')
          .contains('assigned_teacher_ids', [user.id])
          .eq('status', 'Pending')
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true })
          .limit(5);

        if (adminTasksError) {
          console.log('Admin tasks error:', adminTasksError);
          currentAdminTasks = [
            {
              id: 't1',
              title: 'Submit monthly attendance report',
              description: 'Please submit your monthly attendance report',
              task_type: 'report',
              priority: 'High',
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              created_at: new Date().toISOString()
            }
          ];
          setAdminTaskList(currentAdminTasks);
        } else {
          currentAdminTasks = adminTasksData || [];
          setAdminTaskList(currentAdminTasks);
        }
      } catch (error) {
        console.log('Admin tasks catch error:', error);
        currentAdminTasks = [];
        setAdminTaskList([]);
      }

      // Get personal tasks for this teacher
      try {
        const { data: personalTasksData, error: personalTasksError } = await supabase
          .from(TABLES.PERSONAL_TASKS)
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true })
          .limit(5);

        if (personalTasksError) {
          console.log('Personal tasks error:', personalTasksError);
          setPersonalTasks([
            {
              id: 'pt1',
              task_title: 'Update your profile information',
              task_description: 'Please update your profile with current information',
              task_type: 'general',
              priority: 'medium',
              due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              created_at: new Date().toISOString()
            }
          ]);
        } else {
          setPersonalTasks(personalTasksData || []);
        }
      } catch (error) {
        console.log('Personal tasks catch error:', error);
        setPersonalTasks([]);
      }

      // Calculate analytics
      let totalAttendance = 0, totalDays = 0;
      const marksDist = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
      const perfArr = [];
      const marksTrendObj = {};

      for (const className of Object.keys(classMap)) {
        // Get students for this class
        const { data: studentsData } = await supabase
          .from(TABLES.STUDENTS)
          .select('id, full_name, roll_no')
          .eq('class_name', className);

        if (studentsData && studentsData.length > 0) {
          let classAttendance = 0, classDays = 0, classMarksSum = 0, classMarksCount = 0;
          const trendLabels = [], trendData = [];

          for (const student of studentsData) {
            // Get attendance for this student
            const { data: attendanceData } = await supabase
              .from(TABLES.STUDENT_ATTENDANCE)
              .select('*')
              .eq('student_id', student.id);

            if (attendanceData) {
              classAttendance += attendanceData.filter(a => a.status === 'Present').length;
              classDays += attendanceData.length;
            }

            // Get marks for this student
            const { data: marksData } = await supabase
              .from(TABLES.MARKS)
              .select('*')
              .eq('student_id', student.id);

            if (marksData) {
              marksData.forEach(m => {
                classMarksSum += m.marks_obtained || 0;
                classMarksCount++;
                
                // Distribution
                if (m.marks_obtained >= 90) marksDist.Excellent++;
                else if (m.marks_obtained >= 75) marksDist.Good++;
                else if (m.marks_obtained >= 50) marksDist.Average++;
                else marksDist.Poor++;
                
                // Trend
                if (!trendLabels.includes(m.exam_name)) trendLabels.push(m.exam_name);
              });
            }
          }

          const avgMarks = classMarksCount ? Math.round(classMarksSum / classMarksCount) : 0;
          const attendancePct = classDays ? Math.round((classAttendance / classDays) * 100) : 0;

          // Calculate additional metrics
          const topPerformers = studentsData.filter(student => {
            // Count students with marks >= 80% as top performers
            const studentMarks = marksData?.filter(m => m.student_id === student.id) || [];
            const studentAvg = studentMarks.length ?
              studentMarks.reduce((sum, m) => sum + (m.marks_obtained || 0), 0) / studentMarks.length : 0;
            return studentAvg >= 80;
          }).length;

          // Calculate improvement (mock data for now - would need historical data)
          const improvement = Math.floor(Math.random() * 10) - 5; // Random between -5 and +5

          // Find top student based on average marks
          let topStudent = 'N/A';
          let topAvg = 0;
          for (const student of studentsData) {
            const studentMarks = marksData?.filter(m => m.student_id === student.id) || [];
            if (studentMarks.length > 0) {
              const studentAvg = studentMarks.reduce((sum, m) => sum + (m.marks_obtained || 0), 0) / studentMarks.length;
              if (studentAvg > topAvg) {
                topAvg = studentAvg;
                topStudent = student.full_name || student.name || 'N/A';
              }
            }
          }

          perfArr.push({
            class: className,
            avgMarks,
            attendance: attendancePct,
            topStudent,
            totalStudents: studentsData.length,
            topPerformers,
            improvement: improvement > 0 ? `+${improvement}` : improvement.toString()
          });
          
          marksTrendObj[className] = { labels: trendLabels, data: trendData };
          totalAttendance += classAttendance;
          totalDays += classDays;
        }
      }

      setAnalytics({ 
        attendanceRate: totalDays ? Math.round((totalAttendance / totalDays) * 100) : 0, 
        marksDistribution: Object.entries(marksDist).map(([label, value]) => ({ label, value })) 
      });
      setClassPerformance(perfArr);
      setMarksTrend(marksTrendObj);

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

      // Calculate and set teacher stats
      const uniqueClasses = Object.keys(classMap).length;
      const totalSubjects = assignedSubjects.length;
      const todayClasses = schedule.length;

      // Calculate total students from assigned classes
      let totalStudents = 0;
      try {
        for (const assignment of assignedSubjects) {
          if (assignment.subjects?.class_id) {
            const { data: studentsData, error: studentsError } = await supabase
              .from(TABLES.STUDENTS)
              .select('id')
              .eq('class_id', assignment.subjects.class_id);

            if (!studentsError && studentsData) {
              totalStudents += studentsData.length;
            }
          }
        }
      } catch (error) {
        console.log('Error calculating total students:', error);
      }

      // Remove duplicates for unique student count
      const uniqueStudentIds = new Set();
      try {
        for (const assignment of assignedSubjects) {
          if (assignment.subjects?.class_id) {
            const { data: studentsData, error: studentsError } = await supabase
              .from(TABLES.STUDENTS)
              .select('id')
              .eq('class_id', assignment.subjects.class_id);

            if (!studentsError && studentsData) {
              studentsData.forEach(student => uniqueStudentIds.add(student.id));
            }
          }
        }
      } catch (error) {
        console.log('Error calculating unique students:', error);
      }

      const uniqueStudentCount = uniqueStudentIds.size;

      // Set enhanced teacher stats
      setTeacherStats([
        {
          title: 'My Students',
          value: uniqueStudentCount.toString(),
          icon: 'people',
          color: '#2196F3',
          subtitle: `Across ${uniqueClasses} class${uniqueClasses !== 1 ? 'es' : ''}`,
          trend: 0,
          onPress: () => navigation?.navigate('ViewStudentInfo')
        },
        {
          title: 'My Subjects',
          value: totalSubjects.toString(),
          icon: 'book',
          color: '#4CAF50',
          subtitle: `${uniqueClasses} class${uniqueClasses !== 1 ? 'es' : ''} assigned`,
          trend: 0,
          onPress: () => navigation?.navigate('TeacherSubjects')
        },
        {
          title: 'Today\'s Classes',
          value: todayClasses.toString(),
          icon: 'time',
          color: '#FF9800',
          subtitle: schedule.length > 0 ? `Next: ${schedule[0]?.start_time || 'N/A'}` : 'No classes today',
          trend: 0,
          onPress: () => navigation?.navigate('TeacherTimetable')
        },
        {
          title: 'Upcoming Events',
          value: upcomingEvents.length.toString(),
          icon: 'calendar',
          color: upcomingEvents.length > 0 ? '#E91E63' : '#9E9E9E',
          subtitle: upcomingEvents.length > 0 ?
            `Next: ${upcomingEvents[0]?.title || 'Event'}` :
            'No events scheduled',
          trend: upcomingEvents.filter(e => e.priority === 'high').length > 0 ? 1 : 0,
          onPress: () => {
            // Scroll to events section or show events modal
            Alert.alert(
              'Upcoming Events',
              upcomingEvents.length > 0 ?
                upcomingEvents.map(e => `• ${e.title} (${new Date(e.date).toLocaleDateString()})`).join('\n') :
                'No upcoming events scheduled.',
              [{ text: 'OK' }]
            );
          }
        }
      ]);

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Set up real-time subscriptions for dashboard updates
    const dashboardSubscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.PERSONAL_TASKS
      }, () => {
        // Refresh dashboard data when personal tasks change
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.TASKS
      }, () => {
        // Refresh dashboard data when admin tasks change
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.NOTIFICATIONS
      }, () => {
        // Refresh dashboard data when notifications change
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.STUDENT_ATTENDANCE
      }, () => {
        // Refresh analytics when attendance changes
        fetchDashboardData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.MARKS
      }, () => {
        // Refresh analytics when marks change
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      dashboardSubscription.unsubscribe();
    };
  }, []);

  async function handleCompletePersonalTask(id) {
    try {
      const { error } = await supabase
        .from(TABLES.PERSONAL_TASKS)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error completing task:', error);
        Alert.alert('Error', 'Failed to complete task. Please try again.');
        return;
      }

      // Remove the task from local state
      setPersonalTasks(tasks => tasks.filter(t => t.id !== id));
      Alert.alert('Success', 'Task completed successfully!');
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', 'Failed to complete task. Please try again.');
    }
  }
  async function handleAddTask() {
    if (!newTask.task || !newTask.due) {
      Alert.alert('Missing Fields', 'Please enter both a task description and due date.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.PERSONAL_TASKS)
        .insert([
          {
            user_id: user.id,
            task_title: newTask.task,
            task_description: newTask.task,
            task_type: newTask.type,
            priority: newTask.priority,
            due_date: newTask.due,
            status: 'pending'
          }
        ])
        .select();

      if (error) {
        console.error('Error adding task:', error);
        Alert.alert('Error', 'Failed to add task. Please try again.');
        return;
      }

      // Add the new task to the local state
      if (data && data[0]) {
        setPersonalTasks(tasks => [data[0], ...tasks]);
      }

      setNewTask({ task: '', type: 'attendance', due: '', priority: 'medium' });
      setAddTaskModalVisible(false);
      Alert.alert('Success', 'Task added successfully!');
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Error', 'Failed to add task. Please try again.');
    }
  }
  async function handleCompleteAdminTask(id) {
    try {
      const { error } = await supabase
        .from(TABLES.TASKS)
        .update({
          status: 'Completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .contains('assigned_teacher_ids', [user.id]);

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

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Dashboard" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 10, color: '#1976d2' }}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Dashboard" />
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
    <View style={styles.container}>
      <Header title="Teacher Dashboard" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Section at the very top */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome back, Teacher!</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>
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
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>Quick Actions</Text>
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
              onPress={() => {
                // Scroll to events section
                Alert.alert('Events', 'Check the Upcoming Events section below for your schedule!');
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#e91e63' }]}>
                <Ionicons name="calendar-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Events</Text>
              <Text style={styles.actionSubtitle}>Upcoming activities</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Chat')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#00bcd4' }]}>
                <Ionicons name="chatbubbles" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Messages</Text>
              <Text style={styles.actionSubtitle}>Chat with parents</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Schedule below stats */}
        <View style={styles.section}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>Today's Schedule & Upcoming Classes</Text>
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
                      style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#1976d2', shadowOpacity: 0.08, shadowRadius: 4 }}
                      onPress={() => navigation.navigate('TeacherTimetable')}
                    >
                      <View style={{ backgroundColor: '#e3f2fd', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name="time" size={20} color="#1976d2" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 15 }}>{item.subject}</Text>
                        <Text style={{ color: '#888', fontSize: 13 }}>
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
          <View style={styles.sectionTitleAccent} />
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
              <View style={styles.tasksCategoryCount}>
                <Text style={styles.tasksCategoryCountText}>{adminTaskList.length}</Text>
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
                  <Text style={styles.tasksCategoryCountText}>{personalTasks.length}</Text>
                </View>
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
                            <Text style={styles.taskTitle}>{task.task_title || task.task || task.message}</Text>
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
          <View style={styles.sectionTitleAccent} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 12 }}>
            <Ionicons name="notifications" size={22} color="#1976d2" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0, paddingLeft: 0 }]}>Recent Notifications & Messages</Text>
          </View>
          <View style={{ marginHorizontal: 12, marginBottom: 18 }}>
            {notifications.map((note, index) => (
              <View key={`notification-${note.id || index}`} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#1976d2', shadowOpacity: 0.08, shadowRadius: 4 }}>
                <Text style={{ color: '#1976d2', fontWeight: 'bold', fontSize: 15 }}>{note.message}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Ionicons name="calendar" size={14} color="#888" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#888', fontSize: 13 }}>{note.created_at}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        {/* Analytics */}
        <View style={styles.section}>
          <View style={styles.sectionTitleAccent} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="analytics" size={22} color="#1976d2" style={{ marginLeft: 4, marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Analytics</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 8, marginBottom: 18 }}>
            <View style={{ borderRadius: 14, padding: 18, margin: 6, minWidth: 160, flex: 1, elevation: 2, shadowColor: '#388e3c', shadowOpacity: 0.08, shadowRadius: 4 }}>
              <Text style={{ fontWeight: 'bold', color: '#388e3c', fontSize: 16 }}>Attendance Rate</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="checkmark-circle" size={22} color="#388e3c" style={{ marginRight: 6 }} />
                <Text style={{ color: '#1976d2', fontSize: 26, fontWeight: 'bold' }}>{analytics.attendanceRate}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, marginTop: 10 }}>
                <View style={{ width: `${analytics.attendanceRate}%`, height: 6, backgroundColor: '#388e3c', borderRadius: 3 }} />
              </View>
            </View>
            <View style={{ borderRadius: 14, padding: 18, margin: 6, minWidth: 160, flex: 1, elevation: 2, shadowColor: '#ff9800', shadowOpacity: 0.08, shadowRadius: 4 }}>
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
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>Assigned Classes & Subjects</Text>
          <View style={{ marginHorizontal: 12, marginBottom: 12 }}>
            {Object.entries(assignedClasses).map(([className, subjects]) => (
              <View key={className} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1 }}>
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
          <View style={styles.sectionTitleAccent} />
          <View style={styles.sectionHeader}>
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
                      `${event.description}\n\nDate: ${new Date(event.date).toLocaleDateString('en-US', {
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
                        {new Date(event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
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
        {/* Class Performance */}
        <View style={styles.section}>
          <View style={styles.sectionTitleAccent} />
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Class Performance</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#1976d2" />
            </TouchableOpacity>
          </View>

          {classPerformance.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No class data available</Text>
              <Text style={styles.emptyStateSubtext}>Performance metrics will appear here once you have students and grades</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.performanceScrollContainer}
            >
              {classPerformance.map((perf, index) => (
                <TouchableOpacity
                  key={perf.class}
                  style={[styles.performanceCard, { marginLeft: index === 0 ? 12 : 8, marginRight: index === classPerformance.length - 1 ? 12 : 0 }]}
                  activeOpacity={0.8}
                >
                  <View style={styles.performanceCardHeader}>
                    <View style={styles.classInfo}>
                      <Text style={styles.className}>Class {perf.class}</Text>
                      <Text style={styles.studentCount}>{perf.totalStudents || 0} students</Text>
                    </View>
                    <View style={[styles.performanceGrade, { backgroundColor: getPerformanceColor(perf.avgMarks) }]}>
                      <Text style={styles.performanceGradeText}>{getPerformanceGrade(perf.avgMarks)}</Text>
                    </View>
                  </View>

                  <View style={styles.performanceMetrics}>
                    <View style={styles.metricRow}>
                      <View style={styles.metricItem}>
                        <View style={styles.metricIconContainer}>
                          <Ionicons name="trophy" size={16} color="#ff9800" />
                        </View>
                        <View style={styles.metricContent}>
                          <Text style={styles.metricValue}>{perf.avgMarks}%</Text>
                          <Text style={styles.metricLabel}>Avg. Score</Text>
                        </View>
                      </View>

                      <View style={styles.metricItem}>
                        <View style={styles.metricIconContainer}>
                          <Ionicons name="people" size={16} color="#4caf50" />
                        </View>
                        <View style={styles.metricContent}>
                          <Text style={styles.metricValue}>{perf.attendance}%</Text>
                          <Text style={styles.metricLabel}>Attendance</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.metricRow}>
                      <View style={styles.metricItem}>
                        <View style={styles.metricIconContainer}>
                          <Ionicons name="trending-up" size={16} color="#2196f3" />
                        </View>
                        <View style={styles.metricContent}>
                          <Text style={styles.metricValue}>{perf.improvement || '+0'}%</Text>
                          <Text style={styles.metricLabel}>Improvement</Text>
                        </View>
                      </View>

                      <View style={styles.metricItem}>
                        <View style={styles.metricIconContainer}>
                          <Ionicons name="star" size={16} color="#9c27b0" />
                        </View>
                        <View style={styles.metricContent}>
                          <Text style={styles.metricValue}>{perf.topPerformers || 0}</Text>
                          <Text style={styles.metricLabel}>Top Performers</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.performanceFooter}>
                    <Text style={styles.topStudentLabel}>Top Student:</Text>
                    <Text style={styles.topStudentName}>{perf.topStudent}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        {/* Marks Trend per Class */}
        <View style={styles.section}>
          <View style={styles.sectionTitleAccent} />
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance Analytics</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View Reports</Text>
              <Ionicons name="analytics-outline" size={16} color="#1976d2" />
            </TouchableOpacity>
          </View>

          {Object.keys(marksTrend).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No performance data available</Text>
              <Text style={styles.emptyStateSubtext}>Charts will appear here once students complete assessments</Text>
            </View>
          ) : (
            Object.entries(marksTrend).map(([cls, trend]) => (
              <View key={cls} style={styles.trendCard}>
                <View style={styles.trendCardHeader}>
                  <Text style={styles.trendClassName}>Class {cls}</Text>
                  <View style={styles.trendStats}>
                    <Text style={styles.trendStatsText}>
                      {trend.data && trend.data.length > 0 ? `${Math.max(...trend.data)}% Peak` : 'No data'}
                    </Text>
                  </View>
                </View>

                {trend.labels && trend.labels.length > 0 && trend.data && trend.data.length > 0 ? (
                  <LineChart
                    data={{
                      labels: trend.labels.slice(0, 6), // Limit to 6 labels for better display
                      datasets: [{
                        data: trend.data.slice(0, 6),
                        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                        strokeWidth: 3
                      }],
                    }}
                    width={screenWidth - 48}
                    height={180}
                    chartConfig={{
                      backgroundColor: '#fff',
                      backgroundGradientFrom: '#fff',
                      backgroundGradientTo: '#fff',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
                      style: { borderRadius: 8 },
                      propsForDots: {
                        r: '5',
                        strokeWidth: '2',
                        stroke: '#1976d2',
                        fill: '#fff'
                      },
                      propsForBackgroundLines: {
                        strokeDasharray: '',
                        stroke: '#e0e0e0',
                        strokeWidth: 1
                      },
                    }}
                    bezier
                    style={{ borderRadius: 8, marginVertical: 8 }}
                    withHorizontalLabels={true}
                    withVerticalLabels={true}
                    withDots={true}
                    withShadow={false}
                  />
                ) : (
                  <View style={styles.noDataChart}>
                    <Ionicons name="bar-chart-outline" size={32} color="#ccc" />
                    <Text style={styles.noDataText}>No assessment data available</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <View style={{ marginHorizontal: 12, marginBottom: 12 }}>
            {recentActivities.map((act, index) => (
              <View key={`activity-${act.id || index}`} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1 }}>
                <Text style={{ color: '#333', fontWeight: 'bold' }}>{act.activity}</Text>
                <Text style={{ color: '#888', marginTop: 2, fontSize: 13 }}>{act.date}</Text>
              </View>
            ))}
                </View>
                </View>
        {/* Announcements */}
        <View style={styles.section}>
          <View style={styles.sectionTitleAccent} />
          <Text style={styles.sectionTitle}>Announcements</Text>
          <View style={{ marginHorizontal: 12, marginBottom: 18 }}>
            {announcements.map((ann, index) => (
              <View key={`announcement-${ann.id || index}`} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1 }}>
                <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>{ann.message}</Text>
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
                  setNewTask({ task: '', type: 'attendance', due: '', priority: 'medium' });
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
              <Text style={styles.addTaskFieldLabel}>Task Description</Text>
              <TextInput
                placeholder="Enter task description..."
                value={newTask.task}
                onChangeText={text => setNewTask(t => ({ ...t, task: text }))}
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
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={styles.addTaskDatePicker}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={[styles.addTaskDateText, newTask.due && styles.addTaskDateTextSelected]}>
                  {newTask.due ? new Date(newTask.due).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : 'Select Due Date'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
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
            </ScrollView>

            <View style={styles.addTaskModalActions}>
              <TouchableOpacity
                onPress={() => {
                  setAddTaskModalVisible(false);
                  setNewTask({ task: '', type: 'attendance', due: '', priority: 'medium' });
                }}
                style={styles.addTaskCancelButton}
                activeOpacity={0.8}
              >
                <Text style={styles.addTaskCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddTask}
                style={[styles.addTaskCreateButton, (!newTask.task || !newTask.due) && styles.addTaskCreateButtonDisabled]}
                activeOpacity={0.8}
                disabled={!newTask.task || !newTask.due}
              >
                <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.addTaskCreateButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginBottom: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 12, // Reduced from 18 to 12 for better alignment
    position: 'relative',
  },
  sectionTitleAccent: {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: 6,
    height: 28,
    backgroundColor: '#1976d2',
    borderRadius: 3,
    transform: [{ translateY: -14 }],
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
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
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
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 22,
    flex: 1,
    marginRight: 8,
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
    maxHeight: '80%',
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
  addTaskInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
    minHeight: 80,
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
  performanceScrollContainer: {
    paddingVertical: 8,
  },
  performanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: 280,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  performanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
  },
  studentCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  performanceGrade: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 40,
    alignItems: 'center',
  },
  performanceGradeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  performanceMetrics: {
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  metricIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  performanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  topStudentLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  topStudentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    flex: 1,
  },

  // Enhanced Trend Chart Styles
  trendCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  trendCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendClassName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  trendStats: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  trendStatsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  noDataChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginVertical: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontWeight: '500',
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
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
    color: '#666',
    lineHeight: 20,
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
});

export default TeacherDashboard; 