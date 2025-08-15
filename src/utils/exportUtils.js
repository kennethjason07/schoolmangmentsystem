import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import { Alert, Platform } from 'react-native';
import { supabase, TABLES } from './supabase';

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

// Convert data to HTML format for PDF generation
export const convertToHTML = (data, title = 'Report', additionalInfo = null) => {
  if (!data || data.length === 0) {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #2196F3; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>No data available to display.</p>
        </body>
      </html>
    `;
  }

  const headers = Object.keys(data[0]);
  
  // Generate table rows
  const tableRows = data.map(item => {
    const cells = headers.map(header => {
      const value = item[header];
      if (typeof value === 'object' && value !== null) {
        return `<td>${JSON.stringify(value)}</td>`;
      }
      return `<td>${value || ''}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  // Generate table headers
  const tableHeaders = headers.map(header => `<th>${header}</th>`).join('');

  // Additional info section
  const additionalInfoSection = additionalInfo ? `
    <div style="margin-bottom: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
      <h3>Summary Information</h3>
      ${Object.entries(additionalInfo).map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`).join('')}
    </div>
  ` : '';

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #333;
          }
          h1 { 
            color: #2196F3; 
            border-bottom: 3px solid #2196F3; 
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          h3 {
            color: #666;
            margin-top: 20px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left;
          }
          th { 
            background-color: #2196F3; 
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) { 
            background-color: #f8f9fa;
          }
          tr:hover {
            background-color: #e3f2fd;
          }
          .export-info {
            text-align: right;
            color: #666;
            font-size: 12px;
            margin-top: 20px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${additionalInfoSection}
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="export-info">
          Generated on: ${new Date().toLocaleString('en-IN')}
        </div>
      </body>
    </html>
  `;
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

