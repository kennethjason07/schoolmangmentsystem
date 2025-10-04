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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as atob } from 'base-64';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import { useTenantAccess, tenantDatabase } from '../../utils/tenantHelpers';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';

const SchoolDetails = ({ navigation }) => {
  const { user } = useAuth();
  
  // 🚀 ENHANCED: Use the new tenant access hook
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearingLogo, setClearingLogo] = useState(false);
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
  
  // UPI Settings State
  const [upiSettings, setUpiSettings] = useState([]);
  const [upiLoading, setUpiLoading] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [editingUpi, setEditingUpi] = useState(null);
  const [upiFormData, setUpiFormData] = useState({
    upi_id: '',
    upi_name: '',
    description: '',
    is_primary: false,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadSchoolDetails(), loadUpiSettings()]);
    } catch (error) {
      console.error('Error refreshing school details:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // 🚀 ENHANCED: Only load data when tenant is ready
    if (!isReady) return;
    (async () => {
      await Promise.all([loadSchoolDetails(), loadUpiSettings()]);
    })();
  }, [isReady]);

  const loadSchoolDetails = async () => {
    try {
      setLoading(true);
      console.log('🚀 SchoolDetails: Loading school details with enhanced tenant system...');
      
      // 🚀 ENHANCED: Use tenant database for automatic tenant filtering
      const { data, error } = await tenantDatabase.read('school_details', {}, '*');
      
      console.log('🚀 SchoolDetails: Enhanced query result:', { 
        hasData: !!data, 
        dataLength: data?.length, 
        error: error?.message,
        tenantName 
      });

      if (error) {
        console.log('❌ Error loading school details:', error);
        // Don't show error for missing data, just use defaults
        const errorMessage = error.message || '';
        if (error.code !== 'PGRST116' && !errorMessage.includes('no rows')) {
          Alert.alert('Error', 'Failed to load school details: ' + errorMessage);
        }
      }

      if (data && data.length > 0) {
        // Use the first record (there should only be one per tenant)
        const schoolData = data[0];
        setSchoolData(schoolData);
        console.log('✅ School data loaded successfully for tenant:', tenantName);
        console.log('Logo URL from database:', schoolData.logo_url);
      } else {
        console.log('📝 No school details found for tenant:', tenantName, '- using defaults');
      }
    } catch (error) {
      console.log('❌ Exception loading school details:', error);
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
    if (Platform.OS === 'web') {
      // For web, directly open file picker (camera is not available)
      pickImageFromGallery();
    } else if (Platform.OS === 'ios') {
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
      console.log('🖼️ Starting image picker for platform:', Platform.OS);
      
      // For web platform, permissions are handled differently
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant camera roll permissions to upload logo.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: Platform.OS === 'web' ? ImagePicker.MediaTypeOptions.Images : 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        // Web-specific options
        ...(Platform.OS === 'web' && {
          allowsMultipleSelection: false,
        }),
      });

      console.log('🖼️ Image picker result:', {
        canceled: result.canceled,
        hasAssets: !!result.assets,
        assetsLength: result.assets?.length,
        firstAsset: result.assets?.[0] ? {
          uri: result.assets[0].uri,
          type: result.assets[0].type,
          fileSize: result.assets[0].fileSize
        } : null
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('🖼️ Processing selected image...');
        await uploadImage(result.assets[0]);
      } else {
        console.log('🖼️ Image selection was canceled or no image selected');
      }
    } catch (error) {
      console.error('🖼️ Error in pickImageFromGallery:', error);
      Alert.alert(
        'Error', 
        Platform.OS === 'web' 
          ? 'Failed to select image. Please make sure you selected a valid image file.' 
          : 'Failed to pick image: ' + (error.message || error)
      );
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
      console.log('🚀 Enhanced tenant context - Tenant Name:', tenantName);

      // Step 1: Use current authenticated user from context for naming only
      if (!user || !user.id) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Step 3: Skip bucket checking - we know profiles bucket exists (used by profile pictures)
      console.log('Step 3: Skipping bucket check - profiles bucket is confirmed to exist');
      console.log('Note: profiles bucket is actively used by profile picture uploads');

      // Step 4: Generate filename exactly like working profile pictures
      console.log('Step 4: Preparing file for upload...');
      const timestamp = Date.now();
      const fileName = `school_logo_${user.id}_${timestamp}.jpg`;
      console.log('Generated filename (school logo format):', fileName);
      
      // Read the image - different approach for web vs mobile
      let fileData;
      if (Platform.OS === 'web') {
        console.log('Reading image for web platform...');
        // For web, the URI might be a blob URL or data URL
        if (imageAsset.uri.startsWith('data:')) {
          // Data URL - extract base64 part
          const base64 = imageAsset.uri.split(',')[1];
          fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else {
          // Blob URL - fetch as blob then convert to array buffer
          const response = await fetch(imageAsset.uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          fileData = new Uint8Array(arrayBuffer);
        }
      } else {
        // Mobile - use FileSystem
        console.log('Reading image via FileSystem legacy API...');
        const base64 = await FileSystem.readAsStringAsync(imageAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      }
      
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
      
      // Step 9: Save the new logo URL to database with retry mechanism (single upsert)
      console.log('Step 9: Saving new logo URL to database...');
      const saveToDatabase = async (retryCount = 0) => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 1000; // 1 second
        try {
          const tenantId = getTenantId();
          if (!tenantId) throw new Error('No tenant context available');
          const upsertPayload = { ...schoolData, logo_url: publicUrl, tenant_id: tenantId };
          console.log('Upserting school_details with:', upsertPayload, `(Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
          // Fallback pattern for environments without unique tenant_id:
          // Try update by tenant_id, otherwise insert
          const { data: updatedRows, error: updateError } = await supabase
            .from('school_details')
            .update(upsertPayload)
            .eq('tenant_id', tenantId)
            .select();
          if (updateError) throw updateError;
          if (updatedRows && updatedRows.length > 0) {
            setSchoolData(updatedRows[0]);
            return updatedRows[0];
          }
          const { data: insertedRows, error: insertError } = await supabase
            .from('school_details')
            .insert(upsertPayload)
            .select();
          if (insertError) throw insertError;
          const saved = insertedRows && insertedRows[0] ? insertedRows[0] : null;
          if (saved) setSchoolData(saved);
          return saved;
        } catch (dbError) {
          if (
            retryCount < MAX_RETRIES &&
            (dbError.message?.includes('timeout') ||
              dbError.message?.includes('network') ||
              dbError.message?.includes('connection'))
          ) {
            console.log(`Retrying database save due to error: ${dbError.message}`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return await saveToDatabase(retryCount + 1);
          }
          throw dbError;
        }
      };
      
      try {
        await saveToDatabase();
      } catch (dbError) {
        console.error('Database save error after all retries:', dbError);
        // Still show success for upload, but warn about database
        Alert.alert('Warning', 'Image uploaded successfully but failed to save to database. Please try saving the form manually.');
        return;
      }
      
      // Step 10: Local state already updated; skip reloading to avoid extra network calls
      
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
      
      // Enhanced error handling for web platform
      if (Platform.OS === 'web') {
        console.log('🌐 Web platform error - providing enhanced feedback');
        Alert.alert(
          'Upload Error', 
          userFriendlyMessage + '\n\nTip: Make sure you selected a valid image file (JPG, PNG) under 10MB.',
          [
            {
              text: 'OK',
              style: 'default'
            },
            {
              text: 'Try Again',
              style: 'default',
              onPress: () => showImagePicker()
            },
            {
              text: 'View Details',
              style: 'default',
              onPress: () => {
                Alert.alert(
                  'Technical Details',
                  `Platform: Web\nError Type: ${error.name || 'Unknown'}\nMessage: ${error.message || 'No message'}\n\nIf this persists, try refreshing the page or using a different browser.`,
                  [{ text: 'OK', style: 'default' }]
                );
              }
            }
          ]
        );
      } else {
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
      }
    } finally {
      setUploading(false);
    }
  };

  // Clear logo function with retry mechanism
  const clearLogo = async () => {
    console.log('🗑️ Clear logo function called');
    console.log('🗑️ Current logo URL:', schoolData.logo_url);
    console.log('🗑️ Platform:', Platform.OS);
    
    // For web platform, use a simpler confirmation
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to remove the current logo?');
      console.log('🗑️ Web confirmation result:', confirmed);
      
      if (confirmed) {
        console.log('🗑️ User confirmed via web dialog - proceeding...');
        await executeClearLogo();
      } else {
        console.log('🗑️ User cancelled via web dialog');
      }
    } else {
      // Mobile - use Alert.alert
      Alert.alert(
        'Clear Logo',
        'Are you sure you want to remove the current logo?',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => console.log('🗑️ User cancelled logo clearing')
          },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: async () => {
              console.log('🗑️ User confirmed logo clearing - proceeding...');
              await executeClearLogo();
            }
          }
        ]
      );
    }
  };
  
  // Extract the clear logo execution logic into a separate function
  const executeClearLogo = async () => {
    const clearFromDatabase = async (retryCount = 0) => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second
      try {
        const tenantId = getTenantId();
        if (!tenantId) throw new Error('No tenant context available');
        console.log(`Clearing logo for tenant ${tenantId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
        const { data: saveData, error: saveError } = await supabase
          .from('school_details')
          .update({ logo_url: '' })
          .eq('tenant_id', tenantId)
          .select()
          .single();
        if (saveError) throw saveError;
        const clearedData = saveData ? { ...saveData, logo_url: '' } : { ...schoolData, logo_url: '' };
        setSchoolData(clearedData);
        return clearedData;
      } catch (dbError) {
        if (
          retryCount < MAX_RETRIES &&
          (dbError.message?.includes('timeout') ||
            dbError.message?.includes('network') ||
            dbError.message?.includes('connection'))
        ) {
          console.log(`Retrying logo clear due to error: ${dbError.message}`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return await clearFromDatabase(retryCount + 1);
        }
        throw dbError;
      }
    };

    try {
      console.log('🗑️ Starting clear logo process...');
      setClearingLogo(true);
      const result = await clearFromDatabase();
      console.log('🗑️ Clear logo process completed successfully:', result);
      Alert.alert('Success', 'Logo cleared successfully!');
    } catch (error) {
      console.error('Error clearing logo after all retries:', error);
      Alert.alert(
        'Error',
        'Failed to clear logo. This might be due to a connection issue. Please check your internet connection and try again.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Retry', style: 'default', onPress: () => clearLogo() }
        ]
      );
    } finally {
      setClearingLogo(false);
    }
  };

  // UPI Management Functions - Enhanced with tenant system
  const loadUpiSettings = async () => {
    try {
      setUpiLoading(true);
      
      // 🚀 ENHANCED: Use cached tenant ID
      const tenantId = getTenantId();
      console.log('🚀 Loading UPI settings for cached tenant:', tenantId);
      
      if (!tenantId) {
        console.warn('⚠️ No tenant ID available for UPI settings');
        return;
      }
      
      const { data, error } = await supabase
        .from('school_upi_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error loading UPI settings:', error);
        if (error.code !== 'PGRST116') {
          Alert.alert('Error', 'Failed to load UPI settings: ' + error.message);
        }
      } else {
        console.log('✅ UPI settings loaded for tenant:', tenantName, '- Count:', data?.length || 0);
        setUpiSettings(data || []);
      }
    } catch (error) {
      console.error('❌ Exception loading UPI settings:', error);
    } finally {
      setUpiLoading(false);
    }
  };
  
  const handleAddUpi = () => {
    setEditingUpi(null);
    setUpiFormData({
      upi_id: '',
      upi_name: '',
      description: '',
      is_primary: upiSettings.length === 0, // First UPI ID should be primary
    });
    setShowUpiModal(true);
  };
  
  const handleEditUpi = (upiSetting) => {
    setEditingUpi(upiSetting);
    setUpiFormData({
      upi_id: upiSetting.upi_id,
      upi_name: upiSetting.upi_name,
      description: upiSetting.description || '',
      is_primary: upiSetting.is_primary,
    });
    setShowUpiModal(true);
  };
  
  const handleUpiFormChange = (field, value) => {
    setUpiFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const validateUpiId = (upiId) => {
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/;
    return upiRegex.test(upiId);
  };
  
  const handleSaveUpi = async () => {
    try {
      // Validation
      if (!upiFormData.upi_id.trim()) {
        Alert.alert('Error', 'UPI ID is required');
        return;
      }
      if (!validateUpiId(upiFormData.upi_id)) {
        Alert.alert('Error', 'Please enter a valid UPI ID (e.g., user@bank)');
        return;
      }
      if (!upiFormData.upi_name.trim()) {
        Alert.alert('Error', 'UPI name is required');
        return;
      }
      setUpiLoading(true);
      // 🚀 ENHANCED: Use cached tenant ID
      const tenantId = getTenantId();
      if (!tenantId) {
        Alert.alert('Error', 'No tenant context available');
        return;
      }
      const upiData = {
        tenant_id: tenantId,
        upi_id: upiFormData.upi_id.trim(),
        upi_name: upiFormData.upi_name.trim(),
        description: upiFormData.description.trim() || null,
        is_primary: upiFormData.is_primary,
        is_active: true,
      };
      let result;
      if (editingUpi) {
        // Update existing UPI setting
        result = await supabase
          .from('school_upi_settings')
          .update({
            ...upiData,
            updated_by: user?.id,
          })
          .eq('id', editingUpi.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();
      } else {
        // Create new UPI setting
        result = await supabase
          .from('school_upi_settings')
          .insert({
            ...upiData,
            created_by: user?.id,
          })
          .select()
          .single();
      }
      const { data, error } = result;
      if (error) {
        console.error('Error saving UPI setting:', error);
        Alert.alert('Error', 'Failed to save UPI setting: ' + error.message);
        return;
      }
      // Optimistic update instead of reloading
      setShowUpiModal(false);
      setUpiSettings(prev => {
        if (editingUpi) {
          return prev.map(u => (u.id === editingUpi.id ? data : u));
        }
        return [data, ...prev];
      });
      Alert.alert('Success', editingUpi ? 'UPI setting updated successfully!' : 'UPI setting added successfully!');
    } catch (error) {
      console.error('Exception saving UPI setting:', error);
      Alert.alert('Error', 'Failed to save UPI setting. Please try again.');
    } finally {
      setUpiLoading(false);
    }
  };
  
  const handleDeleteUpi = (upiSetting) => {
    Alert.alert(
      'Delete UPI Setting',
      `Are you sure you want to delete "${upiSetting.upi_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpiLoading(true);
              
              // 🚀 ENHANCED: Use cached tenant ID
              const tenantId = getTenantId();
              if (!tenantId) {
                Alert.alert('Error', 'No tenant context available');
                return;
              }
              
              const { error } = await supabase
                .from('school_upi_settings')
                .delete()
                .eq('id', upiSetting.id)
                .eq('tenant_id', tenantId);
              
              if (error) {
                console.error('Error deleting UPI setting:', error);
                Alert.alert('Error', 'Failed to delete UPI setting: ' + error.message);
                return;
              }
              
              // Optimistic update instead of reload
              setUpiSettings(prev => prev.filter(u => u.id !== upiSetting.id));
              Alert.alert('Success', 'UPI setting deleted successfully!');
              
            } catch (error) {
              console.error('Exception deleting UPI setting:', error);
              Alert.alert('Error', 'Failed to delete UPI setting. Please try again.');
            } finally {
              setUpiLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const handleSetPrimary = async (upiSetting) => {
    if (upiSetting.is_primary) {
      Alert.alert('Info', 'This UPI ID is already set as primary.');
      return;
    }
    
    try {
      setUpiLoading(true);
      
      // 🚀 ENHANCED: Use cached tenant ID
      const tenantId = getTenantId();
      if (!tenantId) {
        Alert.alert('Error', 'No tenant context available');
        return;
      }
      
      // Update without updated_by to avoid foreign key constraint issues
      const { error } = await supabase
        .from('school_upi_settings')
        .update({ 
          is_primary: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', upiSetting.id)
        .eq('tenant_id', tenantId);
      
      if (error) {
        console.error('Error setting primary UPI:', error);
        Alert.alert('Error', 'Failed to set primary UPI: ' + error.message);
        return;
      }
      
      // Optimistic update: set this as primary, unset others
      setUpiSettings(prev => prev.map(u => ({ ...u, is_primary: u.id === upiSetting.id })));
      Alert.alert('Success', `"${upiSetting.upi_name}" is now set as the primary UPI ID.`);
      
    } catch (error) {
      console.error('Exception setting primary UPI:', error);
      Alert.alert('Error', 'Failed to set primary UPI. Please try again.');
    } finally {
      setUpiLoading(false);
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
      console.log('🚀 SchoolDetails: Saving school data (upsert)...');
      const tenantId = getTenantId();
      if (!tenantId) throw new Error('No tenant context available');
      const payload = { ...schoolData, tenant_id: tenantId };
      // Fallback pattern for environments without a unique tenant_id constraint:
      // 1) Try update by tenant_id
      // 2) If no row updated, insert
      const { data: updatedRows, error: updateError } = await supabase
        .from('school_details')
        .update(payload)
        .eq('tenant_id', tenantId)
        .select();
      if (updateError) throw updateError;

      if (updatedRows && updatedRows.length > 0) {
        setSchoolData(updatedRows[0]);
      } else {
        const { data: insertedRows, error: insertError } = await supabase
          .from('school_details')
          .insert(payload)
          .select();
        if (insertError) throw insertError;
        if (insertedRows && insertedRows.length > 0) setSchoolData(insertedRows[0]);
      }

      Alert.alert('Success', 'School details saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('❌ Save exception:', error);
      Alert.alert('Error', 'Failed to save school details: ' + (error.message || error), [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } finally {
      setSaving(false);
    }
  };

  // 🚀 ENHANCED: Show tenant loading state
  if (tenantLoading || !isReady) {
    return (
      <View style={styles.container}>
        <Header title="School Details" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Initializing tenant data...</Text>
        </View>
      </View>
    );
  }
  
  // 🚀 ENHANCED: Show tenant error state
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title="School Details" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Ionicons name="warning" size={48} color="#FF9800" />
          <Text style={styles.errorTitle}>Tenant Error</Text>
          <Text style={styles.errorText}>{tenantError}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
      
      {/* Floating Refresh Button - Web Only */}
      <FloatingRefreshButton
        onPress={handleRefresh}
        refreshing={refreshing}
        bottom={80}
      />
      
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
            {Platform.OS === 'web' && !schoolData.logo_url && (
              <Text style={styles.webHint}>
                💡 Click on the logo area below to select an image from your computer
              </Text>
            )}
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
              ) : schoolData.logo_url && schoolData.logo_url.trim() !== '' && schoolData.logo_url.startsWith('http') && !schoolData.logo_url.startsWith('file:') ? (
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
                      // Extract error message safely to avoid cyclical JSON structure
                      const errorMsg = error.nativeEvent?.error || 'Image loading failed';
                      console.error('Image error details:', {
                        nativeError: errorMsg,
                        errorType: typeof error,
                        url: schoolData.logo_url
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
            {schoolData.logo_url && schoolData.logo_url.trim() !== '' && schoolData.logo_url.startsWith('http') && !schoolData.logo_url.startsWith('file:') && !uploading && (
              <>
                <Text style={styles.logoHint}>Tap to change logo</Text>
                <TouchableOpacity 
                  style={[styles.clearLogoButton, clearingLogo && styles.clearLogoButtonDisabled]}
                  onPress={() => {
                    console.log('🗑️ Clear logo button pressed!');
                    clearLogo();
                  }}
                  disabled={clearingLogo}
                >
                  {clearingLogo ? (
                    <>
                      <ActivityIndicator size={16} color="#F44336" />
                      <Text style={styles.clearLogoText}>Clearing...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#F44336" />
                      <Text style={styles.clearLogoText}>Clear Logo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
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

          {/* UPI Payment Settings */}
          <View style={styles.section}>
            <View style={styles.upiHeader}>
              <Text style={styles.sectionTitle}>UPI Payment Settings</Text>
              <TouchableOpacity
                style={styles.addUpiButton}
                onPress={handleAddUpi}
                disabled={upiLoading}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addUpiButtonText}>Add UPI ID</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.upiDescription}>
              Configure UPI IDs for accepting student fee payments via QR codes.
            </Text>

            {upiLoading ? (
              <View style={styles.upiLoadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.upiLoadingText}>Loading UPI settings...</Text>
              </View>
            ) : upiSettings.length === 0 ? (
              <View style={styles.noUpiContainer}>
                <Ionicons name="qr-code-outline" size={48} color="#ccc" />
                <Text style={styles.noUpiTitle}>No UPI IDs Configured</Text>
                <Text style={styles.noUpiText}>
                  Add a UPI ID to enable QR code payments for student fees.
                </Text>
                <TouchableOpacity
                  style={styles.firstUpiButton}
                  onPress={handleAddUpi}
                >
                  <Ionicons name="add" size={16} color="#2196F3" />
                  <Text style={styles.firstUpiButtonText}>Add Your First UPI ID</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.upiListContainer}>
                {upiSettings.map((upiSetting, index) => (
                  <View key={upiSetting.id} style={styles.upiCard}>
                    <View style={styles.upiCardHeader}>
                      <View style={styles.upiCardLeft}>
                        <View style={styles.upiNameContainer}>
                          <Text style={styles.upiName}>{upiSetting.upi_name}</Text>
                          {upiSetting.is_primary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>Primary</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.upiId}>{upiSetting.upi_id}</Text>
                        {upiSetting.description && (
                          <Text style={styles.upiDescription2}>{upiSetting.description}</Text>
                        )}
                      </View>
                      <View style={styles.upiCardActions}>
                        <TouchableOpacity
                          style={styles.upiActionButton}
                          onPress={() => handleEditUpi(upiSetting)}
                        >
                          <Ionicons name="pencil" size={16} color="#2196F3" />
                        </TouchableOpacity>
                        {!upiSetting.is_primary && (
                          <TouchableOpacity
                            style={styles.upiActionButton}
                            onPress={() => handleSetPrimary(upiSetting)}
                          >
                            <Ionicons name="star-outline" size={16} color="#FF9800" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.upiActionButton}
                          onPress={() => handleDeleteUpi(upiSetting)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
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
      
      {/* UPI Modal */}
      <Modal
        visible={showUpiModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUpiModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingUpi ? 'Edit UPI Setting' : 'Add UPI Setting'}
            </Text>
            <TouchableOpacity
              onPress={() => setShowUpiModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.upiFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>UPI ID *</Text>
                <TextInput
                  style={styles.input}
                  value={upiFormData.upi_id}
                  onChangeText={(value) => handleUpiFormChange('upi_id', value)}
                  placeholder="e.g., yourname@bankname"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name *</Text>
                <TextInput
                  style={styles.input}
                  value={upiFormData.upi_name}
                  onChangeText={(value) => handleUpiFormChange('upi_name', value)}
                  placeholder="e.g., Primary Account, School Account"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={upiFormData.description}
                  onChangeText={(value) => handleUpiFormChange('description', value)}
                  placeholder="Additional notes about this UPI account..."
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => handleUpiFormChange('is_primary', !upiFormData.is_primary)}
                >
                  <View style={[styles.checkbox, upiFormData.is_primary && styles.checkboxChecked]}>
                    {upiFormData.is_primary && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>Set as Primary UPI ID</Text>
                </TouchableOpacity>
                <Text style={styles.checkboxHint}>
                  Primary UPI ID will be used by default for QR code generation
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.saveUpiButton, upiLoading && styles.saveUpiButtonDisabled]}
                onPress={handleSaveUpi}
                disabled={upiLoading}
              >
                {upiLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveUpiButtonText}>
                    {editingUpi ? 'Update UPI Setting' : 'Add UPI Setting'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  // 🚀 ENHANCED: Tenant banner styles
  tenantBanner: {
    backgroundColor: '#E8F5E8',
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tenantBannerText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
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
  // 🚀 ENHANCED: Error state styles
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  webHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
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
  clearLogoButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 6,
  },
  clearLogoButtonDisabled: {
    opacity: 0.6,
    borderColor: '#ccc',
  },
  clearLogoText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
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
  // UPI Management Styles
  upiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addUpiButton: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addUpiButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  upiDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  upiLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  noUpiContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  noUpiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  noUpiText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  firstUpiButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  firstUpiButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  upiListContainer: {
    gap: 12,
  },
  upiCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  upiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  upiCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  upiNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  upiName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  primaryBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  primaryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  upiId: {
    fontSize: 14,
    color: '#2196F3',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  upiDescription2: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  upiCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upiActionButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  upiFormCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  checkboxHint: {
    fontSize: 12,
    color: '#666',
    marginLeft: 32,
    lineHeight: 16,
  },
  saveUpiButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveUpiButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveUpiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SchoolDetails;
