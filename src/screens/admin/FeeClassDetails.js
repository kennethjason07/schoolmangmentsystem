import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Platform } from 'react-native';
import Header from '../../components/Header';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../../utils/helpers';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import FeeService from '../../services/FeeService';
import { exportStudentFeeSummary } from '../../utils/exportUtils';

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
  const handleDownloadSummary = async () => {
    try {
      if (!students || students.length === 0) {
        return;
      }
      // Build per-student fee summary using FeeService
      const results = await Promise.all(
        students.map(async (s) => {
          try {
            const res = await FeeService.getStudentFeeDetails(s.id);
            if (res.success && res.data) {
              const d = res.data;
              return {
                studentName: d.student?.name || s.full_name || 'N/A',
                admissionNo: d.student?.admission_no || s.admission_no || 'N/A',
                className: d.student?.class_info ? `${d.student.class_info.name || ''} ${d.student.class_info.section || ''}`.trim() : (classInfo ? `${classInfo.class_name} ${classInfo.section || ''}`.trim() : 'N/A'),
                academicYear: d.fees?.academicYear || s.academic_year || 'N/A',
                totalFee: d.fees?.totalDue ?? d.fees?.totalAmount ?? 0,
                feeConcession: d.fees?.totalDiscounts ?? 0,
                amountPaid: d.fees?.totalPaid ?? 0,
                outstandingFee: d.fees?.totalOutstanding ?? 0,
              };
            }
          } catch (e) {
            // ignore individual errors
          }
          return null;
        })
      );

      const rows = results.filter(Boolean);
      const base = classInfo ? `class_${classInfo.class_name}_${classInfo.section || ''}_fee_summary` : 'class_fee_summary';
      await exportStudentFeeSummary(rows, base.replace(/\s+/g, '_').toLowerCase(), 'csv');
    } catch (e) {
      // best-effort
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
        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadData} />
            }
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            nestedScrollEnabled={true}
            overScrollMode="always"
            scrollEventThrottle={16}
          >
          <Animatable.View animation="fadeIn" style={styles.contentContainer}>
            {classInfo && <Text style={styles.classDesc}>{classInfo.description || `Class ${classInfo.class_name}`}</Text>}
            
            <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <TouchableOpacity onPress={handleDownloadSummary} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#2196F3', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#E3F2FD' }}>
                <Ionicons name="download" size={16} color="#2196F3" />
                <Text style={{ marginLeft: 6, color: '#2196F3' }}>Download Student Summary (CSV)</Text>
              </TouchableOpacity>
            </View>

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
              <View style={styles.listContainer}>
                <Text style={styles.listHeader}>All Fee Dues</Text>
                {students.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="people" size={48} color="#BDBDBD" />
                    <Text style={styles.emptyText}>No students found in this class</Text>
                  </View>
                ) : (
                  <View style={styles.studentsListContainer}>
                    {students.map((item) => {
                      // Use FeeService for consistent calculation across admin views
                      const [studentFeeData, setStudentFeeData] = React.useState(null);
                      const [loadingFeeData, setLoadingFeeData] = React.useState(true);
                    
                    React.useEffect(() => {
                      const fetchStudentFeeData = async () => {
                        try {
                          console.log('🎯 FeeClassDetails - Using FeeService for student:', item.id);
                          const feeServiceResult = await FeeService.getStudentFeeDetails(item.id);
                          if (feeServiceResult.success && feeServiceResult.data) {
                            setStudentFeeData(feeServiceResult.data);
                            console.log('✅ FeeClassDetails - FeeService data:', {
                              totalDue: feeServiceResult.data.fees.totalDue,
                              totalPaid: feeServiceResult.data.fees.totalPaid,
                              components: feeServiceResult.data.fees.components?.length
                            });
                          } else {
                            console.log('⚠️ FeeClassDetails - FeeService failed, using fallback');
                            setStudentFeeData(null);
                          }
                        } catch (error) {
                          console.error('❌ FeeClassDetails - Error fetching fee data:', error);
                          setStudentFeeData(null);
                        } finally {
                          setLoadingFeeData(false);
                        }
                      };
                      
                      fetchStudentFeeData();
                    }, [item.id]);
                
                    return (
                      <View key={item.id} style={styles.studentRowMulti}>
                        <Text style={styles.studentNameMulti}>{item.full_name}</Text>
                        <View style={{ flex: 1 }}>
                          {loadingFeeData ? (
                            <Text style={styles.loadingText}>Loading fee data...</Text>
                          ) : studentFeeData?.fees?.components ? (
                            studentFeeData.fees.components.map((component, index) => {
                              // Determine payment status using centralized data
                              let status = 'Unpaid';
                              if (component.paidAmount >= component.finalAmount) {
                                status = 'Paid';
                              } else if (component.paidAmount > 0) {
                                status = 'Partial';
                              }
                              
                              return (
                                <View key={index} style={styles.feeTypeDueRow}>
                                  <Text style={styles.feeTypeDueTitle}>{component.name}:</Text>
                                  <Text style={styles.feeTypeDueAmount}>
                                    {formatCurrency(component.paidAmount)} / {formatCurrency(component.finalAmount)}
                                    {component.discountAmount > 0 && (
                                      <Text style={styles.discountText}> (₹{component.discountAmount} off)</Text>
                                    )}
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
                            })
                          ) : allFees.length > 0 ? (
                            // Fallback to old calculation if FeeService fails
                            allFees.map(feeType => {
                              const studentPayments = payments.filter(p => 
                                p.student_id === item.id && p.fee_id === feeType.id
                              );
                              
                              const paidAmount = studentPayments.reduce((sum, payment) => 
                                sum + (payment.amount_paid || 0), 0
                              );
                              
                              // Note: This is fallback logic when FeeService fails
                              // In the fallback, we don't have concession data, so we use payment-based status only
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
                            })
                          ) : (
                            <Text style={styles.noFeesText}>No fee structures defined for this class</Text>
                          )}
                        </View>
                      </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          
            {fee && (
              <View style={styles.listContainer}>
                <Text style={styles.listHeader}>Student Fee Details</Text>
                {students.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="people" size={48} color="#BDBDBD" />
                    <Text style={styles.emptyText}>No students found in this class</Text>
                  </View>
                ) : (
                  <View style={styles.studentsListContainer}>
                    {students.map((item) => {
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
                      <View key={item.id} style={styles.studentRow}>
                        <Text style={styles.studentName}>{item.full_name}</Text>
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
                    })}
                  </View>
                )}
                
                {fee && (
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
                )}
              </View>
            )}
          </Animatable.View>
          {/* Add bottom padding to ensure content is fully scrollable */}
          <View style={styles.bottomPadding} />
          </ScrollView>
        </View>
      )}
      
      <FloatingRefreshButton 
        onRefresh={loadData}
        isRefreshing={loading}
        bottom={80}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 120px)',
        maxHeight: 'calc(100vh - 120px)',
        minHeight: 500,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      },
      default: {
        minHeight: 400,
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'scroll',
        overflowX: 'hidden',
        height: '100%',
        maxHeight: '100%',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    minHeight: 'auto',
    ...Platform.select({
      web: {
        paddingBottom: 100,
        paddingTop: 8,
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
    }),
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    minHeight: 'auto',
    ...Platform.select({
      web: {
        width: '100%',
        boxSizing: 'border-box',
      },
    }),
  },
  listContainer: {
    flex: 1,
    marginTop: 12,
    minHeight: 'auto',
  },
  bottomPadding: {
    height: 60,
    ...Platform.select({
      web: {
        height: 40,
      },
    }),
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
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        ':hover': {
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        },
      },
    }),
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
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        ':hover': {
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        },
      },
    }),
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
  discountText: {
    fontSize: 11,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  studentsListContainer: {
    flex: 1,
    minHeight: 'auto',
    paddingVertical: 4,
    ...Platform.select({
      web: {
        width: '100%',
        maxHeight: 'none',
        overflow: 'visible',
      },
    }),
  },
});
