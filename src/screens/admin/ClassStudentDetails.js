import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { formatCurrency } from '../../utils/helpers';
import { format } from 'date-fns';

const ClassStudentDetails = ({ route, navigation }) => {
  const { classData } = route.params;
  
  const [classStudents, setClassStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('outstanding');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistoryModal, setStudentHistoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState('students');
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadClassStudentDetails();
  }, []);

  // Format currency safely in Indian Rupees
  const formatSafeCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0.00';
    }
    const numAmount = parseFloat(amount);
    return `₹${numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Format date safely
  const formatSafeDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Load detailed student information for the class
  const loadClassStudentDetails = async () => {
    try {
      setLoading(true);

      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Get detailed student information for the selected class
      const { data: studentsData, error } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          roll_no,
          student_fees:${TABLES.STUDENT_FEES}(
            id,
            fee_component,
            amount_paid,
            payment_date,
            payment_mode,
            academic_year
          )
        `)
        .eq('class_id', classData.classId);

      if (error) throw error;

      // Get fee structure for this class (removed academic year filter)
      const { data: feeStructureData, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classData.classId);

      console.log('🏫 ClassStudentDetails Debug Info:');
      console.log('📚 Class ID:', classData.classId);
      console.log('🧮 Fee structures found:', feeStructureData?.length || 0);
      if (feeStructureData && feeStructureData.length > 0) {
        console.log('💰 Sample fee structure:', feeStructureData[0]);
      }

      if (feeError) throw feeError;

      // Calculate total fee structure amount
      const totalFeeStructure = feeStructureData.reduce((sum, fee) => 
        sum + (parseFloat(fee.amount) || 0), 0);

      // Process student data with payment details
      const processedStudents = studentsData.map(student => {
        // Filter payments for current academic year
        const currentYearPayments = student.student_fees?.filter(
          payment => payment.academic_year === academicYear
        ) || [];

        // Calculate total paid by this student
        const totalPaid = currentYearPayments.reduce((sum, payment) => 
          sum + (parseFloat(payment.amount_paid) || 0), 0);

        // Calculate outstanding amount
        const outstanding = Math.max(0, totalFeeStructure - totalPaid);

        // Calculate payment percentage
        const paymentPercentage = totalFeeStructure > 0 ? 
          Math.min(100, (totalPaid / totalFeeStructure) * 100) : 0;

        // Get payment status - Fixed logic to prevent showing 'Paid' for all students
        let paymentStatus;
        if (totalFeeStructure === 0) {
          paymentStatus = 'Paid'; // No fees required
        } else if (totalPaid >= totalFeeStructure) {
          paymentStatus = 'Paid'; // Fully paid
        } else if (totalPaid > 0) {
          paymentStatus = 'Partial'; // Partially paid
        } else {
          paymentStatus = 'Pending'; // No payments made
        }

        // Debug logging to trace payment status calculation
        console.log(`Student: ${student.name}, Fee Structure: ${totalFeeStructure}, Paid: ${totalPaid}, Status: ${paymentStatus}`, {
          studentId: student.id,
          totalFeeStructure,
          totalPaid,
          outstanding,
          paymentCount: currentYearPayments.length,
          paymentStatus
        });

        // Get latest payment date
        const latestPayment = currentYearPayments.length > 0 ? 
          currentYearPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0] : null;

        return {
          id: student.id,
          name: student.name,
          admissionNo: student.admission_no,
          rollNo: student.roll_no,
          totalFeeStructure,
          totalPaid,
          outstanding,
          paymentPercentage: Math.round(paymentPercentage * 100) / 100,
          paymentStatus,
          latestPaymentDate: latestPayment?.payment_date,
          latestPaymentMode: latestPayment?.payment_mode,
          payments: currentYearPayments,
          paymentCount: currentYearPayments.length
        };
      });

      // Sort by outstanding amount (highest first)
      processedStudents.sort((a, b) => b.outstanding - a.outstanding);

      setClassStudents(processedStudents);
      setFilteredStudents(processedStudents);

    } catch (error) {
      console.error('Error loading class student details:', error);
      Alert.alert('Error', 'Failed to load student details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter and search students
  const filterAndSearchStudents = (students, query, status, sortBy) => {
    let filtered = [...students];

    // Apply search filter
    if (query.trim()) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchLower) ||
        student.admissionNo?.toLowerCase().includes(searchLower) ||
        student.rollNo?.toString().includes(searchLower)
      );
    }

    // Apply status filter
    if (status !== 'All') {
      filtered = filtered.filter(student => student.paymentStatus === status);
    }

    // Apply sorting
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'outstanding':
      default:
        filtered.sort((a, b) => b.outstanding - a.outstanding);
        break;
    }

    return filtered;
  };

  // Handle search input change
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    const filtered = filterAndSearchStudents(classStudents, query, filterStatus, sortBy);
    setFilteredStudents(filtered);
  };

  // Handle filter status change
  const handleFilterStatusChange = (status) => {
    setFilterStatus(status);
    const filtered = filterAndSearchStudents(classStudents, searchQuery, status, sortBy);
    setFilteredStudents(filtered);
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    const filtered = filterAndSearchStudents(classStudents, searchQuery, filterStatus, newSortBy);
    setFilteredStudents(filtered);
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadClassStudentDetails();
  };

  // Handle student click to show payment history
  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setStudentHistoryModal(true);
  };

  // Handle mark as paid button click
  const handleMarkAsPaid = (student) => {
    setSelectedStudent(student);
    setPaymentDate(new Date());
    setPaymentAmount('');
    setPaymentMode('Cash');
    setPaymentRemarks('');
    setPaymentModal(true);
  };

  // Format date for display
  const formatDateForDisplay = (date) => {
    return format(date, 'dd MMM yyyy');
  };

  // Submit payment record
  const handlePaymentSubmit = async () => {
    if (!selectedStudent || !paymentAmount || paymentAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }

    try {
      setPaymentLoading(true);
      
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Insert payment record
      const { error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .insert({
          student_id: selectedStudent.id,
          fee_component: paymentRemarks || 'General Fee Payment',
          amount_paid: parseFloat(paymentAmount),
          payment_date: paymentDate.toISOString().split('T')[0],
          payment_mode: paymentMode,
          academic_year: academicYear,
        });

      if (error) throw error;

      Alert.alert('Success', 'Payment recorded successfully!');
      setPaymentModal(false);
      
      // Refresh the data to show updated payment status
      await loadClassStudentDetails();
      
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={`${classData.className} - Students`} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading student details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={`${classData.className} - Details`} showBack />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.activeTab]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>
            Students
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            Reports
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Tab Content */}
        {activeTab === 'students' ? (
          <>
            {/* Class Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Class Overview</Text>
                <View style={styles.collectionBadge}>
                  <Text style={styles.collectionBadgeText}>
                    {classData.collectionRate}% Collected
                  </Text>
                </View>
              </View>
              
              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatNumber}>{classStudents.length}</Text>
                  <Text style={styles.summaryStatLabel}>Total Students</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatNumber, { color: '#4CAF50' }]}>
                    {classStudents.filter(s => s.paymentStatus === 'Paid').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Paid</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatNumber, { color: '#FF9800' }]}>
                    {classStudents.filter(s => s.paymentStatus === 'Partial').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Partial</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatNumber, { color: '#F44336' }]}>
                    {classStudents.filter(s => s.paymentStatus === 'Pending').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Pending</Text>
                </View>
              </View>
            </View>

        {/* Search and Filter Section */}
        <View style={styles.searchFilterSection}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, roll no, or admission no..."
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchChange('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['All', 'Paid', 'Partial', 'Pending'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    filterStatus === status && styles.activeFilterChip
                  ]}
                  onPress={() => handleFilterStatusChange(status)}
                >
                  <Text style={[
                    styles.filterChipText,
                    filterStatus === status && styles.activeFilterChipText
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Sort Options */}
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: 'outstanding', label: 'Outstanding' },
                { key: 'name', label: 'Name' }
              ].map((sort) => (
                <TouchableOpacity
                  key={sort.key}
                  style={[
                    styles.sortChip,
                    sortBy === sort.key && styles.activeSortChip
                  ]}
                  onPress={() => handleSortChange(sort.key)}
                >
                  <Text style={[
                    styles.sortChipText,
                    sortBy === sort.key && styles.activeSortChipText
                  ]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Results Summary */}
          <Text style={styles.resultsText}>
            Showing {filteredStudents.length} of {classStudents.length} students
            {searchQuery && ` for "${searchQuery}"`}
          </Text>
        </View>

        {/* Students List */}
        <View style={styles.studentsSection}>
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No students found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery
                  ? `No students match "${searchQuery}"`
                  : `No students with ${filterStatus.toLowerCase()} status`
                }
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setFilterStatus('All');
                  setFilteredStudents(classStudents);
                }}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>Show All Students</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredStudents.map((student, index) => (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.studentCard,
                  {
                    borderLeftColor: student.paymentStatus === 'Paid' ? '#4CAF50' :
                      student.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
                  }
                ]}
                onPress={() => handleStudentClick(student)}
                activeOpacity={0.7}
              >
                {/* Student Header */}
                <View style={styles.studentHeader}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentDetails}>
                      Roll: {student.rollNo || 'N/A'} • Admission: {student.admissionNo}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor: student.paymentStatus === 'Paid' ? '#4CAF50' :
                        student.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
                    }
                  ]}>
                    <Text style={styles.statusText}>{student.paymentStatus}</Text>
                  </View>
                </View>

                {/* Fee Details */}
                <View style={styles.feeDetails}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Total Fee:</Text>
                    <Text style={styles.feeValue}>{formatSafeCurrency(student.totalFeeStructure)}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Paid:</Text>
                    <Text style={[styles.feeValue, { color: '#4CAF50' }]}>
                      {formatSafeCurrency(student.totalPaid)}
                    </Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Outstanding:</Text>
                    <Text style={[styles.feeValue, { color: '#F44336' }]}>
                      {formatSafeCurrency(student.outstanding)}
                    </Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Progress:</Text>
                    <Text style={styles.feeValue}>{student.paymentPercentage}%</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(student.paymentPercentage, 100)}%`,
                          backgroundColor: student.paymentStatus === 'Paid' ? '#4CAF50' :
                            student.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
                        }
                      ]}
                    />
                  </View>
                </View>

                {/* Payment History */}
                {student.payments.length > 0 && (
                  <View style={styles.paymentHistory}>
                    <Text style={styles.paymentHistoryTitle}>
                      Recent Payments ({student.paymentCount})
                    </Text>
                    {student.payments.slice(0, 3).map((payment, payIndex) => (
                      <View key={payment.id} style={styles.paymentItem}>
                        <Text style={styles.paymentComponent}>{payment.fee_component}</Text>
                        <View style={styles.paymentDetails}>
                          <Text style={styles.paymentAmount}>
                            {formatSafeCurrency(payment.amount_paid)}
                          </Text>
                          <Text style={styles.paymentDate}>
                            {formatSafeDate(payment.payment_date)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {student.payments.length > 3 && (
                      <Text style={styles.morePayments}>
                        +{student.payments.length - 3} more payments
                      </Text>
                    )}
                  </View>
                )}

                {/* Last Payment */}
                {student.latestPaymentDate && (
                  <Text style={styles.lastPayment}>
                    Last payment: {formatSafeDate(student.latestPaymentDate)}
                    {student.latestPaymentMode && ` via ${student.latestPaymentMode}`}
                  </Text>
                )}

                {/* Mark as Paid Button */}
                {student.outstanding > 0 && (
                  <TouchableOpacity
                    style={styles.markAsPaidButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleMarkAsPaid(student);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="card" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.markAsPaidButtonText}>
                      Pay
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
          </>
        ) : (
          <>
            {/* Reports Tab */}
            <View style={styles.reportsContainer}>
            <Text style={styles.reportsTitle}>Payment Summary & Analytics</Text>
            
            {/* Key Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, styles.totalStudentsCard]}>
                <View style={styles.metricIconContainer}>
                  <Ionicons name="people" size={24} color="#2196F3" />
                </View>
                <Text style={styles.metricValue}>{classStudents.length}</Text>
                <Text style={styles.metricLabel}>Total Students</Text>
              </View>
              
              <View style={[styles.metricCard, styles.collectionRateCard]}>
                <View style={styles.metricIconContainer}>
                  <Ionicons name="trending-up" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.metricValue}>{classData.collectionRate}%</Text>
                <Text style={styles.metricLabel}>Collection Rate</Text>
              </View>
            </View>
            
            {/* Payment Status Breakdown */}
            <View style={styles.statusBreakdownCard}>
              <Text style={styles.statusBreakdownTitle}>Payment Status Breakdown</Text>
              
              <View style={styles.statusItem}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIndicator, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.statusLabel}>Fully Paid</Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusCount}>
                    {classStudents.filter(s => s.paymentStatus === 'Paid').length}
                  </Text>
                  <Text style={styles.statusPercentage}>
                    ({Math.round((classStudents.filter(s => s.paymentStatus === 'Paid').length / classStudents.length) * 100) || 0}%)
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusProgressBar}>
                <View 
                  style={[styles.statusProgressFill, { 
                    width: `${(classStudents.filter(s => s.paymentStatus === 'Paid').length / classStudents.length) * 100}%`,
                    backgroundColor: '#4CAF50'
                  }]} 
                />
              </View>
              
              <View style={styles.statusItem}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIndicator, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.statusLabel}>Partial Payment</Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusCount}>
                    {classStudents.filter(s => s.paymentStatus === 'Partial').length}
                  </Text>
                  <Text style={styles.statusPercentage}>
                    ({Math.round((classStudents.filter(s => s.paymentStatus === 'Partial').length / classStudents.length) * 100) || 0}%)
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusProgressBar}>
                <View 
                  style={[styles.statusProgressFill, { 
                    width: `${(classStudents.filter(s => s.paymentStatus === 'Partial').length / classStudents.length) * 100}%`,
                    backgroundColor: '#FF9800'
                  }]} 
                />
              </View>
              
              <View style={styles.statusItem}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIndicator, { backgroundColor: '#F44336' }]} />
                  <Text style={styles.statusLabel}>Pending Payment</Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusCount}>
                    {classStudents.filter(s => s.paymentStatus === 'Pending').length}
                  </Text>
                  <Text style={styles.statusPercentage}>
                    ({Math.round((classStudents.filter(s => s.paymentStatus === 'Pending').length / classStudents.length) * 100) || 0}%)
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusProgressBar}>
                <View 
                  style={[styles.statusProgressFill, { 
                    width: `${(classStudents.filter(s => s.paymentStatus === 'Pending').length / classStudents.length) * 100}%`,
                    backgroundColor: '#F44336'
                  }]} 
                />
              </View>
            </View>
            
            {/* Financial Summary */}
            <View style={styles.financialSummaryCard}>
              <Text style={styles.financialSummaryTitle}>Financial Overview</Text>
              
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Total Fees Expected</Text>
                <Text style={styles.financialValue}>
                  {formatSafeCurrency(classStudents.reduce((sum, s) => sum + s.totalFeeStructure, 0))}
                </Text>
              </View>
              
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Amount Collected</Text>
                <Text style={[styles.financialValue, { color: '#4CAF50' }]}>
                  {formatSafeCurrency(classStudents.reduce((sum, s) => sum + s.totalPaid, 0))}
                </Text>
              </View>
              
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Outstanding Amount</Text>
                <Text style={[styles.financialValue, { color: '#F44336' }]}>
                  {formatSafeCurrency(classStudents.reduce((sum, s) => sum + s.outstanding, 0))}
                </Text>
              </View>
              
              <View style={styles.financialDivider} />
              
              <View style={styles.financialItem}>
                <Text style={[styles.financialLabel, { fontWeight: 'bold', fontSize: 16 }]}>Collection Efficiency</Text>
                <Text style={[styles.financialValue, { fontWeight: 'bold', fontSize: 18, color: '#2196F3' }]}>
                  {classData.collectionRate}%
                </Text>
              </View>
            </View>
            
            {/* Payment Activity Summary */}
            <View style={styles.activitySummaryCard}>
              <Text style={styles.activitySummaryTitle}>Payment Activity</Text>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="receipt" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Total Payments Made</Text>
                </View>
                <Text style={styles.activityValue}>
                  {classStudents.reduce((sum, s) => sum + s.paymentCount, 0)}
                </Text>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="person-add" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Students with Payments</Text>
                </View>
                <Text style={styles.activityValue}>
                  {classStudents.filter(s => s.paymentCount > 0).length} / {classStudents.length}
                </Text>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="calculator" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Average Payment per Student</Text>
                </View>
                <Text style={styles.activityValue}>
                  {formatSafeCurrency(classStudents.length > 0 ? 
                    classStudents.reduce((sum, s) => sum + s.totalPaid, 0) / classStudents.length : 0)}
                </Text>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Average Payments per Student</Text>
                </View>
                <Text style={styles.activityValue}>
                  {(classStudents.reduce((sum, s) => sum + s.paymentCount, 0) / Math.max(classStudents.length, 1)).toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
          </>
        )}
      </ScrollView>

      {/* Student Payment History Modal */}
      <Modal
        visible={studentHistoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStudentHistoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedStudent?.name} - Payment History
            </Text>
            <TouchableOpacity
              onPress={() => setStudentHistoryModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedStudent && (
              <>
                {/* Student Summary */}
                <View style={styles.studentSummaryCard}>
                  <View style={styles.studentSummaryHeader}>
                    <View style={styles.studentSummaryInfo}>
                      <Text style={styles.studentSummaryName}>{selectedStudent.name}</Text>
                      <Text style={styles.studentSummaryDetails}>
                        Roll: {selectedStudent.rollNo || 'N/A'} • Admission: {selectedStudent.admissionNo}
                      </Text>
                    </View>
                    <View style={[
                      styles.studentSummaryBadge,
                      {
                        backgroundColor: selectedStudent.paymentStatus === 'Paid' ? '#4CAF50' :
                          selectedStudent.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
                      }
                    ]}>
                      <Text style={styles.studentSummaryBadgeText}>{selectedStudent.paymentStatus}</Text>
                    </View>
                  </View>

                  {/* Payment Summary */}
                  <View style={styles.paymentSummaryGrid}>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Total Fee</Text>
                      <Text style={styles.paymentSummaryValue}>
                        {formatSafeCurrency(selectedStudent.totalFeeStructure)}
                      </Text>
                    </View>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Amount Paid</Text>
                      <Text style={[styles.paymentSummaryValue, { color: '#4CAF50' }]}>
                        {formatSafeCurrency(selectedStudent.totalPaid)}
                      </Text>
                    </View>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Outstanding</Text>
                      <Text style={[styles.paymentSummaryValue, { color: '#F44336' }]}>
                        {formatSafeCurrency(selectedStudent.outstanding)}
                      </Text>
                    </View>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Progress</Text>
                      <Text style={styles.paymentSummaryValue}>{selectedStudent.paymentPercentage}%</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.modalProgressContainer}>
                    <View style={styles.modalProgressBar}>
                      <View
                        style={[
                          styles.modalProgressFill,
                          {
                            width: `${Math.min(selectedStudent.paymentPercentage, 100)}%`,
                            backgroundColor: selectedStudent.paymentStatus === 'Paid' ? '#4CAF50' :
                              selectedStudent.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
                          }
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* Payment History */}
                <View style={styles.paymentHistorySection}>
                  <Text style={styles.paymentHistorySectionTitle}>
                    Payment History ({selectedStudent.paymentCount} payments)
                  </Text>

                  {selectedStudent.payments.length === 0 ? (
                    <View style={styles.noPaymentsContainer}>
                      <Ionicons name="receipt-outline" size={48} color="#ccc" />
                      <Text style={styles.noPaymentsTitle}>No Payments Found</Text>
                      <Text style={styles.noPaymentsText}>
                        This student hasn't made any payments yet.
                      </Text>
                    </View>
                  ) : (
                    selectedStudent.payments
                      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                      .map((payment, index) => (
                        <View key={payment.id} style={styles.paymentHistoryCard}>
                          <View style={styles.paymentHistoryHeader}>
                            <View style={styles.paymentHistoryLeft}>
                              <Text style={styles.paymentHistoryComponent}>
                                {payment.fee_component}
                              </Text>
                              <Text style={styles.paymentHistoryDate}>
                                {formatSafeDate(payment.payment_date)}
                              </Text>
                            </View>
                            <View style={styles.paymentHistoryRight}>
                              <Text style={styles.paymentHistoryAmount}>
                                {formatSafeCurrency(payment.amount_paid)}
                              </Text>
                              {payment.payment_mode && (
                                <Text style={styles.paymentHistoryMode}>
                                  via {payment.payment_mode}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      ))
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Payment Recording Modal */}
      <Modal
        visible={paymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPaymentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Record Payment - {selectedStudent?.name}
            </Text>
            <TouchableOpacity
              onPress={() => setPaymentModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedStudent && (
              <>
                {/* Student Info */}
                <View style={styles.paymentFormCard}>
                  <View style={styles.paymentStudentInfo}>
                    <Text style={styles.paymentStudentName}>{selectedStudent.name}</Text>
                    <Text style={styles.paymentStudentDetails}>
                      Outstanding Amount: {formatSafeCurrency(selectedStudent.outstanding)}
                    </Text>
                  </View>
                </View>

                {/* Payment Form */}
                <View style={styles.paymentFormCard}>
                  <Text style={styles.paymentFormTitle}>Payment Details</Text>
                  
                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter payment amount"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Payment Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Date *</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateInputText}>
                        {formatDateForDisplay(paymentDate)}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Payment Mode */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Mode *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.paymentModeChip,
                            paymentMode === mode && styles.activePaymentModeChip
                          ]}
                          onPress={() => setPaymentMode(mode)}
                        >
                          <Text style={[
                            styles.paymentModeChipText,
                            paymentMode === mode && styles.activePaymentModeChipText
                          ]}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Fee Component / Remarks */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fee Component / Remarks</Text>
                    <TextInput
                      style={[styles.textInput, { height: 80 }]}
                      placeholder="e.g., Tuition Fee, Books Fee, etc."
                      value={paymentRemarks}
                      onChangeText={setPaymentRemarks}
                      multiline
                      textAlignVertical="top"
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      paymentLoading && styles.submitButtonDisabled
                    ]}
                    onPress={handlePaymentSubmit}
                    disabled={paymentLoading}
                    activeOpacity={0.8}
                  >
                    {paymentLoading ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>Recording Payment...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>Record Payment</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  // Tab Navigation
  tabContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  collectionBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  collectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Search and Filter Section
  searchFilterSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  sortChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeSortChip: {
    backgroundColor: '#FF9800',
  },
  sortChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeSortChipText: {
    color: '#fff',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  // Students Section
  studentsSection: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  resetButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Student Cards
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  feeDetails: {
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  paymentHistory: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paymentHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentComponent: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  paymentDetails: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  paymentDate: {
    fontSize: 10,
    color: '#999',
  },
  morePayments: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  lastPayment: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  // Student Summary Card
  studentSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  studentSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  studentSummaryInfo: {
    flex: 1,
  },
  studentSummaryName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentSummaryDetails: {
    fontSize: 14,
    color: '#666',
  },
  studentSummaryBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  studentSummaryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paymentSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  paymentSummaryItem: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  paymentSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalProgressContainer: {
    marginTop: 8,
  },
  modalProgressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Payment History Section
  paymentHistorySection: {
    marginBottom: 20,
  },
  paymentHistorySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  noPaymentsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noPaymentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noPaymentsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentHistoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentHistoryLeft: {
    flex: 1,
  },
  paymentHistoryComponent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentHistoryDate: {
    fontSize: 12,
    color: '#666',
  },
  paymentHistoryRight: {
    alignItems: 'flex-end',
  },
  paymentHistoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  paymentHistoryMode: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  // Reports Tab Styles
  reportsContainer: {
    marginBottom: 20,
  },
  reportsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Key Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  totalStudentsCard: {
    borderTopColor: '#2196F3',
    borderTopWidth: 4,
  },
  collectionRateCard: {
    borderTopColor: '#4CAF50',
    borderTopWidth: 4,
  },
  metricIconContainer: {
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Payment Status Breakdown
  statusBreakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  statusBreakdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  statusPercentage: {
    fontSize: 12,
    color: '#666',
  },
  statusProgressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statusProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Financial Summary
  financialSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  financialSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  financialItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  financialDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  // Payment Activity Summary
  activitySummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  activitySummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  activityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  // Mark as Paid Button
  markAsPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  markAsPaidButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Payment Form Styles
  paymentFormCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  paymentStudentInfo: {
    alignItems: 'center',
  },
  paymentStudentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentStudentDetails: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  paymentModeChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  activePaymentModeChip: {
    backgroundColor: '#2196F3',
  },
  paymentModeChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activePaymentModeChipText: {
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ClassStudentDetails;