// Export individual attendance record
export const exportIndividualAttendanceRecord = async (recordData, format = EXPORT_FORMATS.CSV) => {
  try {
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';
    
    // Get current date for the export
    const exportDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Get teacher name from marked_by ID if available
    let markedByTeacher = 'System';
    if (recordData.marked_by) {
      try {
        const { data: teacherData } = await supabase
          .from(TABLES.TEACHERS)
          .select('name')
          .eq('id', recordData.marked_by)
          .single();
        markedByTeacher = teacherData?.name || 'Unknown Teacher';
      } catch (error) {
        console.log('Could not fetch teacher name:', error);
      }
    }

    switch (format) {
      case EXPORT_FORMATS.CSV:
        // Prepare individual record data for CSV (without remarks)
        const csvData = [{
          'Student Name': recordData.students?.name || 'N/A',
          'Admission No': recordData.students?.admission_no || 'N/A',
          'Class': `${recordData.classes?.class_name || ''} ${recordData.classes?.section || ''}`.trim(),
          'Date': recordData.date,
          'Status': recordData.status,
          'Marked By': markedByTeacher
        }];

        // Add export metadata
        const metadata = [
          { 'Field': 'Export Date', 'Value': exportDate },
          { 'Field': 'Record Date', 'Value': recordData.date },
          { 'Field': 'Class', 'Value': `${recordData.classes?.class_name || ''} ${recordData.classes?.section || ''}`.trim() }
        ];

        content = `INDIVIDUAL ATTENDANCE RECORD\nExported on: ${exportDate}\n\nRECORD DETAILS\n` + 
                 convertToCSV(metadata) + '\n\nATTENDANCE DATA\n' + convertToCSV(csvData);
        fileName = generateFileName(`attendance_${recordData.classes?.class_name}_${recordData.date}`, 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.PDF:
        const pdfData = [{
          'Student Name': recordData.students?.name || 'N/A',
          'Admission No': recordData.students?.admission_no || 'N/A',
          'Class': `${recordData.classes?.class_name || ''} ${recordData.classes?.section || ''}`.trim(),
          'Date': recordData.date,
          'Status': recordData.status,
          'Marked By': markedByTeacher
        }];

        const additionalInfo = {
          'Export Date': exportDate,
          'Record Date': recordData.date,
          'Class': `${recordData.classes?.class_name || ''} ${recordData.classes?.section || ''}`.trim()
        };

        const htmlContent = convertToHTML(
          pdfData, 
          'Individual Attendance Record', 
          additionalInfo
        );

        try {
          const { uri } = await Print.printToFileAsync({ 
            html: htmlContent,
            base64: false
          });
          
          // Create a new filename with .pdf extension
          fileName = generateFileName(`attendance_${recordData.classes?.class_name}_${recordData.date}`, 'pdf');
          const newUri = `${FileSystem.documentDirectory}${fileName}`;
          
          // Move the file to our desired location
          await FileSystem.moveAsync({ from: uri, to: newUri });
          
          // Share the PDF
          const canShare = await checkSharingAvailability();
          if (canShare) {
            await Sharing.shareAsync(newUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Export Attendance Record',
              UTI: 'com.adobe.pdf',
            });
            Alert.alert(
              'Export Successful',
              `Attendance record exported as ${fileName}. You can share it using the options shown.`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Export Successful', 
              `Attendance record saved as ${fileName} in the app's documents folder.`,
              [{ text: 'OK' }]
            );
          }
          return true;
        } catch (error) {
          console.error('Error generating PDF:', error);
          Alert.alert('PDF Error', 'Failed to generate PDF. Please try another format.');
          return false;
        }

      case EXPORT_FORMATS.CLIPBOARD:
        const clipboardData = [{
          'Student Name': recordData.students?.name || 'N/A',
          'Admission No': recordData.students?.admission_no || 'N/A',
          'Class': `${recordData.classes?.class_name || ''} ${recordData.classes?.section || ''}`.trim(),
          'Date': recordData.date,
          'Status': recordData.status,
          'Marked By': markedByTeacher
        }];
        content = `Individual Attendance Record (${exportDate})\n` + convertToCSV(clipboardData);
        return await copyToClipboard(content, 'Individual Attendance Record');

      default:
        throw new Error('Unsupported export format');
    }

    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('Error exporting individual attendance record:', error);
    Alert.alert('Export Error', 'Failed to export individual attendance record.');
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
        // Get current date for the export
        const exportDate = new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        // Prepare attendance data for CSV (without remarks, with teacher names)
        const csvData = await Promise.all(data.map(async (record) => {
          let markedByTeacher = 'System';
          if (record.marked_by) {
            try {
              const { data: teacherData } = await supabase
                .from(TABLES.TEACHERS)
                .select('name')
                .eq('id', record.marked_by)
                .single();
              markedByTeacher = teacherData?.name || 'Unknown Teacher';
            } catch (error) {
              console.log('Could not fetch teacher name for record:', error);
            }
          }
          
          return {
            'Student Name': record.students?.name || 'N/A',
            'Admission No': record.students?.admission_no || 'N/A',
            'Class': `${record.classes?.class_name || ''} ${record.classes?.section || ''}`.trim(),
            'Date': record.date,
            'Status': record.status,
            'Marked By': markedByTeacher
          };
        }));

        // Add summary statistics with export date
        const summaryData = [
          { 'Metric': 'Export Date', 'Value': exportDate },
          { 'Metric': 'Total Present Today', 'Value': stats.presentToday },
          { 'Metric': 'Total Absent Today', 'Value': stats.absentToday },
          { 'Metric': 'Attendance Rate', 'Value': `${stats.attendanceRate}%` },
          { 'Metric': 'Total Students', 'Value': stats.totalStudents }
        ];

        content = `ATTENDANCE SUMMARY\nGenerated on: ${exportDate}\n\n` + convertToCSV(summaryData) + '\n\nATTENDANCE RECORDS\n' + convertToCSV(csvData);
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
          { 'Metric': 'Total Collected', 'Value': formatCurrency(stats.totalCollected || 0) },
          { 'Metric': 'Total Outstanding', 'Value': formatCurrency(stats.totalOutstanding || 0) },
          { 'Metric': 'Total Expected', 'Value': formatCurrency(stats.totalExpected || 0) },
          { 'Metric': 'Collection Rate', 'Value': `${stats.collectionRate || 0}%` }
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
