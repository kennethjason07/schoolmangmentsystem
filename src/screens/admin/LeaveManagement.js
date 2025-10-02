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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import Header from '../../components/Header';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';
import { supabase } from '../../utils/supabase';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import ModernFilters from '../../components/ui/ModernFilters';
import Colors from '../../constants/Colors';
import { useAuth } from '../../utils/AuthContext';
import { createLeaveStatusNotificationForTeacher } from '../../services/notificationService';
import LogViewer from '../../components/debug/LogViewer';
import { useTenantAccess, tenantDatabase } from '../../utils/tenantHelpers';

const { width } = Dimensions.get('window');

const LeaveManagement = ({ navigation }) => {
  const { user, userType, isAuthenticated } = useAuth();
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
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
    // Automatic debug info logging
    logDebugInfo();
  }, []);

  // Realtime subscription for leave applications filtered by tenant_id
  useEffect(() => {
    if (!isReady || !tenantId) return;

    console.log('📡 Subscribing to realtime leave_applications for tenant:', tenantId);
    const channel = supabase
      .channel(`admin-leave-applications-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_applications', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          try {
            const { eventType, new: newRow, old: oldRow } = payload;
            console.log('📡 Realtime event:', eventType, newRow?.id || oldRow?.id);

            setLeaveApplications((prev) => {
              let list = Array.isArray(prev) ? [...prev] : [];
              if (eventType === 'INSERT' && newRow) {
                const teacherObj = teachers.find(t => t.id === newRow.teacher_id) || null;
                const replacementObj = teachers.find(t => t.id === newRow.replacement_teacher_id) || null;
                const start = newRow.start_date ? new Date(newRow.start_date) : null;
                const end = newRow.end_date ? new Date(newRow.end_date) : null;
                const totalDays = newRow.total_days ?? (start && end ? (Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1) : undefined);

                const enriched = {
                  ...newRow,
                  total_days: totalDays,
                  teacher: teacherObj ? { id: teacherObj.id, name: teacherObj.name } : undefined,
                  replacement_teacher: replacementObj ? { id: replacementObj.id, name: replacementObj.name } : undefined,
                };
                list = list.filter(a => a.id !== newRow.id);
                return [enriched, ...list];
              }

              if (eventType === 'UPDATE' && newRow) {
                const idx = list.findIndex(a => a.id === newRow.id);
                const teacherObj = teachers.find(t => t.id === newRow.teacher_id) || null;
                const replacementObj = teachers.find(t => t.id === newRow.replacement_teacher_id) || null;
                const merged = {
                  ...(idx >= 0 ? list[idx] : {}),
                  ...newRow,
                  teacher: teacherObj ? { id: teacherObj.id, name: teacherObj.name } : (idx >= 0 ? list[idx].teacher : undefined),
                  replacement_teacher: replacementObj ? { id: replacementObj.id, name: replacementObj.name } : (idx >= 0 ? list[idx].replacement_teacher : undefined),
                };
                if (idx >= 0) {
                  list[idx] = merged;
                } else {
                  list.unshift(merged);
                }
                return [...list];
              }

              if (eventType === 'DELETE' && oldRow) {
                return list.filter(a => a.id !== oldRow.id);
              }

              return list;
            });
          } catch (err) {
            console.error('Realtime update error:', err);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('📡 Unsubscribing realtime leave_applications channel for tenant:', tenantId);
      supabase.removeChannel(channel);
    };
  }, [isReady, tenantId, teachers]);
  
  const logDebugInfo = async () => {
    try {
      console.log('🧪 [ADMIN_LEAVE] === ENHANCED TENANT DEBUG INFO ===');
      console.log('🧪 [ADMIN_LEAVE] Debug Summary:');
      console.log('   - Tenant ID (cached):', tenantId || 'NONE');
      console.log('   - Tenant ready:', isReady);
      console.log('   - Tenant loading:', tenantLoading);
      console.log('   - Tenant name:', tenantName || 'NONE');
      console.log('   - Tenant error:', tenantError || 'None');
      console.log('🧪 [ADMIN_LEAVE] === END ENHANCED DEBUG INFO ===');
    } catch (error) {
      console.error('🧪 [ADMIN_LEAVE] Enhanced debug info error:', error.message);
    }
  };

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
    const startTime = performance.now();

    try {
      console.log('🚀 LeaveManagement: Starting enhanced tenant data load...');

      // Ensure tenant context is ready
      if (tenantLoading || !isReady) {
        console.log('🔄 [ENHANCED-TENANT] Tenant context not ready, skipping load');
        return;
      }
      if (tenantError) {
        console.error('❌ [ENHANCED-TENANT] Tenant error detected:', tenantError);
        Alert.alert('Tenant Error', String(tenantError));
        return;
      }

      console.log('🏢 LeaveManagement: Using enhanced tenant system, tenant ID:', tenantId || 'NONE');

      // Narrowed projection and optional server-side filters
      const selectColumns = `
        id, teacher_id, leave_type, start_date, end_date, reason, status,
        applied_date, reviewed_at, admin_remarks, replacement_teacher_id, replacement_notes, total_days,
        teacher:teachers!leave_applications_teacher_id_fkey(id, name),
        applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
        reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
        replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
      `;

      // Build server-side filters (optional)
      const baseFilters = {};
      // Status from advanced or quick filters
      if (advancedFilters?.status && advancedFilters.status !== 'All') {
        baseFilters.status = advancedFilters.status;
      } else if (activeQuickFilters?.includes('pending')) {
        baseFilters.status = 'Pending';
      } else if (activeQuickFilters?.includes('approved')) {
        baseFilters.status = 'Approved';
      } else if (activeQuickFilters?.includes('rejected')) {
        baseFilters.status = 'Rejected';
      }
      // Leave type from advanced filters
      if (advancedFilters?.leaveType && advancedFilters.leaveType !== 'all') {
        baseFilters.leave_type = advancedFilters.leaveType;
      }

      const optionFilters = {};
      // Duration to date range (based on start_date)
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const setRange = (start, end) => {
        optionFilters.start_date = { gte: fmt(start), lte: fmt(end) };
      };

      if (advancedFilters?.duration && advancedFilters.duration !== 'all') {
        if (advancedFilters.duration === 'thisWeek') {
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
          setRange(startOfWeek, endOfWeek);
        } else if (advancedFilters.duration === 'thisMonth') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          setRange(startOfMonth, endOfMonth);
        } else if (advancedFilters.duration === 'lastMonth') {
          const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
          setRange(startLast, endLast);
        } else if (advancedFilters.duration === 'thisYear') {
          const startYear = new Date(now.getFullYear(), 0, 1);
          const endYear = new Date(now.getFullYear(), 11, 31);
          setRange(startYear, endYear);
        }
      } else if (activeQuickFilters?.includes('thisWeek')) {
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
        setRange(startOfWeek, endOfWeek);
      }

      const { data, error } = await tenantDatabase.read(
        'leave_applications',
        baseFilters,
        selectColumns,
        { orderBy: { column: 'applied_date', ascending: false }, filters: optionFilters }
      );

      if (error) {
        console.error('❌ [ADMIN_LEAVE] Enhanced tenant query error:', error);
        Alert.alert('Loading Error', 'Failed to load leave applications. Please try again.');
        throw error;
      }

      console.log(`✅ LeaveManagement: Loaded ${data?.length || 0} applications`);
      setLeaveApplications(data || []);

      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ LeaveManagement: Data loaded in ${loadTime}ms`);
    } catch (error) {
      console.error('❌ LeaveManagement: Load failed:', error.message);
      Alert.alert('Error', error.message || 'Failed to load leave applications');
    }
  };

  const loadTeachers = async () => {
    try {
      console.log('🚀 LeaveManagement: Loading teachers with enhanced tenant system...');
      
      if (!isReady) {
        console.log('🔄 LeaveManagement loadTeachers: Tenant context not ready');
        setTeachers([]);
        return;
      }
      if (tenantError) {
        console.error('❌ LeaveManagement loadTeachers: Tenant error:', tenantError);
        setTeachers([]);
        return;
      }

      const { data, error } = await tenantDatabase.read(
        'teachers',
        {},
        'id, name'
      );

      if (error) throw error;

      setTeachers((data || []).map(t => ({ id: t.id, name: t.name })));
      console.log(`✅ LeaveManagement: Loaded ${(data || []).length} teachers`);
    } catch (error) {
      console.error('❌ LeaveManagement: Enhanced tenant teachers load error:', error.message);
      setTeachers([]);
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
      console.log('🚀 [DEBUG] handleAddLeave started');
      console.log('🚀 [DEBUG] Form data:', newLeaveForm);
      console.log('🚀 [DEBUG] Teachers loaded:', teachers.length);
      console.log('🚀 [DEBUG] User type:', userType);
      console.log('🚀 [DEBUG] Is authenticated:', isAuthenticated);
      console.log('🚀 [DEBUG] Tenant ready:', isReady);
      console.log('🚀 [DEBUG] Tenant error:', tenantError);
      
      // Check tenant readiness first
      if (!isReady) {
        console.log('❌ [DEBUG] Tenant context not ready');
        Alert.alert('System Not Ready', 'Please wait for the system to initialize and try again.');
        return;
      }
      
      if (tenantError) {
        console.log('❌ [DEBUG] Tenant error present:', tenantError);
        Alert.alert('System Error', tenantError);
        return;
      }
      
      // Basic form validation
      if (!newLeaveForm.teacher_id || !newLeaveForm.reason.trim()) {
        console.log('❌ [DEBUG] Form validation failed - missing teacher_id or reason');
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (isAfter(newLeaveForm.start_date, newLeaveForm.end_date)) {
        Alert.alert('Error', 'Start date cannot be after end date');
        return;
      }

      // Check authentication
      if (!isAuthenticated || !user) {
        Alert.alert('Authentication Error', 'You must be logged in to add leave applications.');
        navigation.navigate('Login');
        return;
      }
      
      // Check user type (more flexible)
      const normalizedUserType = userType?.toLowerCase();
      if (normalizedUserType !== 'admin') {
        console.log('⚠️ LeaveManagement: Access denied for userType:', userType, 'normalized:', normalizedUserType);
        Alert.alert('Authorization Error', 'Only administrators can add leave applications through this interface.');
        return;
      }
      
      // Calculate total days
      const startDate = newLeaveForm.start_date;
      const endDate = newLeaveForm.end_date;
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // Prepare leave application data
      // Check if this should be auto-approved (admin creating leave for teacher)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      // Auto-approve if:
      // 1. Admin is creating leave for teacher (not backdated and not too far future)
      // 2. Start date is today or future (not backdated)
      // 3. Start date is within 30 days (not too far future)
      const shouldAutoApprove = startDateObj >= today && startDateObj <= thirtyDaysFromNow;
      
      const leaveApplicationData = {
        teacher_id: newLeaveForm.teacher_id,
        leave_type: newLeaveForm.leave_type,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        reason: newLeaveForm.reason.trim(),
        replacement_teacher_id: newLeaveForm.replacement_teacher_id || null,
        replacement_notes: newLeaveForm.replacement_notes?.trim() || null,
        applied_by: user.id,
        applied_date: new Date().toISOString().split('T')[0],
        status: shouldAutoApprove ? 'Approved' : 'Pending',
        ...(shouldAutoApprove && {
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_remarks: `Auto-approved: Leave created by admin (${user.email}) on behalf of teacher`
        })
      };
      
      console.log('📝 LeaveManagement: Creating leave application with enhanced tenant system...');
      
      // 🚀 Use enhanced tenant database helper
      const { data: newLeaveApplication, error } = await tenantDatabase.create(
        'leave_applications',
        leaveApplicationData
      );
      
      if (error) {
        console.error('❌ Enhanced tenant leave creation failed:', error);
        Alert.alert('Error', error.message || 'Failed to create leave application');
        return;
      }
      
      console.log('✅ Leave application created successfully with enhanced tenant system:', newLeaveApplication.id);
      
      // If auto-approved, send notification to teacher immediately
      if (shouldAutoApprove) {
        try {
          console.log('📧 Sending auto-approval notification to teacher...');
          const notificationResult = await createLeaveStatusNotificationForTeacher(
            {
              teacher_id: newLeaveForm.teacher_id,
              leave_type: newLeaveForm.leave_type,
              start_date: format(startDate, 'MMM dd, yyyy'),
              end_date: format(endDate, 'yyyy-MM-dd')
            },
            'Approved',
            `Auto-approved: Leave created by admin on your behalf`,
            user.id
          );
          if (!notificationResult.success) {
            console.error('❌ Failed to send auto-approval notification:', notificationResult.error);
          }
        } catch (notificationError) {
          console.error('❌ Error sending auto-approval notification:', notificationError);
        }
        Alert.alert('Success', `Leave application added and automatically approved! The teacher has been notified.`);
      } else {
        Alert.alert('Success', 'Leave application added successfully and is pending review.');
      }

      // Optimistically update UI without reloading
      const teacherObj = teachers.find(t => t.id === newLeaveForm.teacher_id) || null;
      const replacementObj = teachers.find(t => t.id === newLeaveForm.replacement_teacher_id) || null;
      const optimisticApp = {
        id: newLeaveApplication.id,
        teacher_id: newLeaveForm.teacher_id,
        leave_type: newLeaveForm.leave_type,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        reason: newLeaveForm.reason.trim(),
        replacement_teacher_id: newLeaveForm.replacement_teacher_id || null,
        replacement_notes: newLeaveForm.replacement_notes?.trim() || null,
        applied_by: user.id,
        applied_date: new Date().toISOString().split('T')[0],
        status: shouldAutoApprove ? 'Approved' : 'Pending',
        reviewed_by: shouldAutoApprove ? user.id : null,
        reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
        admin_remarks: shouldAutoApprove ? `Auto-approved: Leave created by admin (${user.email}) on behalf of teacher` : null,
        total_days: totalDays,
        teacher: teacherObj ? { id: teacherObj.id, name: teacherObj.name } : null,
        replacement_teacher: replacementObj ? { id: replacementObj.id, name: replacementObj.name } : null,
      };
      setLeaveApplications(prev => [optimisticApp, ...(prev || [])]);

      setShowAddLeaveModal(false);
      resetAddLeaveForm();
      
    } catch (error) {
      console.error('Error adding leave:', error);
      Alert.alert('Error', 'Failed to add leave application: ' + (error.message || 'Unknown error'));
    }
  };

  const handleReviewLeave = async () => {
    try {
      console.log('🚀 LeaveManagement: Starting handleReviewLeave with enhanced tenant system...');
      
      // Wait for tenant context
      if (!isReady) {
        Alert.alert('Error', 'Tenant context not ready for reviewing leave');
        return;
      }
      
      if (tenantError) {
        Alert.alert('Error', 'Tenant error: ' + tenantError);
        return;
      }

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
      
      // More flexible user type checking for leave review
      const normalizedUserType = userType?.toLowerCase();
      if (normalizedUserType !== 'admin') {
        console.log('⚠️ LeaveManagement Review: Access denied for userType:', userType, 'normalized:', normalizedUserType);
        Alert.alert('Authorization Error', 'Only administrators can review leave applications.');
        return;
      }

      const updateData = {
        status: reviewForm.status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_remarks: reviewForm.admin_remarks.trim(),
        replacement_teacher_id: reviewForm.replacement_teacher_id || null,
        replacement_notes: reviewForm.replacement_notes.trim() || null,
      };

      console.log('✏️ LeaveManagement: Updating leave application with enhanced tenant system...');
      
      // 🚀 Use enhanced tenant database helper for update
      const { error } = await tenantDatabase.update(
        'leave_applications',
        selectedLeave.id,
        updateData
      );

      if (error) {
        console.error('❌ Enhanced tenant leave review update failed:', error);
        throw error;
      }
      
      console.log('✅ Leave application reviewed successfully with enhanced tenant system');

      // Send notification to teacher using notification service
      if (selectedLeave?.teacher_id) {
        try {
          const notificationResult = await createLeaveStatusNotificationForTeacher(
            selectedLeave,
            reviewForm.status,
            reviewForm.admin_remarks.trim(),
            user.id
          );
          
          if (notificationResult.success) {
            console.log('✅ Leave status notification sent to teacher successfully');
          } else {
            console.error('❌ Failed to send leave status notification:', notificationResult.error);
          }
        } catch (notificationError) {
          // Log error but don't show to user - notifications are secondary
          console.error('Notification error:', notificationError);
        }
      }

      Alert.alert('Success', `Leave application ${reviewForm.status.toLowerCase()} successfully`);

      // Optimistically update UI without reloading
      setLeaveApplications(prev => (prev || []).map(app => {
        if (app.id !== selectedLeave.id) return app;
        const replacementObj = teachers.find(t => t.id === reviewForm.replacement_teacher_id) || null;
        return {
          ...app,
          status: reviewForm.status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_remarks: reviewForm.admin_remarks.trim(),
          replacement_teacher_id: reviewForm.replacement_teacher_id || null,
          replacement_notes: reviewForm.replacement_notes.trim() || null,
          reviewed_by_user: { id: user.id, full_name: user.email },
          replacement_teacher: replacementObj ? { id: replacementObj.id, name: replacementObj.name } : null,
        };
      }));

      setShowReviewModal(false);
      setSelectedLeave(null);
      resetReviewForm();
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
        
        {item.status === 'Approved' && item.admin_remarks && item.admin_remarks.includes('Auto-approved') && (
          <View style={styles.autoApprovedSection}>
            <View style={styles.autoApprovedBadge}>
              <Ionicons name="checkmark-done-circle" size={16} color="#4CAF50" />
              <Text style={styles.autoApprovedText}>Auto-Approved by Admin</Text>
            </View>
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
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFFFFF" 
        translucent={false}
      />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Management (Admin)</Text>
          <View style={styles.headerRight}>
            {/* Count badge removed */}
          </View>
        </View>
      
      {/* Floating Refresh Button - Web Only */}
      <FloatingRefreshButton
        onPress={onRefresh}
        refreshing={refreshing}
        bottom={80}
      />
      
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

      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {/* Add Leave Button */}
        <View style={styles.addButtonContainer}>
          <TouchableOpacity
            onPress={() => {
              console.log('🔄 [DEBUG] Add Leave button pressed');
              setShowAddLeaveModal(true);
            }}
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
        <View style={styles.leaveListSection}>
          <FlatList
            data={filteredApplications}
            renderItem={renderLeaveApplication}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
            getItemLayout={Platform.OS === 'android' ? undefined : (data, index) => (
              { length: 200, offset: 200 * index, index }
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>No leave applications found</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery || activeQuickFilters.length > 0 || advancedFilters.status !== 'All' || advancedFilters.leaveType !== 'all' || advancedFilters.duration !== 'all'
                    ? 'No applications match your current filters'
                    : 'No leave applications have been submitted yet'}
                </Text>
                {(searchQuery || activeQuickFilters.length > 0 || advancedFilters.status !== 'All' || advancedFilters.leaveType !== 'all' || advancedFilters.duration !== 'all') && (
                  <TouchableOpacity 
                    style={styles.clearFiltersButton} 
                    onPress={clearAllFilters}
                  >
                    <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListHeaderComponent={
              loading ? null : (
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>
                    Showing {filteredApplications.length} of {leaveApplications.length} applications
                  </Text>
                </View>
              )
            }
          />
        </View>
        </ScrollView>
      </View>

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
            {Platform.OS === 'web' ? (
              <View style={styles.dateRow}>
                <View style={styles.dateInputGroup}>
                  <CrossPlatformDatePicker
                    label="Start Date"
                    value={newLeaveForm.start_date}
                    onChange={(event, date) => {
                      if (date) {
                        setNewLeaveForm({ ...newLeaveForm, start_date: date });
                      }
                    }}
                    mode="date"
                    placeholder="Select Start Date"
                  />
                </View>
                <View style={styles.dateInputGroup}>
                  <CrossPlatformDatePicker
                    label="End Date"
                    value={newLeaveForm.end_date}
                    onChange={(event, date) => {
                      if (date) {
                        setNewLeaveForm({ ...newLeaveForm, end_date: date });
                      }
                    }}
                    mode="date"
                    placeholder="Select End Date"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.dateRow}>
                <View style={styles.dateInputGroup}>
                  <DatePickerButton
                    label="Start Date"
                    value={newLeaveForm.start_date}
                    onPress={() => setShowStartDatePicker(true)}
                    placeholder="Select Start Date"
                    mode="date"
                  />
                </View>
                <View style={styles.dateInputGroup}>
                  <DatePickerButton
                    label="End Date"
                    value={newLeaveForm.end_date}
                    onPress={() => setShowEndDatePicker(true)}
                    placeholder="Select End Date"
                    mode="date"
                  />
                </View>
              </View>
            )}

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
              onPress={() => {
                console.log('💾 [DEBUG] Save button pressed in modal');
                handleAddLeave();
              }}
            >
              <Text style={styles.saveButtonText}>Add Leave</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Pickers - Only show on mobile platforms */}
        {Platform.OS !== 'web' && showStartDatePicker && (
          <CrossPlatformDatePicker
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

        {Platform.OS !== 'web' && showEndDatePicker && (
          <CrossPlatformDatePicker
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxHeight: '100vh',
      overflowY: 'auto',
    }),
  },
  scrollContent: {
    paddingBottom: 100,
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
    }),
  },
  leaveListSection: {
    flex: 1,
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
    lineHeight: 20,
  },
  autoApprovedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8',
  },
  autoApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  autoApprovedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
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
  scrollWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  addButtonTouchable: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignSelf: 'center',
  },
  clearFiltersText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
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
    color: '#333',
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
    backgroundColor: '#2196F3',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  debugStatus: {
    backgroundColor: '#FF9800',
    padding: 8,
    margin: 4,
    borderRadius: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default LeaveManagement;
