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
import DateTimePicker from '@react-native-community/datetimepicker';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { format, parseISO, isAfter, differenceInDays } from 'date-fns';

const { width } = Dimensions.get('window');

const LeaveApplication = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Reload leave applications and balance when teacherProfile changes
    if (teacherProfile?.linked_teacher_id) {
      loadMyLeaves();
      loadLeaveBalance();
    }
  }, [teacherProfile]);

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

  const loadMyLeaves = async () => {
    try {
      if (!teacherProfile?.linked_teacher_id) return;

      const { data, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
          reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
          replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
        `)
        .eq('teacher_id', teacherProfile.linked_teacher_id)
        .order('applied_date', { ascending: false });

      if (error) throw error;
      setMyLeaves(data || []);
    } catch (error) {
      console.error('Error loading my leaves:', error);
    }
  };

  const loadLeaveBalance = async () => {
    try {
      if (!teacherProfile?.linked_teacher_id) return;

      const currentYear = new Date().getFullYear().toString();
      const { data, error } = await supabase
        .from('teacher_leave_balance')
        .select('*')
        .eq('teacher_id', teacherProfile.linked_teacher_id)
        .eq('academic_year', currentYear)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // If no balance record exists, create one with default values
      if (!data) {
        const { data: newBalance, error: insertError } = await supabase
          .from('teacher_leave_balance')
          .insert([{
            teacher_id: teacherProfile.linked_teacher_id,
            academic_year: currentYear,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        setLeaveBalance(newBalance);
      } else {
        setLeaveBalance(data);
      }
    } catch (error) {
      console.error('Error loading leave balance:', error);
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

      // Check leave balance for specific leave types
      if (leaveBalance && ['Sick Leave', 'Casual Leave', 'Earned Leave'].includes(applicationForm.leave_type)) {
        let availableBalance = 0;
        let usedBalance = 0;

        switch (applicationForm.leave_type) {
          case 'Sick Leave':
            availableBalance = leaveBalance.sick_leave_total - leaveBalance.sick_leave_used;
            usedBalance = leaveBalance.sick_leave_used;
            break;
          case 'Casual Leave':
            availableBalance = leaveBalance.casual_leave_total - leaveBalance.casual_leave_used;
            usedBalance = leaveBalance.casual_leave_used;
            break;
          case 'Earned Leave':
            availableBalance = leaveBalance.earned_leave_total - leaveBalance.earned_leave_used;
            usedBalance = leaveBalance.earned_leave_used;
            break;
        }

        if (totalDays > availableBalance) {
          Alert.alert(
            'Insufficient Leave Balance',
            `You have only ${availableBalance} days available for ${applicationForm.leave_type}. You are requesting ${totalDays} days.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Apply Anyway', onPress: () => submitApplication(totalDays) }
            ]
          );
          return;
        }
      }

      await submitApplication(totalDays);
    } catch (error) {
      console.error('Error applying for leave:', error);
      Alert.alert('Error', 'Failed to submit leave application');
    }
  };

  const submitApplication = async (totalDays) => {
    try {
      setSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const leaveData = {
        teacher_id: teacherProfile.linked_teacher_id,
        leave_type: applicationForm.leave_type,
        start_date: format(applicationForm.start_date, 'yyyy-MM-dd'),
        end_date: format(applicationForm.end_date, 'yyyy-MM-dd'),
        reason: applicationForm.reason.trim(),
        applied_by: user.id,
        attachment_url: applicationForm.attachment_url,
      };

      const { error } = await supabase
        .from('leave_applications')
        .insert([leaveData]);

      if (error) throw error;

      // Create notification for admins about the new leave request
      try {
        console.log('📧 Creating notification for admins about new leave request...');
        
        const notificationMessage = `${teacherProfile.teacher?.name || teacherProfile.full_name} has submitted a ${applicationForm.leave_type} request from ${format(applicationForm.start_date, 'MMM dd, yyyy')} to ${format(applicationForm.end_date, 'MMM dd, yyyy')} (${totalDays} ${totalDays === 1 ? 'day' : 'days'}).`;

        // Create the notification for admin review
        const enhancedMessage = `[LEAVE_REQUEST] ${notificationMessage} Reason: ${applicationForm.reason.trim()}`;
        
        const { data: notification, error: notificationError } = await supabase
          .from('notifications')
          .insert({
            message: enhancedMessage,
            type: 'General',
            sent_by: user.id
          })
          .select()
          .single();

        if (notificationError) {
          console.error('❌ Error creating admin notification:', notificationError);
          // Don't fail the entire leave submission if notification fails
        } else {
          console.log('✅ Admin notification created successfully for leave request');
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

  const renderLeaveBalance = () => {
    if (!leaveBalance) return null;

    return (
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceTitle}>Leave Balance ({leaveBalance.academic_year})</Text>
        <View style={styles.balanceCards}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceCardTitle}>Sick Leave</Text>
            <Text style={styles.balanceCardValue}>
              {leaveBalance.sick_leave_total - leaveBalance.sick_leave_used}/{leaveBalance.sick_leave_total}
            </Text>
            <Text style={styles.balanceCardSubtitle}>Days Available</Text>
          </View>
          
          <View style={styles.balanceCard}>
            <Text style={styles.balanceCardTitle}>Casual Leave</Text>
            <Text style={styles.balanceCardValue}>
              {leaveBalance.casual_leave_total - leaveBalance.casual_leave_used}/{leaveBalance.casual_leave_total}
            </Text>
            <Text style={styles.balanceCardSubtitle}>Days Available</Text>
          </View>
          
          <View style={styles.balanceCard}>
            <Text style={styles.balanceCardTitle}>Earned Leave</Text>
            <Text style={styles.balanceCardValue}>
              {leaveBalance.earned_leave_total - leaveBalance.earned_leave_used}/{leaveBalance.earned_leave_total}
            </Text>
            <Text style={styles.balanceCardSubtitle}>Days Available</Text>
          </View>
        </View>
      </View>
    );
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
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Leave Application" showBack={true} navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading leave data...</Text>
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
        {/* Leave Balance Section */}
        {renderLeaveBalance()}

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
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateInputText}>
                      {format(applicationForm.start_date, 'MMM dd, yyyy')}
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
                      {format(applicationForm.end_date, 'MMM dd, yyyy')}
                    </Text>
                    <Ionicons name="calendar" size={20} color="#666" />
                  </TouchableOpacity>
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

              {/* Leave Balance Warning */}
              {leaveBalance && ['Sick Leave', 'Casual Leave', 'Earned Leave'].includes(applicationForm.leave_type) && (
                <View style={styles.balanceWarning}>
                  <Ionicons name="information-circle" size={20} color="#2196F3" />
                  <View style={styles.balanceWarningText}>
                    <Text style={styles.balanceWarningTitle}>Leave Balance Check</Text>
                    <Text style={styles.balanceWarningSubtitle}>
                      {applicationForm.leave_type === 'Sick Leave' && 
                        `Available: ${leaveBalance.sick_leave_total - leaveBalance.sick_leave_used} days`}
                      {applicationForm.leave_type === 'Casual Leave' && 
                        `Available: ${leaveBalance.casual_leave_total - leaveBalance.casual_leave_used} days`}
                      {applicationForm.leave_type === 'Earned Leave' && 
                        `Available: ${leaveBalance.earned_leave_total - leaveBalance.earned_leave_used} days`}
                    </Text>
                  </View>
                </View>
              )}
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

          {/* Date Pickers */}
          {showStartDatePicker && (
            <DateTimePicker
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

          {showEndDatePicker && (
            <DateTimePicker
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
  balanceContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  balanceCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  balanceCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  balanceCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  balanceCardSubtitle: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
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
  balanceWarning: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  balanceWarningText: {
    flex: 1,
    marginLeft: 10,
  },
  balanceWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 2,
  },
  balanceWarningSubtitle: {
    fontSize: 13,
    color: '#1976D2',
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
});

export default LeaveApplication;
