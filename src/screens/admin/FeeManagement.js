import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import Header from '../../components/Header';
import { useNavigation } from '@react-navigation/native';
import CrossPlatformDatePicker from '../../components/CrossPlatformDatePicker';
import { Ionicons } from '@expo/vector-icons';
import { supabase, dbHelpers, TABLES, getUserTenantId } from '../../utils/supabase';
import { format, parseISO } from 'date-fns';
import { CrossPlatformPieChart, CrossPlatformBarChart } from '../../components/CrossPlatformChart';
import { formatCurrency } from '../../utils/helpers';
import { isValidDate, isReasonableDate, formatDateForDB, cleanDateForForm } from '../../utils/dateValidation';
import * as Animatable from 'react-native-animatable';
import { Picker } from '@react-native-picker/picker';
import { useTenant } from '../../contexts/TenantContext';
import { tenantDatabase, getCachedTenantId, initializeTenantHelpers } from '../../utils/tenantHelpers';
import { calculateStudentFees } from '../../utils/feeCalculation';
import FeeService from '../../services/FeeService';
import { useAuth } from '../../utils/AuthContext';
import { FeeManagementOptimizer, loadFeeDataInBackground } from '../../utils/feeManagementOptimizations';
import FeatureGuard from '../../components/FeatureGuard';
import ExportModal from '../../components/ExportModal';
import { 
  getOptimizedFeeManagementData, 
  calculateOptimizedClassPaymentStats, 
  getRecentPayments, 
  getOrganizedFeeStructures
} from '../../utils/optimizedFeeHelpers';
import { 
  sortFeeStructuresByClass, 
  sortClassStatsByClass,
  sortClassesNaturally
} from '../../utils/classSortingUtils';
import { exportStudentFeeSummaryAdvanced, exportTableDataPDF, EXPORT_FORMATS, exportStudentFeeSummaryExcelMultiSheet } from '../../utils/exportUtils';


