import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  Linking, 
  Animated,
  Dimensions,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import { dbHelpers, supabase, TABLES } from '../../utils/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const StudentDetails = ({ route }) => {
  const navigation = useNavigation();
  
  // Safely extract student data with fallback
  const student = route?.params?.student;
  
  const [studentData, setStudentData] = useState(null);
  const [feeStatus, setFeeStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  
  // Early return if no student data is provided
  if (!student || !student.id) {
    return (
      <View style={styles.container}>
        <Header title="Student Details" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#f44336" />
          <Text style={styles.errorText}>No student data provided</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.actionButtonText}>Go Back</Text>
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
      
      // Animate content in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      
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

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudentDetails();
    setRefreshing(false);
  };

  // Scroll event handler
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > 150;
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      Animated.timing(scrollTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  };

  // Scroll to top function
  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ 
        y: 0, 
        animated: true 
      });
    }
  };

  // Tab navigation function
  const navigateToTab = (tabName) => {
    setActiveTab(tabName);
    // You could also scroll to specific sections using ref
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

    // Clean and format phone number
    const cleanedPhone = phoneNumber.toString().replace(/[^+\\d]/g, '');
    
    if (!cleanedPhone || cleanedPhone.length < 6) {
      Alert.alert('Invalid Phone Number', 'The phone number appears to be invalid.');
      return;
    }

    const telUrl = `tel:${cleanedPhone}`;
    
    // Show confirmation dialog
    Alert.alert(
      'Call Parent',
      `Do you want to call ${parentName || 'parent'} at ${phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: async () => {
            try {
              const supported = await Linking.canOpenURL(telUrl);
              
              if (supported) {
                await Linking.openURL(telUrl);
              } else {
                Alert.alert(
                  'Unable to Call',
                  Platform.OS === 'web' 
                    ? 'Phone calling is not supported in web browsers. Please use a mobile device or copy the number manually.'
                    : 'Your device does not support making phone calls.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error making call:', error);
              Alert.alert('Call Failed', 'Unable to make the call. Please try again later.');
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
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.actionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <Header title="Student Profile" showBack={true} />
      
      {/* Main Content Container - This defines the scrollable area */}
      <View style={styles.scrollableContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2196F3']}
              progressBackgroundColor="#fff"
            />
          }
        >
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabScrollContent}
            >
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'profile' && styles.activeTabButton]}
                onPress={() => navigateToTab('profile')}
              >
                <Ionicons name="person" size={20} color={activeTab === 'profile' ? "#2196F3" : "#757575"} />
                <Text style={[styles.tabButtonText, activeTab === 'profile' && styles.activeTabText]}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'parent' && styles.activeTabButton]}
                onPress={() => navigateToTab('parent')}
              >
                <Ionicons name="people" size={20} color={activeTab === 'parent' ? "#2196F3" : "#757575"} />
                <Text style={[styles.tabButtonText, activeTab === 'parent' && styles.activeTabText]}>Parent Info</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'academic' && styles.activeTabButton]}
                onPress={() => navigateToTab('academic')}
              >
                <Ionicons name="school" size={20} color={activeTab === 'academic' ? "#2196F3" : "#757575"} />
                <Text style={[styles.tabButtonText, activeTab === 'academic' && styles.activeTabText]}>Academic</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'additional' && styles.activeTabButton]}
                onPress={() => navigateToTab('additional')}
              >
                <Ionicons name="information-circle" size={20} color={activeTab === 'additional' ? "#2196F3" : "#757575"} />
                <Text style={[styles.tabButtonText, activeTab === 'additional' && styles.activeTabText]}>Additional</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Student Profile Header Card */}
          <Animated.View 
            style={[styles.profileCard, { opacity: fadeAnim }]}
          >
            <View style={styles.profileAvatarContainer}>
              <View style={styles.profileAvatar}>
                <Text style={styles.avatarText}>
                  {studentData.name ? studentData.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            </View>
            
            <View style={styles.profileInfo}>
              <Text style={styles.studentName}>{studentData.name}</Text>
              <Text style={styles.classInfo}>
                {studentData.classes ? `${studentData.classes.class_name} - Section ${studentData.classes.section}` : 'Class not assigned'}
              </Text>
              <Text style={styles.rollNumber}>Admission No: {studentData.admission_no || 'N/A'}</Text>
            </View>
          </Animated.View>

          {/* Student Information Cards - Conditionally shown based on active tab */}
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <View style={styles.card}>
                  <View style={styles.cardItem}>
                    <Ionicons name="calendar" size={24} color="#2196F3" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Date of Birth</Text>
                      <Text style={styles.cardValue}>{formatDate(studentData.dob)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="hourglass" size={24} color="#2196F3" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Age</Text>
                      <Text style={styles.cardValue}>{calculateAge(studentData.dob)} years</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="person" size={24} color="#2196F3" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Gender</Text>
                      <Text style={styles.cardValue}>{studentData.gender || 'Not provided'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="id-card" size={24} color="#2196F3" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Student ID</Text>
                      <Text style={styles.cardValue}>{studentData.id}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* PARENT TAB */}
            {activeTab === 'parent' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Parent/Guardian Information</Text>
                <View style={styles.card}>
                  <View style={styles.cardItem}>
                    <Ionicons name="people" size={24} color="#4CAF50" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Parent/Guardian Name</Text>
                      <Text style={styles.cardValue}>{studentData.parent_info?.name || 'Not available'}</Text>
                    </View>
                  </View>
                  
                  {studentData.parent_info?.relation && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.cardItem}>
                        <Ionicons name="heart" size={24} color="#4CAF50" style={styles.cardIcon} />
                        <View style={styles.cardContent}>
                          <Text style={styles.cardLabel}>Relationship</Text>
                          <Text style={styles.cardValue}>{studentData.parent_info.relation}</Text>
                        </View>
                      </View>
                    </>
                  )}
                  
                  {studentData.parent_info?.phone && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.cardItem}>
                        <Ionicons name="call" size={24} color="#4CAF50" style={styles.cardIcon} />
                        <View style={styles.cardContent}>
                          <Text style={styles.cardLabel}>Phone Number</Text>
                          <Text style={styles.cardValue}>{studentData.parent_info.phone}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() => handleCallParent(studentData.parent_info.phone, studentData.parent_info.name)}
                        >
                          <Ionicons name="call" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                  
                  {studentData.parent_info?.email && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.cardItem}>
                        <Ionicons name="mail" size={24} color="#4CAF50" style={styles.cardIcon} />
                        <View style={styles.cardContent}>
                          <Text style={styles.cardLabel}>Email</Text>
                          <Text style={styles.cardValue}>{studentData.parent_info.email}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* ACADEMIC TAB */}
            {activeTab === 'academic' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Academic Information</Text>
                <View style={styles.card}>
                  <View style={styles.cardItem}>
                    <Ionicons name="school" size={24} color="#FF9800" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Class</Text>
                      <Text style={styles.cardValue}>
                        {studentData.classes ? `${studentData.classes.class_name} - Section ${studentData.classes.section}` : 'Not assigned'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="stats-chart" size={24} color="#FF9800" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Attendance</Text>
                      <Text style={styles.cardValue}>{student.attendancePercentage || 0}%</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="trophy" size={24} color="#FF9800" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Academic Performance</Text>
                      <Text style={[styles.cardValue, styles.highlight]}>
                        {student.hasMarks ? `${student.academicPercentage}%` : 'No marks available'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="cash" size={24} color="#FF9800" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Fee Status</Text>
                      <Text style={[
                        styles.cardValue, 
                        feeStatus === 'Paid' ? styles.statusPaid : styles.statusUnpaid
                      ]}>
                        {feeStatus || 'Unknown'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ADDITIONAL TAB */}
            {activeTab === 'additional' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Additional Details</Text>
                <View style={styles.card}>
                  <View style={styles.cardItem}>
                    <Ionicons name="time" size={24} color="#9C27B0" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Enrollment Date</Text>
                      <Text style={styles.cardValue}>{formatDate(studentData.created_at) || 'N/A'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="location" size={24} color="#9C27B0" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Address</Text>
                      <Text style={styles.cardValue}>{studentData.address || 'Not provided'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="medical" size={24} color="#9C27B0" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Medical Information</Text>
                      <Text style={styles.cardValue}>{studentData.medical_info || 'No medical information on file'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.cardItem}>
                    <Ionicons name="document-text" size={24} color="#9C27B0" style={styles.cardIcon} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Notes</Text>
                      <Text style={styles.cardValue}>{studentData.notes || 'No additional notes'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Extra content to ensure scrollability */}
            <View style={styles.bottomSpacing} />
          </Animated.View>
        </ScrollView>
        
        {/* Scroll to top button */}
        {Platform.OS === 'web' && (
          <Animated.View 
            style={[
              styles.scrollToTopButton,
              { opacity: scrollTopOpacity }
            ]}
          >
            <TouchableOpacity
              style={styles.scrollToTopButtonInner}
              onPress={scrollToTop}
            >
              <Ionicons name="chevron-up" size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Main container styles
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      overflow: 'hidden'
    }),
  },
  scrollableContainer: {
    flex: 1,
    position: 'relative',
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)', // Adjust based on your header height
    }),
  },
  scrollView: {
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
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  
  // Loading and error states
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Tab navigation
  tabContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#757575',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  
  // Profile card
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatarContainer: {
    marginRight: 16,
  },
  profileAvatar: {
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
  profileInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 15,
    color: '#666',
    marginBottom: 4,
  },
  rollNumber: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  
  // Section containers
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  
  // Card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  cardIcon: {
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 0,
  },
  
  // Special styles
  highlight: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  statusPaid: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  statusUnpaid: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  
  // Scroll to top button
  scrollToTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
  },
  
  // Spacing
  bottomSpacing: {
    height: 40,
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
