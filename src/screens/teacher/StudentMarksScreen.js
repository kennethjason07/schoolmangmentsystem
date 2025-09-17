import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { format } from 'date-fns';
import { CrossPlatformBarChart } from '../../components/CrossPlatformChart';
import { Ionicons } from '@expo/vector-icons';
// 🚀 ENHANCED TENANT SYSTEM IMPORTS
import { 
  useTenantAccess, 
  createTenantQuery,
  getCachedTenantId 
} from '../../utils/tenantHelpers';

const StudentMarksScreen = ({ navigation, route }) => {
  const { student } = route.params;
  const [examMarks, setExamMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // 🚀 ENHANCED TENANT SYSTEM - Use reliable cached tenant access
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // 🚀 ENHANCED TENANT SYSTEM - Tenant validation helper
  const validateTenantAccess = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    return { valid: true, tenantId };
  };

  // 🚀 ENHANCED: Load marks data with enhanced tenant system
  const loadMarksData = async () => {
    try {
      setLoading(true);
      
      // 🚀 ENHANCED: Validate tenant access using new helper
      const validation = validateTenantAccess();
      if (!validation.valid) {
        console.error('❌ Enhanced tenant validation failed:', validation.error);
        throw new Error(validation.error);
      }
      
      const tenantId = validation.tenantId;
      console.log('🚀 Enhanced tenant system: Loading marks for student', student.id, 'in tenant:', tenantId);
      
      // 🚀 ENHANCED: Get marks using createTenantQuery with automatic tenant filtering
      const { data: marksData, error: marksError } = await createTenantQuery(
        TABLES.MARKS,
        `
          *,
          subjects(name),
          exams(name, start_date, end_date)
        `,
        { student_id: student.id }
      )
        .order('created_at', { ascending: false });

      if (marksError) throw marksError;

      // Group marks by exam
      const examGroups = {};
      marksData.forEach(mark => {
        const examName = mark.exams?.name || 'Class Test';
        const examDate = mark.exams?.start_date || mark.exams?.end_date || mark.exam_date || new Date().toISOString();
        
        if (!examGroups[examName]) {
          examGroups[examName] = {
            exam: examName,
            date: examDate,
            data: []
          };
        }
        
        examGroups[examName].data.push({
          subject: mark.subjects?.name || 'Unknown Subject',
          marks: mark.marks_obtained || 0,
          total: mark.max_marks || 100,
          subjectId: mark.subject_id
        });
      });

      // Convert to array and sort by date
      const processedExams = Object.values(examGroups).sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );

      setExamMarks(processedExams);
    } catch (error) {
      console.error('Error loading marks data:', error);
      Alert.alert('Error', 'Failed to load marks data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🚀 ENHANCED: Subscribe to real-time updates with tenant readiness check
  useEffect(() => {
    if (isReady) {
      loadMarksData();
    }
  }, [isReady]);
  
  useEffect(() => {
    if (!isReady) return;
    
    const subscription = supabase
      .channel('marks-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.MARKS
      }, () => {
        loadMarksData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isReady]);

  // Get exam totals
  const getExamTotals = (exam, data) => {
    const total = data.reduce((sum, s) => sum + s.marks, 0);
    const maxTotal = data.reduce((sum, s) => sum + s.total, 0);
    const percent = maxTotal ? ((total / maxTotal) * 100).toFixed(1) : '0.0';
    return { total, maxTotal, percent };
  };

  // Handle exam selection
  const handleExamSelect = (exam) => {
    setSelectedExam(exam);
    setSelectedSubject(null);
    setModalVisible(true);
  };

  // Handle subject selection
  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject);
  };

  // 🚀 ENHANCED: Show tenant loading states
  if (tenantLoading) {
    return (
      <View style={styles.container}>
        <Header title={`${student.name}'s Marks`} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Initializing tenant context...</Text>
          <Text style={styles.loadingSubtext}>Setting up secure access</Text>
        </View>
      </View>
    );
  }
  
  // 🚀 ENHANCED: Show tenant errors with enhanced messages
  if (tenantError) {
    return (
      <View style={styles.container}>
        <Header title={`${student.name}'s Marks`} showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Tenant Access Error</Text>
          <Text style={styles.errorText}>{tenantError}</Text>
          <Text style={styles.errorSubtext}>Please check your connection and try again.</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              // Refresh the page to retry tenant initialization
              loadMarksData();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={`${student.name}'s Marks`} showBack={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          {tenantName && (
            <Text style={styles.loadingSubtext}>📚 {tenantName}</Text>
          )}
        </View>
      ) : (
        examMarks.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="book-outline" size={64} color="#E3F2FD" />
            <Text style={styles.noDataText}>No marks found</Text>
            <Text style={styles.noDataSubtext}>Marks will appear here once they are entered by teachers</Text>
          </View>
        ) : (
          <SectionList
            sections={examMarks}
            keyExtractor={(item, index) => item.subject + index}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadMarksData().finally(() => setRefreshing(false));
                }}
                colors={['#1976d2']}
                tintColor="#1976d2"
              />
            }
            ListHeaderComponent={() => (
              <View style={styles.headerContainer}>
                {/* Student Info Card */}
                <View style={styles.studentInfoCard}>
                  <View style={styles.studentAvatarContainer}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarText}>
                        {student.name?.charAt(0).toUpperCase() || 'S'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.studentDetails}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentInfo}>Roll No: {student.roll_no || 'N/A'}</Text>
                    <Text style={styles.studentInfo}>Class: {student.classes?.class_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{examMarks.length}</Text>
                      <Text style={styles.statLabel}>Exams</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>
                        {examMarks.reduce((sum, exam) => sum + exam.data.length, 0)}
                      </Text>
                      <Text style={styles.statLabel}>Subjects</Text>
                    </View>
                  </View>
                </View>

                {/* Performance Chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.sectionTitle}>📊 Performance Overview</Text>
                  <CrossPlatformBarChart
                    data={{
                      labels: examMarks.map(exam => exam.exam.length > 12 ? exam.exam.substring(0, 12) + '...' : exam.exam),
                      datasets: [{
                        data: examMarks.map(exam => {
                          const { percent } = getExamTotals(exam.exam, exam.data);
                          return parseFloat(percent);
                        })
                      }]
                    }}
                    width={Dimensions.get('window').width - 64}
                    height={220}
                    chartConfig={{
                      backgroundColor: '#ffffff',
                      backgroundGradientFrom: '#f8f9ff',
                      backgroundGradientTo: '#ffffff',
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity * 0.8})`,
                      style: {
                        borderRadius: 16
                      },
                      propsForBackgroundLines: {
                        strokeWidth: 1,
                        stroke: '#E3F2FD',
                        strokeDasharray: '5,5'
                      }
                    }}
                    style={{
                      marginVertical: 12,
                      borderRadius: 16
                    }}
                    showValuesOnTopOfBars
                  />
                </View>

                {/* Section Header */}
                <View style={styles.examsSectionHeader}>
                  <Text style={styles.sectionTitle}>📚 Detailed Exam Results</Text>
                  <Text style={styles.sectionSubtitle}>Tap on any exam to view detailed breakdown</Text>
                </View>
              </View>
            )}
            renderSectionHeader={() => null}
            renderItem={({ section: { exam, data, date } }) => {
              const { total, maxTotal, percent } = getExamTotals(exam, data);
              const getGradeColor = (percentage) => {
                if (percentage >= 90) return '#4CAF50'; // Green
                if (percentage >= 80) return '#8BC34A'; // Light Green
                if (percentage >= 70) return '#FFC107'; // Yellow
                if (percentage >= 60) return '#FF9800'; // Orange
                if (percentage >= 50) return '#FF5722'; // Deep Orange
                return '#F44336'; // Red
              };
              const getGradeLetter = (percentage) => {
                if (percentage >= 90) return 'A+';
                if (percentage >= 80) return 'A';
                if (percentage >= 70) return 'B+';
                if (percentage >= 60) return 'B';
                if (percentage >= 50) return 'C';
                return 'F';
              };
              
              return (
                <TouchableOpacity
                  style={[
                    styles.examContainer,
                    {
                      borderLeftWidth: 4,
                      borderLeftColor: getGradeColor(parseFloat(percent)),
                    }
                  ]}
                  onPress={() => handleExamSelect(exam)}
                  activeOpacity={0.7}
                >
                  {/* Exam Header */}
                  <View style={styles.examHeader}>
                    <View style={styles.examHeaderLeft}>
                      <View style={[
                        styles.examIconContainer,
                        { 
                          backgroundColor: getGradeColor(parseFloat(percent)) + '20',
                          borderColor: getGradeColor(parseFloat(percent)) + '40',
                        }
                      ]}>
                        <Ionicons name="school" size={22} color={getGradeColor(parseFloat(percent))} />
                      </View>
                      <View style={styles.examInfo}>
                        <Text style={styles.examText} numberOfLines={2}>{exam}</Text>
                        <Text style={styles.examDateText} numberOfLines={1}>
                          📅 {format(new Date(date), 'dd MMM yyyy')}
                        </Text>
                        <Text style={styles.examSubjectsText}>
                          📚 {data.length} subjects
                        </Text>
                      </View>
                    </View>
                    <View style={styles.examHeaderRight}>
                      <View style={[
                        styles.gradeCircle, 
                        { backgroundColor: getGradeColor(parseFloat(percent)) }
                      ]}>
                        <Text style={styles.gradeText}>{getGradeLetter(parseFloat(percent))}</Text>
                      </View>
                      <Text style={styles.percentageText}>{percent}%</Text>
                      <Text style={styles.totalMarksText} numberOfLines={1}>{total}/{maxTotal}</Text>
                    </View>
                  </View>

                  {/* Subjects List */}
                  <View style={styles.subjectsContainer}>
                    {data.map((subject, index) => {
                      const percentage = subject.total > 0 ? ((subject.marks / subject.total) * 100) : 0;
                      const getSubjectGradeColor = (percentage) => {
                        if (percentage >= 90) return '#4CAF50';
                        if (percentage >= 80) return '#8BC34A';
                        if (percentage >= 70) return '#FFC107';
                        if (percentage >= 60) return '#FF9800';
                        if (percentage >= 50) return '#FF5722';
                        return '#F44336';
                      };
                      const getSubjectGradeLetter = (percentage) => {
                        if (percentage >= 90) return 'A+';
                        if (percentage >= 80) return 'A';
                        if (percentage >= 70) return 'B+';
                        if (percentage >= 60) return 'B';
                        if (percentage >= 50) return 'C';
                        return 'F';
                      };
                      
                      return (
                        <TouchableOpacity 
                          key={index}
                          style={styles.subjectRow}
                          onPress={() => handleSubjectSelect(subject)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.subjectLeft}>
                            <View style={[
                              styles.subjectIndicator, 
                              { backgroundColor: getSubjectGradeColor(percentage) }
                            ]} />
                            <View style={styles.subjectIconContainer}>
                              <Ionicons name="book" size={16} color={getSubjectGradeColor(percentage)} />
                            </View>
                            <View style={styles.subjectDetails}>
                              <Text style={styles.subjectText} numberOfLines={1}>{subject.subject}</Text>
                              <Text style={styles.subjectMetaText}>
                                {percentage >= 75 ? 'Excellent' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Average' : 'Needs Improvement'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.subjectRight}>
                            <View style={[
                              styles.subjectGradeChip,
                              { backgroundColor: getSubjectGradeColor(percentage) }
                            ]}>
                              <Text style={styles.subjectGradeText}>{getSubjectGradeLetter(percentage)}</Text>
                            </View>
                            <Text style={styles.marksText}>{subject.marks}/{subject.total}</Text>
                            <Text style={[styles.percentageLabel, { color: getSubjectGradeColor(percentage) }]}>
                              {percentage.toFixed(1)}%
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.sectionListContent}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* Enhanced Exam Details Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="document-text" size={24} color="#1976d2" />
                <Text style={styles.modalTitle}>{selectedExam}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {examMarks.find(exam => exam.exam === selectedExam)?.data?.map((subject, index) => {
                const percentage = subject.total > 0 ? ((subject.marks / subject.total) * 100) : 0;
                const getSubjectGradeColor = (percentage) => {
                  if (percentage >= 90) return '#4CAF50';
                  if (percentage >= 80) return '#8BC34A';
                  if (percentage >= 70) return '#FFC107';
                  if (percentage >= 60) return '#FF9800';
                  if (percentage >= 50) return '#FF5722';
                  return '#F44336';
                };
                const getGradeLetter = (percentage) => {
                  if (percentage >= 90) return 'A+';
                  if (percentage >= 80) return 'A';
                  if (percentage >= 70) return 'B+';
                  if (percentage >= 60) return 'B';
                  if (percentage >= 50) return 'C';
                  return 'F';
                };
                
                return (
                  <View key={index} style={styles.modalSubjectCard}>
                    <View style={styles.modalSubjectHeader}>
                      <View style={styles.modalSubjectLeft}>
                        <View style={[styles.modalSubjectIndicator, { backgroundColor: getSubjectGradeColor(percentage) }]} />
                        <Text style={styles.modalSubjectName}>{subject.subject}</Text>
                      </View>
                      <View style={[styles.modalGradeChip, { backgroundColor: getSubjectGradeColor(percentage) }]}>
                        <Text style={styles.modalGradeText}>{getGradeLetter(percentage)}</Text>
                      </View>
                    </View>
                    <View style={styles.modalMarksRow}>
                      <View style={styles.modalMarksItem}>
                        <Text style={styles.modalMarksLabel}>Marks Obtained</Text>
                        <Text style={styles.modalMarksValue}>{subject.marks}</Text>
                      </View>
                      <View style={styles.modalMarksItem}>
                        <Text style={styles.modalMarksLabel}>Total Marks</Text>
                        <Text style={styles.modalMarksValue}>{subject.total}</Text>
                      </View>
                      <View style={styles.modalMarksItem}>
                        <Text style={styles.modalMarksLabel}>Percentage</Text>
                        <Text style={[styles.modalPercentageValue, { color: getSubjectGradeColor(percentage) }]}>
                          {percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#666',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
  },
  chartContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12,
  },
  marksList: {
    marginBottom: 24,
  },
  examHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  examText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  examDateText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  examSubjectsText: {
    fontSize: 12,
    color: '#666',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  examSummary: {
    alignItems: 'flex-end',
  },
  totalText: {
    fontSize: 14,
    color: '#666',
  },
  percentText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    borderLeftWidth: 0,
  },
  subjectText: {
    fontSize: 15,
    color: '#333',
  },
  marksText: {
    fontSize: 15,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    fontWeight: 'bold',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  // New styles for improved UI
  sectionListContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    padding: 16,
  },
  studentInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  studentAvatarContainer: {
    marginRight: 16,
  },
  studentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  studentAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  studentDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E3F2FD',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examsSectionHeader: {
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  examHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  examIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  examMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  subjectCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  examHeaderRight: {
    alignItems: 'center',
  },
  gradeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  totalMarksText: {
    fontSize: 12,
    color: '#666',
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  subjectRight: {
    alignItems: 'flex-end',
  },
  percentageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalSubjectCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  modalSubjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSubjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalSubjectIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  modalSubjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalGradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  modalGradeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalMarksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalMarksItem: {
    alignItems: 'center',
    flex: 1,
  },
  modalMarksLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  modalMarksValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalPercentageValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Additional styles for enhanced UI
  examMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  examDuration: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  viewDetailsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  viewDetailsText: {
    fontSize: 10,
    color: '#1976d2',
    fontWeight: '600',
    marginRight: 4,
  },
  subjectIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  subjectDetails: {
    flex: 1,
  },
  subjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  subjectMetaText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  subjectGradeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
    minWidth: 32,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  subjectGradeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  // New container styles
  examContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subjectsContainer: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
});

export default StudentMarksScreen;
