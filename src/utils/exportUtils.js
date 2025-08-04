import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Alert, Platform } from 'react-native';

// Export formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  PDF: 'pdf',
  EXCEL: 'xlsx',
  CLIPBOARD: 'clipboard'
};

// Check if sharing is available (no permissions needed for file system operations)
export const checkSharingAvailability = async () => {
  try {
    return await Sharing.isAvailableAsync();
  } catch (error) {
    console.error('Error checking sharing availability:', error);
    return false;
  }
};

// Convert array of objects to CSV format
export const convertToCSV = (data, headers = null) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = csvHeaders.join(',');
  
  // Create data rows
  const dataRows = data.map(item => {
    return csvHeaders.map(header => {
      const value = item[header];
      // Handle nested objects and arrays
      if (typeof value === 'object' && value !== null) {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      // Escape commas and quotes in strings
      if (typeof value === 'string') {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
};

// Convert data to JSON format
export const convertToJSON = (data, pretty = true) => {
  return JSON.stringify(data, null, pretty ? 2 : 0);
};

// Generate filename with timestamp
export const generateFileName = (baseName, format, includeTimestamp = true) => {
  const timestamp = includeTimestamp ? new Date().toISOString().slice(0, 19).replace(/:/g, '-') : '';
  const timestampSuffix = includeTimestamp ? `_${timestamp}` : '';
  return `${baseName}${timestampSuffix}.${format}`;
};

// Save file to device and share
export const saveFile = async (content, fileName, mimeType = 'text/plain') => {
  try {
    // Create file in document directory (no permissions needed)
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Check if sharing is available
    const canShare = await checkSharingAvailability();

    if (canShare) {
      // Share the file using native sharing dialog
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Export Report',
        UTI: mimeType,
      });

      // Show success message
      Alert.alert(
        'Export Successful',
        `Report exported as ${fileName}. You can share it using the options shown.`,
        [{ text: 'OK' }]
      );
    } else {
      // Fallback: just show success message with file location
      Alert.alert(
        'Export Successful',
        `Report saved as ${fileName} in the app's documents folder.`,
        [{ text: 'OK' }]
      );
    }

    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    Alert.alert(
      'Export Error',
      'Failed to export report. Please try again.',
      [{ text: 'OK' }]
    );
    return false;
  }
};

// Copy data to clipboard (useful for development and quick sharing)
export const copyToClipboard = async (content, title = 'Report Data') => {
  try {
    await Clipboard.setStringAsync(content);
    Alert.alert(
      'Copied to Clipboard',
      `${title} has been copied to your clipboard. You can paste it into any text editor or email.`,
      [{ text: 'OK' }]
    );
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    Alert.alert(
      'Copy Error',
      'Failed to copy data to clipboard. Please try again.',
      [{ text: 'OK' }]
    );
    return false;
  }
};

// Export attendance data
export const exportAttendanceData = async (data, stats, format = EXPORT_FORMATS.CSV) => {
  try {
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';

    switch (format) {
      case EXPORT_FORMATS.CSV:
        // Prepare attendance data for CSV
        const csvData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Class': `${record.classes?.class_name || ''} ${record.classes?.section || ''}`.trim(),
          'Date': record.date,
          'Status': record.status,
          'Marked By': record.marked_by || 'System',
          'Remarks': record.remarks || ''
        }));

        // Add summary statistics
        const summaryData = [
          { 'Metric': 'Total Present Today', 'Value': stats.presentToday },
          { 'Metric': 'Total Absent Today', 'Value': stats.absentToday },
          { 'Metric': 'Attendance Rate', 'Value': `${stats.attendanceRate}%` },
          { 'Metric': 'Total Students', 'Value': stats.totalStudents }
        ];

        content = 'ATTENDANCE SUMMARY\n' + convertToCSV(summaryData) + '\n\nATTENDANCE RECORDS\n' + convertToCSV(csvData);
        fileName = generateFileName('attendance_report', 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.JSON:
        content = convertToJSON({
          summary: stats,
          records: data,
          exportedAt: new Date().toISOString()
        });
        fileName = generateFileName('attendance_report', 'json');
        mimeType = 'application/json';
        break;

      case EXPORT_FORMATS.CLIPBOARD:
        // For clipboard, use CSV format as it's more readable
        const clipboardData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Class': `${record.classes?.class_name || ''} ${record.classes?.section || ''}`.trim(),
          'Date': record.date,
          'Status': record.status,
          'Remarks': record.remarks || ''
        }));
        content = convertToCSV(clipboardData);
        return await copyToClipboard(content, 'Attendance Report');

      default:
        throw new Error('Unsupported export format');
    }

    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('Error exporting attendance data:', error);
    Alert.alert('Export Error', 'Failed to export attendance report.');
    return false;
  }
};

