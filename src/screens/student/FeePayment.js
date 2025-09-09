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
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';
import { useAuth } from '../../utils/AuthContext';
import { getSchoolLogoBase64, getLogoHTML, getReceiptHeaderCSS } from '../../utils/logoUtils';
import FeeService from '../../services/FeeService';
import { validateFeeConsistency, syncFeeAfterPayment } from '../../services/feeSync';

const { width } = Dimensions.get('window');

const FeePayment = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  const [feeStructure, setFeeStructure] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [studentData, setStudentData] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedFee, setSelectedFee] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Move fetchFeeData outside useEffect to make it accessible throughout component
  const fetchFeeData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Validate tenant access before proceeding
        const tenantValidation = await validateTenantAccess(user.id, tenantId);
        if (!tenantValidation.isValid) {
          console.error('❌ FeePayment tenant validation failed:', tenantValidation.error);
          Alert.alert('Access Denied', TENANT_ERROR_MESSAGES.INVALID_TENANT_ACCESS);
          setError(tenantValidation.error);
          return;
        }

        // Load school details first
        console.log('🏫 FeePayment - Loading school details');
        const { data: schoolData, error: schoolError } = await dbHelpers.getSchoolDetails();
        console.log('🏫 FeePayment - School data loaded:', schoolData);
        console.log('🏫 FeePayment - Logo URL:', schoolData?.logo_url);
        setSchoolDetails(schoolData);

        // Get student data directly using linked_student_id with tenant filtering
        const { data: studentDetails, error: studentError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            *,
            classes(id, class_name, section, academic_year),
            tenant_id
          `)
          .eq('tenant_id', tenantId)
          .eq('id', user.linked_student_id)
          .single();

        if (studentError || !studentDetails) {
          throw new Error('Student data not found');
        }

        // Validate student data belongs to correct tenant
        const studentValidation = validateDataTenancy([{ 
          id: studentDetails.id, 
          tenant_id: studentDetails.tenant_id 
        }], tenantId, 'FeePayment');
        
        if (!studentValidation) {
          console.error('❌ Student data validation failed: Student data does not belong to tenant', tenantId);
          Alert.alert('Data Error', TENANT_ERROR_MESSAGES.WRONG_TENANT_DATA);
          return;
        }

        setStudentData(studentDetails);
        console.log('Student FeePayment - Student details:', studentDetails);

        // 🎯 Use NEW class-based FeeService for proper fee structure
        console.log('Student FeePayment - Getting fees using class-based FeeService...');
        const feeServiceResult = await FeeService.getStudentFeesWithClassBase(user.linked_student_id);
        console.log('Student FeePayment - FeeService result:', feeServiceResult);
        
        // Validate fee consistency to ensure data integrity
        try {
          const consistencyCheck = await validateFeeConsistency(user.linked_student_id, user.tenant_id);
          if (!consistencyCheck.isConsistent) {
            console.warn('Student FeePayment - Fee consistency issues detected:', consistencyCheck.issues);
            // Still proceed but log the issues for debugging
          }
          if (consistencyCheck.warnings && consistencyCheck.warnings.length > 0) {
            console.warn('Student FeePayment - Fee warnings:', consistencyCheck.warnings);
          }
        } catch (consistencyError) {
          console.warn('Student FeePayment - Fee consistency check failed (non-critical):', consistencyError);
        }

        // Handle FeeService result
        if (!feeServiceResult.success || !feeServiceResult.data) {
          if (feeServiceResult.error) {
            console.error('Student FeePayment - FeeService error:', feeServiceResult.error);
          } else {
            console.log('Student FeePayment - No fee data from FeeService, showing empty state');
          }
          setFeeStructure({
            studentName: studentDetails.name,
            class: studentDetails.classes?.class_name || 'N/A',
            academicYear: '2024-2025',
            totalDue: 0,
            totalPaid: 0,
            outstanding: 0,
            fees: [],
            metadata: { source: 'empty-state' }
          });
          setPaymentHistory([]);
          return;
        }

        const feeData = feeServiceResult.data;
        console.log('Student FeePayment - Using FeeService data:', feeData);

        // Transform fee components from NEW class-based FeeService
        const transformedFees = feeData.fees.components.map(component => {
          // Determine category based on fee component
          let category = 'general';
          if (component.name) {
            const componentName = component.name.toLowerCase();
            if (componentName.includes('tuition') || componentName.includes('academic')) {
              category = 'tuition';
            } else if (componentName.includes('book') || componentName.includes('library')) {
              category = 'books';
            } else if (componentName.includes('transport') || componentName.includes('bus')) {
              category = 'transport';
            } else if (componentName.includes('exam') || componentName.includes('test')) {
              category = 'examination';
            } else if (componentName.includes('activity') || componentName.includes('sport')) {
              category = 'activities';
            } else if (componentName.includes('facility') || componentName.includes('lab')) {
              category = 'facilities';
            }
          }

          return {
            id: component.id || `fee-${component.name}-${Date.now()}`,
            name: component.name,
            // Class fee amounts
            totalAmount: component.baseFeeAmount, // Base class fee
            discountAmount: component.discountAmount, // Individual discount
            amount: component.finalAmount, // Final amount after discount
            dueDate: component.dueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            status: component.status,
            paidAmount: component.paidAmount,
            remainingAmount: component.remainingAmount,
            description: component.hasIndividualDiscount ? 
              `${component.name} - Class Fee: ₹${component.baseFeeAmount}, Your Discount: ₹${component.discountAmount}` :
              `${component.name} - Standard Class Fee`,
            category: category,
            academicYear: feeData.fees.academicYear,
            isClassFee: component.isClassFee,
            hasIndividualDiscount: component.hasIndividualDiscount,
            appliedDiscount: component.appliedDiscount
          };
        });

        // Get payment history from FeeService
        const paymentHistoryFromService = feeData.fees.payments ? feeData.fees.payments.recentPayments.map(payment => ({
          id: payment.id,
          feeName: payment.component || 'Fee Payment',
          amount: payment.amount,
          paymentDate: payment.date,
          paymentMethod: payment.mode || 'Online',
          transactionId: payment.receipt || `TXN${payment.id.toString().slice(-8).toUpperCase()}`,
          status: 'completed',
          receiptUrl: null,
          remarks: payment.remarks || '',
          academicYear: feeData.student.class_info.academic_year || '2024-25'
        })) : [];

        console.log('Student FeePayment - Payment history from FeeService:', paymentHistoryFromService.length, 'payments');

        setFeeStructure({
          studentName: feeData.student.name,
          class: `${feeData.student.class?.name || 'N/A'} ${feeData.student.class?.section || ''}`.trim(),
          academicYear: feeData.fees.academicYear || '2024-2025',
          // Class-based fee structure information
          totalClassFee: feeData.fees.classBaseFee, // What all students in class pay
          totalDiscounts: feeData.fees.individualDiscounts, // This student's individual discounts
          totalDue: feeData.fees.totalDue, // Final amount after individual discounts
          totalPaid: feeData.fees.totalPaid,
          outstanding: feeData.fees.totalOutstanding,
          fees: transformedFees,
          // Additional information
          classFeeInfo: feeData.classFeeStructure,
          individualInfo: feeData.individualInfo
        });
        
        console.log('Student FeePayment - Payment history loaded:', paymentHistoryFromService.length, 'payments');
        setPaymentHistory(paymentHistoryFromService);
      } catch (err) {
        console.error('Error fetching fee data:', err);
        setError(err.message);

        // Set empty state when there's an error instead of fallback data
        console.log('Student FeePayment - Setting empty state due to error:', err.message);
        setFeeStructure(null);
        setPaymentHistory([]);
      } finally {
        setLoading(false);
      }
    };

  // useEffect to call fetchFeeData when component mounts
  useEffect(() => {
    if (user) {
      fetchFeeData();
    }
  }, [user]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#4CAF50';
      case 'partial': return '#FF9800';
      case 'unpaid': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'partial': return 'Partial';
      case 'unpaid': return 'Unpaid';
      default: return 'Unknown';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'tuition': return 'school';
      case 'books': return 'library';
      case 'transport': return 'car';
      case 'facilities': return 'build';
      case 'activities': return 'football';
      case 'examination': return 'document-text';
      default: return 'card';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'tuition': return '#2196F3';
      case 'books': return '#4CAF50';
      case 'transport': return '#FF9800';
      case 'facilities': return '#9C27B0';
      case 'activities': return '#795548';
      case 'examination': return '#607D8B';
      default: return '#666';
    }
  };

  const handlePayment = (fee) => {
    try {
      console.log('=== STUDENT PAYMENT BUTTON CLICKED ===');
      console.log('Fee data received:', JSON.stringify(fee, null, 2));
      console.log('Current student data:', JSON.stringify(studentData, null, 2));
      console.log('Current fee structure:', JSON.stringify(feeStructure, null, 2));

      if (!fee) {
        console.error('No fee data provided to handlePayment');
        Alert.alert('Error', 'Invalid fee data. Please try again.');
        return;
      }

      // Validate fee data structure
      if (!fee.id || !fee.name) {
        console.error('Fee data missing required fields:', fee);
        Alert.alert('Error', 'Fee data is incomplete. Please refresh and try again.');
        return;
      }

      console.log('Setting selected fee and opening modal');
      setSelectedFee(fee);
      setPaymentModalVisible(true);
      console.log('Payment modal should now be visible');
    } catch (error) {
      console.error('Error in handlePayment:', error);
      Alert.alert('Error', `Failed to open payment options: ${error.message}`);
    }
  };

  // Handle payment method selection - Navigate to dedicated screens
  const handlePaymentMethodSelect = (method) => {
    try {
      console.log('=== STUDENT PAYMENT METHOD SELECTED ===');
      console.log('Method:', JSON.stringify(method, null, 2));
      console.log('Selected fee:', JSON.stringify(selectedFee, null, 2));
      console.log('Student data:', JSON.stringify(studentData, null, 2));
      console.log('Navigation object:', navigation);

      setPaymentModalVisible(false); // Close modal first

      // Validate method data
      if (!method || !method.id) {
        console.error('Invalid payment method data:', method);
        Alert.alert('Error', 'Invalid payment method selected');
        return;
      }

      // Validate required data before navigation
      if (!selectedFee) {
        console.error('No fee selected for payment');
        Alert.alert('Error', 'No fee selected for payment');
        return;
      }

      // Ensure we have valid student data
      const safeStudentData = studentData || {
        id: 'sample-student-id',
        name: 'Sample Student',
        class_id: 'sample-class-id',
        roll_no: 42,
        admission_no: 'ADM2024001'
      };

      console.log('Using safe student data:', JSON.stringify(safeStudentData, null, 2));

      // Navigate to appropriate payment screen
      console.log('Starting navigation for method:', method.id);

      switch (method.id) {
        case 'Card':
          try {
            console.log('Navigating to CardPayment screen');
            navigation.navigate('CardPayment', {
              selectedFee,
              studentData: safeStudentData
            });
            console.log('CardPayment navigation successful');
          } catch (navError) {
            console.error('CardPayment navigation error:', navError);
            Alert.alert('Error', 'Failed to open card payment screen. Please try again.');
          }
          break;

        case 'UPI':
          try {
            console.log('Navigating to UPIPayment screen');
            navigation.navigate('UPIPayment', {
              selectedFee,
              studentData: safeStudentData
            });
            console.log('UPIPayment navigation successful');
          } catch (navError) {
            console.error('UPIPayment navigation error:', navError);
            Alert.alert('Error', 'Failed to open UPI payment screen. Please try again.');
          }
          break;

        case 'Online':
          try {
            console.log('Navigating to OnlineBankingPayment screen');
            navigation.navigate('OnlineBankingPayment', {
              selectedFee,
              studentData: safeStudentData
            });
            console.log('OnlineBankingPayment navigation successful');
          } catch (navError) {
            console.error('OnlineBankingPayment navigation error:', navError);
            Alert.alert('Error', 'Failed to open online banking screen. Please try again.');
          }
          break;

        default:
          console.log('Unsupported payment method:', method.id);
          Alert.alert('Error', `Payment method "${method.name}" is not supported yet`);
      }
    } catch (error) {
      console.error('Payment method selection error:', error);
      Alert.alert('Error', `Failed to process payment method selection: ${error.message}`);
    }
  };

  // Refresh fee data with sync validation
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user && user.linked_student_id) {
        console.log('Student FeePayment - Manual refresh triggered');
        
        // Optionally trigger fee sync to ensure consistency
        try {
          await syncFeeAfterPayment(user.linked_student_id, '', 0, user.tenant_id);
        } catch (syncError) {
          console.warn('Student FeePayment - Refresh sync failed (non-critical):', syncError);
        }
        
        await fetchFeeData();
      }
    } catch (error) {
      console.error('Error refreshing fee data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadReceipt = async (receipt) => {
    setSelectedReceipt(receipt);
    setReceiptModalVisible(true);
  };

  const handleConfirmDownload = async () => {
    if (!selectedReceipt) return;

    try {
      // Generate receipt HTML (now async)
      const htmlContent = await generateReceiptHTML(selectedReceipt);
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = `Receipt_${selectedReceipt.feeName.replace(/\s+/g, '_')}.pdf`;

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            Alert.alert('Permission Required', 'Please grant storage permission to save the receipt.');
            return;
          }

          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf'
          );

          const fileData = await FileSystem.readAsStringAsync(uri, { 
            encoding: FileSystem.EncodingType.Base64 
          });
          await FileSystem.writeAsStringAsync(destUri, fileData, { 
            encoding: FileSystem.EncodingType.Base64 
          });

          Alert.alert('Receipt Downloaded', `Receipt saved as ${fileName}`);
          setReceiptModalVisible(false);
        } catch (error) {
          console.error('Download error:', error);
          Alert.alert('Error', 'Failed to download receipt. Please try again.');
        }
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Receipt',
          UTI: 'com.adobe.pdf'
        });
        setReceiptModalVisible(false);
      }
    } catch (error) {
      console.error('Receipt generation error:', error);
      Alert.alert('Error', 'Failed to generate receipt. Please try again.');
    }
  };

  const handleCloseReceiptModal = () => {
    setReceiptModalVisible(false);
    setSelectedReceipt(null);
  };

  // Format date from yyyy-mm-dd to dd-mm-yyyy
  const formatDateForReceipt = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Handle both yyyy-mm-dd and full ISO date formats
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return dateString;
    }
  };

  // Helper function to load logo as base64 for receipt (deprecated - use logoUtils)
  const getLogoBase64 = async (logoUrl) => {
    console.warn('⚠️ getLogoBase64 is deprecated, using getSchoolLogoBase64 instead');
    return await getSchoolLogoBase64(logoUrl);
  };

  const generateReceiptHTML = async (receipt) => {
    try {
      // Get school logo using standardized utility
      const logoBase64 = schoolDetails?.logo_url ? await getSchoolLogoBase64(schoolDetails.logo_url) : null;
      const logoHTML = getLogoHTML(logoBase64, { width: '80px', height: '80px' });

      return `
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
              <div class="school-name">${schoolDetails?.name || 'School Management System'}</div>
              ${schoolDetails?.address ? `<div class="school-info">${schoolDetails.address}</div>` : ''}
              ${schoolDetails?.phone ? `<div class="school-info">Phone: ${schoolDetails.phone}</div>` : ''}
              ${schoolDetails?.email ? `<div class="school-info">Email: ${schoolDetails.email}</div>` : ''}
              <div class="receipt-title">FEE PAYMENT RECEIPT</div>
            </div>

            <div class="receipt-info">
              <div class="info-row">
                <span><strong>Student Name:</strong> ${feeStructure?.studentName || 'Student Name'}</span>
                <span><strong>Class:</strong> ${feeStructure?.class || 'Class'}</span>
              </div>
              <div class="info-row">
                <span><strong>Fee Type:</strong> ${receipt.feeName}</span>
                <span><strong>Payment Date:</strong> ${formatDateForReceipt(receipt.paymentDate)}</span>
              </div>
              <div class="info-row">
                <span><strong>Transaction ID:</strong> ${receipt.transactionId}</span>
                <span><strong>Payment Method:</strong> ${receipt.paymentMethod}</span>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount">₹${receipt.amount}</div>
              <div class="amount-label">Amount Paid</div>
            </div>

            <div class="footer">
              <p>This is a computer generated receipt. No signature required.</p>
              <p>Thank you for your payment!</p>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generating receipt HTML with logo:', error);
      // Fallback to basic HTML without logo
      const schoolName = schoolDetails?.name || 'School Name';
      return `
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
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #2196F3;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .school-name {
                font-size: 24px;
                font-weight: bold;
                color: #2196F3;
                margin-bottom: 5px;
              }
              .receipt-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .receipt-info {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
              }
              .amount-section {
                text-align: center;
                margin: 20px 0;
                padding: 20px;
                background-color: #e3f2fd;
                border-radius: 8px;
              }
              .amount {
                font-size: 24px;
                font-weight: bold;
                color: #2196F3;
              }
              .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="school-name">${schoolName}</div>
              <div class="receipt-title">Fee Receipt</div>
            </div>

            <div class="receipt-info">
              <div class="info-row">
                <span><strong>Student Name:</strong> ${feeStructure?.studentName || 'Student Name'}</span>
                <span><strong>Class:</strong> ${feeStructure?.class || 'Class'}</span>
              </div>
              <div class="info-row">
                <span><strong>Fee Type:</strong> ${receipt.feeName}</span>
                <span><strong>Payment Date:</strong> ${formatDateForReceipt(receipt.paymentDate)}</span>
              </div>
              <div class="info-row">
                <span><strong>Transaction ID:</strong> ${receipt.transactionId}</span>
                <span><strong>Payment Method:</strong> ${receipt.paymentMethod}</span>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount">₹${receipt.amount}</div>
              <div>Amount Paid</div>
            </div>

            <div class="footer">
              <p>This is a computer generated receipt. No signature required.</p>
              <p>Thank you for your payment!</p>
            </div>
          </body>
        </html>
      `;
    }
  };

  // Get payment methods available (informational for students)
  const getPaymentMethods = () => {
    return [
      { id: 'Online', name: 'Online Payment', icon: 'card', description: 'Pay using Net Banking' },
      { id: 'UPI', name: 'UPI Payment', icon: 'qr-code-outline', description: 'Pay using UPI apps' },
      { id: 'Card', name: 'Credit/Debit Card', icon: 'card-outline', description: 'Pay using your card' }
    ];
  };

  const renderFeeItem = ({ item }) => (
    <View style={styles.feeItem}>
      <View style={styles.feeHeader}>
        <View style={styles.feeInfo}>
          <View style={styles.feeTitleRow}>
            <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category) }]}>
              <Ionicons name={getCategoryIcon(item.category)} size={20} color="#fff" />
            </View>
            <View style={styles.feeTitle}>
              <Text style={styles.feeName}>{item.name}</Text>
              <Text style={styles.feeDescription}>{item.description}</Text>
            </View>
          </View>
          <View style={styles.feeAmount}>
            <Text style={styles.amountText}>₹{item.amount}</Text>
            <Text style={styles.dueDate}>Due: {new Date(item.dueDate).toLocaleDateString('en-US', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric' 
            })}</Text>
          </View>
        </View>
        <View style={styles.feeStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
          {item.status === 'partial' && (
            <Text style={styles.partialAmount}>₹{item.paidAmount} paid</Text>
          )}
        </View>
      </View>
      
      {item.status !== 'paid' && (
        <TouchableOpacity 
          style={[styles.payButton, { backgroundColor: getStatusColor(item.status) }]}
          onPress={() => handlePayment(item)}
        >
          <Ionicons name="card" size={16} color="#fff" />
          <Text style={styles.payButtonText}>
            {item.status === 'partial' ? 'Pay Remaining' : 'View Payment Options'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPaymentHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyFeeName}>{item.feeName}</Text>
        <Text style={styles.historyAmount}>₹{item.amount}</Text>
      </View>
      <View style={styles.historyDetails}>
        <Text style={styles.historyDate}>{formatDateForReceipt(item.paymentDate)}</Text>
        <Text style={styles.historyMethod}>{item.paymentMethod}</Text>
        <Text style={styles.historyId}>TXN: {item.transactionId}</Text>
      </View>
      <TouchableOpacity 
        style={styles.downloadButton}
        onPress={() => handleDownloadReceipt(item)}
      >
        <Ionicons name="download" size={16} color="#2196F3" />
        <Text style={styles.downloadText}>Download Receipt</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Fee Payment" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading fee information...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Fee Payment" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>Failed to load fee information</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchFeeData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!feeStructure) {
    return (
      <View style={styles.container}>
        <Header title="Fee Payment" showBack={true} />
        <View style={styles.emptyContainer}>
          <Ionicons name="card-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No fee information available</Text>
          <Text style={styles.emptySubtext}>Fee structure will be available once configured by the school.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Fee Payment" showBack={true} />
      
      <View style={styles.content}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
            onPress={() => setSelectedTab('overview')}
          >
            <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>Fee Structure</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'history' && styles.activeTab]}
            onPress={() => setSelectedTab('history')}
          >
            <Text style={[styles.tabText, selectedTab === 'history' && styles.activeTabText]}>Payment History</Text>
          </TouchableOpacity>
        </View>

        {/* Fee Summary Cards */}
        <View style={styles.feeDistributionContainer}>
          <Text style={styles.feeDistributionTitle}>Fee Distribution Summary</Text>
          <View style={styles.summaryCards}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Academic Fee</Text>
              <Text style={[styles.summaryAmount, { color: '#2196F3' }]}>₹{feeStructure.totalDue}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={[styles.summaryAmount, { color: '#4CAF50' }]}>₹{feeStructure.totalPaid}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={[styles.summaryAmount, { color: '#F44336' }]}>₹{feeStructure.outstanding}</Text>
            </View>
          </View>
        </View>

        {/* Content based on selected tab */}
        {selectedTab === 'overview' ? (
          <FlatList
            data={feeStructure.fees}
            renderItem={renderFeeItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feeList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2196F3']}
                progressBackgroundColor="#fff"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="card-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No fees configured</Text>
                <Text style={styles.emptySubtext}>Fee structure will be available once configured by the school.</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={paymentHistory}
            renderItem={renderPaymentHistoryItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.historyList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2196F3']}
                progressBackgroundColor="#fff"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No payment history</Text>
                <Text style={styles.emptySubtext}>Payment history will appear here once payments are made.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Payment Information Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Information</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedFee ? (
              <View style={styles.paymentContent}>
                <View style={styles.paymentFeeInfo}>
                  <Text style={styles.paymentFeeName}>{selectedFee.name || 'Fee Payment'}</Text>
                  <Text style={styles.paymentFeeDescription}>{selectedFee.description || 'School fee payment'}</Text>
                  <Text style={styles.paymentAmount}>₹{selectedFee.remainingAmount || selectedFee.amount || 0}</Text>
                </View>

                <View style={styles.paymentMethods}>
                  <Text style={styles.paymentMethodsTitle}>Available Payment Methods</Text>
                  {getPaymentMethods().map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={styles.paymentMethod}
                      onPress={() => {
                        console.log('Payment method button pressed:', method.id);
                        handlePaymentMethodSelect(method);
                      }}
                    >
                      <Ionicons
                        name={method.icon}
                        size={24}
                        color="#2196F3"
                      />
                      <View style={styles.paymentMethodInfo}>
                        <Text style={styles.paymentMethodText}>
                          {method.name}
                        </Text>
                        <Text style={styles.paymentMethodDescription}>
                          {method.description}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.paymentContent}>
                <Text style={styles.errorText}>No fee selected. Please close and try again.</Text>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        visible={receiptModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseReceiptModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt Preview</Text>
              <TouchableOpacity onPress={handleCloseReceiptModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedReceipt && (
              <ScrollView style={styles.receiptPreviewContent}>
                <View style={styles.receiptPreview}>
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptSchoolName}>{schoolDetails?.name || 'School Name'}</Text>
                    <Text style={styles.receiptTitle}>Fee Receipt</Text>
                  </View>

                  <View style={styles.receiptInfo}>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Student Name:</Text>
                      <Text style={styles.receiptInfoValue}>{feeStructure?.studentName}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Class:</Text>
                      <Text style={styles.receiptInfoValue}>{feeStructure?.class}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Fee Type:</Text>
                      <Text style={styles.receiptInfoValue}>{selectedReceipt.feeName}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Payment Date:</Text>
                      <Text style={styles.receiptInfoValue}>{formatDateForReceipt(selectedReceipt.paymentDate)}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Transaction ID:</Text>
                      <Text style={styles.receiptInfoValue}>{selectedReceipt.transactionId}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Payment Method:</Text>
                      <Text style={styles.receiptInfoValue}>{selectedReceipt.paymentMethod}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Status:</Text>
                      <View style={styles.receiptStatusRow}>
                        <Text style={styles.receiptInfoValue}>Completed</Text>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>PAID</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.receiptAmountSection}>
                    <Text style={styles.receiptAmount}>₹{selectedReceipt.amount}</Text>
                    <Text style={styles.receiptAmountLabel}>Amount Paid</Text>
                  </View>

                  <View style={styles.receiptFooter}>
                    <Text style={styles.receiptFooterText}>This is a computer generated receipt.</Text>
                    <Text style={styles.receiptFooterText}>No signature required.</Text>
                    <Text style={styles.receiptFooterText}>Thank you for your payment!</Text>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Receipt Modal Footer */}
            <View style={styles.receiptModalFooter}>
              <TouchableOpacity style={styles.cancelReceiptButton} onPress={handleCloseReceiptModal}>
                <Text style={styles.cancelReceiptButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.downloadReceiptButton} onPress={handleConfirmDownload}>
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.downloadReceiptButtonText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  feeList: {
    paddingBottom: 150,
  },
  historyList: {
    paddingBottom: 20,
  },
  feeItem: {
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
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  feeInfo: {
    flex: 1,
  },
  feeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  feeTitle: {
    flex: 1,
  },
  feeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  feeDescription: {
    fontSize: 12,
    color: '#666',
  },
  feeAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dueDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  feeStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  partialAmount: {
    fontSize: 10,
    color: '#FF9800',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  historyItem: {
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyFeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
  },
  historyMethod: {
    fontSize: 12,
    color: '#666',
  },
  historyId: {
    fontSize: 12,
    color: '#666',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
  },
  downloadText: {
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 4,
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
    maxWidth: 400,
    maxHeight: '95%',
    minHeight: '70%',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentContent: {
    padding: 20,
  },
  paymentFeeInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentFeeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  paymentFeeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  paymentMethods: {
    marginBottom: 24,
  },
  paymentMethodsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  paymentMethodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  feeDistributionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  feeDistributionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  receiptPreviewContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  receiptPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  receiptHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    paddingBottom: 16,
    marginBottom: 20,
  },
  receiptSchoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  receiptInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  receiptInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'center',
  },
  receiptInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  receiptInfoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  receiptAmountSection: {
    alignItems: 'center',
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  receiptAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  receiptAmountLabel: {
    fontSize: 13,
    color: '#666',
  },
  receiptFooter: {
    marginTop: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  receiptFooterText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 3,
    textAlign: 'center',
  },
  receiptStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  receiptModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  cancelReceiptButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelReceiptButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  downloadReceiptButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8,
  },
  downloadReceiptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default FeePayment;
