import * as FileSystem from 'expo-file-system';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import { Alert, Platform } from 'react-native';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
// import * as XLSX from 'xlsx'; // Not installed, will use fallback
const XLSX = null;

// Console logger for export operations
const logExport = (component, message, data) => {
  console.log(`[Export: ${component}] ${message}`, data || '');
};

// Simple PDF test function
export const testPDFExport = async () => {
  console.log('🧪 testPDFExport: Starting PDF test...');
  
  if (Platform.OS !== 'web') {
    Alert.alert('Test Info', 'PDF test only works on web platform.');
    return { success: false, method: 'not-web', message: 'Test only available on web platform.' };
  }
  
  try {
    console.log('🧪 testPDFExport: Attempting to use jsPDF...');

    console.log('🧪 testPDFExport: jsPDF available, creating document...');
    
    const doc = new jsPDF();
    doc.text('Test PDF Export', 20, 20);
    doc.text('This is a test to verify PDF functionality.', 20, 40);
    doc.text(`Generated at: ${new Date().toISOString()}`, 20, 60);
    
    const fileName = `test_pdf_${Date.now()}.pdf`;
    doc.save(fileName);
    
    console.log('🧪 testPDFExport: Test PDF saved successfully as', fileName);
    
    Alert.alert('Test Successful', `Test PDF generated and downloaded as ${fileName}`);
    return { success: true, method: 'pdf', message: 'Test PDF generated successfully!' };
    
  } catch (error) {
    console.error('🧪 testPDFExport ERROR:', error);
    console.error('🧪 testPDFExport ERROR stack:', error.stack);
    
    Alert.alert('Test Failed', `PDF test failed: ${error.message}`);
    return { success: false, method: 'error', message: `PDF test failed: ${error.message}` };
  }
};

// Simple test export function to verify basic functionality
export const testExport = async () => {
  console.log('🧪 testExport: Starting basic export test...');
  try {
    const testContent = 'Test Export Data\nThis is a simple test to verify export functionality.\nDate: ' + new Date().toISOString();
    const testFileName = 'test_export_' + Date.now() + '.txt';
    
    console.log('🧪 testExport: Test content prepared:', { testFileName, contentLength: testContent.length });
    
    // Test clipboard functionality first (most reliable)
    const clipboardSuccess = await copyToClipboard(testContent, 'Test Export');
    
    if (clipboardSuccess) {
      console.log('🧪 testExport: Clipboard test successful');
      return { success: true, method: 'clipboard', message: 'Test export copied to clipboard successfully!' };
    }
    
    // If clipboard fails, try file save
    const fileSuccess = await saveFile(testContent, testFileName, 'text/plain');
    
    if (fileSuccess) {
      console.log('🧪 testExport: File save test successful');
      return { success: true, method: 'file', message: 'Test export saved to file successfully!' };
    }
    
    console.error('🧪 testExport: All export methods failed');
    return { success: false, method: 'none', message: 'All export methods failed during test.' };
    
  } catch (error) {
    console.error('🧪 testExport ERROR:', error);
    console.error('🧪 testExport ERROR stack:', error.stack);
    return { success: false, method: 'error', message: `Test export failed: ${error.message}` };
  }
};
import { supabase, TABLES } from './supabase';
import { tenantHelpers } from './supabase';

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
    console.log('🔄 checkSharingAvailability: Checking if sharing is available...');
    // For web platform, default to false since native sharing is limited
    if (Platform.OS === 'web') {
      console.log('🔄 checkSharingAvailability: Web platform detected, sharing limited');
      return false;
    }
    
    const isAvailable = await Sharing.isAvailableAsync();
    console.log('🔄 checkSharingAvailability: Sharing available:', isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('🔄 checkSharingAvailability ERROR:', error);
    console.error('🔄 checkSharingAvailability ERROR stack:', error.stack);
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

// Local currency formatter to avoid external dependencies in this module
export const formatINRCurrency = (amount) => {
  try {
    const num = Number(amount || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch (e) {
    return `₹${amount ?? 0}`;
  }
};

// Convert data to HTML format for PDF generation
export const convertToHTML = (data, title = 'Report', additionalInfo = null) => {
  if (!data || data.length === 0) {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; }
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
            margin: 10px; 
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
            margin-top: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 10px 12px; 
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
  console.log('📂 saveFile: Starting file save process', { fileName, mimeType });
  try {
    // For web platform, always use the web path (expo-file-system is not supported)
    if (Platform.OS === 'web') {
      console.log('📂 saveFile: Using web-specific export approach');
      return await saveFileWeb(content, fileName, mimeType);
    }

    // Ensure content is a string
    const fileContent = typeof content === 'string' ? content : JSON.stringify(content);
    console.log('📂 saveFile: Content prepared, length:', fileContent.length);

    // Prefer new Expo FS API if available (SDK 54+), otherwise fall back to legacy
    let fileUri = `${FileSystem.documentDirectory || ''}${fileName}`;
    try {
      if (ExpoFile && ExpoPaths && ExpoPaths.document) {
        console.log('📂 saveFile: Using new Expo File API');
        const file = new ExpoFile(ExpoPaths.document, fileName);
        try { file.create(); } catch (e) { /* file may already exist */ }
        file.write(fileContent);
        fileUri = file.uri;
      } else {
        console.log('📂 saveFile: Using legacy FileSystem API');
        const writeOptions = (FileSystem.EncodingType && FileSystem.EncodingType.UTF8)
          ? { encoding: FileSystem.EncodingType.UTF8 }
          : undefined; // default is UTF-8
        await FileSystem.writeAsStringAsync(fileUri, fileContent, writeOptions);
      }
    } catch (writeErr) {
      console.error('📂 saveFile: Write error, attempting clipboard fallback:', writeErr);
      // As a last resort, copy to clipboard to avoid total failure
      try {
        await Clipboard.setStringAsync(fileContent);
        Alert.alert('Copied to Clipboard', `${fileName} content was copied to clipboard as a fallback.`);
        return true;
      } catch (_) {}
      throw writeErr;
    }

    console.log('📂 saveFile: File written successfully at', fileUri);

    // Share first (best UX): lets the user pick Files/Drive/Downloads etc.
    const canShare = await checkSharingAvailability();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Export Report',
        UTI: mimeType,
      });
      return true;
    }

    // If sharing is not available, offer SAF as a fallback on Android
    if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            mimeType || 'text/plain'
          );
          // Write the content directly to the SAF file (no read step needed)
          const dataToWrite = typeof content === 'string' ? content : JSON.stringify(content);
          await FileSystem.writeAsStringAsync(destUri, dataToWrite, writeOptions);
          Alert.alert('Export Successful', `${fileName} saved to selected folder.`);
          return true;
        }
      } catch (safError) {
        console.warn('📂 saveFile: SAF flow failed:', safError?.message);
      }
    }

    Alert.alert('Export Complete', `Report saved as ${fileName} in the app's documents folder.`);
    return true;
  } catch (error) {
    console.error('📂 saveFile ERROR:', error);
    console.error('📂 saveFile ERROR stack:', error.stack);
    console.error('📂 saveFile ERROR message:', error.message);
    Alert.alert(
      'Export Error',
      `Failed to export report: ${error.message || 'Unknown error'}. Please try again.`,
      [{ text: 'OK' }]
    );
    return false;
  }
};

