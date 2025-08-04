import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabase';
import * as Animatable from 'react-native-animatable';

const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleId, setRoleId] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [linkedId, setLinkedId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const roles = [
    { key: 1, label: 'Admin', icon: 'school', color: '#1976d2' },
    { key: 2, label: 'Teacher', icon: 'person', color: '#4CAF50' },
    { key: 3, label: 'Parent', icon: 'people', color: '#FF9800' },
    { key: 4, label: 'Student', icon: 'person-circle', color: '#9C27B0' },
  ];

  // Validate full name
  const validateFullName = (name) => {
    if (!name) {
      setFullNameError('Full name is required');
      return false;
    }
    if (name.length < 2) {
      setFullNameError('Full name must be at least 2 characters');
      return false;
    }
    setFullNameError('');
    return true;
  };

  // Validate phone
  const validatePhone = (phone) => {
    if (!phone) {
      setPhoneError('Phone number is required');
      return false;
    }
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      setPhoneError('Please enter a valid phone number');
      return false;
    }
    setPhoneError('');
    return true;
  };

  // Validate email
  const validateEmail = (email) => {
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Validate password
  const validatePassword = (password) => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  // Validate confirm password
  const validateConfirmPassword = (password, confirmPassword) => {
    if (!confirmPassword) {
      setConfirmPasswordError('Confirm password required');
      return false;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  // Get role ID from Supabase
  const getRoleId = async (roleName) => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('role_name', roleName)
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Role ID retrieval error:', error);
      Alert.alert('Error', 'Invalid role selected');
      return null;
    }
  };

  // Validate role selection
  const validateRole = async () => {
    if (!roleId) {
      Alert.alert('Error', 'Please select a role');
      return false;
    }
    return true;
  };

  const { signUp } = useAuth();

  const handleSignUp = async () => {
    // Validate all inputs
    let isValid = true;
    isValid = validateEmail(email) && isValid;
    isValid = validatePassword(password) && isValid;
    isValid = validateConfirmPassword(password, confirmPassword) && isValid;
    isValid = validateFullName(fullName) && isValid;
    isValid = validatePhone(phone) && isValid;
    isValid = await validateRole() && isValid;

    if (!isValid) return;

    setIsLoading(true);
    
    try {
      const userData = {
        role_id: roleId,
        name: fullName,
        phone: phone,
        linked_student_id: linkedId,
      };

      const { data, error } = await signUp(email, password, userData);
      
      if (error) {
        Alert.alert('Signup Failed', error.message || 'Could not create account');
        return;
      }

      Alert.alert('Success', 'Account created successfully!', [
        { 
          text: 'OK', 
          onPress: () => {
            navigation.navigate('Login');
          }
        },
      ]);
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => {}} />
          }
        >
          <Animatable.View 
            style={styles.logoContainer}
            animation="fadeInDown"
            duration={1000}
          >
            <Ionicons name="person-add" size={80} color="#fff" />
            <Text style={styles.appTitle}>Sign Up</Text>
            <Text style={styles.appSubtitle}>Create a new account</Text>
          </Animatable.View>

          <Animatable.View style={styles.formContainer} animation="fadeInUp" duration={800}>
            {/* Role Selection */}
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>Select Role</Text>
              <View style={styles.roleButtons}>
                {roles.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.roleButton,
                      roleId === r.key && { backgroundColor: r.color }
                    ]}
                    onPress={() => setRoleId(r.key)}
                  >
                    <Ionicons
                      name={r.icon}
                      size={24}
                      color={roleId === r.key ? '#fff' : '#666'}
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        roleId === r.key && { color: '#fff' }
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={24} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#666"
                value={fullName}
                onChangeText={setFullName}
                onBlur={() => validateFullName(fullName)}
              />
              {fullNameError && <Text style={styles.errorText}>{fullNameError}</Text>}
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="call" size={24} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#666"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                onBlur={() => validatePhone(phone)}
              />
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={24} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  validateEmail(text);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {emailError && (
                <Text style={styles.errorText}>{emailError}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={24} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  validatePassword(text);
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={24} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#666"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  validateConfirmPassword(password, text);
                }}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {confirmPasswordError && (
              <Text style={styles.errorText}>{confirmPasswordError}</Text>
            )}

            {/* Linked ID Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="id-card" size={24} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Linked ID (Optional)"
                placeholderTextColor="#666"
                value={linkedId}
                onChangeText={setLinkedId}
              />
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity 
              style={[
                styles.loginButton,
                isLoading && styles.loginButtonDisabled
              ]} 
              onPress={handleSignUp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={24} color="#fff" />
                  <Text style={styles.loginButtonText}>Sign Up</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.signupLink}
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
            >
              <Text style={styles.signupLinkText}>Already have an account? Login</Text>
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  appSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: '48%',
    flex: 1,
    marginBottom: 8,
  },
  roleButtonText: {
    fontSize: 14,
    marginLeft: 8,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 10,
    marginLeft: 15,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  signupLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  signupLinkText: {
    color: '#1976d2',
    fontSize: 14,
  },
  showPasswordButton: {
    marginLeft: 10,
  },
});

export default SignupScreen;
