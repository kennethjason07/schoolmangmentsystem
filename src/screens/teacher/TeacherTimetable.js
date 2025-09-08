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
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';

const TeacherTimetable = ({ navigation }) => {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  
  // 🔍 DEBUG: Log tenant info on component load
  console.log('🕰️ TeacherTimetable - Tenant Debug:', {
    tenantId,
    userId: user?.id
  });
  const [timetables, setTimetables] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Monday');

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Set selectedDay based on current date
  useEffect(() => {
    const currentDay = getDayNameFromDate(new Date());
    if (daysOfWeek.includes(currentDay)) {
      setSelectedDay(currentDay);
    }
  }, []);

  // 🚨 CRITICAL: Validate tenant_id before proceeding
  useEffect(() => {
    if (!tenantId) {
      console.warn('⚠️ TeacherTimetable: No tenant_id available from context');
      Alert.alert('Tenant Error', 'No tenant context available. Please try logging out and back in.');
      setLoading(false);
      return;
    }
    
    console.log('✅ TeacherTimetable: Using tenant_id:', tenantId);
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Validate tenant access before proceeding
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed:', tenantValidation.error);
        Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
        return;
      }
      
      console.log('🚀 TeacherTimetable.loadData: Starting with tenant_id:', tenantId, 'user:', user.id);

      // First get teacher info from users table with tenant-aware query
      console.log('🔍 Loading teacher info for user:', user.id, 'tenant:', tenantId);
      const tenantUserQuery = createTenantQuery(supabase.from('users'), tenantId);
      const { data: userInfo, error: userError } = await tenantUserQuery
        .select('linked_teacher_id, tenant_id')
        .eq('id', user.id)
        .single();

      if (userError || !userInfo?.linked_teacher_id) {
        console.error('❌ Error fetching user info for tenant:', tenantId, userError);
        Alert.alert('Error', 'Failed to load teacher information for this tenant. Please contact admin.');
        return;
      }
      
      // Validate user info belongs to correct tenant
      const userValidation = await validateDataTenancy([{ 
        id: userInfo.linked_teacher_id, 
        tenant_id: userInfo.tenant_id 
      }], tenantId);
      
      if (!userValidation.isValid) {
        console.error('❌ User data validation failed:', userValidation.error);
        Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
        return;
      }

      const teacher = { id: userInfo.linked_teacher_id };
      console.log('👨‍🏫 Found teacher ID:', teacher.id, 'for tenant:', tenantId);
      setTeacherInfo(teacher);

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Load subjects that this teacher teaches with their classes using tenant-aware query
      const tenantSubjectQuery = createTenantQuery(supabase.from('teacher_subjects'), tenantId);
      const { data: teacherSubjects, error: subjectError } = await tenantSubjectQuery
        .select(`
          subject_id,
          tenant_id,
          subjects(
            id, 
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('teacher_id', teacher.id);

      if (!subjectError && teacherSubjects) {
        // Validate fetched subjects belong to correct tenant
        const subjectValidation = await validateDataTenancy(
          teacherSubjects?.map(ts => ({ 
            id: ts.subject_id, 
            tenant_id: ts.tenant_id 
          })) || [],
          tenantId
        );
        
        if (!subjectValidation.isValid) {
          console.error('❌ Subject data validation failed:', subjectValidation.error);
          Alert.alert('Data Error', TENANT_ERROR_MESSAGES.INVALID_TENANT_DATA);
          return;
        }
        
        // Extract subjects
        const subjectList = teacherSubjects.map(ts => ts.subjects).filter(Boolean);
        setSubjects(subjectList);

        // Extract unique classes from the subjects this teacher teaches
        const uniqueClasses = [];
        const classIds = new Set();
        
        teacherSubjects.forEach(ts => {
          if (ts.subjects && ts.subjects.classes && !classIds.has(ts.subjects.classes.id)) {
            classIds.add(ts.subjects.classes.id);
            uniqueClasses.push(ts.subjects.classes);
          }
        });
        
        setClasses(uniqueClasses);
        console.log('🔍 TEACHER DEBUG - Classes found:', uniqueClasses.map(c => `${c.class_name} ${c.section}`));
        console.log('🔍 TEACHER DEBUG - Subjects found:', subjectList.map(s => s.name));
      } else {
        console.error('Error fetching teacher subjects:', subjectError);
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
      // Validate tenant access before fetching timetable data
      const tenantValidation = await validateTenantAccess(user.id, tenantId);
      if (!tenantValidation.isValid) {
        console.error('❌ Tenant validation failed for timetable:', tenantValidation.error);
        return; // Silent return for better UX
      }
      
      console.log('🔍 Loading timetable data for teacher:', teacherId, 'tenant:', tenantId, 'year:', academicYear);
      
      // Fetch timetable entries for this teacher with tenant-aware query
      const tenantTimetableQuery = createTenantQuery(supabase.from('timetable_entries'), tenantId);
      const { data: timetableData, error: timetableError } = await tenantTimetableQuery
        .select(`
          *,
          classes(class_name, section),
          subjects(name),
          tenant_id
        `)
        .eq('teacher_id', teacherId)
        .eq('academic_year', academicYear)
        .order('day_of_week')
        .order('period_number');
      
      console.log('📅 Timetable entries found:', timetableData?.length, 'for teacher:', teacherId);

      if (timetableError) {
        console.error('Error fetching timetable:', timetableError);
        return;
      }
      
      // Validate fetched timetable data belongs to correct tenant
      const timetableValidation = await validateDataTenancy(
        timetableData?.map(entry => ({ 
          id: entry.id, 
          tenant_id: entry.tenant_id 
        })) || [],
        tenantId
      );
      
      if (!timetableValidation.isValid) {
        console.error('❌ Timetable data validation failed:', timetableValidation.error);
        return; // Silent return for better UX
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
    const dayName = dayNames[date.getDay()];
    // If it's Sunday, default to Monday since school timetables don't include Sunday
    return dayName === 'Sunday' ? 'Monday' : dayName;
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
        style={styles.timetableContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        {/* Class Selector */}
        <View style={styles.classSelector}>
          <View style={styles.selectorHeader}>
            <Ionicons name="school" size={20} color="#2196F3" />
            <Text style={styles.selectorLabel}>My Classes</Text>
          </View>
          {classes.length > 1 ? (
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedClass || classes[0]?.id}
                style={styles.classPicker}
                onValueChange={(classId) => setSelectedClass(classId)}
              >
                <Picker.Item label="All Classes" value={null} />
                {classes.map(c => (
                  <Picker.Item 
                    key={c.id} 
                    label={`${c.class_name} - ${c.section}`} 
                    value={c.id} 
                  />
                ))}
              </Picker>
              <Ionicons name="chevron-down" size={20} color="#666" style={styles.pickerIcon} />
            </View>
          ) : (
            <Text style={styles.singleClassText}>
              {classes[0]?.class_name} - {classes[0]?.section}
            </Text>
          )}
        </View>

        {/* Day Selector Tabs */}
        <View style={styles.dayTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.dayTabs}
          contentContainerStyle={{ paddingRight: 60 }}
        >
            {daysOfWeek.map((day, index) => {
              const isSelected = selectedDay === day;
              // Count periods for this day across selected classes
              let totalPeriods = 0;
              if (selectedClass) {
                totalPeriods = timetables[selectedClass]?.[day]?.length || 0;
              } else {
                classes.forEach(classInfo => {
                  totalPeriods += timetables[classInfo.id]?.[day]?.length || 0;
                });
              }
              
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayTab, isSelected && styles.selectedDayTab]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text style={[styles.dayTabText, isSelected && styles.selectedDayTabText]}>
                    {day.substring(0, 3)}
                  </Text>
                  {totalPeriods > 0 && (
                    <View style={styles.periodIndicator}>
                      <Text style={styles.periodCount}>{totalPeriods}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Timetable Content */}
        <ScrollView style={styles.periodsList} showsVerticalScrollIndicator={false}>
          <View style={styles.periodsContainer}>
            <View style={styles.periodsHeader}>
              <Text style={styles.periodsTitle}>Schedule for {selectedDay}</Text>
            </View>
            
            {/* Show periods for selected class or all classes */}
            {selectedClass ? (
              // Show single class
              (() => {
                const classInfo = classes.find(c => c.id === selectedClass);
                const dayTT = timetables[selectedClass]?.[selectedDay] ? [...timetables[selectedClass][selectedDay]] : [];
                dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
                
                return (
                  <View style={styles.classBlock}>
                    <Text style={styles.classTitle}>
                      {classInfo?.class_name} {classInfo?.section}
                    </Text>
                    {dayTT.length === 0 && (
                      <Text style={styles.noPeriods}>
                        No classes scheduled for {selectedDay}.
                      </Text>
                    )}
                    {dayTT.map(period => {
                      const duration = getDuration(period.startTime, period.endTime);
                      return (
                        <View key={period.id} style={styles.periodCard}>
                          <View style={styles.periodHeader}>
                            <Text style={styles.periodTitle}>{period.subject}</Text>
                            <Text style={styles.periodNumber}>Period {period.periodNumber}</Text>
                          </View>
                          <Text style={styles.periodTime}>
                            {formatTime(period.startTime)} - {formatTime(period.endTime)} ({duration} min)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()
            ) : (
              // Show all classes
              classes.map(classInfo => {
                const dayTT = timetables[classInfo.id]?.[selectedDay] ? [...timetables[classInfo.id][selectedDay]] : [];
                dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
                
                return (
                  <View key={classInfo.id} style={styles.classBlock}>
                    <Text style={styles.classTitle}>
                      {classInfo.class_name} {classInfo.section}
                    </Text>
                    {dayTT.length === 0 && (
                      <Text style={styles.noPeriods}>
                        No classes scheduled for {selectedDay}.
                      </Text>
                    )}
                    {dayTT.map(period => {
                      const duration = getDuration(period.startTime, period.endTime);
                      return (
                        <View key={period.id} style={styles.periodCard}>
                          <View style={styles.periodHeader}>
                            <Text style={styles.periodTitle}>{period.subject}</Text>
                            <Text style={styles.periodNumber}>Period {period.periodNumber}</Text>
                          </View>
                          <Text style={styles.periodTime}>
                            {formatTime(period.startTime)} - {formatTime(period.endTime)} ({duration} min)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </ScrollView>
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  timetableContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  classSelector: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginLeft: 8,
  },
  pickerWrapper: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  classPicker: {
    height: 50,
    backgroundColor: 'transparent',
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
    pointerEvents: 'none',
  },
  singleClassText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    textAlign: 'center',
  },
  dayTabsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    paddingVertical: 8,
  },
  dayTabs: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    contentContainerStyle: {
      paddingRight: 60,
    },
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
    minWidth: 72,
    position: 'relative',
  },
  selectedDayTab: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  selectedDayTabText: {
    color: '#fff',
  },
  periodIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#28a745',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  periodsList: {
    flex: 1,
    paddingTop: 16,
  },
  periodsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  periodsHeader: {
    marginBottom: 16,
  },
  periodsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
  },
  classBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 12,
  },
  noPeriods: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  periodCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  periodNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#28a745',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  periodTime: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
});

export default TeacherTimetable;