// Web-specific file save function (fallback for web platform)
export const saveFileWeb = async (content, fileName, mimeType = 'text/plain') => {
  console.log('🌐 saveFileWeb: Starting web file save process', { fileName, mimeType });
  try {
    // Try multiple methods for web export
    
    // Method 1: HTML5 download (most compatible)
    if (typeof window !== 'undefined' && window.document) {
      console.log('🌐 saveFileWeb: Attempting HTML5 download...');
      try {
        const result = await downloadFileWeb(content, fileName, mimeType);
        if (result) {
          console.log('🌐 saveFileWeb: HTML5 download successful');
          Alert.alert(
            'Export Successful',
            `${fileName} has been downloaded to your Downloads folder.`,
            [{ text: 'OK' }]
          );
          return true;
        }
      } catch (downloadError) {
        console.warn('🌐 saveFileWeb: HTML5 download failed:', downloadError);
      }
    }
    
    // Method 2: Clipboard as fallback
    console.log('🌐 saveFileWeb: Attempting clipboard fallback...');
    const clipboardSuccess = await copyToClipboard(content, `${fileName} Export`);
    
    if (clipboardSuccess) {
      console.log('🌐 saveFileWeb: Clipboard fallback successful');
      // Don't show another alert since copyToClipboard already shows one
      return true;
    }
  } catch (error) {
    console.error('🌐 saveFileWeb ERROR:', error);
    console.error('🌐 saveFileWeb ERROR stack:', error.stack);
    
    // Final fallback - try showing content in a new window
    try {
      console.log('🌐 saveFileWeb: Attempting to show content in new window...');
      const success = await showContentInNewWindow(content, fileName);
      if (success) {
        Alert.alert(
          'Export Alternative',
          `${fileName} content is displayed in a new window. You can copy and save it from there.`,
          [{ text: 'OK' }]
        );
        return true;
      }
    } catch (windowError) {
      console.error('🌐 saveFileWeb: New window fallback failed:', windowError);
    }
    
    // Show error message for web
    Alert.alert(
      'Export Error',
      `Failed to export: ${error.message || 'Unknown error'}. Please try copying the data manually or use a different browser.`,
      [{ text: 'OK' }]
    );
    return false;
  }
};

// HTML5 download function for web
const downloadFileWeb = async (content, fileName, mimeType) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('📥 downloadFileWeb: Creating download blob...', { fileName, mimeType });
      
      // Create blob with proper MIME type
      const blob = new Blob([content], { type: mimeType });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      
      // Append to document, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log('📥 downloadFileWeb: Download triggered successfully');
      resolve(true);
    } catch (error) {
      console.error('📥 downloadFileWeb ERROR:', error);
      reject(error);
    }
  });
};

// Generate PDF directly for web platform
const generateWebPDF = async (data, additionalInfo, title) => {
  console.log('📁 generateWebPDF: Starting PDF generation...', { title, dataLength: data?.length });
  
  // Check if we're in a web environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('📁 generateWebPDF: Not in web environment');
    throw new Error('PDF generation only available in web environment');
  }
  
  try {
    console.log('📁 generateWebPDF: Attempting to load jsPDF...');
    
    // Try different import approaches
    let jsPDF, autoTable;
    
    try {
      // Use statically imported modules
      console.log('📁 generateWebPDF: Using jsPDF, type:', typeof jsPDF);
      console.log('📁 generateWebPDF: Using autoTable, type:', typeof autoTable);
    } catch (importError) {
      console.error('📁 generateWebPDF: Import failed:', importError);
      
      // Method 2: Check if globally available
      if (typeof window.jsPDF !== 'undefined') {
        jsPDF = window.jsPDF;
        console.log('📁 generateWebPDF: Using global jsPDF');
      } else {
        throw new Error('jsPDF not available via import or global scope');
      }
    }
    
    if (!jsPDF) {
      throw new Error('jsPDF constructor not found');
    }
    
    console.log('📁 generateWebPDF: Creating PDF document...');
    
    // Create new PDF document
    const doc = new jsPDF();
    
    console.log('📁 generateWebPDF: PDF document created successfully');
    
    // Add title (tighter left margin)
    doc.setFontSize(20);
    doc.text(title, 8, 18);
    
    // Add generation date
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 8, 30);
    
    let yPosition = 50;
    
    // Add summary information if provided
    if (additionalInfo) {
      doc.setFontSize(14);
      doc.text('Summary', 8, yPosition);
      yPosition += 8;
      
      doc.setFontSize(10);
      
      Object.entries(additionalInfo).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 8, yPosition);
        yPosition += 6;
      });
      
      yPosition += 8;
    }
    
    // Add data as simple text if autoTable is not available
    if (data && data.length > 0) {
      console.log('📁 generateWebPDF: Adding data table...');
      
      if (typeof doc.autoTable === 'function') {
        // Use autoTable if available
        const headers = Object.keys(data[0]);
        const tableData = data.map(row => Object.values(row));
        
        doc.autoTable({
          head: [headers],
          body: tableData,
          startY: yPosition,
          margin: { left: 6, right: 6, top: 6 },
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [33, 150, 243],
            textColor: 255,
          },
          alternateRowStyles: {
            fillColor: [248, 249, 250],
          },
        });
      } else {
        // Fallback to manual table creation
        console.log('📁 generateWebPDF: autoTable not available, using manual table creation');
        
        doc.setFontSize(12);
        doc.text(`${title} Data`, 8, yPosition);
        yPosition += 12;
        
        doc.setFontSize(8);
        
        // Add headers
        const headers = Object.keys(data[0]);
        let xPosition = 8;
        headers.forEach((header, index) => {
          doc.text(header, xPosition, yPosition);
          xPosition += 30; // Adjust spacing
        });
        yPosition += 10;
        
        // Add data rows
        data.slice(0, 20).forEach((row, rowIndex) => { // Limit to 20 rows to avoid page overflow
          xPosition = 8;
          Object.values(row).forEach((value, colIndex) => {
            doc.text(String(value || ''), xPosition, yPosition);
            xPosition += 30;
          });
          yPosition += 8;
          
          // Add new page if needed
          if (yPosition > 280) {
            doc.addPage();
            yPosition = 20;
          }
        });
        
        if (data.length > 20) {
          doc.text(`... and ${data.length - 20} more records`, 20, yPosition + 10);
        }
      }
    }
    
    // Generate filename based on title
    const reportType = title.toLowerCase().replace(/\s+/g, '_');
    const fileName = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    console.log('📁 generateWebPDF: Saving PDF as', fileName);
    
    // Save the PDF
    doc.save(fileName);
    
    console.log('📁 generateWebPDF: PDF saved successfully!');
    
    // Show success message
    Alert.alert(
      'Export Successful',
      `${title} has been downloaded as ${fileName}. Check your Downloads folder.`,
      [{ text: 'OK' }]
    );
    
    return true;
  } catch (error) {
    console.error('📁 generateWebPDF ERROR:', error);
    console.error('📁 generateWebPDF ERROR message:', error.message);
    console.error('📁 generateWebPDF ERROR stack:', error.stack);
    
    // More specific error handling
    if (error.message?.includes('import') || error.message?.includes('module')) {
      console.error('📁 generateWebPDF: Module import failed - jsPDF libraries may not be available');
    }
    
    throw error;
  }
};

