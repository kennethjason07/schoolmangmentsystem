import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { decode as atob } from 'base-64';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import { useTenantAccess } from '../../utils/tenantHelpers';
import { setUploadInProgress } from '../../utils/AuthContext';

const { width } = Dimensions.get('window');

const PhotoUpload = ({ navigation }) => {
  // States
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [photoMappings, setPhotoMappings] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Tenant access
  const { getTenantId, isReady, tenantName } = useTenantAccess();

  // Statistics
  const totalPhotos = selectedPhotos.length;
  const mappedPhotos = Object.values(photoMappings).filter(student => student !== null).length;
  const unmappedPhotos = totalPhotos - mappedPhotos;

  useEffect(() => {
    if (isReady && getTenantId()) {
      loadClasses();
    }
  }, [isReady, getTenantId]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedPhotos.length > 0 && students.length > 0) {
      autoMapPhotos();
    }
  }, [selectedPhotos, students]);

  // Load classes
  const loadClasses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('id, class_name, section')
        .eq('tenant_id', getTenantId())
        .order('class_name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      Alert.alert('Error', 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  // Load students for selected class
  const loadStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('id, name, admission_no, photo_url')
        .eq('class_id', selectedClass)
        .eq('tenant_id', getTenantId())
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  // Select photos from device
  const selectPhotos = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/jpg'],
        multiple: true,
        copyToCacheDirectory: false
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size,
          type: asset.mimeType || 'image/jpeg'
        }));

        // Filter out files that are too large (max 5MB)
        const validPhotos = newPhotos.filter(photo => {
          if (photo.size > 5 * 1024 * 1024) {
            Alert.alert('File Too Large', `${photo.name} is larger than 5MB and will be skipped`);
            return false;
          }
          return true;
        });

        setSelectedPhotos(prev => [...prev, ...validPhotos]);
        console.log(`Selected ${validPhotos.length} photos`);
      }
    } catch (error) {
      console.error('Error selecting photos:', error);
      Alert.alert('Error', 'Failed to select photos');
    }
  };

  // Helper function to normalize names for comparison
  const normalizeName = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
      .trim();
  };

  // Helper function to generate name variations for matching
  const getNameVariations = (name) => {
    if (!name) return [];
    const variations = new Set();
    const normalized = normalizeName(name);
    
    // Add the normalized full name
    variations.add(normalized);
    
    // Add individual words (first name, last name, etc.)
    const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 1);
    words.forEach(word => variations.add(word));
    
    // Add combinations of first and last names
    if (words.length >= 2) {
      variations.add(words[0] + words[words.length - 1]); // first + last
      variations.add(words[words.length - 1] + words[0]); // last + first
    }
    
    return Array.from(variations);
  };

  // Auto-map photos to students based on student names
  const autoMapPhotos = () => {
    const mappings = {};
    
    console.log('🔍 AUTO-MAPPING DEBUG:');
    console.log('📚 Available students:', students.map(s => ({ name: s.name, admission_no: s.admission_no })));
    console.log('📷 Photos to map:', selectedPhotos.map(p => p.name));
    
    selectedPhotos.forEach(photo => {
      const fileName = photo.name.toLowerCase().replace(/\.(jpg|jpeg|png|gif)$/i, '');
      const normalizedFileName = normalizeName(fileName);
      console.log(`\n📸 Processing photo: "${photo.name}"`);
      console.log(`🔤 Cleaned filename: "${normalizedFileName}"`);
      
      // Try to find student by name in filename
      const matchedStudent = students.find(student => {
        if (!student.name) {
          console.log(`❌ Student has no name (ID: ${student.id})`);
          return false;
        }
        
        const studentNameVariations = getNameVariations(student.name);
        console.log(`🔍 Checking ${student.name} (admission: ${student.admission_no || 'N/A'})`);
        console.log(`   Name variations: [${studentNameVariations.join(', ')}]`);
        
        // Check if any variation matches the filename
        const isMatch = studentNameVariations.some(variation => {
          const matchFound = normalizedFileName.includes(variation) || variation.includes(normalizedFileName);
          if (matchFound) {
            console.log(`   ✅ MATCH found with variation: "${variation}"`);
          }
          return matchFound;
        });
        
        console.log(`   ${isMatch ? '✅ MATCH!' : '❌ no match'}`);
        return isMatch;
      });

      mappings[photo.uri] = matchedStudent || null;
      
      if (matchedStudent) {
        console.log(`✅ SUCCESS: "${photo.name}" mapped to ${matchedStudent.name} (${matchedStudent.admission_no || 'N/A'})`);
      } else {
        console.log(`❌ NO MATCH: "${photo.name}" could not be mapped`);
        console.log('💡 TIP: Filename should contain the student name (e.g., "anuradha.jpg", "areeb_aman.jpeg", "ashwini_photo.png")');
      }
    });

    setPhotoMappings(mappings);
    console.log('\n📊 Auto-mapping complete:', {
      totalPhotos: selectedPhotos.length,
      mapped: Object.values(mappings).filter(s => s !== null).length,
      unmapped: Object.values(mappings).filter(s => s === null).length
    });
  };

  // Manual mapping of photo to student
  const mapPhotoToStudent = (photoUri, studentId) => {
    const student = students.find(s => s.id === studentId) || null;
    setPhotoMappings(prev => ({
      ...prev,
      [photoUri]: student
    }));
  };

  // Remove photo
  const removePhoto = (photoUri) => {
    setSelectedPhotos(prev => prev.filter(photo => photo.uri !== photoUri));
    setPhotoMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[photoUri];
      return newMappings;
    });
  };

  // Test bucket access (for debugging)
  const testBucketAccess = async () => {
    try {
      console.log('🧪 Testing bucket access...');
      
      // Create a small test file
      const testData = new Blob(['test'], { type: 'text/plain' });
      const testFileName = `test-${Date.now()}.txt`;
      
      // Try to upload
      const { data, error } = await supabase.storage
        .from('student-photos')
        .upload(testFileName, testData);
      
      if (error) {
        console.error('❌ Bucket test failed:', error);
        Alert.alert('Bucket Test Failed', error.message);
        return;
      }
      
      console.log('✅ Bucket upload successful:', data);
      
      // Clean up test file
      await supabase.storage
        .from('student-photos')
        .remove([testFileName]);
      
      console.log('✅ Test file cleaned up');
      Alert.alert('Bucket Test Passed', 'Storage bucket is accessible and working correctly!');
      
    } catch (error) {
      console.error('❌ Bucket test exception:', error);
      Alert.alert('Bucket Test Error', error.message || 'Unknown error occurred');
    }
  };

  // Upload all mapped photos
  const uploadPhotos = async () => {
    const mappedPhotoUris = Object.keys(photoMappings).filter(uri => photoMappings[uri] !== null);
    
    if (mappedPhotoUris.length === 0) {
      Alert.alert('No Photos Mapped', 'Please map at least one photo to a student before uploading.');
      return;
    }

    Alert.alert(
      'Upload Photos',
      `Upload ${mappedPhotoUris.length} photos to students?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upload', onPress: performUpload }
      ]
    );
  };

  // Perform the actual upload
  const performUpload = async () => {
    setUploading(true);
    setUploadInProgress(true); // Notify auth system that upload is starting
    
    try {
      const mappedPhotoUris = Object.keys(photoMappings).filter(uri => photoMappings[uri] !== null);
      console.log('🚀 Starting upload for', mappedPhotoUris.length, 'photos');
      
      let uploadedCount = 0;
      let failedCount = 0;
      const errors = [];
      
      for (let i = 0; i < mappedPhotoUris.length; i++) {
        const photoUri = mappedPhotoUris[i];
        const student = photoMappings[photoUri];
        const photo = selectedPhotos.find(p => p.uri === photoUri);
        
        try {
          console.log(`📸 Uploading photo ${i + 1}/${mappedPhotoUris.length}: ${photo.name} for ${student.name}`);
          
          // Create unique filename: tenantId/studentId_admissionNo_timestamp.jpg
          const timestamp = Date.now();
          const fileExtension = photo.name.split('.').pop().toLowerCase();
          const fileName = `${getTenantId()}/${student.id}_${student.admission_no}_${timestamp}.${fileExtension}`;
          
          // Read file for upload - React Native compatible
          let fileData;
          
          if (Platform.OS === 'web') {
            // Web platform: use blob
            const response = await fetch(photo.uri);
            fileData = await response.blob();
          } else {
            // React Native: Use fetch approach as primary method (it's working reliably)
            try {
              console.log('🔄 Reading file via fetch (primary method):', photo.uri);
              const response = await fetch(photo.uri);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const arrayBuffer = await response.arrayBuffer();
              fileData = new Uint8Array(arrayBuffer);
              console.log('📦 Photo file data created via fetch, size:', fileData.length);
              
            } catch (fetchError) {
              console.error('❌ Failed to read file via fetch:', fetchError);
              
              // Fallback: Try new File class API
              try {
                console.log('🔄 Fallback: trying new File class API');
                
                const file = new File(photo.uri);
                
                if (!file.exists) {
                  throw new Error(`File does not exist at URI: ${photo.uri}`);
                }
                
                const bytes = await file.bytes();
                fileData = new Uint8Array(bytes);
                console.log('📦 Fallback File API successful, file size:', fileData.length);
                
              } catch (fileError) {
                console.error('❌ All file reading methods failed:', { fetchError, fileError });
                throw new Error(`Failed to read file. Fetch error: ${fetchError.message}, File API error: ${fileError.message}`);
              }
            }
          }
          
          console.log(`📁 Uploading to storage path: ${fileName}`);
          console.log(`📦 File data info: size=${fileData.length}, type=${photo.type}`);
          
          // Upload to Supabase Storage with comprehensive error handling
          let uploadData = null;
          let uploadError = null;
          
          try {
            const uploadResult = await supabase.storage
              .from('student-photos')
              .upload(fileName, fileData, {
                contentType: photo.type || 'image/jpeg',
                cacheControl: '3600',
                upsert: false // Don't overwrite existing files
              });
            
            uploadData = uploadResult.data;
            uploadError = uploadResult.error;
            
            console.log('🚀 Supabase upload result:', { uploadData, uploadError });
            
          } catch (uploadException) {
            console.error('❌ Supabase upload threw exception:', uploadException);
            uploadError = uploadException;
          }
          
          if (uploadError) {
            console.error('❌ Upload error details:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message || uploadError}`);
          }
          
          if (!uploadData) {
            throw new Error('Upload returned no data');
          }
          
          console.log('✅ Upload successful:', uploadData);
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('student-photos')
            .getPublicUrl(fileName);
          
          console.log('🔗 Public URL:', publicUrl);
          
          // Update student record with photo URL
          const { error: updateError } = await supabase
            .from('students')
            .update({ photo_url: publicUrl })
            .eq('id', student.id)
            .eq('tenant_id', getTenantId());
          
          if (updateError) {
            console.error('❌ Failed to update student record:', updateError);
            errors.push(`Failed to update ${student.name}: ${updateError.message}`);
            failedCount++;
          } else {
            console.log('✅ Student record updated successfully');
            uploadedCount++;
          }
          
        } catch (error) {
          console.error(`❌ Upload failed for ${student.name}:`, error);
          errors.push(`${student.name}: ${error.message}`);
          failedCount++;
        }
      }
      
      // Show results
      const successMessage = `Successfully uploaded ${uploadedCount} photos!`;
      const errorMessage = failedCount > 0 ? `\n${failedCount} failed.` : '';
      const fullMessage = successMessage + errorMessage;
      
      if (errors.length > 0) {
        console.log('❌ Upload errors:', errors);
      }
      
      Alert.alert(
        uploadedCount > 0 ? 'Upload Complete' : 'Upload Failed', 
        fullMessage,
        [
          {
            text: 'OK', 
            onPress: () => {
              if (uploadedCount > 0) {
                setSelectedPhotos([]);
                setPhotoMappings({});
                loadStudents(); // Refresh to show new photos
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Upload process failed:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
      setUploadInProgress(false); // Notify auth system that upload is complete
    }
  };

  // Render photo item
  const renderPhotoItem = (photo) => {
    const mappedStudent = photoMappings[photo.uri];
    
    return (
      <View key={photo.uri} style={styles.photoItem}>
        <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
        
        <View style={styles.photoInfo}>
          <Text style={styles.photoName} numberOfLines={1}>{photo.name}</Text>
          
          <View style={styles.mappingContainer}>
            <Text style={styles.mappingLabel}>Map to Student:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={mappedStudent?.id || ''}
                onValueChange={(studentId) => mapPhotoToStudent(photo.uri, studentId)}
                style={styles.studentPicker}
              >
                <Picker.Item label="Select Student" value="" />
                {students.map((student) => (
                  <Picker.Item
                    key={student.id}
                    label={`${student.name} (${student.admission_no || 'No Admission #'})`}
                    value={student.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {mappedStudent && (
            <View style={styles.mappedIndicator}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.mappedText}>Mapped to {mappedStudent.name}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removePhoto(photo.uri)}
        >
          <Ionicons name="close-circle" size={24} color="#f44336" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render student item
  const renderStudentItem = (student) => (
    <View key={student.id} style={styles.studentItem}>
      <View style={styles.studentAvatar}>
        {student.photo_url ? (
          <Image source={{ uri: student.photo_url }} style={styles.studentPhoto} />
        ) : (
          <Ionicons name="person" size={24} color="#666" />
        )}
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{student.name}</Text>
        <Text style={styles.studentDetail}>Admission: {student.admission_no || 'N/A'}</Text>
      </View>
      <View style={styles.studentStatus}>
        <View style={[styles.statusBadge, student.photo_url && { backgroundColor: '#E8F5E8' }]}>
          <Ionicons 
            name={student.photo_url ? "checkmark-circle" : "camera"} 
            size={16} 
            color={student.photo_url ? "#4CAF50" : "#FF9800"} 
          />
          <Text style={[styles.statusText, student.photo_url && { color: '#4CAF50' }]}>
            {student.photo_url ? 'Has Photo' : 'No Photo'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading && classes.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Photo Upload" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Photo Upload" showBack={true} onBack={() => navigation.goBack()} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Class Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Class</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={setSelectedClass}
              style={styles.classPicker}
            >
              <Picker.Item label="Select a class..." value="" />
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

        {/* Photo Selection */}
        {selectedClass && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Photos</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.uploadButton} onPress={selectPhotos}>
                <Ionicons name="camera" size={24} color="#2196F3" />
                <Text style={styles.uploadButtonText}>Select JPEG Photos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.testButton} onPress={testBucketAccess}>
                <Ionicons name="flask" size={20} color="#FF9800" />
                <Text style={styles.testButtonText}>Test Bucket</Text>
              </TouchableOpacity>
            </View>

            {/* Statistics */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalPhotos}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{mappedPhotos}</Text>
                <Text style={styles.statLabel}>Mapped</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#FF9800' }]}>{unmappedPhotos}</Text>
                <Text style={styles.statLabel}>Unmapped</Text>
              </View>
            </View>
          </View>
        )}

        {/* Selected Photos */}
        {selectedPhotos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected Photos ({selectedPhotos.length})</Text>
              <TouchableOpacity
                style={styles.uploadAllButton}
                onPress={uploadPhotos}
                disabled={uploading || mappedPhotos === 0}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={16} color="#fff" />
                    <Text style={styles.uploadAllText}>Upload All</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {selectedPhotos.map(renderPhotoItem)}
          </View>
        )}

        {/* Students List */}
        {students.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Students in Class ({students.length})</Text>
            {students.map(renderStudentItem)}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  section: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  classPicker: {
    height: 50,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    minWidth: 100,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF9800',
    marginLeft: 6,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  photoInfo: {
    flex: 1,
  },
  photoName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  mappingContainer: {
    marginBottom: 8,
  },
  mappingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  studentPicker: {
    height: 40,
    fontSize: 14,
  },
  mappedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  mappedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  uploadAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  uploadAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 8,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  studentPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  studentDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  studentStatus: {
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: 4,
  },
  bottomSpacer: {
    height: 50,
  },
});

export default PhotoUpload;