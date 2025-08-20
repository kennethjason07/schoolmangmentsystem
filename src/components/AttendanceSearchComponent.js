import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dbHelpers } from '../utils/supabase';

const AttendanceSearchComponent = () => {
  const [searchCriteria, setSearchCriteria] = useState({
    studentName: '',
    fatherName: '',
    className: '',
    section: '',
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [attendanceResults, setAttendanceResults] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [searchType, setSearchType] = useState('attendance'); // 'attendance' or 'students'

  const handleInputChange = (field, value) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const searchAttendance = async () => {
    try {
      setLoading(true);
      console.log('Searching attendance with criteria:', searchCriteria);

      const result = await dbHelpers.getAttendanceByStudentDetails(searchCriteria, {
        includeStudentDetails: true,
        includeClassDetails: true,
        includeParentDetails: true,
        orderBy: 'date',
        orderDirection: 'desc'
      });

      if (result.error) {
        Alert.alert('Error', `Failed to search attendance: ${result.error.message}`);
        return;
      }

      setAttendanceResults(result.data || []);
      Alert.alert('Success', `Found ${result.totalCount} attendance records`);
    } catch (error) {
      console.error('Error searching attendance:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchStudents = async () => {
    try {
      setLoading(true);
      console.log('Searching students with criteria:', searchCriteria);

      const result = await dbHelpers.searchStudentsByNameAndFather(searchCriteria);

      if (result.error) {
        Alert.alert('Error', `Failed to search students: ${result.error.message}`);
        return;
      }

      setStudentResults(result.data || []);
      Alert.alert('Success', `Found ${result.totalCount} students`);
    } catch (error) {
      console.error('Error searching students:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      if (studentResults.length === 0) {
        Alert.alert('No Students', 'Please search for students first');
        return;
      }

      setLoading(true);
      const studentIds = studentResults.map(student => student.id);

      const result = await dbHelpers.getDetailedAttendanceReport(studentIds, {
        startDate: searchCriteria.startDate || null,
        endDate: searchCriteria.endDate || null,
        includeStats: true
      });

      if (result.error) {
        Alert.alert('Error', `Failed to generate report: ${result.error.message}`);
        return;
      }

      console.log('Generated report:', result);
      Alert.alert('Success', `Report generated with ${result.summary.total_records} records`);
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchCriteria({
      studentName: '',
      fatherName: '',
      className: '',
      section: '',
      startDate: '',
      endDate: ''
    });
    setAttendanceResults([]);
    setStudentResults([]);
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.resultItem}>
      <View style={styles.resultHeader}>
        <Text style={styles.studentName}>{item.students?.name || 'Unknown Student'}</Text>
        <View style={[styles.statusBadge, item.status === 'Present' ? styles.presentBadge : styles.absentBadge]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.resultText}>Date: {item.date}</Text>
      <Text style={styles.resultText}>Class: {item.classes?.class_name} {item.classes?.section}</Text>
      <Text style={styles.resultText}>Roll No: {item.students?.roll_no}</Text>
      {item.father_name && (
        <Text style={styles.resultText}>Father: {item.father_name}</Text>
      )}
    </View>
  );

  const renderStudentItem = ({ item }) => (
    <View style={styles.resultItem}>
      <View style={styles.resultHeader}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.admissionNo}>{item.admission_no}</Text>
      </View>
      <Text style={styles.resultText}>Class: {item.classes?.class_name} {item.classes?.section}</Text>
      <Text style={styles.resultText}>Roll No: {item.roll_no}</Text>
      <Text style={styles.resultText}>Gender: {item.gender}</Text>
      {item.father_name && (
        <Text style={styles.resultText}>Father: {item.father_name}</Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Search</Text>
        <Text style={styles.subtitle}>Search by student name, father's name, and class</Text>
      </View>

      {/* View Mode Toggle - Calendar and Summary */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, searchType === 'attendance' && styles.activeViewModeButton]}
          onPress={() => setSearchType('attendance')}
        >
          <Ionicons name="calendar" size={20} color={searchType === 'attendance' ? '#fff' : '#666'} />
          <Text style={[styles.viewModeButtonText, searchType === 'attendance' && styles.activeViewModeText]}>
            Calendar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, searchType === 'students' && styles.activeViewModeButton]}
          onPress={() => setSearchType('students')}
        >
          <Ionicons name="stats-chart" size={20} color={searchType === 'students' ? '#fff' : '#666'} />
          <Text style={[styles.viewModeButtonText, searchType === 'students' && styles.activeViewModeText]}>
            Summary
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Form */}
      <View style={styles.searchForm}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Student Name</Text>
          <TextInput
            style={styles.input}
            value={searchCriteria.studentName}
            onChangeText={(value) => handleInputChange('studentName', value)}
            placeholder="Enter student name..."
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Father's Name</Text>
          <TextInput
            style={styles.input}
            value={searchCriteria.fatherName}
            onChangeText={(value) => handleInputChange('fatherName', value)}
            placeholder="Enter father's name..."
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Class Name</Text>
            <TextInput
              style={styles.input}
              value={searchCriteria.className}
              onChangeText={(value) => handleInputChange('className', value)}
              placeholder="e.g., 10, XII"
              placeholderTextColor="#999"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Section</Text>
            <TextInput
              style={styles.input}
              value={searchCriteria.section}
              onChangeText={(value) => handleInputChange('section', value)}
              placeholder="e.g., A, B"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {searchType === 'attendance' && (
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput
                style={styles.input}
                value={searchCriteria.startDate}
                onChangeText={(value) => handleInputChange('startDate', value)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.input}
                value={searchCriteria.endDate}
                onChangeText={(value) => handleInputChange('endDate', value)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={searchType === 'attendance' ? searchAttendance : searchStudents}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="#fff" />
                <Text style={styles.buttonText}>Search</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <Ionicons name="close" size={20} color="#666" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Report Button for Students */}
        {searchType === 'students' && studentResults.length > 0 && (
          <TouchableOpacity style={styles.reportButton} onPress={generateReport} disabled={loading}>
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.buttonText}>Generate Attendance Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      <View style={styles.resultsContainer}>
        {searchType === 'attendance' && attendanceResults.length > 0 && (
          <>
            <Text style={styles.resultsTitle}>Attendance Records ({attendanceResults.length})</Text>
            <FlatList
              data={attendanceResults}
              keyExtractor={(item) => `${item.id}-${item.date}`}
              renderItem={renderAttendanceItem}
              scrollEnabled={false}
            />
          </>
        )}

        {searchType === 'students' && studentResults.length > 0 && (
          <>
            <Text style={styles.resultsTitle}>Students Found ({studentResults.length})</Text>
            <FlatList
              data={studentResults}
              keyExtractor={(item) => item.id}
              renderItem={renderStudentItem}
              scrollEnabled={false}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  viewModeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 8,
  },
  activeViewModeButton: {
    backgroundColor: '#007bff',
    elevation: 3,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  viewModeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  activeViewModeText: {
    color: '#fff',
    fontWeight: '700',
  },
  searchForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  searchButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  clearButton: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  reportButton: {
    flexDirection: 'row',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  resultItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  admissionNo: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  presentBadge: {
    backgroundColor: '#d4edda',
  },
  absentBadge: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});

export default AttendanceSearchComponent;
