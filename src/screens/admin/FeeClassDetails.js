import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Header from '../../components/Header';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

export default function FeeClassDetails() {
  const route = useRoute();
  const navigation = useNavigation();
  const { classId, feeId } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [fee, setFee] = useState(null);
  const [allFees, setAllFees] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // Load data from Supabase
  useEffect(() => {
    if (!classId) {
      setError('Class ID is required');
      setLoading(false);
      return;
    }
    
    loadData();
  }, [classId, feeId]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load class information
      const { data: classData, error: classError } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .eq('id', classId)
        .single();
      
      if (classError) throw classError;
      setClassInfo(classData);
      
      // Load students in this class
      const { data: studentsData, error: studentsError } = await dbHelpers.getStudentsByClass(classId);
      
      if (studentsError) throw studentsError;
      setStudents(studentsData || []);
      
      // Load fee structures for this class
      const { data: feesData, error: feesError } = await dbHelpers.getFeeStructure(classId);
      
      if (feesError) throw feesError;
      setAllFees(feesData || []);
      
      // If a specific fee ID is provided, find that fee
      if (feeId) {
        const specificFee = feesData?.find(f => f.id === feeId) || null;
        setFee(specificFee);
      }
      
      // Load all payments for students in this class
      const studentIds = studentsData?.map(student => student.id) || [];
      
      if (studentIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from(TABLES.STUDENT_FEES)
          .select(`
            *,
            fee_structure(*)
          `)
          .in('student_id', studentIds);
        
        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={styles.container}>
      <Header 
        title={classInfo ? classInfo.class_name : 'Class Details'} 
        showBack={true} 
        onBack={() => navigation.goBack()} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading class details...</Text>
        </View>
      ) : error ? (
        <Animatable.View animation="fadeIn" style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </Animatable.View>
      ) : (
        <Animatable.View animation="fadeIn" style={{flex: 1}}>
          {classInfo && <Text style={styles.classDesc}>{classInfo.description || `Class ${classInfo.class_name}`}</Text>}
          
          {fee ? (
            <View style={styles.feeHeaderBox}>
              <Text style={styles.feeHeaderTitle}>
                {fee.type} <Text style={styles.feeHeaderAmount}>{formatCurrency(fee.amount)}</Text>
              </Text>
              <Text style={styles.feeHeaderDesc}>{fee.description}</Text>
              <Text style={styles.feeHeaderDate}>
                <Ionicons name="calendar" size={14} color="#1976d2" /> {format(new Date(fee.due_date), 'dd MMM yyyy')}
              </Text>
            </View>
          ) : null}
          
          {!fee && (
            <FlatList
              data={students}
              keyExtractor={item => item.id}
              style={{ marginTop: 12 }}
              ListHeaderComponent={<Text style={styles.listHeader}>All Fee Dues</Text>}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people" size={48} color="#BDBDBD" />
                  <Text style={styles.emptyText}>No students found in this class</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.studentRowMulti}>
                  <Text style={styles.studentNameMulti}>{item.full_name}</Text>
                  <View style={{ flex: 1 }}>
                    {allFees.length > 0 ? allFees.map(feeType => {
                      // Find payments for this student and fee type
                      const studentPayments = payments.filter(p => 
                        p.student_id === item.id && p.fee_id === feeType.id
                      );
                      
                      // Calculate total paid amount for this fee
                      const paidAmount = studentPayments.reduce((sum, payment) => 
                        sum + (payment.amount_paid || 0), 0
                      );
                      
                      // Determine payment status
                      let status = 'Unpaid';
                      if (paidAmount >= feeType.amount) {
                        status = 'Paid';
                      } else if (paidAmount > 0) {
                        status = 'Partial';
                      }
                      
                      return (
                        <View key={feeType.id} style={styles.feeTypeDueRow}>
                          <Text style={styles.feeTypeDueTitle}>{feeType.type}:</Text>
                          <Text style={styles.feeTypeDueAmount}>
                            {formatCurrency(paidAmount)} / {formatCurrency(feeType.amount)}
                          </Text>
                          <Text 
                            style={[styles.feeTypeDueStatus, 
                              status === 'Paid' ? {color: '#4CAF50'} : 
                              status === 'Partial' ? {color: '#FF9800'} : 
                              {color: '#F44336'}
                            ]}
                          >
                            {status}
                          </Text>
                        </View>
                      );
                    }) : (
                      <Text style={styles.noFeesText}>No fee structures defined for this class</Text>
                    )}
                  </View>
                </View>
              )}
            />
          )}
          
          {fee && (
            <FlatList
              data={students}
              keyExtractor={item => item.id}
              style={{ marginTop: 12 }}
              ListHeaderComponent={<Text style={styles.listHeader}>Student Fee Details</Text>}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people" size={48} color="#BDBDBD" />
                  <Text style={styles.emptyText}>No students found in this class</Text>
                </View>
              }
              renderItem={({ item }) => {
                // Find payments for this student and fee
                const studentPayments = payments.filter(p => 
                  p.student_id === item.id && p.fee_id === fee.id
                );
                
                // Get the most recent payment
                const latestPayment = studentPayments.length > 0 ? 
                  studentPayments.sort((a, b) => 
                    new Date(b.payment_date) - new Date(a.payment_date)
                  )[0] : null;
                
                // Calculate total paid amount
                const paidAmount = studentPayments.reduce((sum, payment) => 
                  sum + (payment.amount_paid || 0), 0
                );
                
                // Determine payment status
                let status = 'Unpaid';
                if (paidAmount >= fee.amount) {
                  status = 'Paid';
                } else if (paidAmount > 0) {
                  status = 'Partial';
                }
                
                return (
                  <View style={styles.studentRow}>
                    <Text style={styles.studentName}>{item.name}</Text>
                    <Text 
                      style={[styles.studentStatus, 
                        status === 'Paid' ? {color: '#4CAF50'} : 
                        status === 'Partial' ? {color: '#FF9800'} : 
                        {color: '#F44336'}
                      ]}
                    >
                      {status}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                      <Text style={styles.studentAmount}>{formatCurrency(paidAmount)}</Text>
                      {latestPayment && latestPayment.payment_date ? (
                        <>
                          <Ionicons name="calendar" size={14} color="#666" style={{marginLeft: 6}} />
                          <Text style={styles.paymentDate}>
                            {format(new Date(latestPayment.payment_date), 'dd MMM yyyy')}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                fee ? (
                  <View style={styles.totalsBox}>
                    <Text style={styles.totalsLabel}>
                      Total Due: <Text style={styles.totalsValue}>{formatCurrency(students.length * fee.amount)}</Text>
                    </Text>
                    <Text style={styles.totalsPaid}>
                      Total Paid: <Text style={styles.totalsValue}>
                        {formatCurrency(payments
                          .filter(p => p.fee_id === fee.id)
                          .reduce((sum, p) => sum + (p.amount_paid || 0), 0))}
                      </Text>
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </Animatable.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  classDesc: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  listHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#1a237e',
    textAlign: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    elevation: 1,
  },
  studentName: {
    flex: 2,
    fontSize: 15,
  },
  studentStatus: {
    flex: 1,
    fontSize: 13,
    color: '#1976d2',
    textAlign: 'center',
  },
  studentAmount: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
  },
  totalsBox: {
    marginTop: 16,
    alignItems: 'center',
  },
  totalsLabel: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 16,
  },
  totalsPaid: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 16,
    marginTop: 4,
  },
  totalsValue: {
    color: '#1976d2',
  },
  calendarIcon: {
    fontSize: 16,
    marginLeft: 6,
  },
  paymentDate: {
    fontSize: 12,
    color: '#888',
    marginLeft: 2,
  },
  feeHeaderBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  feeHeaderTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1a237e',
  },
  feeHeaderAmount: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  feeHeaderDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  feeHeaderDate: {
    fontSize: 13,
    color: '#1976d2',
    marginTop: 2,
  },
  studentRowMulti: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    elevation: 1,
  },
  studentNameMulti: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  feeTypeDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  feeTypeDueTitle: {
    fontSize: 13,
    color: '#333',
    minWidth: 90,
  },
  feeTypeDueAmount: {
    fontSize: 13,
    color: '#1976d2',
    minWidth: 80,
  },
  feeTypeDueStatus: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
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
    marginTop: 10,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1976d2',
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noFeesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
});