// Export academic performance data
export const exportAcademicData = async (data, stats, format = EXPORT_FORMATS.CSV) => {
  try {
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';

    switch (format) {
      case EXPORT_FORMATS.CSV:
        // Prepare academic data for CSV
        const csvData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Exam': record.exams?.name || 'N/A',
          'Subject': record.subjects?.name || 'N/A',
          'Marks Obtained': record.marks_obtained,
          'Max Marks': record.max_marks,
          'Percentage': record.max_marks > 0 ? Math.round((record.marks_obtained / record.max_marks) * 100) : 0,
          'Grade': getGrade(record.max_marks > 0 ? (record.marks_obtained / record.max_marks) * 100 : 0)
        }));

        // Add performance summary
        const summaryData = [
          { 'Metric': 'Total Students', 'Value': stats.totalStudents },
          { 'Metric': 'Average Percentage', 'Value': `${stats.averagePercentage}%` },
          { 'Metric': 'Highest Score', 'Value': `${stats.highestScore}%` },
          { 'Metric': 'Lowest Score', 'Value': `${stats.lowestScore}%` }
        ];

        content = 'ACADEMIC PERFORMANCE SUMMARY\n' + convertToCSV(summaryData) + '\n\nPERFORMANCE RECORDS\n' + convertToCSV(csvData);
        fileName = generateFileName('academic_performance', 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.JSON:
        content = convertToJSON({
          summary: stats,
          records: data,
          exportedAt: new Date().toISOString()
        });
        fileName = generateFileName('academic_performance', 'json');
        mimeType = 'application/json';
        break;

      case EXPORT_FORMATS.CLIPBOARD:
        const clipboardData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Exam': record.exams?.name || 'N/A',
          'Subject': record.subjects?.name || 'N/A',
          'Marks Obtained': record.marks_obtained,
          'Max Marks': record.max_marks,
          'Percentage': record.max_marks > 0 ? Math.round((record.marks_obtained / record.max_marks) * 100) : 0,
          'Grade': getGrade(record.max_marks > 0 ? (record.marks_obtained / record.max_marks) * 100 : 0)
        }));
        content = convertToCSV(clipboardData);
        return await copyToClipboard(content, 'Academic Performance Report');

      default:
        throw new Error('Unsupported export format');
    }

    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('Error exporting academic data:', error);
    Alert.alert('Export Error', 'Failed to export academic performance report.');
    return false;
  }
};

