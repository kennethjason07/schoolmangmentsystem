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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Header from '../../components/Header';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase, TABLES, dbHelpers, isValidUUID } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';
import { format } from 'date-fns';
import { getSchoolLogoBase64, getLogoHTML, getReceiptHeaderCSS } from '../../utils/logoUtils';
import FeeService from '../../services/FeeService';

const { width } = Dimensions.get('window');

const FeePayment = () => {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
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

  // Add state and function for school details similar to AdminDashboard
  const [schoolData, setSchoolData] = useState(null);

  // Fetch school details
  const fetchSchoolData = async () => {
    try {
      const { data: schools, error } = await supabase
        .from('school_details')
        .select('*')
        .single();

      if (error) {
        console.log('Error fetching school data:', error);
        return null;
      }

      setSchoolData(schools);
      return schools;
    } catch (error) {
      console.error('Error in fetchSchoolData:', error);
      return null;
    }
  };

  // Helper function to convert image URL to base64 (deprecated - use logoUtils)
  const fetchImageAsBase64 = async (imageUrl) => {
    console.warn('⚠️ fetchImageAsBase64 is deprecated, using getSchoolLogoBase64 instead');
    return await getSchoolLogoBase64(imageUrl);
  };

  // Move fetchFeeData outside useEffect to make it accessible throughout component
  const fetchFeeData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('FeePayment - Starting fetchFeeData...');
        
        // Fetch school data alongside fee data
        await fetchSchoolData();
        
        // Get parent's student data using the helper function
        const { data: parentUserData, error: parentError } = await dbHelpers.getParentByUserId(user.id);
        if (parentError || !parentUserData) {
          throw new Error('Parent data not found');
        }

        // Get student details from the linked student
        const studentDetails = parentUserData.students;
        setStudentData(studentDetails);

        console.log('FeePayment - Student details:', studentDetails);

        let classFees = null;
        let feesError = null;
        let studentPayments = null;
        let paymentsError = null;

        // Only fetch data if we have valid student details - use centralized FeeService
        if (studentDetails && isValidUUID(studentDetails.id)) {
          console.log('🎯 FeePayment - Using NEW class-based FeeService for student:', studentDetails.id);
          
          // Use the NEW class-based FeeService for proper fee structure
          const feeServiceResult = await FeeService.getStudentFeesWithClassBase(studentDetails.id);
          
          if (feeServiceResult.success && feeServiceResult.data) {
            const feeData = feeServiceResult.data;
            console.log('Parent FeePayment - FeeService successful:', {
              totalDue: feeData.fees.totalDue,
              totalPaid: feeData.fees.totalPaid,
              totalOutstanding: feeData.fees.totalOutstanding,
              individualDiscounts: feeData.fees.individualDiscounts,
              classBaseFee: feeData.fees.classBaseFee,
              feesCount: feeData.fees.components?.length || 0
            });
            
            // Transform the centralized FeeService results to the component's expected format
            const transformedFees = feeData.fees.components.map(component => {
              // Determine category based on fee component
              let category = 'general';
              if (component.component) {
                const componentName = component.component.toLowerCase();
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
                id: component.id,
                name: component.name,
                amount: component.finalAmount, // Use final amount after discounts
                baseFeeAmount: component.baseFeeAmount, // Store original amount
                discountAmount: component.discountAmount, // Store discount
                dueDate: component.dueDate || new Date().toISOString().split('T')[0],
                status: component.status,
                paidAmount: component.paidAmount,
                remainingAmount: component.remainingAmount,
                description: `${component.name} for ${component.academicYear || '2024-25'}${component.discountAmount > 0 ? ` (₹${component.discountAmount} discount applied)` : ''}`,
                category: category,
                academicYear: component.academicYear || '2024-25',
                isClassFee: component.isClassFee || false,
                hasIndividualDiscount: component.hasIndividualDiscount || false,
                payments: component.payments || []
              };
            });
            
            // Set fee structure with proper totals from the new service
            setFeeStructure({
              studentName: studentDetails.name,
              class: studentDetails.classes?.class_name || feeData.student.class?.name || 'N/A',
              academicYear: feeData.fees.academicYear || '2024-2025',
              totalDue: feeData.fees.totalDue, // Total after discounts
              totalBaseFee: feeData.fees.classBaseFee, // Class base fee before discounts
              totalDiscounts: feeData.fees.individualDiscounts, // Individual discounts applied
              totalPaid: feeData.fees.totalPaid,
              outstanding: feeData.fees.totalOutstanding,
              fees: transformedFees
            });
            
            // Transform payment history from the fee components
            const allPayments = feeData.fees.components
              .flatMap(component => component.payments || [])
              .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
            
            const transformedPayments = allPayments.map(payment => ({
              id: payment.id,
              feeName: payment.remarks?.split(' for ')[0] || 'Fee Payment',
              amount: Number(payment.amount) || 0,
              paymentDate: payment.paymentDate || new Date().toISOString().split('T')[0],
              paymentMethod: payment.paymentMode || 'Online',
              transactionId: payment.id ? `TXN${payment.id.toString().slice(-8).toUpperCase()}` : `TXN${Date.now()}`,
              receiptNumber: payment.receiptNumber || null,
              status: 'completed',
              receiptUrl: null,
              remarks: payment.remarks || '',
              academicYear: feeData.fees.academicYear || '2024-2025',
              createdAt: new Date().toISOString()
            }));
            
            setPaymentHistory(transformedPayments);
            
            console.log('✅ FeePayment - Successfully loaded fees with dynamic discount calculation:');
            console.log('- Total fees:', transformedFees.length);
            console.log('- Class base total: ₹' + feeData.fees.classBaseFee);
            console.log('- Individual discounts: ₹' + feeData.fees.individualDiscounts);
            console.log('- Final amount due: ₹' + feeData.fees.totalDue);
            console.log('- Total paid: ₹' + feeData.fees.totalPaid);
            console.log('- Outstanding: ₹' + feeData.fees.totalOutstanding);
            console.log('- Has individual discounts:', feeData.individualInfo.hasIndividualDiscounts);
            
          } else {
            console.log('FeePayment - Fee service failed:', feeServiceResult?.error);
            throw new Error(feeServiceResult?.error || 'Fee service failed');
          }
        } else {
          console.log('FeePayment - Invalid student details, will use sample data');
          console.log('FeePayment - Student ID valid:', isValidUUID(studentDetails?.id));
          console.log('FeePayment - Class ID valid:', isValidUUID(studentDetails?.class_id));
        }
        
        // If no fee structure found, use sample data for development
        let feesToProcess = classFees || [];
        if (!feesToProcess || feesToProcess.length === 0) {
          console.log('FeePayment - No fee structure found, using sample data for development');
          feesToProcess = [
            {
              id: 'sample-fee-1',
              fee_component: 'Tuition Fee',
              amount: 15000,
              due_date: '2024-12-31',
              academic_year: '2024-2025',
              class_id: studentDetails?.class_id,
              created_at: '2024-08-01T00:00:00.000Z'
            },
            {
              id: 'sample-fee-2', 
              fee_component: 'Library Fee',
              amount: 2000,
              due_date: '2024-10-31',
              academic_year: '2024-2025',
              class_id: studentDetails?.class_id,
              created_at: '2024-08-01T00:00:00.000Z'
            },
            {
              id: 'sample-fee-3',
              fee_component: 'Transport Fee', 
              amount: 8000,
              due_date: '2024-09-30',
              academic_year: '2024-2025',
              class_id: studentDetails?.class_id,
              created_at: '2024-08-01T00:00:00.000Z'
            }
          ];
        }

        // Transform fee structure data based on schema
        const transformedFees = feesToProcess.map(fee => {
          // Safely get fee component name
          const feeComponent = fee.fee_component || fee.name || 'General Fee';
          
          // Find payments for this fee component - improved matching logic
          let payments = [];
          if (studentPayments?.length > 0) {
            // Use real payments from database with flexible matching
            payments = studentPayments.filter(p => {
              // More flexible matching - case insensitive and trimmed
              const paymentComponent = (p.fee_component || '').trim().toLowerCase();
              const feeComponentLower = feeComponent.trim().toLowerCase();
              
              // Also try exact match without case sensitivity for academic year
              const paymentYear = (p.academic_year || '').trim();
              const feeYear = (fee.academic_year || '2024-2025').trim();
              
              // Multiple matching strategies
              const exactComponentMatch = paymentComponent === feeComponentLower;
              const partialComponentMatch = paymentComponent.includes(feeComponentLower) || feeComponentLower.includes(paymentComponent);
              const yearMatch = paymentYear === feeYear || !paymentYear || !feeYear; // Be more lenient with year matching
              
              // Use exact match first, then partial if exact fails
              const componentMatch = exactComponentMatch || partialComponentMatch;
              
              // Debug payment matching with more info
              if (componentMatch || exactComponentMatch) {
                console.log(`🔍 FeePayment - Payment matching for "${feeComponent}":`);
                console.log(`  - Payment component: "${paymentComponent}"`);
                console.log(`  - Fee component: "${feeComponentLower}"`);
                console.log(`  - Exact match: ${exactComponentMatch}`);
                console.log(`  - Partial match: ${partialComponentMatch}`);
                console.log(`  - Component match result: ${componentMatch}`);
                console.log(`  - Payment year: "${paymentYear}"`);
                console.log(`  - Fee year: "${feeYear}"`);
                console.log(`  - Year match: ${yearMatch}`);
                console.log(`  - Final match: ${componentMatch && yearMatch}`);
              }
              
              return componentMatch && yearMatch;
            }) || [];
            
            console.log(`✅ FeePayment - Found ${payments.length} payments for "${feeComponent}":`);
            payments.forEach((p, idx) => {
              console.log(`  Payment ${idx + 1}: ID=${p.id}, Amount=₹${p.amount_paid}, Date=${p.payment_date}, Receipt=${p.receipt_number}`);
            });
          } else {
            console.log(`⚠️ FeePayment - No payment data found, using sample payments for "${feeComponent}"`);
            // Use sample payments if no real payments exist
            const samplePaymentAmount = feeComponent === 'Tuition Fee' ? 5000 : 
                                       feeComponent === 'Library Fee' ? 2000 : 0;
            if (samplePaymentAmount > 0) {
              payments = [{
                id: `sample-payment-${feeComponent}`,
                fee_component: feeComponent,
                amount_paid: samplePaymentAmount,
                academic_year: fee.academic_year,
                payment_date: '2024-08-15',
                receipt_number: `SAMPLE-${Date.now()}`,
                payment_mode: 'Sample'
              }];
            }
          }

          const totalPaidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
          const feeAmount = Number(fee.amount || 0);
          const remainingAmount = Math.max(0, feeAmount - totalPaidAmount);

          let status = 'unpaid';
          if (totalPaidAmount >= feeAmount) {
            status = 'paid';
          } else if (totalPaidAmount > 0) {
            status = 'partial';
          }
          
          // Debug status calculation
          console.log(`FeePayment - Status calculation for ${feeComponent}:`);
          console.log(`  - Fee amount: ${feeAmount}`);
          console.log(`  - Total paid: ${totalPaidAmount}`);
          console.log(`  - Remaining: ${remainingAmount}`);
          console.log(`  - Status: ${status}`);
          console.log(`  - Payments count: ${payments.length}`);
          payments.forEach((p, i) => {
            console.log(`    Payment ${i + 1}: ${p.amount_paid} (${p.payment_date})`);
          });

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
        console.log('FeePayment - Fee calculation debug:');
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
        
        // Transform payment history based on schema
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
              receiptNumber: payment.receipt_number || null,
              status: 'completed',
              receiptUrl: null,
              remarks: payment.remarks || '',
              academicYear: payment.academic_year || '2024-2025',
              createdAt: payment.created_at || new Date().toISOString()
            };
          });
        } else {
          // No payment history found - add sample payment history for development
          console.log('FeePayment - No payment history found, using sample payment history');
          transformedPayments = [
            {
              id: 'sample-payment-1',
              feeName: 'Tuition Fee',
              amount: 5000,
              paymentDate: '2024-08-15',
              paymentMethod: 'Card',
              transactionId: 'TXN12345678',
              receiptNumber: 1001,
              status: 'completed',
              receiptUrl: null,
              remarks: 'Partial payment for tuition fee',
              academicYear: '2024-2025',
              createdAt: '2024-08-15T10:30:00.000Z'
            },
            {
              id: 'sample-payment-2',
              feeName: 'Library Fee', 
              amount: 2000,
              paymentDate: '2024-08-20',
              paymentMethod: 'UPI',
              transactionId: 'TXN87654321',
              receiptNumber: 1002,
              status: 'completed',
              receiptUrl: null,
              remarks: 'Full payment for library fee',
              academicYear: '2024-2025',
              createdAt: '2024-08-20T14:15:00.000Z'
            }
          ];
        }

        console.log('FeePayment - Payment history loaded:', transformedPayments.length, 'payments');
        // Debug transformed payments with receipt numbers
        transformedPayments.forEach((payment, index) => {
          console.log(`Transformed Payment ${index + 1}:`);
          console.log('  - ID:', payment.id);
          console.log('  - Receipt Number:', payment.receiptNumber);
          console.log('  - Fee Name:', payment.feeName);
          console.log('  - Amount:', payment.amount);
        });
        setPaymentHistory(transformedPayments);
      } catch (err) {
        console.error('Error fetching fee data:', err);
        setError(err.message);

        // Set empty state when there's an error instead of fallback data
        console.log('FeePayment - Setting empty state due to error:', err.message);
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

  // Get fee statistics for current academic year
  const getFeeStatistics = async (studentId, academicYear = '2024-2025') => {
    try {
      // Get all fee structures for the academic year
      const { data: yearlyFees, error: feesError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('academic_year', academicYear)
        .or(`class_id.eq.${studentData?.class_id},student_id.eq.${studentId}`);

      if (feesError) {
        console.error('Error fetching yearly fees:', feesError);
        return null;
      }

      // Get all payments for the academic year
      const { data: yearlyPayments, error: paymentsError } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year', academicYear);

      if (paymentsError) {
        console.error('Error fetching yearly payments:', paymentsError);
        return null;
      }

      const totalDue = yearlyFees?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;
      const totalPaid = yearlyPayments?.reduce((sum, payment) => sum + Number(payment.amount_paid), 0) || 0;
      const outstanding = totalDue - totalPaid;

      return {
        totalDue,
        totalPaid,
        outstanding,
        paymentCount: yearlyPayments?.length || 0,
        feeComponentsCount: yearlyFees?.length || 0
      };
    } catch (error) {
      console.error('Error calculating fee statistics:', error);
      return null;
    }
  };

  // Get fee breakdown by category
  const getFeeBreakdown = () => {
    if (!feeStructure?.fees) return {};

    const breakdown = {};
    feeStructure.fees.forEach(fee => {
      if (!breakdown[fee.category]) {
        breakdown[fee.category] = {
          totalAmount: 0,
          paidAmount: 0,
          count: 0
        };
      }
      breakdown[fee.category].totalAmount += fee.amount;
      breakdown[fee.category].paidAmount += fee.paidAmount;
      breakdown[fee.category].count += 1;
    });

    return breakdown;
  };

  // Get overdue fees
  const getOverdueFees = () => {
    if (!feeStructure?.fees) return [];

    const today = new Date();
    return feeStructure.fees.filter(fee => {
      const dueDate = new Date(fee.dueDate);
      return dueDate < today && fee.status !== 'paid';
    });
  };

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
      console.log('=== PAYMENT BUTTON CLICKED ===');
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

      console.log('Setting selected fee and opening payment form');
      setSelectedFee(fee);
      setSelectedFeeComponent(fee);
      setPaymentAmount(fee.remainingAmount?.toString() || fee.amount?.toString() || '');
      setPaymentDate(new Date());
      setPaymentMode('Card');
      setPaymentRemarks('');
      setPaymentModalVisible(true);
      console.log('Payment form modal should now be visible');
    } catch (error) {
      console.error('Error in handlePayment:', error);
      Alert.alert('Error', `Failed to open payment form: ${error.message}`);
    }
  };

  // State for admin-style payment recording
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentMode, setPaymentMode] = useState('Card');
  const [selectedFeeComponent, setSelectedFeeComponent] = useState(null);
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastPaymentRecord, setLastPaymentRecord] = useState(null);
  const [receiptModal, setReceiptModal] = useState(false);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [schoolLogo, setSchoolLogo] = useState(null);
  const [feeComponents, setFeeComponents] = useState([]);

  // Missing state variables for legacy payment modal flow
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({});
  const [paymentMethodModalVisible, setPaymentMethodModalVisible] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptModalVisible2, setReceiptModalVisible2] = useState(false);

  // Load school details and logo
  const loadSchoolDetails = async () => {
    try {
      const { data: schoolData, error } = await supabase
        .from('school_details')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading school details:', error);
        return;
      }

      if (schoolData) {
        setSchoolDetails(schoolData);
        
        // Load school logo if available
        if (schoolData.logo_url) {
          try {
            const { data: logoData } = await supabase.storage
              .from('school-assets')
              .getPublicUrl(schoolData.logo_url);
            
            if (logoData?.publicUrl) {
              setSchoolLogo(logoData.publicUrl);
            }
          } catch (logoError) {
            console.error('Error loading school logo:', logoError);
          }
        }
      } else {
        setSchoolDetails({
          name: 'School Management System',
          type: 'School',
          address: '',
          phone: '',
          email: ''
        });
      }
    } catch (error) {
      console.error('Error in loadSchoolDetails:', error);
      setSchoolDetails({
        name: 'School Management System',
        type: 'School',
        address: '',
        phone: '',
        email: ''
      });
    }
  };

  // Load school details on component mount
  useEffect(() => {
    loadSchoolDetails();
  }, []);

  // Admin-style payment recording functions
  const handleSubmitPayment = async () => {
    try {
      // Validation
      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid payment amount');
        return;
      }

      if (!selectedFeeComponent) {
        Alert.alert('Validation Error', 'Please select a fee component');
        return;
      }

      setPaymentLoading(true);

      console.log('FeePayment - Starting admin payment process...', {
        student_id: studentData?.id,
        fee_component: selectedFeeComponent.name,
        amount: parseFloat(paymentAmount),
        payment_mode: paymentMode
      });

      // Generate receipt number
      const receiptNumber = await getNextReceiptNumber();
      console.log('FeePayment - Generated receipt number:', receiptNumber);

      // Prepare payment data
      const paymentData = {
        student_id: studentData?.id,
        tenant_id: user?.tenant_id || null,
        academic_year: selectedFeeComponent.academicYear || '2024-2025',
        fee_component: selectedFeeComponent.name,
        amount_paid: parseFloat(paymentAmount),
        payment_date: paymentDate.toISOString().split('T')[0],
        payment_mode: paymentMode,
        receipt_number: receiptNumber,
        remarks: paymentRemarks || `Payment for ${selectedFeeComponent.name}`
      };

      console.log('FeePayment - Payment data to insert:', paymentData);

      // Save to database with better error handling
      if (studentData?.id && isValidUUID(studentData.id)) {
        const { data, error } = await supabase
          .from('student_fees')
          .insert([paymentData])
          .select();

        if (error) {
          console.error('FeePayment - Database error saving payment:', error);
          Alert.alert(
            'Database Error', 
            `Failed to save payment: ${error.message}\n\nPlease check your connection and try again.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }

        console.log('FeePayment - Payment saved successfully to database:', data);
        
        // Show success alert
        Alert.alert(
          'Payment Recorded',
          `Payment of ₹${parseFloat(paymentAmount).toFixed(2)} has been successfully recorded for ${selectedFeeComponent.name}.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        console.log('FeePayment - Skipping database save (invalid student ID or demo mode)');
        // Show demo mode success message
        Alert.alert(
          'Demo Payment Recorded',
          `Demo payment of ₹${parseFloat(paymentAmount).toFixed(2)} recorded for ${selectedFeeComponent.name}.`,
          [{ text: 'OK', style: 'default' }]
        );
      }

      // Create receipt data
      const receiptInfo = {
        receipt_no: receiptNumber,
        student_name: studentData?.name || 'Student',
        student_admission_no: studentData?.admission_no || 'N/A',
        student_roll_no: studentData?.roll_no || 'N/A',
        fee_component: selectedFeeComponent.name,
        amount_paid: parseFloat(paymentAmount),
        payment_date: paymentDate.toISOString().split('T')[0],
        payment_date_formatted: formatSafeDate(paymentDate),
        payment_mode: paymentMode,
        academic_year: selectedFeeComponent.academicYear || '2024-2025',
        transaction_id: `PAY${Date.now()}`,
        payment_details: `${paymentMode} payment`,
        amount_in_words: numberToWords(parseFloat(paymentAmount))
      };

      setLastPaymentRecord(receiptInfo);
      setPaymentModalVisible(false);
      setReceiptModal(true);

      // Enhanced refresh mechanism with better verification
      console.log('FeePayment - Refreshing fee data after admin payment...');
      
      const performVerifiedRefresh = async (attempts = 0) => {
        try {
          const maxAttempts = 3;
          const baseDelay = 1000;
          
          if (attempts >= maxAttempts) {
            console.log('FeePayment - Max refresh attempts reached, forcing final refresh');
            await fetchFeeData();
            return;
          }
          
          // Check if payment exists in database with retry logic
          const { data: recentPayment, error: paymentCheckError } = await supabase
            .from('student_fees')
            .select('id, amount_paid, fee_component, payment_date, receipt_number')
            .eq('receipt_number', receiptNumber)
            .single();
            
          if (recentPayment && !paymentCheckError) {
            console.log('✅ FeePayment - Payment verified in database:', {
              id: recentPayment.id,
              amount: recentPayment.amount_paid,
              component: recentPayment.fee_component,
              receipt: recentPayment.receipt_number
            });
            
            // Payment confirmed, refresh fee data
            await fetchFeeData();
            console.log('✅ FeePayment - Fee data refreshed successfully after verified payment');
            
          } else {
            console.log(`⏳ FeePayment - Payment not yet found (attempt ${attempts + 1}/${maxAttempts}), retrying...`);
            
            // Exponential backoff for retries
            const delay = baseDelay * Math.pow(1.5, attempts);
            setTimeout(() => {
              performVerifiedRefresh(attempts + 1);
            }, delay);
          }
        } catch (refreshError) {
          console.error('❌ FeePayment - Error in verified refresh:', refreshError);
          
          // Fallback: try basic refresh without verification
          try {
            console.log('🔄 FeePayment - Attempting fallback refresh...');
            await fetchFeeData();
            console.log('✅ FeePayment - Fallback refresh completed');
          } catch (finalError) {
            console.error('❌ FeePayment - Fallback refresh also failed:', finalError);
            Alert.alert(
              'Refresh Warning', 
              'Payment was saved successfully, but the display may not update immediately. Please pull down to refresh manually.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        }
      };
      
      // Start the verified refresh process
      setTimeout(() => {
        performVerifiedRefresh();
      }, 500); // Initial delay to allow database write to complete

      // Reset form
      setPaymentAmount('');
      setPaymentRemarks('');
      setSelectedFeeComponent(null);

    } catch (error) {
      console.error('FeePayment - Error in handleSubmitPayment:', error);
      Alert.alert(
        'Payment Error', 
        `An unexpected error occurred while processing the payment: ${error.message}\n\nPlease try again.`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle date selection
  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setPaymentDate(date);
    }
  };

  // Get payment mode options
  const getPaymentModes = () => {
    return ['Card', 'UPI', 'Bank Transfer'];
  };

  // Render fee component chips
  const renderFeeComponentChips = () => {
    if (!feeStructure?.fees) return null;

    const unpaidFees = feeStructure.fees.filter(fee => fee.status !== 'paid');

    return (
      <View style={styles.feeChipsContainer}>
        <Text style={styles.feeChipsTitle}>Select Fee Component</Text>
        <View style={styles.feeChips}>
          {unpaidFees.map((fee) => (
            <TouchableOpacity
              key={fee.id}
              style={[
                styles.feeChip,
                selectedFeeComponent?.id === fee.id && styles.selectedFeeChip
              ]}
              onPress={() => {
                setSelectedFeeComponent(fee);
                setPaymentAmount(fee.remainingAmount?.toString() || fee.amount?.toString() || '');
              }}
            >
              <Text style={[
                styles.feeChipText,
                selectedFeeComponent?.id === fee.id && styles.selectedFeeChipText
              ]}>
                {fee.name}
              </Text>
              <Text style={[
                styles.feeChipAmount,
                selectedFeeComponent?.id === fee.id && styles.selectedFeeChipAmount
              ]}>
                ₹{fee.remainingAmount || fee.amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Handle print receipt for admin-style receipt
  const handlePrintAdminReceipt = async () => {
    try {
      if (!lastPaymentRecord) {
        Alert.alert('Error', 'No receipt data available');
        return;
      }
      
      const pdfUri = await generateReceiptPDF(lastPaymentRecord);
      await Print.printAsync({ uri: pdfUri });
    } catch (error) {
      console.error('Error printing receipt:', error);
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  // Handle share receipt for admin-style receipt
  const handleShareAdminReceipt = async () => {
    try {
      if (!lastPaymentRecord) {
        Alert.alert('Error', 'No receipt data available');
        return;
      }
      
      const pdfUri = await generateReceiptPDF(lastPaymentRecord);
      
      if (await Sharing.isAvailableAsync()) {
        const fileName = `Receipt_${lastPaymentRecord.receipt_no}_${lastPaymentRecord.student_name.replace(/\s+/g, '_')}.pdf`;
        const newPath = FileSystem.documentDirectory + fileName;
        
        await FileSystem.copyAsync({
          from: pdfUri,
          to: newPath
        });
        
        await Sharing.shareAsync(newPath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Receipt'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  // Handle admin receipt modal close
  const handleAdminReceiptDone = () => {
    setReceiptModal(false);
    setLastPaymentRecord(null);
  };

  // Convert number to words (simple implementation)
  const numberToWords = (amount) => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (amount === 0) return 'zero';
    if (amount < 10) return ones[amount];
    if (amount < 20) return teens[amount - 10];
    if (amount < 100) return tens[Math.floor(amount / 10)] + (amount % 10 !== 0 ? ' ' + ones[amount % 10] : '');
    if (amount < 1000) {
      const hundreds = Math.floor(amount / 100);
      const remainder = amount % 100;
      return ones[hundreds] + ' hundred' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
    }
    if (amount < 100000) {
      const thousands = Math.floor(amount / 1000);
      const remainder = amount % 1000;
      return numberToWords(thousands) + ' thousand' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
    }
    if (amount < 10000000) {
      const lakhs = Math.floor(amount / 100000);
      const remainder = amount % 100000;
      return numberToWords(lakhs) + ' lakh' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
    }
    
    return amount.toString(); // Fallback for very large numbers
  };

  // Format date safely
  const formatSafeDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Handle payment method selection - Open specific payment modal
  const handlePaymentMethodSelect = (method) => {
    try {
      console.log('=== PAYMENT METHOD SELECTED ===');
      console.log('Method:', JSON.stringify(method, null, 2));
      console.log('Selected fee:', JSON.stringify(selectedFee, null, 2));

      setPaymentModalVisible(false); // Close payment selection modal
      setSelectedPaymentMethod(method);
      setPaymentFormData(getInitialFormData(method.id));
      setPaymentMethodModalVisible(true); // Open specific payment method modal
    } catch (error) {
      console.error('Payment method selection error:', error);
      Alert.alert('Error', `Failed to process payment method selection: ${error.message}`);
    }
  };



  // Get initial form data based on payment method
  const getInitialFormData = (methodId) => {
    switch (methodId) {
      case 'Card':
        return {
          cardNumber: '',
          expiryDate: '',
          cvv: '',
          cardHolderName: '',
          saveCard: false
        };
      case 'UPI':
        return {
          upiId: '',
          verifyUpiId: false
        };
      case 'Online':
        return {
          bankName: '',
          accountType: 'savings'
        };
      case 'Cash':
        return {
          receiptNumber: '',
          paidAt: 'School Office'
        };
      default:
        return {};
    }
  };



  // Validate payment form data
  const validatePaymentForm = (methodId, formData) => {
    switch (methodId) {
      case 'Card':
        if (!formData.cardNumber || formData.cardNumber.length < 16) {
          return 'Please enter a valid card number';
        }
        if (!formData.expiryDate || !/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
          return 'Please enter expiry date in MM/YY format';
        }
        if (!formData.cvv || formData.cvv.length < 3) {
          return 'Please enter a valid CVV';
        }
        if (!formData.cardHolderName || formData.cardHolderName.trim().length < 2) {
          return 'Please enter card holder name';
        }
        break;
      case 'UPI':
        if (!formData.upiId || !formData.upiId.includes('@')) {
          return 'Please enter a valid UPI ID';
        }
        break;
      case 'Online':
        if (!formData.bankName) {
          return 'Please select a bank';
        }
        break;
      case 'Cash':
        // Cash payments don't need validation
        break;
    }
    return null;
  };

  // Get next receipt number from database
  const getNextReceiptNumber = async () => {
    try {
      // Try to get the maximum receipt number from existing records
      const { data: maxReceiptData, error: maxError } = await supabase
        .from('student_fees')
        .select('receipt_number')
        .not('receipt_number', 'is', null)
        .eq('tenant_id', user?.tenant_id || null)
        .order('receipt_number', { ascending: false })
        .limit(1)
        .single();
      
      if (maxError && maxError.code !== 'PGRST116') {
        console.error('Error getting max receipt number:', maxError);
        // Fallback: start from 1000
        return 1000;
      }
      
      const maxReceiptNumber = maxReceiptData?.receipt_number || 999;
      const nextReceiptNumber = maxReceiptNumber + 1;
      
      console.log('Max receipt number found:', maxReceiptNumber);
      console.log('Next receipt number will be:', nextReceiptNumber);
      
      return nextReceiptNumber;
    } catch (error) {
      console.error('Error in getNextReceiptNumber:', error);
      // Fallback: start from 1000
      return 1000;
    }
  };

  // Process payment and save to database
  const processPayment = async (paymentData) => {
    try {
      console.log('Processing payment with data:', paymentData);
      console.log('Student data for payment:', studentData);

      // Validate student data
      const studentId = studentData?.id;
      if (!studentId || studentId === 'undefined' || typeof studentId !== 'string') {
        console.log('Invalid student ID, using sample payment processing');
        // For demo purposes, simulate successful payment without database insert
        return {
          success: true,
          data: {
            id: `sample-payment-${Date.now()}`,
            message: 'Payment processed successfully (demo mode)',
            receipt_number: await getNextReceiptNumber()
          }
        };
      }

      // Generate receipt number in frontend
      const receiptNumber = await getNextReceiptNumber();
      console.log('Generated receipt number:', receiptNumber);

      // Insert new student fee record with the generated receipt number
      const { data, error } = await supabase
        .from('student_fees')
        .insert([
          {
            student_id: studentId,
            tenant_id: user?.tenant_id || null,
            academic_year: paymentData.academicYear || '2024-2025',
            fee_component: paymentData.feeComponent,
            amount_paid: Number(paymentData.amount),
            payment_date: paymentData.paymentDate || new Date().toISOString().split('T')[0],
            payment_mode: paymentData.paymentMode || 'Online',
            receipt_number: receiptNumber,
            remarks: paymentData.remarks || `Payment for ${paymentData.feeComponent}`
          }
        ])
        .select();

      if (error) {
        console.error('Database error during payment:', error);
        // Even if database fails, return success for demo
        return {
          success: true,
          data: {
            id: `fallback-payment-${Date.now()}`,
            message: 'Payment processed successfully (fallback mode)'
          }
        };
      }

      // Refresh fee data after successful payment
      try {
        const { data: parentUserData } = await dbHelpers.getParentByUserId(user.id);
        if (parentUserData?.students) {
          await fetchFeeData();
        }
      } catch (refreshError) {
        console.log('Error refreshing fee data:', refreshError);
        // Don't fail the payment if refresh fails
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error processing payment:', error);
      // Return success even on error for demo purposes
      return {
        success: true,
        data: {
          id: `error-fallback-${Date.now()}`,
          message: 'Payment processed successfully (error fallback)'
        }
      };
    }
  };

  // Individual payment processing functions with form data
  const processCardPayment = async (formData) => {
    // Simulate card payment processing with form data
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 90% success rate
        const success = Math.random() > 0.1;
        resolve({
          success,
          transactionId: success ? `CARD${Date.now()}` : null,
          error: success ? null : 'Card payment failed. Please check your card details.',
          paymentDetails: {
            cardNumber: `****-****-****-${formData.cardNumber.slice(-4)}`,
            cardHolderName: formData.cardHolderName
          }
        });
      }, 2000);
    });
  };

  const processUPIPayment = async (formData) => {
    // Simulate UPI payment processing with form data
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 95% success rate
        const success = Math.random() > 0.05;
        resolve({
          success,
          transactionId: success ? `UPI${Date.now()}` : null,
          error: success ? null : 'UPI payment failed. Please try again.',
          paymentDetails: {
            upiId: formData.upiId
          }
        });
      }, 1500);
    });
  };

  const processOnlinePayment = async (formData) => {
    // Simulate online banking payment with form data
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 85% success rate
        const success = Math.random() > 0.15;
        resolve({
          success,
          transactionId: success ? `NET${Date.now()}` : null,
          error: success ? null : 'Online payment failed. Please check your internet connection.',
          paymentDetails: {
            bankName: formData.bankName,
            accountType: formData.accountType
          }
        });
      }, 3000);
    });
  };

  const processCashPayment = async (formData) => {
    // Cash payments are always successful (recorded manually)
    return Promise.resolve({
      success: true,
      transactionId: `CASH${Date.now()}`,
      error: null,
      paymentDetails: {
        receiptNumber: formData.receiptNumber || 'N/A',
        paidAt: formData.paidAt
      }
    });
  };

  // Get pending fees for a student using easy.txt recommendation
  const getPendingFees = async (studentId) => {
    try {
      if (!isValidUUID(studentId)) {
        console.log('FeePayment - Invalid student ID for pending fees:', studentId);
        return [];
      }

      const { data: pendingFees, error } = await supabase
        .from('student_fees')
        .select(`
          *,
          fee_structure(*)
        `)
        .eq('student_id', studentId)
        .in('status', ['unpaid', 'partial']);

      if (error) {
        console.error('Error fetching pending fees:', error);
        return [];
      }

      return pendingFees || [];
    } catch (error) {
      console.error('Error in getPendingFees:', error);
      return [];
    }
  };

  // Get payment methods available
  const getPaymentMethods = () => {
    return [
      { id: 'Online', name: 'Online Payment', icon: 'card', description: 'Pay using Net Banking' },
      { id: 'UPI', name: 'UPI Payment', icon: 'qr-code-outline', description: 'Pay using UPI apps' },
      { id: 'Card', name: 'Credit/Debit Card', icon: 'card-outline', description: 'Pay using your card' }
    ];
  };


  // Get fee structure amount by ID using easy.txt recommendation
  const getFeeStructureAmount = async (feeId) => {
    try {
      if (!isValidUUID(feeId)) {
        return 0;
      }

      const { data: feeData, error } = await supabase
        .from('fee_structure')
        .select('amount')
        .eq('id', feeId)
        .single();

      if (error) {
        console.error('Error fetching fee amount:', error);
        return 0;
      }

      return feeData?.amount || 0;
    } catch (error) {
      console.error('Error in getFeeStructureAmount:', error);
      return 0;
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

  // Get recent payments (last 5)
  const getRecentPayments = () => {
    return paymentHistory.slice(0, 5);
  };



  // Calculate payment summary for a specific period
  const getPaymentSummary = (startDate, endDate) => {
    const filteredPayments = paymentHistory.filter(payment => {
      const paymentDate = new Date(payment.paymentDate);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    return {
      totalAmount: filteredPayments.reduce((sum, payment) => sum + payment.amount, 0),
      paymentCount: filteredPayments.length,
      payments: filteredPayments
    };
  };

  const handleDownloadReceipt = async (receipt) => {
    console.log('=== RECEIPT DOWNLOAD DEBUG ===');
    console.log('Selected Receipt Object:', JSON.stringify(receipt, null, 2));
    console.log('Receipt Number from Object:', receipt.receiptNumber);
    console.log('Receipt ID:', receipt.id);
    console.log('School Data:', schoolData);
    
    // If receipt number is missing, try to fetch it directly from the database
    if (!receipt.receiptNumber && receipt.id) {
      console.log('Receipt number missing, fetching from database...');
      try {
        const { data: freshData, error } = await supabase
          .from('student_fees')
          .select('receipt_number')
          .eq('id', receipt.id)
          .single();
          
        if (!error && freshData?.receipt_number) {
          console.log('Found receipt number in database:', freshData.receipt_number);
          // Update the receipt object with the fresh receipt number
          receipt.receiptNumber = freshData.receipt_number;
        } else {
          console.log('No receipt number found in database for ID:', receipt.id);
        }
      } catch (fetchError) {
        console.error('Error fetching receipt number:', fetchError);
      }
    }
    
    setSelectedReceipt(receipt);
    setReceiptModalVisible(true);
  };

  const handleConfirmDownload = async () => {
    if (!selectedReceipt) return;

    try {
      // Generate receipt HTML
      const htmlContent = await generateReceiptHTML(selectedReceipt);
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = selectedReceipt.receiptNumber ? 
        `Receipt_${selectedReceipt.receiptNumber}.pdf` : 
        `Receipt_${selectedReceipt.feeName.replace(/\s+/g, '_')}.pdf`;

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

  const generateReceiptHTML = async (receipt) => {
    console.log('=== GENERATE RECEIPT HTML DEBUG ===');
    console.log('Receipt object in generateReceiptHTML:', JSON.stringify(receipt, null, 2));
    console.log('Receipt number being used:', receipt.receiptNumber);
    console.log('School data:', schoolData);
    
    // Get school logo as base64 if available using standardized utility
    const logoBase64 = schoolData?.logo_url ? await getSchoolLogoBase64(schoolData.logo_url) : null;
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
            <div class="school-name">${schoolData?.name || schoolData?.school_name || 'ABC School'}</div>
            ${schoolData?.address ? `<div class="school-info">${schoolData.address}</div>` : ''}
            ${schoolData?.phone ? `<div class="school-info">Phone: ${schoolData.phone}</div>` : ''}
            ${schoolData?.email ? `<div class="school-info">Email: ${schoolData.email}</div>` : ''}
            <div class="receipt-title">FEE PAYMENT RECEIPT</div>
            ${receipt.receiptNumber ? `<div class="receipt-number">Receipt No: ${receipt.receiptNumber}</div>` : ''}
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
            ${receipt.receiptNumber ? `
            <div class="info-row">
              <span><strong>Receipt Number:</strong> ${receipt.receiptNumber}</span>
              <span><strong>Academic Year:</strong> ${receipt.academicYear || '2024-2025'}</span>
            </div>` : ''}
          </div>

          <div class="amount-section">
            <div class="amount">₹${receipt.amount}</div>
            <div class="amount-label">Amount Paid</div>
          </div>

          <div class="footer">
            <p>This is a computer generated receipt. No signature required.</p>
            <p>Thank you for your payment!</p>
            <p>Generated on ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}</p>
          </div>
        </body>
      </html>
    `;
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
            {item.status === 'partial' ? 'Pay Remaining' : 'Pay Now'}
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
        <Text style={styles.historyDate}>{item.paymentDate}</Text>
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

  // Handle specific payment method processing
  const handlePaymentMethodSubmit = async () => {
    try {
      const validationError = validatePaymentForm(selectedPaymentMethod.id, paymentFormData);
      if (validationError) {
        Alert.alert('Validation Error', validationError);
        return;
      }

      setPaymentProcessing(true);
      
      let paymentResult;
      switch (selectedPaymentMethod.id) {
        case 'Card':
          paymentResult = await processCardPayment(paymentFormData);
          break;
        case 'UPI':
          paymentResult = await processUPIPayment(paymentFormData);
          break;
        case 'Online':
          paymentResult = await processOnlinePayment(paymentFormData);
          break;
        default:
          throw new Error('Unsupported payment method');
      }

      if (paymentResult.success) {
        // Generate receipt number
        const receiptNumber = await getNextReceiptNumber();
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Save payment to database
        if (studentData && studentData.id && studentData.id !== 'sample-student-id') {
          try {
            console.log('FeePayment - Saving payment to database...', {
              student_id: studentData.id,
              tenant_id: user?.tenant_id,
              fee_component: selectedFee.name,
              amount_paid: Number(selectedFee.remainingAmount || selectedFee.amount)
            });
            
            const { data, error } = await supabase
              .from('student_fees')
              .insert([
                {
                  student_id: studentData.id,
                  tenant_id: user?.tenant_id || null,
                  academic_year: selectedFee.academicYear || '2024-2025',
                  fee_component: selectedFee.name,
                  amount_paid: Number(selectedFee.remainingAmount || selectedFee.amount),
                  payment_date: currentDate,
                  payment_mode: selectedPaymentMethod.name,
                  receipt_number: receiptNumber,
                  remarks: `${selectedPaymentMethod.name} payment`
                }
              ])
              .select();
              
            if (error) {
              console.error('Error saving payment:', error);
              Alert.alert('Database Error', `Failed to save payment: ${error.message}`);
              return; // Stop processing if save fails
            } else {
              console.log('FeePayment - Payment saved successfully to database:', data);
            }
          } catch (saveError) {
            console.error('Error saving payment to database:', saveError);
            Alert.alert('Database Error', `Failed to save payment: ${saveError.message}`);
            return; // Stop processing if save fails
          }
        } else {
          console.log('FeePayment - Skipping database save (invalid student data or sample mode)');
        }
        
        // Prepare receipt data
        const receiptInfo = {
          receipt_no: receiptNumber,
          student_name: studentData.name,
          student_admission_no: studentData.admission_no,
          student_roll_no: studentData.roll_no,
          fee_component: selectedFee.name,
          amount_paid: Number(selectedFee.remainingAmount || selectedFee.amount),
          payment_date: currentDate,
          payment_date_formatted: formatSafeDate(currentDate),
          payment_mode: selectedPaymentMethod.name,
          academic_year: selectedFee.academicYear || '2024-2025',
          transaction_id: paymentResult.transactionId,
          payment_details: getPaymentDetailsString(selectedPaymentMethod.id, paymentFormData),
          amount_in_words: numberToWords(parseFloat(selectedFee.remainingAmount || selectedFee.amount))
        };
        
        setReceiptData(receiptInfo);
        setPaymentMethodModalVisible(false);
        setReceiptModalVisible2(true);
        
        // Refresh fee data with better verification and delay
        console.log('FeePayment - Refreshing fee data after payment...');
        setTimeout(async () => {
          try {
            // Verify the payment was saved by checking the database
            const { data: recentPayment, error: paymentCheckError } = await supabase
              .from('student_fees')
              .select('id, amount_paid, fee_component')
              .eq('receipt_number', receiptNumber)
              .single();
              
            if (recentPayment) {
              console.log('FeePayment - Verified payment in database:', recentPayment);
              // Payment confirmed, now refresh fee data
              await fetchFeeData();
              console.log('FeePayment - Fee data refreshed successfully after payment');
            } else {
              console.log('FeePayment - Payment not found in database, trying longer delay');
              // Try one more time with longer delay
              setTimeout(async () => {
                await fetchFeeData();
              }, 1000);
            }
          } catch (refreshError) {
            console.error('Error refreshing fee data after payment:', refreshError);
            // Still try to refresh even if verification fails
            try {
              await fetchFeeData();
            } catch (finalError) {
              console.error('Final refresh attempt failed:', finalError);
            }
          }
        }, 1000);
      } else {
        Alert.alert('Payment Failed', paymentResult.error || 'Payment processing failed');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'An error occurred while processing your payment. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Get payment details string for receipt
  const getPaymentDetailsString = (methodId, formData) => {
    switch (methodId) {
      case 'Card':
        return `Card: ****-****-****-${formData.cardNumber?.slice(-4) || '****'}`;
      case 'UPI':
        return `UPI ID: ${formData.upiId || 'N/A'}`;
      case 'Online':
        return `Bank: ${formData.bankName || 'N/A'}`;
      default:
        return 'Payment processed';
    }
  };

  // Generate receipt PDF for new payments
  const generateReceiptPDF = async (receiptInfo) => {
    try {
      // Get school logo using standardized utility
      const logoBase64 = schoolData?.logo_url ? await getSchoolLogoBase64(schoolData.logo_url) : null;
      const logoHTML = getLogoHTML(logoBase64, { width: '80px', height: '80px' });
      
      const html = `
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px;
              background: white;
            }
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              border: 2px solid #2196F3;
              padding: 30px;
              background: white;
              border-radius: 10px;
            }
            ${getReceiptHeaderCSS()}
            .receipt-details {
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px dotted #ccc;
            }
            .detail-label {
              font-weight: 500;
              color: #333;
              flex: 1;
            }
            .detail-value {
              color: #666;
              flex: 1;
              text-align: right;
              font-weight: 600;
            }
            .amount-row {
              background-color: #e8f5e8;
              border: 2px solid #4CAF50;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
              text-align: center;
            }
            .amount-label {
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
            }
            .amount-value {
              font-size: 32px;
              font-weight: bold;
              color: #4CAF50;
              margin-bottom: 10px;
            }
            .amount-words {
              font-style: italic;
              color: #666;
              font-size: 14px;
              text-transform: capitalize;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              font-size: 12px;
              color: #999;
            }
            .footer p {
              margin: 5px 0;
            }
            .signature {
              text-align: right;
              margin-top: 40px;
            }
            .signature-line {
              border-top: 1px solid #333;
              width: 200px;
              margin-left: auto;
              margin-top: 40px;
              text-align: center;
              padding-top: 5px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="receipt-header">
              ${logoHTML}
              <div class="school-name">${schoolDetails?.name || 'School Management System'}</div>
              ${schoolDetails?.address ? `<div class="school-info">${schoolDetails.address}</div>` : ''}
              ${schoolDetails?.phone ? `<div class="school-info">Phone: ${schoolDetails.phone}</div>` : ''}
              ${schoolDetails?.email ? `<div class="school-info">Email: ${schoolDetails.email}</div>` : ''}
              <div class="receipt-title">FEE PAYMENT RECEIPT</div>
              <div class="receipt-number">Receipt No: ${receiptInfo.receipt_no}</div>
            </div>
            
            <div class="receipt-details">
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${receiptInfo.payment_date_formatted}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Student Name:</span>
                <span class="detail-value">${receiptInfo.student_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Admission No:</span>
                <span class="detail-value">${receiptInfo.student_admission_no}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Roll No:</span>
                <span class="detail-value">${receiptInfo.student_roll_no}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Academic Year:</span>
                <span class="detail-value">${receiptInfo.academic_year}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fee Component:</span>
                <span class="detail-value">${receiptInfo.fee_component}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Mode:</span>
                <span class="detail-value">${receiptInfo.payment_mode}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Transaction ID:</span>
                <span class="detail-value">${receiptInfo.transaction_id}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Details:</span>
                <span class="detail-value">${receiptInfo.payment_details}</span>
              </div>
            </div>
            
            <div class="amount-row">
              <div class="amount-label">Amount Paid</div>
              <div class="amount-value">₹${receiptInfo.amount_paid.toFixed(2)}</div>
              <div class="amount-words">
                ${receiptInfo.amount_in_words.toUpperCase()} RUPEES ONLY
              </div>
            </div>
            
            <div class="signature">
              <div class="signature-line">
                Authorized Signature
              </div>
            </div>
            
            <div class="footer">
              <p>This is a computer-generated receipt and does not require a physical signature.</p>
              <p>Generated on ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const { uri } = await Print.printToFileAsync({ html });
      return uri;
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      throw error;
    }
  };

  // Handle print receipt
  const handlePrintReceipt = async () => {
    try {
      if (!receiptData) {
        Alert.alert('Error', 'No receipt data available');
        return;
      }
      
      await generateReceiptPDF(receiptData);
      await Print.printAsync({ uri: await generateReceiptPDF(receiptData) });
    } catch (error) {
      console.error('Error printing receipt:', error);
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  // Handle share receipt
  const handleShareReceipt = async () => {
    try {
      if (!receiptData) {
        Alert.alert('Error', 'No receipt data available');
        return;
      }
      
      const pdfUri = await generateReceiptPDF(receiptData);
      
      if (await Sharing.isAvailableAsync()) {
        const fileName = `Receipt_${receiptData.receipt_no}_${receiptData.student_name.replace(/\s+/g, '_')}.pdf`;
        const newPath = FileSystem.documentDirectory + fileName;
        
        await FileSystem.copyAsync({
          from: pdfUri,
          to: newPath
        });
        
        await Sharing.shareAsync(newPath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Receipt'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  // Handle receipt modal close
  const handleReceiptDone = () => {
    setReceiptModalVisible2(false);
    setReceiptData(null);
    setSelectedFee(null);
  };

  // Get popular banks for online banking
  const getPopularBanks = () => {
    return [
      { name: 'State Bank of India', code: 'SBI' },
      { name: 'HDFC Bank', code: 'HDFC' },
      { name: 'ICICI Bank', code: 'ICICI' },
      { name: 'Axis Bank', code: 'AXIS' },
      { name: 'Punjab National Bank', code: 'PNB' },
      { name: 'Bank of Baroda', code: 'BOB' },
      { name: 'Canara Bank', code: 'CANARA' },
      { name: 'Union Bank of India', code: 'UNION' },
    ];
  };

  // Render payment form based on selected method
  const renderPaymentForm = () => {
    if (!selectedPaymentMethod) return null;

    switch (selectedPaymentMethod.id) {
      case 'Card':
        return (
          <View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Card Number</Text>
              <TextInput
                style={styles.formInput}
                placeholder="1234 5678 9012 3456"
                value={paymentFormData.cardNumber}
                onChangeText={(text) => setPaymentFormData({...paymentFormData, cardNumber: text.replace(/\s/g, '')})}
                keyboardType="numeric"
                maxLength={16}
              />
            </View>
            
            <View style={styles.formRow}>
              <View style={[styles.formGroup, {flex: 1, marginRight: 8}]}>
                <Text style={styles.formLabel}>Expiry Date</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="MM/YY"
                  value={paymentFormData.expiryDate}
                  onChangeText={(text) => {
                    const formatted = text.replace(/\D/g, '').replace(/(\d{2})(\d{0,2})/, '$1/$2');
                    setPaymentFormData({...paymentFormData, expiryDate: formatted});
                  }}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              
              <View style={[styles.formGroup, {flex: 1, marginLeft: 8}]}>
                <Text style={styles.formLabel}>CVV</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="123"
                  value={paymentFormData.cvv}
                  onChangeText={(text) => setPaymentFormData({...paymentFormData, cvv: text.replace(/\D/g, '')})}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Card Holder Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="John Doe"
                value={paymentFormData.cardHolderName}
                onChangeText={(text) => setPaymentFormData({...paymentFormData, cardHolderName: text})}
                autoCapitalize="words"
              />
            </View>
          </View>
        );
        
      case 'UPI':
        return (
          <View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>UPI ID</Text>
              <TextInput
                style={styles.formInput}
                placeholder="yourname@paytm"
                value={paymentFormData.upiId}
                onChangeText={(text) => setPaymentFormData({...paymentFormData, upiId: text.toLowerCase()})}
                autoCapitalize="none"
              />
              <View style={styles.upiInfo}>
                <Ionicons name="information-circle" size={16} color="#1976d2" />
                <Text style={styles.upiInfoText}>
                  Enter your UPI ID (e.g., yourname@paytm, yourname@gpay)
                </Text>
              </View>
            </View>
          </View>
        );
        
      case 'Online':
        return (
          <View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Select Your Bank</Text>
              <View style={styles.bankSelector}>
                {getPopularBanks().map((bank) => (
                  <TouchableOpacity
                    key={bank.code}
                    style={[
                      styles.bankOption,
                      paymentFormData.bankName === bank.name && styles.selectedBankOption
                    ]}
                    onPress={() => setPaymentFormData({...paymentFormData, bankName: bank.name})}
                  >
                    <Text style={[
                      styles.bankOptionText,
                      paymentFormData.bankName === bank.name && styles.selectedBankOptionText
                    ]}>
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.cashInfo}>
                <Ionicons name="information-circle" size={16} color="#f57c00" />
                <Text style={styles.cashInfoText}>
                  You will be redirected to your bank's secure website to complete the payment.
                </Text>
              </View>
            </View>
          </View>
        );
        
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Fee Payment" showBack={true} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading fee information...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Fee Payment" showBack={true} />
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.errorText}>Failed to load fee information</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!feeStructure) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Fee Payment" showBack={true} />
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No fee information available</Text>
            <Text style={styles.emptySubtext}>Fee structure will be available once configured by the school.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
              <Text style={styles.summaryLabel}>Base Fee Amount</Text>
              <Text style={[styles.summaryAmount, { color: '#2196F3' }]}>₹{feeStructure.totalBaseFee || feeStructure.totalDue}</Text>
            </View>
            {feeStructure.totalDiscounts > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Discounts Applied</Text>
                <Text style={[styles.summaryAmount, { color: '#FF9800' }]}>₹{feeStructure.totalDiscounts}</Text>
              </View>
            )}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Amount Due</Text>
              <Text style={[styles.summaryAmount, { color: '#9C27B0' }]}>₹{feeStructure.totalDue}</Text>
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

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.fullScreenModalContainer}>
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.fullScreenTitle}>Make Payment</Text>
              <View style={styles.headerSpacer} />
            </View>
            
            <ScrollView style={styles.fullScreenScrollView} contentContainerStyle={styles.fullScreenContent}>
              {selectedFee && (
                <View style={styles.paymentFormContainer}>
                  {/* Fee Details Header */}
                  <View style={styles.feeDetailsHeader}>
                    <Text style={styles.feeDetailsTitle}>{selectedFee.name}</Text>
                    <Text style={styles.feeDetailsAmount}>₹{selectedFee.remainingAmount || selectedFee.amount}</Text>
                  </View>

                  {/* Payment Amount Input */}
                  <View style={styles.adminFormGroup}>
                    <Text style={styles.adminFormLabel}>Payment Amount *</Text>
                    <TextInput
                      style={styles.adminFormInput}
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      placeholder="Enter amount"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Payment Date Picker */}
                  <View style={styles.adminFormGroup}>
                    <Text style={styles.adminFormLabel}>Payment Date *</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.datePickerText}>
                        {format(paymentDate, 'dd MMM yyyy')}
                      </Text>
                      <Ionicons name="calendar" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Payment Mode Selector */}
                  <View style={styles.adminFormGroup}>
                    <Text style={styles.adminFormLabel}>Payment Mode *</Text>
                    <View style={styles.paymentModeContainer}>
                      {getPaymentModes().map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.paymentModeChip,
                            paymentMode === mode && styles.selectedPaymentModeChip
                          ]}
                          onPress={() => setPaymentMode(mode)}
                        >
                          <Text style={[
                            styles.paymentModeChipText,
                            paymentMode === mode && styles.selectedPaymentModeChipText
                          ]}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Fee Component Selection */}
                  {renderFeeComponentChips()}

                  {/* Payment Remarks */}
                  <View style={styles.adminFormGroup}>
                    <Text style={styles.adminFormLabel}>Remarks (Optional)</Text>
                    <TextInput
                      style={styles.adminFormTextArea}
                      value={paymentRemarks}
                      onChangeText={setPaymentRemarks}
                      placeholder="Add any additional remarks..."
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}
            </ScrollView>
            
            {/* Payment Form Footer */}
            <View style={styles.fullScreenFooter}>
              <TouchableOpacity 
                style={[styles.fullScreenSubmitButton, paymentLoading && styles.disabledButton]} 
                onPress={handleSubmitPayment}
                disabled={paymentLoading || !selectedFeeComponent || !paymentAmount}
              >
                {paymentLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.fullScreenSubmitButtonText}>Record Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Date Picker Modal */}
            {showDatePicker && (
              <DateTimePicker
                value={paymentDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}

        </View>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        visible={paymentMethodModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentMethodModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPaymentMethod?.name || 'Payment'}
              </Text>
              <TouchableOpacity onPress={() => setPaymentMethodModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.paymentMethodContent}>
              {selectedFee && (
                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentSummaryTitle}>Payment Summary</Text>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Fee:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedFee.name}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Amount:</Text>
                    <Text style={styles.paymentSummaryValue}>₹{selectedFee.remainingAmount || selectedFee.amount}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Due Date:</Text>
                    <Text style={styles.paymentSummaryValue}>{formatSafeDate(selectedFee.dueDate)}</Text>
                  </View>
                </View>
              )}
              
              {renderPaymentForm()}
            </ScrollView>
            
            <View style={styles.paymentMethodFooter}>
              <TouchableOpacity 
                style={styles.cancelPaymentButton} 
                onPress={() => setPaymentMethodModalVisible(false)}
              >
                <Text style={styles.cancelPaymentButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitPaymentButton, paymentProcessing && styles.disabledButton]} 
                onPress={handlePaymentMethodSubmit}
                disabled={paymentProcessing}
              >
                {paymentProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="card" size={20} color="#fff" />
                    <Text style={styles.submitPaymentButtonText}>Pay Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Receipt Modal */}
      <Modal
        visible={receiptModalVisible2}
        animationType="slide"
        transparent={true}
        onRequestClose={handleReceiptDone}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Successful</Text>
              <TouchableOpacity onPress={handleReceiptDone}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {receiptData && (
              <ScrollView style={styles.receiptPreviewContent}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                  <Text style={styles.successMessage}>Payment completed successfully!</Text>
                </View>
                
                <View style={styles.receiptPreview}>
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptSchoolName}>{schoolDetails?.name || 'School Management System'}</Text>
                    <Text style={styles.receiptTitle}>Fee Payment Receipt</Text>
                    <Text style={styles.receiptNumber}>Receipt No: {receiptData.receipt_no}</Text>
                  </View>

                  <View style={styles.receiptInfo}>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Date:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.payment_date_formatted}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Student:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.student_name}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Admission No:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.student_admission_no}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Fee Component:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.fee_component}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Payment Mode:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.payment_mode}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Transaction ID:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.transaction_id}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Payment Details:</Text>
                      <Text style={styles.receiptInfoValue}>{receiptData.payment_details}</Text>
                    </View>
                  </View>

                  <View style={styles.receiptAmountSection}>
                    <Text style={styles.receiptAmount}>₹{receiptData.amount_paid.toFixed(2)}</Text>
                    <Text style={styles.receiptAmountLabel}>Amount Paid</Text>
                    <Text style={styles.amountInWords}>
                      {receiptData.amount_in_words.toUpperCase()} RUPEES ONLY
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.receiptModalFooter}>
              <TouchableOpacity style={styles.shareReceiptButton} onPress={handleShareReceipt}>
                <Ionicons name="share" size={20} color="#2196F3" />
                <Text style={styles.shareReceiptButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.printReceiptButton} onPress={handlePrintReceipt}>
                <Ionicons name="print" size={20} color="#2196F3" />
                <Text style={styles.printReceiptButtonText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneReceiptButton} onPress={handleReceiptDone}>
                <Text style={styles.doneReceiptButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
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
                    <Text style={styles.receiptSchoolName}>{schoolData?.school_name || 'ABC School'}</Text>
                    <Text style={styles.receiptTitle}>Fee Receipt</Text>
                    {selectedReceipt.receiptNumber && (
                      <Text style={styles.receiptNumber}>Receipt No: {selectedReceipt.receiptNumber}</Text>
                    )}
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
                    {selectedReceipt.receiptNumber && (
                      <View style={styles.receiptInfoRow}>
                        <Text style={styles.receiptInfoLabel}>Receipt Number:</Text>
                        <Text style={styles.receiptInfoValue}>{selectedReceipt.receiptNumber}</Text>
                      </View>
                    )}
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

      {/* Admin-style Receipt Modal */}
      <Modal
        visible={receiptModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleAdminReceiptDone}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Successful</Text>
              <TouchableOpacity onPress={handleAdminReceiptDone}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {lastPaymentRecord && (
              <ScrollView style={styles.receiptPreviewContent}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                  <Text style={styles.successMessage}>Payment recorded successfully!</Text>
                </View>
                
                <View style={styles.receiptPreview}>
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptSchoolName}>{schoolDetails?.name || 'School Management System'}</Text>
                    <Text style={styles.receiptTitle}>Fee Payment Receipt</Text>
                    <Text style={styles.receiptNumber}>Receipt No: {lastPaymentRecord.receipt_no}</Text>
                  </View>

                  <View style={styles.receiptInfo}>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Date:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.payment_date_formatted}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Student:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.student_name}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Admission No:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.student_admission_no}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Fee Component:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.fee_component}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Payment Mode:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.payment_mode}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Transaction ID:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.transaction_id}</Text>
                    </View>
                    <View style={styles.receiptInfoRow}>
                      <Text style={styles.receiptInfoLabel}>Payment Details:</Text>
                      <Text style={styles.receiptInfoValue}>{lastPaymentRecord.payment_details}</Text>
                    </View>
                  </View>

                  <View style={styles.receiptAmountSection}>
                    <Text style={styles.receiptAmount}>₹{lastPaymentRecord.amount_paid.toFixed(2)}</Text>
                    <Text style={styles.receiptAmountLabel}>Amount Paid</Text>
                    <Text style={styles.amountInWords}>
                      {lastPaymentRecord.amount_in_words.toUpperCase()} RUPEES ONLY
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.receiptModalFooter}>
              <TouchableOpacity style={styles.shareReceiptButton} onPress={handleShareAdminReceipt}>
                <Ionicons name="share" size={20} color="#2196F3" />
                <Text style={styles.shareReceiptButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.printReceiptButton} onPress={handlePrintAdminReceipt}>
                <Ionicons name="print" size={20} color="#2196F3" />
                <Text style={styles.printReceiptButtonText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneReceiptButton} onPress={handleAdminReceiptDone}>
                <Text style={styles.doneReceiptButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: '48%',
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
  selectedPaymentMethod: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
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
  selectedPaymentMethodText: {
    color: '#fff',
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectedPaymentMethodDescription: {
    color: '#e3f2fd',
  },
  payNowButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  payNowButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payNowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Payment Form Styles
  paymentFormContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // UPI Form Styles
  upiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  upiInfoText: {
    fontSize: 12,
    color: '#1976d2',
    marginLeft: 8,
    flex: 1,
  },
  // Online Banking Styles
  bankSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedBankOption: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  bankOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedBankOptionText: {
    color: '#fff',
  },
  // Cash Payment Styles
  cashInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  cashInfoText: {
    fontSize: 12,
    color: '#f57c00',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
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
  receiptNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
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
  feeDistributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  feeDistributionItem: {
    alignItems: 'center',
  },
  feeDistributionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  feeDistributionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  feeCategoryBreakdown: {
    marginTop: 16,
  },
  feeCategoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  feeCategoryItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  feeCategoryName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  feeCategoryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeCategoryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  feeCategoryStatus: {
    fontSize: 12,
    color: '#FF9800',
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
  // Payment Method Modal Styles
  paymentMethodContent: {
    flex: 1,
    padding: 20,
  },
  paymentSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  paymentSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentSummaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  paymentMethodFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  cancelPaymentButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelPaymentButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  submitPaymentButton: {
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
  submitPaymentButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 6,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  // Success and Receipt Modal Styles
  successIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 10,
    textAlign: 'center',
  },
  amountInWords: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  shareReceiptButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  shareReceiptButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  printReceiptButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  printReceiptButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  doneReceiptButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 4,
  },
  doneReceiptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Admin-style payment form styles
  paymentFormScrollView: {
    flex: 1,
    maxHeight: 450,
  },
  paymentFormContainer: {
    padding: 20,
  },
  feeDetailsHeader: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  feeDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  feeDetailsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  adminFormGroup: {
    marginBottom: 16,
  },
  adminFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  adminFormInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  adminFormTextArea: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 80,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  paymentModeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentModeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  selectedPaymentModeChip: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  paymentModeChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedPaymentModeChipText: {
    color: '#fff',
  },
  feeChipsContainer: {
    marginBottom: 16,
  },
  feeChipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  feeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feeChip: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    minWidth: 120,
  },
  selectedFeeChip: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  feeChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  selectedFeeChipText: {
    color: '#fff',
  },
  feeChipAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  selectedFeeChipAmount: {
    color: '#fff',
  },
  adminFormFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  cancelAdminButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelAdminButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  submitAdminButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8,
  },
  submitAdminButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 6,
  },
  // Full-screen modal styles
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to center title
  },
  fullScreenScrollView: {
    flex: 1,
  },
  fullScreenContent: {
    padding: 20,
    paddingBottom: 100, // Space for footer button
  },
  fullScreenFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  fullScreenSubmitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fullScreenSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default FeePayment;
