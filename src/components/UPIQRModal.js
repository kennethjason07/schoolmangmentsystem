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
import { supabase } from '../utils/supabase';
import { getSchoolLogoBase64, getLogoHTML, getReceiptHeaderCSS } from '../utils/logoUtils';
import { formatReferenceNumberForDisplay } from '../utils/referenceNumberGenerator';
import { generateWebReceiptHTML, openReceiptInNewWindow } from '../utils/webReceiptGenerator';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

const UPIQRModal = ({ 
  visible, 
  onClose, 
  onSuccess,
  onFailure,
  transactionData 
}) => {
  const [step, setStep] = useState('qr'); // 'qr', 'processing', or 'success'
  const [upiTransaction, setUpiTransaction] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState(null);
  // Removed unused receipt preview state
  const [verificationData, setVerificationData] = useState({
    bankReference: '',
    verifiedAmount: '',
    notes: ''
  });
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [sixDigitRef, setSixDigitRef] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
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
        referenceNumber: paymentDetails.referenceNumber, // Use the new referenceNumber field
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
            reference_number: paymentDetails.referenceNumber, // Use the new referenceNumber field
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
      
      // Load school details for receipt generation
      await loadSchoolDetails();

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
      setIsProcessing(false);
      setSchoolDetails(null);
      // Cleaned up unused receipt preview state
    }
  }, [visible]);

  // Load school details for receipt
  const loadSchoolDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('school_details')
        .select('*')
        .eq('tenant_id', transactionData.tenantId)
        .single();
      
      if (error) {
        console.warn('Could not load school details:', error.message);
        return;
      }
      
      setSchoolDetails(data);
    } catch (error) {
      console.error('Error loading school details:', error);
    }
  };

  // 🎯 Direct Receipt Generation: Process payment and call success callback
  const completePayment = async () => {
    console.log('💱 UPI - Processing direct payment with QR reference');
    setIsProcessing(true);

    try {
      // Create student fee record directly using QR reference
      const feeData = {
        studentId: transactionData.studentId,
        feeComponent: transactionData.feeComponent || 'General Fee',
        amount: transactionData.amount,
        paymentDate: new Date().toISOString().split('T')[0],
        upiTransactionId: upiTransaction.id,
        referenceNumber: paymentDetails.referenceNumber, // Use QR reference number
        bankReference: paymentDetails.referenceNumber, // Same as QR reference for UPI
        tenantId: transactionData.tenantId
      };

      console.log('💰 UPI - Processing payment with QR reference:', paymentDetails.referenceNumber);
      
      // Create student fee record
      const feeRecord = await UPIDBService.createStudentFeeRecord(feeData);
      
      // Update UPI transaction status to COMPLETED
      if (!upiTransaction.isLocal) {
        await UPIDBService.verifyUPITransaction(upiTransaction.id, {
          status: 'SUCCESS',
          adminId: user.id,
          bankRef: paymentDetails.referenceNumber,
          notes: `Direct UPI payment with QR reference: ${paymentDetails.referenceNumber}`
        });
        
        // Link UPI transaction to fee record
        await UPIDBService.updateUPITransactionWithFeeId(upiTransaction.id, feeRecord.id);
      }
      
      // Calculate outstanding amount
      const outstandingAmount = await calculateOutstandingAmount();
      
      // Generate proper receipt (like cash mode)
      const receipt = await generateCashModeReceipt(feeRecord, outstandingAmount, paymentDetails.referenceNumber);
      
      // Directly call success callback with receipt data (no intermediate modal)
      onSuccess({
        transactionId: upiTransaction.id,
        amount: transactionData.amount,
        referenceNumber: paymentDetails.referenceNumber, // QR reference
        bankReference: paymentDetails.referenceNumber, // Same as QR reference for UPI
        paymentMode: 'UPI',
        feeRecord: feeRecord,
        receipt: receipt,
        outstandingAmount: outstandingAmount,
        receiptData: receipt // Pass receipt data to parent
      });
      
      // Close UPI modal immediately
      onClose();
      
    } catch (error) {
      console.error('Error processing UPI payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process payment with 6-digit reference (like mobile)
  const processUPIPaymentWithReference = async () => {
    if (!sixDigitRef.trim()) {
      Alert.alert('Required', 'Please enter the 6-digit reference number');
      return;
    }

    if (sixDigitRef.length !== 6) {
      Alert.alert('Invalid Reference', 'Please enter exactly 6 characters');
      return;
    }

    setIsVerifying(true);
    setShowReferenceModal(false);

    try {
      // Create student fee record directly (auto-approved like mobile)
      const feeData = {
        studentId: transactionData.studentId,
        feeComponent: transactionData.feeComponent || 'General Fee',
        amount: transactionData.amount,
        paymentDate: new Date().toISOString().split('T')[0],
        upiTransactionId: upiTransaction.id,
        referenceNumber: paymentDetails.referenceNumber, // Use QR reference number
        bankReference: sixDigitRef, // Use 6-digit reference from user
        tenantId: transactionData.tenantId
      };

      console.log('💰 UPI - Processing payment with 6-digit ref:', sixDigitRef);
      console.log('💰 UPI - Using QR reference number:', paymentDetails.referenceNumber);
      
      // Create student fee record
      const feeRecord = await UPIDBService.createStudentFeeRecord(feeData);
      
      // Update UPI transaction status to COMPLETED
      if (!upiTransaction.isLocal) {
        await UPIDBService.verifyUPITransaction(upiTransaction.id, {
          status: 'SUCCESS',
          adminId: user.id,
          bankRef: sixDigitRef,
          notes: `Mobile-style payment with 6-digit ref: ${sixDigitRef}`
        });
        
        // Link UPI transaction to fee record
        await UPIDBService.updateUPITransactionWithFeeId(upiTransaction.id, feeRecord.id);
      }
      
      // Calculate outstanding amount
      const outstandingAmount = await calculateOutstandingAmount();
      
      // Generate proper receipt (like cash mode)
      const receipt = await generateCashModeReceipt(feeRecord, outstandingAmount, sixDigitRef);
      
      // 🎯 Show success alert and trigger receipt modal (like cash mode)
      Alert.alert(
        'Payment Successful! ✅',
        `Payment of ₹${transactionData.amount.toFixed(2)} processed successfully.\n\nQR Reference: ${paymentDetails.referenceNumber}\nUPI Reference: ${sixDigitRef}`,
        [
          {
            text: 'View Receipt',
            onPress: () => {
              // Call parent success callback with receipt data (like cash mode)
              onSuccess({
                transactionId: upiTransaction.id,
                amount: transactionData.amount,
                referenceNumber: paymentDetails.referenceNumber, // QR reference
                bankReference: sixDigitRef, // 6-digit reference
                paymentMode: 'UPI',
                feeRecord: feeRecord,
                receipt: receipt,
                outstandingAmount: outstandingAmount,
                receiptData: receipt // Pass receipt data to parent
              });
              onClose(); // Close UPI modal
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error processing UPI payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Calculate outstanding amount
  const calculateOutstandingAmount = async () => {
    try {
      // Query to get total fees for the student
      const { data: totalFees, error: totalError } = await supabase
        .from('student_fee_structure')
        .select('amount')
        .eq('student_id', transactionData.studentId)
        .eq('tenant_id', transactionData.tenantId);

      if (totalError) {
        console.warn('Could not fetch total fees:', totalError.message);
        return 0;
      }

      // Query to get paid fees for the student
      const { data: paidFees, error: paidError } = await supabase
        .from('student_fees')
        .select('amount')
        .eq('student_id', transactionData.studentId)
        .eq('tenant_id', transactionData.tenantId)
        .eq('payment_status', 'PAID');

      if (paidError) {
        console.warn('Could not fetch paid fees:', paidError.message);
        return 0;
      }

      const totalAmount = totalFees?.reduce((sum, fee) => sum + fee.amount, 0) || 0;
      const paidAmount = paidFees?.reduce((sum, fee) => sum + fee.amount, 0) || 0;
      
      return Math.max(0, totalAmount - paidAmount - transactionData.amount); // Subtract current payment
    } catch (error) {
      console.error('Error calculating outstanding amount:', error);
      return 0; // Return 0 on error
    }
  };

  // Generate cash-mode style receipt (exactly matching parent/FeePayment.js format)
  const generateCashModeReceipt = async (feeRecord, outstandingAmount = 0, sixDigitRef) => {
    try {
      const logoBase64 = schoolDetails?.logo_url ? await getSchoolLogoBase64(schoolDetails.logo_url) : null;
      const logoHTML = getLogoHTML(logoBase64, { width: '80px', height: '80px' });
      
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Fee Receipt</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                background-color: #fff;
              }
              ${getReceiptHeaderCSS()}
              .receipt-info {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid #e0e0e0;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 4px 0;
              }
              .info-row:last-child {
                margin-bottom: 0;
              }
              .amount-section {
                text-align: center;
                margin: 25px 0;
                padding: 20px;
                background-color: #e3f2fd;
                border-radius: 8px;
                border: 2px solid #2196F3;
              }
              .amount {
                font-size: 28px;
                font-weight: bold;
                color: #2196F3;
                margin-bottom: 8px;
              }
              .amount-label {
                font-size: 14px;
                color: #666;
                font-weight: 500;
              }
              .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #e0e0e0;
                padding-top: 15px;
              }
              .footer p {
                margin: 5px 0;
              }
            </style>
          </head>
          <body>
            <div class="receipt-header">
              ${logoHTML}
              <div class="school-name">${schoolDetails?.name || schoolDetails?.school_name || 'ABC School'}</div>
              ${schoolDetails?.address ? `<div class="school-info">${schoolDetails.address}</div>` : ''}
              ${schoolDetails?.phone ? `<div class="school-info">Phone: ${schoolDetails.phone}</div>` : ''}
              ${schoolDetails?.email ? `<div class="school-info">Email: ${schoolDetails.email}</div>` : ''}
              <div class="receipt-title">FEE PAYMENT RECEIPT</div>
            </div>

            <div class="receipt-info">
              <div class="info-row">
                <span><strong>Student Name:</strong> ${transactionData.studentName}</span>
                <span><strong>Class:</strong> ${transactionData.className || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span><strong>Fee Type:</strong> ${transactionData.feeComponent || 'Fee Payment'}</span>
                <span><strong>Payment Date:</strong> ${new Date().toLocaleDateString('en-IN')}</span>
              </div>
              <div class="info-row">
                <span><strong>Transaction ID:</strong> ${upiTransaction.id}</span>
                <span><strong>Payment Method:</strong> UPI</span>
              </div>
              <div class="info-row">
                <span><strong>Academic Year:</strong> ${transactionData.academicYear || '2024-2025'}</span>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount">₹${transactionData.amount}</div>
              <div class="amount-label">Amount Paid</div>
            </div>

            <div class="footer">
              <p>This is a computer generated receipt. No signature required.</p>
              <p>Thank you for your payment!</p>
              <p>Generated on ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}</p>
            </div>
          </body>
        </html>
      `;
      
      // Return receipt data matching cash mode format
      return {
        html: receiptHTML,
        studentName: transactionData.studentName,
        amount: transactionData.amount,
        referenceNumber: paymentDetails.referenceNumber, // QR reference
        bankReference: sixDigitRef, // 6-digit reference
        paymentDate: new Date().toLocaleDateString('en-IN'),
        outstandingAmount: outstandingAmount,
        paymentMode: 'UPI'
      };
      
    } catch (error) {
      console.error('Error generating cash-mode receipt:', error);
      throw error;
    }
  };

  // Generate instant receipt using new web receipt generator
  const generateInstantReceipt = async (feeRecord, outstandingAmount = 0) => {
    try {
      // Use the new web receipt generator for consistent format
      // Using regular import declared at the top of the file
      
      const receiptHTML = await generateWebReceiptHTML({
        schoolDetails,
        studentData: {
          name: transactionData.studentName,
          admissionNo: transactionData.admissionNo,
          className: transactionData.className || 'N/A'
        },
        feeData: {
          component: transactionData.feeComponent || 'Fee Payment',
          amount: transactionData.amount
        },
        paymentData: {
          mode: 'UPI Payment',
          transactionId: upiTransaction.id
        },
        outstandingAmount,
        receiptNumber: paymentDetails.referenceNumber,
        academicYear: transactionData.academicYear || '2024-25'
      });
      
      // Return receipt data for web display
      return {
        html: receiptHTML,
        studentName: transactionData.studentName,
        amount: transactionData.amount,
        referenceNumber: paymentDetails.referenceNumber,
        paymentDate: new Date().toLocaleDateString('en-IN'),
        outstandingAmount: outstandingAmount
      };
      
    } catch (error) {
      console.error('Error generating instant receipt:', error);
      throw error;
    }
  };

  // Generate receipt
  const generateReceipt = async (feeRecord) => {
    try {
      const logoBase64 = schoolDetails?.logo_url ? await getSchoolLogoBase64(schoolDetails.logo_url) : null;
      const logoHTML = getLogoHTML(logoBase64, { width: '80px', height: '80px' });
      
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Fee Payment Receipt</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                background-color: #fff;
              }
              ${getReceiptHeaderCSS()}
              .receipt-info {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid #e0e0e0;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 4px 0;
              }
              .info-row:last-child {
                margin-bottom: 0;
              }
              .amount-section {
                text-align: center;
                margin: 25px 0;
                padding: 20px;
                background-color: #e8f5e8;
                border-radius: 8px;
                border: 2px solid #4CAF50;
              }
              .amount {
                font-size: 28px;
                font-weight: bold;
                color: #4CAF50;
                margin-bottom: 8px;
              }
              .amount-label {
                font-size: 14px;
                color: #666;
                font-weight: 500;
              }
              .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #e0e0e0;
                padding-top: 15px;
              }
              .footer p {
                margin: 5px 0;
              }
            </style>
          </head>
          <body>
            <div class="receipt-header">
              ${logoHTML}
              <div class="school-name">${schoolDetails?.name || 'School Management System'}</div>
              ${schoolDetails?.address ? `<div class="school-info">${schoolDetails.address}</div>` : ''}
              ${schoolDetails?.phone ? `<div class="school-info">Phone: ${schoolDetails.phone}</div>` : ''}
              ${schoolDetails?.email ? `<div class="school-info">Email: ${schoolDetails.email}</div>` : ''}
              <div class="receipt-title">FEE PAYMENT RECEIPT</div>
            </div>

            <div class="receipt-info">
              <div class="info-row">
                <span><strong>Student Name:</strong> ${transactionData.studentName}</span>
                <span><strong>Admission No:</strong> ${transactionData.admissionNo}</span>
              </div>
              <div class="info-row">
                <span><strong>Fee Component:</strong> ${transactionData.feeComponent}</span>
                <span><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</span>
              </div>
              <div class="info-row">
                <span><strong>Reference Number:</strong> ${formatReferenceNumberForDisplay(paymentDetails.referenceNumber)}</span>
                <span><strong>Payment Method:</strong> UPI</span>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount">₹${transactionData.amount}</div>
              <div class="amount-label">Amount Paid</div>
            </div>

            <div class="footer">
              <p>This is a computer generated receipt. No signature required.</p>
              <p>Thank you for your payment!</p>
              <p>Payment completed on ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `;
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html: receiptHTML });
      
      return {
        html: receiptHTML,
        uri: uri,
        studentName: transactionData.studentName,
        amount: transactionData.amount,
        referenceNumber: paymentDetails.referenceNumber,
        paymentDate: new Date().toLocaleDateString()
      };
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      throw error;
    }
  };

  // Open receipt in new window (for web) or download (for mobile)
  const downloadReceipt = async () => {
    if (!receiptData) return;
    
    try {
      // Check if running in web environment
      if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        // Web environment - open in new window
        // Using regular import declared at the top of the file
        openReceiptInNewWindow(receiptData.html, `Receipt - ${receiptData.studentName}`);
      } else {
        // Mobile environment - generate PDF and share
        const { uri } = await Print.printToFileAsync({ 
          html: receiptData.html,
          width: 612,
          height: 792
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Fee Payment Receipt'
          });
        } else {
          Alert.alert('Receipt Ready', 'Your receipt has been generated successfully.');
        }
      }
    } catch (error) {
      console.error('Error handling receipt:', error);
      Alert.alert('Error', 'Failed to open receipt');
    }
  };

  // Share QR code as image
  const shareQRCode = async () => {
    try {
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 0.9,
      });

      const shareOptions = {
        url: uri,
        message: `UPI Payment QR Code\nStudent: ${transactionData.studentName}\nAmount: ${UPIService.formatAmount(transactionData.amount)}\nTransaction: ${paymentDetails?.referenceNumber}`
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
      <ScrollView 
        style={styles.modalContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
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
          <Text style={styles.transactionRef}>Ref: {paymentDetails.referenceNumber}</Text>
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
          <Text style={styles.instruction}>6. Click "Payment Done" button below after successful payment</Text>
          
          <View style={styles.importantNote}>
            <Ionicons name="information-circle-outline" size={20} color="#4CAF50" />
            <Text style={styles.importantNoteText}>
              Your payment will be automatically approved and a receipt will be generated instantly!
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
            style={[styles.verifyButton, isProcessing && styles.buttonDisabled]}
            onPress={completePayment}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.verifyButtonText}>
              {isProcessing ? 'Processing...' : 'Payment Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderVerifyStep = () => {
    return (
      <ScrollView 
        style={styles.modalContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
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
            <Text style={styles.summaryValue}>{paymentDetails?.referenceNumber}</Text>
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

  const renderProcessingStep = () => {
    return (
      <View style={styles.processingContainer}>
        <View style={styles.processingContent}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.processingTitle}>Processing Payment</Text>
          <Text style={styles.processingSubtitle}>Please wait while we complete your payment and generate your receipt...</Text>
          
          <View style={styles.processingSteps}>
            <View style={styles.processingStep}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.processingStepText}>Payment verified</Text>
            </View>
            <View style={styles.processingStep}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.processingStepText}>Generating receipt...</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSuccessStep = () => {
    return (
      <ScrollView 
        style={styles.modalContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          </View>
          
          <Text style={styles.successTitle}>Payment Completed!</Text>
          <Text style={styles.successSubtitle}>Your payment has been successfully processed and approved.</Text>
          
          {/* Payment Summary */}
          <View style={styles.successSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Student:</Text>
              <Text style={styles.summaryValue}>{transactionData.studentName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount:</Text>
              <Text style={styles.summaryValue}>₹{transactionData.amount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reference:</Text>
              <Text style={styles.summaryValue}>{formatReferenceNumberForDisplay(paymentDetails?.referenceNumber)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>{new Date().toLocaleDateString()}</Text>
            </View>
          </View>
          
          {/* Receipt Actions */}
          <View style={styles.successActions}>
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={downloadReceipt}
            >
              <Ionicons name="download" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.downloadButtonText}>Download Receipt</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color="#666" style={{ marginRight: 8 }} />
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  // 💱 MOBILE-STYLE: 6-Digit Reference Entry Modal
  const renderReferenceModal = () => {
    return (
      <Modal
        visible={showReferenceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReferenceModal(false)}
      >
        <View style={styles.referenceModalOverlay}>
          <View style={styles.referenceModalContainer}>
            {/* Header */}
            <View style={styles.referenceModalHeader}>
              <Text style={styles.referenceModalTitle}>Enter UPI Reference</Text>
              <TouchableOpacity
                style={styles.referenceCloseButton}
                onPress={() => setShowReferenceModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.referenceModalContent}>
              <View style={styles.referenceIcon}>
                <Ionicons name="card-outline" size={50} color="#4CAF50" />
              </View>
              
              <Text style={styles.referenceModalSubtitle}>
                Please enter the last 6 digits of your UPI transaction reference number
              </Text>

              {/* Payment Details */}
              <View style={styles.referencePaymentInfo}>
                <Text style={styles.referencePaymentText}>Amount: ₹{transactionData.amount}</Text>
                <Text style={styles.referencePaymentText}>Student: {transactionData.studentName}</Text>
              </View>

              {/* 6-Digit Input */}
              <View style={styles.referenceInputGroup}>
                <Text style={styles.referenceInputLabel}>6-Digit Reference *</Text>
                <TextInput
                  style={styles.referenceInput}
                  value={sixDigitRef}
                  onChangeText={(text) => {
                    // Allow alphanumeric characters (letters and numbers) and max 6 characters
                    const alphanumericOnly = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    if (alphanumericOnly.length <= 6) {
                      setSixDigitRef(alphanumericOnly);
                    }
                  }}
                  placeholder="ABC123"
                  keyboardType="default"
                  maxLength={6}
                  textAlign="center"
                  autoFocus={true}
                  autoCapitalize="characters"
                />
                <Text style={styles.referenceInputHint}>
                  Enter the last 6 digits from your UPI app confirmation
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.referenceModalActions}>
                <TouchableOpacity 
                  style={styles.referenceCancelButton}
                  onPress={() => setShowReferenceModal(false)}
                >
                  <Text style={styles.referenceCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.referenceConfirmButton, isVerifying && styles.buttonDisabled]}
                  onPress={processUPIPaymentWithReference}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.referenceConfirmButtonText}>
                    {isVerifying ? 'Processing...' : 'Confirm Payment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Removed receipt preview modal - now handled by parent component

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
        {step === 'qr' && renderQRStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'success' && renderSuccessStep()}
        {step === 'verify' && renderVerifyStep()}
      </View>
      
      {/* 6-Digit Reference Entry Modal */}
      {renderReferenceModal()}
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
  scrollContent: {
    paddingBottom: 600, // Massive bottom padding for optimal mobile navigation visibility
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
    marginBottom: 80, // Increased margin to push buttons above mobile navigation
    marginTop: 20, // Extra space above buttons
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
    marginBottom: 80, // Increased margin to push buttons above mobile navigation
    marginTop: 20, // Extra space above buttons
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
  buttonDisabled: {
    opacity: 0.6,
  },
  
  // Processing Step Styles
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingContent: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 40,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    width: '100%',
    maxWidth: 320,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  processingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  processingSteps: {
    width: '100%',
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  processingStepText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  
  // Success Step Styles
  successContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  successSummary: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  successActions: {
    width: '100%',
    gap: 16,
    marginBottom: 80, // Increased margin to push buttons above mobile navigation
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  closeModalButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Receipt Preview Popup Styles
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptPreviewContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  receiptPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  receiptPreviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  receiptCloseButton: {
    padding: 4,
  },
  receiptPreviewContent: {
    flex: 1,
  },
  receiptPreviewCard: {
    alignItems: 'center',
    padding: 30,
  },
  receiptSuccessIcon: {
    marginBottom: 20,
  },
  receiptPreviewSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  receiptDetails: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 25,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  receiptDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  receiptPreviewActions: {
    width: '100%',
    gap: 12,
  },
  receiptDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  receiptDownloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  receiptLaterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  receiptLaterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Demo Bill Preview Styles
  demoBillPreview: {
    backgroundColor: '#e6f3ff',
    borderWidth: 2,
    borderColor: '#000',
    margin: 10,
    borderRadius: 8,
  },
  demoBillHeader: {
    backgroundColor: '#f0f8ff',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    padding: 15,
  },
  schoolInfo: {
    alignItems: 'center',
  },
  schoolNamePreview: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  schoolAddressPreview: {
    fontSize: 10,
    color: '#333',
    marginBottom: 2,
  },
  officialReceiptPreview: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  studentDetailsPreview: {
    padding: 15,
    backgroundColor: '#f8fcff',
  },
  detailRowPreview: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  detailLabelPreview: {
    fontWeight: 'bold',
    fontSize: 11,
    color: '#000',
    width: 100,
  },
  detailValuePreview: {
    flex: 1,
    fontSize: 11,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#666',
    borderStyle: 'dotted',
    paddingBottom: 2,
  },
  feeTablePreview: {
    margin: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },
  tableHeaderPreview: {
    flexDirection: 'row',
    backgroundColor: '#d6e9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tableHeaderTextPreview: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 11,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#000',
  },
  tableRowPreview: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tableCellPreview: {
    flex: 1,
    fontSize: 11,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#000',
    textAlign: 'center',
  },
  totalRowPreview: {
    flexDirection: 'row',
    backgroundColor: '#e6f3ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabelPreview: {
    fontWeight: 'bold',
    fontSize: 11,
    color: '#000',
  },
  totalAmountPreview: {
    fontWeight: 'bold',
    fontSize: 11,
    color: '#000',
  },
  amountWordsPreview: {
    margin: 10,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  amountWordsTextPreview: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#000',
    fontWeight: 'bold',
  },
  paymentInfoPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  leftInfoPreview: {
    width: '48%',
  },
  rightInfoPreview: {
    width: '48%',
  },
  paymentDetailPreview: {
    fontSize: 10,
    color: '#000',
    marginBottom: 3,
  },
  outstandingPreview: {
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  outstandingTextPreview: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#d68910',
  },
  paidPreview: {
    backgroundColor: '#d4edda',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  paidTextPreview: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#155724',
  },
  signaturePreview: {
    alignItems: 'flex-end',
    padding: 15,
    paddingTop: 30,
  },
  signatureTextPreview: {
    fontSize: 10,
    color: '#000',
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 5,
    textAlign: 'center',
    width: 120,
  },
  receiptPrintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  receiptPrintButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  receiptSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  receiptSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // 6-Digit Reference Modal Styles
  referenceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  referenceModalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  referenceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  referenceModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  referenceCloseButton: {
    padding: 4,
  },
  referenceModalContent: {
    padding: 25,
    alignItems: 'center',
  },
  referenceIcon: {
    marginBottom: 20,
    backgroundColor: '#f0f9ff',
    borderRadius: 50,
    padding: 20,
  },
  referenceModalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  referencePaymentInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
    width: '100%',
    alignItems: 'center',
  },
  referencePaymentText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  referenceInputGroup: {
    width: '100%',
    marginBottom: 25,
  },
  referenceInputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  referenceInput: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    backgroundColor: '#f9f9f9',
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 8,
  },
  referenceInputHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  referenceModalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  referenceCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  referenceCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  referenceConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  referenceConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UPIQRModal;
