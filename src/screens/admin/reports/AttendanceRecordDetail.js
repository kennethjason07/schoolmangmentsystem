import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import { supabase, TABLES } from '../../../utils/supabase';
import { exportIndividualAttendanceRecord, exportAttendanceData, EXPORT_FORMATS, testPDFExport } from '../../../utils/exportUtils';
import { PieChart, BarChart } from 'react-native-chart-kit';

const { width: screenWidth } = Dimensions.get('window');

const AttendanceRecordDetail = ({ navigation, route }) => {
  const { record } = route.params; // The class-wise record passed from previous screen
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [students, setStudents] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    total: 0,
    attendanceRate: 0,
  });
  
  // Enhanced scroll functionality
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentRefreshColor, setCurrentRefreshColor] = useState(0);
  const scrollViewRef = useRef(null);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;
  const scrollTopScale = useRef(new Animated.Value(0.8)).current;
  
  // Constants for scroll behavior
  const isWeb = Platform.OS === 'web';
  const SCROLL_THRESHOLD = isWeb ? 80 : 120;
  const SCROLL_THROTTLE = isWeb ? 32 : 16;
  const refreshColors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      // Load detailed attendance data for this specific class and date
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          students(id, name, admission_no),
          classes(id, class_name, section),
          users!student_attendance_marked_by_fkey(id, full_name)
        `)
        .eq('class_id', record.class_id)
        .eq('date', record.date)
        .order('students(name)');

      if (attendanceError) throw attendanceError;

      // Load all students in this class to show who wasn't marked
      const { data: classStudents, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('class_id', record.class_id);

      if (studentsError) throw studentsError;

      setAttendanceData(attendanceRecords || []);
      setStudents(classStudents || []);
      calculateStats(attendanceRecords || []);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      Alert.alert('Error', 'Failed to load attendance details');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const present = data.filter(record => record.status === 'Present').length;
    const absent = data.filter(record => record.status === 'Absent').length;
    const total = data.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    setStats({
      present,
      absent,
      total,
      attendanceRate,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Cycle through refresh colors for better UX
    setCurrentRefreshColor((prev) => (prev + 1) % refreshColors.length);
    await loadAttendanceData();
    setRefreshing(false);
  };

  // Enhanced scroll event handler
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > SCROLL_THRESHOLD;
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      animateScrollTopButton(shouldShow);
    }
  };

  // Animate scroll-to-top button
  const animateScrollTopButton = (show) => {
    Animated.parallel([
      Animated.timing(scrollTopOpacity, {
        toValue: show ? 1 : 0,
        duration: 300,
        useNativeDriver: !isWeb, // Native driver not supported on web for opacity
      }),
      Animated.spring(scrollTopScale, {
        toValue: show ? 1 : 0.8,
        tension: 100,
        friction: 8,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  };

  // Scroll to top function
  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
        animated: !isWeb // Use CSS smooth scroll on web
      });
    }
  };

  // Quick navigation function
  const scrollToSection = (yPosition) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: yPosition,
        animated: !isWeb
      });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not specified';
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleExport = async (format) => {
    try {
      if (attendanceData.length > 0) {
        // For individual record export (existing functionality)
        if (attendanceData.length === 1) {
          const success = await exportIndividualAttendanceRecord(attendanceData[0], format);
          return success;
        } 
        // For class attendance export (new functionality)
        else {
          // Prepare stats for export
          const exportStats = {
            presentToday: stats.present,
            absentToday: stats.absent,
            totalStudents: stats.total,
            attendanceRate: stats.attendanceRate
          };
          
          const success = await exportAttendanceData(attendanceData, exportStats, format);
          return success;
        }
      } else {
        Alert.alert('No Data', 'No attendance records found to export.');
        return false;
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export attendance record.');
      return false;
    }
  };

  const getPieChartData = () => {
    return [
      {
        name: 'Present',
        population: stats.present,
        color: '#4CAF50',
        legendFontColor: '#333',
        legendFontSize: 14,
      },
      {
        name: 'Absent',
        population: stats.absent,
        color: '#f44336',
        legendFontColor: '#333',
        legendFontSize: 14,
      },
    ];
  };

  // Quick Navigation Component
  const QuickNavigation = () => {
    const navigationItems = [
      { label: 'Header', icon: 'information-circle', position: 0 },
      { label: 'Stats', icon: 'analytics', position: 300 },
      { label: 'Chart', icon: 'pie-chart', position: 600 },
      { label: 'Students', icon: 'people', position: 900 },
    ];

    return (
      <View style={styles.quickNavContainer}>
        <Text style={styles.quickNavTitle}>Quick Navigation</Text>
        <View style={styles.quickNavButtons}>
          {navigationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickNavButton}
              onPress={() => scrollToSection(item.position)}
              accessibilityLabel={`Navigate to ${item.label} section`}
              accessibilityHint={`Scrolls to the ${item.label.toLowerCase()} section of the attendance details`}
            >
              <Ionicons name={item.icon} size={20} color="#2196F3" />
              <Text style={styles.quickNavButtonText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderStudentItem = ({ item }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={20} color="#2196F3" />
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{item.students?.name || 'Unknown Student'}</Text>
          <Text style={styles.studentId}>ID: {item.students?.admission_no}</Text>
        </View>
      </View>
      <View style={styles.attendanceInfo}>
        <View style={[
          styles.statusBadge,
          item.status === 'Present' ? styles.presentBadge : styles.absentBadge
        ]}>
          <Ionicons 
            name={item.status === 'Present' ? 'checkmark-circle' : 'close-circle'} 
            size={12} 
            color="#fff" 
          />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        {item.marked_at && (
          <Text style={styles.timeText}>
            {formatTime(item.marked_at)}
          </Text>
        )}
        {item.users?.full_name && (
          <Text style={styles.markedByText}>
            By: {item.users.full_name}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Attendance Details" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading attendance details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Attendance Details" showBack={true} />

      <View style={styles.scrollableContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={SCROLL_THROTTLE}
          showsVerticalScrollIndicator={!isWeb}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[refreshColors[currentRefreshColor]]}
              tintColor={refreshColors[currentRefreshColor]}
              title="Pull to refresh attendance details"
              titleColor="#666"
            />
          }
        >
        {/* Quick Navigation */}
        <QuickNavigation />

        {/* Header Info */}
        <View style={styles.headerSection}>
          <View style={styles.classHeader}>
            <View style={styles.classIconContainer}>
              <Ionicons name="school" size={24} color="#2196F3" />
            </View>
            <View style={styles.classInfo}>
              <Text style={styles.className}>{record.className}</Text>
              <Text style={styles.dateText}>{formatDate(record.date)}</Text>
            </View>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Attendance Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.present}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f44336' }]}>
                <Ionicons name="close-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.absent}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="analytics" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.attendanceRate}%</Text>
              <Text style={styles.statLabel}>Rate</Text>
            </View>
          </View>
        </View>

        {/* Pie Chart */}
        {stats.total > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Attendance Distribution</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={getPieChartData()}
                width={screenWidth - 60}
                height={200}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          </View>
        )}

        {/* Student List */}
        <View style={styles.studentsSection}>
          <Text style={styles.sectionTitle}>Student Details ({stats.total})</Text>
          <FlatList
            data={attendanceData}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderStudentItem}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No attendance records found</Text>
                <Text style={styles.emptySubtext}>
                  No students were marked for attendance on this date
                </Text>
              </View>
            }
          />
        </View>

        {/* Export Section */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export Options</Text>
          <View style={styles.exportButtonsContainer}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#4CAF50' }]}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.exportBtnText}>Export Attendance Record</Text>
            </TouchableOpacity>
          </View>
          
          {/* PDF Test Button (for debugging) */}
          <View style={styles.testExportContainer}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#9C27B0', marginTop: 8 }]}
              onPress={async () => {
                console.log('🔧 PDF Test Button pressed');
                const result = await testPDFExport();
                console.log('🔧 PDF Test Result:', result);
              }}
            >
              <Ionicons name="document" size={20} color="#fff" />
              <Text style={styles.exportBtnText}>Test PDF Generation</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacing for better scroll experience */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      </View>

      {/* Floating Scroll-to-Top Button */}
      {showScrollTop && (
        <Animated.View
          style={[
            styles.scrollToTopButton,
            {
              opacity: scrollTopOpacity,
              transform: [{ scale: scrollTopScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.scrollToTopInner}
            onPress={scrollToTop}
            accessibilityLabel="Scroll to top"
            accessibilityHint="Scrolls the attendance details back to the top"
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Attendance Record"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.PDF, EXPORT_FORMATS.CLIPBOARD, EXPORT_FORMATS.JSON]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Enhanced container with web optimizations
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      position: 'relative',
    }),
  },
  
  // Scrollable area with calculated height
  scrollableContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)', // Account for header
      maxHeight: 'calc(100vh - 60px)',
      overflow: 'hidden',
    }),
  },
  
  // Enhanced ScrollView with web scroll properties
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
      maxHeight: '100%',
      overflowY: 'scroll',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollBehavior: 'smooth',
      scrollbarWidth: 'thin',
      scrollbarColor: '#2196F3 #f5f5f5',
    }),
  },
  
  // Content container properties
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra bottom padding for better UX
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

  // Header Section
  headerSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 2,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
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
  chartContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },

  // Students Section
  studentsSection: {
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
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  studentContact: {
    fontSize: 11,
    color: '#999',
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
  timeText: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  markedByText: {
    fontSize: 9,
    color: '#999',
  },

  // Export Section
  exportSection: {
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
  exportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  exportBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Test export container
  testExportContainer: {
    marginTop: 8,
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

  // Enhanced Scroll Features Styles
  
  // Quick Navigation Styles
  quickNavContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickNavTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickNavButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickNavButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickNavButtonText: {
    fontSize: 11,
    color: '#2196F3',
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Scroll-to-Top Button Styles
  scrollToTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  
  // Bottom spacing for better scroll experience
  bottomSpacing: {
    height: 100,
    backgroundColor: 'transparent',
  },
});

export default AttendanceRecordDetail;