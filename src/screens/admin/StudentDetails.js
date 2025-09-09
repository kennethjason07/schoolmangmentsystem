import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Platform, Linking, KeyboardAvoidingView, RefreshControl, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import { dbHelpers, supabase, TABLES } from '../../utils/supabase';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle } from '../../styles/webScrollFix';

const StudentDetails = ({ route }) => {
  const navigation = useNavigation();
  
  // Safely extract student data with fallback
  const student = route?.params?.student;
  
  const [studentData, setStudentData] = useState(null);
  const [feeStatus, setFeeStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Refs for scroll functionality
  const scrollViewRef = useRef(null);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;
  
  // Early return if no student data is provided
  if (!student || !student.id) {
    return (
      <View style={styles.container}>
        <Header title="Student Details" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#f44336" />
          <Text style={styles.errorText}>No student data provided</Text>
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

  // Fetch student details function
  const fetchStudentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching student details for ID:', student.id);
      // Fetch student details from DB with class info
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes(class_name, section)
        `)
        .eq('id', student.id)
        .single();
      
      if (error) {
        console.error('Error fetching student:', error);
        throw error;
      }
      
      // Try multiple methods to get parent information
      let parentData = null;
      
      // First check if parent info was already passed from ManageStudents
      if (student.parentName && student.parentName !== 'Not Assigned' && student.parentName !== 'N/A') {
        parentData = {
          name: student.parentName,
          phone: student.parentPhone || null,
          relation: 'Guardian' // Default relation
        };
        console.log('Using parent info from student data:', parentData);
      }
      
      // If no parent info from student data, try database queries
      if (!parentData) {
        // Method 1: Try parents table with student_id
        const { data: parentsTableData, error: parentError } = await supabase
          .from('parents')
          .select('name, relation, phone, email')
          .eq('student_id', student.id);
        
        if (parentsTableData && parentsTableData.length > 0 && !parentError) {
          // Use the first parent record or combine multiple
          const primaryParent = parentsTableData[0];
          parentData = {
            name: primaryParent.name,
            relation: primaryParent.relation || 'Guardian',
            phone: primaryParent.phone || null,
            email: primaryParent.email || null
          };
          console.log('Found parent in parents table:', parentData);
        } else {
          console.log('No parent found in parents table for student:', student.id);
          
          // Method 2: Try via parent_id in students table
          if (data.parent_id) {
            const { data: parentTableData, error: parentTableError } = await supabase
              .from('parents')
              .select('name, relation, phone, email')
              .eq('id', data.parent_id)
              .single();
            
            if (parentTableData && !parentTableError) {
              parentData = {
                name: parentTableData.name,
                relation: parentTableData.relation || 'Guardian',
                phone: parentTableData.phone || null,
                email: parentTableData.email || null
              };
              console.log('Found parent in parents table via parent_id:', parentData);
            } else {
              console.log('No parent found in parents table for parent_id:', data.parent_id);
            }
          }
          
          // Method 3: Try finding parent via users table linked_parent_of
          if (!parentData) {
            const { data: linkedParentData, error: linkedError } = await supabase
              .from('users')
              .select('full_name, email, phone')
              .eq('linked_parent_of', student.id)
              .single();
            
            if (linkedParentData && !linkedError) {
              parentData = {
                name: linkedParentData.full_name,
                relation: 'Guardian',
                phone: linkedParentData.phone || null,
                email: linkedParentData.email || null
              };
              console.log('Found parent via linked_parent_of:', parentData);
            } else {
              console.log('No parent found via linked_parent_of for student:', student.id);
            }
          }
        }
      }
      
      // Combine the data
      const combinedData = {
        ...data,
        parent_info: parentData
      };
      
      console.log('Combined student data:', combinedData);
      setStudentData(combinedData);

      // Fetch fee status
      console.log('Fetching fees for student ID:', student.id);
      const { data: fees, error: feeError } = await dbHelpers.getStudentFees(student.id);
      console.log('Fees data response:', { fees, feeError });
      
      let calculatedFeeStatus = 'Unpaid';
      if (feeError) {
        console.error('Error fetching fees:', feeError);
        console.warn('Fee fetch failed, continuing without fee data');
      } else if (fees && fees.length > 0) {
        // Calculate total amount paid
        const totalPaid = fees.reduce((sum, fee) => {
          return sum + (fee.amount_paid ? parseFloat(fee.amount_paid) : 0);
        }, 0);
        
        // If student has paid any amount, consider it as 'Paid'
        calculatedFeeStatus = totalPaid > 0 ? 'Paid' : 'Unpaid';
        console.log(`Fee calculation: Total paid = ${totalPaid}, Status = ${calculatedFeeStatus}`);
      }
      
      setFeeStatus(calculatedFeeStatus);
    } catch (err) {
      console.error('Full error in fetchStudentDetails:', err);
      setError(`Failed to load student details: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDetails();
  }, [student.id]);

  // Refresh handler to reload student data
  const onRefresh = async () => {
    await fetchStudentDetails();
  };

  // Enhanced scroll event handler with smooth animations and multiple features
  const handleScroll = (event) => {
    const { y: offsetY } = event.nativeEvent.contentOffset;
    const { height: layoutHeight } = event.nativeEvent.layoutMeasurement;
    const { height: contentHeight } = event.nativeEvent.contentSize;
    
    // Calculate scroll progress
    const maxScrollDistance = contentHeight - layoutHeight;
    const progress = maxScrollDistance > 0 ? Math.min(offsetY / maxScrollDistance, 1) : 0;
    setScrollProgress(progress);
    
    const shouldShow = offsetY > (Platform.OS === 'web' ? 80 : 120); // Lower threshold for better UX
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      Animated.timing(scrollTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: Platform.OS === 'web' ? 200 : 250, // Smoother animation
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  };

  // Enhanced scroll to top function with haptic feedback
  const scrollToTop = () => {
    if (scrollViewRef.current) {
      // Add haptic feedback on supported platforms
      if (Platform.OS === 'ios' && typeof require !== 'undefined') {
        try {
          const { Haptics } = require('expo-haptics');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
          console.log('Haptics not available');
        }
      }
      
      scrollViewRef.current.scrollTo({ 
        y: 0, 
        animated: true,
        duration: Platform.OS === 'web' ? 500 : undefined // Smooth web scrolling
      });
    }
  };

  // Scroll to specific section function
  const scrollToSection = (yOffset) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ 
        y: yOffset, 
        animated: true,
        duration: Platform.OS === 'web' ? 300 : undefined
      });
    }
  };

  // Helper function to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not provided';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN');
    } catch (error) {
      return dateStr;
    }
  };

  // Helper function to calculate age
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (error) {
      return 'N/A';
    }
  };

  // Helper function to handle calling parent
  const handleCallParent = async (phoneNumber, parentName) => {
    if (!phoneNumber) {
      Alert.alert(
        'No Phone Number',
        'Parent phone number is not available.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Clean and format phone number (remove any non-digit characters except +)
    const cleanedPhone = phoneNumber.toString().replace(/[^+\d]/g, '');
    
    // Ensure we have a valid phone number after cleaning
    if (!cleanedPhone || cleanedPhone.length < 6) {
      Alert.alert(
        'Invalid Phone Number',
        'The phone number appears to be invalid.',
        [{ text: 'OK' }]
      );
      return;
    }

    const telUrl = `tel:${cleanedPhone}`;
    console.log('Attempting to call with URL:', telUrl);

    // Show confirmation dialog first, then try to make the call
    Alert.alert(
      'Call Parent',
      `Do you want to call ${parentName || 'parent'} at ${phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: async () => {
            try {
              // Try to open the tel URL directly
              const supported = await Linking.canOpenURL(telUrl);
              
              if (supported) {
                await Linking.openURL(telUrl);
              } else {
                // If tel: scheme is not supported, try alternative approaches
                console.log('Tel scheme not supported, trying alternative...');
                
                // Try with different URL formats
                const alternatives = [
                  `tel://${cleanedPhone}`,
                  `phone:${cleanedPhone}`,
                  cleanedPhone
                ];
                
                let callMade = false;
                
                for (const altUrl of alternatives) {
                  try {
                    const altSupported = await Linking.canOpenURL(altUrl);
                    if (altSupported) {
                      await Linking.openURL(altUrl);
                      callMade = true;
                      break;
                    }
                  } catch (altError) {
                    console.log('Alternative URL failed:', altUrl, altError);
                  }
                }
                
                if (!callMade) {
                  // Final fallback - try to open without checking support
                  try {
                    await Linking.openURL(telUrl);
                  } catch (finalError) {
                    console.error('All call attempts failed:', finalError);
                    Alert.alert(
                      'Unable to Call',
                      Platform.OS === 'web' 
                        ? 'Phone calling is not supported in web browsers. Please use a mobile device or copy the number manually.'
                        : 'Your device does not support making phone calls, or the phone app is not available.',
                      [{ text: 'OK' }]
                    );
                  }
                }
              }
            } catch (error) {
              console.error('Error making call:', error);
              Alert.alert(
                'Call Failed',
                Platform.OS === 'web' 
                  ? 'Phone calling is not supported in web browsers. Please copy the number manually: ' + phoneNumber
                  : 'Unable to make the call. Please ensure your device has a phone app installed.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Student Details" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading student details...</Text>
        </View>
      </View>
    );
  }

  if (error || !studentData) {
    return (
      <View style={styles.container}>
        <Header title="Student Details" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error || 'No student data found'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, webContainerStyle]}>
      {/* Use the proper Header component for consistent profile photo loading */}
      <Header title="Student Profile" showBack={true} />
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={Platform.OS === 'web' ? styles.webScrollView : styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={loading} 
              onRefresh={onRefresh}
              colors={['#2196F3', '#4CAF50']}
              progressBackgroundColor="#fff"
              title="Pull to refresh student details"
              titleColor="#666"
            />
          }
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Navigation Bar */}
          <View style={styles.quickNavBar}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickNavContent}
              bounces={false}
            >
              <TouchableOpacity 
                style={styles.quickNavButton}
                onPress={() => scrollToSection(0)}
                activeOpacity={0.7}
              >
                <Ionicons name="person" size={16} color="#2196F3" />
                <Text style={styles.quickNavText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickNavButton}
                onPress={() => scrollToSection(300)}
                activeOpacity={0.7}
              >
                <Ionicons name="people" size={16} color="#4CAF50" />
                <Text style={styles.quickNavText}>Parent</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickNavButton}
                onPress={() => scrollToSection(600)}
                activeOpacity={0.7}
              >
                <Ionicons name="school" size={16} color="#FF9800" />
                <Text style={styles.quickNavText}>Academic</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickNavButton}
                onPress={() => scrollToSection(900)}
                activeOpacity={0.7}
              >
                <Ionicons name="information-circle" size={16} color="#9C27B0" />
                <Text style={styles.quickNavText}>Details</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Student Profile Header - Name Only */}
          <View style={styles.profileHeader}>
            <View style={styles.headerInfo}>
              <Text style={styles.studentName}>{studentData.name}</Text>
              <Text style={styles.classInfo}>
                {studentData.classes ? `${studentData.classes.class_name} - Section ${studentData.classes.section}` : 'Class not assigned'}
              </Text>
              <Text style={styles.rollNumber}>Admission No: {studentData.admission_no || 'N/A'}</Text>
            </View>
          </View>

        {/* Information Cards */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar" size={20} color="#2196F3" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Date of Birth</Text>
                <Text style={styles.infoValue}>{formatDate(studentData.dob)}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="hourglass" size={20} color="#2196F3" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Age</Text>
                <Text style={styles.infoValue}>{calculateAge(studentData.dob)} years</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="person" size={20} color="#2196F3" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{studentData.gender || 'Not provided'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="id-card" size={20} color="#2196F3" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Student ID</Text>
                <Text style={styles.infoValue}>{studentData.id}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Parent Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Parent/Guardian Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="people" size={20} color="#4CAF50" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Parent/Guardian Name</Text>
                <Text style={styles.infoValue}>{studentData.parent_info?.name || 'Not available'}</Text>
              </View>
            </View>
            
            {studentData.parent_info?.relation && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="heart" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Relationship</Text>
                  <Text style={styles.infoValue}>{studentData.parent_info.relation}</Text>
                </View>
              </View>
            )}
            
            {studentData.parent_info?.phone && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="call" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{studentData.parent_info.phone}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.callButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => handleCallParent(studentData.parent_info.phone, studentData.parent_info.name)}
                >
                  <Ionicons name="call" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            
            {studentData.parent_info?.email && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="mail" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{studentData.parent_info.email}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Academic Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Academic Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="school" size={20} color="#4CAF50" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Academic Performance</Text>
                <Text style={[styles.infoValue, styles.academicPercentage]}>
                  {student.hasMarks ? `${student.academicPercentage}%` : '0%'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="stats-chart" size={20} color="#FF9800" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Attendance</Text>
                <Text style={styles.infoValue}>{student.attendancePercentage || 0}%</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="cash" size={20} color="#2196F3" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fee Status</Text>
                <Text style={[styles.infoValue, feeStatus === 'Paid' ? styles.paidStatus : styles.unpaidStatus]}>
                  {feeStatus || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Additional Information Section for more scrollable content */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time" size={20} color="#FF9800" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Enrollment Date</Text>
                <Text style={styles.infoValue}>{formatDate(studentData.created_at) || 'N/A'}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location" size={20} color="#9C27B0" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{studentData.address || 'Not provided'}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="medical" size={20} color="#F44336" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Medical Information</Text>
                <Text style={styles.infoValue}>{studentData.medical_info || 'No medical information on file'}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="document-text" size={20} color="#607D8B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{studentData.notes || 'No additional notes'}</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.bottomSpacing} />
        </ScrollView>
        
        {/* Enhanced Floating Action Buttons */}
        <View style={styles.floatingButtonsContainer}>
          {/* Scroll Progress Indicator */}
          <Animated.View 
            style={[
              styles.scrollProgressContainer,
              {
                opacity: scrollTopOpacity,
                transform: [{
                  translateY: scrollTopOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  })
                }]
              }
            ]}
          >
            <View style={styles.scrollProgressBar}>
              <Animated.View 
                style={[
                  styles.scrollProgressFill, 
                  {
                    height: `${Math.max(10, scrollProgress * 100)}%`
                  }
                ]} 
              />
            </View>
          </Animated.View>
          
          {/* Scroll to Top Button */}
          <Animated.View 
            style={[
              styles.scrollToTopButton,
              {
                opacity: scrollTopOpacity,
                transform: [{
                  scale: scrollTopOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  })
                }, {
                  translateY: scrollTopOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  })
                }]
              }
            ]}
            pointerEvents={showScrollTop ? 'auto' : 'none'}
          >
            <TouchableOpacity
              style={styles.scrollToTopInner}
              onPress={scrollToTop}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Scroll to top"
              accessibilityHint="Double tap to scroll to the top of the page"
            >
              <Ionicons name="chevron-up" size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
        
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'web' ? 40 : 20,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  
  // Header Card
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  classInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  rollNumber: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  
  // Quick Navigation Bar Styles
  quickNavBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingVertical: 8,
  },
  quickNavContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  quickNavButton: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 70,
  },
  quickNavText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginTop: 4,
  },
  
  // Information Sections
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  paidStatus: {
    color: '#4CAF50',
  },
  unpaidStatus: {
    color: '#f44336',
  },
  academicPercentage: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 20,
  },
  
  // Retry Button Styles
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Summary Card Styles
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  // Call Button Styles
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  
  // Enhanced Floating Buttons Container
  floatingButtonsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    zIndex: 1000,
    alignItems: 'center',
  },
  
  // Scroll Progress Indicator
  scrollProgressContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  scrollProgressBar: {
    width: 4,
    height: 40,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scrollProgressFill: {
    width: '100%',
    height: '30%', // This would be dynamically calculated in a real implementation
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  
  // Enhanced Scroll to Top Button Styles
  scrollToTopButton: {
    // Position handled by container
  },
  scrollToTopInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    // Enhanced visibility and interaction for web
    ...(Platform.OS === 'web' && {
      boxShadow: '0 6px 20px rgba(33, 150, 243, 0.4)',
      border: '2px solid rgba(255, 255, 255, 0.2)',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    }),
  },
  
  // Profile Header with Photo Styles
  profileHeader: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoSection: {
    marginRight: 20,
  },
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  placeholderPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  
  // Photo Modal Styles
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  photoModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 10,
  },
  photoOptionText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 15,
  },
  photoCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginTop: 10,
  },
  photoCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Enhanced Web-specific ScrollView styles
  webScrollView: {
    flex: 1,
    height: '100%',
    overflow: 'auto',
    ...Platform.select({
      web: {
        // Enhanced scrollbar styling
        scrollbarWidth: 'thin',
        scrollbarColor: '#2196F3 #f5f5f5',
        '::-webkit-scrollbar': {
          width: '8px',
        },
        '::-webkit-scrollbar-track': {
          background: '#f5f5f5',
          borderRadius: '10px',
        },
        '::-webkit-scrollbar-thumb': {
          background: '#2196F3',
          borderRadius: '10px',
          ':hover': {
            background: '#1976D2',
          },
        },
        // Smooth scrolling behavior
        scrollBehavior: 'smooth',
        overflowScrolling: 'touch', // For iOS Safari
        WebkitOverflowScrolling: 'touch',
        // Performance optimizations
        willChange: 'scroll-position',
        transform: 'translateZ(0)', // Force GPU acceleration
        // Better momentum scrolling
        overscrollBehavior: 'contain',
        // Enhanced focus and interaction
        ':focus': {
          outline: 'none',
        },
        // Better scroll snapping for sections
        scrollSnapType: 'y proximity',
      },
    }),
  },
});

export default StudentDetails;
