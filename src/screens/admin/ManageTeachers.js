import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase, TABLES } from '../../utils/supabase';
import { ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import { useAuth } from '../../utils/AuthContext';
import { useTenantAccess, tenantDatabase } from '../../utils/tenantHelpers';

// Will be fetched from Supabase
const ManageTeachers = ({ navigation, route }) => {
  const { user } = useAuth();
  
  // 🚀 ENHANCED: Use the new tenant access hook
  const { 
    getTenantId, 
    isReady, 
    isLoading: tenantLoading, 
    tenantName, 
    error: tenantError 
  } = useTenantAccess();
  
  // Debug enhanced tenant context
  console.log('🚀 ManageTeachers: Enhanced tenant context:', {
    isReady,
    tenantName: tenantName || 'NULL',
    tenantId: getTenantId() || 'NULL',
    userEmail: user?.email || 'NULL',
    platform: Platform.OS
  });
  
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', age: '', address: '', subjects: [], classes: [], salary: '', qualification: '', sections: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState([]);
  const [preventAutoRefresh, setPreventAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreTeachers, setHasMoreTeachers] = useState(false);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const PAGE_SIZE = 20;

  // Load data on component mount and when tenant changes
  useEffect(() => {
    console.log('🚀 ManageTeachers: useEffect triggered:', {
      isReady,
      tenantId: getTenantId() || 'NULL',
      user: user?.email || 'NULL'
    });
    
    let timeoutId;
    
    // Wait for tenant context to be ready
    if (isReady && getTenantId() && user) {
      console.log('🏢 ManageTeachers: Tenant ready, loading data...');
      loadData();
    } else if (tenantError) {
      console.error('❌ ManageTeachers: Tenant error:', tenantError);
      setError(tenantError);
    } else if (!isReady) {
      console.log('⏳ ManageTeachers: Waiting for tenant context to be ready...');
      // Add a timeout fallback in case tenant context never becomes ready
      timeoutId = setTimeout(() => {
        if (!isReady && !getTenantId()) {
          console.warn('⚠️ ManageTeachers: Tenant context timeout - forcing load with possible limitations');
          setError('Tenant context is taking too long to initialize. Some features may be limited.');
          setLoading(false);
        }
      }, 10000); // 10 second timeout
    } else if (!user) {
      console.warn('🏢 ManageTeachers: Waiting for user authentication...');
    }
    
    // Check if we need to open edit modal from navigation
    if (route.params?.openEditModal && route.params?.editTeacher) {
      setTimeout(() => {
        openEditModal(route.params.editTeacher);
      }, 500);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [route.params, isReady, getTenantId(), user, tenantError]);

  useEffect(() => {
    // When selected classes change, filter out subjects that are no longer valid
    const validSubjects = form.subjects.filter(subjectId => {
      const subject = subjects.find(s => s.id === subjectId);
      return subject && form.classes.includes(subject.class_id);
    });

    if (validSubjects.length !== form.subjects.length) {
      setForm(prevForm => ({ ...prevForm, subjects: validSubjects }));
    }

    // Load sections for all selected classes
    if (form.classes.length > 0) {
      loadSectionsForClasses(form.classes);
    } else {
      setSections([]);
    }

  }, [form.classes, subjects]);
  
  // Function to load data using enhanced tenant system with pagination
  const loadData = async (page = 0, isRefresh = false) => {
    console.log('🚀 ManageTeachers: loadData called with params:', { page, isRefresh, platform: Platform.OS });
    
    const startTime = performance.now();
    
    // Only show full loading for initial load or refresh
    if (isRefresh || page === 0) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const tenantId = getTenantId();
      console.log(`🏢 ManageTeachers: Loading page ${page} for tenant:`, tenantId);
      
      if (!tenantId) {
        console.error('❌ ManageTeachers: No tenant ID available');
        setError('No tenant context available. Please contact administrator.');
        setLoading(false);
        return;
      }
      
      console.log('🚀 ManageTeachers: Loading teachers with enhanced tenant system:', tenantId);
      
      // 🚀 Use enhanced tenant database for teachers
      const { data: teachersData, error: teachersError } = await tenantDatabase.read(
        'teachers', 
        {}, 
        '*',
        { orderBy: { column: 'created_at', ascending: false } }
      );
      
      console.log('🏢 ManageTeachers: Teachers query result:', {
        success: !teachersError,
        count: teachersData?.length || 0,
        error: teachersError?.message || 'none'
      });
      
      if (teachersError) {
        console.error('❌ ManageTeachers: Error loading teachers:', teachersError);
        throw new Error(`Failed to load teachers: ${teachersError.message}`);
      }
      
      // 🚀 Enhanced: Direct parallel queries using tenantDatabase
      console.log('🏢 ManageTeachers: Fetching classes and subjects...');
      const [classesResult, subjectsResult] = await Promise.all([
        tenantDatabase.read('classes', {}, '*', { orderBy: { column: 'class_name', ascending: true } }).catch(err => {
          console.error('❌ ManageTeachers: Error loading classes:', err);
          return { data: null, error: err };
        }),
        tenantDatabase.read('subjects', {}, '*', { orderBy: { column: 'name', ascending: true } }).catch(err => {
          console.error('❌ ManageTeachers: Error loading subjects:', err);
          return { data: null, error: err };
        })
      ]);
      
      // Get classes and subjects data from the parallel queries
      const { data: classesData, error: classesError } = classesResult;
      const { data: subjectsData, error: subjectsError } = subjectsResult;
      
      if (classesError) {
        console.warn('⚠️ ManageTeachers: Failed to load classes:', classesError.message);
      } else {
        setClasses(classesData || []);
        console.log(`✅ ManageTeachers: Loaded ${(classesData || []).length} classes`);
      }
      
      if (subjectsError) {
        console.warn('⚠️ ManageTeachers: Failed to load subjects:', subjectsError.message);
      } else {
        setSubjects(subjectsData || []);
        console.log(`✅ ManageTeachers: Loaded ${(subjectsData || []).length} subjects`);
      }
      
      // Set pagination info
      setHasMoreTeachers((teachersData?.length || 0) === PAGE_SIZE);
      setCurrentPage(page);
      
      // Update teachers list based on whether this is initial load or pagination
      if (page === 0 || isRefresh) {
        // Initial load or refresh - replace all teachers
        setTeachers((teachersData || []).map(teacher => ({
          ...teacher,
          subjects: [], // Will load on-demand when editing
          classes: []   // Will load on-demand when editing  
        })));
        setTotalTeachers((teachersData || []).length);
      } else {
        // Pagination - append to existing teachers
        setTeachers(prev => [...prev, ...(teachersData || []).map(teacher => ({
          ...teacher,
          subjects: [],
          classes: []
        }))]);
        setTotalTeachers(prev => prev + (teachersData || []).length);
      }
      
      // Simple logging
      console.log('📋 ManageTeachers: Data loaded successfully:', {
        teachers: (teachersData || []).length,
        classes: classesData?.length || 0,
        subjects: subjectsData?.length || 0,
        tenantId
      });
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ ManageTeachers: Page ${page} loaded in ${loadTime}ms - ${(teachersData || []).length} teachers`);
      
    } catch (err) {
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.error(`❌ ManageTeachers: Error loading after ${loadTime}ms:`, err);
      setError(err.message || 'Failed to load teachers data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  
  // Handle load more teachers (simple version without pagination)
  const loadMoreTeachers = async () => {
    // Disabled pagination for now - we load all teachers at once
    console.log('🏢 ManageTeachers: Load more called but pagination disabled');
  };

  // Add the missing onRefresh function
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(0, true);
    setRefreshing(false);
  };

  const loadSections = async (classId) => {
    // 🚀 Enhanced: Use enhanced tenant database
    const { data, error } = await tenantDatabase.read(
      'classes',
      { id: classId },
      'section'
    );
    if (error) {
      return;
    }
    setSections(data?.map(item => ({ id: item.section, section_name: item.section })) || []);
  };

  const loadSectionsForClasses = async (classIds) => {
    if (!classIds || classIds.length === 0) {
      setSections([]);
      return;
    }
    
    try {
      // 🚀 Enhanced: Use getTenantId from enhanced tenant system
      const tenantId = getTenantId();
      if (!tenantId) {
        console.warn('🏢 ManageTeachers: No tenant context for loading sections');
        setSections([]);
        return;
      }
      
      // 🚀 Use enhanced tenant database for sections
      const { data, error } = await tenantDatabase.read(
        'classes',
        { id: { in: classIds } },
        'section',
        { filters: { section: { not: null } } }
      );
      
      if (error) {
        console.warn('🏢 ManageTeachers: Error loading sections:', error.message);
        setSections([]);
        return;
      }
      
      // Extract unique sections
      const uniqueSections = [...new Set((data || []).map(item => item.section))]
        .filter(section => section && section.trim() !== '')
        .map(section => ({ id: section, section_name: section }));
      
      setSections(uniqueSections);
      console.log('🏢 ManageTeachers: Loaded', uniqueSections.length, 'unique sections');
    } catch (error) {
      console.warn('🏢 ManageTeachers: Error in loadSectionsForClasses:', error.message);
      setSections([]);
    }
  };

  // Multi-select logic
  const toggleSelect = (arr, value) => arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const openAddModal = () => {
    setModalMode('add');
    setForm({ name: '', phone: '', age: '', address: '', subjects: [], classes: [], salary: '', qualification: '', sections: {} });
    setIsModalVisible(true);
  };
  const openEditModal = async (teacher) => {
    setModalMode('edit');
    setSelectedTeacher(teacher);

    try {
      // 🚀 Enhanced: Fetch current teacher's subject and class assignments using tenant database
      const { data: teacherSubjects, error: tsError } = await tenantDatabase.read(
        'teacher_subjects',
        { teacher_id: teacher.id },
        `*,
         subjects(
           id,
           name,
           class_id,
           academic_year,
           is_optional,
           classes(
             class_name,
             section
           )
         )`
      );
      
      if (tsError) throw tsError;

      // 🚀 Enhanced: Fetch direct class teacher assignments using tenant database
      const { data: directClassAssignments, error: dcError } = await tenantDatabase.read(
        'classes',
        { class_teacher_id: teacher.id },
        'id'
      );
      
      if (dcError) {
        console.warn('Error loading direct class assignments:', dcError);
      }

      // Extract subject and class IDs from teacher assignments
      const subjectIds = [];
      const classIds = new Set(); // Use Set to avoid duplicates
      const sections = {};

      // Add classes from subject assignments
      teacherSubjects?.forEach(ts => {
        if (ts.subject_id) {
          subjectIds.push(ts.subject_id);
        }
        // Get class ID from the subject's class_id
        if (ts.subjects?.class_id) {
          classIds.add(ts.subjects.class_id);
        }
      });

      // Add direct class teacher assignments
      directClassAssignments?.forEach(assignment => {
        classIds.add(assignment.id);
      });

      const finalClassIds = Array.from(classIds);

      console.log('Teacher assignments loaded:', {
        subjectIds,
        classIds: finalClassIds,
        directClassAssignments,
        teacherSubjects,
        teacher: teacher.name
      });

      const formData = {
        name: teacher.name,
        phone: teacher.phone || '',
        age: teacher.age ? String(teacher.age) : '',
        address: teacher.address || '',
        subjects: subjectIds,
        classes: finalClassIds,
        salary: teacher.salary_amount ? String(teacher.salary_amount) : '',
        qualification: teacher.qualification,
        sections: sections,
      };

      console.log('Setting form data:', formData);
      setForm(formData);
    } catch (error) {
      console.error('Error loading teacher assignments:', error);
      // Fallback to basic form
      setForm({
        name: teacher.name,
        phone: teacher.phone || '',
        age: teacher.age ? String(teacher.age) : '',
        address: teacher.address || '',
        subjects: [],
        classes: [],
        salary: teacher.salary_amount ? String(teacher.salary_amount) : '',
        qualification: teacher.qualification,
        sections: {},
      });
    }

    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedTeacher(null);
  };
  const handleSave = async () => {
    console.log('🏢 ManageTeachers: Save button clicked, form data:', form);
    const effectiveTenantId = getTenantId();
    console.log('🏢 ManageTeachers: Saving with tenant context:', {
      tenantId: getTenantId() || 'NULL',
      effectiveTenantId: effectiveTenantId || 'NULL',
      modalMode,
      userEmail: user?.email || 'NULL'
    });
    
    if (!effectiveTenantId) {
      console.error('❌ ManageTeachers: No tenant ID available for save operation');
      Alert.alert('Error', 'Unable to determine tenant context. Please try refreshing the page.');
      return;
    }
    
    console.log('🏢 ManageTeachers: Validation passed, proceeding with save...');

    if (!form.name.trim() || !form.phone.trim() || !form.age.trim()) {
      Alert.alert('Error', 'Please fill all required fields (name, phone, age).');
      return;
    }
    
    // Check if classes and subjects are available
    if (classes.length === 0) {
      Alert.alert('Info', 'No classes available. Teacher will be created without class assignments. You can assign classes later.');
    }
    
    if (subjects.length === 0) {
      Alert.alert('Info', 'No subjects available. Teacher will be created without subject assignments. You can assign subjects later.');
    }

    // Validate age is a number and greater than 18 (as per schema constraint)
    const age = parseInt(form.age);
    if (isNaN(age) || age <= 18) {
      Alert.alert('Error', 'Age must be a valid number greater than 18.');
      return;
    }

    setSaving(true);
    
    try {
      if (modalMode === 'add') {
        // Create new teacher in Supabase (with tenant_id)
        const teacherData = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          age: parseInt(form.age),
          address: form.address.trim(),
          qualification: form.qualification,
          salary_amount: parseFloat(form.salary) || 0,
          salary_type: 'monthly', // Default value
          tenant_id: effectiveTenantId, // Add tenant_id
        };
        
        const { data: newTeacher, error } = await supabase
          .from(TABLES.TEACHERS)
          .insert(teacherData)
          .select()
          .single();
          
        if (error) throw new Error('Failed to create teacher');
        
        // Handle subject and class assignments
        await handleSubjectClassAssignments(newTeacher.id);
        
        Alert.alert('Success', 'Teacher added successfully.');
      } else if (modalMode === 'edit' && selectedTeacher) {
        // Update teacher in Supabase
        const teacherData = {
          name: form.name.trim(),
          phone: form.phone.trim(),
          age: parseInt(form.age),
          address: form.address.trim(),
          qualification: form.qualification,
          salary_amount: parseFloat(form.salary) || 0,
        };
        
        const { error } = await supabase
          .from(TABLES.TEACHERS)
          .update(teacherData)
          .eq('id', selectedTeacher.id);
          
        if (error) throw new Error('Failed to update teacher');
        
        // Handle subject and class assignments
        await handleSubjectClassAssignments(selectedTeacher.id);
        
        Alert.alert('Success', 'Changes saved.');
      }
      closeModal();
    } catch (err) {
      console.error('Error saving teacher:', err);
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };
  
  // Helper function to handle subject and class assignments
  const handleSubjectClassAssignments = async (teacherId) => {
    try {
      console.log('Saving assignments for teacher:', teacherId);
      console.log('Form data:', { subjects: form.subjects, classes: form.classes, sections: form.sections });

      // 🚀 Enhanced: Get tenant ID from enhanced system
      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available for assignments');
      }
      
      console.log('🏢 ManageTeachers: Assignment validation passed');

      // 1. Handle subject assignments first
      // Get all existing subject assignments for this teacher using enhanced tenant database
      const { data: existingAssignments, error: fetchError } = await tenantDatabase.read(
        'teacher_subjects',
        { teacher_id: teacherId },
        '*'
      );
      if (fetchError) {
        console.error('Failed to fetch existing assignments:', fetchError);
        throw new Error('Failed to fetch existing assignments');
      }

      console.log('Existing subject assignments:', existingAssignments);

      // Delete existing subject assignments
      if (existingAssignments.length > 0) {
        const { error: deleteError } = await tenantDatabase.delete(
          'teacher_subjects',
          { teacher_id: teacherId }
        );
        if (deleteError) {
          console.error('Failed to delete assignments:', deleteError);
          throw new Error('Failed to update assignments');
        }
        console.log('Deleted existing subject assignments');
      }

      // Create new assignments for selected subjects
      const assignments = form.subjects.map(subjectId => ({
        teacher_id: teacherId,
        subject_id: subjectId,
      }));

      console.log('New subject assignments to insert:', assignments);

      // Insert new subject assignments if there are any
      if (assignments.length > 0) {
        const { data: insertedData, error: insertError } = await tenantDatabase.create(
          'teacher_subjects',
          assignments
        );
        if (insertError) {
          console.error('Failed to create assignments:', insertError);
          throw new Error('Failed to create assignments');
        }
        console.log('Successfully inserted subject assignments:', insertedData);
      } else {
        console.log('No subjects selected, no subject assignments to insert');
      }

      // 2. Handle direct class teacher assignments
      // First, remove this teacher from all existing class teacher assignments
      const { data: currentClassTeacherAssignments } = await tenantDatabase.read(
        'classes',
        { class_teacher_id: teacherId },
        'id, class_name'
      );

      console.log('Current class teacher assignments:', currentClassTeacherAssignments);

      // Remove this teacher from all classes where they were class teacher
      if (currentClassTeacherAssignments && currentClassTeacherAssignments.length > 0) {
        const { error: removeError } = await tenantDatabase.update(
          'classes',
          { class_teacher_id: teacherId },
          { class_teacher_id: null }
        );
        if (removeError) {
          console.error('Failed to remove from class teacher assignments:', removeError);
          console.warn('Could not remove previous class teacher assignments');
        } else {
          console.log('Removed teacher from previous class teacher assignments');
        }
      }

      // Now assign this teacher to the selected classes
      if (form.classes.length > 0) {
        console.log('Assigning teacher to classes:', form.classes);
        
        // Update each selected class to have this teacher as class_teacher_id
        for (const classId of form.classes) {
          const { error: assignError } = await tenantDatabase.update(
            'classes',
            { id: classId },
            { class_teacher_id: teacherId }
          );
          
          if (assignError) {
            console.error(`Failed to assign teacher to class ${classId}:`, assignError);
            console.warn(`Could not assign teacher to class ${classId}`);
          } else {
            console.log(`Successfully assigned teacher to class ${classId}`);
          }
        }
      }

      // 3. Update teacher's is_class_teacher flag
      const { error: updateTeacherError } = await tenantDatabase.update(
        'teachers',
        { id: teacherId },
        { is_class_teacher: form.classes.length > 0 }
      );
      
      if (updateTeacherError) {
        console.error('Failed to update teacher class teacher flag:', updateTeacherError);
        console.warn('Could not update teacher\'s class teacher status');
      } else {
        console.log('Updated teacher class teacher status:', form.classes.length > 0);
      }
      
    } catch (err) {
      console.error('Error handling assignments:', err);
      throw err; // Re-throw to be caught by the caller
    }
  };
  const handleDelete = async (teacher) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${teacher.name}? This will also remove all related data including assignments, homework, and attendance records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // 🛑️ Validate tenant access for deletion
              const effectiveTenantId = getTenantId();
              console.log('🏢 ManageTeachers: Delete validation for tenant:', effectiveTenantId);
              
              if (!effectiveTenantId) {
                console.error('❌ ManageTeachers: No tenant context for delete operation');
                Alert.alert('Access Denied', 'Unable to determine tenant context for delete operation.');
                setLoading(false);
                return;
              }
              
              console.log('🏢 ManageTeachers: Delete validation passed');
              
              console.log(`Starting deletion process for teacher: ${teacher.name} (ID: ${teacher.id})`);
              
              // Delete all related data in the correct order (from most dependent to least)
              
              // 1. Remove teacher from direct class teacher assignments
              const { error: classTeacherError } = await supabase
                .from('classes')
                .update({ class_teacher_id: null })
                .eq('class_teacher_id', teacher.id);
              if (classTeacherError) {
                console.error('Error removing from class teacher assignments:', classTeacherError);
                throw new Error(`Failed to remove class teacher assignments: ${classTeacherError.message}`);
              }
              console.log('✓ Removed from direct class teacher assignments');
              
              // 2. Delete teacher-subject assignments
              const { error: assignmentError } = await supabase
                .from(TABLES.TEACHER_SUBJECTS)
                .delete()
                .eq('teacher_id', teacher.id);
              if (assignmentError) {
                console.error('Error deleting teacher-subject assignments:', assignmentError);
                throw new Error(`Failed to delete teacher assignments: ${assignmentError.message}`);
              }
              console.log('✓ Deleted teacher-subject assignments');
              
              // 2. Delete teacher attendance records
              const { error: attendanceError } = await supabase
                .from(TABLES.TEACHER_ATTENDANCE)
                .delete()
                .eq('teacher_id', teacher.id);
              if (attendanceError) {
                console.error('Error deleting teacher attendance:', attendanceError);
                throw new Error(`Failed to delete teacher attendance: ${attendanceError.message}`);
              }
              console.log('✓ Deleted teacher attendance records');
              
              // 3. Delete homework assignments (if homeworks table exists)
              try {
                const { error: homeworkError } = await supabase
                  .from('homeworks')
                  .delete()
                  .eq('teacher_id', teacher.id);
                if (homeworkError && !homeworkError.message.includes('does not exist')) {
                  console.warn('Error deleting teacher homework:', homeworkError);
                }
                console.log('✓ Deleted teacher homework records');
              } catch (homeworkErr) {
                console.log('ℹ Homeworks table not found, skipping...');
              }
              
              // 4. Delete tasks assigned to teacher
              try {
                const { error: tasksError } = await supabase
                  .from(TABLES.TASKS)
                  .delete()
                  .eq('assigned_to', teacher.id);
                if (tasksError && !tasksError.message.includes('does not exist')) {
                  console.warn('Error deleting teacher tasks:', tasksError);
                }
                console.log('✓ Deleted teacher tasks');
              } catch (tasksErr) {
                console.log('ℹ Tasks table reference to teacher not found, skipping...');
              }
              
              // 5. Update timetable entries (set teacher_id to NULL instead of deleting)
              try {
                const { error: timetableError } = await supabase
                  .from(TABLES.TIMETABLE)
                  .update({ teacher_id: null })
                  .eq('teacher_id', teacher.id);
                if (timetableError && !timetableError.message.includes('does not exist')) {
                  console.warn('Error updating timetable entries:', timetableError);
                }
                console.log('✓ Updated timetable entries');
              } catch (timetableErr) {
                console.log('ℹ Timetable table not found, skipping...');
              }
              
              // 6. Update or delete any user accounts linked to this teacher
              try {
                const { error: userError } = await supabase
                  .from(TABLES.USERS)
                  .update({ linked_teacher_id: null })
                  .eq('linked_teacher_id', teacher.id);
                if (userError && !userError.message.includes('does not exist')) {
                  console.warn('Error unlinking teacher from user accounts:', userError);
                }
                console.log('✓ Unlinked teacher from user accounts');
              } catch (userErr) {
                console.log('ℹ User accounts not linked to teacher, skipping...');
              }
              
              // 7. Finally, delete the teacher record
              const { error } = await supabase
                .from(TABLES.TEACHERS)
                .delete()
                .eq('id', teacher.id);
                
              if (error) {
                console.error('Error deleting teacher record:', error);
                throw new Error(`Failed to delete teacher: ${error.message}`);
              }
              
              console.log('✓ Deleted teacher record');
              
              // Update local state
              setTeachers(teachers.filter(t => t.id !== teacher.id));
              
              // Show success message with teacher name
              Alert.alert('Success', `Successfully deleted teacher: ${teacher.name}`);
              console.log(`✅ Teacher deletion completed successfully: ${teacher.name}`);
              
            } catch (err) {
              console.error('❌ Error deleting teacher:', err);
              Alert.alert(
                'Deletion Failed', 
                `Could not delete ${teacher.name}: ${err.message}\n\nPlease check if this teacher has dependencies that need to be removed first.`
              );
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  };

  // Enhanced filtering and sorting - simplified for performance
  const filteredTeachers = teachers
    .filter(teacher => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const name = teacher.name?.toLowerCase() || '';
      const qualification = teacher.qualification?.toLowerCase() || '';
      const phone = teacher.phone?.toLowerCase() || '';

      return name.includes(query) ||
             qualification.includes(query) ||
             phone.includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderTeacherItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.teacherCard} 
        onPress={() => navigation.navigate('TeacherDetails', { teacher: item })}
        activeOpacity={0.7}
      >
        <View style={styles.teacherInfo}>
          <View style={styles.teacherAvatar}>
            {item.users?.profile_url ? (
              <View style={styles.profileImageContainer}>
                <Image
                  source={{ uri: item.users.profile_url }}
                  style={styles.profileImage}
                  onError={() => {
                    console.log('Failed to load teacher profile image:', item.users.profile_url);
                  }}
                />
              </View>
            ) : (
              <View style={styles.profileContainer}>
                <Text style={styles.profileInitials}>
                  {item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.iconOverlay}>
              <Ionicons name="person" size={16} color="#4CAF50" />
            </View>
          </View>
          <View style={styles.teacherDetails}>
            <Text style={styles.teacherName}>{item.name}</Text>
            <Text style={styles.teacherSubject}>
              {item.qualification || 'Qualification not specified'}
            </Text>
            <Text style={styles.teacherClass}>
              {item.is_class_teacher ? 'Class Teacher' : 'Subject Teacher'} • Phone: {item.phone || 'N/A'}
            </Text>
            {/* Salary and Education */}
            <Text style={styles.teacherSalary}>
              Salary: {item.salary_amount ? `₹${parseFloat(item.salary_amount).toFixed(2)}` : '₹0.00'}
            </Text>
            <Text style={styles.teacherQualification}>
              Education: {item.qualification || 'N/A'}
            </Text>
          </View>
        </View>
        <View style={styles.teacherActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('TeacherDetails', { teacher: item });
            }}
          >
            <Ionicons name="eye" size={16} color="#2196F3" />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('AssignTaskToTeacher', { teacher: item });
            }}
          >
            <Ionicons name="clipboard" size={16} color="#388e3c" />
            <Text style={styles.actionText}>Assign Task</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
          >
            <Ionicons name="create" size={16} color="#FF9800" />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
          >
            <Ionicons name="trash" size={16} color="#f44336" />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render loading state
  if ((loading && teachers.length === 0) || tenantLoading) {
    console.log('🔄 ManageTeachers: Rendering loading state', { loading, tenantLoading, teachersCount: teachers.length });
    return (
      <View style={styles.fullScreenLoading}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="school-outline" size={48} color="#4CAF50" style={styles.loadingIcon} />
            <PaperActivityIndicator size="large" color="#4CAF50" style={styles.loadingSpinner} />
          </View>
          <Text style={styles.loadingTitle}>Manage Teachers</Text>
          <Text style={styles.loadingText}>
            {tenantLoading ? 'Initializing tenant context...' : 'Loading teachers data...'}
          </Text>
          <Text style={styles.loadingSubtext}>Please wait while we fetch the information</Text>
          {tenantName && (
            <Text style={styles.loadingTenant}>Tenant: {tenantName}</Text>
          )}
        </View>
      </View>
    );
  }
  
  // Render error state
  if (error && teachers.length === 0) {
    console.log('❌ ManageTeachers: Rendering error state', { error, teachersCount: teachers.length });
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Header title="Manage Teachers" showBack={true} />
        <Text style={styles.errorText}>{error}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: '#2196F3' }]} 
            onPress={() => {
              setError(null);
              setLoading(true);
              setTimeout(() => loadData(), 100);
            }}
          >
            <Text style={styles.retryButtonText}>Force Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Fallback render - if we have no teachers but no loading/error state, show empty state
  if (!loading && !error && teachers.length === 0) {
    console.log('ℹ️ ManageTeachers: No teachers found, showing empty state');
  }
  
  console.log('✅ ManageTeachers: Rendering main component', { 
    teachersCount: teachers.length, 
    loading, 
    error,
    tenantReady: isReady,
    tenantId: getTenantId(),
    user: user?.email
  });
  
  return (
    <View style={styles.container}>
      <Header title="Manage Teachers" showBack={true} />
      
      {/* 🚀 Enhanced: Tenant Context Banner */}
      {tenantName && (
        <View style={styles.tenantBanner}>
          <View style={styles.tenantBannerContent}>
            <Ionicons name="business" size={16} color="#4CAF50" />
            <Text style={styles.tenantBannerText}>
              Managing: {tenantName}
            </Text>
          </View>
          {tenantLoading && (
            <PaperActivityIndicator size={12} color="#4CAF50" />
          )}
        </View>
      )}
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <PaperActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Teachers: {totalTeachers}</Text>
          <Text style={styles.headerSubtitle}>
            {searchQuery ? `${filteredTeachers.length} filtered` : 'Active Teachers'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Enhanced Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color={searchQuery ? "#2196F3" : "#999"}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search by name, qualification, or phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholderTextColor="#999"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results Info */}
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsInfo}>
            <Ionicons name="information-circle-outline" size={16} color="#666" />
            <Text style={styles.searchResultsText}>
              {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''} found
              {searchQuery && ` for "${searchQuery}"`}
            </Text>
          </View>
        )}
      </View>
      
      {/* Empty State */}
      {teachers.length === 0 && !loading && (
        <View style={[styles.centerContent, { flex: 1, padding: 20 }]}>
          <Ionicons name="people-outline" size={64} color="#ccc" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 8 }}>
            No teachers found
          </Text>
          <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 20 }}>
            {searchQuery ? 'Try adjusting your search criteria' : 'Add your first teacher to get started'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={[styles.addButton, { flexDirection: 'row' }]} onPress={openAddModal}>
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Add Teacher</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Teachers List */}
      {teachers.length > 0 && (
        <FlatList
          data={filteredTeachers}
          renderItem={renderTeacherItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          onEndReached={loadMoreTeachers}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#4CAF50", "#2196F3"]}
              tintColor="#4CAF50"
            />
          }
          {...Platform.select({
            web: {
              scrollBehavior: 'smooth',
              nestedScrollEnabled: true,
              overScrollMode: 'always',
            },
          })}
          ListFooterComponent={
            hasMoreTeachers && !searchQuery ? (
              <View style={styles.loadingMoreContainer}>
                <PaperActivityIndicator size="small" color="#4CAF50" />
                <Text style={styles.loadingMoreText}>Loading more teachers...</Text>
              </View>
            ) : searchQuery ? null : (
              <View style={styles.endOfListContainer}>
                <Text style={styles.endOfListText}>End of teachers list</Text>
              </View>
            )
          }
        />
      )}
      
      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'add' ? 'Add Teacher' : 'Edit Teacher'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.name}
                  onChangeText={text => setForm(prev => ({ ...prev, name: text }))}
                  placeholder="Enter teacher's name"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.phone}
                  onChangeText={text => setForm(prev => ({ ...prev, phone: text }))}
                  placeholder="Enter teacher's phone number"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Age</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.age}
                  onChangeText={text => setForm(prev => ({ ...prev, age: text }))}
                  placeholder="Enter teacher's age"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Address</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={form.address}
                  onChangeText={text => setForm(prev => ({ ...prev, address: text }))}
                  placeholder="Enter teacher's address"
                  multiline={true}
                  numberOfLines={3}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Qualification</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.qualification}
                  onChangeText={text => setForm(prev => ({ ...prev, qualification: text }))}
                  placeholder="Enter teacher's qualification"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Salary</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.salary}
                  onChangeText={text => setForm(prev => ({ ...prev, salary: text }))}
                  placeholder="Enter teacher's salary"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Classes</Text>
                <View style={styles.multiSelectContainer}>
                  {classes.map(cls => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[
                        styles.multiSelectItem,
                        form.classes.includes(cls.id) && styles.multiSelectItemActive
                      ]}
                      onPress={() => setForm(prev => ({ ...prev, classes: toggleSelect(prev.classes, cls.id) }))}
                    >
                      <Text style={styles.multiSelectText}>{cls.class_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Subjects</Text>
                <View style={styles.multiSelectContainer}>
                  {subjects.map(subject => (
                    <TouchableOpacity
                      key={subject.id}
                      style={[
                        styles.multiSelectItem,
                        form.subjects.includes(subject.id) && styles.multiSelectItemActive
                      ]}
                      onPress={() => setForm(prev => ({ ...prev, subjects: toggleSelect(prev.subjects, subject.id) }))}
                    >
                      <Text style={styles.multiSelectText}>{subject.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Sections</Text>
                <View style={styles.multiSelectContainer}>
                  {sections.map(section => (
                    <TouchableOpacity
                      key={section.id}
                      style={[
                        styles.multiSelectItem,
                        form.sections[section.id] && styles.multiSelectItemActive
                      ]}
                      onPress={() => setForm(prev => ({ ...prev, sections: { ...prev.sections, [section.id]: !prev.sections[section.id] } }))}
                    >
                      <Text style={styles.multiSelectText}>{section.section_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSave} disabled={saving}>
                <Text style={styles.modalButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Full Screen Loading Styles
  fullScreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingContent: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 48,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    minWidth: 280,
    maxWidth: 320,
  },
  loadingIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingIcon: {
    opacity: 0.3,
  },
  loadingSpinner: {
    position: 'absolute',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  errorText: {
    marginTop: 20,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  retryButton: {
    marginTop: 15,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    ...Platform.select({
      web: {
        height: '100vh',
        overflow: 'auto',
      },
    }),
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
    backgroundColor: '#4CAF50',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    padding: 16,
  },
  teacherCard: {
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
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teacherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  profileContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  profileImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileInitials: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  teacherDetails: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  teacherSubject: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 2,
  },
  teacherClass: {
    fontSize: 12,
    color: '#666',
  },
  teacherStats: {
    alignItems: 'center',
  },
  studentsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  studentsLabel: {
    fontSize: 10,
    color: '#666',
  },
  attendanceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 4,
  },
  attendanceLabel: {
    fontSize: 10,
    color: '#666',
  },
  teacherActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  teacherSalary: {
    fontSize: 13,
    color: '#795548',
    marginTop: 2,
  },
  teacherQualification: {
    fontSize: 13,
    color: '#607D8B',
    marginBottom: 2,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        maxHeight: '90vh',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  multiSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  multiSelectItem: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  multiSelectItemActive: {
    backgroundColor: '#4CAF50',
  },
  multiSelectText: {
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Enhanced Search Styles
  searchSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    marginBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchResultsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  searchResultsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  // Pagination styles
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  endOfListContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  endOfListText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  // 🚀 Enhanced: Tenant Banner Styles
  tenantBanner: {
    backgroundColor: '#E8F5E8',
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tenantBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
  },
  loadingTenant: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ManageTeachers;