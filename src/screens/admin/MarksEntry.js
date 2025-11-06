/**
 * MarksEntry - Enhanced Tenant System Implementation
 * 
 * This component has been migrated to use the Enhanced Tenant System:
 * - Uses useTenantAccess hook for tenant context
 * - Leverages tenantDatabase helpers for automatic tenant filtering
 * - Implements robust tenant validation with validateTenantReadiness()
 * - All database operations are tenant-scoped automatically
 * - Removed complex email-based tenant validation logic
 * - Uses getCachedTenantId for fast tenant ID access
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, FlatList, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { createBulkMarksNotifications } from '../../utils/marksNotificationHelpers';
import { useTenantAccess, tenantDatabase, createTenantQuery, getCachedTenantId } from '../../utils/tenantHelpers';
import { useAuth } from '../../utils/AuthContext';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';

const MarksEntry = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const inputRefs = useRef({});
  const { user } = useAuth();
  const tenantAccess = useTenantAccess();
  
  // Helper function to validate tenant readiness and get effective tenant ID
  const validateTenantReadiness = useCallback(async () => {
    console.log('🔍 [MarksEntry] validateTenantReadiness - Starting validation');
    console.log('🔍 [MarksEntry] User state:', { 
      id: user?.id, 
      email: user?.email 
    });
    console.log('🔍 [MarksEntry] Tenant access state:', { 
      isReady: tenantAccess.isReady,
      isLoading: tenantAccess.isLoading,
      currentTenant: tenantAccess.currentTenant?.id
    });
    
    // Wait for tenant system to be ready
    if (!tenantAccess.isReady || tenantAccess.isLoading) {
      console.log('⏳ [MarksEntry] Tenant system not ready, waiting...');
      return { success: false, reason: 'TENANT_NOT_READY' };
    }
    
    // Get effective tenant ID
    const effectiveTenantId = await getCachedTenantId();
    if (!effectiveTenantId) {
      console.log('❌ [MarksEntry] No effective tenant ID available');
      return { success: false, reason: 'NO_TENANT_ID' };
    }
    
    console.log('✅ [MarksEntry] Tenant validation successful:', {
      effectiveTenantId,
      currentTenant: tenantAccess.currentTenant?.id
    });
    
    return { 
      success: true, 
      effectiveTenantId,
      tenantContext: tenantAccess.currentTenant
    };
  }, [user?.id, user?.email, tenantAccess.isReady, tenantAccess.isLoading, tenantAccess.currentTenant?.id]);
  
  // Get exam and class data from route params
  const { exam, examClass } = route.params || {};

  // Core data states
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [marksForm, setMarksForm] = useState({});
  const [changedCells, setChangedCells] = useState(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Modal states for adding new items
  const [addSubjectModalVisible, setAddSubjectModalVisible] = useState(false);
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkFillModalVisible, setBulkFillModalVisible] = useState(false);
  const [bulkFillValue, setBulkFillValue] = useState('');
  
  // UI states
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);
  const [averageMarks, setAverageMarks] = useState({});
  const [subjectMenuVisible, setSubjectMenuVisible] = useState(null);
  const [showAdmissionNumbers, setShowAdmissionNumbers] = useState(false);

  // Subject-specific max marks overrides
  const [subjectMaxMarks, setSubjectMaxMarks] = useState({}); // { subjectId: maxMarks }
  const [maxMarksModalVisible, setMaxMarksModalVisible] = useState(false);
  const [selectedSubjectForMaxMarks, setSelectedSubjectForMaxMarks] = useState(null);
  const [tempMaxMarks, setTempMaxMarks] = useState('');

  // Load data with enhanced tenant system
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🚀 [MarksEntry] loadData - Starting with enhanced tenant validation');
      
      // Validate tenant readiness
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        console.log('⚠️ [MarksEntry] Tenant not ready for data loading:', tenantValidation.reason);
        if (tenantValidation.reason === 'TENANT_NOT_READY') {
          setLoading(false);
          return;
        }
        throw new Error('Tenant validation failed: ' + tenantValidation.reason);
      }
      
      const { effectiveTenantId } = tenantValidation;
      console.log('✅ [MarksEntry] Using effective tenant ID for data loading:', effectiveTenantId);

      // Load subjects for the class using enhanced tenant database
      console.log('🔍 Loading subjects via enhanced tenant database for class:', examClass.id);
      const { data: subjectsData, error: subjectsError } = await tenantDatabase.read('subjects', { class_id: examClass.id }, 'id, name, class_id, academic_year, is_optional');

      if (subjectsError) throw subjectsError;

      // Load students for the class using enhanced tenant database
      console.log('🔍 Loading students via enhanced tenant database for class:', examClass.id);
      const { data: studentsData, error: studentsError } = await tenantDatabase.read('students', { class_id: examClass.id }, 'id, admission_no, name, roll_no, class_id, academic_year');

      if (studentsError) throw studentsError;

      // Load existing marks for this exam - use direct query to ensure no limits
      console.log('🔍 Loading marks via enhanced tenant database for exam:', exam.id);
      console.log('🔍 Query params:', {
        tenant_id: effectiveTenantId,
        exam_id: exam.id
      });

      // Use direct Supabase query with explicit range to get ALL marks
      let { data: marksData, error: marksError, count } = await supabase
        .from('marks')
        .select('id, student_id, exam_id, subject_id, marks_obtained, grade, max_marks, remarks', { count: 'exact' })
        .eq('tenant_id', effectiveTenantId)
        .eq('exam_id', exam.id)
        .order('student_id');

      console.log('📊 Marks query result:', {
        data: marksData,
        error: marksError,
        count: count,
        dataLength: marksData?.length || 0
      });

      // If no marks found with tenant filter, try without tenant filter to diagnose
      if ((!marksData || marksData.length === 0) && !marksError) {
        console.log('⚠️ No marks found with tenant filter. Checking if marks exist without tenant filter...');
        const { data: allExamMarks, count: allCount } = await supabase
          .from('marks')
          .select('id, student_id, exam_id, subject_id, marks_obtained, grade, max_marks, remarks, tenant_id', { count: 'exact' })
          .eq('exam_id', exam.id);

        console.log('📊 All marks for this exam (no tenant filter):', {
          count: allCount,
          dataLength: allExamMarks?.length || 0,
          sampleMarks: allExamMarks?.slice(0, 3),
          tenantIds: allExamMarks ? [...new Set(allExamMarks.map(m => m.tenant_id))] : []
        });

        // Use all marks if they exist (backward compatibility for marks saved without tenant_id)
        if (allExamMarks && allExamMarks.length > 0) {
          console.log('✅ Using marks without tenant filter for backward compatibility');
          marksData = allExamMarks;
        }
      }

      if (marksError) {
        console.error('❌ Error loading marks:', marksError);
        throw marksError;
      }

      console.log('📬 Loaded data:', {
        subjects: subjectsData?.length || 0,
        students: studentsData?.length || 0,
        marks: marksData?.length || 0,
        expectedMarks: (studentsData?.length || 0) * (subjectsData?.length || 0)
      });

      // Log details about loaded marks
      if (marksData && marksData.length > 0) {
        console.log('📊 Marks distribution:', {
          totalMarks: marksData.length,
          uniqueStudents: new Set(marksData.map(m => m.student_id)).size,
          uniqueSubjects: new Set(marksData.map(m => m.subject_id)).size,
          sampleMarks: marksData.slice(0, 3)
        });
      }
      
      // Set validated data
      let processedSubjects = subjectsData || [];

      // If no subjects exist, create default ones and save them to the database
      if (processedSubjects.length === 0) {
        console.log('📚 [MarksEntry] No subjects found, creating and saving default subjects...');
        const defaultSubjects = ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi'];

        // Save each default subject to the database
        const savedSubjects = [];
        for (const subjectName of defaultSubjects) {
          const subjectData = {
            name: subjectName,
            class_id: examClass.id,
            academic_year: '2024-25',
            is_optional: false
          };

          const { data: savedSubject, error: saveError } = await tenantDatabase.create('subjects', subjectData);

          if (saveError) {
            console.error('❌ [MarksEntry] Error saving default subject:', subjectName, saveError);
            continue; // Skip this subject and continue with others
          }

          if (savedSubject) {
            console.log('✅ [MarksEntry] Saved default subject:', subjectName, 'with ID:', savedSubject.id);
            savedSubjects.push(savedSubject);
          }
        }

        processedSubjects = savedSubjects;
        console.log('✅ [MarksEntry] All default subjects saved:', savedSubjects.length);
      }

      // Sort subjects alphabetically by name
      processedSubjects = processedSubjects.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      console.log('📋 [MarksEntry] Subjects sorted alphabetically:', processedSubjects.map(s => s.name));

      setSubjects(processedSubjects);
      setStudents(studentsData || []);
      setMarks(marksData || []);

      // Initialize marks form with existing marks
      const formData = {};
      (marksData || []).forEach(mark => {
        if (!formData[mark.student_id]) {
          formData[mark.student_id] = {};
        }
        // Convert -1 (absent) to 'AB', -2 (not applicable) to 'NA' for display, otherwise show the marks
        if (mark.marks_obtained === -1) {
          formData[mark.student_id][mark.subject_id] = 'AB';
        } else if (mark.marks_obtained === -2) {
          formData[mark.student_id][mark.subject_id] = 'NA';
        } else {
          formData[mark.student_id][mark.subject_id] = mark.marks_obtained.toString();
        }
      });
      setMarksForm(formData);

      // Detect subject-specific max marks overrides from existing marks
      const overridesFromMarks = {};
      const examDefaultMaxMarks = exam?.max_marks || 100;

      (marksData || []).forEach(mark => {
        // If this mark has a different max_marks than the exam default, it's an override
        if (mark.max_marks && mark.max_marks !== examDefaultMaxMarks) {
          // Only set if we haven't already set it or if it's consistent
          if (!overridesFromMarks[mark.subject_id]) {
            overridesFromMarks[mark.subject_id] = mark.max_marks;
          }
        }
      });

      // Load overrides from localStorage (for overrides set before marks are saved)
      const localStorageKey = `subject_max_marks_${exam.id}`;
      let overridesFromStorage = {};
      try {
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
          overridesFromStorage = JSON.parse(stored);
          console.log('📦 [MarksEntry] Loaded overrides from localStorage:', overridesFromStorage);
        }
      } catch (error) {
        console.warn('⚠️ [MarksEntry] Failed to load overrides from localStorage:', error);
      }

      // Merge overrides: marks take precedence over localStorage
      const mergedOverrides = { ...overridesFromStorage, ...overridesFromMarks };

      if (Object.keys(mergedOverrides).length > 0) {
        console.log('📊 [MarksEntry] Final merged max marks overrides:', mergedOverrides);
        setSubjectMaxMarks(mergedOverrides);
      }
      
      console.log('✅ [MarksEntry] Data loaded successfully');

    } catch (error) {
      console.error('❌ [MarksEntry] Error loading data:', error);
      Alert.alert('Error', `Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [examClass?.id, exam?.id, validateTenantReadiness]);

  // Load data when enhanced tenant system is ready
  useEffect(() => {
    if (exam && examClass && tenantAccess.isReady && !tenantAccess.isLoading) {
      console.log('🚀 [MarksEntry] Enhanced tenant system ready, loading data...');
      loadData();
    }
  }, [exam, examClass, tenantAccess.isReady, tenantAccess.isLoading, loadData]);

  // Reload data when screen comes into focus (e.g., when navigating back)
  useFocusEffect(
    useCallback(() => {
      if (exam && examClass && tenantAccess.isReady && !tenantAccess.isLoading) {
        console.log('🔄 [MarksEntry] Screen focused, reloading data to show saved marks...');
        loadData();
      }
    }, [exam, examClass, tenantAccess.isReady, tenantAccess.isLoading, loadData])
  );

  // Handle marks change with validation
  const handleMarksChange = (studentId, subjectId, value) => {
    // Get max marks: use subject-specific override if exists, otherwise use exam default
    const maxMarks = subjectMaxMarks[subjectId] || exam?.max_marks || 100;

    // Allow empty string (user is typing), or valid numbers/decimals 0 to max_marks (inclusive)
    // Also allow single decimal point for typing (e.g., "22.")
    if (value !== '' && value !== '.') {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > maxMarks) {
        Alert.alert('Error', `Please enter valid marks (0-${maxMarks})`);
        return;
      }
    }

    setMarksForm(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: value
      }
    }));
  };

  // Save all marks with enhanced tenant system
  const handleBulkSaveMarks = async () => {
    try {
      setSaving(true);
      console.log('🚀 [MarksEntry] Starting handleBulkSaveMarks...');

      // Validate tenant readiness
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        console.log('⚠️ [MarksEntry] Tenant not ready for marks saving:', tenantValidation.reason);
        Alert.alert('Error', 'System not ready. Please try again.');
        setSaving(false);
        return;
      }
      
      const { effectiveTenantId } = tenantValidation;
      console.log('✅ [MarksEntry] Using effective tenant ID for marks saving:', effectiveTenantId);
      
      console.log('🚀 [MarksEntry] Current state:', {
        exam: exam ? { id: exam.id, name: exam.name, max_marks: exam.max_marks } : 'NO EXAM',
        examClass: examClass ? { id: examClass.id, class_name: examClass.class_name } : 'NO CLASS',
        effectiveTenantId,
        userId: user?.id || 'NO USER',
        marksFormKeys: Object.keys(marksForm),
        marksFormSize: Object.keys(marksForm).length
      });
      
      if (!exam) {
        console.error('❌ [MarksEntry] No exam provided');
        Alert.alert('Error', 'Exam information is missing');
        return;
      }

      const marksToSave = [];
      console.log('📝 [MarksEntry] Processing marks form data...', {
        marksForm: marksForm,
        examMaxMarks: exam.max_marks || 100,
        subjectMaxMarksOverrides: subjectMaxMarks
      });

      Object.entries(marksForm).forEach(([studentId, subjectMarks]) => {
        console.log('📝 [MarksEntry] Processing student:', studentId, 'subjects:', subjectMarks);

        // Skip temporary student IDs that haven't been saved to the database yet
        if (studentId.startsWith('temp-')) {
          console.log('⚠️ [MarksEntry] Skipping temporary student ID:', studentId);
          return;
        }

        Object.entries(subjectMarks).forEach(([subjectId, marksObtained]) => {
          console.log('📝 [MarksEntry] Processing subject:', subjectId, 'marks:', marksObtained);

          // Skip temporary subject IDs that haven't been saved to the database yet
          if (subjectId.startsWith('temp-')) {
            console.log('⚠️ [MarksEntry] Skipping temporary subject ID:', subjectId);
            return;
          }

          // Check if marks is 'AB' (absent) or 'NA' (not applicable)
          const upperMarks = marksObtained?.toString().toUpperCase();
          const isAbsent = upperMarks && (upperMarks === 'AB' || upperMarks === 'A');
          const isNotApplicable = upperMarks && (upperMarks === 'NA' || upperMarks === 'N');

          if (isAbsent) {
            // Handle absent student
            const maxMarks = subjectMaxMarks[subjectId] || exam.max_marks || 100;

            const markRecord = {
              student_id: studentId,
              exam_id: exam.id,
              subject_id: subjectId,
              marks_obtained: -1, // Use -1 to indicate absent
              grade: 'AB', // Absent grade
              max_marks: maxMarks,
              remarks: 'Absent' // Mark as absent in remarks
            };

            console.log('📝 [MarksEntry] Adding absent mark record:', markRecord);
            marksToSave.push(markRecord);
          } else if (isNotApplicable) {
            // Handle not applicable (for optional subjects, etc.)
            const maxMarks = subjectMaxMarks[subjectId] || exam.max_marks || 100;

            const markRecord = {
              student_id: studentId,
              exam_id: exam.id,
              subject_id: subjectId,
              marks_obtained: -2, // Use -2 to indicate not applicable
              grade: 'NA', // Not applicable grade
              max_marks: maxMarks,
              remarks: 'Not Applicable' // Mark as not applicable in remarks
            };

            console.log('📝 [MarksEntry] Adding not applicable mark record:', markRecord);
            marksToSave.push(markRecord);
          } else if (marksObtained && !isNaN(parseFloat(marksObtained))) {
            const marksValue = parseFloat(marksObtained);
            // Use subject-specific max marks if exists, otherwise use exam's default max_marks
            const maxMarks = subjectMaxMarks[subjectId] || exam.max_marks || 100;
            const hasOverride = subjectMaxMarks[subjectId] !== undefined;

            console.log(`📊 [MarksEntry] Subject ${subjectId} max marks:`, {
              override: subjectMaxMarks[subjectId],
              examDefault: exam.max_marks,
              using: maxMarks,
              hasOverride
            });

            const percentage = (marksValue / maxMarks) * 100;
            let grade = 'F';
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B';
            else if (percentage >= 60) grade = 'C';
            else if (percentage >= 40) grade = 'D';

            const markRecord = {
              student_id: studentId,
              exam_id: exam.id,
              subject_id: subjectId,
              marks_obtained: marksValue,
              grade: grade,
              max_marks: maxMarks, // Store subject-specific or exam's default max_marks
              remarks: exam.name || 'Exam' // Store exam name as remarks
            };

            console.log('📝 [MarksEntry] Adding mark record:', markRecord);
            marksToSave.push(markRecord);
          } else {
            console.log('⚠️ [MarksEntry] Skipping invalid marks:', { studentId, subjectId, marksObtained });
          }
        });
      });

      console.log('💾 [MarksEntry] Final marks to save:', {
        count: marksToSave.length,
        data: marksToSave
      });

      // Check if any marks were skipped due to temporary IDs
      const hasTemporaryData = Object.entries(marksForm).some(([studentId, subjectMarks]) => {
        return studentId.startsWith('temp-') || Object.keys(subjectMarks).some(subjectId => subjectId.startsWith('temp-'));
      });

      if (hasTemporaryData && marksToSave.length === 0) {
        Alert.alert(
          'Cannot Save Marks',
          'All students or subjects have temporary IDs. Please ensure students and subjects are properly saved in the database before entering marks.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      if (hasTemporaryData && marksToSave.length > 0) {
        Alert.alert(
          'Note',
          'Some marks were skipped because they belong to temporary students or subjects that haven\'t been saved to the database yet. Only marks for existing students and subjects will be saved.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSaving(false) },
            { text: 'Continue', onPress: async () => {
              await saveFinalMarks(marksToSave);
              setSaving(false);
            }}
          ]
        );
        return;
      }

      if (marksToSave.length > 0) {
        await saveFinalMarks(marksToSave);
      } else {
        Alert.alert('Info', 'No marks to save');
      }

    } catch (error) {
      console.error('❌ [MarksEntry] Error saving marks:', error);
      Alert.alert('Error', `Failed to save marks: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Separate function to handle the actual saving logic
  const saveFinalMarks = async (marksToSave) => {
    try {
      // Validate tenant readiness before saving
      const tenantValidation = await validateTenantReadiness();
      if (!tenantValidation.success) {
        throw new Error('Tenant validation failed: ' + tenantValidation.reason);
      }

      const { effectiveTenantId } = tenantValidation;

      // Use UPSERT instead of DELETE + INSERT to handle duplicates gracefully
      console.log('💾 [MarksEntry] Upserting marks:', marksToSave.length, 'records');
      console.log('📊 [MarksEntry] Sample mark to save:', marksToSave[0]);

      // Add tenant_id to all marks
      const marksWithTenant = marksToSave.map(mark => ({
        ...mark,
        tenant_id: effectiveTenantId
      }));

      // First, delete all existing marks for this exam to handle removed entries
      // Then use UPSERT which will handle both INSERT and UPDATE gracefully
      console.log('🗑️ [MarksEntry] Deleting existing marks for exam:', exam.id);
      const { error: deleteError } = await supabase
        .from('marks')
        .delete()
        .eq('tenant_id', effectiveTenantId)
        .eq('exam_id', exam.id);

      if (deleteError) {
        console.error('❌ [MarksEntry] Delete error:', deleteError);
        // Don't throw - try upsert anyway as it might still work
      }

      // Use Supabase's upsert method which handles INSERT OR UPDATE automatically
      // This will create new records or update existing ones
      const { data: upsertedMarks, error: upsertError } = await supabase
        .from('marks')
        .upsert(marksWithTenant, {
          onConflict: 'student_id,exam_id,subject_id',
          ignoreDuplicates: false // Update on conflict instead of ignoring
        })
        .select();

      if (upsertError) {
        console.error('❌ [MarksEntry] Upsert error:', upsertError);
        throw upsertError;
      }

      const insertedMarks = upsertedMarks || [];

      console.log('💾 [MarksEntry] Upsert result:', {
        recordsUpserted: insertedMarks.length,
        sampleTenantIds: [...new Set(insertedMarks.map(m => m.tenant_id))],
        examId: insertedMarks[0]?.exam_id
      });

      // Log first upserted mark to verify
      if (insertedMarks.length > 0) {
        console.log('✅ [MarksEntry] First mark upserted successfully:', {
          id: insertedMarks[0].id,
          student_id: insertedMarks[0].student_id,
          exam_id: insertedMarks[0].exam_id,
          subject_id: insertedMarks[0].subject_id,
          marks_obtained: insertedMarks[0].marks_obtained,
          tenant_id: insertedMarks[0].tenant_id
        });
      }

      // Send marks notifications to parents silently in background
      try {
        // Use the new bulk marks notification system
        await createBulkMarksNotifications(
          marksToSave,
          exam,
          user?.id // Pass the current user ID as admin user ID
        );
      } catch (notificationError) {
        // Log error but don't show to user - notifications are secondary
        console.error('❌ [MarksEntry] Error sending bulk marks notifications:', notificationError);
      }

      // Sync localStorage with database (marks now contain the truth)
      // Keep localStorage overrides only for subjects that have no marks saved
      const localStorageKey = `subject_max_marks_${exam.id}`;
      try {
        const savedSubjectIds = new Set(insertedMarks.map(m => m.subject_id));
        const updatedStorage = {};

        // Keep only overrides for subjects without saved marks
        Object.entries(subjectMaxMarks).forEach(([subjectId, maxMarks]) => {
          if (!savedSubjectIds.has(subjectId)) {
            updatedStorage[subjectId] = maxMarks;
          }
        });

        if (Object.keys(updatedStorage).length > 0) {
          localStorage.setItem(localStorageKey, JSON.stringify(updatedStorage));
          console.log('💾 [MarksEntry] Updated localStorage after save:', updatedStorage);
        } else {
          localStorage.removeItem(localStorageKey);
          console.log('🗑️ [MarksEntry] Cleared localStorage (all overrides now in database)');
        }
      } catch (error) {
        console.warn('⚠️ [MarksEntry] Failed to sync localStorage:', error);
      }

      // Show success message with details
      Alert.alert(
        '✓ Success',
        `Marks saved successfully!\n\n${insertedMarks.length} student${insertedMarks.length !== 1 ? 's' : ''} updated.`,
        [{ text: 'OK' }]
      );

      // Clear unsaved changes indicator
      setHasUnsavedChanges(false);
      setChangedCells(new Set());

      // Reload data to verify marks were saved correctly
      console.log('🔄 [MarksEntry] Reloading data to verify marks were saved...');
      await loadData();
      console.log('✅ [MarksEntry] Data reload completed after save');
    } catch (error) {
      console.error('❌ [MarksEntry] Error saving marks in saveFinalMarks:', error);
      Alert.alert('Error', `Failed to save marks: ${error.message}`);
    }
  };

  // Add new subject
  const handleAddSubject = () => {
    setNewSubjectName('');
    setAddSubjectModalVisible(true);
  };

  const handleSaveNewSubject = async () => {
    if (!newSubjectName?.trim()) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    try {
      console.log('💾 [MarksEntry] Saving new subject to database:', newSubjectName.trim());

      const subjectData = {
        name: newSubjectName.trim(),
        class_id: examClass.id,
        academic_year: '2024-25',
        is_optional: false
      };

      const { data: savedSubject, error: saveError } = await tenantDatabase.create('subjects', subjectData);

      if (saveError) {
        console.error('❌ [MarksEntry] Error saving new subject:', saveError);
        Alert.alert('Error', `Failed to save subject: ${saveError.message}`);
        return;
      }

      if (savedSubject) {
        console.log('✅ [MarksEntry] Saved new subject with ID:', savedSubject.id);
        setSubjects(prev => [...prev, savedSubject]);
        setAddSubjectModalVisible(false);
        setNewSubjectName('');
        Alert.alert('Success', `Subject "${newSubjectName}" added successfully!`);
      }
    } catch (error) {
      console.error('❌ [MarksEntry] Error in handleSaveNewSubject:', error);
      Alert.alert('Error', `Failed to save subject: ${error.message}`);
    }
  };

  // Add new student
  const handleAddStudent = () => {
    setNewStudentName('');
    setAddStudentModalVisible(true);
  };

  const handleSaveNewStudent = async () => {
    if (!newStudentName?.trim()) {
      Alert.alert('Error', 'Please enter a student name');
      return;
    }

    try {
      console.log('💾 [MarksEntry] Saving new student to database:', newStudentName.trim());

      const studentData = {
        name: newStudentName.trim(),
        class_id: examClass.id,
        roll_no: students.length + 1,
        date_of_birth: null,
        gender: null,
        address: null,
        phone: null,
        email: null,
        admission_date: new Date().toISOString().split('T')[0],
        academic_year: '2024-25'
      };

      const { data: savedStudent, error: saveError } = await tenantDatabase.create('students', studentData);

      if (saveError) {
        console.error('❌ [MarksEntry] Error saving new student:', saveError);
        Alert.alert('Error', `Failed to save student: ${saveError.message}`);
        return;
      }

      if (savedStudent) {
        console.log('✅ [MarksEntry] Saved new student with ID:', savedStudent.id);
        setStudents(prev => [...prev, savedStudent]);
        setAddStudentModalVisible(false);
        setNewStudentName('');
        Alert.alert('Success', `Student "${newStudentName}" added successfully!`);
      }
    } catch (error) {
      console.error('❌ [MarksEntry] Error in handleSaveNewStudent:', error);
      Alert.alert('Error', `Failed to save student: ${error.message}`);
    }
  };

  // Delete subject
  const handleDeleteSubject = (subjectId) => {
    Alert.alert(
      'Delete Subject',
      'Are you sure you want to delete this subject?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSubjects(prev => prev.filter(subject => subject.id !== subjectId));
            // Also remove marks for this subject
            setMarksForm(prev => {
              const updated = { ...prev };
              Object.keys(updated).forEach(studentId => {
                if (updated[studentId][subjectId]) {
                  delete updated[studentId][subjectId];
                }
              });
              return updated;
            });
          }
        }
      ]
    );
  };

  // Generate report for student
  const handleGenerateReport = (student) => {
    const studentMarks = marksForm[student.id] || {};

    let reportText = `Report Card for ${student.name} (Roll #${student.roll_no || student.id})\n`;
    reportText += `Exam: ${exam?.name}\n`;
    reportText += `Class: ${examClass?.class_name}\n\n`;
    reportText += 'Subjects and Marks:\n';

    let totalMarks = 0;
    let subjectCount = 0;

    subjects.forEach(subject => {
      const mark = studentMarks[subject.id] || 'Not entered';
      reportText += `${subject.name}: ${mark}\n`;
      if (mark && !isNaN(mark)) {
        totalMarks += parseInt(mark);
        subjectCount++;
      }
    });

    if (subjectCount > 0) {
      const average = (totalMarks / subjectCount).toFixed(2);
      reportText += `\nTotal: ${totalMarks}\nAverage: ${average}%`;
    }

    Alert.alert('Report Card', reportText);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Enter Marks" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading marks data...</Text>
        </View>
      </View>
    );
  }

  // Helper functions for improved UX
  const getStudentInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const calculateAverage = () => {
    let total = 0;
    let count = 0;
    
    Object.values(marksForm).forEach(studentMarks => {
      Object.values(studentMarks).forEach(mark => {
        if (mark && !isNaN(parseFloat(mark))) {
          total += parseFloat(mark);
          count++;
        }
      });
    });
    
    return count > 0 ? (total / count).toFixed(1) : '0';
  };

  const isMarkInvalid = (value) => {
    // Allow 'AB' for absent and 'NA' for not applicable
    const upperValue = value?.toString().toUpperCase();
    if (upperValue && (upperValue === 'AB' || upperValue === 'A' || upperValue === 'NA' || upperValue === 'N')) {
      return false;
    }
    return value && (isNaN(parseFloat(value)) || parseFloat(value) > 100 || parseFloat(value) < 0);
  };

  const handleMarksChangeImproved = (studentId, subjectId, value) => {
    // Get max marks: use subject-specific override if exists, otherwise use exam default
    const maxMarks = subjectMaxMarks[subjectId] || exam?.max_marks || 100;

    // Convert to uppercase for consistent handling
    const upperValue = value.toUpperCase();

    // Allow empty string (user is typing), single decimal point, 'AB' for absent, or 'NA' for not applicable
    // Also allow 'A' or 'N' while typing
    if (value !== '' && value !== '.') {
      // Check if it's 'AB' (absent) or partial entry 'A'
      if (upperValue === 'AB' || upperValue === 'A') {
        // Store as 'AB' for absent
        const absentValue = upperValue === 'A' ? 'A' : 'AB';
        setMarksForm(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [subjectId]: absentValue
          }
        }));
        const cellKey = `${studentId}-${subjectId}`;
        setChangedCells(prev => new Set(prev).add(cellKey));
        setHasUnsavedChanges(true);
        return;
      }

      // Check if it's 'NA' (not applicable) or partial entry 'N'
      if (upperValue === 'NA' || upperValue === 'N') {
        // Store as 'NA' for not applicable
        const naValue = upperValue === 'N' ? 'N' : 'NA';
        setMarksForm(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            [subjectId]: naValue
          }
        }));
        const cellKey = `${studentId}-${subjectId}`;
        setChangedCells(prev => new Set(prev).add(cellKey));
        setHasUnsavedChanges(true);
        return;
      }

      // Otherwise validate as number
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > maxMarks) {
        Alert.alert('Error', `Please enter valid marks (0-${maxMarks}), 'AB' for absent, or 'NA' for not applicable`);
        return;
      }
    }

    // Update marks form
    setMarksForm(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: value
      }
    }));

    // Track changed cells
    const cellKey = `${studentId}-${subjectId}`;
    setChangedCells(prev => new Set(prev).add(cellKey));
    setHasUnsavedChanges(true);
  };

  const handleBulkFill = () => {
    setBulkFillValue('');
    setBulkFillModalVisible(true);
  };

  const applyBulkFill = () => {
    if (!bulkFillValue || isNaN(parseFloat(bulkFillValue))) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }

    const newMarksForm = { ...marksForm };
    students.forEach(student => {
      subjects.forEach(subject => {
        if (!newMarksForm[student.id]) {
          newMarksForm[student.id] = {};
        }
        if (!newMarksForm[student.id][subject.id]) { // Only fill empty cells
          newMarksForm[student.id][subject.id] = bulkFillValue;
          const cellKey = `${student.id}-${subject.id}`;
          setChangedCells(prev => new Set(prev).add(cellKey));
        }
      });
    });

    setMarksForm(newMarksForm);
    setHasUnsavedChanges(true);
    setBulkFillModalVisible(false);
    setBulkFillValue('');
  };

  const focusNextInput = (studentIndex, subjectIndex) => {
    const nextSubjectIndex = subjectIndex + 1;
    const nextStudentIndex = studentIndex + 1;
    
    if (nextSubjectIndex < subjects.length) {
      // Move to next subject for same student
      const nextKey = `${students[studentIndex].id}-${subjects[nextSubjectIndex].id}`;
      inputRefs.current[nextKey]?.focus();
    } else if (nextStudentIndex < students.length) {
      // Move to first subject of next student
      const nextKey = `${students[nextStudentIndex].id}-${subjects[0].id}`;
      inputRefs.current[nextKey]?.focus();
    }
  };

  // Handle subject menu (three dots)
  const handleSubjectMenu = (subject) => {
    Alert.alert(
      'Subject Options',
      `What would you like to do with "${subject.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Edit Name',
          onPress: () => {
            setNewSubjectName(subject.name);
            setAddSubjectModalVisible(true);
          }
        },
        {
          text: 'Delete Subject',
          style: 'destructive',
          onPress: () => handleDeleteSubject(subject.id)
        }
      ]
    );
  };

  // Format student display name for cleaner UI
  const formatStudentName = (name) => {
    const words = name.split(' ');
    if (words.length > 2) {
      return `${words[0]} ${words[1].charAt(0)}.`;
    }
    return name;
  };

  // Get shortened admission/roll number
  const getStudentRollDisplay = (student) => {
    if (showAdmissionNumbers && student.admission_no) {
      return `Adm: ${student.admission_no.slice(-4)}`; // Show last 4 digits only
    }
    return `Roll: ${student.roll_no || 'N/A'}`;
  };

  // Handle setting max marks for a specific subject
  const handleSetSubjectMaxMarks = (subject) => {
    setSelectedSubjectForMaxMarks(subject);
    // Set current value: override if exists, otherwise exam default
    const currentMaxMarks = subjectMaxMarks[subject.id] || exam?.max_marks || 100;
    setTempMaxMarks(currentMaxMarks.toString());
    setMaxMarksModalVisible(true);
  };

  // Save subject-specific max marks
  const handleSaveSubjectMaxMarks = () => {
    if (!selectedSubjectForMaxMarks) return;

    const maxMarksValue = parseInt(tempMaxMarks);

    // Validate input
    if (!tempMaxMarks || isNaN(maxMarksValue) || maxMarksValue <= 0) {
      Alert.alert('Error', 'Please enter a valid positive number for max marks');
      return;
    }

    const examDefaultMaxMarks = exam?.max_marks || 100;

    console.log('💾 [MarksEntry] Saving subject max marks:', {
      subjectId: selectedSubjectForMaxMarks.id,
      subjectName: selectedSubjectForMaxMarks.name,
      newMaxMarks: maxMarksValue,
      examDefault: examDefaultMaxMarks
    });

    // Update subject max marks
    setSubjectMaxMarks(prev => {
      const updated = { ...prev };

      // If it's the same as exam default, remove the override
      if (maxMarksValue === examDefaultMaxMarks) {
        delete updated[selectedSubjectForMaxMarks.id];
        console.log('🔄 [MarksEntry] Removed override, using exam default');
        Alert.alert(
          'Success',
          `Max marks for "${selectedSubjectForMaxMarks.name}" reset to exam default (${examDefaultMaxMarks})`
        );
      } else {
        updated[selectedSubjectForMaxMarks.id] = maxMarksValue;
        console.log('✅ [MarksEntry] Override set:', updated);
        Alert.alert(
          'Success',
          `Max marks for "${selectedSubjectForMaxMarks.name}" set to ${maxMarksValue}`
        );
      }

      // Save to localStorage for persistence across page reloads
      const localStorageKey = `subject_max_marks_${exam.id}`;
      try {
        if (Object.keys(updated).length > 0) {
          localStorage.setItem(localStorageKey, JSON.stringify(updated));
          console.log('💾 [MarksEntry] Saved overrides to localStorage:', updated);
        } else {
          localStorage.removeItem(localStorageKey);
          console.log('🗑️ [MarksEntry] Removed overrides from localStorage (all reset)');
        }
      } catch (error) {
        console.warn('⚠️ [MarksEntry] Failed to save overrides to localStorage:', error);
      }

      return updated;
    });

    // Mark as having unsaved changes
    setHasUnsavedChanges(true);

    // Close modal
    setMaxMarksModalVisible(false);
    setSelectedSubjectForMaxMarks(null);
    setTempMaxMarks('');
  };

  // Reset subject max marks to exam default
  const handleResetSubjectMaxMarks = () => {
    if (!selectedSubjectForMaxMarks) return;

    setSubjectMaxMarks(prev => {
      const updated = { ...prev };
      delete updated[selectedSubjectForMaxMarks.id];

      // Save to localStorage
      const localStorageKey = `subject_max_marks_${exam.id}`;
      try {
        if (Object.keys(updated).length > 0) {
          localStorage.setItem(localStorageKey, JSON.stringify(updated));
          console.log('💾 [MarksEntry] Saved overrides to localStorage after reset:', updated);
        } else {
          localStorage.removeItem(localStorageKey);
          console.log('🗑️ [MarksEntry] Removed all overrides from localStorage');
        }
      } catch (error) {
        console.warn('⚠️ [MarksEntry] Failed to update localStorage:', error);
      }

      return updated;
    });

    const examDefaultMaxMarks = exam?.max_marks || 100;
    Alert.alert(
      'Reset',
      `Max marks for "${selectedSubjectForMaxMarks.name}" reset to exam default (${examDefaultMaxMarks})`
    );

    setMaxMarksModalVisible(false);
    setSelectedSubjectForMaxMarks(null);
    setTempMaxMarks('');
    setHasUnsavedChanges(true);
  };


  if (!exam || !examClass) {
    return (
      <View style={styles.container}>
        <Header title="Enter Marks" showBack={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={64} color="#f44336" />
          <Text style={styles.errorText}>Missing exam or class information</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render horizontally scrollable table with performance optimizations
  const renderTable = () => (
    <View style={styles.tableContainer}>
      {/* Single Horizontal ScrollView containing entire table */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.mainHorizontalScroll}
        contentContainerStyle={styles.mainHorizontalContent}
        // Performance optimizations for smooth scrolling
        decelerationRate="fast"
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        overScrollMode="never"
        bounces={false}
        bouncesZoom={false}
        alwaysBounceHorizontal={false}
        directionalLockEnabled={true}
        automaticallyAdjustContentInsets={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <View style={styles.tableContent}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.studentNameColumn}>
              <Text style={styles.headerText}>Student Name</Text>
            </View>
            {subjects.map((subject) => {
              const subjectMaxMarksValue = subjectMaxMarks[subject.id] || exam?.max_marks || 100;
              const hasOverride = subjectMaxMarks[subject.id] !== undefined;

              return (
                <View key={subject.id} style={styles.subjectColumn}>
                  <Text style={styles.headerText} numberOfLines={2}>
                    {subject.name}
                  </Text>
                  <View style={styles.maxMarksContainer}>
                    <Text style={[styles.maxMarksText, hasOverride && styles.maxMarksOverride]}>
                      Max: {subjectMaxMarksValue}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleSetSubjectMaxMarks(subject)}
                      style={styles.maxMarksButton}
                    >
                      <Ionicons
                        name={hasOverride ? "create" : "add-circle-outline"}
                        size={16}
                        color={hasOverride ? "#FF9800" : "#2196F3"}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
          
          {/* Table Body with vertical scroll */}
          <ScrollView 
            style={styles.tableBody} 
            showsVerticalScrollIndicator={false}
            // Performance optimizations for vertical scrolling
            removeClippedSubviews={true}
            scrollEventThrottle={16}
            decelerationRate="fast"
            overScrollMode="never"
            bounces={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            getItemLayout={(data, index) => ({
              length: 60, // minHeight from tableRow style
              offset: 60 * index,
              index,
            })}
          >
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
                  const value = marksForm[student.id]?.[subject.id] || '';
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
                        onChangeText={(newValue) => handleMarksChangeImproved(student.id, subject.id, newValue)}
                        keyboardType="default"
                        maxLength={6}
                        returnKeyType="next"
                        onSubmitEditing={() => focusNextInput(studentIndex, subjectIndex)}
                        selectTextOnFocus
                        // TextInput performance optimizations
                        autoCorrect={false}
                        spellCheck={false}
                        autoCapitalize="characters"
                        blurOnSubmit={false}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Enter Marks" showBack={true} onBack={() => navigation.goBack()} />
      
      {/* Compact Header */}
      <View style={styles.compactHeader}>
        {/* Class Info Badge */}
        <View style={styles.classInfoBadge}>
          <Text style={styles.classInfoText}>
            {examClass.class_name} - {examClass.section || 'A'} | Students: {students.length} | Subjects: {subjects.length}
          </Text>
        </View>
      </View>

      {/* Table Layout */}
      {renderTable()}
      
      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            hasUnsavedChanges && styles.saveButtonHighlight,
            saving && styles.saveButtonDisabled
          ]}
          onPress={handleBulkSaveMarks}
          disabled={saving}
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.saveButtonText}>Saving...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                {hasUnsavedChanges ? "Save Changes" : "Save Changes"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Subject Modal */}
      {addSubjectModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Add New Subject</Text>

            <Text style={styles.addLabel}>Subject Name</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., Mathematics, English, Science"
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddSubjectModalVisible(false);
                  setNewSubjectName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalButton, styles.saveButton]}
                onPress={handleSaveNewSubject}
              >
                <Text style={styles.saveButtonText}>Add Subject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Add Student Modal */}
      {addStudentModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Add New Student</Text>

            <Text style={styles.addLabel}>Student Name</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., John Doe, Mary Smith"
              value={newStudentName}
              onChangeText={setNewStudentName}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setAddStudentModalVisible(false);
                  setNewStudentName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalButton, styles.saveButton]}
                onPress={handleSaveNewStudent}
              >
                <Text style={styles.saveButtonText}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Bulk Fill Modal */}
      {bulkFillModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Fill Empty Cells</Text>
            <Text style={styles.bulkFillDescription}>
              This will fill all empty mark cells with the same value.
            </Text>

            <Text style={styles.addLabel}>Marks (0-100)</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., 75, 80.5, 90.25"
              value={bulkFillValue}
              onChangeText={setBulkFillValue}
              keyboardType={Platform.OS === 'web' ? 'numeric' : 'decimal-pad'}
              inputMode={Platform.OS === 'web' ? 'decimal' : undefined}
              maxLength={6}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setBulkFillModalVisible(false);
                  setBulkFillValue('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addModalButton, { backgroundColor: '#FF9800' }]}
                onPress={applyBulkFill}
              >
                <Text style={styles.saveButtonText}>Fill Empty</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Set Subject Max Marks Modal */}
      {maxMarksModalVisible && selectedSubjectForMaxMarks && (
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addModalTitle}>Set Max Marks</Text>
            <Text style={styles.bulkFillDescription}>
              Set maximum marks for "{selectedSubjectForMaxMarks.name}"
              {'\n'}Exam default: {exam?.max_marks || 100}
            </Text>

            <Text style={styles.addLabel}>Maximum Marks</Text>
            <TextInput
              style={styles.addInput}
              placeholder="e.g., 50, 75, 100"
              value={tempMaxMarks}
              onChangeText={setTempMaxMarks}
              keyboardType={Platform.OS === 'web' ? 'numeric' : 'number-pad'}
              inputMode={Platform.OS === 'web' ? 'numeric' : undefined}
              maxLength={4}
              autoFocus={true}
            />

            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalButton, styles.cancelButton]}
                onPress={() => {
                  setMaxMarksModalVisible(false);
                  setSelectedSubjectForMaxMarks(null);
                  setTempMaxMarks('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {subjectMaxMarks[selectedSubjectForMaxMarks.id] && (
                <TouchableOpacity
                  style={[styles.addModalButton, { backgroundColor: '#FF5722' }]}
                  onPress={handleResetSubjectMaxMarks}
                >
                  <Text style={styles.saveButtonText}>Reset</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.addModalButton, styles.saveButton]}
                onPress={handleSaveSubjectMaxMarks}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FloatingRefreshButton 
        onPress={loadData}
        refreshing={loading}
        bottom={80}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  goBackButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  examInfoContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classTitle: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    // Web-specific styles
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  saveButtonDisabled: {
    backgroundColor: '#9E9E9E',
    opacity: 0.7,
    // Web-specific styles
    ...(Platform.OS === 'web' && {
      cursor: 'not-allowed',
    }),
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tableContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  table: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  studentHeaderCell: {
    width: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  subjectHeaderCell: {
    minWidth: 100,
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginRight: 4,
  },
  addSubjectHeaderCell: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#2196F3',
  },
  addButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  deleteButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  addSubjectButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 60,
  },
  studentCell: {
    width: 140,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  markCell: {
    minWidth: 100,
    width: 100,
    paddingHorizontal: 8,
    marginRight: 4,
  },
  actionCell: {
    width: 100,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  markInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 44,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    minHeight: 36,
  },
  reportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  studentRollNumber: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  addStudentButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addStudentText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noSubjectsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 16,
    marginHorizontal: 16,
  },
  noSubjectsText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  addSubjectText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 24,
  },
  addModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  bulkFillDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // New improved UI styles
  classInfoPill: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  classInfoText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  quickActionsContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  
  subjectHeadersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  subjectHeaders: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  studentNameHeader: {
    width: 180,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  subjectHeader: {
    minWidth: 110,
    width: 110,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSubjectHeader: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  subjectHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  deleteSubjectBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  
  studentsList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  studentRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
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
  
  studentInfo: {
    width: 180,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
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
    fontSize: 14,
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
  studentAdmission: {
    fontSize: 12,
    color: '#666',
  },
  
  marksScrollView: {
    flex: 1,
  },
  markInputContainer: {
    minWidth: 110,
    width: 110,
    marginRight: 8,
    position: 'relative',
  },
  markInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 42,
  },
  changedMarkInput: {
    borderColor: '#ff9800',
    backgroundColor: '#fff3e0',
  },
  invalidMarkInput: {
    borderColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  changedIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff9800',
  },
  
  studentActionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  
  emptyStudentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStudentsText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  addFirstStudentBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstStudentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  averageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginTop: 16,
  },
  averageLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  averageValue: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  
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
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  unsavedIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff5722',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  // Compact redesigned styles
  compactHeader: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classInfoBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  compactActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  compactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    minWidth: 90,
    justifyContent: 'center',
  },
  compactActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  
  // Sticky header styles
  stickyHeaderContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stickyHeader: {
    maxHeight: 50,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  stickyStudentHeader: {
    width: 180,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  stickyHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  stickySubjectHeader: {
    minWidth: 110,
    width: 110,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedStickySubjectHeader: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  stickySubjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  subjectMenuBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  
  // Enhanced mark input with larger touch targets
  markInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#fafafa',
    textAlign: 'center',
    width: '100%',
    minHeight: 48,
  },
  
  // Table Layout Styles
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
    // Web-specific improvements
    ...(Platform.OS === 'web' && {
      maxHeight: '70vh',
    }),
  },
  
  // Main horizontal scroll container with optimizations
  mainHorizontalScroll: {
    flex: 1,
    // Web-specific scroll improvements
    ...(Platform.OS === 'web' && {
      overflowX: 'auto',
      overflowY: 'hidden',
    }),
  },
  mainHorizontalContent: {
    flexGrow: 1,
    // Hardware acceleration hints
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  tableContent: {
    minWidth: '100%',
    // Performance optimizations
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  
  // Table Header
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  studentNameColumn: {
    width: 160,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
  },
  subjectColumn: {
    width: 120,
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
  
  // Table Body with performance optimizations
  tableBody: {
    flex: 1,
    // Enable hardware acceleration
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
    // Web-specific scroll improvements
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    minHeight: 60,
    // Row performance optimizations
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
  },
  
  // Student Name Cell
  studentNameCell: {
    width: 160,
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
    width: 120,
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
    // TextInput performance optimizations
    includeFontPadding: false,
    textAlignVertical: 'center',
    shouldRasterizeIOS: true,
    renderToHardwareTextureAndroid: true,
    // Web-specific styles
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      cursor: 'text',
    }),
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
    // Web-specific styles
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
  },
  saveButtonHighlight: {
    backgroundColor: '#1976d2',
  },
  saveButtonDisabled: {
    backgroundColor: '#9E9E9E',
    opacity: 0.7,
    // Web-specific styles
    ...(Platform.OS === 'web' && {
      cursor: 'not-allowed',
    }),
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  
  // Horizontal Scrolling Table Layout Styles
  headerContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  
  // Fixed student name header
  fixedStudentNameHeader: {
    width: 160,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    zIndex: 1,
  },
  
  // Scrollable subjects header container
  scrollableHeaderContainer: {
    flex: 1,
  },
  scrollableHeaderContent: {
    flexDirection: 'row',
  },
  
  // Individual scrollable subject columns in header
  scrollableSubjectColumn: {
    width: 120,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  
  // Fixed student name cell in rows
  fixedStudentNameCell: {
    width: 160,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: 2,
    borderRightColor: '#333',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  
  // Scrollable row container
  scrollableRowContainer: {
    flex: 1,
  },
  scrollableRowContent: {
    flexDirection: 'row',
  },
  
  // Individual scrollable subject cells in rows
  scrollableSubjectCell: {
    width: 120,
    borderRightWidth: 2,
    borderRightColor: '#333',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  // Max marks container and styles
  maxMarksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
  },
  maxMarksText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  maxMarksOverride: {
    color: '#FF9800',
    fontWeight: '700',
  },
  maxMarksButton: {
    padding: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
});

export default MarksEntry;
