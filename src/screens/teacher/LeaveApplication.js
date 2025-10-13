import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { format, parseISO, isAfter, differenceInDays } from 'date-fns';
import { createLeaveRequestNotificationForAdmins } from '../../services/notificationService';
import { 
  useTenantAccess, 
  tenantDatabase, 
  createTenantQuery, 
  getCachedTenantId 
} from '../../utils/tenantHelpers';
import { submitLeaveApplication, loadLeaveApplications } from '../../utils/leaveApplicationUtils';
import { useAuth } from '../../utils/AuthContext';

// Table names for enhanced tenant system
const TABLES = {
  USERS: 'users',
  TEACHERS: 'teachers',
  LEAVE_APPLICATIONS: 'leave_applications'
};

const { width } = Dimensions.get('window');

const LeaveApplication = ({ navigation }) => {
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState(null);

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
  const [submitting, setSubmitting] = useState(false);

  const leaveTypes = [
    'Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave',
    'Paternity Leave', 'Emergency Leave', 'Personal Leave', 'Medical Leave', 'Other'
  ];

  // Enhanced tenant validation helper
  const validateTenant = async () => {
    const cachedTenantId = await getCachedTenantId();
    if (!cachedTenantId) {
      throw new Error('Tenant context not available. Please refresh and try again.');
    }
    return { valid: true, tenantId: cachedTenantId };
  };

  useEffect(() => {
    if (user && isReady) {
      loadData();
    }
  }, [user, isReady]);

  useEffect(() => {
    // Reload leave applications when teacherProfile changes and tenant is ready
    if (teacherProfile?.linked_teacher_id && isReady) {
      loadMyLeaves();
    }
  }, [teacherProfile, isReady]);

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
      console.log('🚀 Enhanced tenant system: Starting loadTeacherProfile...');
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate tenant context
      const tenantValidation = await validateTenant();
      if (!tenantValidation.valid) {
        throw new Error('Tenant validation failed');
      }

      const effectiveTenantId = tenantValidation.tenantId;
      console.log('📊 Enhanced tenant system: Using tenant ID:', effectiveTenantId);

      // Use enhanced tenant query for user profile
      const userQuery = createTenantQuery(effectiveTenantId, TABLES.USERS)
        .select(`
          id,
          full_name,
          linked_teacher_id,
          teacher:teachers!users_linked_teacher_id_fkey(id, name)
        `)
        .eq('id', user.id)
        .single();

      const { data, error } = await userQuery;
      if (error) {
        console.error('❌ Enhanced tenant system: Error loading teacher profile:', error);
        throw error;
      }
      
      if (!data.linked_teacher_id) {
        throw new Error('User is not linked to a teacher profile');
      }

      setTeacherProfile(data);
      console.log('✅ Enhanced tenant system: Teacher profile loaded successfully');
      
    } catch (error) {
      console.error('❌ Enhanced tenant system: Error in loadTeacherProfile:', error);
      Alert.alert('Error', 'Failed to load teacher profile. Please contact admin.');
    }
  };

  const loadMyLeaves = async () => {
    const startTime = performance.now();
    
    try {
      if (!teacherProfile?.linked_teacher_id) {
        console.log('⚠️ Enhanced tenant system: No teacher profile available for leaves loading');
        return;
      }
      
      console.log('🚀 Enhanced tenant system: Starting loadMyLeaves...');
      
      // Validate tenant context using enhanced system
      const tenantValidation = await validateTenant();
      if (!tenantValidation.valid) {
        throw new Error('Tenant validation failed for leave applications');
      }

      const effectiveTenantId = tenantValidation.tenantId;
      console.log('📊 Enhanced tenant system: Loading leaves with tenant ID:', effectiveTenantId);

      // Use enhanced tenant query for leave applications
      const leavesQuery = createTenantQuery(effectiveTenantId, TABLES.LEAVE_APPLICATIONS)
        .select(`
          *,
          applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
          reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
          replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
        `)
        .eq('teacher_id', teacherProfile.linked_teacher_id)
        .order('applied_date', { ascending: false });

      const { data, error } = await leavesQuery;
      if (error) {
        console.error('❌ Enhanced tenant system: Error in leave applications query:', error);
        throw error;
      }
      
      setMyLeaves(data || []);
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ Enhanced tenant system: My leaves loaded in ${loadTime}ms (${(data || []).length} applications)`);
      
    } catch (error) {
      console.error('❌ Enhanced tenant system: Error loading my leaves:', error.message);
      // Don't show alert for this error as it might be called multiple times
    }
  };


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [teacherProfile]);

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

  const submitApplication = async (totalDays) => {
    try {
      setSubmitting(true);
      console.log('🚀 Enhanced tenant system: Starting submitApplication...');

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate tenant context
      const tenantValidation = await validateTenant();
      if (!tenantValidation.valid) {
        throw new Error('Tenant validation failed for leave submission');
      }

      const effectiveTenantId = tenantValidation.tenantId;
      console.log('📊 Enhanced tenant system: Submitting leave with tenant ID:', effectiveTenantId);

      // Prepare application data for the utility
      const applicationData = {
        leave_type: applicationForm.leave_type,
        start_date: format(applicationForm.start_date, 'yyyy-MM-dd'),
        end_date: format(applicationForm.end_date, 'yyyy-MM-dd'),
        reason: applicationForm.reason.trim(),
        attachment_url: applicationForm.attachment_url
      };
      
      // Use the utility to submit leave application with enhanced tenant system
      const result = await submitLeaveApplication(applicationData, user, { id: effectiveTenantId });
      
      if (!result.success) {
        console.error('❌ Enhanced tenant system: Leave submission failed:', result.error);
        Alert.alert('Error', result.error);
        return;
      }
      
      console.log('✅ Enhanced tenant system: Leave application submitted successfully');

      // Create notification for admins about the new leave request
      try {
        console.log('📧 Creating notification for admins about new leave request...');
        
        const notificationResult = await createLeaveRequestNotificationForAdmins(
          {
            leave_type: applicationForm.leave_type,
            start_date: format(applicationForm.start_date, 'MMM dd, yyyy'),
            end_date: format(applicationForm.end_date, 'MMM dd, yyyy'),
            reason: applicationForm.reason.trim(),
            total_days: totalDays
          },
          teacherProfile,
          user.id,
          effectiveTenantId // Pass tenant ID from enhanced tenant system
        );

        if (notificationResult.success) {
          console.log(`✅ Admin notification created successfully for ${notificationResult.recipientCount} admin users from tenant: ${notificationResult.tenantId}`);
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
      Alert.alert('Error', 'Failed to submit leave application: ' + (error.message || 'Unknown error'));
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
          <View style={styles.leaveInfo}>
            <Text style={styles.leaveType}>{item.leave_type}</Text>
            <Text style={styles.leaveDates}>
              {format(startDate, 'MMM dd, yyyy')} - {format(endDate, 'MMM dd, yyyy')}
              ({item.total_days} {item.total_days === 1 ? 'day' : 'days'})
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.leaveDetails}>
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

        {item.admin_remarks && (
          <View style={styles.remarksSection}>
            <Text style={styles.remarksLabel}>Admin Remarks:</Text>
            <Text style={styles.remarksText}>{item.admin_remarks}</Text>
          </View>
        )}

        {item.replacement_notes && (
          <View style={styles.replacementNotesSection}>
            <Text style={styles.replacementNotesLabel}>Replacement Instructions:</Text>
            <Text style={styles.replacementNotesText}>{item.replacement_notes}</Text>
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
      </View>
    );
  };

  // Enhanced loading state with tenant context
  if (!isReady || (loading && !refreshing)) {
    const loadingText = !isReady ? 
      'Initializing secure tenant context...' : 
      'Loading leave application data...';
    const subText = !isReady ? 
      'Setting up secure access to your leave applications' : 
      'Please wait while we fetch your leave history';
      
    return (
      <View style={styles.container}>
        <Header title="Leave Application" showBack={true} navigation={navigation} />
        <View style={styles.enhancedLoadingContainer}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="shield-checkmark" size={48} color="#2196F3" />
            <ActivityIndicator size="large" color="#2196F3" style={styles.spinner} />
          </View>
          <Text style={styles.enhancedLoadingText}>{loadingText}</Text>
          <Text style={styles.enhancedLoadingSubtext}>{subText}</Text>
          {!isReady && (
            <View style={styles.tenantStatusContainer}>
              <Text style={styles.tenantStatusText}>
                Tenant Status: {tenantError ? 'Error' : 'Initializing...'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Enhanced error state with tenant context
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="Leave Application" showBack={true} navigation={navigation} />
        <View style={styles.enhancedErrorContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.enhancedErrorText}>Tenant Access Error</Text>
          <Text style={styles.enhancedErrorSubtext}>
            Unable to establish secure tenant context. This affects your ability to access leave applications.
          </Text>
          <View style={styles.errorDetailsContainer}>
            <Text style={styles.errorDetailsLabel}>Error Details:</Text>
            <Text style={styles.errorDetailsText}>{tenantError}</Text>
            <Text style={styles.errorDetailsLabel}>Tenant ID:</Text>
            <Text style={styles.errorDetailsText}>{tenantId || 'Not available'}</Text>
            <Text style={styles.errorDetailsLabel}>Ready Status:</Text>
            <Text style={styles.errorDetailsText}>{isReady ? 'Ready' : 'Not Ready'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setLoading(true);
              loadData();
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!teacherProfile) {
    return (
      <View style={styles.container}>
        <Header title="Leave Application" showBack={true} navigation={navigation} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>
            You don't have permission to access leave management. Please contact your administrator.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Leave Application" showBack={true} navigation={navigation} />
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContainer}
      >

        {/* Apply Leave Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => setShowApplicationForm(true)}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.applyButtonText}>Apply for Leave</Text>
          </TouchableOpacity>
        </View>

        {/* My Leave Applications */}
        <View style={styles.leavesSection}>
          <Text style={styles.sectionTitle}>My Leave Applications</Text>
          
          {myLeaves.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>No leave applications yet</Text>
              <Text style={styles.emptySubtext}>
                Your submitted leave applications will appear here
              </Text>
            </View>
          ) : (
            <FlatList
              data={myLeaves}
              renderItem={renderLeaveApplication}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.leavesList}
            />
          )}
        </View>
      </ScrollView>

      {/* Application Form Modal */}
      {showApplicationForm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowApplicationForm(false);
                  setShowLeaveTypeDropdown(false);
                  resetApplicationForm();
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Leave Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Leave Type</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowLeaveTypeDropdown(!showLeaveTypeDropdown)}
                >
                  <Text style={styles.pickerText}>{applicationForm.leave_type}</Text>
                  <Ionicons 
                    name={showLeaveTypeDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
                
                {/* Dropdown Options */}
                {showLeaveTypeDropdown && (
                  <View style={styles.dropdown}>
                    <ScrollView 
                      style={styles.dropdownScrollView}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      bounces={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {leaveTypes.map((type, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.dropdownItem,
                            applicationForm.leave_type === type && styles.dropdownItemSelected,
                            index === leaveTypes.length - 1 && styles.dropdownItemLast
                          ]}
                          onPress={() => {
                            setApplicationForm({ ...applicationForm, leave_type: type });
                            setShowLeaveTypeDropdown(false);
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            applicationForm.leave_type === type && styles.dropdownItemTextSelected
                          ]}>
                            {type}
                          </Text>
                          {applicationForm.leave_type === type && (
                            <Ionicons name="checkmark" size={16} color="#2196F3" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Date Selection */}
              <View style={styles.dateRow}>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  {Platform.OS === 'web' ? (
                    <CrossPlatformDatePicker
                      value={applicationForm.start_date}
                      onChange={(event, date) => {
                        if (date) {
                          setApplicationForm({ 
                            ...applicationForm, 
                            start_date: date,
                            end_date: date > applicationForm.end_date ? date : applicationForm.end_date
                          });
                        }
                      }}
                      mode="date"
                      placeholder="Select Start Date"
                      containerStyle={styles.dateInput}
                    />
                  ) : (
                    <DatePickerButton
                      value={applicationForm.start_date}
                      onPress={() => setShowStartDatePicker(true)}
                      mode="date"
                      style={styles.dateInput}
                      displayFormat={(date) => format(date, 'MMM dd, yyyy')}
                      iconName="calendar"
                    />
                  )}
                </View>

                <View style={styles.dateInputGroup}>
                  <Text style={styles.inputLabel}>End Date</Text>
                  {Platform.OS === 'web' ? (
                    <CrossPlatformDatePicker
                      value={applicationForm.end_date}
                      onChange={(event, date) => {
                        if (date) {
                          setApplicationForm({ ...applicationForm, end_date: date });
                        }
                      }}
                      mode="date"
                      placeholder="Select End Date"
                      containerStyle={styles.dateInput}
                    />
                  ) : (
                    <DatePickerButton
                      value={applicationForm.end_date}
                      onPress={() => setShowEndDatePicker(true)}
                      mode="date"
                      style={styles.dateInput}
                      displayFormat={(date) => format(date, 'MMM dd, yyyy')}
                      iconName="calendar"
                    />
                  )}
                </View>
              </View>

              {/* Total Days Display */}
              <View style={styles.totalDaysContainer}>
                <Text style={styles.totalDaysLabel}>Total Days:</Text>
                <Text style={styles.totalDaysValue}>
                  {differenceInDays(applicationForm.end_date, applicationForm.start_date) + 1} days
                </Text>
              </View>

              {/* Reason */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason for Leave *</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  value={applicationForm.reason}
                  onChangeText={(text) => setApplicationForm({ ...applicationForm, reason: text })}
                  placeholder="Please provide detailed reason for your leave request..."
                  placeholderTextColor="#999"
                />
              </View>

            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowApplicationForm(false);
                  setShowLeaveTypeDropdown(false);
                  resetApplicationForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleApplyLeave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Submit Application</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Pickers - Only show on mobile platforms */}
          {Platform.OS !== 'web' && showStartDatePicker && (
            <CrossPlatformDatePicker
              value={applicationForm.start_date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowStartDatePicker(false);
                if (date) {
                  setApplicationForm({ 
                    ...applicationForm, 
                    start_date: date,
                    end_date: date > applicationForm.end_date ? date : applicationForm.end_date
                  });
                }
              }}
            />
          )}

          {Platform.OS !== 'web' && showEndDatePicker && (
            <CrossPlatformDatePicker
              value={applicationForm.end_date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowEndDatePicker(false);
                if (date) {
                  setApplicationForm({ ...applicationForm, end_date: date });
                }
              }}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F44336',
    marginTop: 15,
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 15,
  },
  actionSection: {
    marginBottom: 15,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  leavesSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
  },
  leavesList: {
    gap: 15,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
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
  leaveInfo: {
    flex: 1,
  },
  leaveType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  leaveDates: {
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
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
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
  replacementNotesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8',
  },
  replacementNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  replacementNotesText: {
    fontSize: 14,
    color: '#4CAF50',
    lineHeight: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    width: width - 30,
    maxHeight: '90%',
    minHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
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
    maxHeight: '100%',
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
  picker: {
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
  pickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
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
  totalDaysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  totalDaysLabel: {
    fontSize: 16,
    color: '#1976D2',
    marginRight: 8,
  },
  totalDaysValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
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
    minHeight: 100,
    lineHeight: 22,
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
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Dropdown styles
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  // Enhanced loading and error styles for tenant system
  enhancedLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
  },
  loadingIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  spinner: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  enhancedLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
    textAlign: 'center',
  },
  enhancedLoadingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  tenantStatusContainer: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  tenantStatusText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  enhancedErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FAFAFA',
  },
  enhancedErrorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F44336',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  enhancedErrorSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorDetailsContainer: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    marginBottom: 24,
    width: '100%',
  },
  errorDetailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    marginTop: 8,
    marginBottom: 2,
  },
  errorDetailsText: {
    fontSize: 14,
    color: '#BF360C',
    marginBottom: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  autoApprovedSection: {
    marginTop: 12,
  },
  autoApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignSelf: 'flex-start',
  },
  autoApprovedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 6,
  },
});

export default LeaveApplication;
