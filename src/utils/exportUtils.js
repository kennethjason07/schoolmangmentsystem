import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
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

      case EXPORT_FORMATS.PDF:
        return await generateAcademicPerformancePDF(data, stats);

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

// Generate PDF for Academic Performance Report
export const generateAcademicPerformancePDF = async (data, stats) => {
  try {
    const htmlContent = generateAcademicPerformanceHTML(data, stats);
    
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false
    });

    const fileName = `Academic_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    
    if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert('Permission Required', 'Please grant storage permission to save the PDF file.');
          return false;
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

        Alert.alert('PDF Saved Successfully', `Academic performance report saved as ${fileName}`);
        return true;
      } catch (error) {
        console.error('Android save error:', error);
        return await sharePDF(uri, fileName);
      }
    } else {
      return await sharePDF(uri, fileName);
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    Alert.alert('Error', 'Failed to generate PDF report. Please try again.');
    return false;
  }
};

// Generate PDF with preview functionality
export const generateAcademicPerformancePDFWithPreview = async (data, stats) => {
  try {
    const htmlContent = generateAcademicPerformanceHTML(data, stats);
    return { success: true, htmlContent };
  } catch (error) {
    console.error('PDF preview generation error:', error);
    return { success: false, error: error.message };
  }
};

// Share PDF file
const sharePDF = async (uri, fileName) => {
  try {
    const canShare = await checkSharingAvailability();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Academic Performance Report',
        UTI: 'com.adobe.pdf'
      });
      Alert.alert('Export Successful', `Report exported as ${fileName}`);
      return true;
    } else {
      Alert.alert('Export Complete', `Report generated successfully as ${fileName}`);
      return true;
    }
  } catch (error) {
    console.error('Error sharing PDF:', error);
    Alert.alert('Share Error', 'Failed to share PDF. File has been generated successfully.');
    return false;
  }
};

// Generate HTML content for Academic Performance PDF
export const generateAcademicPerformanceHTML = (data, stats) => {
  const currentDate = new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Academic Performance Report</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            margin: 20px; 
            line-height: 1.6;
            color: #333;
          }
          
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 3px solid #2196F3;
            padding-bottom: 20px;
          }
          
          .school-name { 
            font-size: 28px; 
            font-weight: bold; 
            color: #2196F3; 
            margin-bottom: 5px;
          }
          
          .report-title {
            font-size: 22px;
            color: #1976D2;
            margin: 10px 0;
          }
          
          .report-date {
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
          }
          
          .summary-section {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 25px;
            border-left: 5px solid #2196F3;
          }
          
          .summary-title {
            font-size: 18px;
            font-weight: bold;
            color: #2196F3;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }
          
          .summary-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .summary-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .summary-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .grade-section {
            margin-bottom: 25px;
            background: white;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e0e0e0;
          }
          
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #2196F3;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
          }
          
          .grade-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          
          .grade-card {
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid;
          }
          
          .grade-a { border-color: #4CAF50; background: rgba(76, 175, 80, 0.1); }
          .grade-b { border-color: #8BC34A; background: rgba(139, 195, 74, 0.1); }
          .grade-c { border-color: #FF9800; background: rgba(255, 152, 0, 0.1); }
          .grade-d { border-color: #FF5722; background: rgba(255, 87, 34, 0.1); }
          .grade-f { border-color: #f44336; background: rgba(244, 67, 54, 0.1); }
          
          .grade-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          
          .grade-count {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .grade-percentage {
            font-size: 12px;
            color: #666;
          }
          
          .subject-section {
            margin-bottom: 25px;
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          th, td { 
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
          }
          
          th { 
            background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
          }
          
          tr:nth-child(even) {
            background: #f8f9fa;
          }
          
          tr:hover {
            background: #e3f2fd;
          }
          
          .performance-bar {
            background: #e0e0e0;
            border-radius: 10px;
            height: 8px;
            margin: 5px 0;
          }
          
          .performance-fill {
            height: 100%;
            border-radius: 10px;
          }
          
          .performers-section {
            margin-bottom: 25px;
          }
          
          .performer-card {
            display: flex;
            align-items: center;
            padding: 10px 15px;
            margin-bottom: 8px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #2196F3;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .rank-badge {
            background: #2196F3;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
          }
          
          .performer-info {
            flex: 1;
          }
          
          .performer-name {
            font-weight: bold;
            margin-bottom: 3px;
          }
          
          .performer-details {
            color: #666;
            font-size: 12px;
          }
          
          .performer-score {
            font-size: 18px;
            font-weight: bold;
            color: #4CAF50;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          
          @media print {
            .grade-section, .subject-section, .performers-section {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="school-name">ABC School</div>
          <h1 class="report-title">Academic Performance Report</h1>
          <p class="report-date">Generated on ${currentDate}</p>
        </div>

        <!-- Performance Summary -->
        <div class="summary-section">
          <h2 class="summary-title">📊 Performance Overview</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-value" style="color: #2196F3;">${stats.totalStudents}</div>
              <div class="summary-label">Total Students</div>
            </div>
            <div class="summary-card">
              <div class="summary-value" style="color: #4CAF50;">${stats.averagePercentage}%</div>
              <div class="summary-label">Average Performance</div>
            </div>
            <div class="summary-card">
              <div class="summary-value" style="color: #FF9800;">${stats.highestScore}%</div>
              <div class="summary-label">Highest Score</div>
            </div>
            <div class="summary-card">
              <div class="summary-value" style="color: #f44336;">${stats.lowestScore}%</div>
              <div class="summary-label">Lowest Score</div>
            </div>
          </div>
        </div>

        <!-- Grade Distribution -->
        <div class="grade-section">
          <h2 class="section-title">🎯 Grade Distribution Analysis</h2>
          <div class="grade-grid">
            ${stats.gradeDistribution.map(grade => {
              const totalStudents = stats.gradeDistribution.reduce((sum, g) => sum + g.population, 0);
              const percentage = totalStudents > 0 ? Math.round((grade.population / totalStudents) * 100) : 0;
              const gradeClass = grade.name.includes('A') ? 'grade-a' : 
                                grade.name.includes('B') ? 'grade-b' : 
                                grade.name.includes('C') ? 'grade-c' : 
                                grade.name.includes('D') ? 'grade-d' : 'grade-f';
              
              return `
                <div class="grade-card ${gradeClass}">
                  <div class="grade-name">${grade.name}</div>
                  <div class="grade-count">${grade.population}</div>
                  <div class="grade-percentage">${percentage}% of students</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Subject Performance -->
        ${stats.subjectPerformance.length > 0 ? `
        <div class="subject-section">
          <h2 class="section-title">📚 Subject-wise Performance</h2>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Students Evaluated</th>
                <th>Average Performance</th>
                <th>Performance Bar</th>
              </tr>
            </thead>
            <tbody>
              ${stats.subjectPerformance.map(subject => {
                const performanceColor = subject.percentage >= 90 ? '#4CAF50' : 
                                        subject.percentage >= 80 ? '#8BC34A' : 
                                        subject.percentage >= 70 ? '#FF9800' : 
                                        subject.percentage >= 60 ? '#FF5722' : '#f44336';
                
                return `
                  <tr>
                    <td><strong>${subject.subject}</strong></td>
                    <td>${subject.count}</td>
                    <td><strong style="color: ${performanceColor}">${subject.percentage}%</strong></td>
                    <td>
                      <div class="performance-bar">
                        <div class="performance-fill" style="width: ${subject.percentage}%; background: ${performanceColor};"></div>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Top Performers -->
        ${stats.topPerformers.length > 0 ? `
        <div class="performers-section">
          <h2 class="section-title">🏆 Top Performers</h2>
          ${stats.topPerformers.slice(0, 10).map((performer, index) => {
            const scoreColor = performer.percentage >= 90 ? '#4CAF50' : 
                              performer.percentage >= 80 ? '#8BC34A' : 
                              performer.percentage >= 70 ? '#FF9800' : 
                              performer.percentage >= 60 ? '#FF5722' : '#f44336';
            
            return `
              <div class="performer-card">
                <div class="rank-badge">${index + 1}</div>
                <div class="performer-info">
                  <div class="performer-name">${performer.name}</div>
                  <div class="performer-details">#${performer.admissionNo} • ${performer.count} subjects</div>
                </div>
                <div class="performer-score" style="color: ${scoreColor}">${performer.percentage}%</div>
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>This report was generated automatically by the School Management System</p>
          <p>Report Date: ${currentDate} | Total Records Analyzed: ${data.length}</p>
        </div>
      </body>
    </html>
  `;
};
