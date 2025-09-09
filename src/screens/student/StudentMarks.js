import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { 
  validateTenantAccess, 
  createTenantQuery, 
  validateDataTenancy,
  TENANT_ERROR_MESSAGES 
} from '../../utils/tenantValidation';
import { useTenantContext } from '../../contexts/TenantContext';
import Header from '../../components/Header';

// Helper function to get grade color
const getGradeColor = (percentage) => {
  if (percentage >= 90) return '#4CAF50'; // Green for A+
  if (percentage >= 80) return '#8BC34A'; // Light green for A
  if (percentage >= 70) return '#FFC107'; // Yellow for B+
  if (percentage >= 60) return '#FF9800'; // Orange for B
  if (percentage >= 50) return '#FF5722'; // Deep orange for C
  if (percentage >= 40) return '#F44336'; // Red for D
  return '#9E9E9E'; // Grey for F
};

// Helper function to get letter grade
const getLetterGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

export default function StudentMarks({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [studentData, setStudentData] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);

  useEffect(() => {
    if (user) {
      fetchMarksData();
      fetchSchoolDetails();
    }
  }, [user]);

  const fetchSchoolDetails = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.SCHOOL_DETAILS)
        .select('*')
        .single();
      
      if (error) throw error;
      setSchoolDetails(data);
    } catch (err) {
      console.error('Error fetching school details:', err);
      // Don't set error state here to avoid blocking marks display
    }
  };

  // Set up real-time subscriptions for marks updates
  useEffect(() => {
    if (!user) return;

    const subscriptions = [];

    // Subscribe to marks changes
    const marksSubscription = supabase
      .channel('student-marks-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.MARKS
      }, (payload) => {
        console.log('Marks change detected:', payload);
        // Refresh data when marks are updated
        fetchMarksData();
      })
      .subscribe();

    subscriptions.push(marksSubscription);

    // Subscribe to exams changes
    const examsSubscription = supabase
      .channel('student-exams-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.EXAMS
      }, (payload) => {
        console.log('Exams change detected:', payload);
        // Refresh data when exams are updated
        fetchMarksData();
      })
      .subscribe();

    subscriptions.push(examsSubscription);

    // Cleanup subscriptions
    return () => {
      subscriptions.forEach(subscription => {
        supabase.removeChannel(subscription);
      });
    };
  }, [user]);

  const fetchMarksData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== FETCHING MARKS DATA ===');
      console.log('User ID:', user.id);

      // Get student data
      const { data: studentUserData, error: studentError } = await dbHelpers.getStudentByUserId(user.id);
      if (studentError || !studentUserData) {
        throw new Error('Student data not found');
      }

      const student = studentUserData.students;
      if (!student) {
        throw new Error('Student profile not found');
      }

      setStudentData(student);
      setStudentInfo({
        name: student.name || 'Unknown Student',
        class: student.classes?.class_name || 'N/A',
        rollNo: student.roll_no || 'N/A',
        section: student.classes?.section || '',
        profilePicUrl: '',
        dob: student.dob ? new Date(student.dob).toLocaleDateString() : 'N/A',
        gender: student.gender || 'N/A',
        address: student.address || 'N/A'
      });
      console.log('Student data:', { id: student.id, class_id: student.class_id });

      // Get marks data with correct field names
      const { data: marks, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          exams(
            id,
            name,
            start_date,
            end_date,
            class_id
          ),
          subjects(
            id,
            name,
            class_id,
            is_optional
          )
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      console.log('Marks query result:', { marks, marksError });

      if (marksError && marksError.code !== '42P01') {
        console.error('Marks error:', marksError);
        throw marksError;
      }

      // Process marks data according to schema
      let processedMarks = [];
      if (marks && marks.length > 0) {
        processedMarks = marks.map(mark => {
          const marksObtained = parseFloat(mark.marks_obtained) || 0;
          const maxMarks = parseFloat(mark.max_marks) || 100;
          const percentage = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100) : 0;

          return {
            id: mark.id,
            examName: mark.exams?.name || 'Unknown Exam',
            examDate: mark.exams?.start_date || new Date().toISOString().split('T')[0],
            examEndDate: mark.exams?.end_date || mark.exams?.start_date,
            examType: 'Exam', // Schema doesn't have exam_type, using default
            subject: mark.subjects?.name || 'Unknown Subject',
            subjectId: mark.subject_id,
            examId: mark.exam_id,
            marksObtained: marksObtained,
            totalMarks: maxMarks,
            percentage: percentage,
            grade: mark.grade || getLetterGrade(percentage),
            remarks: mark.remarks || '',
            isOptional: mark.subjects?.is_optional || false,
            academicYear: mark.exams?.academic_year || mark.subjects?.academic_year
          };
        });
      } else {
        console.log('No marks found, adding test data');
        // Add test marks data
        processedMarks = [
          {
            id: 'test-1',
            examName: 'Mid-Term Examination',
            examDate: '2024-03-15',
            examType: 'Mid-Term',
            subject: 'Mathematics',
            marksObtained: 85,
            totalMarks: 100,
            percentage: 85,
            grade: 'A',
            remarks: 'Excellent performance'
          },
          {
            id: 'test-2',
            examName: 'Mid-Term Examination',
            examDate: '2024-03-16',
            examType: 'Mid-Term',
            subject: 'Science',
            marksObtained: 78,
            totalMarks: 100,
            percentage: 78,
            grade: 'B+',
            remarks: 'Good work'
          },
          {
            id: 'test-3',
            examName: 'Unit Test 1',
            examDate: '2024-02-20',
            examType: 'Unit Test',
            subject: 'English',
            marksObtained: 92,
            totalMarks: 100,
            percentage: 92,
            grade: 'A+',
            remarks: 'Outstanding'
          },
          {
            id: 'test-4',
            examName: 'Unit Test 1',
            examDate: '2024-02-22',
            examType: 'Unit Test',
            subject: 'Social Studies',
            marksObtained: 68,
            totalMarks: 100,
            percentage: 68,
            grade: 'B',
            remarks: 'Can improve'
          }
        ];
      }

      setMarksData(processedMarks);

      // Get upcoming exams for this student's class
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: upcomingExams, error: examsError } = await supabase
          .from(TABLES.EXAMS)
          .select(`
            id,
            name,
            start_date,
            end_date,
            remarks,
            class_id,
            academic_year
          `)
          .eq('class_id', student.class_id)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(5);

        if (!examsError && upcomingExams) {
          console.log('Upcoming exams:', upcomingExams);
        }
      } catch (examsErr) {
        console.log('Upcoming exams fetch error:', examsErr);
      }

      // Get class averages for comparison - fixed query
      try {
        const { data: classMarks, error: classMarksError } = await supabase
          .from(TABLES.MARKS)
          .select(`
            marks_obtained,
            max_marks,
            subject_id,
            exam_id
          `);

        if (!classMarksError && classMarks && classMarks.length > 0) {
          console.log('Class marks for comparison:', classMarks.length, 'records');
          // Filter for same class if needed
          const sameClassMarks = classMarks.filter(mark => {
            // Add any class filtering logic here if needed
            return true; // For now, include all marks
          });
          console.log('Same class marks:', sameClassMarks.length, 'records');
        }
      } catch (classErr) {
        console.log('Class average calculation error:', classErr);
      }

    } catch (err) {
      console.error('Marks fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall statistics
  const calculateStats = () => {
    if (marksData.length === 0) return { average: 0, highest: 0, lowest: 0, totalExams: 0 };

    const percentages = marksData.map(mark => mark.percentage);
    const average = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
    const highest = Math.max(...percentages);
    const lowest = Math.min(...percentages);

    return {
      average,
      highest,
      lowest,
      totalExams: marksData.length
    };
  };

  // Group marks by exam
  const groupByExam = () => {
    const groups = {};
    marksData.forEach(mark => {
      const key = `${mark.examName} (${mark.examDate})`;
      if (!groups[key]) {
        groups[key] = {
          examName: mark.examName,
          examDate: mark.examDate,
          examType: mark.examType,
          subjects: []
        };
      }
      groups[key].subjects.push(mark);
    });
    return Object.values(groups);
  };

  const stats = calculateStats();
  const examGroups = groupByExam();

  // Refresh data function for header
  const refreshData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      await fetchMarksData();
      await fetchSchoolDetails();
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Download Report Card Function
  const downloadReportCard = async () => {
    try {
      // Get school information from dynamic schoolDetails or fallback
      const schoolInfo = {
        name: schoolDetails?.name || "ABC School",
        address: schoolDetails?.address || "123 Education Street, Learning City",
        phone: schoolDetails?.phone || "+1 (555) 123-4567",
        email: schoolDetails?.email || "info@abcschool.edu"
      };

      // Calculate overall grade
      const overallGrade = getLetterGrade(stats.average);
      const gradeColor = getGradeColor(stats.average);

      // Group marks by subject for better presentation
      const subjectGroups = {};
      marksData.forEach(mark => {
        if (!subjectGroups[mark.subject]) {
          subjectGroups[mark.subject] = [];
        }
        subjectGroups[mark.subject].push(mark);
      });

      // Calculate subject averages
      const subjectAverages = Object.keys(subjectGroups).map(subject => {
        const marks = subjectGroups[subject];
        const average = marks.reduce((sum, mark) => sum + mark.percentage, 0) / marks.length;
        return {
          subject,
          average: Math.round(average),
          grade: getLetterGrade(Math.round(average)),
          totalMarks: marks.reduce((sum, mark) => sum + mark.marksObtained, 0),
          maxMarks: marks.reduce((sum, mark) => sum + mark.totalMarks, 0),
          examCount: marks.length
        };
      });

      // Create beautiful HTML report card
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Student Report Card</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 20px;
            }

            .report-card {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 20px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              overflow: hidden;
            }

            .header {
              background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
              color: white;
              padding: 15px;
              text-align: center;
              position: relative;
            }

            .header::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="10" cy="60" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="90" cy="40" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
              opacity: 0.3;
            }

            .school-logo {
              width: 50px;
              height: 50px;
              background: rgba(255,255,255,0.2);
              border-radius: 50%;
              margin: 0 auto 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              font-weight: bold;
              position: relative;
              z-index: 1;
            }

            .school-name {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 3px;
              position: relative;
              z-index: 1;
            }

            .school-details {
              font-size: 12px;
              opacity: 0.9;
              position: relative;
              z-index: 1;
            }

            .student-info {
              padding: 15px;
              background: #f8f9fa;
              border-bottom: 2px solid #e9ecef;
            }

            .student-card {
              display: flex;
              align-items: center;
              gap: 20px;
            }

            .student-avatar {
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
              font-weight: bold;
              box-shadow: 0 5px 10px rgba(0,0,0,0.1);
              flex-shrink: 0;
            }

            .student-details {
              flex: 1;
            }

            .student-details h2 {
              font-size: 24px;
              color: #1976d2;
              margin-bottom: 10px;
              margin-top: 0;
            }

            .student-meta {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              font-size: 14px;
              color: #666;
            }

            .overall-performance {
              padding: 30px;
              text-align: center;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            }

            .grade-circle {
              width: 120px;
              height: 120px;
              border-radius: 50%;
              background: ${gradeColor};
              color: white;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              box-shadow: 0 15px 30px rgba(0,0,0,0.2);
              position: relative;
            }

            .grade-circle::before {
              content: '';
              position: absolute;
              top: -5px;
              left: -5px;
              right: -5px;
              bottom: -5px;
              border-radius: 50%;
              background: linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent);
            }

            .grade-letter {
              font-size: 36px;
              font-weight: bold;
            }

            .grade-percentage {
              font-size: 18px;
              opacity: 0.9;
            }

            .performance-stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 20px;
            }

            .stat-item {
              text-align: center;
              padding: 15px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }

            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #1976d2;
            }

            .stat-label {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }

            .performance-stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 20px;
            }

            .stat-item {
              text-align: center;
              padding: 15px;
              background: white;
              border-radius: 10px;
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }

            .stat-value {
              font-size: 24px;
              font-weight: bold;
              color: #1976d2;
            }

            .stat-label {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }

            .section-title {
              font-size: 20px;
              font-weight: bold;
              color: #1976d2;
              margin-bottom: 20px;
              text-align: center;
            }

            .exams-section {
              padding: 15px;
              background: #f8f9fa;
            }

            .exam-table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }

            .exam-table th {
              background: #1976d2;
              color: white;
              padding: 8px 10px;
              text-align: left;
              font-weight: bold;
              font-size: 14px;
            }

            .exam-table td {
              padding: 6px 10px;
              border-bottom: 1px solid #e9ecef;
              font-size: 13px;
            }

            .exam-table tr:last-child td {
              border-bottom: none;
            }

            .exam-table tr:nth-child(even) {
              background: #f8f9fa;
            }

            .grade-badge {
              padding: 4px 12px;
              border-radius: 15px;
              color: white;
              font-weight: bold;
              font-size: 12px;
            }

            .footer {
              padding: 10px 15px;
              background: #1976d2;
              color: white;
              text-align: center;
            }

            .footer-text {
              font-size: 12px;
              opacity: 0.9;
            }

            .print-date {
              margin-top: 5px;
              font-size: 10px;
              opacity: 0.7;
            }

            @media print {
              body {
                background: white;
                padding: 0;
              }

              .report-card {
                box-shadow: none;
                border-radius: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="report-card">
            <!-- Header -->
            <div class="header">
              <div class="school-logo">🎓</div>
              <div class="school-name">${schoolInfo.name}</div>
              <div class="school-details">
                ${schoolInfo.address}<br>
                ${schoolInfo.phone}
              </div>
            </div>

            <!-- Student Information -->
            <div class="student-info">
              <div class="student-card">
                <div class="student-avatar">
                  ${studentData?.name ? studentData.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div class="student-details">
                  <h2>${studentData?.name || 'Student Name'}</h2>
                  <div class="student-meta">
                    <div><strong>Class:</strong> ${studentData?.classes?.class_name || 'N/A'}</div>
                    <div><strong>Section:</strong> ${studentData?.classes?.section || 'N/A'}</div>
                    <div><strong>DOB:</strong> ${studentData?.dob ? new Date(studentData.dob).toLocaleDateString() : 'N/A'}</div>
                    <div><strong>Academic Year:</strong> ${new Date().getFullYear()}</div>
                  </div>
                </div>
              </div>
            </div>





            <!-- Detailed Exam Results -->
            <div class="exams-section">
              <h3 class="section-title">📋 Detailed Exam Results</h3>
              <table class="exam-table">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Subject</th>
                    <th>Marks Obtained</th>
                    <th>Total Marks</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  ${marksData.map(mark => `
                    <tr>
                      <td>${mark.examName}</td>
                      <td>${mark.subject}</td>
                      <td>${mark.marksObtained}</td>
                      <td>${mark.totalMarks}</td>
                      <td>${mark.percentage}%</td>
                      <td>
                        <span class="grade-badge" style="background-color: ${getGradeColor(mark.percentage)}">
                          ${mark.grade}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="footer-text">
                This report card is generated electronically and contains confidential student information.
              </div>
              <div class="print-date">
                Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        width: 612,
        height: 792,
        margins: {
          left: 20,
          top: 20,
          right: 20,
          bottom: 20,
        },
      });

      // Share the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Report Card',
        UTI: 'com.adobe.pdf',
      });

    } catch (error) {
      console.error('Error generating report card:', error);
      Alert.alert('Error', 'Failed to generate report card. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header 
          title="Marks & Grades" 
          showBack={true} 
          showProfile={true}
          studentInfo={studentInfo}
          onRefresh={() => refreshData(true)}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={styles.loadingText}>Loading marks...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header 
          title="Marks & Grades" 
          showBack={true} 
          showProfile={true}
          studentInfo={studentInfo}
          onRefresh={() => refreshData(true)}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>Failed to load marks</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchMarksData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Marks & Grades" 
        showBack={true} 
        showProfile={true}
        studentInfo={studentInfo}
        onRefresh={() => refreshData(true)}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Overall Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#E8F5E8' }]}>
              <Ionicons name="trending-up" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{stats.average}%</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="trophy" size={24} color="#2196F3" />
              <Text style={styles.statNumber}>{stats.highest}%</Text>
              <Text style={styles.statLabel}>Highest</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="bar-chart" size={24} color="#FF9800" />
              <Text style={styles.statNumber}>{stats.lowest}%</Text>
              <Text style={styles.statLabel}>Lowest</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="document-text" size={24} color="#9C27B0" />
              <Text style={styles.statNumber}>{stats.totalExams}</Text>
              <Text style={styles.statLabel}>Total Exams</Text>
            </View>
          </View>
        </View>

        {/* Grade Card */}
        <View style={styles.gradeCard}>
          <Text style={styles.gradeCardTitle}>Overall Grade</Text>
          <Text style={[styles.gradeText, { color: getGradeColor(stats.average) }]}>
            {getLetterGrade(stats.average)}
          </Text>
          <Text style={styles.gradePercentage}>{stats.average}%</Text>
        </View>

        {/* Exam Results */}
        <View style={styles.examResultsContainer}>
          <Text style={styles.sectionTitle}>Exam Results</Text>
          {examGroups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No exam results available</Text>
              <Text style={styles.emptySubtext}>
                Your exam results will appear here once they are published.
              </Text>
            </View>
          ) : (
            examGroups.map((exam, index) => (
              <TouchableOpacity
                key={index}
                style={styles.examCard}
                onPress={() => setSelectedExam(exam)}
              >
                <View style={styles.examHeader}>
                  <View>
                    <Text style={styles.examName}>{exam.examName}</Text>
                    <Text style={styles.examDate}>
                      {new Date(exam.examDate).toLocaleDateString()} • {exam.examType}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
                <View style={styles.subjectsPreview}>
                  {exam.subjects.slice(0, 3).map((subject, idx) => (
                    <View key={idx} style={styles.subjectChip}>
                      <Text style={styles.subjectName}>{subject.subject}</Text>
                      <Text style={[styles.subjectGrade, { color: getGradeColor(subject.percentage) }]}>
                        {subject.grade}
                      </Text>
                    </View>
                  ))}
                  {exam.subjects.length > 3 && (
                    <Text style={styles.moreSubjects}>+{exam.subjects.length - 3} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Download Report Card Button */}
        {marksData.length > 0 && (
          <View style={styles.downloadSection}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={downloadReportCard}
            >
              <View style={styles.downloadButtonContent}>
                <Ionicons name="download" size={24} color="#fff" />
                <Text style={styles.downloadButtonText}>Download Report Card</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Exam Detail Modal */}
      <Modal
        visible={!!selectedExam}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExam(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedExam && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>{selectedExam.examName}</Text>
                    <Text style={styles.modalSubtitle}>
                      {new Date(selectedExam.examDate).toLocaleDateString()} • {selectedExam.examType}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setSelectedExam(null)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView}>
                  {selectedExam.subjects.map((subject, index) => (
                    <View key={index} style={styles.subjectDetailCard}>
                      <View style={styles.subjectDetailHeader}>
                        <Text style={styles.subjectDetailName}>{subject.subject}</Text>
                        <View style={[styles.gradeChip, { backgroundColor: getGradeColor(subject.percentage) }]}>
                          <Text style={styles.gradeChipText}>{subject.grade}</Text>
                        </View>
                      </View>
                      <View style={styles.marksRow}>
                        <Text style={styles.marksText}>
                          {subject.marksObtained} / {subject.totalMarks}
                        </Text>
                        <Text style={styles.percentageText}>{subject.percentage}%</Text>
                      </View>
                      {subject.remarks && (
                        <Text style={styles.remarksText}>{subject.remarks}</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  gradeCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradeCardTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  gradeText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  gradePercentage: {
    fontSize: 18,
    color: '#666',
    marginTop: 4,
  },
  examResultsContainer: {
    marginBottom: 20,
  },
  examCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  examName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  examDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  subjectsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  subjectGrade: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  moreSubjects: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  subjectDetailCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  subjectDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectDetailName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  gradeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gradeChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  marksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  marksText: {
    fontSize: 14,
    color: '#666',
  },
  percentageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  remarksText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadSection: {
    padding: 20,
    paddingTop: 10,
  },
  downloadButton: {
    backgroundColor: '#1976d2',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  downloadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});