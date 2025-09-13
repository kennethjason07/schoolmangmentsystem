import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase } from '../../utils/supabase';
import ReportCardModal from '../../components/ReportCardModal';

const isWeb = Platform.OS === 'web';

const ReportCardGeneration = ({ navigation }) => {
  // Dynamic responsive state that updates on resize
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  
  const isTablet = dimensions.width >= 768;
  const getResponsiveWidth = () => {
    if (isWeb && dimensions.width > 1200) return Math.min(dimensions.width * 0.8, 1200);
    if (isTablet) return dimensions.width * 0.9;
    return dimensions.width;
  };
  const responsiveWidth = getResponsiveWidth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reportCardVisible, setReportCardVisible] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [studentsScrollY, setStudentsScrollY] = useState(0);

  // Listen for dimension changes on web
  useEffect(() => {
    if (isWeb) {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setDimensions({ width: window.width, height: window.height });
      });
      return () => subscription?.remove();
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedExam) {
      loadStudents();
    }
  }, [selectedClass, selectedExam]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadClasses(), loadExams()]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      throw error;
    }
  };

  const loadExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id,
          name,
          class_id,
          academic_year,
          start_date,
          end_date,
          remarks,
          max_marks,
          created_at,
          classes:class_id (
            id,
            class_name,
            section
          )
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
      throw error;
    }
  };

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            id,
            class_name,
            section
          ),
          parents:parent_id (
            name,
            phone,
            email
          )
        `)
        .eq('class_id', selectedClass)
        .order('roll_no', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    if (selectedClass && selectedExam) {
      await loadStudents();
    }
    setRefreshing(false);
  };

  const getFilteredExams = () => {
    if (!selectedClass) return [];
    
    // Filter exams by class_id, ensuring proper type comparison
    const filteredExams = exams.filter(exam => {
      // Handle both string and number types for IDs
      const examClassId = exam.class_id?.toString();
      const selectedClassId = selectedClass?.toString();
      
      return examClassId === selectedClassId;
    });
    
    return filteredExams;
  };

  const handleStudentPress = (student) => {
    setSelectedStudent(student);
    setReportCardVisible(true);
  };

  const closeReportCard = () => {
    setReportCardVisible(false);
    setSelectedStudent(null);
  };

  const getClassDisplay = (classData) => {
    return `${classData.class_name} - ${classData.section}`;
  };

  const getSelectedClassDisplay = () => {
    const classData = classes.find(c => c.id === selectedClass);
    return classData ? getClassDisplay(classData) : 'Select Class';
  };

  const getSelectedExamDisplay = () => {
    const examData = exams.find(e => e.id === selectedExam);
    return examData ? examData.name : 'Select Exam';
  };

  const renderStudent = (student) => (
    <TouchableOpacity
      key={student.id}
      style={[styles.studentCard, isTablet && styles.studentCardTablet]}
      onPress={() => handleStudentPress(student)}
      activeOpacity={0.7}
    >
      <View style={styles.studentInfo}>
        <Text style={styles.studentName} numberOfLines={2}>{student.name}</Text>
        <Text style={styles.studentDetails} numberOfLines={1}>
          Admission No: {student.admission_no}
        </Text>
        <Text style={styles.studentDetails} numberOfLines={1}>
          Parent: {student.parents?.name || 'N/A'}
        </Text>
      </View>
      <View style={styles.viewReportButton}>
        <Ionicons name="document-text" size={20} color="#1976d2" />
        <Text style={styles.viewReportText}>View Report</Text>
      </View>
    </TouchableOpacity>
  );

  // Create styles as a function to use current dimensions
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f7fa',
    },
    content: {
      flex: 1,
      paddingHorizontal: isWeb ? Math.max(16, (dimensions.width - responsiveWidth) / 2) : 16,
    },
    contentContainer: {
      paddingBottom: 20,
      ...(isWeb && {
        flexGrow: 1,
        minHeight: dimensions.height - 100, // Account for header
      }),
    },
    webContentContainer: {
      alignSelf: 'center',
      width: responsiveWidth,
      flexGrow: 1,
    },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  filtersSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  summarySection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  studentsSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  studentsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentsHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  scrollIndicatorText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  scrollIndicatorTextActive: {
    color: '#1976d2',
    fontWeight: '500',
  },
  studentsList: {
    gap: 12,
  },
  studentsScrollContainer: {
    maxHeight: isWeb ? 600 : isTablet ? 500 : 400,
    marginTop: 8,
  },
  studentsScrollContent: {
    paddingBottom: 16,
  },
  studentCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  viewReportButton: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  viewReportText: {
    fontSize: 12,
    color: '#1976d2',
    marginTop: 4,
    fontWeight: '500',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  helpSection: {
    marginBottom: 16,
  },
  helpCard: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginTop: 8,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'left',
    lineHeight: 20,
  },
  filterCount: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  pickerDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
    opacity: 0.6,
  },
  noExamsText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Responsive styles for tablets and large screens
  studentRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  studentsGrid: {
    gap: 12,
    ...(isTablet && {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    }),
  },
  studentCardContainer: {
    width: '100%',
  },
  studentCardLeft: {
    ...(isTablet && {
      width: '48%',
      marginBottom: 12,
    }),
  },
  studentCardRight: {
    ...(isTablet && {
      width: '48%',
      marginBottom: 12,
    }),
  },
  studentsGridWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  studentCardWeb: {
    width: 'calc(33.333% - 12px)',
    minWidth: 300,
    maxWidth: 400,
  },
  studentCardTablet: {
    flex: 0.48,
    marginHorizontal: 4,
    marginBottom: 8,
    minHeight: 120,
    },
  });

  // Return the JSX here since styles are now created inside
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Report Card Generation" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Report Card Generation" showBack={true} />
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isWeb && styles.webContentContainer]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={isWeb ? true : false}
        bounces={Platform.OS === 'ios'}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        {...(isWeb && {
          scrollEnabled: true,
          keyboardShouldPersistTaps: 'handled'
        })}
      >
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Select Filters</Text>
          
          {/* Class Selection */}
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Class & Section</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedClass}
                style={styles.picker}
                onValueChange={(value) => {
                  setSelectedClass(value);
                  setSelectedExam('');
                  setStudents([]);
                }}
              >
                <Picker.Item label="Select Class" value="" />
                {classes.map(cls => (
                  <Picker.Item
                    key={cls.id}
                    label={getClassDisplay(cls)}
                    value={cls.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Exam Selection */}
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>
              Exam {selectedClass && getFilteredExams().length > 0 && (
                <Text style={styles.filterCount}>({getFilteredExams().length} available)</Text>
              )}
            </Text>
            <View style={[styles.pickerContainer, !selectedClass && styles.pickerDisabled]}>
              <Picker
                selectedValue={selectedExam}
                style={styles.picker}
                onValueChange={setSelectedExam}
                enabled={!!selectedClass}
              >
                <Picker.Item 
                  label={!selectedClass ? "Select a class first" : "Select Exam"} 
                  value="" 
                />
                {getFilteredExams().map(exam => (
                  <Picker.Item
                    key={exam.id}
                    label={`${exam.name} (${exam.classes?.class_name || 'Unknown Class'})`}
                    value={exam.id}
                  />
                ))}
              </Picker>
            </View>
            {selectedClass && getFilteredExams().length === 0 && (
              <Text style={styles.noExamsText}>
                ⚠️ No exams found for this class. Please create an exam first.
              </Text>
            )}
          </View>
        </View>

        {/* Summary Section */}
        {selectedClass && selectedExam && (
          <View style={styles.summarySection}>
            <View style={styles.summaryHeader}>
              <Ionicons name="analytics" size={20} color="#1976d2" />
              <Text style={styles.summaryTitle}>Summary</Text>
            </View>
            <View style={styles.summaryCards}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{students.length}</Text>
                <Text style={styles.summaryLabel}>Total Students</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{getSelectedClassDisplay()}</Text>
                <Text style={styles.summaryLabel}>Selected Class</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{getSelectedExamDisplay()}</Text>
                <Text style={styles.summaryLabel}>Selected Exam</Text>
              </View>
            </View>
          </View>
        )}

        {/* Students List */}
        {selectedClass && selectedExam && (
          <View style={styles.studentsSection}>
            <View style={styles.studentsHeader}>
              <View style={styles.studentsHeaderLeft}>
                <Ionicons name="people" size={20} color="#1976d2" />
                <Text style={styles.studentsHeaderTitle}>Students ({students.length})</Text>
              </View>
              {students.length > (isWeb ? 8 : isTablet ? 6 : 4) && (
                <View style={styles.scrollIndicator}>
                  <Ionicons 
                    name={studentsScrollY > 50 ? "arrow-up" : "arrow-down"} 
                    size={16} 
                    color={studentsScrollY > 0 ? "#1976d2" : "#666"} 
                  />
                  <Text style={[
                    styles.scrollIndicatorText,
                    studentsScrollY > 0 && styles.scrollIndicatorTextActive
                  ]}>
                    {studentsScrollY > 50 ? "Scroll to top" : "Scroll for more"}
                  </Text>
                </View>
              )}
            </View>
            
            {students.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.noDataText}>No students found</Text>
                <Text style={styles.noDataSubtext}>
                  No students are enrolled in the selected class
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.studentsScrollContainer}
                contentContainerStyle={styles.studentsScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                bounces={Platform.OS === 'ios'}
                onScroll={(event) => {
                  setStudentsScrollY(event.nativeEvent.contentOffset.y);
                }}
                scrollEventThrottle={16}
              >
                <View style={styles.studentsList}>
                  {isWeb ? (
                    // Use simple map rendering for web to avoid scroll conflicts
                    <View style={[styles.studentsGrid, dimensions.width > 1200 && styles.studentsGridWeb]}>
                      {students.map((student, index) => (
                        <View key={student.id} style={dimensions.width > 1200 ? styles.studentCardWeb : null}>
                          {renderStudent(student)}
                        </View>
                      ))}
                    </View>
                  ) : isTablet ? (
                    // Enable scrolling for tablet FlatList when inside ScrollView
                    <View style={styles.studentsGrid}>
                      {students.map((student, index) => (
                        <View 
                          key={student.id} 
                          style={[
                            styles.studentCardContainer,
                            index % 2 === 0 ? styles.studentCardLeft : styles.studentCardRight
                          ]}
                        >
                          {renderStudent(student)}
                        </View>
                      ))}
                    </View>
                  ) : (
                    students.map(renderStudent)
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* Help Section */}
        {!selectedClass || !selectedExam ? (
          <View style={styles.helpSection}>
            <View style={styles.helpCard}>
              <Ionicons name="information-circle" size={24} color="#2196F3" />
              <Text style={styles.helpTitle}>How to Generate Report Cards</Text>
              <Text style={styles.helpText}>
                1. Select a class and section from the dropdown{'\n'}
                2. Choose an exam for which you want to generate report cards{'\n'}
                3. Click on any student to view their detailed report card{'\n'}
                4. Use the download button to save the report card as PDF
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Report Card Modal */}
      {selectedStudent && (
        <ReportCardModal
          visible={reportCardVisible}
          student={selectedStudent}
          examId={selectedExam}
          onClose={closeReportCard}
        />
      )}
    </View>
  );
};

export default ReportCardGeneration;
