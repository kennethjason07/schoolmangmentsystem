import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

export default function MarksEntryStudentsScreen({ navigation, route }) {
  const { subject, subjectId } = route.params;
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Fetch students for the selected subject
  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get teacher info using the helper function
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) throw new Error('Teacher not found');

      // Get classes and sections where teacher teaches this subject
      const { data: teacherAssignments, error: assignmentsError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('teacher_id', teacherData.id)
        .eq('subject_id', subjectId);

      if (assignmentsError) throw assignmentsError;

      if (!teacherAssignments || teacherAssignments.length === 0) {
        setStudents([]);
        return;
      }

      // Get all students from assigned classes
      const studentPromises = teacherAssignments.map(assignment => 
        supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no,
            classes(class_name, section)
          `)
          .eq('class_id', assignment.classes.id)
          .order('roll_no')
      );

      const studentResults = await Promise.all(studentPromises);
      const allStudents = [];

      studentResults.forEach((result, index) => {
        if (result.data) {
          const classSection = `${teacherAssignments[index].classes.class_name} - ${teacherAssignments[index].classes.section}`;
          result.data.forEach(student => {
            allStudents.push({
              ...student,
              classSection
            });
          });
        }
      });

      setStudents(allStudents);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing marks for the subject
  const fetchExistingMarks = async () => {
    if (!subjectId || students.length === 0) return;

    try {
      const { data: existingMarks, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select('*')
        .eq('subject_id', subjectId)
        .in('student_id', students.map(s => s.id));

      if (marksError) throw marksError;

      const marksMap = {};
      existingMarks.forEach(mark => {
        marksMap[mark.student_id] = mark.marks_obtained.toString();
      });

      setMarks(marksMap);

    } catch (err) {
      console.error('Error fetching existing marks:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [subjectId]);

  useEffect(() => {
    if (students.length > 0) {
      fetchExistingMarks();
    }
  }, [students, subjectId]);

  function handleMarkChange(studentId, value) {
    if (!/^\d*$/.test(value)) return;
    if (value && (parseInt(value) < 0 || parseInt(value) > 100)) return;
    setMarks(m => ({ ...m, [studentId]: value }));
  }

  async function handleSave() {
    try {
      setSaving(true);

      // Validate all marks are entered
      for (let student of students) {
        if (!marks[student.id] || marks[student.id].trim() === '') {
          Alert.alert('Validation Error', `Please enter marks for ${student.name}`);
          return;
        }
        const markValue = parseInt(marks[student.id]);
        if (isNaN(markValue) || markValue < 0 || markValue > 100) {
          Alert.alert('Validation Error', `Invalid marks for ${student.name}. Marks should be between 0-100.`);
          return;
        }
      }

      // Prepare marks data for upsert
      const marksData = students.map(student => ({
        student_id: student.id,
        subject_id: subjectId,
        marks_obtained: parseInt(marks[student.id]),
        max_marks: 100,
        exam_id: null, // Will need to create exam records separately
        created_at: new Date().toISOString()
      }));

      // Upsert marks (insert or update)
      const { error: upsertError } = await supabase
        .from(TABLES.MARKS)
        .upsert(marksData, {
          onConflict: 'student_id,subject_id',
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      Alert.alert('Success', 'Marks saved successfully!');
      
      // Refresh existing marks
      await fetchExistingMarks();

    } catch (err) {
      Alert.alert('Error', err.message);
      console.error('Error saving marks:', err);
    } finally {
      setSaving(false);
    }
  }

  // Summary statistics
  const allMarks = Object.values(marks).map(Number).filter(m => !isNaN(m) && m > 0);
  const avg = allMarks.length ? (allMarks.reduce((a, b) => a + b, 0) / allMarks.length).toFixed(1) : '-';
  const max = allMarks.length ? Math.max(...allMarks) : '-';
  const min = allMarks.length ? Math.min(...allMarks) : '-';

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={`Marks Entry: ${subject}`} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title={`Marks Entry: ${subject}`} showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStudents}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={`Marks Entry: ${subject}`} showBack={true} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {students.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.noDataText}>No students found</Text>
            <Text style={styles.noDataSubtext}>No students are assigned to this subject</Text>
          </View>
        ) : (
          <>
            {/* Marks Entry Table */}
            <View style={styles.tableBox}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Student</Text>
                <Text style={styles.tableCell}>Roll</Text>
                <Text style={styles.tableCell}>Class</Text>
                <Text style={styles.tableCell}>Marks</Text>
              </View>
              {students.map(student => (
                <View key={student.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{student.name}</Text>
                  <Text style={styles.tableCell}>{student.roll_no}</Text>
                  <Text style={styles.tableCell}>{student.classSection}</Text>
                  <TextInput
                    style={styles.marksInput}
                    value={marks[student.id] || ''}
                    onChangeText={v => handleMarkChange(student.id, v)}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="--"
                  />
                </View>
              ))}
            </View>

            {/* Summary Stats */}
            <View style={styles.statsRowBox}>
              <Text style={styles.statsText}>Average: <Text style={styles.statsValue}>{avg}</Text></Text>
              <Text style={styles.statsText}>Highest: <Text style={styles.statsValue}>{max}</Text></Text>
              <Text style={styles.statsText}>Lowest: <Text style={styles.statsValue}>{min}</Text></Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="save" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving...' : 'Save Marks'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  tableBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#e3f2fd',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  marksInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  statsRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    elevation: 1,
  },
  statsText: {
    fontSize: 14,
    color: '#333',
  },
  statsValue: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 18,
    alignSelf: 'center',
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#ccc',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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