// Export fee collection data
export const exportFeeData = async (data, stats, format = EXPORT_FORMATS.CSV) => {
  try {
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';

    switch (format) {
      case EXPORT_FORMATS.CSV:
        // Prepare fee data for CSV
        const csvData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Class': `${record.students?.classes?.class_name || ''} ${record.students?.classes?.section || ''}`.trim(),
          'Fee Component': record.fee_component,
          'Amount Paid': record.amount_paid,
          'Payment Date': record.payment_date,
          'Payment Mode': record.payment_mode,
          'Receipt No': record.receipt_no || 'N/A',
          'Status': record.status || 'Paid'
        }));

        // Add collection summary
        const summaryData = [
          { 'Metric': 'Total Collected', 'Value': formatCurrency(stats.totalCollected) },
          { 'Metric': 'Total Outstanding', 'Value': formatCurrency(stats.totalOutstanding) },
          { 'Metric': 'Total Expected', 'Value': formatCurrency(stats.totalExpected) },
          { 'Metric': 'Collection Rate', 'Value': `${stats.collectionRate}%` }
        ];

        content = 'FEE COLLECTION SUMMARY\n' + convertToCSV(summaryData) + '\n\nFEE RECORDS\n' + convertToCSV(csvData);
        fileName = generateFileName('fee_collection', 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.JSON:
        content = convertToJSON({
          summary: stats,
          records: data,
          exportedAt: new Date().toISOString()
        });
        fileName = generateFileName('fee_collection', 'json');
        mimeType = 'application/json';
        break;

      case EXPORT_FORMATS.CLIPBOARD:
        const clipboardData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Class': `${record.students?.classes?.class_name || ''} ${record.students?.classes?.section || ''}`.trim(),
          'Fee Component': record.fee_component,
          'Amount Paid': record.amount_paid,
          'Payment Date': record.payment_date,
          'Payment Mode': record.payment_mode,
          'Receipt No': record.receipt_no || 'N/A',
          'Status': record.status || 'Paid'
        }));
        content = convertToCSV(clipboardData);
        return await copyToClipboard(content, 'Fee Collection Report');

      default:
        throw new Error('Unsupported export format');
    }

    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('Error exporting fee data:', error);
    Alert.alert('Export Error', 'Failed to export fee collection report.');
    return false;
  }
};

// Export student overview data
export const exportStudentData = async (data, stats, format = EXPORT_FORMATS.CSV) => {
  try {
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';

    switch (format) {
      case EXPORT_FORMATS.CSV:
        // Prepare student data for CSV
        const csvData = data.map(student => ({
          'Name': student.name,
          'Admission No': student.admission_no,
          'Class': `${student.classes?.class_name || ''} ${student.classes?.section || ''}`.trim(),
          'Gender': student.gender,
          'Date of Birth': student.dob,
          'Age': calculateAge(student.dob),
          'Father Name': student.father_name || 'N/A',
          'Mother Name': student.mother_name || 'N/A',
          'Contact': student.contact_number || 'N/A',
          'Address': student.address || 'N/A',
          'Religion': student.religion || 'N/A',
          'Caste': student.caste || 'N/A',
          'Enrollment Date': student.created_at?.split('T')[0] || 'N/A'
        }));

        // Add overview summary
        const summaryData = [
          { 'Metric': 'Total Students', 'Value': stats.totalStudents },
          { 'Metric': 'Male Students', 'Value': stats.maleStudents },
          { 'Metric': 'Female Students', 'Value': stats.femaleStudents },
          { 'Metric': 'Average Age', 'Value': stats.averageAge }
        ];

        content = 'STUDENT OVERVIEW SUMMARY\n' + convertToCSV(summaryData) + '\n\nSTUDENT RECORDS\n' + convertToCSV(csvData);
        fileName = generateFileName('student_overview', 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.JSON:
        content = convertToJSON({
          summary: stats,
          records: data,
          exportedAt: new Date().toISOString()
        });
        fileName = generateFileName('student_overview', 'json');
        mimeType = 'application/json';
        break;

      case EXPORT_FORMATS.CLIPBOARD:
        const clipboardData = data.map(student => ({
          'Name': student.name,
          'Admission No': student.admission_no,
          'Class': `${student.classes?.class_name || ''} ${student.classes?.section || ''}`.trim(),
          'Gender': student.gender,
          'Date of Birth': student.dob,
          'Age': calculateAge(student.dob),
          'Father Name': student.father_name || 'N/A',
          'Mother Name': student.mother_name || 'N/A',
          'Contact': student.contact_number || 'N/A',
          'Address': student.address || 'N/A',
          'Religion': student.religion || 'N/A',
          'Caste': student.caste || 'N/A',
          'Enrollment Date': student.created_at?.split('T')[0] || 'N/A'
        }));
        content = convertToCSV(clipboardData);
        return await copyToClipboard(content, 'Student Overview Report');

      default:
        throw new Error('Unsupported export format');
    }

    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('Error exporting student data:', error);
    Alert.alert('Export Error', 'Failed to export student overview report.');
    return false;
  }
};

// Helper functions
const getGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const calculateAge = (dob) => {
  if (!dob) return 'N/A';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};
