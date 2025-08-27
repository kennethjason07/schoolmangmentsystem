import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import ModernFilters from '../../components/ui/ModernFilters';
import Colors from '../../constants/Colors';
import { useAuth } from '../../utils/AuthContext';

const { width } = Dimensions.get('window');

const LeaveManagement = ({ navigation }) => {
  const { user, userType, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [teachers, setTeachers] = useState([]);
  
  // Modern filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilters, setActiveQuickFilters] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    status: 'All',
    leaveType: 'all',
    duration: 'all',
  });
  
  // Add leave form state
  const [newLeaveForm, setNewLeaveForm] = useState({
    teacher_id: '',
    leave_type: 'Sick Leave',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
    replacement_teacher_id: '',
    replacement_notes: '',
  });

  // Review modal state
  const [reviewForm, setReviewForm] = useState({
    status: 'Approved',
    admin_remarks: '',
    replacement_teacher_id: '',
    replacement_notes: '',
  });

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);
  const [showReplacementTeacherPicker, setShowReplacementTeacherPicker] = useState(false);

  const statusFilters = ['All', 'Pending', 'Approved', 'Rejected'];
  const leaveTypes = [
    'Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave',
    'Paternity Leave', 'Emergency Leave', 'Personal Leave', 'Medical Leave', 'Other'
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leaveApplications, activeQuickFilters, advancedFilters, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadLeaveApplications(), loadTeachers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load leave management data');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaveApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
          reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
          replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
        `)
        .order('applied_date', { ascending: false });

      if (error) throw error;
      setLeaveApplications(data || []);
    } catch (error) {
      console.error('Error loading leave applications:', error);
    }
  };

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      setTeachers([]); // Set empty array as fallback
    }
  };

  // Modern filter logic
  const applyFilters = () => {
    let filtered = [...leaveApplications];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(app => 
        app.teacher?.name?.toLowerCase().includes(searchLower) ||
        app.leave_type?.toLowerCase().includes(searchLower) ||
        app.reason?.toLowerCase().includes(searchLower) ||
        app.status?.toLowerCase().includes(searchLower)
      );
    }

    // Apply quick filters
    if (activeQuickFilters.length > 0) {
      filtered = filtered.filter(app => {
        return activeQuickFilters.some(filterKey => {
          switch (filterKey) {
            case 'pending':
              return app.status === 'Pending';
            case 'approved':
              return app.status === 'Approved';
            case 'rejected':
              return app.status === 'Rejected';
            case 'thisWeek':
              const now = new Date();
              const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
              const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
              const startDate = parseISO(app.start_date);
              return startDate >= startOfWeek && startDate <= endOfWeek;
            default:
              return true;
          }
        });
      });
    }

    // Apply advanced filters
    if (advancedFilters.status && advancedFilters.status !== 'All') {
      filtered = filtered.filter(app => app.status === advancedFilters.status);
    }

    if (advancedFilters.leaveType && advancedFilters.leaveType !== 'all') {
      filtered = filtered.filter(app => app.leave_type === advancedFilters.leaveType);
    }

    if (advancedFilters.duration && advancedFilters.duration !== 'all') {
      const now = new Date();
      filtered = filtered.filter(app => {
        const startDate = parseISO(app.start_date);
        switch (advancedFilters.duration) {
          case 'thisWeek':
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
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
  
  // Modern filter handlers
  const handleFiltersChange = (type, filters) => {
    switch (type) {
      case 'quick':
        setActiveQuickFilters(filters);
        break;
      case 'advanced':
        setAdvancedFilters(filters);
        break;
      case 'clear':
        clearAllFilters();
        break;
    }
  };

  const handleSearch = (searchText) => {
    setSearchQuery(searchText);
  };

  const clearAllFilters = () => {
    setActiveQuickFilters([]);
    setAdvancedFilters({
      status: 'All',
      leaveType: 'all',
      duration: 'all',
    });
    setSearchQuery('');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleAddLeave = async () => {
    try {
      if (!newLeaveForm.teacher_id || !newLeaveForm.reason.trim()) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (isAfter(newLeaveForm.start_date, newLeaveForm.end_date)) {
        Alert.alert('Error', 'Start date cannot be after end date');
        return;
      }

      // Check authentication using AuthContext
      if (!isAuthenticated || !user) {
        Alert.alert('Authentication Error', 'You must be logged in to add leave applications.');
        navigation.navigate('Login');
        return;
      }
      
      if (userType !== 'Admin') {
        Alert.alert('Authorization Error', 'Only administrators can add leave applications.');
        return;
      }
      
      console.log('Using authenticated user from context:', user.id);

      // Ensure user exists in the users table
      let userId = user.id;
      try {
        // Check if user exists in users table
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (userCheckError && userCheckError.code === 'PGRST116') {
          // User doesn't exist, create it
          console.log('Creating user record in users table...');
          
          // First, get the Admin role ID
          const { data: adminRole, error: roleError } = await supabase
            .from('roles')
            .select('id')
            .eq('role_name', 'Admin')
            .single();
          
          let adminRoleId;
          if (roleError) {
            console.error('Error getting admin role:', roleError);
            // Fallback to role ID 1 (typically Admin)
            adminRoleId = 1;
          } else {
            adminRoleId = adminRole.id;
          }
          
          const { error: createUserError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.full_name || user.email,
              role_id: adminRoleId, // Use role_id instead of role
              created_at: new Date().toISOString()
            });
          
          if (createUserError) {
            console.error('Error creating user:', createUserError);
            // If we can't create the user, we'll have to work around it
            userId = null;
          } else {
            console.log('User record created successfully');
          }
        } else if (userCheckError) {
          console.error('Error checking user existence:', userCheckError);
          userId = null;
        }
      } catch (userError) {
        console.error('Error handling user record:', userError);
        userId = null;
      }

      const leaveData = {
        teacher_id: newLeaveForm.teacher_id,
        leave_type: newLeaveForm.leave_type,
        start_date: format(newLeaveForm.start_date, 'yyyy-MM-dd'),
        end_date: format(newLeaveForm.end_date, 'yyyy-MM-dd'),
        reason: newLeaveForm.reason.trim(),
        applied_by: userId,
        replacement_teacher_id: newLeaveForm.replacement_teacher_id || null,
        replacement_notes: newLeaveForm.replacement_notes.trim() || null,
        status: 'Approved', // Admin added leaves are auto-approved
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        admin_remarks: `Added by admin on behalf of teacher (Admin ID: ${user.id})`,
      };

      const { error } = await supabase
        .from('leave_applications')
        .insert([leaveData]);

      if (error) throw error;

      Alert.alert('Success', 'Leave application added successfully');
      setShowAddLeaveModal(false);
      resetAddLeaveForm();
      await loadLeaveApplications();
    } catch (error) {
      console.error('Error adding leave:', error);
      Alert.alert('Error', 'Failed to add leave application');
    }
  };

  const handleReviewLeave = async () => {
    try {
      if (!reviewForm.admin_remarks.trim()) {
        Alert.alert('Error', 'Please add admin remarks');
        return;
      }

      // Check authentication using AuthContext
      if (!isAuthenticated || !user) {
        Alert.alert('Authentication Error', 'You must be logged in to review leave applications.');
        navigation.navigate('Login');
        return;
      }
      
      if (userType && userType.toLowerCase() !== 'admin') {
        Alert.alert('Authorization Error', 'Only administrators can review leave applications.');
        return;
      }

      // Check leave balance before approving (only for trackable leave types)
      if (reviewForm.status === 'Approved' && 
          ['Sick Leave', 'Casual Leave', 'Earned Leave'].includes(selectedLeave.leave_type)) {
        
        console.log('🔍 Checking leave balance before approval...');
        
        try {
          // Get teacher's current leave balance
          const { data: balance, error: balanceError } = await supabase
            .from('teacher_leave_balance')
            .select('*')
            .eq('teacher_id', selectedLeave.teacher_id)
            .eq('academic_year', selectedLeave.academic_year)
            .single();

          let currentUsed = 0;
          let totalAllowed = 0;
          
          if (!balanceError && balance) {
            // Get current usage and total for the specific leave type
            switch (selectedLeave.leave_type) {
              case 'Sick Leave':
                currentUsed = balance.sick_leave_used;
                totalAllowed = balance.sick_leave_total;
                break;
              case 'Casual Leave':
                currentUsed = balance.casual_leave_used;
                totalAllowed = balance.casual_leave_total;
                break;
              case 'Earned Leave':
                currentUsed = balance.earned_leave_used;
                totalAllowed = balance.earned_leave_total;
                break;
            }
            
            const availableLeave = totalAllowed - currentUsed;
            
            if (selectedLeave.total_days > availableLeave) {
              Alert.alert(
                'Insufficient Leave Balance',
                `Teacher has only ${availableLeave} ${selectedLeave.leave_type.toLowerCase()} days remaining, but applied for ${selectedLeave.total_days} days.\n\nOptions:`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Reject Application', 
                    style: 'destructive',
                    onPress: () => {
                      setReviewForm({ ...reviewForm, status: 'Rejected', admin_remarks: reviewForm.admin_remarks + ` [Insufficient leave balance: ${availableLeave} days available]` });
                    }
                  },
                  {
                    text: 'Admin Override - Approve Anyway',
                    style: 'default',
                    onPress: () => {
                      Alert.alert(
                        'Admin Override Confirmation',
                        `You are about to approve a leave request that exceeds the teacher's available balance by ${selectedLeave.total_days - availableLeave} days.\n\nThis will result in negative leave balance. Continue?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Override and Approve',
                            style: 'destructive',
                            onPress: () => {
                              setReviewForm({ 
                                ...reviewForm, 
                                status: 'Approved', 
                                admin_remarks: reviewForm.admin_remarks + ` [ADMIN OVERRIDE: Approved despite insufficient balance - ${availableLeave} days available, ${selectedLeave.total_days} days requested]` 
                              });
                              console.log('⚠️ Admin override: Proceeding with approval despite insufficient balance');
                            }
                          }
                        ]
                      );
                    }
                  }
                ]
              );
              return;
            }
          } else {
            // No balance record exists, create one with default values
            console.log('📝 Creating default balance record for teacher...');
            
            const { error: createBalanceError } = await supabase
              .from('teacher_leave_balance')
              .insert({
                teacher_id: selectedLeave.teacher_id,
                academic_year: selectedLeave.academic_year,
                // Default values are set by the schema
              });
            
            if (createBalanceError) {
              console.error('Error creating balance record:', createBalanceError);
              Alert.alert(
                'Balance Record Error',
                'Could not create leave balance record. Please ensure teacher has a balance record before approving leave.',
                [{ text: 'OK' }]
              );
              return;
            }
            
            console.log('✅ Balance record created with defaults');
          }
        } catch (balanceCheckError) {
          console.error('Error checking leave balance:', balanceCheckError);
          Alert.alert(
            'Balance Check Failed',
            'Could not verify leave balance. Do you want to proceed anyway?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Proceed', onPress: () => console.log('Proceeding without balance check') }
            ]
          );
          return;
        }
      }

      const updateData = {
        status: reviewForm.status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_remarks: reviewForm.admin_remarks.trim(),
        replacement_teacher_id: reviewForm.replacement_teacher_id || null,
        replacement_notes: reviewForm.replacement_notes.trim() || null,
      };

      const { error } = await supabase
        .from('leave_applications')
        .update(updateData)
        .eq('id', selectedLeave.id);

      if (error) throw error;

      // Send notification to teacher silently in background
      if (selectedLeave?.teacher_id) {
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('linked_teacher_id', selectedLeave.teacher_id)
            .single();

          if (!userError && userData) {
            const baseMessage = reviewForm.status === 'Approved' 
              ? `Your ${selectedLeave.leave_type} request has been approved.`
              : `Your ${selectedLeave.leave_type} request has been rejected.`;

            const fullMessage = reviewForm.admin_remarks.trim() 
              ? `${baseMessage} Remarks: ${reviewForm.admin_remarks.trim()}`
              : baseMessage;

            await supabase
              .from('notifications')
              .insert({
                message: fullMessage,
                type: 'General',
                delivery_mode: 'InApp',
                delivery_status: 'Sent',
                sent_by: user.id,
                created_at: new Date().toISOString()
              });
          }
        } catch (notificationError) {
          // Log error but don't show to user - notifications are secondary
          console.error('Notification error:', notificationError);
        }
      }

      Alert.alert('Success', `Leave application ${reviewForm.status.toLowerCase()} successfully`);
      setShowReviewModal(false);
      setSelectedLeave(null);
      resetReviewForm();
      await loadLeaveApplications();
    } catch (error) {
      console.error('Error reviewing leave:', error);
      Alert.alert('Error', 'Failed to review leave application');
    }
  };

  const resetAddLeaveForm = () => {
    setNewLeaveForm({
      teacher_id: '',
      leave_type: 'Sick Leave',
      start_date: new Date(),
      end_date: new Date(),
      reason: '',
      replacement_teacher_id: '',
      replacement_notes: '',
    });
  };

  const resetReviewForm = () => {
    setReviewForm({
      status: 'Approved',
      admin_remarks: '',
      replacement_teacher_id: '',
      replacement_notes: '',
    });
  };

  const openReviewModal = (leave) => {
    setSelectedLeave(leave);
    setReviewForm({
      status: 'Approved',
      admin_remarks: '',
      replacement_teacher_id: leave.replacement_teacher_id || '',
      replacement_notes: leave.replacement_notes || '',
    });
    setShowReviewModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#FF9800';
      case 'Approved': return '#4CAF50';
      case 'Rejected': return '#F44336';
      case 'Cancelled': return '#9E9E9E';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return 'time';
      case 'Approved': return 'checkmark-circle';
      case 'Rejected': return 'close-circle';
      case 'Cancelled': return 'ban';
      default: return 'help-circle';
    }
  };

  const renderLeaveApplication = ({ item }) => {
    const startDate = parseISO(item.start_date);
    const endDate = parseISO(item.end_date);
    
    return (
      <View style={styles.leaveCard}>
        <View style={styles.leaveHeader}>
          <View style={styles.teacherInfo}>
            <Text style={styles.teacherName}>{item.teacher?.name || 'Unknown Teacher'}</Text>
            <Text style={styles.leaveType}>{item.leave_type}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.leaveDetails}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar" size={16} color="#666" />
            <Text style={styles.dateText}>
              {format(startDate, 'MMM dd, yyyy')} - {format(endDate, 'MMM dd, yyyy')} 
              ({item.total_days} {item.total_days === 1 ? 'day' : 'days'})
            </Text>
          </View>
          
          <View style={styles.reasonRow}>
            <Ionicons name="document-text" size={16} color="#666" />
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>

          {item.replacement_teacher && (
            <View style={styles.replacementRow}>
              <Ionicons name="person" size={16} color="#666" />
              <Text style={styles.replacementText}>
                Replacement: {item.replacement_teacher.name}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Applied: {format(parseISO(item.applied_date), 'MMM dd, yyyy')}
            </Text>
            {item.reviewed_at && (
              <Text style={styles.metaText}>
                Reviewed: {format(parseISO(item.reviewed_at), 'MMM dd, yyyy')}
              </Text>
            )}
          </View>
        </View>

        {item.status === 'Pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => openReviewModal(item)}
            >
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.admin_remarks && (
          <View style={styles.remarksSection}>
            <Text style={styles.remarksLabel}>Admin Remarks:</Text>
            <Text style={styles.remarksText}>{item.admin_remarks}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Leave Management" navigation={navigation} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading leave applications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Leave Management" navigation={navigation} showBack={true} />
      
      {/* Modern Filters */}
      <ModernFilters
        quickFilters={[
          { 
            key: 'pending', 
            label: 'Pending', 
            icon: 'time-outline', 
            count: leaveApplications.filter(app => app.status === 'Pending').length,
            color: '#FF9800' 
          },
          { 
            key: 'approved', 
            label: 'Approved', 
            icon: 'checkmark-circle-outline', 
            count: leaveApplications.filter(app => app.status === 'Approved').length,
            color: '#4CAF50' 
          },
          { 
            key: 'rejected', 
            label: 'Rejected', 
            icon: 'close-circle-outline', 
            count: leaveApplications.filter(app => app.status === 'Rejected').length,
            color: '#F44336' 
          },
          { 
            key: 'thisWeek', 
            label: 'This Week', 
            icon: 'calendar-outline', 
            count: leaveApplications.filter(app => {
              const now = new Date();
              const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
              const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
              const startDate = parseISO(app.start_date);
              return startDate >= startOfWeek && startDate <= endOfWeek;
            }).length,
            color: Colors.primary 
          },
        ]}
        advancedFilters={[
          {
            key: 'status',
            title: 'Leave Status',
            icon: 'analytics-outline',
            options: [
              { value: 'All', label: 'All Status', icon: 'list-outline' },
              { value: 'Pending', label: 'Pending', icon: 'time-outline', count: leaveApplications.filter(app => app.status === 'Pending').length },
              { value: 'Approved', label: 'Approved', icon: 'checkmark-circle-outline', count: leaveApplications.filter(app => app.status === 'Approved').length },
              { value: 'Rejected', label: 'Rejected', icon: 'close-circle-outline', count: leaveApplications.filter(app => app.status === 'Rejected').length },
            ]
          },
          {
            key: 'leaveType',
            title: 'Leave Type',
            icon: 'medical-outline',
            options: [
              { value: 'all', label: 'All Types', icon: 'apps-outline' },
              ...leaveTypes.map(type => ({
                value: type, 
                label: type, 
                count: leaveApplications.filter(app => app.leave_type === type).length
              }))
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
        ]}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        searchPlaceholder="Search leave applications..."
        showFloatingButton={false}
        showQuickFilters={true}
        showSearchBar={true}
        searchValue={searchQuery}
        activeQuickFilters={activeQuickFilters}
        activeAdvancedFilters={advancedFilters}
      />

      {/* Add Leave Button */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          onPress={() => setShowAddLeaveModal(true)}
          style={styles.addButtonTouchable}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButton}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Leave for Teacher</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Leave Applications List */}
      <FlatList
        data={filteredApplications}
        renderItem={renderLeaveApplication}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>No leave applications found</Text>
            <Text style={styles.emptySubtext}>
              {selectedStatus === 'All' 
                ? 'No leave applications have been submitted yet'
                : `No ${selectedStatus.toLowerCase()} leave applications`}
            </Text>
          </View>
        }
      />

      {/* Add Leave Modal */}
      <Modal
        visible={showAddLeaveModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Leave for Teacher</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddLeaveModal(false);
                resetAddLeaveForm();
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Teacher Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Teacher *</Text>
              <TouchableOpacity
                style={styles.customDropdown}
                onPress={() => setShowTeacherPicker(true)}
              >
                <Text style={[styles.dropdownText, !newLeaveForm.teacher_id && styles.placeholderText]}>
                  {newLeaveForm.teacher_id 
                    ? teachers.find(t => t.id === newLeaveForm.teacher_id)?.name || 'Select Teacher'
                    : 'Select Teacher'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Leave Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Leave Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newLeaveForm.leave_type}
                  style={styles.nativePicker}
                  onValueChange={(itemValue) => 
                    setNewLeaveForm({ ...newLeaveForm, leave_type: itemValue })
                  }
                >
                  {leaveTypes.map(type => (
                    <Picker.Item
                      key={type}
                      label={type}
                      value={type}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Date Selection */}
            <View style={styles.dateRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.inputLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.dateInputText}>
                    {format(newLeaveForm.start_date, 'MMM dd, yyyy')}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateInputGroup}>
                <Text style={styles.inputLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateInputText}>
                    {format(newLeaveForm.end_date, 'MMM dd, yyyy')}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reason */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                value={newLeaveForm.reason}
                onChangeText={(text) => setNewLeaveForm({ ...newLeaveForm, reason: text })}
                placeholder="Enter reason for leave..."
                placeholderTextColor="#999"
              />
            </View>

            {/* Replacement Teacher */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Replacement Teacher (Optional)</Text>
              <TouchableOpacity
                style={styles.customDropdown}
                onPress={() => setShowReplacementTeacherPicker(true)}
              >
                <Text style={[styles.dropdownText, !newLeaveForm.replacement_teacher_id && styles.placeholderText]}>
                  {newLeaveForm.replacement_teacher_id 
                    ? teachers.find(t => t.id === newLeaveForm.replacement_teacher_id)?.name || 'No Replacement'
                    : 'No Replacement'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Replacement Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Replacement Notes</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={2}
                value={newLeaveForm.replacement_notes}
                onChangeText={(text) => setNewLeaveForm({ ...newLeaveForm, replacement_notes: text })}
                placeholder="Instructions for replacement teacher..."
                placeholderTextColor="#999"
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddLeaveModal(false);
                resetAddLeaveForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddLeave}
            >
              <Text style={styles.saveButtonText}>Add Leave</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={newLeaveForm.start_date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowStartDatePicker(false);
              if (date) {
                setNewLeaveForm({ ...newLeaveForm, start_date: date });
              }
            }}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={newLeaveForm.end_date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowEndDatePicker(false);
              if (date) {
                setNewLeaveForm({ ...newLeaveForm, end_date: date });
              }
            }}
          />
        )}

        {/* Teacher Picker Modal */}
        {showTeacherPicker && (
          <Modal
            visible={showTeacherPicker}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Select Teacher</Text>
                  <TouchableOpacity onPress={() => setShowTeacherPicker(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerModalList}>
                  {teachers.map(teacher => (
                    <TouchableOpacity
                      key={teacher.id}
                      style={[
                        styles.pickerModalItem,
                        newLeaveForm.teacher_id === teacher.id && styles.pickerModalItemSelected
                      ]}
                      onPress={() => {
                        setNewLeaveForm({ ...newLeaveForm, teacher_id: teacher.id });
                        setShowTeacherPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerModalItemText,
                        newLeaveForm.teacher_id === teacher.id && styles.pickerModalItemTextSelected
                      ]}>
                        {teacher.name}
                      </Text>
                      {newLeaveForm.teacher_id === teacher.id && (
                        <Ionicons name="checkmark" size={20} color="#2196F3" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Replacement Teacher Picker Modal */}
        {showReplacementTeacherPicker && (
          <Modal
            visible={showReplacementTeacherPicker}
            animationType="slide"
            transparent={true}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Select Replacement Teacher</Text>
                  <TouchableOpacity onPress={() => setShowReplacementTeacherPicker(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.pickerModalList}>
                  <TouchableOpacity
                    style={[
                      styles.pickerModalItem,
                      !newLeaveForm.replacement_teacher_id && styles.pickerModalItemSelected
                    ]}
                    onPress={() => {
                      setNewLeaveForm({ ...newLeaveForm, replacement_teacher_id: '' });
                      setShowReplacementTeacherPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerModalItemText,
                      !newLeaveForm.replacement_teacher_id && styles.pickerModalItemTextSelected
                    ]}>
                      No Replacement
                    </Text>
                    {!newLeaveForm.replacement_teacher_id && (
                      <Ionicons name="checkmark" size={20} color="#2196F3" />
                    )}
                  </TouchableOpacity>
                  {teachers
                    .filter(t => t.id !== newLeaveForm.teacher_id)
                    .map(teacher => (
                      <TouchableOpacity
                        key={teacher.id}
                        style={[
                          styles.pickerModalItem,
                          newLeaveForm.replacement_teacher_id === teacher.id && styles.pickerModalItemSelected
                        ]}
                        onPress={() => {
                          setNewLeaveForm({ ...newLeaveForm, replacement_teacher_id: teacher.id });
                          setShowReplacementTeacherPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerModalItemText,
                          newLeaveForm.replacement_teacher_id === teacher.id && styles.pickerModalItemTextSelected
                        ]}>
                          {teacher.name}
                        </Text>
                        {newLeaveForm.replacement_teacher_id === teacher.id && (
                          <Ionicons name="checkmark" size={20} color="#2196F3" />
                        )}
                      </TouchableOpacity>
                    ))
                  }
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* Review Leave Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review Leave Application</Text>
            <TouchableOpacity
              onPress={() => {
                setShowReviewModal(false);
                setSelectedLeave(null);
                resetReviewForm();
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedLeave && (
            <ScrollView style={styles.modalContent}>
              {/* Leave Details */}
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>Leave Details</Text>
                <Text style={styles.reviewText}>Teacher: {selectedLeave.teacher?.name}</Text>
                <Text style={styles.reviewText}>Type: {selectedLeave.leave_type}</Text>
                <Text style={styles.reviewText}>
                  Duration: {format(parseISO(selectedLeave.start_date), 'MMM dd, yyyy')} - {format(parseISO(selectedLeave.end_date), 'MMM dd, yyyy')}
                  ({selectedLeave.total_days} {selectedLeave.total_days === 1 ? 'day' : 'days'})
                </Text>
                <Text style={styles.reviewText}>Reason: {selectedLeave.reason}</Text>
              </View>

              {/* Decision */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Decision</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={reviewForm.status}
                    style={styles.nativePicker}
                    onValueChange={(itemValue) => 
                      setReviewForm({ ...reviewForm, status: itemValue })
                    }
                  >
                    <Picker.Item label="Approve" value="Approved" />
                    <Picker.Item label="Reject" value="Rejected" />
                  </Picker>
                </View>
              </View>

              {/* Admin Remarks */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admin Remarks *</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  value={reviewForm.admin_remarks}
                  onChangeText={(text) => setReviewForm({ ...reviewForm, admin_remarks: text })}
                  placeholder="Enter your remarks..."
                  placeholderTextColor="#999"
                />
              </View>

              {reviewForm.status === 'Approved' && (
                <>
                  {/* Replacement Teacher */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Replacement Teacher (Optional)</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={reviewForm.replacement_teacher_id}
                        style={styles.nativePicker}
                        onValueChange={(itemValue) => 
                          setReviewForm({ ...reviewForm, replacement_teacher_id: itemValue })
                        }
                      >
                        <Picker.Item label="No Replacement" value="" />
                        {teachers
                          .filter(t => t.id !== selectedLeave.teacher_id)
                          .map(teacher => (
                            <Picker.Item
                              key={teacher.id}
                              label={teacher.name}
                              value={teacher.id}
                            />
                          ))
                        }
                      </Picker>
                    </View>
                  </View>

                  {/* Replacement Notes */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Replacement Notes</Text>
                    <TextInput
                      style={styles.textArea}
                      multiline
                      numberOfLines={2}
                      value={reviewForm.replacement_notes}
                      onChangeText={(text) => setReviewForm({ ...reviewForm, replacement_notes: text })}
                      placeholder="Instructions for replacement teacher..."
                      placeholderTextColor="#999"
                    />
                  </View>
                </>
              )}
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowReviewModal(false);
                setSelectedLeave(null);
                resetReviewForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: getStatusColor(reviewForm.status) }]}
              onPress={handleReviewLeave}
            >
              <Text style={styles.saveButtonText}>
                {reviewForm.status === 'Approved' ? 'Approve' : 'Reject'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterTab: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    elevation: 3,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  addButtonContainer: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  listContainer: {
    flexGrow: 1,
    padding: 15,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  leaveType: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  leaveDetails: {
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  replacementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replacementText: {
    fontSize: 14,
    color: '#4CAF50',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  remarksSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  remarksLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  remarksText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  nativePicker: {
    color: '#333',
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 15,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  reviewSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pickerModalList: {
    maxHeight: 400,
  },
  pickerModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  pickerModalItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  pickerModalItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pickerModalItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
});

export default LeaveManagement;
