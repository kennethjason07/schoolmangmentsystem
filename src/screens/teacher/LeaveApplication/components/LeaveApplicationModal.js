import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  Dimensions,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, differenceInDays } from 'date-fns';
import CrossPlatformDatePicker, { DatePickerButton } from '../../../../components/CrossPlatformDatePicker';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const LeaveApplicationModal = ({
  visible,
  onClose,
  applicationForm,
  setApplicationForm,
  leaveTypes,
  showStartDatePicker,
  setShowStartDatePicker,
  showEndDatePicker,
  setShowEndDatePicker,
  showLeaveTypeDropdown,
  setShowLeaveTypeDropdown,
  submitting,
  onSubmit,
  scrollSettings
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      presentationStyle={isWeb ? "overFullScreen" : "pageSheet"}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, isWeb && styles.modalContainerWeb]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
            {...scrollSettings}
          >
            {/* Leave Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Leave Type *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowLeaveTypeDropdown(!showLeaveTypeDropdown)}
                activeOpacity={0.7}
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
                    contentContainerStyle={styles.dropdownScrollContent}
                    showsVerticalScrollIndicator={isWeb}
                    nestedScrollEnabled={true}
                    bounces={!isWeb}
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
                        activeOpacity={0.7}
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
                <Text style={styles.inputLabel}>Start Date *</Text>
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
                <Text style={styles.inputLabel}>End Date *</Text>
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
              <Ionicons name="calendar" size={16} color="#1976D2" />
              <Text style={styles.totalDaysLabel}>Total Days:</Text>
              <View style={styles.totalDaysBadge}>
                <Text style={styles.totalDaysValue}>
                  {differenceInDays(applicationForm.end_date, applicationForm.start_date) + 1} days
                </Text>
              </View>
            </View>

            {/* Reason */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Leave *</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={6}
                value={applicationForm.reason}
                onChangeText={(text) => setApplicationForm({ ...applicationForm, reason: text })}
                placeholder="Please provide detailed reason for your leave request..."
                placeholderTextColor="#999"
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {applicationForm.reason.length}/500 characters
              </Text>
            </View>

            {/* Leave Guidelines */}
            <View style={styles.guidelinesContainer}>
              <View style={styles.guidelinesHeader}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.guidelinesTitle}>Leave Application Guidelines</Text>
              </View>
              <View style={styles.guidelinesList}>
                <Text style={styles.guidelineItem}>• Submit leave requests at least 24 hours in advance</Text>
                <Text style={styles.guidelineItem}>• Provide detailed reason for leave</Text>
                <Text style={styles.guidelineItem}>• Emergency leave can be submitted retrospectively</Text>
                <Text style={styles.guidelineItem}>• You will be notified once your application is reviewed</Text>
              </View>
            </View>

            {/* Add some bottom padding for modal scrolling */}
            <View style={styles.modalBottomPadding} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (submitting || !applicationForm.reason.trim()) && styles.submitButtonDisabled
              ]}
              onPress={onSubmit}
              disabled={submitting || !applicationForm.reason.trim()}
              activeOpacity={0.8}
            >
              {submitting ? (
                <>
                  <Ionicons name="hourglass" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submit Application</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: isWeb ? 'center' : 'flex-end',
    alignItems: 'center'
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: isWeb ? 20 : 20,
    borderTopRightRadius: isWeb ? 20 : 20,
    borderBottomLeftRadius: isWeb ? 20 : 0,
    borderBottomRightRadius: isWeb ? 20 : 0,
    width: isWeb ? Math.min(600, width * 0.9) : width,
    maxHeight: isWeb ? height * 0.9 : '95%',
    minHeight: isWeb ? '60%' : '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  modalContainerWeb: {
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333'
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa'
  },
  modalContent: {
    flex: 1
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 10
  },

  // Input Group Styles
  inputGroup: {
    marginBottom: 24,
    position: 'relative'
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },

  // Picker Styles
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 52
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontWeight: '500'
  },

  // Dropdown Styles
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    maxHeight: 250,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  dropdownScrollView: {
    maxHeight: 250
  },
  dropdownScrollContent: {
    paddingVertical: 4
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  dropdownItemSelected: {
    backgroundColor: '#E3F2FD'
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontWeight: '500'
  },
  dropdownItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600'
  },
  dropdownItemLast: {
    borderBottomWidth: 0
  },

  // Date Input Styles
  dateRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16
  },
  dateInputGroup: {
    flex: 1
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    minHeight: 52
  },

  // Total Days Styles
  totalDaysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24
  },
  totalDaysLabel: {
    fontSize: 16,
    color: '#1976D2',
    marginLeft: 8,
    marginRight: 12,
    fontWeight: '600'
  },
  totalDaysBadge: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  totalDaysValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },

  // Text Area Styles
  textArea: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 120,
    lineHeight: 22
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4
  },

  // Guidelines Styles
  guidelinesContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8
  },
  guidelinesList: {
    gap: 6
  },
  guidelineItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },

  // Modal Actions Styles
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d'
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
    shadowOpacity: 0.1
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF'
  },

  // Padding Styles
  modalBottomPadding: {
    height: 20
  }
});

export default LeaveApplicationModal;
