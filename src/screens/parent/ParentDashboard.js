import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import StatCard from '../../components/StatCard';
import StudentSwitchBanner from '../../components/StudentSwitchBanner';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { useSelectedStudent } from '../../contexts/SelectedStudentContext';
import { useFocusEffect } from '@react-navigation/native';
import usePullToRefresh from '../../hooks/usePullToRefresh';

const ParentDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const { selectedStudent, hasMultipleStudents, loading: studentLoading } = useSelectedStudent();
  const [studentData, setStudentData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [exams, setExams] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);

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

  // Modal states
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [showExamsModal, setShowExamsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);

  // Function to refresh notifications
  const refreshNotifications = async () => {
    try {
      console.log('Refreshing notifications for parent:', user.id);
      
      // Get notifications with recipients for this parent
      const { data: notificationsData, error: notificationsError } = await supabase
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
        .eq('recipient_type', 'Parent')
        .eq('recipient_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (notificationsError && notificationsError.code !== '42P01') {
        console.log('Notifications refresh error:', notificationsError);
      } else {
        const mappedNotifications = (notificationsData || []).map(n => ({
          id: n.id,
          title: n.notifications.message || 'Notification', // Use message as title since title doesn't exist
          message: n.notifications.message,
          type: n.notifications.type || 'general',
          created_at: n.notifications.created_at,
          is_read: n.is_read || false,
          read_at: n.read_at
        }));
        console.log('Mapped notifications count:', mappedNotifications.length);
        console.log('Unread notifications count:', mappedNotifications.filter(n => !n.is_read).length);
        setNotifications(mappedNotifications);
      }
    } catch (err) {
      console.log('Notifications refresh fetch error:', err);
      setNotifications([]);
    }
  };

  // Add focus effect to refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('Parent Dashboard - Screen focused, refreshing notifications...');
        refreshNotifications();
      }
    }, [user])
  );

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    // Fetch all dashboard data when refreshing
    const { data: parentUserData, error: parentError } = await dbHelpers.getParentByUserId(user.id);
    if (!parentError && parentUserData) {
      let studentDetails = null;
      
      if (parentUserData.students && parentUserData.students.length > 0) {
        studentDetails = parentUserData.students[0];
      } else if (parentUserData.linked_parent_of) {
        const { data: linkedStudentData, error: linkedStudentError } = await supabase
          .from(TABLES.STUDENTS)
          .select('*')
          .eq('id', parentUserData.linked_parent_of)
          .single();
        if (!linkedStudentError) {
          studentDetails = linkedStudentData;
        }
      }
      
      if (studentDetails) {
        // Refresh all data
        await Promise.all([
          refreshNotifications(),
          // Refresh other data as needed
        ]);
      }
    }
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get parent's student data - improved approach with multiple fallback methods
        console.log('Parent Dashboard - Starting student data fetch for parent user:', user.id);
        
        let studentDetails = null;
        let studentProfilePhoto = null;
        
        try {
          // Method 1: Check if user has linked_parent_of (new structure)
          if (user.linked_parent_of) {
            console.log('Parent Dashboard - Method 1: Using linked_parent_of');
            const { data: linkedStudentData, error: linkedStudentError } = await supabase
              .from(TABLES.STUDENTS)
              .select(`
                *,
                classes(id, class_name, section)
              `)
              .eq('id', user.linked_parent_of)
              .single();
            
            if (!linkedStudentError && linkedStudentData) {
              console.log('Parent Dashboard - Successfully fetched linked student:', linkedStudentData.name);
              
              studentDetails = {
                ...linkedStudentData,
                roll_number: linkedStudentData.roll_no || linkedStudentData.roll_number,
                admission_number: linkedStudentData.admission_no || linkedStudentData.admission_number,
                date_of_birth: linkedStudentData.dob || linkedStudentData.date_of_birth,
                class_name: linkedStudentData.classes?.class_name || linkedStudentData.class_name,
                section: linkedStudentData.classes?.section || linkedStudentData.section,
                full_class_name: linkedStudentData.classes ? `${linkedStudentData.classes.class_name} ${linkedStudentData.classes.section}` : (linkedStudentData.class_name || ''),
                aadhar_no: linkedStudentData.aadhar_no,
                place_of_birth: linkedStudentData.place_of_birth,
                nationality: linkedStudentData.nationality,
                religion: linkedStudentData.religion,
                caste: linkedStudentData.caste,
                pin_code: linkedStudentData.pin_code,
                mother_tongue: linkedStudentData.mother_tongue,
                identification_mark_1: linkedStudentData.identification_mark_1,
                identification_mark_2: linkedStudentData.identification_mark_2,
                academic_year: linkedStudentData.academic_year,
                general_behaviour: linkedStudentData.general_behaviour,
                remarks: linkedStudentData.remarks,
                parent_id: linkedStudentData.parent_id,
                school_id: linkedStudentData.school_id,
                created_at: linkedStudentData.created_at
              };
            } else {
              console.error('Parent Dashboard - Error fetching linked student:', linkedStudentError);
            }
          }
          
          // Method 2: Check students table for students with this user as parent_id
          if (!studentDetails) {
            console.log('Parent Dashboard - Method 2: Using students.parent_id');
            const { data: studentsData, error: studentsError } = await supabase
              .from(TABLES.STUDENTS)
              .select(`
                *,
                classes(id, class_name, section)
              `)
              .eq('parent_id', user.id)
              .limit(1);
            
            if (!studentsError && studentsData && studentsData.length > 0) {
              const student = studentsData[0];
              console.log('Parent Dashboard - Found student via parent_id:', student.name);
              
              studentDetails = {
                ...student,
                roll_number: student.roll_no || student.roll_number,
                admission_number: student.admission_no || student.admission_number,
                date_of_birth: student.dob || student.date_of_birth,
                class_id: student.class_id,
                class_name: student.classes?.class_name || student.class_name,
                section: student.classes?.section || student.section,
                full_class_name: student.classes ? `${student.classes.class_name} ${student.classes.section}` : (student.class_name || ''),
                aadhar_no: student.aadhar_no,
                place_of_birth: student.place_of_birth,
                nationality: student.nationality,
                religion: student.religion,
                caste: student.caste,
                pin_code: student.pin_code,
                mother_tongue: student.mother_tongue,
                identification_mark_1: student.identification_mark_1,
                identification_mark_2: student.identification_mark_2,
                academic_year: student.academic_year,
                general_behaviour: student.general_behaviour,
                remarks: student.remarks,
                parent_id: student.parent_id,
                school_id: student.school_id,
                created_at: student.created_at
              };
            } else {
              console.log('Parent Dashboard - No students found via parent_id method');
            }
          }
          
          // Method 3: Check parents table for this user's email
          if (!studentDetails) {
            console.log('Parent Dashboard - Method 3: Using parents table');
            const { data: parentData, error: parentError } = await supabase
              .from('parents')
              .select('id, name, email, phone, student_id, relation')
              .eq('email', user.email)
              .limit(1);
            
            if (!parentError && parentData && parentData.length > 0) {
              const parentRecord = parentData[0];
              console.log('Parent Dashboard - Found parent record:', parentRecord);
              
              if (parentRecord.student_id) {
                const { data: linkedStudentData, error: linkedStudentError } = await supabase
                  .from(TABLES.STUDENTS)
                  .select(`
                    *,
                    classes(id, class_name, section)
                  `)
                  .eq('id', parentRecord.student_id)
                  .single();
                
                if (!linkedStudentError && linkedStudentData) {
                  console.log('Parent Dashboard - Successfully fetched student from parent record:', linkedStudentData.name);
                  
                  studentDetails = {
                    ...linkedStudentData,
                    roll_number: linkedStudentData.roll_no || linkedStudentData.roll_number,
                    admission_number: linkedStudentData.admission_no || linkedStudentData.admission_number,
                    date_of_birth: linkedStudentData.dob || linkedStudentData.date_of_birth,
                    class_name: linkedStudentData.classes?.class_name || linkedStudentData.class_name,
                    section: linkedStudentData.classes?.section || linkedStudentData.section,
                    full_class_name: linkedStudentData.classes ? `${linkedStudentData.classes.class_name} ${linkedStudentData.classes.section}` : (linkedStudentData.class_name || ''),
                    aadhar_no: linkedStudentData.aadhar_no,
                    place_of_birth: linkedStudentData.place_of_birth,
                    nationality: linkedStudentData.nationality,
                    religion: linkedStudentData.religion,
                    caste: linkedStudentData.caste,
                    pin_code: linkedStudentData.pin_code,
                    mother_tongue: linkedStudentData.mother_tongue,
                    identification_mark_1: linkedStudentData.identification_mark_1,
                    identification_mark_2: linkedStudentData.identification_mark_2,
                    academic_year: linkedStudentData.academic_year,
                    general_behaviour: linkedStudentData.general_behaviour,
                    remarks: linkedStudentData.remarks,
                    parent_id: linkedStudentData.parent_id,
                    school_id: linkedStudentData.school_id,
                    created_at: linkedStudentData.created_at
                  };
                } else {
                  console.error('Parent Dashboard - Error fetching student from parent record:', linkedStudentError);
                }
              }
            } else {
              console.log('Parent Dashboard - No parent record found via email method');
            }
          }
        } catch (err) {
          console.error('Parent Dashboard - Error in Method 1:', err);
        }
        
        // Method 4: Direct query if all methods failed
        if (!studentDetails) {
          try {
            console.log('Parent Dashboard - Method 4: Direct query for students with parent_id');
            
            const { data: directStudentData, error: directError } = await supabase
              .from(TABLES.STUDENTS)
              .select(`
                *,
                classes(id, class_name, section)
              `)
              .eq('parent_id', user.id)
              .maybeSingle();
            
            if (!directError && directStudentData) {
              console.log('Parent Dashboard - Method 4 success, found student:', directStudentData.name);
              
              studentDetails = {
                ...directStudentData,
                roll_number: directStudentData.roll_no || directStudentData.roll_number,
                admission_number: directStudentData.admission_no || directStudentData.admission_number,
                date_of_birth: directStudentData.dob || directStudentData.date_of_birth,
                class_name: directStudentData.classes?.class_name || directStudentData.class_name,
                section: directStudentData.classes?.section || directStudentData.section,
                full_class_name: directStudentData.classes ? `${directStudentData.classes.class_name} ${directStudentData.classes.section}` : (directStudentData.class_name || ''),
                aadhar_no: directStudentData.aadhar_no,
                place_of_birth: directStudentData.place_of_birth,
                nationality: directStudentData.nationality,
                religion: directStudentData.religion,
                caste: directStudentData.caste,
                pin_code: directStudentData.pin_code,
                mother_tongue: directStudentData.mother_tongue,
                identification_mark_1: directStudentData.identification_mark_1,
                identification_mark_2: directStudentData.identification_mark_2,
                academic_year: directStudentData.academic_year,
                general_behaviour: directStudentData.general_behaviour,
                remarks: directStudentData.remarks,
                parent_id: directStudentData.parent_id,
                school_id: directStudentData.school_id,
                created_at: directStudentData.created_at
              };
            } else {
              console.log('Parent Dashboard - Method 4 failed:', directError);
            }
          } catch (err) {
            console.error('Parent Dashboard - Error in Method 4:', err);
          }
        }
        
        // After getting student details, fetch the student's profile photo from users table and parent information
        if (studentDetails) {
          try {
            console.log('Parent Dashboard - Fetching student profile photo for student ID:', studentDetails.id);
            
            // Find the user account linked to this student
            const { data: studentUserData, error: studentUserError } = await supabase
              .from(TABLES.USERS)
              .select('id, profile_url, full_name')
              .eq('linked_student_id', studentDetails.id)
              .maybeSingle();
            
            if (!studentUserError && studentUserData) {
              console.log('Parent Dashboard - Found student user account:', studentUserData.id);
              console.log('Parent Dashboard - Student profile_url:', studentUserData.profile_url);
              studentProfilePhoto = studentUserData.profile_url;
              
              // Add profile photo to student details
              studentDetails.profile_url = studentUserData.profile_url;
            } else {
              console.log('Parent Dashboard - No user account found for student or no profile photo:', studentUserError);
            }
          } catch (err) {
            console.error('Parent Dashboard - Error fetching student profile photo:', err);
          }
          
          // Fetch parent information from parents table
          try {
            console.log('Parent Dashboard - Fetching parent information for student ID:', studentDetails.id);
            
            const { data: parentsData, error: parentsError } = await supabase
              .from('parents')
              .select('name, relation, phone, email')
              .eq('student_id', studentDetails.id);
            
            if (!parentsError && parentsData && parentsData.length > 0) {
              console.log('Parent Dashboard - Found parent information:', parentsData);
              
              // Map parent information based on relation
              let fatherName = null;
              let motherName = null;
              let guardianName = null;
              let parentPhone = null;
              let parentEmail = null;
              
              parentsData.forEach(parent => {
                if (parent.relation === 'Father') {
                  fatherName = parent.name;
                  if (!parentPhone) parentPhone = parent.phone;
                  if (!parentEmail) parentEmail = parent.email;
                } else if (parent.relation === 'Mother') {
                  motherName = parent.name;
                  if (!parentPhone) parentPhone = parent.phone;
                  if (!parentEmail) parentEmail = parent.email;
                } else if (parent.relation === 'Guardian') {
                  guardianName = parent.name;
                  if (!parentPhone) parentPhone = parent.phone;
                  if (!parentEmail) parentEmail = parent.email;
                }
              });
              
              // Add parent information to student details
              studentDetails.father_name = fatherName;
              studentDetails.mother_name = motherName;
              studentDetails.guardian_name = guardianName;
              studentDetails.parent_phone = parentPhone;
              studentDetails.parent_email = parentEmail;
              
              console.log('Parent Dashboard - Mapped parent info:', {
                father_name: fatherName,
                mother_name: motherName,
                guardian_name: guardianName,
                parent_phone: parentPhone,
                parent_email: parentEmail
              });
            } else {
              console.log('Parent Dashboard - No parent information found in parents table:', parentsError);
            }
          } catch (err) {
            console.error('Parent Dashboard - Error fetching parent information:', err);
          }
        }
        
        // If still no student data found, throw error instead of using sample data
        if (!studentDetails) {
          console.error('Parent Dashboard - No student data found through any method');
          throw new Error(`No student linked to this parent account. Please contact the school administration to link your child's account. User ID: ${user.id}, Email: ${user.email}`);
        }
        
        console.log('Parent Dashboard - Final studentDetails:', JSON.stringify(studentDetails, null, 2));
        setStudentData(studentDetails);

        // Get notifications for parent
        try {
          console.log('Fetching notifications for parent:', user.id);
          
          // Get notifications with recipients for this parent
          const { data: notificationsData, error: notificationsError } = await supabase
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
            .eq('recipient_type', 'Parent')
            .eq('recipient_id', user.id)
            .order('sent_at', { ascending: false })
            .limit(10);

          if (notificationsError && notificationsError.code !== '42P01') {
            console.log('Notifications error:', notificationsError);
          } else {
            const mappedNotifications = (notificationsData || []).map(n => ({
              id: n.id,
              title: n.notifications.message || 'Notification', // Use message as title since title doesn't exist
              message: n.notifications.message,
              type: n.notifications.type || 'general',
              created_at: n.notifications.created_at,
              is_read: n.is_read || false,
              read_at: n.read_at
            }));
            console.log('Initial notifications count:', mappedNotifications.length);
            console.log('Initial unread notifications count:', mappedNotifications.filter(n => !n.is_read).length);
            setNotifications(mappedNotifications);
          }
        } catch (err) {
          console.log('Notifications fetch error:', err);
          setNotifications([]);
        }

        // Get upcoming exams for student's class
        try {
          const { data: examsData, error: examsError } = await supabase
            .from(TABLES.EXAMS)
            .select('*')
            .eq('class_id', studentDetails.class_id)
            .order('start_date', { ascending: true })
            .limit(5);

          if (examsError && examsError.code !== '42P01') {
            console.log('Exams error:', examsError);
          }
          setExams(examsData || []);
        } catch (err) {
          console.log('Exams fetch error:', err);
          setExams([]);
        }

        // Get upcoming events from the events table
        try {
          const today = new Date().toISOString().split('T')[0];
          console.log('🔍 Parent Dashboard - Fetching upcoming events from date:', today);
          
          // Get all upcoming events (today and future) that are active
          const { data: upcomingEventsData, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .eq('status', 'Active')
            .gte('event_date', today)
            .order('event_date', { ascending: true });
            
          console.log('📊 Parent Dashboard - Upcoming events found:', upcomingEventsData?.length || 0);
          if (upcomingEventsData && upcomingEventsData.length > 0) {
            console.log('📋 Parent Dashboard - Upcoming events details:');
            upcomingEventsData.forEach((event, index) => {
              console.log(`   ${index + 1}. "${event.title}" - Date: ${event.event_date}, School-wide: ${event.is_school_wide}`);
            });
          }
          
          if (eventsError) {
            console.error('❌ Parent Dashboard - Events query error:', eventsError);
          }
          
          // Map the events to the format expected by the UI
          const mappedEvents = (upcomingEventsData || []).map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            event_date: event.event_date,
            event_time: event.start_time || '09:00',
            icon: event.icon || 'calendar',
            color: event.color || '#FF9800',
            location: event.location,
            organizer: event.organizer
          }));
          
          console.log('✅ Parent Dashboard - Mapped events for dashboard:', mappedEvents.length);
          
          if (mappedEvents.length > 0) {
            console.log('🎉 Parent Dashboard - SUCCESS: Events will be shown on dashboard!');
          } else {
            console.log('⚠️  Parent Dashboard - WARNING: No events to show on dashboard!');
          }
          
          setEvents(mappedEvents.slice(0, 5)); // Show top 5 events
        } catch (err) {
          console.log('❌ Parent Dashboard - Events fetch error:', err);
          setEvents([]);
        }

        // SIMPLE ATTENDANCE CALCULATION - MATCHES StudentAttendanceMarks
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, so add 1

        try {
          // Get ALL attendance records for this student
          const { data: allAttendanceData, error: attendanceError } = await supabase
            .from(TABLES.STUDENT_ATTENDANCE)
            .select('*')
            .eq('student_id', studentDetails.id)
            .order('date', { ascending: false });

          if (attendanceError) throw attendanceError;

          // Filter to current month records
          const currentMonthRecords = (allAttendanceData || []).filter(record => {
            // Safety check for valid date format
            if (!record.date || typeof record.date !== 'string') {
              console.warn('Invalid date format in attendance record:', record.date);
              return false;
            }
            
            const dateParts = record.date.split('-');
            if (dateParts.length < 2) {
              console.warn('Date does not contain expected format (YYYY-MM-DD):', record.date);
              return false;
            }
            
            const recordYear = parseInt(dateParts[0], 10);
            const recordMonth = parseInt(dateParts[1], 10);
            
            // Check if parsing was successful (not NaN)
            if (isNaN(recordYear) || isNaN(recordMonth)) {
              console.warn('Failed to parse date components:', record.date, 'year:', dateParts[0], 'month:', dateParts[1]);
              return false;
            }
            
            return recordYear === year && recordMonth === month;
          });

          console.log('=== PARENT DASHBOARD SIMPLE CALCULATION ===');
          console.log('Current month:', `${year}-${String(month).padStart(2, '0')}`);
          console.log('Current month records:', currentMonthRecords.length);
          console.log('Records:', currentMonthRecords.map(r => `${r.date}: ${r.status}`));
          console.log('==========================================');

          // Use the filtered records
          const attendanceData = currentMonthRecords;

          if (attendanceError && attendanceError.code !== '42P01') {
            console.log('Attendance error:', attendanceError);
          }
          setAttendance(attendanceData || []);
        } catch (err) {
          console.log('Attendance fetch error:', err);
          setAttendance([]);
        }

        // Get student marks
        try {
          const { data: marksData, error: marksError } = await supabase
            .from(TABLES.MARKS)
            .select(`
              *,
              subjects(name),
              exams(name, start_date)
            `)
            .eq('student_id', studentDetails.id)
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

        // Get fee information
        try {
          const { data: feesData, error: feesError } = await supabase
            .from(TABLES.FEES)
            .select('*')
            .eq('student_id', studentDetails.id)
            .order('due_date', { ascending: true });

          if (feesError && feesError.code !== '42P01') {
            console.log('Fees error:', feesError);
          }
          setFees(feesData || []);
        } catch (err) {
          console.log('Fees fetch error:', err);
          setFees([]);
        }

        // Get school details
        try {
          const schoolData = await dbHelpers.getSchoolDetails();
          if (schoolData && schoolData.data) {
            setSchoolDetails(schoolData.data);
          }
        } catch (err) {
          console.log('School details fetch error:', err);
          setSchoolDetails(null);
        }

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
        Alert.alert('Error', 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Calculate unread notifications count
  const unreadCount = notifications.filter(notification => !notification.is_read).length;
  
  // Debug logging for unread count
  console.log('=== PARENT DASHBOARD UNREAD COUNT DEBUG ===');
  console.log('Total notifications:', notifications.length);
  console.log('Notifications array:', notifications);
  console.log('Unread count:', unreadCount);
  console.log('============================================');

  // Calculate attendance percentage - SIMPLE METHOD (only count 'Present' as attended)
  const totalRecords = attendance.length;
  const presentOnlyCount = attendance.filter(a => a.status === 'Present').length;
  const absentCount = attendance.filter(item => item.status === 'Absent').length;
  const attendancePercentage = totalRecords > 0 ? Math.round((presentOnlyCount / totalRecords) * 100) : 0;

  // Calculate attendance data for pie chart with safe values
  const safeAttendanceData = [
    {
      name: 'Present',
      population: Number.isFinite(presentOnlyCount) ? presentOnlyCount : 0,
      color: '#4CAF50',
      legendFontColor: '#333',
      legendFontSize: 14
    },
    {
      name: 'Absent',
      population: Number.isFinite(absentCount) ? absentCount : 0,
      color: '#F44336',
      legendFontColor: '#333',
      legendFontSize: 14
    },
  ];

  // Only show chart if we have valid data
  const attendancePieData = safeAttendanceData.filter(item => item.population > 0).length > 0
    ? safeAttendanceData
    : [{ name: 'No Data', population: 1, color: '#E0E0E0', legendFontColor: '#999', legendFontSize: 14 }];

  console.log('=== PARENT DASHBOARD PERCENTAGE CALCULATION ===');
  console.log('Total records:', totalRecords);
  console.log('Present records:', presentOnlyCount);
  console.log('Calculated percentage:', attendancePercentage);
  console.log('===============================================');

  // Get fee status
  const getFeeStatus = () => {
    if (fees.length === 0) return 'No fees';

    const pendingFees = fees.filter(fee => fee.status === 'pending');
    if (pendingFees.length === 0) return 'All paid';

    const totalPending = pendingFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
    return `₹${totalPending.toLocaleString()}`;
  };

  // Get fee subtitle
  const getFeeSubtitle = () => {
    if (fees.length === 0) return 'No fees due';

    const pendingFees = fees.filter(fee => fee.status === 'pending');
    if (pendingFees.length === 0) return 'All fees paid';

    const nextDue = pendingFees.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
    const daysUntilDue = Math.ceil((new Date(nextDue.due_date) - new Date()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue === 0) return 'Due today';
    return `Due in ${daysUntilDue} days`;
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

  // Get marks subtitle
  const getMarksSubtitle = () => {
    if (marks.length === 0) return 'No exams taken';

    const recentMarks = marks.slice(0, 3);
    const avgRecent = recentMarks.reduce((sum, mark) => {
      const percentage = (mark.marks_obtained / mark.max_marks) * 100;
      return sum + percentage;
    }, 0) / recentMarks.length;

    if (avgRecent >= 90) return 'Excellent performance';
    if (avgRecent >= 75) return 'Good performance';
    if (avgRecent >= 60) return 'Average performance';
    return 'Needs improvement';
  };

  // Find the next upcoming event
  const nextEvent = events && events.length > 0 ? events[0] : null;

  // Update childStats for the event card
  const childStats = [
    {
      title: 'Attendance',
      value: `${attendancePercentage}%`,
      icon: 'checkmark-circle',
      color: attendancePercentage >= 75 ? '#4CAF50' : attendancePercentage >= 60 ? '#FF9800' : '#F44336',
      subtitle: `${presentOnlyCount}/${attendance.length} days present`,
      onPress: () => navigation.navigate('Attendance')
    },
    {
      title: 'Fee Status',
      value: getFeeStatus(),
      icon: 'card',
      color: fees.filter(f => f.status === 'pending').length > 0 ? '#FF9800' : '#4CAF50',
      subtitle: getFeeSubtitle(),
      onPress: () => navigation.navigate('Fees')
    },
    {
      title: 'Average Marks',
      value: getAverageMarks(),
      icon: 'document-text',
      color: '#2196F3',
      subtitle: getMarksSubtitle(),
      onPress: () => navigation.navigate('Marks')
    },
    {
      title: 'Upcoming Exams',
      value: String(exams.length),
      icon: 'calendar',
      color: '#9C27B0',
      subtitle: exams.length > 0 ? `Next: ${exams[0]?.name || 'TBA'}` : 'No upcoming exams',
      onPress: () => setShowExamsModal(true)
    },
  ];

  const renderExamItem = ({ item, index }) => (
    <View style={styles.examItem}>
      <View style={styles.examIcon}>
        <Ionicons name="calendar" size={24} color="#9C27B0" />
      </View>
      <View style={styles.examInfo}>
        <Text style={styles.examSubject}>{item.subject_name}</Text>
        <Text style={styles.examDetails}>{formatDateToDDMMYYYY(item.exam_date)} • {item.exam_time}</Text>
        <Text style={styles.examClass}>{item.class_name}</Text>
      </View>
      <TouchableOpacity style={styles.examAction}>
        <Ionicons name="chevron-forward" size={20} color="#9C27B0" />
      </TouchableOpacity>
    </View>
  );

  const renderEventItem = ({ item, index }) => {
    // Ensure item is defined and has required properties
    const safeItem = {
      color: item?.color || '#FF9800',
      icon: item?.icon || 'calendar',
      title: item?.title || 'Event',
      event_date: item?.event_date || new Date().toISOString().split('T')[0],
      event_time: item?.event_time || '09:00',
      description: item?.description || 'No description available'
    };

    return (
      <View style={styles.eventItem}>
        <View style={[styles.eventIcon, { backgroundColor: safeItem.color }]}>
          <Ionicons name={safeItem.icon} size={24} color="#fff" />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{safeItem.title}</Text>
          <Text style={styles.eventDetails}>{formatDateToDDMMYYYY(safeItem.event_date)} • {safeItem.event_time}</Text>
          <Text style={styles.eventDescription}>{safeItem.description}</Text>
        </View>
      </View>
    );
  };

  const renderNotificationItem = ({ item, index }) => (
    <View style={[styles.notificationItem, { borderLeftColor: getNotificationColor(item.type) }]}>
      <View style={styles.notificationIcon}>
        <Ionicons name={getNotificationIcon(item.type)} size={20} color={getNotificationColor(item.type)} />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{formatDateToDDMMYYYY(item.created_at)}</Text>
      </View>
    </View>
  );

  const getNotificationColor = (type) => {
    switch (type) {
      case 'fee': return '#FF9800';
      case 'exam': return '#9C27B0';
      case 'attendance': return '#f44336';
      case 'homework': return '#2196F3';
      case 'event': return '#FF9800';
      case 'sports': return '#4CAF50';
      case 'meeting': return '#9C27B0';
      default: return '#666';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'fee': return 'card';
      case 'exam': return 'calendar';
      case 'attendance': return 'checkmark-circle';
      case 'homework': return 'library';
      case 'event': return 'trophy';
      case 'sports': return 'football';
      case 'meeting': return 'people';
      default: return 'notifications';
    }
  };

  const renderExamCard = ({ item, index }) => (
    <View style={styles.eventItem}>
      <View style={[styles.eventIcon, { backgroundColor: '#9C27B0' }]}> 
        <Ionicons name="calendar" size={24} color="#fff" />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.subject_name} Exam</Text>
        <Text style={styles.eventDetails}>{formatDateToDDMMYYYY(item.exam_date)} • {item.exam_time}</Text>
        <Text style={styles.eventDescription}>{item.description || 'Exam scheduled'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Parent Dashboard" showBack={false} showNotifications={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Parent Dashboard" showBack={false} showNotifications={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>Failed to load dashboard</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.replace('ParentDashboard')}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Use student profile photo if available, otherwise fallback to default
  const studentImage = studentData?.profile_url ? { uri: studentData.profile_url } : require('../../../assets/icon.png');

  return (
    <View style={styles.container}>
      <Header 
        title="Parent Dashboard" 
        showBack={false} 
        showNotifications={true}
        unreadCount={unreadCount}
      />
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF9800']}
            progressBackgroundColor="#fff"
          />
        }
      >
        {/* Welcome Section - Modern gradient design */}
        {schoolDetails && (
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
        )}

        {/* Student Details Card */}
        <TouchableOpacity style={styles.studentCard} onPress={() => setShowStudentDetailsModal(true)} activeOpacity={0.85}>
          <View style={styles.studentCardRow}>
            <Image source={studentImage} style={styles.studentAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.studentCardName}>{studentData?.name || 'Student Name'}</Text>
              <Text style={styles.studentCardClass}>{studentData?.full_class_name || studentData?.class_name || 'N/A'} • Roll No: {studentData?.roll_number || 'N/A'}</Text>
              <Text style={[styles.studentCardClass, { fontSize: 12, color: '#999' }]}>Class ID: {studentData?.class_id || 'N/A'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={28} color="#bbb" />
          </View>
        </TouchableOpacity>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {childStats.map((stat, index) => (
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

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ParentTabs', { screen: 'Chat' })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="chatbubble" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Message Teacher</Text>
              <Text style={styles.actionSubtitle}>Chat with teachers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('CallWithTeacher')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="call" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Call Teacher</Text>
              <Text style={styles.actionSubtitle}>Make a phone call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ParentNotifications')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="notifications" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Notifications</Text>
              <Text style={styles.actionSubtitle}>View updates</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Fees')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="card" size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>Pay Fees</Text>
              <Text style={styles.actionSubtitle}>Online payment</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* This Week's Attendance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week's Attendance</Text>
            <TouchableOpacity onPress={() => setShowAttendanceModal(true)}>
              <Text style={styles.viewAllText}>View Details</Text>
            </TouchableOpacity>
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
                Present: {presentOnlyCount} days | Absent: {absentCount} days
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Marks */}
        {marks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Marks</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Marks')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.marksContainer}>
              {marks.slice(0, 3).map((mark, index) => (
                <View key={index} style={styles.markCard}>
                  <View style={styles.markHeader}>
                    <Text style={styles.markSubject}>{mark.subjects?.name || 'Subject'}</Text>
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


        {/* Upcoming Exams */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Exams</Text>
            <TouchableOpacity onPress={() => setShowExamsModal(true)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={exams.slice(0, 4)}
            renderItem={renderExamCard}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => setShowEventsModal(true)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={events.slice(0, 4)}
            renderItem={renderEventItem}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

      </ScrollView>

      {/* Attendance Details Modal */}
      {showAttendanceModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>This Week's Attendance</Text>
              <TouchableOpacity onPress={() => setShowAttendanceModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 300 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              <View style={styles.attendanceTableHeader}>
                <Text style={styles.attendanceTableColHeader}>Date</Text>
                <Text style={styles.attendanceTableColHeader}>Day</Text>
                <Text style={styles.attendanceTableColHeader}>Status</Text>
              </View>
              {attendance.map((item, idx) => (
                <View key={idx} style={styles.attendanceTableRow}>
                  <Text style={styles.attendanceTableCol}>{formatDateToDDMMYYYY(item.date)}</Text>
                  <Text style={styles.attendanceTableCol}>{new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}</Text>
                  <Text style={[styles.attendanceTableCol, { color: item.status === 'present' ? '#4CAF50' : '#F44336', fontWeight: 'bold' }]}>{item.status}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Events Modal */}
      {showEventsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Upcoming Events</Text>
              <TouchableOpacity onPress={() => setShowEventsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 400 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {events.map((item, idx) => (
                <View key={idx} style={styles.modalEventItem}>
                  <View style={[styles.modalEventIcon, { backgroundColor: item.color || '#FF9800' }]}>
                    <Ionicons name={item.icon || 'calendar'} size={24} color="#fff" />
                  </View>
                  <View style={styles.modalEventInfo}>
                    <Text style={styles.modalEventTitle}>{item.title}</Text>
                    <Text style={styles.modalEventDetails}>{formatDateToDDMMYYYY(item.event_date)} • {item.event_time}</Text>
                    <Text style={styles.modalEventDescription}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Exams Modal */}
      {showExamsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Upcoming Exams</Text>
              <TouchableOpacity onPress={() => setShowExamsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 400 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {exams.map((item, idx) => (
                <View key={idx} style={styles.modalEventItem}>
                  <View style={[styles.modalEventIcon, { backgroundColor: '#9C27B0' }]}>
                    <Ionicons name="calendar" size={24} color="#fff" />
                  </View>
                  <View style={styles.modalEventInfo}>
                    <Text style={styles.modalEventTitle}>{item.subject_name} Exam</Text>
                    <Text style={styles.modalEventDetails}>{formatDateToDDMMYYYY(item.exam_date)} • {item.exam_time}</Text>
                    <Text style={styles.modalEventDescription}>{item.description || 'Exam scheduled'}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={{ height: 400 }} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {notifications.map((item, idx) => (
                <View key={idx} style={styles.notificationItem}>
                  {renderNotificationItem({ item, index: idx })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Student Details Modal */}
      {showStudentDetailsModal && (
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
                <Image source={studentImage} style={styles.studentAvatarLarge} />
              </View>
              {/* Basic Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Name:</Text><Text style={styles.detailsValue}>{studentData?.name || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Admission No:</Text><Text style={styles.detailsValue}>{studentData?.admission_number || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Roll No:</Text><Text style={styles.detailsValue}>{studentData?.roll_number || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Class:</Text><Text style={styles.detailsValue}>{studentData?.full_class_name || studentData?.class_name || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Academic Year:</Text><Text style={styles.detailsValue}>{studentData?.academic_year || 'N/A'}</Text></View>
              
              {/* Personal Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>DOB:</Text><Text style={styles.detailsValue}>{studentData?.date_of_birth || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Gender:</Text><Text style={styles.detailsValue}>{studentData?.gender || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Blood Group:</Text><Text style={styles.detailsValue}>{studentData?.blood_group || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Aadhar No:</Text><Text style={styles.detailsValue}>{studentData?.aadhar_no || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Place of Birth:</Text><Text style={styles.detailsValue}>{studentData?.place_of_birth || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Nationality:</Text><Text style={styles.detailsValue}>{studentData?.nationality || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Religion:</Text><Text style={styles.detailsValue}>{studentData?.religion || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Caste:</Text><Text style={styles.detailsValue}>{studentData?.caste || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Mother Tongue:</Text><Text style={styles.detailsValue}>{studentData?.mother_tongue || 'N/A'}</Text></View>
              
              {/* Contact Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Address:</Text><Text style={styles.detailsValue}>{studentData?.address || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Pin Code:</Text><Text style={styles.detailsValue}>{studentData?.pin_code || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Mobile:</Text><Text style={styles.detailsValue}>{studentData?.phone || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Email:</Text><Text style={styles.detailsValue}>{studentData?.email || 'N/A'}</Text></View>
              
              {/* Family Information */}
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Father's Name:</Text><Text style={styles.detailsValue}>{studentData?.father_name || 'N/A'}</Text></View>
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Mother's Name:</Text><Text style={styles.detailsValue}>{studentData?.mother_name || 'N/A'}</Text></View>
              {studentData?.guardian_name && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Guardian Name:</Text><Text style={styles.detailsValue}>{studentData.guardian_name}</Text></View>
              )}
              {studentData?.parent_phone && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Parent Phone:</Text><Text style={styles.detailsValue}>{studentData.parent_phone}</Text></View>
              )}
              {studentData?.parent_email && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Parent Email:</Text><Text style={styles.detailsValue}>{studentData.parent_email}</Text></View>
              )}
              
              {/* Physical Characteristics */}
              {(studentData?.identification_mark_1 || studentData?.identification_mark_2) && (
                <>
                  {studentData?.identification_mark_1 && (
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>ID Mark 1:</Text><Text style={styles.detailsValue}>{studentData.identification_mark_1}</Text></View>
                  )}
                  {studentData?.identification_mark_2 && (
                    <View style={styles.detailsRow}><Text style={styles.detailsLabel}>ID Mark 2:</Text><Text style={styles.detailsValue}>{studentData.identification_mark_2}</Text></View>
                  )}
                </>
              )}
              
              {/* Behavioral Information */}
              {studentData?.general_behaviour && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Behaviour:</Text><Text style={styles.detailsValue}>{studentData.general_behaviour}</Text></View>
              )}
              
              {/* Additional Notes */}
              {studentData?.remarks && (
                <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Remarks:</Text><Text style={styles.detailsValue}>{studentData.remarks}</Text></View>
              )}
            </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statCardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
  },
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
  chart: {
    borderRadius: 12,
  },

  examItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  examIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3e5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  examInfo: {
    flex: 1,
  },
  examSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  examDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  examClass: {
    fontSize: 12,
    color: '#999',
  },
  examAction: {
    padding: 8,
  },
  eventItem: {
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
    alignItems: 'center',
    justifyContent: 'center',
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
  eventDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  eventAction: {
    padding: 8,
  },
  modalEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalEventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modalEventInfo: {
    flex: 1,
  },
  modalEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modalEventDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalEventDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
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
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  attendanceTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  attendanceTableColHeader: {
    flex: 1,
    fontWeight: 'bold',
    color: '#1976d2',
    fontSize: 15,
    textAlign: 'center',
  },
  attendanceTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attendanceTableCol: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
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
    marginRight: 16,
    backgroundColor: '#eee',
  },
  studentAvatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  detailsLabel: {
    fontWeight: 'bold',
    color: '#1976d2',
    width: 120,
    fontSize: 15,
  },
  detailsValue: {
    flex: 1,
    color: '#333',
    fontSize: 15,
    marginLeft: 8,
    flexWrap: 'wrap',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
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
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Marks Section Styles
  marksContainer: {
    paddingHorizontal: 4,
  },
  markCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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

  // Fee Section Styles
  feesContainer: {
    paddingHorizontal: 4,
  },
  feeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  feeStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  feeStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  feeDueDate: {
    fontSize: 12,
    color: '#999',
  },

  // Welcome Section - AdminDashboard Style
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
  dateText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Quick Actions Styles
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default ParentDashboard;
