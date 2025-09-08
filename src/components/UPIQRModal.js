import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { UPIService } from '../services/UPIService';
import { UPIDBService } from '../services/UPIDBService';
import { useAuth } from '../utils/AuthContext';

const UPIQRModal = ({ 
  visible, 
  onClose, 
  onSuccess,
  onFailure,
  transactionData 
}) => {
  const [step, setStep] = useState('qr'); // 'qr' or 'verify'
  const [upiTransaction, setUpiTransaction] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [verificationData, setVerificationData] = useState({
    bankReference: '',
    notes: '',
    verifiedAmount: ''
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  
  const qrRef = useRef();
  const { user } = useAuth();

  // Generate QR code and create UPI transaction
  const generateQRCode = async () => {
    try {
      setQrGenerated(true);
      
      if (!transactionData) {
        throw new Error('Transaction data is required');
      }
      
      // Validate required fields
      if (!transactionData.tenantId) {
        console.error('Missing tenantId in transactionData:', transactionData);
        throw new Error('Missing tenant information. Please try again.');
      }
      
      if (!transactionData.studentId) {
        console.error('Missing studentId in transactionData:', transactionData);
        throw new Error('Missing student information. Please try again.');
      }
      
      // Create student info and fee info from transaction data
      const studentInfo = {
        id: transactionData.studentId,
        name: transactionData.studentName,
        admissionNo: transactionData.admissionNo || transactionData.admission_no
      };
      
      const feeInfo = {
        amount: transactionData.amount,
        feeComponent: transactionData.feeComponent
      };
      
      // Clear any cached UPI settings to ensure fresh data
      UPIService.clearCache(transactionData.tenantId);
      
      // Create payment details (async with tenantId)
      const paymentDetails = await UPIService.getPaymentDetails(studentInfo, feeInfo, transactionData.tenantId);
      setPaymentDetails(paymentDetails);

      // Generate UPI string for QR code
      const upiString = UPIService.generateUPIString(paymentDetails);

      // Create UPI transaction in database with error handling
      const upiTransactionData = {
        studentId: transactionData.studentId,
        transactionRef: paymentDetails.transactionRef,
        amount: transactionData.amount,
        upiId: paymentDetails.upiId,
        qrData: upiString,
        feeComponent: transactionData.feeComponent || 'General Fee',
        academicYear: transactionData.academicYear,
        paymentDate: transactionData.paymentDate,
        tenantId: transactionData.tenantId
      };

      try {
        const transaction = await UPIDBService.createUPITransaction(upiTransactionData);
        setUpiTransaction(transaction);
      } catch (dbError) {
        if (dbError.message && dbError.message.includes('unrecognized configuration parameter')) {
          console.warn('⚠️ RPC function error, creating local transaction record instead');
          // Create a local transaction object for the UI to work
          const localTransaction = {
            id: `local_${Date.now()}`,
            qr_data: upiString,
            transaction_ref: paymentDetails.transactionRef,
            student_id: transactionData.studentId,
            amount: transactionData.amount,
            payment_status: 'PENDING',
            created_at: new Date().toISOString(),
            isLocal: true // Flag to indicate this is a local record
          };
          setUpiTransaction(localTransaction);
          console.log('💡 Using local transaction record:', localTransaction.id);
        } else {
          throw dbError; // Re-throw other errors
        }
      }
      
      // Initialize verification amount
      setVerificationData({
        ...verificationData,
        verifiedAmount: transactionData.amount.toString()
      });

    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
    }
  };

  // Initialize QR generation when modal opens
  React.useEffect(() => {
    if (visible && !qrGenerated) {
      generateQRCode();
    }
    if (!visible) {
      // Reset state when modal closes
      setStep('qr');
      setUpiTransaction(null);
      setPaymentDetails(null);
      setQrGenerated(false);
      setVerificationData({
        bankReference: '',
        notes: '',
        verifiedAmount: ''
      });
    }
  }, [visible]);

  // Share QR code as image
  const shareQRCode = async () => {
    try {
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 0.9,
      });

      const shareOptions = {
        url: uri,
        message: `UPI Payment QR Code\nStudent: ${transactionData.studentName}\nAmount: ${UPIService.formatAmount(transactionData.amount)}\nTransaction: ${paymentDetails?.transactionRef}`
      };

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, shareOptions);
      } else {
        Alert.alert('Sharing not available', 'Unable to share on this device');
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  // Verify payment
  const verifyPayment = async (status) => {
    if (status === 'SUCCESS' && !verificationData.bankReference.trim()) {
      Alert.alert('Required Field', 'Please enter the UPI reference number');
      return;
    }

    if (status === 'SUCCESS' && (!verificationData.verifiedAmount || parseFloat(verificationData.verifiedAmount) <= 0)) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    try {
      setIsVerifying(true);

      // Handle local transactions (created when database RPC functions fail)
      if (upiTransaction.isLocal) {
        if (status === 'SUCCESS') {
          Alert.alert(
            'Payment Noted!', 
            `Payment of ${UPIService.formatAmount(verificationData.verifiedAmount)} has been noted. Manual database entry may be required.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  onSuccess({
                    transactionId: upiTransaction.id,
                    amount: parseFloat(verificationData.verifiedAmount),
                    bankReference: verificationData.bankReference,
                    paymentMode: 'UPI',
                    isLocal: true
                  });
                  onClose();
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Payment Rejected', 
            'Payment has been marked as failed.',
            [
              {
                text: 'OK',
                onPress: () => onClose()
              }
            ]
          );
        }
        return;
      }

      // Normal database transaction verification
      const verificationDetails = {
        status: status,
        adminId: user.id,
        bankRef: verificationData.bankReference,
        notes: verificationData.notes
      };

      await UPIDBService.verifyUPITransaction(upiTransaction.id, verificationDetails);

      if (status === 'SUCCESS') {
        // Create student fee record
        const feeData = {
          studentId: transactionData.studentId,
          feeComponent: transactionData.feeComponent || 'General Fee',
          amount: parseFloat(verificationData.verifiedAmount),
          paymentDate: new Date().toISOString().split('T')[0],
          upiTransactionId: upiTransaction.id,
          bankReference: verificationData.bankReference,
          tenantId: transactionData.tenantId // Fix: Add missing tenant_id
        };

        // 🔍 DEBUG: Log the feeData being sent to createStudentFeeRecord
        console.log('💰 UPI - Creating fee record with data:', {
          studentId: feeData.studentId,
          tenantId: feeData.tenantId,
          feeComponent: feeData.feeComponent,
          amount: feeData.amount
        });
        
        // 🔍 DEBUG: Log the original transactionData for comparison
        console.log('📊 UPI - Original transactionData:', {
          studentId: transactionData.studentId,
          tenantId: transactionData.tenantId,
          studentName: transactionData.studentName
        });

        const feeRecord = await UPIDBService.createStudentFeeRecord(feeData);
        
        // Link UPI transaction to fee record
        await UPIDBService.updateUPITransactionWithFeeId(upiTransaction.id, feeRecord.id);

        Alert.alert(
          'Payment Verified!', 
          `Payment of ${UPIService.formatAmount(verificationData.verifiedAmount)} has been successfully verified and recorded.`,
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess({
                  transactionId: upiTransaction.id,
                  amount: parseFloat(verificationData.verifiedAmount),
                  bankReference: verificationData.bankReference,
                  paymentMode: 'UPI',
                  feeRecord: feeRecord
                });
                onClose();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Payment Rejected', 
          'Payment has been marked as failed.',
          [
            {
              text: 'OK',
              onPress: () => onClose()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      Alert.alert('Error', 'Failed to verify payment. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const renderQRStep = () => {
    if (!paymentDetails || !upiTransaction) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Generating QR Code...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>UPI Payment</Text>
          <Text style={styles.subtitle}>Scan QR code to pay</Text>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentInfo}>
          <Text style={styles.studentName}>{transactionData.studentName}</Text>
          <Text style={styles.admissionNo}>({transactionData.admissionNo || transactionData.admission_no})</Text>
          <Text style={styles.amount}>{UPIService.formatAmount(transactionData.amount)}</Text>
          <Text style={styles.feeComponent}>{transactionData.feeComponent || 'Fee Payment'}</Text>
          <Text style={styles.transactionRef}>Ref: {paymentDetails.transactionRef}</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrContainer} ref={qrRef}>
          <QRCode
            value={paymentDetails.qrData || upiTransaction.qr_data}
            size={200}
            backgroundColor="white"
            color="black"
          />
          <Text style={styles.upiId}>{paymentDetails.upiId}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to Pay:</Text>
          <Text style={styles.instruction}>1. Open any UPI app (PhonePe, Google Pay, Paytm, etc.)</Text>
          <Text style={styles.instruction}>2. Tap "Scan QR Code" or "Pay by QR"</Text>
          <Text style={styles.instruction}>3. Scan this QR code with your phone camera</Text>
          <Text style={styles.instruction}>4. Verify the amount (₹{transactionData.amount}) and merchant name</Text>
          <Text style={styles.instruction}>5. Complete payment using your UPI PIN</Text>
          <Text style={styles.instruction}>6. Take screenshot of successful payment with UPI Reference ID</Text>
          <Text style={styles.instruction}>7. Click "Payment Done" button below to verify</Text>
          
          <View style={styles.importantNote}>
            <Ionicons name="information-circle-outline" size={20} color="#FF9800" />
            <Text style={styles.importantNoteText}>
              Payment will remain "PENDING" until admin verification. Please save your UPI reference number!
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.qrActions}>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={shareQRCode}
          >
            <Ionicons name="share-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.shareButtonText}>Share QR Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.verifyButton}
            onPress={() => setStep('verify')}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.verifyButtonText}>Payment Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderVerifyStep = () => {
    return (
      <ScrollView style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setStep('qr')}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Verify Payment</Text>
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentSummary}>
          <Text style={styles.summaryTitle}>Payment Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Student:</Text>
            <Text style={styles.summaryValue}>{transactionData.studentName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount:</Text>
            <Text style={styles.summaryValue}>{UPIService.formatAmount(transactionData.amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Transaction:</Text>
            <Text style={styles.summaryValue}>{paymentDetails?.transactionRef}</Text>
          </View>
        </View>

        {/* Verification Form */}
        <View style={styles.verificationForm}>
          <Text style={styles.formTitle}>Verification Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>UPI Reference Number *</Text>
            <TextInput
              style={styles.input}
              value={verificationData.bankReference}
              onChangeText={(text) => setVerificationData({
                ...verificationData,
                bankReference: text.toUpperCase()
              })}
              placeholder="Enter 12-digit UTR/Ref number"
              maxLength={20}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Verified Amount</Text>
            <TextInput
              style={styles.input}
              value={verificationData.verifiedAmount}
              onChangeText={(text) => setVerificationData({
                ...verificationData,
                verifiedAmount: text
              })}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={verificationData.notes}
              onChangeText={(text) => setVerificationData({
                ...verificationData,
                notes: text
              })}
              placeholder="Any additional notes..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Verification Actions */}
        <View style={styles.verificationActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => verifyPayment('FAILED')}
            disabled={isVerifying}
          >
            <Ionicons name="close-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.rejectButtonText}>Reject Payment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => verifyPayment('SUCCESS')}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.approveButtonText}>
              {isVerifying ? 'Verifying...' : 'Verify Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Close Button */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={28} color="#666" />
        </TouchableOpacity>

        {/* Content based on current step */}
        {step === 'qr' ? renderQRStep() : renderVerifyStep()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  
  // QR Step Styles
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  paymentInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  admissionNo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  amount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginVertical: 8,
  },
  feeComponent: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  transactionRef: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  qrContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  upiId: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  instructions: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    paddingLeft: 5,
  },
  importantNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  importantNoteText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#E65100',
    fontWeight: '500',
    lineHeight: 18,
  },
  qrActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Verify Step Styles
  paymentSummary: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  verificationForm: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  approveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UPIQRModal;
