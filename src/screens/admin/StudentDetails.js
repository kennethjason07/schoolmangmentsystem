import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Header from '../../components/Header';
import { dbHelpers } from '../../utils/supabase';

const StudentDetails = ({ route }) => {
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
        // Fetch student details from DB
        const { data, error } = await dbHelpers.getStudentById(student.id);
        console.log('Student data response:', { data, error });
        if (error) {
          console.error('Error fetching student:', error);
          throw error;
        }
        setStudentData(data);

        // Fetch fee status
        console.log('Fetching fees for student ID:', student.id);
        const { data: fees, error: feeError } = await dbHelpers.getStudentFees(student.id);
        console.log('Fees data response:', { fees, feeError });
        if (feeError) {
          console.error('Error fetching fees:', feeError);
          // Don't throw error for fees, just log it
          console.warn('Fee fetch failed, continuing without fee data');
        }
        // Determine fee status (simple: if any paid, show Paid, else Unpaid)
        setFeeStatus(fees && fees.length > 0 ? 'Paid' : 'Unpaid');
      } catch (err) {
        console.error('Full error in fetchStudentDetails:', err);
        setError(`Failed to load student details: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentDetails();
  }, [student.id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Student Details" showBack={true} />
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (error || !studentData) {
    return (
      <View style={styles.container}>
        <Header title="Student Details" showBack={true} />
        <Text style={{ color: 'red', margin: 24 }}>{error || 'No data found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={studentData.name} showBack={true} />
      <View style={styles.card}>
        <Text style={styles.name}>{studentData.name}</Text>
        <Text style={styles.detail}>Class: {studentData.class_id || '-'}</Text>
        <Text style={styles.detail}>Roll No: {studentData.roll_no || '-'}</Text>
        <Text style={styles.detail}>DOB: {studentData.dob || '-'}</Text>
        <Text style={styles.detail}>Attendance: -</Text>
        <Text style={styles.detail}>Fee Status: {feeStatus}</Text>
        <Text style={styles.detail}>Phone: {studentData.phone || '-'}</Text>
        <Text style={styles.detail}>Parent: {studentData.parent_id || '-'}</Text>
        {/* Add more fields as needed */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 12,
  },
  detail: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
});

export default StudentDetails; 