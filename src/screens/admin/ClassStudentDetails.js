import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Image,
  FlatList,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { formatCurrency } from '../../utils/helpers';
import { format } from 'date-fns';

const ClassStudentDetails = ({ route, navigation }) => {
  const { classData } = route.params;
  
  const [classStudents, setClassStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('outstanding');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistoryModal, setStudentHistoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState('students');
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [feeComponents, setFeeComponents] = useState([]);
  const [selectedFeeComponent, setSelectedFeeComponent] = useState('');
  const [receiptModal, setReceiptModal] = useState(false);
  const [lastPaymentRecord, setLastPaymentRecord] = useState(null);
  const [individualReceiptModal, setIndividualReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [schoolLogo, setSchoolLogo] = useState(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  
  // Refs for scrolling
  const mainScrollViewRef = useRef(null);
  const studentListRef = useRef(null);
  const modalScrollViewRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSchoolDetails();
    loadClassStudentDetails();
  }, []);

  // Load school details and logo
  const loadSchoolDetails = async () => {
    try {
      console.log('🏫 Loading school details...');
      
      const { data: schoolData, error } = await supabase
        .from('school_details')
        .select('*')
        .limit(1)
        .single();

      console.log('🏫 School details query result:', { schoolData, error });

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error loading school details:', error);
        Alert.alert(
          'School Details Error', 
          `Failed to load school details: ${error.message}\n\nCode: ${error.code}`
        );
        return;
      }

      if (schoolData) {
        console.log('✅ School details loaded:', schoolData);
        console.log('📸 Logo URL from database:', schoolData.logo_url);
        setSchoolDetails(schoolData);
        
        // Load school logo if available
        if (schoolData.logo_url) {
          try {
            console.log('🔄 Attempting to load logo from:', schoolData.logo_url);
            
            // First, let's check if the file exists
            const { data: fileInfo, error: fileError } = await supabase.storage
              .from('school-assets')
              .list('', {
                limit: 100,
                search: schoolData.logo_url
              });
            
            console.log('📁 Storage file check:', { fileInfo, fileError });
            
            // Get public URL regardless of file check result
            const { data: logoData } = await supabase.storage
              .from('school-assets')
              .getPublicUrl(schoolData.logo_url);
            
            console.log('🌐 Public URL data:', logoData);
            
            if (logoData?.publicUrl) {
              console.log('✅ School logo URL generated:', logoData.publicUrl);
              setSchoolLogo(logoData.publicUrl);
              
              // Test if the image actually loads
              fetch(logoData.publicUrl, { method: 'HEAD' })
                .then(response => {
                  console.log('🖼️ Logo accessibility test:', {
                    status: response.status,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                  });
                  if (!response.ok) {
                    console.warn('⚠️ Logo URL is not accessible:', response.status);
                  }
                })
                .catch(fetchError => {
                  console.error('❌ Logo fetch test failed:', fetchError);
                });
            } else {
              console.warn('⚠️ No public URL generated for logo');
            }
          } catch (logoError) {
            console.error('❌ Error loading school logo:', logoError);
            Alert.alert(
              'Logo Loading Error', 
              `Failed to load school logo: ${logoError.message}\n\nLogo path: ${schoolData.logo_url}`
            );
          }
        } else {
          console.log('ℹ️ No logo URL found in school details');
        }
      } else {
        console.log('ℹ️ No school details found, using default');
        setSchoolDetails({
          name: 'School Management System',
          type: 'School',
          address: '',
          phone: '',
          email: ''
        });
      }
    } catch (error) {
      console.error('❌ Error in loadSchoolDetails:', error);
      Alert.alert(
        'School Details Error', 
        `Unexpected error: ${error.message}`
      );
      // Set default school details
      setSchoolDetails({
        name: 'School Management System',
        type: 'School',
        address: '',
        phone: '',
        email: ''
      });
    }
  };

  // Format currency safely in Indian Rupees
  const formatSafeCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0.00';
    }
    const numAmount = parseFloat(amount);
    return `₹${numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
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

  // Load detailed student information for the class
  const loadClassStudentDetails = async () => {
    try {
      setLoading(true);

      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Get detailed student information for the selected class
      const { data: studentsData, error } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          roll_no,
          student_fees:${TABLES.STUDENT_FEES}(
            id,
            fee_component,
            amount_paid,
            payment_date,
            payment_mode,
            academic_year
          )
        `)
        .eq('class_id', classData.classId);

      if (error) throw error;

      // Get fee structure for this class (removed academic year filter)
      const { data: feeStructureData, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classData.classId);

      console.log('🏫 ClassStudentDetails Debug Info:');
      console.log('📚 Class ID:', classData.classId);
      console.log('🧮 Fee structures found:', feeStructureData?.length || 0);
      if (feeStructureData && feeStructureData.length > 0) {
        console.log('💰 Sample fee structure:', feeStructureData[0]);
      }

      if (feeError) throw feeError;

      // Calculate total fee structure amount
      const totalFeeStructure = feeStructureData.reduce((sum, fee) => 
        sum + (parseFloat(fee.amount) || 0), 0);

      // Get fee concessions for all students in this class - simplified approach
      const studentIds = studentsData.map(s => s.id);
      let concessionsData = [];
      
      console.log('🎫 Fetching concessions for students:', studentIds);
      console.log('🎫 Academic Year:', academicYear);
      
      if (studentIds.length > 0) {
        const { data: concessions, error: concessionsError } = await supabase
          .from('student_discounts')
          .select('student_id, discount_value, discount_type, fee_component, description')
          .in('student_id', studentIds)
          .eq('is_active', true);
        
        console.log('🎫 Raw concessions from DB:', concessions);
        console.log('🎫 Concessions error:', concessionsError);
        
        if (!concessionsError && concessions) {
          concessionsData = concessions;
          console.log('🎫 Total concessions found:', concessionsData.length);
        }
      }

      // Process student data with payment details and concessions
      const processedStudents = studentsData.map(student => {
        // Filter payments for current academic year
        const currentYearPayments = student.student_fees?.filter(
          payment => payment.academic_year === academicYear
        ) || [];

        // Calculate total paid by this student
        const totalPaid = currentYearPayments.reduce((sum, payment) => 
          sum + (parseFloat(payment.amount_paid) || 0), 0);

        // Calculate concessions for this student - simplified approach
        const studentConcessions = concessionsData.filter(c => c.student_id === student.id);
        const totalConcessions = studentConcessions.reduce((sum, concession) => 
          sum + (parseFloat(concession.discount_value) || 0), 0);
        
        // Debug concessions for this student
        console.log(`🎫 Student ${student.name} (ID: ${student.id}) concessions:`, {
          studentConcessions,
          totalConcessions,
          concessionsFound: studentConcessions.length
        });

        // Calculate outstanding amount (no adjustment, just display concession separately)
        const outstanding = Math.max(0, totalFeeStructure - totalPaid);
        const adjustedFeeAmount = Math.max(0, totalFeeStructure - totalConcessions);

        // Calculate payment percentage based on adjusted fee amount
        const paymentPercentage = adjustedFeeAmount > 0 ? 
          Math.min(100, (totalPaid / adjustedFeeAmount) * 100) : 0;

        // Get payment status - Fixed logic to prevent showing 'Paid' for all students
        let paymentStatus;
        if (totalFeeStructure === 0) {
          paymentStatus = 'Paid'; // No fees required
        } else if (totalPaid >= totalFeeStructure) {
          paymentStatus = 'Paid'; // Fully paid
        } else if (totalPaid > 0) {
          paymentStatus = 'Partial'; // Partially paid
        } else {
          paymentStatus = 'Pending'; // No payments made
        }

        // Debug logging to trace payment status calculation
        console.log(`Student: ${student.name}, Fee Structure: ${totalFeeStructure}, Paid: ${totalPaid}, Status: ${paymentStatus}`, {
          studentId: student.id,
          totalFeeStructure,
          totalPaid,
          outstanding,
          paymentCount: currentYearPayments.length,
          paymentStatus
        });

        // Get latest payment date
        const latestPayment = currentYearPayments.length > 0 ? 
          currentYearPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0] : null;

        return {
          id: student.id,
          name: student.name,
          admissionNo: student.admission_no,
          rollNo: student.roll_no,
          totalFeeStructure,
          totalPaid,
          outstanding,
          paymentPercentage: Math.round(paymentPercentage * 100) / 100,
          paymentStatus,
          latestPaymentDate: latestPayment?.payment_date,
          latestPaymentMode: latestPayment?.payment_mode,
          payments: currentYearPayments,
          paymentCount: currentYearPayments.length,
          totalConcessions,
          adjustedFeeAmount
        };
      });

      // Sort by outstanding amount (highest first)
      processedStudents.sort((a, b) => b.outstanding - a.outstanding);

      setClassStudents(processedStudents);
      setFilteredStudents(processedStudents);

    } catch (error) {
      console.error('Error loading class student details:', error);
      Alert.alert('Error', 'Failed to load student details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter and search students
  const filterAndSearchStudents = (students, query, status, sortBy) => {
    let filtered = [...students];

    // Apply search filter
    if (query.trim()) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchLower) ||
        student.admissionNo?.toLowerCase().includes(searchLower) ||
        student.rollNo?.toString().includes(searchLower)
      );
    }

    // Apply status filter
    if (status !== 'All') {
      filtered = filtered.filter(student => student.paymentStatus === status);
    }

    // Apply sorting
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'outstanding':
      default:
        filtered.sort((a, b) => b.outstanding - a.outstanding);
        break;
    }

    return filtered;
  };

  // Handle search input change
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    const filtered = filterAndSearchStudents(classStudents, query, filterStatus, sortBy);
    setFilteredStudents(filtered);
  };

  // Handle filter status change
  const handleFilterStatusChange = (status) => {
    setFilterStatus(status);
    const filtered = filterAndSearchStudents(classStudents, searchQuery, status, sortBy);
    setFilteredStudents(filtered);
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    const filtered = filterAndSearchStudents(classStudents, searchQuery, filterStatus, newSortBy);
    setFilteredStudents(filtered);
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadClassStudentDetails();
  };

  // Handle student click to show payment history
  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setStudentHistoryModal(true);
    // Reset modal scroll position to top
    setTimeout(() => {
      if (modalScrollViewRef.current) {
        modalScrollViewRef.current.scrollTo({ y: 0, animated: true });
      }
    }, 100);
  };

  // Load fee components for the class
  const loadFeeComponents = async () => {
    try {
      console.log('💰 Loading fee components for class:', classData.classId);
      
      const { data: feeComponentsData, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classData.classId);

      console.log('💰 Fee components query result:', { feeComponentsData, error });
      
      if (error) {
        console.error('💰 Error loading fee components:', error);
        throw error;
      }

      if (feeComponentsData && feeComponentsData.length > 0) {
        console.log('💰 Fee components loaded:', feeComponentsData.map(c => c.fee_component));
        setFeeComponents(feeComponentsData);
      } else {
        console.log('💰 No fee components found for class');
        setFeeComponents([]);
      }
    } catch (error) {
      console.error('Error loading fee components:', error);
      Alert.alert('Debug Info', `Fee Components Error: ${error.message}\n\nClass ID: ${classData.classId}\n\nTable: ${TABLES.FEE_STRUCTURE}`);
    }
  };

  // Get next receipt number from database
  const getNextReceiptNumber = async () => {
    try {
      // Try to get the maximum receipt number from existing records
      const { data: maxReceiptData, error: maxError } = await supabase
        .from('student_fees')
        .select('receipt_number')
        .not('receipt_number', 'is', null)
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
      
      console.log('Admin - Max receipt number found:', maxReceiptNumber);
      console.log('Admin - Next receipt number will be:', nextReceiptNumber);
      
      return nextReceiptNumber;
    } catch (error) {
      console.error('Error in getNextReceiptNumber:', error);
      // Fallback: start from 1000
      return 1000;
    }
  };

  // Handle mark as paid button click
  const handleMarkAsPaid = (student) => {
    setSelectedStudent(student);
    setPaymentDate(new Date());
    setPaymentAmount('');
    setPaymentMode('Cash');
    setPaymentRemarks('');
    setSelectedFeeComponent('');
    setPaymentModal(true);
    
    // Load fee components when modal opens
    loadFeeComponents();
  };

  // Handle fee concession button click
  const handleFeeConcesssionClick = (student) => {
    // Navigate to DiscountManagement screen with student context
    navigation.navigate('DiscountManagement', {
      classId: classData.classId,
      className: classData.className,
      studentId: student.id,
      studentName: student.name,
      openIndividualDiscount: true
    });
  };

  // Format date for display
  const formatDateForDisplay = (date) => {
    return format(date, 'dd MMM yyyy');
  };

  // Handle individual receipt generation
  const handleGenerateIndividualReceipt = async (payment) => {
    if (!selectedStudent || !payment) return;
    
    // Use the actual receipt number from the payment record if available
    let receiptNumber = payment.receipt_number;
    
    // If no receipt number exists in the payment record, generate one
    if (!receiptNumber) {
      receiptNumber = await getNextReceiptNumber();
      console.log('Generated new receipt number for existing payment:', receiptNumber);
    }
    
    const receiptData = {
      ...payment,
      student_name: selectedStudent.name,
      student_admission_no: selectedStudent.admissionNo,
      student_roll_no: selectedStudent.rollNo,
      class_name: classData.className,
      receipt_no: receiptNumber,
      payment_date_formatted: formatSafeDate(payment.payment_date),
      amount_in_words: numberToWords(parseFloat(payment.amount_paid))
    };
    
    setSelectedPaymentForReceipt(receiptData);
    setIndividualReceiptModal(true);
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

  // Generate PDF receipt
  const generateReceiptPDF = async (receiptData) => {
    try {
      const schoolName = schoolDetails?.name || 'School Management System';
      const schoolAddress = schoolDetails?.address || '';
      const schoolPhone = schoolDetails?.phone || '';
      const schoolEmail = schoolDetails?.email || '';
      
      const logoHtml = schoolLogo 
        ? `<img src="${schoolLogo}" style="width: 80px; height: 80px; margin-bottom: 10px;" />` 
        : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Receipt</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #fff;
            }
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              border: 2px solid #2196F3;
              border-radius: 10px;
              padding: 30px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2196F3;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .school-name {
              font-size: 28px;
              font-weight: bold;
              color: #2196F3;
              margin: 10px 0;
            }
            .school-info {
              font-size: 12px;
              color: #666;
              margin: 5px 0;
            }
            .receipt-title {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin: 15px 0 10px 0;
              letter-spacing: 2px;
            }
            .receipt-number {
              font-size: 14px;
              color: #2196F3;
              font-weight: bold;
              margin-top: 10px;
            }
            .details-section {
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .detail-label {
              font-weight: 600;
              color: #666;
            }
            .detail-value {
              font-weight: 600;
              color: #333;
            }
            .payment-section {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .payment-title {
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              color: #333;
              margin-bottom: 15px;
            }
            .amount-section {
              background-color: #e8f5e8;
              border: 2px solid #4CAF50;
              border-radius: 8px;
              padding: 15px;
              margin-top: 15px;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .amount-label {
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            .amount-value {
              font-size: 24px;
              font-weight: bold;
              color: #4CAF50;
            }
            .amount-words {
              font-size: 12px;
              color: #666;
              font-style: italic;
              text-align: center;
              text-transform: capitalize;
            }
            .footer {
              border-top: 1px solid #eee;
              padding-top: 20px;
              margin-top: 30px;
              text-align: center;
            }
            .footer-text {
              font-size: 10px;
              color: #999;
              margin: 5px 0;
            }
            .thank-you {
              font-size: 16px;
              font-weight: bold;
              color: #4CAF50;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              ${logoHtml}
              <div class="school-name">${schoolName}</div>
              ${schoolAddress ? `<div class="school-info">${schoolAddress}</div>` : ''}
              ${schoolPhone ? `<div class="school-info">Phone: ${schoolPhone}</div>` : ''}
              ${schoolEmail ? `<div class="school-info">Email: ${schoolEmail}</div>` : ''}
              <div class="receipt-title">PAYMENT RECEIPT</div>
              <div class="receipt-number">Receipt No: ${receiptData.receipt_no}</div>
            </div>

            <div class="details-section">
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${receiptData.payment_date_formatted}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Student Name:</span>
                <span class="detail-value">${receiptData.student_name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Admission No:</span>
                <span class="detail-value">${receiptData.student_admission_no}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Roll No:</span>
                <span class="detail-value">${receiptData.student_roll_no || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Class:</span>
                <span class="detail-value">${receiptData.class_name}</span>
              </div>
            </div>

            <div class="payment-section">
              <div class="payment-title">Payment Details</div>
              <div class="detail-row">
                <span class="detail-label">Fee Component:</span>
                <span class="detail-value">${receiptData.fee_component}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Mode:</span>
                <span class="detail-value">${receiptData.payment_mode}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Academic Year:</span>
                <span class="detail-value">${receiptData.academic_year}</span>
              </div>
              
              <div class="amount-section">
                <div class="amount-row">
                  <span class="amount-label">Amount Paid:</span>
                  <span class="amount-value">₹${parseFloat(receiptData.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="amount-words">
                  (In words: ${receiptData.amount_in_words} rupees only)
                </div>
              </div>
            </div>

            <div class="footer">
              <div class="footer-text">This is a computer generated receipt.</div>
              <div class="footer-text">Payment ID: ${receiptData.id}</div>
              <div class="thank-you">Thank you for your payment!</div>
            </div>
          </div>
        </body>
        </html>
      `;

      return htmlContent;
    } catch (error) {
      console.error('Error generating PDF content:', error);
      throw error;
    }
  };

  // Handle print receipt
  const handlePrintReceipt = async (receiptData) => {
    try {
      const htmlContent = await generateReceiptPDF(receiptData);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      
      await Print.printAsync({ uri });
    } catch (error) {
      console.error('Error printing receipt:', error);
      Alert.alert('Print Error', 'Failed to print receipt. Please try again.');
    }
  };

  // Handle share receipt
  const handleShareReceipt = async (receiptData) => {
    try {
      const htmlContent = await generateReceiptPDF(receiptData);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = `receipt_${receiptData.receipt_no.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Payment Receipt'
        });
      } else {
        Alert.alert('Share Not Available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Share Error', 'Failed to share receipt. Please try again.');
    }
  };

  // Submit payment record
  const handlePaymentSubmit = async () => {
    if (!selectedStudent || !paymentAmount || paymentAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }

    if (!selectedFeeComponent) {
      Alert.alert('Validation Error', 'Please select a fee component.');
      return;
    }

    try {
      setPaymentLoading(true);
      
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Generate sequential receipt number
      const receiptNumber = await getNextReceiptNumber();
      console.log('Admin - Generated receipt number for new payment:', receiptNumber);

      // Insert payment record
      const feeComponentName = selectedFeeComponent === 'custom' 
        ? (paymentRemarks || 'General Fee Payment')
        : selectedFeeComponent || 'General Fee Payment';

      const { data: paymentData, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .insert({
          student_id: selectedStudent.id,
          fee_component: feeComponentName,
          amount_paid: parseFloat(paymentAmount),
          payment_date: paymentDate.toISOString().split('T')[0],
          payment_mode: paymentMode,
          academic_year: academicYear,
          receipt_number: receiptNumber,
        })
        .select()
        .single();

      if (error) throw error;

      // Store payment record for receipt
      const receiptData = {
        ...paymentData,
        student_name: selectedStudent.name,
        student_admission_no: selectedStudent.admissionNo,
        student_roll_no: selectedStudent.rollNo,
        class_name: classData.className,
        receipt_no: receiptNumber,
        payment_date_formatted: formatDateForDisplay(paymentDate),
        amount_in_words: numberToWords(parseFloat(paymentAmount))
      };
      
      setLastPaymentRecord(receiptData);
      setPaymentModal(false);
      
      // Show receipt modal
      setReceiptModal(true);
      
      // Refresh the data to show updated payment status
      await loadClassStudentDetails();
      
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle scroll events for scroll-to-top button
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowScrollToTop(offsetY > 300); // Show button after scrolling 300px
      },
    }
  );

  // Scroll to top function
  const scrollToTop = () => {
    if (mainScrollViewRef.current) {
      mainScrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
    if (studentListRef.current) {
      studentListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  // Optimized render function for student cards
  const renderStudentCard = useCallback(({ item: student, index }) => (
    <TouchableOpacity
      key={student.id}
      style={[
        styles.studentCard,
        {
          borderLeftColor: student.paymentStatus === 'Paid' ? '#4CAF50' :
            student.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
        }
      ]}
      onPress={() => handleStudentClick(student)}
      activeOpacity={0.7}
    >
      {/* Student Header */}
      <View style={styles.studentHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentDetails}>
            Roll: {student.rollNo || 'N/A'} • Admission: {student.admissionNo}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: student.paymentStatus === 'Paid' ? '#4CAF50' :
              student.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
          }
        ]}>
          <Text style={styles.statusText}>{student.paymentStatus}</Text>
        </View>
      </View>

      {/* Fee Details */}
      <View style={styles.feeDetails}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Total Fee:</Text>
          <Text style={styles.feeValue}>{formatSafeCurrency(student.totalFeeStructure)}</Text>
        </View>
        {student.totalConcessions > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Fee Concession:</Text>
            <Text style={[styles.feeValue, { color: '#FF9800' }]}>
              -{formatSafeCurrency(student.totalConcessions)}
            </Text>
          </View>
        )}
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Amount Paid:</Text>
          <Text style={[styles.feeValue, { color: '#4CAF50' }]}>
            {formatSafeCurrency(student.totalPaid)}
          </Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Outstanding:</Text>
          <Text style={[styles.feeValue, { color: '#F44336' }]}>
            {formatSafeCurrency(student.outstanding)}
          </Text>
        </View>
      </View>

      {/* Fee Concession Display */}
      {student.totalConcessions > 0 && (
        <View style={styles.concessionsContainer}>
          <View style={styles.concessionsHeader}>
            <View style={styles.concessionsIconContainer}>
              <Ionicons name="pricetags" size={18} color="#FF9800" />
              <Text style={styles.concessionsHeaderText}>Fee Concession Applied</Text>
            </View>
            <View style={styles.concessionsStats}>
              <Text style={styles.concessionsAmount}>
                {formatSafeCurrency(student.totalConcessions)}
              </Text>
            </View>
          </View>
          <View style={styles.concessionsDetails}>
            <Text style={styles.concessionsDetailsText}>
              Adjusted fee after concession: {formatSafeCurrency(student.adjustedFeeAmount)}
            </Text>
          </View>
        </View>
      )}

      {/* Payment History */}
      {student.payments.length > 0 && (
        <View style={styles.paymentHistory}>
          <Text style={styles.paymentHistoryTitle}>
            Recent Payments ({student.paymentCount})
          </Text>
          {student.payments.slice(0, 3).map((payment, payIndex) => (
            <View key={payment.id} style={styles.paymentItem}>
              <Text style={styles.paymentComponent}>{payment.fee_component}</Text>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentAmount}>
                  {formatSafeCurrency(payment.amount_paid)}
                </Text>
                <Text style={styles.paymentDate}>
                  {formatSafeDate(payment.payment_date)}
                </Text>
              </View>
            </View>
          ))}
          {student.payments.length > 3 && (
            <Text style={styles.morePayments}>
              +{student.payments.length - 3} more payments
            </Text>
          )}
        </View>
      )}

      {/* Last Payment */}
      {student.latestPaymentDate && (
        <Text style={styles.lastPayment}>
          Last payment: {formatSafeDate(student.latestPaymentDate)}
          {student.latestPaymentMode && ` via ${student.latestPaymentMode}`}
        </Text>
      )}

      {/* Action Buttons */}
      {student.outstanding > 0 && (
        <View style={styles.actionButtonsContainer}>
          {/* Pay Button */}
          <TouchableOpacity
            style={styles.markAsPaidButton}
            onPress={(e) => {
              e.stopPropagation();
              handleMarkAsPaid(student);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="card" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.markAsPaidButtonText}>
              Pay
            </Text>
          </TouchableOpacity>

          {/* Fee Concession Button */}
          <TouchableOpacity
            style={styles.feeConcessionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleFeeConcesssionClick(student);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="pricetags" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.feeConcessionButtonText}>
              Fee Concession
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  ), [formatSafeCurrency, formatSafeDate, handleStudentClick, handleMarkAsPaid, handleFeeConcesssionClick]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item) => item.id.toString(), []);

  // Get item layout for better performance
  const getItemLayout = useCallback((data, index) => ({
    length: 200, // Approximate height of each student card
    offset: 200 * index,
    index,
  }), []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={`${classData.className} - Students`} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading student details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={`${classData.className} - Details`} showBack />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.activeTab]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>
            Students
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>
            Reports
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.scrollWrapper}>
        <ScrollView 
          ref={mainScrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
          nestedScrollEnabled={true}
          overScrollMode="always"
          scrollEventThrottle={1}
          onScroll={handleScroll}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={10}
        >
        {/* Tab Content */}
        {activeTab === 'students' ? (
          <>
            {/* Class Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Class Overview</Text>
                <View style={styles.collectionBadge}>
                  <Text style={styles.collectionBadgeText}>
                    {classData.collectionRate}% Collected
                  </Text>
                </View>
              </View>
              
              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatNumber}>{classStudents.length}</Text>
                  <Text style={styles.summaryStatLabel}>Total Students</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatNumber, { color: '#4CAF50' }]}>
                    {classStudents.filter(s => s.paymentStatus === 'Paid').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Paid</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatNumber, { color: '#FF9800' }]}>
                    {classStudents.filter(s => s.paymentStatus === 'Partial').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Partial</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={[styles.summaryStatNumber, { color: '#F44336' }]}>
                    {classStudents.filter(s => s.paymentStatus === 'Pending').length}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Pending</Text>
                </View>
              </View>
            </View>

        {/* Search and Filter Section */}
        <View style={styles.searchFilterSection}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, roll no, or admission no..."
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchChange('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={Platform.OS === 'web'}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {['All', 'Paid', 'Partial', 'Pending'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    filterStatus === status && styles.activeFilterChip
                  ]}
                  onPress={() => handleFilterStatusChange(status)}
                >
                  <Text style={[
                    styles.filterChipText,
                    filterStatus === status && styles.activeFilterChipText
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Sort Options */}
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: 'outstanding', label: 'Outstanding' },
                { key: 'name', label: 'Name' }
              ].map((sort) => (
                <TouchableOpacity
                  key={sort.key}
                  style={[
                    styles.sortChip,
                    sortBy === sort.key && styles.activeSortChip
                  ]}
                  onPress={() => handleSortChange(sort.key)}
                >
                  <Text style={[
                    styles.sortChipText,
                    sortBy === sort.key && styles.activeSortChipText
                  ]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Results Summary */}
          <Text style={styles.resultsText}>
            Showing {filteredStudents.length} of {classStudents.length} students
            {searchQuery && ` for "${searchQuery}"`}
          </Text>
        </View>

        {/* Students List */}
        <View style={styles.studentsSection}>
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No students found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery
                  ? `No students match "${searchQuery}"`
                  : `No students with ${filterStatus.toLowerCase()} status`
                }
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setFilterStatus('All');
                  setFilteredStudents(classStudents);
                }}
                style={styles.resetButton}
              >
                <Text style={styles.resetButtonText}>Show All Students</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={studentListRef}
              data={filteredStudents}
              renderItem={renderStudentCard}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={Platform.OS === 'android'}
              maxToRenderPerBatch={5}
              windowSize={10}
              initialNumToRender={10}
              updateCellsBatchingPeriod={50}
              scrollEventThrottle={1}
              getItemLayout={getItemLayout}
              nestedScrollEnabled={false}
              style={styles.studentFlatList}
              contentContainerStyle={styles.studentFlatListContent}
            />
          )}
        </View>
          </>
        ) : (
          <>
            {/* Reports Tab */}
            <View style={styles.reportsContainer}>
            <Text style={styles.reportsTitle}>Payment Summary & Analytics</Text>
            
            {/* Key Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, styles.totalStudentsCard]}>
                <View style={styles.metricIconContainer}>
                  <Ionicons name="people" size={24} color="#2196F3" />
                </View>
                <Text style={styles.metricValue}>{classStudents.length}</Text>
                <Text style={styles.metricLabel}>Total Students</Text>
              </View>
              
              <View style={[styles.metricCard, styles.collectionRateCard]}>
                <View style={styles.metricIconContainer}>
                  <Ionicons name="trending-up" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.metricValue}>{classData.collectionRate}%</Text>
                <Text style={styles.metricLabel}>Collection Rate</Text>
              </View>
            </View>
            
            {/* Payment Status Breakdown */}
            <View style={styles.statusBreakdownCard}>
              <Text style={styles.statusBreakdownTitle}>Payment Status Breakdown</Text>
              
              <View style={styles.statusItem}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIndicator, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.statusLabel}>Fully Paid</Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusCount}>
                    {classStudents.filter(s => s.paymentStatus === 'Paid').length}
                  </Text>
                  <Text style={styles.statusPercentage}>
                    ({Math.round((classStudents.filter(s => s.paymentStatus === 'Paid').length / classStudents.length) * 100) || 0}%)
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusProgressBar}>
                <View 
                  style={[styles.statusProgressFill, { 
                    width: `${(classStudents.filter(s => s.paymentStatus === 'Paid').length / classStudents.length) * 100}%`,
                    backgroundColor: '#4CAF50'
                  }]} 
                />
              </View>
              
              <View style={styles.statusItem}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIndicator, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.statusLabel}>Partial Payment</Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusCount}>
                    {classStudents.filter(s => s.paymentStatus === 'Partial').length}
                  </Text>
                  <Text style={styles.statusPercentage}>
                    ({Math.round((classStudents.filter(s => s.paymentStatus === 'Partial').length / classStudents.length) * 100) || 0}%)
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusProgressBar}>
                <View 
                  style={[styles.statusProgressFill, { 
                    width: `${(classStudents.filter(s => s.paymentStatus === 'Partial').length / classStudents.length) * 100}%`,
                    backgroundColor: '#FF9800'
                  }]} 
                />
              </View>
              
              <View style={styles.statusItem}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusIndicator, { backgroundColor: '#F44336' }]} />
                  <Text style={styles.statusLabel}>Pending Payment</Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusCount}>
                    {classStudents.filter(s => s.paymentStatus === 'Pending').length}
                  </Text>
                  <Text style={styles.statusPercentage}>
                    ({Math.round((classStudents.filter(s => s.paymentStatus === 'Pending').length / classStudents.length) * 100) || 0}%)
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusProgressBar}>
                <View 
                  style={[styles.statusProgressFill, { 
                    width: `${(classStudents.filter(s => s.paymentStatus === 'Pending').length / classStudents.length) * 100}%`,
                    backgroundColor: '#F44336'
                  }]} 
                />
              </View>
            </View>
            
            {/* Financial Summary */}
            <View style={styles.financialSummaryCard}>
              <Text style={styles.financialSummaryTitle}>Financial Overview</Text>
              
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Total Fees Expected</Text>
                <Text style={styles.financialValue}>
                  {formatSafeCurrency(classStudents.reduce((sum, s) => sum + s.totalFeeStructure, 0))}
                </Text>
              </View>
              
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Amount Collected</Text>
                <Text style={[styles.financialValue, { color: '#4CAF50' }]}>
                  {formatSafeCurrency(classStudents.reduce((sum, s) => sum + s.totalPaid, 0))}
                </Text>
              </View>
              
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Outstanding Amount</Text>
                <Text style={[styles.financialValue, { color: '#F44336' }]}>
                  {formatSafeCurrency(classStudents.reduce((sum, s) => sum + s.outstanding, 0))}
                </Text>
              </View>
              
              <View style={styles.financialDivider} />
              
              <View style={styles.financialItem}>
                <Text style={[styles.financialLabel, { fontWeight: 'bold', fontSize: 16 }]}>Collection Efficiency</Text>
                <Text style={[styles.financialValue, { fontWeight: 'bold', fontSize: 18, color: '#2196F3' }]}>
                  {classData.collectionRate}%
                </Text>
              </View>
            </View>
            
            {/* Payment Activity Summary */}
            <View style={styles.activitySummaryCard}>
              <Text style={styles.activitySummaryTitle}>Payment Activity</Text>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="receipt" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Total Payments Made</Text>
                </View>
                <Text style={styles.activityValue}>
                  {classStudents.reduce((sum, s) => sum + s.paymentCount, 0)}
                </Text>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="person-add" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Students with Payments</Text>
                </View>
                <Text style={styles.activityValue}>
                  {classStudents.filter(s => s.paymentCount > 0).length} / {classStudents.length}
                </Text>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="calculator" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Average Payment per Student</Text>
                </View>
                <Text style={styles.activityValue}>
                  {formatSafeCurrency(classStudents.length > 0 ? 
                    classStudents.reduce((sum, s) => sum + s.totalPaid, 0) / classStudents.length : 0)}
                </Text>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityLeft}>
                  <Ionicons name="calendar" size={20} color="#666" />
                  <Text style={styles.activityLabel}>Average Payments per Student</Text>
                </View>
                <Text style={styles.activityValue}>
                  {(classStudents.reduce((sum, s) => sum + s.paymentCount, 0) / Math.max(classStudents.length, 1)).toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
          </>
        )}
        </ScrollView>
      </View>
      
      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <Animated.View 
          style={[
            styles.scrollToTopButton,
            {
              opacity: scrollY.interpolate({
                inputRange: [300, 400],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [{
                translateY: scrollY.interpolate({
                  inputRange: [300, 400],
                  outputRange: [100, 0],
                  extrapolate: 'clamp',
                })
              }]
            }
          ]}
        >
          <TouchableOpacity
            onPress={scrollToTop}
            style={styles.scrollToTopButtonInner}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-up" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Student Payment History Modal */}
      <Modal
        visible={studentHistoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStudentHistoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedStudent?.name} - Payment History
            </Text>
            <TouchableOpacity
              onPress={() => setStudentHistoryModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            ref={modalScrollViewRef}
            style={styles.modalContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            scrollEventThrottle={1}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
          >
            {selectedStudent && (
              <>
                {/* Student Summary */}
                <View style={styles.studentSummaryCard}>
                  <View style={styles.studentSummaryHeader}>
                    <View style={styles.studentSummaryInfo}>
                      <Text style={styles.studentSummaryName}>{selectedStudent.name}</Text>
                      <Text style={styles.studentSummaryDetails}>
                        Roll: {selectedStudent.rollNo || 'N/A'} • Admission: {selectedStudent.admissionNo}
                      </Text>
                    </View>
                    <View style={[
                      styles.studentSummaryBadge,
                      {
                        backgroundColor: selectedStudent.paymentStatus === 'Paid' ? '#4CAF50' :
                          selectedStudent.paymentStatus === 'Partial' ? '#FF9800' : '#F44336'
                      }
                    ]}>
                      <Text style={styles.studentSummaryBadgeText}>{selectedStudent.paymentStatus}</Text>
                    </View>
                  </View>

                  {/* Payment Summary */}
                  <View style={styles.paymentSummaryGrid}>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Total Fee</Text>
                      <Text style={styles.paymentSummaryValue}>
                        {formatSafeCurrency(selectedStudent.totalFeeStructure)}
                      </Text>
                    </View>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Amount Paid</Text>
                      <Text style={[styles.paymentSummaryValue, { color: '#4CAF50' }]}>
                        {formatSafeCurrency(selectedStudent.totalPaid)}
                      </Text>
                    </View>
                    <View style={styles.paymentSummaryItem}>
                      <Text style={styles.paymentSummaryLabel}>Outstanding</Text>
                      <Text style={[styles.paymentSummaryValue, { color: '#F44336' }]}>
                        {formatSafeCurrency(selectedStudent.outstanding)}
                      </Text>
                    </View>
                    {selectedStudent.totalConcessions > 0 && (
                      <View style={styles.paymentSummaryItem}>
                        <Text style={styles.paymentSummaryLabel}>Fee Concession</Text>
                        <Text style={[styles.paymentSummaryValue, { color: '#FF9800' }]}>
                          {formatSafeCurrency(selectedStudent.totalConcessions)}
                        </Text>
                      </View>
                    )}
                  </View>

                </View>

                {/* Payment History */}
                <View style={styles.paymentHistorySection}>
                  <Text style={styles.paymentHistorySectionTitle}>
                    Payment History ({selectedStudent.paymentCount} payments)
                  </Text>

                  {selectedStudent.payments.length === 0 ? (
                    <View style={styles.noPaymentsContainer}>
                      <Ionicons name="receipt-outline" size={48} color="#ccc" />
                      <Text style={styles.noPaymentsTitle}>No Payments Found</Text>
                      <Text style={styles.noPaymentsText}>
                        This student hasn't made any payments yet.
                      </Text>
                    </View>
                  ) : (
                    selectedStudent.payments
                      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                      .map((payment, index) => (
                        <View key={payment.id} style={styles.paymentHistoryCard}>
                          <View style={styles.paymentHistoryHeader}>
                            <View style={styles.paymentHistoryLeft}>
                              <Text style={styles.paymentHistoryComponent}>
                                {payment.fee_component}
                              </Text>
                              <Text style={styles.paymentHistoryDate}>
                                {formatSafeDate(payment.payment_date)}
                              </Text>
                            </View>
                            <View style={styles.paymentHistoryRight}>
                              <Text style={styles.paymentHistoryAmount}>
                                {formatSafeCurrency(payment.amount_paid)}
                              </Text>
                              {payment.payment_mode && (
                                <Text style={styles.paymentHistoryMode}>
                                  via {payment.payment_mode}
                                </Text>
                              )}
                            </View>
                          </View>
                          
                          {/* Generate Receipt Button */}
                          <TouchableOpacity
                            style={styles.generateReceiptButton}
                            onPress={() => handleGenerateIndividualReceipt(payment)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="receipt" size={16} color="#2196F3" style={{ marginRight: 6 }} />
                            <Text style={styles.generateReceiptButtonText}>Generate Receipt</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Payment Recording Modal */}
      <Modal
        visible={paymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPaymentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Record Payment - {selectedStudent?.name}
            </Text>
            <TouchableOpacity
              onPress={() => setPaymentModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedStudent && (
              <>
                {/* Student Info */}
                <View style={styles.paymentFormCard}>
                  <View style={styles.paymentStudentInfo}>
                    <Text style={styles.paymentStudentName}>{selectedStudent.name}</Text>
                    <Text style={styles.paymentStudentDetails}>
                      Outstanding Amount: {formatSafeCurrency(selectedStudent.outstanding)}
                    </Text>
                  </View>
                </View>

                {/* Payment Form */}
                <View style={styles.paymentFormCard}>
                  <Text style={styles.paymentFormTitle}>Payment Details</Text>
                  
                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Amount *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter payment amount"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="numeric"
                      placeholderTextColor="#999"
                      editable={true}
                    />
                    {selectedFeeComponent && selectedFeeComponent !== 'custom' && (() => {
                      const selectedComponent = feeComponents.find(c => c.fee_component === selectedFeeComponent);
                      if (!selectedComponent) return null;
                      
                      const paidForThisComponent = selectedStudent.payments
                        .filter(payment => payment.fee_component === selectedFeeComponent)
                        .reduce((sum, payment) => sum + (parseFloat(payment.amount_paid) || 0), 0);
                      
                      const remainingForComponent = Math.max(0, selectedComponent.amount - paidForThisComponent);
                      
                      return (
                        <View style={styles.feeComponentReference}>
                          <Text style={styles.feeReferenceLabel}>
                            {selectedFeeComponent} - Payment Summary:
                          </Text>
                          <View style={styles.feeBreakdown}>
                            <View style={styles.feeBreakdownRow}>
                              <Text style={styles.feeBreakdownLabel}>Total Fee:</Text>
                              <Text style={styles.feeBreakdownValue}>
                                {formatSafeCurrency(selectedComponent.amount)}
                              </Text>
                            </View>
                            <View style={styles.feeBreakdownRow}>
                              <Text style={styles.feeBreakdownLabel}>Already Paid:</Text>
                              <Text style={[styles.feeBreakdownValue, { color: '#4CAF50' }]}>
                                {formatSafeCurrency(paidForThisComponent)}
                              </Text>
                            </View>
                            <View style={[styles.feeBreakdownRow, styles.remainingRow]}>
                              <Text style={styles.remainingLabel}>Remaining Amount:</Text>
                              <Text style={styles.remainingAmount}>
                                {formatSafeCurrency(remainingForComponent)}
                              </Text>
                            </View>
                          </View>
                          {remainingForComponent === 0 && (
                            <View style={styles.fullyPaidBanner}>
                              <Text style={styles.fullyPaidBannerText}>
                                ✅ This fee component is fully paid!
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>

                  {/* Payment Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Date *</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateInputText}>
                        {formatDateForDisplay(paymentDate)}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* Payment Mode */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Mode *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.paymentModeChip,
                            paymentMode === mode && styles.activePaymentModeChip
                          ]}
                          onPress={() => setPaymentMode(mode)}
                        >
                          <Text style={[
                            styles.paymentModeChipText,
                            paymentMode === mode && styles.activePaymentModeChipText
                          ]}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Fee Component Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fee Component</Text>
                    {feeComponents.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {feeComponents.map((component, index) => {
                          // Calculate remaining amount for this specific component
                          const paidForThisComponent = selectedStudent.payments
                            .filter(payment => payment.fee_component === component.fee_component)
                            .reduce((sum, payment) => sum + (parseFloat(payment.amount_paid) || 0), 0);
                          
                          const remainingForComponent = Math.max(0, component.amount - paidForThisComponent);
                          
                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.feeComponentChip,
                                selectedFeeComponent === component.fee_component && styles.activeFeeComponentChip,
                                remainingForComponent === 0 && styles.fullyPaidFeeChip
                              ]}
                              onPress={() => {
                                setSelectedFeeComponent(component.fee_component);
                                // Suggest the remaining amount but don't auto-fill
                                setPaymentRemarks(`Payment for ${component.fee_component}`);
                              }}
                              disabled={remainingForComponent === 0}
                            >
                              <Text style={[
                                styles.feeComponentChipText,
                                selectedFeeComponent === component.fee_component && styles.activeFeeComponentChipText,
                                remainingForComponent === 0 && styles.fullyPaidFeeChipText
                              ]}>
                                {component.fee_component}
                                {remainingForComponent === 0 && ' ✓'}
                              </Text>
                              <Text style={[
                                styles.feeComponentChipAmount,
                                selectedFeeComponent === component.fee_component && styles.activeFeeComponentChipAmount,
                                remainingForComponent === 0 && styles.fullyPaidFeeChipAmount
                              ]}>
                                {remainingForComponent === 0 ? (
                                  <Text style={styles.fullyPaidText}>Fully Paid</Text>
                                ) : (
                                  <>
                                    <Text style={styles.remainingAmountText}>
                                      Remaining: {formatSafeCurrency(remainingForComponent)}
                                    </Text>
                                    <Text style={styles.totalAmountText}>
                                      (Total: {formatSafeCurrency(component.amount)})
                                    </Text>
                                  </>
                                )}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        {/* Custom/Other option */}
                        <TouchableOpacity
                          style={[
                            styles.feeComponentChip,
                            styles.customFeeChip,
                            selectedFeeComponent === 'custom' && styles.activeFeeComponentChip
                          ]}
                          onPress={() => {
                            setSelectedFeeComponent('custom');
                            setPaymentRemarks('Custom payment');
                          }}
                        >
                          <Text style={[
                            styles.feeComponentChipText,
                            styles.customFeeChipText,
                            selectedFeeComponent === 'custom' && styles.activeFeeComponentChipText
                          ]}>
                            Other
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.feeComponentChip,
                          styles.customFeeChip,
                          styles.activeFeeComponentChip
                        ]}
                        onPress={() => {
                          setSelectedFeeComponent('custom');
                          setPaymentRemarks('General payment');
                        }}
                      >
                        <Text style={[styles.feeComponentChipText, styles.activeFeeComponentChipText]}>
                          General Payment
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Additional Remarks */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Additional Remarks (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, { height: 80 }]}
                      placeholder="Any additional notes or remarks..."
                      value={paymentRemarks}
                      onChangeText={setPaymentRemarks}
                      multiline
                      textAlignVertical="top"
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      paymentLoading && styles.submitButtonDisabled
                    ]}
                    onPress={handlePaymentSubmit}
                    disabled={paymentLoading}
                    activeOpacity={0.8}
                  >
                    {paymentLoading ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>Recording Payment...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.submitButtonText}>Record Payment</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        visible={receiptModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReceiptModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Payment Receipt
            </Text>
            <TouchableOpacity
              onPress={() => setReceiptModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {lastPaymentRecord && (
              <View style={styles.receiptContainer}>
                {/* Receipt Header */}
                <View style={styles.receiptHeader}>
                  <View style={styles.schoolInfo}>
                    {schoolLogo && (
                      <Image 
                        source={{ uri: schoolLogo }} 
                        style={styles.schoolLogo}
                        resizeMode="contain"
                      />
                    )}
                    <Text style={styles.schoolName}>
                      {schoolDetails?.name || 'School Management System'}
                    </Text>
                    {schoolDetails?.address && (
                      <Text style={styles.schoolAddress}>{schoolDetails.address}</Text>
                    )}
                    {schoolDetails?.phone && (
                      <Text style={styles.schoolContact}>Phone: {schoolDetails.phone}</Text>
                    )}
                    {schoolDetails?.email && (
                      <Text style={styles.schoolContact}>Email: {schoolDetails.email}</Text>
                    )}
                    <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
                  </View>
                  <View style={styles.receiptNumber}>
                    <Text style={styles.receiptNumberLabel}>Receipt No.</Text>
                    <Text style={styles.receiptNumberValue}>{lastPaymentRecord.receipt_no}</Text>
                  </View>
                </View>

                {/* Receipt Details */}
                <View style={styles.receiptDetailsSection}>
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Date:</Text>
                    <Text style={styles.receiptDetailValue}>{lastPaymentRecord.payment_date_formatted}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Student Name:</Text>
                    <Text style={styles.receiptDetailValue}>{lastPaymentRecord.student_name}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Admission No:</Text>
                    <Text style={styles.receiptDetailValue}>{lastPaymentRecord.student_admission_no}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Roll No:</Text>
                    <Text style={styles.receiptDetailValue}>{lastPaymentRecord.student_roll_no || 'N/A'}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Class:</Text>
                    <Text style={styles.receiptDetailValue}>{lastPaymentRecord.class_name}</Text>
                  </View>
                </View>

                {/* Payment Details */}
                <View style={styles.paymentDetailsSection}>
                  <Text style={styles.paymentSectionTitle}>Payment Details</Text>
                  
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Fee Component:</Text>
                    <Text style={styles.paymentDetailValue}>{lastPaymentRecord.fee_component}</Text>
                  </View>
                  
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Payment Mode:</Text>
                    <Text style={styles.paymentDetailValue}>{lastPaymentRecord.payment_mode}</Text>
                  </View>
                  
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Academic Year:</Text>
                    <Text style={styles.paymentDetailValue}>{lastPaymentRecord.academic_year}</Text>
                  </View>
                  
                  <View style={styles.amountSection}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Amount Paid:</Text>
                      <Text style={styles.amountValue}>{formatSafeCurrency(lastPaymentRecord.amount_paid)}</Text>
                    </View>
                    <Text style={styles.amountInWords}>
                      (In words: {lastPaymentRecord.amount_in_words} rupees only)
                    </Text>
                  </View>
                </View>

                {/* Receipt Footer */}
                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>This is a computer generated receipt.</Text>
                  <Text style={styles.receiptFooterText}>Payment ID: {lastPaymentRecord.id}</Text>
                  <Text style={styles.thankYouText}>Thank you for your payment!</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.receiptActions}>
                  <TouchableOpacity
                    style={styles.printButton}
                    onPress={() => handlePrintReceipt(lastPaymentRecord)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="print" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.printButtonText}>Print Receipt</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleShareReceipt(lastPaymentRecord)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.shareButtonText}>Share PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Individual Receipt Modal for Payment History */}
      <Modal
        visible={individualReceiptModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIndividualReceiptModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Payment Receipt
            </Text>
            <TouchableOpacity
              onPress={() => setIndividualReceiptModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedPaymentForReceipt && (
              <View style={styles.receiptContainer}>
                {/* Receipt Header */}
                <View style={styles.receiptHeader}>
                  <View style={styles.schoolInfo}>
                    {schoolLogo && (
                      <Image 
                        source={{ uri: schoolLogo }} 
                        style={styles.schoolLogo}
                        resizeMode="contain"
                      />
                    )}
                    <Text style={styles.schoolName}>
                      {schoolDetails?.name || 'School Management System'}
                    </Text>
                    {schoolDetails?.address && (
                      <Text style={styles.schoolAddress}>{schoolDetails.address}</Text>
                    )}
                    {schoolDetails?.phone && (
                      <Text style={styles.schoolContact}>Phone: {schoolDetails.phone}</Text>
                    )}
                    {schoolDetails?.email && (
                      <Text style={styles.schoolContact}>Email: {schoolDetails.email}</Text>
                    )}
                    <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
                  </View>
                  <View style={styles.receiptNumber}>
                    <Text style={styles.receiptNumberLabel}>Receipt No.</Text>
                    <Text style={styles.receiptNumberValue}>{selectedPaymentForReceipt.receipt_no}</Text>
                  </View>
                </View>

                {/* Receipt Details */}
                <View style={styles.receiptDetailsSection}>
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Date:</Text>
                    <Text style={styles.receiptDetailValue}>{selectedPaymentForReceipt.payment_date_formatted}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Student Name:</Text>
                    <Text style={styles.receiptDetailValue}>{selectedPaymentForReceipt.student_name}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Admission No:</Text>
                    <Text style={styles.receiptDetailValue}>{selectedPaymentForReceipt.student_admission_no}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Roll No:</Text>
                    <Text style={styles.receiptDetailValue}>{selectedPaymentForReceipt.student_roll_no || 'N/A'}</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Class:</Text>
                    <Text style={styles.receiptDetailValue}>{selectedPaymentForReceipt.class_name}</Text>
                  </View>
                </View>

                {/* Payment Details */}
                <View style={styles.paymentDetailsSection}>
                  <Text style={styles.paymentSectionTitle}>Payment Details</Text>
                  
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Fee Component:</Text>
                    <Text style={styles.paymentDetailValue}>{selectedPaymentForReceipt.fee_component}</Text>
                  </View>
                  
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Payment Mode:</Text>
                    <Text style={styles.paymentDetailValue}>{selectedPaymentForReceipt.payment_mode}</Text>
                  </View>
                  
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Academic Year:</Text>
                    <Text style={styles.paymentDetailValue}>{selectedPaymentForReceipt.academic_year}</Text>
                  </View>
                  
                  <View style={styles.amountSection}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Amount Paid:</Text>
                      <Text style={styles.amountValue}>{formatSafeCurrency(selectedPaymentForReceipt.amount_paid)}</Text>
                    </View>
                    <Text style={styles.amountInWords}>
                      (In words: {selectedPaymentForReceipt.amount_in_words} rupees only)
                    </Text>
                  </View>
                </View>

                {/* Receipt Footer */}
                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>This is a computer generated receipt.</Text>
                  <Text style={styles.receiptFooterText}>Payment ID: {selectedPaymentForReceipt.id}</Text>
                  <Text style={styles.thankYouText}>Thank you for your payment!</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.receiptActions}>
                  <TouchableOpacity
                    style={styles.printButton}
                    onPress={() => handlePrintReceipt(selectedPaymentForReceipt)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="print" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.printButtonText}>Print Receipt</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleShareReceipt(selectedPaymentForReceipt)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.shareButtonText}>Share PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
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
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 120px)',
        maxHeight: 'calc(100vh - 120px)',
        minHeight: 500,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      },
      default: {
        minHeight: 400,
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'scroll',
        overflowX: 'hidden',
        height: '100%',
        maxHeight: '100%',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
    ...Platform.select({
      web: {
        paddingBottom: 100,
        paddingTop: 8,
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  // Tab Navigation
  tabContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  collectionBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  collectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Search and Filter Section
  searchFilterSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  sortChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeSortChip: {
    backgroundColor: '#FF9800',
  },
  sortChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeSortChipText: {
    color: '#fff',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  // Students Section
  studentsSection: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  resetButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Student Cards
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  feeDetails: {
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  paymentHistory: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paymentHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentComponent: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  paymentDetails: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  paymentDate: {
    fontSize: 10,
    color: '#999',
  },
  morePayments: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  lastPayment: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalTitle: {
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
  modalContent: {
    flex: 1,
    padding: 16,
  },
  // Student Summary Card
  studentSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  studentSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  studentSummaryInfo: {
    flex: 1,
  },
  studentSummaryName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentSummaryDetails: {
    fontSize: 14,
    color: '#666',
  },
  studentSummaryBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  studentSummaryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paymentSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  paymentSummaryItem: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  paymentSummaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  modalProgressContainer: {
    marginTop: 8,
  },
  modalProgressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Payment History Section
  paymentHistorySection: {
    marginBottom: 20,
  },
  paymentHistorySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  noPaymentsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noPaymentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noPaymentsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentHistoryCard: {
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
  paymentHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentHistoryLeft: {
    flex: 1,
  },
  paymentHistoryComponent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentHistoryDate: {
    fontSize: 12,
    color: '#666',
  },
  paymentHistoryRight: {
    alignItems: 'flex-end',
  },
  paymentHistoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  paymentHistoryMode: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  // Reports Tab Styles
  reportsContainer: {
    marginBottom: 20,
  },
  reportsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Key Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  totalStudentsCard: {
    borderTopColor: '#2196F3',
    borderTopWidth: 4,
  },
  collectionRateCard: {
    borderTopColor: '#4CAF50',
    borderTopWidth: 4,
  },
  metricIconContainer: {
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Payment Status Breakdown
  statusBreakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  statusBreakdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  statusPercentage: {
    fontSize: 12,
    color: '#666',
  },
  statusProgressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statusProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Financial Summary
  financialSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  financialSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  financialItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  financialDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  // Payment Activity Summary
  activitySummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  activitySummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  activityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  // Action Buttons Container
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  // Mark as Paid Button
  markAsPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  markAsPaidButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Fee Concession Button
  feeConcessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  feeConcessionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Payment Form Styles
  paymentFormCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  paymentStudentInfo: {
    alignItems: 'center',
  },
  paymentStudentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentStudentDetails: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  paymentModeChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  activePaymentModeChip: {
    backgroundColor: '#2196F3',
  },
  paymentModeChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activePaymentModeChipText: {
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Fee Concession Display Styles
  concessionsContainer: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  concessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  concessionsIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  concessionsHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF8F00',
    marginLeft: 6,
  },
  concessionsStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  concessionsAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF8F00',
  },
  addConcessionButton: {
    padding: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 143, 0, 0.1)',
  },
  concessionsDetails: {
    marginTop: 4,
  },
  concessionsDetailsText: {
    fontSize: 12,
    color: '#FF8F00',
    fontStyle: 'italic',
  },
  // Fee Component Chips
  feeComponentChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeFeeComponentChip: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  customFeeChip: {
    backgroundColor: '#F5F5F5',
    borderStyle: 'dashed',
    borderColor: '#999',
    borderWidth: 1,
  },
  feeComponentChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  activeFeeComponentChipText: {
    color: '#fff',
  },
  customFeeChipText: {
    color: '#666',
    fontSize: 13,
  },
  feeComponentChipAmount: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeFeeComponentChipAmount: {
    color: '#E3F2FD',
  },
  feeComponentReference: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  feeReferenceLabel: {
    fontSize: 13,
    color: '#1976D2',
    marginBottom: 8,
    fontWeight: '600',
  },
  feeReferenceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  feeBreakdown: {
    marginTop: 4,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  feeBreakdownLabel: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  feeBreakdownValue: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  remainingRow: {
    borderTopWidth: 1,
    borderTopColor: '#BBDEFB',
    paddingTop: 6,
    marginTop: 4,
  },
  remainingLabel: {
    fontSize: 13,
    color: '#1976D2',
    fontWeight: 'bold',
  },
  remainingAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  fullyPaidBanner: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  fullyPaidBannerText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Fully Paid Fee Component Styles
  fullyPaidFeeChip: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    opacity: 0.7,
  },
  fullyPaidFeeChipText: {
    color: '#2E7D32',
  },
  fullyPaidFeeChipAmount: {
    color: '#2E7D32',
  },
  fullyPaidText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  remainingAmountText: {
    fontSize: 11,
    color: '#F44336',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  totalAmountText: {
    fontSize: 9,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  generateReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  generateReceiptButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
  },
  // Receipt Styles
  receiptContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  receiptHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
    paddingBottom: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  schoolInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  schoolLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
    alignSelf: 'center',
  },
  schoolName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
    textAlign: 'center',
  },
  schoolAddress: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  schoolContact: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 2,
  },
  receiptNumber: {
    alignItems: 'center',
  },
  receiptNumberLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  receiptNumberValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  receiptDetailsSection: {
    marginBottom: 20,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  receiptDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  receiptDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  paymentDetailsSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  paymentSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  amountSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  amountInWords: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  receiptFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  receiptFooterText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginBottom: 4,
  },
  thankYouText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
  },
  receiptActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // FlatList Styles
  studentFlatList: {
    flex: 1,
  },
  studentFlatListContent: {
    paddingBottom: 20,
  },
  // Horizontal Scroll Content
  horizontalScrollContent: {
    paddingHorizontal: 4,
  },
  // Scroll to Top Button
  scrollToTopButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed',
        bottom: 30,
        right: 30,
      },
    }),
  },
  scrollToTopButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: '#1976D2',
          transform: 'scale(1.1)',
        },
      },
    }),
  },
});

export default ClassStudentDetails;
