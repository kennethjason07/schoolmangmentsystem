import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
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
import { useAuth } from '../../utils/AuthContext';
import Header from '../../components/Header';
import { supabase, dbHelpers } from '../../utils/supabase';
import { format } from 'date-fns';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../styles/webScrollFix';
import { navigationService } from '../../services/NavigationService';

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
  const [photoUploading, setPhotoUploading] = useState(false);
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
      console.log('📷 [Photo Upload] Starting upload process...');
      console.log('📷 [Photo Upload] Platform:', Platform.OS);
      console.log('📷 [Photo Upload] Image URI:', uri);
      
      if (!authUser) {
        console.error('📷 [Photo Upload] No authenticated user found');
        Alert.alert('Error', 'No authenticated user found');
        return;
      }

      setPhotoUploading(true);
      console.log('📷 [Photo Upload] Starting photo upload for user:', authUser.id);

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
      
      console.log('📷 [Photo Upload] Upload completed successfully');
      Alert.alert('Success', 'Photo updated successfully');
      loadUserData();
    } catch (error) {
      console.error('📷 [Photo Upload] Upload failed with error:', error);
      console.error('📷 [Photo Upload] Error stack:', error.stack);
      Alert.alert('Upload Error', `Failed to upload photo: ${error.message || error}\n\nPlease check:\n- Your internet connection\n- App permissions\n- Try again with a smaller image`);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Handle photo removal
  const handleRemovePhoto = async () => {
    try {
      console.log('🗑️ [Photo Remove] Starting remove process...');
      
      if (!authUser) {
        console.error('🗑️ [Photo Remove] No authenticated user found');
        Alert.alert('Error', 'No authenticated user found');
        return;
      }

      if (!user?.profile_url) {
        console.log('🗑️ [Photo Remove] No profile photo to remove');
        Alert.alert('Info', 'No profile photo to remove');
        return;
      }

      setPhotoUploading(true);

      // Extract filename from URL for deletion
      const urlParts = user.profile_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      console.log('🗑️ [Photo Remove] File to delete:', fileName);

      // Get the authenticated user's session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No authenticated session found');
      }

      // Remove from database first
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_url: null })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('🗑️ [Photo Remove] Database update error:', updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      console.log('🗑️ [Photo Remove] Database updated successfully');

      // Delete from storage
      try {
        const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
        const deleteResponse = await fetch(`${supabaseUrl}/storage/v1/object/profiles/${fileName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (deleteResponse.ok) {
          console.log('🗑️ [Photo Remove] File deleted from storage successfully');
        } else {
          console.warn('🗑️ [Photo Remove] Failed to delete file from storage (non-critical):', deleteResponse.status);
        }
      } catch (storageError) {
        console.warn('🗑️ [Photo Remove] Storage deletion error (non-critical):', storageError);
      }

      Alert.alert('Success', 'Profile photo removed successfully');
      loadUserData();
    } catch (error) {
      console.error('🗑️ [Photo Remove] Remove failed with error:', error);
      Alert.alert('Remove Error', `Failed to remove photo: ${error.message || error}`);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Handle photo selection
  const handlePickPhoto = async () => {
    console.log('📷 [Photo Pick] Opening photo selection menu, platform:', Platform.OS);
    console.log('📷 [Photo Pick] Current user has photo:', !!user?.profile_url);
    
    const options = [];
    const actions = [];
    
    // Always add gallery option (works best on web)
    options.push('Choose from Gallery');
    actions.push(handleChooseFromGallery);
    
    // Add camera option for mobile platforms
    if (Platform.OS !== 'web') {
      options.push('Take Photo');
      actions.push(handleTakePhoto);
    }
    
    // Add remove option if user has a photo
    if (user?.profile_url) {
      options.push('Remove Photo');
      actions.push(() => {
        Alert.alert(
          'Remove Photo',
          'Are you sure you want to remove your profile photo?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: handleRemovePhoto }
          ]
        );
      });
    }
    
    options.push('Cancel');
    
    if (Platform.OS === 'ios' && Platform.OS !== 'web') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: user?.profile_url ? options.length - 2 : undefined,
        },
        async (buttonIndex) => {
          if (buttonIndex < actions.length) {
            await actions[buttonIndex]();
          }
        }
      );
    } else {
      const alertButtons = actions.map((action, index) => ({
        text: options[index],
        onPress: action,
        style: options[index] === 'Remove Photo' ? 'destructive' : 'default'
      }));
      alertButtons.push({ text: 'Cancel', style: 'cancel' });
      
      Alert.alert('Profile Photo', 'Select an option', alertButtons);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      console.log('🖼️ [Gallery] Starting gallery selection...');
      console.log('🖼️ [Gallery] Platform:', Platform.OS);
      
      // For web, permissions are usually handled by the browser
      if (Platform.OS !== 'web') {
        console.log('🖼️ [Gallery] Requesting media library permissions...');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('🖼️ [Gallery] Permission status:', status);
        
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant permission to access your photo library to select a profile picture.');
          return;
        }
      }

      console.log('🖼️ [Gallery] Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        // Web-specific options
        ...(Platform.OS === 'web' && {
          allowsMultipleSelection: false,
        })
      });

      console.log('🖼️ [Gallery] Image picker result:', {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
        firstAssetUri: result.assets?.[0]?.uri
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('🖼️ [Gallery] Image selected, starting upload...');
        await handleUploadPhoto(result.assets[0].uri);
      } else {
        console.log('🖼️ [Gallery] Image selection canceled or no assets');
      }
    } catch (error) {
      console.error('🖼️ [Gallery] Error choosing from gallery:', error);
      console.error('🖼️ [Gallery] Error stack:', error.stack);
      Alert.alert('Gallery Error', `Failed to select photo: ${error.message}\n\nThis might be due to:\n- Browser permissions\n- Image file format\n- File size too large`);
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
    console.log('🔴 LOGOUT BUTTON CLICKED! Platform:', Platform.OS);
    
    // Platform-specific confirmation
    if (Platform.OS === 'web') {
      // Use browser's native confirm for web
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (!confirmed) {
        console.log('❌ Logout cancelled by user');
        return;
      }
      console.log('✅ Logout confirmed by user');
      // Proceed with logout directly for web
      await performLogout();
    } else {
      // Use React Native Alert for mobile
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
              await performLogout();
            },
          },
        ]
      );
    }
  };

  // Separate logout logic into its own function
  const performLogout = async () => {
            try {
              console.log('🚪 [ProfileScreen] Starting logout process...');
              console.log('🌐 [ProfileScreen] Platform:', Platform.OS);
              setLoading(true);
              
              if (Platform.OS === 'web') {
                // Simplified web logout
                console.log('🧹 [ProfileScreen] Web platform - starting logout');
                
                // Step 1: Sign out from Supabase
                try {
                  await signOut();
                  console.log('✅ [ProfileScreen] Supabase signOut completed');
                } catch (signOutError) {
                  console.warn('⚠️ [ProfileScreen] Supabase signOut error (continuing anyway):', signOutError);
                }
                
                // Step 2: Clear all auth-related data
                try {
                  // Clear localStorage
                  if (typeof localStorage !== 'undefined') {
                    const keys = Object.keys(localStorage);
                    keys.forEach(key => {
                      if (key.includes('auth') || key.includes('supabase') || key.includes('token') || key.includes('session')) {
                        localStorage.removeItem(key);
                        console.log(`🧹 Cleared localStorage: ${key}`);
                      }
                    });
                  }
                  
                  // Clear sessionStorage
                  if (typeof sessionStorage !== 'undefined') {
                    const keys = Object.keys(sessionStorage);
                    keys.forEach(key => {
                      if (key.includes('auth') || key.includes('supabase') || key.includes('token') || key.includes('session')) {
                        sessionStorage.removeItem(key);
                        console.log(`🧹 Cleared sessionStorage: ${key}`);
                      }
                    });
                  }
                  
                  console.log('✅ [ProfileScreen] Local auth data cleared');
                } catch (clearError) {
                  console.warn('⚠️ [ProfileScreen] Error clearing local auth data:', clearError);
                }
                
                // Step 3: Force page reload - this will trigger auth check and show login
                console.log('🔄 [ProfileScreen] Reloading page to complete logout...');
                window.location.reload();
                
                // No need to continue - reload will handle everything
                return;
                
              } else {
                // Mobile platforms - use standard logout
                console.log('📱 [ProfileScreen] Mobile platform - standard logout');
                await signOut();
                // Don't manually navigate - auth context will handle navigation when user becomes null
                console.log('✅ [ProfileScreen] Sign out completed, auth context will handle navigation');
              }
              
            } catch (error) {
              console.error('💥 [ProfileScreen] Unexpected logout error:', error);
              
              // For web, force redirect even if there was an error
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                console.log('💥 [ProfileScreen] Forcing redirect due to error');
                window.location.href = '/';
              } else {
                // For mobile, show error but let auth handle the navigation
                Alert.alert('Logout Error', 'There was an issue logging out. Please try again.');
                // Don't manually navigate - if signOut was successful, auth context will handle navigation
                console.log('⚠️ [ProfileScreen] Error during logout, but letting auth context handle navigation');
              }
              
            } finally {
              if (Platform.OS !== 'web') {
                setLoading(false);
              }
            }
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
              <TouchableOpacity 
                onPress={photoUploading ? undefined : handlePickPhoto}
                disabled={photoUploading}
              >
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: user.profile_url }}
                    style={[styles.profileImage, photoUploading && styles.imageUploading]}
                  />
                  {photoUploading ? (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#1976d2" />
                      <Text style={styles.loadingText}>Processing...</Text>
                    </View>
                  ) : (
                    <View style={styles.imageEditOverlay}>
                      <Ionicons name="camera" size={20} color="#1976d2" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.imageContainer}>
                <View style={[styles.defaultProfileImage, photoUploading && styles.imageUploading]}>
                  {photoUploading ? (
                    <ActivityIndicator size="large" color="#1976d2" />
                  ) : (
                    <Ionicons name="person" size={60} color="#999" />
                  )}
                </View>
                {!photoUploading && (
                  <TouchableOpacity
                    style={styles.imageOverlay}
                    onPress={handlePickPhoto}
                  >
                    <Ionicons name="camera" size={24} color="#1976d2" />
                  </TouchableOpacity>
                )}
                {photoUploading && (
                  <View style={styles.loadingTextContainer}>
                    <Text style={styles.loadingText}>Processing...</Text>
                  </View>
                )}
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
            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                { 
                  opacity: pressed ? 0.7 : 1,
                  cursor: Platform.OS === 'web' ? 'pointer' : 'default'
                }
              ]}
              onPress={() => {
                console.log('🔴 Pressable Logout button pressed!');
                handleLogout();
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.logoutIcon} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
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
  imageUploading: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTextContainer: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
    marginTop: 8,
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
