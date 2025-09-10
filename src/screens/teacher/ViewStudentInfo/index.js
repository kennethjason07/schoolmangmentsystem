import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  RefreshControl, 
  Platform, 
  Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../../components/Header';
import { useAuth } from '../../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../../utils/supabase';
import StudentListHeader from './components/StudentListHeader';
import StudentList from './components/StudentList';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = width >= 768;

const ViewStudentInfo = () => {
  // State management
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState('All');
  const [classes, setClasses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  // Teacher statistics state
  const [teacherStats, setTeacherStats] = useState({
    classTeacherCount: 0,
    subjectTeacherCount: 0,
    totalStudents: 0
  });

  // Responsive settings - conditional settings for web version
  const scrollingSettings = {
    web: {
      showsVerticalScrollIndicator: true,
      showsHorizontalScrollIndicator: false,
      nestedScrollEnabled: true,
      bounces: false,
      bouncesZoom: false,
      scrollEventThrottle: 16,
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'on-drag',
      decelerationRate: 'fast',
      alwaysBounceVertical: false,
      overScrollMode: 'never',
      automaticallyAdjustKeyboardInsets: false,
      contentInsetAdjustmentBehavior: 'automatic'
    },
    mobile: {
      showsVerticalScrollIndicator: false,
      showsHorizontalScrollIndicator: false,
      nestedScrollEnabled: true,
      bounces: true,
      bouncesZoom: false,
      scrollEventThrottle: 16,
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'on-drag',
      decelerationRate: 'normal',
      alwaysBounceVertical: true,
      overScrollMode: 'auto',
      automaticallyAdjustKeyboardInsets: true,
      contentInsetAdjustmentBehavior: 'automatic'
    }
  };

  // Get current scrolling settings based on platform
  const currentScrollSettings = isWeb ? scrollingSettings.web : scrollingSettings.mobile;

  // Fetch teacher's students
  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('ViewStudentInfo: Starting fetch with user ID:', user?.id);

      if (!user?.id) {
        throw new Error('User not logged in');
      }

      // Get teacher info using the helper function
      console.log('ViewStudentInfo: Fetching teacher data...');
      const { data: teacherData, error: teacherError } = await dbHelpers.getTeacherByUserId(user.id);

      console.log('ViewStudentInfo: Teacher query result:', { teacherData, teacherError });

      if (teacherError || !teacherData) {
        console.error('ViewStudentInfo: Teacher not found:', teacherError);
        // Check if this user has a teacher account at all
        const { data: userData, error: userError } = await supabase
          .from(TABLES.USERS)
          .select('id, email, linked_teacher_id, role_id')
          .eq('id', user.id)
          .single();
        
        console.log('ViewStudentInfo: User data check:', { userData, userError });
        
        if (!userData?.linked_teacher_id) {
          throw new Error('This user account is not linked to a teacher profile. Please contact an administrator.');
        }
        
        throw new Error(teacherError?.message || 'Teacher data could not be retrieved');
      }

      console.log('ViewStudentInfo: Teacher data:', teacherData);

      // Get classes where teacher teaches subjects
      const { data: assignedData, error: assignedError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('teacher_id', teacherData.id);

      if (assignedError) throw assignedError;

      console.log('ViewStudentInfo: Subject assignments:', assignedData);

      // Get classes where teacher is the class teacher
      const { data: classTeacherData, error: classTeacherError } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          id,
          class_name,
          section,
          academic_year
        `)
        .eq('class_teacher_id', teacherData.id);

      if (classTeacherError) throw classTeacherError;

      console.log('ViewStudentInfo: Class teacher data:', classTeacherData);

      // Calculate teacher statistics
      const classTeacherCount = classTeacherData?.length || 0;
      
      // Count unique subjects the teacher teaches
      const uniqueSubjects = new Set();
      assignedData.forEach(assignment => {
        if (assignment.subjects?.name) {
          uniqueSubjects.add(assignment.subjects.name);
        }
      });
      const subjectTeacherCount = uniqueSubjects.size;

      // Combine all unique classes
      const subjectClasses = assignedData
        .filter(a => a.subjects?.classes)
        .map(a => ({
          id: a.subjects.classes.id,
          class_name: a.subjects.classes.class_name,
          section: a.subjects.classes.section,
          type: 'subject'
        }));

      const classTeacherClasses = classTeacherData.map(c => ({
        id: c.id,
        class_name: c.class_name,
        section: c.section,
        type: 'class_teacher'
      }));

      // Remove duplicates by class id
      const allClasses = [...subjectClasses, ...classTeacherClasses];
      const uniqueClassesMap = new Map();
      allClasses.forEach(cls => {
        if (!uniqueClassesMap.has(cls.id)) {
          uniqueClassesMap.set(cls.id, cls);
        }
      });

      const uniqueClassesArray = Array.from(uniqueClassesMap.values());
      const uniqueClassNames = uniqueClassesArray.map(c => `${c.class_name} - ${c.section}`);
      setClasses(['All', ...uniqueClassNames]);

      console.log('ViewStudentInfo: All unique classes:', uniqueClassesArray);

      // Optimized single query to get students with their parent information
      const studentPromises = uniqueClassesArray.map(classInfo => {
        console.log('ViewStudentInfo: Fetching students with parents for class:', classInfo.id, `(${classInfo.type})`);
        return supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no,
            address,
            dob,
            gender,
            admission_no,
            academic_year,
            classes(class_name, section),
            parents!parents_student_id_fkey(
              id,
              name,
              phone,
              email,
              relation
            )
          `)
          .eq('class_id', classInfo.id)
          .order('roll_no')
          .then(result => ({ ...result, classInfo }));
      });

      const studentResults = await Promise.all(studentPromises);
      console.log('ViewStudentInfo: Student results with parents:', studentResults);

      // Process all students and their parent information
      const allStudents = [];
      
      studentResults.forEach((result) => {
        if (result.data && result.classInfo) {
          result.data.forEach(student => {
            allStudents.push({ 
              ...student, 
              classInfo: result.classInfo,
              parentInfo: student.parents, // Direct parent info from the join
              classSection: `${student.classes?.class_name || 'Unknown'} - ${student.classes?.section || 'Unknown'}`
            });
            
            // Log parent information for debugging
            if (student.parents) {
              console.log(`✅ Student ${student.name} -> Parent: ${student.parents.name} (${student.parents.relation || 'Unknown relation'})`);
              console.log(`   📞 Phone: ${student.parents.phone || 'N/A'}, 📧 Email: ${student.parents.email || 'N/A'}`);
            } else {
              console.log(`❌ Student ${student.name} -> No parent information found (parent_id: ${student.parent_id || 'null'})`);
            }
          });
        }
      });

      console.log('ViewStudentInfo: Final processed students:', allStudents.length);
      
      // Update teacher statistics
      setTeacherStats({
        classTeacherCount,
        subjectTeacherCount,
        totalStudents: allStudents.length
      });

      setStudents(allStudents);
      setFilteredStudents(allStudents);

    } catch (error) {
      console.error('ViewStudentInfo: Error fetching students:', error);
      setError(error.message);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter students based on search query and selected class
  const filterStudents = useCallback(() => {
    let filtered = students;
    
    // Filter by class
    if (selectedClass !== 'All') {
      filtered = filtered.filter(student => student.classSection === selectedClass);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(query) ||
        student.roll_no?.toString().includes(query) ||
        student.admission_no?.toLowerCase().includes(query) ||
        student.classSection.toLowerCase().includes(query) ||
        student.parents?.name?.toLowerCase().includes(query)
      );
    }
    
    setFilteredStudents(filtered);
  }, [students, searchQuery, selectedClass]);

  // Modal handlers
  const openModal = (student) => {
    setSelectedStudent(student);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedStudent(null);
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
  };

  // Export PDF handler (placeholder)
  const handleExportPDF = async () => {
    Alert.alert('Export PDF', 'PDF export functionality will be implemented here');
  };

  // Effects
  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [filterStudents]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Header title="View Student Info" showBack={true} />
        
        <StudentListHeader
          teacherStats={teacherStats}
          students={students}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedClass={selectedClass}
          setSelectedClass={setSelectedClass}
          classes={classes}
          filteredStudents={filteredStudents}
          handleExportPDF={handleExportPDF}
          scrollSettings={currentScrollSettings}
        />
        
        <StudentList
          filteredStudents={filteredStudents}
          openModal={openModal}
          selectedStudent={selectedStudent}
          modalVisible={modalVisible}
          closeModal={closeModal}
          refreshing={refreshing}
          onRefresh={onRefresh}
          searchQuery={searchQuery}
          scrollSettings={currentScrollSettings}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  }
});

export default ViewStudentInfo;
