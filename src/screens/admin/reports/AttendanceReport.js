import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  FlatList,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import { supabase, TABLES } from '../../../utils/supabase';
import { exportAttendanceData, exportIndividualAttendanceRecord, EXPORT_FORMATS } from '../../../utils/exportUtils';
import { getCurrentUserTenantByEmail } from '../../../utils/getTenantByEmail';
import { LineChart, BarChart } from 'react-native-chart-kit';
import CrossPlatformDatePicker, { DatePickerButton } from '../../../components/CrossPlatformDatePicker';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../../styles/webScrollFix';

const { width: screenWidth } = Dimensions.get('window');

const AttendanceReport = ({ navigation }) => {
  // Refs and scroll state
  const scrollViewRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('thisWeek');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0,
    weeklyAttendance: [],
    classWiseAttendance: [],
  });

  const dateRangeOptions = [
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'custom', label: 'Custom Range' },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAttendanceData();
    }
  }, [selectedClass, selectedSection, selectedDateRange, startDate, endDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClasses(),
        loadStudents(),
      ]);
      await loadAttendanceData();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;
      
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('class_name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;
      
      const { data, error } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    let start, end;

    switch (selectedDateRange) {
      case 'today':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'thisWeek':
        // Calculate start of week (Sunday)
        const dayOfWeek = today.getDay();
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + 6);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'custom':
        start = startDate;
        end = endDate;
        break;
      default:
        // Default to last 7 days
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    // Ensure we have valid dates
    if (!start || isNaN(start.getTime())) {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    }
    if (!end || isNaN(end.getTime())) {
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    return { start, end };
  };

  const loadAttendanceData = async () => {
    try {
      const { start, end } = getDateRange();

      // Ensure dates are valid
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date range:', { start, end });
        return;
      }

      // Get current tenant for proper filtering
      const tenantResult = await getCurrentUserTenantByEmail();
      
      if (!tenantResult.success) {
        throw new Error(`Failed to get tenant: ${tenantResult.error}`);
      }
      
      const tenantId = tenantResult.data.tenant.id;

      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          students(id, name, admission_no),
          classes(id, class_name, section)
        `)
        .eq('tenant_id', tenantId)
        .gte('date', start.toISOString().split('T')[0])
        .lte('date', end.toISOString().split('T')[0])
        .order('date', { ascending: false });

      // Apply class filter
      if (selectedClass !== 'All') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;

      setAttendanceData(data || []);
      calculateStatistics(data || []);
    } catch (error) {
      console.error('Error loading attendance data:', error);
    }
  };

  const calculateStatistics = (data) => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = data.filter(record => record.date === today);
    
    const presentToday = todayAttendance.filter(record => record.status === 'Present').length;
    const absentToday = todayAttendance.filter(record => record.status === 'Absent').length;
    const totalToday = todayAttendance.length;
    
    const attendanceRate = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : 0;

    // Calculate weekly attendance for chart
    const weeklyData = {};
    data.forEach(record => {
      const date = record.date;
      if (!weeklyData[date]) {
        weeklyData[date] = { present: 0, total: 0 };
      }
      weeklyData[date].total++;
      if (record.status === 'Present') {
        weeklyData[date].present++;
      }
    });

    const weeklyAttendance = Object.entries(weeklyData)
      .map(([date, stats]) => ({
        date,
        rate: Math.round((stats.present / stats.total) * 100)
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7); // Last 7 days

    // Calculate class-wise attendance
    const classData = {};
    data.forEach(record => {
      const className = `${record.classes?.class_name} ${record.classes?.section}`;
      if (!classData[className]) {
        classData[className] = { present: 0, total: 0 };
      }
      classData[className].total++;
      if (record.status === 'Present') {
        classData[className].present++;
      }
    });

    const classWiseAttendance = Object.entries(classData)
      .map(([className, stats]) => ({
        className,
        rate: Math.round((stats.present / stats.total) * 100),
        present: stats.present,
        total: stats.total
      }))
      .sort((a, b) => b.rate - a.rate);

    setStats({
      totalStudents: students.length,
      presentToday,
      absentToday,
      attendanceRate,
      weeklyAttendance,
      classWiseAttendance,
    });
  };

  // Calculate class-wise records for recent records section
  const getClassWiseRecords = () => {
    const classRecords = {};
    
    attendanceData.forEach(record => {
      const date = record.date;
      const classKey = `${record.classes?.class_name} ${record.classes?.section}`;
      const recordKey = `${classKey}-${date}`;
      
      if (!classRecords[recordKey]) {
        classRecords[recordKey] = {
          id: recordKey,
          className: classKey,
          date: date,
          present: 0,
          absent: 0,
          total: 0,
          class_id: record.class_id
        };
      }
      
      classRecords[recordKey].total++;
      if (record.status === 'Present') {
        classRecords[recordKey].present++;
      } else if (record.status === 'Absent') {
        classRecords[recordKey].absent++;
      }
    });
    
    return Object.values(classRecords)
      .map(record => ({
        ...record,
        attendanceRate: Math.round((record.present / record.total) * 100)
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20); // Show latest 20 class records
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAttendanceData();
    setRefreshing(false);
  };

  // Scroll event handler for scroll-to-top button
  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 200;
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      Animated.timing(scrollTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [showScrollTop, scrollTopOpacity]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, []);

  const handleDateChange = (event, selectedDate, type) => {
    if (type === 'start') {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleExport = async (format) => {
    try {
      const success = await exportAttendanceData(attendanceData, stats, format);
      return success;
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export attendance report.');
      return false;
    }
  };

  // Handle navigation to detail screen
  const handleRecordPress = (record) => {
    navigation.navigate('AttendanceRecordDetail', { record });
  };

  const renderClassWiseRecord = ({ item }) => (
    <TouchableOpacity 
      style={styles.classWiseCard} 
      onPress={() => handleRecordPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.classWiseInfo}>
        <View style={styles.classIconContainer}>
          <Ionicons name="school" size={20} color="#2196F3" />
        </View>
        <View style={styles.classWiseDetails}>
          <Text style={styles.classWiseName}>{item.className}</Text>
          <Text style={styles.classWiseStats}>
            {item.present} Present • {item.absent} Absent • {item.total} Total
          </Text>
          <Text style={styles.classWiseDate}>{formatDate(new Date(item.date))}</Text>
        </View>
      </View>
      <View style={styles.classWiseAttendanceInfo}>
        <View style={[
          styles.classWiseProgressContainer,
          { backgroundColor: item.attendanceRate >= 80 ? '#E8F5E9' : item.attendanceRate >= 60 ? '#FFF3E0' : '#FFEBEE' }
        ]}>
          <View style={[
            styles.classWiseProgressFill,
            {
              width: `${item.attendanceRate}%`,
              backgroundColor: item.attendanceRate >= 80 ? '#4CAF50' : item.attendanceRate >= 60 ? '#FF9800' : '#f44336'
            }
          ]} />
        </View>
        <Text style={[
          styles.classWisePercentage,
          { color: item.attendanceRate >= 80 ? '#4CAF50' : item.attendanceRate >= 60 ? '#FF9800' : '#f44336' }
        ]}>
          {item.attendanceRate}%
        </Text>
        
        {/* Tap to View Details Indicator */}
        <View style={styles.viewDetailsIndicator}>
          <Ionicons name="chevron-forward" size={16} color="#999" />
          <Text style={styles.tapToViewText}>Tap to view</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.mainContainer}>
        <Header title="Attendance Report" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading attendance data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <Header title="Attendance Report" showBack={true} />
      
      <View style={styles.scrollableContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#2196F3']}
            />
          }
          {...getWebScrollProps()}
        >
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filters</Text>

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Class</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={setSelectedClass}
                  style={styles.picker}
                >
                  <Picker.Item label="All Classes" value="All" />
                  {classes.map((cls) => (
                    <Picker.Item
                      key={cls.id}
                      label={`${cls.class_name} ${cls.section}`}
                      value={cls.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedDateRange}
                  onValueChange={setSelectedDateRange}
                  style={styles.picker}
                >
                  {dateRangeOptions.map((option) => (
                    <Picker.Item
                      key={option.key}
                      label={option.label}
                      value={option.key}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {selectedDateRange === 'custom' && (
            <View style={styles.customDateRow}>
              {Platform.OS === 'web' ? (
                <>
                  <View style={styles.dateInputWrapper}>
                    <CrossPlatformDatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={(event, date) => handleDateChange(event, date, 'start')}
                      mode="date"
                      placeholder="Select Start Date"
                      containerStyle={{ flex: 1, marginRight: 8 }}
                    />
                  </View>
                  <View style={styles.dateInputWrapper}>
                    <CrossPlatformDatePicker
                      label="End Date"
                      value={endDate}
                      onChange={(event, date) => handleDateChange(event, date, 'end')}
                      mode="date"
                      placeholder="Select End Date"
                      containerStyle={{ flex: 1, marginLeft: 8 }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <DatePickerButton
                    label="Start Date"
                    value={startDate}
                    onPress={() => setShowStartDatePicker(true)}
                    placeholder="Select Start Date"
                    mode="date"
                    style={styles.dateButton}
                    containerStyle={{ flex: 1, marginRight: 8 }}
                    displayFormat={(date) => `Start: ${formatDate(date)}`}
                  />
                  <DatePickerButton
                    label="End Date"
                    value={endDate}
                    onPress={() => setShowEndDatePicker(true)}
                    placeholder="Select End Date"
                    mode="date"
                    style={styles.dateButton}
                    containerStyle={{ flex: 1, marginLeft: 8 }}
                    displayFormat={(date) => `End: ${formatDate(date)}`}
                  />
                </>
              )}
            </View>
          )}
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Today's Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.presentToday}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f44336' }]}>
                <Ionicons name="close-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.absentToday}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.attendanceRate}%</Text>
              <Text style={styles.statLabel}>Attendance Rate</Text>
            </View>
          </View>
        </View>

        {/* Weekly Attendance Chart */}
        {stats.weeklyAttendance.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Weekly Attendance Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: stats.weeklyAttendance.map(item =>
                    new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                  ),
                  datasets: [{
                    data: stats.weeklyAttendance.map(item => item.rate),
                    strokeWidth: 3,
                  }]
                }}
                width={Math.max(screenWidth - 40, stats.weeklyAttendance.length * 60)}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#2196F3'
                  }
                }}
                style={styles.chart}
              />
            </ScrollView>
          </View>
        )}


        {/* Recent Attendance Records */}
        <View style={styles.recordsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Records</Text>
            <TouchableOpacity 
              style={styles.exportButton}
              onPress={() => setShowExportModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={16} color="#2196F3" />
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={getClassWiseRecords()} // Show class-wise records
            keyExtractor={(item) => item.id}
            renderItem={renderClassWiseRecord}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No attendance records found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your filters or date range
                </Text>
              </View>
            }
          />
        </View>
        
        {/* Extra bottom space for better scrolling */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>

      {/* Date Pickers - Only show on mobile platforms */}
      {Platform.OS !== 'web' && showStartDatePicker && (
        <CrossPlatformDatePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'start')}
        />
      )}

      {Platform.OS !== 'web' && showEndDatePicker && (
        <CrossPlatformDatePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'end')}
        />
      )}

      {/* Scroll to Top Button - Web Only */}
      {Platform.OS === 'web' && (
        <Animated.View 
          style={[styles.scrollToTopButton, { opacity: scrollTopOpacity }]}
        >
          <TouchableOpacity 
            style={styles.scrollToTopInner} 
            onPress={scrollToTop}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-up" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Attendance Report"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.JSON, EXPORT_FORMATS.CLIPBOARD]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // 🎯 CRITICAL: Main container with fixed viewport height
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && {
      height: '100vh',           // ✅ CRITICAL: Fixed viewport height
      maxHeight: '100vh',        // ✅ CRITICAL: Prevent expansion
      overflow: 'hidden',        // ✅ CRITICAL: Hide overflow on main container
      position: 'relative',      // ✅ CRITICAL: For absolute positioning
    }),
  },
  
  // 🎯 CRITICAL: Scrollable area with calculated height
  scrollableContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)',      // ✅ CRITICAL: Account for header (60px)
      maxHeight: 'calc(100vh - 60px)',   // ✅ CRITICAL: Prevent expansion
      overflow: 'hidden',                // ✅ CRITICAL: Control overflow
    }),
  },
  
  // 🎯 CRITICAL: ScrollView with explicit overflow
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',                    // ✅ CRITICAL: Full height
      maxHeight: '100%',                 // ✅ CRITICAL: Prevent expansion
      overflowY: 'scroll',              // ✅ CRITICAL: Enable vertical scroll
      overflowX: 'hidden',              // ✅ CRITICAL: Disable horizontal scroll
      WebkitOverflowScrolling: 'touch', // ✅ GOOD: Smooth iOS scrolling
      scrollBehavior: 'smooth',         // ✅ GOOD: Smooth animations
      scrollbarWidth: 'thin',           // ✅ GOOD: Thin scrollbars
      scrollbarColor: '#2196F3 #f5f5f5', // ✅ GOOD: Custom scrollbar colors
    }),
  },
  
  // 🎯 CRITICAL: Content container properties
  scrollContent: {
    flexGrow: 1,                    // ✅ CRITICAL: Allow content to grow
    paddingBottom: 100,             // ✅ IMPORTANT: Extra bottom padding
  },
  
  // 🎯 GOOD TO HAVE: Bottom spacing for better scroll experience
  bottomSpacing: {
    height: 100,                    // ✅ IMPORTANT: Extra space at bottom
  },
  // Scroll to Top Button Styles
  scrollToTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
    }),
  },
  scrollToTopInner: {
    backgroundColor: '#2196F3',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Filters Section
  filtersSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  customDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },

  // Statistics Section
  statsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Chart Section
  chartSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },

  // Class Section
  classSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  classStats: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },

  // Records Section
  recordsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    paddingBottom: 80, // Increased bottom padding to prevent home button overlap
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
  },
  exportText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },

  // Attendance Record Card
  attendanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  classInfo: {
    fontSize: 12,
    color: '#2196F3',
  },
  attendanceInfo: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  presentBadge: {
    backgroundColor: '#4CAF50',
  },
  absentBadge: {
    backgroundColor: '#f44336',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#666',
  },

  // Class-wise Record Card Styles
  classWiseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  classWiseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  classIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  classWiseDetails: {
    flex: 1,
  },
  classWiseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  classWiseStats: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
  },
  classWiseDate: {
    fontSize: 12,
    color: '#999',
  },
  classWiseAttendanceInfo: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  classWiseProgressContainer: {
    width: 60,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  classWiseProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  classWisePercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },

  // View Details Indicator
  viewDetailsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tapToViewText: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default AttendanceReport;
