import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import CrossPlatformDatePicker from '../../components/CrossPlatformDatePicker';
import { exportStudyCertificatePDF } from '../../utils/exportUtils';
import { useNavigation } from '@react-navigation/native';

const StudyCertificate = () => {
  const navigation = useNavigation();
  const today = new Date();
  const yyyy = today.getFullYear();
  const defaultFromYear = `${yyyy - 1}-${String(yyyy).slice(-2)}`;
  const defaultToYear = `${yyyy}-${String(yyyy + 1).slice(-2)}`;

  const [form, setForm] = useState({
    admissionNo: '',
    title: 'Mr.', // Mr./Ms.
    studentName: '',
    relationType: 'Son of', // Son of / Daughter of
    parentName: '',
    fromYear: defaultFromYear,
    toYear: defaultToYear,
    studyingFrom: '',
    studyingTo: '',
    character: 'Good', // Good / Satisfactory
    dob: null,
    religion: 'Hindu',
    caste: 'Lingayat',
    admissionRegisterNo: '',
    date: today,
    place: '',
    headmasterTitle: 'Headmaster/principal',
    // Optional header fields (you can customize or leave blank)
    schoolName: "Global's Sanmarg Public School",
    schoolAddress: 'Near Fateh Darwaza, Parsal Taltem, Bidar-585401',
    schoolContact: 'Contact No:+91 9341111756, Email: global295000@gmail.com',
    logoUrl: ''
  });

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // Back button handler
  const handleGoBack = () => {
    navigation.goBack();
  };

  // Create form sections data for FlatList
  const getFormSections = () => {
    return [
      { id: 'student-details', type: 'section' },
      { id: 'academic-details', type: 'section' },
      { id: 'header-section', type: 'section' },
      { id: 'generate-button', type: 'section' }
    ];
  };

  const renderFormSection = ({ item }) => {
    switch (item.id) {
      case 'student-details':
        return (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Student Details</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Admission No *</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.admissionNo} 
                  onChangeText={t => update('admissionNo', t)} 
                  placeholder="e.g. 12345" 
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Title</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.title} 
                  onChangeText={t => update('title', t)} 
                  placeholder="Mr. / Ms." 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.colFull}>
                <Text style={styles.label}>Student Name *</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.studentName} 
                  onChangeText={t => update('studentName', t)} 
                  placeholder="e.g. SHAIK AYAAN" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Relation Type</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.relationType} 
                  onChangeText={t => update('relationType', t)} 
                  placeholder="Son of / Daughter of" 
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Parent Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.parentName} 
                  onChangeText={t => update('parentName', t)} 
                  placeholder="e.g. Shaik Aleem" 
                />
              </View>
            </View>
          </View>
        );
      case 'academic-details':
        return (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Academic Details</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>From Year</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.fromYear} 
                  onChangeText={t => update('fromYear', t)} 
                  placeholder="e.g. 2023-24" 
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>To Year</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.toYear} 
                  onChangeText={t => update('toYear', t)} 
                  placeholder="e.g. 2024-25" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Studying From (Class)</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.studyingFrom} 
                  onChangeText={t => update('studyingFrom', t)} 
                  placeholder="e.g. Class I" 
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>To (Class)</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.studyingTo} 
                  onChangeText={t => update('studyingTo', t)} 
                  placeholder="e.g. NURSERY" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Character</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.character} 
                  onChangeText={t => update('character', t)} 
                  placeholder="Good / Satisfactory" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Date of Birth</Text>
                <CrossPlatformDatePicker
                  value={form.dob || new Date()}
                  onChange={(e, d) => d && update('dob', d)}
                  mode="date"
                  style={styles.dateButton}
                  textStyle={styles.dateButtonText}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Admission Register No</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.admissionRegisterNo} 
                  onChangeText={t => update('admissionRegisterNo', t)} 
                  placeholder="e.g. 98765" 
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Date on Certificate</Text>
                <CrossPlatformDatePicker
                  value={form.date || new Date()}
                  onChange={(e, d) => d && update('date', d)}
                  mode="date"
                  style={styles.dateButton}
                  textStyle={styles.dateButtonText}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Place</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.place} 
                  onChangeText={t => update('place', t)} 
                  placeholder="e.g. Bidar" 
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Headmaster/Principal</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.headmasterTitle} 
                  onChangeText={t => update('headmasterTitle', t)} 
                  placeholder="Headmaster/principal" 
                />
              </View>
            </View>
          </View>
        );
      case 'header-section':
        return (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Header (Optional)</Text>
            <View style={styles.row}>
              <View style={styles.colFull}>
                <Text style={styles.label}>School Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.schoolName} 
                  onChangeText={t => update('schoolName', t)} 
                  placeholder="School Name" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.colFull}>
                <Text style={styles.label}>Address Line</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.schoolAddress} 
                  onChangeText={t => update('schoolAddress', t)} 
                  placeholder="Address" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.colFull}>
                <Text style={styles.label}>Contact/Email Line</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.schoolContact} 
                  onChangeText={t => update('schoolContact', t)} 
                  placeholder="Contact line" 
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.colFull}>
                <Text style={styles.label}>School Logo (optional)</Text>
                
                {/* Logo Preview */}
                {form.logoUrl ? (
                  <View style={styles.logoContainer}>
                    <Image 
                      source={{ uri: form.logoUrl }} 
                      style={styles.logoPreview} 
                      resizeMode="contain"
                    />
                    <View style={styles.logoActions}>
                      <TouchableOpacity style={styles.changeLogoBtn} onPress={pickImage}>
                        <Ionicons name="image" size={16} color="#1976d2" />
                        <Text style={styles.changeLogoBtnText}>Change Logo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.removeLogoBtn} onPress={removeLogo}>
                        <Ionicons name="trash" size={16} color="#f44336" />
                        <Text style={styles.removeLogoBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.selectLogoBtn} onPress={pickImage}>
                    <Ionicons name="image" size={24} color="#1976d2" />
                    <Text style={styles.selectLogoBtnText}>Select School Logo</Text>
                    <Text style={styles.selectLogoSubtext}>Choose image from your device</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        );
      case 'generate-button':
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.generateBtn} onPress={onGenerate}>
              <Ionicons name="document" size={18} color="#fff" />
              <Text style={styles.generateBtnText}>Generate PDF</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  // Image picker functionality
  const pickImage = async () => {
    try {
      // Request permission if needed
      if (Platform.OS !== 'web') {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Please allow access to your photo library to select a logo.');
          return;
        }
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for logo
        quality: 0.8,
        base64: Platform.OS === 'web', // Get base64 for web platform
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        if (Platform.OS === 'web') {
          // For web, use base64 data URL
          if (asset.base64) {
            update('logoUrl', `data:image/jpeg;base64,${asset.base64}`);
          } else {
            update('logoUrl', asset.uri);
          }
        } else {
          // For mobile, use the file URI
          update('logoUrl', asset.uri);
        }
        
        Alert.alert('Success', 'Logo selected successfully!');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Remove logo
  const removeLogo = () => {
    Alert.alert(
      'Remove Logo',
      'Are you sure you want to remove the selected logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => update('logoUrl', '') }
      ]
    );
  };

  const onGenerate = async () => {
    try {
      if (!form.studentName || !form.admissionNo) {
        Alert.alert('Missing Info', 'Please enter Admission No and Student Name');
        return;
      }
      const ok = await exportStudyCertificatePDF(form);
      if (!ok) Alert.alert('Export Failed', 'Could not generate the Study Certificate.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to generate certificate');
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#1976d2" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Study Certificate</Text>
            <Text style={styles.subtitle}>Fill the details and generate a PDF matching the official format</Text>
          </View>
        </View>
      </View>

      {/* FlatList for Form Content */}
      <FlatList
        data={getFormSections()}
        renderItem={renderFormSection}
        keyExtractor={(item) => item.id}
        style={styles.form}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        removeClippedSubviews={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    height: '100%' // Ensure full height
  },
  header: { 
    paddingHorizontal: 16, 
    paddingTop: Platform.OS === 'web' ? 16 : 44, // Account for status bar on mobile
    paddingBottom: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4, // Align with title
  },
  headerTextContainer: {
    flex: 1,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#222' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 4 },
  form: { 
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60, // Extra padding for better scrolling
    flexGrow: 1,
  },
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1976d2', marginBottom: 8, marginTop: 8 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  col: { flex: 1 },
  colFull: { flex: 1 },
  label: { fontSize: 12, color: '#555', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fafafa' },
  dateButton: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  dateButtonText: { fontSize: 14, color: '#333' },
  
  // Logo picker styles
  logoContainer: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    padding: 12, 
    backgroundColor: '#fafafa',
    alignItems: 'center'
  },
  logoPreview: { 
    width: 100, 
    height: 100, 
    marginBottom: 12,
    borderRadius: 8
  },
  logoActions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  changeLogoBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#e3f2fd', 
    borderRadius: 6 
  },
  changeLogoBtnText: { 
    fontSize: 12, 
    color: '#1976d2', 
    fontWeight: '500' 
  },
  removeLogoBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#ffebee', 
    borderRadius: 6 
  },
  removeLogoBtnText: { 
    fontSize: 12, 
    color: '#f44336', 
    fontWeight: '500' 
  },
  selectLogoBtn: { 
    borderWidth: 2, 
    borderColor: '#1976d2', 
    borderStyle: 'dashed', 
    borderRadius: 8, 
    paddingVertical: 32, 
    paddingHorizontal: 16, 
    alignItems: 'center', 
    backgroundColor: '#f8f9ff' 
  },
  selectLogoBtnText: { 
    fontSize: 14, 
    color: '#1976d2', 
    fontWeight: '600', 
    marginTop: 8 
  },
  selectLogoSubtext: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 4 
  },
  
  generateBtn: { marginTop: 16, backgroundColor: '#1976d2', borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default StudyCertificate;
