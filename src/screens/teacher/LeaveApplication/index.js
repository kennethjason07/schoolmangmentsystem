import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  Dimensions
} from 'react-native';
import Header from '../../../components/Header';
// 🚀 ENHANCED: Updated imports for enhanced tenant system
import { supabase } from '../../../utils/supabase';
import { format, parseISO, isAfter, differenceInDays } from 'date-fns';
import { createLeaveRequestNotificationForAdmins } from '../../../services/notificationService';
import { useTenantAccess } from '../../../contexts/TenantContext';
import { tenantDatabase, createTenantQuery, getCachedTenantId } from '../../../utils/tenantHelpers';
import LeaveApplicationHeader from './components/LeaveApplicationHeader';
import LeaveApplicationList from './components/LeaveApplicationList';
import LeaveApplicationModal from './components/LeaveApplicationModal';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const LeaveApplication = ({ navigation }) => {
  const { 
    user,
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    error: tenantError 
  } = useTenantAccess();
  
  // 🚀 ENHANCED: Tenant validation helper
  const validateTenantReadiness = async () => {
    try {
      if (!user || !isReady) {
        console.error('❌ LeaveApplication: User or tenant not ready');
        return {
          isValid: false,
          error: 'System is loading. Please wait a moment.'
        };
      }
      
      const tenantId = getCachedTenantId();
      if (!tenantId) {
        console.error('❌ LeaveApplication: Cached tenant ID not available');
        return {
          isValid: false,
          error: 'Tenant system not ready. Please try again in a moment.'
        };
      }
      
      console.log('✅ LeaveApplication: Tenant validation successful:', tenantId);
      return {
        isValid: true,
        tenantId
      };
    } catch (error) {
      console.error('❌ LeaveApplication: Tenant validation error:', error);
      return {
        isValid: false,
        error: 'System error. Please contact support.'
      };
    }
  };
  
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Application form state
  const [applicationForm, setApplicationForm] = useState({
    leave_type: 'Sick Leave',
    start_date: new Date(),
    end_date: new Date(),
    reason: '',
    attachment_url: null,
  });

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showLeaveTypeDropdown, setShowLeaveTypeDropdown] = useState(false);

  const leaveTypes = [
    'Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave',
    'Paternity Leave', 'Emergency Leave', 'Personal Leave', 'Medical Leave', 'Other'
  ];

  // Responsive settings - conditional settings for web version
  const scrollingSettings = {
    web: {
      showsVerticalScrollIndicator: true,
      showsHorizontalScrollIndicator: false,
      nestedScrollEnabled: true,
      bounces: false,
      bouncesZoom: false,
      scrollEventThrottle: 16,
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'on-drag',
      decelerationRate: 'fast',
      alwaysBounceVertical: false,
      overScrollMode: 'never',
      automaticallyAdjustKeyboardInsets: false,
      contentInsetAdjustmentBehavior: 'automatic'
    },
    mobile: {
      showsVerticalScrollIndicator: false,
      showsHorizontalScrollIndicator: false,
      nestedScrollEnabled: true,
      bounces: true,
      bouncesZoom: false,
      scrollEventThrottle: 16,
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'on-drag',
      decelerationRate: 'normal',
      alwaysBounceVertical: true,
      overScrollMode: 'auto',
      automaticallyAdjustKeyboardInsets: true,
      contentInsetAdjustmentBehavior: 'automatic'
    }
  };

  // Get current scrolling settings based on platform
  const currentScrollSettings = isWeb ? scrollingSettings.web : scrollingSettings.mobile;

  // Effects
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Reload leave applications when teacherProfile changes
    if (teacherProfile?.linked_teacher_id) {
      loadMyLeaves();
    }
  }, [teacherProfile]);

  // Data loading functions
  const loadData = async () => {
    try {
      setLoading(true);
      // Load teacher profile first, then the dependent data will load via useEffect
      await loadTeacherProfile();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load leave application data');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          linked_teacher_id,
          teacher:teachers!users_linked_teacher_id_fkey(id, name)
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (!data.linked_teacher_id) {
        throw new Error('User is not linked to a teacher profile');
      }

      setTeacherProfile(data);
    } catch (error) {
      console.error('Error loading teacher profile:', error);
      Alert.alert('Error', 'Failed to load teacher profile. Please contact admin.');
    }
  };

  // 🚀 ENHANCED: Updated loadMyLeaves to use enhanced tenant system
  const loadMyLeaves = async () => {
    const startTime = performance.now();
    
    try {
      if (!teacherProfile?.linked_teacher_id) return;
      
      console.log('🚀 Enhanced TeacherLeaveApplication: Starting loadMyLeaves...');
      
      // ✨ Validate tenant readiness
      const { isValid, tenantId, error: validationError } = await validateTenantReadiness();
      if (!isValid) {
        console.error('❌ Enhanced TeacherLeaveApplication: Tenant validation failed:', validationError);
        return;
      }

      // 🚀 ENHANCED: Use createTenantQuery for automatic tenant filtering
      console.log('📊 Enhanced TeacherLeaveApplication: Creating tenant-aware query...');
      const { data, error } = await createTenantQuery(tenantId, 'leave_applications', `
        *,
        applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
        reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
        replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
      `)
        .eq('teacher_id', teacherProfile.linked_teacher_id)
        .order('applied_date', { ascending: false });

      if (error) throw error;
      
      setMyLeaves(data || []);
      
      // Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ Enhanced TeacherLeaveApplication: My leaves loaded in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ Enhanced TeacherLeaveApplication: Error loading my leaves:', error.message);
    }
  };

  // 🚀 ENHANCED: Updated refresh handler to use tenant validation
  const onRefresh = useCallback(async () => {
    const { isValid } = await validateTenantReadiness();
    if (!isValid) {
      return;
    }
    
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [teacherProfile]);

  // Leave application handlers
  const handleApplyLeave = async () => {
    try {
      if (!applicationForm.reason.trim()) {
        Alert.alert('Error', 'Please enter the reason for leave');
        return;
      }

      if (isAfter(applicationForm.start_date, applicationForm.end_date)) {
        Alert.alert('Error', 'Start date cannot be after end date');
        return;
      }

      // Calculate total days
      const totalDays = differenceInDays(applicationForm.end_date, applicationForm.start_date) + 1;

      await submitApplication(totalDays);
    } catch (error) {
      console.error('Error applying for leave:', error);
      Alert.alert('Error', 'Failed to submit leave application');
    }
  };

  // 🚀 ENHANCED: Updated submitApplication to use enhanced tenant system
  const submitApplication = async (totalDays) => {
    const startTime = performance.now();
    
    try {
      setSubmitting(true);
      console.log('🚀 Enhanced TeacherLeaveApplication: Starting submitApplication...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // ✨ Validate tenant readiness
      const { isValid, tenantId, error: validationError } = await validateTenantReadiness();
      if (!isValid) {
        throw new Error(validationError);
      }

      const leaveData = {
        teacher_id: teacherProfile.linked_teacher_id,
        leave_type: applicationForm.leave_type,
        start_date: format(applicationForm.start_date, 'yyyy-MM-dd'),
        end_date: format(applicationForm.end_date, 'yyyy-MM-dd'),
        reason: applicationForm.reason.trim(),
        applied_by: user.id,
        attachment_url: applicationForm.attachment_url,
        // Note: tenant_id will be added automatically by tenantDatabase.create
      };

      // 🚀 ENHANCED: Use tenantDatabase.create for automatic tenant isolation
      console.log('💾 Enhanced TeacherLeaveApplication: Creating leave via tenantDatabase...');
      const { data: result, error: createError } = await tenantDatabase.create(
        'leave_applications',
        leaveData
      );
      
      if (createError) {
        throw new Error(`Failed to create leave application record: ${createError.message}`);
      }
      
      if (!result) {
        throw new Error('Failed to create leave application record');
      }

      // Create notification for admins about the new leave request
      try {
        console.log('📧 Creating notification for admins about new leave request...');
        
        // Use the proper notification service to create admin notifications with recipients
        const notificationResult = await createLeaveRequestNotificationForAdmins(
          {
            leave_type: applicationForm.leave_type,
            start_date: format(applicationForm.start_date, 'MMM dd, yyyy'),
            end_date: format(applicationForm.end_date, 'MMM dd, yyyy'),
            reason: applicationForm.reason.trim(),
            total_days: totalDays
          },
          teacherProfile,
          user.id
        );

        if (notificationResult.success) {
          console.log(`✅ Admin notification created successfully for ${notificationResult.recipientCount} admin users`);
        } else {
          console.error('❌ Failed to create admin notification:', notificationResult.error);
        }
      } catch (notificationError) {
        console.error('❌ Error in notification creation process:', notificationError);
        // Don't fail the entire operation if notification fails
      }

      Alert.alert('Success', 'Leave application submitted successfully. Administrators have been notified and you will be notified once it is reviewed.');
      setShowApplicationForm(false);
      resetApplicationForm();
      await loadMyLeaves();
    } catch (error) {
      console.error('Error submitting leave application:', error);
      Alert.alert('Error', 'Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  const resetApplicationForm = () => {
    setApplicationForm({
      leave_type: 'Sick Leave',
      start_date: new Date(),
      end_date: new Date(),
      reason: '',
      attachment_url: null,
    });
    setShowLeaveTypeDropdown(false);
  };

  // Status helpers
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

  return (
    <View style={styles.container}>
      <Header title="Leave Application" showBack={true} navigation={navigation} />
      
      <LeaveApplicationHeader
        onApplyPress={() => setShowApplicationForm(true)}
        scrollSettings={currentScrollSettings}
      />
      
      <LeaveApplicationList
        myLeaves={myLeaves}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        teacherProfile={teacherProfile}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        scrollSettings={currentScrollSettings}
      />
      
      <LeaveApplicationModal
        visible={showApplicationForm}
        onClose={() => {
          setShowApplicationForm(false);
          setShowLeaveTypeDropdown(false);
          resetApplicationForm();
        }}
        applicationForm={applicationForm}
        setApplicationForm={setApplicationForm}
        leaveTypes={leaveTypes}
        showStartDatePicker={showStartDatePicker}
        setShowStartDatePicker={setShowStartDatePicker}
        showEndDatePicker={showEndDatePicker}
        setShowEndDatePicker={setShowEndDatePicker}
        showLeaveTypeDropdown={showLeaveTypeDropdown}
        setShowLeaveTypeDropdown={setShowLeaveTypeDropdown}
        submitting={submitting}
        onSubmit={handleApplyLeave}
        scrollSettings={currentScrollSettings}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  }
});

export default LeaveApplication;
