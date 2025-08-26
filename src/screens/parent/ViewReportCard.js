import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import usePullToRefresh from '../../hooks/usePullToRefresh';

const { width } = Dimensions.get('window');

const ViewReportCard = () => {
  const [student, setStudent] = useState(null);
  const [reportCards, setReportCards] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReportCard, setSelectedReportCard] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [marks, setMarks] = useState([]);
  const { user } = useAuth();

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchReportCardData();
  });

  const fetchReportCardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get parent's linked student
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no,
            class_id,
            academic_year,
            classes(id, class_name, section, academic_year)
          )
        `)
        .eq('id', user.id)
        .single();

      if (parentError || !parentUser?.linked_parent_of) {
        throw new Error('Student data not found');
      }

      const studentData = parentUser.students;
      setStudent(studentData);

      // Get all exams for the student's class and academic year
      const { data: examsData, error: examsError } = await supabase
        .from(TABLES.EXAMS)
        .select('id, name, class_id, academic_year, start_date, end_date, remarks, max_marks, created_at')
        .eq('class_id', studentData.class_id)
        .eq('academic_year', studentData.academic_year)
        .order('start_date', { ascending: false });

      if (examsError) throw examsError;
      setExams(examsData || []);

      // Get all subjects for the student's class
      const { data: subjectsData, error: subjectsError } = await supabase
        .from(TABLES.SUBJECTS)
        .select('*')
        .eq('class_id', studentData.class_id)
        .eq('academic_year', studentData.academic_year)
        .order('name');

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Get all marks for the student
      const { data: marksData, error: marksError } = await supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          exams(id, name, start_date, end_date, max_marks),
          subjects(id, name)
        `)
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (marksError) throw marksError;
      setMarks(marksData || []);

      // Process report cards by exam
      const reportCards = {};
      if (marksData) {
        marksData.forEach(mark => {
          const examId = mark.exam_id;
          if (!reportCards[examId]) {
            reportCards[examId] = {
              exam: mark.exams,
              subjects: [],
              totalMarks: 0,
              totalMaxMarks: 0,
              percentage: 0
            };
          }
          
          // Use exam's max_marks instead of marks table max_marks
          const examMaxMarks = mark.exams?.max_marks || 100;
          
          reportCards[examId].subjects.push({
            subject: mark.subjects,
            marks_obtained: mark.marks_obtained,
            max_marks: examMaxMarks, // Use exam's max_marks
            grade: mark.grade,
            remarks: mark.remarks
          });
          
          reportCards[examId].totalMarks += parseFloat(mark.marks_obtained || 0);
          reportCards[examId].totalMaxMarks += parseFloat(examMaxMarks);
        });
      }

      // Calculate percentages
      Object.keys(reportCards).forEach(examId => {
        const card = reportCards[examId];
        card.percentage = card.totalMaxMarks > 0 
          ? ((card.totalMarks / card.totalMaxMarks) * 100).toFixed(2)
          : 0;
      });

      setReportCards(reportCards);

    } catch (err) {
      console.error('Error fetching report card data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReportCardData();
    }
  }, [user]);

  const calculateGrade = (obtained, max) => {
    const percentage = (obtained / max) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'A-';
    if (percentage >= 60) return 'B+';
    if (percentage >= 50) return 'B';
    if (percentage >= 40) return 'B-';
    if (percentage >= 30) return 'C+';
    if (percentage >= 20) return 'C';
    return 'C-';
  };

  const calculateRank = async (studentId, examId, classId) => {
    try {
      // Get all students in the class
      const classStudents = await dbHelpers.getStudentsByClass(classId);
      
      // Get marks for all students in this exam
      const allMarks = [];
      for (const student of classStudents) {
        const studentMarks = await dbHelpers.read('marks', { 
          student_id: student.id, 
          exam_id: examId 
        });
        
        if (studentMarks && studentMarks.length > 0) {
          const totalMarks = studentMarks.reduce((sum, mark) => sum + mark.marks_obtained, 0);
          allMarks.push({ studentId: student.id, totalMarks });
        }
      }
      
      // Sort by total marks (descending)
      allMarks.sort((a, b) => b.totalMarks - a.totalMarks);
      
      // Find rank
      const rank = allMarks.findIndex(mark => mark.studentId === studentId) + 1;
      return rank || 1;
    } catch (error) {
      console.error('Error calculating rank:', error);
      return 1;
    }
  };

  const getClassTeacher = async (classId) => {
    try {
      const classData = await dbHelpers.read('classes', { id: classId });
      if (classData && classData.length > 0) {
        const teacher = await dbHelpers.read('teachers', { id: classData[0].teacher_id });
        if (teacher && teacher.length > 0) {
          return `${teacher[0].title || 'Mr.'} ${teacher[0].name}`;
        }
      }
      return 'Class Teacher';
    } catch (error) {
      console.error('Error getting class teacher:', error);
      return 'Class Teacher';
    }
  };

  const groupReportCardsByYear = () => {
    const grouped = {};
    Object.keys(reportCards).forEach(examId => {
      const reportCard = reportCards[examId];
      const year = reportCard.exam?.academic_year || student?.academic_year || '2024-25';
      
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push({ examId, ...reportCard });
    });
    return grouped;
  };

  const groupedReportCards = groupReportCardsByYear();
  const sortedYears = Object.keys(groupedReportCards).sort((a, b) => b.localeCompare(a));

  const handleReportCardPress = (reportCard) => {
    setSelectedReportCard(reportCard);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedReportCard(null);
  };

  const handleExportPDF = async () => {
    if (!selectedReportCard) return;

    try {
      // Generate HTML content for PDF
      const htmlContent = generatePDFHTML(selectedReportCard);

      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      // Create a proper filename
      const fileName = `ReportCard_${selectedReportCard.studentName}_${selectedReportCard.examName.replace(/\s+/g, '_')}.pdf`;

      if (Platform.OS === 'android') {
        try {
          // For Android, use StorageAccessFramework to save to Downloads
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            Alert.alert('Permission Required', 'Please grant storage permission to save the PDF file.');
            return;
          }

          // Create file in the selected directory
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf'
          );

          // Copy the PDF content to the destination
          const fileData = await FileSystem.readAsStringAsync(uri, { 
            encoding: FileSystem.EncodingType.Base64 
          });
          await FileSystem.writeAsStringAsync(destUri, fileData, { 
            encoding: FileSystem.EncodingType.Base64 
          });

          Alert.alert(
            'PDF Saved Successfully',
            `Report card has been saved to your device.\n\nFile: ${fileName}\nLocation: Selected folder`,
            [
              { 
                text: 'Share', 
                onPress: () => sharePDF(uri, fileName) 
              },
              { text: 'OK', style: 'default' }
            ]
          );
        } catch (error) {
          console.error('Android save error:', error);
          // Fallback to sharing
          Alert.alert(
            'Save Failed',
            'Could not save to Downloads folder. Opening share options instead.',
            [
              { 
                text: 'Share', 
                onPress: () => sharePDF(uri, fileName) 
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      } else {
        // For iOS, share directly
        await sharePDF(uri, fileName);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const sharePDF = async (uri, fileName) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Report Card',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share PDF. Please try again.');
    }
  };

  const generatePDFHTML = (reportCard) => {
    const getGradeColor = (grade) => {
      switch (grade) {
        case 'A+': return '#4CAF50';
        case 'A': return '#4CAF50';
        case 'A-': return '#8BC34A';
        case 'B+': return '#2196F3';
        case 'B': return '#2196F3';
        case 'B-': return '#03A9F4';
        case 'C+': return '#FF9800';
        case 'C': return '#FF9800';
        case 'C-': return '#FF5722';
        default: return '#F44336';
      }
    };

    const subjectsHTML = reportCard.subjects.map(subject => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${subject.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${subject.marksObtained}/${subject.maxMarks}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center; color: ${getGradeColor(subject.grade)}; font-weight: bold;">${subject.grade}</td>
      </tr>
    `).join('');

    const remarksHTML = reportCard.subjects.map(subject => `
      <div style="margin-bottom: 10px;">
        <strong>${subject.name}:</strong> ${subject.remarks}
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Report Card</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2196F3;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .school-name {
              font-size: 24px;
              font-weight: bold;
              color: #2196F3;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .student-info {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .marks-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .marks-table th {
              background-color: #2196F3;
              color: white;
              padding: 12px;
              text-align: center;
              font-weight: bold;
            }
            .marks-table td {
              padding: 8px;
              border-bottom: 1px solid #e0e0e0;
            }
            .summary-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-bottom: 20px;
            }
            .summary-item {
              flex: 1;
              min-width: 120px;
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
            }
            .summary-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 5px;
            }
            .summary-value {
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            .remarks-section {
              margin-bottom: 20px;
            }
            .remark-item {
              background-color: #f8f9fa;
              padding: 10px;
              border-radius: 5px;
              margin-bottom: 8px;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
            }
            .signature-item {
              text-align: center;
              flex: 1;
            }
            .signature-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 5px;
            }
            .signature-name {
              font-size: 14px;
              font-weight: bold;
              color: #333;
            }
            .grade-color {
              color: ${getGradeColor(reportCard.overallGrade)};
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
              .student-info { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">ABC School</div>
            <div class="report-title">Report Card</div>
          </div>

          <div class="student-info">
            <div class="info-row">
              <span><strong>Student Name:</strong> ${reportCard.studentName}</span>
              <span><strong>Class:</strong> ${reportCard.class}</span>
            </div>
            <div class="info-row">
              <span><strong>Roll Number:</strong> ${reportCard.rollNumber}</span>
              <span><strong>Academic Year:</strong> ${reportCard.academicYear}</span>
            </div>
            <div class="info-row">
              <span><strong>Exam:</strong> ${reportCard.examName}</span>
              <span><strong>Date:</strong> ${new Date(reportCard.examDate).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>

          <h3>Subject-wise Marks</h3>
          <table class="marks-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Marks</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${subjectsHTML}
            </tbody>
          </table>

          <h3>Performance Summary</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Total Marks</div>
              <div class="summary-value">${reportCard.totalMarks}/${reportCard.maxTotalMarks}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Average</div>
              <div class="summary-value">${reportCard.averagePercentage}%</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Overall Grade</div>
              <div class="summary-value grade-color">${reportCard.overallGrade}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Class Rank</div>
              <div class="summary-value">${reportCard.rank}</div>
            </div>
          </div>

          <div class="remarks-section">
            <h3>Subject-wise Remarks</h3>
            ${remarksHTML}
          </div>

          <div class="signatures">
            <div class="signature-item">
              <div class="signature-label">Class Teacher</div>
              <div class="signature-name">${reportCard.classTeacher}</div>
            </div>
            <div class="signature-item">
              <div class="signature-label">Principal</div>
              <div class="signature-name">${reportCard.principal}</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const getGradeColor = (grade) => {
    if (typeof grade === 'number') {
      if (grade >= 90) return '#4CAF50';
      if (grade >= 75) return '#FF9800';
      if (grade >= 60) return '#FFC107';
      return '#F44336';
    }
    
    switch (grade) {
      case 'A+': case 'A': return '#4CAF50';
      case 'B+': case 'B': return '#FF9800';
      case 'C+': case 'C': return '#FFC107';
      default: return '#F44336';
    }
  };

  const renderReportCard = ({ item: examId }) => {
    const reportCard = reportCards[examId];
    if (!reportCard) return null;

    return (
      <View style={styles.reportCard}>
        <View style={styles.examHeader}>
          <Text style={styles.examName}>{reportCard.exam?.name}</Text>
          <Text style={styles.examDate}>
            {new Date(reportCard.exam?.start_date).toLocaleDateString()} - {' '}
            {new Date(reportCard.exam?.end_date).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.subjectsHeader}>
          <Text style={styles.subjectHeaderText}>Subject</Text>
          <Text style={styles.subjectHeaderText}>Marks</Text>
          <Text style={styles.subjectHeaderText}>Total</Text>
          <Text style={styles.subjectHeaderText}>Grade</Text>
        </View>

        {reportCard.subjects.map((subjectMark, index) => (
          <View key={index} style={styles.subjectRow}>
            <Text style={styles.subjectName}>{subjectMark.subject?.name}</Text>
            <Text style={styles.subjectMarks}>
              {subjectMark.marks_obtained}
            </Text>
            <Text style={styles.subjectTotal}>
              {subjectMark.max_marks}
            </Text>
            <Text style={[styles.subjectGrade, { color: getGradeColor(subjectMark.grade) }]}>
              {subjectMark.grade || 'N/A'}
            </Text>
          </View>
        ))}

        <View style={styles.summarySection}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Marks</Text>
            <Text style={styles.summaryValue}>
              {reportCard.totalMarks}/{reportCard.totalMaxMarks}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Percentage</Text>
            <Text style={[styles.summaryValue, { color: getGradeColor(reportCard.percentage) }]}>
              {reportCard.percentage}%
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderYearSection = ({ item: year }) => (
    <View style={styles.yearSection}>
      <Text style={styles.yearTitle}>{year}</Text>
      <FlatList
        data={groupedReportCards[year]}
        renderItem={({ item }) => renderReportCard({ item: item.examId })}
        keyExtractor={(item) => item.examId}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    </View>
  );

  const handleExportAllPDF = async () => {
    try {
      const htmlContent = generateAllReportCardsPDF();
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = `AllReportCards_${student?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permissions.granted) {
            Alert.alert('Permission Required', 'Please grant storage permission to save the PDF file.');
            return;
          }

          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf'
          );

          const fileData = await FileSystem.readAsStringAsync(uri, { 
            encoding: FileSystem.EncodingType.Base64 
          });
          await FileSystem.writeAsStringAsync(destUri, fileData, { 
            encoding: FileSystem.EncodingType.Base64 
          });

          Alert.alert('PDF Saved Successfully', `All report cards saved as ${fileName}`);
        } catch (error) {
          console.error('Android save error:', error);
          await sharePDF(uri, fileName);
        }
      } else {
        await sharePDF(uri, fileName);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const handleExportCurrentPDF = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const currentYearKey = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      const currentYearReports = groupedReportCards[currentYearKey] || [];
      
      if (currentYearReports.length === 0) {
        Alert.alert('No Data', 'No report cards found for current academic year.');
        return;
      }

      const htmlContent = generateYearReportCardsPDF(currentYearReports, currentYearKey);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = `ReportCards_${student?.name?.replace(/\s+/g, '_')}_${currentYearKey}.pdf`;
      await sharePDF(uri, fileName);
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const generateAllReportCardsPDF = () => {
    const allReportsHtml = Object.keys(reportCards).map(examId => {
      const reportCard = reportCards[examId];
      return generateSingleReportHTML(reportCard);
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Complete Report Card</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .school-name { 
              font-size: 24px; 
              font-weight: bold; 
              color: #2196F3; 
              margin-bottom: 10px;
            }
            .student-info { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 8px; 
              margin-bottom: 20px;
              display: inline-block;
              width: 100%;
            }
            .report-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: center; 
            }
            th { 
              background: #1976d2; 
              color: white; 
            }
            .subject-cell {
              text-align: left;
              padding-left: 15px;
            }
            .exam-title {
              color: #1976d2;
              font-size: 18px;
              font-weight: bold;
              margin: 20px 0 10px 0;
            }
            .total-row {
              background: #f8f9fa;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">ABC School</div>
            <h1>Complete Report Card</h1>
            <div class="student-info">
              <strong>Student:</strong> ${student?.name} | 
              <strong>Class:</strong> ${student?.classes?.class_name} ${student?.classes?.section} | 
              <strong>Admission No:</strong> ${student?.admission_no}
            </div>
          </div>
          ${allReportsHtml}
        </body>
      </html>
    `;
  };

  const generateYearReportCardsPDF = (yearReports, year) => {
    const reportsHtml = yearReports.map(report => 
      generateSingleReportHTML(reportCards[report.examId])
    ).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Report Cards - ${year}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px; 
            }
            .school-name { 
              font-size: 24px; 
              font-weight: bold; 
              color: #2196F3; 
              margin-bottom: 10px;
            }
            .student-info { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 8px; 
              margin-bottom: 20px;
              display: inline-block;
              width: 100%;
            }
            .report-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 15px 0; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: center; 
            }
            th { 
              background: #1976d2; 
              color: white; 
            }
            .subject-cell {
              text-align: left;
              padding-left: 15px;
            }
            .exam-title {
              color: #1976d2;
              font-size: 18px;
              font-weight: bold;
              margin: 20px 0 10px 0;
            }
            .total-row {
              background: #f8f9fa;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">ABC School</div>
            <h1>Report Cards - Academic Year ${year}</h1>
            <div class="student-info">
              <strong>Student:</strong> ${student?.name} | 
              <strong>Class:</strong> ${student?.classes?.class_name} ${student?.classes?.section} | 
              <strong>Admission No:</strong> ${student?.admission_no}
            </div>
          </div>
          ${reportsHtml}
        </body>
      </html>
    `;
  };

  const generateSingleReportHTML = (reportCard) => {
    if (!reportCard) return '';
    
    return `
      <div class="report-section">
        <h3 class="exam-title">${reportCard.exam?.name}</h3>
        <p><strong>Date:</strong> ${new Date(reportCard.exam?.start_date).toLocaleDateString()} - ${new Date(reportCard.exam?.end_date).toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Marks Obtained</th>
              <th>Max Marks</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${reportCard.subjects?.map(subject => `
              <tr>
                <td class="subject-cell">${subject.subject?.name}</td>
                <td>${subject.marks_obtained}</td>
                <td>${subject.max_marks}</td>
                <td style="color: ${getGradeColor(subject.grade)}">${subject.grade}</td>
              </tr>
            `).join('') || ''}
            <tr class="total-row">
              <td class="subject-cell"><strong>Total</strong></td>
              <td><strong>${reportCard.totalMarks}</strong></td>
              <td><strong>${reportCard.totalMaxMarks}</strong></td>
              <td><strong>${reportCard.percentage}%</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

  const handlePreviewAllPDF = () => {
    const htmlContent = generateAllReportCardsPDF();
    setPreviewContent(htmlContent);
    setPreviewType('all');
    setShowPreviewModal(true);
  };

  const handleConfirmExport = async () => {
    setShowPreviewModal(false);
    await handleExportAllPDF();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Report Card" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading report cards...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Report Card" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchReportCardData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const reportCardKeys = Object.keys(reportCards);

  return (
    <View style={styles.container}>
      <Header title="Report Card" showBack={true} />
      
      {student && (
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentDetails}>
            Class: {student.classes?.class_name} {student.classes?.section} | 
            Admission No: {student.admission_no}
          </Text>
        </View>
      )}

      <FlatList
        data={reportCardKeys}
        renderItem={renderReportCard}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
            progressBackgroundColor="#fff"
          />
        }
        ListEmptyComponent={
          <View style={styles.noDataContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.noDataText}>No report cards available</Text>
            <Text style={styles.noDataSubtext}>Pull down to refresh and check for new report cards</Text>
          </View>
        }
      />
      
      {/* Export Button - Only show when there are report cards */}
      {reportCardKeys.length > 0 && (
        <View style={styles.exportSection}>
          <TouchableOpacity style={styles.exportButton} onPress={handlePreviewAllPDF}>
            <Ionicons name="download" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>Export Report Card</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Export Modal - Removed, direct preview */}

      {/* Preview Modal */}
      {showPreviewModal && (
        <Modal
          visible={showPreviewModal}
          animationType="slide"
          onRequestClose={() => setShowPreviewModal(false)}
        >
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <TouchableOpacity 
                style={styles.previewBackButton}
                onPress={() => setShowPreviewModal(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
                <Text style={styles.previewBackText}>Back</Text>
              </TouchableOpacity>
              
              <Text style={styles.previewTitle}>PDF Preview</Text>
              
              <TouchableOpacity 
                style={styles.previewExportButton}
                onPress={handleConfirmExport}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.previewExportText}>Export</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.previewContent}>
              <View style={styles.previewWebView}>
                <Text style={styles.previewNote}>
                  Preview of your PDF report. Scroll down to see all content.
                </Text>
                
                <View style={styles.htmlPreview}>
                  <View style={styles.previewDocument}>
                    <View style={styles.documentHeader}>
                      <Text style={styles.schoolName}>ABC School</Text>
                      <Text style={styles.documentTitle}>
                        Complete Report Card
                      </Text>
                    </View>
                    
                    {student && (
                      <View style={styles.studentInfoPreview}>
                        <Text style={styles.previewText}>
                          <Text style={styles.boldText}>Student:</Text> {student.name}
                        </Text>
                        <Text style={styles.previewText}>
                          <Text style={styles.boldText}>Class:</Text> {student.classes?.class_name} {student.classes?.section}
                        </Text>
                        <Text style={styles.previewText}>
                          <Text style={styles.boldText}>Admission No:</Text> {student.admission_no}
                        </Text>
                      </View>
                    )}
                    
                    {/* All Report Cards Preview */}
                    {Object.keys(reportCards).map(examId => {
                      const reportCard = reportCards[examId];
                      return (
                        <View key={examId} style={styles.reportPreview}>
                          <Text style={styles.examTitle}>{reportCard.exam?.name}</Text>
                          <Text style={styles.examDate}>
                            {new Date(reportCard.exam?.start_date).toLocaleDateString()} - {new Date(reportCard.exam?.end_date).toLocaleDateString()}
                          </Text>
                          
                          <View style={styles.marksTable}>
                            <View style={styles.tableHeader}>
                              <Text style={styles.tableHeaderText}>Subject</Text>
                              <Text style={styles.tableHeaderText}>Marks</Text>
                              <Text style={styles.tableHeaderText}>Max</Text>
                              <Text style={styles.tableHeaderText}>Grade</Text>
                            </View>
                            
                            {reportCard.subjects?.map((subject, index) => (
                              <View key={index} style={styles.tableRow}>
                                <Text style={styles.subjectCellText}>{subject.subject?.name}</Text>
                                <Text style={styles.tableCellText}>{subject.marks_obtained}</Text>
                                <Text style={styles.tableCellText}>{subject.max_marks}</Text>
                                <Text style={styles.tableCellText}>{subject.grade}</Text>
                              </View>
                            ))}
                            
                            <View style={styles.totalRow}>
                              <Text style={styles.totalText}>
                                Total: {reportCard.totalMarks}/{reportCard.totalMaxMarks} ({reportCard.percentage}%)
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentInfo: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 30, // Reduced from 40 to 30
    paddingBottom: 12,
    marginBottom: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6, // Reduced from 10 to 6
    textAlign: 'center',
    lineHeight: 28,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 0, // Remove any bottom margin
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  examHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  examName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  examDate: {
    fontSize: 14,
    color: '#666',
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subjectsHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  subjectHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subjectRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  subjectName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  subjectMarks: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  subjectTotal: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  subjectGrade: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  yearSection: {
    marginBottom: 24,
  },
  yearTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#1976d2',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    maxHeight: '80%',
  },
  marksSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  marksTable: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 8,
  },
  subjectCellText: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 15,
    fontSize: 14,
    color: '#333',
  },
  marksCell: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  gradeCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center',
  },
  summaryCardLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  exportSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  exportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
  },
  exportOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  exportCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  exportCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  previewHeader: {
    backgroundColor: '#1976d2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  previewBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewBackText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  previewExportText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  previewContent: {
    flex: 1,
  },
  previewWebView: {
    flex: 1,
    margin: 16,
  },
  previewNote: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'center',
  },
  htmlPreview: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewDocument: {
    padding: 20,
  },
  documentHeader: {
    alignItems: 'center',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#1976d2',
    paddingBottom: 20,
  },
  schoolName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  studentInfoPreview: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  previewText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
  },
  reportPreview: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 20,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  examDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  marksTable: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1976d2',
    paddingVertical: 12,
  },
  tableHeaderText: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 8,
  },
  tableCellText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default ViewReportCard; 
