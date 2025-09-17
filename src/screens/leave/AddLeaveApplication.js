import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { 
  useTenantAccess,
  tenantDatabase,
  getCachedTenantId
} from '../../utils/tenantHelpers';
import { colors } from '../../../assets/colors';

const AddLeaveApplication = ({ visible, onClose, onApplicationAdded }) => {
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  const [leaveType, setLeaveType] = useState('Sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();

  // 🚀 ENHANCED: Tenant validation helper
  const validateTenantAccess = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const cachedTenantId = getCachedTenantId();
    if (!cachedTenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    return { valid: true, tenantId: cachedTenantId };
  };

  const leaveTypes = ['Sick', 'Casual', 'Emergency', 'Earned'];

  const resetForm = () => {
    setLeaveType('Sick');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleSubmit = async () => {
    const startTime = performance.now();
    
    console.log('🚀 AddLeaveApplication: Starting leave application submission...');
    console.log('📊 AddLeaveApplication: Form data:', {
      leaveType,
      startDate,
      endDate,
      reason,
      user: user?.email
    });

    // Validation
    if (!startDate || !endDate || !reason.trim()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert('Validation Error', 'End date must be after start date.');
      return;
    }

    if (!user) {
      Alert.alert('Authentication Error', 'Please log in to submit leave applications.');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('📊 AddLeaveApplication: Preparing to insert into database...');
      
      // 🚀 ENHANCED: Validate tenant access using new helper
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Enhanced tenant validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        return;
      }
      
      const effectiveTenantId = validation.tenantId;
      console.log('🚀 Enhanced tenant system: Using cached tenant ID:', effectiveTenantId);

      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('➕ [ADD_LEAVE] Session check:', {
        hasSession: !!session,
        sessionUser: session?.user?.email,
        sessionError: sessionError?.message
      });

      if (!session) {
        Alert.alert('Authentication Error', 'Please log in to submit leave applications.');
        return;
      }

      // Prepare the data for insertion (tenant_id will be added automatically)
      const leaveData = {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'Pending',
        applied_date: new Date().toISOString().split('T')[0],
        applied_by: user.id,
        teacher_id: user.linked_teacher_id || null,
        total_days: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1,
        academic_year: new Date().getFullYear().toString()
      };

      console.log('➥ [ADD_LEAVE] Data to insert:', leaveData);

      // 🚀 ENHANCED: Insert using tenantDatabase helper
      const { data: insertedData, error: insertError } = await tenantDatabase.create('leave_applications', leaveData);

      console.log('➕ [ADD_LEAVE] Insert result:', {
        data: insertedData,
        error: insertError?.message,
        errorCode: insertError?.code
      });

      if (insertError) {
        console.error('❌ [ADD_LEAVE] Insert failed:', insertError);
        
        if (insertError.code === '42501') {
          Alert.alert(
            'Database Permission Error', 
            'Unable to submit leave application due to database permissions. Please contact your administrator.'
          );
        } else if (insertError.code === '23503') {
          Alert.alert(
            'Data Reference Error',
            'There was an issue with the user or teacher reference. Please contact support.'
          );
        } else {
          Alert.alert(
            'Submission Error', 
            `Failed to submit leave application: ${insertError.message}`
          );
        }
        return;
      }

      console.log('✅ AddLeaveApplication: Leave application submitted successfully:', insertedData);
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const submitTime = Math.round(endTime - startTime);
      console.log(`✅ AddLeaveApplication: Leave submitted in ${submitTime}ms`);
      
      Alert.alert(
        'Success!', 
        'Leave application submitted successfully.',
        [{ text: 'OK', onPress: () => {
          resetForm();
          onClose();
          onApplicationAdded?.(insertedData[0]);
        }}]
      );

    } catch (error) {
      console.error('❌ AddLeaveApplication: Submission error:', error.message);
      Alert.alert('Error', 'An unexpected error occurred while submitting the application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Leave Application</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Leave Details</Text>

            {/* Leave Type Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Leave Type *</Text>
              <View style={styles.leaveTypeContainer}>
                {leaveTypes.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.leaveTypeButton,
                      leaveType === type && styles.leaveTypeButtonActive
                    ]}
                    onPress={() => setLeaveType(type)}
                  >
                    <Text style={[
                      styles.leaveTypeText,
                      leaveType === type && styles.leaveTypeTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range */}
            <View style={styles.dateRow}>
              <View style={styles.dateGroup}>
                <Text style={styles.label}>Start Date *</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.dateGroup}>
                <Text style={styles.label}>End Date *</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChangeText={setEndDate}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Reason */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Reason *</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Please provide a reason for your leave..."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* User Info Display */}
            <View style={styles.userInfo}>
              <Text style={styles.userInfoText}>
                📧 Submitted by: {user?.email || 'Unknown'}
              </Text>
              {user?.full_name && (
                <Text style={styles.userInfoText}>
                  👤 Name: {user.full_name}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color={colors.white} />
                <Text style={styles.submitButtonText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  leaveTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leaveTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaveTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  leaveTypeText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  leaveTypeTextActive: {
    color: colors.white,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateGroup: {
    flex: 1,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.text,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.text,
    height: 100,
  },
  userInfo: {
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  userInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  submitButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
});

export default AddLeaveApplication;
