import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';

const { width } = Dimensions.get('window');

const TeacherLeaveBalance = ({ navigation }) => {
  const { user, userType, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherBalances, setTeacherBalances] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [currentYear] = useState(new Date().getFullYear().toString());
  
  // Add balance form state
  const [newBalanceForm, setNewBalanceForm] = useState({
    teacher_id: '',
    academic_year: currentYear,
    sick_leave_total: 12,
    sick_leave_used: 0,
    casual_leave_total: 12,
    casual_leave_used: 0,
    earned_leave_total: 20,
    earned_leave_used: 0,
  });

  // Edit balance form state
  const [editBalanceForm, setEditBalanceForm] = useState({
    sick_leave_total: 12,
    sick_leave_used: 0,
    casual_leave_total: 12,
    casual_leave_used: 0,
    earned_leave_total: 20,
    earned_leave_used: 0,
  });

  const [showTeacherPicker, setShowTeacherPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadTeacherBalances(), loadTeachers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load leave balance data');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('teacher_leave_balance')
        .select(`
          *,
          teacher:teachers!teacher_leave_balance_teacher_id_fkey(id, name)
        `)
        .eq('academic_year', currentYear)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeacherBalances(data || []);
    } catch (error) {
      console.error('Error loading teacher balances:', error);
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
      setTeachers([]);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleAddBalance = async () => {
    try {
      if (!newBalanceForm.teacher_id) {
        Alert.alert('Error', 'Please select a teacher');
        return;
      }

      // Check authentication
      if (!isAuthenticated || !user) {
        Alert.alert('Authentication Error', 'You must be logged in to manage leave balances.');
        navigation.navigate('Login');
        return;
      }
      
      if (userType !== 'Admin') {
        Alert.alert('Authorization Error', 'Only administrators can manage leave balances.');
        return;
      }

      // Check if balance already exists for this teacher and year
      const existingBalance = teacherBalances.find(
        balance => balance.teacher_id === newBalanceForm.teacher_id && 
                  balance.academic_year === newBalanceForm.academic_year
      );

      if (existingBalance) {
        Alert.alert('Error', 'Leave balance already exists for this teacher in the selected academic year.');
        return;
      }

      const { error } = await supabase
        .from('teacher_leave_balance')
        .insert([newBalanceForm]);

      if (error) throw error;

      Alert.alert('Success', 'Leave balance created successfully');
      setShowAddBalanceModal(false);
      resetAddBalanceForm();
      await loadTeacherBalances();
    } catch (error) {
      console.error('Error adding leave balance:', error);
      Alert.alert('Error', 'Failed to create leave balance');
    }
  };

  const handleEditBalance = async () => {
    try {
      if (!selectedBalance) return;

      // Check authentication
      if (!isAuthenticated || !user) {
        Alert.alert('Authentication Error', 'You must be logged in to manage leave balances.');
        navigation.navigate('Login');
        return;
      }
      
      if (userType !== 'Admin') {
        Alert.alert('Authorization Error', 'Only administrators can manage leave balances.');
        return;
      }

      const updateData = {
        ...editBalanceForm,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('teacher_leave_balance')
        .update(updateData)
        .eq('id', selectedBalance.id);

      if (error) throw error;

      Alert.alert('Success', 'Leave balance updated successfully');
      setShowEditBalanceModal(false);
      setSelectedBalance(null);
      await loadTeacherBalances();
    } catch (error) {
      console.error('Error updating leave balance:', error);
      Alert.alert('Error', 'Failed to update leave balance');
    }
  };

  const handleDeleteBalance = (balance) => {
    Alert.alert(
      'Delete Leave Balance',
      `Are you sure you want to delete the leave balance for ${balance.teacher?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('teacher_leave_balance')
                .delete()
                .eq('id', balance.id);

              if (error) throw error;

              Alert.alert('Success', 'Leave balance deleted successfully');
              await loadTeacherBalances();
            } catch (error) {
              console.error('Error deleting leave balance:', error);
              Alert.alert('Error', 'Failed to delete leave balance');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (balance) => {
    setSelectedBalance(balance);
    setEditBalanceForm({
      sick_leave_total: balance.sick_leave_total,
      sick_leave_used: balance.sick_leave_used,
      casual_leave_total: balance.casual_leave_total,
      casual_leave_used: balance.casual_leave_used,
      earned_leave_total: balance.earned_leave_total,
      earned_leave_used: balance.earned_leave_used,
    });
    setShowEditBalanceModal(true);
  };

  const resetAddBalanceForm = () => {
    setNewBalanceForm({
      teacher_id: '',
      academic_year: currentYear,
      sick_leave_total: 12,
      sick_leave_used: 0,
      casual_leave_total: 12,
      casual_leave_used: 0,
      earned_leave_total: 20,
      earned_leave_used: 0,
    });
  };

  const createDefaultBalancesForAll = async () => {
    Alert.alert(
      'Create Default Balances',
      'This will create default leave balances for all teachers who don\'t have a balance record for the current year. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Get teachers who don't have balance records for current year
              const existingTeacherIds = teacherBalances.map(b => b.teacher_id);
              const teachersWithoutBalance = teachers.filter(t => !existingTeacherIds.includes(t.id));
              
              if (teachersWithoutBalance.length === 0) {
                Alert.alert('Info', 'All teachers already have leave balance records for the current year.');
                return;
              }

              const defaultBalances = teachersWithoutBalance.map(teacher => ({
                teacher_id: teacher.id,
                academic_year: currentYear,
                sick_leave_total: 12,
                sick_leave_used: 0,
                casual_leave_total: 12,
                casual_leave_used: 0,
                earned_leave_total: 20,
                earned_leave_used: 0,
              }));

              const { error } = await supabase
                .from('teacher_leave_balance')
                .insert(defaultBalances);

              if (error) throw error;

              Alert.alert('Success', `Created default leave balances for ${teachersWithoutBalance.length} teachers.`);
              await loadTeacherBalances();
            } catch (error) {
              console.error('Error creating default balances:', error);
              Alert.alert('Error', 'Failed to create default balances');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getLeaveStatus = (used, total) => {
    const percentage = (used / total) * 100;
    if (percentage >= 90) return { color: '#F44336', status: 'Critical' };
    if (percentage >= 75) return { color: '#FF9800', status: 'Warning' };
    return { color: '#4CAF50', status: 'Good' };
  };

  const renderBalanceCard = ({ item }) => {
    const sickStatus = getLeaveStatus(item.sick_leave_used, item.sick_leave_total);
    const casualStatus = getLeaveStatus(item.casual_leave_used, item.casual_leave_total);
    const earnedStatus = getLeaveStatus(item.earned_leave_used, item.earned_leave_total);

    return (
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <View style={styles.teacherInfo}>
            <Text style={styles.teacherName}>{item.teacher?.name || 'Unknown Teacher'}</Text>
            <Text style={styles.academicYear}>Academic Year: {item.academic_year}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openEditModal(item)}
            >
              <Ionicons name="create" size={20} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteBalance(item)}
            >
              <Ionicons name="trash" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.leaveTypes}>
          {/* Sick Leave */}
          <View style={styles.leaveTypeRow}>
            <View style={styles.leaveTypeInfo}>
              <Text style={styles.leaveTypeLabel}>Sick Leave</Text>
              <Text style={styles.leaveTypeBalance}>
                {item.sick_leave_used} / {item.sick_leave_total} days
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: '#E0E0E0' }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min((item.sick_leave_used / item.sick_leave_total) * 100, 100)}%`,
                      backgroundColor: sickStatus.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.statusText, { color: sickStatus.color }]}>
                {sickStatus.status}
              </Text>
            </View>
          </View>

          {/* Casual Leave */}
          <View style={styles.leaveTypeRow}>
            <View style={styles.leaveTypeInfo}>
              <Text style={styles.leaveTypeLabel}>Casual Leave</Text>
              <Text style={styles.leaveTypeBalance}>
                {item.casual_leave_used} / {item.casual_leave_total} days
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: '#E0E0E0' }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min((item.casual_leave_used / item.casual_leave_total) * 100, 100)}%`,
                      backgroundColor: casualStatus.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.statusText, { color: casualStatus.color }]}>
                {casualStatus.status}
              </Text>
            </View>
          </View>

          {/* Earned Leave */}
          <View style={styles.leaveTypeRow}>
            <View style={styles.leaveTypeInfo}>
              <Text style={styles.leaveTypeLabel}>Earned Leave</Text>
              <Text style={styles.leaveTypeBalance}>
                {item.earned_leave_used} / {item.earned_leave_total} days
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: '#E0E0E0' }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min((item.earned_leave_used / item.earned_leave_total) * 100, 100)}%`,
                      backgroundColor: earnedStatus.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.statusText, { color: earnedStatus.color }]}>
                {earnedStatus.status}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Leave Balance" navigation={navigation} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading leave balances...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Teacher Leave Balance" navigation={navigation} showBack={true} />
      
      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          onPress={() => setShowAddBalanceModal(true)}
          style={styles.actionButton}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Add Balance</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={createDefaultBalancesForAll}
          style={styles.actionButton}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Ionicons name="layers" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Create All</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Balance List */}
      <FlatList
        data={teacherBalances}
        renderItem={renderBalanceCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>No Leave Balances Found</Text>
            <Text style={styles.emptySubtext}>
              Create leave balance records for teachers to track their leave usage
            </Text>
          </View>
        }
      />

      {/* Add Balance Modal */}
      <Modal
        visible={showAddBalanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Leave Balance</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddBalanceModal(false);
                resetAddBalanceForm();
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
                <Text style={[styles.dropdownText, !newBalanceForm.teacher_id && styles.placeholderText]}>
                  {newBalanceForm.teacher_id 
                    ? teachers.find(t => t.id === newBalanceForm.teacher_id)?.name || 'Select Teacher'
                    : 'Select Teacher'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Academic Year */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Academic Year</Text>
              <TextInput
                style={styles.textInput}
                value={newBalanceForm.academic_year}
                onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, academic_year: text })}
                placeholder="Enter academic year..."
                placeholderTextColor="#999"
              />
            </View>

            {/* Leave Types */}
            <View style={styles.leaveSection}>
              <Text style={styles.sectionTitle}>Sick Leave</Text>
              <View style={styles.leaveInputRow}>
                <View style={styles.leaveInputGroup}>
                  <Text style={styles.inputLabel}>Total Days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={newBalanceForm.sick_leave_total.toString()}
                    onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, sick_leave_total: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="12"
                  />
                </View>
                <View style={styles.leaveInputGroup}>
                  <Text style={styles.inputLabel}>Used Days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={newBalanceForm.sick_leave_used.toString()}
                    onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, sick_leave_used: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>
            </View>

            <View style={styles.leaveSection}>
              <Text style={styles.sectionTitle}>Casual Leave</Text>
              <View style={styles.leaveInputRow}>
                <View style={styles.leaveInputGroup}>
                  <Text style={styles.inputLabel}>Total Days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={newBalanceForm.casual_leave_total.toString()}
                    onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, casual_leave_total: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="12"
                  />
                </View>
                <View style={styles.leaveInputGroup}>
                  <Text style={styles.inputLabel}>Used Days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={newBalanceForm.casual_leave_used.toString()}
                    onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, casual_leave_used: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>
            </View>

            <View style={styles.leaveSection}>
              <Text style={styles.sectionTitle}>Earned Leave</Text>
              <View style={styles.leaveInputRow}>
                <View style={styles.leaveInputGroup}>
                  <Text style={styles.inputLabel}>Total Days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={newBalanceForm.earned_leave_total.toString()}
                    onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, earned_leave_total: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="20"
                  />
                </View>
                <View style={styles.leaveInputGroup}>
                  <Text style={styles.inputLabel}>Used Days</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={newBalanceForm.earned_leave_used.toString()}
                    onChangeText={(text) => setNewBalanceForm({ ...newBalanceForm, earned_leave_used: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddBalanceModal(false);
                resetAddBalanceForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddBalance}
            >
              <Text style={styles.saveButtonText}>Create Balance</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                        newBalanceForm.teacher_id === teacher.id && styles.pickerModalItemSelected
                      ]}
                      onPress={() => {
                        setNewBalanceForm({ ...newBalanceForm, teacher_id: teacher.id });
                        setShowTeacherPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerModalItemText,
                        newBalanceForm.teacher_id === teacher.id && styles.pickerModalItemTextSelected
                      ]}>
                        {teacher.name}
                      </Text>
                      {newBalanceForm.teacher_id === teacher.id && (
                        <Ionicons name="checkmark" size={20} color="#2196F3" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* Edit Balance Modal */}
      <Modal
        visible={showEditBalanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Leave Balance</Text>
            <TouchableOpacity
              onPress={() => {
                setShowEditBalanceModal(false);
                setSelectedBalance(null);
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedBalance && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.teacherInfoSection}>
                <Text style={styles.teacherInfoTitle}>Teacher: {selectedBalance.teacher?.name}</Text>
                <Text style={styles.teacherInfoSubtitle}>Academic Year: {selectedBalance.academic_year}</Text>
              </View>

              {/* Leave Types */}
              <View style={styles.leaveSection}>
                <Text style={styles.sectionTitle}>Sick Leave</Text>
                <View style={styles.leaveInputRow}>
                  <View style={styles.leaveInputGroup}>
                    <Text style={styles.inputLabel}>Total Days</Text>
                    <TextInput
                      style={styles.numberInput}
                      value={editBalanceForm.sick_leave_total.toString()}
                      onChangeText={(text) => setEditBalanceForm({ ...editBalanceForm, sick_leave_total: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.leaveInputGroup}>
                    <Text style={styles.inputLabel}>Used Days</Text>
                    <TextInput
                      style={styles.numberInput}
                      value={editBalanceForm.sick_leave_used.toString()}
                      onChangeText={(text) => setEditBalanceForm({ ...editBalanceForm, sick_leave_used: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.leaveSection}>
                <Text style={styles.sectionTitle}>Casual Leave</Text>
                <View style={styles.leaveInputRow}>
                  <View style={styles.leaveInputGroup}>
                    <Text style={styles.inputLabel}>Total Days</Text>
                    <TextInput
                      style={styles.numberInput}
                      value={editBalanceForm.casual_leave_total.toString()}
                      onChangeText={(text) => setEditBalanceForm({ ...editBalanceForm, casual_leave_total: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.leaveInputGroup}>
                    <Text style={styles.inputLabel}>Used Days</Text>
                    <TextInput
                      style={styles.numberInput}
                      value={editBalanceForm.casual_leave_used.toString()}
                      onChangeText={(text) => setEditBalanceForm({ ...editBalanceForm, casual_leave_used: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.leaveSection}>
                <Text style={styles.sectionTitle}>Earned Leave</Text>
                <View style={styles.leaveInputRow}>
                  <View style={styles.leaveInputGroup}>
                    <Text style={styles.inputLabel}>Total Days</Text>
                    <TextInput
                      style={styles.numberInput}
                      value={editBalanceForm.earned_leave_total.toString()}
                      onChangeText={(text) => setEditBalanceForm({ ...editBalanceForm, earned_leave_total: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.leaveInputGroup}>
                    <Text style={styles.inputLabel}>Used Days</Text>
                    <TextInput
                      style={styles.numberInput}
                      value={editBalanceForm.earned_leave_used.toString()}
                      onChangeText={(text) => setEditBalanceForm({ ...editBalanceForm, earned_leave_used: parseInt(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowEditBalanceModal(false);
                setSelectedBalance(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleEditBalance}
            >
              <Text style={styles.saveButtonText}>Update Balance</Text>
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
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  listContainer: {
    flexGrow: 1,
    padding: 15,
  },
  balanceCard: {
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
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
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
  academicYear: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  leaveTypes: {
    gap: 12,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaveTypeInfo: {
    flex: 1,
  },
  leaveTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  leaveTypeBalance: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    flex: 2,
    alignItems: 'flex-end',
  },
  progressBar: {
    width: 100,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
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
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
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
  leaveSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  leaveInputRow: {
    flexDirection: 'row',
    gap: 15,
  },
  leaveInputGroup: {
    flex: 1,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  teacherInfoSection: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  teacherInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  teacherInfoSubtitle: {
    fontSize: 14,
    color: '#1565C0',
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

export default TeacherLeaveBalance;
