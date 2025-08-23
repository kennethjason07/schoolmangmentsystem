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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';

// Will be fetched from Supabase
const ManageTeachers = ({ navigation, route }) => {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [form, setForm] = useState({ name: '', subjects: [], classes: [], salary: '', qualification: '', sections: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState([]);
  
  // Load data on component mount
  useEffect(() => {
    loadData();
    
    // Check if we need to open edit modal from navigation
    if (route.params?.openEditModal && route.params?.editTeacher) {
      setTimeout(() => {
        openEditModal(route.params.editTeacher);
      }, 500);
    }
  }, [route.params]);

  useEffect(() => {
    // When selected classes change, filter out subjects that are no longer valid
    const validSubjects = form.subjects.filter(subjectId => {
      const subject = subjects.find(s => s.id === subjectId);
      return subject && form.classes.includes(subject.class_id);
    });

    if (validSubjects.length !== form.subjects.length) {
      setForm(prevForm => ({ ...prevForm, subjects: validSubjects }));
    }

    // Fetch sections for the selected classes
    if (form.classes.length > 0) {
      const classId = form.classes[form.classes.length - 1];
      loadSections(classId);
    }

  }, [form.classes, subjects]);
  
  // Function to load all necessary data
  const loadData = async () => {
    const startTime = performance.now(); // 📊 Performance monitoring
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Loading teachers with optimized query...');
      
      // Use a single JOIN query to get all teacher data with related information
      const { data: teachersData, error: teachersError } = await supabase
        .from(TABLES.TEACHERS)
        .select(`
          *,
          users(
            id,
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });
      
      if (teachersError) {
        console.error("Supabase error loading teachers:", teachersError);
        throw new Error('Failed to load teachers');
      }
      
      // Load classes
      const { data: classesData, error: classesError } = await dbHelpers.getClasses();
      if (classesError) throw new Error('Failed to load classes');
      
      // Load subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select('*');
      if (subjectsError) throw new Error('Failed to load subjects');
      
      if (!teachersData || teachersData.length === 0) {
        setTeachers([]);
        setClasses(classesData);
        setSubjects(subjectsData);
        return;
      }
      
      // Get all teacher subject assignments in a single query
      const teacherIds = teachersData.map(t => t.id);
      const { data: allTeacherSubjects } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          teacher_id,
          subject_id,
          subjects(
            id,
            name,
            class_id
          )
        `)
        .in('teacher_id', teacherIds);
      
      // Create teacher subjects lookup map for O(1) access
      const teacherSubjectsLookup = {};
      (allTeacherSubjects || []).forEach(assignment => {
        if (!teacherSubjectsLookup[assignment.teacher_id]) {
          teacherSubjectsLookup[assignment.teacher_id] = [];
        }
        teacherSubjectsLookup[assignment.teacher_id].push(assignment);
      });
      
      // Process teacher data - no async operations needed
      const processedTeachers = teachersData.map(teacher => {
        const teacherSubjects = teacherSubjectsLookup[teacher.id] || [];
        
        // Extract unique subject IDs and class IDs
        const subjectIds = new Set();
        const classIds = new Set();
        teacherSubjects.forEach(ts => {
          if (ts.subject_id) subjectIds.add(ts.subject_id);
          if (ts.subjects?.class_id) classIds.add(ts.subjects.class_id);
        });
        
        return {
          ...teacher,
          subjects: Array.from(subjectIds),
          classes: Array.from(classIds),
        };
      });
      
      // Update state with loaded data
      setTeachers(processedTeachers);
      setClasses(classesData);
      // Ensure subjects are unique by ID before setting to state
      const uniqueSubjects = Array.from(new Map(subjectsData.map(subject => [subject.id, subject])).values());
      setSubjects(uniqueSubjects);
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.log(`✅ Teachers loaded successfully in ${loadTime}ms`);
      console.log(`📈 Performance: ${processedTeachers.length} teachers processed`);
      
      if (loadTime > 1000) {
        console.warn('⚠️ Slow loading detected. Consider adding more database indexes.');
      } else {
        console.log('🚀 Fast loading achieved!');
      }
      
    } catch (err) {
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      console.error(`❌ Error loading teachers after ${loadTime}ms:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Error during refresh:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const loadSections = async (classId) => {
    const { data, error } = await dbHelpers.getSectionsByClass(classId);
    if (error) {
      return;
    }
    setSections(data);
  };

  // Multi-select logic
  const toggleSelect = (arr, value) => arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const openAddModal = () => {
    setModalMode('add');
    setForm({ name: '', subjects: [], classes: [], salary: '', qualification: '', sections: {} });
    setIsModalVisible(true);
  };
  const openEditModal = async (teacher) => {
    setModalMode('edit');
    setSelectedTeacher(teacher);

    try {
      // Fetch current teacher's subject and class assignments
      const { data: teacherSubjects, error: tsError } = await dbHelpers.getTeacherSubjects(teacher.id);
      if (tsError) throw tsError;

      // Extract subject and class IDs from teacher assignments
      const subjectIds = [];
      const classIds = new Set(); // Use Set to avoid duplicates
      const sections = {};

      teacherSubjects?.forEach(ts => {
        if (ts.subject_id) {
          subjectIds.push(ts.subject_id);
        }
        // Get class ID from the subject's class_id
        if (ts.subjects?.class_id) {
          classIds.add(ts.subjects.class_id);
        }
      });

      const finalClassIds = Array.from(classIds);

      console.log('Teacher subjects loaded:', {
        subjectIds,
        classIds: finalClassIds,
        teacherSubjects,
        teacher: teacher.name
      });

      const formData = {
        name: teacher.name,
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
    console.log('Save button clicked, form data:', form);

    if (!form.name.trim() || form.subjects.length === 0 || form.classes.length === 0) {
      Alert.alert('Error', 'Please fill all fields and select at least one subject and class.');
      return;
    }

    setSaving(true);
    
    try {
      if (modalMode === 'add') {
        // Create new teacher in Supabase
        const teacherData = {
          name: form.name.trim(),
          qualification: form.qualification,
          salary_amount: parseFloat(form.salary) || 0,
          salary_type: 'monthly', // Default value
        };
        
        const { data: newTeacher, error } = await supabase
          .from(TABLES.TEACHERS)
          .insert(teacherData)
          .select()
          .single();
          
        if (error) throw new Error('Failed to create teacher');
        
        // Handle subject and class assignments
        await handleSubjectClassAssignments(newTeacher.id);
        
        // Reload data to get updated list
        await loadData();
        
        Alert.alert('Success', 'Teacher added successfully.');
      } else if (modalMode === 'edit' && selectedTeacher) {
        // Update teacher in Supabase
        const teacherData = {
          name: form.name.trim(),
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
        
        // Reload data to get updated list
        await loadData();
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
      console.log('Form data:', { subjects: form.subjects, classes: form.classes });

      // First, get all existing assignments for this teacher
      const { data: existingAssignments, error: fetchError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select('*')
        .eq('teacher_id', teacherId);
      if (fetchError) {
        console.error('Failed to fetch existing assignments:', fetchError);
        throw new Error('Failed to fetch existing assignments');
      }

      console.log('Existing assignments:', existingAssignments);

      // Delete existing assignments
      if (existingAssignments.length > 0) {
        const { error: deleteError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .delete()
          .eq('teacher_id', teacherId);
        if (deleteError) {
          console.error('Failed to delete assignments:', deleteError);
          throw new Error('Failed to update assignments');
        }
        console.log('Deleted existing assignments');
      }

      // Create new assignments for selected subjects
      const assignments = form.subjects.map(subjectId => ({
        teacher_id: teacherId,
        subject_id: subjectId,
      }));

      console.log('New assignments to insert:', assignments);

      // Insert new assignments if there are any
      if (assignments.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .insert(assignments)
          .select();
        if (insertError) {
          console.error('Failed to create assignments:', insertError);
          throw new Error('Failed to create assignments');
        }
        console.log('Successfully inserted assignments:', insertedData);
      } else {
        console.log('No subjects selected, no assignments to insert');
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
              console.log(`Starting deletion process for teacher: ${teacher.name} (ID: ${teacher.id})`);
              
              // Delete all related data in the correct order (from most dependent to least)
              
              // 1. Delete teacher-subject assignments
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

  // Enhanced filtering and sorting
  const filteredTeachers = teachers
    .filter(teacher => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const name = teacher.name?.toLowerCase() || '';
      const qualification = teacher.qualification?.toLowerCase() || '';

      // Get subject names for this teacher
      const teacherSubjectNames = subjects
        .filter(subject => teacher.subjects?.includes(subject.id))
        .map(subject => subject.name?.toLowerCase() || '')
        .join(' ');

      // Get class names for this teacher
      const teacherClassNames = classes
        .filter(cls => teacher.classes?.includes(cls.id))
        .map(cls => cls.class_name?.toLowerCase() || '')
        .join(' ');

      return name.includes(query) ||
             qualification.includes(query) ||
             teacherSubjectNames.includes(query) ||
             teacherClassNames.includes(query);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderTeacherItem = ({ item }) => {
    // Remove duplicate subject IDs before rendering
    const uniqueSubjectIds = [...new Set(item.subjects)];
    return (
      <TouchableOpacity 
        style={styles.teacherCard} 
        onPress={() => navigation.navigate('TeacherDetails', { teacher: item })}
        activeOpacity={0.7}
      >
        <View style={styles.teacherInfo}>
          <View style={styles.teacherAvatar}>
            <Ionicons name="person" size={24} color="#4CAF50" />
          </View>
          <View style={styles.teacherDetails}>
            <Text style={styles.teacherName}>{item.name}</Text>
            <Text style={styles.teacherSubject}>
              {item.subjects.map(s => subjects.find(sub => sub.id === s)?.name || '').join(', ')}
            </Text>
            <Text style={styles.teacherClass}>{item.classes.map(c => classes.find(cls => cls.id === c)?.class_name || '').join(', ')}</Text>
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
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
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
          <Text style={styles.headerTitle}>Total Teachers: {filteredTeachers.length}</Text>
          <Text style={styles.headerSubtitle}>Active Teachers</Text>
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
              placeholder="Search by name, qualification, or subject..."
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
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
                  {classes.map(cls => (
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
                        <Text style={[
                          styles.checkboxCardText,
                          form.classes.includes(cls.id) && styles.checkboxCardTextSelected
                        ]}>
                          {cls.class_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
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

                {form.classes.map(classId => {
                  const selectedClass = classes.find(c => c.id === classId);
                  const classSubjects = subjects.filter(subject => subject.class_id === classId);

                  if (classSubjects.length === 0) return null;

                  return (
                    <View key={classId} style={styles.classSubjectsGroup}>
                      <Text style={styles.classSubjectsTitle}>
                        📚 {selectedClass?.class_name} - Subjects
                      </Text>
                      <View style={styles.checkboxGrid}>
                        {classSubjects.map(subject => (
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
                        ))}
                      </View>
                    </View>
                  );
                })}

                {form.classes.length === 0 && (
                  <View style={styles.noSelectionContainer}>
                    <Text style={styles.noSelectionText}>
                      Please select classes first to see available subjects
                    </Text>
                  </View>
                )}
              </View>

              {/* Section Assignment (if classes selected) */}
              {form.classes.length > 0 && (
                <View style={styles.formSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="layers-outline" size={20} color="#9C27B0" />
                    <Text style={styles.sectionTitle}>Section Assignment</Text>
                  </View>

                  <Text style={styles.sectionDescription}>
                    Assign sections for each selected class
                  </Text>

                  {form.classes.map(classId => {
                    const selectedClass = classes.find(c => c.id === classId);
                    return (
                      <View key={classId} style={styles.sectionAssignmentItem}>
                        <Text style={styles.sectionAssignmentLabel}>{selectedClass?.class_name}</Text>
                        <View style={styles.pickerContainer}>
                          <Picker
                            selectedValue={form.sections[classId]}
                            onValueChange={(itemValue) => setForm({ ...form, sections: { ...form.sections, [classId]: itemValue } })}
                            style={styles.picker}
                          >
                            <Picker.Item label="Select Section" value="" />
                            {sections.map(section => (
                              <Picker.Item key={section.id} label={section.section_name} value={section.id} />
                            ))}
                          </Picker>
                        </View>
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
});

export default ManageTeachers;
