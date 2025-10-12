import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import FloatingRefreshButton from '../../components/FloatingRefreshButton';
import { Picker } from '@react-native-picker/picker';
import { supabase, TABLES } from '../../utils/supabase';
import { useTenantAccess } from '../../contexts/TenantContext';
import { tenantDatabase, getCachedTenantId } from '../../utils/tenantHelpers';
import { useAuth } from '../../utils/AuthContext';
import { validateTenantAccess } from '../../utils/tenantValidation';

const ManageClasses = ({ navigation }) => {
  const { 
    tenantId,
    isReady, 
    isLoading: tenantLoading, 
    tenant, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // 🏢 LOG: Component initialization with optimized logging
  console.log('🏢 ManageClasses: Component initialized with email-based tenant system');
  console.log('🏢 ManageClasses: Initial context:', {
    tenantId: tenantId || 'NULL',
    tenantName: tenant?.name || 'NULL',
    userEmail: user?.email || 'NULL',
    tenantLoading
  });
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState(['A', 'B', 'C', 'D']);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [newClass, setNewClass] = useState({
    class_name: '',
    academic_year: '2024-25',
    section: '',
    class_teacher_id: '',
  });
  const [classDetailsModal, setClassDetailsModal] = useState(false);
  const [selectedClassDetails, setSelectedClassDetails] = useState(null);
  const [classSubjects, setClassSubjects] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Pagination state
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // 🛡️ Enhanced tenant validation function
  const validateTenantAccessLocal = () => {
    if (!isReady) {
      return { valid: false, error: 'Tenant context not ready' };
    }
    
    const cachedTenantId = getCachedTenantId();
    if (!cachedTenantId) {
      return { valid: false, error: 'No tenant ID available' };
    }
    
    if (!user) {
      return { valid: false, error: 'User not authenticated' };
    }
    
    return { valid: true, tenantId: cachedTenantId };
  };

  // 🚀 Enhanced tenant context loading
  useEffect(() => {
    console.log('🔄 ManageClasses: Enhanced tenant context changed');
    console.log('📍 ManageClasses: Enhanced tenant status:', {
      isReady,
      tenantLoading,
      tenantId: tenantId || 'null',
      tenantName: tenantName || 'null',
      userId: user?.id || 'null',
      hasError: !!tenantError
    });
    
    // Only load data when tenant is ready
    if (isReady && user) {
      console.log('🚀 ManageClasses: Tenant ready, loading data...');
      loadAllData();
    } else if (tenantError) {
      console.error('❌ ManageClasses: Tenant error detected:', tenantError);
      setError(tenantError);
    } else {
      console.log('⏳ ManageClasses: Waiting for tenant to be ready...', {
        isReady,
        hasUser: !!user,
        tenantLoading
      });
    }
  }, [isReady, user, tenantError]);

  // Debug modal state changes
  useEffect(() => {
    console.log('🔧 ManageClasses: Class details modal state changed:', classDetailsModal);
    if (classDetailsModal && selectedClassDetails) {
      console.log('🔧 ManageClasses: Selected class details:', selectedClassDetails.class_name);
    }
  }, [classDetailsModal, selectedClassDetails]);

  const loadAllData = async () => {
    const startTime = performance.now();
    setLoading(true);
    
    // 🚀 Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('❌ ManageClasses: Loading timeout (10s)');
      setError('Loading timeout. Please check your internet connection.');
      setLoading(false);
    }, 10000);
    
    try {
      console.log('🏢 ManageClasses: Starting enhanced tenant data loading...');
      
      // 🛡️ Enhanced tenant validation
      const validation = validateTenantAccessLocal();
      if (!validation.valid) {
        throw new Error(`Tenant validation failed: ${validation.error}`);
      }
      
      // Fetch teachers once (narrow projection)
      console.log('🏢 ManageClasses: Fetching teachers...');
      const teachersResult = await tenantDatabase.read(TABLES.TEACHERS, {}, 'id, name');
      const { data: teacherData, error: teacherError } = teachersResult;
      if (teacherError) {
        console.error('❌ ManageClasses: Teachers query failed:', teacherError.message);
        throw new Error(`Failed to load teachers: ${teacherError.message}`);
      }
      setTeachers(teacherData || []);

      // Reset pagination state and load first page of classes
      setClasses([]);
      setPage(0);
      setHasMore(true);
      await loadClassesPage(0, true);
      
      console.log('📊 ManageClasses: Data loaded successfully:', {
        classes: (Array.isArray(classes) ? classes.length : 0),
        teachers: teacherData?.length || 0,
        tenantId
      });
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ ManageClasses: Data loaded in ${loadTime}ms`);
      
      if (loadTime > 2000) {
        console.warn('⚠️ ManageClasses: Slow loading (>2s). Check network.');
      } else {
        console.log('🚀 ManageClasses: Fast loading achieved!');
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ ManageClasses: Failed to load data:', error.message);
      Alert.alert('Error', error.message || 'Failed to load classes and teachers');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  // Load one page of classes with counts
  const loadClassesPage = async (pageNumber = 0, replace = false) => {
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const cachedTenantId = getCachedTenantId();
    if (!cachedTenantId) throw new Error('No tenant ID available for pagination');

    setLoadingPage(true);
    try {
      // Fetch one page of classes
      const { data: classPage, error: classError } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, section, academic_year, class_teacher_id')
        .eq('tenant_id', cachedTenantId)
        .order('class_name', { ascending: true })
        .range(from, to);

      if (classError) throw classError;

      const pageHasMore = (classPage?.length || 0) === PAGE_SIZE;
      setHasMore(pageHasMore);

      const classIds = (classPage || []).map(c => c.id);
      let classesWithCounts = classPage || [];

      if (classIds.length > 0) {
        // Fetch students and subjects for just these classes to compute counts
        const [studentsRes, subjectsRes] = await Promise.all([
          supabase.from(TABLES.STUDENTS).select('id, class_id').eq('tenant_id', cachedTenantId).in('class_id', classIds),
          supabase.from(TABLES.SUBJECTS).select('id, class_id').eq('tenant_id', cachedTenantId).in('class_id', classIds),
        ]);

        if (studentsRes.error) console.warn('Warning: Student count query failed:', studentsRes.error.message);
        if (subjectsRes.error) console.warn('Warning: Subject count query failed:', subjectsRes.error.message);

        const students = studentsRes.data || [];
        const subjects = subjectsRes.data || [];

        const studentCounts = new Map();
        for (const s of students) {
          if (!s.class_id) continue;
          studentCounts.set(s.class_id, (studentCounts.get(s.class_id) || 0) + 1);
        }
        const subjectCounts = new Map();
        for (const sub of subjects) {
          if (!sub.class_id) continue;
          subjectCounts.set(sub.class_id, (subjectCounts.get(sub.class_id) || 0) + 1);
        }

        classesWithCounts = (classPage || []).map(cls => ({
          ...cls,
          students_count: studentCounts.get(cls.id) || 0,
          subjects_count: subjectCounts.get(cls.id) || 0,
        }));
      }

      if (replace) {
        setClasses(classesWithCounts);
      } else {
        setClasses(prev => [...(prev || []), ...classesWithCounts]);
      }
      setPage(pageNumber);
      setInitialLoaded(true);
    } finally {
      setLoadingPage(false);
    }
  };

  const handleAddClass = async () => {
    try {
      // 🛡️ Enhanced tenant validation
      const validation = validateTenantAccessLocal();
      if (!validation.valid) {
        Alert.alert('Access Denied', validation.error);
        return;
      }

      if (!newClass.class_name || !newClass.section) {
        Alert.alert('Error', 'Please fill in class name and section');
        return;
      }

      console.log('🏠 ManageClasses: Creating new class with enhanced tenant system');
      console.log('📋 ManageClasses: Class data for insert:', {
        class_name: newClass.class_name,
        academic_year: newClass.academic_year,
        section: newClass.section,
        class_teacher_id: newClass.class_teacher_id || null
      });
      
      // First, check if a class with the same name, section, and academic year already exists using enhanced helpers
      console.log('🔍 ManageClasses: Checking for existing class using enhanced tenant system');
      const { data: existingClass, error: checkError } = await tenantDatabase.read(
        TABLES.CLASSES,
        {
          class_name: newClass.class_name,
          section: newClass.section,
          academic_year: newClass.academic_year
        },
        'id, class_name, section, academic_year'
      );
      
      if (checkError) {
        console.error('❌ ManageClasses: Error checking for existing class:', checkError);
        throw checkError;
      }
      
      if (existingClass && existingClass.length > 0) {
        console.log('⚠️ ManageClasses: Duplicate class found:', existingClass[0]);
        const errorMessage = `A class "${newClass.class_name}${newClass.section}" already exists for academic year "${newClass.academic_year}" in your school. Please choose a different class name, section, or academic year.`;
        Alert.alert('Duplicate Class', errorMessage);
        return; // Don't proceed with insert
      }
      
      console.log('✅ ManageClasses: No duplicate found, proceeding with enhanced insert');
      
      // Insert a new class using enhanced tenant database helpers
      const { data: insertedData, error } = await tenantDatabase.create(TABLES.CLASSES, {
        class_name: newClass.class_name,
        academic_year: newClass.academic_year,
        section: newClass.section,
        class_teacher_id: newClass.class_teacher_id || null
      });

      if (error) {
        console.error('❌ ManageClasses: Database error adding class:', error);
        
        // Handle specific constraint violations with user-friendly messages
        if (error.code === '23505' && error.message.includes('unique_class_section_year')) {
          const errorMessage = `A class "${newClass.class_name}${newClass.section}" already exists for academic year "${newClass.academic_year}". Please choose a different class name, section, or academic year.`;
          Alert.alert('Duplicate Class', errorMessage);
          return; // Don't throw, just return to keep modal open
        }
        
        throw error;
      }
      
      console.log('✅ ManageClasses: Class created successfully with enhanced tenant system!');
      console.log('📋 ManageClasses: Inserted class details:');
      if (insertedData && insertedData.length > 0) {
        insertedData.forEach((cls, index) => {
          console.log(`   [${index + 1}] New Class: ${cls.class_name} | tenant_id: ${cls.tenant_id} | id: ${cls.id}`);
          
          // Verify the inserted class has the correct tenant_id (auto-injected by tenantDatabase)
          const cachedTenantId = getCachedTenantId();
          if (cls.tenant_id === cachedTenantId) {
            console.log('✅ ManageClasses: New class has correct tenant_id (auto-injected)');
          } else {
            console.error('❌ ManageClasses: NEW CLASS TENANT MISMATCH!');
            console.error('❌ Expected tenant_id:', cachedTenantId);
            console.error('❌ Actual tenant_id:', cls.tenant_id);
          }
        });
      }

      // Refresh data
      await loadAllData();
      setNewClass({ 
        class_name: '', 
        academic_year: '2024-25', 
        section: '', 
        class_teacher_id: '' 
      });
      setIsAddModalVisible(false);
      Alert.alert('Success', 'Class added successfully!');
    } catch (error) {
      console.error('Error adding class:', error);
      Alert.alert('Error', `Failed to add class: ${error.message}`);
    }
  };

  const handleEditClass = async () => {
    try {
      // 🛡️ Enhanced tenant validation
      const validation = validateTenantAccessLocal();
      if (!validation.valid) {
        Alert.alert('Access Denied', validation.error);
        return;
      }

      if (!selectedClass.class_name || !selectedClass.section) {
        Alert.alert('Error', 'Please fill in class name and section');
        return;
      }

      // First, check if another class with the same name, section, and academic year already exists using enhanced helpers
      console.log('🔍 ManageClasses: Checking for existing class in tenant (edit) using enhanced system');
      const { data: allExistingClasses, error: checkError } = await tenantDatabase.read(
        TABLES.CLASSES,
        {
          class_name: selectedClass.class_name,
          section: selectedClass.section,
          academic_year: selectedClass.academic_year
        },
        'id, class_name, section, academic_year'
      );
      
      // Filter out the current class being edited
      const existingClass = allExistingClasses?.filter(cls => cls.id !== selectedClass.id) || [];
      
      if (checkError) {
        console.error('❌ ManageClasses: Error checking for existing class during edit:', checkError);
        throw checkError;
      }
      
      if (existingClass && existingClass.length > 0) {
        console.log('⚠️ ManageClasses: Duplicate class found during edit:', existingClass[0]);
        const errorMessage = `A class "${selectedClass.class_name}${selectedClass.section}" already exists for academic year "${selectedClass.academic_year}" in your school. Please choose a different class name, section, or academic year.`;
        Alert.alert('Duplicate Class', errorMessage);
        return; // Don't proceed with update
      }
      
      console.log('✅ ManageClasses: No duplicate found during edit, proceeding with enhanced update');

      // Update a class using enhanced tenant database helpers
      const { error } = await tenantDatabase.update(TABLES.CLASSES, selectedClass.id, {
        class_name: selectedClass.class_name,
        academic_year: selectedClass.academic_year,
        section: selectedClass.section,
        class_teacher_id: selectedClass.class_teacher_id || null
      });

      if (error) {
        console.error('Database error updating class:', error);
        
        // Handle specific constraint violations with user-friendly messages
        if (error.code === '23505' && error.message.includes('unique_class_section_year')) {
          const errorMessage = `A class "${selectedClass.class_name}${selectedClass.section}" already exists for academic year "${selectedClass.academic_year}". Please choose a different class name, section, or academic year.`;
          Alert.alert('Duplicate Class', errorMessage);
          return; // Don't throw, just return to keep modal open
        }
        
        throw error;
      }

      // Refresh data
      await loadAllData();
      setIsEditModalVisible(false);
      setSelectedClass(null);
      Alert.alert('Success', 'Class updated successfully!');
    } catch (error) {
      console.error('Error updating class:', error);
      Alert.alert('Error', `Failed to update class: ${error.message}`);
    }
  };

  const handleDeleteClass = async (classItem) => {
    // 🚀 FIXED: Web-compatible confirmation dialog (like teacher screen)
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm(`Are you sure you want to delete "${classItem.class_name}"? This will also delete all associated subjects, assignments, exams, and related data.`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Class',
            `Are you sure you want to delete "${classItem.class_name}"? This will also delete all associated subjects, assignments, exams, and related data.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });
    
    if (!confirmDelete) {
      console.log('❌ User cancelled class deletion');
      return;
    }
    
    // Show loading state
    setLoading(true);
    
    try {
      // 🛡️ Enhanced tenant validation
      const validation = validateTenantAccessLocal();
      if (!validation.valid) {
        const errorMsg = `Access Denied: ${validation.error}`;
        if (Platform.OS === 'web') {
          window.alert(errorMsg);
        } else {
          Alert.alert('Access Denied', validation.error);
        }
        return;
      }
      
      console.log(`🗑️ Starting deletion process for class: ${classItem.class_name} (ID: ${classItem.id})`);
      console.log('🏢 Using enhanced tenant system for deletion');

      // 🚀 FIXED: Use consistent tenantDatabase helpers throughout (like teacher screen)
      
      // Step 1: Get all subjects for this class to handle cascading deletes
      console.log('1. Finding subjects for this class...');
      const { data: classSubjects, error: subjectsQueryError } = await tenantDatabase.read(
        TABLES.SUBJECTS,
        { class_id: classItem.id },
        'id'
      );
      
      if (subjectsQueryError) {
        console.error('Error querying subjects:', subjectsQueryError);
        throw new Error(`Failed to query subjects: ${subjectsQueryError.message}`);
      }
      
      const subjectIds = classSubjects?.map(s => s.id) || [];
      console.log('✓ Found subjects to delete:', subjectIds.length);

      // Step 2: Delete teacher_subjects assignments for these subjects
      if (subjectIds.length > 0) {
        console.log('2. Deleting teacher-subject assignments...');
        const { error: teacherSubjectsError } = await tenantDatabase.delete(
          'teacher_subjects',
          { subject_id: { in: subjectIds } }
        );
        if (teacherSubjectsError) {
          console.error('Error deleting teacher_subjects:', teacherSubjectsError);
          throw new Error(`Failed to delete teacher assignments: ${teacherSubjectsError.message}`);
        }
        console.log('✓ Deleted teacher-subject assignments');
      }

      // Step 3: Delete marks related to subjects in this class
      if (subjectIds.length > 0) {
        console.log('3. Deleting marks...');
        const { error: marksError } = await tenantDatabase.delete(
          'marks',
          { subject_id: { in: subjectIds } }
        );
        if (marksError && !marksError.message.includes('does not exist')) {
          console.error('Error deleting marks:', marksError);
          throw new Error(`Failed to delete marks: ${marksError.message}`);
        }
        console.log('✓ Deleted marks');
      }

      // Step 4: Delete timetable entries for this class
      console.log('4. Deleting timetable entries...');
      try {
        const { error: timetableError } = await tenantDatabase.delete(
          'timetable_entries',
          { class_id: classItem.id }
        );
        if (timetableError && !timetableError.message.includes('does not exist')) {
          console.warn('Error deleting timetable entries:', timetableError);
        } else {
          console.log('✓ Deleted timetable entries');
        }
      } catch (timetableErr) {
        console.log('ℹ Timetable entries table not found, skipping...');
      }

      // Step 5: Delete assignments and their submissions
      console.log('5. Finding and deleting assignments...');
      const { data: classAssignments } = await tenantDatabase.read(
        'assignments',
        { class_id: classItem.id },
        'id'
      );
      
      const assignmentIds = classAssignments?.map(a => a.id) || [];
      if (assignmentIds.length > 0) {
        // Delete assignment submissions first
        const { error: submissionsError } = await tenantDatabase.delete(
          'assignment_submissions',
          { assignment_id: { in: assignmentIds } }
        );
        if (submissionsError && !submissionsError.message.includes('does not exist')) {
          console.warn('Error deleting assignment submissions:', submissionsError);
        }
        
        // Then delete assignments
        const { error: assignmentsError } = await tenantDatabase.delete(
          'assignments',
          { class_id: classItem.id }
        );
        if (assignmentsError) {
          console.error('Error deleting assignments:', assignmentsError);
          throw new Error(`Failed to delete assignments: ${assignmentsError.message}`);
        }
      }
      console.log('✓ Deleted assignments and submissions');

      // Step 6: Delete other related data
      console.log('6. Deleting other related data...');
      
      // Delete homeworks
      try {
        const { error: homeworksError } = await tenantDatabase.delete(
          'homeworks',
          { class_id: classItem.id }
        );
        if (homeworksError && !homeworksError.message.includes('does not exist')) {
          console.warn('Error deleting homeworks:', homeworksError);
        } else {
          console.log('✓ Deleted homeworks');
        }
      } catch (homeworkErr) {
        console.log('ℹ Homeworks table not found, skipping...');
      }

      // Delete exams
      try {
        const { error: examsError } = await tenantDatabase.delete(
          'exams',
          { class_id: classItem.id }
        );
        if (examsError && !examsError.message.includes('does not exist')) {
          console.warn('Error deleting exams:', examsError);
        } else {
          console.log('✓ Deleted exams');
        }
      } catch (examErr) {
        console.log('ℹ Exams table not found, skipping...');
      }

      // Delete fee structures
      try {
        const { error: feeStructureError } = await tenantDatabase.delete(
          'fee_structure',
          { class_id: classItem.id }
        );
        if (feeStructureError && !feeStructureError.message.includes('does not exist')) {
          console.warn('Error deleting fee structures:', feeStructureError);
        } else {
          console.log('✓ Deleted fee structures');
        }
      } catch (feeErr) {
        console.log('ℹ Fee structure table not found, skipping...');
      }

      // Delete attendance records
      try {
        const { error: attendanceError } = await tenantDatabase.delete(
          'student_attendance',
          { class_id: classItem.id }
        );
        if (attendanceError && !attendanceError.message.includes('does not exist')) {
          console.warn('Error deleting student attendance:', attendanceError);
        } else {
          console.log('✓ Deleted student attendance');
        }
      } catch (attendanceErr) {
        console.log('ℹ Student attendance table not found, skipping...');
      }

      // Step 7: Update students to remove class assignment
      console.log('7. Updating students to remove class assignment...');
      const { error: updateError } = await tenantDatabase.update(
        'students',
        { class_id: classItem.id },
        { class_id: null }
      );
      if (updateError) {
        console.warn('Error updating students:', updateError);
        // Don't throw error for this, as it's not critical
      } else {
        console.log('✓ Updated students to remove class assignment');
      }

      // Step 8: Delete subjects for this class
      console.log('8. Deleting subjects...');
      const { error: subjectsError } = await tenantDatabase.delete(
        TABLES.SUBJECTS,
        { class_id: classItem.id }
      );
      if (subjectsError) {
        console.error('Error deleting subjects:', subjectsError);
        throw new Error(`Failed to delete subjects: ${subjectsError.message}`);
      }
      console.log('✓ Deleted subjects');

      // Step 9: Finally, delete the class itself
      console.log('9. Deleting class record...');
      const { error: classDeleteError } = await tenantDatabase.delete(
        TABLES.CLASSES,
        classItem.id  // Use the ID directly for single record deletion
      );
      if (classDeleteError) {
        console.error('Error deleting class:', classDeleteError);
        throw new Error(`Failed to delete class: ${classDeleteError.message}`);
      }
      console.log('✓ Deleted class record');

      // 🚀 FIXED: Update local state with proper React state management
      setClasses(prevClasses => {
        const updatedClasses = prevClasses.filter(c => c.id !== classItem.id);
        console.log(`🔄 Updated local state: removed class ${classItem.class_name}, remaining: ${updatedClasses.length}`);
        return updatedClasses;
      });
      
      // 🚀 FIXED: Web-compatible success message
      const successMsg = `Successfully deleted class: ${classItem.class_name}`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Success', successMsg);
      }
      
      console.log(`✅ Class deletion completed successfully: ${classItem.class_name}`);
      
    } catch (error) {
      console.error('❌ Error deleting class:', error);
      
      // 🚀 FIXED: Web-compatible error message
      const errorMsg = `Could not delete "${classItem.class_name}": ${error.message}\n\nPlease check if this class has dependencies that need to be removed first.`;
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('Deletion Failed', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (classItem) => {
    // Find teacher name for display
    const teacher = teachers.find(t => t.id === classItem.class_teacher_id);
    setSelectedClass({ 
      ...classItem,
      teacher_name: teacher?.name || 'Unknown'
    });
    setIsEditModalVisible(true);
  };

  const openClassDetails = async (classItem) => {
    console.log('🔧 ManageClasses: Opening class details for:', classItem.class_name);
    
    try {
      setSelectedClassDetails(classItem);
      
      // Enhanced tenant validation
      const validation = validateTenantAccessLocal();
      if (!validation.valid) {
        Alert.alert('Access Denied', validation.error);
        return;
      }
      
      // Fetch subjects for this class with their assigned teachers using manual query (complex join)
      console.log('📋 ManageClasses: Fetching subjects for class ID using enhanced system:', classItem.id);
      
      const cachedTenantId = getCachedTenantId();
      const { data: subjectsData, error: subjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select(`
          id,
          name,
          is_optional,
          teacher_subjects(
            teachers(
              id,
              name
            )
          )
        `)
        .eq('class_id', classItem.id)
        .eq('tenant_id', cachedTenantId);
      
      if (subjectsError) {
        console.error('Error fetching subjects:', subjectsError);
        throw subjectsError;
      }
      
      console.log('📋 ManageClasses: Subjects data loaded:', subjectsData?.length || 0, 'subjects');
      
      // Process the data to get teacher info for each subject
      const processedSubjects = subjectsData?.map(subject => ({
        ...subject,
        teacher: subject.teacher_subjects?.[0]?.teachers || null
      })) || [];
      
      console.log('🔧 ManageClasses: Setting class subjects and showing modal');
      setClassSubjects(processedSubjects);
      setClassDetailsModal(true);
      
    } catch (error) {
      console.error('Error loading class details:', error);
      Alert.alert('Error', 'Failed to load class details');
    }
  };


  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Reset and reload the first page (teachers are already cached in state)
      setClasses([]);
      setPage(0);
      setHasMore(true);
      await loadClassesPage(0, true);
    } finally {
      setRefreshing(false);
    }
  };

  const renderClassItem = ({ item }) => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      );
    }

    // Find teacher name for display
    const teacher = teachers.find(t => t.id === item.class_teacher_id);

    return (
      <TouchableOpacity 
        style={[
          styles.classCard,
          Platform.OS === 'web' && styles.webClickable
        ]}
        onPress={() => {
          console.log('🔧 ManageClasses: Class card pressed:', item.class_name);
          openClassDetails(item);
        }}
        activeOpacity={0.7}
        accessibilityRole={Platform.OS === 'web' ? 'button' : undefined}
        accessibilityLabel={`View details for ${item.class_name}`}
      >
        <View style={styles.classHeader}>
          <View style={styles.classInfo}>
            <Text style={styles.className}>{item.class_name}</Text>
            <Text style={styles.classDetails}>
              Section {item.section}
            </Text>
            <Text style={styles.classTeacher}>
              Class Teacher: {teacher?.name || 'Not Assigned'}
            </Text>
          </View>
          <View style={styles.classStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.students_count || 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.subjects_count || 0}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.classActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.viewButton]}
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('StudentList', { 
                classId: item.id,
                className: item.class_name,
                section: item.section
              });
            }}
          >
            <Ionicons name="people" size={16} color="#2196F3" />
            <Text style={styles.viewButtonText}>View Students</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]}
            onPress={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
          >
            <Ionicons name="create" size={16} color="#FF9800" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton, Platform.OS === 'web' && { cursor: 'pointer' }]}
            onPress={(e) => {
              if (e && e.stopPropagation) e.stopPropagation();
              if (e && e.preventDefault) e.preventDefault();
              console.log('🔄 Delete button clicked for class:', item.class_name);
              handleDeleteClass(item);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={16} color="#f44336" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModal = (isVisible, isEdit = false) => (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setIsAddModalVisible(false);
        setIsEditModalVisible(false);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.scrollWrapper}>
            <ScrollView 
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              keyboardShouldPersistTaps="handled"
              bounces={Platform.OS !== 'web'}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEdit ? 'Edit Class' : 'Add New Class'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddModalVisible(false);
                  setIsEditModalVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Class Name</Text>
                <TextInput
                  style={styles.input}
                  value={isEdit ? selectedClass?.class_name : newClass.class_name}
                  onChangeText={(text) => 
                    isEdit 
                      ? setSelectedClass({ ...selectedClass, class_name: text })
                      : setNewClass({ ...newClass, class_name: text })
                  }
                  placeholder="e.g., Class 1A"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Academic Year</Text>
                <TextInput
                  style={styles.input}
                  value={isEdit ? selectedClass?.academic_year : newClass.academic_year}
                  onChangeText={(text) => 
                    isEdit 
                      ? setSelectedClass({ ...selectedClass, academic_year: text })
                      : setNewClass({ ...newClass, academic_year: text })
                  }
                  placeholder="e.g., 2024-25"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Section</Text>
                <View style={styles.pickerDropdownContainer}>
                  <Picker
                    selectedValue={isEdit ? selectedClass?.section : newClass.section}
                    onValueChange={(itemValue) => 
                      isEdit 
                        ? setSelectedClass({ ...selectedClass, section: itemValue })
                        : setNewClass({ ...newClass, section: itemValue })
                    }
                    style={styles.pickerDropdown}
                  >
                    <Picker.Item label="Select Section" value="" />
                    {sections.map((section) => (
                      <Picker.Item key={section} label={section} value={section} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teacher (Optional)</Text>
                <View style={styles.pickerDropdownContainer}>
                  <Picker
                    selectedValue={isEdit ? selectedClass?.class_teacher_id : newClass.class_teacher_id}
                    onValueChange={(itemValue) => 
                      isEdit 
                        ? setSelectedClass({ ...selectedClass, class_teacher_id: itemValue })
                        : setNewClass({ ...newClass, class_teacher_id: itemValue })
                    }
                    style={styles.pickerDropdown}
                  >
                    <Picker.Item label="No Teacher Assigned" value="" />
                    {teachers.map((teacher) => (
                      <Picker.Item key={teacher.id} label={teacher.name} value={teacher.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={isEdit ? handleEditClass : handleAddClass}
              >
                <Text style={styles.submitButtonText}>
                  {isEdit ? 'Update Class' : 'Add Class'}
                </Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Add class details modal
  const renderClassDetailsModal = () => {
    console.log('🔧 ManageClasses: Rendering class details modal. Visible:', classDetailsModal);
    
    return (
      <Modal
        visible={classDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          console.log('🔧 ManageClasses: Closing class details modal');
          setClassDetailsModal(false);
        }}
      >
      <View style={styles.fullScreenModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {selectedClassDetails?.class_name} Details
          </Text>
          <TouchableOpacity onPress={() => setClassDetailsModal(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.scrollWrapper}>
          <ScrollView 
            style={[styles.scrollContainer, styles.detailsContent]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
          >
          <View style={styles.classInfoSection}>
            <Text style={styles.sectionTitle}>Class Information</Text>
            <Text style={styles.infoText}>Section: {selectedClassDetails?.section}</Text>
            <Text style={styles.infoText}>Academic Year: {selectedClassDetails?.academic_year}</Text>
            <Text style={styles.infoText}>
              Class Teacher: {teachers.find(t => t.id === selectedClassDetails?.class_teacher_id)?.name || 'Not Assigned'}
            </Text>
            <Text style={styles.infoText}>Students: {selectedClassDetails?.students_count || 0}</Text>
          </View>

          <View style={styles.subjectsSection}>
            <Text style={styles.sectionTitle}>Subjects & Teachers</Text>
            {classSubjects.length > 0 ? (
              classSubjects.map((subject, index) => (
                <View key={subject.id} style={styles.subjectItem}>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{subject.name}</Text>
                    {subject.is_optional && (
                      <Text style={styles.subjectCode}>Optional</Text>
                    )}
                  </View>
                  <Text style={styles.subjectTeacher}>
                    {subject.teacher?.name || 'No teacher assigned'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSubjectsText}>No subjects assigned to this class</Text>
            )}
          </View>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.timetableButton}
          onPress={() => {
            setClassDetailsModal(false);
            navigation.navigate('SubjectsTimetable', { classId: selectedClassDetails?.id });
          }}
        >
          <Ionicons name="calendar" size={20} color="#fff" />
          <Text style={styles.timetableButtonText}>View Timetable</Text>
        </TouchableOpacity>
      </View>
    </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Manage Classes" showBack={true} />
      
      {/* Floating Refresh Button - Web Only */}
      <FloatingRefreshButton
        onPress={onRefresh}
        refreshing={refreshing}
        bottom={80}
      />
      
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Total Classes: {classes.length}</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {(loading || tenantLoading || !isReady) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>
            {tenantLoading || !isReady ? 'Initializing enhanced tenant access...' : 'Loading classes...'}
          </Text>
        </View>
      ) : tenantError ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: 'red' }]}>Tenant Error: {tenantError}</Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          renderItem={renderClassItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          nestedScrollEnabled={true}
          overScrollMode={Platform.OS === 'android' ? 'always' : 'never'}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.2}
          onEndReached={() => {
            if (!loadingPage && hasMore) {
              loadClassesPage(page + 1, false);
            }
          }}
          getItemLayout={Platform.OS === 'web' ? undefined : (data, index) => ({
            length: 200, // Approximate item height for class cards
            offset: 200 * index,
            index,
          })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="school" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No classes found</Text>
              <Text style={styles.emptySubtext}>Add your first class to get started</Text>
            </View>
          }
          ListFooterComponent={
            loadingPage ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator size="small" color="#2196F3" />
              </View>
            ) : null
          }
        />
      )}

      {renderModal(isAddModalVisible, false)}
      {renderModal(isEditModalVisible, true)}
      {renderClassDetailsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  addButton: {
    backgroundColor: '#2196F3',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  classTeacher: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  classStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  classActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  viewButton: {
    backgroundColor: '#e3f2fd',
  },
  viewButtonText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  editButton: {
    backgroundColor: '#fff3e0',
  },
  editButtonText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    minHeight: 400,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  pickerDropdownContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  pickerDropdown: {
    width: '100%',
    backgroundColor: 'transparent',
    color: '#333',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  detailsContent: {
    flex: 1,
    paddingVertical: 10,
  },
  classInfoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  subjectsSection: {
    marginBottom: 20,
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  subjectCode: {
    fontSize: 12,
    color: '#666',
  },
  subjectTeacher: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  noSubjectsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  timetableButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
  },
  timetableButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Scroll wrapper styles to fix scrolling issues
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
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    ...Platform.select({
      web: {
        paddingBottom: 40,
      },
    }),
  },
  // Web-specific styles for clickable elements
  webClickable: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
      },
    }),
  },
});

export default ManageClasses;
