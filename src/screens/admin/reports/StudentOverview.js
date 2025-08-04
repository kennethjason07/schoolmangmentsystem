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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import ExportModal from '../../../components/ExportModal';
import { supabase, TABLES } from '../../../utils/supabase';
import { exportStudentData, EXPORT_FORMATS } from '../../../utils/exportUtils';
import { PieChart, BarChart } from 'react-native-chart-kit';

const { width: screenWidth } = Dimensions.get('window');

const StudentOverview = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentsData, setStudentsData] = useState([]);
  const [classes, setClasses] = useState([]);
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2024-25');
  const [selectedGender, setSelectedGender] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    maleStudents: 0,
    femaleStudents: 0,
    averageAge: 0,
    genderDistribution: [],
    classDistribution: [],
    ageDistribution: [],
    religionDistribution: [],
    casteDistribution: [],
    enrollmentTrend: [],
    recentEnrollments: [],
  });

  const academicYears = ['2024-25', '2023-24', '2022-23'];
  const genders = ['All', 'Male', 'Female'];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadStudentData();
    }
  }, [selectedClass, selectedAcademicYear, selectedGender]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadClasses(),
      ]);
      await loadStudentData();
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

  const loadStudentData = async () => {
    try {
      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('academic_year', selectedAcademicYear)
        .order('created_at', { ascending: false });

      // Apply filters
      if (selectedClass !== 'All') {
        query = query.eq('class_id', selectedClass);
      }
      if (selectedGender !== 'All') {
        query = query.eq('gender', selectedGender);
      }

      const { data, error } = await query;
      if (error) throw error;

      setStudentsData(data || []);
      calculateStatistics(data || []);
    } catch (error) {
      console.error('Error loading student data:', error);
    }
  };

  const calculateStatistics = (data) => {
    const totalStudents = data.length;
    const maleStudents = data.filter(student => student.gender === 'Male').length;
    const femaleStudents = data.filter(student => student.gender === 'Female').length;

    // Calculate average age
    const currentYear = new Date().getFullYear();
    const ages = data.map(student => {
      const birthYear = new Date(student.dob).getFullYear();
      return currentYear - birthYear;
    }).filter(age => age > 0 && age < 25); // Filter reasonable ages

    const averageAge = ages.length > 0 ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0;

    // Gender distribution for pie chart
    const genderDistribution = [
      {
        name: 'Male',
        population: maleStudents,
        color: '#2196F3',
        legendFontColor: '#333',
        legendFontSize: 12,
      },
      {
        name: 'Female',
        population: femaleStudents,
        color: '#E91E63',
        legendFontColor: '#333',
        legendFontSize: 12,
      }
    ].filter(item => item.population > 0);

    // Class distribution
    const classData = {};
    data.forEach(student => {
      const className = `${student.classes?.class_name} ${student.classes?.section}`;
      classData[className] = (classData[className] || 0) + 1;
    });

    const classDistribution = Object.entries(classData)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count);

    // Age distribution
    const ageGroups = {
      '5-8': 0,
      '9-12': 0,
      '13-16': 0,
      '17+': 0
    };

    ages.forEach(age => {
      if (age >= 5 && age <= 8) ageGroups['5-8']++;
      else if (age >= 9 && age <= 12) ageGroups['9-12']++;
      else if (age >= 13 && age <= 16) ageGroups['13-16']++;
      else if (age >= 17) ageGroups['17+']++;
    });

    const ageDistribution = Object.entries(ageGroups)
      .map(([ageGroup, count]) => ({ ageGroup, count }))
      .filter(item => item.count > 0);

    // Religion distribution
    const religionData = {};
    data.forEach(student => {
      const religion = student.religion || 'Not Specified';
      religionData[religion] = (religionData[religion] || 0) + 1;
    });

    const religionDistribution = Object.entries(religionData)
      .map(([religion, count]) => ({
        name: religion,
        population: count,
        color: getReligionColor(religion),
        legendFontColor: '#333',
        legendFontSize: 12,
      }))
      .sort((a, b) => b.population - a.population)
      .slice(0, 5); // Top 5 religions

    // Caste distribution
    const casteData = {};
    data.forEach(student => {
      const caste = student.caste || 'Not Specified';
      casteData[caste] = (casteData[caste] || 0) + 1;
    });

    const casteDistribution = Object.entries(casteData)
      .map(([caste, count]) => ({ caste, count }))
      .sort((a, b) => b.count - a.count);

    // Enrollment trend (last 6 months)
    const enrollmentData = {};
    data.forEach(student => {
      const month = new Date(student.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      enrollmentData[month] = (enrollmentData[month] || 0) + 1;
    });

    const enrollmentTrend = Object.entries(enrollmentData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => new Date(`1 ${a.month}`) - new Date(`1 ${b.month}`))
      .slice(-6); // Last 6 months

    setStats({
      totalStudents,
      maleStudents,
      femaleStudents,
      averageAge,
      genderDistribution,
      classDistribution,
      ageDistribution,
      religionDistribution,
      casteDistribution,
      enrollmentTrend,
      recentEnrollments: data.slice(0, 10),
    });
  };

  const getReligionColor = (religion) => {
    const colors = {
      'Hindu': '#FF9800',
      'Muslim': '#4CAF50',
      'Christian': '#2196F3',
      'Sikh': '#9C27B0',
      'Buddhist': '#795548',
      'Jain': '#607D8B',
      'Not Specified': '#666'
    };
    return colors[religion] || '#666';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudentData();
    setRefreshing(false);
  };

  const handleExport = async (format) => {
    try {
      const success = await exportStudentData(studentsData, stats, format);
      return success;
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', 'Failed to export student overview report.');
      return false;
    }
  };

  const renderStudentCard = ({ item }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={20} color="#2196F3" />
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentId}>#{item.admission_no}</Text>
          <Text style={styles.classInfo}>
            {item.classes?.class_name} {item.classes?.section}
          </Text>
        </View>
      </View>
      <View style={styles.studentMeta}>
        <View style={[styles.genderBadge, { backgroundColor: item.gender === 'Male' ? '#2196F3' : '#E91E63' }]}>
          <Text style={styles.genderText}>{item.gender}</Text>
        </View>
        <Text style={styles.enrollmentDate}>
          Enrolled: {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Student Overview" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading student data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Student Overview" showBack={true} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by student name or admission number"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

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

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Gender</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedGender}
                  onValueChange={setSelectedGender}
                  style={styles.picker}
                >
                  {genders.map((gender) => (
                    <Picker.Item key={gender} label={gender} value={gender} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Student Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="male" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.maleStudents}</Text>
              <Text style={styles.statLabel}>Male</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E91E63' }]}>
                <Ionicons name="female" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.femaleStudents}</Text>
              <Text style={styles.statLabel}>Female</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FF9800' }]}>
                <Ionicons name="calendar" size={24} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.averageAge}</Text>
              <Text style={styles.statLabel}>Avg Age</Text>
            </View>
          </View>
        </View>

        {/* Gender Distribution Chart */}
        {stats.genderDistribution.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Gender Distribution</Text>
            <PieChart
              data={stats.genderDistribution}
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

        {/* Class Distribution Chart */}
        {stats.classDistribution.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Class-wise Distribution</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: stats.classDistribution.map(item =>
                    item.className.length > 8 ? item.className.substring(0, 8) + '...' : item.className
                  ),
                  datasets: [{
                    data: stats.classDistribution.map(item => item.count),
                  }]
                }}
                width={Math.max(screenWidth - 40, stats.classDistribution.length * 80)}
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

        {/* Age Distribution */}
        {stats.ageDistribution.length > 0 && (
          <View style={styles.distributionSection}>
            <Text style={styles.sectionTitle}>Age Distribution</Text>
            {stats.ageDistribution.map((item, index) => (
              <View key={index} style={styles.distributionCard}>
                <View style={styles.distributionInfo}>
                  <Text style={styles.distributionLabel}>{item.ageGroup} years</Text>
                </View>
                <View style={styles.distributionValue}>
                  <Text style={styles.distributionCount}>{item.count} students</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Religion Distribution */}
        {stats.religionDistribution.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Religion Distribution</Text>
            <PieChart
              data={stats.religionDistribution}
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

        {/* Caste Distribution */}
        {stats.casteDistribution.length > 0 && (
          <View style={styles.distributionSection}>
            <Text style={styles.sectionTitle}>Caste Distribution</Text>
            {stats.casteDistribution.map((item, index) => (
              <View key={index} style={styles.distributionCard}>
                <View style={styles.distributionInfo}>
                  <Text style={styles.distributionLabel}>{item.caste}</Text>
                </View>
                <View style={styles.distributionValue}>
                  <Text style={styles.distributionCount}>{item.count} students</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Enrollment Trend */}
        {stats.enrollmentTrend.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Enrollment Trend (Last 6 Months)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: stats.enrollmentTrend.map(item => item.month),
                  datasets: [{
                    data: stats.enrollmentTrend.map(item => item.count),
                  }]
                }}
                width={Math.max(screenWidth - 40, stats.enrollmentTrend.length * 80)}
                height={220}
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
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

        {/* Recent Enrollments */}
        <View style={styles.studentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Enrollments</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#2196F3" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={stats.recentEnrollments.slice(0, 5)}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderStudentCard}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No students found</Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your filters
                </Text>
              </View>
            }
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="person-add" size={20} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Add Student</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowExportModal(true)}
            >
              <Ionicons name="document-text" size={20} color="#2196F3" />
              <Text style={styles.actionButtonText}>Export List</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="stats-chart" size={20} color="#FF9800" />
              <Text style={styles.actionButtonText}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Student Overview Report"
        availableFormats={[EXPORT_FORMATS.CSV, EXPORT_FORMATS.JSON, EXPORT_FORMATS.CLIPBOARD]}
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

  // Search Section
  searchSection: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },

  // Filters Section
  filtersSection: {
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

  // Distribution Section
  distributionSection: {
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
  distributionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  distributionInfo: {
    flex: 1,
  },
  distributionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  distributionValue: {
    alignItems: 'flex-end',
  },
  distributionCount: {
    fontSize: 14,
    color: '#666',
  },
  // Students Section
  studentsSection: {
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

  // Student Card
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  classInfo: {
    fontSize: 12,
    color: '#2196F3',
  },
  studentMeta: {
    alignItems: 'flex-end',
  },
  genderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  genderText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  enrollmentDate: {
    fontSize: 10,
    color: '#666',
  },

  // Actions Section
  actionsSection: {
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  actionButton: {
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
  actionButtonText: {
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

export default StudentOverview;
