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
import AsyncStorage from '@react-native-async-storage/async-storage';

// NEW: Modern Filter System
import ModernFilters from '../../components/ui/ModernFilters';

// Existing imports
import { colors } from '../../../assets/colors';
import AdminAddButton from '../../components/ui/AdminAddButton';
import AddLeaveApplication from './AddLeaveApplication';

const { width } = Dimensions.get('window');

const LeaveManagementModern = ({ navigation, route }) => {
  // Existing state
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

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
    switch (type) {
      case 'quick':
        setActiveQuickFilters(filters);
        applyQuickFilters(filters);
        break;
      case 'advanced':
        setAdvancedFilters(filters);
        applyAdvancedFilters(filters);
        break;
      case 'clear':
        clearAllFilters();
        break;
    }
  };

  const handleSearch = (searchText) => {
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
    let filtered = [...leaveApplications];

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(app => 
        app.employeeName?.toLowerCase().includes(searchLower) ||
        app.leaveType?.toLowerCase().includes(searchLower) ||
        app.reason?.toLowerCase().includes(searchLower) ||
        app.status?.toLowerCase().includes(searchLower)
      );
    }

    // Apply quick filters
    if (quickFilters.length > 0) {
      filtered = filtered.filter(app => {
        return quickFilters.some(filterKey => {
          switch (filterKey) {
            case 'pending':
              return app.status === 'Pending';
            case 'approved':
              return app.status === 'Approved';
            case 'rejected':
              return app.status === 'Rejected';
            case 'thisWeek':
              const now = new Date();
              const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
              const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
              const startDate = new Date(app.startDate);
              return startDate >= startOfWeek && startDate <= endOfWeek;
            default:
              return true;
          }
        });
      });
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

    setFilteredApplications(filtered);
  };

  // Update filtered applications when leave applications change
  useEffect(() => {
    applyFilters(activeQuickFilters, advancedFilters, searchQuery);
  }, [leaveApplications]);

  // Existing functions (loadLeaveApplications, etc.)
  const loadLeaveApplications = async () => {
    try {
      setIsLoading(true);
      const storedApplications = await AsyncStorage.getItem('leaveApplications');
      if (storedApplications) {
        const applications = JSON.parse(storedApplications);
        setLeaveApplications(applications);
        setFilteredApplications(applications); // Initial load
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaveApplications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaveApplications();
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
      const updatedApplications = leaveApplications.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      );
      
      setLeaveApplications(updatedApplications);
      await AsyncStorage.setItem('leaveApplications', JSON.stringify(updatedApplications));
      
      Alert.alert('Success', `Leave application ${newStatus.toLowerCase()} successfully`);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update leave application status');
    }
  };

  const handleApplicationAdded = (newApplication) => {
    const updatedApplications = [...leaveApplications, newApplication];
    setLeaveApplications(updatedApplications);
    setModalVisible(false);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Management</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>{filteredApplications.length}</Text>
        </View>
      </View>

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
        onPress={() => setModalVisible(true)}
        label="Add Leave Application"
      />

      <AddLeaveApplication
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onApplicationAdded={handleApplicationAdded}
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
    alignItems: 'center',
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
});

export default LeaveManagementModern;
