import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import Header from '../../components/Header';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import { useAuth } from '../../utils/AuthContext';
import { supabase, dbHelpers, TABLES } from '../../utils/supabase';
import { sendAbsenceNotificationToParent } from '../../services/notificationService';

function formatDateDMY(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return '';
    return `${d}-${m}-${y}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

const TakeAttendance = () => {
  const today = new Date();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateDMY(new Date().toISOString().split('T')[0]));
  const [attendanceMark, setAttendanceMark] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewClass, setViewClass] = useState(null);
  const [viewSection, setViewSection] = useState(null);
  const [viewDate, setViewDate] = useState(selectedDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  // Fetch teacher's assigned classes and students
  const fetchClassesAndStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get teacher info using the helper function
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      if (teacherError || !teacherData) throw new Error('Teacher not found');
      setTeacherInfo(teacherData);

      // Get assigned classes and subjects
      const { data: assignedSubjects, error: subjectsError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            classes(class_name, id, section)
          )
        `)
        .eq('teacher_id', teacherData.id);

      if (subjectsError) throw subjectsError;

      // Extract unique classes
      const classMap = new Map();

      assignedSubjects.forEach(subject => {
        if (subject.subjects?.classes) {
          classMap.set(subject.subjects.classes.id, {
            id: subject.subjects.classes.id,
            class_name: subject.subjects.classes.class_name,
            section: subject.subjects.classes.section
          });
        }
      });

      const classList = Array.from(classMap.values());
      
      setClasses(classList);
      
      if (classList.length > 0) {
        setSelectedClass(classList[0].id);
        setViewClass(classList[0].id);
        setSelectedSection(classList[0].section);
        setViewSection(classList[0].section);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch students when class or section changes
  const fetchStudents = async () => {
    if (!selectedClass) return;
    
    try {
      setLoading(true);
      
      // Get students for the selected class
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          admission_no,
          classes(class_name, section)
        `)
        .eq('class_id', selectedClass)
        .order('admission_no');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing attendance for selected class, section and date
  const fetchExistingAttendance = async () => {
    if (!selectedClass || !selectedDate || students.length === 0) return;
    
    try {
      // Get existing attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('date', selectedDate)
        .eq('class_id', selectedClass)
        .in('student_id', students.map(s => s.id));

      if (attendanceError) throw attendanceError;

      // Create attendance mark object
      const mark = {};
      attendanceData.forEach(record => {
        mark[record.student_id] = record.status;
      });
      setAttendanceMark(mark);

    } catch (err) {
      console.error('Error fetching attendance:', err);
    }
  };

  useEffect(() => {
    fetchClassesAndStudents();
    
    // Set up real-time subscription for attendance updates
    const attendanceSubscription = supabase
      .channel('attendance-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.STUDENT_ATTENDANCE
      }, (payload) => {
        // Refresh attendance data when changes occur
        if (selectedClass && selectedSection && selectedDate) {
          fetchExistingAttendance();
        }
      })
      .subscribe();

    return () => {
      attendanceSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchStudents();
    
    // Set up real-time subscription for student updates
    const studentSubscription = supabase
      .channel('student-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.STUDENTS
      }, (payload) => {
        // Refresh students when student data changes
        if (selectedClass) {
          fetchStudents();
        }
      })
      .subscribe();

    return () => {
      studentSubscription.unsubscribe();
    };
  }, [selectedClass]);

  useEffect(() => {
    fetchExistingAttendance();
  }, [selectedClass, selectedSection, selectedDate, students]);

  const handleMarkAttendance = async () => {
    try {
      setLoading(true);
      
      if (students.length === 0) {
        Alert.alert('No Students', 'No students found for the selected class and section.');
        return;
      }

      // Prepare attendance records
      const attendanceRecords = students.map(student => ({
        student_id: student.id,
        class_id: selectedClass,
        date: selectedDate,
        status: attendanceMark[student.id] || 'Absent',
        marked_by: user.id // Use user.id instead of teacherInfo.id for consistency
      }));

      // Upsert attendance records (insert or update if exists)
      const { error: upsertError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .upsert(attendanceRecords, {
          onConflict: 'student_id,date',
          ignoreDuplicates: false
        });

      if (upsertError) throw upsertError;

      // Send absence notifications to parents
      console.log('📧 [ATTENDANCE] Checking for absent students to notify parents...');

      const absentStudents = attendanceRecords.filter(record => record.status === 'Absent');
      console.log(`📧 [ATTENDANCE] Found ${absentStudents.length} absent students`);

      let notificationResults = [];

      if (absentStudents.length > 0) {
        console.log('📧 [ATTENDANCE] Sending absence notifications...');

        for (const absentRecord of absentStudents) {
          try {
            console.log(`📧 [ATTENDANCE] Sending notification for student: ${absentRecord.student_id}`);

            const result = await sendAbsenceNotificationToParent(
              absentRecord.student_id,
              absentRecord.date,
              absentRecord.marked_by
            );

            notificationResults.push({
              studentId: absentRecord.student_id,
              success: result.success,
              message: result.message || result.error
            });

            if (result.success) {
              console.log(`✅ [ATTENDANCE] Notification sent for student ${absentRecord.student_id}: ${result.message}`);
            } else {
              console.log(`❌ [ATTENDANCE] Failed to send notification for student ${absentRecord.student_id}: ${result.error}`);
            }
          } catch (notificationError) {
            console.error(`❌ [ATTENDANCE] Error sending notification for student ${absentRecord.student_id}:`, notificationError);
            notificationResults.push({
              studentId: absentRecord.student_id,
              success: false,
              message: notificationError.message
            });
          }
        }

        const successCount = notificationResults.filter(r => r.success).length;
        const failureCount = notificationResults.filter(r => !r.success).length;

        console.log(`📊 [ATTENDANCE] Notification results: ${successCount} sent, ${failureCount} failed`);

        if (successCount > 0) {
          const successResults = notificationResults.filter(r => r.success);
          const notificationsSent = successResults.filter(r => r.message.includes('Notification')).length;
          const messagesSent = successResults.filter(r => r.message.includes('message')).length;

          Alert.alert(
            'Success',
            `Attendance saved successfully!\n\n✅ Absence notifications sent to ${successCount} parent(s)\n✅ Absence messages sent to ${successCount} parent(s)\n\nParents will see both notifications and messages about their child's absence.`
          );
        } else if (failureCount > 0) {
          Alert.alert(
            'Partial Success',
            `Attendance saved successfully!\n\n⚠️ Note: ${failureCount} absence notification(s) and message(s) could not be sent (no parent mapping found).\n\nTo enable notifications for these students, add their parent mappings to the system.`
          );
        } else {
          Alert.alert('Success', 'Attendance saved successfully!');
        }
      } else {
        Alert.alert('Success', 'Attendance saved successfully!');
      }
      
    } catch (err) {
      Alert.alert('Error', err.message);
      console.error('Error saving attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // For viewing attendance in modal
  const [viewAttendance, setViewAttendance] = useState([]);
  
  const fetchViewAttendance = async () => {
    if (!viewClass || !viewDate) return;
    
    try {
      // Get students for the view class
      const { data: viewStudents } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, name, admission_no')
        .eq('class_id', viewClass);

      if (!viewStudents || viewStudents.length === 0) {
        setViewAttendance([]);
        return;
      }

      if (!viewStudents || viewStudents.length === 0) {
        setViewAttendance([]);
        return;
      }

      // Get attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          students(name, admission_no)
        `)
        .eq('date', viewDate)
        .in('student_id', viewStudents.map(s => s.id));

      if (attendanceError) throw attendanceError;

      // Combine student info with attendance
      const combinedAttendance = viewStudents.map(student => {
        const attendance = attendanceData.find(a => a.student_id === student.id);
        return {
          student_id: student.id,
          student_name: student.name,
          roll_number: student.admission_no,
          date: viewDate,
          status: attendance ? attendance.status : 'Not Marked'
        };
      });

      setViewAttendance(combinedAttendance);

    } catch (err) {
      console.error('Error fetching view attendance:', err);
      setViewAttendance([]);
    }
  };

  useEffect(() => {
    if (viewModalVisible) {
      fetchViewAttendance();
    }
  }, [viewClass, viewDate, viewModalVisible]);

  const exportToPDF = async () => {
    try {
      const present = viewAttendance.filter(r => r.status === 'Present');
      const absent = viewAttendance.filter(r => r.status === 'Absent');
      const notMarked = viewAttendance.filter(r => r.status === 'Not Marked');
      
      let html = `
        <h2 style="text-align:center;">Attendance Report</h2>
        <h3 style="text-align:center;">Class: ${viewClass} | Date: ${formatDateDMY(viewDate)}</h3>
        
        <h4 style="text-align:center; color: #4CAF50;">Present Students (${present.length})</h4>
        <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background-color:#f5f5f5;"><th style="text-align:center;padding:8px;">Admission No</th><th style="text-align:center;padding:8px;">Student Name</th></tr>
          ${present.map(r => `<tr><td style="text-align:center;padding:8px;">${r.roll_number || '-'}</td><td style="text-align:center;padding:8px;">${r.student_name || '-'}</td></tr>`).join('') || '<tr><td style="text-align:center;padding:8px;">-</td><td style="text-align:center;padding:8px;">-</td></tr>'}
        </table>
        
        <h4 style="text-align:center; color: #F44336;">Absent Students (${absent.length})</h4>
        <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background-color:#f5f5f5;"><th style="text-align:center;padding:8px;">Admission No</th><th style="text-align:center;padding:8px;">Student Name</th></tr>
          ${absent.map(r => `<tr><td style="text-align:center;padding:8px;">${r.roll_number || '-'}</td><td style="text-align:center;padding:8px;">${r.student_name || '-'}</td></tr>`).join('') || '<tr><td style="text-align:center;padding:8px;">-</td><td style="text-align:center;padding:8px;">-</td></tr>'}
        </table>
        
        ${notMarked.length > 0 ? `
        <h4 style="text-align:center; color: #FF9800;">Not Marked (${notMarked.length})</h4>
        <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <tr style="background-color:#f5f5f5;"><th style="text-align:center;padding:8px;">Admission No</th><th style="text-align:center;padding:8px;">Student Name</th></tr>
          ${notMarked.map(r => `<tr><td style="text-align:center;padding:8px;">${r.roll_number || '-'}</td><td style="text-align:center;padding:8px;">${r.student_name || '-'}</td></tr>`).join('')}
        </table>
        ` : ''}
        
        <div style="margin-top:20px;text-align:center;">
          <p><strong>Total Students:</strong> ${viewAttendance.length}</p>
          <p><strong>Present:</strong> ${present.length} (${Math.round((present.length / viewAttendance.length) * 100)}%)</p>
          <p><strong>Absent:</strong> ${absent.length} (${Math.round((absent.length / viewAttendance.length) * 100)}%)</p>
        </div>
      `;
      
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
      console.error('PDF generation error:', error);
    }
  };

  // Toggle attendance status for a student
  const toggleStudentAttendance = (studentId, status) => {
    setAttendanceMark(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh all data
      await Promise.all([
        fetchClassesAndStudents(),
        selectedClass ? fetchStudents() : Promise.resolve(),
        (selectedClass && selectedDate && students.length > 0) ? fetchExistingAttendance() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Error during refresh:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={{ marginTop: 10, color: '#1976d2' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Take Attendance" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 20 }}>Error: {error}</Text>
          <TouchableOpacity style={{ backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }} onPress={fetchClassesAndStudents}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Take Attendance" showBack={true} />
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
      >
        <View style={{ padding: 20 }}>
          {/* Class and Date Selection */}
          <View style={styles.selectionContainer}>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Select Class</Text>
              <Picker
                selectedValue={selectedClass}
                onValueChange={(itemValue) => {
                  setSelectedClass(itemValue);
                  const selectedClassData = classes.find(c => c.id === itemValue);
                  if (selectedClassData) {
                    setSelectedSection(selectedClassData.section);
                  }
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select Class" value={null} />
                {classes.map(cls => (
                  <Picker.Item 
                    key={cls.id} 
                    label={`${cls.class_name} ${cls.section}`} 
                    value={cls.id} 
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.dateContainer}>
              <Text style={styles.pickerLabel}>Select Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {displayDate || formatDateDMY(selectedDate)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Attendance Count Summary */}
          {students.length > 0 && (
            <View style={styles.countContainer}>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {Object.values(attendanceMark).filter(status => status === 'Present').length}
                </Text>
                <Text style={styles.countLabel}>Present</Text>
              </View>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {Object.values(attendanceMark).filter(status => status === 'Absent').length}
                </Text>
                <Text style={styles.countLabel}>Absent</Text>
              </View>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>
                  {students.length - Object.keys(attendanceMark).length}
                </Text>
                <Text style={styles.countLabel}>Not Marked</Text>
              </View>
            </View>
          )}

          {showDatePicker && Platform.OS !== 'web' && (
            <DateTimePicker 
              value={selectedDate ? new Date(selectedDate) : new Date()} 
              mode="date" 
              display="default" 
              onChange={(event, selected) => { 
                setShowDatePicker(false); 
                if (selected) { 
                  const dd = String(selected.getDate()).padStart(2, '0'); 
                  const mm = String(selected.getMonth() + 1).padStart(2, '0'); 
                  const yyyy = selected.getFullYear(); 
                  const isoDate = `${yyyy}-${mm}-${dd}`;
                  const displayDate = `${dd}-${mm}-${yyyy}`;
                  setSelectedDate(isoDate); 
                  setDisplayDate(displayDate);
                } 
              }}
            />
          )}

          {/* Students List */}
          {students.length > 0 ? (
            <View style={styles.studentsContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { flex: 1 }]}>Admission No</Text>
                <Text style={[styles.headerCell, { flex: 2.5 }]}>Student Name</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Present</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Absent</Text>
              </View>
              
              {students.map(student => {
                const currentStatus = attendanceMark[student.id];
                
                return (
                  <View key={student.id} style={styles.studentRow}>
                    <Text style={[styles.studentCell, { flex: 1 }]}>{student.admission_no}</Text>
                    <Text style={[styles.studentCell, { flex: 2.5 }]}>{student.name}</Text>
                    
                    {/* Present Button */}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[
                          styles.attendanceCircle,
                          currentStatus === 'Present' && styles.presentCircle
                        ]}
                        onPress={() => toggleStudentAttendance(student.id, 'Present')}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={currentStatus === 'Present' ? '#fff' : '#ccc'}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Absent Button */}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <TouchableOpacity
                        style={[
                          styles.attendanceCircle,
                          currentStatus === 'Absent' && styles.absentCircle
                        ]}
                        onPress={() => toggleStudentAttendance(student.id, 'Absent')}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={currentStatus === 'Absent' ? '#fff' : '#ccc'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No students found for the selected class and section.</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleMarkAttendance}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : 'Submit Attendance'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.viewButton} 
              onPress={() => { 
                setViewClass(selectedClass); 
                setViewSection(selectedSection);
                setViewDate(selectedDate); 
                setViewModalVisible(true); 
              }}
            >
              <Text style={styles.viewButtonText}>View Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* View Attendance Modal */}
      <Modal 
        visible={viewModalVisible} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>View Attendance</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1976d2" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalFilters}>
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Class:</Text>
                {Platform.OS === 'web' ? (
                  <select 
                    value={viewClass} 
                    onChange={e => setViewClass(e.target.value)} 
                    style={styles.webSelect}
                  >
                    {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.class_name} - {cls.section}</option>)}
                  </select>
                ) : (
                  <Picker 
                    selectedValue={viewClass} 
                    onValueChange={setViewClass} 
                    style={styles.modalPicker}
                  >
                    {classes.map(cls => <Picker.Item key={cls.id} label={`${cls.class_name} - ${cls.section}`} value={cls.id} />)}
                  </Picker>
                )}
              </View>
              
              <View style={styles.modalPickerContainer}>
                <Text style={styles.modalPickerLabel}>Date:</Text>
                {Platform.OS === 'web' ? (
                  <input 
                    type="date" 
                    value={viewDate} 
                    onChange={e => setViewDate(e.target.value)} 
                    style={styles.webInput}
                  />
                ) : (
                  <TouchableOpacity 
                    style={styles.dateButton} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {viewDate ? formatDateDMY(viewDate) : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalTableHeader}>
                <Text style={styles.modalHeaderCell}>Admission No</Text>
                <Text style={styles.modalHeaderCell}>Student Name</Text>
                <Text style={styles.modalHeaderCell}>Status</Text>
              </View>
              
              {viewAttendance.map(record => (
                <View key={record.student_id} style={styles.modalStudentRow}>
                  <Text style={styles.modalStudentCell}>{record.roll_number || '-'}</Text>
                  <Text style={styles.modalStudentCell}>{record.student_name || '-'}</Text>
                  <Text style={[
                    styles.modalStudentCell, 
                    styles.statusText,
                    record.status === 'Present' ? styles.presentStatus : 
                    record.status === 'Absent' ? styles.absentStatus : 
                    styles.notMarkedStatus
                  ]}>
                    {record.status}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={exportToPDF} style={styles.exportButton}>
                <Text style={styles.exportButtonText}>Export to PDF</Text>
              </TouchableOpacity>
            </View>
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
  scrollView: {
    flex: 1,
  },
  selectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  dateContainer: {
    marginBottom: 0,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  webSelect: {
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  webInput: {
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    color: '#333',
    fontSize: 15,
  },
  countContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'space-around',
  },
  countBox: {
    alignItems: 'center',
    flex: 1,
  },
  countNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  countLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  studentsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 12,
  },
  studentCell: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
  },
  attendanceButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  noDataContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  noDataText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flex: 1,
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  viewButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flex: 1,
    marginLeft: 8,
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  modalOverlay: {
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalFilters: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  modalPickerContainer: {
    flex: 1,
    marginHorizontal: 4,
    minWidth: 100,
  },
  modalPickerLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  modalPicker: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    fontSize: 14,
  },
  modalStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingVertical: 8,
  },
  modalStudentCell: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
    fontSize: 14,
  },
  statusText: {
    fontWeight: 'bold',
  },
  presentStatus: {
    color: '#4CAF50',
  },
  absentStatus: {
    color: '#F44336',
  },
  notMarkedStatus: {
    color: '#FF9800',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginRight: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  attendanceCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentCircle: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  absentCircle: {
    backgroundColor: '#f44336',
    borderColor: '#f44336',
  },
  disabledCircle: {
    opacity: 0.5,
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  presentButton: {
    backgroundColor: '#e8f5e8',
  },
  absentButton: {
    backgroundColor: '#ffebee',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default TakeAttendance; 
