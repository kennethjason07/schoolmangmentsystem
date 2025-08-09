import React, { useState, useEffect } from 'react';
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

const ProfileScreen = () => {
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
  const navigation = useNavigation();
  const { signOut, user: authUser } = useAuth();

  // Load user data
  const loadUserData = async () => {
    try {
      setLoading(true);
      
      if (!authUser) {
        console.log('No authenticated user found');
        return;
      }
      
      // Get user profile from users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      // Get user role name
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('role_name')
        .eq('id', profileData?.role_id)
        .single();

      if (roleError) {
        console.error('Role error:', roleError);
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
          phone: form.contact,
          updated_at: new Date().toISOString()
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

      // Upload to Supabase storage
      const fileName = `${authUser.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, uri, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Update profile with new photo URL
      const { error: updateError } = await supabase
        .from('users')
        .update({
          photo_url: `${supabase.storage.getPublicUrl('profiles', fileName).data.publicUrl}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Photo updated successfully');
      loadUserData();
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo');
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  // Handle logout
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
                const result = await signOut();
                if (result?.error) {
                  // Check if it's a session missing error (which means already logged out)
                  if (result.error.message?.includes('Auth session missing') || result.error.name === 'AuthSessionMissingError') {
                    console.log('Session already missing during logout, proceeding...');
                    // Don't show error, this is expected if session expired
                  } else {
                    console.error('Logout error:', result.error);
                    Alert.alert('Error', `Failed to logout: ${result.error.message || 'Unknown error'}`);
                  }
                }
                // AuthContext will handle navigation automatically on successful logout
              } catch (error) {
                console.error('Logout error:', error);
                // Don't show error for session missing issues
                if (!error.message?.includes('Auth session missing') && error.name !== 'AuthSessionMissingError') {
                  Alert.alert('Error', 'Failed to logout');
                }
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
    <View style={styles.container}>
      <Header title="Profile" showBack={true} />
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadUserData} />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          bounces={true}
          alwaysBounceVertical={true}
          nestedScrollEnabled={true}
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
            {user?.photo_url ? (
              <Image
                source={{ uri: user.photo_url }}
                style={styles.profileImage}
              />
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
            <Text style={styles.name}>{user?.name || 'No Name'}</Text>
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
    marginBottom: 10,
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
});

export default ProfileScreen;
