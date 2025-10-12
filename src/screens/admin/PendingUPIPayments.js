import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import Header from '../../components/Header';
import { UPIDBService } from '../../services/UPIDBService';
import { useAuth } from '../../utils/AuthContext';
import { useTenantAccess } from '../../contexts/TenantContext';
import { formatReferenceNumberForDisplay, validateReferenceNumberFormat } from '../../utils/referenceNumberGenerator';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';

const { width } = Dimensions.get('window');

const PendingUPIPayments = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // State management
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Verification form state
  const [verificationData, setVerificationData] = useState({
    action: 'APPROVE', // 'APPROVE' or 'REJECT'
    adminRemarks: '',
    verifiedAmount: '',
  });
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'PENDING', 'VERIFIED', 'REJECTED'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setLoading(true);
      
      // Use email-based tenant system - let the service handle tenant lookup
      console.log('🏢 PendingUPIPayments - Loading payments with email-based tenant system');
      
      const rawPayments = await UPIDBService.getPendingPaymentConfirmations(tenantId);
      
      // Transform the data to match the UI expectations
      const transformedPayments = rawPayments.map(payment => ({
        id: payment.id,
        studentName: payment.student?.name || 'Unknown Student',
        studentClass: payment.student?.class ? 
          `${payment.student.class.class_name} ${payment.student.class.section}` : 'N/A',
        amount: payment.amount,
        feeComponent: payment.fee_component,
        utrNumber: payment.reference_number, // Use reference_number as UTR
        remarks: payment.verification_notes || '',
        status: payment.payment_status,
        submittedAt: payment.updated_at,
        paymentDate: payment.payment_date,
        // Raw data for further processing
        studentId: payment.student_id,
        tenantId: payment.tenant_id,
        academicYear: payment.academic_year
      }));
      
      console.log(`✅ Loaded ${transformedPayments.length} pending payments`);
      setPendingPayments(transformedPayments);
    } catch (error) {
      console.error('Error loading pending payments:', error);
      Alert.alert('Error', 'Failed to load pending payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingPayments();
    setRefreshing(false);
  };

  const openVerificationModal = (payment) => {
    setSelectedPayment(payment);
    setVerificationData({
      action: 'APPROVE',
      adminRemarks: '',
      verifiedAmount: payment.amount ? payment.amount.toString() : '0',
    });
    setVerificationModalVisible(true);
  };

  const closeVerificationModal = () => {
    setVerificationModalVisible(false);
    setSelectedPayment(null);
    setVerificationData({
      action: 'APPROVE',
      adminRemarks: '',
      verifiedAmount: '',
    });
  };

  const handleDirectApprove = async (payment) => {
    Alert.alert(
      'Approve Payment',
      `Are you sure you want to approve this payment of ₹${payment.amount} for ${payment.studentName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setProcessing(true);
            try {
              const verificationPayload = {
                confirmationId: payment.id,
                action: 'APPROVE',
                adminId: user.id,
                adminRemarks: `Payment approved directly by admin on ${new Date().toLocaleDateString()}`,
                verifiedAmount: payment.amount,
                tenantId: tenantId
              };

              await UPIDBService.verifyStudentPaymentConfirmation(verificationPayload);
              
              Alert.alert('Success', 'Payment approved successfully!');
              // Reload pending payments
              await loadPendingPayments();
              
            } catch (error) {
              console.error('Error approving payment:', error);
              Alert.alert('Error', 'Failed to approve payment. Please try again.');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleVerifyPayment = async () => {
    if (!selectedPayment || processing) return; // Prevent multiple clicks

    // Validation
    if (!verificationData.adminRemarks.trim()) {
      Alert.alert('Invalid Input', 'Please provide admin remarks for verification.');
      return;
    }

    // Validate reference number format
    if (selectedPayment.utrNumber && !validateReferenceNumberFormat(selectedPayment.utrNumber)) {
      Alert.alert(
        'Invalid Reference Number',
        'The reference number format is invalid. Expected format: 6 alphanumeric characters (4 letters + 2 numbers mixed).\n\nPlease contact technical support if this error persists.'
      );
      return;
    }

    if (verificationData.action === 'APPROVE') {
      const amount = parseFloat(verificationData.verifiedAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid verification amount.');
        return;
      }
      
      if (amount > selectedPayment.amount) {
        Alert.alert('Invalid Amount', 'Verified amount cannot be greater than the claimed amount.');
        return;
      }
    }

    setProcessing(true);

    try {
      const verificationPayload = {
        confirmationId: selectedPayment.id,
        action: verificationData.action,
        adminId: user.id,
        adminRemarks: verificationData.adminRemarks,
        verifiedAmount: verificationData.action === 'APPROVE' ? parseFloat(verificationData.verifiedAmount) : 0,
        tenantId: tenantId
      };

      await UPIDBService.verifyStudentPaymentConfirmation(verificationPayload);
      
      Alert.alert(
        'Payment Verified',
        `Payment has been ${verificationData.action.toLowerCase()}d successfully.`,
        [{ text: 'OK', onPress: () => closeVerificationModal() }]
      );

      // Reload pending payments
      await loadPendingPayments();
      
    } catch (error) {
      console.error('Error verifying payment:', error);
      Alert.alert('Error', 'Failed to verify payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING_ADMIN_VERIFICATION': return '#FF9800';
      case 'SUCCESS': return '#4CAF50'; // This is 'Approved' in the database
      case 'FAILED': return '#F44336';  // This is 'Rejected' in the database
      case 'PENDING': return '#2196F3';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING_ADMIN_VERIFICATION': return 'Pending';
      case 'SUCCESS': return 'Approved'; // Map SUCCESS to 'Approved' for display
      case 'FAILED': return 'Rejected';  // Map FAILED to 'Rejected' for display
      case 'PENDING': return 'Pending';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter payments based on status and search
  const filteredPayments = pendingPayments.filter(payment => {
    // Debug: Log status comparison
    if (filterStatus !== 'ALL') {
      console.log('🔍 Filtering:', { 
        filterStatus, 
        paymentStatus: payment.status, 
        matches: payment.status === filterStatus,
        paymentId: payment.id,
        studentName: payment.studentName
      });
    }
    
    const matchesStatus = filterStatus === 'ALL' || payment.status === filterStatus;
    const matchesSearch = !searchQuery || 
      payment.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.utrNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.feeComponent?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });
  
  // Debug: Log filtering results
  console.log('📊 Filter Results:', {
    filterStatus,
    searchQuery,
    totalPayments: pendingPayments.length,
    filteredCount: filteredPayments.length,
    uniqueStatuses: [...new Set(pendingPayments.map(p => p.status))]
  });

  const renderPaymentItem = ({ item }) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.studentName || 'Unknown Student'}</Text>
          <Text style={styles.studentClass}>{item.studentClass || 'N/A'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fee Type:</Text>
          <Text style={styles.detailValue}>{item.feeComponent || 'General Fee'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount:</Text>
          <Text style={[styles.detailValue, styles.amountText]}>₹{item.amount || 0}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Reference Number:</Text>
          <Text style={[styles.detailValue, styles.referenceNumber]}>
            {item.utrNumber ? formatReferenceNumberForDisplay(item.utrNumber) : 'N/A'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Submitted:</Text>
          <Text style={styles.detailValue}>{formatDate(item.submittedAt)}</Text>
        </View>
        {item.remarks && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Student Remarks:</Text>
            <Text style={styles.detailValue}>{item.remarks}</Text>
          </View>
        )}
      </View>

      {item.status === 'PENDING_ADMIN_VERIFICATION' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleDirectApprove(item)}
            disabled={processing}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              setVerificationData(prev => ({ ...prev, action: 'REJECT' }));
              openVerificationModal(item);
            }}
          >
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student, UTR, or fee type..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
        {['ALL', 'PENDING_ADMIN_VERIFICATION', 'SUCCESS', 'FAILED'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && styles.activeFilterButton
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[
              styles.filterButtonText,
              filterStatus === status && styles.activeFilterButtonText
            ]}>
              {status === 'ALL' ? 'All' : 
               status === 'PENDING_ADMIN_VERIFICATION' ? 'Pending' :
               status === 'SUCCESS' ? 'Approved' :
               status === 'FAILED' ? 'Rejected' :
               status.charAt(0) + status.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Pending UPI Payments" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading pending payments...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Pending UPI Payments" showBack={true} />
      
      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingPayments.filter(p => p.status === 'PENDING_ADMIN_VERIFICATION').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingPayments.filter(p => p.status === 'SUCCESS').length}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingPayments.filter(p => p.status === 'FAILED').length}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            ₹{pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Total Amount</Text>
        </View>
      </View>

      {/* Filters */}
      {renderFilters()}

      {/* Payment List */}
      <FlatList
        data={filteredPayments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        bounces={true}
        contentContainerStyle={styles.paymentsList}
        style={styles.flatListStyle}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        getItemLayout={(data, index) => ({
          length: 200, // Approximate item height
          offset: 200 * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            progressBackgroundColor="#fff"
            tintColor="#2196F3"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No pending payments found</Text>
            <Text style={styles.emptySubtext}>Student payment confirmations will appear here</Text>
          </View>
        }
        ListHeaderComponent={() => (
          filteredPayments.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          ) : null
        )}
        ListFooterComponent={() => (
          filteredPayments.length > 5 ? (
            <View style={styles.listFooter}>
              <Text style={styles.listFooterText}>
                End of payments list
              </Text>
            </View>
          ) : null
        )}
      />

      {/* Verification Modal */}
      <Modal
        visible={verificationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeVerificationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {verificationData.action === 'APPROVE' ? 'Approve Payment' : 'Reject Payment'}
              </Text>
              <TouchableOpacity onPress={closeVerificationModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedPayment && (
              <ScrollView 
                style={styles.modalContent}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Payment Summary */}
                <View style={styles.paymentSummary}>
                  <Text style={styles.summaryTitle}>Payment Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Student:</Text>
                    <Text style={styles.summaryValue}>{selectedPayment.studentName}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Fee Type:</Text>
                    <Text style={styles.summaryValue}>{selectedPayment.feeComponent}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Claimed Amount:</Text>
                    <Text style={[styles.summaryValue, styles.amountHighlight]}>₹{selectedPayment.amount}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reference Number:</Text>
                    <Text style={[styles.summaryValue, styles.referenceNumber]}>
                      {selectedPayment.utrNumber ? formatReferenceNumberForDisplay(selectedPayment.utrNumber) : 'N/A'}
                    </Text>
                  </View>
                  {selectedPayment.remarks && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Student Remarks:</Text>
                      <Text style={styles.summaryValue}>{selectedPayment.remarks}</Text>
                    </View>
                  )}
                </View>

                {/* Verification Form */}
                <View style={styles.verificationForm}>
                  <Text style={styles.formTitle}>Verification Details</Text>
                  
                  {/* Action Selection */}
                  <View style={styles.actionSelection}>
                    <TouchableOpacity
                      style={[
                        styles.actionOption,
                        verificationData.action === 'APPROVE' && styles.selectedAction
                      ]}
                      onPress={() => setVerificationData({...verificationData, action: 'APPROVE'})}
                    >
                      <Ionicons 
                        name="checkmark-circle" 
                        size={24} 
                        color={verificationData.action === 'APPROVE' ? '#4CAF50' : '#ccc'} 
                      />
                      <Text style={[
                        styles.actionText,
                        verificationData.action === 'APPROVE' && styles.selectedActionText
                      ]}>
                        Approve Payment
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.actionOption,
                        verificationData.action === 'REJECT' && styles.selectedAction
                      ]}
                      onPress={() => setVerificationData({...verificationData, action: 'REJECT'})}
                    >
                      <Ionicons 
                        name="close-circle" 
                        size={24} 
                        color={verificationData.action === 'REJECT' ? '#F44336' : '#ccc'} 
                      />
                      <Text style={[
                        styles.actionText,
                        verificationData.action === 'REJECT' && styles.selectedActionText
                      ]}>
                        Reject Payment
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Verified Amount (only for approval) */}
                  {verificationData.action === 'APPROVE' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Verified Amount *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={verificationData.verifiedAmount}
                        onChangeText={(text) => setVerificationData({...verificationData, verifiedAmount: text})}
                        keyboardType="numeric"
                        placeholder="Enter verified amount"
                        editable={!processing}
                      />
                    </View>
                  )}

                  {/* Admin Remarks */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Admin Remarks *</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={verificationData.adminRemarks}
                      onChangeText={(text) => setVerificationData({...verificationData, adminRemarks: text})}
                      placeholder={verificationData.action === 'APPROVE' ? 
                        'Payment verified and approved...' : 
                        'Reason for rejection...'}
                      multiline
                      numberOfLines={3}
                      editable={!processing}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={closeVerificationModal}
                    disabled={processing}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      verificationData.action === 'APPROVE' ? styles.approveButton : styles.rejectButton,
                      processing && styles.processingButton
                    ]}
                    onPress={handleVerifyPayment}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons 
                          name={verificationData.action === 'APPROVE' ? 'checkmark' : 'close'} 
                          size={20} 
                          color="#fff" 
                        />
                        <Text style={styles.confirmButtonText}>
                          {verificationData.action === 'APPROVE' ? 'Approve Payment' : 'Reject Payment'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  statusFilters: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  flatListStyle: {
    flex: 1,
  },
  paymentsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100, // Extra padding for better scroll experience
    flexGrow: 1,
  },
  listHeader: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  listFooter: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  listFooterText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  paymentCard: {
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
  paymentHeader: {
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
  },
  studentClass: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  amountText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  referenceNumber: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  customButton: {
    backgroundColor: '#2196F3',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  paymentSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  amountHighlight: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  verificationForm: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionSelection: {
    marginBottom: 16,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedAction: {
    borderColor: '#2196F3',
    backgroundColor: '#f3f8ff',
  },
  actionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  selectedActionText: {
    color: '#333',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  processingButton: {
    backgroundColor: '#bbb',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default PendingUPIPayments;
