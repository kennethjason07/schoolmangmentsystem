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
import UPIQRModal from '../../components/UPIQRModal';
import { useAuth } from '../../utils/AuthContext';
import { getNextReceiptNumber } from '../../utils/receiptCounter';
import { loadLogoWithFallbacks, validateImageData } from '../../utils/robustLogoLoader';
import LogoDisplay from '../../components/LogoDisplay';
import { useFocusEffect } from '@react-navigation/native';

const ClassStudentDetails = ({ route, navigation }) => {
  const { classData } = route.params;
  
  const [classStudents, setClassStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('admission');
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
  const [concessionsData, setConcessionsData] = useState([]); // Student discounts/concessions
  const [receiptModal, setReceiptModal] = useState(false);
  const [lastPaymentRecord, setLastPaymentRecord] = useState(null);
  const [individualReceiptModal, setIndividualReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [schoolLogo, setSchoolLogo] = useState(null);
  const [showUPIQRModal, setShowUPIQRModal] = useState(false);
  const [upiTransactionData, setUpiTransactionData] = useState(null);
  const { user } = useAuth();
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  
  // Refs for scrolling
  const mainScrollViewRef = useRef(null);
  const studentListRef = useRef(null);
  const reportsScrollViewRef = useRef(null);
  const modalScrollViewRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Refs for swipe gestures
  const touchStartXRef = useRef(0);
  const touchStartX2Ref = useRef(0);

  useEffect(() => {
    loadSchoolDetails();
    loadClassStudentDetails();
  }, []);

  // 🚀 DYNAMIC UPDATE: Listen for screen focus to refresh data when returning from DiscountManagement
  useFocusEffect(
    useCallback(() => {
      // Only reload if we're returning from another screen (not initial mount)
      // Check if route params indicate we should refresh
      if (route.params?.shouldRefresh || route.params?.concessionUpdated) {
        console.log('🔄 Screen focused with refresh request - reloading student data...');
        loadClassStudentDetails();
        
        // Clear the refresh flag to prevent unnecessary reloads
        if (navigation.setParams) {
          navigation.setParams({ shouldRefresh: false, concessionUpdated: false });
        }
      }
    }, [route.params?.shouldRefresh, route.params?.concessionUpdated])
  );

  // 🚀 DYNAMIC UPDATE: Real-time listener for student_discounts table changes
  useEffect(() => {
    let discountsSubscription;

    const setupDiscountsListener = async () => {
      try {
        const tenantId = user?.tenant_id;
        if (!tenantId) return;

        // Set up real-time subscription for student_discounts changes
        discountsSubscription = supabase
          .channel(`student_discounts_class_${classData.classId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'student_discounts',
              filter: `tenant_id=eq.${tenantId}`
            },
            (payload) => {
              console.log('🎯 Student discount changed:', payload);
              
              // Check if the change affects students in this class
              const { new: newRecord, old: oldRecord } = payload;
              const affectedStudentId = newRecord?.student_id || oldRecord?.student_id;
              
              if (affectedStudentId && classStudents.some(s => s.id === affectedStudentId)) {
                console.log('🔄 Discount change affects this class - refreshing student data...');
                // Reload the student details to reflect concession changes
                loadClassStudentDetails();
              }
            }
          )
          .subscribe();

        console.log('✅ Set up real-time listener for student discounts');
      } catch (error) {
        console.warn('⚠️ Failed to setup discounts listener:', error);
      }
    };

    if (user?.tenant_id && classData.classId) {
      setupDiscountsListener();
    }

    // Cleanup on unmount
    return () => {
      if (discountsSubscription) {
        supabase.removeChannel(discountsSubscription);
        console.log('🧹 Cleaned up discounts real-time listener');
      }
    };
  }, [user?.tenant_id, classData.classId, classStudents]);

  // Load school details and logo
  const loadSchoolDetails = async () => {
    try {
      console.log('🏫 Loading school details with tenant filtering...');
      
      // Use tenant-aware helper instead of direct query
      const { data: schoolData, error } = await dbHelpers.getSchoolDetails();

      console.log('🏫 School details query result:', { schoolData, error });

      if (error) {
        console.error('❌ Error loading school details:', error);
        Alert.alert(
          'School Details Error', 
          `Failed to load school details: ${error.message}`
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
              console.log('📷 Logo will be used in receipt generation');
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
    console.log('🚀 [DEBUG] loadClassStudentDetails function called!');
    console.log('🚀 [DEBUG] classData:', classData);
    console.log('🚀 [DEBUG] user:', user);
    
    // Outer try-catch to catch ALL possible errors
    try {
      // Inner try-catch for main function logic
      try {
        console.log('🚀 [DEBUG] Setting loading to true...');
        setLoading(true);

      // 🏦 GET TENANT ID FOR DATA ISOLATION
      const tenantId = user?.tenant_id;
      
      // 🐛 COMPREHENSIVE TENANT DEBUGGING
      console.log('🔍 [TENANT DEBUG] Starting ClassStudentDetails loadClassStudentDetails');
      console.log('🔍 [TENANT DEBUG] Full user object:', JSON.stringify(user, null, 2));
      console.log('🔍 [TENANT DEBUG] Extracted tenant_id:', tenantId);
      console.log('🔍 [TENANT DEBUG] Tenant ID type:', typeof tenantId);
      console.log('🔍 [TENANT DEBUG] Is tenant_id truthy?', !!tenantId);
      console.log('🔍 [TENANT DEBUG] ClassData:', JSON.stringify(classData, null, 2));
      
      if (!tenantId) {
        console.error('❌ [TENANT DEBUG] CRITICAL: No tenant_id found in user object');
        console.error('❌ [TENANT DEBUG] User object keys:', Object.keys(user || {}));
        console.error('❌ [TENANT DEBUG] This will prevent student data from loading');
        Alert.alert('Error', 'Tenant context not found. Please re-login.');
        return;
      }
      
      console.log('✅ [TENANT DEBUG] Tenant ID validation passed:', tenantId);

      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Get detailed student information for the selected class with tenant isolation
      console.log('🎯 [TENANT DEBUG] About to execute student query with parameters:');
      console.log('🎯 [TENANT DEBUG] Query table:', TABLES.STUDENTS);
      console.log('🎯 [TENANT DEBUG] Class ID filter:', classData.classId);
      console.log('🎯 [TENANT DEBUG] Tenant ID filter:', tenantId);
      
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
        .eq('class_id', classData.classId)
        .eq('tenant_id', tenantId); // 🔒 TENANT ISOLATION

      console.log('📊 [TENANT DEBUG] Student query results:');
      console.log('📊 [TENANT DEBUG] Students found:', studentsData?.length || 0);
      console.log('📊 [TENANT DEBUG] Query error:', error);
      if (studentsData && studentsData.length > 0) {
        console.log('📊 [TENANT DEBUG] Sample student data:', studentsData[0]);
      } else {
        console.log('❌ [TENANT DEBUG] NO STUDENTS FOUND - This is the root cause!');
        console.log('❌ [TENANT DEBUG] Possible causes:');
        console.log('❌ [TENANT DEBUG] 1. No students exist for this class_id:', classData.classId);
        console.log('❌ [TENANT DEBUG] 2. No students exist for this tenant_id:', tenantId);
        console.log('❌ [TENANT DEBUG] 3. Students exist but with different class_id or tenant_id');
        console.log('❌ [TENANT DEBUG] 4. Database connectivity issues');
        
        // Let's try a broader query to see what students exist
        try {
          const { data: allStudentsForTenant } = await supabase
            .from(TABLES.STUDENTS)
            .select('id, name, class_id, tenant_id')
            .eq('tenant_id', tenantId);
          console.log('🔍 [TENANT DEBUG] All students for this tenant:', allStudentsForTenant?.length || 0);
          if (allStudentsForTenant && allStudentsForTenant.length > 0) {
            console.log('🔍 [TENANT DEBUG] Sample tenant student:', allStudentsForTenant[0]);
          }
          
          const { data: allStudentsForClass } = await supabase
            .from(TABLES.STUDENTS)
            .select('id, name, class_id, tenant_id')
            .eq('class_id', classData.classId);
          console.log('🔍 [TENANT DEBUG] All students for this class (any tenant):', allStudentsForClass?.length || 0);
          if (allStudentsForClass && allStudentsForClass.length > 0) {
            console.log('🔍 [TENANT DEBUG] Sample class student:', allStudentsForClass[0]);
          }
        } catch (debugError) {
          console.error('🔍 [TENANT DEBUG] Error in debug queries:', debugError);
        }
      }

      if (error) throw error;

      // Get fee structure for this class with tenant isolation
      const { data: feeStructureData, error: feeError } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classData.classId)
        .eq('tenant_id', tenantId) // 🔒 TENANT ISOLATION
        .is('student_id', null); // Only class-level fees

      console.log('🏫 ClassStudentDetails Debug Info:');
      console.log('📚 Class ID:', classData.classId);
      console.log('🏢 Tenant ID:', tenantId);
      console.log('🧮 Fee structures found:', feeStructureData?.length || 0);
      if (feeStructureData && feeStructureData.length > 0) {
        console.log('💰 Sample fee structure:', feeStructureData[0]);
      }

      if (feeError) throw feeError;

      // Calculate total fee structure amount (BASE FEE)
      const totalBaseFeeStructure = feeStructureData.reduce((sum, fee) => 
        sum + (parseFloat(fee.amount) || 0), 0);

      // 🎯 GET FEE CONCESSIONS FOR ALL STUDENTS (FIXED AMOUNTS)
      const studentIds = studentsData.map(s => s.id);
      let loadedConcessionsData = [];
      
      console.log('🎫 Fetching concessions for students:', studentIds);
      console.log('🎫 Academic Year:', academicYear);
      
      if (studentIds.length > 0) {
        const { data: concessions, error: concessionsError } = await supabase
          .from('student_discounts')
          .select('student_id, discount_value, discount_type, fee_component, description')
          .in('student_id', studentIds)
          .eq('tenant_id', tenantId) // 🔒 TENANT ISOLATION
          .eq('is_active', true);
        
        console.log('🎫 Raw concessions from DB:', concessions);
        console.log('🎫 Concessions error:', concessionsError);
        
        if (!concessionsError && concessions) {
          loadedConcessionsData = concessions;
          console.log('🎫 Total concessions found:', loadedConcessionsData.length);
        }
      }
      
      // ✅ SET CONCESSIONS DATA IN STATE so it's accessible throughout component
      setConcessionsData(loadedConcessionsData);

      // Process student data with CORRECTED concession logic
      const processedStudents = studentsData.map(student => {
        // Filter payments for current academic year
        const currentYearPayments = student.student_fees?.filter(
          payment => payment.academic_year === academicYear
        ) || [];

        // Calculate total paid by this student
        const totalPaid = currentYearPayments.reduce((sum, payment) => 
          sum + (parseFloat(payment.amount_paid) || 0), 0);

        // 🎯 CALCULATE CONCESSIONS CORRECTLY (FIXED AMOUNTS DEDUCTED FROM BASE FEE)
        const studentConcessions = loadedConcessionsData.filter(c => c.student_id === student.id);
        const totalConcessions = studentConcessions.reduce((sum, concession) => {
          if (concession.discount_type === 'fixed_amount') {
            return sum + (parseFloat(concession.discount_value) || 0);
          } else if (concession.discount_type === 'percentage') {
            // Apply percentage to base fee
            return sum + (totalBaseFeeStructure * (parseFloat(concession.discount_value) || 0) / 100);
          }
          return sum;
        }, 0);
        
        // Debug concessions for this student
        console.log(`🎫 Student ${student.name} (ID: ${student.id}) concessions:`, {
          studentConcessions,
          totalConcessions,
          concessionsFound: studentConcessions.length
        });

        // 🔧 CORRECTED LOGIC: Adjusted Fee = Base Fee - Concessions
        const adjustedFeeAmount = Math.max(0, totalBaseFeeStructure - totalConcessions);
        
        // 🔧 CORRECTED LOGIC: Outstanding = Max(0, Adjusted Fee - Total Paid)
        const outstanding = Math.max(0, adjustedFeeAmount - totalPaid);

        // Calculate payment percentage based on adjusted fee amount
        const paymentPercentage = adjustedFeeAmount > 0 ? 
          Math.min(100, (totalPaid / adjustedFeeAmount) * 100) : 0;

        // Get payment status - Enhanced logic with concession-based banners for admin
        let paymentStatus;
        if (totalConcessions >= totalBaseFeeStructure && totalBaseFeeStructure > 0) {
          paymentStatus = 'Free'; // Full concession covers all fees
        } else if (totalConcessions > 0 && totalConcessions < totalBaseFeeStructure) {
          paymentStatus = 'Concession'; // Partial concession applied
        } else if (totalPaid >= adjustedFeeAmount) {
          paymentStatus = 'Paid'; // Fully paid against adjusted fee
        } else if (totalPaid > 0) {
          paymentStatus = 'Partial'; // Partially paid
        } else {
          paymentStatus = 'Pending'; // No payments made
        }

        // Debug logging to trace payment status calculation
        console.log(`Student: ${student.name}, Base Fee: ${totalBaseFeeStructure}, Concessions: ${totalConcessions}, Adjusted Fee: ${adjustedFeeAmount}, Paid: ${totalPaid}, Outstanding: ${outstanding}, Status: ${paymentStatus}`, {
          studentId: student.id,
          totalBaseFeeStructure,
          totalConcessions,
          adjustedFeeAmount,
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
          admission_no: student.admission_no,
          admissionNo: student.admission_no, // Keep both for compatibility
          roll_no: student.roll_no,
          rollNo: student.roll_no, // Keep both for compatibility
          totalFeeStructure: totalBaseFeeStructure, // Original base fee
          totalPaid,
          outstanding,
          paymentPercentage: Math.round(paymentPercentage * 100) / 100,
          paymentStatus,
          latestPaymentDate: latestPayment?.payment_date,
          latestPaymentMode: latestPayment?.payment_mode,
          payments: currentYearPayments,
          paymentCount: currentYearPayments.length,
          totalConcessions,
          adjustedFeeAmount // ✅ This is the key field - fee after concessions
        };
      });

      // Sort by admission number by default (maintains stable order)
      processedStudents.sort((a, b) => {
        // First try sorting by admission number
        if (a.admission_no && b.admission_no) {
          return a.admission_no.localeCompare(b.admission_no, undefined, { numeric: true });
        }
        // Fallback to name if no admission number
        return a.name.localeCompare(b.name);
      });

      setClassStudents(processedStudents);
      setFilteredStudents(processedStudents);

      } catch (error) {
        console.error('❌ Inner try-catch error loading class student details:', error);
        Alert.alert('Error', 'Failed to load student details');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    } catch (outerError) {
      // 🚨 OUTER try-catch to catch ALL possible errors including silent failures
      console.error('❌ [OUTER CATCH] Critical error in loadClassStudentDetails:', outerError);
      console.error('❌ [OUTER CATCH] Error name:', outerError.name);
      console.error('❌ [OUTER CATCH] Error message:', outerError.message);
      console.error('❌ [OUTER CATCH] Error stack:', outerError.stack);
      
      Alert.alert(
        'Critical Error', 
        `A critical error occurred while loading student details:\n\n${outerError.message}\n\nPlease check the console for more details and contact support if this persists.`,
        [{ text: 'OK', style: 'default' }]
      );
      
      // Ensure loading states are reset even in critical failure
      setLoading(false);
      setRefreshing(false);
      
      // Set empty state to prevent undefined errors in UI
      setClassStudents([]);
      setFilteredStudents([]);
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
        filtered.sort((a, b) => b.outstanding - a.outstanding);
        break;
      case 'admission':
      default:
        // Sort by admission number, fallback to name
        filtered.sort((a, b) => {
          if (a.admission_no && b.admission_no) {
            return a.admission_no.localeCompare(b.admission_no, undefined, { numeric: true });
          }
          return a.name.localeCompare(b.name);
        });
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
    console.log('🎯 Navigating to DiscountManagement for student:', student.name);
    
    // Navigate to DiscountManagement screen with student context
    navigation.navigate('DiscountManagement', {
      classId: classData.classId,
      className: classData.className,
      studentId: student.id,
      studentName: student.name,
      openIndividualDiscount: true,
      // Add callback information for dynamic updates
      returnScreen: 'ClassStudentDetails',
      returnParams: {
        classData,
        shouldRefresh: true,
        concessionUpdated: true
      }
    });
  };

  // Handle UPI QR Code payment
  const handleUPIPayment = (student) => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount first.');
      return;
    }

    if (!selectedFeeComponent) {
      Alert.alert('Validation Error', 'Please select a fee component first.');
      return;
    }

    // Use selectedStudent or fallback to passed student parameter
    const studentData = selectedStudent || student;
    
    if (!studentData) {
      Alert.alert('Error', 'Student data is not available. Please try again.');
      return;
    }

    // Set student and UPI transaction data
    const transactionData = {
      studentId: studentData.id,
      studentName: studentData.name,
      admissionNo: studentData.admissionNo || studentData.admission_no,
      className: classData.className,
      amount: parseFloat(paymentAmount),
      feeComponent: selectedFeeComponent === 'custom' 
        ? (paymentRemarks || 'General Fee Payment')
        : selectedFeeComponent || 'General Fee Payment',
      paymentDate: paymentDate.toISOString().split('T')[0],
      academicYear: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`,
      tenantId: user?.tenant_id
    };

    setUpiTransactionData(transactionData);
    setShowUPIQRModal(true);
  };

  // Handle UPI payment success - EXACT MOBILE MATCH
  const handleUPIPaymentSuccess = async (paymentData) => {
    try {
      setPaymentLoading(true);
      
      // 🚨 IMPORTANT: The UPI payment record is already created by UPIDBService.createStudentFeeRecord
      // We don't need to insert it again here. Just use the existing record.
      
      // Check if paymentData contains the fee record (from UPIQRModal)
      let insertedPayment;
      
      if (paymentData.feeRecord && !paymentData.isLocal) {
        // Use the existing fee record created by UPI flow
        insertedPayment = paymentData.feeRecord;
        console.log('✅ Using existing UPI fee record:', insertedPayment.id);
      } else {
        // Fallback: Create record manually (only if UPI flow didn't create one)
        console.log('🔄 Creating manual fee record as fallback...');
        
        const receiptNumber = await getNextReceiptNumber();
        console.log('UPI - Generated receipt number:', receiptNumber);

        const { data: manualPayment, error } = await supabase
          .from(TABLES.STUDENT_FEES)
          .insert({
            student_id: upiTransactionData.studentId,
            fee_component: upiTransactionData.feeComponent,
            amount_paid: upiTransactionData.amount,
            payment_date: upiTransactionData.paymentDate,
            payment_mode: 'UPI',
            academic_year: upiTransactionData.academicYear,
            receipt_number: receiptNumber,
            tenant_id: user?.tenant_id, // ✅ FIX: Add missing tenant_id
            // Note: transaction_id removed as it doesn't exist in student_fees table schema
            // UPI transaction details are stored in the separate upi_transactions table
          })
          .select()
          .single();

        if (error) throw error;
        insertedPayment = manualPayment;
      }

      // Store payment record for receipt
      const receiptData = {
        ...insertedPayment,
        student_name: upiTransactionData.studentName,
        student_admission_no: upiTransactionData.admissionNo,
        student_roll_no: selectedStudent?.rollNo,
        class_name: upiTransactionData.className,
        receipt_no: insertedPayment.receipt_number || 'N/A', // ✅ FIX: Use receipt_number from the inserted payment
        payment_date_formatted: formatDateForDisplay(paymentDate),
        amount_in_words: numberToWords(upiTransactionData.amount)
      };
      
      setLastPaymentRecord(receiptData);
      
      // 🎯 MOBILE EXACT MATCH: Close UPI QR modal and payment modal first
      setShowUPIQRModal(false);
      setPaymentModal(false);
      
      // 🎯 MOBILE EXACT MATCH: Show receipt modal immediately
      setReceiptModal(true);
      
      // 🎯 MOBILE EXACT MATCH: Show success alert
      Alert.alert('Payment Successful', 'UPI payment has been recorded successfully!');
      
      // Refresh the data to show updated payment status
      await loadClassStudentDetails();
      
      // 🚀 DYNAMIC UPDATE: Force UI refresh after UPI payment
      console.log('🔄 UPI payment successful - triggering dynamic UI update...');
      
    } catch (error) {
      console.error('Error recording UPI payment:', error);
      Alert.alert('Error', 'Failed to record UPI payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle UPI payment failure
  const handleUPIPaymentFailure = (error) => {
    console.error('UPI payment failed:', error);
    Alert.alert('Payment Failed', error.message || 'UPI payment failed. Please try again.');
  };

  // Handle UPI modal close
  const handleUPIModalClose = () => {
    setShowUPIQRModal(false);
    setUpiTransactionData(null);
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

  // Load logo directly for print (backup method)
  const loadLogoForPrint = async () => {
    try {
      console.log('📷 Loading logo directly for print...');
      
      // If we already have a working logo URL, use it
      if (schoolLogo && isValidImageUrl(schoolLogo)) {
        console.log('✅ Using already loaded logo URL:', schoolLogo);
        return schoolLogo;
      }
      
      // Otherwise try to load it fresh from database
      if (schoolDetails?.logo_url) {
        // If logo_url is already a full URL, use it directly
        if (isValidImageUrl(schoolDetails.logo_url)) {
          console.log('✅ Logo URL is already full URL:', schoolDetails.logo_url);
          return schoolDetails.logo_url;
        }
        
        // Extract filename if it's a full URL
        let filename = schoolDetails.logo_url;
        if (schoolDetails.logo_url.includes('/')) {
          filename = schoolDetails.logo_url.split('/').pop().split('?')[0];
        }
        
        // Try profiles bucket first (where new uploads go)
        try {
          const { data: profilesLogoData } = await supabase.storage
            .from('profiles')
            .getPublicUrl(filename);
            
          if (profilesLogoData?.publicUrl && isValidImageUrl(profilesLogoData.publicUrl)) {
            console.log('✅ Loaded logo from profiles bucket:', profilesLogoData.publicUrl);
            return profilesLogoData.publicUrl;
          }
        } catch (profilesError) {
          console.log('🔄 Profiles bucket failed, trying school-assets:', profilesError.message);
        }
        
        // Fallback to school-assets bucket
        try {
          const { data: assetsLogoData } = await supabase.storage
            .from('school-assets')
            .getPublicUrl(filename);
            
          if (assetsLogoData?.publicUrl && isValidImageUrl(assetsLogoData.publicUrl)) {
            console.log('✅ Loaded logo from school-assets bucket:', assetsLogoData.publicUrl);
            return assetsLogoData.publicUrl;
          }
        } catch (assetsError) {
          console.log('❌ Both buckets failed:', assetsError.message);
        }
      }
      
      console.log('⚠️ No valid logo URL available for print');
      return null;
    } catch (error) {
      console.error('❌ Error loading logo for print:', error);
      return null;
    }
  };
  
  // Helper function to validate image URLs (same as LogoDisplay)
  const isValidImageUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('file://')) return false;
    if (url.includes('ExperienceData') || url.includes('ImagePicker')) return false;
    return url.startsWith('http://') || url.startsWith('https://');
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

  // Format date from yyyy-mm-dd to dd-mm-yyyy (copied from student)
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

  // Import the unified receipt template (copied from student)
  const { generateUnifiedReceiptHTML } = require('../../utils/unifiedReceiptTemplate');

  // Generate receipt HTML using unified template (copied from student)
  const generateReceiptHTML = async (receiptData) => {
    try {
      console.log('📧 Admin - Generating unified receipt HTML...');
      
      // Convert admin receipt data format to match unified template expectations
      const unifiedReceiptData = {
        student_name: receiptData.student_name,
        student_admission_no: receiptData.student_admission_no,
        class_name: receiptData.class_name,
        fee_component: receiptData.fee_component,
        payment_date_formatted: receiptData.payment_date_formatted,
        receipt_no: receiptData.receipt_no || receiptData.receipt_number,
        payment_mode: receiptData.payment_mode,
        amount_paid: receiptData.amount_paid
      };
      
      // Use the unified receipt template
      const htmlContent = await generateUnifiedReceiptHTML(unifiedReceiptData, schoolDetails);
      
      console.log('✅ Admin - Unified receipt HTML generated successfully');
      return htmlContent;
    } catch (error) {
      console.error('❌ Admin - Error generating unified receipt:', error);
      // Fallback to old method if unified template fails
      return await generateFallbackReceiptHTML(receiptData);
    }
  };

  // Fallback receipt generator (copied from student)
  const generateFallbackReceiptHTML = async (receiptData) => {
    try {
      console.log('📧 Admin - Generating fallback receipt HTML...');
      
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
            <title>Fee Receipt - ${receiptData.receipt_no || receiptData.receipt_number}</title>
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
                    <span class="receipt-value">${receiptData.student_name}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Admission No:</span>
                    <span class="receipt-value">${receiptData.student_admission_no}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Class:</span>
                    <span class="receipt-value">${receiptData.class_name}</span>
                  </div>
                </div>
                
                <!-- Right Column -->
                <div class="receipt-column">
                  <div class="receipt-row">
                    <span class="receipt-label">Fee Type:</span>
                    <span class="receipt-value">${receiptData.fee_component}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Date:</span>
                    <span class="receipt-value">${receiptData.payment_date_formatted}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Receipt No:</span>
                    <span class="receipt-value">${receiptData.receipt_no || receiptData.receipt_number}</span>
                  </div>
                  <div class="receipt-row">
                    <span class="receipt-label">Payment Mode:</span>
                    <span class="receipt-value">${receiptData.payment_mode}</span>
                  </div>
                </div>
              </div>
              
              <!-- Amount Section -->
              <div class="receipt-amount-section">
                <p class="receipt-amount-label">Amount Paid</p>
                <h3 class="receipt-amount">₹${receiptData.amount_paid?.toLocaleString()}</h3>
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
            <title>Receipt - ${receiptData.receipt_no || receiptData.receipt_number || 'N/A'}</title>
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
                <div class="row"><span class="label">Student Name:</span> ${receiptData.student_name || 'N/A'}</div>
                <div class="row"><span class="label">Admission No:</span> ${receiptData.student_admission_no || 'N/A'}</div>
                <div class="row"><span class="label">Class:</span> ${receiptData.class_name || 'N/A'}</div>
              </div>
              <div>
                <div class="row"><span class="label">Fee Type:</span> ${receiptData.fee_component || 'N/A'}</div>
                <div class="row"><span class="label">Date:</span> ${receiptData.payment_date_formatted || 'N/A'}</div>
                <div class="row"><span class="label">Receipt No:</span> ${receiptData.receipt_no || receiptData.receipt_number || 'N/A'}</div>
                <div class="row"><span class="label">Payment Mode:</span> ${receiptData.payment_mode || 'N/A'}</div>
              </div>
            </div>
            <div class="amount">Amount Paid: ₹${receiptData.amount_paid?.toLocaleString() || '0.00'}</div>
          </body>
        </html>
      `;
    }
  };

  // Handle print receipt with landscape orientation (copied from student)
  const handlePrintReceipt = async (receiptData) => {
    try {
      const htmlContent = await generateReceiptHTML(receiptData);
      
      // Print directly with landscape orientation
      await Print.printAsync({
        html: htmlContent,
        orientation: Print.Orientation.landscape
      });
      
      console.log('✅ Admin - Print dialog opened successfully');
    } catch (error) {
      console.error('❌ Admin - Print error:', error);
      Alert.alert('Print Error', 'Failed to print receipt. Please try again.');
    }
  };

  // Handle share receipt with landscape orientation (copied from student)
  const handleShareReceipt = async (receiptData) => {
    try {
      const htmlContent = await generateReceiptHTML(receiptData);
      
      // Generate PDF with landscape orientation
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        orientation: Print.Orientation.landscape
      });

      const receiptNumber = receiptData.receipt_no || receiptData.receipt_number || 'N_A';
      const fileName = `receipt_${String(receiptNumber).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      // Try Android-specific download, fallback to sharing (copied from student)
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
        } catch (error) {
          console.error('Android download error, falling back to sharing:', error);
          // Fallback to sharing if Android-specific method fails
          try {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Share Receipt',
              UTI: 'com.adobe.pdf'
            });
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

  // Submit payment record
  const handlePaymentSubmit = async () => {
    // 🛡️ ENHANCED VALIDATION WITH OVERPAYMENT PREVENTION
    if (!selectedStudent || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount greater than ₹0.');
      return;
    }

    if (!selectedFeeComponent) {
      Alert.alert('Validation Error', 'Please select a fee component.');
      return;
    }

    // 🚨 ENHANCED OVERPAYMENT VALIDATION LOGIC - WITH CONCESSION SUPPORT
    if (selectedFeeComponent !== 'custom') {
      const selectedComponent = feeComponents.find(c => c.fee_component === selectedFeeComponent);
      if (selectedComponent) {
        const paidForThisComponent = selectedStudent.payments
          .filter(payment => payment.fee_component === selectedFeeComponent)
          .reduce((sum, payment) => sum + (parseFloat(payment.amount_paid) || 0), 0);
        
        // 🎯 APPLY CONCESSIONS to validation: Calculate component amount after discounts
        // Get concessions that apply to this specific fee component
        const componentConcessions = concessionsData.filter(c => 
          c.student_id === selectedStudent.id && 
          (c.fee_component === selectedComponent.fee_component || c.fee_component === 'all')
        );
        
        // Calculate total discount for this component
        const componentDiscount = componentConcessions.reduce((sum, concession) => {
          if (concession.discount_type === 'fixed_amount') {
            return sum + (parseFloat(concession.discount_value) || 0);
          } else if (concession.discount_type === 'percentage') {
            // Apply percentage to this component's base fee
            return sum + (selectedComponent.amount * (parseFloat(concession.discount_value) || 0) / 100);
          }
          return sum;
        }, 0);
        
        // Adjusted component amount after concessions
        const adjustedComponentAmount = Math.max(0, selectedComponent.amount - componentDiscount);
        
        const remainingForComponent = Math.max(0, adjustedComponentAmount - paidForThisComponent);
        const paymentAmountFloat = parseFloat(paymentAmount);
        
        // 🚨 PREVENT OVERPAYMENT WITH WARNING POPUP
        // Allow payments even when there's no outstanding amount (for additional payments)
        if (paymentAmountFloat > remainingForComponent && remainingForComponent > 0) {
          Alert.alert(
            'Payment Failed', 
            `Payment amount cannot exceed outstanding balance of ₹${remainingForComponent.toFixed(2)}

Entered: ₹${paymentAmountFloat.toFixed(2)}
Outstanding: ₹${remainingForComponent.toFixed(2)}

This prevents duplicate or overpayments to maintain fee accuracy.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        // 📊 Additional validation: Check if payment would result in negative outstanding
        // Only show warning if there was originally an outstanding amount
        const studentOutstanding = selectedStudent.outstanding || 0;
        if (paymentAmountFloat > studentOutstanding && studentOutstanding > 0) {
          Alert.alert(
            'Payment Amount Check',
            `Payment amount (₹${paymentAmountFloat.toFixed(2)}) is higher than student's total outstanding amount (₹${studentOutstanding.toFixed(2)}).\n\nDo you want to proceed with this payment?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Proceed Anyway', style: 'default', onPress: () => proceedWithPayment() }
            ]
          );
          return;
        }
      }
    }

    // If all validations pass, proceed with payment
    await proceedWithPayment();
  };

  // 🚀 SEPARATE FUNCTION FOR ACTUAL PAYMENT PROCESSING
  const proceedWithPayment = async () => {
    try {
      // 🔒 DISABLE BUTTON IMMEDIATELY TO PREVENT DOUBLE SUBMISSION
      if (paymentLoading) {
        console.warn('⚠️ Payment already in progress, ignoring duplicate submission');
        return;
      }
      
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
          tenant_id: user?.tenant_id, // ✅ TENANT ISOLATION
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
      
      // 🎯 MOBILE EXACT MATCH: Close payment modal first, then auto-show receipt
      setPaymentModal(false);
      setReceiptModal(true);
      
      // Show success alert while receipt is displayed
      Alert.alert(
        'Payment Recorded Successfully! ✅',
        `Payment of ₹${parseFloat(paymentAmount).toFixed(2)} has been recorded for ${selectedStudent.name}.\n\nReceipt Number: ${receiptNumber}\nFee Component: ${feeComponentName}\nPayment Mode: ${paymentMode}`
      );
      
      // Refresh the data to show updated payment status
      await loadClassStudentDetails();
      
      // 🚀 DYNAMIC UPDATE: Force UI refresh by updating state
      console.log('🔄 Payment successful - triggering dynamic UI update...');
      
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert(
        'Payment Failed',
        `Failed to record payment: ${error.message}\n\nPlease try again or contact support.`,
        [
          {
            text: 'Try Again',
            onPress: () => {
              // Keep modal open for retry
            }
          },
          {
            text: 'Close',
            style: 'cancel',
            onPress: () => {
              setPaymentModal(false);
            }
          }
        ]
      );
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
            student.paymentStatus === 'Free' ? '#2196F3' :
            student.paymentStatus === 'Concession' ? '#9C27B0' :
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
              student.paymentStatus === 'Free' ? '#2196F3' :
              student.paymentStatus === 'Concession' ? '#9C27B0' :
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



      {/* Action Buttons */}
      {(student.outstanding > 0 || student.totalConcessions > 0 || student.totalFeeStructure > 0) && (
        <View style={styles.actionButtonsContainer}>
          {/* Pay Button - Always show if there are fees to manage */}
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

          {/* Fee Concession Button - Always show if there are fees to manage */}
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
              {student.totalConcessions > 0 ? 'Manage Concessions' : 'Fee Concession'}
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
        {/* Tab Content */}
        {activeTab === 'students' ? (
          // 📱 Use the same working logic for both web and mobile
          filteredStudents.length === 0 ? (
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
              scrollEventThrottle={1}
              onScroll={handleScroll}
            >
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
                      { key: 'admission', label: 'Admission No.' },
                      { key: 'name', label: 'Name' },
                      { key: 'outstanding', label: 'Outstanding' }
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

              {/* Empty State */}
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
            </ScrollView>
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
              onScroll={handleScroll}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListHeaderComponent={
                <View style={styles.listHeaderContainer}>
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
                          { key: 'admission', label: 'Admission No.' },
                          { key: 'name', label: 'Name' },
                          { key: 'outstanding', label: 'Outstanding' }
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
                </View>
              }
              contentContainerStyle={styles.studentFlatListContent}
            />
          )
        ) : (
          <ScrollView 
            ref={reportsScrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            scrollEventThrottle={1}
            onScroll={handleScroll}
          >
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
          </ScrollView>
        )}
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
                  
                  {/* 🎯 STEP 1: Fee Component Selection (Moved to TOP) */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fee Component *</Text>
                    <Text style={styles.inputHelperText}>Select the fee component first, then the amount will be auto-populated</Text>
                    {feeComponents.length > 0 ? (
                      <View style={styles.feeComponentVerticalContainer}>
                        {feeComponents.map((component, index) => {
                          // Calculate remaining amount for this specific component
                          const paidForThisComponent = selectedStudent.payments
                            .filter(payment => payment.fee_component === component.fee_component)
                            .reduce((sum, payment) => sum + (parseFloat(payment.amount_paid) || 0), 0);
                          
                          // 🎯 APPLY CONCESSIONS: Calculate component amount after discounts
                          // Get concessions that apply to this specific fee component
                          const componentConcessions = concessionsData.filter(c => 
                            c.student_id === selectedStudent.id && 
                            (c.fee_component === component.fee_component || c.fee_component === 'all')
                          );
                          
                          // Calculate total discount for this component
                          const componentDiscount = componentConcessions.reduce((sum, concession) => {
                            if (concession.discount_type === 'fixed_amount') {
                              return sum + (parseFloat(concession.discount_value) || 0);
                            } else if (concession.discount_type === 'percentage') {
                              // Apply percentage to this component's base fee
                              return sum + (component.amount * (parseFloat(concession.discount_value) || 0) / 100);
                            }
                            return sum;
                          }, 0);
                          
                          // Adjusted component amount after concessions
                          const adjustedComponentAmount = Math.max(0, component.amount - componentDiscount);
                          
                          const remainingForComponent = Math.max(0, adjustedComponentAmount - paidForThisComponent);
                          
                          return (
                            <TouchableOpacity
                              key={index}
                              style={[
                                styles.feeComponentChipVertical,
                                selectedFeeComponent === component.fee_component && styles.activeFeeComponentChip,
                                remainingForComponent === 0 && styles.fullyPaidFeeChip
                              ]}
                              onPress={() => {
                                setSelectedFeeComponent(component.fee_component);
                                // ✅ AUTO-POPULATE the payment amount with the remaining outstanding amount (after concessions)
                                // Allow setting payment amount even when fully paid (for additional payments)
                                // If fully paid, default to 0 but allow user to change
                                setPaymentAmount(remainingForComponent.toString());
                                setPaymentRemarks(`Payment for ${component.fee_component}`);
                              }}
                              // Allow selecting components even when fully paid (for additional payments)
                              disabled={false}
                            >
                              {/* Left side: Fee component name and status */}
                              <View style={styles.feeChipLeft}>
                                <Text style={[
                                  styles.feeComponentChipText,
                                  selectedFeeComponent === component.fee_component && styles.activeFeeComponentChipText,
                                  remainingForComponent === 0 && styles.fullyPaidFeeChipText
                                ]}>
                                  {component.fee_component}
                                  {remainingForComponent === 0 && ' ✓'}
                                </Text>
                                {componentDiscount > 0 && (
                                  <Text style={[
                                    styles.concessionIndicatorText,
                                    selectedFeeComponent === component.fee_component && styles.activeConcessionIndicator
                                  ]}>
                                    💰 Concession Applied
                                  </Text>
                                )}
                              </View>
                              
                              {/* Right side: Amount information */}
                              <View style={styles.feeChipRight}>
                                {remainingForComponent === 0 ? (
                                  <Text style={[
                                    styles.fullyPaidText,
                                    selectedFeeComponent === component.fee_component && { color: '#fff' }
                                  ]}>Fully Paid ✓</Text>
                                ) : (
                                  <>
                                    <Text style={[
                                      styles.remainingAmountTextVertical,
                                      selectedFeeComponent === component.fee_component && styles.activeRemainingAmountText
                                    ]}>
                                      {formatSafeCurrency(remainingForComponent)}
                                    </Text>
                                    <Text style={[
                                      styles.totalAmountTextVertical,
                                      selectedFeeComponent === component.fee_component && styles.activeTotalAmountText
                                    ]}>
                                      {componentDiscount > 0 ? (
                                        formatSafeCurrency(component.amount)
                                      ) : (
                                        'remaining'
                                      )}
                                    </Text>
                                  </>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        {/* Custom/Other option */}
                        <TouchableOpacity
                          style={[
                            styles.feeComponentChipVertical,
                            styles.customFeeChip,
                            selectedFeeComponent === 'custom' && styles.activeFeeComponentChip
                          ]}
                          onPress={() => {
                            setSelectedFeeComponent('custom');
                            setPaymentRemarks('Custom payment');
                          }}
                        >
                          <View style={styles.feeChipLeft}>
                            <Text style={[
                              styles.feeComponentChipText,
                              styles.customFeeChipText,
                              selectedFeeComponent === 'custom' && styles.activeFeeComponentChipText
                            ]}>
                              Other / Custom
                            </Text>
                            <Text style={[
                              styles.concessionIndicatorText,
                              selectedFeeComponent === 'custom' && styles.activeConcessionIndicator
                            ]}>
                              📝 Custom Amount
                            </Text>
                          </View>
                          <View style={styles.feeChipRight}>
                            <Text style={[
                              styles.totalAmountTextVertical,
                              selectedFeeComponent === 'custom' && styles.activeTotalAmountText
                            ]}>
                              Enter manually
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
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

                  {/* 🎯 STEP 2: Payment Amount (LOCKED until fee component selected) */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Amount (₹) *</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        !selectedFeeComponent && styles.textInputDisabled // ✅ DISABLED STYLING
                      ]}
                      placeholder="Select a fee component first..."
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#999"
                      editable={!!selectedFeeComponent} // ✅ LOCK INPUT until component selected
                    />
                    {!selectedFeeComponent && (
                      <Text style={styles.inputHelperText}>Please select a fee component above to enable payment amount entry</Text>
                    )}
                  </View>

                  {/* 🎯 STEP 3: Payment Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Date *</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateInputText}>
                        {formatDateForDisplay(paymentDate)}
                      </Text>
                      <Ionicons name="calendar" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* 🎯 STEP 4: Payment Mode (Button Style with Colors) */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Mode *</Text>
                    <View style={styles.paymentModeContainer}>
                      {['Cash', 'UPI'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.paymentModeChip,
                            paymentMode === mode && styles.activePaymentModeChip
                          ]}
                          onPress={() => setPaymentMode(mode)}
                          activeOpacity={0.8}
                        >
                          <Text style={[
                            styles.paymentModeChipText,
                            paymentMode === mode && styles.activePaymentModeChipText
                          ]}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    {/* 🎯 UPI QR Code Generation Button */}
                    {paymentMode === 'UPI' && selectedFeeComponent && paymentAmount && (
                      <TouchableOpacity
                        style={styles.upiQRButton}
                        onPress={() => handleUPIPayment()}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="qr-code" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.upiQRButtonText}>Generate QR Code</Text>
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

                  {/* Submit Button - Only show for Cash payments or if UPI is selected but QR not generated */}
                  {paymentMode !== 'UPI' && (
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        (paymentLoading || !selectedFeeComponent || !paymentAmount) && styles.submitButtonDisabled
                      ]}
                      onPress={handlePaymentSubmit}
                      disabled={paymentLoading || !selectedFeeComponent || !paymentAmount}
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
                          <Text style={styles.submitButtonText}>
                            {!selectedFeeComponent ? 'Select Fee Component' : !paymentAmount ? 'Enter Amount' : 'Record Payment'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  {/* UPI Payment Instructions */}
                  {paymentMode === 'UPI' && (
                    <View style={styles.upiInstructionsContainer}>
                      <Text style={styles.upiInstructionsTitle}>UPI Payment Instructions:</Text>
                      <Text style={styles.upiInstructionsText}>1. Enter the payment amount and select fee component</Text>
                      <Text style={styles.upiInstructionsText}>2. Click 'Generate QR Code' to create payment QR</Text>
                      <Text style={styles.upiInstructionsText}>3. Scan QR with any UPI app to complete payment</Text>
                      <Text style={styles.upiInstructionsText}>4. Payment will be recorded automatically after confirmation</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Receipt Modal - Clean Layout (copied from student, updated) */}
      <Modal
        visible={receiptModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setReceiptModal(false);
          // Navigate to fee management home screen after receipt closes
          navigation.navigate('FeeManagement');
        }}
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
              setReceiptModal(false);
              navigation.navigate('FeeManagement');
            }
          }}
        >
          <View style={styles.receiptModalContainer}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.receiptCloseButton} 
              onPress={() => {
                setReceiptModal(false);
                // Navigate to fee management home screen after receipt closes
                navigation.navigate('FeeManagement');
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            
            {lastPaymentRecord && (
              <ScrollView 
                style={styles.receiptScrollView}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.receiptDocument}>
                  {/* Header with Logo and School Name */}
                  <View style={styles.receiptDocumentHeader}>
                    <View style={styles.receiptLogoContainer}>
                      {schoolLogo ? (
                        <Image 
                          source={{ uri: schoolLogo }} 
                          style={styles.receiptLogoImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.receiptLogoPlaceholder}>
                          <Ionicons name="school" size={40} color="#2196F3" />
                        </View>
                      )}
                    </View>
                    <View style={styles.receiptSchoolInfo}>
                      <Text style={styles.receiptSchoolNameNew}>{schoolDetails?.name || 'School Name'}</Text>
                      <Text style={styles.receiptSchoolAddressNew}>{schoolDetails?.address || 'School Address'}</Text>
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
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.student_name}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Admission No:</Text>
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.student_admission_no}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Class:</Text>
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.class_name}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Fee Type:</Text>
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.fee_component}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Date:</Text>
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.payment_date_formatted}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Receipt No:</Text>
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.receipt_no}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Payment Mode:</Text>
                      <Text style={styles.receiptInfoValueNew}>{lastPaymentRecord.payment_mode}</Text>
                    </View>
                  </View>

                  {/* Separator Line Above Amount */}
                  <View style={styles.receiptAmountSeparatorLine} />
                  
                  {/* Amount Section */}
                  <View style={styles.receiptAmountSectionNew}>
                    <Text style={styles.receiptAmountLabelNew}>Amount Paid:</Text>
                    <Text style={styles.receiptAmountNew}>₹{lastPaymentRecord.amount_paid?.toLocaleString()}</Text>
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
                  lastPaymentRecord && handlePrintReceipt(lastPaymentRecord);
                }}
              >
                <Ionicons name="print" size={20} color="#fff" />
                <Text style={styles.receiptPrintButtonText}>Print</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.receiptDownloadButton} 
                onPress={() => {
                  lastPaymentRecord && handleShareReceipt(lastPaymentRecord);
                }}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.receiptDownloadButtonText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Preview Modal - Clean Layout (copied from student) */}
      <Modal
        visible={individualReceiptModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIndividualReceiptModal(false)}
      >
        <View 
          style={styles.receiptModalOverlay}
          onTouchStart={(e) => {
            touchStartX2Ref.current = e.nativeEvent.pageX;
          }}
          onTouchEnd={(e) => {
            const touchEndX = e.nativeEvent.pageX;
            const swipeDistance = touchEndX - touchStartX2Ref.current;
            
            // If swipe right distance is more than 100px, close modal
            if (swipeDistance > 100) {
              setIndividualReceiptModal(false);
            }
          }}
        >
          <View style={styles.receiptModalContainer}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.receiptCloseButton} 
              onPress={() => setIndividualReceiptModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            
            {selectedPaymentForReceipt && (
              <ScrollView 
                style={styles.receiptScrollView}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.receiptDocument}>
                  {/* Header with Logo and School Name */}
                  <View style={styles.receiptDocumentHeader}>
                    <View style={styles.receiptLogoContainer}>
                      {/* Enhanced Logo Loading using LogoDisplay component */}
                      <LogoDisplay 
                        logoUrl={schoolDetails?.logo_url}
                        size={60}
                        style={styles.receiptLogo}
                        fallbackIcon="school-outline"
                      />
                    </View>
                    <View style={styles.receiptSchoolInfo}>
                      <Text style={styles.receiptSchoolNameNew}>{schoolDetails?.name || 'School Name'}</Text>
                      <Text style={styles.receiptSchoolAddressNew}>{schoolDetails?.address || 'School Address'}</Text>
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
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.student_name}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Admission No:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.student_admission_no}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Class:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.class_name}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Fee Type:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.fee_component}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Date:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.payment_date_formatted}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Receipt No:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.receipt_no}</Text>
                    </View>
                    <View style={styles.receiptInfoRowNew}>
                      <Text style={styles.receiptInfoLabelNew}>Payment Mode:</Text>
                      <Text style={styles.receiptInfoValueNew}>{selectedPaymentForReceipt.payment_mode}</Text>
                    </View>
                  </View>

                  {/* Separator Line Above Amount */}
                  <View style={styles.receiptAmountSeparatorLine} />
                  
                  {/* Amount Section */}
                  <View style={styles.receiptAmountSectionNew}>
                    <Text style={styles.receiptAmountLabelNew}>Amount Paid:</Text>
                    <Text style={styles.receiptAmountNew}>₹{selectedPaymentForReceipt.amount_paid?.toLocaleString()}</Text>
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
                  selectedPaymentForReceipt && handlePrintReceipt(selectedPaymentForReceipt);
                }}
              >
                <Ionicons name="print" size={20} color="#fff" />
                <Text style={styles.receiptPrintButtonText}>Print</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.receiptDownloadButton} 
                onPress={() => {
                  selectedPaymentForReceipt && handleShareReceipt(selectedPaymentForReceipt);
                }}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.receiptDownloadButtonText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* UPI QR Modal */}
      {showUPIQRModal && upiTransactionData && (
        <UPIQRModal
          visible={showUPIQRModal}
          onClose={handleUPIModalClose}
          onSuccess={handleUPIPaymentSuccess}
          onFailure={handleUPIPaymentFailure}
          transactionData={upiTransactionData}
        />
      )}
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
  // UPI Payment Button
  upiPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
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
  upiPaymentButtonText: {
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
  // 🔧 NEW: Disabled Input Styling
  textInputDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#D0D0D0',
    color: '#999',
  },
  // 🔧 NEW: Payment Mode Container Styling
  paymentModeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  // 🔧 NEW: Input Helper Text Styling
  inputHelperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
  },
  // UPI Payment Note Styles
  upiPaymentNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
    textAlign: 'center',
  },
  // Compact Payment Summary Styles
  compactPaymentSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentSummaryText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  paymentSummaryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  // FlatList Styles
  studentFlatList: {
    flex: 1,
  },
  studentFlatListContent: {
    paddingBottom: 20,
  },
  // List Header Container
  listHeaderContainer: {
    paddingBottom: 8,
  },
  // Horizontal Scroll Content
  horizontalScrollContent: {
    paddingHorizontal: 4,
  },
  // Fee Component Scroll Container (OLD - Horizontal)
  feeComponentScrollContainer: {
    maxHeight: 150,
    marginVertical: 8,
  },
  // Fee Component Vertical Container (NEW - Mobile Friendly)
  feeComponentVerticalContainer: {
    marginVertical: 8,
  },
  // Fee Component Chip - Vertical Layout
  feeComponentChipVertical: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Fee Chip Left Side (Name and Status)
  feeChipLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  // Fee Chip Right Side (Amount)
  feeChipRight: {
    alignItems: 'flex-end',
  },
  // Concession Indicator Text
  concessionIndicatorText: {
    fontSize: 10,
    color: '#FF8F00',
    fontWeight: '600',
    marginTop: 2,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Remaining Amount Text - Vertical Layout
  remainingAmountTextVertical: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  // Total Amount Text - Vertical Layout
  totalAmountTextVertical: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
    marginTop: 2,
  },
  // Active (Selected) Amount Text Styles - White for blue background
  activeRemainingAmountText: {
    color: '#fff',
  },
  activeTotalAmountText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Active Concession Indicator - White on blue background
  activeConcessionIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
  },
  // UPI QR Button
  upiQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  upiQRButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // UPI Instructions Container
  upiInstructionsContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  upiInstructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  upiInstructionsText: {
    fontSize: 14,
    color: '#BF360C',
    marginBottom: 4,
    lineHeight: 20,
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
  
  // Receipt Modal Styles (fullscreen like student)
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
  receiptLogoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
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
  receiptSchoolAddressNew: {
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

export default ClassStudentDetails;
