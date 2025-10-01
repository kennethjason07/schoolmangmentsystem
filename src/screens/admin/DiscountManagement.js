import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { formatCurrency } from '../../utils/helpers';
import { useTenant } from '../../contexts/TenantContext';

// Component load verification
console.log('💻 DISCOUNT MANAGEMENT - Component loaded on platform:', Platform.OS);
console.log('🔧 DISCOUNT MANAGEMENT - Enhanced delete functionality active');
console.log('🔍 DISCOUNT MANAGEMENT - Version: Enhanced with optimistic updates and detailed logging');
console.log('🕰️ DISCOUNT MANAGEMENT - Load time:', new Date().toISOString());

const DiscountManagement = ({ navigation, route }) => {
  // Get navigation parameters
  const params = route.params || {};
  const { classId, className, studentId, studentName, returnScreen, returnParams } = params;
  
  // Get tenant context
  const { tenantId } = useTenant();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [feeComponents, setFeeComponents] = useState([]);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [distributionModalVisible, setDistributionModalVisible] = useState(false);
  const [distributionData, setDistributionData] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    classId: classId || '',
    studentId: studentId || '',
    discountValue: '', // Only amount entry
    feeComponent: '', // Empty means all components
    description: '',
    academicYear: '2024-25'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadStudentDiscounts();
  }, []);

  // Auto-open modal if coming from student details
  useEffect(() => {
    if (classId && studentId && studentName) {
      // Directly open the modal for this student
      setModalVisible(true);
    }
  }, [classId, studentId, studentName]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const componentsResult = await dbHelpers.getFeeComponents(classId);

      if (componentsResult.error) throw componentsResult.error;

      setFeeComponents(componentsResult.data || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDiscounts = async () => {
    try {
      console.log('🔄 REFRESH DEBUG - Loading student discounts...', {
        studentId,
        academicYear: formData.academicYear,
        timestamp: new Date().toISOString()
      });
      
      if (studentId) {
        const { data, error } = await dbHelpers.getDiscountsByStudent(studentId, formData.academicYear);
        if (error) throw error;
        
        console.log('📊 REFRESH DEBUG - Got discounts for student:', {
          count: data?.length || 0,
          discountIds: data?.map(d => d.id) || []
        });
        
        setDiscounts(data || []);
      } else {
        // Load all discounts if no specific student
        const { data, error } = await dbHelpers.getDiscountSummary({
          academicYear: formData.academicYear
        });
        if (error) throw error;
        
        console.log('📊 REFRESH DEBUG - Got discount summary:', {
          count: data?.length || 0
        });
        
        setDiscounts(data || []);
      }
    } catch (error) {
      console.error('❌ REFRESH ERROR - Failed to load fee concessions:', error);
    }
  };

  const openDiscountModal = (discount = null) => {
    setEditingDiscount(discount);
    
    if (discount) {
      setFormData({
        classId: discount.class_id || classId || '',
        studentId: discount.student_id || studentId || '',
        discountValue: discount.discount_value?.toString() || '',
        feeComponent: discount.fee_component || '',
        description: discount.description || '',
        academicYear: discount.academic_year || '2024-25'
      });
    } else {
      setFormData({
        classId: classId || '',
        studentId: studentId || '',
        discountValue: '',
        feeComponent: '',
        description: '',
        academicYear: '2024-25'
      });
    }
    
    setModalVisible(true);
  };

  // Note: Individual fee structure creation logic has been moved to 
  // dbHelpers.applyStudentDiscountToFeeStructure() in supabase.js
  // This provides better logic that only creates entries for discounted components

  const handleSaveDiscount = async () => {
    // Enhanced validation with detailed logging
    console.log('🔍 DISCOUNT DEBUG - Starting discount creation...');
    console.log('📋 Form Data:', {
      classId: formData.classId,
      studentId: formData.studentId,
      discountValue: formData.discountValue,
      feeComponent: formData.feeComponent,
      description: formData.description,
      academicYear: formData.academicYear
    });
    console.log('📊 Context Data:', { tenantId, editingDiscount: !!editingDiscount });
    
    // Simple validation for amount only
    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      console.error('❌ Validation Error: Invalid discount amount:', formData.discountValue);
      Alert.alert('Validation Error', 'Please enter a valid concession amount');
      return;
    }

    if (!formData.classId || !formData.studentId) {
      console.error('❌ Validation Error: Missing required IDs:', {
        classId: formData.classId,
        studentId: formData.studentId
      });
      Alert.alert('Error', 'Student and class information is required');
      return;
    }

    if (!tenantId) {
      console.error('❌ Validation Error: Missing tenant context');
      Alert.alert('Error', 'Tenant context is required');
      return;
    }

    try {
      setLoading(true);

      if (editingDiscount) {
        console.log('🔄 Updating existing discount:', editingDiscount.id);
        // Update existing discount
        const { error } = await dbHelpers.updateStudentDiscount(editingDiscount.id, {
          discount_type: 'fixed_amount', // Always fixed amount
          discount_value: parseFloat(formData.discountValue),
          fee_component: formData.feeComponent || null,
          description: formData.description
        });
        
        if (error) {
          console.error('❌ Update Error:', error);
          throw error;
        }
        
        console.log('✅ Discount updated successfully');
        Alert.alert(
          'Success', 
          'Fee concession updated successfully',
          [{
            text: 'OK',
            onPress: () => {
              // Trigger navigation back with refresh if coming from ClassStudentDetails
              if (returnScreen === 'ClassStudentDetails' && returnParams) {
                console.log('🔄 Navigating back to ClassStudentDetails after update...');
                navigation.navigate(returnScreen, {
                  ...returnParams,
                  shouldRefresh: true,
                  concessionUpdated: true,
                  timestamp: Date.now()
                });
              }
            }
          }]
        );
      } else {
        console.log('➕ Creating new discount...');
        
        const discountData = {
          student_id: formData.studentId,
          class_id: formData.classId,
          academic_year: formData.academicYear,
          discount_type: 'fixed_amount', // Always fixed amount
          discount_value: parseFloat(formData.discountValue),
          fee_component: formData.feeComponent || null,
          description: formData.description
        };
        
        console.log('💾 Discount data to be saved:', discountData);
        console.log('🚀 About to call dbHelpers.createStudentDiscount...');
        
        // Create a discount record which will be stored in student_discounts table
        const { error: discountError, data: createdDiscount, distributionDetails } = await dbHelpers.createStudentDiscount(discountData);
        
        if (discountError) {
          console.error('❌ Create Error Details:', {
            message: discountError.message,
            code: discountError.code,
            hint: discountError.hint,
            details: discountError.details
          });
          
          // Provide more specific error messages
          let errorMessage = discountError.message;
          if (discountError.message.includes('foreign key')) {
            errorMessage = 'The selected student or class does not exist. Please refresh and try again.';
          } else if (discountError.message.includes('permission')) {
            errorMessage = 'You do not have permission to create discounts. Please contact your administrator.';
          } else if (discountError.message.includes('duplicate')) {
            errorMessage = 'A discount already exists for this student. Please edit the existing discount instead.';
          }
          
          throw new Error(errorMessage);
        }
        
        console.log('✅ Discount created successfully:', createdDiscount);
        
        // 🚀 DYNAMIC UPDATE: Trigger parent screen refresh after discount creation
        const handleSuccessAndNavigation = () => {
          // If we came from ClassStudentDetails, navigate back with refresh params
          if (returnScreen === 'ClassStudentDetails' && returnParams) {
            console.log('🔄 Navigating back to ClassStudentDetails with refresh params...');
            navigation.navigate(returnScreen, {
              ...returnParams,
              shouldRefresh: true,
              concessionUpdated: true,
              timestamp: Date.now() // Force param change to trigger useFocusEffect
            });
          }
        };
        
        // Show distribution popup if multiple records were created
        if (distributionDetails && distributionDetails.distribution && distributionDetails.distribution.length > 1) {
          setDistributionData(distributionDetails);
          setDistributionModalVisible(true);
          
          // Store the navigation callback to trigger after distribution modal closes
          setDistributionData(prev => ({ ...prev, onClose: handleSuccessAndNavigation }));
        } else {
          Alert.alert(
            'Success', 
            `Fee concession of ₹${parseFloat(formData.discountValue)} applied successfully to student. The discount will be reflected in fee calculations.`,
            [{
              text: 'OK',
              onPress: handleSuccessAndNavigation
            }]
          );
        }
      }

      setModalVisible(false);
      setEditingDiscount(null);
      
      // Refresh data
      loadStudentDiscounts();
      
    } catch (error) {
      console.error('❌ Error saving discount:', error);
      
      // Enhanced error message for user
      let userMessage = error.message || 'Failed to save fee concession';
      if (userMessage.includes('fetch failed')) {
        userMessage = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert(
        'Error', 
        userMessage,
        [
          { text: 'OK' },
          { 
            text: 'Copy Error', 
            onPress: () => {
              // This would copy error details for debugging
              console.log('Full error for debugging:', JSON.stringify(error, null, 2));
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiscount = async (discountId) => {
    console.log('🗑️ DELETE DEBUG - Starting delete process for discount:', discountId);
    console.log('🔍 DELETE DEBUG - Platform detected:', Platform.OS);
    console.log('🔍 DELETE DEBUG - Current discounts count:', discounts.length);
    
    // Platform-aware confirmation dialog
    const confirmDelete = () => {
      if (Platform.OS === 'web') {
        return window.confirm('Are you sure you want to delete this fee concession? This action will remove the concession and may affect fee calculations.');
      } else {
        return new Promise((resolve) => {
          Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this fee concession? This action will remove the concession and may affect fee calculations.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });
      }
    };
    
    const deleteConfirmed = Platform.OS === 'web' ? confirmDelete() : await confirmDelete();
    
    if (!deleteConfirmed) {
      console.log('🙄 DELETE DEBUG - User cancelled deletion');
      return;
    }
    
    // Execute delete operation
    try {
      console.log('🔄 DELETE DEBUG - User confirmed deletion, calling deleteStudentDiscount...');
      setLoading(true); // Show loading indicator
      const deleteResult = await dbHelpers.deleteStudentDiscount(discountId, false); // Soft delete
      
      console.log('📊 DELETE DEBUG - Delete result:', deleteResult);
      
      if (deleteResult.error) {
        console.error('❌ DELETE ERROR:', deleteResult.error);
        console.error('Error details:', {
          message: deleteResult.error.message,
          code: deleteResult.error.code,
          hint: deleteResult.error.hint,
          details: deleteResult.error.details
        });
        
        // Provide more specific error messages
        let errorMessage = deleteResult.error.message;
        if (deleteResult.error.message.includes('permission')) {
          errorMessage = 'You do not have permission to delete this concession. Please contact your administrator.';
        } else if (deleteResult.error.message.includes('foreign key')) {
          errorMessage = 'This concession cannot be deleted because it is linked to existing fee records. Please contact support.';
        } else if (deleteResult.error.message.includes('not found')) {
          errorMessage = 'The concession was not found. It may have been deleted already.';
        }
        
        // Platform-aware error display
        if (Platform.OS === 'web') {
          window.alert(`Delete Failed: ${errorMessage}`);
        } else {
          Alert.alert(
            'Delete Failed',
            errorMessage,
            [
              { text: 'OK' },
              {
                text: 'Copy Error',
                onPress: () => {
                  console.log('Full delete error for debugging:', JSON.stringify(deleteResult.error, null, 2));
                }
              }
            ]
          );
        }
        return;
      }
      
      console.log('✅ DELETE SUCCESS - Fee concession deleted successfully');
      
      // Immediate optimistic UI update - remove from local state
      console.log('🔄 Applying optimistic UI update - removing deleted discount from view...');
      setDiscounts(prevDiscounts => {
        const filtered = prevDiscounts.filter(d => d.id !== discountId);
        console.log('📊 Optimistic update - discounts count:', prevDiscounts.length, '->', filtered.length);
        return filtered;
      });
      
      // Also refresh from server to be sure
      console.log('🔄 Refreshing discount data from server after successful delete...');
      loadStudentDiscounts();
      
      // 🚀 DYNAMIC UPDATE: Trigger parent screen refresh after discount deletion
      const handleDeleteSuccessAndNavigation = () => {
        if (returnScreen === 'ClassStudentDetails' && returnParams) {
          console.log('🔄 Navigating back to ClassStudentDetails after delete...');
          navigation.navigate(returnScreen, {
            ...returnParams,
            shouldRefresh: true,
            concessionUpdated: true,
            timestamp: Date.now()
          });
        }
      };
      
      // Platform-aware success message
      if (Platform.OS === 'web') {
        window.alert('Success: Fee concession deleted successfully. The changes have been applied.');
        handleDeleteSuccessAndNavigation();
      } else {
        Alert.alert(
          'Success', 
          'Fee concession deleted successfully. The changes have been applied.',
          [{
            text: 'OK',
            onPress: handleDeleteSuccessAndNavigation
          }]
        );
      }
      
    } catch (error) {
      console.error('💥 DELETE EXCEPTION - Unexpected error during delete:', error);
      console.error('Exception details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Platform-aware exception display
      if (Platform.OS === 'web') {
        window.alert(`Delete Error: An unexpected error occurred: ${error.message || 'Unknown error'}`);
      } else {
        Alert.alert(
          'Delete Error',
          `An unexpected error occurred: ${error.message || 'Unknown error'}`,
          [
            { text: 'OK' },
            {
              text: 'Copy Error',
              onPress: () => {
                console.log('Full exception for debugging:', JSON.stringify(error, null, 2));
              }
            }
          ]
        );
      }
    } finally {
      // Small delay before hiding loading to prevent flicker
      setTimeout(() => {
        setLoading(false);
      }, 100);
      console.log('🏁 DELETE DEBUG - Delete process completed');
    }
  };

  const renderDiscounts = () => (
    <FlatList
      data={discounts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.discountCard}>
          <View style={styles.discountHeader}>
            <View>
              <Text style={styles.studentName}>{item.student_name || item.students?.name || studentName}</Text>
              {/* Only show class info if we have valid data */}
              {((item.class_name || item.classes?.class_name || className) && (item.class_name !== 'undefined' && item.classes?.class_name !== 'undefined' && className !== 'undefined')) ? (
                <Text style={styles.classInfo}>
                  {item.class_name || item.classes?.class_name || className}
                  {(item.section && item.section !== 'undefined') || (item.classes?.section && item.classes?.section !== 'undefined') ? 
                    ` - ${item.section || item.classes?.section}` : ''}
                </Text>
              ) : null}
            </View>
            <View style={styles.discountAmount}>
              <Text style={styles.discountValue}>
                ₹{item.discount_value}
              </Text>
              <Text style={styles.discountType}>
                Fixed Amount
              </Text>
            </View>
          </View>
          
          <View style={styles.discountDetails}>
            {item.fee_component && (
              <Text style={styles.feeComponent}>
                <Ionicons name="pricetag" size={14} color="#1976d2" />
                {' '}{item.fee_component}
              </Text>
            )}
            {item.description && (
              <Text style={styles.discountDescription}>{item.description}</Text>
            )}
          </View>
          
          <View style={styles.discountActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openDiscountModal()}
            >
              <Ionicons name="add-circle" size={18} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Add More</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openDiscountModal(item)}
            >
              <Ionicons name="create-outline" size={18} color="#1976d2" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteDiscount(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#f44336" />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadStudentDiscounts().finally(() => setRefreshing(false));
          }}
        />
      }
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No fee concessions found</Text>
          <Text style={styles.emptySubtext}>
            {studentName ? `No concessions applied for ${studentName}` : 'Add fee concessions for students to get started'}
          </Text>
        </View>
      )}
    />
  );

  const renderDiscountModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingDiscount ? 'Edit Fee Concession' : 'Add Fee Concession'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Student Info Display */}
            {studentName && (
              <View style={styles.studentInfoCard}>
                <Text style={styles.studentInfoLabel}>Student</Text>
                <Text style={styles.studentInfoName}>{studentName}</Text>
                <Text style={styles.studentInfoClass}>{className}</Text>
              </View>
            )}

            {/* Concession Amount */}
            <Text style={styles.inputLabel}>Concession Amount (₹) *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.discountValue}
              onChangeText={(text) => setFormData(prev => ({ ...prev, discountValue: text }))}
              placeholder="Enter concession amount"
              keyboardType="numeric"
            />

            {/* Fee Component Selection */}
            <Text style={styles.inputLabel}>Fee Component</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.feeComponent}
                onValueChange={(value) => setFormData(prev => ({ ...prev, feeComponent: value }))}
                style={styles.picker}
              >
                <Picker.Item label="All Fee Components" value="" />
                {feeComponents.map((component) => (
                  <Picker.Item key={component} label={component} value={component} />
                ))}
              </Picker>
            </View>

            {/* Description */}
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Enter concession description (optional)"
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveDiscount}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : (editingDiscount ? 'Update' : 'Save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderDistributionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={distributionModalVisible}
      onRequestClose={() => setDistributionModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              🎩 Concession Distribution
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDistributionModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {distributionData && (
              <View>
                <View style={styles.distributionSummary}>
                  <Text style={styles.distributionTitle}>
                    Your concession of ₹{distributionData.originalAmount} has been automatically distributed:
                  </Text>
                  
                  <View style={styles.distributionStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Total Applied:</Text>
                      <Text style={styles.statValue}>₹{distributionData.totalDistributed}</Text>
                    </View>
                    {distributionData.remainingAmount > 0 && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Remaining:</Text>
                        <Text style={[styles.statValue, { color: '#FF9800' }]}>₹{distributionData.remainingAmount}</Text>
                      </View>
                    )}
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Records Created:</Text>
                      <Text style={styles.statValue}>{distributionData.distribution.length}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.distributionList}>
                  <Text style={styles.distributionListTitle}>Distribution Details:</Text>
                  {distributionData.distribution.map((item, index) => (
                    <View key={index} style={styles.distributionItem}>
                      <View style={styles.distributionItemHeader}>
                        <Text style={styles.distributionComponent}>{item.component}</Text>
                        <Text style={styles.distributionAmount}>₹{item.concessionAmount}</Text>
                      </View>
                      <View style={styles.distributionItemFooter}>
                        <Text style={styles.distributionDetail}>
                          Applied to fee of ₹{item.componentAmount}
                        </Text>
                        <Text style={styles.distributionPercentage}>
                          {((item.concessionAmount / item.componentAmount) * 100).toFixed(1)}% discount
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.distributionNote}>
                  <Ionicons name="information-circle" size={20} color="#1976d2" />
                  <Text style={styles.distributionNoteText}>
                    Concessions are applied to the highest fee components first. Multiple discount records have been created for better tracking.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => {
                setDistributionModalVisible(false);
                
                // Execute the stored navigation callback if it exists
                if (distributionData?.onClose) {
                  distributionData.onClose();
                } else {
                  Alert.alert('Success', 'Fee concessions have been applied successfully!');
                }
              }}
            >
              <Text style={styles.saveButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && discounts.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Fee Concession" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading fee concessions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title={studentName ? `${studentName} - Fee Concession` : "Fee Concession"} 
        showBack={true}
        rightIcon={studentName ? "refresh" : undefined}
        rightIconOnPress={studentName ? () => {
          console.log('🔄 Manual refresh triggered...');
          setRefreshing(true);
          loadStudentDiscounts().finally(() => setRefreshing(false));
        } : undefined}
        rightIconTitle={studentName ? "Refresh Concessions" : undefined}
      />
      
      {/* Content */}
      <View style={styles.content}>
        {renderDiscounts()}
      </View>

      {/* FAB - Only show if not specific student or if no concessions exist */}
      {(!studentId || discounts.length === 0) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => openDiscountModal()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modals */}
      {renderDiscountModal()}
      {renderDistributionModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    marginTop: 16,
  },
  discountCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  discountAmount: {
    alignItems: 'flex-end',
  },
  discountValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  discountType: {
    fontSize: 12,
    color: '#666',
  },
  discountDetails: {
    marginBottom: 12,
  },
  feeComponent: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 4,
  },
  discountDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  discountActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#e8f5e8',
    borderRadius: 6,
    marginRight: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 6,
    marginRight: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1976d2',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  studentInfoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  studentInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  studentInfoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentInfoClass: {
    fontSize: 14,
    color: '#666',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  saveButton: {
    backgroundColor: '#1976d2',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
  // Distribution modal styles
  distributionSummary: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  distributionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  distributionList: {
    marginBottom: 16,
  },
  distributionListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  distributionItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  distributionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  distributionComponent: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  distributionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  distributionItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distributionDetail: {
    fontSize: 12,
    color: '#666',
  },
  distributionPercentage: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  distributionNote: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'flex-start',
  },
  distributionNoteText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#1976d2',
    flex: 1,
    lineHeight: 16,
  },
});

export default DiscountManagement;
