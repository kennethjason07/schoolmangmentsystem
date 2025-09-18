import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Animated
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import Header from '../../components/Header';
import { dbHelpers, supabase, TABLES } from '../../utils/supabase';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');

const TeacherDetails = ({ route, navigation }) => {
  const { teacher } = route.params;
  const [teacherData, setTeacherData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classTeacherOf, setClassTeacherOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form, setForm] = useState({ 
    name: '', 
    subjects: [], 
    classes: [], 
    salary: '', 
    qualification: '', 
    sections: {} 
  });
  const [allSubjects, setAllSubjects] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState([]);
  const [classSubjectMap, setClassSubjectMap] = useState(new Map());
  const [refreshing, setRefreshing] = useState(false);
  
  // Enhanced scroll functionality
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentRefreshColor, setCurrentRefreshColor] = useState(0);
  const scrollViewRef = useRef(null);
  const scrollTopOpacity = useRef(new Animated.Value(0)).current;
  const scrollTopScale = useRef(new Animated.Value(0.8)).current;
  
  // Constants for scroll behavior
  const isWeb = Platform.OS === 'web';
  const SCROLL_THRESHOLD = isWeb ? 80 : 120;
  const SCROLL_THROTTLE = isWeb ? 32 : 16;
  const refreshColors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];

  const loadFormData = async () => {
    try {
      const { data: classesData } = await dbHelpers.getClasses();
      const { data: subjectsData } = await supabase
        .from(TABLES.SUBJECTS)
        .select('*');
      
      setAllClasses(classesData || []);
      setAllSubjects(subjectsData || []);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const toggleSelect = (arr, value) => arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const handleSubjectClassAssignments = async (teacherId) => {
    try {
      // Delete existing assignments
      await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .delete()
        .eq('teacher_id', teacherId);

      // Create new assignments
      const assignments = [];
      form.subjects.forEach(subjectId => {
        const subject = allSubjects.find(s => s.id === subjectId);
        if (subject && form.classes.includes(subject.class_id)) {
          assignments.push({
            teacher_id: teacherId,
            subject_id: subjectId,
            class_id: subject.class_id
          });
        }
      });

      if (assignments.length > 0) {
        await supabase
          .from(TABLES.TEACHER_SUBJECTS)
          .insert(assignments);
      }
    } catch (error) {
      console.error('Error handling assignments:', error);
      throw error;
    }
  };

  const openEditModal = async () => {
    await loadFormData();
    
    try {
      const { data: teacherSubjects } = await dbHelpers.getTeacherSubjects(teacher.id);
      
      const subjectIds = [];
      const classIds = new Set();
      
      teacherSubjects?.forEach(ts => {
        if (ts.subject_id) subjectIds.push(ts.subject_id);
        if (ts.subjects?.class_id) classIds.add(ts.subjects.class_id);
      });

      setForm({
        name: teacherData?.name || '',
        subjects: subjectIds,
        classes: Array.from(classIds),
        salary: teacherData?.salary_amount ? String(teacherData.salary_amount) : '',
        qualification: teacherData?.qualification || '',
        sections: {},
      });
      
      setIsEditModalVisible(true);
    } catch (error) {
      console.error('Error loading teacher data:', error);
      Alert.alert('Error', 'Failed to load teacher data');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter teacher name');
      return;
    }

    setSaving(true);
    try {
      // Update teacher basic info
      const { error } = await supabase
        .from(TABLES.TEACHERS)
        .update({
          name: form.name.trim(),
          qualification: form.qualification,
          salary_amount: parseFloat(form.salary) || 0,
        })
        .eq('id', teacher.id);
        
      if (error) throw error;
      
      // Handle subject assignments (copy logic from ManageTeachers)
      await handleSubjectClassAssignments(teacher.id);
      
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Teacher updated successfully');
      
      // Refresh the screen data
      navigation.replace('TeacherDetails', { teacher: { ...teacher, name: form.name } });
    } catch (error) {
      console.error('Error updating teacher:', error);
      Alert.alert('Error', 'Failed to update teacher');
    } finally {
      setSaving(false);
    }
  };

  const loadSections = async (classId) => {
    const { data, error } = await dbHelpers.getSectionsByClass(classId);
    if (error) {
      return;
    }
    setSections(data);
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Cycle through refresh colors for better UX
      setCurrentRefreshColor((prev) => (prev + 1) % refreshColors.length);
      await fetchTeacherDetails();
    } finally {
      setRefreshing(false);
    }
  };

  // Enhanced scroll event handler
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY > SCROLL_THRESHOLD;
    
    if (shouldShow !== showScrollTop) {
      setShowScrollTop(shouldShow);
      animateScrollTopButton(shouldShow);
    }
  };

  // Animate scroll-to-top button
  const animateScrollTopButton = (show) => {
    Animated.parallel([
      Animated.timing(scrollTopOpacity, {
        toValue: show ? 1 : 0,
        duration: 300,
        useNativeDriver: !isWeb, // Native driver not supported on web for opacity
      }),
      Animated.spring(scrollTopScale, {
        toValue: show ? 1 : 0.8,
        tension: 100,
        friction: 8,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  };

  // Scroll to top function
  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: 0,
        animated: !isWeb // Use CSS smooth scroll on web
      });
    }
  };

  // Quick navigation function
  const scrollToSection = (yPosition) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: yPosition,
        animated: !isWeb
      });
    }
  };

  const fetchTeacherDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch teacher details (get all, then filter by id)
      const { data: teachers, error: teacherError } = await dbHelpers.getTeachers();
      if (teacherError) throw teacherError;
      const t = teachers.find(t => t.id === teacher.id);
      setTeacherData(t);
      // Fetch teacher subjects/classes
      const { data: teacherSubjects, error: tsError } = await dbHelpers.getTeacherSubjects(teacher.id);
      
      if (tsError) {
        console.error('Error fetching teacher subjects:', tsError);
        throw tsError;
      }

      // Fetch class teacher info
      const { data: classTeacherData, error: ctError } = await dbHelpers.read('classes', { class_teacher_id: teacher.id });
      if (ctError) throw ctError;
      if (classTeacherData && classTeacherData.length > 0) {
        setClassTeacherOf(classTeacherData[0]);
      }

      // Process teacher assignments to group subjects by class
      const classSubjectMap = new Map(); // Map of className -> [subjects]
      const uniqueSubjects = new Set();
      const uniqueClasses = new Set();
      
      if (teacherSubjects && teacherSubjects.length > 0) {
        teacherSubjects.forEach((ts) => {
          // Get subject name from the subjects relation
          if (ts.subjects?.name && ts.subjects?.classes?.class_name) {
            const subjectName = ts.subjects.name;
            const fullClassName = `${ts.subjects.classes.class_name}${ts.subjects.classes.section ? ' ' + ts.subjects.classes.section : ''}`;
            
            // Add to unique sets
            uniqueSubjects.add(subjectName);
            uniqueClasses.add(fullClassName);
            
            // Group subjects by class
            if (!classSubjectMap.has(fullClassName)) {
              classSubjectMap.set(fullClassName, []);
            }
            classSubjectMap.get(fullClassName).push(subjectName);
          }
        });
      }

      const subjectsArray = Array.from(uniqueSubjects);
      const classesArray = Array.from(uniqueClasses);
      
      // Store the class-subject mapping for use in the UI
      setClassSubjectMap(classSubjectMap);
      
      setSubjects(subjectsArray);
      setClasses(classesArray);
    } catch (err) {
      setError('Failed to load teacher details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherDetails();
  }, [teacher.id]);

  useEffect(() => {
    // When selected classes change, filter out subjects that are no longer valid
    const validSubjects = form.subjects.filter(subjectId => {
      const subject = allSubjects.find(s => s.id === subjectId);
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

  }, [form.classes, allSubjects]);

  // Quick Navigation Component
  const QuickNavigation = () => {
    const navigationItems = [
      { label: 'Profile', icon: 'person', position: 0 },
      { label: 'Personal', icon: 'information-circle', position: 400 },
      { label: 'Class Teacher', icon: 'school', position: 600 },
      { label: 'Assignments', icon: 'library', position: 800 },
    ];

    return (
      <View style={styles.quickNavContainer}>
        <Text style={styles.quickNavTitle}>Quick Navigation</Text>
        <View style={styles.quickNavButtons}>
          {navigationItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickNavButton}
              onPress={() => scrollToSection(item.position)}
              accessibilityLabel={`Navigate to ${item.label} section`}
              accessibilityHint={`Scrolls to the ${item.label.toLowerCase()} section of the teacher details`}
            >
              <Ionicons name={item.icon} size={20} color="#2196F3" />
              <Text style={styles.quickNavButtonText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Details" showBack={true} />
        <PaperActivityIndicator animating={true} size="large" color="#2196F3" style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (error || !teacherData) {
    return (
      <View style={styles.container}>
        <Header title="Teacher Details" showBack={true} />
        <Text style={{ color: 'red', margin: 24 }}>{error || 'No data found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Teacher Profile" showBack={true} />
      
      <View style={styles.scrollableContainer}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent} 
          onScroll={handleScroll}
          scrollEventThrottle={SCROLL_THROTTLE}
          showsVerticalScrollIndicator={!isWeb}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[refreshColors[currentRefreshColor]]}
              tintColor={refreshColors[currentRefreshColor]}
              title="Pull to refresh teacher details"
              titleColor="#666"
            />
          }
        >
        {/* Quick Navigation */}
        <QuickNavigation />
        {/* Profile Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={48} color="#fff" />
            </View>
            <View style={styles.onlineIndicator} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.teacherName}>{teacherData?.name || 'N/A'}</Text>
            <Text style={styles.teacherRole}>
              {classTeacherOf ? `Class Teacher - ${classTeacherOf.class_name}` : 'Subject Teacher'}
            </Text>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="class" size={20} color="#2196F3" />
                <Text style={styles.statNumber}>{classes.length}</Text>
                <Text style={styles.statLabel}>Classes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialIcons name="book" size={20} color="#4CAF50" />
                <Text style={styles.statNumber}>{subjects.length}</Text>
                <Text style={styles.statLabel}>Subjects</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.currencyIcon}>{"\u20B9"}</Text>
                <Text style={[styles.statNumber, styles.salaryText]} numberOfLines={1} adjustsFontSizeToFit={true}>
                  {teacherData?.salary_amount ? parseFloat(teacherData.salary_amount).toFixed(2) : '0.00'}
                </Text>
                <Text style={styles.statLabel}>Salary</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Information Cards */}
        <View style={styles.cardsContainer}>
          {/* Personal Information Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person_outline" size={24} color="#2196F3" />
              <Text style={styles.cardTitle}>Personal Information</Text>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{teacherData?.name || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Qualification</Text>
                  <Text style={styles.infoValue}>{teacherData?.qualification || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Salary</Text>
                  <Text style={styles.infoValue}>
                    {teacherData?.salary_amount ? `\u20B9${parseFloat(teacherData.salary_amount).toFixed(2)}` : '\u20B90.00'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Class Teacher Information */}
          {classTeacherOf && (
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="school" size={24} color="#4CAF50" />
                <Text style={styles.cardTitle}>Class Teacher</Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.classTeacherBadge}>
                  <MaterialIcons name="star" size={20} color="#FFD700" />
                  <Text style={styles.classTeacherText}>{classTeacherOf.class_name}</Text>
                </View>
                <Text style={styles.classTeacherDescription}>
                  Responsible for overall class management and student welfare
                </Text>
              </View>
            </View>
          )}

          {/* Subject Assignments Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="assignment" size={24} color="#FF9800" />
              <Text style={styles.cardTitle}>Subject Assignments</Text>
            </View>

            <View style={styles.cardContent}>
              {subjects.length > 0 || classes.length > 0 ? (
                <View style={styles.assignmentsContainer}>
                  {/* Display subjects grouped by class if classes exist */}
                  {classes.length > 0 ? (
                    classes.map((cls, idx) => (
                      <View key={cls + idx} style={styles.assignmentItem}>
                        <View style={styles.assignmentHeader}>
                          <View style={styles.classChip}>
                            <MaterialIcons name="class" size={16} color="#2196F3" />
                            <Text style={styles.classChipText}>{cls}</Text>
                          </View>
                        </View>
                        <View style={styles.subjectsList}>
                          {(classSubjectMap.get(cls) || []).slice(0, 3).map((subject, subIdx) => (
                            <View key={`${subject}-${subIdx}`} style={styles.subjectChip}>
                              <MaterialIcons name="book" size={14} color="#4CAF50" />
                              <Text style={styles.subjectChipText}>{subject}</Text>
                            </View>
                          ))}
                          {(classSubjectMap.get(cls) || []).length > 3 && (
                            <Text style={styles.moreSubjectsText}>+{(classSubjectMap.get(cls) || []).length - 3} more</Text>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    /* Display subjects only if no classes */
                    <View style={styles.assignmentItem}>
                      <View style={styles.assignmentHeader}>
                        <View style={styles.classChip}>
                          <MaterialIcons name="book" size={16} color="#4CAF50" />
                          <Text style={styles.classChipText}>Assigned Subjects</Text>
                        </View>
                      </View>
                      <View style={styles.subjectsList}>
                        {subjects.slice(0, 6).map((subject, subIdx) => (
                          <View key={`${subject}-${subIdx}`} style={styles.subjectChip}>
                            <MaterialIcons name="book" size={14} color="#4CAF50" />
                            <Text style={styles.subjectChipText}>{subject}</Text>
                          </View>
                        ))}
                        {subjects.length > 6 && (
                          <Text style={styles.moreSubjectsText}>+{subjects.length - 6} more</Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <MaterialIcons name="assignment_late" size={48} color="#E0E0E0" />
                  <Text style={styles.emptyStateText}>No subject assignments</Text>
                  <Text style={styles.emptyStateSubtext}>This teacher has no assigned subjects yet</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AssignTaskToTeacher', { teacher: teacherData })}
          >
            <MaterialIcons name="assignment_add" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Assign Task</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={openEditModal}
          >
            <MaterialIcons name="edit" size={20} color="#2196F3" />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Edit Details</Text>
          </TouchableOpacity>
        </View>
        
        {/* Bottom spacing for better scroll experience */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      </View>

      {/* Floating Scroll-to-Top Button */}
      {showScrollTop && (
        <Animated.View
          style={[
            styles.scrollToTopButton,
            {
              opacity: scrollTopOpacity,
              transform: [{ scale: scrollTopScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.scrollToTopInner}
            onPress={scrollToTop}
            accessibilityLabel="Scroll to top"
            accessibilityHint="Scrolls the teacher details back to the top"
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Edit Modal - Exact copy from ManageTeachers.js */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons
                  name="create"
                  size={24}
                  color="#2196F3"
                  style={styles.modalIcon}
                />
                <Text style={styles.modalTitle}>Edit Teacher</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
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
                  <Text style={styles.inputLabel}>Qualification</Text>
                  <TextInput
                    placeholder="Enter qualification (e.g., B.Ed, M.A.)"
                    value={form.qualification}
                    onChangeText={text => setForm({ ...form, qualification: text })}
                    style={styles.textInput}
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monthly Salary *</Text>
                  <View style={styles.salaryInputContainer}>
                    <Text style={styles.currencySymbol}>{"\u20B9"}</Text>
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
                  {allClasses.map(cls => (
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
                  Select subjects for the assigned classes
                </Text>

                <View style={styles.checkboxGrid}>
                  {allSubjects
                    .filter(subject => form.classes.includes(subject.class_id))
                    .map(subject => (
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

                {form.classes.length > 0 && allSubjects.filter(s => form.classes.includes(s.class_id)).length === 0 && (
                  <Text style={styles.noSubjectsText}>
                    No subjects available for selected classes
                  </Text>
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
                    const selectedClass = allClasses.find(c => c.id === classId);
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
                onPress={() => setIsEditModalVisible(false)}
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
                    <Text style={styles.saveButtonText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="save"
                      size={20}
                      color="#fff"
                      style={styles.saveButtonIcon}
                    />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
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
  // Enhanced container with web optimizations
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      position: 'relative',
    }),
  },
  
  // Scrollable area with calculated height
  scrollableContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 60px)', // Account for header
      maxHeight: 'calc(100vh - 60px)',
      overflow: 'hidden',
    }),
  },
  
  // Enhanced ScrollView with web scroll properties
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
      maxHeight: '100%',
      overflowY: 'scroll',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollBehavior: 'smooth',
      scrollbarWidth: 'thin',
      scrollbarColor: '#2196F3 #f8f9fa',
    }),
  },
  
  // Content container properties
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra bottom padding for better UX
  },
  // Profile Header Card
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
    width: '100%',
  },
  teacherName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  teacherRole: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  salaryText: {
    textAlign: 'center',
    minWidth: 80,
    maxWidth: 120,
  },
  salaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  currencyIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
    marginRight: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  // Cards Container
  cardsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  cardContent: {
    padding: 20,
    paddingTop: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  // Class Teacher Badge
  classTeacherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  classTeacherText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginLeft: 8,
  },
  classTeacherDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Subject Assignments
  assignmentsContainer: {
    gap: 12,
  },
  assignmentItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  assignmentHeader: {
    marginBottom: 8,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  classChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginLeft: 6,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginLeft: 6,
  },
  subjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  moreSubjectsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2196F3',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#2196F3',
  },
  // Modal Styles - Exact copy from ManageTeachers.js
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '95%',
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  modalScrollView: {
    maxHeight: 500,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  salaryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    paddingLeft: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 8,
  },
  salaryInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    fontSize: 16,
    color: '#333',
  },
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
  noSubjectsText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    marginTop: 16,
  },
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
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonTextDisabled: {
    color: '#999',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Enhanced Scroll Features Styles
  
  // Quick Navigation Styles
  quickNavContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickNavTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickNavButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickNavButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickNavButtonText: {
    fontSize: 11,
    color: '#2196F3',
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Scroll-to-Top Button Styles
  scrollToTopButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  scrollToTopInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  
  // Bottom spacing for better scroll experience
  bottomSpacing: {
    height: 100,
    backgroundColor: 'transparent',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    maxHeight: 400,
  },
  inputGroup: {
    padding: 20,
    paddingBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 8,
  },
  checkboxItemSelected: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  checkboxText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  checkboxTextSelected: {
    color: '#2e7d32',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TeacherDetails;
