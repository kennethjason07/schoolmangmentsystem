import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, TABLES } from '../utils/supabase';
import WebPaymentModal from './WebPaymentModal';

const WebFeeManagement = ({
  classData,
  user,
  selectedAcademicYear,
}) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [feeComponents, setFeeComponents] = useState([]);

  // 📊 Load Student Data with Enhanced Fee Calculations
  const loadStudentData = async () => {
    try {
      if (!user?.tenant_id || !classData?.id) {
        console.warn('Missing tenant_id or class data');
        return;
      }

      // 🔒 Fetch students with tenant validation
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          roll_no,
          phone,
          parent_phone,
          email,
          tenant_id
        `)
        .eq('class_id', classData.id)
        .eq('tenant_id', user.tenant_id)
        .order('name');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        Alert.alert('Error', 'Failed to load student data. Please try again.');
        return;
      }

      // 🔒 Fetch fee structure with tenant validation
      const { data: feeStructureData, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classData.id)
        .eq('academic_year', selectedAcademicYear)
        .eq('tenant_id', user.tenant_id);

      if (feeError) {
        console.error('Error fetching fee structure:', feeError);
      }

      setFeeComponents(feeStructureData || []);

      // 🔒 Fetch all payments with tenant validation
      const { data: paymentsData, error: paymentsError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .in('student_id', studentsData.map(s => s.id))
        .eq('academic_year', selectedAcademicYear)
        .eq('tenant_id', user.tenant_id);

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
      }

      // 🔒 Fetch concessions with tenant validation
      const { data: concessionsData, error: concessionsError } = await supabase
        .from(TABLES.STUDENT_CONCESSIONS)
        .select('*')
        .in('student_id', studentsData.map(s => s.id))
        .eq('academic_year', selectedAcademicYear)
        .eq('tenant_id', user.tenant_id);

      if (concessionsError) {
        console.error('Error fetching concessions:', concessionsError);
      }

      // Calculate financial details for each student
      const enrichedStudents = studentsData.map(student => {
        const studentPayments = (paymentsData || []).filter(p => p.student_id === student.id);
        const studentConcessions = (concessionsData || []).filter(c => c.student_id === student.id);

        // Calculate total fees from fee structure
        const totalFees = (feeStructureData || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);

        // Calculate total concessions (fixed amounts, not percentages)
        const totalConcessions = studentConcessions.reduce((sum, concession) => {
          return sum + (parseFloat(concession.concession_amount) || 0);
        }, 0);

        // Calculate total payments made
        const totalPaid = studentPayments.reduce((sum, payment) => {
          return sum + (parseFloat(payment.amount_paid) || 0);
        }, 0);

        // Outstanding = (Total Fees - Concessions) - Total Paid
        const outstanding = Math.max(0, (totalFees - totalConcessions) - totalPaid);

        return {
          ...student,
          totalFees: totalFees,
          totalConcessions: totalConcessions,
          totalPaid: totalPaid,
          outstanding: outstanding,
          payments: studentPayments,
          concessions: studentConcessions,
          paymentStatus: outstanding > 0 ? 'pending' : 'paid'
        };
      });

      setStudents(enrichedStudents);

    } catch (error) {
      console.error('Error in loadStudentData:', error);
      Alert.alert('Error', 'Failed to load data. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [classData?.id, selectedAcademicYear, user?.tenant_id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStudentData();
  };

  const handlePaymentSuccess = async () => {
    // Refresh student data after successful payment
    await loadStudentData();
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.admission_no && student.admission_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (student.roll_no && student.roll_no.toString().includes(searchQuery))
  );

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'overdue': return '#F44336';
      default: return '#666';
    }
  };

  const renderStudentItem = ({ item: student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentDetails}>
            Roll: {student.roll_no || 'N/A'} | Admission: {student.admission_no || 'N/A'}
          </Text>
          {student.phone && (
            <Text style={styles.studentContact}>📱 {student.phone}</Text>
          )}
        </View>
        <View style={styles.statusBadge}>
          <View style={[
            styles.statusDot,
            { backgroundColor: getPaymentStatusColor(student.paymentStatus) }
          ]} />
          <Text style={[
            styles.statusText,
            { color: getPaymentStatusColor(student.paymentStatus) }
          ]}>
            {student.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.feeBreakdown}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Total Fees:</Text>
          <Text style={styles.feeValue}>{formatCurrency(student.totalFees)}</Text>
        </View>
        
        {student.totalConcessions > 0 && (
          <View style={styles.feeRow}>
            <Text style={[styles.feeLabel, styles.concessionText]}>Concession:</Text>
            <Text style={[styles.feeValue, styles.concessionText]}>
              -{formatCurrency(student.totalConcessions)}
            </Text>
          </View>
        )}
        
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Paid Amount:</Text>
          <Text style={[styles.feeValue, { color: '#4CAF50' }]}>
            {formatCurrency(student.totalPaid)}
          </Text>
        </View>
        
        <View style={[styles.feeRow, styles.outstandingRow]}>
          <Text style={styles.outstandingLabel}>Outstanding:</Text>
          <Text style={[
            styles.outstandingValue,
            { color: student.outstanding > 0 ? '#F44336' : '#4CAF50' }
          ]}>
            {formatCurrency(student.outstanding)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.paymentButton,
            student.outstanding <= 0 && styles.paymentButtonDisabled
          ]}
          onPress={() => {
            if (student.outstanding > 0) {
              setSelectedStudent(student);
              setShowPaymentModal(true);
            } else {
              Alert.alert('No Payment Due', 'This student has no outstanding amount.');
            }
          }}
          disabled={student.outstanding <= 0}
        >
          <Ionicons
            name={student.outstanding > 0 ? "card" : "checkmark-circle"}
            size={18}
            color="#fff"
          />
          <Text style={styles.paymentButtonText}>
            {student.outstanding > 0 ? 'Record Payment' : 'Paid'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => {
            if (student.payments.length === 0) {
              Alert.alert('No History', 'No payment history found for this student.');
              return;
            }

            const paymentHistory = student.payments
              .map(payment => `${payment.fee_component}: ${formatCurrency(payment.amount_paid)} (${payment.payment_date})`)
              .join('\n');

            Alert.alert(
              `Payment History - ${student.name}`,
              paymentHistory,
              [{ text: 'OK' }]
            );
          }}
        >
          <Ionicons name="time" size={18} color="#2196F3" />
          <Text style={styles.historyButtonText}>History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="school" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Students Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery ? 'Try adjusting your search terms' : 'No students in this class yet'}
      </Text>
    </View>
  );

  const renderSummaryStats = () => {
    const totalStudents = students.length;
    const paidStudents = students.filter(s => s.paymentStatus === 'paid').length;
    const totalOutstanding = students.reduce((sum, s) => sum + s.outstanding, 0);
    const totalCollected = students.reduce((sum, s) => sum + s.totalPaid, 0);

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Class Fee Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalStudents}</Text>
            <Text style={styles.summaryLabel}>Total Students</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{paidStudents}</Text>
            <Text style={styles.summaryLabel}>Paid</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#F44336' }]}>
              {formatCurrency(totalOutstanding)}
            </Text>
            <Text style={styles.summaryLabel}>Outstanding</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
              {formatCurrency(totalCollected)}
            </Text>
            <Text style={styles.summaryLabel}>Collected</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading fee management...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students by name, roll no, or admission no..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearSearchButton}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary Stats */}
      {!searchQuery && renderSummaryStats()}

      {/* Student List */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderStudentItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2196F3"
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Payment Modal */}
      <WebPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedStudent(null);
        }}
        selectedStudent={selectedStudent}
        classData={classData}
        user={user}
        onPaymentSuccess={handlePaymentSuccess}
        feeComponents={feeComponents}
      />
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 4,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  studentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  studentContact: {
    fontSize: 12,
    color: '#888',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feeBreakdown: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  concessionText: {
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  outstandingRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  outstandingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  outstandingValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  paymentButtonDisabled: {
    backgroundColor: '#ccc',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  historyButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default WebFeeManagement;