// Show content in new window (final fallback)
const showContentInNewWindow = async (content, fileName) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🪟 showContentInNewWindow: Opening content in new window...', { fileName });
      
      const newWindow = window.open('', '_blank');
      if (!newWindow) {
        throw new Error('Popup blocked or failed to open');
      }
      
      // Create HTML content for the new window
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
            .header { background: #f0f0f0; padding: 10px; margin-bottom: 20px; border-radius: 5px; }
            .content { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${fileName}</h2>
            <p>Select all content below and copy it to save the data.</p>
          </div>
          <div class="content">${content}</div>
        </body>
        </html>
      `;
      
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      
      console.log('🪟 showContentInNewWindow: Content displayed in new window');
      resolve(true);
    } catch (error) {
      console.error('🪟 showContentInNewWindow ERROR:', error);
      reject(error);
    }
  });
};

// Copy data to clipboard (useful for development and quick sharing)
export const copyToClipboard = async (content, title = 'Report Data') => {
  console.log('📋 copyToClipboard: Starting clipboard copy process', { title, contentLength: content?.length });
  try {
    if (content == null) {
      console.error('📋 copyToClipboard: No content provided to copy');
      throw new Error('No content provided to copy');
    }

    const text = typeof content === 'string' ? content : String(content);
    console.log('📋 copyToClipboard: Platform detected:', Platform.OS);

    // Web: try navigator.clipboard first only when allowed/available
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const secure = (window.isSecureContext === true) || (window.location && window.location.hostname === 'localhost');
      if (secure && window.navigator?.clipboard?.writeText) {
        console.log('📋 copyToClipboard: Using web navigator.clipboard.writeText');
        try {
          await window.navigator.clipboard.writeText(text);
          try { Alert.alert('Copied to Clipboard', `${title} has been copied to your clipboard.`, [{ text: 'OK' }]); } catch (_) {}
          return true;
        } catch (webClipboardError) {
          console.warn('📋 copyToClipboard: navigator.clipboard failed -> falling back', webClipboardError?.message || webClipboardError);
        }
      }

      // Web fallback: hidden textarea
      if (typeof document !== 'undefined') {
        try {
          console.log('📋 copyToClipboard: Trying textarea fallback...');
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (ok) {
            try { Alert.alert('Copied to Clipboard', `${title} has been copied to your clipboard.`, [{ text: 'OK' }]); } catch (_) {}
            return true;
          }
        } catch (taErr) {
          console.warn('📋 copyToClipboard: Textarea fallback failed', taErr?.message || taErr);
        }
      }
    }

    // Native/mobile or web fallback: expo-clipboard
    if (Clipboard?.setStringAsync) {
      console.log('📋 copyToClipboard: Using expo-clipboard');
      await Clipboard.setStringAsync(text);
      try { Alert.alert('Copied to Clipboard', `${title} has been copied to your clipboard.`, [{ text: 'OK' }]); } catch (_) {}
      return true;
    }

    throw new Error('No clipboard method available');
  } catch (error) {
    console.error('📋 copyToClipboard ERROR:', error);
    console.error('📋 copyToClipboard ERROR stack:', error.stack);
    try {
      Alert.alert('Copy Error', `Failed to copy data to clipboard: ${error.message || 'Unknown error'}.`);
    } catch (_) {}
    return false;
  }
};

// Export individual attendance record
export const exportIndividualAttendanceRecord = async (recordData, format = EXPORT_FORMATS.CSV) => {
  console.log('📝 exportIndividualAttendanceRecord: Starting export process', { format, recordId: recordData?.id });
  try {
    // Validate input data
    if (!recordData) {
      console.error('📝 exportIndividualAttendanceRecord: No record data provided');
      throw new Error('No attendance record provided for export');
    }
    
    console.log('📝 exportIndividualAttendanceRecord: Record data validation passed, proceeding with format:', format);
    
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';
    
    // Get current date for the export
    const exportDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Get teacher name from marked_by ID if available with better error handling
    let markedByTeacher = 'System';
    if (recordData.marked_by) {
      try {
        // Add tenant context for the query
        const tenantId = await tenantHelpers.getCurrentTenantId();
        let query = supabase
          .from(TABLES.TEACHERS)
          .select('name');
        
        // Add tenant filtering if tenantId exists
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
        
        const { data: teacherData, error: teacherError } = await query
          .eq('id', recordData.marked_by)
          .single();
        
        if (teacherError) {
          console.log('Teacher fetch error:', teacherError);
        } else if (teacherData) {
          markedByTeacher = teacherData.name || 'Unknown Teacher';
        }
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

        content = "INDIVIDUAL ATTENDANCE RECORD\nExported on: " + exportDate + "\n\nRECORD DETAILS\n" + 
                 convertToCSV(metadata) + "\n\nATTENDANCE DATA\n" + convertToCSV(csvData);
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
          // For web platform, use direct PDF generation
          if (Platform.OS === 'web') {
            console.log('📝 exportIndividualAttendanceRecord: Using web PDF generation...');
            
            try {
              const success = await generateWebPDF(pdfData, additionalInfo, 'Individual Attendance Record');
              
              if (success) {
                console.log('📝 exportIndividualAttendanceRecord: Web PDF generation completed');
                return true;
              } else {
                throw new Error('PDF generation failed');
              }
            } catch (webError) {
              console.error('📝 exportIndividualAttendanceRecord: Web PDF failed:', webError);
              Alert.alert('PDF Error', `Failed to generate PDF: ${webError.message || 'Unknown error'}. Please try another format.`);
              return false;
            }
          } else {
            // Native mobile PDF generation
          const { uri } = await Print.printToFileAsync({ 
            html: htmlContent,
            base64: false
          });
          
          // Create a new filename with .pdf extension
          fileName = generateFileName(`attendance_${recordData.classes?.class_name}_${recordData.date}`, 'pdf');
          
          // Share or notify without moving the file (Expo SDK 54+ deprecates moveAsync)
          return await sharePDF(uri, fileName);
          }
        } catch (error) {
          console.error('📝 exportIndividualAttendanceRecord: Error generating PDF:', error);
          Alert.alert('PDF Error', `Failed to generate PDF: ${error.message || 'Unknown error'}. Please try another format.`);
          return false;
        }

      case EXPORT_FORMATS.CLIPBOARD:
        console.log('📋 exportIndividualAttendanceRecord: Processing clipboard export...');
        const clipboardData = [{
          'Student Name': recordData.students?.name || 'N/A',
          'Admission No': recordData.students?.admission_no || 'N/A',
          'Class': `${recordData.classes?.class_name || ''} ${recordData.classes?.section || ''}`.trim(),
          'Date': recordData.date,
          'Status': recordData.status,
          'Marked By': markedByTeacher
        }];
        
        // Format content nicely for clipboard
        const clipboardContent = `INDIVIDUAL ATTENDANCE RECORD\nExported on: ${exportDate}\n\nSTUDENT DETAILS:\n${convertToCSV(clipboardData)}`;
        console.log('📋 exportIndividualAttendanceRecord: Clipboard content prepared, length:', clipboardContent.length);
        return await copyToClipboard(clipboardContent, 'Individual Attendance Record');

      default:
        throw new Error('Unsupported export format');
    }

    console.log('📝 exportIndividualAttendanceRecord: Content prepared, saving file...', { fileName, contentLength: content.length });
    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('📝 exportIndividualAttendanceRecord ERROR:', error);
    console.error('📝 exportIndividualAttendanceRecord ERROR stack:', error.stack);
    
    // Enhanced error messages
    let userMessage = 'Failed to export attendance record.';
    
    if (error.message?.includes('No attendance record')) {
      userMessage = 'No attendance record data available for export.';
    } else if (error.message?.includes('FileSystem')) {
      userMessage = 'File system error. Please check app permissions and try again.';
    } else if (error.message?.includes('sharing')) {
      userMessage = 'Sharing not available. Please try copying to clipboard instead.';
    } else if (error.message?.includes('Permission')) {
      userMessage = 'Permission denied. Please check app permissions in device settings.';
    }
    
    Alert.alert('Export Error', `${userMessage}\n\nTechnical details: ${error.message || 'Unknown error'}`);
    return false;
  }
};

// Export attendance data
export const exportAttendanceData = async (data, stats, format = EXPORT_FORMATS.CSV) => {
  console.log('📄 exportAttendanceData: Starting export process', { format, dataLength: data?.length });
  try {
    // Validate input data
    if (!data || !Array.isArray(data)) {
      console.error('📄 exportAttendanceData: Invalid data provided');
      throw new Error('No attendance data provided for export');
    }
    
    if (data.length === 0) {
      console.warn('📄 exportAttendanceData: Empty data array provided');
      Alert.alert('No Data', 'No attendance records available for export.');
      return false;
    }
    
    console.log('📄 exportAttendanceData: Data validation passed, proceeding with format:', format);
    
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
              // Add tenant context for the query
              const tenantId = await tenantHelpers.getCurrentTenantId();
              let query = supabase
                .from(TABLES.TEACHERS)
                .select('name');
              
              // Add tenant filtering if tenantId exists
              if (tenantId) {
                query = query.eq('tenant_id', tenantId);
              }
              
              const { data: teacherData, error: teacherError } = await query
                .eq('id', record.marked_by)
                .single();
              
              if (teacherError) {
                console.log('Teacher fetch error for record:', record.id, teacherError);
              } else if (teacherData) {
                markedByTeacher = teacherData.name || 'Unknown Teacher';
              }
            } catch (error) {
              console.log('Could not fetch teacher name for record:', record.id, error);
            }
          }
          
          return {
            'Student Name': record.students?.name || 'N/A',
            'Admission No': record.students?.admission_no || 'N/A',
            'Class': `${record.classes?.class_name || ''} ${record.classes?.section || ''}`.trim(),
            'Date': record.date,
            'Status': record.status,
            'Marked By': markedByTeacher,
            'Marked At': record.marked_at || 'N/A'
          };
        }));

        // Add summary statistics with export date
        const summaryData = [
          { 'Metric': 'Export Date', 'Value': exportDate },
          { 'Metric': 'Total Present Today', 'Value': stats.presentToday || 0 },
          { 'Metric': 'Total Absent Today', 'Value': stats.absentToday || 0 },
          { 'Metric': 'Attendance Rate', 'Value': `${stats.attendanceRate || 0}%` },
          { 'Metric': 'Total Students', 'Value': stats.totalStudents || data.length }
        ];

        content = "ATTENDANCE SUMMARY\nGenerated on: " + exportDate + "\n\n" + convertToCSV(summaryData) + "\n\nATTENDANCE RECORDS\n" + convertToCSV(csvData);
        fileName = generateFileName('attendance_report', 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.PDF:
        console.log('📄 exportAttendanceData: Processing PDF export...');
        
        // Get current date for the export
        const pdfExportDate = new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        // Prepare attendance data for PDF (similar to CSV but for PDF)
        const pdfData = await Promise.all(data.map(async (record) => {
          let markedByTeacher = 'System';
          if (record.marked_by) {
            try {
              // Add tenant context for the query
              const tenantId = await tenantHelpers.getCurrentTenantId();
              let query = supabase
                .from(TABLES.TEACHERS)
                .select('name');
              
              // Add tenant filtering if tenantId exists
              if (tenantId) {
                query = query.eq('tenant_id', tenantId);
              }
              
              const { data: teacherData, error: teacherError } = await query
                .eq('id', record.marked_by)
                .single();
              
              if (teacherError) {
                console.log('Teacher fetch error for PDF record:', record.id, teacherError);
              } else if (teacherData) {
                markedByTeacher = teacherData.name || 'Unknown Teacher';
              }
            } catch (error) {
              console.log('Could not fetch teacher name for PDF record:', record.id, error);
            }
          }
          
          return {
            'Student Name': record.students?.name || 'N/A',
            'Admission No': record.students?.admission_no || 'N/A',
            'Class': `${record.classes?.class_name || ''} ${record.classes?.section || ''}`.trim(),
            'Date': record.date,
            'Status': record.status,
            'Marked By': markedByTeacher,
            'Marked At': record.marked_at || 'N/A'
          };
        }));

        // Prepare additional info for PDF
        const pdfAdditionalInfo = {
          'Export Date': pdfExportDate,
          'Total Present Today': stats.presentToday || 0,
          'Total Absent Today': stats.absentToday || 0,
          'Attendance Rate': `${stats.attendanceRate || 0}%`,
          'Total Students': stats.totalStudents || data.length
        };

        const htmlContent = convertToHTML(
          pdfData, 
          'Attendance Report', 
          pdfAdditionalInfo
        );

        try {
          console.log('📄 exportAttendanceData: Generating PDF...');
          
          // For web platform, use direct PDF generation
          if (Platform.OS === 'web') {
            console.log('📄 exportAttendanceData: Using web PDF generation...');
            console.log('📄 exportAttendanceData: PDF data prepared:', { 
              dataLength: pdfData.length, 
              additionalInfoKeys: Object.keys(pdfAdditionalInfo),
              sampleData: pdfData.slice(0, 2)
            });
            
            try {
              console.log('📄 exportAttendanceData: Calling generateWebPDF...');
              
              // Generate PDF directly using browser APIs
              const success = await generateWebPDF(pdfData, pdfAdditionalInfo, 'Attendance Report');
              
              console.log('📄 exportAttendanceData: generateWebPDF returned:', success);
              
              if (success) {
                console.log('📄 exportAttendanceData: Web PDF generation completed successfully');
                return true;
              } else {
                console.error('📄 exportAttendanceData: generateWebPDF returned false');
                throw new Error('PDF generation returned false');
              }
            } catch (webError) {
              console.error('📄 exportAttendanceData: Web PDF failed, error details:');
              console.error('  - Error name:', webError.name);
              console.error('  - Error message:', webError.message);
              console.error('  - Error stack:', webError.stack);
              console.log('📄 exportAttendanceData: Trying HTML fallback...');
              
              // Fallback to HTML download if PDF generation fails
              try {
                const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
                const url = window.URL.createObjectURL(htmlBlob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `attendance_report_${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                }, 100);
                
                Alert.alert(
                  'Export as HTML',
                  'Could not generate PDF directly. Downloaded as HTML file instead. Open it in your browser and use Print > Save as PDF to convert it.',
                  [{ text: 'OK' }]
                );
                
                return true;
              } catch (htmlError) {
                console.error('📄 exportAttendanceData: HTML fallback also failed:', htmlError);
                throw htmlError;
              }
            }
          } else {
            // Native mobile PDF generation
          const { uri } = await Print.printToFileAsync({ 
            html: htmlContent,
            base64: false
          });
          
          // Create a new filename with .pdf extension
          fileName = generateFileName('attendance_report', 'pdf');
          
          // Share or notify without moving the file (Expo SDK 54+ deprecates moveAsync)
          return await sharePDF(uri, fileName);
          }
        } catch (error) {
          console.error('📄 exportAttendanceData: PDF generation error:', error);
          Alert.alert('PDF Error', `Failed to generate PDF: ${error.message || 'Unknown error'}. Please try another format.`);
          return false;
        }

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
        console.log('📋 exportAttendanceData: Processing clipboard export...');
        
        // Get current date for the export
        const clipboardExportDate = new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        const clipboardData = await Promise.all(data.map(async (record) => {
          let markedByTeacher = 'System';
          if (record.marked_by) {
            try {
              // Add tenant context for the query
              const tenantId = await tenantHelpers.getCurrentTenantId();
              let query = supabase
                .from(TABLES.TEACHERS)
                .select('name');
              
              // Add tenant filtering if tenantId exists
              if (tenantId) {
                query = query.eq('tenant_id', tenantId);
              }
              
              const { data: teacherData, error: teacherError } = await query
                .eq('id', record.marked_by)
                .single();
              
              if (!teacherError && teacherData) {
                markedByTeacher = teacherData.name || 'Unknown Teacher';
              }
            } catch (error) {
              console.log('Could not fetch teacher name for clipboard:', error);
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
        
        // Add summary information at the top
        const summaryText = `ATTENDANCE REPORT\nExported on: ${clipboardExportDate}\n\nSUMMARY:\nPresent Today: ${stats.presentToday || 0}\nAbsent Today: ${stats.absentToday || 0}\nAttendance Rate: ${stats.attendanceRate || 0}%\nTotal Students: ${stats.totalStudents || data.length}\n\nDETAILS:\n`;
        
        content = summaryText + convertToCSV(clipboardData);
        console.log('📋 exportAttendanceData: Clipboard content prepared, length:', content.length);
        return await copyToClipboard(content, 'Attendance Report');

      default:
        throw new Error('Unsupported export format');
    }

    console.log('📄 exportAttendanceData: Content prepared, saving file...', { fileName, contentLength: content.length });
    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('📄 exportAttendanceData ERROR:', error);
    console.error('📄 exportAttendanceData ERROR stack:', error.stack);
    
    // Enhanced error messages
    let userMessage = 'Failed to export attendance report.';
    
    if (error.message?.includes('No attendance data')) {
      userMessage = 'No attendance data available for export. Please ensure attendance records exist.';
    } else if (error.message?.includes('FileSystem')) {
      userMessage = 'File system error. Please check app permissions and try again.';
    } else if (error.message?.includes('sharing')) {
      userMessage = 'Sharing not available. Please try copying to clipboard instead.';
    } else if (error.message?.includes('Permission')) {
      userMessage = 'Permission denied. Please check app permissions in device settings.';
    }
    
    Alert.alert('Export Error', `${userMessage}\n\nTechnical details: ${error.message || 'Unknown error'}`);
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
          { 'Metric': 'Total Collected', 'Value': formatINRCurrency(stats.totalCollected || 0) },
          { 'Metric': 'Total Outstanding', 'Value': formatINRCurrency(stats.totalOutstanding || 0) },
          { 'Metric': 'Total Expected', 'Value': formatINRCurrency(stats.totalExpected || 0) },
          { 'Metric': 'Collection Rate', 'Value': `${stats.collectionRate || 0}%` }
        ];

        content = "FEE COLLECTION SUMMARY\n" + convertToCSV(summaryData) + "\n\nFEE RECORDS\n" + convertToCSV(csvData);
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

      case EXPORT_FORMATS.PDF:
        // Prepare data for PDF
        const pdfData = data.map(record => ({
          'Student Name': record.students?.name || 'N/A',
          'Admission No': record.students?.admission_no || 'N/A',
          'Class': `${record.students?.classes?.class_name || ''} ${record.students?.classes?.section || ''}`.trim(),
          'Fee Component': record.fee_component,
          'Amount Paid': record.amount_paid,
          'Payment Date': record.payment_date,
          'Payment Mode': record.payment_mode,
          'Receipt No': record.receipt_no || 'N/A',
        }));

        const pdfAdditionalInfo = {
          'Total Collected': formatINRCurrency(stats.totalCollected || 0),
          'Total Outstanding': formatINRCurrency(stats.totalOutstanding || 0),
          'Total Expected': formatINRCurrency(stats.totalExpected || 0),
          'Collection Rate': `${stats.collectionRate || 0}%`,
          'Records': data?.length || 0,
        };

        // Build HTML once for both branches (also used as fallback on web)
        const htmlContent = convertToHTML(pdfData, 'Fee Collection Report', pdfAdditionalInfo);
        if (Platform.OS === 'web') {
          // Web PDF: try jsPDF first, then graceful HTML fallback
          try {
            const success = await generateWebPDF(pdfData, pdfAdditionalInfo, 'Fee Collection Report');
            return !!success;
          } catch (webError) {
            console.error('📄 exportFeeData: Web PDF failed, falling back to HTML download:', webError?.message || webError);
            try {
              const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
              const url = window.URL.createObjectURL(htmlBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `fee_collection_${new Date().toISOString().split('T')[0]}.html`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => window.URL.revokeObjectURL(url), 100);
              Alert.alert('Export as HTML', 'Could not generate PDF directly. Downloaded as HTML instead. Open it and use Print > Save as PDF to convert.', [{ text: 'OK' }]);
              return true;
            } catch (htmlErr) {
              console.error('📄 exportFeeData: HTML fallback also failed:', htmlErr);
              throw webError;
            }
          }
        } else {
          // Native: generate PDF via HTML -> printToFile
          const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
          fileName = generateFileName('fee_collection', 'pdf');
          
          // Share or notify without moving the file (Expo SDK 54+ deprecates moveAsync)
          return await sharePDF(uri, fileName);
        }
        

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

// Export per-student fee summary (for Excel/CSV)
// rows should be an array of objects with keys:
// {
//   studentName, admissionNo, className, academicYear,
//   totalFee, feeConcession, amountPaid, outstandingFee
// }
export const exportStudentFeeSummary = async (
  rows,
  fileBaseName = 'student_fee_summary',
  format = EXPORT_FORMATS.CSV
) => {
  try {
    if (!rows || rows.length === 0) {
      Alert.alert('No Data', 'No fee summary data available to export.');
      return false;
    }

    switch (format) {
      case EXPORT_FORMATS.CSV: {
        const csvRows = rows.map(r => ({
          'Student Name': r.studentName || 'N/A',
          'Admission No': r.admissionNo || 'N/A',
          'Class': r.className || 'N/A',
          'Academic Year': r.academicYear || 'N/A',
          'Total Fee': r.totalFee ?? 0,
          'Fee Concession': r.feeConcession ?? 0,
          'Amount Paid': r.amountPaid ?? 0,
          'Outstanding Fee': r.outstandingFee ?? 0,
        }));
        const content = convertToCSV(csvRows);
        const fileName = generateFileName(fileBaseName, 'csv');
        const mimeType = 'text/csv';
        return await saveFile(content, fileName, mimeType);
      }
      case EXPORT_FORMATS.CLIPBOARD: {
        const csvRows = rows.map(r => ({
          'Student Name': r.studentName || 'N/A',
          'Admission No': r.admissionNo || 'N/A',
          'Class': r.className || 'N/A',
          'Academic Year': r.academicYear || 'N/A',
          'Total Fee': r.totalFee ?? 0,
          'Fee Concession': r.feeConcession ?? 0,
          'Amount Paid': r.amountPaid ?? 0,
          'Outstanding Fee': r.outstandingFee ?? 0,
        }));
        const content = convertToCSV(csvRows);
        return await copyToClipboard(content, 'Student Fee Summary');
      }
      default: {
        // For now, support CSV/Clipboard which are Excel-friendly
        Alert.alert('Format Not Supported', 'Only CSV export is supported for fee summaries at the moment.');
        return false;
      }
    }
  } catch (error) {
    console.error('Error exporting student fee summary:', error);
    Alert.alert('Export Error', 'Failed to export student fee summary.');
    return false;
  }
};

// Advanced/raw export: use rows as-is and include all keys as columns
export const exportStudentFeeSummaryAdvanced = async (
  rows,
  fileBaseName = 'student_fee_summary_full',
  format = EXPORT_FORMATS.CSV
) => {
  try {
    if (!rows || rows.length === 0) {
      Alert.alert('No Data', 'No fee summary data available to export.');
      return false;
    }

    switch (format) {
      case EXPORT_FORMATS.CSV: {
        const content = convertToCSV(rows);
        const fileName = generateFileName(fileBaseName, 'csv');
        return await saveFile(content, fileName, 'text/csv');
      }
      case EXPORT_FORMATS.CLIPBOARD: {
        const content = convertToCSV(rows);
        return await copyToClipboard(content, 'Student Fee Summary (Full)');
      }
      default:
        Alert.alert('Format Not Supported', 'Only CSV export is supported for fee summaries at the moment.');
        return false;
    }
  } catch (error) {
    console.error('Error exporting student fee summary (advanced):', error);
    Alert.alert('Export Error', 'Failed to export student fee summary.');
    return false;
  }
};

// Excel export with one worksheet per class
export const exportStudentFeeSummaryExcelMultiSheet = async (
  rows,
  fileBaseName = 'student_fee_summary_multi'
) => {
  try {
    if (!rows || rows.length === 0) {
      Alert.alert('No Data', 'No fee summary data available to export.');
      return false;
    }

    // Group rows by Class column
    const byClass = new Map();
    for (const r of rows) {
      const cls = (r['Class'] || 'Unknown Class').toString();
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls).push(r);
    }

    // Try to generate a real Excel workbook on web using SheetJS
    try {
      const isWeb = Platform.OS === 'web';

      const wb = XLSX.utils.book_new();

      for (const [cls, classRows] of byClass.entries()) {
        // Convert to worksheet, ensure header ordering is stable
        const headers = Object.keys(classRows[0]);
        const ws = XLSX.utils.json_to_sheet(classRows, { header: headers });
        // Sheet name constraints: max 31 chars, no []:*?/\\
        const safeName = cls.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
        XLSX.utils.book_append_sheet(wb, ws, safeName);
      }

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = generateFileName(fileBaseName, 'xlsx');

      if (isWeb) {
        // Use web saver
        return await saveFileWeb(wbout, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        // Native: fallback to CSV bundle if binary save not supported reliably
        // Build a multi-section CSV
        let combined = '';
        for (const [cls, classRows] of byClass.entries()) {
          combined += `Class: ${cls}\n`;
          combined += convertToCSV(classRows);
          combined += `\n\n`;
        }
        const csvName = generateFileName(fileBaseName + '_by_class', 'csv');
        return await saveFile(combined, csvName, 'text/csv');
      }
    } catch (xlsxError) {
      console.warn('Excel generation not available, falling back to CSV:', xlsxError?.message);
      // Fallback: create a single CSV with grouped sections
      let combined = '';
      for (const [cls, classRows] of byClass.entries()) {
        combined += `Class: ${cls}\n`;
        combined += convertToCSV(classRows);
        combined += `\n\n`;
      }
      const fileName = generateFileName(fileBaseName + '_by_class', 'csv');
      return await saveFile(combined, fileName, 'text/csv');
    }
  } catch (error) {
    console.error('Error exporting Excel multi-sheet:', error);
    Alert.alert('Export Error', 'Failed to export Excel file.');
    return false;
  }
};

// Export rows as a PDF table
export const exportTableDataPDF = async (rows, title = 'Report', additionalInfo = null) => {
  try {
    const html = convertToHTML(rows, title, additionalInfo);

    // Web: use jsPDF via generateWebPDF if possible, otherwise fall back to HTML download
    if (Platform.OS === 'web') {
      try {
        const ok = await generateWebPDF(rows, additionalInfo, title);
        if (ok) return true;
      } catch (e) {
        console.warn('exportTableDataPDF: web PDF failed, falling back to HTML:', e?.message);
        const fileName = generateFileName(title.toLowerCase().replace(/\s+/g, '_'), 'html');
        return await saveFileWeb(html, fileName, 'text/html');
      }
      return false;
    }

    // Native: print to file and share
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const fileName = generateFileName(title.toLowerCase().replace(/\s+/g, '_'), 'pdf');
    // Share directly from the generated URI; avoid deprecated moveAsync
    const canShare = await checkSharingAvailability();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${title} (${fileName})`,
        UTI: 'com.adobe.pdf',
      });
      return true;
    }
    Alert.alert('Export Complete', `Report generated successfully as ${fileName}`);
    return true;
  } catch (error) {
    console.error('exportTableDataPDF ERROR:', error);
    Alert.alert('Export Error', 'Failed to generate PDF.');
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

        content = "STUDENT OVERVIEW SUMMARY\n" + convertToCSV(summaryData) + "\n\nSTUDENT RECORDS\n" + convertToCSV(csvData);
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

// Export top performers data
export const exportTopPerformers = async (topPerformers, stats, format = EXPORT_FORMATS.CSV) => {
  console.log('🏆 exportTopPerformers: Starting export process', { format, performersCount: topPerformers?.length });
  try {
    // Validate input data
    if (!topPerformers || !Array.isArray(topPerformers)) {
      console.error('🏆 exportTopPerformers: Invalid top performers data provided');
      throw new Error('No top performers data provided for export');
    }
    
    if (topPerformers.length === 0) {
      console.warn('🏆 exportTopPerformers: Empty top performers array provided');
      Alert.alert('No Data', 'No top performers data available for export.');
      return false;
    }
    
    console.log('🏆 exportTopPerformers: Data validation passed, proceeding with format:', format);
    
    let content = '';
    let fileName = '';
    let mimeType = 'text/plain';
    
    // Get current date for the export
    const exportDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    switch (format) {
      case EXPORT_FORMATS.CSV:
        // Prepare top performers data for CSV
        const csvData = topPerformers.map((performer, index) => ({
          'Rank': index + 1,
          'Student Name': performer.name || 'N/A',
          'Admission No': performer.admissionNo || 'N/A',
          'Percentage': `${performer.percentage}%`,
          'Subjects Count': performer.count || 0,
          'Total Marks': performer.totalMarks || 0,
          'Max Marks': performer.totalMaxMarks || 0,
          'Performance Grade': getGrade(performer.percentage)
        }));

        // Add summary statistics
        const summaryData = [
          { 'Metric': 'Export Date', 'Value': exportDate },
          { 'Metric': 'Total Top Performers', 'Value': topPerformers.length },
          { 'Metric': 'Highest Percentage', 'Value': `${topPerformers[0]?.percentage || 0}%` },
          { 'Metric': 'Average Performance (Top 10)', 'Value': `${Math.round(topPerformers.slice(0, 10).reduce((sum, p) => sum + p.percentage, 0) / Math.min(10, topPerformers.length))}%` },
          { 'Metric': 'School Average', 'Value': `${stats.averagePercentage || 0}%` }
        ];

        content = "TOP PERFORMERS REPORT\nGenerated on: " + exportDate + "\n\nSUMMARY\n" + convertToCSV(summaryData) + "\n\nTOP PERFORMERS\n" + convertToCSV(csvData);
        fileName = generateFileName('top_performers', 'csv');
        mimeType = 'text/csv';
        break;

      case EXPORT_FORMATS.PDF:
        console.log('🏆 exportTopPerformers: Processing PDF export...');
        
        // Prepare top performers data for PDF
        const pdfData = topPerformers.map((performer, index) => ({
          'Rank': index + 1,
          'Student Name': performer.name || 'N/A',
          'Admission No': performer.admissionNo || 'N/A',
          'Percentage': `${performer.percentage}%`,
          'Subjects': performer.count || 0,
          'Grade': getGrade(performer.percentage)
        }));

        // Prepare additional info for PDF
        const pdfAdditionalInfo = {
          'Export Date': exportDate,
          'Total Top Performers': topPerformers.length,
          'Highest Score': `${topPerformers[0]?.percentage || 0}%`,
          'Top 10 Average': `${Math.round(topPerformers.slice(0, 10).reduce((sum, p) => sum + p.percentage, 0) / Math.min(10, topPerformers.length))}%`,
          'School Average': `${stats.averagePercentage || 0}%`
        };

        const htmlContent = convertToHTML(
          pdfData, 
          'Top Performers Report', 
          pdfAdditionalInfo
        );

        try {
          console.log('🏆 exportTopPerformers: Generating PDF...');
          
          // For web platform, use direct PDF generation
          if (Platform.OS === 'web') {
            console.log('🏆 exportTopPerformers: Using web PDF generation...');
            
            try {
              const success = await generateWebPDF(pdfData, pdfAdditionalInfo, 'Top Performers Report');
              
              if (success) {
                console.log('🏆 exportTopPerformers: Web PDF generation completed successfully');
                return true;
              } else {
                throw new Error('PDF generation returned false');
              }
            } catch (webError) {
              console.error('🏆 exportTopPerformers: Web PDF failed:', webError);
              // Fallback to HTML download
              try {
                const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
                const url = window.URL.createObjectURL(htmlBlob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `top_performers_${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                }, 100);
                
                Alert.alert(
                  'Export as HTML',
                  'Could not generate PDF directly. Downloaded as HTML file instead. Open it in your browser and use Print > Save as PDF to convert it.',
                  [{ text: 'OK' }]
                );
                
                return true;
              } catch (htmlError) {
                console.error('🏆 exportTopPerformers: HTML fallback failed:', htmlError);
                throw htmlError;
              }
            }
          } else {
            // Native mobile PDF generation
          const { uri } = await Print.printToFileAsync({ 
            html: htmlContent,
            base64: false
          });
          
          // Create filename and share without moving (Expo SDK 54+ deprecates moveAsync)
          fileName = generateFileName('top_performers', 'pdf');
          return await sharePDF(uri, fileName);
          }
        } catch (error) {
          console.error('🏆 exportTopPerformers: PDF generation error:', error);
          Alert.alert('PDF Error', `Failed to generate PDF: ${error.message || 'Unknown error'}. Please try another format.`);
          return false;
        }
        break;

      case EXPORT_FORMATS.JSON:
        content = convertToJSON({
          summary: {
            exportDate,
            totalPerformers: topPerformers.length,
            schoolAverage: stats.averagePercentage,
            highestScore: topPerformers[0]?.percentage || 0
          },
          topPerformers,
          exportedAt: new Date().toISOString()
        });
        fileName = generateFileName('top_performers', 'json');
        mimeType = 'application/json';
        break;

      case EXPORT_FORMATS.CLIPBOARD:
        console.log('📋 exportTopPerformers: Processing clipboard export...');
        
        const clipboardData = topPerformers.map((performer, index) => ({
          'Rank': index + 1,
          'Student Name': performer.name || 'N/A',
          'Admission No': performer.admissionNo || 'N/A',
          'Percentage': `${performer.percentage}%`,
          'Subjects': performer.count || 0,
          'Grade': getGrade(performer.percentage)
        }));
        
        // Add summary information at the top
        const summaryText = `TOP PERFORMERS REPORT\nGenerated on: ${exportDate}\n\nSUMMARY:\nTotal Top Performers: ${topPerformers.length}\nHighest Score: ${topPerformers[0]?.percentage || 0}%\nTop 10 Average: ${Math.round(topPerformers.slice(0, 10).reduce((sum, p) => sum + p.percentage, 0) / Math.min(10, topPerformers.length))}%\nSchool Average: ${stats.averagePercentage || 0}%\n\nTOP PERFORMERS:\n`;
        
        content = summaryText + convertToCSV(clipboardData);
        console.log('📋 exportTopPerformers: Clipboard content prepared, length:', content.length);
        return await copyToClipboard(content, 'Top Performers Report');

      default:
        throw new Error('Unsupported export format');
    }

    console.log('🏆 exportTopPerformers: Content prepared, saving file...', { fileName, contentLength: content.length });
    return await saveFile(content, fileName, mimeType);
  } catch (error) {
    console.error('🏆 exportTopPerformers ERROR:', error);
    console.error('🏆 exportTopPerformers ERROR stack:', error.stack);
    
    // Enhanced error messages
    let userMessage = 'Failed to export top performers report.';
    
    if (error.message?.includes('No top performers data')) {
      userMessage = 'No top performers data available for export. Please ensure academic records exist.';
    } else if (error.message?.includes('FileSystem')) {
      userMessage = 'File system error. Please check app permissions and try again.';
    } else if (error.message?.includes('sharing')) {
      userMessage = 'Sharing not available. Please try copying to clipboard instead.';
    } else if (error.message?.includes('Permission')) {
      userMessage = 'Permission denied. Please check app permissions in device settings.';
    }
    
    Alert.alert('Export Error', `${userMessage}\n\nTechnical details: ${error.message || 'Unknown error'}`);
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

        const base64Enc = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : undefined;
        const fileData = await FileSystem.readAsStringAsync(uri, base64Enc ? { encoding: base64Enc } : undefined);
        await FileSystem.writeAsStringAsync(destUri, fileData, base64Enc ? { encoding: base64Enc } : undefined);

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

  let gradeGridContent = '';
  if (stats.gradeDistribution) {
    stats.gradeDistribution.forEach(grade => {
      const totalStudents = stats.gradeDistribution.reduce((sum, g) => sum + g.population, 0);
      const percentage = totalStudents > 0 ? Math.round((grade.population / totalStudents) * 100) : 0;
      const gradeClass = grade.name.includes('A') ? 'grade-a' : 
                        grade.name.includes('B') ? 'grade-b' : 
                        grade.name.includes('C') ? 'grade-c' : 
                        grade.name.includes('D') ? 'grade-d' : 'grade-f';
      
      gradeGridContent += '<div class="grade-card ' + gradeClass + '">' +
        '<div class="grade-name">' + grade.name + '</div>' +
        '<div class="grade-count">' + grade.population + '</div>' +
        '<div class="grade-percentage">' + percentage + '% of students</div>' +
        '</div>';
    });
  }

  let subjectPerformanceContent = '';
  if (stats.subjectPerformance && stats.subjectPerformance.length > 0) {
    subjectPerformanceContent = '<div class="subject-section">' +
      '<h2 class="section-title">📚 Subject-wise Performance</h2>' +
      '<table>' +
      '<thead>' +
      '<tr>' +
      '<th>Subject</th>' +
      '<th>Students Evaluated</th>' +
      '<th>Average Performance</th>' +
      '<th>Performance Bar</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>';
    
    stats.subjectPerformance.forEach(subject => {
      const performanceColor = subject.percentage >= 90 ? '#4CAF50' : 
                              subject.percentage >= 80 ? '#8BC34A' : 
                              subject.percentage >= 70 ? '#FF9800' : 
                              subject.percentage >= 60 ? '#FF5722' : '#f44336';
      
      subjectPerformanceContent += '<tr>' +
        '<td><strong>' + subject.subject + '</strong></td>' +
        '<td>' + subject.count + '</td>' +
        '<td><strong style="color: ' + performanceColor + '">' + subject.percentage + '%</strong></td>' +
        '<td>' +
        '<div class="performance-bar">' +
        '<div class="performance-fill" style="width: ' + subject.percentage + '%; background: ' + performanceColor + ';"></div>' +
        '</div>' +
        '</td>' +
        '</tr>';
    });
    
    subjectPerformanceContent += '</tbody></table></div>';
  }

  let topPerformersContent = '';
  if (stats.topPerformers && stats.topPerformers.length > 0) {
    topPerformersContent = '<div class="performers-section">' +
      '<h2 class="section-title">📅 Top Performers</h2>';
    
    stats.topPerformers.slice(0, 10).forEach((performer, index) => {
      const scoreColor = performer.percentage >= 90 ? '#4CAF50' : 
                        performer.percentage >= 80 ? '#8BC34A' : 
                        performer.percentage >= 70 ? '#FF9800' : 
                        performer.percentage >= 60 ? '#FF5722' : '#f44336';
      
      topPerformersContent += '<div class="performer-card">' +
        '<div class="rank-badge">' + (index + 1) + '</div>' +
        '<div class="performer-info">' +
        '<div class="performer-name">' + performer.name + '</div>' +
        '<div class="performer-details">' + performer.admissionNo + ' • ' + performer.count + ' subjects</div>' +
        '</div>' +
        '<div class="performer-score" style="color: ' + scoreColor + '">' + performer.percentage + '%</div>' +
        '</div>';
    });
    
    topPerformersContent += '</div>';
  }

  return '' +
    '<!DOCTYPE html>' +
    '<html>' +
      '<head>' +
        '<meta charset="utf-8">' +
        '<title>Academic Performance Report</title>' +
        '<style>' +
          'body { ' +
            'font-family: \'Arial\', sans-serif; ' +
            'margin: 20px; ' +
            'line-height: 1.6;' +
            'color: #333;' +
          '}' +
          '' +
          '.header { ' +
            'text-align: center; ' +
            'margin-bottom: 30px; ' +
            'border-bottom: 3px solid #2196F3;' +
            'padding-bottom: 20px;' +
          '}' +
          '' +
          '.school-name { ' +
            'font-size: 28px; ' +
            'font-weight: bold; ' +
            'color: #2196F3; ' +
            'margin-bottom: 5px;' +
          '}' +
          '' +
          '.report-title {' +
            'font-size: 22px;' +
            'color: #1976D2;' +
            'margin: 10px 0;' +
          '}' +
          '' +
          '.report-date {' +
            'color: #666;' +
            'font-size: 14px;' +
            'margin-bottom: 20px;' +
          '}' +
          '' +
          '.summary-section {' +
            'background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);' +
            'padding: 25px;' +
            'border-radius: 12px;' +
            'margin-bottom: 25px;' +
            'border-left: 5px solid #2196F3;' +
          '}' +
          '' +
          '.summary-title {' +
            'font-size: 18px;' +
            'font-weight: bold;' +
            'color: #2196F3;' +
            'margin-bottom: 15px;' +
            'display: flex;' +
            'align-items: center;' +
          '}' +
          '' +
          '.summary-grid {' +
            'display: grid;' +
            'grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));' +
            'gap: 15px;' +
          '}' +
          '' +
          '.summary-card {' +
            'background: white;' +
            'padding: 15px;' +
            'border-radius: 8px;' +
            'text-align: center;' +
            'box-shadow: 0 2px 4px rgba(0,0,0,0.1);' +
          '}' +
          '' +
          '.summary-value {' +
            'font-size: 24px;' +
            'font-weight: bold;' +
            'margin-bottom: 5px;' +
          '}' +
          '' +
          '.summary-label {' +
            'color: #666;' +
            'font-size: 12px;' +
            'text-transform: uppercase;' +
            'letter-spacing: 0.5px;' +
          '}' +
          '' +
          '.grade-section {' +
            'margin-bottom: 25px;' +
            'background: white;' +
            'padding: 20px;' +
            'border-radius: 12px;' +
            'border: 1px solid #e0e0e0;' +
          '}' +
          '' +
          '.section-title {' +
            'font-size: 18px;' +
            'font-weight: bold;' +
            'color: #2196F3;' +
            'margin-bottom: 20px;' +
            'display: flex;' +
            'align-items: center;' +
            'padding-bottom: 10px;' +
            'border-bottom: 2px solid #f0f0f0;' +
          '}' +
          '' +
          '.grade-grid {' +
            'display: grid;' +
            'grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));' +
            'gap: 15px;' +
            'margin-bottom: 20px;' +
          '}' +
          '' +
          '.grade-card {' +
            'padding: 15px;' +
            'border-radius: 8px;' +
            'text-align: center;' +
            'border: 2px solid;' +
          '}' +
          '' +
          '.grade-a { border-color: #4CAF50; background: rgba(76, 175, 80, 0.1); }' +
          '.grade-b { border-color: #8BC34A; background: rgba(139, 195, 74, 0.1); }' +
          '.grade-c { border-color: #FF9800; background: rgba(255, 152, 0, 0.1); }' +
          '.grade-d { border-color: #FF5722; background: rgba(255, 87, 34, 0.1); }' +
          '.grade-f { border-color: #f44336; background: rgba(244, 67, 54, 0.1); }' +
          '' +
          '.grade-name {' +
            'font-size: 16px;' +
            'font-weight: bold;' +
            'margin-bottom: 8px;' +
          '}' +
          '' +
          '.grade-count {' +
            'font-size: 20px;' +
            'font-weight: bold;' +
            'margin-bottom: 5px;' +
          '}' +
          '' +
          '.grade-percentage {' +
            'font-size: 12px;' +
            'color: #666;' +
          '}' +
          '' +
          '.subject-section {' +
            'margin-bottom: 25px;' +
          '}' +
          '' +
          'table { ' +
            'width: 100%; ' +
            'border-collapse: collapse; ' +
            'margin: 15px 0;' +
            'background: white;' +
            'border-radius: 8px;' +
            'overflow: hidden;' +
            'box-shadow: 0 2px 8px rgba(0,0,0,0.1);' +
          '}' +
          '' +
          'th, td { ' +
            'padding: 12px 15px;' +
            'text-align: left;' +
            'border-bottom: 1px solid #e0e0e0;' +
          '}' +
          '' +
          'th { ' +
            'background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);' +
            'color: white;' +
            'font-weight: bold;' +
            'text-transform: uppercase;' +
            'font-size: 12px;' +
            'letter-spacing: 0.5px;' +
          '}' +
          '' +
          'tr:nth-child(even) {' +
            'background: #f8f9fa;' +
          '}' +
          '' +
          'tr:hover {' +
            'background: #e3f2fd;' +
          '}' +
          '' +
          '.performance-bar {' +
            'background: #e0e0e0;' +
            'border-radius: 10px;' +
            'height: 8px;' +
            'margin: 5px 0;' +
          '}' +
          '' +
          '.performance-fill {' +
            'height: 100%;' +
            'border-radius: 10px;' +
          '}' +
          '' +
          '.performers-section {' +
            'margin-bottom: 25px;' +
          '}' +
          '' +
          '.performer-card {' +
            'display: flex;' +
            'align-items: center;' +
            'padding: 10px 15px;' +
            'margin-bottom: 8px;' +
            'background: white;' +
            'border-radius: 8px;' +
            'border-left: 4px solid #2196F3;' +
            'box-shadow: 0 1px 3px rgba(0,0,0,0.1);' +
          '}' +
          '' +
          '.rank-badge {' +
            'background: #2196F3;' +
            'color: white;' +
            'width: 30px;' +
            'height: 30px;' +
            'border-radius: 50%;' +
            'display: flex;' +
            'align-items: center;' +
            'justify-content: center;' +
            'font-weight: bold;' +
            'margin-right: 15px;' +
          '}' +
          '' +
          '.performer-info {' +
            'flex: 1;' +
          '}' +
          '' +
          '.performer-name {' +
            'font-weight: bold;' +
            'margin-bottom: 3px;' +
          '}' +
          '' +
          '.performer-details {' +
            'color: #666;' +
            'font-size: 12px;' +
          '}' +
          '' +
          '.performer-score {' +
            'font-size: 18px;' +
            'font-weight: bold;' +
            'color: #4CAF50;' +
          '}' +
          '' +
          '.footer {' +
            'margin-top: 40px;' +
            'padding-top: 20px;' +
            'border-top: 1px solid #e0e0e0;' +
            'text-align: center;' +
            'color: #666;' +
            'font-size: 12px;' +
          '}' +
          '' +
          '@media print {' +
            '.grade-section, .subject-section, .performers-section {' +
              'page-break-inside: avoid;' +
            '}' +
          '}' +
        '</style>' +
      '</head>' +
      '<body>' +
        '<!-- Header -->' +
        '<div class="header">' +
          '<div class="school-name">ABC School</div>' +
          '<h1 class="report-title">Academic Performance Report</h1>' +
          '<p class="report-date">Generated on ' + currentDate + '</p>' +
        '</div>' +

        '<!-- Performance Summary -->' +
        '<div class="summary-section">' +
          '<h2 class="summary-title">📊 Performance Overview</h2>' +
          '<div class="summary-grid">' +
            '<div class="summary-card">' +
              '<div class="summary-value" style="color: #2196F3;">' + (stats.totalStudents || 0) + '</div>' +
              '<div class="summary-label">Total Students</div>' +
            '</div>' +
            '<div class="summary-card">' +
              '<div class="summary-value" style="color: #4CAF50;">' + (stats.averagePercentage || 0) + '%</div>' +
              '<div class="summary-label">Average Performance</div>' +
            '</div>' +
            '<div class="summary-card">' +
              '<div class="summary-value" style="color: #FF9800;">' + (stats.highestScore || 0) + '%</div>' +
              '<div class="summary-label">Highest Score</div>' +
            '</div>' +
            '<div class="summary-card">' +
              '<div class="summary-value" style="color: #f44336;">' + (stats.lowestScore || 0) + '%</div>' +
              '<div class="summary-label">Lowest Score</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Grade Distribution -->' +
        '<div class="grade-section">' +
          '<h2 class="section-title">🎯 Grade Distribution Analysis</h2>' +
          '<div class="grade-grid">' +
            gradeGridContent +
          '</div>' +
        '</div>' +

        '<!-- Subject Performance -->' +
        subjectPerformanceContent +

        '<!-- Top Performers -->' +
        topPerformersContent +

        '<!-- Footer -->' +
        '<div class="footer">' +
          '<p>This report was generated automatically by the School Management System</p>' +
          '<p>Report Date: ' + currentDate + ' | Total Records Analyzed: ' + (data.length || 0) + '</p>' +
        '</div>' +
      '</body>' +
    '</html>';
};
