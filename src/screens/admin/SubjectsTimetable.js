import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Button, Alert, ScrollView, ActivityIndicator, RefreshControl, Platform, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import { format } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useTenant } from '../../contexts/TenantContext';


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
  const { tenantId } = useTenant();
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
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [copyDayModal, setCopyDayModal] = useState({ visible: false });
  const [periodSettingsModal, setPeriodSettingsModal] = useState({ visible: false });
  const [periodSettings, setPeriodSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedDayData, setCopiedDayData] = useState(null);
  const [copiedSourceDay, setCopiedSourceDay] = useState('');
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  // Add screen dimension change listener
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

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

// Fetch all subjects with teacher and class information through junction table
        const { data: subjectData, error: subjectError } = await supabase
          .from(TABLES.SUBJECTS)
          .select(`
            *,
            teacher_subjects(
              teachers(id, name)
            ),
            classes(
              id,
              class_name,
              section
            )
          `)
          .eq('tenant_id', tenantId)
          .order('name');
        if (subjectError) throw subjectError;
        setSubjects(subjectData || []);

        // Fetch period settings
        await fetchPeriodSettings();

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
    console.log('Timetable fetch - using tenantId:', tenantId);
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
        // day_of_week is always a string according to schema
        const dayName = period.day_of_week;
        
        if (grouped[dayName]) {
          grouped[dayName].push({
            id: period.id,
            type: 'subject', // Schema doesn't have period_type, all entries are subjects
            subjectId: period.subject_id,
            subject: period.subjects,
            startTime: period.start_time,
            endTime: period.end_time,
            label: period.subjects?.name, // Use subject name as label
            room: null // Schema doesn't have room_number column
          });
        }
      });

      // Sort periods by start time for each day
      Object.keys(grouped).forEach(day => {
        grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      // Force state update to ensure UI refreshes
      setTimetables(prev => {
        const newState = { ...prev, [classId]: grouped };
        console.log('Updated timetables state for class:', classId, newState[classId]);
        return newState;
      });
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
setSubjectForm({ name: '', code: '', teacherId: '', classId: '' });
    setModalVisible(true);
  };
  const openEditSubject = (subject) => {
    setEditSubject(subject);
    // Get teacher ID from the junction table relationship
    const teacherId = subject.teacher_subjects?.[0]?.teachers?.id || '';
    setSubjectForm({
      name: subject.name,
      teacherId: teacherId,
      classId: subject.class_id || ''
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

      // Validate that a class is selected in the form
      if (!subjectForm.classId) {
        Alert.alert('Error', 'Please select a class');
        setLoading(false);
        return;
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

const subjectData = {
        name: subjectForm.name,
        class_id: subjectForm.classId,
        academic_year: academicYear,
        is_optional: false, // Default to false, can be made configurable later
        tenant_id: tenantId,
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
            .eq('subject_id', editSubject.id)
            .eq('tenant_id', tenantId);

          // Then add the new teacher assignment
await supabase
            .from(TABLES.TEACHER_SUBJECTS)
            .insert([{
              teacher_id: subjectForm.teacherId,
              subject_id: editSubject.id,
              tenant_id: tenantId,
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
              subject_id: data[0].id,
              tenant_id: tenantId,
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
          ),
          classes(
            id,
            class_name,
            section
          )
        `)
        .eq('tenant_id', tenantId)
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

// Fetch period settings from database
  const fetchPeriodSettings = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

      if (!tenantId) {
        console.warn('Could not determine tenantId from context for period settings; using defaults');
        setPeriodSettings(getDefaultPeriods());
        return;
      }

      const { data: periodData, error: periodError } = await supabase
        .from('period_settings')
        .select('*')
        .eq('academic_year', academicYear)
        .eq('period_type', 'class')
        .eq('is_active', true)
        .eq('tenant_id', tenantId)
        .order('start_time');
      
      if (periodError) {
        console.error('Error fetching period settings:', periodError);
        // Use default periods if fetch fails
        setPeriodSettings(getDefaultPeriods());
      } else if (periodData && periodData.length > 0) {
        // Transform database data to component format
        const transformedPeriods = periodData.map(period => ({
          id: period.id,
          number: period.period_number,
          startTime: period.start_time,
          endTime: period.end_time,
          duration: period.duration_minutes,
          name: period.period_name
        }));
        setPeriodSettings(transformedPeriods);
      } else {
        // No periods in database, use defaults and save them
        const defaultPeriods = getDefaultPeriods();
        setPeriodSettings(defaultPeriods);
        await savePeriodSettingsToDatabase(defaultPeriods, academicYear);
      }
    } catch (error) {
      console.error('Error in fetchPeriodSettings:', error);
      setPeriodSettings(getDefaultPeriods());
    }
  };

  // Get default period structure
  const getDefaultPeriods = () => {
    return [
      { number: 1, startTime: '08:00', endTime: '08:45', duration: 45, name: 'Period 1' },
      { number: 2, startTime: '08:45', endTime: '09:30', duration: 45, name: 'Period 2' },
      { number: 3, startTime: '09:45', endTime: '10:30', duration: 45, name: 'Period 3' },
      { number: 4, startTime: '10:30', endTime: '11:15', duration: 45, name: 'Period 4' },
      { number: 5, startTime: '11:30', endTime: '12:15', duration: 45, name: 'Period 5' },
      { number: 6, startTime: '12:15', endTime: '13:00', duration: 45, name: 'Period 6' },
      { number: 7, startTime: '14:00', endTime: '14:45', duration: 45, name: 'Period 7' },
      { number: 8, startTime: '14:45', endTime: '15:30', duration: 45, name: 'Period 8' },
    ];
  };

  // Helper to get time slots (now uses database data)
  const getTimeSlots = () => {
    return periodSettings.length > 0 ? periodSettings : getDefaultPeriods();
  };

  // Helper to get subjects for the selected class
  const getClassSubjects = () => {
    return subjects.filter(subject => subject.class_id === selectedClass);
  };

  // Handler for subject change in period slots
  const handleSubjectChange = async (day, slot, subjectId) => {
    if (!subjectId) {
      // Remove subject from this slot if empty
      const existingPeriod = timetables[selectedClass]?.[day]?.find(
        p => p.startTime === slot.startTime
      );
      if (existingPeriod) {
        await removePeriod(day, existingPeriod.id);
      }
      return;
    }

    try {
      // Get teacher for the selected subject
      let teacherId = null;
const { data: teacherSubject, error: teacherError } = await supabase
        .from('teacher_subjects')
        .select('teacher_id')
        .eq('subject_id', subjectId)
        .eq('tenant_id', tenantId)
        .single();

      if (!teacherError && teacherSubject) {
        teacherId = teacherSubject.teacher_id;
      }

      // If no teacher is assigned to the subject, show error and return
      if (!teacherId) {
        Alert.alert(
          'No Teacher Assigned',
          'This subject has no teacher assigned. Please assign a teacher to this subject first, or select a different subject.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current academic year
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

const timetableData = {
        class_id: selectedClass,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: day, // Use day name directly (Monday, Tuesday, etc.) - matches database constraint
        period_number: slot.number,
        start_time: slot.startTime,
        end_time: slot.endTime,
        academic_year: academicYear,
        tenant_id: tenantId,
      };

      // Check if period already exists for this slot (by start time)
      const existingPeriodByTime = timetables[selectedClass]?.[day]?.find(
        p => p.startTime === slot.startTime
      );

      // Also check if there's already a period for this exact slot (class, day, period_number)
const { data: existingPeriodBySlot, error: checkError } = await supabase
        .from(TABLES.TIMETABLE)
        .select('id')
        .eq('class_id', selectedClass)
        .eq('day_of_week', day)
        .eq('period_number', slot.number)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing period:', checkError);
        throw checkError;
      }

      // Determine which period to update
      const existingPeriod = existingPeriodByTime || (existingPeriodBySlot ? {
        id: existingPeriodBySlot.id,
        startTime: slot.startTime
      } : null);

      if (existingPeriod) {
        // Update existing period
        const { data, error } = await dbHelpers.updateTimetableEntry(existingPeriod.id, timetableData);
        if (error) throw error;
      } else {
        // Create new period - use upsert to handle conflicts
const { data, error } = await supabase
          .from(TABLES.TIMETABLE)
          .upsert([timetableData], {
            onConflict: 'class_id,day_of_week,period_number'
          })
          .select(`
            *,
            subjects(id, name),
            classes(id, class_name, section)
          `);
        
        if (error) throw error;
      }

      // Refresh timetable data
      await fetchTimetableForClass(selectedClass);
    } catch (error) {
      console.error('Error updating period:', error);
      Alert.alert('Error', 'Failed to update period: ' + (error.message || 'Unknown error'));
    }
  };

  // Handler to remove a period
  const removePeriod = async (day, periodId) => {
    try {
      const { error } = await dbHelpers.deleteTimetableEntry(periodId);
      if (error) throw error;

      // Update local state
      setTimetables(prev => {
        const classTT = { ...prev[selectedClass] };
        const dayTT = classTT[day] ? [...classTT[day]] : [];
        classTT[day] = dayTT.filter(p => p.id !== periodId);
        return { ...prev, [selectedClass]: classTT };
      });
    } catch (error) {
      console.error('Error removing period:', error);
      Alert.alert('Error', 'Failed to remove period');
    }
  };

  // Handler to clear all periods for the selected day
  const clearDay = async () => {
    Alert.alert(
      'Clear Day Timetable',
      `Are you sure you want to clear all periods for ${selectedDay}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const dayPeriods = timetables[selectedClass]?.[selectedDay] || [];
              
              // Delete all periods for this day
              for (const period of dayPeriods) {
                await dbHelpers.deleteTimetableEntry(period.id);
              }

              // Update local state
              setTimetables(prev => {
                const classTT = { ...prev[selectedClass] };
                classTT[selectedDay] = [];
                return { ...prev, [selectedClass]: classTT };
              });

              Alert.alert('Success', `${selectedDay} timetable cleared successfully`);
            } catch (error) {
              console.error('Error clearing day:', error);
              Alert.alert('Error', 'Failed to clear day timetable');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handler to save the timetable (refresh data)
  const saveDayTimetable = async () => {
    try {
      setLoading(true);
      await fetchTimetableForClass(selectedClass);
      Alert.alert('Success', 'Timetable saved successfully');
    } catch (error) {
      console.error('Error saving timetable:', error);
      Alert.alert('Error', 'Failed to save timetable');
    } finally {
      setLoading(false);
    }
  };

  // Handler to copy day timetable
  const copyDayTimetable = (dayToCopy) => {
    const dayData = timetables[selectedClass]?.[dayToCopy] || [];
    if (dayData.length === 0) {
      Alert.alert('No Data', `No periods found for ${dayToCopy} to copy.`);
      return;
    }
    
    // Store the copied data (deep copy to avoid reference issues)
    const copiedData = dayData.map(period => ({
      subjectId: period.subjectId,
      subject: period.subject,
      startTime: period.startTime,
      endTime: period.endTime,
      label: period.label,
      room: period.room,
      type: period.type || 'subject'
    }));
    
    setCopiedDayData(copiedData);
    setCopiedSourceDay(dayToCopy);
    setCopyDayModal({ visible: false });
    
    Alert.alert('Success', `${dayToCopy} timetable copied! You can now paste it to another day.`);
  };

  // Handler to paste copied day timetable
  const pasteDayTimetable = async () => {
    if (!copiedDayData || copiedDayData.length === 0) {
      Alert.alert('No Data', 'No timetable data copied. Please copy a day first.');
      return;
    }

    Alert.alert(
      'Paste Timetable',
      `This will replace all periods in ${selectedDay} with periods from ${copiedSourceDay}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Paste',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              
              // First, clear existing periods for the current day
              const existingPeriods = timetables[selectedClass]?.[selectedDay] || [];
              for (const period of existingPeriods) {
                await dbHelpers.deleteTimetableEntry(period.id);
              }

              // Get current academic year
              const currentYear = new Date().getFullYear();
              const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;

              // Create new periods from copied data
              for (const copiedPeriod of copiedDayData) {
                // Get teacher for the subject
                let teacherId = null;
const { data: teacherSubject, error: teacherError } = await supabase
                  .from('teacher_subjects')
                  .select('teacher_id')
                  .eq('subject_id', copiedPeriod.subjectId)
                  .eq('tenant_id', tenantId)
                  .single();

                if (!teacherError && teacherSubject) {
                  teacherId = teacherSubject.teacher_id;
                }

                // Generate period number based on start time
                const periodNumber = Math.floor((parseInt(copiedPeriod.startTime.split(':')[0]) - 8) * 2) + 1;

const timetableData = {
                  class_id: selectedClass,
                  subject_id: copiedPeriod.subjectId,
                  teacher_id: teacherId,
                  day_of_week: selectedDay,
                  period_number: periodNumber,
                  start_time: copiedPeriod.startTime,
                  end_time: copiedPeriod.endTime,
                  academic_year: academicYear,
                  tenant_id: tenantId,
                };

await supabase
                  .from(TABLES.TIMETABLE)
                  .insert([timetableData]);
              }

              // Refresh the timetable data to update UI
              await fetchTimetableForClass(selectedClass);
              
              Alert.alert('Success', `${copiedSourceDay} timetable pasted to ${selectedDay} successfully!`);
              
              // Force a small delay to ensure state update is complete
              setTimeout(() => {
                // This ensures the UI re-renders with the updated data
                setSelectedDay(selectedDay);
              }, 100);
            } catch (error) {
              console.error('Error pasting timetable:', error);
              Alert.alert('Error', 'Failed to paste timetable: ' + (error.message || 'Unknown error'));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handler to open copy day modal
  const openCopyDayModal = () => {
    setCopyDayModal({ visible: true });
  };

  // Handler to open period settings modal
  const openPeriodSettingsModal = async () => {
    // Refresh period settings before opening modal
    await fetchPeriodSettings();
    setPeriodSettingsModal({ visible: true });
  };

  // Handler to add new period slot
  const addPeriodSlot = () => {
    const newPeriod = {
      number: periodSettings.length + 1,
      startTime: '09:00',
      endTime: '09:45',
      duration: 45,
      name: `Period ${periodSettings.length + 1}`
    };
    setPeriodSettings([...periodSettings, newPeriod]);
  };

  // Handler to remove period slot
  const removePeriodSlot = (index) => {
    const updated = periodSettings.filter((_, i) => i !== index);
    // Renumber periods
    const renumbered = updated.map((period, i) => ({ ...period, number: i + 1 }));
    setPeriodSettings(renumbered);
  };

  // Handler to update period slot
  const updatePeriodSlot = (index, field, value) => {
    const updated = [...periodSettings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Calculate duration if start or end time changed
    if (field === 'startTime' || field === 'endTime') {
      const { startTime, endTime } = updated[index];
      updated[index].duration = getDuration(startTime, endTime);
    }
    
    setPeriodSettings(updated);
  };

// Save period settings to database
  const savePeriodSettingsToDatabase = async (periods, academicYear) => {
    try {
      if (!tenantId) {
        throw new Error('No tenantId available from context');
      }
      
      // First, delete existing periods for this academic year and tenant
      await supabase
        .from('period_settings')
        .delete()
        .eq('academic_year', academicYear)
        .eq('tenant_id', tenantId);

      // Insert new period settings with tenant_id
      const periodsToInsert = periods.map(period => ({
        period_number: period.number,
        start_time: period.startTime,
        end_time: period.endTime,
        period_name: period.name || `Period ${period.number}`,
        period_type: 'class',
        academic_year: academicYear,
        tenant_id: tenantId,
        is_active: true
      }));

      const { error: insertError } = await supabase
        .from('period_settings')
        .insert(periodsToInsert);

      if (insertError) {
        throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error saving period settings to database:', error);
      throw error;
    }
  };

  // Handler to save period settings
  const savePeriodSettings = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      
      await savePeriodSettingsToDatabase(periodSettings, academicYear);
      
      setPeriodSettingsModal({ visible: false });
      Alert.alert('Success', 'Period settings saved successfully!');
      
      // Refresh period settings to get updated data with IDs
      await fetchPeriodSettings();
    } catch (error) {
      console.error('Error saving period settings:', error);
      Alert.alert('Error', 'Failed to save period settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch classes
      const { data: classData, error: classError } = await dbHelpers.getClasses();
      if (!classError) {
        setClasses(classData || []);
      }

      // Fetch teachers
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeachers();
      if (!teacherError) {
        setTeachers(teacherData || []);
      }

      // Refresh subjects
      await refreshSubjects();

      // Refresh period settings
      await fetchPeriodSettings();

      // Refresh timetable for the selected class
      if (selectedClass) {
        await fetchTimetableForClass(selectedClass);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Helper function for responsive styles
  const getResponsiveStyles = () => {
    const { width, height } = screenData;
    const isTablet = width >= 768;
    const isLandscape = width > height;
    const isMobile = width < 768;
    const isWeb = Platform.OS === 'web';

    return {
      isTablet,
      isLandscape,
      isMobile,
      isWeb,
      contentPadding: isTablet ? 24 : 16,
      modalWidth: isTablet ? '70%' : '90%',
      maxHeight: isWeb ? '75vh' : height * 0.75,
      gridColumns: isTablet && isLandscape ? 2 : 1,
    };
  };

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
        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={['#4CAF50']}
                tintColor="#4CAF50"
              />
            }
          >
          <View style={styles.subjectsSection}>
            {subjects.map((item) => (
              <View key={item.id} style={styles.subjectRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{item.name}</Text>
                  <Text style={styles.subjectClass}>Class: {item.classes ? `${item.classes.class_name} - ${item.classes.section}` : 'No Class Assigned'}</Text>
                  <Text style={styles.subjectTeacher}>Teacher: {getSubjectTeacher(item)}</Text>
                </View>
                <TouchableOpacity onPress={() => openEditSubject(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#1976d2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSubject(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Modal visible={modalVisible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { width: getResponsiveStyles().modalWidth }]}>
                <Text style={styles.modalTitle}>{editSubject ? 'Edit Subject' : 'Add Subject'}</Text>
                <TextInput
                  placeholder="Subject Name"
                  value={subjectForm.name}
                  onChangeText={text => setSubjectForm(f => ({ ...f, name: text }))}
                  style={styles.input}
                />

                <Text style={{ marginTop: 16, marginBottom: 4, fontSize: 14, fontWeight: '600', color: '#333' }}>Select Class:</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={subjectForm.classId}
                    style={styles.modalPicker}
                    onValueChange={itemValue => setSubjectForm(f => ({ ...f, classId: itemValue }))}
                  >
                    <Picker.Item label="Select a Class" value="" />
                    {classes.map(c => (
                      <Picker.Item 
                        key={c.id} 
                        label={`${c.class_name} - ${c.section}`} 
                        value={c.id} 
                      />
                    ))}
                  </Picker>
                </View>

                <Text style={{ marginTop: 16, marginBottom: 4, fontSize: 14, fontWeight: '600', color: '#333' }}>Assign Teacher (Optional):</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={subjectForm.teacherId}
                    style={styles.modalPicker}
                    onValueChange={itemValue => setSubjectForm(f => ({ ...f, teacherId: itemValue }))}
                  >
                    <Picker.Item label="Select a Teacher" value="" />
                    {teachers.map(t => (
                      <Picker.Item key={t.id} label={t.name} value={t.id} />
                    ))}
                  </Picker>
                </View>
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
          </ScrollView>
        </View>
      ) : (
        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.timetableScrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={['#4CAF50']}
                tintColor="#4CAF50"
              />
            }
          >
          {/* Class Selector */}
          <View style={styles.classSelector}>
            <View style={styles.selectorHeader}>
              <Ionicons name="school" size={20} color="#2196F3" />
              <Text style={styles.selectorLabel}>Select Class</Text>
            </View>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedClass}
                style={styles.classPicker}
                onValueChange={setSelectedClass}
              >
                {classes.map(c => (
                  <Picker.Item 
                    key={c.id} 
                    label={`${c.class_name} - ${c.section}`} 
                    value={c.id} 
                  />
                ))}
              </Picker>
              <Ionicons name="chevron-down" size={20} color="#666" style={styles.pickerIcon} />
            </View>
          </View>

          {/* Day Selector Tabs */}
          <View style={styles.dayTabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
              {days.map((day, index) => {
                const isSelected = selectedDay === day;
                const dayPeriods = timetables[selectedClass]?.[day] || [];
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayTab, isSelected && styles.selectedDayTab]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text style={[styles.dayTabText, isSelected && styles.selectedDayTabText]}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Period Entry List - Remove nested ScrollView */}
          <View style={styles.periodsContainer}>
            <View style={styles.periodsHeader}>
              <Text style={styles.periodsTitle}>Periods for {selectedDay}</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.copyDayButton}
                  onPress={() => openCopyDayModal()}
                >
                  <Ionicons name="copy" size={16} color="#2196F3" />
                  <Text style={styles.copyDayText}>Copy Day</Text>
                </TouchableOpacity>
                {copiedDayData && copiedDayData.length > 0 && (
                  <TouchableOpacity 
                    style={styles.pasteDayButton}
                    onPress={() => pasteDayTimetable()}
                  >
                    <Ionicons name="clipboard" size={16} color="#4CAF50" />
                    <Text style={styles.pasteDayText}>Paste</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Period Settings Button - Below header */}
            <TouchableOpacity 
              style={styles.settingsButtonLarge}
              onPress={() => openPeriodSettingsModal()}
            >
              <Ionicons name="settings" size={18} color="#2196F3" />
              <Text style={styles.settingsTextLarge}>Configure Period Timings</Text>
              <Ionicons name="chevron-right" size={16} color="#2196F3" />
            </TouchableOpacity>

            {/* Pre-defined time slots */}
            {getTimeSlots().map((slot, index) => {
              const existingPeriod = timetables[selectedClass]?.[selectedDay]?.find(
                p => p.startTime === slot.startTime
              );
              return (
                <View key={index} style={styles.periodSlot}>
                  <View style={styles.periodTimeSlot}>
                    <Text style={styles.periodNumber}>Period {slot.number}</Text>
                    <Text style={styles.periodTime}>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </Text>
                    <Text style={styles.periodDuration}>({slot.duration} min)</Text>
                  </View>
                  <View style={styles.subjectSelector}>
                    <View style={styles.subjectPickerWrapper}>
                      <Picker
                        key={`${selectedDay}-${slot.startTime}-${existingPeriod?.subjectId || 'empty'}`}
                        selectedValue={existingPeriod?.subjectId || ''}
                        style={styles.subjectPicker}
                        onValueChange={(subjectId) => handleSubjectChange(selectedDay, slot, subjectId)}
                      >
                        <Picker.Item label="Select Subject" value="" />
                        {getClassSubjects().map(subject => (
                          <Picker.Item 
                            key={subject.id} 
                            label={subject.name} 
                            value={subject.id} 
                          />
                        ))}
                      </Picker>
                    </View>
                    {existingPeriod && (
                      <TouchableOpacity
                        style={styles.removeSubjectButton}
                        onPress={() => removePeriod(selectedDay, existingPeriod.id)}
                      >
                        <Ionicons name="trash" size={16} color="#f44336" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.clearDayButton}
              onPress={() => clearDay()}
            >
              <Ionicons name="refresh" size={16} color="#666" />
              <Text style={styles.clearDayText}>Clear Day</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveTimetableButton}
              onPress={() => saveDayTimetable()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveTimetableText}>Save Timetable</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
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
            {Platform.OS === 'web' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <CrossPlatformDatePicker
                    label="Start Time"
                    value={periodForm.startTime ? (() => {
                      const [h, m] = periodForm.startTime.split(':').map(Number);
                      return new Date(1970, 0, 1, h, m);
                    })() : null}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        const h = selectedDate.getHours().toString().padStart(2, '0');
                        const m = selectedDate.getMinutes().toString().padStart(2, '0');
                        setPeriodForm(f => ({ ...f, startTime: `${h}:${m}` }));
                      }
                    }}
                    mode="time"
                    placeholder="Select Start Time"
                    containerStyle={{ marginBottom: 8 }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CrossPlatformDatePicker
                    label="End Time"
                    value={periodForm.endTime ? (() => {
                      const [h, m] = periodForm.endTime.split(':').map(Number);
                      return new Date(1970, 0, 1, h, m);
                    })() : null}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        const h = selectedDate.getHours().toString().padStart(2, '0');
                        const m = selectedDate.getMinutes().toString().padStart(2, '0');
                        setPeriodForm(f => ({ ...f, endTime: `${h}:${m}` }));
                      }
                    }}
                    mode="time"
                    placeholder="Select End Time"
                    containerStyle={{ marginBottom: 8 }}
                  />
                </View>
              </View>
            ) : (
              <>
                <DatePickerButton
                  label="Start Time"
                  value={periodForm.startTime ? (() => {
                    const [h, m] = periodForm.startTime.split(':').map(Number);
                    return new Date(1970, 0, 1, h, m);
                  })() : null}
                  onPress={() => openTimePicker('startTime', periodForm.startTime)}
                  placeholder="Select Start Time"
                  mode="time"
                  style={styles.input}
                  containerStyle={{ marginBottom: 8 }}
                />
                <DatePickerButton
                  label="End Time"
                  value={periodForm.endTime ? (() => {
                    const [h, m] = periodForm.endTime.split(':').map(Number);
                    return new Date(1970, 0, 1, h, m);
                  })() : null}
                  onPress={() => openTimePicker('endTime', periodForm.endTime)}
                  placeholder="Select End Time"
                  mode="time"
                  style={styles.input}
                  containerStyle={{ marginBottom: 8 }}
                />
              </>
            )}

            {periodForm.type === 'subject' && (
              <TextInput
                placeholder="Room Number (optional)"
                value={periodForm.room}
                onChangeText={text => setPeriodForm(f => ({ ...f, room: text }))}
                style={styles.input}
              />
            )}
            {Platform.OS !== 'web' && showTimePicker.visible && (
              <CrossPlatformDatePicker
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

      {/* Period Settings Modal */}
      <Modal visible={periodSettingsModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.largeModalContent]}>
            <Text style={styles.modalTitle}>Period Settings</Text>
            <Text style={styles.modalSubtitle}>Configure period timings for all days</Text>
            
            <ScrollView style={styles.periodSettingsList}>
              {periodSettings.map((period, index) => (
                <View key={index} style={styles.periodSettingRow}>
                  <View style={styles.periodSettingHeader}>
                    <Text style={styles.periodSettingNumber}>Period {period.number}</Text>
                    <TouchableOpacity
                      style={styles.removePeriodButton}
                      onPress={() => removePeriodSlot(index)}
                    >
                      <Ionicons name="trash" size={16} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                  
                  {Platform.OS === 'web' ? (
                    <View style={styles.timeInputRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <CrossPlatformDatePicker
                          label="Start Time"
                          value={(() => {
                            const [h, m] = period.startTime.split(':').map(Number);
                            return new Date(1970, 0, 1, h, m);
                          })()}
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              const h = selectedDate.getHours().toString().padStart(2, '0');
                              const m = selectedDate.getMinutes().toString().padStart(2, '0');
                              updatePeriodSlot(index, 'startTime', `${h}:${m}`);
                            }
                          }}
                          mode="time"
                          placeholder="Start Time"
                          containerStyle={{ marginBottom: 8 }}
                        />
                      </View>
                      
                      <Text style={styles.timeSeparator}>to</Text>
                      
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <CrossPlatformDatePicker
                          label="End Time"
                          value={(() => {
                            const [h, m] = period.endTime.split(':').map(Number);
                            return new Date(1970, 0, 1, h, m);
                          })()}
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              const h = selectedDate.getHours().toString().padStart(2, '0');
                              const m = selectedDate.getMinutes().toString().padStart(2, '0');
                              updatePeriodSlot(index, 'endTime', `${h}:${m}`);
                            }
                          }}
                          mode="time"
                          placeholder="End Time"
                          containerStyle={{ marginBottom: 8 }}
                        />
                      </View>
                      
                      <View style={styles.durationDisplay}>
                        <Text style={styles.durationText}>{period.duration} min</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.timeInputRow}>
                      <TouchableOpacity
                        style={styles.timeInput}
                        onPress={() => {
                          const [h, m] = period.startTime.split(':').map(Number);
                          const date = new Date();
                          date.setHours(h, m);
                          setShowTimePicker({ 
                            visible: true, 
                            field: `period_${index}_start`,
                            value: date 
                          });
                        }}
                      >
                        <Text style={styles.timeInputText}>{formatTime(period.startTime)}</Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.timeSeparator}>to</Text>
                      
                      <TouchableOpacity
                        style={styles.timeInput}
                        onPress={() => {
                          const [h, m] = period.endTime.split(':').map(Number);
                          const date = new Date();
                          date.setHours(h, m);
                          setShowTimePicker({ 
                            visible: true, 
                            field: `period_${index}_end`,
                            value: date 
                          });
                        }}
                      >
                        <Text style={styles.timeInputText}>{formatTime(period.endTime)}</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.durationDisplay}>
                        <Text style={styles.durationText}>{period.duration} min</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
              
              <TouchableOpacity
                style={styles.addPeriodButton}
                onPress={addPeriodSlot}
              >
                <Ionicons name="add" size={20} color="#2196F3" />
                <Text style={styles.addPeriodText}>Add Period</Text>
              </TouchableOpacity>
            </ScrollView>
            
            {Platform.OS !== 'web' && showTimePicker.visible && showTimePicker.field.startsWith('period_') && (
              <CrossPlatformDatePicker
                value={showTimePicker.value}
                mode="time"
                is24Hour={true}
                display="clock"
                onChange={(event, selectedDate) => {
                  if (event.type === 'dismissed') {
                    setShowTimePicker({ ...showTimePicker, visible: false });
                    return;
                  }
                  
                  const date = selectedDate || showTimePicker.value;
                  const h = date.getHours().toString().padStart(2, '0');
                  const m = date.getMinutes().toString().padStart(2, '0');
                  const time = `${h}:${m}`;
                  
                  const [, indexStr, type] = showTimePicker.field.split('_');
                  const index = parseInt(indexStr);
                  const field = type === 'start' ? 'startTime' : 'endTime';
                  
                  updatePeriodSlot(index, field, time);
                  setShowTimePicker({ ...showTimePicker, visible: false });
                }}
              />
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPeriodSettingsModal({ visible: false })}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={savePeriodSettings}
              >
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy Day Modal */}
      <Modal visible={copyDayModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Copy Day Timetable</Text>
            <Text style={styles.modalSubtitle}>Select a day to copy its timetable</Text>
            
            <ScrollView style={styles.copyDayList}>
              {days.map(day => {
                const dayPeriods = timetables[selectedClass]?.[day] || [];
                const periodCount = dayPeriods.length;
                
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.copyDayOption,
                      periodCount === 0 && styles.copyDayOptionDisabled
                    ]}
                    onPress={() => periodCount > 0 ? copyDayTimetable(day) : null}
                    disabled={periodCount === 0}
                  >
                    <View style={styles.copyDayInfo}>
                      <Text style={[
                        styles.copyDayName,
                        periodCount === 0 && styles.copyDayNameDisabled
                      ]}>
                        {day}
                      </Text>
                      <Text style={[
                        styles.copyDayPeriods,
                        periodCount === 0 && styles.copyDayPeriodsDisabled
                      ]}>
                        {periodCount} {periodCount === 1 ? 'period' : 'periods'}
                      </Text>
                    </View>
                    {periodCount > 0 && (
                      <Ionicons name="chevron-forward" size={20} color="#2196F3" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCopyDayModal({ visible: false })}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
  // Enhanced scroll wrapper styles for web compatibility
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 160px)',
        maxHeight: 'calc(100vh - 160px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        overflowY: 'auto'
      }
    })
  },
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      maxHeight: '75vh',
      overflowY: 'auto'
    })
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  subjectsSection: {
    paddingTop: 16,
    paddingBottom: 100,
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
  subjectClass: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  subjectTeacher: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      zIndex: 9999,
      right: '24px',
      bottom: '24px',
    })
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
  // New Timetable Styles
  timetableContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    ...(Platform.OS === 'web' && {
      maxHeight: '75vh',
      overflowY: 'auto'
    })
  },
  timetableScrollContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },
  timetableHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timetableTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  timetableSubtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  classSelector: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginLeft: 8,
  },
  pickerWrapper: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  classPicker: {
    height: 50,
    backgroundColor: 'transparent',
  },
  pickerIcon: {
    position: 'absolute',
    right: 12,
    top: 15,
    pointerEvents: 'none',
  },
  dayTabsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dayTabs: {
    paddingVertical: 16,
    paddingLeft: 12,
    paddingRight: 12,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
    minWidth: 72,
    position: 'relative',
  },
  selectedDayTab: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  selectedDayTabText: {
    color: '#fff',
  },
  periodsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 250,
    paddingTop: 16,
  },
  periodsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  periodsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
  },
  copyDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
  },
  copyDayText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  periodSlot: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    alignItems: 'center',
  },
  periodTimeSlot: {
    flex: 1,
    paddingRight: 16,
  },
  periodNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  periodTime: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
    marginBottom: 2,
  },
  periodDuration: {
    fontSize: 12,
    color: '#6c757d',
  },
  subjectSelector: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectPickerWrapper: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 8,
    minHeight: 50,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  subjectPicker: {
    height: 50,
    backgroundColor: 'transparent',
    color: '#495057',
    paddingHorizontal: 8,
  },
  removeSubjectButton: {
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 40,
    minHeight: 84,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  clearDayButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 8,
    minHeight: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  clearDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginLeft: 6,
  },
  saveTimetableButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#28a745',
    borderRadius: 10,
    marginLeft: 8,
    minHeight: 48,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  saveTimetableText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    marginRight: 8,
  },
  settingsText: {
    fontSize: 11,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  settingsButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbdefb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  settingsTextLarge: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '600',
    flex: 1,
  },
  copyDayText: {
    fontSize: 11,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  pasteDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    marginLeft: 8,
  },
  pasteDayText: {
    fontSize: 11,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  copyDayList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  copyDayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  copyDayOptionDisabled: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    opacity: 0.6,
  },
  copyDayInfo: {
    flex: 1,
  },
  copyDayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 2,
  },
  copyDayNameDisabled: {
    color: '#adb5bd',
  },
  copyDayPeriods: {
    fontSize: 14,
    color: '#6c757d',
  },
  copyDayPeriodsDisabled: {
    color: '#adb5bd',
  },
  largeModalContent: {
    width: '90%',
    height: '80%',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  periodSettingsList: {
    flex: 1,
    marginVertical: 8,
  },
  periodSettingRow: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  periodSettingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodSettingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  removePeriodButton: {
    padding: 6,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  timeInputText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 14,
    color: '#6c757d',
    marginHorizontal: 8,
  },
  durationDisplay: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  addPeriodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bbdefb',
    borderStyle: 'dashed',
  },
  addPeriodText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#28a745',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  modalPicker: {
    height: 50,
    backgroundColor: 'transparent',
    color: '#495057',
  },
});

export default SubjectsTimetable; 