import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Modal, ScrollView, Button, Platform, Animated, Easing, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import Header from '../../components/Header';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import DropDownPicker from 'react-native-dropdown-picker';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const ViewStudentInfo = () => {
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
  const navigation = useNavigation();

  // State for teacher statistics
  const [teacherStats, setTeacherStats] = useState({
    classTeacherCount: 0,
    subjectTeacherCount: 0,
    totalStudents: 0
  });

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
              parentInfo: student.parents // Direct parent info from the join
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

      console.log('ViewStudentInfo: Found students:', allStudents.length);
      console.log('ViewStudentInfo: Students with parent info:', allStudents.filter(s => s.parentInfo).length);
      
      // Process all students and add properly formatted parent information
      const finalStudents = [];
      allStudents.forEach(student => {
        const classInfo = student.classInfo;
        const classSection = `${classInfo.class_name} - ${classInfo.section}`;
        
        // Process multiple parents for each student (father, mother, guardian)
        let parentInfo = null;
        let fatherInfo = null;
        let motherInfo = null;
        let guardianInfo = null;
        
        if (student.parents) {
          // Check if parents is an array (multiple parents) or single object
          const parentsArray = Array.isArray(student.parents) ? student.parents : [student.parents];
          
          // Organize parents by relation and clean up invalid data
          parentsArray.forEach(parent => {
            // Skip invalid or placeholder parent names
            const isValidParentName = parent.name && 
              parent.name.trim() !== '' && 
              parent.name.toLowerCase() !== 'n/a' &&
              !parent.name.toLowerCase().includes('placeholder');
            
            if (isValidParentName) {
              const parentData = {
                name: parent.name,
                phone: parent.phone,
                email: parent.email,
                relation: parent.relation
              };
              
              if (parent.relation === 'Father') {
                fatherInfo = parentData;
              } else if (parent.relation === 'Mother') {
                motherInfo = parentData;
              } else if (parent.relation === 'Guardian') {
                guardianInfo = parentData;
              }
            } else {
              // Log invalid parent data for debugging
              console.log(`⚠️ Skipping invalid parent name for student ${student.name}: "${parent.name}"`);
            }
          });
          
          // Create combined parent info with separate father/mother details
          parentInfo = {
            father: fatherInfo,
            mother: motherInfo,
            guardian: guardianInfo,
            // For backward compatibility, use first available parent
            name: fatherInfo?.name || motherInfo?.name || guardianInfo?.name || 'N/A',
            phone: fatherInfo?.phone || motherInfo?.phone || guardianInfo?.phone || 'N/A',
            email: fatherInfo?.email || motherInfo?.email || guardianInfo?.email || 'N/A',
            relation: fatherInfo?.relation || motherInfo?.relation || guardianInfo?.relation || 'N/A'
          };
        }
        
        finalStudents.push({
          ...student,
          classSection,
          className: classInfo.class_name,
          sectionName: classInfo.section,
          teacherRole: classInfo.type, // 'subject' or 'class_teacher'
          parents: parentInfo // Use the processed parent info
        });
        
        // Log for debugging
        if (parentInfo) {
          const parentDetails = [];
          if (fatherInfo) parentDetails.push(`Father: ${fatherInfo.name}`);
          if (motherInfo) parentDetails.push(`Mother: ${motherInfo.name}`);
          if (guardianInfo) parentDetails.push(`Guardian: ${guardianInfo.name}`);
          
          console.log(`🔗 Student ${student.name} -> ${parentDetails.join(', ') || 'No specific relation'}`);
        } else {
          console.log(`⚠️ Student ${student.name} has no parent information`);
        }
      });

      // Remove duplicates by student ID
      const uniqueStudents = finalStudents.filter((student, index, self) =>
        index === self.findIndex(s => s.id === student.id)
      );

      console.log('ViewStudentInfo: Final unique students:', uniqueStudents.length);
      console.log('ViewStudentInfo: Students with parent info:', uniqueStudents.filter(s => s.parents).length);
      setStudents(uniqueStudents);
      setFilteredStudents(uniqueStudents);

      // Update teacher statistics
      setTeacherStats({
        classTeacherCount,
        subjectTeacherCount,
        totalStudents: uniqueStudents.length
      });

      console.log('ViewStudentInfo: Teacher Stats - Class Teacher:', classTeacherCount, 'Subject Teacher:', subjectTeacherCount, 'Total Students:', uniqueStudents.length);

    } catch (err) {
      setError(err.message);
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch student statistics
  const fetchStudentStats = async (studentId) => {
    try {
      // Get attendance statistics
      const { data: attendanceData, error: attendanceError } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', studentId);

      if (attendanceError) throw attendanceError;

      const totalDays = attendanceData.length;
      const presentDays = attendanceData.filter(a => a.status === 'Present').length;
      const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Get marks statistics
      const { data: marksData, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select('*')
        .eq('student_id', studentId);

      if (marksError) throw marksError;

      const totalMarks = marksData.length;
      const averageMarks = totalMarks > 0 
        ? Math.round(marksData.reduce((sum, m) => sum + (m.marks_obtained || 0), 0) / totalMarks)
        : 0;

      return {
        attendance: attendancePercentage,
        marks: averageMarks,
        attendanceHistory: attendanceData.slice(-4).map(a => a.status === 'Present' ? 100 : 0),
        marksHistory: marksData.slice(-4).map(m => m.marks_obtained || 0)
      };

    } catch (err) {
      console.error('Error fetching student stats:', err);
      return {
        attendance: 0,
        marks: 0,
        attendanceHistory: [0, 0, 0, 0],
        marksHistory: [0, 0, 0, 0]
      };
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchStudents();
    } catch (error) {
      console.error('Error refreshing students:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter students based on search and class
  useEffect(() => {
    let filtered = students;

    console.log('ViewStudentInfo: Filtering - selectedClass:', selectedClass);
    console.log('ViewStudentInfo: Total students before filter:', students.length);

    // Filter by class
    if (selectedClass !== 'All') {
      filtered = filtered.filter(student => {
        const match = student.classSection === selectedClass;
        if (!match) {
          console.log('ViewStudentInfo: Student class mismatch:', student.classSection, 'vs', selectedClass);
        }
        return match;
      });
      console.log('ViewStudentInfo: Students after class filter:', filtered.length);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const beforeSearchFilter = filtered.length;
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.roll_no ?? '').toString().includes(searchQuery) ||
        student.admission_no?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log('ViewStudentInfo: Students after search filter:', filtered.length, 'from', beforeSearchFilter);
    }

    console.log('ViewStudentInfo: Final filtered students:', filtered.length);
    setFilteredStudents(filtered);
  }, [students, searchQuery, selectedClass]);

  const openModal = async (student) => {
    setSelectedStudent(student);
    setModalVisible(true);
    
    // Fetch student statistics
    const stats = await fetchStudentStats(student.id);
    setSelectedStudent({ ...student, ...stats });
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedStudent(null);
  };



  const handleExportPDF = async () => {
    try {
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Students Report</title>
            <style>
              body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
                line-height: 1.4;
              }
              .header {
                text-align: center;
                margin-bottom: 40px;
                border-bottom: 3px solid #1976d2;
                padding-bottom: 20px;
              }
              .header h1 {
                color: #1976d2;
                margin: 0 0 10px 0;
                font-size: 28px;
              }
              .header p {
                margin: 5px 0;
                color: #666;
                font-size: 14px;
              }
              .summary {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
              }
              .summary h3 {
                margin: 0 0 10px 0;
                color: #1976d2;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 12px;
              }
              th {
                background-color: #1976d2;
                color: white;
                padding: 12px 8px;
                text-align: left;
                font-weight: bold;
              }
              td {
                border: 1px solid #ddd;
                padding: 10px 8px;
                vertical-align: top;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              tr:hover {
                background-color: #f0f8ff;
              }
              .student-name {
                font-weight: bold;
                color: #1976d2;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #ddd;
                padding-top: 20px;
              }
              @media print {
                body { margin: 0; }
                .header { page-break-after: avoid; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Student Information Report</h1>
              <p>Generated on: ${currentDate}</p>
              <p>Teacher: ${user?.email || 'N/A'}</p>
            </div>

            <div class="summary">
              <h3>Report Summary</h3>
              <p>Total Students: <strong>${filteredStudents.length}</strong></p>
              <p>Classes: <strong>${[...new Set(filteredStudents.map(s => s.classSection))].join(', ')}</strong></p>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Admission No</th>
                  <th>Class</th>
                  <th>Gender</th>
                  <th>DOB</th>
                  <th>Parent Name</th>
                  <th>Parent Contact</th>
                </tr>
              </thead>
              <tbody>
                ${filteredStudents.map(student => `
                  <tr>
                    <td class="student-name">${student.name || 'N/A'}</td>
                    <td>${student.roll_no || 'N/A'}</td>
                    <td>${student.admission_no || 'N/A'}</td>
                    <td>${student.classSection || 'N/A'}</td>
                    <td>${student.gender || 'N/A'}</td>
                    <td>${student.dob || 'N/A'}</td>
                    <td>${student.parents?.name || 'N/A'}</td>
                    <td>${student.parents?.phone || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              <p>This report was generated automatically by the School Management System</p>
              <p>© ${new Date().getFullYear()} School Management System</p>
            </div>
          </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `Students_Report_${timestamp}_${time}.pdf`;

      // For Android and iOS, use different storage approaches
      if (Platform.OS === 'android') {
        // Android: Save to Downloads folder or use SAF
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            // User selected a directory, save there
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              fileName,
              'application/pdf'
            );
            
            const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            await FileSystem.writeAsStringAsync(fileUri, fileContent, { encoding: FileSystem.EncodingType.Base64 });
            
            Alert.alert(
              'Download Successful! 📁',
              `PDF saved to your selected folder:\n\n📄 ${fileName}\n👥 ${filteredStudents.length} students exported\n\n✅ You can find it in your chosen directory.`,
              [{ text: 'Great!', style: 'default' }]
            );
            return;
          }
        } catch (error) {
          console.log('SAF failed, trying alternative:', error);
        }
        
        // Fallback: Save to app directory and share
        const documentDirectory = FileSystem.documentDirectory;
        const newPath = `${documentDirectory}${fileName}`;
        await FileSystem.moveAsync({ from: uri, to: newPath });
        
        // Immediately trigger sharing to let user save wherever they want
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save Students Report',
            UTI: 'com.adobe.pdf'
          });
          
          Alert.alert(
            'Export Complete! 📱',
            `PDF generated successfully:\n\n📄 ${fileName}\n👥 ${filteredStudents.length} students exported\n\n💾 Use the share dialog to save to your preferred location (Downloads, Drive, etc.).`,
            [{ text: 'Done', style: 'default' }]
          );
        }
      } else {
        // iOS: Use the share sheet for direct saving
        const documentDirectory = FileSystem.documentDirectory;
        const newPath = `${documentDirectory}${fileName}`;
        await FileSystem.moveAsync({ from: uri, to: newPath });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save Students Report',
            UTI: 'com.adobe.pdf'
          });
          
          Alert.alert(
            'Export Complete! 📱',
            `PDF generated successfully:\n\n📄 ${fileName}\n👥 ${filteredStudents.length} students exported\n\n💾 Use the share options to save to Files, iCloud, or other locations.`,
            [{ text: 'Done', style: 'default' }]
          );
        } else {
          // Fallback if sharing is not available
          Alert.alert(
            'Export Complete! 📁',
            `PDF saved to app storage:\n\n📄 ${fileName}\n👥 ${filteredStudents.length} students exported\n\n📍 Location: App Documents`,
            [{ text: 'OK', style: 'default' }]
          );
        }
      }

    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert(
        'Export Failed ❌',
        'Unable to save PDF report. Please check storage permissions and try again.',
        [{ text: 'Try Again', style: 'default' }]
      );
    }
  };

  const renderStudent = ({ item }) => (
    <TouchableOpacity
      style={styles.studentCard}
      onPress={() => openModal(item)}
    >
      <View style={styles.studentHeader}>
        <View style={styles.studentInfo}>
          <View style={styles.studentNameRow}>
            <Text style={styles.studentName}>{item.name}</Text>
          </View>
          <Text style={styles.studentDetails}>
            Roll: {item.roll_no} | {item.classSection}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      
      <View style={styles.studentStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Admission No</Text>
          <Text style={styles.statValue}>{item.admission_no || 'N/A'}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Parent</Text>
          <Text style={styles.statValue}>{item.parents?.name || 'N/A'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="View Student Info" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="View Student Info" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStudents}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="View Student Info" showBack={true} />
      
      <View style={styles.content}>
        {/* Teacher Role Summary */}
        {students.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Your Students</Text>
            <View style={styles.summaryCards}>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons name="school" size={20} color="#fff" />
                </View>
                <Text style={styles.summaryNumber}>
                  {teacherStats.classTeacherCount}
                </Text>
                <Text style={styles.summaryLabel}>Class Teacher</Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: '#2196F3' }]}>
                  <Ionicons name="book" size={20} color="#fff" />
                </View>
                <Text style={styles.summaryNumber}>
                  {teacherStats.subjectTeacherCount}
                </Text>
                <Text style={styles.summaryLabel}>Subject Teacher</Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: '#FF9800' }]}>
                  <Ionicons name="people" size={20} color="#fff" />
                </View>
                <Text style={styles.summaryNumber}>{teacherStats.totalStudents}</Text>
                <Text style={styles.summaryLabel}>Total Students</Text>
              </View>
            </View>
          </View>
        )}

        {/* Search and Filter */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Class:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {classes.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[
                    styles.filterButton,
                    selectedClass === cls && styles.selectedFilterButton
                  ]}
                  onPress={() => setSelectedClass(cls)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedClass === cls && styles.selectedFilterButtonText
                  ]}>
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Export Section */}
        {filteredStudents.length > 0 && (
          <View style={styles.exportSection}>
            <TouchableOpacity
              style={styles.modernExportButton}
              onPress={handleExportPDF}
              activeOpacity={0.8}
            >
              <View style={styles.exportIconContainer}>
                <Ionicons name="document-text" size={24} color="#fff" />
              </View>
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportTitle}>Export PDF Report</Text>
                <Text style={styles.exportSubtitle}>
                  Download {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} data
                </Text>
              </View>
              <View style={styles.exportArrowContainer}>
                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Students List */}
        {filteredStudents.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.noDataText}>No students found</Text>
            <Text style={styles.noDataSubtext}>
              {searchQuery ? 'Try adjusting your search' : 'No students assigned to your classes'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredStudents}
            renderItem={renderStudent}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#1976d2"
                {...(Platform.OS === 'android' && { colors: ['#1976d2'] })}
              />
            }
          />
        )}
      </View>

      {/* Student Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Student Details</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#1976d2" />
              </TouchableOpacity>
            </View>
            
            {selectedStudent && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Personal Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Roll No:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.roll_no}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Class:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.classSection}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Admission No:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.admission_no || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date of Birth:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.dob || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Gender:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.gender || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Parent Information</Text>
                  
                  {/* Father Information */}
                  {selectedStudent.parents?.father && selectedStudent.parents.father.name ? (
                    <View style={styles.parentSubSection}>
                      <Text style={styles.parentRelationTitle}>👨 Father</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Name:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.father.name}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Phone:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.father.phone || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Email:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.father.email || 'N/A'}</Text>
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Mother Information */}
                  {selectedStudent.parents?.mother ? (
                    <View style={styles.parentSubSection}>
                      <Text style={styles.parentRelationTitle}>👩 Mother</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Name:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.mother.name}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Phone:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.mother.phone || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Email:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.mother.email || 'N/A'}</Text>
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Guardian Information */}
                  {selectedStudent.parents?.guardian ? (
                    <View style={styles.parentSubSection}>
                      <Text style={styles.parentRelationTitle}>🤝 Guardian</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Name:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.guardian.name}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Phone:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.guardian.phone || 'N/A'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Email:</Text>
                        <Text style={styles.detailValue}>{selectedStudent.parents.guardian.email || 'N/A'}</Text>
                      </View>
                    </View>
                  ) : null}
                  
                  {/* Show message if no parents found */}
                  {!selectedStudent.parents?.father && !selectedStudent.parents?.mother && !selectedStudent.parents?.guardian ? (
                    <View style={styles.noParentInfo}>
                      <Text style={styles.noParentText}>No parent information available</Text>
                    </View>
                  ) : null}
                  
                  {/* Student Address */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Student Address:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.address || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Academic Performance</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Attendance:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.attendance || 0}%</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Average Marks:</Text>
                    <Text style={styles.detailValue}>{selectedStudent.marks || 0}%</Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      closeModal();
                      navigation.navigate('StudentMarksScreen', { student: selectedStudent });
                    }}
                  >
                    <Ionicons name="book" size={20} color="#1976d2" />
                    <Text style={styles.actionButtonText}>View Marks</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      closeModal();
                      navigation.navigate('StudentAttendanceScreen', { student: selectedStudent });
                    }}
                  >
                    <Ionicons name="calendar" size={20} color="#1976d2" />
                    <Text style={styles.actionButtonText}>View Attendance</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
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
  content: {
    flex: 1,
    padding: 16,
  },
  summarySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCard: {
    alignItems: 'center',
    flex: 1,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  searchSection: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 12,
  },
  filterButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    elevation: 1,
  },
  selectedFilterButton: {
    backgroundColor: '#1976d2',
  },
  filterButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  selectedFilterButtonText: {
    color: '#fff',
  },
  exportSection: {
    marginBottom: 16,
  },
  modernExportButton: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundColor: '#667eea',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginHorizontal: 4,
  },
  exportIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  exportTextContainer: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  exportSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  exportArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  classTeacherBadge: {
    backgroundColor: '#4CAF50',
  },
  subjectTeacherBadge: {
    backgroundColor: '#2196F3',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  studentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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
    width: '90%',
    maxHeight: '80%',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 30,
    paddingBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: '#1976d2',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    fontWeight: 'bold',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  parentSubSection: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  parentRelationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
    textAlign: 'left',
  },
  noParentInfo: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  noParentText: {
    color: '#f57c00',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default ViewStudentInfo; 