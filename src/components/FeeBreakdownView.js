import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/helpers';
import FeeService from '../services/FeeService';

/**
 * Enhanced FeeBreakdownView component that shows detailed fee breakdown
 * including component-wise fees, discounts, payments, and outstanding amounts
 */
const FeeBreakdownView = ({ 
  studentId, 
  studentName,
  onDiscountPress,
  onPaymentPress,
  showActions = true 
}) => {
  const [loading, setLoading] = useState(true);
  const [feeData, setFeeData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedComponents, setExpandedComponents] = useState(new Set());

  useEffect(() => {
    loadFeeDetails();
  }, [studentId]);

  const loadFeeDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await FeeService.getStudentFeeDetails(studentId, {
        includePaymentHistory: true,
        includeFeeBreakdown: true
      });
      
      if (result.success) {
        setFeeData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to load fee details');
    } finally {
      setLoading(false);
    }
  };

  const toggleComponent = (componentName) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(componentName)) {
      newExpanded.delete(componentName);
    } else {
      newExpanded.add(componentName);
    }
    setExpandedComponents(newExpanded);
  };

  const getComponentStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#4CAF50';
      case 'partial': return '#FF9800';
      case 'unpaid': return '#F44336';
      default: return '#666';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading fee breakdown...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadFeeDetails}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!feeData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No fee data available</Text>
      </View>
    );
  }

  const { fees, student, discounts } = feeData;
  const hasDiscounts = discounts.hasDiscounts;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Student Header */}
      <View style={styles.studentHeader}>
        <Text style={styles.studentName}>{studentName || student.name}</Text>
        <Text style={styles.studentDetails}>
          {student.admission_no} • {student.class_info?.name}
          {student.class_info?.section ? ` - ${student.class_info.section}` : ''}
        </Text>
        <Text style={styles.academicYear}>Academic Year: {fees.academicYear}</Text>
      </View>

      {/* Overall Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Fee Summary</Text>
        
        {hasDiscounts && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base Total:</Text>
              <Text style={styles.baseFeeText}>
                ₹{formatCurrency(fees.totalBaseFee || fees.totalDue + fees.totalDiscounts)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.discountLabel}>
                <Ionicons name="pricetag" size={16} color="#4CAF50" />
                {' '}Total Discounts:
              </Text>
              <Text style={styles.discountText}>
                -₹{formatCurrency(fees.totalDiscounts)}
              </Text>
            </View>
            
            <View style={styles.divider} />
          </>
        )}
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelBold}>Amount Due:</Text>
          <Text style={styles.summaryValueBold}>
            ₹{formatCurrency(fees.totalDue)}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Paid:</Text>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            ₹{formatCurrency(fees.totalPaid)}
          </Text>
        </View>
        
        <View style={[styles.summaryRow, styles.outstandingRow]}>
          <Text style={styles.summaryLabelBold}>Outstanding:</Text>
          <Text style={[styles.summaryValueBold, { 
            color: fees.totalOutstanding > 0 ? '#F44336' : '#4CAF50' 
          }]}>
            ₹{formatCurrency(fees.totalOutstanding)}
          </Text>
        </View>
      </View>

      {/* Discount Summary (if applicable) */}
      {hasDiscounts && (
        <View style={styles.discountSummaryCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="pricetag" size={20} color="#4CAF50" />
            <Text style={styles.cardTitle}>Active Discounts</Text>
          </View>
          
          {discounts.activeDiscounts.map((discount, index) => (
            <View key={index} style={styles.discountItem}>
              <View style={styles.discountInfo}>
                <Text style={styles.discountComponent}>
                  {discount.component || 'All Components'}
                </Text>
                <Text style={styles.discountReason}>
                  {discount.reason || 'No reason specified'}
                </Text>
              </View>
              <View style={styles.discountValue}>
                <Text style={styles.discountValueText}>
                  {discount.type === 'percentage' ? `${discount.value}%` : `₹${discount.value}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Component-wise Breakdown */}
      <View style={styles.componentsCard}>
        <Text style={styles.cardTitle}>Fee Components</Text>
        
        {fees.components?.map((component, index) => (
          <View key={index} style={styles.componentContainer}>
            <TouchableOpacity
              style={styles.componentHeader}
              onPress={() => toggleComponent(component.component)}
            >
              <View style={styles.componentInfo}>
                <Text style={styles.componentName}>{component.component}</Text>
                <Text style={styles.componentDueDate}>
                  Due: {formatDate(component.dueDate)}
                </Text>
              </View>
              
              <View style={styles.componentSummary}>
                <Text style={[styles.componentStatus, {
                  color: getComponentStatusColor(component.status)
                }]}>
                  {component.status?.charAt(0).toUpperCase() + component.status?.slice(1)}
                </Text>
                <Text style={styles.componentAmount}>
                  ₹{formatCurrency(component.finalAmount)}
                </Text>
                <Ionicons 
                  name={expandedComponents.has(component.component) ? 
                    "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#666" 
                />
              </View>
            </TouchableOpacity>

            {expandedComponents.has(component.component) && (
              <View style={styles.componentDetails}>
                {/* Base Fee */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Base Fee:</Text>
                  <Text style={styles.detailValue}>
                    ₹{formatCurrency(component.baseFee)}
                  </Text>
                </View>

                {/* Discount (if applicable) */}
                {component.discount > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: '#4CAF50' }]}>
                      Discount:
                    </Text>
                    <Text style={[styles.detailValue, { color: '#4CAF50' }]}>
                      -₹{formatCurrency(component.discount)}
                    </Text>
                  </View>
                )}

                {/* Final Amount */}
                <View style={[styles.detailRow, styles.finalAmountRow]}>
                  <Text style={styles.detailLabelBold}>Final Amount:</Text>
                  <Text style={styles.detailValueBold}>
                    ₹{formatCurrency(component.finalAmount)}
                  </Text>
                </View>

                {/* Payment Status */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Paid:</Text>
                  <Text style={[styles.detailValue, { color: '#4CAF50' }]}>
                    ₹{formatCurrency(component.paidAmount)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Outstanding:</Text>
                  <Text style={[styles.detailValue, {
                    color: component.outstandingAmount > 0 ? '#F44336' : '#4CAF50'
                  }]}>
                    ₹{formatCurrency(component.outstandingAmount)}
                  </Text>
                </View>

                {/* Applied Discounts */}
                {component.appliedDiscounts && component.appliedDiscounts.length > 0 && (
                  <View style={styles.appliedDiscountsSection}>
                    <Text style={styles.appliedDiscountsTitle}>Applied Discounts:</Text>
                    {component.appliedDiscounts.map((discount, discountIndex) => (
                      <View key={discountIndex} style={styles.appliedDiscount}>
                        <Text style={styles.appliedDiscountType}>
                          {discount.type === 'percentage' ? 
                            `${discount.value}% discount` : 
                            `₹${discount.value} discount`}
                        </Text>
                        {discount.reason && (
                          <Text style={styles.appliedDiscountReason}>
                            {discount.reason}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Payment History for this component */}
                {component.payments && component.payments.length > 0 && (
                  <View style={styles.paymentHistorySection}>
                    <Text style={styles.paymentHistoryTitle}>Payment History:</Text>
                    {component.payments.map((payment, paymentIndex) => (
                      <View key={paymentIndex} style={styles.paymentItem}>
                        <View style={styles.paymentDetails}>
                          <Text style={styles.paymentAmount}>
                            ₹{formatCurrency(payment.amount)}
                          </Text>
                          <Text style={styles.paymentDate}>
                            {formatDate(payment.date)}
                          </Text>
                        </View>
                        <View style={styles.paymentMeta}>
                          <Text style={styles.paymentMode}>
                            {payment.mode || 'Not specified'}
                          </Text>
                          {payment.receipt && (
                            <Text style={styles.receiptNumber}>
                              #{payment.receipt}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action buttons for this component */}
                {showActions && component.outstandingAmount > 0 && (
                  <View style={styles.componentActions}>
                    <TouchableOpacity
                      style={styles.payComponentButton}
                      onPress={() => onPaymentPress && onPaymentPress(component)}
                    >
                      <Ionicons name="card" size={16} color="white" />
                      <Text style={styles.actionButtonText}>Pay Now</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Global Action Buttons */}
      {showActions && (
        <View style={styles.globalActions}>
          {fees.totalOutstanding > 0 && (
            <TouchableOpacity
              style={styles.payAllButton}
              onPress={() => onPaymentPress && onPaymentPress('all')}
            >
              <Ionicons name="card" size={18} color="white" />
              <Text style={styles.payAllButtonText}>
                Pay All Outstanding (₹{formatCurrency(fees.totalOutstanding)})
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.manageDiscountsButton}
            onPress={() => onDiscountPress && onDiscountPress(studentId)}
          >
            <Ionicons name="pricetag-outline" size={18} color="#1976d2" />
            <Text style={styles.manageDiscountsButtonText}>
              {hasDiscounts ? 'Manage Discounts' : 'Add Discount'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
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
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  studentHeader: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  academicYear: {
    fontSize: 12,
    color: '#999',
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  baseFeeText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  discountLabel: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  discountText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  outstandingRow: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  discountSummaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  discountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  discountInfo: {
    flex: 1,
  },
  discountComponent: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  discountReason: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  discountValue: {
    alignItems: 'flex-end',
  },
  discountValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  componentsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  componentContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
  },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  componentInfo: {
    flex: 1,
  },
  componentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  componentDueDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  componentSummary: {
    alignItems: 'flex-end',
  },
  componentStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  componentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  componentDetails: {
    paddingLeft: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f8f9fa',
    marginTop: 8,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailLabelBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  finalAmountRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 6,
    marginTop: 4,
  },
  appliedDiscountsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  appliedDiscountsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  appliedDiscount: {
    paddingLeft: 8,
  },
  appliedDiscountType: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  appliedDiscountReason: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  paymentHistorySection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paymentHistoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingLeft: 8,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4CAF50',
  },
  paymentDate: {
    fontSize: 10,
    color: '#666',
  },
  paymentMeta: {
    alignItems: 'flex-end',
  },
  paymentMode: {
    fontSize: 10,
    color: '#666',
  },
  receiptNumber: {
    fontSize: 9,
    color: '#999',
  },
  componentActions: {
    marginTop: 8,
  },
  payComponentButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 4,
    fontSize: 12,
  },
  globalActions: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  payAllButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  payAllButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 16,
  },
  manageDiscountsButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  manageDiscountsButtonText: {
    color: '#1976d2',
    fontWeight: '600',
    marginLeft: 6,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default FeeBreakdownView;
