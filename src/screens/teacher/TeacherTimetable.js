import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';

const TeacherTimetable = ({ navigation }) => {
  const { user } = useAuth();
  const [timetables, setTimetables] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // First get teacher info from users table
      const { data: userInfo, error: userError } = await supabase
        .from('users')
        .select('linked_teacher_id')
        .eq('id', user.id)
        .single();

      if (userError || !userInfo?.linked_teacher_id) {
        console.error('Error fetching user info:', userError);
        Alert.alert('Error', 'Failed to load teacher information. Please contact admin.');
        return;
      }

      const teacher = { id: userInfo.linked_teacher_id };
      setTeacherInfo(teacher);

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Load classes that this teacher teaches
      const { data: teacherClasses, error: classError } = await supabase
        .from('timetable_entries')
        .select(`
          class_id,
          classes(id, class_name, section)
        `)
        .eq('teacher_id', teacher.id)
        .eq('academic_year', academicYear);

      if (!classError && teacherClasses) {
        const uniqueClasses = [];
        const classIds = new Set();
        teacherClasses.forEach(entry => {
          if (entry.classes && !classIds.has(entry.classes.id)) {
            classIds.add(entry.classes.id);
            uniqueClasses.push(entry.classes);
          }
        });
        setClasses(uniqueClasses);
      }

      // Load subjects that this teacher teaches
      const { data: teacherSubjects, error: subjectError } = await supabase
        .from('teacher_subjects')
        .select(`
          subject_id,
          subjects(id, name)
        `)
        .eq('teacher_id', teacher.id);

      if (!subjectError && teacherSubjects) {
        const subjectList = teacherSubjects.map(ts => ts.subjects).filter(Boolean);
        setSubjects(subjectList);
      }

      // Load timetable data for all classes this teacher teaches
      await loadTimetableData(teacher.id, academicYear);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTimetableData = async (teacherId, academicYear) => {
    try {
      // Fetch timetable entries for this teacher
      const { data: timetableData, error: timetableError } = await supabase
        .from('timetable_entries')
        .select(`
          *,
          classes(class_name, section),
          subjects(name)
        `)
        .eq('teacher_id', teacherId)
        .eq('academic_year', academicYear)
        .order('day_of_week')
        .order('period_number');

      if (timetableError) {
        console.error('Error fetching timetable:', timetableError);
        return;
      }

      // Organize timetable by class, then by day
      const organizedTimetable = {};

      timetableData?.forEach(entry => {
        const classId = entry.class_id;
        const dayName = entry.day_of_week;

        if (!organizedTimetable[classId]) {
          organizedTimetable[classId] = {};
        }
        if (!organizedTimetable[classId][dayName]) {
          organizedTimetable[classId][dayName] = [];
        }

        organizedTimetable[classId][dayName].push({
          id: entry.id,
          subject: entry.subjects?.name || 'Unknown Subject',
          startTime: entry.start_time,
          endTime: entry.end_time,
          periodNumber: entry.period_number,
          subjectId: entry.subject_id,
        });
      });

      setTimetables(organizedTimetable);
    } catch (error) {
      console.error('Error loading timetable data:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getDayNameFromDate = (date) => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };



  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="My Timetable" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading your timetable...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="My Timetable" showBack={true} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>My Timetable</Text>

        {/* Date Navigation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd; })}>
            <Text style={{ fontSize: 28, marginHorizontal: 12 }}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: 'bold', minWidth: 120, textAlign: 'center' }}>
            {format(selectedDate, 'dd MMM yyyy')}
          </Text>
          <TouchableOpacity onPress={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd; })}>
            <Text style={{ fontSize: 28, marginHorizontal: 12 }}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Show timetable for all classes this teacher teaches */}
        {classes.map(classInfo => {
          const dayName = getDayNameFromDate(selectedDate);
          const dayTT = timetables[classInfo.id]?.[dayName] ? [...timetables[classInfo.id][dayName]] : [];
          dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <View key={classInfo.id} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>
                {classInfo.class_name} {classInfo.section} - {dayName}
              </Text>
              {dayTT.length === 0 && (
                <Text style={{ color: '#888', marginVertical: 8 }}>
                  No classes scheduled for this day.
                </Text>
              )}
              {dayTT.map(period => {
                const duration = getDuration(period.startTime, period.endTime);
                return (
                  <View key={period.id} style={styles.periodCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.periodTitle}>
                          {period.subject}
                        </Text>
                        <Text style={styles.periodTime}>
                          {formatTime(period.startTime)} - {formatTime(period.endTime)} ({duration} min)
                        </Text>
                        <Text style={styles.periodTeacher}>
                          Period {period.periodNumber}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayBlock: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
  },
  periodCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  periodTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  periodTeacher: {
    fontSize: 12,
    color: '#888',
  },

});

export default TeacherTimetable;
