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
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import { useTenantContext } from '../../contexts/TenantContext';
import { validateTenantAccess, createTenantQuery, validateDataTenancy, TENANT_ERROR_MESSAGES } from '../../utils/tenantValidation';
import { useAuth } from '../../utils/AuthContext';
import { getCurrentUserTenantByEmail } from '../../utils/getTenantByEmail';
import { AdminTenantFix } from '../../utils/adminTenantFix';

// Will be fetched from Supabase
const ManageTeachers = ({ navigation, route }) => {
  const { tenantId, currentTenant } = useTenantContext();
  const { user } = useAuth();
  const [fallbackTenantId, setFallbackTenantId] = useState(null);
  
  // Debug tenant context
  console.log('🏢 ManageTeachers: Component initialized with:', {
    tenantId: tenantId || 'NULL',
    currentTenant: currentTenant ? currentTenant.name : 'NULL',
    userEmail: user?.email || 'NULL'
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
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [hasMoreTeachers, setHasMoreTeachers] = useState(false);
  const [preventAutoRefresh, setPreventAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Helper function to get effective tenant ID (from context or fallback)
  const getEffectiveTenantId = () => {
    return tenantId || fallbackTenantId;
  };
  
  // Helper function to get database user ID from auth user
  const getDbUserId = async () => {
    try {
      if (!user?.id) {
        return { success: false, error: 'No authenticated user found' };
      }
      return { success: true, userId: user.id };
    } catch (error) {
      console.error('Error getting user ID:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Initialize fallback tenant ID if context tenant is missing
  const initializeTenantContext = async () => {
    // If we already have a tenantId from context, return it
    if (tenantId) {
      console.log('✅ ManageTeachers: Using tenant from context:', tenantId);
      return tenantId;
    }
    
    // If we already have a fallback tenant, return it
    if (fallbackTenantId) {
      console.log('✅ ManageTeachers: Using fallback tenant:', fallbackTenantId);
      return fallbackTenantId;
    }
    
    // If no user, can't initialize
    if (!user || !user.email) {
      console.error('❌ ManageTeachers: Cannot initialize tenant - no user available');
      return null;
    }
    
    console.log('🔧 ManageTeachers: Tenant context missing, attempting email-based initialization...');
    console.log('🔧 ManageTeachers: User email:', user.email);
    
    try {
      // Use the robust email-based tenant lookup
      const result = await getCurrentUserTenantByEmail();
      
      console.log('🔧 ManageTeachers: Email-based tenant lookup result:', {
        success: result.success,
        tenantId: result.data?.tenantId || 'NONE',
        tenantName: result.data?.tenantName || 'NONE',
        error: result.error || 'none'
      });
      
      if (result.success && result.data?.tenantId) {
        const foundTenantId = result.data.tenantId;
        console.log('✅ ManageTeachers: Email-based tenant found:', foundTenantId, '-', result.data.tenantName);
        setFallbackTenantId(foundTenantId);
        return foundTenantId;
      } else {
        // Fallback: Try AdminTenantFix as backup
        console.warn('⚠️ ManageTeachers: Email-based lookup failed, trying AdminTenantFix...');
        const adminResult = await AdminTenantFix.getAdminTenantContext(user);
        
        if (adminResult.tenantId) {
          console.log('✅ ManageTeachers: AdminTenantFix succeeded:', adminResult.tenantId);
          setFallbackTenantId(adminResult.tenantId);
          return adminResult.tenantId;
        } else {
          const errorMessage = result.error || adminResult.error || 'No tenant context available. Please contact administrator.';
          console.error('❌ ManageTeachers: All tenant initialization methods failed');
          console.error('❌ ManageTeachers: Email-based error:', result.error);
          console.error('❌ ManageTeachers: AdminTenantFix error:', adminResult.error);
          setError(errorMessage);
          return null;
        }
      }
    } catch (error) {
      console.error('💥 ManageTeachers: Fatal error in tenant initialization:', error);
      setError('Failed to initialize tenant context. Please contact administrator.');
      return null;
    }
  };
  
  // Load data on component mount and when tenant changes
  useEffect(() => {
    // Prevent auto-refresh after deletion operations
    if (preventAutoRefresh) {
      console.log('🚫 ManageTeachers: Auto-refresh prevented after deletion');
      return;
    }
    
    console.log('🏢 ManageTeachers: useEffect triggered:', {
      tenantId: tenantId || 'NULL',
      user: user?.email || 'NULL'
    });
    
    const effectiveTenantId = getEffectiveTenantId();
    if (effectiveTenantId && user) {
      console.log('🏢 ManageTeachers: Loading data with tenant and user available');
      loadData();
    } else if (user) {
      console.warn('🏢 ManageTeachers: User available but waiting for tenant context...');
      // Try to initialize tenant context
      initializeTenantContext().then((initializedTenantId) => {
        if (initializedTenantId) {
          console.log('🏢 ManageTeachers: Tenant context initialized, loading data...');
          loadData();
        }
      });
    } else {
      console.warn('🏢 ManageTeachers: Waiting for user authentication...');
    }
    
    // Check if we need to open edit modal from navigation
    if (route.params?.openEditModal && route.params?.editTeacher) {
      setTimeout(() => {
        openEditModal(route.params.editTeacher);
      }, 500);
    }
  }, [route.params, tenantId, user, fallbackTenantId, preventAutoRefresh]);

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
  
  // Pull-to-refresh handler
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Use isRefresh=true to avoid showing the full-screen loading
      await loadData(0, true);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Function to load data using optimized approach with pagination
  const loadData = async (page = 0, isRefresh = false) => {
    const startTime = performance.now();
    
    // Only show full loading for initial load or refresh
    if (isRefresh || page === 0) {
      setLoading(true);
    }
    setError(null);
    
    try {
      console.log(`🏢 ManageTeachers: Loading page ${page} for tenant:`, tenantId);
      
      // Initialize tenant context if needed
      const effectiveTenantId = await initializeTenantContext();
      
      if (!effectiveTenantId) {
        console.error('❌ ManageTeachers: No tenant context available after initialization');
        setError('No tenant context available. Please contact administrator.');
        setLoading(false);
        return;
      }
      
      // 🛑️ Validate tenant access first
      const validation = await validateTenantAccess(user?.id, effectiveTenantId, 'ManageTeachers');
      if (!validation.isValid) {
        console.error('❌ ManageTeachers: Tenant validation failed:', validation.error);
        setError(validation.error);
        setLoading(false);
        return;
      }

      console.log('🚀 ManageTeachers: Loading teachers with optimized query for tenant:', effectiveTenantId);
      
      console.log('✅ ManageTeachers: Tenant validation successful');

      // 🚀 Direct query with effective tenant ID (from context or fallback)
      console.log('🏢 ManageTeachers: Querying teachers directly with effective tenant:', effectiveTenantId);
      
      // Direct query - no pagination variables needed since we're not using them
      const { data: teachersData, error: teachersError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });
      
      console.log('🏢 ManageTeachers: Teachers query result:', {
        success: !teachersError,
        count: teachersData?.length || 0,
        error: teachersError?.message || 'none'
      });
      
      if (teachersError) {
        console.error('❌ ManageTeachers: Error loading teachers:', teachersError);
        throw new Error(`Failed to load teachers: ${teachersError.message}`);
      }
      
      // 🚀 OPTIMIZED: Direct parallel queries - much faster
      console.log('🏢 ManageTeachers: Fetching classes and subjects...');
      const [classesResult, subjectsResult] = await Promise.all([
        supabase
          .from(TABLES.CLASSES)
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .order('class_name'),
        supabase
          .from(TABLES.SUBJECTS)
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .order('name')
      ]);
      
      // Process teachers data with basic info
      const processedTeachers = (teachersData || []).map(teacher => ({
        ...teacher,
        subjects: [], // Will load on-demand when editing
        classes: []   // Will load on-demand when editing  
      }));
      
      console.log(`✅ ManageTeachers: Processed ${processedTeachers.length} teachers`);
      
      // Update teachers state
      setTeachers(processedTeachers);
      setTotalTeachers(processedTeachers.length);
      
      console.log('🔍 Debug - Teachers loaded:', {
        count: processedTeachers.length,
        teacherIds: processedTeachers.map(t => ({ id: t.id, name: t.name })),
        isRefresh: isRefresh,
        page: page,
        tenantId: effectiveTenantId
      });
      
      // Extract data from parallel queries
      const { data: classesData, error: classesError } = classesResult;
      const { data: subjectsData, error: subjectsError } = subjectsResult;
      
      // Set classes data
      if (classesError) {
        console.warn('⚠️ ManageTeachers: Failed to load classes:', classesError.message);
        setClasses([]);
      } else {
        setClasses(classesData || []);
        console.log(`✅ ManageTeachers: Loaded ${(classesData || []).length} classes`);
      }
      
      // Set subjects data
      if (subjectsError) {
        console.warn('⚠️ ManageTeachers: Failed to load subjects:', subjectsError.message);
        setSubjects([]);
      } else {
        setSubjects(subjectsData || []);
        console.log(`✅ ManageTeachers: Loaded ${(subjectsData || []).length} subjects`);
      }
      
      // Simple logging
      console.log('📋 ManageTeachers: Data loaded successfully:', {
        teachers: processedTeachers.length,
        classes: classesData?.length || 0,
        subjects: subjectsData?.length || 0,
        tenantId: effectiveTenantId
      });
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ ManageTeachers: Page ${page} loaded in ${loadTime}ms - ${teachers.length} teachers`);
      
    } catch (err) {
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.error(`❌ ManageTeachers: Error loading after ${loadTime}ms:`, err);
      setError(err.message || 'Failed to load teachers data');
    } finally {
      setLoading(false);
    }
  };

  
  // Handle load more teachers (simple version without pagination)
  const loadMoreTeachers = async () => {
    // Disabled pagination for now - we load all teachers at once
    console.log('🏢 ManageTeachers: Load more called but pagination disabled');
  };

  const loadSections = async (classId) => {
    const { data, error } = await dbHelpers.getSectionsByClass(classId);
    if (error) {
      return;
    }
    setSections(data);
  };

  const loadSectionsForClasses = async (classIds) => {
    if (!classIds || classIds.length === 0) {
      setSections([]);
      return;
    }
    
    try {
      // 🚀 OPTIMIZED: Simple direct query
      const effectiveTenantId = getEffectiveTenantId();
      if (!effectiveTenantId) {
        console.warn('🏢 ManageTeachers: No tenant context for loading sections');
        setSections([]);
        return;
      }
      
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('section')
        .eq('tenant_id', effectiveTenantId)
        .in('id', classIds)
        .not('section', 'is', null);
      
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
      // Fetch current teacher's subject and class assignments
      const { data: teacherSubjects, error: tsError } = await dbHelpers.getTeacherSubjects(teacher.id);
      if (tsError) throw tsError;

      // Also fetch direct class teacher assignments
      const { data: directClassAssignments, error: dcError } = await supabase
        .from('classes')
        .select('id')
        .eq('class_teacher_id', teacher.id);
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
    console.log('🏢 ManageTeachers: Saving with tenant context:', {
      tenantId: tenantId || 'NULL',
      modalMode,
      userEmail: user?.email || 'NULL'
    });
    
    // 🛑️ Validate tenant access first
    const userIdResult = await getDbUserId();
    if (!userIdResult.success) {
      console.error('❌ ManageTeachers: Failed to get user ID for save:', userIdResult.error);
      Alert.alert('Access Denied', `Unable to verify user access: ${userIdResult.error}`);
      return;
    }
    
    const validation = await validateTenantAccess(userIdResult.userId, getEffectiveTenantId(), 'ManageTeachers - Save');
    if (!validation.isValid) {
      console.error('❌ ManageTeachers: Save validation failed:', validation.error);
      Alert.alert('Access Denied', validation.error);
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
          tenant_id: getEffectiveTenantId(), // Add tenant_id
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

      // 🛡️ Validate tenant access for assignments
      const userIdResult = await getDbUserId();
      if (!userIdResult.success) {
        throw new Error(`Unable to verify user access: ${userIdResult.error}`);
      }
      
      const validation = await validateTenantAccess(userIdResult.userId, getEffectiveTenantId(), 'ManageTeachers - Assignments');
      if (!validation.isValid) {
        throw new Error(`Assignment access denied: ${validation.error}`);
      }

      // 1. Handle subject assignments first
      // Get all existing subject assignments for this teacher using tenant-aware query
      const { data: existingAssignments, error: fetchError } = await createTenantQuery(tenantId, TABLES.TEACHER_SUBJECTS)
        .select('*')
        .eq('teacher_id', teacherId)
        .execute();
      if (fetchError) {
        console.error('Failed to fetch existing assignments:', fetchError);
        throw new Error('Failed to fetch existing assignments');
      }

      console.log('Existing subject assignments:', existingAssignments);

      // Delete existing subject assignments
      if (existingAssignments.length > 0) {
        const { error: deleteError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .delete()
          .eq('teacher_id', teacherId);
        if (deleteError) {
          console.error('Failed to delete assignments:', deleteError);
          throw new Error('Failed to update assignments');
        }
        console.log('Deleted existing subject assignments');
      }

      // Create new assignments for selected subjects (with tenant_id)
      const assignments = form.subjects.map(subjectId => ({
        teacher_id: teacherId,
        subject_id: subjectId,
        tenant_id: getEffectiveTenantId(), // Add tenant_id
      }));

      console.log('New subject assignments to insert:', assignments);

      // Insert new subject assignments if there are any
      if (assignments.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .insert(assignments)
          .select();
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
      const { data: currentClassTeacherAssignments } = await supabase
        .from('classes')
        .select('id, class_name')
        .eq('class_teacher_id', teacherId);

      console.log('Current class teacher assignments:', currentClassTeacherAssignments);

      // Remove this teacher from all classes where they were class teacher
      if (currentClassTeacherAssignments && currentClassTeacherAssignments.length > 0) {
        const { error: removeError } = await supabase
          .from('classes')
          .update({ class_teacher_id: null })
          .eq('class_teacher_id', teacherId);
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
          const { error: assignError } = await supabase
            .from('classes')
            .update({ class_teacher_id: teacherId })
            .eq('id', classId);
          
          if (assignError) {
            console.error(`Failed to assign teacher to class ${classId}:`, assignError);
            console.warn(`Could not assign teacher to class ${classId}`);
          } else {
            console.log(`Successfully assigned teacher to class ${classId}`);
          }
        }
      }

      // 3. Update teacher's is_class_teacher flag
      const { error: updateTeacherError } = await supabase
        .from(TABLES.TEACHERS)
        .update({ 
          is_class_teacher: form.classes.length > 0
        })
        .eq('id', teacherId);
      
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
  
  // Extracted deletion logic so it can be called from web (window.confirm) and native (Alert button)
  const performDeleteTeacher = async (teacher) => {
    // COMPREHENSIVE DEBUG LOGGING
    console.log('🚨 DEBUG: Starting performDeleteTeacher function');
    console.log('🚨 DEBUG: Teacher object:', JSON.stringify(teacher, null, 2));
    console.log('🚨 DEBUG: Teacher ID:', teacher?.id, 'Type:', typeof teacher?.id);
    console.log('🚨 DEBUG: Teacher Name:', teacher?.name);
    console.log('🚨 DEBUG: Current tenant context:', {
      tenantId: tenantId || 'NULL',
      fallbackTenantId: fallbackTenantId || 'NULL',
      effectiveTenantId: getEffectiveTenantId() || 'NULL'
    });
    console.log('🚨 DEBUG: Current user:', {
      userId: user?.id || 'NULL',
      email: user?.email || 'NULL'
    });
    
    if (!teacher || !teacher.id) {
      console.error('🚨 CRITICAL ERROR: Teacher object or ID is missing!');
      Alert.alert('Error', 'Invalid teacher data. Cannot proceed with deletion.');
      return;
    }
    
    setLoading(true);
    try {
      // 🛑️ Validate tenant access for deletion
      console.log('🚨 DEBUG: Starting tenant validation...');
      console.log('🏢 ManageTeachers: Delete validation for tenant:', tenantId);

      const userIdResult = await getDbUserId();
      console.log('🚨 DEBUG: User ID result:', userIdResult);
      if (!userIdResult.success) {
        console.error('❌ ManageTeachers: Failed to get user ID for delete:', userIdResult.error);
        Alert.alert('Access Denied', `Unable to verify user access: ${userIdResult.error}`);
        setLoading(false);
        return;
      }

      const effectiveTenantId = getEffectiveTenantId();
      console.log('🚨 DEBUG: About to validate tenant access with:', {
        userId: userIdResult.userId,
        tenantId: effectiveTenantId,
        context: 'ManageTeachers - Delete'
      });
      
      const validation = await validateTenantAccess(userIdResult.userId, effectiveTenantId, 'ManageTeachers - Delete');
      console.log('🚨 DEBUG: Tenant validation result:', validation);
      if (!validation.isValid) {
        console.error('❌ ManageTeachers: Delete validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        setLoading(false);
        return;
      }

      console.log('🏢 ManageTeachers: Delete validation passed');
      console.log(`🚨 DEBUG: Starting deletion process for teacher: ${teacher.name} (ID: ${teacher.id})`);

      // 1. Remove teacher from direct class teacher assignments
      console.log('🚨 DEBUG: Step 1 - Removing from class teacher assignments...');
      const { data: classUpdateData, error: classTeacherError } = await supabase
        .from('classes')
        .update({ class_teacher_id: null })
        .eq('class_teacher_id', teacher.id)
        .select();
      console.log('🚨 DEBUG: Class teacher update result:', {
        data: classUpdateData,
        error: classTeacherError,
        affectedRows: classUpdateData?.length || 0
      });
      if (classTeacherError) {
        console.error('❌ ERROR: Class teacher assignments removal failed:', classTeacherError);
        throw new Error(`Failed to remove class teacher assignments: ${classTeacherError.message}`);
      }
      console.log('✓ Removed from direct class teacher assignments');

      // 2. Delete teacher-subject assignments
      console.log('🚨 DEBUG: Step 2 - Deleting teacher-subject assignments...');
      const { data: assignmentDeleteData, error: assignmentError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .delete()
        .eq('teacher_id', teacher.id)
        .select();
      console.log('🚨 DEBUG: Assignment deletion result:', {
        data: assignmentDeleteData,
        error: assignmentError,
        deletedRows: assignmentDeleteData?.length || 0
      });
      if (assignmentError) {
        console.error('❌ ERROR: Assignment deletion failed:', assignmentError);
        throw new Error(`Failed to delete teacher assignments: ${assignmentError.message}`);
      }
      console.log('✓ Deleted teacher-subject assignments');

      // 3. Delete teacher attendance records
      console.log('🚨 DEBUG: Step 3 - Deleting teacher attendance...');
      const { data: attendanceDeleteData, error: attendanceError } = await supabase
        .from(TABLES.TEACHER_ATTENDANCE)
        .delete()
        .eq('teacher_id', teacher.id)
        .select();
      console.log('🚨 DEBUG: Attendance deletion result:', {
        data: attendanceDeleteData,
        error: attendanceError,
        deletedRows: attendanceDeleteData?.length || 0
      });
      if (attendanceError) {
        console.error('❌ ERROR: Attendance deletion failed:', attendanceError);
        throw new Error(`Failed to delete teacher attendance: ${attendanceError.message}`);
      }
      console.log('✓ Deleted teacher attendance records');

      // 4. Delete homework assignments (if homeworks table exists)
      console.log('🚨 DEBUG: Step 4 - Deleting homework assignments...');
      try {
        const { data: homeworkDeleteData, error: homeworkError } = await supabase
          .from('homeworks')
          .delete()
          .eq('teacher_id', teacher.id)
          .select();
        console.log('🚨 DEBUG: Homework deletion result:', {
          data: homeworkDeleteData,
          error: homeworkError,
          deletedRows: homeworkDeleteData?.length || 0
        });
        if (homeworkError && !homeworkError.message.includes('does not exist')) {
          console.warn('⚠️ WARNING: Error deleting teacher homework:', homeworkError);
        }
        console.log('✓ Deleted teacher homework records');
      } catch (homeworkErr) {
        console.log('ℹ Homeworks table not found, skipping...', homeworkErr.message);
      }

      // 5. Delete tasks assigned to teacher
      console.log('🚨 DEBUG: Step 5 - Deleting teacher tasks...');
      try {
        const { data: tasksDeleteData, error: tasksError } = await supabase
          .from(TABLES.TASKS)
          .delete()
          .eq('assigned_to', teacher.id)
          .select();
        console.log('🚨 DEBUG: Tasks deletion result:', {
          data: tasksDeleteData,
          error: tasksError,
          deletedRows: tasksDeleteData?.length || 0
        });
        if (tasksError && !tasksError.message.includes('does not exist')) {
          console.warn('⚠️ WARNING: Error deleting teacher tasks:', tasksError);
        }
        console.log('✓ Deleted teacher tasks');
      } catch (tasksErr) {
        console.log('ℹ Tasks table reference to teacher not found, skipping...', tasksErr.message);
      }

      // 6. Delete timetable entries (CRITICAL: Must delete, not update to NULL)
      console.log('🚨 DEBUG: Step 6 - Deleting timetable entries...');
      try {
        const { data: timetableDeleteData, error: timetableError } = await supabase
          .from(TABLES.TIMETABLE)
          .delete()
          .eq('teacher_id', teacher.id)
          .select();
        console.log('🚨 DEBUG: Timetable deletion result:', {
          data: timetableDeleteData,
          error: timetableError,
          deletedRows: timetableDeleteData?.length || 0
        });
        if (timetableError) {
          console.error('❌ ERROR: Timetable entries deletion failed:', timetableError);
          throw new Error(`Failed to delete timetable entries: ${timetableError.message}`);
        }
        console.log('✓ Deleted timetable entries');
      } catch (timetableErr) {
        console.error('❌ ERROR: Exception during timetable deletion:', timetableErr);
        throw new Error(`Failed to delete timetable entries: ${timetableErr.message}`);
      }

      // 6.1. Handle leave applications where teacher is primary teacher
      console.log('🚨 DEBUG: Step 6.1 - Deleting leave applications as primary teacher...');
      try {
        const { data: leaveDeleteData, error: leaveError } = await supabase
          .from(TABLES.LEAVE_APPLICATIONS)
          .delete()
          .eq('teacher_id', teacher.id)
          .select();
        console.log('🚨 DEBUG: Leave applications deletion result (primary):', {
          data: leaveDeleteData,
          error: leaveError,
          deletedRows: leaveDeleteData?.length || 0
        });
        if (leaveError) {
          console.error('❌ ERROR: Leave applications deletion failed (primary):', leaveError);
          throw new Error(`Failed to delete leave applications: ${leaveError.message}`);
        }
        console.log('✓ Deleted leave applications as primary teacher');
      } catch (leaveErr) {
        console.error('❌ ERROR: Exception during leave applications deletion (primary):', leaveErr);
        throw new Error(`Failed to delete leave applications: ${leaveErr.message}`);
      }

      // 6.2. Update leave applications where teacher is replacement teacher (set to NULL)
      console.log('🚨 DEBUG: Step 6.2 - Updating leave applications as replacement teacher...');
      try {
        const { data: replacementUpdateData, error: replacementError } = await supabase
          .from(TABLES.LEAVE_APPLICATIONS)
          .update({ replacement_teacher_id: null })
          .eq('replacement_teacher_id', teacher.id)
          .select();
        console.log('🚨 DEBUG: Leave applications update result (replacement):', {
          data: replacementUpdateData,
          error: replacementError,
          updatedRows: replacementUpdateData?.length || 0
        });
        if (replacementError) {
          console.error('❌ ERROR: Leave applications update failed (replacement):', replacementError);
          throw new Error(`Failed to update replacement teacher in leave applications: ${replacementError.message}`);
        }
        console.log('✓ Updated leave applications replacement teacher to NULL');
      } catch (replacementErr) {
        console.error('❌ ERROR: Exception during leave applications update (replacement):', replacementErr);
        throw new Error(`Failed to update replacement teacher in leave applications: ${replacementErr.message}`);
      }

      // 7. Update or delete any user accounts linked to this teacher
      console.log('🚨 DEBUG: Step 7 - Unlinking user accounts...');
      try {
        const { data: userUpdateData, error: userError } = await supabase
          .from(TABLES.USERS)
          .update({ linked_teacher_id: null })
          .eq('linked_teacher_id', teacher.id)
          .select();
        console.log('🚨 DEBUG: User unlinking result:', {
          data: userUpdateData,
          error: userError,
          affectedRows: userUpdateData?.length || 0
        });
        if (userError && !userError.message.includes('does not exist')) {
          console.warn('⚠️ WARNING: Error unlinking teacher from user accounts:', userError);
        }
        console.log('✓ Unlinked teacher from user accounts');
      } catch (userErr) {
        console.log('ℹ User accounts not linked to teacher, skipping...', userErr.message);
      }

      // 8. CRITICAL: Finally, delete the teacher record
      console.log('🚨 DEBUG: Step 8 - DELETING MAIN TEACHER RECORD...');
      console.log('🚨 DEBUG: About to delete teacher with ID:', teacher.id, 'from table:', TABLES.TEACHERS);
      
      // First, let's verify the teacher exists before deletion
      const { data: verifyTeacher, error: verifyError } = await supabase
        .from(TABLES.TEACHERS)
        .select('id, name, tenant_id')
        .eq('id', teacher.id)
        .single();
      
      console.log('🚨 DEBUG: Teacher verification before deletion:', {
        found: !!verifyTeacher,
        teacher: verifyTeacher,
        error: verifyError
      });
      
      if (verifyError && verifyError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('❌ ERROR: Could not verify teacher exists:', verifyError);
        throw new Error(`Could not verify teacher exists: ${verifyError.message}`);
      }
      
      if (!verifyTeacher) {
        console.warn('⚠️ WARNING: Teacher not found in database, may already be deleted');
        Alert.alert('Notice', 'Teacher may have already been deleted.');
        // Still update local state
        setTeachers(prev => prev.filter(t => t.id !== teacher.id));
        setTotalTeachers(prev => Math.max(0, prev - 1));
        return;
      }
      
      // Now perform the actual deletion
      const { data: deleteData, error: deleteError } = await supabase
        .from(TABLES.TEACHERS)
        .delete()
        .eq('id', teacher.id)
        .select();

      console.log('🚨 DEBUG: MAIN TEACHER DELETION RESULT:', {
        data: deleteData,
        error: deleteError,
        deletedRows: deleteData?.length || 0,
        deletedTeacher: deleteData?.[0] || null
      });

      if (deleteError) {
        console.error('❌ CRITICAL ERROR: Teacher record deletion failed:', deleteError);
        console.error('❌ Full error details:', JSON.stringify(deleteError, null, 2));
        throw new Error(`Failed to delete teacher: ${deleteError.message}`);
      }

      if (!deleteData || deleteData.length === 0) {
        console.error('❌ CRITICAL ERROR: No rows were deleted from teachers table!');
        console.error('❌ This suggests the teacher ID may not match any records');
        throw new Error('No teacher record was found to delete. The teacher may not exist in the database.');
      }

      console.log('✅ SUCCESS: Teacher record deleted from database');
      console.log('✅ Deleted teacher data:', deleteData[0]);

      // Prevent any auto-refresh after deletion
      setPreventAutoRefresh(true);
      
      // Update local state immediately
      console.log('🚨 DEBUG: Updating local state...');
      setTeachers(prev => {
        const filtered = prev.filter(t => t.id !== teacher.id);
        console.log('🚨 DEBUG: Local state update - before:', prev.length, 'after:', filtered.length);
        return filtered;
      });
      setTotalTeachers(prev => {
        const newCount = Math.max(0, prev - 1);
        console.log('🚨 DEBUG: Total teachers updated - before:', prev, 'after:', newCount);
        return newCount;
      });

      // Show success message with teacher name (same behavior on web and mobile)
      Alert.alert('Success', `Successfully deleted teacher: ${teacher.name}`);
      console.log(`✅ Teacher deletion completed successfully: ${teacher.name}`);
      
      // Reset prevent flag after a delay to allow normal operations later
      setTimeout(() => {
        setPreventAutoRefresh(false);
        console.log('🔄 ManageTeachers: Auto-refresh re-enabled');
      }, 2000);

    } catch (err) {
      console.error('❌ Error deleting teacher:', err);
      if (Platform.OS === 'web') {
        // Basic web fallback
        console.error(`Could not delete ${teacher.name}: ${err.message}`);
      } else {
        Alert.alert(
          'Deletion Failed', 
          `Could not delete ${teacher.name}: ${err.message}\n\nPlease check if this teacher has dependencies that need to be removed first.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teacher) => {
    // Show confirmation dialog before deletion
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to delete teacher "${teacher.name}"?\n\n` +
        `This will permanently remove the teacher and all their assignments, ` +
        `attendance records, and associated data. This action cannot be undone.`
      );
      if (confirmed) {
        await performDeleteTeacher(teacher);
      }
    } else {
      Alert.alert(
        'Delete Teacher',
        `Are you sure you want to delete teacher "${teacher.name}"?\n\n` +
        `This will permanently remove the teacher and all their assignments, ` +
        `attendance records, and associated data. This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => performDeleteTeacher(teacher)
          }
        ]
      );
    }
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
  if (loading && teachers.length === 0) {
    return (
      <View style={styles.fullScreenLoading}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="school-outline" size={48} color="#4CAF50" style={styles.loadingIcon} />
            <PaperActivityIndicator size="large" color="#4CAF50" style={styles.loadingSpinner} />
          </View>
          <Text style={styles.loadingTitle}>Manage Teachers</Text>
          <Text style={styles.loadingText}>Loading teachers data...</Text>
          <Text style={styles.loadingSubtext}>Please wait while we fetch the information</Text>
        </View>
      </View>
    );
  }
  
  // Render error state
  if (error && teachers.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Header title="Manage Teachers" showBack={true} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Header title="Manage Teachers" showBack={true} />
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
      {/* Add/Edit Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons
                  name={modalMode === 'add' ? "person-add" : "create"}
                  size={24}
                  color="#2196F3"
                  style={styles.modalIcon}
                />
                <Text style={styles.modalTitle}>
                  {modalMode === 'add' ? 'Add New Teacher' : 'Edit Teacher'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Personal Information Section */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-outline" size={20} color="#2196F3" />
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <TextInput
                    placeholder="Enter teacher's full name"
                    value={form.name}
                    onChangeText={text => setForm({ ...form, name: text })}
                    style={styles.textInput}
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <TextInput
                    placeholder="Enter phone number"
                    value={form.phone}
                    onChangeText={text => setForm({ ...form, phone: text })}
                    keyboardType="phone-pad"
                    style={styles.textInput}
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Age *</Text>
                  <TextInput
                    placeholder="Enter age (must be > 18)"
                    value={form.age}
                    onChangeText={text => setForm({ ...form, age: text })}
                    keyboardType="numeric"
                    style={styles.textInput}
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Address</Text>
                  <TextInput
                    placeholder="Enter full address"
                    value={form.address}
                    onChangeText={text => setForm({ ...form, address: text })}
                    style={[styles.textInput, styles.multilineInput]}
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Qualification *</Text>
                  <TextInput
                    placeholder="e.g., B.Ed, M.A, Ph.D"
                    value={form.qualification}
                    onChangeText={text => setForm({ ...form, qualification: text })}
                    style={styles.textInput}
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monthly Salary *</Text>
                  <View style={styles.salaryInputContainer}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      placeholder="Enter monthly salary"
                      value={form.salary}
                      onChangeText={text => setForm({ ...form, salary: text })}
                      keyboardType="numeric"
                      style={styles.salaryInput}
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              </View>
              {/* Class Assignment Section */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="school-outline" size={20} color="#FF9800" />
                  <Text style={styles.sectionTitle}>Class Assignment</Text>
                </View>

                <Text style={styles.sectionDescription}>
                  Select classes this teacher will handle
                </Text>

                <View style={styles.checkboxGrid}>
                  {classes.length > 0 ? (
                    classes.map(cls => (
                      <TouchableOpacity
                        key={cls.id}
                        style={[
                          styles.checkboxCard,
                          form.classes.includes(cls.id) && styles.checkboxCardSelected
                        ]}
                        onPress={() => setForm({ ...form, classes: toggleSelect(form.classes, cls.id) })}
                      >
                        <View style={styles.checkboxCardContent}>
                          <Ionicons
                            name={form.classes.includes(cls.id) ? 'checkmark-circle' : 'ellipse-outline'}
                            size={24}
                            color={form.classes.includes(cls.id) ? '#FF9800' : '#ccc'}
                          />
                          <View style={styles.classCardTextContainer}>
                            <Text style={[
                              styles.checkboxCardText,
                              form.classes.includes(cls.id) && styles.checkboxCardTextSelected
                            ]}>
                              {cls.class_name}
                            </Text>
                            <View style={styles.sectionBadgeContainer}>
                              <View style={[
                                styles.sectionBadge,
                                form.classes.includes(cls.id) && styles.sectionBadgeSelected
                              ]}>
                                <Text style={[
                                  styles.sectionBadgeText,
                                  form.classes.includes(cls.id) && styles.sectionBadgeTextSelected
                                ]}>
                                  {cls.section || '?'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.noSelectionContainer}>
                      <Text style={styles.noSelectionText}>
                        No classes available. Please create classes first in Manage Classes.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Subject Assignment Section */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="book-outline" size={20} color="#4CAF50" />
                  <Text style={styles.sectionTitle}>Subject Assignment</Text>
                </View>

                <Text style={styles.sectionDescription}>
                  Select subjects this teacher will teach (grouped by selected classes)
                </Text>

                {form.classes.length > 0 ? (
                  form.classes.map(classId => {
                    const selectedClass = classes.find(c => c.id === classId);
                    const classSubjects = subjects.filter(subject => subject.class_id === classId);

                    return (
                      <View key={classId} style={styles.classSubjectsGroup}>
                        <Text style={styles.classSubjectsTitle}>
                          📚 {selectedClass?.class_name} - Subjects
                        </Text>
                        <View style={styles.checkboxGrid}>
                          {classSubjects.length > 0 ? (
                            classSubjects.map(subject => (
                              <TouchableOpacity
                                key={subject.id}
                                style={[
                                  styles.checkboxCard,
                                  form.subjects.includes(subject.id) && styles.checkboxCardSelected
                                ]}
                                onPress={() => setForm({ ...form, subjects: toggleSelect(form.subjects, subject.id) })}
                              >
                                <View style={styles.checkboxCardContent}>
                                  <Ionicons
                                    name={form.subjects.includes(subject.id) ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={24}
                                    color={form.subjects.includes(subject.id) ? '#4CAF50' : '#ccc'}
                                  />
                                  <Text style={[
                                    styles.checkboxCardText,
                                    form.subjects.includes(subject.id) && styles.checkboxCardTextSelected
                                  ]}>
                                    {subject.name}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.noSelectionContainer}>
                              <Text style={styles.noSelectionText}>
                                No subjects available for {selectedClass?.class_name}. Please add subjects to this class first.
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.noSelectionContainer}>
                    <Text style={styles.noSelectionText}>
                      Please select classes first to see available subjects
                    </Text>
                  </View>
                )}
              </View>

              {/* Section Information Section */}
              {form.classes.length > 0 && (
                <View style={styles.formSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="layers-outline" size={20} color="#9C27B0" />
                    <Text style={styles.sectionTitle}>Class & Section Details</Text>
                  </View>

                  <Text style={styles.sectionDescription}>
                    Classes and their assigned sections (automatically assigned when you select a class)
                  </Text>

                  {form.classes.map(classId => {
                    const selectedClass = classes.find(c => c.id === classId);
                    
                    return (
                      <View key={classId} style={styles.classSectionInfo}>
                        <View style={styles.classSectionHeader}>
                          <Ionicons name="school" size={18} color="#FF9800" />
                          <Text style={styles.classSectionName}>
                            {selectedClass?.class_name}
                          </Text>
                          <View style={styles.sectionBadgeLarge}>
                            <Text style={styles.sectionBadgeLargeText}>
                              {selectedClass?.section || '?'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.classSectionDetails}>
                          <Ionicons name="layers" size={16} color="#9C27B0" />
                          <Text style={styles.classSectionText}>
                            Section {selectedClass?.section || 'not assigned'}
                          </Text>
                        </View>
                        <Text style={styles.classSectionNote}>
                          ✓ Teacher assigned as Class Teacher for {selectedClass?.class_name} - Section {selectedClass?.section || 'N/A'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, saving && styles.cancelButtonDisabled]}
                onPress={closeModal}
                disabled={saving}
              >
                <Text style={[styles.cancelButtonText, saving && styles.cancelButtonTextDisabled]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <PaperActivityIndicator
                      size={20}
                      color="#fff"
                      style={styles.saveButtonIcon}
                    />
                    <Text style={styles.saveButtonText}>
                      {modalMode === 'add' ? 'Adding...' : 'Saving...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={modalMode === 'add' ? "add" : "save"}
                      size={20}
                      color="#fff"
                      style={styles.saveButtonIcon}
                    />
                    <Text style={styles.saveButtonText}>
                      {modalMode === 'add' ? 'Add Teacher' : 'Save Changes'}
                    </Text>
                  </>
                )}
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
        overflow: 'hidden',
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
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  modalScrollView: {
    maxHeight: '70%',
  },
  // Form Sections
  formSection: {
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  // Input Groups
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  salaryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  salaryInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  // Checkbox Grid
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    minWidth: '45%',
    flex: 1,
  },
  checkboxCardSelected: {
    backgroundColor: '#fff',
    borderColor: '#2196F3',
  },
  checkboxCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  checkboxCardTextSelected: {
    color: '#333',
    fontWeight: '600',
  },
  // Section Assignment
  sectionAssignmentItem: {
    marginBottom: 16,
  },
  sectionAssignmentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  picker: {
    height: 50,
  },
  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  cancelButtonTextDisabled: {
    color: '#999',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.8,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  // Class-grouped subjects styles
  classSubjectsGroup: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  classSubjectsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  noSelectionContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  noSelectionText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Class Section Info Styles
  classSectionInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  classSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  classSectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  classSectionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  classSectionText: {
    fontSize: 14,
    color: '#9C27B0',
    fontWeight: '500',
    marginLeft: 6,
  },
  classSectionNote: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
  },
  // Class Card Text Container Styles
  classCardTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  classCardSectionText: {
    fontSize: 12,
    color: '#9C27B0',
    fontWeight: '500',
    marginTop: 2,
  },
  classCardSectionTextSelected: {
    color: '#7B1FA2',
    fontWeight: '600',
  },
  // Section Badge Styles
  sectionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionBadge: {
    backgroundColor: '#E8EAF6',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C5CAE9',
  },
  sectionBadgeSelected: {
    backgroundColor: '#3F51B5',
    borderColor: '#3F51B5',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C6BC0',
    textAlign: 'center',
  },
  sectionBadgeTextSelected: {
    color: '#fff',
  },
  // Large Section Badge Styles (for Class & Section Details)
  sectionBadgeLarge: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sectionBadgeLargeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
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
  // Delete Confirmation Modal Styles for Web
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    minWidth: 320,
    maxWidth: 400,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  deleteModalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  deleteModalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffebee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  deleteModalBody: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  deleteModalTeacherName: {
    fontWeight: '600',
    color: '#333',
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  deleteModalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  deleteModalDeleteButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#f44336',
    borderBottomRightRadius: 16,
  },
  deleteModalDeleteIcon: {
    marginRight: 6,
  },
  deleteModalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ManageTeachers;
