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

const StudentMarksScreen = ({ navigation, route }) => {
  const { student } = route.params;
  const [examMarks, setExamMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Load marks data
  const loadMarksData = async () => {
    try {
      setLoading(true);
      
      // Get marks for the student with subject and exam information
      const { data: marksData, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          subjects(name),
          exams(name, start_date)
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      if (marksError) throw marksError;

      // Group marks by exam
      const examGroups = {};
      marksData.forEach(mark => {
        const examName = mark.exams?.name || 'Class Test';
        const examDate = mark.exams?.start_date || mark.exam_date || new Date().toISOString();
        
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

  // Subscribe to real-time updates
  useEffect(() => {
    loadMarksData();

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
  }, []);

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

  return (
    <View style={styles.container}>
      <Header title={`${student.name}'s Marks`} showBack={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadMarksData().finally(() => setRefreshing(false));
              }}
            />
          }
        >
          {examMarks.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="book-outline" size={48} color="#ccc" />
              <Text style={styles.noDataText}>No marks found</Text>
              <Text style={styles.noDataSubtext}>Marks will appear here once entered</Text>
            </View>
          ) : (
            <>
              {/* Marks Summary Chart */}
              <View style={styles.chartContainer}>
                <Text style={styles.sectionTitle}>Marks Summary</Text>
                <CrossPlatformBarChart
                  data={examMarks.map(exam => ({
                    exam: exam.exam,
                    marks: exam.data.reduce((sum, s) => sum + s.marks, 0)
                  }))}
                  xAxisLabel="Exam"
                  yAxisLabel="Total Marks"
                  barColor="#1976d2"
                  style={{ height: 200 }}
                />
              </View>

              {/* Exam Marks List */}
              <View style={styles.marksList}>
                <Text style={styles.sectionTitle}>Exam Marks</Text>
                <SectionList
                  sections={examMarks}
                  keyExtractor={(item, index) => item.subject + index}
                  renderSectionHeader={({ section: { exam, data, date } }) => {
                    const { total, maxTotal, percent } = getExamTotals(exam, data);
                    return (
                      <TouchableOpacity
                        style={styles.examHeaderContainer}
                        onPress={() => handleExamSelect(exam)}
                      >
                        <View style={styles.examInfo}>
                          <Ionicons name="book" size={20} color="#1976d2" />
                          <Text style={styles.examText}>{exam}</Text>
                          <Text style={styles.dateText}>
                            {format(new Date(date), 'dd MMM yyyy')}
                          </Text>
                        </View>
                        <View style={styles.examSummary}>
                          <Text style={styles.totalText}>Total: {total} / {maxTotal}</Text>
                          <Text style={styles.percentText}>{percent}%</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.subjectRow}
                      onPress={() => handleSubjectSelect(item.subject)}
                    >
                      <Text style={styles.subjectText}>{item.subject}</Text>
                      <Text style={styles.marksText}>
                        {item.marks} / {item.total}
                      </Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.list}
                />
              </View>
            </>
          )}

          {/* Exam Details Modal */}
          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#1976d2" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{selectedExam}</Text>
                </View>
                
                <ScrollView>
                  {examMarks.find(exam => exam.exam === selectedExam)?.data?.map((subject, index) => (
                    <View key={index} style={styles.modalItem}>
                      <Text style={styles.subjectText}>{subject.subject}</Text>
                      <Text style={styles.marksText}>
                        {subject.marks} / {subject.total}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  examText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
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
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    marginLeft: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
  },
});

export default StudentMarksScreen; 