import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode as atob } from 'base-64';
import Header from '../../components/Header';
import { supabase, dbHelpers } from '../../utils/supabase';

const SchoolDetails = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [schoolData, setSchoolData] = useState({
    name: '',
    type: 'School', // School or College
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    principal_name: '',
    established_year: '',
    affiliation: '',
    logo_url: '',
    description: '',
  });

  useEffect(() => {
    loadSchoolDetails();
  }, []);

  const loadSchoolDetails = async () => {
    try {
      setLoading(true);
      console.log('=== Loading school details ===');
      const { data, error } = await dbHelpers.getSchoolDetails();

      console.log('School details query result:', { data, error });
      if (data) {
        console.log('Logo URL from database:', data.logo_url);
        if (data.logo_url) {
          console.log('Logo URL exists - will attempt to display image');
          console.log('URL starts with http:', data.logo_url.startsWith('http'));
          console.log('URL starts with file:', data.logo_url.startsWith('file:'));
          if (data.logo_url.startsWith('file:')) {
            console.log('🚫 Local file path detected, will show placeholder instead');
          }
        } else {
          console.log('No logo URL found in database');
        }
      }

      if (error) {
        console.log('Error loading school details:', error);
        // Don't show error for missing data, just use defaults
        const errorMessage = error.message || '';
        if (error.code !== 'PGRST116' && !errorMessage.includes('no rows')) {
          Alert.alert('Error', 'Failed to load school details: ' + errorMessage);
        }
      }

      if (data) {
        setSchoolData(data);
        console.log('School data state updated with:', data);
      }
    } catch (error) {
      console.log('Exception loading school details:', error);
      // Don't show error for missing data, just use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSchoolData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const showImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImageFromCamera();
          } else if (buttonIndex === 2) {
            pickImageFromGallery();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Image',
        'Choose how you want to select an image',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: pickImageFromCamera },
          { text: 'Choose from Gallery', onPress: pickImageFromGallery },
        ]
      );
    }
  };

  const pickImageFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo: ' + (error.message || error));
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image: ' + (error.message || error));
    }
  };

  const uploadImage = async (imageAsset) => {
    try {
      setUploading(true);
      
  console.log('=== Starting school logo upload debug ===');
      console.log('Current schoolData.logo_url before upload:', schoolData.logo_url);
      console.log('Image URI:', imageAsset.uri);
      console.log('Image size:', imageAsset.fileSize);
      console.log('Image type:', imageAsset.type || 'unknown');

      // Step 1: Check authentication status
      console.log('Step 1: Checking authentication...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Current user:', user?.id || 'Not authenticated');
      console.log('Auth error:', authError);
      
      if (!user) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Step 2: Test basic Supabase connection
      console.log('Step 2: Testing Supabase connection...');
      try {
        const { data: testData, error: testError } = await supabase
          .from('school_details')
          .select('count', { count: 'exact', head: true });
        console.log('Connection test result:', { testData, testError });
      } catch (testErr) {
        console.log('Connection test failed:', testErr);
      }

      // Step 3: Skip bucket checking - we know profiles bucket exists (used by profile pictures)
      console.log('Step 3: Skipping bucket check - profiles bucket is confirmed to exist');
      console.log('Note: profiles bucket is actively used by profile picture uploads');

      // Step 4: Generate filename exactly like working profile pictures
      console.log('Step 4: Preparing file for upload...');
      const timestamp = Date.now();
      const fileName = `${user.id}_${timestamp}.jpg`;
      console.log('Generated filename (exact profile picture format):', fileName);
      
      // Read the image using expo-file-system (React Native compatible)
      console.log('Reading image via FileSystem...');
      const base64 = await FileSystem.readAsStringAsync(imageAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 → Uint8Array (React Native compatible)
      const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      console.log('File data created - size:', fileData.length, 'type: image/jpeg');

      // Step 5: Delete old logo if exists
      if (schoolData.logo_url) {
        console.log('Step 5: Deleting old logo...');
        try {
          // Extract filename from old URL
          const oldFileName = schoolData.logo_url.split('/').pop().split('?')[0];
          console.log('Old filename to delete:', oldFileName);
          
          const { error: deleteError } = await supabase.storage
            .from('profiles')
            .remove([oldFileName]);
            
          if (deleteError) {
            console.log('Delete error (might not exist):', deleteError);
          } else {
            console.log('Old logo deleted successfully');
          }
        } catch (deleteErr) {
          console.log('Delete operation failed:', deleteErr);
        }
      }

      // Step 6: Upload new image using Supabase storage (React Native compatible)
      console.log('Step 6: Uploading new image using Uint8Array...');
      console.log('Upload parameters:', {
        bucket: 'profiles',
        fileName,
        dataSize: fileData.length,
        contentType: 'image/jpeg'
      });
      
      // Upload using Supabase storage with Uint8Array (React Native compatible)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, fileData, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true // Allow replacing existing files
        });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      console.log('Upload successful:', uploadData);

      // Step 7: Generate public URL using Supabase
      console.log('Step 7: Generating public URL...');
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(fileName);
      console.log('Public URL generated:', publicUrl);

      // Step 8: Update state and save to database immediately
      console.log('Step 8: Updating state with new URL...');
      handleInputChange('logo_url', publicUrl);
      
      // Step 9: Save the new logo URL to database immediately
      console.log('Step 9: Saving new logo URL to database...');
      try {
        const updatedSchoolData = { ...schoolData, logo_url: publicUrl };
        console.log('Updating database with:', updatedSchoolData);
        
        const { data: saveData, error: saveError } = await dbHelpers.updateSchoolDetails(updatedSchoolData);
        
        if (saveError) {
          console.error('Failed to save logo URL to database:', saveError);
          throw new Error('Failed to save logo URL: ' + saveError.message);
        }
        
        console.log('Logo URL saved to database successfully:', saveData);
        
        // Update local state with saved data
        if (saveData) {
          setSchoolData(saveData);
          console.log('Local state updated with saved data:', saveData);
        }
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // Still show success for upload, but warn about database
        Alert.alert('Warning', 'Image uploaded but failed to save to database. Please try saving the form.');
        return;
      }
      
      // Step 10: Force component refresh to ensure UI updates
      console.log('Step 10: Reloading school details to refresh UI...');
      setTimeout(() => {
        loadSchoolDetails();
      }, 500);
      
      console.log('=== Upload completed successfully! ===');
      Alert.alert('Success', 'Logo uploaded successfully!');
      
    } catch (error) {
      console.error('=== Upload failed ===');
      console.error('Error object:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error cause:', error.cause);
      console.error('Error stack:', error.stack);
      
      let errorMessage = 'Failed to upload logo';
      let userFriendlyMessage = '';
      
      // Categorize different types of errors
      if (error.name === 'StorageUnknownError') {
        if (error.message.includes('Network request failed')) {
          userFriendlyMessage = 'Network connection failed. Please check your internet connection and try again.';
        } else {
          userFriendlyMessage = 'Storage service error. Please try again later.';
        }
      } else if (error.message && error.message.includes('row-level security policy')) {
        userFriendlyMessage = 'Permission denied: Storage bucket requires additional configuration. Please contact your administrator.';
      } else if (error.message && error.message.includes('bucket')) {
        userFriendlyMessage = 'Storage bucket configuration issue. Please contact your administrator.';
      } else if (error.message && error.message.includes('authenticated')) {
        userFriendlyMessage = 'Authentication required. Please log out and log back in.';
      } else {
        userFriendlyMessage = errorMessage + ': ' + (error.message || 'Unknown error');
      }
      
      Alert.alert(
        'Upload Error', 
        userFriendlyMessage,
        [
          {
            text: 'OK',
            style: 'default'
          },
          {
            text: 'View Details',
            style: 'default',
            onPress: () => {
              Alert.alert(
                'Technical Details',
                `Error Type: ${error.name || 'Unknown'}\n\nMessage: ${error.message || 'No message'}\n\nPlease share these details with your administrator.`,
                [{ text: 'OK', style: 'default' }]
              );
            }
          }
        ]
      );
    } finally {
      setUploading(false);
    }
  };

  const saveSchoolDetails = async () => {
    try {
      setSaving(true);

      // Validate required fields
      if (!schoolData.name.trim()) {
        Alert.alert('Error', 'School/College name is required');
        return;
      }

      console.log('Saving school data:', schoolData);
      const { data, error } = await dbHelpers.updateSchoolDetails(schoolData);

      console.log('Save result:', { data, error });

      if (error) {
        console.error('Save error details:', error);
        throw error;
      }

      if (data) {
        setSchoolData(data);
      }
      
      // Show success message and navigate back to dashboard
      Alert.alert(
        'Success', 
        'School details saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to dashboard
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Save exception:', error);
      // Show error message and navigate back to dashboard
      Alert.alert(
        'Error', 
        'Failed to save school details: ' + (error.message || error),
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to dashboard even on error
              navigation.goBack();
            }
          }
        ]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="School Details" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading school details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="School Details" showBack={true} onBack={() => navigation.goBack()} />
      
      <View style={styles.scrollWrapper}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          keyboardShouldPersistTaps="handled"
          bounces={Platform.OS !== 'web'}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => {}} />
          }
        >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Text style={styles.sectionTitle}>Logo</Text>
            <TouchableOpacity 
              style={[styles.logoContainer, uploading && styles.logoContainerUploading]} 
              onPress={showImagePicker}
              disabled={uploading}
            >
              {uploading ? (
                <View style={styles.logoPlaceholder}>
                  <ActivityIndicator size="large" color="#2196F3" />
                  <Text style={styles.logoPlaceholderText}>Uploading...</Text>
                </View>
              ) : schoolData.logo_url && schoolData.logo_url.startsWith('http') && !schoolData.logo_url.startsWith('file:') ? (
                <>
                  <Image 
                    key={schoolData.logo_url}
                    source={{ uri: schoolData.logo_url }} 
                    style={styles.logoImage}
                    onLoad={() => {
                      console.log('=== IMAGE LOADED SUCCESSFULLY ===');
                      console.log('Image URL that loaded:', schoolData.logo_url);
                    }}
                    onError={(error) => {
                      console.error('=== IMAGE LOAD ERROR ===');
                      console.error('Failed to load image URL:', schoolData.logo_url);
                      console.error('Image error details:', {
                        nativeError: error.nativeEvent?.error,
                        fullError: error,
                        errorType: typeof error,
                        errorKeys: Object.keys(error || {})
                      });
                      console.error('This image will not display - placeholder should show instead');
                      
                      // Test if we can fetch the URL directly
                      fetch(schoolData.logo_url)
                        .then(response => {
                          console.log('Direct fetch test - Status:', response.status, response.statusText);
                          console.log('Direct fetch test - Headers:', response.headers);
                        })
                        .catch(fetchError => {
                          console.error('Direct fetch test failed:', fetchError);
                        });
                    }}
                    onLoadStart={() => {
                      console.log('=== IMAGE LOAD STARTED ===');
                      console.log('Attempting to load image from:', schoolData.logo_url);
                      console.log('URL validation - starts with http:', schoolData.logo_url.startsWith('http'));
                      console.log('URL validation - length:', schoolData.logo_url.length);
                    }}
                    onLoadEnd={() => {
                      console.log('=== IMAGE LOAD ENDED ===');
                    }}
                  />
                  
                  <View style={styles.logoOverlay}>
                    <Ionicons name="camera" size={20} color="#fff" />
                  </View>
                </>
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="school-outline" size={32} color="#bbb" />
                  <Ionicons name="add-circle" size={20} color="#2196F3" style={styles.addIcon} />
                  <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
                </View>
              )}
            </TouchableOpacity>
            {schoolData.logo_url && schoolData.logo_url.startsWith('http') && !schoolData.logo_url.startsWith('file:') && !uploading && (
              <Text style={styles.logoHint}>Tap to change logo</Text>
            )}
            
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Institution Name *</Text>
              <TextInput
                style={styles.input}
                value={schoolData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="Enter school/college name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, schoolData.type === 'School' && styles.typeButtonActive]}
                  onPress={() => handleInputChange('type', 'School')}
                >
                  <Text style={[styles.typeButtonText, schoolData.type === 'School' && styles.typeButtonTextActive]}>
                    School
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, schoolData.type === 'College' && styles.typeButtonActive]}
                  onPress={() => handleInputChange('type', 'College')}
                >
                  <Text style={[styles.typeButtonText, schoolData.type === 'College' && styles.typeButtonTextActive]}>
                    College
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Principal/Director Name</Text>
              <TextInput
                style={styles.input}
                value={schoolData.principal_name}
                onChangeText={(value) => handleInputChange('principal_name', value)}
                placeholder="Enter principal/director name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Established Year</Text>
              <TextInput
                style={styles.input}
                value={schoolData.established_year}
                onChangeText={(value) => handleInputChange('established_year', value)}
                placeholder="Enter establishment year"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Affiliation</Text>
              <TextInput
                style={styles.input}
                value={schoolData.affiliation}
                onChangeText={(value) => handleInputChange('affiliation', value)}
                placeholder="Enter board/university affiliation"
              />
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={schoolData.address}
                onChangeText={(value) => handleInputChange('address', value)}
                placeholder="Enter complete address"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={schoolData.city}
                  onChangeText={(value) => handleInputChange('city', value)}
                  placeholder="City"
                />
              </View>
              
              <View style={[styles.inputGroup, styles.flex1, styles.marginLeft]}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  value={schoolData.state}
                  onChangeText={(value) => handleInputChange('state', value)}
                  placeholder="State"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Pincode</Text>
              <TextInput
                style={styles.input}
                value={schoolData.pincode}
                onChangeText={(value) => handleInputChange('pincode', value)}
                placeholder="Enter pincode"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={schoolData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={schoolData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Website</Text>
              <TextInput
                style={styles.input}
                value={schoolData.website}
                onChangeText={(value) => handleInputChange('website', value)}
                placeholder="Enter website URL"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={schoolData.description}
                onChangeText={(value) => handleInputChange('description', value)}
                placeholder="Enter a brief description about the institution"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveSchoolDetails}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Details</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Enhanced scroll wrapper styles for web compatibility
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto'
      }
    })
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  flex1: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxHeight: '100vh', // Set max height for web
      overflowY: 'auto',  // Enable vertical scrolling on web
    })
  },
  scrollContent: {
    flexGrow: 1,
    ...(Platform.OS === 'web' && {
      minHeight: '100%',  // Ensure content takes full height on web
    })
  },
  content: {
    padding: 20,
    paddingBottom: Platform.OS === 'web' ? 80 : 40, // Extra bottom padding for web to ensure save button is visible
    ...(Platform.OS === 'web' && {
      minHeight: 'calc(100vh - 100px)', // Ensure content is tall enough to scroll properly on web
    })
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  logoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    position: 'relative',
  },
  logoContainerUploading: {
    opacity: 0.7,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    position: 'relative',
  },
  logoPlaceholderText: {
    marginTop: 8,
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  addIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  logoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  typeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  marginLeft: {
    marginLeft: 10,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SchoolDetails;
