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
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
// 🚀 ENHANCED TENANT SYSTEM IMPORTS
import { 
  useTenantAccess, 
  tenantDatabase, 
  createTenantQuery,
  getCachedTenantId 
} from '../../utils/tenantHelpers';

const TeacherTimetable = ({ navigation }) => {
  const { user } = useAuth();
  // 🚀 ENHANCED TENANT SYSTEM - Use reliable cached tenant access
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // 🚀 ENHANCED TENANT SYSTEM - Tenant validation helper
  const validateTenantAccess = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    return { valid: true, tenantId };
  };
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

  // 🚀 ENHANCED: Load data when tenant is ready
  useEffect(() => {
    if (isReady && user?.id) {
      console.log('🚀 Enhanced: Tenant and user ready, loading timetable data...');
      loadData();
    }
  }, [isReady, user?.id]);

  // 🚀 ENHANCED: Fetch all timetable data with enhanced tenant system
  const loadData = async () => {
    try {
      setLoading(true);
      
      // 🚀 ENHANCED: Validate tenant access using new helper
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Enhanced tenant validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        setLoading(false);
        return;
      }
      
      const tenantId = validation.tenantId;
      console.log('🚀 Enhanced tenant system: Using cached tenant ID:', tenantId);
      
      // 🚀 ENHANCED: Get teacher info using dbHelpers with enhanced validation
      console.log('🔍 Getting teacher info using dbHelpers...');
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);
      
      if (teacherError || !teacherData) {
        throw new Error('Teacher profile not found. Please contact administrator.');
      }
      
      // 🚀 ENHANCED: Teacher data validation (enhanced tenant system handles automatic validation)
      if (teacherData && teacherData.tenant_id && teacherData.tenant_id !== tenantId) {
        console.error('❌ Teacher data validation failed: tenant mismatch');
        Alert.alert('Data Error', 'Teacher data belongs to different tenant');
        setLoading(false);
        return;
      }
      
      const teacher = teacherData;
      setTeacherInfo(teacher);
      console.log('✅ Enhanced: Teacher lookup successful:', teacher.name);
      
      // 🚀 ENHANCED: Get assigned subjects and classes using enhanced tenant system
      console.log('📚 Loading teacher subjects and classes...');
      const { data: assignedSubjects, error: subjectsError } = await tenantDatabase.read(
        TABLES.TEACHER_SUBJECTS,
        { teacher_id: teacher.id },
        `
          *,
          subjects(
            id,
            name,
            class_id,
            classes(class_name, id, section)
          )
        `
      );
      
      if (subjectsError) {
        console.error('❌ Error fetching assigned subjects:', subjectsError);
        throw subjectsError;
      }
      
      // Process subjects and classes
      const subjectList = assignedSubjects.map(assignment => assignment.subjects).filter(Boolean);
      setSubjects(subjectList);
      
      // Extract unique classes
      const classMap = new Map();
      assignedSubjects.forEach(assignment => {
        if (assignment.subjects?.classes) {
          const classData = assignment.subjects.classes;
          const uniqueKey = `${classData.class_name}-${classData.section}`;
          if (!classMap.has(uniqueKey)) {
            classMap.set(uniqueKey, classData);
          }
        }
      });
      
      const uniqueClasses = Array.from(classMap.values());
      setClasses(uniqueClasses);
      
      console.log('📊 Found', subjectList.length, 'subjects and', uniqueClasses.length, 'classes');
      console.log('🔍 Classes:', uniqueClasses.map(c => `${c.class_name} ${c.section}`));
      console.log('🔍 Subjects:', subjectList.map(s => s.name));
      
      // 🚀 ENHANCED: Load timetable data using enhanced tenant system
      await loadTimetableData(teacher.id, tenantId);
      
    } catch (error) {
      console.error('❌ Error in loadData:', error);
      Alert.alert('Error', error.message || 'Failed to load teacher timetable data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🚀 ENHANCED: Load timetable data with enhanced tenant system
  const loadTimetableData = async (teacherId, tenantId) => {
    try {
      console.log('🗺 Enhanced: Loading timetable data for teacher:', teacherId, 'tenant:', tenantId);
      
      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      
      console.log('🎓 Using academic year:', academicYear);
      
      // 🚀 ENHANCED: Fetch timetable entries using createTenantQuery for complex operations
      const { data: timetableData, error: timetableError } = await createTenantQuery(
        tenantId,
        TABLES.TIMETABLE,
        `
          *,
          classes(class_name, section),
          subjects(name)
        `,
        { 
          teacher_id: teacherId,
          academic_year: academicYear 
        }
      )
        .order('day_of_week')
        .order('period_number');
      
      console.log('📅 Timetable entries found:', timetableData?.length, 'for teacher:', teacherId);

      if (timetableError) {
        console.error('❌ Error fetching timetable:', timetableError);
        return;
      }
      
      if (!timetableData || timetableData.length === 0) {
        console.log('📋 No timetable data found for teacher', teacherId, 'in academic year', academicYear);
        setTimetables({});
        return;
      }

      // Organize timetable by class, then by day
      const organizedTimetable = {};

      timetableData.forEach(entry => {
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
      console.log('✅ Timetable data organized successfully');
      
    } catch (error) {
      console.error('❌ Error loading timetable data:', error);
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



  // 🚀 ENHANCED: Show loading if tenant is loading OR data is loading
  if (loading || tenantLoading || !isReady) {
    return (
      <View style={styles.container}>
        <Header title="My Timetable" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>
            {tenantLoading || !isReady ? 'Initializing tenant access...' : 'Loading your timetable...'}
          </Text>
          {tenantName && (
            <Text style={styles.tenantText}>Tenant: {tenantName}</Text>
          )}
        </View>
      </View>
    );
  }
  
  // 🚀 ENHANCED: Show error if there's a data error OR tenant error
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="My Timetable" showBack={true} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Access Error: {tenantError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'hidden',
      },
    }),
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
    ...Platform.select({
      web: {
        overflow: 'auto',
        height: '100%',
        WebkitOverflowScrolling: 'touch',
      }
    })
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
  // 🚀 ENHANCED TENANT SYSTEM STYLES
  tenantText: {
    marginTop: 8,
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default TeacherTimetable;
