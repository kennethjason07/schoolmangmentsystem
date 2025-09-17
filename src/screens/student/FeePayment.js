import React, { useState, useEffect, useRef } from 'react';
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
import { generateMockReferenceNumber } from '../../utils/referenceNumberGenerator';
import { getNextReceiptNumber } from '../../utils/receiptCounter';
import { loadLogoWithFallbacks, validateImageData } from '../../utils/robustLogoLoader';
import { Image } from 'react-native';
import LogoDisplay from '../../components/LogoDisplay';

const { width } = Dimensions.get('window');

const FeePayment = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  const [feeStructure, setFeeStructure] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [studentData, setStudentData] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  
  // Ref for swipe gesture
  const touchStartXRef = useRef(0);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedFee, setSelectedFee] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentHistoryView, setPaymentHistoryView] = useState('history'); // 'history' or 'status'
  const [paymentStatusData, setPaymentStatusData] = useState([]); // For payment status cards

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
        console.log('🏦 FeePayment - Loading school details');
        const { data: schoolData, error: schoolError } = await dbHelpers.getSchoolDetails();
        console.log('🏦 FeePayment - School data loaded:', {
          hasData: !!schoolData,
          schoolName: schoolData?.name || 'NO NAME',
          logoUrl: schoolData?.logo_url || 'NO LOGO URL',
          logoUrlType: typeof schoolData?.logo_url,
          logoUrlLength: schoolData?.logo_url?.length || 0,
          error: schoolError?.message || 'No error',
          allKeys: Object.keys(schoolData || {})
        });
        console.log('🏦 FeePayment - Raw school data:', schoolData);
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

        // 🎯 Load fee data from student_fee_summary view (EMAIL-BASED TENANT SYSTEM)
        console.log('Student FeePayment - Loading fee data from student_fee_summary view...');
        
        const { data: feeData, error: feeError } = await supabase
          .from('student_fee_summary')
          .select('*')
          .eq('student_id', user.linked_student_id)
          .single();

        if (feeError) {
          console.error('Student FeePayment - Error loading fee data:', feeError);
          // Check if student has no fee data vs actual error
          if (feeError.code === 'PGRST116') {
            console.log('Student FeePayment - No fee data found for student, showing empty state');
            setFeeStructure({
              studentName: studentDetails.name,
              class: `${studentDetails.classes?.class_name || 'N/A'} ${studentDetails.classes?.section || ''}`.trim(),
              academicYear: studentDetails.academic_year || '2024-2025',
              totalDue: 0,
              totalPaid: 0,
              outstanding: 0,
              fees: [],
              metadata: { source: 'no-fee-data' }
            });
            setPaymentHistory([]);
            return;
          }
          throw feeError;
        }

        console.log('Student FeePayment - Fee data loaded from view:', feeData);

        // Transform fee components from JSON to array format
        const transformedFees = (feeData.fee_components || []).map((component, index) => {
          // Determine category based on fee component name
          let category = 'general';
          if (component.fee_component) {
            const componentName = component.fee_component.toLowerCase();
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
            id: `fee-${component.fee_component}-${index}`,
            name: component.fee_component,
            totalAmount: Number(component.base_amount) || 0,
            discountAmount: Number(component.discount_amount) || 0,
            amount: Number(component.final_amount) || 0,
            dueDate: component.due_date || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            status: component.status || 'unpaid',
            paidAmount: Number(component.paid_amount) || 0,
            remainingAmount: Number(component.outstanding_amount) || 0,
            description: component.has_discount ? 
              `${component.fee_component} - Base: ₹${component.base_amount}, Discount: ₹${component.discount_amount}` :
              `${component.fee_component} - Standard Fee`,
            category: category,
            academicYear: feeData.academic_year,
            hasDiscount: component.has_discount,
            discountType: component.discount_type,
            paymentCount: component.payment_count || 0,
            lastPaymentDate: component.last_payment_date
          };
        });

        // Get payment history from student_fees table
        const { data: paymentHistory, error: paymentError } = await supabase
          .from('student_fees')
          .select('*')
          .eq('student_id', user.linked_student_id)
          .order('payment_date', { ascending: false })
          .limit(10);

        const paymentHistoryTransformed = (paymentHistory || []).map(payment => ({
          id: payment.id,
          feeName: payment.fee_component,
          amount: Number(payment.amount_paid),
          paymentDate: payment.payment_date,
          paymentMethod: payment.payment_mode || 'Online',
          transactionId: payment.receipt_number ? payment.receipt_number.toString() : `TXN${payment.id.toString().slice(-8).toUpperCase()}`,
          status: 'completed',
          receiptUrl: null,
          remarks: payment.remarks || '',
          academicYear: payment.academic_year || feeData.academic_year
        }));

        console.log('Student FeePayment - Payment history loaded:', paymentHistoryTransformed.length, 'payments');

        // Set fee structure using data from student_fee_summary view
        setFeeStructure({
          studentName: feeData.student_name,
          class: `${feeData.class_name || 'N/A'} ${feeData.section || ''}`.trim(),
          academicYear: feeData.academic_year || '2024-2025',
          admissionNo: feeData.admission_no,
          rollNo: feeData.roll_no,
          // Fee totals from view
          totalBaseFees: Number(feeData.total_base_fees) || 0,
          totalDiscounts: Number(feeData.total_discounts) || 0,
          totalDue: Number(feeData.total_final_fees) || 0,
          totalPaid: Number(feeData.total_paid) || 0,
          outstanding: Number(feeData.total_outstanding) || 0,
          fees: transformedFees,
          // Status and metadata
          overallStatus: feeData.overall_status,
          hasDiscounts: feeData.has_any_discounts,
          totalFeeComponents: feeData.total_fee_components || 0,
          calculatedAt: feeData.calculated_at,
          metadata: { source: 'student_fee_summary_view', tenantId: feeData.tenant_id }
        });
        
        setPaymentHistory(paymentHistoryTransformed);
        
        // Get real payment status data from upi_transactions table
        const { data: upiTransactions, error: upiError } = await supabase
          .from('upi_transactions')
          .select(`
            id,
            amount,
            reference_number,
            payment_status,
            fee_component,
            payment_date,
            created_at,
            verified_at,
            verification_notes,
            admin_verified_by,
            users!admin_verified_by(full_name)
          `)
          .eq('student_id', user.linked_student_id)
          .order('created_at', { ascending: false })
          .limit(10);

        const paymentStatusTransformed = (upiTransactions || []).map(transaction => {
          // Map payment_status from DB to display status
          let displayStatus = 'pending';
          if (transaction.payment_status === 'SUCCESS') {
            displayStatus = 'approved';
          } else if (transaction.payment_status === 'FAILED') {
            displayStatus = 'rejected';
          } else if (transaction.payment_status === 'PENDING_ADMIN_VERIFICATION') {
            displayStatus = 'pending';
          }

          return {
            id: transaction.id,
            feeName: transaction.fee_component,
            amount: Number(transaction.amount),
            referenceNumber: transaction.reference_number,
            status: displayStatus,
            submittedDate: transaction.payment_date || transaction.created_at?.split('T')[0],
            approvedDate: transaction.verified_at?.split('T')[0] || null,
            remarks: transaction.verification_notes || 
                    (displayStatus === 'pending' ? 'Waiting for admin approval' : 
                     displayStatus === 'approved' ? `Approved by ${transaction.users?.full_name || 'admin'}` : 
                     'Payment verification failed')
          };
        });

        console.log('Student FeePayment - Payment status loaded:', paymentStatusTransformed.length, 'transactions');
        setPaymentStatusData(paymentStatusTransformed);
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
        case 'UPI_QR':
          try {
            console.log('Navigating to Student QR Payment screen');
            navigation.navigate('StudentQRPayment', {
              selectedFee,
              studentData: safeStudentData,
              tenantId: tenantId
            });
            console.log('StudentQRPayment navigation successful');
          } catch (navError) {
            console.error('StudentQRPayment navigation error:', navError);
            Alert.alert('Error', 'Failed to open QR payment screen. Please try again.');
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
    console.log('📧 Preparing receipt for:', receipt.feeName);
    
    // Generate new receipt number
    const receiptNumber = await getNextReceiptNumber();
    
    // Enhance receipt with additional data
    const enhancedReceipt = {
      ...receipt,
      receiptNumber: cleanReceiptNumber(receiptNumber),
      studentName: feeStructure?.studentName || studentData?.name || 'Student Name',
      admissionNo: studentData?.admission_no || 'N/A',
      className: feeStructure?.class || `${studentData?.classes?.class_name || 'N/A'} ${studentData?.classes?.section || ''}`.trim(),
      academicYear: feeStructure?.academicYear || '2024-25'
    };
    
    setSelectedReceipt(enhancedReceipt);
    setReceiptModalVisible(true);
  };

  const handleConfirmDownload = async () => {
    if (!selectedReceipt) return;

    try {
      // Generate receipt HTML (now async)
      const htmlContent = await generateReceiptHTML(selectedReceipt);
      
      // Generate PDF with landscape orientation
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        orientation: Print.Orientation.landscape
      });

      const fileName = `Receipt_${selectedReceipt.feeName.replace(/\s+/g, '_')}.pdf`;

      // Try Android-specific download, fallback to sharing
      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            console.log('⚠️ Permission denied, falling back to sharing');
            // Fallback to sharing instead of failing
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Save Receipt',
              UTI: 'com.adobe.pdf'
            });
            setReceiptModalVisible(false);
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
          console.error('Android download error, falling back to sharing:', error);
          // Fallback to sharing if Android-specific method fails
          try {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Share Receipt',
              UTI: 'com.adobe.pdf'
            });
            setReceiptModalVisible(false);
          } catch (shareError) {
            console.error('Share error:', shareError);
            Alert.alert('Error', 'Failed to save or share receipt. Please try again.');
          }
        }
      } else {
        // Default sharing for iOS or when StorageAccessFramework is not available
        try {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share Receipt',
            UTI: 'com.adobe.pdf'
          });
          setReceiptModalVisible(false);
        } catch (shareError) {
          console.error('Share error:', shareError);
          Alert.alert('Error', 'Failed to share receipt. Please try again.');
        }
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

  const handlePrintReceipt = async () => {
    if (!selectedReceipt) return;

    try {
      // Generate receipt HTML for printing
      const htmlContent = await generateReceiptHTML(selectedReceipt);
      
      // Print directly
      await Print.printAsync({
        html: htmlContent,
        orientation: Print.Orientation.landscape
      });
      
      console.log('✅ Print dialog opened successfully');
      setReceiptModalVisible(false);
    } catch (error) {
      console.error('❌ Print error:', error);
      Alert.alert('Print Error', 'Failed to print receipt. Please try again.');
    }
  };

  // Clean receipt number by removing RCP prefix if present
  const cleanReceiptNumber = (receiptNumber) => {
    if (!receiptNumber) return 'N/A';
    const str = receiptNumber.toString();
    // Remove RCP prefix if it exists
    if (str.startsWith('RCP')) {
      return str.substring(3);
    }
    return str;
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

  // Import the unified receipt template
  const { generateUnifiedReceiptHTML } = require('../../utils/unifiedReceiptTemplate');

  // Generate receipt HTML using unified template
  const generateReceiptHTML = async (receipt) => {
    try {
      console.log('📧 Student - Generating unified receipt HTML...');
      
      // DIRECT LOGO TEST - Let's try to load the logo directly first
      console.log('🧪 DIRECT LOGO TEST - Starting logo loading test...');
      if (schoolDetails?.logo_url) {
        console.log('🧪 Testing logo URL directly:', schoolDetails.logo_url);
        try {
          const directTestResponse = await fetch(schoolDetails.logo_url, { method: 'HEAD' });
          console.log('🧪 Direct URL test result:', {
            ok: directTestResponse.ok,
            status: directTestResponse.status,
            url: schoolDetails.logo_url
          });
        } catch (directTestError) {
          console.log('🧪 Direct URL test failed:', directTestError.message);
        }
      } else {
        console.log('🧪 No logo URL in school details!');
      }
      
      // Convert student receipt data format to match unified template expectations
      const unifiedReceiptData = {
        student_name: receipt.studentName,
        student_admission_no: receipt.admissionNo,
        class_name: receipt.className,
        fee_component: receipt.feeName,
        payment_date_formatted: formatDateForReceipt(receipt.paymentDate),
        receipt_no: cleanReceiptNumber(receipt.receiptNumber),
        payment_mode: receipt.paymentMethod,
        amount_paid: receipt.amount
      };
      
      // Use the unified receipt template with no preloaded logo (let it handle loading)
      console.log('📷 Student - Using unified template without preloaded logo');
      console.log('🏫 Student - School details being passed to template:', {
        hasSchoolDetails: !!schoolDetails,
        schoolName: schoolDetails?.name,
        logoUrl: schoolDetails?.logo_url,
        logoUrlType: typeof schoolDetails?.logo_url,
        logoUrlLength: schoolDetails?.logo_url?.length || 0
      });
      const htmlContent = await generateUnifiedReceiptHTML(unifiedReceiptData, schoolDetails, null);
      
      console.log('✅ Student - Unified receipt HTML generated successfully');
      return htmlContent;
    } catch (error) {
      console.error('❌ Student - Error generating unified receipt:', error);
      console.log('🔄 Student - Trying simple receipt with direct logo URL...');
      // Try simple receipt first, then complex fallback
      try {
        return await generateSimpleReceiptHTML(receipt);
      } catch (simpleError) {
        console.error('❌ Simple receipt also failed:', simpleError);
        return await generateFallbackReceiptHTML(receipt);
      }
    }
  };

  // Simple receipt generator with direct logo URL usage
  const generateSimpleReceiptHTML = async (receipt) => {
    try {
      console.log('📧 Student - Generating SIMPLE receipt HTML...');
      
      // Use logo URL directly from school details (no complex loading)
      let logoHTML = '';
      if (schoolDetails?.logo_url) {
        console.log('🖼️ Using direct logo URL:', schoolDetails.logo_url);
        
        // Try to load as base64 first for better compatibility
        try {
          console.log('🔄 Attempting to convert logo to base64 for receipt...');
          const logoBase64 = await getSchoolLogoBase64(schoolDetails.logo_url);
          if (logoBase64) {
            console.log('✅ Successfully got base64 logo for receipt, size:', logoBase64.length);
            logoHTML = `<img src="${logoBase64}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;" alt="School Logo" />`;
          } else {
            console.log('🔄 Base64 conversion failed, using direct URL');
            logoHTML = `<img src="${schoolDetails.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;" alt="School Logo" onerror="this.style.display='none'" />`;
          }
        } catch (base64Error) {
          console.log('❌ Base64 conversion error, using direct URL:', base64Error.message);
          logoHTML = `<img src="${schoolDetails.logo_url}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px;" alt="School Logo" onerror="this.style.display='none'" />`;
        }
      } else {
        console.log('🏠 No logo URL, using school icon fallback');
        logoHTML = `<div style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; font-size: 40px; background: #f5f5f5; border: 2px dashed #ccc; border-radius: 8px;">🏦</div>`;
      }
      
      const schoolName = schoolDetails?.name || 'School Name';
      const schoolAddress = schoolDetails?.address || 'School Address';
      
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fee Receipt - ${cleanReceiptNumber(receipt.receiptNumber)}</title>
            <style>
              @page { size: A4 landscape; margin: 15mm; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
              .receipt-container { max-width: 100%; border: 2px solid #000; padding: 20px; }
              .header { display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #000; }
              .logo { margin-right: 20px; }
              .school-info { flex-grow: 1; text-align: center; }
              .school-name { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; }
              .school-address { font-size: 14px; color: #666; margin: 0; }
              .title { text-align: center; font-size: 28px; font-weight: bold; margin: 20px 0; text-decoration: underline; }
              .details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 20px 0; }
              .detail-item { display: flex; justify-content: space-between; margin: 8px 0; padding: 5px 0; border-bottom: 1px dotted #ccc; }
              .amount-section { text-align: center; margin: 30px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; }
              .amount { font-size: 32px; font-weight: bold; color: #2196F3; }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <div class="logo">${logoHTML}</div>
                <div class="school-info">
                  <div class="school-name">${schoolName}</div>
                  <div class="school-address">${schoolAddress}</div>
                </div>
              </div>
              
              <div class="title">FEE RECEIPT</div>
              
              <div class="details">
                <div class="left-column">
                  <div class="detail-item"><span>Receipt No:</span><span>${cleanReceiptNumber(receipt.receiptNumber)}</span></div>
                  <div class="detail-item"><span>Student Name:</span><span>${receipt.studentName}</span></div>
                  <div class="detail-item"><span>Class:</span><span>${receipt.className}</span></div>
                </div>
                <div class="right-column">
                  <div class="detail-item"><span>Payment Date:</span><span>${formatDateForReceipt(receipt.paymentDate)}</span></div>
                  <div class="detail-item"><span>Payment Mode:</span><span>${receipt.paymentMethod}</span></div>
                  <div class="detail-item"><span>Fee Type:</span><span>${receipt.feeName}</span></div>
                </div>
              </div>
              
              <div class="amount-section">
                <div>Amount Paid</div>
                <div class="amount">₹${receipt.amount}</div>
              </div>
              
              <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
                This is a computer-generated receipt.
              </div>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      console.error('❌ Error generating simple receipt:', error);
      throw error;
    }
  };

  // Fallback receipt generator (keeping the old logic as backup)
  const generateFallbackReceiptHTML = async (receipt) => {
    try {
      console.log('📧 Student - Generating fallback receipt HTML...');
      
      // Load logo using robust loading system
      const logoData = await loadLogoWithFallbacks(schoolDetails?.logo_url);
      const isValidLogo = validateImageData(logoData);
      
      console.log('🇫️ Logo loading result:', { 
        hasLogo: !!logoData, 
        isValid: isValidLogo, 
        logoSize: logoData?.length || 0 
      });
      
      const logoHTML = isValidLogo 
        ? `<img src="${logoData}" style="width: 80px; height: 80px; object-fit: contain;" />` 
        : `<div style="width: 80px; height: 80px; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; background: #f9f9f9; color: #666; font-size: 12px;">LOGO</div>`;
      
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fee Receipt - ${cleanReceiptNumber(receipt.receiptNumber)}</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 15mm;
              }
              
              body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 0;
                color: #333;
                line-height: 1.4;
                background: #fff;
              }
              
              .receipt-container {
                max-width: 100%;
                margin: 0 auto;
                background: white;
                border: 2px solid #333;
                padding: 20px;
              }
              
              .receipt-header {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #ddd;
              }
              
              .receipt-logo {
                margin-right: 20px;
                flex-shrink: 0;
              }
              
              .receipt-school-info {
                flex-grow: 1;
              }
              
              .receipt-school-name {
                font-size: 24px;
                font-weight: bold;
                color: #2196F3;
                margin: 0;
                margin-bottom: 5px;
              }
              
              .receipt-school-address {
                font-size: 14px;
                color: #666;
                margin: 0;
              }
              
              .receipt-title {
                text-align: center;
                font-size: 28px;
                font-weight: bold;
                color: #333;
                margin: 20px 0;
                letter-spacing: 2px;
              }
              
              .receipt-separator {
                height: 2px;
                background: #333;
                margin: 20px 0;
              }
              
              .receipt-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin: 30px 0;
              }
              
              .receipt-column {
                display: flex;
                flex-direction: column;
                gap: 15px;
              }
              
              .receipt-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px dotted #ccc;
              }
              
              .receipt-label {
                font-weight: 600;
                color: #555;
                font-size: 14px;
                min-width: 120px;
              }
              
              .receipt-value {
                font-weight: 500;
                color: #333;
                font-size: 14px;
                text-align: right;
              }
              
              .receipt-amount-section {
                text-align: center;
                margin: 30px 0;
                padding: 20px;
                background: #f8f9fa;
                border: 2px dashed #2196F3;
              }
              
              .receipt-amount-label {
                font-size: 16px;
                color: #666;
                margin-bottom: 10px;
                font-weight: 500;
              }
              
              .receipt-amount {
                font-size: 32px;
                font-weight: bold;
                color: #2196F3;
                margin: 0;
              }
              
              @media print {
                .receipt-container {
                  border: 2px solid #333;
                  box-shadow: none;
                }
                
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <!-- Header -->
              <div class="receipt-header">
                <div class="receipt-logo">
                  ${logoHTML}
                </div>
                <div class="receipt-school-info">
                  <h1 class="receipt-school-name">${schoolDetails?.name || 'School Name'}</h1>
                  <p class="receipt-school-address">${schoolDetails?.address || 'School Address'}</p>
                </div>
              </div>
              
              <!-- Title -->
              <h2 class="receipt-title">FEE RECEIPT</h2>
              
              <!-- Separator -->
              <div class="receipt-separator"></div>
              
              <!-- Content Grid -->
              <div class="receipt-content">
                <!-- Left Column -->
                <div class="receipt-column">
                  <div class="receipt-row">
                    <span class="receipt-label">Student Name:</span>
                    <span class="receipt-value">${receipt.studentName}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Admission No:</span>
                    <span class="receipt-value">${receipt.admissionNo}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Class:</span>
                    <span class="receipt-value">${receipt.className}</span>
                  </div>
                </div>
                
                <!-- Right Column -->
                <div class="receipt-column">
                  <div class="receipt-row">
                    <span class="receipt-label">Fee Type:</span>
                    <span class="receipt-value">${receipt.feeName}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Date:</span>
                    <span class="receipt-value">${formatDateForReceipt(receipt.paymentDate)}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Receipt No:</span>
                    <span class="receipt-value">${receipt.receiptNumber}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Payment Mode:</span>
                    <span class="receipt-value">${receipt.paymentMethod}</span>
                  </div>
                </div>
              </div>
              
              <!-- Amount Section -->
              <div class="receipt-amount-section">
                <p class="receipt-amount-label">Amount Paid</p>
                <h3 class="receipt-amount">₹${receipt.amount?.toLocaleString()}</h3>
              </div>
            </div>
          </body>
        </html>
      `;
    } catch (error) {
      console.error('❌ Error generating fallback receipt HTML:', error);
      // Simple fallback if everything fails
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Receipt - ${receipt.receiptNumber || 'N/A'}</title>
            <style>
              @page { size: A4 landscape; margin: 20mm; }
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; margin-bottom: 30px; }
              .school-name { font-size: 24px; font-weight: bold; color: #000; }
              .receipt-title { font-size: 20px; margin: 20px 0; text-decoration: underline; }
              .content { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 20px 0; }
              .row { margin: 10px 0; }
              .label { font-weight: bold; }
              .amount { text-align: center; font-size: 24px; font-weight: bold; color: #000; margin: 30px 0; border: 2px solid #000; padding: 15px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="school-name">${schoolDetails?.name || 'School Name'}</div>
              <div class="school-address">${schoolDetails?.address || 'School Address'}</div>
              <div class="receipt-title">FEE RECEIPT</div>
            </div>
            <div class="content">
              <div>
                <div class="row"><span class="label">Student Name:</span> ${receipt.studentName || 'N/A'}</div>
                <div class="row"><span class="label">Admission No:</span> ${receipt.admissionNo || 'N/A'}</div>
                <div class="row"><span class="label">Class:</span> ${receipt.className || 'N/A'}</div>
              </div>
              <div>
                <div class="row"><span class="label">Fee Type:</span> ${receipt.feeName || 'N/A'}</div>
                <div class="row"><span class="label">Date:</span> ${formatDateForReceipt(receipt.paymentDate) || 'N/A'}</div>
                <div class="row"><span class="label">Receipt No:</span> ${receipt.receiptNumber || 'N/A'}</div>
                <div class="row"><span class="label">Payment Mode:</span> ${receipt.paymentMethod || 'N/A'}</div>
              </div>
            </div>
            <div class="amount">Amount Paid: ₹${receipt.amount?.toLocaleString() || '0.00'}</div>
          </body>
        </html>
      `;
    }
  };

  // Note: Old generateOldReceiptHTML function removed - now using unified template

  // Get payment methods available (QR Code only for students)
  const getPaymentMethods = () => {
    return [
      { id: 'UPI_QR', name: 'Pay via QR Code', icon: 'qr-code-outline', description: 'Scan QR code with any UPI app to pay instantly' }
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


  // New render function for payment status items
  const renderPaymentStatusItem = ({ item }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'approved': return '#4CAF50';
        case 'pending': return '#FF9800';
        case 'rejected': return '#F44336';
        default: return '#666';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'approved': return 'Approved';
        case 'pending': return 'Pending';
        case 'rejected': return 'Rejected';
        default: return 'Unknown';
      }
    };

    return (
      <View style={styles.paymentStatusItem}>
        <View style={styles.statusHeader}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusFeeName}>{item.feeName}</Text>
            <Text style={styles.statusReferenceNumber}>REF: {item.referenceNumber}</Text>
          </View>
          <View style={styles.statusRight}>
            <Text style={styles.statusAmount}>₹{item.amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusBadgeText}>{getStatusText(item.status)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.statusBody}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Submitted:</Text>
            <Text style={styles.statusValue}>{formatDateForReceipt(item.submittedDate)}</Text>
          </View>
          {item.approvedDate && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Approved:</Text>
              <Text style={styles.statusValue}>{formatDateForReceipt(item.approvedDate)}</Text>
            </View>
          )}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Remarks:</Text>
            <Text style={styles.statusValue}>{item.remarks}</Text>
          </View>
        </View>
      </View>
    );
  };

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
            style={styles.scrollContainer}
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
          <View style={styles.scrollContainer}>
            {/* Payment History Toggle Control - 2 OPTIONS */}
            <View style={styles.historyToggleContainer}>
              <TouchableOpacity 
                style={[styles.toggleButton, paymentHistoryView === 'history' && styles.activeToggleButton]}
                onPress={() => {
                  console.log('🔄 History toggle pressed');
                  setPaymentHistoryView('history');
                }}
              >
                <Ionicons name="list-outline" size={16} color={paymentHistoryView === 'history' ? '#fff' : '#666'} />
                <Text style={[styles.toggleButtonText, paymentHistoryView === 'history' && styles.activeToggleButtonText]}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleButton, paymentHistoryView === 'status' && styles.activeToggleButton]}
                onPress={() => {
                  console.log('🔄 Status toggle pressed');
                  setPaymentHistoryView('status');
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={paymentHistoryView === 'status' ? '#fff' : '#666'} />
                <Text style={[styles.toggleButtonText, paymentHistoryView === 'status' && styles.activeToggleButtonText]}>Status</Text>
              </TouchableOpacity>
            </View>

            {/* Content based on payment history view - 2 OPTIONS */}
            {paymentHistoryView === 'history' ? (
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
            ) : (
              <FlatList
                data={paymentStatusData}
                renderItem={renderPaymentStatusItem}
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
                    <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>No payment status</Text>
                    <Text style={styles.emptySubtext}>Payment status will appear here when you submit payments for approval.</Text>
                  </View>
                }
              />
            )}
          </View>
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

      {/* Receipt Preview Modal - Landscape Layout */}
      <Modal
        visible={receiptModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCloseReceiptModal}
      >
        <View 
          style={styles.receiptModalOverlay}
          onTouchStart={(e) => {
            touchStartXRef.current = e.nativeEvent.pageX;
          }}
          onTouchEnd={(e) => {
            const touchEndX = e.nativeEvent.pageX;
            const swipeDistance = touchEndX - touchStartXRef.current;
            
            // If swipe right distance is more than 100px, close modal
            if (swipeDistance > 100) {
              handleCloseReceiptModal();
            }
          }}
        >
          <View style={styles.receiptModalContainer}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.receiptCloseButton} 
              onPress={handleCloseReceiptModal}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            
            {selectedReceipt && (
              <ScrollView 
                style={styles.receiptScrollView}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.receiptDocument}>
                  {/* Header with Logo and School Name */}
                  <View style={styles.receiptDocumentHeader}>
                    <View style={styles.receiptLogoContainer}>
                      {/* Dynamic Logo Loading */}
                      <LogoDisplay 
                        logoUrl={schoolDetails?.logo_url}
                        size={60}
                        style={styles.receiptLogo}
                        fallbackIcon="school-outline"
                      />
                    </View>
                    <View style={styles.receiptSchoolInfo}>
                      <Text style={styles.receiptSchoolNameNew}>{schoolDetails?.name || 'School Name'}</Text>
                      <Text style={styles.receiptSchoolAddress}>{schoolDetails?.address || 'School Address'}</Text>
                    </View>
                  </View>

                  {/* Receipt Title */}
                  <Text style={styles.receiptDocumentTitle}>FEE RECEIPT</Text>
                  
                  {/* Separator Line */}
                  <View style={styles.receiptSeparatorLine} />

                  {/* Receipt Content - Single Column */}
                  <View style={styles.receiptContentSingle}>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Student Name:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedReceipt.studentName}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Admission No:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedReceipt.admissionNo}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Class:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedReceipt.className}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Fee Type:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedReceipt.feeName}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Date:</Text>
                      <Text style={styles.receiptInfoValueNew}>{formatDateForReceipt(selectedReceipt.paymentDate)}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Receipt No:</Text>
                      <Text style={styles.receiptInfoValueNew}>{cleanReceiptNumber(selectedReceipt.receiptNumber)}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Payment Mode:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedReceipt.paymentMethod}</Text>
                    </View>
                  </View>

                  {/* Separator Line Above Amount */}
                  <View style={styles.receiptAmountSeparatorLine} />
                  
                  {/* Amount Section */}
                  <View style={styles.receiptAmountSectionNew}>
                    <Text style={styles.receiptAmountLabelNew}>Amount Paid:</Text>
                    <Text style={styles.receiptAmountNew}>₹{selectedReceipt.amount?.toLocaleString()}</Text>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Action Buttons */}
            <View style={styles.receiptActionButtons}>
              <TouchableOpacity 
                style={styles.receiptPrintButton} 
                onPress={() => {
                  console.log('🖨️ Print receipt');
                  handlePrintReceipt();
                }}
              >
                <Ionicons name="print" size={20} color="#fff" />
                <Text style={styles.receiptPrintButtonText}>Print</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.receiptDownloadButton} 
                onPress={handleConfirmDownload}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.receiptDownloadButtonText}>Download</Text>
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
  scrollContainer: {
    flex: 1,
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
    paddingBottom: 100,
  },
  historyList: {
    paddingBottom: 100,
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
  // Toggle control styles - 3 BUTTONS ENHANCED VISIBILITY
  historyToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    minHeight: 40,
  },
  activeToggleButton: {
    backgroundColor: '#2196F3',
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  activeToggleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Payment Status Item Styles
  paymentStatusItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLeft: {
    flex: 1,
  },
  statusFeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusReferenceNumber: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  statusAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBody: {
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statusDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    backgroundColor: '#f1f8e9',
  },
  statusDownloadText: {
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  // Payment status card styles
  paymentStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  cardFeeType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  cardReferenceNumber: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  cardBody: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardField: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  cardActionText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  
  // New Fullscreen Receipt Modal Styles
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContainer: {
    backgroundColor: '#fff',
    width: '100%',
    height: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  receiptCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  receiptScrollView: {
    flex: 1,
    paddingHorizontal: 10,
  },
  receiptScrollContent: {
    padding: 20,
    paddingTop: 60, // Account for close button
    paddingBottom: 100, // Account for action buttons
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  receiptDocument: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    padding: 24,
    minHeight: 500,
    width: '100%',
    maxWidth: 800,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  receiptDocumentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  receiptLogoContainer: {
    marginRight: 20,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptLogoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  receiptLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  receiptSchoolInfo: {
    flex: 1,
    alignItems: 'center',
  },
  receiptSchoolNameNew: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptSchoolAddress: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    textAlign: 'center',
  },
  receiptDocumentTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
    marginVertical: 16,
  },
  receiptSeparatorLine: {
    height: 2,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  receiptContentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
  },
  receiptLeftColumn: {
    flex: 1,
    marginRight: 20,
  },
  receiptRightColumn: {
    flex: 1,
    marginLeft: 20,
  },
  receiptContentSingle: {
    marginVertical: 16,
  },
  receiptInfoRowNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 2,
  },
  receiptInfoLabelNew: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    minWidth: 80,
  },
  receiptInfoValueNew: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  receiptAmountSeparatorLine: {
    height: 2,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  receiptAmountSectionNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 12,
  },
  receiptAmountLabelNew: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  receiptAmountNew: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  receiptActionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  receiptPrintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minWidth: 120,
  },
  receiptPrintButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  receiptDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minWidth: 120,
  },
  receiptDownloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FeePayment;
