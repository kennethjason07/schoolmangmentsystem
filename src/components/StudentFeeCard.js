import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/helpers';
import FeeService from '../services/FeeService';

/**
 * Enhanced StudentFeeCard component that displays comprehensive fee information
 * including base fees, applied discounts, and final amounts
 */
const StudentFeeCard = ({ 
  studentId, 
  studentName, 
  className,
  onPress, 
  onDiscountManage,
  showDiscountButton = false,
  showPaymentButton = true,
  compact = false 
}) => {
  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStudentFees();
  }, [studentId]);

  const loadStudentFees = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🏦 StudentFeeCard: Loading fees for student:', studentId);
      
      const result = await FeeService.getStudentFeeDetails(studentId, {
        includePaymentHistory: true,
        includeFeeBreakdown: true
      });
      
      if (result.success) {
        setFeeData(result.data);
        console.log('✅ StudentFeeCard: Fee data loaded successfully');
        console.log('   Total Due: ₹' + result.data.fees.totalDue);
        console.log('   Total Discounts: ₹' + result.data.fees.totalDiscounts);
        console.log('   Outstanding: ₹' + result.data.fees.totalOutstanding);
      } else {
        setError(result.error);
        console.error('❌ StudentFeeCard: Failed to load fee data:', result.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to load fee information');
      console.error('❌ StudentFeeCard: Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
      case 'fully_paid':
        return '#4CAF50'; // Green
      case 'free':
      case 'Free':
        return '#2196F3'; // Blue for free (due to full concession)
      case 'concession':
      case 'Concession':
        return '#9C27B0'; // Purple for partial concession
      case 'partial':
      case 'partially_paid':
      case 'Partial':
        return '#FF9800'; // Orange
      case 'pending':
      case 'Pending':
      case 'unpaid':
      default:
        return '#F44336'; // Red
    }
  };

  const getStatusText = (status, totalOutstanding, feeData) => {
    // Check for concession-based statuses first
    if (feeData && feeData.fees) {
      const totalConcessions = feeData.fees.totalDiscounts || 0;
      const totalBaseFee = feeData.fees.totalBaseFee || (feeData.fees.totalDue + totalConcessions);
      
      // If concession equals or exceeds total fees, show "Free"
      if (totalConcessions >= totalBaseFee && totalBaseFee > 0) {
        return 'Free';
      }
      
      // If partial concession is applied, show "Concession"
      if (totalConcessions > 0 && totalConcessions < totalBaseFee) {
        return 'Concession';
      }
    }
    
    // Original payment-based logic
    if (totalOutstanding <= 0) return 'Paid';
    if (status === 'partial' || status === 'partially_paid') return 'Partial';
    return 'Pending';
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.loadingText}>Loading fee information...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={20} color="#F44336" />
          <Text style={styles.errorText}>Failed to load fees</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={loadStudentFees}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!feeData) {
    return (
      <View style={styles.card}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No fee data available</Text>
        </View>
      </View>
    );
  }

  const { fees, student, discounts } = feeData;
  const hasDiscounts = discounts.hasDiscounts;
  const statusText = getStatusText(fees.status, fees.totalOutstanding, feeData);
  const statusColor = getStatusColor(statusText);

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Student Header */}
      <View style={styles.header}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {studentName || student.name}
          </Text>
          <Text style={styles.studentDetails}>
            {student.admission_no} • {className || student.class_info?.name}
            {student.class_info?.section ? ` - ${student.class_info.section}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>

      {/* Fee Summary Section */}
      <View style={styles.feeSection}>
        {hasDiscounts && (
          <View style={styles.discountHeader}>
            <Ionicons name="pricetag" size={16} color="#4CAF50" />
            <Text style={styles.discountHeaderText}>
              Discounts Applied • ₹{formatCurrency(fees.totalDiscounts)} saved
            </Text>
          </View>
        )}

        {/* Base Fee Display (if discounts exist) */}
        {hasDiscounts && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Base Fee:</Text>
            <Text style={styles.baseFeeAmount}>
              ₹{formatCurrency(fees.totalBaseFee || fees.totalDue + fees.totalDiscounts)}
            </Text>
          </View>
        )}

        {/* Discount Display (if exists) */}
        {hasDiscounts && (
          <View style={styles.feeRow}>
            <Text style={styles.discountLabel}>
              <Ionicons name="remove-circle" size={14} color="#4CAF50" />
              {' '}Discount:
            </Text>
            <Text style={styles.discountAmount}>
              -₹{formatCurrency(fees.totalDiscounts)}
            </Text>
          </View>
        )}

        {/* Final Amount Due */}
        <View style={[styles.feeRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Amount Due:</Text>
          <Text style={styles.totalAmount}>
            ₹{formatCurrency(fees.totalDue)}
          </Text>
        </View>

        {/* Paid Amount (if any) */}
        {fees.totalPaid > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.paidLabel}>Paid:</Text>
            <Text style={styles.paidAmount}>
              ₹{formatCurrency(fees.totalPaid)}
            </Text>
          </View>
        )}

        {/* Outstanding Amount */}
        {fees.totalOutstanding > 0 && (
          <View style={[styles.feeRow, styles.outstandingRow]}>
            <Text style={styles.outstandingLabel}>Outstanding:</Text>
            <Text style={[styles.outstandingAmount, { color: statusColor }]}>
              ₹{formatCurrency(fees.totalOutstanding)}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons - Only show Pay Now in student/parent views, not admin */}
      {!compact && (
        <View style={styles.actionSection}>
          {/* Pay Button - Show if there's an outstanding amount */}
          {showPaymentButton && fees.totalOutstanding > 0 && (
            <TouchableOpacity 
              style={styles.payButton}
              onPress={() => onPress && onPress('payment')}
            >
              <Ionicons name="card" size={16} color="white" />
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>
          )}
          
          {/* Discount Button - Show if discounts exist or there are fees to manage */}
          {showDiscountButton && (
            <TouchableOpacity 
              style={styles.discountButton}
              onPress={() => onDiscountManage && onDiscountManage(studentId, studentName)}
            >
              <Ionicons name="pricetag-outline" size={16} color="#1976d2" />
              <Text style={styles.discountButtonText}>
                {hasDiscounts ? 'Manage Discounts' : 'Add Discount'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Fee Component Count (for detailed view trigger) */}
      <View style={styles.detailsHint}>
        <Text style={styles.componentCount}>
          {fees.components?.length || 0} fee component{fees.components?.length !== 1 ? 's' : ''}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#666" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F44336',
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  feeSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginBottom: 12,
  },
  discountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
  },
  discountHeaderText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
    color: '#4CAF50',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
  },
  baseFeeAmount: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  discountLabel: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  discountAmount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paidLabel: {
    fontSize: 14,
    color: '#4CAF50',
  },
  paidAmount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  outstandingRow: {
    backgroundColor: '#fafafa',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  outstandingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  outstandingAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  payButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  payButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
  },
  discountButton: {
    flex: 1,
    backgroundColor: '#f0f7ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  discountButtonText: {
    color: '#1976d2',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 12,
  },
  detailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  componentCount: {
    fontSize: 12,
    color: '#666',
  },
});

export default StudentFeeCard;
