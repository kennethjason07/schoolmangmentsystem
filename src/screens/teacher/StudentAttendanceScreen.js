import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { format, parseISO } from 'date-fns';
import { CrossPlatformBarChart } from '../../components/CrossPlatformChart';
import { Ionicons } from '@expo/vector-icons';

const StudentAttendanceScreen = ({ navigation, route }) => {
  const { student } = route.params;
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load attendance data
  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Get daily attendance records
      const { data: dailyData, error: dailyError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', student.id)
        .order('date');

      if (dailyError) throw dailyError;

      // Process data to create monthly summaries
      const attendanceByMonth = {};
      const monthlySummary = {};

      dailyData.forEach(record => {
        const date = new Date(record.date);
        const month = format(date, 'MMMM yyyy');
        const monthKey = format(date, 'yyyy-MM');
        
        if (!attendanceByMonth[month]) {
          attendanceByMonth[month] = [];
        }
        
        attendanceByMonth[month].push({
          day: format(date, 'd'),
          status: record.status,
          date: record.date
        });

        // Calculate monthly summary
        if (!monthlySummary[monthKey]) {
          monthlySummary[monthKey] = {
            month: month,
            totalDays: 0,
            presentDays: 0,
            percentage: 0
          };
        }
        
        monthlySummary[monthKey].totalDays++;
        if (record.status === 'Present') {
          monthlySummary[monthKey].presentDays++;
        }
      });

      // Calculate percentages
      Object.values(monthlySummary).forEach(summary => {
        summary.percentage = summary.totalDays > 0 
          ? (summary.presentDays / summary.totalDays) * 100 
          : 0;
      });

      setMonthlyAttendance(Object.values(monthlySummary));
      setDailyAttendance(attendanceByMonth);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      Alert.alert('Error', 'Failed to load attendance data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    loadAttendanceData();

    const subscription = supabase
      .channel('attendance-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.STUDENT_ATTENDANCE
      }, () => {
        loadAttendanceData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle month selection
  const handleMonthSelect = (month) => {
    setSelectedMonth(month);
    setModalVisible(true);
  };

  // Handle attendance update
  const handleAttendanceUpdate = async (date, status) => {
    try {
      const { error } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .update({ status })
        .eq('student_id', student.id)
        .eq('date', date);

      if (error) throw error;

      Alert.alert('Success', 'Attendance updated successfully');
      loadAttendanceData();
    } catch (error) {
      console.error('Error updating attendance:', error);
      Alert.alert('Error', 'Failed to update attendance');
    }
  };

  // Format attendance percentage
  const formatPercentage = (percent) => {
    return `${Math.round(percent)}%`;
  };

  return (
    <View style={styles.container}>
      <Header title={`${student.name}'s Attendance`} showBack={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadAttendanceData().finally(() => setRefreshing(false));
              }}
            />
          }
        >
          {monthlyAttendance.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>No attendance records found</Text>
              <Text style={styles.noDataSubtext}>Attendance will appear here once marked</Text>
            </View>
          ) : (
            <>
              {/* Attendance Summary Chart */}
              <View style={styles.chartContainer}>
                <Text style={styles.sectionTitle}>Attendance Summary</Text>
                <CrossPlatformBarChart
                  data={{
                    labels: monthlyAttendance.map(month => month.month),
                    datasets: [
                      {
                        data: monthlyAttendance.map(month => month.percentage)
                      }
                    ]
                  }}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    strokeWidth: 2
                  }}
                  width={350}
                  height={200}
                  style={{ marginVertical: 8, borderRadius: 16 }}
                />
              </View>

              {/* Monthly Attendance List */}
              <View style={styles.attendanceList}>
                <Text style={styles.sectionTitle}>Monthly Attendance</Text>
                <View style={styles.list}>
                  {monthlyAttendance.map((item) => (
                    <TouchableOpacity
                      key={item.month}
                      style={[styles.monthRow, {
                        backgroundColor: selectedMonth === item.month ? '#e3f2fd' : '#fff'
                      }]}
                      onPress={() => handleMonthSelect(item.month)}
                    >
                      <View style={styles.monthInfo}>
                        <Ionicons name="calendar" size={20} color="#1976d2" />
                        <Text style={styles.monthText}>{item.month}</Text>
                      </View>
                      <View style={styles.monthStats}>
                        <Text style={styles.percentText}>{formatPercentage(item.percentage)}</Text>
                        <Text style={styles.daysText}>
                          {item.presentDays}/{item.totalDays} days
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Calendar Modal */}
          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#1976d2" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{selectedMonth} Daily Attendance</Text>
                </View>
                
                <ScrollView>
                  <View style={styles.calendarGrid}>
                    {dailyAttendance[selectedMonth]?.map(({ day, status, date }) => (
                      <Pressable
                        key={date}
                        style={[styles.dayCell, 
                          status === 'Present' ? styles.present : styles.absent,
                          styles.dayCard
                        ]}
                        onPress={() => handleAttendanceUpdate(date, status === 'Present' ? 'Absent' : 'Present')}
                      >
                        <Text style={styles.dayText}>{day}</Text>
                        <View style={styles.statusIndicator}>
                          <Ionicons 
                            name={status === 'Present' ? 'checkmark-circle' : 'close-circle'} 
                            size={20}
                            color={status === 'Present' ? '#4caf50' : '#f44336'}
                          />
                          <Text style={styles.statusText}>{status}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}
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
  scrollContent: {
    padding: 16,
  },
  chartContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  attendanceList: {
    marginBottom: 24,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  monthStats: {
    alignItems: 'flex-end',
  },
  percentText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  daysText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCell: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  present: {
    backgroundColor: '#e8f5e9',
  },
  absent: {
    backgroundColor: '#ffebee',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    fontWeight: 'bold',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  }
});

export default StudentAttendanceScreen; 