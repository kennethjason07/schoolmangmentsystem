import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const { width: screenWidth } = Dimensions.get('window');

const AnalyticsReports = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');

  // Analytics Data State
  const [overviewStats, setOverviewStats] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [academicData, setAcademicData] = useState({});
  const [financialData, setFinancialData] = useState({});
  const [teacherData, setTeacherData] = useState({});
  const [studentData, setStudentData] = useState({});

  // Helper function to get date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (selectedPeriod) {
      case 'today':
        return {
          start: startOfToday,
          end: now,
          label: 'Today'
        };
      case 'thisWeek':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        return {
          start: startOfWeek,
          end: now,
          label: 'This Week'
        };
      case 'thisMonth':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now,
          label: 'This Month'
        };
      case 'thisYear':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: now,
          label: 'This Year'
        };
      default:
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now,
          label: 'This Month'
        };
    }
  };

  // Helper function to format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Load overview statistics
  const loadOverviewStats = async () => {
    try {
      const dateRange = getDateRange();

      // Load basic counts
      const [studentsResult, teachersResult, classesResult, subjectsResult] = await Promise.all([
        supabase.from(TABLES.STUDENTS).select('id, created_at, class_id'),
        supabase.from(TABLES.TEACHERS).select('id, created_at, salary_amount'),
        supabase.from(TABLES.CLASSES).select('id, class_name, section'),
        supabase.from(TABLES.SUBJECTS).select('id, name, class_id')
      ]);

      const students = studentsResult.data || [];
      const teachers = teachersResult.data || [];
      const classes = classesResult.data || [];
      const subjects = subjectsResult.data || [];

      // Calculate total salary expense
      const totalSalaryExpense = teachers.reduce((sum, teacher) =>
        sum + (parseFloat(teacher.salary_amount) || 0), 0
      );

      setOverviewStats({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalSubjects: subjects.length,
        totalSalaryExpense,
        avgStudentsPerClass: classes.length > 0 ? Math.round(students.length / classes.length) : 0,
        avgSubjectsPerClass: classes.length > 0 ? Math.round(subjects.length / classes.length) : 0
      });

    } catch (error) {
      console.error('Error loading overview stats:', error);
    }
  };

  // Load attendance analytics
  const loadAttendanceData = async () => {
    try {
      const dateRange = getDateRange();

      // Load student attendance
      const { data: studentAttendance } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          students(name, class_id),
          classes(class_name, section)
        `)
        .gte('date', dateRange.start.toISOString().split('T')[0])
        .lte('date', dateRange.end.toISOString().split('T')[0]);

      // Load teacher attendance
      const { data: teacherAttendance } = await supabase
        .from(TABLES.TEACHER_ATTENDANCE)
        .select(`
          *,
          teachers(name)
        `)
        .gte('date', dateRange.start.toISOString().split('T')[0])
        .lte('date', dateRange.end.toISOString().split('T')[0]);

      // Calculate attendance statistics
      const studentPresentCount = studentAttendance?.filter(a => a.status === 'Present').length || 0;
      const studentTotalCount = studentAttendance?.length || 0;
      const studentAttendanceRate = studentTotalCount > 0 ? (studentPresentCount / studentTotalCount * 100) : 0;

      const teacherPresentCount = teacherAttendance?.filter(a => a.status === 'Present').length || 0;
      const teacherTotalCount = teacherAttendance?.length || 0;
      const teacherAttendanceRate = teacherTotalCount > 0 ? (teacherPresentCount / teacherTotalCount * 100) : 0;

      // Group by class for student attendance
      const attendanceByClass = {};
      studentAttendance?.forEach(record => {
        const className = record.classes?.class_name + ' ' + record.classes?.section;
        if (!attendanceByClass[className]) {
          attendanceByClass[className] = { present: 0, total: 0 };
        }
        attendanceByClass[className].total++;
        if (record.status === 'Present') {
          attendanceByClass[className].present++;
        }
      });

      setAttendanceData({
        studentAttendanceRate: Math.round(studentAttendanceRate),
        teacherAttendanceRate: Math.round(teacherAttendanceRate),
        studentPresentCount,
        studentTotalCount,
        teacherPresentCount,
        teacherTotalCount,
        attendanceByClass,
        dailyAttendance: studentAttendance || []
      });

    } catch (error) {
      console.error('Error loading attendance data:', error);
    }
  };

  // Load academic performance data
  const loadAcademicData = async () => {
    try {
      const dateRange = getDateRange();

      // Load marks data
      const { data: marks } = await supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          students(name, class_id),
          subjects(name, class_id),
          exams(name, class_id)
        `);

      // Load exams data
      const { data: exams } = await supabase
        .from(TABLES.EXAMS)
        .select(`
          *,
          classes(class_name, section)
        `)
        .gte('start_date', dateRange.start.toISOString().split('T')[0])
        .lte('end_date', dateRange.end.toISOString().split('T')[0]);

      // Load assignments data
      const { data: assignments } = await supabase
        .from(TABLES.ASSIGNMENTS)
        .select(`
          *,
          classes(class_name, section),
          subjects(name),
          teachers(name)
        `)
        .gte('assigned_date', dateRange.start.toISOString().split('T')[0])
        .lte('due_date', dateRange.end.toISOString().split('T')[0]);

      // Calculate academic statistics
      const totalMarks = marks?.reduce((sum, mark) => sum + (parseFloat(mark.marks_obtained) || 0), 0) || 0;
      const totalMaxMarks = marks?.reduce((sum, mark) => sum + (parseFloat(mark.max_marks) || 0), 0) || 0;
      const averagePercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks * 100) : 0;

      // Group marks by subject
      const subjectPerformance = {};
      marks?.forEach(mark => {
        const subjectName = mark.subjects?.name;
        if (subjectName) {
          if (!subjectPerformance[subjectName]) {
            subjectPerformance[subjectName] = { totalMarks: 0, maxMarks: 0, count: 0 };
          }
          subjectPerformance[subjectName].totalMarks += parseFloat(mark.marks_obtained) || 0;
          subjectPerformance[subjectName].maxMarks += parseFloat(mark.max_marks) || 0;
          subjectPerformance[subjectName].count++;
        }
      });

      // Calculate grade distribution
      const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      marks?.forEach(mark => {
        const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks * 100) : 0;
        if (percentage >= 90) gradeDistribution.A++;
        else if (percentage >= 80) gradeDistribution.B++;
        else if (percentage >= 70) gradeDistribution.C++;
        else if (percentage >= 60) gradeDistribution.D++;
        else gradeDistribution.F++;
      });

      setAcademicData({
        totalExams: exams?.length || 0,
        totalAssignments: assignments?.length || 0,
        totalMarksRecords: marks?.length || 0,
        averagePercentage: Math.round(averagePercentage),
        subjectPerformance,
        gradeDistribution,
        recentExams: exams?.slice(0, 5) || [],
        recentAssignments: assignments?.slice(0, 5) || []
      });

    } catch (error) {
      console.error('Error loading academic data:', error);
    }
  };

  // Load financial data
  const loadFinancialData = async () => {
    try {
      const dateRange = getDateRange();

      // Load fee payments
      const { data: feePayments } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select(`
          *,
          students(name, class_id)
        `)
        .gte('payment_date', dateRange.start.toISOString().split('T')[0])
        .lte('payment_date', dateRange.end.toISOString().split('T')[0]);

      // Load fee structure
      const { data: feeStructure } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*');

      // Calculate financial statistics
      const totalCollected = feePayments?.reduce((sum, payment) =>
        sum + (parseFloat(payment.amount_paid) || 0), 0
      ) || 0;

      const totalExpected = feeStructure?.reduce((sum, fee) =>
        sum + (parseFloat(fee.amount) || 0), 0
      ) || 0;

      const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected * 100) : 0;

      // Group by payment mode
      const paymentModeDistribution = {};
      feePayments?.forEach(payment => {
        const mode = payment.payment_mode || 'Unknown';
        paymentModeDistribution[mode] = (paymentModeDistribution[mode] || 0) + parseFloat(payment.amount_paid || 0);
      });

      // Group by fee component
      const feeComponentDistribution = {};
      feePayments?.forEach(payment => {
        const component = payment.fee_component || 'Unknown';
        feeComponentDistribution[component] = (feeComponentDistribution[component] || 0) + parseFloat(payment.amount_paid || 0);
      });

      setFinancialData({
        totalCollected,
        totalExpected,
        collectionRate: Math.round(collectionRate),
        totalPayments: feePayments?.length || 0,
        paymentModeDistribution,
        feeComponentDistribution,
        recentPayments: feePayments?.slice(0, 10) || []
      });

    } catch (error) {
      console.error('Error loading financial data:', error);
    }
  };

  // Main data loading function
  const loadAllData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadOverviewStats(),
        loadAttendanceData(),
        loadAcademicData(),
        loadFinancialData()
      ]);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh data
  const onRefresh = () => {
    setRefreshing(true);
    loadAllData(false);
  };

  // Load data on component mount and when period changes
  useEffect(() => {
    loadAllData();
  }, [selectedPeriod]);

  // Period selector options
  const periodOptions = [
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'thisYear', label: 'This Year' }
  ];

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Analytics & Reports" showBack={true} />
        <View style={styles.loadingContainer}>
          <PaperActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading analytics data...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Analytics & Reports" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadAllData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main render
  return (
    <View style={styles.container}>
      <Header title="Analytics & Reports" showBack={true} />

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {periodOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.periodButton,
                selectedPeriod === option.key && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod(option.key)}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === option.key && styles.periodButtonTextActive
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{overviewStats.totalStudents || 0}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{overviewStats.totalTeachers || 0}</Text>
              <Text style={styles.statLabel}>Total Teachers</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="school" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{overviewStats.totalClasses || 0}</Text>
              <Text style={styles.statLabel}>Total Classes</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="book" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{overviewStats.totalSubjects || 0}</Text>
              <Text style={styles.statLabel}>Total Subjects</Text>
            </View>
          </View>
        </View>

        {/* Financial Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <View style={styles.financialStats}>
            <View style={styles.financialCard}>
              <Text style={styles.financialAmount}>₹{formatNumber(financialData.totalCollected || 0)}</Text>
              <Text style={styles.financialLabel}>Total Collected</Text>
              <Text style={styles.financialSubtext}>{financialData.collectionRate || 0}% collection rate</Text>
            </View>
            <View style={styles.financialCard}>
              <Text style={styles.financialAmount}>₹{formatNumber(overviewStats.totalSalaryExpense || 0)}</Text>
              <Text style={styles.financialLabel}>Monthly Salary Expense</Text>
              <Text style={styles.financialSubtext}>Teacher salaries</Text>
            </View>
          </View>
        </View>

        {/* Quick Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Reports</Text>
          <View style={styles.reportsList}>
            <TouchableOpacity
              style={styles.reportItem}
              onPress={() => navigation.navigate('AttendanceReport')}
            >
              <View style={[styles.reportIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>Attendance Report</Text>
                <Text style={styles.reportSubtitle}>
                  Student: {attendanceData.studentAttendanceRate || 0}% • Teacher: {attendanceData.teacherAttendanceRate || 0}%
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportItem}
              onPress={() => navigation.navigate('AcademicPerformance')}
            >
              <View style={[styles.reportIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="school" size={24} color="#fff" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>Academic Performance</Text>
                <Text style={styles.reportSubtitle}>
                  {academicData.totalExams || 0} exams • {academicData.averagePercentage || 0}% avg score
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportItem}
              onPress={() => navigation.navigate('FeeCollection')}
            >
              <View style={[styles.reportIcon, { backgroundColor: '#9C27B0' }]}>
                <Ionicons name="card" size={24} color="#fff" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>Fee Collection</Text>
                <Text style={styles.reportSubtitle}>
                  ₹{formatNumber(financialData.totalCollected || 0)} collected • {financialData.collectionRate || 0}% rate
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reportItem}
              onPress={() => navigation.navigate('StudentOverview')}
            >
              <View style={[styles.reportIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle}>Student Overview</Text>
                <Text style={styles.reportSubtitle}>
                  {overviewStats.totalStudents || 0} students • {overviewStats.avgStudentsPerClass || 0} avg per class
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  // Period Selector
  periodSelector: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  periodButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  // Sections
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Attendance
  attendanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  attendanceCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  attendanceTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  attendancePercentage: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  attendanceSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  // Academic
  academicStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  academicStatItem: {
    alignItems: 'center',
  },
  academicStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  academicStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Financial
  financialStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  financialAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9C27B0',
    marginBottom: 4,
  },
  financialLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  financialSubtext: {
    fontSize: 12,
    color: '#666',
  },
  // Reports
  reportsList: {
    marginTop: 8,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Charts
  chartContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  // Loading & Error States
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnalyticsReports;