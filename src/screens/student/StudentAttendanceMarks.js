import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal, Pressable, AccessibilityInfo, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const MONTHS = [
  { label: 'January', value: '2024-01' },
  { label: 'February', value: '2024-02' },
  { label: 'March', value: '2024-03' },
  { label: 'April', value: '2024-04' },
  { label: 'May', value: '2024-05' },
  { label: 'June', value: '2024-06' },
  { label: 'July', value: '2024-07' },
  { label: 'August', value: '2024-08' },
  { label: 'September', value: '2024-09' },
  { label: 'October', value: '2024-10' },
  { label: 'November', value: '2024-11' },
  { label: 'December', value: '2024-12' },
];

const getAttendanceColor = (status) => {
  switch (status) {
    case 'present': return '#4CAF50';
    case 'absent': return '#F44336';
    case 'late': return '#FF9800';
    case 'excused': return '#9C27B0';
    default: return '#bbb';
  }
};
const getAttendanceIcon = (status) => {
  switch (status) {
    case 'present': return 'checkmark-circle';
    case 'absent': return 'close-circle';
    case 'late': return 'time';
    case 'excused': return 'medical';
    default: return 'help-circle';
  }
};

// School info will be loaded dynamically from database

export default function StudentAttendanceMarks({ route, navigation }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [selectedStat, setSelectedStat] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [attendanceData, setAttendanceData] = useState({});
  const [attendanceDetails, setAttendanceDetails] = useState({});
  const [marksData, setMarksData] = useState([]);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthlyAttendanceStats, setMonthlyAttendanceStats] = useState({});
  const [classAverages, setClassAverages] = useState({});
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [schoolInfo, setSchoolInfo] = useState({
    name: 'Springfield Public School',
    address: '123 Main St, Springfield, USA',
    logoUrl: '',
  });

  // Fetch attendance and marks from Supabase
  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get student id from user context
      // Get student data using the helper function
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      // Get student details from the linked student
      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      const studentId = student.id;

      setStudentInfo({
        name: student.name,
        class: student.classes?.class_name || 'N/A',
        rollNo: student.roll_no,
        section: student.classes?.section || '',
        profilePicUrl: '',
      });

      // Get attendance records with additional details
      const { data: attendance, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          classes(
            id,
            class_name,
            section
          ),
          users!student_attendance_marked_by_fkey(
            full_name
          )
        `)
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (attendanceError) {
        console.error('Attendance error:', attendanceError);
        throw attendanceError;
      }

      // Group attendance by date string with additional metadata
      const attendanceMap = {};
      const attendanceDetailsMap = {};
      attendance.forEach(a => {
        const dateStr = a.date;
        let status = 'present';
        if (a.status === 'Present') status = 'present';
        else if (a.status === 'Absent') status = 'absent';
        else if (a.status === 'Late') status = 'late';
        else if (a.status === 'Excused') status = 'excused';

        attendanceMap[dateStr] = status;
        attendanceDetailsMap[dateStr] = {
          status,
          markedBy: a.users?.full_name || 'System',
          className: a.classes?.class_name || student.classes?.class_name,
          section: a.classes?.section || student.classes?.section,
          createdAt: a.created_at
        };
      });
      setAttendanceData(attendanceMap);
      setAttendanceDetails(attendanceDetailsMap);

      // Get marks records with subject and exam details
      const { data: marks, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            is_optional
          ),
          exams(
            id,
            name,
            start_date,
            end_date,
            class_id
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (marksError) {
        console.error('Marks error:', marksError);
        throw marksError;
      }

      // Process marks data to include subject and exam names
      const processedMarks = marks.map(mark => ({
        ...mark,
        subject_name: mark.subjects?.name || 'Unknown Subject',
        exam_name: mark.exams?.name || 'Unknown Exam',
        exam_date: mark.exams?.start_date,
        total_marks: mark.max_marks || 100,
        percentage: mark.marks_obtained && mark.max_marks ?
          Math.round((mark.marks_obtained / mark.max_marks) * 100) : 0
      }));

      setMarksData(processedMarks);

      // Get class average for comparison (optional enhancement)
      try {
        const { data: classMarks, error: classMarksError } = await supabase
          .from(TABLES.MARKS)
          .select(`
            marks_obtained,
            max_marks,
            subject_id,
            exam_id,
            students!inner(class_id)
          `)
          .eq('students.class_id', student.class_id);

        if (!classMarksError && classMarks) {
          // Calculate class averages by subject and exam
          const classAverages = {};
          classMarks.forEach(mark => {
            const key = `${mark.subject_id}-${mark.exam_id}`;
            if (!classAverages[key]) {
              classAverages[key] = { total: 0, count: 0, maxMarks: mark.max_marks };
            }
            classAverages[key].total += mark.marks_obtained || 0;
            classAverages[key].count += 1;
          });

          // Add class average to processed marks
          const marksWithClassAvg = processedMarks.map(mark => {
            const key = `${mark.subject_id}-${mark.exam_id}`;
            const classAvg = classAverages[key];
            return {
              ...mark,
              classAverage: classAvg ? Math.round((classAvg.total / classAvg.count / classAvg.maxMarks) * 100) : null
            };
          });
          setMarksData(marksWithClassAvg);
        }
      } catch (classErr) {
        console.log('Class average calculation error:', classErr);
        // Continue without class averages
      }

      // Get attendance statistics for the current academic year
      try {
        const currentYear = new Date().getFullYear();
        const academicYearStart = `${currentYear}-04-01`; // Assuming academic year starts in April
        const academicYearEnd = `${currentYear + 1}-03-31`;

        const { data: yearlyAttendance, error: yearlyError } = await supabase
          .from(TABLES.STUDENT_ATTENDANCE)
          .select('date, status')
          .eq('student_id', studentId)
          .gte('date', academicYearStart)
          .lte('date', academicYearEnd)
          .order('date', { ascending: true });

        if (!yearlyError && yearlyAttendance) {
          // Calculate monthly attendance trends
          const monthlyStats = {};
          yearlyAttendance.forEach(record => {
            const month = record.date.substring(0, 7); // YYYY-MM format
            if (!monthlyStats[month]) {
              monthlyStats[month] = { present: 0, absent: 0, total: 0 };
            }
            monthlyStats[month].total += 1;
            if (record.status === 'Present') {
              monthlyStats[month].present += 1;
            } else {
              monthlyStats[month].absent += 1;
            }
          });

          // Store monthly stats for potential use in charts
          setMonthlyAttendanceStats(monthlyStats);
          console.log('Monthly attendance stats:', monthlyStats);
        }
      } catch (yearlyErr) {
        console.log('Yearly attendance calculation error:', yearlyErr);
      }

      // Get upcoming exams for this student's class
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: upcomingExams, error: examsError } = await supabase
          .from(TABLES.EXAMS)
          .select(`
            id,
            name,
            start_date,
            end_date,
            remarks,
            class_id
          `)
          .eq('class_id', student.class_id)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(5);

        if (!examsError && upcomingExams) {
          setUpcomingExams(upcomingExams);
          console.log('Upcoming exams:', upcomingExams);
        }
      } catch (examsErr) {
        console.log('Upcoming exams fetch error:', examsErr);
      }

      // Get subjects for this student's class
      try {
        const { data: subjects, error: subjectsError } = await supabase
          .from(TABLES.SUBJECTS)
          .select(`
            id,
            name,
            is_optional,
            class_id
          `)
          .eq('class_id', student.class_id);

        if (!subjectsError && subjects) {
          setClassSubjects(subjects);
          console.log('Class subjects:', subjects);
        }
      } catch (subjectsErr) {
        console.log('Subjects fetch error:', subjectsErr);
      }

      // Get school details
      try {
        const { data: schoolDetails, error: schoolError } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .select('*')
          .limit(1)
          .single();

        if (!schoolError && schoolDetails) {
          setSchoolInfo({
            name: schoolDetails.name || 'School Management System',
            address: schoolDetails.address || 'School Address',
            logoUrl: schoolDetails.logo_url || '',
            phone: schoolDetails.phone || '',
            email: schoolDetails.email || '',
            website: schoolDetails.website || '',
            principalName: schoolDetails.principal_name || ''
          });
        }
      } catch (schoolErr) {
        console.log('School details fetch error:', schoolErr);
      }

    } catch (err) {
      setError(err.message);
      console.error('StudentAttendanceMarks error:', err);
    } finally {
      setLoading(false);
    }
  };

  // SIMPLE SOLUTION - Handle tab changes
  useEffect(() => {
    if (route?.params?.activeTab) {
      console.log('Setting activeTab to:', route.params.activeTab);
      setActiveTab(route.params.activeTab);
    }
  }, [route?.params?.activeTab]);

  useEffect(() => {
    fetchStudentData();
    // Enhanced real-time subscriptions
    const attendanceSub = supabase
      .channel('student-attendance-marks-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.STUDENT_ATTENDANCE }, fetchStudentData)
      .subscribe();
    const marksSub = supabase
      .channel('student-attendance-marks-marks')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.MARKS }, fetchStudentData)
      .subscribe();
    const examsSub = supabase
      .channel('student-attendance-marks-exams')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.EXAMS }, fetchStudentData)
      .subscribe();
    const subjectsSub = supabase
      .channel('student-attendance-marks-subjects')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.SUBJECTS }, fetchStudentData)
      .subscribe();
    const studentsSub = supabase
      .channel('student-attendance-marks-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.STUDENTS }, fetchStudentData)
      .subscribe();

    return () => {
      attendanceSub.unsubscribe();
      marksSub.unsubscribe();
      examsSub.unsubscribe();
      subjectsSub.unsubscribe();
      studentsSub.unsubscribe();
    };
  }, []);

  // Attendance summary for selected month
  const stats = { present: 0, absent: 0, late: 0, excused: 0 };
  const [year, month] = selectedMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const s = attendanceData[dateStr];
    if (stats[s] !== undefined) stats[s]++;
  }
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const percentage = total ? Math.round((stats.present / total) * 100) : 0;

  // Stat card details
  const statDetails = {
    present: 'Days the student was present in class.',
    absent: 'Days the student was absent from class.',
    late: 'Days the student was late to class.',
    excused: 'Days the student was excused (with permission).',
    attendance: 'Overall attendance percentage for the selected month.'
  };

  // Marks logic
  const examTypes = Array.from(new Set(marksData.map(m => m.exam_name)));
  const marksByExam = examTypes.map(type => ({
    type,
    marks: marksData.filter(m => m.exam_name === type),
  }));
  const avgByExam = examTypes.map(type => {
    const ms = marksData.filter(m => m.exam_name === type);
    const avg = ms.length ? ms.reduce((sum, m) => sum + ((m.marks_obtained / (m.total_marks || 100)) * 100), 0) / ms.length : 0;
    return { type, avg: Math.round(avg) };
  });
  const improvementData = avgByExam.map((a, i, arr) => {
    let color = '#1976d2';
    if (i > 0) {
      if (a.avg > arr[i-1].avg) color = '#4CAF50';
      else if (a.avg < arr[i-1].avg) color = '#F44336';
      else color = '#FF9800';
    }
    return { ...a, color };
  });

  // Month navigation handlers
  const monthIdx = MONTHS.findIndex(m => m.value === selectedMonth);
  const goPrevMonth = () => {
    if (monthIdx > 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setSelectedMonth(MONTHS[monthIdx - 1].value);
        fadeAnim.setValue(1);
      });
    }
  };
  const goNextMonth = () => {
    if (monthIdx < MONTHS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setSelectedMonth(MONTHS[monthIdx + 1].value);
        fadeAnim.setValue(1);
      });
    }
  };

  function getCalendarTableHtml(month, year, attendanceData) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    let html = '<table class="calendar-table"><tr>';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
      html += `<th>${d}</th>`;
    });
    html += '</tr><tr>';
    for (let i = 0; i < startWeekday; i++) html += '<td></td>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const status = attendanceData[dateStr];
      let bg = '';
      if (status === 'present') bg = 'background:#4CAF50;color:#fff;';
      else if (status === 'absent') bg = 'background:#F44336;color:#fff;';
      else if (status === 'late') bg = 'background:#FF9800;color:#fff;';
      else if (status === 'excused') bg = 'background:#9C27B0;color:#fff;';
      html += `<td style="${bg}">${day}</td>`;
      if ((startWeekday + day) % 7 === 0) html += '</tr><tr>';
    }
    html += '</tr></table>';
    return html;
  }
  const calendarHtml = getCalendarTableHtml(month - 1, year, attendanceData);
  const barChartHtml = `
    <div style="display:flex;justify-content:space-around;margin:18px 0 8px 0;">
      <div style="text-align:center;"><div style="height:${stats.present*2}px;width:24px;background:#4CAF50;margin-bottom:4px;"></div><div style="font-size:13px;">Present</div></div>
      <div style="text-align:center;"><div style="height:${stats.absent*2}px;width:24px;background:#F44336;margin-bottom:4px;"></div><div style="font-size:13px;">Absent</div></div>
      <div style="text-align:center;"><div style="height:${stats.late*2}px;width:24px;background:#FF9800;margin-bottom:4px;"></div><div style="font-size:13px;">Late</div></div>
      <div style="text-align:center;"><div style="height:${stats.excused*2}px;width:24px;background:#9C27B0;margin-bottom:4px;"></div><div style="font-size:13px;">Excused</div></div>
    </div>
  `;
  const marksListHtml = `
    <ul style='margin-top:8px;'>
      ${marksData.map(m => `<li>${m.subject_name} (${m.exam_name}): <b>${m.marks_obtained}/${m.total_marks}</b></li>`).join('')}
    </ul>
  `;
  const improvementGraphHtml = `
    <div style='display:flex;align-items:flex-end;height:120px;padding:8px 0;margin-bottom:12px;'>
      ${improvementData.map(a => `
        <div style='width:48px;align-items:center;margin:0 8px;text-align:center;'>
          <div style='font-size:13px;color:#222;font-weight:bold;margin-bottom:4px;'>${a.avg}%</div>
          <div style='height:${a.avg}px;width:32px;background:${a.color};border-radius:8px;margin:0 auto;'></div>
          <div style='font-size:13px;color:#888;margin-top:6px;'>${a.type}</div>
        </div>
      `).join('')}
    </div>
  `;
  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .school-header { display: flex; align-items: center; margin-bottom: 16px; }
          .school-logo { width: 60px; height: 60px; border-radius: 8px; margin-right: 16px; background: #eee; display: inline-block; }
          .student-info { display: flex; align-items: center; margin-bottom: 16px; }
          .profile-pic { width: 60px; height: 60px; border-radius: 30px; background: #eee; margin-right: 16px; display: flex; align-items: center; justify-content: center; }
          .profile-placeholder { width: 60px; height: 60px; border-radius: 30px; background: #ccc; }
          .student-details { font-size: 15px; color: #333; }
          .student-name { font-size: 20px; font-weight: bold; color: #1976d2; margin-bottom: 2px; }
          .calendar-table { border-collapse: collapse; width: 100%; margin-top: 16px; }
          .calendar-table th, .calendar-table td { width: 40px; height: 40px; text-align: center; border: 1px solid #ddd; }
          .calendar-table th { background: #f5f5f5; color: #1976d2; }
        </style>
      </head>
      <body>
        <div class="school-header">
          <div class="school-logo"></div>
          <div>
            <h1 style="margin:0;">${schoolInfo.name}</h1>
            <p style="margin:0;">${schoolInfo.address}</p>
          </div>
        </div>
        <div class="student-info">
          <div class="profile-pic"><div class="profile-placeholder"></div></div>
          <div class="student-details">
            <div class="student-name">${studentInfo?.name}</div>
            <div>Class: ${studentInfo?.class} &nbsp; Roll No: ${studentInfo?.rollNo}</div>
            <div>Section: ${studentInfo?.section}</div>
          </div>
        </div>
        <h2 style="color:#1976d2;">Attendance Calendar</h2>
        ${calendarHtml}
        <h2 style="color:#1976d2;">Attendance Stats</h2>
        <div style="font-size:16px;margin-bottom:8px;">Present: <b>${stats.present}</b> &nbsp; Absent: <b>${stats.absent}</b> &nbsp; Late: <b>${stats.late}</b> &nbsp; Excused: <b>${stats.excused}</b> &nbsp; Attendance %: <b>${percentage}%</b></div>
        ${barChartHtml}
        <h2 style="color:#1976d2;">Marks Summary</h2>
        ${marksListHtml}
        <h2 style="color:#1976d2;">Improvement Graph</h2>
        ${improvementGraphHtml}
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 10, color: '#555' }}>Loading data...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
          <Text style={{ fontSize: 18, color: '#F44336', textAlign: 'center', padding: 20 }}>{error}</Text>
          <TouchableOpacity onPress={fetchStudentData} style={{ backgroundColor: '#1976d2', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Tab Selector */}
          <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, alignSelf: 'center', padding: 4 }}>
            <TouchableOpacity
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, position: 'relative' }}
              onPress={() => setActiveTab('attendance')}
              accessibilityLabel="Attendance Tab"
            >
              <Text style={{
                color: activeTab === 'attendance' ? '#1976d2' : '#90caf9',
                fontWeight: 'bold',
                fontSize: 16,
              }}>Attendance</Text>
              {activeTab === 'attendance' && (
                <View style={{ height: 2, backgroundColor: '#1976d2', borderRadius: 2, width: 32, marginTop: 4 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, position: 'relative' }}
              onPress={() => setActiveTab('marks')}
              accessibilityLabel="Marks Tab"
            >
              <Text style={{
                color: activeTab === 'marks' ? '#1976d2' : '#90caf9',
                fontWeight: 'bold',
                fontSize: 16,
              }}>Marks</Text>
              {activeTab === 'marks' && (
                <View style={{ height: 2, backgroundColor: '#1976d2', borderRadius: 2, width: 32, marginTop: 4 }} />
              )}
            </TouchableOpacity>
          </View>
          {activeTab === 'attendance' ? (
            <>
              {/* Stats Cards at the Top */}
              <View style={{ marginBottom: 16 }}>
                {/* First row: Attendance % only */}
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <View style={[styles.statCard, { flex: 1 }]}>
                    <Ionicons name="trending-up" size={28} color="#2196F3" style={styles.statIcon} />
                    <Text style={[styles.statNumber, { color: '#2196F3' }]}>{percentage}%</Text>
                    <Text style={styles.statLabel}>Attendance</Text>
                  </View>
                </View>
                {/* Second row: Present and Absent */}
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <View style={[styles.statCard, { flex: 1, marginRight: 6 }]}>
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" style={styles.statIcon} />
                    <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.present}</Text>
                    <Text style={styles.statLabel}>Present</Text>
                  </View>
                  <View style={[styles.statCard, { flex: 1, marginLeft: 6 }]}>
                    <Ionicons name="close-circle" size={28} color="#F44336" style={styles.statIcon} />
                    <Text style={[styles.statNumber, { color: '#F44336' }]}>{stats.absent}</Text>
                    <Text style={styles.statLabel}>Absent</Text>
                  </View>
                </View>
                {/* Third row: Late and Excused */}
                <View style={{ flexDirection: 'row' }}>
                  <View style={[styles.statCard, { flex: 1, marginRight: 6 }]}>
                    <Ionicons name="time" size={28} color="#FF9800" style={styles.statIcon} />
                    <Text style={[styles.statNumber, { color: '#FF9800' }]}>{stats.late}</Text>
                    <Text style={styles.statLabel}>Late</Text>
                  </View>
                  <View style={[styles.statCard, { flex: 1, marginLeft: 6 }]}>
                    <Ionicons name="medical" size={28} color="#9C27B0" style={styles.statIcon} />
                    <Text style={[styles.statNumber, { color: '#9C27B0' }]}>{stats.excused}</Text>
                    <Text style={styles.statLabel}>Excused</Text>
                  </View>
                </View>
              </View>
              {/* Stat Details Modal */}
              <Modal visible={!!selectedStat} transparent animationType="fade" onRequestClose={() => setSelectedStat(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 28, minWidth: 240, alignItems: 'center', elevation: 6 }}>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#FF9800', marginBottom: 10 }}>{selectedStat && statDetails[selectedStat] ? statDetails[selectedStat].split(' ')[0] : ''}</Text>
                    <Text style={{ fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 18 }}>{selectedStat && statDetails[selectedStat]}</Text>
                    <TouchableOpacity onPress={() => setSelectedStat(null)} style={{ backgroundColor: '#FF9800', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 24 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              {/* Carousel Month Selector */}
              {/* In the attendance tab, update the month carousel to look like a single pill/box */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F2FD', borderRadius: 18, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 }}>
                <TouchableOpacity onPress={goPrevMonth} style={{ backgroundColor: '#BBDEFB', borderRadius: 16, padding: 6, marginRight: 8, borderWidth: 1, borderColor: '#90caf9' }}>
                  <Ionicons name="chevron-back" size={22} color="#1976d2" />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#1976d2', letterSpacing: 0.5, minWidth: 90, textAlign: 'center' }}>{MONTHS.find(m => m.value === selectedMonth)?.label} {year}</Text>
                <TouchableOpacity onPress={goNextMonth} style={{ backgroundColor: '#BBDEFB', borderRadius: 16, padding: 6, marginLeft: 8, borderWidth: 1, borderColor: '#90caf9' }}>
                  <Ionicons name="chevron-forward" size={22} color="#1976d2" />
                </TouchableOpacity>
              </View>
              {/* Attendance Calendar with Weekday Headers and Alignment */}
              <View>
                <Text style={[styles.sectionTitle, {marginBottom: 4}]}>{MONTHS.find(m => m.value === selectedMonth)?.label} {year}</Text>
                {/* Wrap the calendar grid in a bordered container */}
                <View style={{ borderWidth: 1.5, borderColor: '#FFECB3', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF3E0', borderBottomWidth: 1, borderBottomColor: '#FFE0B2' }}>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                      <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 14, color: '#FF9800', fontWeight: 'bold', paddingVertical: 4 }}>{d}</Text>
                    ))}
                  </View>
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {/* Empty cells before the 1st */}
                      {[...Array(firstDay.getDay())].map((_, i) => (
                        <View key={'empty'+i} style={{ width: `${100/7}%`, aspectRatio: 1, borderRightWidth: (i % 7 !== 6) ? 1 : 0, borderBottomWidth: 1, borderColor: '#FFE0B2' }} />
                      ))}
                      {[...Array(daysInMonth)].map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const status = attendanceData[dateStr];
                        const isToday = dateStr === new Date().toISOString().slice(0, 10);
                        return (
                          <TouchableOpacity
                            key={day}
                            style={{ width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: ((firstDay.getDay() + i) % 7 !== 6) ? 1 : 0, borderBottomWidth: 1, borderColor: '#FFE0B2' }}
                            onPress={() => setSelectedDay({ day, status, dateStr })}
                            activeOpacity={0.7}
                            accessibilityLabel={`Day ${day}, ${status || 'No data'}`}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 16, color: '#222', fontWeight: isToday ? 'bold' : 'normal' }}>{day}</Text>
                              {status && (
                                <Ionicons name={getAttendanceIcon(status)} size={14} color={getAttendanceColor(status)} style={{ marginLeft: 2 }} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Animated.View>
                </View>
              </View>
              {/* Enhanced Day Tooltip/Modal */}
              <Modal visible={!!selectedDay} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 28, minWidth: 280, alignItems: 'center', elevation: 6 }}>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#FF9800', marginBottom: 10 }}>
                      {selectedDay?.dateStr ? new Date(selectedDay.dateStr).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : `Day ${selectedDay?.day}`}
                    </Text>
                    <View style={{ alignItems: 'center', marginBottom: 18 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons
                          name={getAttendanceIcon(selectedDay?.status)}
                          size={24}
                          color={getAttendanceColor(selectedDay?.status)}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: getAttendanceColor(selectedDay?.status) }}>
                          {selectedDay?.status ? selectedDay.status.charAt(0).toUpperCase() + selectedDay.status.slice(1) : 'No data'}
                        </Text>
                      </View>
                      {selectedDay?.dateStr && attendanceDetails[selectedDay.dateStr] && (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                            Marked by: {attendanceDetails[selectedDay.dateStr].markedBy}
                          </Text>
                          {attendanceDetails[selectedDay.dateStr].createdAt && (
                            <Text style={{ fontSize: 12, color: '#888' }}>
                              Time: {new Date(attendanceDetails[selectedDay.dateStr].createdAt).toLocaleTimeString()}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setSelectedDay(null)} style={{ backgroundColor: '#FF9800', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 24 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, styles.present]} /><Text style={styles.legendLabel}>Present</Text>
                <View style={[styles.legendDot, styles.absent]} /><Text style={styles.legendLabel}>Absent</Text>
                <View style={[styles.legendDot, styles.late]} /><Text style={styles.legendLabel}>Late</Text>
                <View style={[styles.legendDot, styles.excused]} /><Text style={styles.legendLabel}>Excused</Text>
              </View>
              {/* Download Button */}
              <TouchableOpacity style={styles.downloadBtn} onPress={async () => {
                function getCalendarTableHtml(month, year, attendanceData) {
                  const firstDay = new Date(year, month, 1);
                  const lastDay = new Date(year, month + 1, 0);
                  const startWeekday = firstDay.getDay();
                  const daysInMonth = lastDay.getDate();
                  let html = '<table class="calendar-table"><tr>';
                  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
                    html += `<th>${d}</th>`;
                  });
                  html += '</tr><tr>';
                  for (let i = 0; i < startWeekday; i++) html += '<td></td>';
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const status = attendanceData[dateStr];
                    let bg = '';
                    if (status === 'present') bg = 'background:#4CAF50;color:#fff;';
                    else if (status === 'absent') bg = 'background:#F44336;color:#fff;';
                    else if (status === 'late') bg = 'background:#FF9800;color:#fff;';
                    else if (status === 'excused') bg = 'background:#9C27B0;color:#fff;';
                    html += `<td style="${bg}">${day}</td>`;
                    if ((startWeekday + day) % 7 === 0) html += '</tr><tr>';
                  }
                  html += '</tr></table>';
                  return html;
                }
                const calendarHtml = getCalendarTableHtml(month - 1, year, attendanceData);
                const barChartHtml = `
                  <div style="display:flex;justify-content:space-around;margin:18px 0 8px 0;">
                    <div style="text-align:center;"><div style="height:${stats.present*2}px;width:24px;background:#4CAF50;margin-bottom:4px;"></div><div style="font-size:13px;">Present</div></div>
                    <div style="text-align:center;"><div style="height:${stats.absent*2}px;width:24px;background:#F44336;margin-bottom:4px;"></div><div style="font-size:13px;">Absent</div></div>
                    <div style="text-align:center;"><div style="height:${stats.late*2}px;width:24px;background:#FF9800;margin-bottom:4px;"></div><div style="font-size:13px;">Late</div></div>
                    <div style="text-align:center;"><div style="height:${stats.excused*2}px;width:24px;background:#9C27B0;margin-bottom:4px;"></div><div style="font-size:13px;">Excused</div></div>
                  </div>
                `;
                const marksListHtml = `
                  <ul style='margin-top:8px;'>
                    ${marksData.map(m => `<li>${m.subject_name} (${m.exam_name}): <b>${m.marks_obtained}/${m.total_marks}</b></li>`).join('')}
                  </ul>
                `;
                const improvementGraphHtml = `
                  <div style='display:flex;align-items:flex-end;height:120px;padding:8px 0;margin-bottom:12px;'>
                    ${improvementData.map(a => `
                      <div style='width:48px;align-items:center;margin:0 8px;text-align:center;'>
                        <div style='font-size:13px;color:#222;font-weight:bold;margin-bottom:4px;'>${a.avg}%</div>
                        <div style='height:${a.avg}px;width:32px;background:${a.color};border-radius:8px;margin:0 auto;'></div>
                        <div style='font-size:13px;color:#888;margin-top:6px;'>${a.type}</div>
                      </div>
                    `).join('')}
                  </div>
                `;
                const htmlContent = `
                  <html>
                    <head>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .school-header { display: flex; align-items: center; margin-bottom: 16px; }
                        .school-logo { width: 60px; height: 60px; border-radius: 8px; margin-right: 16px; background: #eee; display: inline-block; }
                        .student-info { display: flex; align-items: center; margin-bottom: 16px; }
                        .profile-pic { width: 60px; height: 60px; border-radius: 30px; background: #eee; margin-right: 16px; display: flex; align-items: center; justify-content: center; }
                        .profile-placeholder { width: 60px; height: 60px; border-radius: 30px; background: #ccc; }
                        .student-details { font-size: 15px; color: #333; }
                        .student-name { font-size: 20px; font-weight: bold; color: #1976d2; margin-bottom: 2px; }
                        .calendar-table { border-collapse: collapse; width: 100%; margin-top: 16px; }
                        .calendar-table th, .calendar-table td { width: 40px; height: 40px; text-align: center; border: 1px solid #ddd; }
                        .calendar-table th { background: #f5f5f5; color: #1976d2; }
                      </style>
                    </head>
                    <body>
                      <div class="school-header">
                        <div class="school-logo"></div>
                        <div>
                          <h1 style="margin:0;">${schoolInfo.name}</h1>
                          <p style="margin:0;">${schoolInfo.address}</p>
                        </div>
                      </div>
                      <div class="student-info">
                        <div class="profile-pic"><div class="profile-placeholder"></div></div>
                        <div class="student-details">
                          <div class="student-name">${studentInfo?.name}</div>
                          <div>Class: ${studentInfo?.class} &nbsp; Roll No: ${studentInfo?.rollNo}</div>
                          <div>Section: ${studentInfo?.section}</div>
                        </div>
                      </div>
                      <h2 style="color:#1976d2;">Attendance Calendar</h2>
                      ${calendarHtml}
                      <h2 style="color:#1976d2;">Attendance Stats</h2>
                      <div style="font-size:16px;margin-bottom:8px;">Present: <b>${stats.present}</b> &nbsp; Absent: <b>${stats.absent}</b> &nbsp; Late: <b>${stats.late}</b> &nbsp; Excused: <b>${stats.excused}</b> &nbsp; Attendance %: <b>${percentage}%</b></div>
                      ${barChartHtml}
                      <h2 style="color:#1976d2;">Marks Summary</h2>
                      ${marksListHtml}
                      <h2 style="color:#1976d2;">Improvement Graph</h2>
                      ${improvementGraphHtml}
                    </body>
                  </html>
                `;
                try {
                  const { uri } = await Print.printToFileAsync({ html: htmlContent });
                  await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Share Attendance Report',
                  });
                } catch (error) {
                  Alert.alert('Failed to generate PDF', error.message);
                }
              }}>
                <Ionicons name="download" size={18} color="#fff" />
                <Text style={styles.downloadBtnText}>Download Attendance</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Upcoming Exams Section */}
              {upcomingExams.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Upcoming Exams</Text>
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 18, elevation: 1 }}>
                    {upcomingExams.map((exam, index) => (
                      <View key={exam.id} style={{
                        padding: 16,
                        borderBottomWidth: index < upcomingExams.length - 1 ? 1 : 0,
                        borderBottomColor: '#f0f0f0'
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <Ionicons name="school" size={20} color="#1976d2" style={{ marginRight: 8 }} />
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 }}>{exam.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons name="calendar" size={16} color="#666" style={{ marginRight: 8 }} />
                          <Text style={{ fontSize: 14, color: '#666' }}>
                            {new Date(exam.start_date).toLocaleDateString()}
                            {exam.end_date !== exam.start_date && ` - ${new Date(exam.end_date).toLocaleDateString()}`}
                          </Text>
                        </View>
                        {exam.remarks && (
                          <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{exam.remarks}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Marks Summary</Text>
              {/* Marks Table by Exam Type */}
              {marksByExam.map(({ type, marks }) => (
                <View key={type} style={{ marginBottom: 18 }}>
                  <Text style={styles.examTypeHeader}>{type}</Text>
                  <View style={styles.marksTable}>
                    <View style={styles.marksHeaderRow}>
                      <Text style={styles.marksHeader}>Subject</Text>
                      <Text style={styles.marksHeader}>Score</Text>
                      <Text style={styles.marksHeader}>Max</Text>
                      <Text style={styles.marksHeader}>%</Text>
                      <Text style={styles.marksHeader}>Grade</Text>
                    </View>
                    {marks.map((m, i) => {
                      const percentage = Math.round((m.marks_obtained / (m.total_marks || 100)) * 100);
                      const grade = m.grade || (
                        percentage >= 90 ? 'A+' :
                        percentage >= 80 ? 'A' :
                        percentage >= 70 ? 'B+' :
                        percentage >= 60 ? 'B' :
                        percentage >= 50 ? 'C' :
                        percentage >= 40 ? 'D' : 'F'
                      );
                      return (
                        <View key={i} style={styles.marksRow}>
                          <Text style={styles.marksCell}>{m.subject_name}</Text>
                          <Text style={styles.marksCell}>{m.marks_obtained}</Text>
                          <Text style={styles.marksCell}>{m.total_marks}</Text>
                          <Text style={[styles.marksPercentage, {
                            color: percentage >= 60 ? '#4CAF50' : percentage >= 40 ? '#FF9800' : '#F44336'
                          }]}>{percentage}%</Text>
                          <Text style={[styles.marksCell, {
                            fontWeight: 'bold',
                            color: percentage >= 60 ? '#4CAF50' : percentage >= 40 ? '#FF9800' : '#F44336'
                          }]}>{grade}</Text>
                          {m.classAverage && (
                            <Text style={[styles.marksCell, { fontSize: 12, color: '#666' }]}>
                              Class Avg: {m.classAverage}%
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                  {/* Average for this exam type */}
                  <View style={styles.marksAvgRow}>
                    <Text style={{ color: '#888', fontWeight: 'bold' }}>Average: </Text>
                    <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>{avgByExam.find(a => a.type === type)?.avg || 0}%</Text>
                  </View>
                </View>
              ))}
              {/* Improvement Graph (bar chart) */}
              <Text style={styles.sectionTitle}>Improvement Graph</Text>
              <LineChart
                data={{
                  labels: improvementData.map(a => a.type),
                  datasets: [{
                    data: improvementData.map(a => a.avg),
                    color: () => '#1976d2',
                    strokeWidth: 3,
                  }],
                }}
                width={340}
                height={180}
                yAxisSuffix="%"
                chartConfig={{
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#fff',
                    fill: '#1976d2',
                  },
                  propsForBackgroundLines: {
                    stroke: '#E3F2FD',
                  },
                  fillShadowGradient: '#E3F2FD',
                  fillShadowGradientOpacity: 1,
                }}
                bezier
                style={{ borderRadius: 12, marginBottom: 18, marginTop: 4 }}
              />
              {/* Download Button */}
              <TouchableOpacity style={styles.downloadBtn} onPress={async () => {
                const subjectColors = {
                  Math: '#1976d2',
                  Science: '#388e3c',
                  English: '#fbc02d',
                  Other: '#8e24aa',
                };
                const exams = Array.from(new Set(marksData.map(m => m.exam_name)));
                const subjects = Array.from(new Set(marksData.map(m => m.subject_name)));
                const groupedBarChartHtml = `
                  <div style='margin:18px 0 8px 0;'>
                    <div style='display:flex;align-items:flex-end;height:100px;'>
                      ${exams.map(exam => `
                        <div style='flex:1;display:flex;flex-direction:column;align-items:center;margin:0 8px;'>
                          <div style='display:flex;align-items:flex-end;height:100px;'>
                            ${subjects.map(subj => {
                              const mark = marksData.find(m => m.exam_name === exam && m.subject_name === subj);
                              const color = subjectColors[subj] || subjectColors.Other;
                              return mark ? `<div style='width:18px;height:${mark ? (mark.marks_obtained/mark.total_marks)*90 : 0}px;background:${color};border-radius:6px 6px 0 0;margin:0 2px;'></div>` : '';
                            }).join('')}
                          </div>
                          <div style='font-size:12px;color:#888;margin-top:4px;'>${exam}</div>
                        </div>
                      `).join('')}
                    </div>
                    <div style='display:flex;justify-content:center;margin-top:8px;'>
                      ${subjects.map(subj => `<div style='display:flex;align-items:center;margin:0 10px;'><div style='width:14px;height:14px;background:${subjectColors[subj] || subjectColors.Other};border-radius:3px;margin-right:4px;'></div><span style='font-size:13px;color:#333;'>${subj}</span></div>`).join('')}
                    </div>
                  </div>
                `;
                const maxY = 100;
                const chartWidth = 320;
                const chartHeight = 120;
                const n = improvementData.length;
                const xStep = n > 1 ? (chartWidth - 40) / (n - 1) : 0;
                const points = improvementData.map((a, i) => {
                  const x = 20 + i * xStep;
                  const y = chartHeight - 20 - (a.avg / maxY) * (chartHeight - 40);
                  return { x, y, label: a.type, value: a.avg };
                });
                const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
                const improvementGraphHtml = n > 1 ? `
                  <svg width='${chartWidth}' height='${chartHeight}' viewBox='0 0 ${chartWidth} ${chartHeight}' style='display:block;border:1px solid #E3F2FD;background:#fff;'>
                    <polyline points='${polylinePoints}' fill='none' stroke='#1976d2' stroke-width='3' />
                    ${points.map(p => `<circle cx='${p.x}' cy='${p.y}' r='6' fill='#1976d2' stroke='#fff' stroke-width='2' />`).join('')}
                    ${points.map(p => `<text x='${p.x}' y='${chartHeight-4}' font-size='13' fill='#888' text-anchor='middle'>${p.label}</text>`).join('')}
                    ${points.map(p => `<text x='${p.x}' y='${p.y-12}' font-size='13' fill='#1976d2' text-anchor='middle' font-weight='bold'>${p.value}%</text>`).join('')}
                  </svg>
                ` : `<div style='color:#888;font-size:14px;margin:18px 0;'>Not enough data for improvement graph.</div>`;
                const htmlContent = `
                  <html>
                    <head>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .school-header { display: flex; align-items: center; margin-bottom: 16px; }
                        .school-logo { width: 60px; height: 60px; border-radius: 8px; margin-right: 16px; background: #eee; display: inline-block; }
                        .student-info { display: flex; align-items: center; margin-bottom: 16px; }
                        .profile-pic { width: 60px; height: 60px; border-radius: 30px; background: #eee; margin-right: 16px; display: flex; align-items: center; justify-content: center; }
                        .profile-placeholder { width: 60px; height: 60px; border-radius: 30px; background: #ccc; }
                        .student-details { font-size: 15px; color: #333; }
                        .student-name { font-size: 20px; font-weight: bold; color: #1976d2; margin-bottom: 2px; }
                        .calendar-table { border-collapse: collapse; width: 100%; margin-top: 16px; }
                        .calendar-table th, .calendar-table td { width: 40px; height: 40px; text-align: center; border: 1px solid #ddd; }
                        .calendar-table th { background: #f5f5f5; color: #1976d2; }
                      </style>
                    </head>
                    <body>
                      <div class="school-header">
                        <div class="school-logo"></div>
                        <div>
                          <h1 style="margin:0;">${schoolInfo.name}</h1>
                          <p style="margin:0;">${schoolInfo.address}</p>
                        </div>
                      </div>
                      <div class="student-info">
                        <div class="profile-pic"><div class="profile-placeholder"></div></div>
                        <div class="student-details">
                          <div class="student-name">${studentInfo?.name}</div>
                          <div>Class: ${studentInfo?.class} &nbsp; Roll No: ${studentInfo?.rollNo}</div>
                          <div>Section: ${studentInfo?.section}</div>
                        </div>
                      </div>
                      <h2 style="color:#1976d2;">Attendance Calendar</h2>
                      ${calendarHtml}
                      <h2 style="color:#1976d2;">Attendance Stats</h2>
                      <div style="font-size:16px;margin-bottom:8px;">Present: <b>${stats.present}</b> &nbsp; Absent: <b>${stats.absent}</b> &nbsp; Late: <b>${stats.late}</b> &nbsp; Excused: <b>${stats.excused}</b> &nbsp; Attendance %: <b>${percentage}%</b></div>
                      ${barChartHtml}
                      <h2 style="color:#1976d2;">Marks Summary</h2>
                      ${marksListHtml}
                      <h2 style="color:#1976d2;">Improvement Graph</h2>
                      ${improvementGraphHtml}
                      <h2 style="color:#1976d2;">Subject-wise Performance</h2>
                      ${groupedBarChartHtml}
                    </body>
                  </html>
                `;
                try {
                  const { uri } = await Print.printToFileAsync({ html: htmlContent });
                  await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Share Marks Report',
                  });
                } catch (error) {
                  Alert.alert('Failed to generate PDF', error.message);
                }
              }}>
                <Ionicons name="download" size={18} color="#fff" />
                <Text style={styles.downloadBtnText}>Download Marks</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerHighlight: { backgroundColor: '#fff7e6', paddingTop: 18, paddingBottom: 8, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, shadowColor: '#FF9800', shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', elevation: 2 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  activeTab: { backgroundColor: '#FF9800', borderRadius: 16 },
  tabText: { fontSize: 17, color: '#FF9800', fontWeight: 'bold', letterSpacing: 0.5 },
  activeTabText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  tabUnderline: { position: 'absolute', bottom: 0, left: 20, right: 20, height: 4, borderRadius: 2, backgroundColor: '#FFD699' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', marginVertical: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  calendarDay: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#fff', margin: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  dayText: { fontSize: 15, color: '#333' },
  present: { backgroundColor: '#4CAF50' },
  absent: { backgroundColor: '#F44336' },
  late: { backgroundColor: '#FF9800' },
  excused: { backgroundColor: '#9C27B0' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' },
  legendDot: { width: 16, height: 16, borderRadius: 4, marginHorizontal: 4 },
  legendLabel: { fontSize: 13, color: '#555', marginRight: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' },
  statCard: { borderWidth: 0, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 2, elevation: 2, shadowOpacity: 0.10, shadowRadius: 6, backgroundColor: '#fff' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#1976d2' },
  statLabel: { fontSize: 12, color: '#888' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1976d2', borderRadius: 8, paddingVertical: 12, marginTop: 18 },
  downloadBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  marksTable: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 18, elevation: 1 },
  marksHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', padding: 8 },
  marksHeader: { flex: 1, fontWeight: 'bold', color: '#1976d2', fontSize: 15, textAlign: 'center' },
  marksRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  marksCell: { flex: 1, fontSize: 14, color: '#333', textAlign: 'center' },
  analyticsBox: { backgroundColor: '#fff', borderRadius: 10, padding: 24, marginBottom: 18, elevation: 1 },
  monthSelectorRow: { flexDirection: 'row', marginBottom: 10 },
  monthBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
  monthBtnActive: { backgroundColor: '#1976d2' },
  monthBtnText: { color: '#1976d2', fontWeight: 'bold' },
  monthBtnTextActive: { color: '#fff' },
  calendarHeaderRow: { flexDirection: 'row', marginBottom: 2, marginTop: 4 },
  calendarHeaderText: { flex: 1, textAlign: 'center', color: '#888', fontWeight: 'bold' },
  todayDay: { borderWidth: 2, borderColor: '#1976d2' },
  monthSelectorShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12 },
  chevronBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 2 },
  statsScrollRow: { marginBottom: 12 },
  statsRowImproved: { flexDirection: 'row', alignItems: 'center' },
  statCardImproved: { width: 110, height: 120, borderRadius: 16, marginRight: 14, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, padding: 10 },
  statNumImproved: { fontSize: 26, fontWeight: 'bold', color: '#1976d2', marginTop: 4 },
  statLabelImproved: { fontSize: 13, color: '#555', marginTop: 2, fontWeight: '600' },
  statIcon: { marginBottom: 2 },
  monthCarouselRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  monthCarouselLabelBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthCarouselLabel: { fontSize: 18, fontWeight: 'bold', color: '#FF9800', letterSpacing: 0.5 },
  monthCarouselRowBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: '#fff3e0', borderRadius: 32, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#FF9800', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  chevronBtnBox: { padding: 6, borderRadius: 20, backgroundColor: 'transparent' },
  monthCarouselLabelBoxed: { fontSize: 18, fontWeight: 'bold', color: '#FF9800', letterSpacing: 0.5, marginHorizontal: 16 },
  statIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statsRowImprovedNoScroll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' },
  examTypeHeader: { fontSize: 16, fontWeight: 'bold', color: '#FF9800', marginBottom: 4, marginTop: 8 },
  marksPercentage: { flex: 1, fontSize: 14, color: '#1976d2', textAlign: 'center', fontWeight: 'bold' },
  marksAvgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, marginBottom: 8 },
  improvementGraphBar: { width: 32, borderRadius: 8, marginHorizontal: 8 },
  improvementGraphScroll: { marginBottom: 18 },
  improvementGraphBarLabel: { fontSize: 13, color: '#222', fontWeight: 'bold', marginBottom: 4 },
  improvementGraphBarValue: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },
  calendarCard: { backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 12, elevation: 2, shadowColor: '#FF9800', shadowOpacity: 0.08, shadowRadius: 8 },
  calendarDayToday: { borderWidth: 2.5, borderColor: '#FF9800', backgroundColor: '#fffbe7' },
  calendarDayText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  noDataDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#bbb', marginTop: 2 },
  attendanceIconCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2, alignSelf: 'center' },
  statNumber: { fontSize: 26, fontWeight: 'bold', color: '#1976d2', marginTop: 4 },
});