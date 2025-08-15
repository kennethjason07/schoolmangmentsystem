import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import GradeAnalysisModal from '../../../components/GradeAnalysisModal';
import PDFPreviewModal from '../../../components/PDFPreviewModal';
import { supabase, TABLES } from '../../../utils/supabase';
import { exportAcademicData, EXPORT_FORMATS, copyToClipboard, generateAcademicPerformancePDF, generateAcademicPerformanceHTML } from '../../../utils/exportUtils';
import { BarChart, PieChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

const { width: screenWidth } = Dimensions.get('window');

const AcademicPerformance = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marksData, setMarksData] = useState([]);
  const [examsData, setExamsData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedExam, setSelectedExam] = useState('All');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showGradeAnalysisModal, setShowGradeAnalysisModal] = useState(false);
  const [showPDFPreviewModal, setShowPDFPreviewModal] = useState(false);
  const [pdfPreviewContent, setPDFPreviewContent] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-25');
  
  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    averagePercentage: 0,
    highestScore: 0,
    lowestScore: 0,
    gradeDistribution: [],
    subjectPerformance: [],
    topPerformers: [],
    classRankings: [],
  });

  const academicYears = ['2024-25', '2023-24', '2022-23'];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAcademicData();
    }
  }, [selectedClass, selectedSubject, selectedExam, selectedAcademicYear]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClasses(),
        loadSubjects(),
        loadExams(),
      ]);
      await loadAcademicData();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .eq('academic_year', selectedAcademicYear)
        .order('class_name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadSubjects = async () => {
    try {
      let query = supabase
        .from(TABLES.SUBJECTS)
        .select('*')
        .eq('academic_year', selectedAcademicYear)
        .order('name');

      if (selectedClass !== 'All') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadExams = async () => {
    try {
      let query = supabase
        .from(TABLES.EXAMS)
        .select('*')
        .eq('academic_year', selectedAcademicYear)
        .order('start_date', { ascending: false });

      if (selectedClass !== 'All') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExamsData(data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
    }
  };

  const loadAcademicData = async () => {
    try {
      let query = supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          students(id, name, admission_no, class_id),
          exams(id, name, class_id),
          subjects(id, name)
        `);

      // Apply filters
      if (selectedExam !== 'All') {
        query = query.eq('exam_id', selectedExam);
      }
      if (selectedSubject !== 'All') {
        query = query.eq('subject_id', selectedSubject);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by class if selected
      let filteredData = data || [];
      if (selectedClass !== 'All') {
        filteredData = filteredData.filter(mark => 
          mark.students?.class_id === selectedClass
        );
      }

      setMarksData(filteredData);
      calculateStatistics(filteredData);
    } catch (error) {
      console.error('Error loading academic data:', error);
    }
  };

  const calculateStatistics = (data) => {
    if (data.length === 0) {
      setStats({
        totalStudents: 0,
        averagePercentage: 0,
        highestScore: 0,
        lowestScore: 0,
        gradeDistribution: [],
        subjectPerformance: [],
        topPerformers: [],
        classRankings: [],
      });
      return;
    }

    // Calculate basic statistics
    const totalMarks = data.reduce((sum, mark) => sum + (parseFloat(mark.marks_obtained) || 0), 0);
    const totalMaxMarks = data.reduce((sum, mark) => sum + (parseFloat(mark.max_marks) || 0), 0);
    const averagePercentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;

    const percentages = data.map(mark => 
      mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks * 100) : 0
    );
    const highestScore = Math.max(...percentages);
    const lowestScore = Math.min(...percentages);

    // Calculate grade distribution
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    data.forEach(mark => {
      const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks * 100) : 0;
      if (percentage >= 90) gradeDistribution.A++;
      else if (percentage >= 80) gradeDistribution.B++;
      else if (percentage >= 70) gradeDistribution.C++;
      else if (percentage >= 60) gradeDistribution.D++;
      else gradeDistribution.F++;
    });

    const gradeDistributionArray = Object.entries(gradeDistribution).map(([grade, count]) => ({
      name: `Grade ${grade}`,
      population: count,
      color: getGradeColor(grade),
      legendFontColor: '#333',
      legendFontSize: 12,
    }));

    // Calculate subject performance
    const subjectData = {};
    data.forEach(mark => {
      const subjectName = mark.subjects?.name || 'Unknown';
      if (!subjectData[subjectName]) {
        subjectData[subjectName] = { totalMarks: 0, totalMaxMarks: 0, count: 0 };
      }
      subjectData[subjectName].totalMarks += parseFloat(mark.marks_obtained) || 0;
      subjectData[subjectName].totalMaxMarks += parseFloat(mark.max_marks) || 0;
      subjectData[subjectName].count++;
    });

    const subjectPerformance = Object.entries(subjectData)
      .map(([subject, stats]) => ({
        subject,
        percentage: stats.totalMaxMarks > 0 ? Math.round((stats.totalMarks / stats.totalMaxMarks) * 100) : 0,
        count: stats.count
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Calculate top performers (by student)
    const studentData = {};
    data.forEach(mark => {
      const studentId = mark.students?.id;
      const studentName = mark.students?.name || 'Unknown';
      if (!studentData[studentId]) {
        studentData[studentId] = { 
          name: studentName, 
          totalMarks: 0, 
          totalMaxMarks: 0, 
          count: 0,
          admissionNo: mark.students?.admission_no
        };
      }
      studentData[studentId].totalMarks += parseFloat(mark.marks_obtained) || 0;
      studentData[studentId].totalMaxMarks += parseFloat(mark.max_marks) || 0;
      studentData[studentId].count++;
    });

    const topPerformers = Object.values(studentData)
      .map(student => ({
        ...student,
        percentage: student.totalMaxMarks > 0 ? Math.round((student.totalMarks / student.totalMaxMarks) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);

    setStats({
      totalStudents: Object.keys(studentData).length,
      averagePercentage,
      highestScore: Math.round(highestScore),
      lowestScore: Math.round(lowestScore),
      gradeDistribution: gradeDistributionArray,
      subjectPerformance,
      topPerformers,
      classRankings: [],
    });
  };

  const getGradeColor = (grade) => {
    const colors = {
      A: '#4CAF50',
      B: '#8BC34A',
      C: '#FF9800',
      D: '#FF5722',
      F: '#f44336'
    };
    return colors[grade] || '#666';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAcademicData();
    setRefreshing(false);
  };

  const handleExport = async (format) => {
    try {
      if (format === EXPORT_FORMATS.PDF) {
        // Show PDF preview instead of directly generating
        await handlePDFPreview();
        return true;
      }
      const success = await exportAcademicData(marksData, stats, format);
      return success;
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export academic performance report.');
      return false;
    }
  };

  const handlePDFPreview = async () => {
    try {
      // Generate HTML content for preview
      const htmlContent = generateAcademicPerformanceHTML(marksData, stats);
      setPDFPreviewContent(htmlContent);
      setShowExportModal(false);
      setShowPDFPreviewModal(true);
    } catch (error) {
      console.error('PDF preview error:', error);
      Alert.alert('Preview Error', 'Failed to generate PDF preview.');
    }
  };

  const handleGeneratePDFFromPreview = async () => {
    setIsGeneratingPDF(true);
    try {
      const success = await generateAcademicPerformancePDF(marksData, stats);
      if (success) {
        setShowPDFPreviewModal(false);
        setPDFPreviewContent('');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Generation Error', 'Failed to generate PDF report.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleGradeAnalysis = () => {
    if (stats.gradeDistribution.length === 0) {
      Alert.alert(
        'No Data Available',
        'No grade data available for analysis. Please check your filters.',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowGradeAnalysisModal(true);
  };

  const handleCopyGradeAnalysis = async () => {
    const totalStudents = stats.gradeDistribution.reduce((sum, grade) => sum + grade.population, 0);
    const gradeAnalysisText = stats.gradeDistribution
      .map(grade => {
        const percentage = totalStudents > 0 ? Math.round((grade.population / totalStudents) * 100) : 0;
        return `${grade.name}: ${grade.population} students (${percentage}%)`;
      })
      .join('\n');

    const analysisMessage = `Grade Distribution Analysis:\n\n${gradeAnalysisText}\n\nTotal Students: ${totalStudents}\nAverage Performance: ${stats.averagePercentage}%\nHighest Score: ${stats.highestScore}%\nLowest Score: ${stats.lowestScore}%`;
    
    await copyAnalysisToClipboard(analysisMessage);
    setShowGradeAnalysisModal(false);
  };

  const copyAnalysisToClipboard = async (text) => {
    try {
      await copyToClipboard(text, 'Grade Analysis');
    } catch (error) {
      console.error('Failed to copy analysis:', error);
    }
  };

  const renderTopPerformer = ({ item, index }) => (
    <View style={styles.performerCard}>
      <View style={styles.rankContainer}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
      <View style={styles.performerInfo}>
        <Text style={styles.performerName}>{item.name}</Text>
        <Text style={styles.performerDetails}>
          #{item.admissionNo} • {item.count} subjects
        </Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={[styles.scoreText, { color: getScoreColor(item.percentage) }]}>
          {item.percentage}%
        </Text>
      </View>
    </View>
  );

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return '#4CAF50';
    if (percentage >= 80) return '#8BC34A';
    if (percentage >= 70) return '#FF9800';
    if (percentage >= 60) return '#FF5722';
    return '#f44336';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Academic Performance" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading academic data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Academic Performance" showBack={true} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filters</Text>
          
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Academic Year</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedAcademicYear}
                  onValueChange={setSelectedAcademicYear}
                  style={styles.picker}
                >
                  {academicYears.map((year) => (
                    <Picker.Item key={year} label={year} value={year} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Class</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={setSelectedClass}
                  style={styles.picker}
                >
                  <Picker.Item label="All Classes" value="All" />
                  {classes.map((cls) => (
                    <Picker.Item
                      key={cls.id}
                      label={`${cls.class_name} ${cls.section}`}
                      value={cls.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Subject</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedSubject}
                  onValueChange={setSelectedSubject}
                  style={styles.picker}
                >
                  <Picker.Item label="All Subjects" value="All" />
                  {subjects.map((subject) => (
                    <Picker.Item
                      key={subject.id}
                      label={subject.name}
                      value={subject.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Exam</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedExam}
                  onValueChange={setSelectedExam}
                  style={styles.picker}
                >
                  <Picker.Item label="All Exams" value="All" />
                  {examsData.map((exam) => (
                    <Picker.Item
                      key={exam.id}
                      label={exam.name}
                      value={exam.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="trending-up" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.averagePercentage}%</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="trophy" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.highestScore}%</Text>
              <Text style={styles.statLabel}>Highest</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#f44336' }]}>
                <Ionicons name="trending-down" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.lowestScore}%</Text>
              <Text style={styles.statLabel}>Lowest</Text>
            </View>
          </View>
        </View>

        {/* Grade Distribution Chart */}
        {stats.gradeDistribution.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Grade Distribution</Text>
            <PieChart
              data={stats.gradeDistribution}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 10]}
              absolute
            />
          </View>
        )}

        {/* Subject Performance Chart */}
        {stats.subjectPerformance.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Subject-wise Performance</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: stats.subjectPerformance.map(item =>
                    item.subject.length > 8 ? item.subject.substring(0, 8) + '...' : item.subject
                  ),
                  datasets: [{
                    data: stats.subjectPerformance.map(item => item.percentage),
                  }]
                }}
                width={Math.max(screenWidth - 40, stats.subjectPerformance.length * 80)}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  barPercentage: 0.7,
                }}
                style={styles.chart}
                showValuesOnTopOfBars={true}
              />
            </ScrollView>
          </View>
        )}

        {/* Top Performers */}
        <View style={styles.performersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Performers</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#2196F3" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={stats.topPerformers.slice(0, 5)}
            keyExtractor={(item, index) => `performer-${index}`}
            renderItem={renderTopPerformer}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="school-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No performance data found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your filters
                </Text>
              </View>
            }
          />
        </View>

        {/* Subject Performance Details */}
        {stats.subjectPerformance.length > 0 && (
          <View style={styles.subjectSection}>
            <Text style={styles.sectionTitle}>Subject Performance Details</Text>
            {stats.subjectPerformance.map((item, index) => (
              <View key={index} style={styles.subjectCard}>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{item.subject}</Text>
                  <Text style={styles.subjectStats}>
                    {item.count} students evaluated
                  </Text>
                </View>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${item.percentage}%`,
                          backgroundColor: getScoreColor(item.percentage)
                        }
                      ]}
                    />
                  </View>
                  <Text style={[
                    styles.percentageText,
                    { color: getScoreColor(item.percentage) }
                  ]}>
                    {item.percentage}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Export Section */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="document-text" size={20} color="#2196F3" />
              <Text style={styles.exportButtonText}>Performance Report</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.exportButton}
              onPress={handleGradeAnalysis}
            >
              <Ionicons name="bar-chart" size={20} color="#4CAF50" />
              <Text style={styles.exportButtonText}>Grade Analysis</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportButton}>
              <Ionicons name="trophy" size={20} color="#FF9800" />
              <Text style={styles.exportButtonText}>Top Performers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Academic Performance Report"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.PDF, EXPORT_FORMATS.CLIPBOARD]}
      />

      {/* Grade Analysis Modal */}
      <GradeAnalysisModal
        visible={showGradeAnalysisModal}
        onClose={() => setShowGradeAnalysisModal(false)}
        stats={stats}
        onCopyAnalysis={handleCopyGradeAnalysis}
      />

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        visible={showPDFPreviewModal}
        onClose={() => {
          setShowPDFPreviewModal(false);
          setPDFPreviewContent('');
        }}
        onDownload={handleGeneratePDFFromPreview}
        data={marksData}
        stats={stats}
        title="Academic Performance Report Preview"
      />
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
  },
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

  // Filters Section
  filtersSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  picker: {
    height: 50,
    color: '#333',
  },

  // Statistics Section
  statsSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Chart Section
  chartSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },

  // Performers Section
  performersSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2196F3',
    marginRight: 4,
  },
  performerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  rankContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  performerDetails: {
    fontSize: 12,
    color: '#666',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Subject Section
  subjectSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  subjectStats: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },

  // Export Section
  exportSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 80,
    padding: 16,
    paddingBottom: 32,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  exportButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    minWidth: '30%',
  },
  exportButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default AcademicPerformance;
