import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabase';
import * as Animatable from 'react-native-animatable';
// 🚀 ENHANCED_TENANT_SYSTEM: Import tenant access hook and helpers
import { useTenantAccess, initializeTenantHelpers } from '../../utils/tenantHelpers';
import { getTenantIdByEmail } from '../../utils/getTenantByEmail';

// Import VidyaSethu logo with fallback
const VidyaSethuLogo = require('../../../assets/logo-white.png');

// Import role-specific logos
const TeacherLogo = require('../../../logo-teacher.jpg');
const ParentLogo = require('../../../parents-logo.jpg');
const StudentLogo = require('../../../student-logo-vector.jpg');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [logoError, setLogoError] = useState(false); // Try to load PNG logo first
  const { signIn } = useAuth();
  // 🚀 ENHANCED_TENANT_SYSTEM: Use tenant access hook
  const { isReady, isLoading: tenantLoading, error: tenantError } = useTenantAccess();

  const roles = [
    { key: 'admin', label: 'Admin', description: 'School Management', icon: 'school', color: '#1976d2' },
    { key: 'teacher', label: 'Teacher', description: 'Faculty Member', icon: 'person', color: '#4CAF50' },
    { key: 'parent', label: 'Parent', description: 'Guardian', icon: 'people', color: '#FF9800' },
    { key: 'student', label: 'Student', description: 'Learner', icon: 'person-circle', color: '#9C27B0' },
  ];

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

  // Validate password - simplified for login
  const validatePassword = (password) => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  // 🚀 ENHANCED_TENANT_SYSTEM: Validate tenant access for the user
  const validateTenantAccess = async (userEmail) => {
    try {
      console.log('🚀 ENHANCED_TENANT_SYSTEM: Validating tenant access for:', userEmail);
      
      // Get tenant information using email lookup
      const tenantResult = await getTenantIdByEmail(userEmail);
      
      if (!tenantResult.success) {
        console.error('🚀 ENHANCED_TENANT_SYSTEM: Tenant validation failed:', tenantResult.error);
        
        // Show user-friendly error message
        if (tenantResult.userFriendlyError) {
          Alert.alert(
            tenantResult.userFriendlyError,
            `${tenantResult.error}\n\n${tenantResult.suggestions ? tenantResult.suggestions.join('\n') : ''}`
          );
        } else {
          Alert.alert('Access Error', tenantResult.error || 'Unable to validate school access');
        }
        
        return false;
      }
      
      // Initialize tenant helpers with the tenant ID
      initializeTenantHelpers(tenantResult.data.tenantId);
      console.log('🚀 ENHANCED_TENANT_SYSTEM: Tenant helpers initialized with ID:', tenantResult.data.tenantId);
      
      return true;
    } catch (error) {
      console.error('🚀 ENHANCED_TENANT_SYSTEM: Error validating tenant access:', error);
      Alert.alert('Error', 'Failed to validate school access. Please try again.');
      return false;
    }
  };

  // Check if database is properly setup and role exists in Supabase
  const validateRole = async (role) => {
    try {
      console.log('🔍 Validating role:', role);
      
      // First check if any roles exist in the database at all
      const { data: allRoles, error: allRolesError } = await supabase
        .from('roles')
        .select('role_name, id')
        .limit(10);

      if (allRolesError) {
        console.log('📝 Database error detected:', allRolesError);
        console.error('💥 Database connection error:', allRolesError);
        Alert.alert(
          'Database Connection Error', 
          'Unable to connect to the database. Please check your internet connection and try again.'
        );
        return false;
      }

      // If no roles exist in the database
      if (!allRoles || allRoles.length === 0) {
        console.log('⚠️ No roles found in database');
        Alert.alert(
          'Setup Required',
          'No roles are configured in the system. Please contact your system administrator to set up user roles.'
        );
        return false;
      }

      console.log(`📊 Found ${allRoles.length} roles in database:`, allRoles.map(r => r.role_name));
      
      // Convert lowercase role to proper case for database lookup
      const roleMap = {
        'admin': 'Admin',
        'teacher': 'Teacher', 
        'parent': 'Parent',
        'student': 'Student'
      };
      
      const properRoleName = roleMap[role.toLowerCase()];
      console.log('🏷️ Looking for role name:', properRoleName);
      
      if (!properRoleName) {
        console.log('❌ Invalid role name provided:', role);
        Alert.alert('Error', 'Invalid role selected. Please select a valid role.');
        return false;
      }
      
      // Check if the specific role exists
      const roleExists = allRoles.some(r => r.role_name === properRoleName);
      
      if (!roleExists) {
        const availableRoles = allRoles.map(r => r.role_name).join(', ');
        console.log('⚠️ Role not found:', properRoleName);
        Alert.alert(
          'Role Not Available', 
          `The role '${properRoleName}' is not configured in the system.

Available roles: ${availableRoles}

Please contact the administrator to add this role.`
        );
        return false;
      }
      
      console.log('✅ Role validation successful for:', properRoleName);
      return true;
    } catch (error) {
      console.error('💥 Role validation error:', error);
      Alert.alert(
        'Validation Error', 
        'Unable to validate user role. Please check your internet connection and try again.\n\nIf the problem persists, contact your system administrator.'
      );
      return false;
    }
  };

  const handleLogin = async () => {
    // Validate inputs
    let isValid = true;
    isValid = validateEmail(email) && isValid;
    isValid = validatePassword(password) && isValid;
    isValid = await validateRole(selectedRole) && isValid;

    if (!isValid) return;

    setIsLoading(true);
    
    try {
      // 🚀 ENHANCED_TENANT_SYSTEM: Validate tenant access before login
      const hasTenantAccess = await validateTenantAccess(email);
      if (!hasTenantAccess) {
        console.log('🚀 ENHANCED_TENANT_SYSTEM: Tenant access validation failed');
        return;
      }
      
      const { data, error } = await signIn(email, password, selectedRole);
      
      if (error) {
        Alert.alert('Login Failed', error.message || 'Invalid credentials');
        return;
      }

      // Navigation will be handled automatically by AuthContext based on user type
      console.log('Login successful:', data);
      
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradient}
        >
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
            {/* VidyaSethu Logo - Replace with your custom logo */}
            {!logoError ? (
              <Image
                source={VidyaSethuLogo}
                style={styles.logoImage}
                resizeMode="contain"
                onError={(error) => {
                  console.log('Logo file error:', error.nativeEvent.error);
                  setLogoError(true);
                }}
                onLoad={() => {
                  console.log('Logo loaded successfully');
                }}
              />
            ) : (
              // Fallback logo design when PNG logo fails to load
              <View style={styles.logoFallback}>
                {/* Beautiful text-based logo design */}
                <View style={styles.textLogoContainer}>
                  <View style={styles.textLogoCircle}>
                    <Text style={styles.textLogoMain}>VS</Text>
                  </View>
                  <View style={styles.bridgeSymbol}>
                    <View style={styles.bridgeLine} />
                    <Ionicons name="school-outline" size={24} color="rgba(255,255,255,0.8)" />
                    <View style={styles.bridgeLine} />
                  </View>
                </View>
              </View>
            )}
            <Text style={styles.appTitle}>VidyaSetu</Text>
            <Text style={styles.appSubtitle}>Bridge of Knowledge</Text>
          </Animatable.View>

          <Animatable.View style={styles.formContainer} animation="fadeInUp" duration={800}>
            {/* Role Selection */}
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>Select Role</Text>
              <View style={styles.roleButtons}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.key}
                    style={[
                      styles.roleButton,
                      selectedRole === role.key && { backgroundColor: role.color }
                    ]}
                    onPress={() => setSelectedRole(role.key)}
                  >
                    <View style={styles.roleButtonContent}>
                      {/* Show logo for teacher, parent, student; icon for admin */}
                      {role.key === 'teacher' ? (
                        <Image 
                          source={TeacherLogo} 
                          style={styles.roleLogo} 
                          resizeMode="contain"
                        />
                      ) : role.key === 'parent' ? (
                        <Image 
                          source={ParentLogo} 
                          style={styles.roleLogo} 
                          resizeMode="contain"
                        />
                      ) : role.key === 'student' ? (
                        <Image 
                          source={StudentLogo} 
                          style={styles.roleLogo} 
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons 
                          name={role.icon} 
                          size={28} 
                          color={selectedRole === role.key ? '#fff' : role.color} 
                        />
                      )}
                      <View style={styles.roleButtonTextContainer}>
                        <Text style={[
                          styles.roleButtonTitle,
                          selectedRole === role.key && { color: '#fff' }
                        ]}>
                          {role.label}
                        </Text>
                        <Text style={[
                          styles.roleButtonDescription,
                          selectedRole === role.key && { color: 'rgba(255,255,255,0.9)' }
                        ]}>
                          {role.description}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={24} color="#1976d2" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email address"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    validateEmail(text);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {emailError && (
                <Text style={styles.errorText}>{emailError}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={24} color="#1976d2" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
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
                    color="#1976d2"
                  />
                </TouchableOpacity>
              </View>
              {passwordError && (
                <Text style={styles.errorText}>{passwordError}</Text>
              )}
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                isLoading && styles.loginButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="log-in" size={24} color="#fff" />
                  <Text style={styles.loginButtonText}>Login</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Footer Section */}
            <View style={styles.footerContainer}>
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
              
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#667eea',
  },
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
  logoImage: {
    width: 80,
    height: 80,
    // Remove tintColor to show actual logo colors
  },
  logoFallback: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLogoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    }),
  },
  textLogoMain: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    ...(Platform.OS === 'web' ? {
      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
    } : {
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    }),
  },
  bridgeSymbol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bridgeLine: {
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 4,
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
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)',
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 10,
    }),
  },
  roleContainer: {
    marginBottom: 12,
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
    // Web-specific enhancements
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }),
  },
  roleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  roleButtonTextContainer: {
    marginLeft: 10,
    flex: 1,
    alignItems: 'flex-start',
  },
  roleButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  roleButtonDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  roleLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  roleButtonText: {
    fontSize: 14,
    marginLeft: 8,
    color: '#666',
  },
  inputSection: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  showPasswordButton: {
    marginLeft: 10,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 5,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 10,
    padding: 15,
    marginTop: 12,
    // Web-specific enhancements
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      ':hover': {
        backgroundColor: '#1565c0',
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(25, 118, 210, 0.3)',
      },
    }),
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
  footerContainer: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  forgotPasswordButton: {
    alignItems: 'flex-end',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#1976d2',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  signupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen;  