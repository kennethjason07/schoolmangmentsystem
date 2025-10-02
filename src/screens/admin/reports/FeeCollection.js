import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  FlatList,
  TextInput,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import { supabase, TABLES } from '../../../utils/supabase';
import { exportFeeData, EXPORT_FORMATS } from '../../../utils/exportUtils';
import enhancedNotificationService from '../../../services/enhancedNotificationService';
import { useTenantAccess, getCachedTenantId, tenantDatabase, createTenantQuery } from '../../../utils/tenantHelpers';
import { PieChart, BarChart } from 'react-native-chart-kit';
import CrossPlatformDatePicker, { DatePickerButton } from '../../../components/CrossPlatformDatePicker';

const { width: screenWidth } = Dimensions.get('window');

const FeeCollection = ({ navigation }) => {
  // Enhanced tenant access
  const { 
    isReady, 
    isLoading: tenantLoading, 
    tenantName, 
    error: tenantError,
    getTenantId 
  } = useTenantAccess();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feeData, setFeeData] = useState([]);
  const [feeStructureData, setFeeStructureData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-25');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);

  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderAudience, setReminderAudience] = useState('Parent'); // 'Parent' | 'Student' | 'Both'
  const [reminderScope, setReminderScope] = useState('all'); // 'all' | 'class'
  const [reminderClassId, setReminderClassId] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');
  
  // Enhanced scroll functionality
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentRefreshColor, setCurrentRefreshColor] = useState(0);
  const scrollViewRef = useRef(null);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;
  const scrollTopScale = useRef(new Animated.Value(0.8)).current;
  
  // Constants for scroll behavior
  const isWeb = Platform.OS === 'web';
  const SCROLL_THRESHOLD = isWeb ? 80 : 120;
  const SCROLL_THROTTLE = isWeb ? 32 : 16;
  const refreshColors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];
  
  // Statistics
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalOutstanding: 0,
    totalExpected: 0,
    collectionRate: 0,
    monthlyCollection: [],
    paymentModeDistribution: [],
    classWiseCollection: [],
    recentPayments: [],
  });

  // Recent payments pagination
  const RECENT_PAGE_SIZE = 50;
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentPage, setRecentPage] = useState(0);
  const [recentHasMore, setRecentHasMore] = useState(true);
  const [recentLoadingPage, setRecentLoadingPage] = useState(false);

  const academicYears = ['2024-25', '2023-24', '2022-23'];
  const paymentStatuses = ['All', 'Paid', 'Pending', 'Partial'];
  const dateRangeOptions = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'thisYear', label: 'This Year' },
    { key: 'custom', label: 'Custom Range' },
  ];

  // Validate tenant access
  const validateTenantAccess = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    // Additional check: make sure we're not dealing with parent user
    console.log('🔍 Validating user access - Tenant ready:', isReady, 'Tenant ID:', tenantId);
    
    return { valid: true };
  };

  // Force correct initial state on component mount
  useEffect(() => {
    console.log('🏁 ENHANCED: Component mounted, forcing correct state...');
    
    // Force date range to 'all' if it's not already set
    if (selectedDateRange !== 'all') {
      console.log('🔄 ENHANCED: Forcing date range from', selectedDateRange, 'to all');
      setSelectedDateRange('all');
    }
  }, []);

  useEffect(() => {
    console.log('🏁 ENHANCED: Component state check:', {
      selectedDateRange,
      selectedAcademicYear,
      selectedClass,
      selectedPaymentStatus,
      isReady,
      tenantLoading
    });
    
    if (isReady) {
      loadInitialData();
    }
  }, [isReady]);

  // Debounced filter handling for date range and payment status (no reload of students/fee structure)
  const filterDebounceRef = useRef(null);

  // Reload students and fee structure only when class or academic year changes
  useEffect(() => {
    if (!isReady || loading) return;
    console.log('🔄 Class or academic year changed, reloading supporting data...');
    Promise.all([loadStudents(), loadFeeStructure()])
      .then(() => loadFeeData())
      .catch(() => loadFeeData());
  }, [isReady, selectedClass, selectedAcademicYear]);

  // Debounced reload when only date range or payment status changes
  useEffect(() => {
    if (!isReady || loading) return;
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      console.log('⏱️ Debounced filter change, reloading fee data...');
      loadFeeData();
    }, 300);
    return () => filterDebounceRef.current && clearTimeout(filterDebounceRef.current);
  }, [selectedPaymentStatus, selectedDateRange, startDate, endDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClasses(),
        loadStudents(),
        loadFeeStructure(),
      ]);
      await loadFeeData();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      // Validate tenant access first
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Classes: Tenant validation failed:', validation.error);
        return;
      }

      // Use tenantDatabase helper as per ENHANCED_TENANT_SYSTEM
      const { data, error } = await tenantDatabase.read(
        TABLES.CLASSES,
        { academic_year: selectedAcademicYear },
        '*'
      );

      if (error) {
        console.error('❌ Classes loading error:', error);
        throw error;
      }
      
      console.log('✅ Loaded classes:', data?.length || 0);
      setClasses(data || []);
    } catch (error) {
      console.error('❌ Error loading classes:', error);
      Alert.alert('Error', `Failed to load classes: ${error.message}`);
    }
  };

  const loadStudents = async () => {
    try {
      // Validate tenant access first  
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Students: Tenant validation failed:', validation.error);
        return;
      }

      // Build filters
      let filters = { academic_year: selectedAcademicYear };
      if (selectedClass !== 'All') {
        filters.class_id = selectedClass;
      }
      
      console.log('🏫 Loading students with filters:', filters);
      
      // Use tenantDatabase helper as per ENHANCED_TENANT_SYSTEM
      const { data, error } = await tenantDatabase.read(
        TABLES.STUDENTS,
        filters,
        '*'
      );

      if (error) {
        console.error('❌ Students loading error:', error);
        throw error;
      }
      
      console.log('✅ Loaded students:', data?.length || 0, 'for class:', selectedClass === 'All' ? 'All Classes' : selectedClass);
      
      // Debug: Log class information for specific students
      if (data && data.length > 0) {
        console.log('🏫 Sample student:', {
          id: data[0].id,
          name: data[0].name || data[0].full_name,
          class_id: data[0].class_id
        });
      }
      
      setStudents(data || []);
    } catch (error) {
      console.error('❌ Error loading students:', error);
      Alert.alert('Error', `Failed to load students: ${error.message}`);
    }
  };

  const loadFeeStructure = async () => {
    try {
      // Validate tenant access first
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Fee Structure: Tenant validation failed:', validation.error);
        return;
      }

      // Build filters
      let filters = { academic_year: selectedAcademicYear };
      if (selectedClass !== 'All') {
        filters.class_id = selectedClass;
      }
      
      // Use tenantDatabase helper as per ENHANCED_TENANT_SYSTEM
      const { data, error } = await tenantDatabase.read(
        TABLES.FEE_STRUCTURE,
        filters,
        '*'
      );

      if (error) {
        console.error('❌ Fee structure loading error:', error);
        throw error;
      }
      
      console.log('✅ Loaded fee structure:', data?.length || 0);
      setFeeStructureData(data || []);
    } catch (error) {
      console.error('❌ Error loading fee structure:', error);
      Alert.alert('Error', `Failed to load fee structure: ${error.message}`);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    let start, end;

    switch (selectedDateRange) {
      case 'all':
        // For 'all', we don't need valid dates since we skip date filtering
        start = null;
        end = null;
        break;
      case 'today':
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'thisWeek':
        // Calculate start of week (Sunday)
        const dayOfWeek = today.getDay();
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + 6);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        start = startDate;
        end = endDate;
        break;
      default:
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Ensure we have valid dates
    if (!start || isNaN(start.getTime())) {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    if (!end || isNaN(end.getTime())) {
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return { start, end };
  };

  const fetchCollectedTotalByFilters = async (tenantId, academicYear, classId, start, end) => {
    try {
      const params = {
        p_tenant_id: tenantId,
        p_academic_year: academicYear,
        p_class_id: classId,
        p_start_date: start ? start.toISOString().split('T')[0] : null,
        p_end_date: end ? end.toISOString().split('T')[0] : null,
      };
      const { data, error } = await supabase.rpc('fee_collection_total_by_filters', params);
      if (!error && typeof data === 'number') return data;
    } catch (e) {
      // ignore RPC errors, fallback will apply
    }
    return null;
  };

  const loadRecentPaymentsPage = async (pageNumber = 0, replace = false) => {
    try {
      const tenantId = getCachedTenantId();
      const { start, end } = getDateRange();
      const from = pageNumber * RECENT_PAGE_SIZE;
      const to = from + RECENT_PAGE_SIZE - 1;

      let query = supabase
        .from(TABLES.STUDENT_FEES)
        .select(`
          id, student_id, fee_component, amount_paid, payment_date, payment_mode, academic_year,
          students(id, name, admission_no, class_id, classes(class_name, section))
        `)
        .eq('tenant_id', tenantId)
        .eq('academic_year', selectedAcademicYear)
        .order('payment_date', { ascending: false })
        .range(from, to);

      if (selectedDateRange !== 'all' && start && end) {
        query = query.gte('payment_date', start.toISOString().split('T')[0])
                     .lte('payment_date', end.toISOString().split('T')[0]);
      }
      if (selectedClass !== 'All') {
        query = query.eq('students.class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      const hasMore = (data?.length || 0) === RECENT_PAGE_SIZE;
      setRecentHasMore(hasMore);
      setRecentPage(pageNumber);
      if (replace) setRecentPayments(data || []);
      else setRecentPayments(prev => ([...(prev || []), ...(data || [])]));
    } catch (err) {
      if (replace) setRecentPayments([]);
    }
  };

  const loadFeeData = async () => {
    try {
      console.log('🚀 Starting ENHANCED loadFeeData...');
      
      // Validate tenant access
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Fee Data: Tenant validation failed:', validation.error);
        return;
      }

      const tenantId = getCachedTenantId();
      const { start, end } = getDateRange();

      // Build base query with narrow projection and joins for class info
      let query = supabase
        .from(TABLES.STUDENT_FEES)
        .select(`
          id, student_id, fee_component, amount_paid, payment_date, payment_mode, academic_year,
          students!inner(id, name, admission_no, class_id, classes(class_name, section))
        `)
        .eq('tenant_id', tenantId)
        .eq('academic_year', selectedAcademicYear)
        .order('payment_date', { ascending: false });

      // Server-side date filter (skip if 'all')
      if (selectedDateRange !== 'all' && start && end) {
        query = query.gte('payment_date', start.toISOString().split('T')[0])
                     .lte('payment_date', end.toISOString().split('T')[0]);
      }

      // Server-side class filter
      if (selectedClass !== 'All') {
        query = query.eq('students.class_id', selectedClass);
      }

      // Note: Payment status server-side filter omitted unless a status column exists

      const { data, error } = await query;
      if (error) throw error;

      console.log('✅ ENHANCED: Loaded fee records:', data?.length || 0);
      setFeeData(data || []);

      // Server aggregate for total collected (optional)
      const serverCollected = await fetchCollectedTotalByFilters(
        tenantId,
        selectedAcademicYear,
        selectedClass !== 'All' ? selectedClass : null,
        selectedDateRange !== 'all' ? start : null,
        selectedDateRange !== 'all' ? end : null
      );

      calculateStatistics(data || [], serverCollected != null ? { totalCollected: serverCollected } : undefined);

      // Load first page of recent payments
      await loadRecentPaymentsPage(0, true);
    } catch (error) {
      console.error('❌ ENHANCED: Error loading fee data:', error);
      Alert.alert('Error', `Failed to load fee data: ${error.message}`);
    }
  };

  const calculateStatistics = (data, overrides) => {
    console.log('📊 ENHANCED: Calculating statistics for fee data:', data?.length || 0, 'records');
    console.log('🏫 Students count:', students?.length || 0);
    console.log('📋 Fee structure count:', feeStructureData?.length || 0);
    
    // Debug: Log sample fee data to check field names
    if (data && data.length > 0) {
      console.log('💰 Sample fee record:', JSON.stringify(data[0], null, 2));
    }
    
    // Calculate total collected - use primary field name
    let totalCollected = data.reduce((sum, fee) => {
      // Use amount_paid as primary field (standard field name)
      const amount = parseFloat(fee.amount_paid) || 0;
      
      if (amount > 0) {
        console.log(`💰 Adding ${amount} from record:`, fee.id || 'unknown');
      }
      
      return sum + amount;
    }, 0);
    
    // Apply override from server aggregate if available
    if (overrides && typeof overrides.totalCollected === 'number') {
      totalCollected = overrides.totalCollected;
    }
    console.log('💰 Total Collected Amount:', totalCollected);

    // 🚀 ENHANCED: Calculate expected amount properly (per student basis with discounts)
    let totalExpected = 0;
    
    if (feeStructureData && feeStructureData.length > 0 && students && students.length > 0) {
      // Calculate base fee per student from fee structure
      const baseFeePerStudent = feeStructureData.reduce((sum, structure) => {
        const amount = parseFloat(structure.amount) || parseFloat(structure.fee_amount) || 0;
        return sum + amount;
      }, 0);
      
      console.log('💰 Base fee per student:', baseFeePerStudent);
      
      // Calculate expected amount considering discounts for each student
      let totalDiscountAmount = 0;
      const studentsCount = students.length;
      
      // For now, calculate total expected as base fee × students
      // Discounts will be handled separately if discount data is available
      totalExpected = baseFeePerStudent * studentsCount;
      
      console.log('🏫 Students count:', studentsCount);
      console.log('📈 Total Expected (base calculation):', totalExpected);
      console.log('💵 Total Discounts:', totalDiscountAmount);
      console.log('📈 Final Expected Amount:', totalExpected - totalDiscountAmount);
      
      // Adjust for discounts if any
      totalExpected = totalExpected - totalDiscountAmount;
    } else {
      console.warn('⚠️ Missing fee structure or students data for expected calculation');
      // Fallback: use old calculation
      totalExpected = feeStructureData.reduce((sum, structure) => {
        const amount = parseFloat(structure.amount) || parseFloat(structure.fee_amount) || 0;
        return sum + amount;
      }, 0);
      console.log('📈 Total Expected (fallback):', totalExpected);
    }

    // Calculate outstanding (Expected - Collected)
    const totalOutstanding = Math.max(0, totalExpected - totalCollected);

    // Calculate collection rate
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
    
    console.log('💯 CALCULATION VERIFICATION:');
    console.log('  Formula: Outstanding = Expected - Collected');
    console.log('  Outstanding = ' + totalExpected + ' - ' + totalCollected + ' = ' + totalOutstanding);

    // Calculate monthly collection for chart
    const monthlyData = {};
    data.forEach(fee => {
      const paymentDate = fee.payment_date || fee.created_at;
      if (paymentDate) {
        const month = new Date(paymentDate).toLocaleDateString('en-IN', { month: 'short' });
        const amount = parseFloat(fee.amount_paid) || 0;
        monthlyData[month] = (monthlyData[month] || 0) + amount;
      }
    });

    const monthlyCollection = Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(`1 ${a.month} 2024`) - new Date(`1 ${b.month} 2024`));

    // Calculate payment mode distribution
    const paymentModes = {};
    data.forEach(fee => {
      const mode = fee.payment_mode || 'Unknown';
      paymentModes[mode] = (paymentModes[mode] || 0) + 1;
    });

    const paymentModeDistribution = Object.entries(paymentModes).map(([mode, count]) => ({
      name: mode,
      population: count,
      color: getPaymentModeColor(mode),
      legendFontColor: '#333',
      legendFontSize: 12,
    }));

    // Calculate class-wise collection
    const classData = {};
    data.forEach(fee => {
      const className = `${fee.students?.classes?.class_name || fee.class_name || 'Unknown'} ${fee.students?.classes?.section || fee.section || ''}`;
      if (className && className.trim() !== 'Unknown') {
        if (!classData[className]) {
          classData[className] = { collected: 0, count: 0 };
        }
        const amount = parseFloat(fee.amount_paid) || 0;
        classData[className].collected += amount;
        classData[className].count++;
      }
    });

    const classWiseCollection = Object.entries(classData)
      .map(([className, stats]) => ({
        className,
        collected: stats.collected,
        count: stats.count,
        average: Math.round(stats.collected / stats.count)
      }))
      .sort((a, b) => b.collected - a.collected);

    console.log('📊 ENHANCED FINAL STATS SUMMARY:');
    console.log('💰 Total Collected:', totalCollected, '(from', data?.length || 0, 'payment records)');
    console.log('📈 Total Expected:', totalExpected, '(fee structure:', feeStructureData?.length || 0, 'entries × students:', students?.length || 0, ')');
    console.log('🔴 Total Outstanding:', totalOutstanding);
    console.log('📅 Collection Rate:', collectionRate + '%');
    
    // Clear calculation verification
    console.log('\n🧮 CALCULATION VERIFICATION:');
    if (feeStructureData && students) {
      const feePerStudent = feeStructureData.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      console.log('Formula: Fee per student (₹' + feePerStudent + ') × Students (' + students.length + ') = Expected (₹' + totalExpected + ')');
      console.log('Outstanding: Expected (₹' + totalExpected + ') - Collected (₹' + totalCollected + ') = ₹' + totalOutstanding);
    }
    
    // Additional debugging for your specific case
    console.log('\n📝 DEBUG INFO:');
    console.log('- Selected class:', selectedClass === 'All' ? 'All Classes' : selectedClass);
    console.log('- Academic year:', selectedAcademicYear);
    console.log('- Classes available:', classes?.length || 0);
    console.log('- Students in selected class:', students?.length || 0);
    console.log('- Fee structure entries:', feeStructureData?.length || 0);
    console.log('- Payment records:', data?.length || 0);
    
    setStats({
      totalCollected,
      totalOutstanding,
      totalExpected,
      collectionRate,
      monthlyCollection,
      paymentModeDistribution,
      classWiseCollection,
      recentPayments: data.slice(0, 10),
    });
    
    console.log('✅ Stats updated - Collected amount should now show:', formatCurrency(totalCollected));
  };

  const getPaymentModeColor = (mode) => {
    const colors = {
      'Cash': '#4CAF50',
      'Card': '#2196F3',
      'Online': '#9C27B0',
      'UPI': '#FF9800',
      'Unknown': '#666'
    };
    return colors[mode] || '#666';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Cycle through refresh colors for better UX
    setCurrentRefreshColor((prev) => (prev + 1) % refreshColors.length);
    await loadFeeData();
    setRefreshing(false);
  };

  // Enhanced scroll event handler
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > SCROLL_THRESHOLD;
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      animateScrollTopButton(shouldShow);
    }
  };

  // Animate scroll-to-top button
  const animateScrollTopButton = (show) => {
    Animated.parallel([
      Animated.timing(scrollTopOpacity, {
        toValue: show ? 1 : 0,
        duration: 300,
        useNativeDriver: !isWeb, // Native driver not supported on web for opacity
      }),
      Animated.spring(scrollTopScale, {
        toValue: show ? 1 : 0.8,
        tension: 100,
        friction: 8,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  };

  // Scroll to top function
  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
        animated: !isWeb // Use CSS smooth scroll on web
      });
    }
  };

  // Quick navigation function
  const scrollToSection = (yPosition) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: yPosition,
        animated: !isWeb
      });
    }
  };

  const handleDateChange = (event, selectedDate, type) => {
    if (type === 'start') {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleExport = async (format) => {
    try {
      const success = await exportFeeData(feeData, stats, format);
      return success;
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export fee collection report.');
      return false;
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Paid': return '#4CAF50';
      case 'Pending': return '#f44336';
      case 'Partial': return '#FF9800';
      default: return '#666';
    }
  };

  // Prepare default reminder message when stats or selection changes
  useEffect(() => {
    const defaultMsg = `Fee payment reminder:\nOutstanding: ${formatCurrency(stats.totalOutstanding)}. Please clear dues at the earliest. Thank you.`;
    setReminderMessage(defaultMsg);
    setReminderClassId(selectedClass !== 'All' ? selectedClass : (classes[0]?.id || null));
  }, [stats.totalOutstanding, selectedClass, classes]);

  // Send fee reminders to parents and students
  const handleSendReminders = async (options = { skipConfirm: false }) => {
    try {
      if (sendingReminders) return;

      // Confirm only if not invoked from modal
      if (!options.skipConfirm) {
        const scopeText = selectedClass === 'All' ? 'all classes' : 'the selected class';
        const confirmed = await new Promise((resolve) => {
          Alert.alert(
            'Send Fee Reminders',
            `This will send a reminder to parents and students for ${scopeText}. Continue?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Send', onPress: () => resolve(true) }
            ]
          );
        });
        if (!confirmed) return;
      }

      setSendingReminders(true);

      const message = reminderMessage?.trim() ? reminderMessage : `Fee payment reminder. Outstanding: ${formatCurrency(stats.totalOutstanding)}`;
      const recipientTypes = reminderAudience === 'Both' ? ['Parent', 'Student'] : [reminderAudience];

      // Determine target classes
      let targetClassIds = [];
      if (reminderScope === 'class') {
        const cid = reminderClassId || (selectedClass !== 'All' ? selectedClass : null);
        if (cid) targetClassIds = [cid];
      } else {
        // all classes
        if (selectedClass !== 'All') targetClassIds = [selectedClass];
        else targetClassIds = classes.map(c => c.id).filter(Boolean);
      }

      // If no class id found, attempt single call with null (some backends allow global)
      if (targetClassIds.length === 0) {
        const result = await enhancedNotificationService.createBulkNotification({
          type: 'GRADE_ENTERED',
          message,
          classId: null,
          recipientTypes,
          deliveryMode: 'InApp'
        });
        if (!result?.success) throw new Error(result?.error || 'Could not send reminders');
        Alert.alert('Reminders Sent', 'Fee reminders have been queued for delivery.');
        return true;
      }

      // Send per-class; count successes
      let successCount = 0;
      for (const cid of targetClassIds) {
        const res = await enhancedNotificationService.createBulkNotification({
          type: 'GRADE_ENTERED',
          message,
          classId: cid,
          recipientTypes,
          deliveryMode: 'InApp'
        });
        if (res?.success) successCount += 1;
      }

      if (successCount > 0) {
        Alert.alert('Reminders Sent', `Fee reminders queued for ${successCount} class(es).`);
        return true;
      } else {
        throw new Error('No reminders could be queued');
      }
    } catch (e) {
      console.error('Send reminders error:', e);
      Alert.alert('Error', e.message || 'Failed to send reminders');
      return false;
    } finally {
      setSendingReminders(false);
    }
  };

  // Quick Navigation Component
  const QuickNavigation = () => {
    const navigationItems = [
      { label: 'Filters', icon: 'filter', position: 0 },
      { label: 'Stats', icon: 'analytics', position: 400 },
      { label: 'Charts', icon: 'pie-chart', position: 800 },
      { label: 'Payments', icon: 'card', position: 1200 },
    ];

    return (
      <View style={styles.quickNavContainer}>
        <Text style={styles.quickNavTitle}>Quick Navigation</Text>
        <View style={styles.quickNavButtons}>
          {navigationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickNavButton}
              onPress={() => scrollToSection(item.position)}
              accessibilityLabel={`Navigate to ${item.label} section`}
              accessibilityHint={`Scrolls to the ${item.label.toLowerCase()} section of the fee collection report`}
            >
              <Ionicons name={item.icon} size={20} color="#2196F3" />
              <Text style={styles.quickNavButtonText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderPaymentRecord = ({ item }) => (
    <View style={styles.paymentCard}>
      <View style={styles.studentInfo}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={20} color="#2196F3" />
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{item.students?.name}</Text>
          <Text style={styles.studentId}>#{item.students?.admission_no}</Text>
          <Text style={styles.feeComponent}>{item.fee_component}</Text>
        </View>
      </View>
      <View style={styles.paymentInfo}>
        <Text style={styles.amountText}>{formatCurrency(item.amount_paid)}</Text>
        <View style={[styles.paymentModeBadge, { backgroundColor: getPaymentModeColor(item.payment_mode) }]}>
          <Text style={styles.paymentModeText}>{item.payment_mode}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(new Date(item.payment_date))}</Text>
      </View>
    </View>
  );

  // Handle tenant errors
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="Fee Collection" showBack={true} />
        <View style={styles.loadingContainer}>
          <Ionicons name="warning" size={48} color="#f44336" />
          <Text style={styles.errorText}>Tenant Access Error</Text>
          <Text style={styles.errorSubtext}>{tenantError}</Text>
          <Text style={styles.errorHint}>Please check your connection and try again</Text>
        </View>
      </View>
    );
  }

  // Handle loading states
  if (tenantLoading || !isReady || loading) {
    const loadingMessage = tenantLoading || !isReady 
      ? 'Initializing tenant access...' 
      : 'Loading fee data...';
    
    return (
      <View style={styles.container}>
        <Header title="Fee Collection" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Fee Collection" showBack={true} />
      
      <View style={styles.scrollableContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={SCROLL_THROTTLE}
          showsVerticalScrollIndicator={!isWeb}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[refreshColors[currentRefreshColor]]}
              tintColor={refreshColors[currentRefreshColor]}
              title="Pull to refresh fee collection data"
              titleColor="#666"
            />
          }
        >
        {/* Quick Navigation (web only) */}
        {isWeb && <QuickNavigation />}
        
        {/* Tenant Info Banner */}
        
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filters</Text>

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Academic Year</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAcademicYear}
                  onValueChange={setSelectedAcademicYear}
                  style={styles.picker}
                >
                  {academicYears.map((year) => (
                    <Picker.Item key={year} label={year} value={year} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Class</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={setSelectedClass}
                  style={styles.picker}
                >
                  <Picker.Item label="All Classes" value="All" />
                  {classes.map((cls) => (
                    <Picker.Item
                      key={cls.id}
                      label={`${cls.class_name} ${cls.section}`}
                      value={cls.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Payment Status</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedPaymentStatus}
                  onValueChange={setSelectedPaymentStatus}
                  style={styles.picker}
                >
                  {paymentStatuses.map((status) => (
                    <Picker.Item key={status} label={status} value={status} />
                  ))}
                </Picker>
              </View>
            </View>

              <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedDateRange}
                  onValueChange={(value) => {
                    console.log('📅 Date range changed to:', value);
                    setSelectedDateRange(value);
                  }}
                  style={styles.picker}
                >
                  {dateRangeOptions.map((option) => (
                    <Picker.Item
                      key={option.key}
                      label={option.label}
                      value={option.key}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {selectedDateRange === 'custom' && (
            <View style={styles.customDateRow}>
              {Platform.OS === 'web' ? (
                <>
                  <View style={styles.dateInputWrapper}>
                    <CrossPlatformDatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={(event, date) => handleDateChange(event, date, 'start')}
                      mode="date"
                      placeholder="Select Start Date"
                      containerStyle={{ flex: 1, marginRight: 8 }}
                    />
                  </View>
                  <View style={styles.dateInputWrapper}>
                    <CrossPlatformDatePicker
                      label="End Date"
                      value={endDate}
                      onChange={(event, date) => handleDateChange(event, date, 'end')}
                      mode="date"
                      placeholder="Select End Date"
                      containerStyle={{ flex: 1, marginLeft: 8 }}
                    />
                  </View>
                </>
              ) : (
                <>
                  <DatePickerButton
                    label="Start Date"
                    value={startDate}
                    onPress={() => setShowStartDatePicker(true)}
                    placeholder="Select Start Date"
                    mode="date"
                    style={styles.dateButton}
                    containerStyle={{ flex: 1, marginRight: 8 }}
                    displayFormat={(date) => `Start: ${formatDate(date)}`}
                  />
                  <DatePickerButton
                    label="End Date"
                    value={endDate}
                    onPress={() => setShowEndDatePicker(true)}
                    placeholder="Select End Date"
                    mode="date"
                    style={styles.dateButton}
                    containerStyle={{ flex: 1, marginLeft: 8 }}
                    displayFormat={(date) => `End: ${formatDate(date)}`}
                  />
                </>
              )}
            </View>
          )}
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Collection Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>
                {stats.totalCollected > 0 
                  ? formatCurrency(stats.totalCollected) 
                  : '₹0'
                }
              </Text>
              <Text style={styles.statLabel}>Collected</Text>
              {/* Debug info - remove in production */}
              {__DEV__ && (
                <Text style={styles.debugText}>
                  Raw: {stats.totalCollected || 0}
                </Text>
              )}
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f44336' }]}>
                <Ionicons name="time" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalOutstanding)}</Text>
              <Text style={styles.statLabel}>Outstanding</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="calculator" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{formatCurrency(stats.totalExpected)}</Text>
              <Text style={styles.statLabel}>Expected</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="trending-up" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.collectionRate}%</Text>
              <Text style={styles.statLabel}>Collection Rate</Text>
            </View>
          </View>
        </View>

        {/* Monthly Collection Chart */}
        {stats.monthlyCollection.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Monthly Collection Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: stats.monthlyCollection.map(item => item.month),
                  datasets: [{
                    data: stats.monthlyCollection.map(item => item.amount),
                  }]
                }}
                width={Math.max(screenWidth - 40, stats.monthlyCollection.length * 80)}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  barPercentage: 0.7,
                }}
                style={styles.chart}
                showValuesOnTopOfBars={true}
              />
            </ScrollView>
          </View>
        )}

        {/* Payment Mode Distribution */}
        {stats.paymentModeDistribution.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Payment Mode Distribution</Text>
            <PieChart
              data={stats.paymentModeDistribution}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 10]}
              absolute
            />
          </View>
        )}

        {/* Class-wise Collection */}
        {stats.classWiseCollection.length > 0 && (
          <View style={styles.classSection}>
            <Text style={styles.sectionTitle}>Class-wise Collection</Text>
            {stats.classWiseCollection.map((item, index) => (
              <View key={index} style={styles.classCard}>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{item.className}</Text>
                  <Text style={styles.classStats}>
                    {item.count} payments • Avg: {formatCurrency(item.average)}
                  </Text>
                </View>
                <View style={styles.collectionAmount}>
                  <Text style={styles.amountText}>{formatCurrency(item.collected)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Payments */}
        <View style={styles.paymentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="download" size={16} color="#2196F3" />
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={recentPayments}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderPaymentRecord}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="card-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No payment records found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your filters or date range
                </Text>
              </View>
            }
            ListFooterComponent={
              recentHasMore ? (
                <TouchableOpacity
                  onPress={async () => {
                    if (!recentLoadingPage) {
                      setRecentLoadingPage(true);
                      try { await loadRecentPaymentsPage(recentPage + 1, false); } finally { setRecentLoadingPage(false); }
                    }
                  }}
                  style={{ marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2196F3', borderRadius: 6 }}
                >
                  <Text style={{ color: '#fff' }}>{recentLoadingPage ? 'Loading...' : 'Load more'}</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowExportModal(true)}
              accessibilityLabel="Generate report"
              accessibilityHint="Opens export options to generate the fee collection report"
            >
              <Ionicons name="document-text" size={20} color="#2196F3" />
              <Text style={styles.actionButtonText}>Generate Report</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowReminderModal(true)}
              disabled={sendingReminders}
              accessibilityLabel="Send reminders"
              accessibilityHint="Opens options to send reminders to parents or students"
            >
              <Ionicons name="mail" size={20} color="#FF9800" />
              <Text style={styles.actionButtonText}>{sendingReminders ? 'Sending...' : 'Send Reminders'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Bottom spacing for better scroll experience */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      </View>

      {/* Floating Scroll-to-Top Button */}
      {showScrollTop && (
        <Animated.View
          style={[
            styles.scrollToTopButton,
            {
              opacity: scrollTopOpacity,
              transform: [{ scale: scrollTopScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.scrollToTopInner}
            onPress={scrollToTop}
            accessibilityLabel="Scroll to top"
            accessibilityHint="Scrolls the fee collection report back to the top"
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Date Pickers - Only show on mobile platforms */}
      {Platform.OS !== 'web' && showStartDatePicker && (
        <CrossPlatformDatePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'start')}
        />
      )}

      {Platform.OS !== 'web' && showEndDatePicker && (
        <CrossPlatformDatePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, date) => handleDateChange(event, date, 'end')}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Fee Collection Report"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.PDF, EXPORT_FORMATS.CLIPBOARD]}
      />

      {/* Reminder Modal */}
      <Modal
        visible={showReminderModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.reminderOverlay}>
          <View style={styles.reminderModal}>
            <View style={styles.reminderHeader}>
              <Text style={styles.reminderTitle}>Send Fee Reminders</Text>
              <TouchableOpacity style={styles.reminderCloseButton} onPress={() => setShowReminderModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={styles.reminderSubtitle}>Audience</Text>
              <View style={styles.radioRow}>
                {['Parent','Student','Both'].map(opt => (
                  <TouchableOpacity key={opt} style={[styles.radioPill, reminderAudience===opt && styles.radioPillActive]} onPress={() => setReminderAudience(opt)}>
                    <Text style={[styles.radioPillText, reminderAudience===opt && styles.radioPillTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.reminderSubtitle, { marginTop: 12 }]}>Scope</Text>
              <View style={styles.radioRow}>
                {['all','class'].map(opt => (
                  <TouchableOpacity key={opt} style={[styles.radioPill, reminderScope===opt && styles.radioPillActive]} onPress={() => setReminderScope(opt)}>
                    <Text style={[styles.radioPillText, reminderScope===opt && styles.radioPillTextActive]}>{opt === 'all' ? 'All Classes' : 'Specific Class'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {reminderScope === 'class' && (
                <View style={{ marginTop: 8 }}>
                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={reminderClassId} onValueChange={setReminderClassId} style={styles.picker}>
                      {classes.map((cls) => (
                        <Picker.Item key={cls.id} label={`${cls.class_name} ${cls.section}`} value={cls.id} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              <Text style={[styles.reminderSubtitle, { marginTop: 12 }]}>Message</Text>
              <View style={styles.pickerContainer}>
                <TextInput
                  style={{ padding: 12, minHeight: 80, textAlignVertical: 'top' }}
                  multiline
                  value={reminderMessage}
                  onChangeText={setReminderMessage}
                  placeholder="Type reminder message"
                />
              </View>
            </View>

            <View style={styles.reminderActions}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowReminderModal(false)} disabled={sendingReminders}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.exportButton]} onPress={async()=>{ const ok = await handleSendReminders({ skipConfirm: true }); if (ok !== false) setShowReminderModal(false); }} disabled={sendingReminders}>
                <Text style={styles.exportButtonText}>{sendingReminders ? 'Sending...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // Enhanced container with web optimizations
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      position: 'relative',
    }),
  },
  
  // Scrollable area with calculated height
  scrollableContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)', // Account for header
      maxHeight: 'calc(100vh - 60px)',
      overflow: 'hidden',
    }),
  },
  
  // Enhanced ScrollView with web scroll properties
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
      maxHeight: '100%',
      overflowY: 'scroll',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollBehavior: 'smooth',
      scrollbarWidth: 'thin',
      scrollbarColor: '#2196F3 #f5f5f5',
    }),
  },
  
  // Content container properties
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra bottom padding for better UX
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#f44336',
    textAlign: 'center',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tenantInfo: {
    marginTop: 8,
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Tenant Banner Styles
  tenantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E8',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  tenantBannerText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  
  // Debug styles (for development)
  debugText: {
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
    fontFamily: 'monospace',
  },

  // Search Section
  searchSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },

  // Filters Section
  filtersSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  customDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },

  // Statistics Section
  statsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Chart Section
  chartSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },

  // Class Section
  classSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  classStats: {
    fontSize: 12,
    color: '#666',
  },
  collectionAmount: {
    alignItems: 'flex-end',
  },
  // Payments Section
  paymentsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
  },
  exportText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },

  // Payment Record Card
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  feeComponent: {
    fontSize: 12,
    color: '#2196F3',
  },
  paymentInfo: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  paymentModeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  paymentModeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 10,
    color: '#666',
  },

  // Actions Section
  actionsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: 30,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  // Enhanced Scroll Features Styles
  
  // Quick Navigation Styles
  quickNavContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickNavTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickNavButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickNavButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickNavButtonText: {
    fontSize: 11,
    color: '#2196F3',
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Scroll-to-Top Button Styles
  scrollToTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  
  // Bottom spacing for better scroll experience
  bottomSpacing: {
    height: 100,
    backgroundColor: 'transparent',
  },

  // Reminder Modal styles
  reminderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reminderModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  reminderCloseButton: { padding: 4 },
  reminderSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  radioPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
  },
  radioPillActive: {
    borderColor: '#2196F3',
    backgroundColor: '#f3f8ff',
  },
  radioPillText: {
    fontSize: 12,
    color: '#555',
  },
  radioPillTextActive: {
    color: '#1976D2',
    fontWeight: '600',
  },

  reminderActions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
});

export default FeeCollection;
