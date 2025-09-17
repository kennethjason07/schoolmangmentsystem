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
import { useAuth } from '../../utils/AuthContext';
import { useParentAuth } from '../../hooks/useParentAuth';
import { getSchoolLogoBase64, getLogoHTML, getReceiptHeaderCSS } from '../../utils/logoUtils';
import FeeService from '../../services/FeeService';

const { width } = Dimensions.get('window');

const FeePayment = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { 
    isParent, 
    parentStudents, 
    directParentMode, 
    loading: parentLoading, 
    error: parentError 
  } = useParentAuth();
  
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

  // Move fetchFeeData outside useEffect to make it accessible throughout component with parent validation
  const fetchFeeData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('💳 [PARENT-AWARE] Starting fetchFeeData...');
      
      // Parent authentication validation
      if (parentLoading) {
        console.log('🔄 [PARENT-AWARE] Parent context is loading, delaying fee data fetch...');
        setLoading(false);
        return;
      }
      
      // Check if user is a parent
      if (!isParent || !parentStudents || parentStudents.length === 0) {
        console.error('❌ [PARENT-AWARE] User is not a parent or has no students');
        setError('Parent authentication required. Please log in as a parent.');
        setLoading(false);
        return;
      }

      // Get parent's student data using direct parent access
      let studentDetails = null;
      
      // Use the first student (or implement student selection if multiple)
      if (parentStudents.length > 0) {
        studentDetails = parentStudents[0];
        console.log('✅ [PARENT-AWARE] Found student via direct parent access:', studentDetails.name);
      } else {
        console.error('❌ [PARENT-AWARE] No students found for parent');
        setError('No students found for this parent account.');
        setLoading(false);
        return;
      }
      
      setStudentData(studentDetails);

      // Load school details without tenant context
      console.log('🏫 [PARENT-AWARE] Loading school details without tenant context');
      const { data: schoolData, error: schoolError } = await supabase
        .from('school_details')
        .select('*')
        .single();

      if (schoolError && schoolError.code !== 'PGRST116') {
        console.error('❌ [PARENT-AWARE] Error loading school details:', schoolError);
      } else {
        setSchoolDetails(schoolData);
      }

      // Use the FeeService for proper fee structure without tenant context
      const feeServiceResult = await FeeService.getStudentFeesWithClassBase(studentDetails.id, {
        tenantValidation: false // No tenant validation for parent mode
      });
      
      if (feeServiceResult.success && feeServiceResult.data) {
        const feeData = feeServiceResult.data;
        
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
          transactionId: payment.id ? `FEE${payment.id.toString().slice(-6)}` : `FEE${Date.now().toString().slice(-6)}`,
          receiptNumber: payment.receiptNumber || null,
          status: 'completed',
          receiptUrl: null,
          remarks: payment.remarks || '',
          academicYear: feeData.fees.academicYear || '2024-2025',
          createdAt: new Date().toISOString()
        }));
        
        setPaymentHistory(transformedPayments);
        
      } else {
        console.log('FeePayment - Fee service failed:', feeServiceResult?.error);
        throw new Error(feeServiceResult?.error || 'Fee service failed');
      }
    } catch (error) {
      console.error('❌ Error in fetchFeeData:', error);
      setError('Failed to load fee data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      console.log('🔄 [PARENT-AWARE] No authenticated user, skipping fee data fetch');
      return;
    }
    
    if (parentLoading) {
      console.log('🔄 [PARENT-AWARE] Parent context is loading, waiting for initialization...');
      return;
    }
    
    if (isParent && parentStudents && parentStudents.length > 0) {
      console.log('🔄 [PARENT-AWARE] Parent context loaded, initializing fee payment data...', {
        isParent, 
        studentsCount: parentStudents.length
      });
      fetchFeeData();
    } else {
      console.log('🔄 [PARENT-AWARE] User is not a parent or has no students');
    }
  }, [user, isParent, parentStudents, parentLoading]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFeeData().then(() => setRefreshing(false));
  };

  const handleTabChange = (tab) => {
    setSelectedTab(tab);
  };

  const handleFeeSelect = (fee) => {
    setSelectedFee(fee);
    setPaymentModalVisible(true);
  };

  const handlePaymentModalClose = () => {
    setSelectedFee(null);
    setPaymentModalVisible(false);
  };

  const handleReceiptModalClose = () => {
    setSelectedReceipt(null);
    setReceiptModalVisible(false);
  };

  const handleReceiptSelect = (receipt) => {
    setSelectedReceipt(receipt);
    setReceiptModalVisible(true);
  };

  const handlePayment = (fee) => {
    try {
      console.log('=== PAYMENT BUTTON CLICKED ===');
      console.log('Fee data received:', JSON.stringify(fee, null, 2));

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
      setPaymentModalVisible(true);
      console.log('Payment form modal should now be visible');
    } catch (error) {
      console.error('Error in handlePayment:', error);
      Alert.alert('Error', `Failed to open payment form: ${error.message}`);
    }
  };

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

  if (loading || parentLoading) {
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
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchFeeData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Fee Payment" showBack={true} />
      <Text>Fee Payment Screen - Implementation continues here</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    padding: 20,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  errorSubText: {
    color: '#999',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FeePayment;