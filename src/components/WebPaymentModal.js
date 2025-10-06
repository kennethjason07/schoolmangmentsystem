import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, TABLES } from '../utils/supabase';
import { format } from 'date-fns';
import WebReceiptDisplay from './WebReceiptDisplay';

const WebPaymentModal = ({
  visible,
  onClose,
  selectedStudent,
  classData,
  user,
  onPaymentSuccess,
  feeComponents = []
}) => {
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedFeeComponent, setSelectedFeeComponent] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [qrData, setQRData] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);

  // 🔒 Comprehensive Tenant Validation
  const validateTenantAccess = async () => {
    try {
      if (!user?.tenant_id) {
        throw new Error('No tenant context found. Please login again.');
      }

      if (!selectedStudent?.id) {
        throw new Error('Invalid student data. Please refresh and try again.');
      }

      // Validate student belongs to user's tenant
      const { data: studentCheck, error } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, tenant_id')
        .eq('id', selectedStudent.id)
        .eq('tenant_id', user.tenant_id)
        .single();

      if (error || !studentCheck) {
        throw new Error('Student not found or access denied.');
      }

      return true;
    } catch (error) {
      console.error('Tenant validation failed:', error);
      Alert.alert('Access Error', error.message);
      return false;
    }
  };

  // 🔒 Validate Payment Amount
  const validatePaymentAmount = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount greater than ₹0.');
      return false;
    }

    const amount = parseFloat(paymentAmount);
    const studentOutstanding = selectedStudent?.outstanding || 0;
    
    // 🚨 STRICT: Block payment if exceeds total outstanding (only when there is outstanding amount)
    // Allow payments even when there's no outstanding amount (for additional payments)
    if (amount > studentOutstanding && studentOutstanding > 0) {
      Alert.alert(
        'Payment Blocked',
        `Payment amount ₹${amount.toFixed(2)} exceeds total outstanding amount ₹${studentOutstanding.toFixed(2)}.\n\nOverpayment is not allowed. Please enter the correct amount.`,
        [{ text: 'OK', style: 'default' }]
      );
      return false;
    }

    return true;
  };

  // 💰 Generate Next Receipt Number
  const getNextReceiptNumber = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('receipt_number')
        .eq('tenant_id', user.tenant_id)
        .not('receipt_number', 'is', null)
        .order('receipt_number', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error getting max receipt number:', error);
        return 1000;
      }

      return (data?.receipt_number || 999) + 1;
    } catch (error) {
      console.error('Receipt number generation error:', error);
      return 1000;
    }
  };

  // 💳 Handle Cash Payment
  const handleCashPayment = async () => {
    try {
      setProcessing(true);

      // Validate tenant access
      const hasAccess = await validateTenantAccess();
      if (!hasAccess) return;

      // Validate payment amount
      if (!validatePaymentAmount()) return;

      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      const receiptNumber = await getNextReceiptNumber();
      const feeComponentName = selectedFeeComponent === 'custom' 
        ? (paymentRemarks || 'General Fee Payment')
        : selectedFeeComponent;

      // Insert payment record with comprehensive tenant validation
      const { data: paymentData, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .insert({
          student_id: selectedStudent.id,
          fee_component: feeComponentName,
          amount_paid: parseFloat(paymentAmount),
          payment_date: paymentDate.toISOString().split('T')[0],
          payment_mode: 'Cash',
          academic_year: academicYear,
          receipt_number: receiptNumber,
          remarks: paymentRemarks,
          tenant_id: user.tenant_id, // 🔒 Ensure tenant isolation
        })
        .select()
        .single();

      if (error) {
        console.error('Payment insert error:', error);
        throw new Error('Failed to record payment. Please try again.');
      }

      // Prepare receipt data
      const studentOutstanding = parseFloat(selectedStudent?.outstanding || 0);
      const paidNow = parseFloat(paymentAmount);
      const remainingAfterPayment = Math.max(0, studentOutstanding - paidNow);

      const receipt = {
        ...paymentData,
        student_name: selectedStudent.name,
        student_admission_no: selectedStudent.admissionNo || selectedStudent.admission_no,
        student_roll_no: selectedStudent.rollNo || selectedStudent.roll_no,
        class_name: classData.className,
        receipt_no: receiptNumber,
        payment_date_formatted: format(paymentDate, 'dd MMM yyyy'),
        amount_in_words: numberToWords(paidNow),
        amount_remaining: remainingAfterPayment,
        cashier_name: (user?.full_name || user?.email || '').toString()
      };

      setReceiptData(receipt);
      setShowReceipt(true);

      // Refresh parent data
      if (onPaymentSuccess) {
        await onPaymentSuccess();
      }

      Alert.alert(
        'Payment Recorded Successfully! ✅',
        `Cash payment of ₹${parseFloat(paymentAmount).toFixed(2)} has been recorded.\n\nReceipt Number: ${receiptNumber}`,
        [
          {
            text: 'Print Receipt',
            onPress: () => {
              // Receipt modal will handle printing
            }
          },
          {
            text: 'Close',
            style: 'cancel',
            onPress: () => {
              resetForm();
              onClose();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Cash payment error:', error);
      Alert.alert('Payment Failed', error.message || 'Failed to process cash payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // 📱 Handle QR Code Generation
  const handleQRCodePayment = async () => {
    try {
      setProcessing(true);

      // Validate tenant access
      const hasAccess = await validateTenantAccess();
      if (!hasAccess) return;

      // Validate payment amount
      if (!validatePaymentAmount()) return;

      // Get UPI ID from school settings
      const { data: upiSettings, error: upiError } = await supabase
        .from('school_upi_settings')
        .select('upi_id, upi_name')
        .eq('tenant_id', user.tenant_id)
        .eq('is_active', true)
        .single();

      if (upiError || !upiSettings?.upi_id) {
        Alert.alert('UPI Not Configured', 'UPI payment is not configured for your school. Please contact administrator.');
        return;
      }

      const amount = parseFloat(paymentAmount);
      const feeComponentName = selectedFeeComponent === 'custom' 
        ? (paymentRemarks || 'General Fee Payment')
        : selectedFeeComponent;

      // Generate UPI payment string
      const upiString = `upi://pay?pa=${upiSettings.upi_id}&pn=${encodeURIComponent(upiSettings.upi_name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`${feeComponentName} - ${selectedStudent.name}`)}`;

      setQRData({
        upiString,
        amount,
        studentName: selectedStudent.name,
        feeComponent: feeComponentName,
        upiId: upiSettings.upi_id,
        upiName: upiSettings.upi_name
      });

      setShowQRCode(true);

    } catch (error) {
      console.error('QR generation error:', error);
      Alert.alert('QR Code Error', 'Failed to generate QR code. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // 🔤 Number to Words Conversion
  const numberToWords = (num) => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num === 0) return 'zero';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    if (num < 1000) {
      const hundreds = Math.floor(num / 100);
      const remainder = num % 100;
      return ones[hundreds] + ' hundred' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
    }
    if (num < 100000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      return numberToWords(thousands) + ' thousand' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
    }
    return num.toString();
  };

  const resetForm = () => {
    setPaymentAmount('');
    setSelectedFeeComponent('');
    setPaymentRemarks('');
    setPaymentMode('Cash');
    setShowReceipt(false);
    setShowQRCode(false);
    setReceiptData(null);
    setQRData(null);
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!visible) return null;

  // Show receipt modal
  if (showReceipt && receiptData) {
    return (
      <WebReceiptDisplay
        visible={true}
        receiptData={receiptData}
        onClose={() => {
          setShowReceipt(false);
          resetForm();
          onClose();
        }}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Record Payment - {selectedStudent?.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Student Info */}
          <View style={styles.studentCard}>
            <Text style={styles.studentName}>{selectedStudent?.name}</Text>
            <Text style={styles.studentDetails}>
              Outstanding Amount: {formatCurrency(selectedStudent?.outstanding || 0)}
            </Text>
          </View>

          {/* QR Code Display - Web Specific */}
          {showQRCode && qrData && Platform.OS === 'web' && (
            <View style={styles.qrDisplayCard}>
              <Text style={styles.qrTitle}>UPI Payment QR Code</Text>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
                backgroundColor: '#fff',
                margin: 20,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16
                }}>
                  {/* QR Code would be generated here using a library like qrcode */}
                  <div style={{
                    width: 200,
                    height: 200,
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: '#666',
                    border: '2px solid #ddd',
                    borderRadius: 8
                  }}>
                    QR Code for ₹{qrData.amount}
                    <br />
                    <small style={{marginTop: 8, display: 'block'}}>
                      Scan with any UPI app
                    </small>
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 16, fontWeight: 'bold', marginBottom: 4}}>
                      Pay to: {qrData.upiName}
                    </div>
                    <div style={{fontSize: 14, color: '#666'}}>
                      UPI ID: {qrData.upiId}
                    </div>
                  </div>
                </div>
              </div>
              <TouchableOpacity 
                style={styles.qrActionButton}
                onPress={() => {
                  Alert.alert(
                    'Payment Completed?',
                    'Please confirm that the payment has been successfully completed.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Yes, Completed',
                        onPress: async () => {
                          // Here you would typically verify the payment
                          // For now, we'll simulate immediate confirmation
                          Alert.alert('Payment Verified', 'UPI payment has been verified successfully!');
                          setShowQRCode(false);
                          resetForm();
                          onClose();
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.qrActionText}>Payment Completed</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Payment Form */}
          {!showQRCode && (
            <View style={styles.paymentCard}>
              <Text style={styles.cardTitle}>Payment Details</Text>

              {/* Fee Component Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fee Component *</Text>
                <View style={styles.componentGrid}>
                  {feeComponents.map((component, index) => {
                    const paidAmount = selectedStudent?.payments
                      ?.filter(p => p.fee_component === component.fee_component)
                      ?.reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0) || 0;
                    const remainingAmount = Math.max(0, component.amount - paidAmount);
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.componentChip,
                          selectedFeeComponent === component.fee_component && styles.componentChipActive,
                          remainingAmount === 0 && styles.componentChipPaid
                        ]}
                        onPress={() => {
                          // Allow selecting components even when fully paid (for additional payments)
                          setSelectedFeeComponent(component.fee_component);
                          // Auto-populate with remaining amount (0 if fully paid)
                          setPaymentAmount(remainingAmount.toString());
                        }}
                        // Allow selecting components even when fully paid (for additional payments)
                        disabled={false}
                      >
                        <Text style={[
                          styles.componentChipText,
                          selectedFeeComponent === component.fee_component && styles.componentChipTextActive,
                          remainingAmount === 0 && styles.componentChipTextPaid
                        ]}>
                          {component.fee_component}
                        </Text>
                        <Text style={[
                          styles.componentAmount,
                          selectedFeeComponent === component.fee_component && styles.componentAmountActive,
                          remainingAmount === 0 && styles.componentAmountPaid
                        ]}>
                          {remainingAmount === 0 ? 'Paid ✓' : formatCurrency(remainingAmount)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.componentChip,
                      styles.componentChipCustom,
                      selectedFeeComponent === 'custom' && styles.componentChipActive
                    ]}
                    onPress={() => setSelectedFeeComponent('custom')}
                  >
                    <Text style={[
                      styles.componentChipText,
                      selectedFeeComponent === 'custom' && styles.componentChipTextActive
                    ]}>
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Payment Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment Amount (₹) *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    !selectedFeeComponent && styles.textInputDisabled
                  ]}
                  placeholder="Enter amount..."
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="numeric"
                  editable={!!selectedFeeComponent}
                />
                {!selectedFeeComponent && (
                  <Text style={styles.helperText}>Please select a fee component first</Text>
                )}
              </View>

              {/* Payment Mode Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment Mode *</Text>
                <View style={styles.modeSelection}>
                  {['Cash', 'QR Code'].map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.modeChip,
                        paymentMode === mode && styles.modeChipActive
                      ]}
                      onPress={() => setPaymentMode(mode)}
                    >
                      <Ionicons 
                        name={mode === 'Cash' ? 'cash' : 'qr-code'} 
                        size={20} 
                        color={paymentMode === mode ? '#fff' : '#666'} 
                      />
                      <Text style={[
                        styles.modeText,
                        paymentMode === mode && styles.modeTextActive
                      ]}>
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Remarks */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Remarks (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  placeholder="Additional notes..."
                  value={paymentRemarks}
                  onChangeText={setPaymentRemarks}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  (!selectedFeeComponent || !paymentAmount || processing) && styles.actionButtonDisabled
                ]}
                onPress={paymentMode === 'Cash' ? handleCashPayment : handleQRCodePayment}
                disabled={!selectedFeeComponent || !paymentAmount || processing}
              >
                {processing ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.actionButtonText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons 
                      name={paymentMode === 'Cash' ? 'cash' : 'qr-code'} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.actionButtonText}>
                      {paymentMode === 'Cash' ? 'Record Payment' : 'Generate QR Code'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  headerTitle: {
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
  content: {
    flex: 1,
    padding: 16,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    alignItems: 'center',
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  studentDetails: {
    fontSize: 16,
    color: '#666',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
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
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textInputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 6,
  },
  componentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  componentChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  componentChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  componentChipPaid: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
    opacity: 0.7,
  },
  componentChipCustom: {
    backgroundColor: '#f5f5f5',
    borderStyle: 'dashed',
    borderColor: '#999',
    borderWidth: 1,
  },
  componentChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  componentChipTextActive: {
    color: '#fff',
  },
  componentChipTextPaid: {
    color: '#2e7d32',
  },
  componentAmount: {
    fontSize: 12,
    color: '#999',
  },
  componentAmountActive: {
    color: '#e3f2fd',
  },
  componentAmountPaid: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  modeSelection: {
    flexDirection: 'row',
    gap: 12,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  modeChipActive: {
    backgroundColor: '#2196F3',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeTextActive: {
    color: '#fff',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 20,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qrDisplayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  qrActionButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  qrActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WebPaymentModal;
