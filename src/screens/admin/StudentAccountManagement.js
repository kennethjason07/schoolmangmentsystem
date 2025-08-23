import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const StudentAccountManagement = ({ navigation }) => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Account form state
  const [accountForm, setAccountForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);

      // Test auth connection
      await dbHelpers.testAuthConnection();

      // Load classes first
      const { data: classesData, error: classesError } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, section')
        .order('class_name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load students with their class information and check if they have accounts
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section),
          parents:parent_id(id, name, phone, email)
        `)
        .order('name');

      if (studentsError) throw studentsError;

      // Check which students already have login accounts
      const { data: existingAccounts, error: accountsError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, linked_student_id, role_id, full_name')
        .not('linked_student_id', 'is', null);

      if (accountsError) throw accountsError;

      // Map students with their account status
      const studentsWithAccountStatus = (studentsData || []).map(student => {
        const hasAccount = existingAccounts?.some(account => account.linked_student_id === student.id);
        const accountInfo = existingAccounts?.find(account => account.linked_student_id === student.id);
        
        return {
          ...student,
          hasAccount,
          accountInfo
        };
      });

      setStudents(studentsWithAccountStatus);
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccountForm(prev => ({ 
      ...prev, 
      password: password,
      confirmPassword: password
    }));
  };

  const openCreateAccountModal = (student) => {
    setSelectedStudent(student);
    setAccountForm({
      full_name: student.name,
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setModalVisible(true);
  };

  const handleCreateAccount = async () => {
    if (!accountForm.full_name || !accountForm.email || !accountForm.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (accountForm.password !== accountForm.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (accountForm.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);

      // Check if email exists in users table
      const { data: existingUser } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('email', accountForm.email)
        .single();

      if (existingUser) {
        Alert.alert('Error', 'An account with this email already exists');
        setLoading(false);
        return;
      }

      // Create student account using proper Supabase Auth
      console.log('Creating student account for:', selectedStudent.name, 'with email:', accountForm.email);

      const { data: accountData, error: accountError } = await dbHelpers.createStudentAccount(
        {
          studentId: selectedStudent.id
        },
        {
          email: accountForm.email,
          password: accountForm.password,
          full_name: accountForm.full_name,
          phone: accountForm.phone
        }
      );

      if (accountError) {
        console.error('Error creating student account:', accountError);
        Alert.alert('Error', `Failed to create account: ${accountError.message || accountError}`);
        return;
      }

      console.log('Student account created successfully:', accountData);

      // Verify the account was created by checking the users table
      const { data: verifyUser } = await supabase
        .from(TABLES.USERS)
        .select('id, email, full_name')
        .eq('linked_student_id', selectedStudent.id)
        .single();

      console.log('Verification - User found in database:', verifyUser);

      // Close modal and reset form first
      setModalVisible(false);
      setSelectedStudent(null);
      setAccountForm({
        email: '',
        password: '',
        confirmPassword: ''
      });
      setShowPassword(false);
      setShowConfirmPassword(false);

      // Then show success alert
      Alert.alert(
        'Success',
        `✅ Login account created successfully for ${selectedStudent.name}!\n\n📧 Email: ${accountForm.email}\n🔑 Password: ${accountForm.password}\n\n✨ The student can now log in with these credentials.\n\n${verifyUser ? '✅ Account verified in database' : '⚠️ Account created but verification pending'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              loadStudents(); // Refresh the list
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error creating account:', error);
      Alert.alert('Error', `Failed to create account: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    // First filter by selected class
    const classMatch = selectedClass === 'all' || student.classes?.id === selectedClass;
    
    // Then filter by search query
    const searchMatch = searchQuery === '' || (
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.admission_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.classes?.class_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return classMatch && searchMatch;
  });

  const renderStudentItem = ({ item }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <View style={styles.studentHeader}>
          <Text style={styles.studentName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.hasAccount ? '#E8F5E8' : '#FFF3E0' }]}>
            <Ionicons 
              name={item.hasAccount ? "checkmark-circle" : "person-add"} 
              size={12} 
              color={item.hasAccount ? '#4CAF50' : '#FF9800'} 
            />
            <Text style={[styles.statusText, { color: item.hasAccount ? '#4CAF50' : '#FF9800' }]}>
              {item.hasAccount ? 'Has Account' : 'No Account'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.studentDetail}>
          Admission No: {item.admission_no || 'N/A'}
        </Text>
        <Text style={styles.studentDetail}>
          Class: {item.classes?.class_name} {item.classes?.section}
        </Text>
        <Text style={styles.studentDetail}>
          Roll No: {item.roll_no || 'N/A'}
        </Text>
        {item.hasAccount && item.accountInfo && (
          <Text style={styles.studentDetail}>
            Email: {item.accountInfo.email}
          </Text>
        )}
      </View>
      
      <View style={styles.actionContainer}>
        {!item.hasAccount ? (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => openCreateAccountModal(item)}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.createButtonText}>Create Account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.accountCreatedContainer}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.accountCreatedText}>Account Created</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header title="Student Account Management" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Student Account Management" showBack={true} onBack={() => navigation.goBack()} />
      
      <View style={styles.content}>
        {/* Class Selection Dropdown */}
        <View style={styles.classFilterContainer}>
          <Ionicons name="school" size={20} color="#666" style={styles.classFilterIcon} />
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={(itemValue) => setSelectedClass(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="All Classes" value="all" />
              {classes.map((cls) => (
                <Picker.Item 
                  key={cls.id} 
                  label={`${cls.class_name}${cls.section ? ` - ${cls.section}` : ''}`} 
                  value={cls.id} 
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Students List */}
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people" size={48} color="#BDBDBD" />
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Create Account Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Create Login Account for {selectedStudent?.name}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={accountForm.full_name}
                onChangeText={(text) => setAccountForm(prev => ({ ...prev, full_name: text }))}
                placeholder="Enter full name"
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={accountForm.email}
                onChangeText={(text) => setAccountForm(prev => ({ ...prev, email: text }))}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={accountForm.phone}
                onChangeText={(text) => setAccountForm(prev => ({ ...prev, phone: text }))}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />

              <View style={styles.passwordRow}>
                <Text style={styles.inputLabel}>Password *</Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generatePassword}
                >
                  <Ionicons name="refresh" size={16} color="#2196F3" />
                  <Text style={styles.generateText}>Generate</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={accountForm.password}
                  onChangeText={(text) => setAccountForm(prev => ({ ...prev, password: text }))}
                  placeholder="Enter password"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={accountForm.confirmPassword}
                  onChangeText={(text) => setAccountForm(prev => ({ ...prev, confirmPassword: text }))}
                  placeholder="Confirm password"
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              
              {/* Add some bottom padding to ensure last field is accessible */}
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.createAccountButton}
                onPress={handleCreateAccount}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={16} color="#fff" />
                    <Text style={styles.createAccountButtonText}>Create Account</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  studentInfo: {
    flex: 1,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  studentDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  accountCreatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  accountCreatedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  classFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  classFilterIcon: {
    marginRight: 12,
  },
  pickerContainer: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
    width: '100%',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    height: '95%',
    maxHeight: '95%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    flex: 1,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
    paddingLeft: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  generateText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 4,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  createAccountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    gap: 8,
  },
  createAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default StudentAccountManagement;
