import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Platform, Alert, ActivityIndicator, Share } from 'react-native';
import Header from '../../components/Header';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import { supabase, dbHelpers } from '../../utils/supabase';
import CrossPlatformPieChart from '../../components/CrossPlatformPieChart';

const MarksManagement = () => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [examTypes, setExamTypes] = useState(['Unit Test', 'Term Exam', 'Final Exam']);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedExamType, setSelectedExamType] = useState('Unit Test');
  const [examDate, setExamDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [marks, setMarks] = useState({});
  const [editMode, setEditMode] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [marksHistory, setMarksHistory] = useState([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedSection && selectedSubject && examDate) {
      loadMarks();
      loadMarksHistory();
    }
  }, [selectedClass, selectedSection, selectedSubject, examDate]);

  const loadAllData = async () => {
    try {
      // Load classes
      const { data: classData, error: classError } = await dbHelpers.getClasses();
      if (classError) throw classError;
      setClasses(classData);

      // Extract unique sections from classData
      const uniqueSections = [...new Set(classData.map(cls => cls.section))];
      setSections(uniqueSections.map(s => ({ id: s, section_name: s }))); // Format for Picker

      // Load subjects
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('*');
      if (subjectError) throw subjectError;
      setSubjects(subjectData);

      // Load students (initially empty)
      setStudents([]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMarksHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('marks')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('exam_type', selectedExamType)
        .order('exam_date', { ascending: true });

      if (error) throw error;
      setMarksHistory(data || []);
    } catch (error) {
      console.error('Error loading marks history:', error);
    }
  };

  const loadStudents = async (classId, section) => {
    try {
      const { data, error } = await dbHelpers.getStudentsByClass(classId, section);
      if (error) throw error;
      setStudents(data);
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students');
    }
  };

  // Format date as dd-mm-yyyy
  const formatDateDMY = (date) => {
    if (!date) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  const handleSaveMarks = async () => {
    try {
      const examDateStr = formatDateDMY(examDate);
      
      // Validate marks
      const maxMarks = 100; // Default max marks
      const invalidMarks = Object.entries(marks).some(([_, mark]) => {
        const num = parseInt(mark);
        return isNaN(num) || num < 0 || num > maxMarks;
      });

      if (invalidMarks) {
        Alert.alert('Error', `Marks should be between 0 and ${maxMarks}`);
        return;
      }

      // Delete existing marks for this class/subject/date
      await supabase
        .from('marks')
        .delete()
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('exam_date', examDateStr);

      // Insert new marks
      const records = Object.entries(marks).map(([studentId, mark]) => ({
        class_id: selectedClass,
        student_id: studentId,
        subject_id: selectedSubject,
        exam_date: examDateStr,
        mark: parseInt(mark),
        exam_type: selectedExamType
      }));

      await supabase
        .from('marks')
        .insert(records);

      Alert.alert('Success', 'Marks saved successfully!');
      setEditMode({});
    } catch (error) {
      console.error('Error saving marks:', error);
      Alert.alert('Error', 'Failed to save marks');
    }
  };

  const exportMarks = async () => {
    try {
      const html = `
        <h2 style="text-align:center;">${selectedSubject} Marks - ${selectedExamType}</h2>
        <h3 style="text-align:center;">Class: ${classes.find(c => c.id === selectedClass)?.class_name} - ${selectedSection}</h3>
        <h3 style="text-align:center;">Exam Date: ${formatDateDMY(examDate)}</h3>
        <table border="1" style="border-collapse:collapse;width:100%;margin-top:20px;">
          <tr>
            <th style="text-align:center;padding:8px;">Roll No</th>
            <th style="text-align:center;padding:8px;">Student Name</th>
            <th style="text-align:center;padding:8px;">Marks</th>
            <th style="text-align:center;padding:8px;">Grade</th>
          </tr>
          ${students
            .map(student => {
              const mark = marks[student.id] || 0;
              const grade = calculateGrade(parseInt(mark));
              return `
                <tr>
                  <td style="text-align:center;padding:8px;">${student.roll_no}</td>
                  <td style="text-align:center;padding:8px;">${student.name}</td>
                  <td style="text-align:center;padding:8px;">${mark}</td>
                  <td style="text-align:center;padding:8px;">${grade}</td>
                </tr>
              `;
            })
            .join('')}
        </table>
      `;

      await Print.printAsync({ html });
    } catch (error) {
      console.error('Error exporting marks:', error);
      Alert.alert('Error', 'Failed to export marks');
    }
  };

  const calculateGrade = (marks) => {
    if (marks >= 90) return 'A+';
    if (marks >= 80) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 50) return 'D';
    return 'F';
  };

  const calculateStatistics = () => {
    const validMarks = Object.values(marks).filter(mark => mark && !isNaN(parseInt(mark)));
    if (validMarks.length === 0) return null;

    const marksNum = validMarks.map(mark => parseInt(mark));
    const total = marksNum.reduce((a, b) => a + b, 0);
    const average = (total / marksNum.length).toFixed(2);
    const highest = Math.max(...marksNum);
    const lowest = Math.min(...marksNum);

    return {
      average,
      highest,
      lowest,
      totalStudents: marksNum.length
    };
  };

  const loadMarks = async () => {
    try {
      const examDateStr = formatDateDMY(examDate);
      const { data, error } = await supabase
        .from('marks')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('exam_date', examDateStr);

      if (error) throw error;
      
      const marksData = {};
      data.forEach(record => {
        marksData[record.student_id] = record.mark;
      });
      setMarks(marksData);
    } catch (error) {
      console.error('Error loading marks:', error);
      Alert.alert('Error', 'Failed to load marks');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Marks Management" showBack={true} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Picker
                selectedValue={selectedClass}
                onValueChange={(itemValue) => {
                  setSelectedClass(itemValue);
                  setSelectedSection(null);
                  setSelectedSubject(null);
                  setStudents([]);
                  setMarks({});
                }}
              >
                <Picker.Item label="Select Class" value="" />
                {classes.map(cls => (
                  <Picker.Item key={cls.id} label={cls.class_name} value={cls.id} />
                ))}
              </Picker>
            </View>
            <View style={styles.filterItem}>
              <Picker
                selectedValue={selectedSection}
                onValueChange={(itemValue) => {
                  setSelectedSection(itemValue);
                  setSelectedSubject(null);
                  loadStudents(selectedClass, itemValue);
                  setMarks({});
                }}
                enabled={!!selectedClass}
              >
                <Picker.Item label="Select Section" value={null} />
                {sections.map(section => (
                  <Picker.Item key={section} label={section} value={section} />
                ))}
              </Picker>
            </View>
            <View style={styles.filterItem}>
              <Picker
                selectedValue={selectedSubject}
                onValueChange={(itemValue) => {
                  setSelectedSubject(itemValue);
                  setMarks({});
                }}
                enabled={!!selectedClass && !!selectedSection}
              >
                <Picker.Item label="Select Subject" value="" />
                {subjects.map(subject => (
                  <Picker.Item key={subject.id} label={subject.name} value={subject.id} />
                ))}
              </Picker>
            </View>
            <View style={styles.filterItem}>
              <Picker
                selectedValue={selectedExamType}
                onValueChange={(itemValue) => {
                  setSelectedExamType(itemValue);
                  setMarks({});
                }}
              >
                {examTypes.map(type => (
                  <Picker.Item key={type} label={type} value={type} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.datePickerContainer}>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.datePickerButtonText}>
                {examDate ? formatDateDMY(examDate) : 'Select Exam Date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={examDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setExamDate(selectedDate);
                  }
                }}
              />
            )}
          </View>
        </View>

        {selectedClass && selectedSection && selectedSubject && students.length > 0 && (
          <>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSaveMarks}
              >
                <Text style={styles.buttonText}>Save Marks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowAnalysis(!showAnalysis)}
              >
                <Text style={styles.buttonText}>{showAnalysis ? 'Hide Analysis' : 'Show Analysis'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowExportModal(true)}
              >
                <Text style={styles.buttonText}>Export Marks</Text>
              </TouchableOpacity>
            </View>

            {showAnalysis && (
              <View style={styles.analysisContainer}>
                <Text style={styles.analysisTitle}>Marks Analysis</Text>
                {calculateStatistics() && (
                  <View style={styles.statsContainer}>
                    <Text style={styles.statItem}>Average: {calculateStatistics().average}</Text>
                    <Text style={styles.statItem}>Highest: {calculateStatistics().highest}</Text>
                    <Text style={styles.statItem}>Lowest: {calculateStatistics().lowest}</Text>
                    <Text style={styles.statItem}>Total Students: {calculateStatistics().totalStudents}</Text>
                  </View>
                )}
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Grade Distribution</Text>
                  <CrossPlatformPieChart
                    data={[
                      { name: 'A+', population: Object.values(marks).filter(m => calculateGrade(parseInt(m)) === 'A+').length, color: '#4CAF50' },
                      { name: 'A', population: Object.values(marks).filter(m => calculateGrade(parseInt(m)) === 'A').length, color: '#43A047' },
                      { name: 'B', population: Object.values(marks).filter(m => calculateGrade(parseInt(m)) === 'B').length, color: '#66BB6A' },
                      { name: 'C', population: Object.values(marks).filter(m => calculateGrade(parseInt(m)) === 'C').length, color: '#81C784' },
                      { name: 'D', population: Object.values(marks).filter(m => calculateGrade(parseInt(m)) === 'D').length, color: '#A5D6A7' },
                      { name: 'F', population: Object.values(marks).filter(m => calculateGrade(parseInt(m)) === 'F').length, color: '#FFCDD2' },
                    ]}
                    width={300}
                    height={200}
                    chartConfig={{
                      backgroundColor: '#fff',
                      backgroundGradientFrom: '#fff',
                      backgroundGradientTo: '#fff',
                      color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              </View>
            )}

            <View style={styles.marksContainer}>
              {students.map(student => (
                <View key={student.id} style={styles.studentRow}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <View style={styles.markInputContainer}>
                    <TextInput
                      style={styles.markInput}
                      keyboardType="numeric"
                      value={marks[student.id] || ''}
                      onChangeText={(text) => {
                        const value = text.replace(/[^0-9]/g, '');
                        setMarks({ ...marks, [student.id]: value });
                        setEditMode({ ...editMode, [student.id]: true });
                      }}
                      placeholder="Enter marks"
                      editable={editMode[student.id]}
                    />
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setEditMode({ ...editMode, [student.id]: true })}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Options</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                exportMarks();
                setShowExportModal(false);
              }}
            >
              <Text style={styles.modalButtonText}>Export to PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                // TODO: Add Excel export functionality
                Alert.alert('Coming Soon', 'Excel export will be available in future updates');
                setShowExportModal(false);
              }}
            >
              <Text style={styles.modalButtonText}>Export to Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  filterContainer: {
    padding: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterItem: {
    flex: 1,
    marginRight: 8,
  },
  datePickerContainer: {
    marginBottom: 24,
  },
  datePickerButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  datePickerButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  analysisContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statItem: {
    fontSize: 16,
    marginBottom: 8,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  marksContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  studentName: {
    flex: 1,
    fontSize: 16,
  },
  markInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 8,
    padding: 8,
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#2196F3',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default MarksManagement;