const FeeManagement = () => {
  const navigation = useNavigation();
  const { 
    tenantId, 
    isReady, 
    loading: tenantLoading, 
    currentTenant: tenant, 
    tenantName, 
    error: tenantError,
    initializeTenant: initializeTenantContext
  } = useTenant();
  const { user } = useAuth();
  
  const [tab, setTab] = useState('structure');
  const [classes, setClasses] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [classPaymentStats, setClassPaymentStats] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({
    totalCollected: 0,
    totalDue: 0,
    totalOutstanding: 0,
    collectionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feeModal, setFeeModal] = useState({ 
    visible: false, 
    classId: '', 
    fee: { 
      id: '', 
      type: '', 
      amount: '', 
      dueDate: '', 
      description: '' 
    } 
  });
  const [editFeeId, setEditFeeId] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [feeStructureModal, setFeeStructureModal] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState([]); // Changed to array
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedFee, setSelectedFee] = useState(null);
  const [newFeeStructure, setNewFeeStructure] = useState({
    type: '',
    amount: '',
    dueDate: null,
    academicYear: '2024-25'
  });
  const [feeStats, setFeeStats] = useState({ 
    totalDue: 0, 
    totalPaid: 0, 
    pendingStudents: 0 
  });
  const [optimizedData, setOptimizedData] = useState(null);
  const [showExportModalFM, setShowExportModalFM] = useState(false);
  const [useOptimizedQueries, setUseOptimizedQueries] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ step: 0, message: '' });
  
  
  // UPI Payment Verification state
  const [pendingUPIPayments, setPendingUPIPayments] = useState([]);
  const [upiLoading, setUpiLoading] = useState(false);
  
  // Enhanced tenant system - simplified validation
  const checkTenantReady = () => {
    return isReady && !tenantLoading && !tenantError && tenantId;
  };
  
  // Enhanced tenant system handles initialization automatically
  React.useEffect(() => {
    if (tenantId && isReady) {
      console.log('🚀 FeeManagement: Enhanced tenant system ready with ID:', tenantId);
      // Initialize tenant helpers to ensure cache is set
      initializeTenantHelpers(tenantId);
    } else {
      console.log('⚠️ FeeManagement: Waiting for tenant context to be ready:', {
        tenantId: tenantId || 'NULL',
        isReady,
        tenantLoading,
        tenantError: tenantError?.message || 'none'
      });
    }
  }, [tenantId, isReady, tenantLoading, tenantError]);
  
  // Enhanced tenant system handles initialization automatically - no manual init needed

  // Add safe date formatting function at the top
  const formatSafeDate = (dateValue) => {
    console.log('formatSafeDate input:', dateValue, typeof dateValue); // Debug log
    
    if (!dateValue) return 'No date selected';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  // Safe currency formatting
  const formatSafeCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '₹0';
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  // Helper to resolve a robust tenantId (prefers live auth on mobile)
  const getEffectiveTenantId = async () => {
    try {
      if (Platform.OS !== 'web') {
        const resolved = await getUserTenantId();
        if (resolved) return resolved;
      }
    } catch (e) {
      console.warn('FeeManagement: getEffectiveTenantId fallback to context tenantId due to error:', e?.message);
    }
    return tenantId;
  };

  // Helper function to calculate total fees for a student
  // 🚀 OPTIMIZED fee statistics calculation - Lightning fast
  const calculateFeeStats = async () => {
    if (!checkTenantReady()) {
      console.error('❌ FeeManagement calculateFeeStats: Tenant context not ready');
      setFeeStats({ totalDue: 0, totalPaid: 0, pendingStudents: 0 });
      return;
    }

    try {
      const tId = await getEffectiveTenantId();
      console.log('🔍 FeeManagement: Calculating fee stats (OPTIMIZED) for tenant:', tId);
      
      // 🚀 ULTRA-FAST: Single query with aggregation
      const { data: statsData, error: statsError } = await supabase
        .from('fee_structure')
        .select('amount')
        .eq('tenant_id', tId);
      
      if (statsError) throw statsError;
      
      // 🚀 ULTRA-FAST: Single query for payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('student_fees')
        .select('amount_paid, student_id')
        .eq('tenant_id', tId);
      
      if (paymentsError) throw paymentsError;
      
      // 🚀 ULTRA-FAST: Single query for student count
      const { count: studentCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tId);
      
      if (studentsError) throw studentsError;
      
      
      // ⚡ Lightning-fast in-memory calculations
      const totalDue = (statsData || []).reduce((sum, fee) => sum + Number(fee.amount), 0);
      const totalPaid = (paymentsData || []).reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
      
      // 🚀 ULTRA-FAST: Single query for student count
      // Fast set-based calculation for pending students
      const studentsWithPayments = new Set((paymentsData || []).map(fee => fee.student_id));
      const pendingStudents = (studentCount || 0) - studentsWithPayments.size;
      console.log('FeeManagement - OPTIMIZED Fee Stats - Total Paid Amount:', totalPaid);
      setFeeStats({ totalDue, totalPaid, pendingStudents });
      
    } catch (error) {
      console.error('FeeManagement - Error calculating fee statistics:', error);
      setFeeStats({ totalDue: 0, totalPaid: 0, pendingStudents: 0 });
    }
  };

  // 🔥 OPTIMIZED: Get pending fees using ultra-fast lookup
  const getPendingFees = async (studentId, classId) => {
    if (!checkTenantReady()) {
      console.error('❌ FeeManagement getPendingFees: Tenant context not ready');
      return [];
    }

    try {
      // 🚀 Use centralized fee calculation for consistency
      const feeCalc = await calculateStudentFees(studentId, classId);
      if (feeCalc && feeCalc.details) {
        return feeCalc.details.filter(fee => fee.status === 'pending' || fee.outstandingAmount > 0);
      }
      return [];
    } catch (error) {
      console.error('Error getting pending fees:', error);
      return [];
    }
  };

  // 🔥 This function has been replaced by ultra-fast in-memory processing
  // See processUltraFastData() and processOptimizedData() functions above
  // Kept as placeholder to maintain code structure

  // 🚀 ULTRA-FAST refresh with intelligent cache management
  const refreshWithCacheClear = async () => {
    if (checkTenantReady()) {
      console.log('🔄 FeeManagement: Ultra-fast refresh with smart cache management');
      
      // Intelligent cache clearing - only clear relevant caches
      setOptimizedData(null);
      setUseOptimizedQueries(true);
      isLoadingRef.current = false;
      
      // Pre-emptively update loading state for better UX
      setRefreshing(true);
      
      // Use the ultra-fast loading method directly
      try {
        await loadAllDataUltraFast();
      } catch (error) {
        console.error('❌ Ultra-fast refresh failed:', error);
        await loadAllDataOptimized();
      } finally {
        setRefreshing(false);
      }
    }
  };

  // Debounced refresh helper to coalesce rapid refreshes
  const debouncedRefreshRef = useRef(null);
  const debouncedRefreshWithCacheClear = () => {
    try {
      if (debouncedRefreshRef.current) {
        clearTimeout(debouncedRefreshRef.current);
      }
      debouncedRefreshRef.current = setTimeout(() => {
        // Fire and forget; underlying function handles loading states
        refreshWithCacheClear();
      }, 400);
    } catch (e) {
      // Fallback to immediate refresh if something goes wrong
      refreshWithCacheClear();
    }
  };
  
  
  // Load data when enhanced tenant system is ready (once)
  const hasInitiallyLoaded = useRef(false);
  useEffect(() => {
    if (checkTenantReady() && !hasInitiallyLoaded.current) {
      console.log('🚀 FeeManagement: Enhanced tenant system ready, loading data...');
      // Ensure tenant helpers are initialized
      initializeTenantHelpers(tenantId);
      hasInitiallyLoaded.current = true;
      loadAllData();
    }
  }, [tenantId, isReady, tenantLoading, tenantError]);


  // Remove the tab change effect as it's causing continuous refreshing
  // The useFocusEffect and pull-to-refresh should be sufficient for real-time updates

  // Real-time subscription for student_fees
  const paymentsChannelRef = useRef(null);
  useEffect(() => {
    let channel;
    let cancelled = false;

    const setupRealtime = async () => {
      try {
        if (!checkTenantReady()) return;
        const tId = await getEffectiveTenantId();
        if (!tId) return;

        // Cleanup any existing channel before creating a new one
        if (paymentsChannelRef.current) {
          try { supabase.removeChannel(paymentsChannelRef.current); } catch (e) {}
          paymentsChannelRef.current = null;
        }

        channel = supabase
          .channel(`student_fees-tenant-${tId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'student_fees', filter: `tenant_id=eq.${tId}` },
            (payload) => {
              try {
                const { eventType, new: newRow, old: oldRow } = payload;
                if (eventType === 'INSERT' && newRow) {
                  const studentMeta = students.find(s => s.id === newRow.student_id);
                  const studentName = studentMeta?.name || 'Unknown Student';
                  const studentClassId = studentMeta?.class_id;
                  const enriched = {
                    ...newRow,
                    students: { full_name: studentName }
                  };
                  // Determine if student had payments before (approximate with current state)
                  const hadPaymentsBefore = (payments || []).some(p => p.student_id === newRow.student_id);
                  // Remove matching optimistic temp entries and prepend
                  setPayments(prev => {
                    const next = (prev || []).filter(p => {
                      const isTemp = String(p.id || '').startsWith('temp-');
                      return !(isTemp && p.student_id === newRow.student_id && Number(p.amount_paid) === Number(newRow.amount_paid) && p.payment_date === newRow.payment_date);
                    });
                    return [enriched, ...next];
                  });
                  setPaymentSummary(prev => ({
                    ...prev,
                    totalCollected: (prev?.totalCollected || 0) + Number(newRow.amount_paid || 0),
                    totalOutstanding: Math.max(0, (prev?.totalOutstanding || 0) - Number(newRow.amount_paid || 0))
                  }));
                  // Incrementally update class-wise stats
                  if (studentClassId) {
                    const delta = Number(newRow.amount_paid || 0);
                    setClassPaymentStats(prev => (prev || []).map(cls => {
                      if (cls.classId !== studentClassId) return cls;
                      const updatedTotalPaid = (cls.totalPaid || 0) + delta;
                      const updatedOutstanding = Math.max(0, (cls.totalExpectedFees || 0) - updatedTotalPaid);
                      const updatedCollectionRate = (cls.totalExpectedFees || 0) > 0
                        ? Math.round((updatedTotalPaid / cls.totalExpectedFees) * 10000) / 100
                        : 0;
                      return {
                        ...cls,
                        totalPaid: updatedTotalPaid,
                        outstanding: updatedOutstanding,
                        collectionRate: updatedCollectionRate,
                        studentsWithPayments: cls.studentsWithPayments + (hadPaymentsBefore ? 0 : 1),
                        studentsWithoutPayments: Math.max(0, cls.studentsWithoutPayments - (hadPaymentsBefore ? 0 : 1))
                      };
                    }));
                  }
                } else if (eventType === 'UPDATE' && newRow && oldRow) {
                  const delta = Number(newRow.amount_paid || 0) - Number(oldRow.amount_paid || 0);
                  const studentMeta = students.find(s => s.id === newRow.student_id);
                  const studentClassId = studentMeta?.class_id;
                  setPayments(prev => (prev || []).map(p => p.id === newRow.id ? { ...p, ...newRow, students: p.students } : p));
                  if (delta !== 0) {
                    setPaymentSummary(prev => ({
                      ...prev,
                      totalCollected: (prev?.totalCollected || 0) + delta,
                      totalOutstanding: Math.max(0, (prev?.totalOutstanding || 0) - delta)
                    }));
                    if (studentClassId) {
                      setClassPaymentStats(prev => (prev || []).map(cls => {
                        if (cls.classId !== studentClassId) return cls;
                        const updatedTotalPaid = (cls.totalPaid || 0) + delta;
                        const updatedOutstanding = Math.max(0, (cls.totalExpectedFees || 0) - updatedTotalPaid);
                        const updatedCollectionRate = (cls.totalExpectedFees || 0) > 0
                          ? Math.round((updatedTotalPaid / cls.totalExpectedFees) * 10000) / 100
                          : 0;
                        return {
                          ...cls,
                          totalPaid: updatedTotalPaid,
                          outstanding: updatedOutstanding,
                          collectionRate: updatedCollectionRate
                        };
                      }));
                    }
                  }
                } else if (eventType === 'DELETE' && oldRow) {
                  const hasOtherPayments = (payments || []).some(p => p.student_id === oldRow.student_id && p.id !== oldRow.id);
                  const studentMeta = students.find(s => s.id === oldRow.student_id);
                  const studentClassId = studentMeta?.class_id;
                  setPayments(prev => (prev || []).filter(p => p.id !== oldRow.id));
                  setPaymentSummary(prev => ({
                    ...prev,
                    totalCollected: Math.max(0, (prev?.totalCollected || 0) - Number(oldRow.amount_paid || 0)),
                    totalOutstanding: (prev?.totalOutstanding || 0) + Number(oldRow.amount_paid || 0)
                  }));
                  if (studentClassId) {
                    const delta = -Number(oldRow.amount_paid || 0);
                    setClassPaymentStats(prev => (prev || []).map(cls => {
                      if (cls.classId !== studentClassId) return cls;
                      const updatedTotalPaid = Math.max(0, (cls.totalPaid || 0) + delta);
                      const updatedOutstanding = Math.max(0, (cls.totalExpectedFees || 0) - updatedTotalPaid);
                      const updatedCollectionRate = (cls.totalExpectedFees || 0) > 0
                        ? Math.round((updatedTotalPaid / cls.totalExpectedFees) * 10000) / 100
                        : 0;
                      const lostPayer = !hasOtherPayments ? 1 : 0;
                      return {
                        ...cls,
                        totalPaid: updatedTotalPaid,
                        outstanding: updatedOutstanding,
                        collectionRate: updatedCollectionRate,
                        studentsWithPayments: Math.max(0, cls.studentsWithPayments - lostPayer),
                        studentsWithoutPayments: cls.studentsWithoutPayments + lostPayer
                      };
                    }));
                  }
                }
              } catch (e) {
                console.warn('Realtime payments handler error:', e?.message);
              }
            }
          )
          .subscribe();

        paymentsChannelRef.current = channel;
      } catch (e) {
        console.warn('Failed to setup realtime payments subscription:', e?.message);
      }
    };

    setupRealtime();

    return () => {
      cancelled = true;
      if (paymentsChannelRef.current) {
        try { supabase.removeChannel(paymentsChannelRef.current); } catch (e) {}
        paymentsChannelRef.current = null;
      }
      if (channel) {
        try { supabase.removeChannel(channel); } catch (e) {}
      }
    };
  }, [tenantId, isReady]);

  const isLoadingRef = useRef(false);
  const loadAllData = async () => {
    if (!checkTenantReady() || isLoadingRef.current) {
      console.log('⚠️ FeeManagement: Cannot load data - tenant not ready or already loading');
      return;
    }
    
    isLoadingRef.current = true;
    const startTime = performance.now();

    try {
      setLoading(true);
      setRefreshing(true);
      setLoadingProgress({ step: 1, message: 'Loading data...' });

      console.log('🚀 FeeManagement: Starting ULTRA-FAST batch loading...');
      
      // 🚀 ULTRA-FAST BATCH LOADING - Single Query with All Data
      const result = await loadAllDataUltraFast();
      
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ FeeManagement: ULTRA-FAST loading completed in ${loadTime}ms`);
      
      setLoadingProgress({ step: 4, message: 'Complete' });
      
      if (loadTime < 500) {
        console.log('🚀 EXCELLENT PERFORMANCE: Data loaded in under 500ms!');
      } else if (loadTime < 1000) {
        console.log('⚡ GOOD PERFORMANCE: Data loaded in under 1 second');
      } else {
        console.warn('⚠️ SLOW PERFORMANCE: Consider database optimization');
      }

    } catch (error) {
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.error(`❌ FeeManagement: Ultra-fast loading failed after ${loadTime}ms:`, error);
      
      try {
        console.log('🔄 Falling back to optimized loading...');
        await loadAllDataOptimized();
      } catch (fallbackError) {
        console.error('❌ FeeManagement: All loading methods failed:', fallbackError);
        Alert.alert('Error', `Failed to load fee data: ${fallbackError.message}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  // 🚀 ULTRA-FAST BATCH LOADING - Revolutionary Performance Optimization
  const loadAllDataUltraFast = async () => {
    console.log('⚡ Starting ULTRA-FAST batch loading with optimized parallel queries...');
    
    // 🔥 OPTIMIZED APPROACH: Use parallel queries instead of complex joins
    const batchStartTime = performance.now();

    const tId = await getEffectiveTenantId();
    if (!tId) {
      throw new Error('Tenant context not available for fee loading');
    }
    
    // Execute optimized parallel queries for maximum compatibility
    const [
      classesResult,
      studentsResult,
      feeStructuresResult,
      paymentsResult,
      studentDiscountsResult
    ] = await Promise.all([
      // Classes query
      supabase
        .from('classes')
        .select('id, class_name, section, academic_year')
        .eq('tenant_id', tId),
      
      // Students query  
      supabase
        .from('students')
        .select('id, name, admission_no, academic_year, class_id')
        .eq('tenant_id', tId),
      
      // Fee structures query with discount information
      supabase
        .from('fee_structure')
        .select('id, class_id, student_id, fee_component, amount, base_amount, due_date, academic_year, discount_applied')
        .eq('tenant_id', tId),
      
      // Payments query
      supabase
        .from('student_fees')
        .select('id, student_id, fee_component, amount_paid, payment_date, payment_mode, academic_year')
        .eq('tenant_id', tId)
        .order('payment_date', { ascending: false }),
      
      // Student discounts query
      supabase
        .from('student_discounts')
        .select('id, student_id, class_id, academic_year, discount_type, discount_value, fee_component, is_active')
        .eq('tenant_id', tId)
        .eq('is_active', true)
    ]);
    
    // Check for errors
    [classesResult, studentsResult, feeStructuresResult, paymentsResult, studentDiscountsResult].forEach((result, index) => {
      if (result.error) {
        const queryNames = ['classes', 'students', 'fee_structures', 'payments', 'student_discounts'];
        throw new Error(`${queryNames[index]} query failed: ${result.error.message}`);
      }
    });
    
    const batchEndTime = performance.now();
    console.log(`🚀 Database batch completed in ${Math.round(batchEndTime - batchStartTime)}ms`);
    
    // 🔥 IN-MEMORY PROCESSING: Lightning-fast data transformation
    const processingStartTime = performance.now();
    
    const processedData = processOptimizedData(
      classesResult.data || [], 
      feeStructuresResult.data || [],
      studentsResult.data || [],
      paymentsResult.data || [],
      studentDiscountsResult.data || []
    );
    
    const processingEndTime = performance.now();
    console.log(`⚡ In-memory processing completed in ${Math.round(processingEndTime - processingStartTime)}ms`);
    
    // 🎯 Set all state in single batch
    setClasses(processedData.classes);
    setFeeStructures(processedData.feeStructures);
    setStudents(processedData.students);
    setPayments(processedData.payments);
    setClassPaymentStats(processedData.classStats);
    setPaymentSummary(processedData.summary);
    setFeeStats(processedData.feeStats);
    
    console.log('✅ ULTRA-FAST loading complete - all data processed and set!');
    
    return processedData;
  };
  
  // 🔥 This function has been integrated into the optimized data processing
  // All ultra-fast processing is now handled by processOptimizedData() function
  
  // 🔄 Optimized fallback method (still faster than original)
  const loadAllDataOptimized = async () => {
    console.log('⚡ Using optimized parallel loading as fallback...');
    
    // Parallel data loading with optimized queries including discounts
    const [
      classesResult,
      feeStructuresResult,
      studentsResult,
      paymentsResult,
      studentDiscountsResult
    ] = await Promise.all([
      tenantDatabase.read('classes', {}, 'id, class_name, section, academic_year'),
      tenantDatabase.read('fee_structure', {}, 'id, class_id, student_id, fee_component, amount, base_amount, due_date, academic_year, discount_applied'),
      tenantDatabase.read('students', {}, 'id, name, class_id, admission_no, academic_year'),
      tenantDatabase.read('student_fees', {}, 'id, student_id, fee_component, amount_paid, payment_date, payment_mode, academic_year'),
      tenantDatabase.read('student_discounts', { is_active: true }, 'id, student_id, class_id, academic_year, discount_type, discount_value, fee_component, is_active')
    ]);

    // Check for errors
    [classesResult, feeStructuresResult, studentsResult, paymentsResult, studentDiscountsResult].forEach(result => {
      if (result.error) throw result.error;
    });

    const classesData = classesResult.data || [];
    const feeStructuresData = feeStructuresResult.data || [];
    const studentsData = studentsResult.data || [];
    const paymentsData = paymentsResult.data || [];
    const studentDiscountsData = studentDiscountsResult.data || [];

    // Fast in-memory processing with discount support
    const processedData = processOptimizedData(classesData, feeStructuresData, studentsData, paymentsData, studentDiscountsData);
    
    // Set all state
    setClasses(processedData.classes);
    setFeeStructures(processedData.feeStructures);
    setStudents(processedData.students);
    setPayments(processedData.payments);
    setClassPaymentStats(processedData.classStats);
    setPaymentSummary(processedData.summary);
    setFeeStats(processedData.feeStats);
    
    return processedData;
  };
  
  // Optimized data processor for fallback method
  const processOptimizedData = (classesData, feeStructuresData, studentsData, paymentsData, studentDiscountsData = []) => {
    console.log('🔍 Processing fee data with discount support...', {
      classes: classesData.length,
      feeStructures: feeStructuresData.length,
      students: studentsData.length,
      payments: paymentsData.length,
      discounts: studentDiscountsData.length
    });
    
    // Create efficient lookup maps
    const classLookup = new Map();
    const studentLookup = new Map();
    const paymentsByStudent = new Map();
    const feesByClass = new Map();
    const feesByStudent = new Map();
    const discountsByStudent = new Map();
    
    // Build lookup maps
    classesData.forEach(cls => classLookup.set(cls.id, cls));
    studentsData.forEach(student => studentLookup.set(student.id, student));
    
    paymentsData.forEach(payment => {
      if (!paymentsByStudent.has(payment.student_id)) {
        paymentsByStudent.set(payment.student_id, []);
      }
      paymentsByStudent.get(payment.student_id).push(payment);
    });
    
    // Process student discounts
    studentDiscountsData.forEach(discount => {
      if (!discountsByStudent.has(discount.student_id)) {
        discountsByStudent.set(discount.student_id, []);
      }
      discountsByStudent.get(discount.student_id).push(discount);
    });
    
    // Process fee structures - separate class fees from student-specific fees
    feeStructuresData.forEach(fee => {
      // Class-level fees (student_id is null)
      if (!fee.student_id) {
        if (!feesByClass.has(fee.class_id)) {
          feesByClass.set(fee.class_id, []);
        }
        feesByClass.get(fee.class_id).push(fee);
      } else {
        // Student-specific fees
        if (!feesByStudent.has(fee.student_id)) {
          feesByStudent.set(fee.student_id, []);
        }
        feesByStudent.get(fee.student_id).push(fee);
      }
    });
    
    // Helper function to calculate class-level fee for a student considering discounts
    // Note: Student-specific fees are handled separately to avoid double-counting
    const calculateStudentFeeAmount = (baseFee, studentId, feeComponent) => {
      let feeAmount = parseFloat(baseFee.amount || baseFee.base_amount || 0);
      
      // Apply student discounts to class-level fees
      const studentDiscounts = discountsByStudent.get(studentId) || [];
      const applicableDiscount = studentDiscounts.find(d => 
        !d.fee_component || d.fee_component === feeComponent
      );
      
      if (applicableDiscount) {
        if (applicableDiscount.discount_type === 'percentage') {
          const discountAmount = (feeAmount * parseFloat(applicableDiscount.discount_value)) / 100;
          feeAmount = Math.max(0, feeAmount - discountAmount);
          console.log(`💰 Applied ${applicableDiscount.discount_value}% discount for ${studentId}: ${feeComponent} = ₹${feeAmount}`);
        } else if (applicableDiscount.discount_type === 'fixed_amount') {
          feeAmount = Math.max(0, feeAmount - parseFloat(applicableDiscount.discount_value));
          console.log(`💰 Applied ₹${applicableDiscount.discount_value} discount for ${studentId}: ${feeComponent} = ₹${feeAmount}`);
        }
      } else {
        console.log(`💵 Class fee for ${studentId}: ${feeComponent} = ₹${feeAmount} (no discount)`);
      }
      
      return feeAmount;
    };
    
    // Process fee structures
    const feeStructures = [];
    for (const [classId, fees] of feesByClass) {
      const classData = classLookup.get(classId);
      if (classData) {
        feeStructures.push({
          classId,
          name: `${classData.class_name}${classData.section ? ` - ${classData.section}` : ''}`,
          fees: fees.map(fee => ({
            id: fee.id,
            type: fee.fee_component || 'Unknown Fee',
            amount: fee.amount || 0,
            due_date: fee.due_date,
            description: fee.fee_component || 'No description',
            academic_year: fee.academic_year || '2024-25'
          }))
        });
      }
    }
    
    // Process payments with student info
    const enrichedPayments = paymentsData.map(payment => {
      const student = studentLookup.get(payment.student_id);
      return {
        ...payment,
        students: { full_name: student?.name || 'Unknown Student' }
      };
    });
    
    // Calculate class stats efficiently with discount support
    const classStats = [];
    let totalCollected = 0;
    let totalDue = 0;
    let totalOutstanding = 0; // Will be calculated from totalDue - totalCollected for consistency
    
    console.log('📋 Starting class-wise fee calculation with discount support...');
    
    classesData.forEach(classData => {
      const studentsInClass = studentsData.filter(s => s.class_id === classData.id);
      const feeStructuresForClass = feesByClass.get(classData.id) || [];
      
      console.log(`📊 Processing class ${classData.class_name}${classData.section ? '-' + classData.section : ''}:`, {
        students: studentsInClass.length,
        feeComponents: feeStructuresForClass.length
      });
      
      let classExpectedFees = 0;
      let classPaidAmount = 0;
      let classStudentsWithPayments = 0;
      
      // Calculate expected fees per student considering individual discounts
      studentsInClass.forEach(student => {
        let studentExpectedFees = 0;
        const processedComponents = new Set(); // Track processed fee components to avoid double-counting
        
        // 🔥 FIXED: First process student-specific fees (highest priority)
        const studentSpecificFees = feesByStudent.get(student.id) || [];
        studentSpecificFees.forEach(fee => {
          if (fee.class_id === classData.id) { // Only fees for this class
            const feeAmount = parseFloat(fee.amount || fee.base_amount || 0);
            studentExpectedFees += feeAmount;
            processedComponents.add(fee.fee_component);
            console.log(`📦 Student-specific fee for ${student.name}: ${fee.fee_component} = ₹${feeAmount}`);
          }
        });
        
        // 🔥 FIXED: Then process class-level fees (only if not already processed as student-specific)
        feeStructuresForClass.forEach(fee => {
          if (!processedComponents.has(fee.fee_component)) {
            const studentFeeAmount = calculateStudentFeeAmount(fee, student.id, fee.fee_component);
            studentExpectedFees += studentFeeAmount;
            processedComponents.add(fee.fee_component);
          } else {
            console.log(`⚠️ Skipping class fee for ${student.name}: ${fee.fee_component} (student-specific fee exists)`);
          }
        });
        
        classExpectedFees += studentExpectedFees;
        
        // Calculate how much this student has paid
        const studentPayments = paymentsByStudent.get(student.id) || [];
        const studentTotalPaid = studentPayments.reduce((sum, p) => 
          sum + (parseFloat(p.amount_paid) || 0), 0);
        
        classPaidAmount += studentTotalPaid;
        if (studentTotalPaid > 0) classStudentsWithPayments++;
        
        console.log(`  Student ${student.name}: Expected=₹${studentExpectedFees}, Paid=₹${studentTotalPaid}`);
      });
      
      const classOutstanding = Math.max(0, classExpectedFees - classPaidAmount);
      const collectionRate = classExpectedFees > 0 ? 
        Math.round((classPaidAmount / classExpectedFees) * 10000) / 100 : 0;
      
      console.log(`  Class totals: Expected=₹${classExpectedFees}, Collected=₹${classPaidAmount}, Outstanding=₹${classOutstanding}`);
      
      // Calculate total fee per student for display (average)
      const avgFeePerStudent = studentsInClass.length > 0 ? classExpectedFees / studentsInClass.length : 0;
      
      classStats.push({
        classId: classData.id,
        className: `${classData.class_name}${classData.section ? ` - ${classData.section}` : ''}`,
        totalStudents: studentsInClass.length,
        totalExpectedFees: classExpectedFees,
        totalPaid: classPaidAmount,
        outstanding: classOutstanding,
        collectionRate,
        studentsWithPayments: classStudentsWithPayments,
        studentsWithoutPayments: studentsInClass.length - classStudentsWithPayments,
        feeStructureAmount: avgFeePerStudent // Updated to use average fee per student
      });
      
      totalDue += classExpectedFees;
      totalCollected += classPaidAmount;
      // Note: Don't add classOutstanding here - calculate total outstanding from totals
    });
    
    // ✅ FIXED: Calculate total outstanding from total due and total collected to ensure mathematical consistency
    totalOutstanding = Math.max(0, totalDue - totalCollected);
    
    console.log('🔧 Recalculated Outstanding for consistency:', {
      calculatedOutstanding: `₹${totalOutstanding}`,
      formula: `max(0, ${totalDue} - ${totalCollected})`
    });
    
    // Sort data
    classStats.sort((a, b) => b.outstanding - a.outstanding);
    feeStructures.sort((a, b) => a.name.localeCompare(b.name));
    
    const overallCollectionRate = totalDue > 0 ? 
      Math.round((totalCollected / totalDue) * 10000) / 100 : 0;
    
    console.log('✅ Fee calculation completed with discount support:', {
      totalDue: `₹${totalDue}`,
      totalCollected: `₹${totalCollected}`,
      totalOutstanding: `₹${totalOutstanding}`,
      collectionRate: `${overallCollectionRate}%`,
      classesProcessed: classStats.length
    });
    
    return {
      classes: classesData,
      students: studentsData.map(student => ({ ...student, full_name: student.name })),
      payments: enrichedPayments,
      feeStructures,
      classStats,
      summary: {
        totalCollected,
        totalDue,
        totalOutstanding,
        collectionRate: overallCollectionRate
      },
      feeStats: {
        totalDue,
        totalPaid: totalCollected,
        pendingStudents: studentsData.length - classStats.reduce((sum, cls) => sum + cls.studentsWithPayments, 0)
      }
    };
  };
  

  // Handle fee operations (add/edit)
  const handleFeeOperation = async (operation, feeData) => {
    if (!feeData || !feeData.type || !feeData.amount) {
      Alert.alert('Error', 'Missing required fee information');
      return;
    }

    // Validate due date
    const dueDate = operation === 'edit' ? feeData.dueDate : newFeeStructure.dueDate;
    if (!dueDate || !isValidDate(dueDate)) {
      Alert.alert('Error', 'Please select a valid due date');
      return;
    }

    try {
      setPaymentLoading(true);

      // Format the date properly before saving
      const formattedDueDate = formatDateForDB(dueDate);

      const feeRecord = {
        id: operation === 'edit' ? feeData.id : undefined,
        class_id: operation === 'edit' ? feeData.classId : selectedClassId,
        fee_component: operation === 'edit' ? feeData.type : newFeeStructure.type,
        amount: operation === 'edit' ? feeData.amount : newFeeStructure.amount,
        due_date: formattedDueDate,
        description: operation === 'edit' ? feeData.description : newFeeStructure.description
      };
      
      const { error } = operation === 'edit' 
        ? await tenantDatabase.update('fee_structure', { id: feeData.id }, feeRecord)
        : await tenantDatabase.create('fee_structure', feeRecord);

      if (error) throw error;

      await refreshWithCacheClear();
      if (operation === 'edit') {
        setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
        setEditFeeId(null);
        Alert.alert('Success', 'Fee updated successfully');
      } else {
        setFeeStructureModal(false);
        setNewFeeStructure({ type: '', amount: '', dueDate: '', description: '' });
        Alert.alert('Success', 'Fee added successfully');
      }

    } catch (error) {
      console.error('Error handling fee operation:', error);
      Alert.alert('Error', `${operation === 'edit' ? 'Failed to update fee' : 'Failed to add fee'}: ${error.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Handle edit fee
  const handleEditFee = async (classId, feeId, fee) => {
    if (!feeId || !fee.type || !fee.amount) {
      Alert.alert('Error', 'Missing required fee information');
      return;
    }

    // Validate due date
    if (!fee.dueDate || !isValidDate(fee.dueDate)) {
      Alert.alert('Error', 'Please select a valid due date');
      return;
    }

    try {
      setPaymentLoading(true);

      // Format the date properly before saving
      const formattedDueDate = formatDateForDB(fee.dueDate);

      const { error } = await tenantDatabase.update(
        'fee_structure',
        { id: feeId },
        {
          fee_component: fee.type,
          amount: fee.amount,
          due_date: fee.dueDate ? new Date(fee.dueDate).toISOString().split('T')[0] : null
        }
      );

      if (error) throw error;

      // Optimistic update of fee in local state
      setFeeStructures(prev => prev.map(cls => {
        if (cls.classId !== classId) return cls;
        return {
          ...cls,
          fees: (cls.fees || []).map(f => (
            f.id === feeId
              ? {
                  ...f,
                  type: fee.type,
                  amount: fee.amount,
                  due_date: fee.dueDate ? new Date(fee.dueDate).toISOString().split('T')[0] : null,
                  description: fee.description ?? f.description
                }
              : f
          ))
        };
      }));

      // Debounced background refresh
      debouncedRefreshWithCacheClear();
      setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
      setEditFeeId(null);
      Alert.alert('Success', 'Fee updated successfully');

    } catch (error) {
      console.error('Error updating fee:', error);
      Alert.alert('Error', 'Failed to update fee');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle payment
  const handlePayment = async (studentId, feeStructureId, amount) => {
    if (!studentId || !amount) {
      Alert.alert('Error', 'Missing required payment information');
      return;
    }

    // Validate payment date
    if (!isValidDate(paymentDate)) {
      Alert.alert('Error', 'Invalid payment date selected. Please select a valid date.');
      return;
    }
    
    try {
      setPaymentLoading(true);
      
      // Get the fee structure to know the details using enhanced tenant database
      const { data: feeStructureData, error: feeStructureError } = await tenantDatabase.read(
        'fee_structure',
        { id: feeStructureId },
        'amount, fee_component, academic_year'
      );
        
      if (feeStructureError) throw feeStructureError;
      
      const feeStructure = feeStructureData?.[0];
      if (!feeStructure) {
        throw new Error('Fee structure not found');
      }
      
      // First check if there's an existing record for this student and fee component
      const { data: existingFees, error: checkError } = await tenantDatabase.read(
        'student_fees',
        {
          student_id: studentId,
          fee_component: feeStructure.fee_component,
          academic_year: feeStructure.academic_year
        },
        'amount_paid'
      );
        
      if (checkError) {
        throw checkError;
      }
      
      const totalAmount = feeStructure.amount;
      const amountPaid = parseFloat(amount);
      
      // Calculate existing payments for this fee component
      const existingAmountPaid = existingFees?.reduce((sum, fee) => sum + Number(fee.amount_paid || 0), 0) || 0;
      const newTotalPaid = existingAmountPaid + amountPaid;
      
      let status = 'pending';
      if (newTotalPaid >= totalAmount) {
        status = 'paid';
      } else if (newTotalPaid > 0) {
        status = 'partial';
      }
      
      // Always create a new payment record (this represents a payment transaction)
      const { error: insertError } = await tenantDatabase.create('student_fees', {
        student_id: studentId,
        fee_component: feeStructure.fee_component,
        academic_year: feeStructure.academic_year,
        amount_paid: amountPaid,
        payment_date: paymentDate.toISOString().split('T')[0], // Date only
        payment_mode: 'Cash' // Default payment mode, can be made configurable
        // Note: status and tenant_id will be automatically handled by tenantDatabase
      });

      if (insertError) throw insertError;

      // Optimistic UI update: prepend new payment and update summary
      const optimisticPayment = {
        id: `temp-${Date.now()}`,
        student_id: studentId,
        fee_component: feeStructure.fee_component,
        amount_paid: amountPaid,
        payment_date: paymentDate.toISOString().split('T')[0], // Date only
        payment_mode: 'Cash',
        academic_year: feeStructure.academic_year,
        students: { full_name: selectedStudent?.name || (students.find(s => s.id === studentId)?.name) || 'Unknown Student' }
      };
      setPayments(prev => [optimisticPayment, ...(prev || [])]);
      setPaymentSummary(prev => ({
        ...prev,
        totalCollected: (prev?.totalCollected || 0) + amountPaid,
        totalOutstanding: Math.max(0, (prev?.totalOutstanding || 0) - amountPaid)
      }));

      // Debounced background refresh
      debouncedRefreshWithCacheClear();
      Alert.alert('Success', 'Payment recorded successfully');
      setPaymentModal(false);
      setSelectedStudent(null);
      setSelectedFee(null);
      setPaymentAmount('');
      setPaymentDate(new Date());

    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Error', `Failed to record payment: ${error.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Download per-student fee summary (CSV)
  // Build per-student rows for export
  const buildFMStudentSummaryRows = async () => {
    try {
      console.log('📥 FeeManagement Export: Building student rows...', {
        studentsTotal: students?.length || 0
      });
const results = await Promise.all(
        (students || []).map(async (s, idx) => {
          try {
            // Avoid passing 'quiet' flag if it triggers runtime issues in some environments
            const res = await FeeService.getStudentFeeDetails(s.id, { includePaymentHistory: false, includeFeeBreakdown: true });
            if (res.success && res.data) {
              const d = res.data;
              if (idx < 3) {
                console.log('📥 FeeManagement Export: Sample row', idx, {
                  student: d.student?.name,
                  class: d.student?.class_info?.name,
                  totalDue: d.fees?.totalDue,
                  totalPaid: d.fees?.totalPaid
                });
              }
              return {
                'Student Name': d.student?.name || s.name || s.full_name || 'N/A',
                'Admission No': d.student?.admission_no || s.admission_no || 'N/A',
                'Roll No': d.student?.roll_no || s.roll_no || 'N/A',
                'Class': d.student?.class_info ? `${d.student.class_info.name || ''} ${d.student.class_info.section || ''}`.trim() : 'N/A',
                'Academic Year': d.fees?.academicYear || s.academic_year || 'N/A',
                'Payment Status': d.fees?.status || 'N/A',
                'Total Fee (Base)': d.fees?.totalBaseFee ?? 0,
                'Fee Concession': d.fees?.totalDiscounts ?? 0,
                'Adjusted Fee': d.fees?.totalDue ?? d.fees?.totalAmount ?? 0,
                'Amount Paid': d.fees?.totalPaid ?? 0,
                'Outstanding Fee': d.fees?.totalOutstanding ?? 0,
              };
            } else {
              if (idx < 3) console.log('📥 FeeManagement Export: Skipping student (no data)', s?.id);
              // Build a minimal fallback row so export still proceeds
              return {
                'Student Name': s.name || s.full_name || 'N/A',
                'Admission No': s.admission_no || 'N/A',
                'Roll No': s.roll_no || 'N/A',
                'Class': s.className || s.class_name || 'N/A',
                'Academic Year': s.academic_year || 'N/A',
                'Payment Status': 'N/A',
                'Total Fee (Base)': 0,
                'Fee Concession': 0,
                'Adjusted Fee': 0,
                'Amount Paid': 0,
                'Outstanding Fee': 0,
              };
            }
          } catch (err) {
            console.warn('📥 FeeManagement Export: Error building row for', s?.id, err?.message);
            // Fallback row on error so we don't end up with zero rows
            return {
              'Student Name': s.name || s.full_name || 'N/A',
              'Admission No': s.admission_no || 'N/A',
              'Roll No': s.roll_no || 'N/A',
              'Class': s.className || s.class_name || 'N/A',
              'Academic Year': s.academic_year || 'N/A',
              'Payment Status': 'N/A',
              'Total Fee (Base)': 0,
              'Fee Concession': 0,
              'Adjusted Fee': 0,
              'Amount Paid': 0,
              'Outstanding Fee': 0,
            };
          }
        })
      );
      const rows = results.filter(Boolean);
      console.log('📥 FeeManagement Export: Built rows', { rowsCount: rows.length });
      return rows;
    } catch (e) {
      console.warn('📥 FeeManagement Export: Failed to build rows', e?.message);
      return [];
    }
  };

  const handleDownloadStudentSummary = async () => {
    console.log('📥 FeeManagement: Download button clicked (payments tab)');
    setShowExportModalFM(true);
  };

  const handleExportOptionFM = async (format) => {
    console.log('📥 FeeManagement Export: Export requested', { format });
    try {
      const rows = await buildFMStudentSummaryRows();
      console.log('📥 FeeManagement Export: Rows ready', { rows: rows.length });
      if (!rows || rows.length === 0) {
        console.warn('📥 FeeManagement Export: No rows to export');
        return false;
      }
      const base = 'fee_management_student_fee_summary';
      let ok = false;
if (format === EXPORT_FORMATS.CSV) {
        ok = await exportStudentFeeSummaryAdvanced(rows, base, EXPORT_FORMATS.CSV);
      } else if (format === EXPORT_FORMATS.CLIPBOARD) {
        ok = await exportStudentFeeSummaryAdvanced(rows, base, EXPORT_FORMATS.CLIPBOARD);
      } else if (format === EXPORT_FORMATS.PDF) {
        ok = await exportTableDataPDF(rows, 'Fee Management - Student Fee Summary', {
          Students: students?.length || 0,
          Generated: new Date().toLocaleString('en-IN')
        });
      } else if (format === EXPORT_FORMATS.EXCEL) {
        ok = await exportStudentFeeSummaryExcelMultiSheet(rows, base);
      }
      console.log('📥 FeeManagement Export: Export finished', { success: !!ok });
      return !!ok;
    } catch (e) {
      console.warn('📥 FeeManagement Export: Export failed', e?.message);
      return false;
    } finally {
      setShowExportModalFM(false);
    }
  };

  // Open fee modal
  const openFeeModal = (classId, fee = null) => {
    if (!classId) {
      Alert.alert('Error', 'Class ID is required');
      return;
    }
    
    if (fee) {
      // Edit existing fee
      setFeeModal({
        visible: true,
        classId,
        fee: {
          id: fee.id,
          type: fee.fee_component || fee.type || 'Unknown Fee',
          amount: (fee.amount || 0).toString(),
          dueDate: fee.due_date || null,
          description: fee.description || fee.fee_component || 'No description'
        }
      });
      setEditFeeId(fee.id);
    } else {
      // Add new fee
      setFeeModal({
        visible: true,
        classId,
        fee: { type: '', amount: '', dueDate: null, description: '' }
      });
      setEditFeeId(null);
    }
  };

  // Note: Using imported isValidDate from dateValidation utils

  // Handle delete structure
  const handleDeleteStructure = async (feeId) => {
    if (!feeId) {
      Alert.alert('Error', 'Invalid fee structure ID');
      return;
    }
    
    try {
      setPaymentLoading(true);
      
      // First get the fee structure details using enhanced tenant database
      const { data: feeStructure, error: feeError } = await tenantDatabase.read(
        'fee_structure',
        { id: feeId },
        'fee_component, academic_year'
      );
      
      if (feeError) throw feeError;
      
      const feeRecord = feeStructure?.[0];
      if (!feeRecord) {
        throw new Error('Fee structure not found');
      }
      
      // Check if there are any student fees associated with this fee component
      const { data: associatedFees, error: checkError } = await tenantDatabase.read(
        'student_fees',
        {
          fee_component: feeRecord.fee_component,
          academic_year: feeRecord.academic_year
        },
        'id'
      );
      
      if (checkError) throw checkError;
      
      if (associatedFees && associatedFees.length > 0) {
        Alert.alert(
          'Cannot Delete', 
          'This fee structure has associated student payments. Please remove those first.'
        );
        return;
      }
      
      // If no associated fees, proceed with deletion
      const { error } = await tenantDatabase.delete('fee_structure', { id: feeId });

      if (error) throw error;

      // Clear cache and refresh data
      await refreshWithCacheClear();
      Alert.alert('Success', 'Fee structure deleted successfully');

    } catch (error) {
      console.error('Error deleting fee structure:', error);
      Alert.alert('Error', 'Failed to delete fee structure');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Handle delete fee
  const handleDeleteFee = async (fee) => {
    if (!fee || !fee.id) {
      Alert.alert('Error', 'Invalid fee ID');
      return;
    }
    
    try {
      setPaymentLoading(true);

      // Fetch canonical fee structure fields to avoid mismatches
      const { data: fsData, error: fsError } = await tenantDatabase.read(
        'fee_structure',
        { id: fee.id },
        'fee_component, academic_year'
      );
      if (fsError) throw fsError;
      const fs = fsData?.[0];
      if (!fs) {
        throw new Error('Fee structure not found');
      }

      // Check if there are any student fees associated with this fee component and academic year
      const { data: associatedFees, error: checkError } = await tenantDatabase.read(
        'student_fees',
        {
          fee_component: fs.fee_component,
          academic_year: fs.academic_year
        },
        'id'
      );
      
      if (checkError) throw checkError;
      
      if (associatedFees && associatedFees.length > 0) {
        Alert.alert(
          'Cannot Delete', 
          'This fee has associated student payments. Please remove those first.'
        );
        return;
      }
      
      // If no associated fees, proceed with deletion
      const { error } = await tenantDatabase.delete('fee_structure', { id: fee.id });

      if (error) throw error;

      // Optimistic UI: remove fee locally
      setFeeStructures(prev => prev.map(cls => ({
        ...cls,
        fees: (cls.fees || []).filter(f => f.id !== fee.id)
      })));

      // Debounced background refresh
      debouncedRefreshWithCacheClear();
      Alert.alert('Success', 'Fee deleted successfully');

    } catch (error) {
      console.error('Error deleting fee:', error);
      Alert.alert('Error', 'Failed to delete fee');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle add fee structure
  const handleAddFeeStructure = async () => {
    // Validation
    if (selectedClassIds.length === 0) {
      Alert.alert('Error', 'Please select at least one class');
      return;
    }
    
    if (!newFeeStructure.type.trim()) {
      Alert.alert('Error', 'Please enter fee component');
      return;
    }
    
    if (!newFeeStructure.amount.trim() || isNaN(parseFloat(newFeeStructure.amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!newFeeStructure.dueDate) {
      Alert.alert('Error', 'Please select a due date');
      return;
    }

    if (!newFeeStructure.academicYear.trim()) {
      Alert.alert('Error', 'Please enter academic year');
      return;
    }

    // Validate the due date
    if (!isValidDate(newFeeStructure.dueDate)) {
      Alert.alert('Error', 'Please select a valid due date');
      return;
    }

    try {
      setPaymentLoading(true);
      
      // Create fee structure for each selected class using enhanced tenant database
      const amountValue = parseFloat(newFeeStructure.amount);
      const feeStructures = selectedClassIds.map(classId => ({
        class_id: classId,
        student_id: null, // ⚠️ CRITICAL: Explicitly set to null for class-level fees
        fee_component: newFeeStructure.type.trim(),
        amount: amountValue,
        base_amount: amountValue, // ✅ FIXED: Set base_amount equal to amount for class fees
        academic_year: newFeeStructure.academicYear.trim(),
        due_date: format(new Date(newFeeStructure.dueDate), 'yyyy-MM-dd')
      }));

      const { error } = await tenantDatabase.createMany('fee_structure', feeStructures);

      if (error) throw error;

      // Optimistic UI: append new fee(s) to selected classes locally
      setFeeStructures(prev => prev.map(cls => {
        if (!selectedClassIds.includes(cls.classId)) return cls;
        const newFee = {
          id: `temp-${cls.classId}-${Date.now()}`,
          type: newFeeStructure.type.trim(),
          amount: amountValue,
          due_date: format(new Date(newFeeStructure.dueDate), 'yyyy-MM-dd'),
          description: newFeeStructure.type.trim(),
          academic_year: newFeeStructure.academicYear.trim()
        };
        return { ...cls, fees: [ ...(cls.fees || []), newFee ] };
      }));

      // Debounced background refresh
      debouncedRefreshWithCacheClear();
      
      setFeeStructureModal(false);
      setSelectedClassIds([]);
      setNewFeeStructure({
        type: '',
        amount: '',
        dueDate: null,
        academicYear: '2024-25'
      });
      
      Alert.alert(
        'Success', 
        `Fee structure added successfully for ${selectedClassIds.length} class(es)!`
      );

    } catch (error) {
      console.error('Error adding fee structure:', error);
      Alert.alert('Error', 'Failed to add fee structure. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Fee Management" 
        showBack={true}
        rightIcon="pricetags-outline"
        rightIconOnPress={() => navigation.navigate('DiscountManagement')}
        rightIconTitle="Manage Discounts"
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          {loadingProgress.step > 0 && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{loadingProgress.message}</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(loadingProgress.step / 4) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressStepText}>
                Step {loadingProgress.step} of 4
              </Text>
              {loadingProgress.step === 1 && (
                <Text style={styles.performanceText}>
                  🚀 Using ULTRA-FAST batch loading...
                </Text>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, tab === 'structure' && styles.activeTab]}
              onPress={() => setTab('structure')}
            >
              <Text style={[styles.tabText, tab === 'structure' && styles.activeTabText]}>
                Fee Structure
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'payments' && styles.activeTab]}
              onPress={() => setTab('payments')}
            >
              <Text style={[styles.tabText, tab === 'payments' && styles.activeTabText]}>
                Payments
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'recent' && styles.activeTab]}
              onPress={() => setTab('recent')}
            >
              <Text style={[styles.tabText, tab === 'recent' && styles.activeTabText]}>
                Recent Payments
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'upi' && styles.activeTab]}
              onPress={() => {
                setTab('upi');
                // Navigate to UPI Payment Verification screen
                navigation.navigate('PendingUPIPayments');
              }}
            >
              <Text style={[styles.tabText, tab === 'upi' && styles.activeTabText]}>
                UPI Verification
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.scrollWrapper}>
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={refreshWithCacheClear}
                  title="Pull to refresh fee data"
                  tintColor="#1976d2"
                  colors={['#1976d2']}
                />
              }
              keyboardShouldPersistTaps="handled"
              bounces={Platform.OS !== 'web'}
            >
              {tab === 'structure' && (
              <View style={styles.structureContent}>
                {feeStructures.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="school-outline" size={48} color="#ccc" />
                    <Text style={styles.noDataText}>No fee structures found</Text>
                    <Text style={styles.emptySubtext}>
                      Use the + button below to create fee structures for your classes
                    </Text>
                  </View>
                ) : (
                  feeStructures.map((classData) => (
                    <View key={classData.classId} style={styles.classCard}>
                      {/* Class Header */}
                      <View style={styles.classHeader}>
                        <Text style={styles.className}>{classData.name}</Text>
                      </View>

                      {/* Fee Items */}
                      {classData.fees && classData.fees.length > 0 ? (
                        classData.fees.map((fee, index) => (
                          <TouchableOpacity 
                            key={fee.id || `fee-${classData.classId}-${index}`} 
                            style={styles.feeItemCard}
                            onPress={() => openFeeModal(classData.classId, fee)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.feeItemContent}>
                              <View style={styles.feeItemLeft}>
                                <Text style={styles.feeItemTitle}>
                                  {fee.type || fee.fee_component || 'Unknown Fee'}
                                </Text>
                                <View style={styles.feeAmountContainer}>
                                  <Text style={styles.feeBaseAmount}>Base: {formatSafeCurrency(fee.amount)}</Text>
                                  {/* TODO: Show discounted amount if different */}
                                </View>
                                <Text style={styles.feeItemDescription}>
                                  {fee.description || fee.fee_component || 'No description'}
                                </Text>
                                <View style={styles.feeItemDate}>
                                  <Ionicons name="calendar-outline" size={14} color="#1976d2" />
                                  <Text style={styles.feeItemDateText}>
                                    Due: {formatSafeDate(fee.due_date)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.feeItemActions}>
                                <TouchableOpacity 
                                  style={styles.feeActionButton}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFee(fee);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.emptyFeesContainer}>
                          <Text style={styles.emptyFeesText}>No fees configured for this class</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
                {/* Add bottom padding to ensure last card is fully visible */}
                <View style={styles.bottomSpacer} />
              </View>
              )}
              {tab === 'payments' && (
              <View style={styles.paymentsContent}>
                {/* Payment Summary Cards */}
                <View style={styles.paymentSummaryContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.sectionTitle}>Payment Overview</Text>
                    <TouchableOpacity onPress={handleDownloadStudentSummary} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#2196F3', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#E3F2FD' }}>
                      <Ionicons name="download" size={16} color="#2196F3" />
                      <Text style={{ marginLeft: 6, color: '#2196F3' }}>Download Student Summary (CSV)</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.summaryCardsRow}>
                    <View style={[styles.summaryCard, { backgroundColor: '#4CAF50' }]}>
                      <Text style={styles.summaryCardValue}>{formatSafeCurrency(paymentSummary.totalCollected)}</Text>
                      <Text style={styles.summaryCardLabel}>Total Collected</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#FF9800' }]}>
                      <Text style={styles.summaryCardValue}>{formatSafeCurrency(paymentSummary.totalOutstanding)}</Text>
                      <Text style={styles.summaryCardLabel}>Outstanding</Text>
                    </View>
                  </View>
                  <View style={styles.summaryCardsRow}>
                    <View style={[styles.summaryCard, { backgroundColor: '#2196F3' }]}>
                      <Text style={styles.summaryCardValue}>{paymentSummary.collectionRate}%</Text>
                      <Text style={styles.summaryCardLabel}>Collection Rate</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#9C27B0' }]}>
                      <Text style={styles.summaryCardValue}>{formatSafeCurrency(paymentSummary.totalDue)}</Text>
                      <Text style={styles.summaryCardLabel}>Total Due</Text>
                    </View>
                  </View>
                </View>


                {/* Class-wise Payment Statistics */}
                <View style={styles.classStatsContainer}>
                  <Text style={styles.sectionTitle}>Class-wise Payment Status</Text>
                  {classPaymentStats.length === 0 ? (
                    <Text style={styles.noDataText}>No payment data available</Text>
                  ) : (
                    sortClassStatsByClass(classPaymentStats).map((classData, index) => (
                      <TouchableOpacity
                        key={classData.classId}
                        style={styles.classStatCard}
                        onPress={() => {
                          navigation.navigate('ClassStudentDetails', { classData });
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.classStatHeader}>
                          <Text style={styles.classStatName}>{classData.className}</Text>
                          <View style={styles.classStatHeaderRight}>
                            <View style={[
                              styles.collectionRateBadge,
                              { backgroundColor: classData.collectionRate >= 80 ? '#4CAF50' :
                                classData.collectionRate >= 50 ? '#FF9800' : '#F44336' }
                            ]}>
                              <Text style={styles.collectionRateText}>{classData.collectionRate}%</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#666" style={{ marginLeft: 8 }} />
                          </View>
                        </View>

                        <View style={styles.classStatDetails}>
                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Students: {classData.totalStudents}</Text>
                            <Text style={styles.statValue}>
                              Paid: {classData.studentsWithPayments} | Pending: {classData.studentsWithoutPayments}
                            </Text>
                          </View>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Total Fees:</Text>
                            <Text style={styles.statValue}>{formatSafeCurrency(classData.totalExpectedFees)}</Text>
                          </View>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Collected:</Text>
                            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                              {formatSafeCurrency(classData.totalPaid)}
                            </Text>
                          </View>

                          <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Outstanding:</Text>
                            <Text style={[styles.statValue, { color: '#F44336' }]}>
                              {formatSafeCurrency(classData.outstanding)}
                            </Text>
                          </View>
                        </View>

                      </TouchableOpacity>
                    ))
                  )}
                </View>

              </View>
              )}
              {tab === 'recent' && (
              <View style={styles.paymentsContent}>
                {/* Recent Payments */}
                <View style={styles.recentPaymentsContainer}>
                  <Text style={styles.sectionTitle}>Recent Payments</Text>
                  {payments.slice(0, 20).map((item, index) => (
                    <View key={item.id || `payment-${index}`} style={styles.paymentItem}>
                      <View style={styles.paymentItemLeft}>
                        <Text style={styles.paymentStudentName}>{item.students?.full_name || 'Unknown Student'}</Text>
                        <Text style={styles.paymentFeeType}>{item.fee_structure?.fee_component || item.fee_component || 'Unknown Fee'}</Text>
                        <Text style={styles.paymentDate}>{formatSafeDate(item.payment_date)}</Text>
                      </View>
                      <View style={styles.paymentItemRight}>
                        <Text style={styles.paymentAmount}>{formatSafeCurrency(item.amount_paid)}</Text>
                        <View style={styles.paymentStatus}>
                          <View style={[
                            styles.statusDot, 
                            { backgroundColor: item.status === 'paid' ? '#4CAF50' : 
                                              item.status === 'partial' ? '#FF9800' : '#F44336' }
                          ]} />
                          <Text style={styles.statusText}>
                            {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Paid'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {payments.length === 0 && (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="receipt-outline" size={48} color="#ccc" />
                      <Text style={styles.noPaymentsText}>No payments found</Text>
                      <Text style={styles.emptySubtext}>Payment records will appear here when available</Text>
                    </View>
                  )}
                </View>
              </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
      {tab === 'structure' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setSelectedClassIds([]); // Reset to empty array
            setNewFeeStructure({
              type: '',
              amount: '',
              dueDate: null,
              academicYear: '2024-25'
            });
            setFeeStructureModal(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Export Modal */}
<ExportModal
        visible={showExportModalFM}
        onClose={() => setShowExportModalFM(false)}
        onExport={handleExportOptionFM}
        title="Export Student Fee Summary"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.EXCEL, EXPORT_FORMATS.PDF, EXPORT_FORMATS.CLIPBOARD]}
      />

      {/* Modal for Payment, Fee Edit/Add, and Fee Structure */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={paymentModal || feeModal.visible || feeStructureModal}
      onRequestClose={() => {
        if (paymentModal) {
          setPaymentModal(false);
        } else if (feeModal.visible) {
          setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
        } else {
          setFeeStructureModal(false);
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {paymentModal 
              ? 'Make Payment' 
              : feeModal.visible 
                ? (editFeeId ? 'Edit Fee' : 'Add New Fee')
                : 'Add New Fee Structure'
            }
          </Text>
          
          <ScrollView 
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {paymentModal ? (
              <View>
                <Text style={styles.studentInfo}>Student: {selectedStudent?.name || 'Unknown'}</Text>
                <Text style={styles.studentInfo}>Fee: {selectedFee?.type || 'Unknown'}</Text>
                <Text style={styles.studentInfo}>Amount: {formatSafeCurrency(paymentAmount)}</Text>
                <Text style={styles.studentInfo}>Payment Date: {formatSafeDate(paymentDate)}</Text>
                <TextInput
                  style={styles.input}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="Enter payment amount"
                  keyboardType="numeric"
                />
                <Text style={styles.inputLabel}>Payment Date *</Text>
                <CrossPlatformDatePicker
                  value={paymentDate && !isNaN(new Date(paymentDate).getTime()) ? new Date(paymentDate) : new Date()}
                  mode="date"
                  placeholder="Select payment date"
                  label=""
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setPaymentDate(selectedDate);
                    }
                  }}
                  style={styles.dateButton}
                  textStyle={styles.dateButtonText}
                />
              </View>
            ) : feeModal.visible ? (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Fee Type"
                  value={feeModal.fee.type}
                  onChangeText={text => {
                    setFeeModal(prev => ({
                      ...prev,
                      fee: {
                        ...prev.fee,
                        type: text
                      }
                    }));
                  }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Amount"
                  value={feeModal.fee.amount}
                  onChangeText={text => {
                    setFeeModal(prev => ({
                      ...prev,
                      fee: {
                        ...prev.fee,
                        amount: text
                      }
                    }));
                  }}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Description"
                  value={feeModal.fee.description}
                  onChangeText={text => {
                    setFeeModal(prev => ({
                      ...prev,
                      fee: {
                        ...prev.fee,
                        description: text
                      }
                    }));
                  }}
                  multiline
                  numberOfLines={3}
                />
                <Text style={styles.inputLabel}>Due Date *</Text>
                <CrossPlatformDatePicker
                  value={feeModal.fee.dueDate ? new Date(feeModal.fee.dueDate) : new Date()}
                  mode="date"
                  placeholder="Select due date"
                  label=""
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setFeeModal(prev => ({
                        ...prev,
                        fee: {
                          ...prev.fee,
                          dueDate: selectedDate.toISOString().split('T')[0]
                        }
                      }));
                    }
                  }}
                  minimumDate={new Date()}
                  style={styles.dateButton}
                  textStyle={styles.dateButtonText}
                />
              </View>
            ) : (
              <View>
              {/* Multiple Class Selection */}
              <Text style={styles.inputLabel}>Select Classes *</Text>
              <Text style={styles.helperText}>Tap classes to select/deselect multiple</Text>
              
              {/* All Classes Button */}
              <View style={styles.allClassesContainer}>
                <TouchableOpacity
                  style={[
                    styles.allClassesButton,
                    selectedClassIds.length === classes.length && styles.allClassesButtonSelected
                  ]}
                  onPress={() => {
                    if (selectedClassIds.length === classes.length) {
                      // Deselect all
                      setSelectedClassIds([]);
                    } else {
                      // Select all
                      setSelectedClassIds(classes.map(cls => cls.id));
                    }
                  }}
                >
                  <Ionicons 
                    name={selectedClassIds.length === classes.length ? "checkmark-circle" : "ellipse-outline"} 
                    size={20} 
                    color={selectedClassIds.length === classes.length ? "#fff" : "#1976d2"} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[
                    styles.allClassesButtonText,
                    selectedClassIds.length === classes.length && styles.allClassesButtonTextSelected
                  ]}>
                    All Classes ({classes.length})
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.classSelectionContainer}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[
                      styles.classChip,
                      selectedClassIds.includes(cls.id) && styles.selectedClassChip
                    ]}
                    onPress={() => {
                      if (selectedClassIds.includes(cls.id)) {
                        // Remove from selection
                        setSelectedClassIds(prev => prev.filter(id => id !== cls.id));
                      } else {
                        // Add to selection
                        setSelectedClassIds(prev => [...prev, cls.id]);
                      }
                    }}
                  >
                    <Text style={[
                      styles.classChipText,
                      selectedClassIds.includes(cls.id) && styles.selectedClassChipText
                    ]}>
                      {cls.class_name} - {cls.section || 'A'}
                    </Text>
                    {selectedClassIds.includes(cls.id) && (
                      <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Fee Component *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tuition Fee, Bus Fee, Lab Fee"
                value={newFeeStructure.type}
                onChangeText={(text) => setNewFeeStructure({ ...newFeeStructure, type: text })}
              />
              
              <Text style={styles.inputLabel}>Amount *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount in ₹"
                value={newFeeStructure.amount}
                onChangeText={(text) => setNewFeeStructure({ ...newFeeStructure, amount: text })}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Due Date *</Text>
              <CrossPlatformDatePicker
                value={newFeeStructure.dueDate || new Date()}
                mode="date"
                placeholder="Select due date"
                label=""
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setNewFeeStructure({ ...newFeeStructure, dueDate: selectedDate });
                  }
                }}
                minimumDate={new Date()}
                style={styles.dateButton}
                textStyle={styles.dateButtonText}
              />

              <Text style={styles.requiredNote}>* Required fields</Text>
              
              {/* Selected Classes Summary */}
              {selectedClassIds.length > 0 && (
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryTitle}>
                    Fee will be created for {selectedClassIds.length} class(es):
                  </Text>
                  {selectedClassIds.map(classId => {
                    const cls = classes.find(c => c.id === classId);
                    return (
                      <Text key={classId} style={styles.summaryItem}>
                        • {cls?.class_name} - {cls?.section || 'A'}
                      </Text>
                    );
                  })}
                  {newFeeStructure.dueDate && (
                    <Text style={styles.summaryItem}>
                      • Due Date: {formatSafeDate(newFeeStructure.dueDate)}
                    </Text>
                  )}
                </View>
              )}
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                if (paymentModal) {
                  setPaymentModal(false);
                } else if (feeModal.visible) {
                  setFeeModal({ visible: false, classId: '', fee: { type: '', amount: '', dueDate: '', description: '' } });
                } else {
                  setFeeStructureModal(false);
                }
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => {
                if (paymentModal) {
                  handlePayment(selectedStudent?.id, selectedFee?.id, paymentAmount);
                } else if (feeModal.visible) {
                  if (editFeeId) {
                    handleEditFee(feeModal.classId, editFeeId, feeModal.fee);
                  } else {
                    handleFeeOperation('add', feeModal.fee);
                  }
                } else {
                  handleAddFeeStructure();
                }
              }}
              disabled={paymentLoading}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                {paymentLoading ? 'Saving...' : 
                  paymentModal ? 'Pay' : 
                  feeModal.visible ? (editFeeId ? 'Update' : 'Save') : 
                  'Add'
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </View>
);};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mainContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  progressContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  progressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1976d2',
    borderRadius: 2,
  },
  progressStepText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#333',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  structureContent: {
    gap: 16,
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editClassButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  classInfo: {
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  classDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dueStudents: {
    fontSize: 14,
    color: '#4A90E2',
    marginBottom: 2,
  },
  totalDue: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  feeItemCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  feeItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  feeItemLeft: {
    flex: 1,
  },
  feeItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 4,
  },
  feeItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  feeItemDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeItemDateText: {
    fontSize: 12,
    color: '#4A90E2',
  },
  feeItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  feeActionButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxHeight: '90%',
    maxWidth: 500,
  },
  modalScrollView: {
    maxHeight: '70vh',
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  studentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  studentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  requiredNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#1976d2',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  bottomSpacer: {
    height: 100,
    width: '100%',
  },
  classSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  classChip: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedClassChip: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  classChipText: {
    fontSize: 14,
    color: '#333',
  },
  selectedClassChipText: {
    color: '#fff',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginLeft: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  // Missing styles for payments tab
  paymentsContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  paymentItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentStudentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentFeeType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  noPaymentsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyFeesContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyFeesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  // Missing styles for reports tab
  reportsContent: {
    padding: 16,
  },
  statisticItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statisticLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statisticValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
  },
  // Payment section styles
  paymentSummaryContainer: {
    marginBottom: 20,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  classStatsContainer: {
    marginBottom: 20,
    paddingBottom: 80,
  },
  classStatCard: {
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
  classStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  classStatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  classStatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionRateBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  collectionRateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  classStatDetails: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  recentPaymentsContainer: {
    marginBottom: 20,
    paddingBottom: 80,
  },
  paymentItemLeft: {
    flex: 1,
  },
  paymentItemRight: {
    alignItems: 'flex-end',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 20,
  },
  // All Classes Button Styles
  allClassesContainer: {
    marginBottom: 12,
  },
  allClassesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#1976d2',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  allClassesButtonSelected: {
    backgroundColor: '#1976d2',
    borderStyle: 'solid',
  },
  allClassesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  allClassesButtonTextSelected: {
    color: '#fff',
  },
  // Recent Payments Tab Specific Styles
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  feeAmountContainer: {
    marginVertical: 4,
  },
  feeBaseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  // Scroll wrapper styles to fix scrolling issues
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
    ...Platform.select({
      web: {
        paddingBottom: 40,
      },
    }),
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  performanceText: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 3,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// Wrap with FeatureGuard for access control
const FeeManagementWithGuard = (props) => {
  return (
    <FeatureGuard screenName="FeeManagement">
      <FeeManagement {...props} />
    </FeatureGuard>
  );
};

export default FeeManagementWithGuard;
