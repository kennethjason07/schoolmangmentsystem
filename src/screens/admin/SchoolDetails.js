import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
      const { data, error } = await dbHelpers.getSchoolDetails();

      if (error) {
        console.log('Error loading school details:', error);
        // Don't show error for missing data, just use defaults
        if (error.code !== 'PGRST116' && !error.message?.includes('no rows')) {
          Alert.alert('Error', 'Failed to load school details: ' + error.message);
        }
      }

      if (data) {
        setSchoolData(data);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo: ' + error.message);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  const uploadImage = async (imageAsset) => {
    try {
      setUploading(true);
      
      // Create a unique filename
      const timestamp = Date.now();
      const fileExt = imageAsset.uri.split('.').pop();
      const fileName = `school-logo-${timestamp}.${fileExt}`;
      
      // Convert image to blob
      const response = await fetch(imageAsset.uri);
      const blob = await response.blob();
      
      // Delete old logo if exists
      if (schoolData.logo_url) {
        try {
          const oldFileName = schoolData.logo_url.split('/').pop();
          if (oldFileName && oldFileName !== fileName) {
            await supabase.storage
              .from('school-logos')
              .remove([oldFileName]);
          }
        } catch (deleteError) {
          console.log('Error deleting old logo:', deleteError);
          // Don't block upload if delete fails
        }
      }
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('school-logos')
        .getPublicUrl(fileName);
      
      // Update state with new URL
      handleInputChange('logo_url', publicUrl);
      
      Alert.alert('Success', 'Logo uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload logo. Please try again.');
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
        'Failed to save school details: ' + error.message,
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
      
      <KeyboardAvoidingView 
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={true}
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
              ) : schoolData.logo_url ? (
                <>
                  <Image source={{ uri: schoolData.logo_url }} style={styles.logoImage} />
                  <View style={styles.logoOverlay}>
                    <Ionicons name="camera" size={20} color="#fff" />
                  </View>
                </>
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="camera" size={40} color="#999" />
                  <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
                </View>
              )}
            </TouchableOpacity>
            {schoolData.logo_url && !uploading && (
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
      </KeyboardAvoidingView>
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
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  flex1: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40, // Extra padding at bottom for better scroll experience
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
  },
  logoPlaceholderText: {
    marginTop: 5,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
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
