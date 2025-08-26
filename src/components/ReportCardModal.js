import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

const ReportCardModal = ({ visible, student, examId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [marks, setMarks] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [schoolDetails, setSchoolDetails] = useState(null);
  const [examDetails, setExamDetails] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (visible && student && examId) {
      loadReportCardData();
    }
  }, [visible, student, examId]);

  const loadReportCardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMarks(),
        loadAttendance(),
        loadSchoolDetails(),
        loadExamDetails(),
        loadSubjects(),
      ]);
    } catch (error) {
      console.error('Error loading report card data:', error);
      Alert.alert('Error', 'Failed to load report card data.');
    } finally {
      setLoading(false);
    }
  };

  const loadMarks = async () => {
    try {
      const { data, error } = await supabase
        .from('marks')
        .select(`
          *,
          subjects:subject_id (
            id,
            name
          )
        `)
        .eq('student_id', student.id)
        .eq('exam_id', examId);

      if (error) throw error;
      setMarks(data || []);
    } catch (error) {
      console.error('Error loading marks:', error);
      throw error;
    }
  };

  const loadAttendance = async () => {
    try {
      // Get attendance for the current academic year
      const { data, error } = await supabase
        .from('student_attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('class_id', student.class_id);

      if (error) throw error;

      const attendanceData = data || [];
      const totalDays = attendanceData.length;
      const presentDays = attendanceData.filter(a => a.status === 'Present').length;
      const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;

      setAttendance({
        totalDays,
        presentDays,
        absentDays: totalDays - presentDays,
        percentage: attendancePercentage,
      });
    } catch (error) {
      console.error('Error loading attendance:', error);
      throw error;
    }
  };

  const loadSchoolDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('school_details')
        .select('*')
        .limit(1);

      if (error) {
        console.error('Error loading school details:', error);
        return; // Don't throw here, school details are optional
      }
      
      // Set the first school details if available, otherwise null
      setSchoolDetails(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Error loading school details:', error);
      // Don't throw here, school details are optional
    }
  };

  const loadExamDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id, name, class_id, academic_year, start_date, end_date, remarks, max_marks, created_at')
        .eq('id', examId)
        .limit(1);

      if (error) {
        console.error('Error loading exam details:', error);
        return; // Don't throw here, set default exam details
      }
      
      // Set the exam details if available, otherwise null
      setExamDetails(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Error loading exam details:', error);
      // Don't throw here, exam details can be optional
    }
  };

  const loadSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('class_id', student.class_id);

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
      throw error;
    }
  };

  const calculateGrade = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    if (percentage >= 35) return 'D';
    return 'F';
  };

  const calculateTotals = () => {
    const totalMarksObtained = marks.reduce((sum, mark) => sum + (mark.marks_obtained || 0), 0);
    // Use exam's max_marks for each subject instead of marks table max_marks
    const examMaxMarks = examDetails?.max_marks || 100;
    const totalMaxMarks = marks.length * examMaxMarks;
    const percentage = totalMaxMarks > 0 ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(1) : 0;
    const grade = calculateGrade(percentage);

    return {
      totalMarksObtained,
      totalMaxMarks,
      percentage,
      grade,
    };
  };

  const getSubjectMark = (subjectId) => {
    return marks.find(mark => mark.subject_id === subjectId);
  };

  const generateReportCardHTML = () => {
    const totals = calculateTotals();
    const currentDate = new Date().toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Report Card - ${student.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .school-name {
            font-size: 24px;
            font-weight: bold;
            color: #1976d2;
          }
          .school-address {
            font-size: 12px;
            color: #666;
          }
          .report-title {
            font-size: 20px;
            font-weight: bold;
            margin: 10px 0;
          }
          .student-info {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
          }
          .info-section {
            flex: 1;
          }
          .info-row {
            margin: 5px 0;
          }
          .label {
            font-weight: 900 !important;
            display: inline-block;
            width: 120px;
            font-family: Arial, sans-serif;
            color: #000 !important;
          }
          .value {
            font-weight: 900 !important;
            font-family: Arial, sans-serif;
            color: #000 !important;
          }
          strong {
            font-weight: 900 !important;
            font-family: Arial, sans-serif;
            color: #000 !important;
          }
          .marks-table th {
            background-color: #f0f0f0;
            font-weight: 900 !important;
            color: #000 !important;
          }
          .total-row {
            background-color: #e3f2fd;
            font-weight: 900 !important;
          }
          .total-row td {
            font-weight: 900 !important;
            color: #000 !important;
          }
          .marks-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .marks-table th,
          .marks-table td {
            border: 1px solid #333;
            padding: 8px;
            text-align: center;
          }
          .marks-table th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .total-row {
            background-color: #e3f2fd;
            font-weight: bold;
          }
          .attendance-section,
          .summary-section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1976d2;
          }
          .grade-display {
            font-size: 18px;
            font-weight: bold;
            color: #1976d2;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          .signature {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-bottom: 1px solid #333;
            margin-bottom: 5px;
            height: 30px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-name">${schoolDetails?.name || 'School Management System'}</div>
          <div class="school-address">
            ${schoolDetails?.address || ''} ${schoolDetails?.city || ''} ${schoolDetails?.state || ''}
            ${schoolDetails?.phone ? 'Phone: ' + schoolDetails.phone : ''}
          </div>
          <div class="report-title">STUDENT REPORT CARD</div>
        </div>

        <div class="student-info">
          <div class="info-section">
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">${student.name}</span>
            </div>
            <div class="info-row">
              <span class="label">Admission No:</span>
              <span class="value">${student.admission_no}</span>
            </div>
            <div class="info-row">
              <span class="label">Class:</span>
              <span class="value">${student.classes?.class_name} - ${student.classes?.section}</span>
            </div>
            <div class="info-row">
              <span class="label">DOB:</span>
              <span class="value">${new Date(student.dob).toLocaleDateString()}</span>
            </div>
          </div>
          <div class="info-section">
            <div class="info-row">
              <span class="label">Exam:</span>
              <span class="value">${examDetails?.name || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Academic Year:</span>
              <span class="value">${student.academic_year}</span>
            </div>
            <div class="info-row">
              <span class="label">Generated On:</span>
              <span class="value">${currentDate}</span>
            </div>
          </div>
        </div>

        <table class="marks-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Marks Obtained</th>
              <th>Total Marks</th>
              <th>Percentage</th>
              <th>Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map(subject => {
              const mark = getSubjectMark(subject.id);
              const marksObtained = mark?.marks_obtained || 0;
              const maxMarks = examDetails?.max_marks || 100; // Use exam's max_marks
              const percentage = maxMarks > 0 ? ((marksObtained / maxMarks) * 100).toFixed(1) : 0;
              const grade = mark?.grade || calculateGrade(percentage);
              
              return `
                <tr>
                  <td>${subject.name}</td>
                  <td>${marksObtained}</td>
                  <td>${maxMarks}</td>
                  <td>${percentage}%</td>
                  <td>${grade}</td>
                  <td>${mark?.remarks || '-'}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td><strong>TOTAL</strong></td>
              <td><strong>${totals.totalMarksObtained}</strong></td>
              <td><strong>${totals.totalMaxMarks}</strong></td>
              <td><strong>${totals.percentage}%</strong></td>
              <td><strong>${totals.grade}</strong></td>
              <td>-</td>
            </tr>
          </tbody>
        </table>

        <div class="attendance-section">
          <div class="section-title">Attendance Summary</div>
          <div class="info-row">
            <span class="label">Total Days:</span>
            <span>${attendance?.totalDays || 0}</span>
          </div>
          <div class="info-row">
            <span class="label">Present Days:</span>
            <span>${attendance?.presentDays || 0}</span>
          </div>
          <div class="info-row">
            <span class="label">Absent Days:</span>
            <span>${attendance?.absentDays || 0}</span>
          </div>
          <div class="info-row">
            <span class="label">Attendance %:</span>
            <span class="grade-display">${attendance?.percentage || 0}%</span>
          </div>
        </div>

        <div class="summary-section">
          <div class="section-title">Performance Summary</div>
          <div class="info-row">
            <span class="label">Overall Grade:</span>
            <span class="grade-display">${totals.grade}</span>
          </div>
          <div class="info-row">
            <span class="label">Overall Percentage:</span>
            <span class="grade-display">${totals.percentage}%</span>
          </div>
          <div class="info-row">
            <span class="label">Rank:</span>
            <span>To be calculated</span>
          </div>
        </div>

        <div class="signature-section">
          <div class="signature">
            <div class="signature-line"></div>
            <div>Class Teacher</div>
          </div>
          <div class="signature">
            <div class="signature-line"></div>
            <div>Principal</div>
          </div>
          <div class="signature">
            <div class="signature-line"></div>
            <div>Parent Signature</div>
          </div>
        </div>

        <div class="footer">
          <p>This is a computer-generated report card. For any queries, please contact the school administration.</p>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true);
      
      const htmlContent = generateReportCardHTML();
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      const fileName = `${student.name}_${examDetails?.name || 'Report'}_${new Date().getFullYear()}.pdf`;
      const documentDirectory = FileSystem.documentDirectory;
      const newPath = `${documentDirectory}${fileName}`;

      await FileSystem.moveAsync({
        from: uri,
        to: newPath,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newPath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Report Card',
        });
      } else {
        Alert.alert('Success', `Report card saved to ${newPath}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const totals = marks.length > 0 ? calculateTotals() : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1976d2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Card</Text>
          <TouchableOpacity 
            onPress={handleDownloadPDF} 
            style={styles.downloadButton}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <ActivityIndicator size="small" color="#1976d2" />
            ) : (
              <Ionicons name="download" size={24} color="#1976d2" />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Loading report card...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* School Header */}
            <View style={styles.schoolHeader}>
              <Text style={styles.schoolName}>
                {schoolDetails?.name || 'School Management System'}
              </Text>
              <Text style={styles.schoolAddress}>
                {schoolDetails?.address && `${schoolDetails.address}, `}
                {schoolDetails?.city && `${schoolDetails.city}, `}
                {schoolDetails?.state}
              </Text>
              <Text style={styles.reportTitle}>STUDENT REPORT CARD</Text>
            </View>

            {/* Student Information */}
            <View style={styles.studentInfo}>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Student Name:</Text>
                  <Text style={styles.infoValue}>{student.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Admission No:</Text>
                  <Text style={styles.infoValue}>{student.admission_no}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Class:</Text>
                  <Text style={styles.infoValue}>
                    {student.classes?.class_name} - {student.classes?.section}
                  </Text>
                </View>
              </View>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Exam:</Text>
                  <Text style={styles.infoValue}>{examDetails?.name || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Academic Year:</Text>
                  <Text style={styles.infoValue}>{student.academic_year}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date of Birth:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(student.dob).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Generated On:</Text>
                  <Text style={styles.infoValue}>
                    {new Date().toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Marks Table */}
            <View style={styles.marksSection}>
              <Text style={styles.sectionTitle}>Academic Performance</Text>
              <View style={styles.marksTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.headerCell, { flex: 2 }]}>Subject</Text>
                  <Text style={[styles.tableCell, styles.headerCell, { flex: 1 }]}>Marks</Text>
                  <Text style={[styles.tableCell, styles.headerCell, { flex: 1 }]}>Total</Text>
                  <Text style={[styles.tableCell, styles.headerCell, { flex: 1 }]}>%</Text>
                  <Text style={[styles.tableCell, styles.headerCell, { flex: 1 }]}>Grade</Text>
                </View>
                
                {subjects.map(subject => {
                  const mark = getSubjectMark(subject.id);
                  const marksObtained = mark?.marks_obtained || 0;
                  const maxMarks = examDetails?.max_marks || 100; // Use exam's max_marks
                  const percentage = maxMarks > 0 ? ((marksObtained / maxMarks) * 100).toFixed(1) : 0;
                  const grade = mark?.grade || calculateGrade(percentage);
                  
                  return (
                    <View key={subject.id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 2 }]}>{subject.name}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{marksObtained}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{maxMarks}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{percentage}%</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{grade}</Text>
                    </View>
                  );
                })}
                
                {totals && (
                  <View style={[styles.tableRow, styles.totalRow]}>
                    <Text style={[styles.tableCell, styles.totalCell, { flex: 2 }]}>TOTAL</Text>
                    <Text style={[styles.tableCell, styles.totalCell, { flex: 1 }]}>{totals.totalMarksObtained}</Text>
                    <Text style={[styles.tableCell, styles.totalCell, { flex: 1 }]}>{totals.totalMaxMarks}</Text>
                    <Text style={[styles.tableCell, styles.totalCell, { flex: 1 }]}>{totals.percentage}%</Text>
                    <Text style={[styles.tableCell, styles.totalCell, { flex: 1 }]}>{totals.grade}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Attendance Summary */}
            {attendance && (
              <View style={styles.attendanceSection}>
                <Text style={styles.sectionTitle}>Attendance Summary</Text>
                <View style={styles.attendanceGrid}>
                  <View style={styles.attendanceCard}>
                    <Text style={styles.attendanceValue}>{attendance.totalDays}</Text>
                    <Text style={styles.attendanceLabel}>Total Days</Text>
                  </View>
                  <View style={styles.attendanceCard}>
                    <Text style={styles.attendanceValue}>{attendance.presentDays}</Text>
                    <Text style={styles.attendanceLabel}>Present</Text>
                  </View>
                  <View style={styles.attendanceCard}>
                    <Text style={styles.attendanceValue}>{attendance.absentDays}</Text>
                    <Text style={styles.attendanceLabel}>Absent</Text>
                  </View>
                  <View style={styles.attendanceCard}>
                    <Text style={[styles.attendanceValue, styles.percentageText]}>
                      {attendance.percentage}%
                    </Text>
                    <Text style={styles.attendanceLabel}>Attendance</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Performance Summary */}
            {totals && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Performance Summary</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Overall Grade</Text>
                    <Text style={[styles.summaryValue, styles.gradeText]}>{totals.grade}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Overall Percentage</Text>
                    <Text style={[styles.summaryValue, styles.percentageText]}>{totals.percentage}%</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  downloadButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  schoolHeader: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1976d2',
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
  },
  schoolAddress: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoColumn: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  marksSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 12,
  },
  marksTable: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  totalRow: {
    backgroundColor: '#e3f2fd',
  },
  tableCell: {
    padding: 12,
    fontSize: 12,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  headerCell: {
    fontWeight: 'bold',
    color: '#333',
  },
  totalCell: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
  attendanceSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  attendanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  attendanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  attendanceLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  summarySection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  gradeText: {
    color: '#4CAF50',
  },
  percentageText: {
    color: '#1976d2',
  },
});

export default ReportCardModal;
