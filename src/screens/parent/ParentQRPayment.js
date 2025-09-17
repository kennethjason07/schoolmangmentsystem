import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';

import Header from '../../components/Header';
import { UPIService } from '../../services/UPIService';
import { UPIDBService } from '../../services/UPIDBService';
import { useAuth } from '../../utils/AuthContext';
import { useSelectedStudent } from '../../contexts/SelectedStudentContext';
import { formatReferenceNumberForDisplay } from '../../utils/referenceNumberGenerator';

const { width } = Dimensions.get('window');

const ParentQRPayment = ({ route, navigation }) => {
  const { selectedFee, tenantId } = route.params;
  const { user } = useAuth();
  const { selectedStudent } = useSelectedStudent();
  
  // Use selectedStudent from context instead of route params
  const studentData = selectedStudent;
  
  // Step management: 'amount' -> 'qr' -> 'confirm'
  const [currentStep, setCurrentStep] = useState('amount');
  
  // Amount input state
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // QR code state
  const [qrData, setQrData] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [transaction, setTransaction] = useState(null);
  
  // Confirmation state
  const [confirmationData, setConfirmationData] = useState({
    remarks: ''
  });
  
  // Loading states
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const qrRef = useRef();
  
  // Track if we need to regenerate QR code due to cache refresh
  const [needsQRRefresh, setNeedsQRRefresh] = useState(false);

  // Only clear UPI cache on initial screen mount, not on every focus
  // We use a ref to track if this is the first focus or a subsequent one
  const initialFocusRef = useRef(true);
  
  useFocusEffect(
    React.useCallback(() => {
      // Only clear cache and force refresh when navigating to screen for the first time
      // or when returning from a different screen (not on every re-render)
      if (initialFocusRef.current) {
        console.log('🔄 [STUDENT QR DEBUG] Initial screen focus, clearing UPI cache...');
        UPIService.clearCache();
        UPIService.forceRefreshUPISettings(tenantId);
        initialFocusRef.current = false;
        
        // If we already have a QR code generated, mark it for refresh (initial load only)
        if (qrData && currentStep === 'qr') {
          console.log('🔄 [STUDENT QR DEBUG] Existing QR code detected on initial load, marking for refresh');
          setNeedsQRRefresh(true);
        }
      } else {
        console.log('🔄 [STUDENT QR DEBUG] Subsequent screen focus, not clearing cache automatically');
      }
    }, [tenantId]) // Remove qrData and currentStep from dependencies to prevent continuous re-runs
  );

  // Handle QR code refresh when needed
  useEffect(() => {
    if (needsQRRefresh && currentStep === 'qr') {
      console.log('🔄 [STUDENT QR DEBUG] Refreshing QR code due to cache clear...');
      
      const refreshQRCode = async () => {
        setGenerating(true);
        try {
          // Create payment details for QR generation with fresh UPI data
          const paymentInfo = {
            ...selectedFee,
            amount: parseFloat(paymentAmount)
          };

          console.log('🔄 [STUDENT QR DEBUG] Regenerating QR with fresh UPI settings...');
          const details = await UPIService.getPaymentDetails(studentData, paymentInfo, tenantId);
          console.log('🔄 [STUDENT QR DEBUG] Fresh UPI details:', {
            upiId: details.upiId,
            merchantName: details.merchantName,
            tenantId: details.tenantId
          });
          
          setPaymentDetails(details);
          const upiString = UPIService.generateUPIString(details);
          setQrData(upiString);
          
          console.log('🔄 [STUDENT QR DEBUG] Refreshed QR with UPI ID:', details.upiId);
          console.log('🔍 [STUDENT QR DEBUG] Refreshed QR contains fallback UPI?', upiString.includes('hanokalure0@okhdfcbank'));
          
        } catch (error) {
          console.error('🔄 [STUDENT QR DEBUG] Error refreshing QR code:', error);
        } finally {
          setGenerating(false);
          setNeedsQRRefresh(false);
        }
      };
      
      refreshQRCode();
    }
  }, [needsQRRefresh, currentStep, paymentAmount, selectedFee, studentData, tenantId]);

  // Validation functions
  const validateAmount = () => {
    const amount = parseFloat(paymentAmount);
    const maxAmount = selectedFee.remainingAmount || selectedFee.amount;
    
    if (!paymentAmount || paymentAmount.trim() === '') {
      return 'Please enter payment amount';
    }
    
    if (isNaN(amount) || amount <= 0) {
      return 'Please enter a valid amount';
    }
    
    if (amount > maxAmount) {
      return `Maximum payable amount is ₹${maxAmount}`;
    }
    
    if (amount < 1) {
      return 'Minimum payment amount is ₹1';
    }
    
    return null;
  };

  const validateConfirmation = () => {
    // No validation needed - reference number is auto-generated and stored in transaction
    return null;
  };

  // Generate QR Code
  const generateQRCode = async () => {
    const validationError = validateAmount();
    if (validationError) {
      Alert.alert('Invalid Amount', validationError);
      return;
    }

    setGenerating(true);
    
    try {
      // Create payment details for QR generation
      const paymentInfo = {
        ...selectedFee,
        amount: parseFloat(paymentAmount)
      };

      console.log('🏫 [STUDENT QR DEBUG] Starting QR generation with params:', {
        tenantId: tenantId,
        studentName: studentData.name,
        studentId: studentData.id,
        admissionNo: studentData.admission_no,
        amount: parseFloat(paymentAmount),
        feeComponent: selectedFee.name
      });
      
      // Get payment details using the existing UPI service
      console.log('📞 [STUDENT QR DEBUG] Calling UPIService.getPaymentDetails with tenantId:', tenantId);
      const details = await UPIService.getPaymentDetails(studentData, paymentInfo, tenantId);
      console.log('📋 [STUDENT QR DEBUG] UPIService.getPaymentDetails returned:', {
        upiId: details.upiId,
        merchantName: details.merchantName,
        referenceNumber: details.referenceNumber,
        tenantId: details.tenantId
      });
      setPaymentDetails(details);

      // Generate UPI string for QR code
      const upiString = UPIService.generateUPIString(details);
      setQrData(upiString);

      console.log('🎯 [STUDENT QR DEBUG] Generated UPI String:', upiString);
      console.log('🎯 [STUDENT QR DEBUG] Using UPI ID:', details.upiId);
      console.log('🔍 [STUDENT QR DEBUG] QR Data contains fallback UPI?', upiString.includes('hanokalure0@okhdfcbank'));

      // Create transaction record in database
      const transactionData = {
        studentId: studentData.id,
        studentName: studentData.name, // Add student name for reference number generation
        referenceNumber: details.referenceNumber, // Use the 6-digit reference number from UPIService
        amount: parseFloat(paymentAmount),
        upiId: details.upiId,
        qrData: upiString,
        feeComponent: selectedFee.name || 'General Fee',
        academicYear: selectedFee.academicYear || '2024-2025',
        paymentDate: new Date().toISOString().split('T')[0],
        tenantId: tenantId
      };

      try {
        const txn = await UPIDBService.createUPITransaction(transactionData);
        setTransaction(txn);
        console.log('✅ Student Transaction created:', txn.id);
      } catch (dbError) {
        console.warn('⚠️ Database transaction creation failed, using local record:', dbError);
        // Create local transaction for UI continuity
        const localTxn = {
          id: `student_${Date.now()}`,
          ...transactionData,
          created_at: new Date().toISOString(),
          isLocal: true
        };
        setTransaction(localTxn);
      }

      setCurrentStep('qr');
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Share QR Code
  const shareQRCode = async () => {
    if (!qrRef.current) return;
    
    try {
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 0.9,
      });

      const shareOptions = {
        url: uri,
        message: `UPI Payment QR Code\nStudent: ${studentData.name}\nAmount: ₹${paymentAmount}\nFee: ${selectedFee.name}`
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

  // Submit Payment Confirmation
  const submitPaymentConfirmation = async () => {
    const validationError = validateConfirmation();
    if (validationError) {
      Alert.alert('Invalid Information', validationError);
      return;
    }

    setSubmitting(true);

    try {
      const confirmationPayload = {
        transactionId: transaction.id,
        studentId: studentData.id,
        referenceNumber: transaction.reference_number, // Use the generated reference number
        amount: parseFloat(paymentAmount),
        feeComponent: selectedFee.name,
        remarks: confirmationData.remarks,
        submittedBy: user.id,
        status: 'PENDING_ADMIN_VERIFICATION'
      };

      if (transaction.isLocal) {
        // Handle local transactions
        console.log('📝 Submitting local transaction confirmation:', confirmationPayload);
        
        const referenceForDisplay = transaction.reference_number ? formatReferenceNumberForDisplay(transaction.reference_number) : 'N/A';
        
        Alert.alert(
          'Payment Confirmation Submitted!',
          `Your payment confirmation has been submitted successfully for admin verification.\n\n` +
          `💳 Amount: ₹${paymentAmount}\n` +
          `🔢 Reference Number: ${referenceForDisplay}\n` +
          `👤 Student: ${studentData.name}\n\n` +
          `The admin will verify your UPI payment and update your fee record within 24 hours. You can track the status in the Payment History section.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        // Submit to database
        await UPIDBService.submitStudentPaymentConfirmation(confirmationPayload);
        
        const referenceForDisplay = transaction.reference_number ? formatReferenceNumberForDisplay(transaction.reference_number) : 'Generated';
        
        Alert.alert(
          'Payment Confirmation Submitted!',
          `Your payment confirmation has been submitted successfully for admin verification.\n\n` +
          `💳 Amount: ₹${paymentAmount}\n` +
          `🔢 Reference Number: ${referenceForDisplay}\n` +
          `👤 Student: ${studentData.name}\n\n` +
          `The admin will verify your UPI payment and update your fee record within 24 hours. You will receive a notification once verified.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }

    } catch (error) {
      console.error('Error submitting payment confirmation:', error);
      Alert.alert('Error', 'Failed to submit payment confirmation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add web scroll optimization like Profile screen
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.id = 'qr-payment-screen-styles';
      style.textContent = `
        .qr-payment-screen-container {
          position: relative;
          height: 100%;
          overflow: hidden;
        }
        
        .qr-payment-screen-container > div:first-child {
          height: 100%;
          overflow: hidden;
        }
        
        .qr-payment-scroll-view {
          height: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          scroll-behavior: smooth !important;
          scrollbar-width: thin;
        }
        
        .qr-payment-scroll-view::-webkit-scrollbar {
          width: 8px;
        }
        
        .qr-payment-scroll-view::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .qr-payment-scroll-view::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        
        .qr-payment-scroll-view::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.4);
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        const existingStyle = document.getElementById('qr-payment-screen-styles');
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, []);

  // Render Amount Input Step
  const renderAmountStep = () => (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      enabled={Platform.OS !== 'web'}
    >
      <ScrollView 
        style={styles.stepContainer} 
        contentContainerStyle={styles.scrollContent}
        className="qr-payment-scroll-view"
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        scrollBehavior="smooth"
        WebkitOverflowScrolling="touch"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              console.log('🔄 [STUDENT QR DEBUG] Pull-to-refresh triggered - clearing UPI cache...');
              setRefreshing(true);
              UPIService.clearCache();
              UPIService.forceRefreshUPISettings(tenantId);
              // Small delay to show refresh indicator
              setTimeout(() => setRefreshing(false), 500);
            }} 
          />
        }
      >
      <View style={styles.stepHeader}>
        <Ionicons name="calculator-outline" size={48} color="#4CAF50" />
        <Text style={styles.stepTitle}>Enter Payment Amount</Text>
        <Text style={styles.stepSubtitle}>Enter the amount you want to pay for this fee</Text>
      </View>

      {/* Fee Information */}
      <View style={styles.feeCard}>
        <Text style={styles.feeCardTitle}>Fee Details</Text>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Fee Type:</Text>
          <Text style={styles.feeValue}>{selectedFee.name}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Total Amount:</Text>
          <Text style={styles.feeValue}>₹{selectedFee.amount}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Paid Amount:</Text>
          <Text style={styles.feeValue}>₹{selectedFee.paidAmount || 0}</Text>
        </View>
        <View style={[styles.feeRow, styles.outstandingRow]}>
          <Text style={styles.outstandingLabel}>Outstanding:</Text>
          <Text style={styles.outstandingValue}>₹{selectedFee.remainingAmount || selectedFee.amount}</Text>
        </View>
      </View>

      {/* Amount Input */}
      <View style={styles.amountInputContainer}>
        <Text style={styles.inputLabel}>Payment Amount *</Text>
        <View style={styles.amountInputWrapper}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#999"
          />
        </View>
        
        {/* Quick Amount Buttons */}
        <View style={styles.quickAmountContainer}>
          <Text style={styles.quickAmountLabel}>Quick Select:</Text>
          <View style={styles.quickAmountButtons}>
            <TouchableOpacity
              style={styles.quickAmountButton}
              onPress={() => setPaymentAmount((selectedFee.remainingAmount || selectedFee.amount).toString())}
            >
              <Text style={styles.quickAmountText}>Full Amount</Text>
            </TouchableOpacity>
            
            {selectedFee.remainingAmount > 1000 && (
              <TouchableOpacity
                style={styles.quickAmountButton}
                onPress={() => setPaymentAmount(Math.floor((selectedFee.remainingAmount || selectedFee.amount) / 2).toString())}
              >
                <Text style={styles.quickAmountText}>Half Amount</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Important Note */}
        <View style={styles.importantNote}>
          <Ionicons name="information-circle-outline" size={16} color="#FF9800" />
          <Text style={styles.importantNoteText}>
            You cannot pay more than the outstanding amount. Partial payments are allowed.
          </Text>
        </View>
      </View>

      {/* Generate QR Button */}
      <TouchableOpacity
        style={[styles.primaryButton, generating && styles.primaryButtonDisabled]}
        onPress={generateQRCode}
        disabled={generating}
      >
        {generating ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.primaryButtonText}>Generating QR Code...</Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="qr-code" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Generate QR Code</Text>
          </View>
        )}
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render QR Code Step
  const renderQRStep = () => (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      enabled={Platform.OS !== 'web'}
    >
      <ScrollView 
        style={styles.stepContainer} 
        contentContainerStyle={styles.scrollContent}
        className="qr-payment-scroll-view"
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        scrollBehavior="smooth"
        WebkitOverflowScrolling="touch"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              console.log('🔄 [STUDENT QR DEBUG] Pull-to-refresh triggered on QR step - refreshing QR code...');
              setRefreshing(true);
              UPIService.clearCache();
              UPIService.forceRefreshUPISettings(tenantId);
              
              if (qrData) {
                setNeedsQRRefresh(true);
              }
              
              // Small delay to show refresh indicator
              setTimeout(() => setRefreshing(false), 500);
            }} 
          />
        }
      >
      <View style={styles.stepHeader}>
        <Ionicons name="qr-code" size={48} color="#4CAF50" />
        <Text style={styles.stepTitle}>Scan QR to Pay</Text>
        <Text style={styles.stepSubtitle}>Use any UPI app to scan and pay</Text>
      </View>

      {/* Payment Summary */}
      <View style={styles.paymentSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Student:</Text>
          <Text style={styles.summaryValue}>{studentData.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fee Type:</Text>
          <Text style={styles.summaryValue}>{selectedFee.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount:</Text>
          <Text style={[styles.summaryValue, styles.amountHighlight]}>₹{paymentAmount}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Reference Number:</Text>
          <Text style={styles.summaryValue}>{transaction?.reference_number ? formatReferenceNumberForDisplay(transaction.reference_number) : 'Generating...'}</Text>
        </View>
      </View>

      {/* QR Code */}
      <View style={styles.qrContainer} ref={qrRef}>
        <QRCode
          value={qrData}
          size={200}
          backgroundColor="white"
          color="black"
        />
        <Text style={styles.upiId}>{paymentDetails?.upiId}</Text>
      </View>

      {/* Payment Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to Pay:</Text>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>1.</Text>
          <Text style={styles.instructionText}>Open any UPI app (PhonePe, Google Pay, Paytm, etc.)</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>2.</Text>
          <Text style={styles.instructionText}>Tap "Scan QR Code" or "Pay by QR"</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>3.</Text>
          <Text style={styles.instructionText}>Scan this QR code</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>4.</Text>
          <Text style={styles.instructionText}>Verify amount (₹{paymentAmount}) and complete payment</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>5.</Text>
          <Text style={styles.instructionText}>Save the UTR/Reference number from success message</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>6.</Text>
          <Text style={styles.instructionText}>Click "Payment Done" below to submit confirmation</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.qrActions}>
        <TouchableOpacity style={styles.shareButton} onPress={shareQRCode}>
          <Ionicons name="share-outline" size={20} color="#2196F3" />
          <Text style={styles.shareButtonText}>Share QR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => setCurrentStep('confirm')}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}>Payment Done</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render Confirmation Step
  const renderConfirmStep = () => (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      enabled={Platform.OS !== 'web'}
    >
      <ScrollView 
        style={styles.stepContainer} 
        contentContainerStyle={styles.scrollContent}
        className="qr-payment-scroll-view"
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        scrollBehavior="smooth"
        WebkitOverflowScrolling="touch"
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => {}} />
        }
      >
      <View style={styles.stepHeader}>
        <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
        <Text style={styles.stepTitle}>Confirm Payment</Text>
        <Text style={styles.stepSubtitle}>Enter payment details to confirm</Text>
      </View>

      {/* Payment Summary */}
      <View style={styles.paymentSummary}>
        <Text style={styles.summaryTitle}>Payment Details</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount Paid:</Text>
          <Text style={[styles.summaryValue, styles.amountHighlight]}>₹{paymentAmount}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Reference Number:</Text>
          <Text style={styles.summaryValue}>{transaction?.reference_number ? formatReferenceNumberForDisplay(transaction.reference_number) : 'N/A'}</Text>
        </View>
      </View>

      {/* Confirmation Form */}
      <View style={styles.confirmationForm}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Remarks (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={confirmationData.remarks}
            onChangeText={(text) => setConfirmationData({ ...confirmationData, remarks: text })}
            placeholder="Any additional notes..."
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.importantNote}>
          <Ionicons name="information-circle-outline" size={16} color="#4CAF50" />
          <Text style={styles.importantNoteText}>
            Your payment will be verified by the admin using the reference number shown above. No need to enter UTR manually.
          </Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
        onPress={submitPaymentConfirmation}
        disabled={submitting}
      >
        {submitting ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.primaryButtonText}>Submitting...</Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Submit Payment Confirmation</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setCurrentStep('qr')}
      >
        <Ionicons name="arrow-back" size={20} color="#666" />
        <Text style={styles.secondaryButtonText}>Back to QR Code</Text>
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'amount':
        return renderAmountStep();
      case 'qr':
        return renderQRStep();
      case 'confirm':
        return renderConfirmStep();
      default:
        return renderAmountStep();
    }
  };

  return (
    <View style={styles.container} className="qr-payment-screen-container">
      <Header title="QR Code Payment" showBack={true} />
      
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressStep, currentStep === 'amount' && styles.activeStep]}>
            <Text style={[styles.progressText, currentStep === 'amount' && styles.activeProgressText]}>1</Text>
          </View>
          <View style={[styles.progressLine, (currentStep === 'qr' || currentStep === 'confirm') && styles.activeLine]} />
          <View style={[styles.progressStep, currentStep === 'qr' && styles.activeStep]}>
            <Text style={[styles.progressText, currentStep === 'qr' && styles.activeProgressText]}>2</Text>
          </View>
          <View style={[styles.progressLine, currentStep === 'confirm' && styles.activeLine]} />
          <View style={[styles.progressStep, currentStep === 'confirm' && styles.activeStep]}>
            <Text style={[styles.progressText, currentStep === 'confirm' && styles.activeProgressText]}>3</Text>
          </View>
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>Amount</Text>
          <Text style={styles.progressLabel}>QR Code</Text>
          <Text style={styles.progressLabel}>Confirm</Text>
        </View>
      </View>

      {/* Step Content */}
      {renderCurrentStep()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  progressContainer: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  progressStep: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStep: {
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  activeProgressText: {
    color: '#fff',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activeLine: {
    backgroundColor: '#4CAF50',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 5,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  feeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  feeCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  outstandingRow: {
    borderBottomWidth: 0,
    paddingTop: 15,
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
  },
  feeLabel: {
    fontSize: 16,
    color: '#666',
  },
  feeValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  outstandingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  outstandingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  amountInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    paddingVertical: 15,
  },
  quickAmountContainer: {
    marginTop: 10,
  },
  quickAmountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAmountButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#f8f9fa',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  importantNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  importantNoteText: {
    fontSize: 14,
    color: '#e65100',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    marginTop: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#bbb',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  paymentSummary: {
    backgroundColor: '#fff',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  amountHighlight: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  upiId: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  instructions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    width: 25,
  },
  instructionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  qrActions: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    backgroundColor: '#fff',
  },
  shareButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  confirmationForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ParentQRPayment;
