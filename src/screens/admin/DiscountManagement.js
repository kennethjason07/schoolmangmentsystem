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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { formatCurrency } from '../../utils/helpers';

const DiscountManagement = ({ navigation, route }) => {
  // Get navigation parameters
  const params = route.params || {};
  const { classId, className, studentId, studentName } = params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [feeComponents, setFeeComponents] = useState([]);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  
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
      if (studentId) {
        const { data, error } = await dbHelpers.getDiscountsByStudent(studentId, formData.academicYear);
        if (error) throw error;
        setDiscounts(data || []);
      } else {
        // Load all discounts if no specific student
        const { data, error } = await dbHelpers.getDiscountSummary({
          academicYear: formData.academicYear
        });
        if (error) throw error;
        setDiscounts(data || []);
      }
    } catch (error) {
      console.error('Error loading fee concessions:', error);
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

  const handleSaveDiscount = async () => {
    // Simple validation for amount only
    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid concession amount');
      return;
    }

    if (!formData.classId || !formData.studentId) {
      Alert.alert('Error', 'Student and class information is required');
      return;
    }

    try {
      setLoading(true);

      if (editingDiscount) {
        // Update existing discount
        const { error } = await dbHelpers.updateStudentDiscount(editingDiscount.id, {
          discount_type: 'fixed_amount', // Always fixed amount
          discount_value: parseFloat(formData.discountValue),
          fee_component: formData.feeComponent || null,
          description: formData.description
        });
        
        if (error) throw error;
        Alert.alert('Success', 'Fee concession updated successfully');
      } else {
        // Create new discount - always individual
        const { error } = await dbHelpers.createStudentDiscount({
          student_id: formData.studentId,
          class_id: formData.classId,
          academic_year: formData.academicYear,
          discount_type: 'fixed_amount', // Always fixed amount
          discount_value: parseFloat(formData.discountValue),
          fee_component: formData.feeComponent || null,
          description: formData.description
        });
        
        if (error) throw error;
        Alert.alert('Success', 'Fee concession created successfully');
      }

      setModalVisible(false);
      setEditingDiscount(null);
      
      // Refresh data
      loadStudentDiscounts();
      
    } catch (error) {
      console.error('Error saving discount:', error);
      Alert.alert('Error', 'Failed to save fee concession: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiscount = async (discountId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this fee concession?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await dbHelpers.deleteStudentDiscount(discountId, false); // Soft delete
              
              if (error) throw error;
              
              Alert.alert('Success', 'Fee concession deleted successfully');
              
              // Refresh data
              loadStudentDiscounts();
            } catch (error) {
              console.error('Error deleting discount:', error);
              Alert.alert('Error', 'Failed to delete fee concession');
            }
          }
        }
      ]
    );
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

      {/* Modal */}
      {renderDiscountModal()}
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
});

export default DiscountManagement;
