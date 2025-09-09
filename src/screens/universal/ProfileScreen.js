import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import Header from '../../components/Header';
import { supabase, dbHelpers } from '../../utils/supabase';
import { format } from 'date-fns';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../styles/webScrollFix';

const ProfileScreen = ({ navigation, route }) => {
  // Track if the user navigated from admin context
  const isFromAdmin = route?.params?.fromAdmin || false;
  // Create a ref to access the ScrollView directly
  const scrollViewRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    contact: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [roles, setRoles] = useState([]);
  const [scrollY, setScrollY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const { signOut, user: authUser, loading: authLoading } = useAuth();

  // Load user data
  const loadUserData = async () => {
    try {
      console.log('🚀 [ProfileScreen] Starting loadUserData...');
      console.log('🔍 [ProfileScreen] AuthUser:', authUser ? { id: authUser.id, email: authUser.email } : 'null');
      setLoading(true);
      
      if (!authUser) {
        console.log('❌ [ProfileScreen] No authenticated user found');
        return;
      }
      
      console.log('🔍 [ProfileScreen] AuthUser ID:', authUser.id);
      console.log('🔍 [ProfileScreen] AuthUser Email:', authUser.email);
      
      // Try to get user profile by email first (more reliable with RLS)
      console.log('📛 [ProfileScreen] Querying users table by email...');
      let profileData = null;
      
      const { data: profileByEmail, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();
        
      console.log('📊 [ProfileScreen] Profile by email result:');
      console.log('📊 [ProfileScreen] - profileByEmail:', profileByEmail);
      console.log('📊 [ProfileScreen] - emailError:', emailError);
      
      if (emailError) {
        console.error('❌ [ProfileScreen] Email query error:', emailError);
        // If email query fails due to RLS, show helpful message
        Alert.alert(
          'Profile Access Issue', 
          'Unable to load your profile data. This might be due to database permissions. Please contact support or try logging out and back in.',
          [
            { text: 'OK' },
            { text: 'Logout', onPress: signOut }
          ]
        );
        return;
      }
      
      if (profileByEmail) {
        console.log('✅ [ProfileScreen] Found user profile by email:', profileByEmail.id);
        profileData = profileByEmail;
      } else {
        console.log('🔍 [ProfileScreen] No user found by email, trying by auth ID...');
        
        // Fallback: try to get user by auth ID
        const { data: profileById, error: idError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
          
        if (idError) {
          console.error('❌ [ProfileScreen] ID query error:', idError);
        }
        
        if (profileById) {
          console.log('✅ [ProfileScreen] Found user profile by ID:', profileById.id);
          profileData = profileById;
        } else {
          console.log('❌ [ProfileScreen] No user profile found by email or ID');
          Alert.alert(
            'Profile Not Found', 
            'Your user profile was not found in the database. This needs to be created manually. Please contact support.',
            [
              { text: 'OK' },
              { text: 'Logout', onPress: signOut }
            ]
          );
          return;
        }
      }
      
      console.log('✅ [ProfileScreen] Profile data loaded:', {
        id: profileData.id,
        email: profileData.email,
        full_name: profileData.full_name,
        role_id: profileData.role_id,
        phone: profileData.phone
      });

      // Get user role name with role_id validation
      let roleData = null;
      let roleError = null;
      
      // Validate role_id before querying
      if (profileData?.role_id && typeof profileData.role_id === 'number' && !isNaN(profileData.role_id)) {
        console.log('🔍 [ProfileScreen] Querying role with valid role_id:', profileData.role_id);
        
        const roleResult = await supabase
          .from('roles')
          .select('role_name')
          .eq('id', profileData.role_id)
          .single();
          
        roleData = roleResult.data;
        roleError = roleResult.error;
        
        if (roleError) {
          console.error('🚨 [ProfileScreen] Role query error:', roleError);
          // Use fallback role names for common role IDs
          const fallbackRoles = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
          const fallbackRoleName = fallbackRoles[profileData.role_id] || 'User';
          console.log('🔄 [ProfileScreen] Using fallback role name:', fallbackRoleName);
          roleData = { role_name: fallbackRoleName };
        }
      } else {
        console.warn('⚠️ [ProfileScreen] Invalid or missing role_id:', profileData?.role_id, typeof profileData?.role_id);
        // Set default role for invalid role_id
        roleData = { role_name: 'User' };
      }

      setUser(profileData);
      setRoles(roleData ? [roleData.role_name] : []);
      setForm({
        name: profileData?.full_name || '',
        email: profileData?.email || '',
        contact: profileData?.phone || '',
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    loadUserData();
    
    // Inject CSS for web to prevent double scrolling
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.id = 'profile-screen-styles';
      style.textContent = `
        /* Only apply to current screen container - prevent double scrolling */
        .profile-screen-container {
          position: relative;
          height: 100%;
          overflow: hidden;
        }
        
        /* Ensure parent containers don't scroll */
        .profile-screen-container > div:first-child {
          height: 100%;
          overflow: hidden;
        }
        
        /* Only the ScrollView inside should scroll */
        .profile-scroll-view {
          height: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          scroll-behavior: smooth !important;
          scrollbar-width: thin;
        }
        
        /* Hide scrollbar on webkit browsers for cleaner look */
        .profile-scroll-view::-webkit-scrollbar {
          width: 8px;
        }
        
        .profile-scroll-view::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .profile-scroll-view::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        
        .profile-scroll-view::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.4);
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        const existingStyle = document.getElementById('profile-screen-styles');
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }

    const subscription = supabase
      .channel('profile-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users'
      }, () => {
        loadUserData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle profile update
  const handleSave = async () => {
    try {
      if (!authUser) {
        Alert.alert('Error', 'No authenticated user found');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          full_name: form.name,
          email: form.email,
          phone: form.contact
        })
        .eq('id', authUser.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      setEditing(false);
      loadUserData();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  // Handle password change
  const handleChangePassword = async () => {
    if (!password || password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      Alert.alert('Success', 'Password changed successfully');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password');
    }
  };

  // Handle photo upload
  const handleUploadPhoto = async (uri) => {
    try {
      if (!authUser) {
        Alert.alert('Error', 'No authenticated user found');
        return;
      }

      console.log('Starting photo upload for user:', authUser.id);
      console.log('Image URI:', uri);

      // First, get the current profile image to delete it later
      let oldImageFileName = null;
      try {
        const { data: currentUser } = await supabase
          .from('users')
          .select('profile_url')
          .eq('id', authUser.id)
          .single();
        
        if (currentUser?.profile_url) {
          // Extract filename from URL
          const urlParts = currentUser.profile_url.split('/');
          oldImageFileName = urlParts[urlParts.length - 1];
          console.log('Found existing image to delete:', oldImageFileName);
        }
      } catch (error) {
        console.log('No existing image to delete or error checking:', error);
      }

      // Create a file name
      const timestamp = Date.now();
      const fileName = `${authUser.id}_${timestamp}.jpg`;
      
      console.log('Generated filename:', fileName);
      
      // React Native specific file upload approach
      const formData = new FormData();
      
      // Add the file to FormData with proper React Native file object
      formData.append('', {
        uri: uri,
        type: 'image/jpeg',
        name: fileName,
      });
      
      console.log('FormData created for React Native upload');
      
      // Get the authenticated user's session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No authenticated session found');
      }

      // Upload using direct fetch to Supabase storage API
      const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
      
      const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/profiles/${fileName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          // Don't set Content-Type for FormData - let the browser set it with boundary
        },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload response error:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      const uploadData = { path: fileName };

      console.log('Upload successful:', uploadData);

      // Construct the public URL manually
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/profiles/${fileName}`;

      console.log('Generated public URL:', publicUrl);

      // Update the user's profile in the database
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({
          profile_url: publicUrl
        })
        .eq('id', authUser.id)
        .select();

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      console.log('Database update successful:', updateData);
      
      // Delete the old image from storage if it exists
      if (oldImageFileName) {
        try {
          console.log('Attempting to delete old image:', oldImageFileName);
          
          const deleteResponse = await fetch(`${supabaseUrl}/storage/v1/object/profiles/${oldImageFileName}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });
          
          if (deleteResponse.ok) {
            console.log('Old profile image deleted successfully:', oldImageFileName);
          } else {
            console.warn('Failed to delete old image (non-critical):', deleteResponse.status);
          }
        } catch (deleteError) {
          console.warn('Error deleting old image (non-critical):', deleteError);
          // Don't throw here - image upload was successful, deletion is just cleanup
        }
      }
      
      Alert.alert('Success', 'Photo updated successfully');
      loadUserData();
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', `Failed to upload photo: ${error.message || error}`);
    }
  };

  // Handle photo selection
  const handlePickPhoto = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await handleTakePhoto();
          } else if (buttonIndex === 2) {
            await handleChooseFromGallery();
          }
        }
      );
    } else {
      Alert.alert('Profile Photo', 'Select an option', [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handleChooseFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error choosing from gallery:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to use your camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Handle logout with improved web compatibility
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
              try {
                console.log('🚪 Starting logout process...');
                setLoading(true);
                
                // Add timeout for web platform to prevent hanging
                const LOGOUT_TIMEOUT = Platform.OS === 'web' ? 5000 : 10000;
                
                const logoutPromise = signOut();
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Logout timed out')), LOGOUT_TIMEOUT)
                );
                
                const result = await Promise.race([logoutPromise, timeoutPromise]);
                
                console.log('🚪 Logout result:', result);
                
                if (result?.error) {
                  // Check if it's a session missing error (which means already logged out)
                  if (result.error.message?.includes('Auth session missing') || 
                      result.error.name === 'AuthSessionMissingError') {
                    console.log('✅ Session already missing during logout, proceeding...');
                    // Don't show error, this is expected if session expired
                  } else {
                    console.error('❌ Logout error:', result.error);
                    Alert.alert('Error', `Failed to logout: ${result.error.message || 'Unknown error'}`);
                    return;
                  }
                }
                
                console.log('✅ Logout successful');
                // AuthContext will handle navigation automatically on successful logout
                
              } catch (error) {
                console.error('💥 Logout error:', error);
                
                // Handle timeout specifically
                if (error.message?.includes('timed out')) {
                  console.log('⏱️ Logout timed out, forcing local logout...');
                  Alert.alert(
                    'Logout', 
                    'Logout completed (connection timeout). You will be redirected to the login screen.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Try to navigate manually
                          if (navigation?.reset) {
                            navigation.reset({
                              index: 0,
                              routes: [{ name: 'Auth' }],
                            });
                          } else if (navigation?.navigate) {
                            navigation.navigate('Auth');
                          }
                        }
                      }
                    ]
                  );
                  return;
                }
                
                // Don't show error for session missing issues
                if (!error.message?.includes('Auth session missing') && 
                    error.name !== 'AuthSessionMissingError') {
                  console.error('❌ Unexpected logout error:', error);
                  Alert.alert('Error', 'Failed to logout. Please try again.');
                } else {
                  console.log('✅ Session was already missing, logout completed');
                }
              } finally {
                setLoading(false);
              }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <View style={styles.container} className="profile-screen-container">
      <Header title="Profile" showBack={true} />
      
      {/* Scroll Wrapper for web optimization */}
      <View style={styles.scrollWrapper}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'web' ? undefined : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          enabled={Platform.OS !== 'web'}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            className="profile-scroll-view"
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            nestedScrollEnabled={true}
            bounces={false}
            overScrollMode="never"
            scrollBehavior="smooth"
            WebkitOverflowScrolling="touch"
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadUserData} />
            }
            onScroll={(event) => {
              setScrollY(event.nativeEvent.contentOffset.y);
            }}
            onContentSizeChange={(width, height) => {
              setContentHeight(height);
            }}
            onLayout={(event) => {
              setScrollViewHeight(event.nativeEvent.layout.height);
            }}
          >
          <View style={styles.profileHeader}>
            {user?.profile_url ? (
              <TouchableOpacity onPress={handlePickPhoto}>
                <Image
                  source={{ uri: user.profile_url }}
                  style={styles.profileImage}
                />
                <View style={styles.imageEditOverlay}>
                  <Ionicons name="camera" size={20} color="#1976d2" />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.imageContainer}>
                <View style={styles.defaultProfileImage}>
                  <Ionicons name="person" size={60} color="#999" />
                </View>
                <TouchableOpacity
                  style={styles.imageOverlay}
                  onPress={handlePickPhoto}
                >
                  <Ionicons name="camera" size={24} color="#1976d2" />
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.name}>{user?.full_name || 'No Name'}</Text>
            <Text style={styles.email}>{user?.email || 'No Email'}</Text>
          </View>
          <View style={styles.rolesContainer}>
            {roles.map(role => (
              <View key={role} style={styles.roleTag}>
                <Text style={styles.roleText}>{role}</Text>
              </View>
            ))}
          </View>
          <View style={styles.form}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={text => setForm(f => ({ ...f, name: text }))}
              editable={editing}
            />
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={text => setForm(f => ({ ...f, email: text }))}
              editable={editing}
              keyboardType="email-address"
            />
            <Text style={styles.inputLabel}>Contact</Text>
            <TextInput
              style={styles.input}
              value={form.contact}
              onChangeText={text => setForm(f => ({ ...f, contact: text }))}
              editable={editing}
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={[styles.saveButton, !editing && styles.disabledButton]}
              onPress={editing ? handleSave : () => setEditing(true)}
            >
              <Text style={styles.buttonText}>
                {editing ? 'Save Changes' : 'Edit Profile'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.passwordSection}>
            <Text style={styles.sectionHeader}>Change Password</Text>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="New Password"
              secureTextEntry
            />
            <TextInput
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              secureTextEntry
            />
            <TouchableOpacity
              style={styles.passwordButton}
              onPress={handleChangePassword}
            >
              <Text style={styles.buttonText}>Change Password</Text>
            </TouchableOpacity>
          </View>
          {/* Logout Section */}
          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
  },
  defaultProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 8,
  },
  imageEditOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  roleTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1976d2',
    marginHorizontal: 4,
    marginVertical: 2,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    textTransform: 'uppercase',
  },
  form: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButton: {
    backgroundColor: '#1976d2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  passwordSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passwordButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passwordInput: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  logoutSection: {
    marginTop: 20,
    marginBottom: 40,
    paddingBottom: 30,
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginBottom: 8, // Remove marginBottom so it aligns with title
  },
  backButtonText: {
    color: '#1976d2',
    fontSize: 16,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  // Web scroll optimization styles
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 120px)',
        minHeight: 0,
        maxHeight: '100vh',
        overflow: 'hidden',
      },
      default: {
        flex: 1,
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch',
      },
    }),
  },
});

export default ProfileScreen;
