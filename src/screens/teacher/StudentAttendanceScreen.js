import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
      <Header title={student.name} showBack={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading attendance data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadAttendanceData().finally(() => setRefreshing(false));
              }}
              colors={['#1976d2']}
              tintColor="#1976d2"
            />
          }
        >
          {monthlyAttendance.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="calendar-outline" size={64} color="#E0E0E0" />
              </View>
              <Text style={styles.emptyTitle}>No Attendance Records</Text>
              <Text style={styles.emptySubtitle}>Attendance data will appear here once marked by teachers</Text>
            </View>
          ) : (
            <>
              {/* Student Info Card */}
              <View style={styles.studentCard}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>
                    {student.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentSubtitle}>Attendance Overview</Text>
                </View>
              </View>

              {/* Quick Stats */}
              <View style={styles.quickStats}>
                <View style={styles.statItem}>
                  <View style={styles.statIcon}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  </View>
                  <Text style={styles.statValue}>
                    {monthlyAttendance.reduce((sum, month) => sum + month.presentDays, 0)}
                  </Text>
                  <Text style={styles.statLabel}>Present</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={styles.statIcon}>
                    <Ionicons name="close-circle" size={20} color="#F44336" />
                  </View>
                  <Text style={styles.statValue}>
                    {monthlyAttendance.reduce((sum, month) => sum + (month.totalDays - month.presentDays), 0)}
                  </Text>
                  <Text style={styles.statLabel}>Absent</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={styles.statIcon}>
                    <Ionicons name="calendar" size={20} color="#1976d2" />
                  </View>
                  <Text style={styles.statValue}>
                    {monthlyAttendance.reduce((sum, month) => sum + month.totalDays, 0)}
                  </Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>

              {/* Attendance Chart */}
              {monthlyAttendance.length > 0 && (
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>Monthly Trends</Text>
                    <View style={styles.chartBadge}>
                      <Text style={styles.chartBadgeText}>
                        {Math.round(
                          monthlyAttendance.reduce((sum, month) => sum + month.percentage, 0) / monthlyAttendance.length
                        )}% Avg
                      </Text>
                    </View>
                  </View>
                  <CrossPlatformBarChart
                    data={monthlyAttendance
                      .filter(month => month.totalDays > 0)
                      .map(month => ({
                        label: month.month.split(' ')[0].substring(0, 3),
                        value: Math.round(month.percentage),
                        month: month.month,
                        percentage: month.percentage
                      }))
                    }
                    width={Dimensions.get('window').width - 48}
                    height={180}
                    chartConfig={{
                      backgroundColor: '#ffffff',
                      backgroundGradientFrom: '#ffffff',
                      backgroundGradientTo: '#ffffff',
                      color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                      barPercentage: 0.6,
                      decimalPlaces: 0,
                    }}
                    style={styles.chart}
                  />
                </View>
              )}

              {/* Monthly Records */}
              <View style={styles.monthlySection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Monthly Records</Text>
                  <Text style={styles.sectionSubtitle}>Tap to view daily details</Text>
                </View>
                <View style={styles.monthlyList}>
                  {monthlyAttendance.map((item, index) => (
                    <TouchableOpacity
                      key={item.month}
                      style={styles.monthCard}
                      onPress={() => handleMonthSelect(item.month)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.monthCardLeft}>
                        <View style={styles.monthIconBg}>
                          <Ionicons name="calendar-outline" size={18} color="#1976d2" />
                        </View>
                        <View style={styles.monthInfo}>
                          <Text style={styles.monthName}>{item.month}</Text>
                          <View style={styles.monthStats}>
                            <View style={styles.monthStat}>
                              <View style={styles.presentDot} />
                              <Text style={styles.monthStatText}>{item.presentDays} Present</Text>
                            </View>
                            <View style={styles.monthStat}>
                              <View style={styles.absentDot} />
                              <Text style={styles.monthStatText}>{item.totalDays - item.presentDays} Absent</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles.monthCardRight}>
                        <View style={[styles.percentageBadge, {
                          backgroundColor: item.percentage >= 85 ? '#E8F5E8' : item.percentage >= 75 ? '#FFF3E0' : '#FFEBEE'
                        }]}>
                          <Text style={[styles.percentageText, {
                            color: item.percentage >= 85 ? '#4CAF50' : item.percentage >= 75 ? '#FF9800' : '#F44336'
                          }]}>
                            {Math.round(item.percentage)}%
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#BDBDBD" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
      
      {/* Calendar Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.newModalContent}>
            {/* New Modal Header */}
            <View style={styles.newModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalMonthIcon}>
                  <Ionicons name="calendar" size={24} color="#1976d2" />
                </View>
                <View>
                  <Text style={styles.newModalTitle}>{selectedMonth}</Text>
                  <Text style={styles.modalSubtitle}>Daily Attendance</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.newCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Enhanced Summary Cards */}
            {selectedMonth && dailyAttendance[selectedMonth] && (
              <View style={styles.newModalSummary}>
                <View style={styles.newSummaryGrid}>
                  <View style={styles.newSummaryCard}>
                    <View style={styles.summaryCardHeader}>
                      <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                      <Text style={styles.summaryCardTitle}>Present</Text>
                    </View>
                    <Text style={styles.newSummaryNumber}>
                      {dailyAttendance[selectedMonth]?.filter(day => day.status === 'Present').length || 0}
                    </Text>
                    <Text style={styles.summaryCardPercent}>
                      {Math.round((dailyAttendance[selectedMonth]?.filter(day => day.status === 'Present').length || 0) / (dailyAttendance[selectedMonth]?.length || 1) * 100)}%
                    </Text>
                  </View>
                  
                  <View style={styles.newSummaryCard}>
                    <View style={styles.summaryCardHeader}>
                      <Ionicons name="close-circle" size={18} color="#F44336" />
                      <Text style={styles.summaryCardTitle}>Absent</Text>
                    </View>
                    <Text style={styles.newSummaryNumber}>
                      {dailyAttendance[selectedMonth]?.filter(day => day.status === 'Absent').length || 0}
                    </Text>
                    <Text style={styles.summaryCardPercent}>
                      {Math.round((dailyAttendance[selectedMonth]?.filter(day => day.status === 'Absent').length || 0) / (dailyAttendance[selectedMonth]?.length || 1) * 100)}%
                    </Text>
                  </View>
                </View>
                
                <View style={styles.totalDaysCard}>
                  <Ionicons name="calendar-outline" size={16} color="#1976d2" />
                  <Text style={styles.totalDaysText}>
                    Total: {dailyAttendance[selectedMonth]?.length || 0} days
                  </Text>
                </View>
              </View>
            )}
            
            {/* Calendar Section */}
            <View style={styles.calendarSection}>
              <Text style={styles.calendarSectionTitle}>Daily Calendar</Text>
              <ScrollView style={styles.newModalScrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.newCalendarGrid}>
                  {dailyAttendance[selectedMonth]?.map(({ day, status, date }) => (
                    <Pressable
                      key={date}
                      style={[styles.newDayCell, 
                        status === 'Present' ? styles.newPresent : styles.newAbsent
                      ]}
                      onPress={() => handleAttendanceUpdate(date, status === 'Present' ? 'Absent' : 'Present')}
                    >
                      <Text style={styles.newDayText}>{day}</Text>
                      <View style={styles.newDayStatus}>
                        <Ionicons 
                          name={status === 'Present' ? 'checkmark' : 'close'} 
                          size={12}
                          color="#fff"
                        />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            
            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Text style={styles.modalFooterText}>Tap any day to toggle attendance</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Student Card
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  studentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  studentAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976D2',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  studentSubtitle: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#212121',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  // Chart Card
  chartCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  chartBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  // Monthly Section
  monthlySection: {
    marginTop: 16,
    marginBottom: 32,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '500',
  },
  monthlyList: {
    paddingHorizontal: 16,
  },
  // Month Cards
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  monthCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  monthIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  monthInfo: {
    flex: 1,
  },
  monthName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 6,
  },
  monthStats: {
    flexDirection: 'row',
    gap: 16,
  },
  monthStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  absentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F44336',
    marginRight: 6,
  },
  monthStatText: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '500',
  },
  monthCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalSummary: {
    marginBottom: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#dee2e6',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontWeight: '500',
  },
  // New Enhanced Modal Styles
  newModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '90%',
    position: 'absolute',
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  newModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalMonthIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  newModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  newCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newModalSummary: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  newSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  newSummaryCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  newSummaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  summaryCardPercent: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  totalDaysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  totalDaysText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginLeft: 6,
  },
  calendarSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  calendarSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  newModalScrollView: {
    flex: 1,
    maxHeight: 300,
  },
  newCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 20,
  },
  newDayCell: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  newPresent: {
    backgroundColor: '#4CAF50',
  },
  newAbsent: {
    backgroundColor: '#F44336',
  },
  newDayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  newDayStatus: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  modalFooterText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  dayCell: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  present: {
    backgroundColor: '#e8f5e9',
  },
  absent: {
    backgroundColor: '#ffebee',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  dayIcon: {
    marginTop: 2,
  },
  // New styles for improved UI
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    minHeight: 85,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
    numberOfLines: 1,
    paddingHorizontal: 2,
  },
  monthIconContainer: {
    marginRight: 12,
  },
  monthDetails: {
    flex: 1,
  },
  attendanceBreakdown: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 16,
  },
  presentDays: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  absentDays: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presentDaysText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  absentDaysText: {
    fontSize: 12,
    color: '#F44336',
    marginLeft: 4,
    fontWeight: '500',
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