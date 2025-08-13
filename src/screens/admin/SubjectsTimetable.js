import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Button, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';



// Helper to calculate duration in minutes
function getDuration(start, end) {
  if (!start || !end || typeof start !== 'string' || typeof end !== 'string') return 0;
  try {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    return (eh * 60 + em) - (sh * 60 + sm);
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
}

// Helper to format time (24h to 12h)
function formatTime(t) {
  if (!t || typeof t !== 'string') return '';
  try {
    let [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return t; // Return original if parsing fails
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return t; // Return original string if error
  }
}

const SubjectsTimetable = ({ route }) => {
  const { classId } = route?.params || {};
  const [tab, setTab] = useState(classId ? 'timetable' : 'subjects');
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', teacherId: '' });
  const [selectedClass, setSelectedClass] = useState(classId || null);
  const [timetables, setTimetables] = useState({});
  const [periodModal, setPeriodModal] = useState({ visible: false, day: '', period: null });
  const [periodForm, setPeriodForm] = useState({ type: 'subject', subjectId: '', label: '', startTime: '', endTime: '', room: '' });
  const [showTimePicker, setShowTimePicker] = useState({ visible: false, field: '', value: new Date() });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch classes
        const { data: classData, error: classError } = await dbHelpers.getClasses();
        if (classError) throw classError;
        setClasses(classData || []);

        const defaultClassId = classId || classData?.[0]?.id || null;
        setSelectedClass(defaultClassId);

        // Fetch teachers
        const { data: teacherData, error: teacherError } = await dbHelpers.getTeachers();
        if (teacherError) throw teacherError;
        setTeachers(teacherData || []);

        // Fetch all subjects with teacher information through junction table
        const { data: subjectData, error: subjectError } = await supabase
          .from(TABLES.SUBJECTS)
          .select(`
            *,
            teacher_subjects(
              teachers(id, name)
            )
          `)
          .order('name');
        if (subjectError) throw subjectError;
        setSubjects(subjectData || []);

        // Fetch timetable for the default class
        if (defaultClassId) {
          await fetchTimetableForClass(defaultClassId);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load timetable data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchTimetableForClass = async (classId) => {
    try {
      const { data: timetableData, error: timetableError } = await dbHelpers.getTimetableByClass(classId);
      if (timetableError) throw timetableError;

      // Group timetable by day
      const grouped = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: []
      };

      timetableData?.forEach(period => {
        const dayName = getDayName(period.day_of_week);
        if (grouped[dayName]) {
          grouped[dayName].push({
            id: period.id,
            type: period.period_type || 'subject',
            subjectId: period.subject_id,
            subject: period.subjects,
            startTime: period.start_time,
            endTime: period.end_time,
            label: period.label || period.subjects?.name,
            room: period.room_number
          });
        }
      });

      // Sort periods by start time for each day
      Object.keys(grouped).forEach(day => {
        grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      setTimetables(prev => ({ ...prev, [classId]: grouped }));
    } catch (err) {
      console.error('Error fetching timetable:', err);
      setError('Failed to load timetable for selected class.');
    }
  };

  const getDayName = (dayNumber) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Monday';
  };

  useEffect(() => {
    // When selectedClass changes, fetch timetable for that class
    const fetchClassData = async () => {
      if (!selectedClass) return;
      await fetchTimetableForClass(selectedClass);
    };
    fetchClassData();
  }, [selectedClass]);

  // Subject CRUD
  const openAddSubject = () => {
    setEditSubject(null);
    setSubjectForm({ name: '', code: '', teacherId: '' });
    setModalVisible(true);
  };
  const openEditSubject = (subject) => {
    setEditSubject(subject);
    // Get teacher ID from the junction table relationship
    const teacherId = subject.teacher_subjects?.[0]?.teachers?.id || '';
    setSubjectForm({
      name: subject.name,
      teacherId: teacherId
    });
    setModalVisible(true);
  };

  const handleSaveSubject = async () => {
    if (!subjectForm.name) {
      Alert.alert('Error', 'Please enter subject name');
      return;
    }

    try {
      setLoading(true);

      // Validate that a class is selected
      if (!selectedClass) {
        Alert.alert('Error', 'Please select a class first');
        setLoading(false);
        return;
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      const subjectData = {
        name: subjectForm.name,
        class_id: selectedClass,
        academic_year: academicYear,
        is_optional: false // Default to false, can be made configurable later
      };

      if (editSubject) {
        // Update subject
        const { data, error } = await supabase
          .from(TABLES.SUBJECTS)
          .update(subjectData)
          .eq('id', editSubject.id)
          .select();

        if (error) throw error;

        // Handle teacher assignment through junction table
        if (subjectForm.teacherId) {
          // First, remove existing teacher assignments for this subject
          await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .delete()
            .eq('subject_id', editSubject.id);

          // Then add the new teacher assignment
          await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .insert([{
              teacher_id: subjectForm.teacherId,
              subject_id: editSubject.id
            }]);
        }

        // Refresh subjects list
        await refreshSubjects();
      } else {
        // Create new subject
        const { data, error } = await supabase
          .from(TABLES.SUBJECTS)
          .insert([subjectData])
          .select();

        if (error) throw error;

        // Handle teacher assignment through junction table
        if (subjectForm.teacherId && data[0]) {
          await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .insert([{
              teacher_id: subjectForm.teacherId,
              subject_id: data[0].id
            }]);
        }

        // Refresh subjects list
        await refreshSubjects();
      }

      setModalVisible(false);
      Alert.alert('Success', `Subject ${editSubject ? 'updated' : 'created'} successfully`);
    } catch (error) {
      console.error('Error saving subject:', error);
      Alert.alert('Error', 'Failed to save subject');
    } finally {
      setLoading(false);
    }
  };

  const refreshSubjects = async () => {
    try {
      const { data: subjectData, error: subjectError } = await supabase
        .from(TABLES.SUBJECTS)
        .select(`
          *,
          teacher_subjects(
            teachers(id, name)
          )
        `)
        .order('name');
      if (subjectError) throw subjectError;
      setSubjects(subjectData || []);
    } catch (error) {
      console.error('Error refreshing subjects:', error);
    }
  };

  const handleDeleteSubject = async (id) => {
    Alert.alert('Delete Subject', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setLoading(true);
          const { error } = await supabase
            .from(TABLES.SUBJECTS)
            .delete()
            .eq('id', id);

          if (error) throw error;

          setSubjects(subjects.filter(s => s.id !== id));
          Alert.alert('Success', 'Subject deleted successfully');
        } catch (error) {
          console.error('Error deleting subject:', error);
          Alert.alert('Error', 'Failed to delete subject');
        } finally {
          setLoading(false);
        }
      }},
    ]);
  };

  // Timetable helpers
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periods = [1, 2, 3, 4, 5, 6];
  const getSubjectName = (subjectId) => {
    const subj = subjects.find(s => s.id === subjectId);
    return subj ? subj.name : '-';
  };
  const getTeacherName = (teacherId) => {
    const t = teachers.find(t => t.id === teacherId);
    return t ? t.name : '-';
  };

  const getSubjectTeacher = (subject) => {
    if (subject.teacher_subjects && subject.teacher_subjects.length > 0) {
      const teacher = subject.teacher_subjects[0].teachers;
      return teacher ? teacher.name : '-';
    }
    return '-';
  };
  const handleAssignSubject = async (day, period, subjectId) => {
    setTimetables(prev => {
      const classTT = { ...prev[selectedClass] };
      const dayTT = classTT[day] ? [...classTT[day]] : [];
      const idx = dayTT.findIndex(p => p.period === period);
      if (idx >= 0) {
        dayTT[idx].subjectId = subjectId;
      } else {
        dayTT.push({ period, subjectId });
      }
      classTT[day] = dayTT;
      return { ...prev, [selectedClass]: classTT };
    });
  };

  // Open add/edit period modal
  const openAddPeriod = (day) => {
    setPeriodForm({
      type: 'subject',
      subjectId: subjects[0]?.id || '',
      label: '',
      startTime: '',
      endTime: '',
      room: ''
    });
    setPeriodModal({ visible: true, day, period: null });
  };
  const openEditPeriod = (day, period) => {
    setPeriodForm({
      type: period.type,
      subjectId: period.subjectId || '',
      label: period.label || '',
      startTime: period.startTime,
      endTime: period.endTime,
      room: period.room || ''
    });
    setPeriodModal({ visible: true, day, period });
  };
  const handleSavePeriod = async () => {
    const { type, subjectId, label, startTime, endTime } = periodForm;
    if (!startTime || !endTime || (type === 'subject' && !subjectId) || (type === 'break' && !label)) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      setLoading(true);

      // Validate that a subject is selected (current schema only supports subjects, not breaks)
      if (!subjectId) {
        Alert.alert('Error', 'Please select a subject. The current system only supports subject periods.');
        setLoading(false);
        return;
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      // Generate period number based on start time
      const periodNumber = Math.floor((parseInt(startTime.split(':')[0]) - 8) * 2) + 1;

      // Get teacher for the selected subject
      let teacherId = null;
      const { data: teacherSubject, error: teacherError } = await supabase
        .from('teacher_subjects')
        .select('teacher_id')
        .eq('subject_id', subjectId)
        .single();

      if (teacherError) {
        console.log('No teacher assigned to this subject yet');
      } else {
        teacherId = teacherSubject?.teacher_id;
      }

      // If no teacher is assigned to the subject, we need to assign one
      if (!teacherId) {
        Alert.alert(
          'No Teacher Assigned',
          'This subject has no teacher assigned. Please assign a teacher to this subject first, or select a different subject.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const timetableData = {
        class_id: selectedClass,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: periodModal.day, // Use day name directly (Monday, Tuesday, etc.)
        period_number: periodNumber,
        start_time: startTime,
        end_time: endTime,
        academic_year: academicYear
      };

      if (periodModal.period) {
        // Edit existing period
        const { data, error } = await dbHelpers.updateTimetableEntry(periodModal.period.id, timetableData);
        if (error) throw error;

        // Update local state
        setTimetables(prev => {
          const classTT = { ...prev[selectedClass] };
          const dayTT = classTT[periodModal.day] ? [...classTT[periodModal.day]] : [];
          const idx = dayTT.findIndex(p => p.id === periodModal.period.id);
          if (idx >= 0) {
            // Find subject name for display
            const subject = subjects.find(s => s.id === data[0].subject_id);
            dayTT[idx] = {
              id: data[0].id,
              subjectId: data[0].subject_id,
              subject: subject?.name || 'Unknown Subject',
              startTime: data[0].start_time,
              endTime: data[0].end_time,
              periodNumber: data[0].period_number
            };
          }
          classTT[periodModal.day] = dayTT;
          return { ...prev, [selectedClass]: classTT };
        });
      } else {
        // Add new period
        const { data, error } = await dbHelpers.createTimetableEntry(timetableData);
        if (error) throw error;

        // Update local state
        setTimetables(prev => {
          const classTT = { ...prev[selectedClass] };
          const dayTT = classTT[periodModal.day] ? [...classTT[periodModal.day]] : [];
          // Find subject name for display
          const subject = subjects.find(s => s.id === data[0].subject_id);
          dayTT.push({
            id: data[0].id,
            subjectId: data[0].subject_id,
            subject: subject?.name || 'Unknown Subject',
            startTime: data[0].start_time,
            endTime: data[0].end_time,
            periodNumber: data[0].period_number
          });
          // Sort by start time
          dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
          classTT[periodModal.day] = dayTT;
          return { ...prev, [selectedClass]: classTT };
        });
      }

      setPeriodModal({ visible: false, day: '', period: null });
      Alert.alert('Success', `Period ${periodModal.period ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving period:', error);
      Alert.alert('Error', 'Failed to save period');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePeriod = async (day, id) => {
    Alert.alert('Delete Period', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setLoading(true);
          const { error } = await dbHelpers.deleteTimetableEntry(id);
          if (error) throw error;

          // Update local state
          setTimetables(prev => {
            const classTT = { ...prev[selectedClass] };
            const dayTT = classTT[day] ? [...classTT[day]] : [];
            classTT[day] = dayTT.filter(p => p.id !== id);
            return { ...prev, [selectedClass]: classTT };
          });

          Alert.alert('Success', 'Period deleted successfully');
        } catch (error) {
          console.error('Error deleting period:', error);
          Alert.alert('Error', 'Failed to delete period');
        } finally {
          setLoading(false);
        }
      }},
    ]);
  };

  const getDayNumber = (dayName) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.indexOf(dayName);
  };

  // Helper to handle time picker
  const openTimePicker = (field, initial) => {
    let h = 9, m = 0;
    if (initial && typeof initial === 'string') {
      try {
        const parts = initial.split(':').map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          h = parts[0];
          m = parts[1];
        }
      } catch (error) {
        console.error('Error parsing initial time:', error);
      }
    }
    const date = new Date();
    date.setHours(h);
    date.setMinutes(m);
    setShowTimePicker({ visible: true, field, value: date });
  };
  const onTimePicked = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowTimePicker({ ...showTimePicker, visible: false });
      return;
    }
    const date = selectedDate || showTimePicker.value;
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    setPeriodForm(f => ({ ...f, [showTimePicker.field]: `${h}:${m}` }));
    setShowTimePicker({ ...showTimePicker, visible: false });
  };

  // Helper to get day name from date
  function getDayNameFromDate(date) {
    return days[date.getDay() === 0 ? 6 : date.getDay() - 1]; // 0=Sunday, 1=Monday...
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Subjects & Timetable" showBack={true} />
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Subjects & Timetable" showBack={true} />
        <Text style={{ color: 'red', margin: 24 }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Subjects & Timetable" showBack={true} />
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'subjects' && styles.activeTab]} onPress={() => setTab('subjects')}>
          <Text style={styles.tabText}>Subjects</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'timetable' && styles.activeTab]} onPress={() => setTab('timetable')}>
          <Text style={styles.tabText}>Timetable</Text>
        </TouchableOpacity>
      </View>
      {tab === 'subjects' ? (
        <View style={styles.content}>
          <FlatList
            data={subjects}
            keyExtractor={item => item.id}
            style={{ width: '100%', marginTop: 16 }}
            renderItem={({ item }) => (
              <View style={styles.subjectRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{item.name} ({item.code})</Text>
                  <Text style={styles.subjectTeacher}>Teacher: {getTeacherName(item.teacher_id)}</Text>
                </View>
                <TouchableOpacity onPress={() => openEditSubject(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#1976d2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSubject(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            )}
          />
          <Modal visible={modalVisible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editSubject ? 'Edit Subject' : 'Add Subject'}</Text>
                <TextInput
                  placeholder="Subject Name"
                  value={subjectForm.name}
                  onChangeText={text => setSubjectForm(f => ({ ...f, name: text }))}
                  style={styles.input}
                />

                <Text style={{ marginTop: 8 }}>Assign Teacher:</Text>
                <Picker
                  selectedValue={subjectForm.teacherId}
                  style={styles.input}
                  onValueChange={itemValue => setSubjectForm(f => ({ ...f, teacherId: itemValue }))}
                >
                  {teachers.map(t => (
                    <Picker.Item key={t.id} label={t.name} value={t.id} />
                  ))}
                </Picker>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                  <Button title="Cancel" onPress={() => setModalVisible(false)} />
                  <Button title="Save" onPress={handleSaveSubject} />
                </View>
              </View>
            </View>
          </Modal>
          {/* Floating Add Button */}
          <TouchableOpacity style={styles.fab} onPress={openAddSubject}>
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>Class Timetable</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd; })}>
              <Text style={{ fontSize: 28, marginHorizontal: 12 }}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold', minWidth: 120, textAlign: 'center' }}>{format(selectedDate, 'dd MMM yyyy')}</Text>
            <TouchableOpacity onPress={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd; })}>
              <Text style={{ fontSize: 28, marginHorizontal: 12 }}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ marginRight: 8, fontWeight: 'bold', fontSize: 16 }}>Select Class:</Text>
            <View style={{
              flex: 1,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 6,
              overflow: 'hidden',
              height: 56,
              minHeight: 44,
              alignSelf: 'stretch',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}>
              <Picker
                selectedValue={selectedClass}
                style={{ color: '#222', backgroundColor: '#fff', width: '100%', height: 56, minHeight: 44, fontSize: 16 }}
                onValueChange={setSelectedClass}
              >
                {classes.map(c => (
                  <Picker.Item key={c.id} label={`${c.class_name} ${c.section}`} value={c.id} />
                ))}
              </Picker>
            </View>
          </View>
          {/* Show only the selected day's timetable */}
          {(() => {
            const dayName = getDayNameFromDate(selectedDate);
            const dayTT = timetables[selectedClass]?.[dayName] ? [...timetables[selectedClass][dayName]] : [];
            dayTT.sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <View key={dayName} style={styles.dayBlock}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.dayTitle}>{dayName}</Text>
                  <TouchableOpacity style={styles.addPeriodBtn} onPress={() => openAddPeriod(dayName)}>
                    <Text style={styles.addPeriodBtnText}>+ Add Period</Text>
                  </TouchableOpacity>
                </View>
                {dayTT.length === 0 && <Text style={{ color: '#888', marginVertical: 8 }}>No periods added.</Text>}
                {dayTT.map(period => {
                  const duration = getDuration(period.startTime, period.endTime);
                  let subject, teacherName;
                  if (period.type === 'subject') {
                    // Use the subject data from the period if available, otherwise find it
                    subject = period.subject || subjects.find(s => s.id === period.subjectId);
                    // Get teacher name from the subject's teacher_subjects relationship
                    teacherName = subject ? getSubjectTeacher(subject) : '-';
                  }
                  return (
                    <View key={period.id} style={styles.periodCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.periodTitle}>
                            {period.type === 'subject' && subject ?
                              subject.name :
                              period.label}
                          </Text>
                          <Text style={styles.periodTime}>
                            {formatTime(period.startTime)} - {formatTime(period.endTime)} ({duration} min)
                          </Text>
                          {period.type === 'subject' && (
                            <Text style={styles.periodTeacher}>
                              Teacher: {teacherName}
                              {period.room && ` • Room: ${period.room}`}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          <TouchableOpacity style={styles.actionBtn} onPress={() => openEditPeriod(dayName, period)}>
                            <Ionicons name="pencil" size={20} color="#1976d2" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.deletePeriodBtn} onPress={() => handleDeletePeriod(dayName, period.id)}>
                            <Ionicons name="trash" size={20} color="#d32f2f" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      )}

      {/* Period Modal */}
      <Modal visible={periodModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{periodModal.period ? 'Edit Period' : 'Add Period'}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.typeBtn, periodForm.type === 'subject' && styles.activeTypeBtn]}
                onPress={() => setPeriodForm(f => ({ ...f, type: 'subject' }))}
              >
                <Text>Subject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, periodForm.type === 'break' && styles.activeTypeBtn]}
                onPress={() => setPeriodForm(f => ({ ...f, type: 'break' }))}
              >
                <Text>Break</Text>
              </TouchableOpacity>
            </View>
            {periodForm.type === 'subject' ? (
              <>
                <Text style={{ marginTop: 8 }}>Subject:</Text>
                <Picker
                  selectedValue={periodForm.subjectId}
                  style={styles.input}
                  onValueChange={itemValue => setPeriodForm(f => ({ ...f, subjectId: itemValue }))}
                >
                  {subjects.map(s => (
                    <Picker.Item key={s.id} label={s.name} value={s.id} />
                  ))}
                </Picker>
              </>
            ) : (
              <>
                <TextInput
                  placeholder="Break Label (e.g., Tea Break, Lunch Break)"
                  value={periodForm.label}
                  onChangeText={text => setPeriodForm(f => ({ ...f, label: text }))}
                  style={styles.input}
                />
              </>
            )}
            <TouchableOpacity
              style={styles.input}
              onPress={() => openTimePicker('startTime', periodForm.startTime)}
            >
              <Text>{periodForm.startTime ? `Start Time: ${formatTime(periodForm.startTime)}` : 'Select Start Time'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.input}
              onPress={() => openTimePicker('endTime', periodForm.endTime)}
            >
              <Text>{periodForm.endTime ? `End Time: ${formatTime(periodForm.endTime)}` : 'Select End Time'}</Text>
            </TouchableOpacity>

            {periodForm.type === 'subject' && (
              <TextInput
                placeholder="Room Number (optional)"
                value={periodForm.room}
                onChangeText={text => setPeriodForm(f => ({ ...f, room: text }))}
                style={styles.input}
              />
            )}
            {showTimePicker.visible && (
              <DateTimePicker
                value={showTimePicker.value}
                mode="time"
                is24Hour={true}
                display="clock"
                onChange={onTimePicked}
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setPeriodModal({ visible: false, day: '', period: null })} />
              <Button title="Save" onPress={handleSavePeriod} />
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
    paddingTop: 28, // Increased for mobile header spacing
    paddingBottom: 8, // Keep lower padding
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007bff',
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subjectTeacher: {
    fontSize: 14,
    color: '#666',
  },
  actionBtn: {
    marginLeft: 12,
    padding: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 8,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayBlock: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: '#007bff',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: -2,
  },
  addPeriodBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  addPeriodBtnText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: 'bold',
  },
  deletePeriodBtn: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#ffdddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePeriodIcon: {
    fontSize: 18,
    color: '#d00',
  },
  periodTeacher: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
    minWidth: 80,
  },
  periodCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  periodTime: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  periodTeacher: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  typeBtn: {
    flex: 1,
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTypeBtn: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
});

export default SubjectsTimetable; 