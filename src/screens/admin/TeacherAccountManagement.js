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
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useTenantAccess } from '../../utils/tenantHelpers';

const TeacherAccountManagement = ({ navigation }) => {
  const { 
    tenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  const [teachers, setTeachers] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [accountForm, setAccountForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isReady && tenantId) {
      loadTeachers();
    }
  }, [isReady, tenantId]);

  // Filter teachers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTeachers(teachers);
    } else {
      const filtered = teachers.filter(teacher => 
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.qualification?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (teacher.users && teacher.users.length > 0 && 
         teacher.users[0].email?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredTeachers(filtered);
    }
  }, [searchQuery, teachers]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const loadTeachers = async () => {
    const startTime = performance.now();
    let timeoutId;
    
    try {
      console.log('🚀 TeacherAccountManagement: Starting data load...');
      setLoading(true);
      
      // ⏰ Set timeout protection
      timeoutId = setTimeout(() => {
        console.warn('⚠️ TeacherAccountManagement: Load timeout (10s)');
        throw new Error('Loading timeout - please check your connection');
      }, 10000);
      
      // 🔍 Validate tenant context
      console.log('📋 TeacherAccountManagement: Current tenant ID:', tenantId);
      
      if (!isReady || !tenantId) {
        throw new Error('Tenant context not ready. Please wait and try again.');
      }
      
      if (tenantError) {
        throw new Error(tenantError.message || 'Tenant initialization error');
      }
      
      // 🏃‍♂️ Fast parallel data fetching
      console.log('📊 TeacherAccountManagement: Fetching teachers data...');
      const { data, error } = await dbHelpers.getTeachers({ 
        includeUserDetails: true // Include user details for account management
      });
      
      if (error) throw error;
      
      clearTimeout(timeoutId);
      
      // ✅ Set data immediately
      const teachersData = data || [];
      setTeachers(teachersData);
      setFilteredTeachers(teachersData);
      
      console.log(`✅ TeacherAccountManagement: Loaded ${teachersData.length} teachers`);
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ TeacherAccountManagement: Data loaded in ${loadTime}ms`);
      
      if (loadTime > 2000) {
        console.warn('⚠️ TeacherAccountManagement: Slow loading (>2s). Check network.');
      } else {
        console.log('🚀 TeacherAccountManagement: Fast loading achieved!');
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ TeacherAccountManagement: Failed to load data:', error.message);
      Alert.alert('Error', error.message || 'Failed to load teachers');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeachers();
    setRefreshing(false);
  };

  const openCreateAccount = (teacher) => {
    setSelectedTeacher(teacher);
    setAccountForm({
      email: '',
      password: '',
      confirmPassword: '',
      full_name: teacher.name,
      phone: ''
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setModalVisible(true);
  };

  const validateForm = () => {
    const { email, password, confirmPassword, full_name } = accountForm;
    
    if (!email || !password || !confirmPassword || !full_name) {
      Alert.alert('Error', 'Please fill all required fields');
      return false;
    }

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      const { data, error } = await dbHelpers.createTeacherAccount(
        { teacherId: selectedTeacher.id },
        {
          email: accountForm.email,
          password: accountForm.password,
          full_name: accountForm.full_name,
          phone: accountForm.phone
        }
      );

      if (error) throw error;

      // Close modal and reset form first
      setModalVisible(false);
      setSelectedTeacher(null);
      setAccountForm({
        full_name: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      setShowPassword(false);
      setShowConfirmPassword(false);

      // Then show success alert
      Alert.alert(
        'Success',
        `Teacher account created successfully!

Login credentials:
Email: ${accountForm.email}
Password: ${accountForm.password}

The teacher can now login immediately with these credentials.

Please share these credentials with the teacher.`,
        [
          {
            text: 'OK',
            onPress: () => {
              loadTeachers(); // Refresh the list
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating teacher account:', error);

      let errorMessage = 'Failed to create teacher account';

      if (error.message) {
        if (error.message.includes('For security purposes')) {
          errorMessage = 'Please wait a moment before creating another account. Try again in 1 minute.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'This email is already registered. Please use a different email address.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('Password')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
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

  const renderTeacherItem = ({ item }) => {
    // Check if teacher has a linked user account
    const hasAccount = item.users && item.users.length > 0;

    return (
      <View style={styles.teacherCard}>
        <View style={styles.teacherInfo}>
          <View style={styles.avatarContainer}>
            <Ionicons
              name="person"
              size={24}
              color={hasAccount ? "#4CAF50" : "#666"}
            />
          </View>
          <View style={styles.teacherDetails}>
            <Text style={styles.teacherName}>{item.name}</Text>
            <Text style={styles.teacherStatus}>
              {hasAccount ? `Email: ${item.users[0]?.email}` : 'No login account'}
            </Text>
            {hasAccount && (
              <Text style={styles.teacherPhone}>
                Phone: {item.users[0]?.phone || 'Not provided'}
              </Text>
            )}
            <Text style={styles.teacherDetails}>
              Qualification: {item.qualification || 'Not specified'}
            </Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          {hasAccount ? (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.statusText}>Active</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => openCreateAccount(item)}
            >
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.createButtonText}>Create Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Accounts" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading teachers...</Text>
        </View>
      </View>
    );
  }

  // Show loading state when tenant is not ready
  if (tenantLoading || !isReady) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Accounts" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Initializing tenant context...</Text>
        </View>
      </View>
    );
  }

  // Show error state if tenant failed to load
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Accounts" showBack={true} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Tenant Error: {tenantError.message}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => loadTeachers()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Teacher Accounts" showBack={true} />
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        keyboardShouldPersistTaps="handled"
        bounces={Platform.OS !== 'web'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Account Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{teachers.length}</Text>
              <Text style={styles.summaryLabel}>Total Teachers</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {teachers.filter(t => t.users && t.users.length > 0).length}
              </Text>
              <Text style={styles.summaryLabel}>With Accounts</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {teachers.filter(t => !t.users || t.users.length === 0).length}
              </Text>
              <Text style={styles.summaryLabel}>Pending Setup</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search teachers by name, email, or qualification..."
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Teachers List */}
        <View style={styles.teachersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Teachers</Text>
            {searchQuery.length > 0 && (
              <Text style={styles.searchResultsText}>
                {filteredTeachers.length} of {teachers.length} teachers
              </Text>
            )}
          </View>
          <FlatList
            data={filteredTeachers}
            keyExtractor={(item) => item.id}
            renderItem={renderTeacherItem}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery.length > 0 ? 'No teachers match your search' : 'No teachers found'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery.length > 0 
                    ? 'Try adjusting your search criteria'
                    : 'Add teachers first to create their login accounts'
                  }
                </Text>
                {searchQuery.length > 0 && (
                  <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
                    <Text style={styles.clearSearchText}>Clear Search</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </View>
      </ScrollView>

      {/* Create Account Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent={false}
      >
        <View style={styles.modalBackgroundOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardContainer}
          >
            <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Create Login Account for {selectedTeacher?.name}
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
              contentContainerStyle={styles.modalScrollContainer}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              bounces={true}
              scrollEnabled={true}
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
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },

  // Summary Section
  summarySection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Teachers Section
  teachersSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  teacherCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teacherDetails: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  teacherStatus: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  teacherPhone: {
    fontSize: 12,
    color: '#666',
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
    borderRadius: 6,
  },
  createButtonText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Modal Styles
  modalBackgroundOverlay: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalKeyboardContainer: {
    flex: 1,
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    paddingRight: 16,
    lineHeight: 26,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    flex: 1,
  },
  modalScrollContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e4e7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    minHeight: 48,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e4e7',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    minHeight: 48,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  eyeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  generateText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 4,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  createAccountButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccountButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 8,
  },

  // Search Section
  searchSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchResultsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  clearSearchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default TeacherAccountManagement;
