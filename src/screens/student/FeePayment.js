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
import { supabase, TABLES, dbHelpers, isValidUUID } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';

const { width } = Dimensions.get('window');

const FeePayment = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [feeStructure, setFeeStructure] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [studentData, setStudentData] = useState(null);
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
        // Get student data directly using linked_student_id
        const { data: studentDetails, error: studentError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            *,
            classes(id, class_name, section, academic_year)
          `)
          .eq('id', user.linked_student_id)
          .single();

        if (studentError || !studentDetails) {
          throw new Error('Student data not found');
        }

        setStudentData(studentDetails);

        // Debug student details first
        console.log('Student FeePayment - Student details:', studentDetails);

        let classFees = null;
        let feesError = null;

        // Only fetch data if we have valid student details
        if (studentDetails && isValidUUID(studentDetails.id) && isValidUUID(studentDetails.class_id)) {
          console.log('Student FeePayment - Fetching fee structure for student:', studentDetails.id, 'class:', studentDetails.class_id);

          // Get fee structure for a class using easy.txt recommendation
          const feeResult = await supabase
            .from('fee_structure')
            .select(`
              *,
              classes(id, class_name, section, academic_year)
            `)
            .or(`class_id.eq.${studentDetails.class_id},student_id.eq.${studentDetails.id}`)
            .order('due_date', { ascending: true });

          classFees = feeResult.data;
          feesError = feeResult.error;

          if (feesError) {
            console.log('Student FeePayment - Database error fetching fee structure:', feesError);
          } else {
            console.log('Student FeePayment - Loaded', classFees?.length || 0, 'fee structure records from database');
          }
        } else {
          console.log('Student FeePayment - Invalid student details, will use sample data');
          console.log('Student FeePayment - Student ID valid:', isValidUUID(studentDetails?.id));
          console.log('Student FeePayment - Class ID valid:', isValidUUID(studentDetails?.class_id));
        }

        if (feesError && feesError.code !== '42P01') {
          console.log('Fee structure error:', feesError);
        }

        // Debug fee structure data
        console.log('Student FeePayment - Raw fee structure data:');
        console.log('- Student ID:', studentDetails?.id);
        console.log('- Class ID:', studentDetails?.class_id);
        console.log('- Fee structures found:', classFees?.length || 0);
        console.log('- Fee structure details:', classFees);

        // Get payment history using proper schema: student_fees table
        let studentPayments = null;
        let paymentsError = null;

        if (studentDetails && isValidUUID(studentDetails.id)) {
          console.log('Student FeePayment - Fetching payment history for student:', studentDetails.id);

          // Get student fees with fee structure details using easy.txt recommendation
          const paymentResult = await supabase
            .from('student_fees')
            .select(`
              *,
              students(name, admission_no),
              fee_structure(*)
            `)
            .eq('student_id', studentDetails.id)
            .order('payment_date', { ascending: false });

          studentPayments = paymentResult.data;
          paymentsError = paymentResult.error;

          if (paymentsError) {
            console.log('Student FeePayment - Database error fetching payments:', paymentsError);
          } else {
            console.log('Student FeePayment - Loaded', studentPayments?.length || 0, 'payment records from database');
          }
        } else {
          console.log('Student FeePayment - Invalid student ID for payment history:', studentDetails?.id);
        }

        if (paymentsError && paymentsError.code !== '42P01') {
          console.log('Student payments error:', paymentsError);
        }

        // Debug payment data
        console.log('Student FeePayment - Raw payment data:');
        console.log('- Payments found:', studentPayments?.length || 0);
        console.log('- Payment details:', studentPayments);
        
        // If no fee structure found, create sample data for testing
        let feesToProcess = classFees || [];
        if (!feesToProcess || feesToProcess.length === 0) {
          console.log('Student FeePayment - No fee structure found, creating sample data');
          const safeClassId = (studentDetails && studentDetails.class_id) ? studentDetails.class_id : 'sample-class-id';
          const safeStudentId = (studentDetails && studentDetails.id) ? studentDetails.id : null;

          feesToProcess = [
            {
              id: 'sample-1',
              academic_year: '2024-2025',
              class_id: safeClassId,
              student_id: safeStudentId,
              fee_component: 'Tuition Fee',
              amount: 25000,
              due_date: '2024-04-30'
            },
            {
              id: 'sample-2',
              academic_year: '2024-2025',
              class_id: safeClassId,
              student_id: safeStudentId,
              fee_component: 'Development Fee',
              amount: 5000,
              due_date: '2024-04-30'
            },
            {
              id: 'sample-3',
              academic_year: '2024-2025',
              class_id: safeClassId,
              student_id: safeStudentId,
              fee_component: 'Transport Fee',
              amount: 8000,
              due_date: '2024-05-31'
            }
          ];
        }

        // Transform payment history based on schema FIRST
        let transformedPayments = [];

        if (studentPayments && studentPayments.length > 0) {
          transformedPayments = studentPayments.map(payment => {
            return {
              id: payment.id,
              feeName: payment.fee_component || 'Fee Payment',
              amount: Number(payment.amount_paid) || 0,
              paymentDate: payment.payment_date || new Date().toISOString().split('T')[0],
              paymentMethod: payment.payment_mode || 'Online',
              transactionId: payment.id ? `TXN${payment.id.slice(-8).toUpperCase()}` : `TXN${Date.now()}`,
              status: 'completed',
              receiptUrl: null,
              remarks: payment.remarks || '',
              academicYear: payment.academic_year || '2024-2025',
              createdAt: payment.created_at || new Date().toISOString()
            };
          });
        } else {
          // Add sample payment history if no real data exists
          console.log('Student FeePayment - No payment history found, adding sample data');
          transformedPayments = [
            {
              id: 'sample-payment-1',
              feeName: 'Tuition Fee',
              amount: 25000,
              paymentDate: '2024-01-15',
              paymentMethod: 'Online Banking',
              transactionId: 'TXN12345678',
              status: 'completed',
              receiptUrl: null,
              remarks: 'First installment payment',
              academicYear: '2024-2025',
              createdAt: '2024-01-15T10:30:00Z'
            },
            {
              id: 'sample-payment-2',
              feeName: 'Development Fee',
              amount: 5000,
              paymentDate: '2024-02-10',
              paymentMethod: 'UPI',
              transactionId: 'TXN87654321',
              status: 'completed',
              receiptUrl: null,
              remarks: 'Development fee payment',
              academicYear: '2024-2025',
              createdAt: '2024-02-10T14:20:00Z'
            },
            {
              id: 'sample-payment-3',
              feeName: 'Transport Fee',
              amount: 3000,
              paymentDate: '2024-03-05',
              paymentMethod: 'Credit Card',
              transactionId: 'TXN11223344',
              status: 'completed',
              receiptUrl: null,
              remarks: 'Partial payment',
              academicYear: '2024-2025',
              createdAt: '2024-03-05T09:15:00Z'
            }
          ];
        }

        // Transform fee structure data based on schema
        const transformedFees = feesToProcess.map(fee => {
          // Safely get fee component name
          const feeComponent = fee.fee_component || fee.name || 'General Fee';
          
          // Find payments for this fee component using the transformed payments
          const payments = transformedPayments?.filter(p =>
            p.feeName === feeComponent &&
            p.academicYear === (fee.academic_year || '2024-2025')
          ) || [];

          const totalPaidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const feeAmount = Number(fee.amount || 0);
          const remainingAmount = feeAmount - totalPaidAmount;

          let status = 'unpaid';
          if (totalPaidAmount >= feeAmount) {
            status = 'paid';
          } else if (totalPaidAmount > 0) {
            status = 'partial';
          }

          // Determine category based on fee component
          let category = 'general';
          if (feeComponent) {
            const component = feeComponent.toLowerCase();
            if (component.includes('tuition') || component.includes('academic')) {
              category = 'tuition';
            } else if (component.includes('book') || component.includes('library')) {
              category = 'books';
            } else if (component.includes('transport') || component.includes('bus')) {
              category = 'transport';
            } else if (component.includes('exam') || component.includes('test')) {
              category = 'examination';
            } else if (component.includes('activity') || component.includes('sport')) {
              category = 'activities';
            } else if (component.includes('facility') || component.includes('lab')) {
              category = 'facilities';
            }
          }

          return {
            id: fee.id || `fee-${Date.now()}-${Math.random()}`,
            name: feeComponent,
            amount: feeAmount,
            dueDate: fee.due_date || new Date().toISOString().split('T')[0],
            status: status,
            paidAmount: totalPaidAmount,
            remainingAmount: remainingAmount,
            description: `${feeComponent} for ${fee.academic_year || '2024-25'}`,
            category: category,
            academicYear: fee.academic_year || '2024-25',
            isClassFee: fee.class_id ? true : false,
            isIndividualFee: fee.student_id ? true : false,
            payments: payments
          };
        });
        
        // Calculate totals with debugging
        const totalDue = transformedFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalPaid = transformedFees.reduce((sum, fee) => sum + fee.paidAmount, 0);
        const outstanding = totalDue - totalPaid;

        // Debug logging
        console.log('Student FeePayment - Fee calculation debug:');
        console.log('- Transformed fees count:', transformedFees.length);
        console.log('- Total due:', totalDue);
        console.log('- Total paid:', totalPaid);
        console.log('- Outstanding:', outstanding);
        console.log('- Fee details:', transformedFees.map(f => ({ name: f.name, amount: f.amount, paid: f.paidAmount, status: f.status })));

        setFeeStructure({
          studentName: studentDetails.name,
          class: studentDetails.classes?.class_name || 'N/A',
          academicYear: '2024-2025', // This could be fetched from settings
          totalDue: totalDue,
          totalPaid: totalPaid,
          outstanding: outstanding,
          fees: transformedFees
        });
        
        console.log('Student FeePayment - Payment history loaded:', transformedPayments.length, 'payments');
        setPaymentHistory(transformedPayments);
      } catch (err) {
        console.error('Error fetching fee data:', err);
        setError(err.message);

        // Set fallback data even when there's an error
        console.log('Student FeePayment - Setting fallback data due to error');
        setFeeStructure({
          totalDue: 38000,
          totalPaid: 33000,
          outstanding: 5000,
          fees: [
            {
              id: 'fallback-1',
              name: 'Tuition Fee',
              amount: 25000,
              paidAmount: 25000,
              remainingAmount: 0,
              status: 'paid',
              dueDate: '2024-04-30',
              academicYear: '2024-2025'
            },
            {
              id: 'fallback-2',
              name: 'Development Fee',
              amount: 5000,
              paidAmount: 5000,
              remainingAmount: 0,
              status: 'paid',
              dueDate: '2024-04-30',
              academicYear: '2024-2025'
            },
            {
              id: 'fallback-3',
              name: 'Transport Fee',
              amount: 8000,
              paidAmount: 3000,
              remainingAmount: 5000,
              status: 'partial',
              dueDate: '2024-05-31',
              academicYear: '2024-2025'
            }
          ]
        });

        // Set fallback payment history
        setPaymentHistory([
          {
            id: 'fallback-payment-1',
            feeName: 'Tuition Fee',
            amount: 25000,
            paymentDate: '2024-01-15',
            paymentMethod: 'Online Banking',
            transactionId: 'TXN12345678',
            status: 'completed',
            receiptUrl: null,
            remarks: 'Full payment',
            academicYear: '2024-2025',
            createdAt: '2024-01-15T10:30:00Z'
          },
          {
            id: 'fallback-payment-2',
            feeName: 'Development Fee',
            amount: 5000,
            paymentDate: '2024-02-10',
            paymentMethod: 'UPI',
            transactionId: 'TXN87654321',
            status: 'completed',
            receiptUrl: null,
            remarks: 'Development fee',
            academicYear: '2024-2025',
            createdAt: '2024-02-10T14:20:00Z'
          },
          {
            id: 'fallback-payment-3',
            feeName: 'Transport Fee',
            amount: 3000,
            paymentDate: '2024-03-05',
            paymentMethod: 'Credit Card',
            transactionId: 'TXN11223344',
            status: 'completed',
            receiptUrl: null,
            remarks: 'Partial payment',
            academicYear: '2024-2025',
            createdAt: '2024-03-05T09:15:00Z'
          }
        ]);

        // Don't show error alert, just log it
        console.log('Student FeePayment - Using fallback data due to error:', err.message);
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

  // Refresh fee data
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user) {
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
      // Generate receipt HTML
      const htmlContent = generateReceiptHTML(selectedReceipt);
      
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

  const generateReceiptHTML = (receipt) => {
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
            <div class="school-name">ABC School</div>
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
                    <Text style={styles.receiptSchoolName}>ABC School</Text>
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
