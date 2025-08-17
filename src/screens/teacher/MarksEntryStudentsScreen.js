import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

export default function MarksEntryStudentsScreen({ navigation, route }) {
  const { subject, subjectId } = route.params;
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState(null);
  const [changedCells, setChangedCells] = useState(new Set());
  const [progress, setProgress] = useState({ filled: 0, total: 0 });
  
  const { user } = useAuth();
  const headerScrollRef = useRef();
  const bodyScrollRef = useRef();
  const inputRefs = useRef({});
  const autoSaveTimeoutRef = useRef(null);
  
  const { width: screenWidth } = Dimensions.get('window');
  const STUDENT_NAME_WIDTH = 160;
  const SUBJECT_CELL_WIDTH = 90;

  // Fetch students and subjects data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get teacher info using the helper function
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) throw new Error('Teacher not found');

      // Get classes and sections where teacher teaches subjects
      const { data: teacherAssignments, error: assignmentsError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          classes(id, class_name, section),
          subjects(id, name)
        `)
        .eq('teacher_id', teacherData.id);

      if (assignmentsError) throw assignmentsError;

      if (!teacherAssignments || teacherAssignments.length === 0) {
        setStudents([]);
        setSubjects([]);
        return;
      }

      // Get unique classes and subjects
      const uniqueClasses = new Map();
      const uniqueSubjects = new Map();
      
      teacherAssignments.forEach(assignment => {
        if (assignment.classes) {
          uniqueClasses.set(assignment.classes.id, assignment.classes);
        }
        if (assignment.subjects) {
          uniqueSubjects.set(assignment.subjects.id, assignment.subjects);
        }
      });

      const classIds = Array.from(uniqueClasses.keys());
      const allSubjects = Array.from(uniqueSubjects.values());
      
      // Get all students from assigned classes
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          roll_no,
          admission_no,
          classes(class_name, section)
        `)
        .in('class_id', classIds)
        .order('roll_no');

      if (studentsError) throw studentsError;

      setStudents(studentsData || []);
      setSubjects(allSubjects);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing marks for all subjects
  const fetchExistingMarks = async () => {
    if (students.length === 0 || subjects.length === 0) return;

    try {
      console.log('Fetching existing marks for students:', students.length, 'subjects:', subjects.length);
      
      const { data: existingMarks, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select('student_id, subject_id, marks_obtained, max_marks, grade, created_at')
        .in('subject_id', subjects.map(s => s.id))
        .in('student_id', students.map(s => s.id))
        .order('created_at', { ascending: false }); // Get latest marks first

      if (marksError) {
        console.error('Error fetching marks:', marksError);
        throw marksError;
      }

      console.log('Found existing marks:', existingMarks?.length || 0);
      
      const marksMap = {};
      if (existingMarks && existingMarks.length > 0) {
        // Group by student-subject combination to get the latest entry
        const latestMarks = {};
        existingMarks.forEach(mark => {
          const cellKey = `${mark.student_id}-${mark.subject_id}`;
          if (!latestMarks[cellKey] || new Date(mark.created_at) > new Date(latestMarks[cellKey].created_at)) {
            latestMarks[cellKey] = mark;
          }
        });
        
        // Convert to display format
        Object.entries(latestMarks).forEach(([cellKey, mark]) => {
          marksMap[cellKey] = mark.marks_obtained?.toString() || '';
        });
        
        console.log('Processed marks map:', Object.keys(marksMap).length, 'entries');
      }

      setMarks(marksMap);
      updateProgress(marksMap);

    } catch (err) {
      console.error('Error fetching existing marks:', err);
      // Don't throw error, just log it so the screen doesn't break
    }
  };
  
  // Update progress calculation
  const updateProgress = useCallback((currentMarks = marks) => {
    const totalCells = students.length * subjects.length;
    const filledCells = Object.values(currentMarks).filter(mark => mark && mark.trim() !== '').length;
    setProgress({ filled: filledCells, total: totalCells });
  }, [students.length, subjects.length, marks]);
  
  // Auto-save functionality
  const autoSave = useCallback(async (updatedMarks) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        await saveMarks(updatedMarks, false); // Silent save
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setAutoSaving(false);
      }
    }, 1500); // Auto-save after 1.5 seconds of inactivity
  }, []);
  
  // Enhanced mark change handler with auto-save
  const handleMarkChange = (studentId, subjectId, value) => {
    // Validate input - only allow numbers and empty string
    if (value !== '' && (!/^\d*$/.test(value) || parseInt(value) > 100)) {
      return;
    }
    
    const cellKey = `${studentId}-${subjectId}`;
    const updatedMarks = { ...marks, [cellKey]: value };
    
    setMarks(updatedMarks);
    setChangedCells(prev => new Set(prev).add(cellKey));
    updateProgress(updatedMarks);
    
    // Auto-save if value is valid
    if (value === '' || (value >= 0 && value <= 100)) {
      autoSave(updatedMarks);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (students.length > 0 && subjects.length > 0) {
      fetchExistingMarks();
    }
  }, [students, subjects]);

  // Enhanced save function
  const saveMarks = async (currentMarks = marks, showAlert = true) => {
    try {
      const marksToSave = [];
      
      Object.entries(currentMarks).forEach(([cellKey, value]) => {
        if (value && value.trim() !== '') {
          const [studentId, subjectId] = cellKey.split('-');
          const markValue = parseInt(value);
          
          if (!isNaN(markValue) && markValue >= 0 && markValue <= 100) {
            marksToSave.push({
              student_id: studentId,
              subject_id: subjectId,
              marks_obtained: markValue,
              max_marks: 100,
              exam_id: null
            });
          }
        }
      });
      
      if (marksToSave.length > 0) {
        console.log('Saving marks:', marksToSave.length, 'entries');
        
        // Use upsert with proper conflict resolution
        const { error: upsertError } = await supabase
          .from(TABLES.MARKS)
          .upsert(marksToSave, {
            onConflict: 'student_id,subject_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          throw upsertError;
        }
        
        console.log('Successfully saved marks');
        
        // Also try a simple update/insert approach as fallback
        /* Alternative approach if upsert doesn't work:
        for (const markData of marksToSave) {
          const { error: updateError } = await supabase
            .from(TABLES.MARKS)
            .update({
              marks_obtained: markData.marks_obtained,
              max_marks: markData.max_marks,
              created_at: markData.created_at
            })
            .eq('student_id', markData.student_id)
            .eq('subject_id', markData.subject_id);
            
          if (updateError && updateError.code === 'PGRST116') {
            // Record doesn't exist, insert it
            const { error: insertError } = await supabase
              .from(TABLES.MARKS)
              .insert(markData);
              
            if (insertError) throw insertError;
          } else if (updateError) {
            throw updateError;
          }
        }
        */
        
        if (showAlert) {
          Alert.alert('Success', `Saved ${marksToSave.length} marks successfully!`);
        }
        
        // Clear changed cells indicator
        setChangedCells(new Set());
      }

    } catch (err) {
      if (showAlert) {
        Alert.alert('Error', err.message);
      }
      console.error('Error saving marks:', err);
      throw err;
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      await saveMarks();
      await fetchExistingMarks(); // Refresh data
    } catch (err) {
      // Error already handled in saveMarks
    } finally {
      setSaving(false);
    }
  };
  
  // Focus next input for better UX
  const focusNextInput = (studentIndex, subjectIndex) => {
    const nextSubjectIndex = subjectIndex + 1;
    const nextStudentIndex = studentIndex + 1;
    
    let nextCellKey = null;
    
    if (nextSubjectIndex < subjects.length) {
      // Move to next subject in same row
      nextCellKey = `${students[studentIndex].id}-${subjects[nextSubjectIndex].id}`;
    } else if (nextStudentIndex < students.length) {
      // Move to first subject in next row
      nextCellKey = `${students[nextStudentIndex].id}-${subjects[0].id}`;
    }
    
    if (nextCellKey && inputRefs.current[nextCellKey]) {
      inputRefs.current[nextCellKey].focus();
    }
  };
  
  // Sync horizontal scrolling between header and body
  const handleHeaderScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
  };
  
  const handleBodyScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
  };

  // Enhanced statistics
  const getStats = () => {
    const allMarks = Object.values(marks)
      .map(Number)
      .filter(m => !isNaN(m) && m >= 0);
    
    if (allMarks.length === 0) {
      return { avg: '-', max: '-', min: '-', count: 0 };
    }
    
    return {
      avg: (allMarks.reduce((a, b) => a + b, 0) / allMarks.length).toFixed(1),
      max: Math.max(...allMarks),
      min: Math.min(...allMarks),
      count: allMarks.length
    };
  };
  
  const stats = getStats();
  
  // Render table layout like the image
  const renderTable = () => (
    <View style={styles.tableContainer}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={styles.studentNameColumn}>
          <Text style={styles.headerText}>Student Name</Text>
        </View>
        {subjects.map((subject) => (
          <View key={subject.id} style={styles.subjectColumn}>
            <Text style={styles.headerText} numberOfLines={1}>
              {subject.name}
            </Text>
          </View>
        ))}
      </View>
      
      {/* Table Body */}
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {students.map((student, studentIndex) => (
          <View key={student.id} style={styles.tableRow}>
            {/* Student Name Cell */}
            <View style={styles.studentNameCell}>
              <Text style={styles.studentNameText} numberOfLines={2}>
                {student.name}
              </Text>
            </View>
            
            {/* Subject Mark Cells */}
            {subjects.map((subject, subjectIndex) => {
              const cellKey = `${student.id}-${subject.id}`;
              const value = marks[cellKey] || '';
              const isChanged = changedCells.has(cellKey);
              const isInvalid = value && (isNaN(value) || value > 100 || value < 0);
              
              return (
                <View key={subject.id} style={styles.subjectCell}>
                  <TextInput
                    ref={ref => {
                      if (ref) {
                        inputRefs.current[cellKey] = ref;
                      }
                    }}
                    style={styles.cellInput}
                    placeholder=""
                    value={value}
                    onChangeText={(newValue) => handleMarkChange(student.id, subject.id, newValue)}
                    keyboardType="numeric"
                    maxLength={3}
                    returnKeyType="next"
                    onSubmitEditing={() => focusNextInput(studentIndex, subjectIndex)}
                    selectTextOnFocus
                  />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
  

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Enter Marks" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading spreadsheet...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Enter Marks" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Enter Marks" showBack={true} />
      
      {/* Compact Info Header */}
      <View style={styles.compactHeader}>
        <View style={styles.classInfoBadge}>
          <Text style={styles.classInfoText}>
            Students: {students.length} | Subjects: {subjects.length} | Progress: {progress.filled}/{progress.total}
          </Text>
        </View>
        
        {/* Auto-save indicator */}
        {autoSaving && (
          <View style={styles.autoSaveIndicator}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.autoSaveText}>Auto-saving...</Text>
          </View>
        )}
      </View>
      
      {students.length === 0 ? (
        <View style={styles.noDataContainer}>
          <Ionicons name="people-outline" size={48} color="#ccc" />
          <Text style={styles.noDataText}>No students found</Text>
          <Text style={styles.noDataSubtext}>No students are assigned to these subjects</Text>
        </View>
      ) : (
        <>
          {/* Table Layout */}
          {renderTable()}
          
          {/* Save Button */}
          <View style={styles.saveButtonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, (saving || autoSaving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || autoSaving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Compact header styles
  compactHeader: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  classInfoBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'center',
  },
  classInfoText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
    textAlign: 'center',
  },
  autoSaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  autoSaveText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  
  // Sticky header styles
  stickyHeaderContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  stickyStudentHeader: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  stickyHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  stickySubjectHeader: {
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  stickySubjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    lineHeight: 14,
  },
  
  // Student list and rows
  studentsList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  evenRow: {
    backgroundColor: '#fff',
  },
  oddRow: {
    backgroundColor: '#fafafa',
  },
  
  // Student info section
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentMeta: {
    fontSize: 12,
    color: '#666',
  },
  
  // Mark input styles
  markInputContainer: {
    marginRight: 8,
    position: 'relative',
  },
  markInput: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 44, // Large tap target for mobile
    color: '#333',
  },
  changedMarkInput: {
    borderColor: '#FF9800',
    backgroundColor: '#fff3e0',
  },
  invalidMarkInput: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  zeroMarkInput: {
    borderColor: '#9c27b0',
    backgroundColor: '#f3e5f5',
  },
  
  // Visual indicators
  changedIndicator: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9800',
    borderWidth: 2,
    borderColor: '#fff',
  },
  errorIndicator: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  
  // Statistics section
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  
  // Progress bar
  progressContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabDisabled: {
    backgroundColor: '#bdbdbd',
  },
  unsavedIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff5722',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unsavedCount: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  
  // Empty state
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Table Layout Styles (matching the image)
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    overflow: 'hidden',
  },
  
  // Table Header
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  studentNameColumn: {
    flex: 2,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
  },
  subjectColumn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  
  // Table Body
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    minHeight: 60,
  },
  
  // Student Name Cell
  studentNameCell: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
  },
  studentNameText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
  },
  
  // Subject Mark Cells
  subjectCell: {
    flex: 1,
    borderRightWidth: 2,
    borderRightColor: '#333',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cellInput: {
    width: '100%',
    minHeight: 44,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#333',
  },
  
  // Cell States
  changedCell: {
    borderColor: '#FF9800',
    backgroundColor: '#fff8e1',
  },
  invalidCell: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  zeroCell: {
    borderColor: '#9c27b0',
    backgroundColor: '#f3e5f5',
  },
  
  // Changed indicator dot
  changedDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  
  // Save Button
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
