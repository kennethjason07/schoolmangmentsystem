import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { useTenantAccess } from '../../utils/tenantHelpers';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';

// NEW: Modern Filter System
import ModernFilters from '../../components/ui/ModernFilters';

// Existing imports
import { colors } from '../../../assets/colors';
import AdminAddButton from '../../components/ui/AdminAddButton';
import AddLeaveApplication from './AddLeaveApplication';

// Debug imports
import LogViewer from '../../components/debug/LogViewer';

const { width } = Dimensions.get('window');

const LeaveManagementModern = ({ navigation, route }) => {
  console.log('🎬 [LEAVE_MGMT] Component render started');
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // Existing state
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [debugLogVisible, setDebugLogVisible] = useState(false);

  // NEW: Modern Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilters, setActiveQuickFilters] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    status: 'all',
    leaveType: 'all',
    duration: 'all',
  });
  const [filteredApplications, setFilteredApplications] = useState([]);

  // Get filter counts for badges
  const getFilterCounts = useMemo(() => {
    const pending = leaveApplications.filter(app => app.status === 'Pending').length;
    const approved = leaveApplications.filter(app => app.status === 'Approved').length;
    const rejected = leaveApplications.filter(app => app.status === 'Rejected').length;
    const thisWeek = getThisWeekLeaves().length;
    const sick = leaveApplications.filter(app => app.leaveType === 'Sick').length;
    const casual = leaveApplications.filter(app => app.leaveType === 'Casual').length;
    const earned = leaveApplications.filter(app => app.leaveType === 'Earned').length;
    const emergency = leaveApplications.filter(app => app.leaveType === 'Emergency').length;

    return {
      pending,
      approved,
      rejected,
      thisWeek,
      sick,
      casual,
      earned,
      emergency,
    };
  }, [leaveApplications]);

  // Helper function to get this week's leaves
  const getThisWeekLeaves = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
    
    return leaveApplications.filter(app => {
      const startDate = new Date(app.startDate);
      return startDate >= startOfWeek && startDate <= endOfWeek;
    });
  };

  // NEW: Modern Filter Configuration
  const quickFilters = [
    { 
      key: 'pending', 
      label: 'Pending', 
      icon: 'time-outline', 
      count: getFilterCounts.pending,
      color: colors.warning 
    },
    { 
      key: 'approved', 
      label: 'Approved', 
      icon: 'checkmark-circle-outline', 
      count: getFilterCounts.approved,
      color: colors.success 
    },
    { 
      key: 'rejected', 
      label: 'Rejected', 
      icon: 'close-circle-outline', 
      count: getFilterCounts.rejected,
      color: colors.error 
    },
    { 
      key: 'thisWeek', 
      label: 'This Week', 
      icon: 'calendar-outline', 
      count: getFilterCounts.thisWeek,
      color: colors.primary 
    },
  ];

  const advancedFiltersConfig = [
    {
      key: 'status',
      title: 'Leave Status',
      icon: 'analytics-outline',
      options: [
        { value: 'all', label: 'All Status', icon: 'list-outline' },
        { value: 'pending', label: 'Pending', icon: 'time-outline', count: getFilterCounts.pending },
        { value: 'approved', label: 'Approved', icon: 'checkmark-circle-outline', count: getFilterCounts.approved },
        { value: 'rejected', label: 'Rejected', icon: 'close-circle-outline', count: getFilterCounts.rejected },
      ]
    },
    {
      key: 'leaveType',
      title: 'Leave Type',
      icon: 'medical-outline',
      options: [
        { value: 'all', label: 'All Types', icon: 'apps-outline' },
        { value: 'sick', label: 'Sick Leave', icon: 'medical-outline', count: getFilterCounts.sick },
        { value: 'casual', label: 'Casual Leave', icon: 'happy-outline', count: getFilterCounts.casual },
        { value: 'earned', label: 'Earned Leave', icon: 'trophy-outline', count: getFilterCounts.earned },
        { value: 'emergency', label: 'Emergency Leave', icon: 'alert-circle-outline', count: getFilterCounts.emergency },
      ]
    },
    {
      key: 'duration',
      title: 'Time Period',
      icon: 'calendar-outline',
      options: [
        { value: 'all', label: 'All Time', icon: 'infinite-outline' },
        { value: 'thisWeek', label: 'This Week', icon: 'today-outline' },
        { value: 'thisMonth', label: 'This Month', icon: 'calendar-outline' },
        { value: 'lastMonth', label: 'Last Month', icon: 'chevron-back-outline' },
        { value: 'thisYear', label: 'This Year', icon: 'calendar-number-outline' },
      ]
    }
  ];

  // NEW: Modern Filter Handlers
  const handleFiltersChange = (type, filters) => {
    console.log('🔍 [LEAVE_MGMT] Filter change:', { type, filters });
    switch (type) {
      case 'quick':
        console.log('🔍 [LEAVE_MGMT] Applying quick filters:', filters);
        setActiveQuickFilters(filters);
        applyQuickFilters(filters);
        break;
      case 'advanced':
        console.log('🔍 [LEAVE_MGMT] Applying advanced filters:', filters);
        setAdvancedFilters(filters);
        applyAdvancedFilters(filters);
        break;
      case 'clear':
        console.log('🔍 [LEAVE_MGMT] Clearing all filters');
        clearAllFilters();
        break;
    }
  };

  const handleSearch = (searchText) => {
    console.log('🔍 [LEAVE_MGMT] Search query changed:', searchText);
    setSearchQuery(searchText);
    applyFilters(activeQuickFilters, advancedFilters, searchText);
  };

  const applyQuickFilters = (quickFilters) => {
    applyFilters(quickFilters, advancedFilters, searchQuery);
  };

  const applyAdvancedFilters = (advFilters) => {
    applyFilters(activeQuickFilters, advFilters, searchQuery);
  };

  const clearAllFilters = () => {
    setActiveQuickFilters([]);
    setAdvancedFilters({
      status: 'all',
      leaveType: 'all',
      duration: 'all',
    });
    setSearchQuery('');
    setFilteredApplications(leaveApplications);
  };

  // NEW: Comprehensive Filter Logic
  const applyFilters = (quickFilters = [], advFilters = {}, search = '') => {
    console.log('🔍 [LEAVE_MGMT] Applying filters:', {
      quickFilters,
      advFilters,
      search,
      totalApplications: leaveApplications.length
    });
    
    let filtered = [...leaveApplications];
    console.log('🔍 [LEAVE_MGMT] Starting with applications:', filtered.length);

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      console.log('🔍 [LEAVE_MGMT] Applying search filter:', searchLower);
      
      const beforeSearchCount = filtered.length;
      filtered = filtered.filter(app => 
        app.employeeName?.toLowerCase().includes(searchLower) ||
        app.leaveType?.toLowerCase().includes(searchLower) ||
        app.reason?.toLowerCase().includes(searchLower) ||
        app.status?.toLowerCase().includes(searchLower)
      );
      
      console.log('🔍 [LEAVE_MGMT] After search filter:', filtered.length, '(filtered out:', (beforeSearchCount - filtered.length), ')');
    }

    // Apply quick filters
    if (quickFilters.length > 0) {
      console.log('🔍 [LEAVE_MGMT] Applying quick filters:', quickFilters);
      const beforeQuickCount = filtered.length;
      
      filtered = filtered.filter(app => {
        return quickFilters.some(filterKey => {
          switch (filterKey) {
            case 'pending':
              const isPending = app.status === 'Pending';
              console.log(`🔍 [LEAVE_MGMT] Quick filter 'pending' for ${app.employeeName}: ${isPending} (status: ${app.status})`);
              return isPending;
            case 'approved':
              const isApproved = app.status === 'Approved';
              console.log(`🔍 [LEAVE_MGMT] Quick filter 'approved' for ${app.employeeName}: ${isApproved} (status: ${app.status})`);
              return isApproved;
            case 'rejected':
              const isRejected = app.status === 'Rejected';
              console.log(`🔍 [LEAVE_MGMT] Quick filter 'rejected' for ${app.employeeName}: ${isRejected} (status: ${app.status})`);
              return isRejected;
            case 'thisWeek':
              const now = new Date();
              const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
              const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
              const startDate = new Date(app.startDate);
              const isThisWeek = startDate >= startOfWeek && startDate <= endOfWeek;
              console.log(`🔍 [LEAVE_MGMT] Quick filter 'thisWeek' for ${app.employeeName}: ${isThisWeek} (start: ${app.startDate})`);
              return isThisWeek;
            default:
              return true;
          }
        });
      });
      
      console.log('🔍 [LEAVE_MGMT] After quick filters:', filtered.length, '(filtered out:', (beforeQuickCount - filtered.length), ')');
    }

    // Apply advanced filters
    if (advFilters.status && advFilters.status !== 'all') {
      filtered = filtered.filter(app => app.status?.toLowerCase() === advFilters.status.toLowerCase());
    }

    if (advFilters.leaveType && advFilters.leaveType !== 'all') {
      filtered = filtered.filter(app => app.leaveType?.toLowerCase() === advFilters.leaveType.toLowerCase());
    }

    if (advFilters.duration && advFilters.duration !== 'all') {
      const now = new Date();
      filtered = filtered.filter(app => {
        const startDate = new Date(app.startDate);
        switch (advFilters.duration) {
          case 'thisWeek':
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
            return startDate >= startOfWeek && startDate <= endOfWeek;
          case 'thisMonth':
            return startDate.getMonth() === now.getMonth() && startDate.getFullYear() === now.getFullYear();
          case 'lastMonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return startDate.getMonth() === lastMonth.getMonth() && startDate.getFullYear() === lastMonth.getFullYear();
          case 'thisYear':
            return startDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    }

    console.log('🏁 [LEAVE_MGMT] Final filtered applications count:', filtered.length);
    console.log('🏁 [LEAVE_MGMT] Final filtered applications:', filtered.map(app => ({
      id: app.id,
      employeeName: app.employeeName,
      status: app.status,
      leaveType: app.leaveType,
      startDate: app.startDate
    })));
    
    setFilteredApplications(filtered);
  };

  // Update filtered applications when leave applications change
  useEffect(() => {
    console.log('🔄 [LEAVE_MGMT] Leave applications changed, reapplying filters...');
    console.log('🔄 [LEAVE_MGMT] Current applications count:', leaveApplications.length);
    applyFilters(activeQuickFilters, advancedFilters, searchQuery);
  }, [leaveApplications]);

  // Get auth context for user info
  const { user } = useAuth();

  // Load leave applications from Supabase database
  const loadLeaveApplications = async () => {
    const startTime = performance.now();
    let timeoutId;
    
    try {
      setIsLoading(true);
      console.log('🚀 LeaveManagementModern: Starting optimized data load...');
      
      // ⏰ Set timeout protection
      timeoutId = setTimeout(() => {
        console.warn('⚠️ LeaveManagementModern: Load timeout (10s)');
        throw new Error('Loading timeout - please check your connection');
      }, 10000);
      
      // Use cached tenant ID from enhanced context
      if (!tenantId) {
        console.log('⚠️ LeaveManagementModern: No tenant ID available');
        throw new Error('Unable to determine tenant context. Please contact support.');
      }
      
      if (tenantError) {
        console.error('❌ LeaveManagementModern: Tenant error:', tenantError);
        throw new Error('Tenant error: ' + tenantError);
      }
      
      // Check current session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('📄 [LEAVE_MGMT] Session check:');
      console.log('   - Session exists:', !!session);
      console.log('   - Session user:', session?.user?.email || 'None');
      console.log('   - Session error:', sessionError?.message || 'None');
      
      if (!session) {
        console.log('❌ [LEAVE_MGMT] No active session found');
        Alert.alert('Authentication Error', 'Please log in to view leave applications.');
        return;
      }
      
      console.log('📊 LeaveManagementModern: Querying leave_applications table with tenant filter...');
      
      // Query leave applications from Supabase with joins to get employee names
      const { data: applications, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(name),
          applied_by_user:users!leave_applications_applied_by_fkey(full_name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      console.log('📊 [LEAVE_MGMT] Leave applications query result:');
      console.log('   - Applications found:', applications?.length || 0);
      console.log('   - Error:', error?.message || 'None');
      console.log('   - Error code:', error?.code || 'None');
      console.log('   - Error hint:', error?.hint || 'None');
      console.log('   - Error details:', error?.details || 'None');
      
      if (applications && applications.length > 0) {
        console.log('📄 [LEAVE_MGMT] Sample application structure:', applications[0]);
      }
      console.log('📄 [LEAVE_MGMT] Raw data preview:', JSON.stringify(applications?.slice(0, 2), null, 2));
      
      if (error) {
        console.error('❌ Error loading leave applications:', error);
        
        // Check if it's an RLS error
        if (error.code === '42501') {
          console.log('🔒 RLS blocking leave applications access');
          Alert.alert(
            'Database Access Issue',
            'Unable to load leave applications due to database permissions. Please run the leave RLS fix script or contact support.',
            [
              { text: 'OK' },
              { text: 'Retry', onPress: loadLeaveApplications }
            ]
          );
          return;
        }
        
        Alert.alert(
          'Loading Error',
          'Failed to load leave applications. Please check your internet connection and try again.'
        );
        return;
      }
      
      // Transform database data to match expected format
      console.log('🔄 [LEAVE_MGMT] Transforming database data...');
      const transformedApplications = (applications || []).map((app, index) => {
        console.log(`📝 [LEAVE_MGMT] Processing application ${index + 1}:`, {
          id: app.id,
          teacher: app.teacher,
          applied_by_user: app.applied_by_user,
          start_date: app.start_date,
          end_date: app.end_date,
          leave_type: app.leave_type,
          status: app.status
        });
        
        // Calculate number of days
        const startDate = new Date(app.start_date);
        const endDate = new Date(app.end_date);
        const numberOfDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        const transformed = {
          id: app.id,
          employeeName: app.teacher?.name || app.applied_by_user?.full_name || 'Unknown Employee',
          employeeEmail: app.applied_by_user?.email || 'unknown@email.com',
          leaveType: app.leave_type,
          startDate: app.start_date,
          endDate: app.end_date,
          numberOfDays: numberOfDays,
          reason: app.reason,
          status: app.status || 'Pending',
          appliedDate: app.applied_date || app.created_at
        };
        
        console.log(`✅ [LEAVE_MGMT] Transformed application ${index + 1}:`, transformed);
        return transformed;
      });
      
      clearTimeout(timeoutId);
      
      console.log(`✅ LeaveManagementModern: Successfully loaded ${transformedApplications.length} leave applications`);
      
      setLeaveApplications(transformedApplications);
      setFilteredApplications(transformedApplications);
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ LeaveManagementModern: Data loaded in ${loadTime}ms`);
      
      if (loadTime > 2000) {
        console.warn('⚠️ LeaveManagementModern: Slow loading (>2s). Check network.');
      } else {
        console.log('🚀 LeaveManagementModern: Fast loading achieved!');
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ LeaveManagementModern: Failed to load data:', error.message);
      Alert.alert('Error', error.message || 'An unexpected error occurred while loading leave applications.');
    } finally {
      clearTimeout(timeoutId);
      console.log('🏁 [LEAVE_MGMT] Finished loading leave applications, setting loading to false');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 [LEAVE_MGMT] Component mounted, loading leave applications...');
    loadLeaveApplications();
  }, []);

  const onRefresh = async () => {
    console.log('🔄 [LEAVE_MGMT] Refresh triggered by user pull-to-refresh');
    setRefreshing(true);
    await loadLeaveApplications();
    console.log('✅ [LEAVE_MGMT] Refresh completed');
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return colors.success;
      case 'Rejected':
        return colors.error;
      case 'Pending':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved':
        return 'checkmark-circle';
      case 'Rejected':
        return 'close-circle';
      case 'Pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const handleStatusUpdate = async (applicationId, newStatus) => {
    try {
      console.log('🔄 [LEAVE_MGMT] Updating leave application status:', { applicationId, newStatus });
      console.log('🔄 [LEAVE_MGMT] Current user:', user?.email || 'Not logged in');
      
      // Find the application being updated
      const targetApp = leaveApplications.find(app => app.id === applicationId);
      console.log('🔄 [LEAVE_MGMT] Target application:', targetApp);
      
      // Update in Supabase database
      console.log('🔄 [LEAVE_MGMT] Sending update to Supabase...');
      const { data: updatedData, error } = await supabase
        .from('leave_applications')
        .update({ status: newStatus })
        .eq('id', applicationId)
        .select();
      
      console.log('📊 [LEAVE_MGMT] Update result:');
      console.log('   - Updated data:', updatedData);
      console.log('   - Error:', error?.message || 'None');
      console.log('   - Error code:', error?.code || 'None');
      
      if (error) {
        console.error('❌ [LEAVE_MGMT] Error updating leave status in database:', error);
        Alert.alert('Update Failed', `Failed to update leave application status: ${error.message}`);
        return;
      }
      
      // Update local state
      console.log('🔄 [LEAVE_MGMT] Updating local state...');
      const updatedApplications = leaveApplications.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      );
      
      console.log('📊 [LEAVE_MGMT] Updated applications count:', updatedApplications.length);
      setLeaveApplications(updatedApplications);
      
      console.log('✅ [LEAVE_MGMT] Leave application status updated successfully');
      Alert.alert('Success', `Leave application ${newStatus.toLowerCase()} successfully`);
      
    } catch (error) {
      console.error('💥 [LEAVE_MGMT] Error updating leave status:', error);
      console.error('💥 [LEAVE_MGMT] Error stack:', error.stack);
      Alert.alert('Error', `Failed to update leave application status: ${error.message}`);
    }
  };

  const handleApplicationAdded = async (newApplication) => {
    console.log('➕ [LEAVE_MGMT] New leave application added, refreshing list...');
    console.log('➕ [LEAVE_MGMT] New application data:', newApplication);
    setModalVisible(false);
    // Reload from database to get the latest data
    console.log('🔄 [LEAVE_MGMT] Reloading all applications after new addition...');
    await loadLeaveApplications();
    console.log('✅ [LEAVE_MGMT] Application list refreshed after addition');
  };

  const renderLeaveApplicationItem = ({ item }) => (
    <View style={styles.applicationCard}>
      <View style={styles.applicationHeader}>
        <View style={styles.applicationInfo}>
          <Text style={styles.employeeName}>{item.employeeName}</Text>
          <Text style={styles.leaveType}>{item.leaveType} Leave</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={colors.white} />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.applicationBody}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.dateText}>
            {item.startDate} - {item.endDate}
          </Text>
        </View>
        
        {item.reason && (
          <View style={styles.reasonContainer}>
            <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>
          </View>
        )}
        
        <Text style={styles.daysText}>
          {item.numberOfDays} day{item.numberOfDays !== 1 ? 's' : ''}
        </Text>
      </View>
      
      {item.status === 'Pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleStatusUpdate(item.id, 'Approved')}
          >
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleStatusUpdate(item.id, 'Rejected')}
          >
            <Ionicons name="close" size={18} color={colors.white} />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={80} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>
        {searchQuery || activeQuickFilters.length > 0 || Object.values(advancedFilters).some(v => v !== 'all')
          ? 'No matching applications found'
          : 'No leave applications yet'
        }
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || activeQuickFilters.length > 0 || Object.values(advancedFilters).some(v => v !== 'all')
          ? 'Try adjusting your filters or search terms'
          : 'Leave applications will appear here once submitted'
        }
      </Text>
    </View>
  );

  console.log('🎨 [LEAVE_MGMT] Rendering component with state:', {
    leaveApplicationsCount: leaveApplications.length,
    filteredApplicationsCount: filteredApplications.length,
    isLoading,
    refreshing,
    modalVisible,
    activeQuickFilters,
    searchQuery
  });
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Management</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={async () => {
              console.log('🧪 [LEAVE_MGMT] Quick DB test button pressed');
              try {
                const { data, error } = await supabase.from('leave_applications').select('count', { count: 'exact', head: true });
                const { data: session } = await supabase.auth.getSession();
                Alert.alert('DB Test', `Session: ${session.session ? 'YES' : 'NO'}\nCount: ${data || 'ERROR'}\nError: ${error?.message || 'None'}\nCode: ${error?.code || 'None'}`);
              } catch (e) {
                Alert.alert('DB Test Error', e.message);
              }
            }}
            style={styles.debugButton}
          >
            <Ionicons name="flask" size={20} color={colors.error} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              console.log('🐛 [LEAVE_MGMT] Debug button pressed');
              setDebugLogVisible(true);
            }}
            style={styles.debugButton}
          >
            <Ionicons name="bug" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.countBadge}>{filteredApplications.length}</Text>
        </View>
      </View>

      {/* Debug Status Display - Remove this after debugging */}
      {__DEV__ && (
        <View style={styles.debugStatus}>
          <Text style={styles.debugText}>
            🔍 Debug Status: Loading: {isLoading ? 'YES' : 'NO'} | 
            User: {user?.email?.slice(0, 15) || 'None'} | 
            Apps: {leaveApplications.length} | 
            Filtered: {filteredApplications.length}
          </Text>
        </View>
      )}

      {/* NEW: Modern Filter System - Replaces old filter tabs */}
      <ModernFilters
        quickFilters={quickFilters}
        advancedFilters={advancedFiltersConfig}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        searchPlaceholder="Search leave applications..."
        showFloatingButton={true}
        showQuickFilters={true}
        showSearchBar={true}
        searchValue={searchQuery}
        activeQuickFilters={activeQuickFilters}
        activeAdvancedFilters={advancedFilters}
      />

      <FlatList
        data={filteredApplications}
        keyExtractor={(item) => item.id}
        renderItem={renderLeaveApplicationItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={EmptyState}
      />

      <AdminAddButton
        onPress={() => {
          console.log('➕ [LEAVE_MGMT] Add button pressed, opening modal');
          setModalVisible(true);
        }}
        label="Add Leave Application"
      />

      {/* AddLeaveApplication component */}
      <AddLeaveApplication
        visible={modalVisible}
        onClose={() => {
          console.log('❌ [LEAVE_MGMT] Modal closed');
          setModalVisible(false);
        }}
        onApplicationAdded={handleApplicationAdded}
      />
      
      {/* Debug Log Viewer */}
      <LogViewer
        visible={debugLogVisible}
        onClose={() => setDebugLogVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 40,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debugButton: {
    padding: 4,
  },
  countBadge: {
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  applicationCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  applicationInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  leaveType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  applicationBody: {
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: colors.text,
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  reasonText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  daysText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    flex: 1,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  debugStatus: {
    backgroundColor: colors.warning,
    padding: 8,
    margin: 4,
    borderRadius: 4,
  },
  debugText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '500',
  },
  debugModal: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -50 }],
    width: 200,
    height: 100,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  debugModalText: {
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  debugModalClose: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  debugModalCloseText: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default LeaveManagementModern;
