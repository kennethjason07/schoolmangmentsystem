import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import { dbHelpers, supabase } from '../../utils/supabase';

const StudentDetails = ({ route }) => {
  const navigation = useNavigation();
  const { student } = route.params;
  const [studentData, setStudentData] = useState(null);
  const [feeStatus, setFeeStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
        
        // Method 1: Try parents table
        const { data: parentsTableData, error: parentError } = await supabase
          .from('parents')
          .select('name, relation')
          .eq('student_id', student.id)
          .single();
        
        if (parentsTableData && !parentError) {
          parentData = parentsTableData;
          console.log('Found parent in parents table:', parentData);
        } else {
          console.log('No parent found in parents table for student:', student.id);
          
          // Method 2: Try via parent_id in students table (users table)
          if (data.parent_id) {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('full_name, email, phone')
              .eq('id', data.parent_id)
              .single();
            
            if (userData && !userError) {
              parentData = { name: userData.full_name, relation: 'Guardian' };
              console.log('Found parent in users table:', parentData);
            } else {
              console.log('No parent found in users table for parent_id:', data.parent_id);
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
              parentData = { name: linkedParentData.full_name, relation: 'Guardian' };
              console.log('Found parent via linked_parent_of:', parentData);
            } else {
              console.log('No parent found via linked_parent_of for student:', student.id);
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
    fetchStudentDetails();
  }, [student.id]);

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
    <View style={styles.container}>
      {/* Use the proper Header component for consistent profile photo loading */}
      <Header title="Student Profile" showBack={true} />
      
      <ScrollView style={styles.content}>
        {/* Student Info Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.studentName}>{studentData.name}</Text>
          <Text style={styles.classInfo}>
            {studentData.classes ? `${studentData.classes.class_name} - Section ${studentData.classes.section}` : 'Class not assigned'}
          </Text>
          <Text style={styles.rollNumber}>Roll No: {studentData.roll_no || 'N/A'}</Text>
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
        
        <View style={styles.bottomSpacing} />
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
    padding: 16,
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
    alignItems: 'center',
  },
});

export default StudentDetails;
