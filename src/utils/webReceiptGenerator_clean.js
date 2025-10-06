const { getSchoolLogoBase64, getLogoHTML } = require('./logoUtils');
const { formatReferenceNumberForDisplay } = require('./referenceNumberGenerator');
const { generateUnifiedReceiptHTML } = require('./unifiedReceiptTemplate');

/**
 * Web Receipt Generator with Demo Bill Format
 * Generates HTML receipts that work perfectly in web browsers and for PDF printing
 */

// Helper function to format dates for receipts
const formatDate = (date) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return 'N/A';
  }
};

/**
 * Generate Web Receipt HTML using Unified Template
 * This ensures consistency between mobile and web receipt formats
 */
const generateWebReceiptHTML = async (receiptData) => {
  try {
    console.log('📧 Web - Generating receipt using unified template...');
    
    const {
      schoolDetails,
      studentData,
      feeData,
      paymentData,
      outstandingAmount = 0,
      receiptNumber,
      academicYear = '2024-25',
      cashierName,
      fatherName,
      totalPaidTillDate
    } = receiptData;

    // Convert web receipt data to unified template format
    const unifiedReceiptData = {
      student_name: studentData.name,
      student_admission_no: studentData.admissionNo,
      class_name: studentData.className,
      fee_component: feeData.feeName || feeData.fee_component || 'Fee Payment',
      payment_date_formatted: feeData.paymentDate ? formatDate(new Date(feeData.paymentDate)) : formatDate(new Date()),
      receipt_no: formatReferenceNumberForDisplay(receiptNumber),
      payment_mode: paymentData?.paymentMode || feeData.paymentMethod || 'Online',
      amount_paid: feeData.amount,
      amount_remaining: outstandingAmount,
      total_paid_till_date: totalPaidTillDate,
      cashier_name: cashierName,
      fathers_name: fatherName,
      uid: studentData.studentUID
    };

    // Use the unified template for consistent formatting
    const htmlContent = await generateUnifiedReceiptHTML(
      unifiedReceiptData, 
      schoolDetails, 
      schoolDetails?.schoolLogo // Use preloaded logo if available
    );

    console.log('✅ Web - Receipt generated using unified template');
    return htmlContent;
  } catch (error) {
    console.error('❌ Web receipt generation error:', error);
    throw error;
  }
};

// Legacy function - now uses unified template
const generateLegacyWebReceiptHTML = async (receiptData) => {
  // This is kept for backwards compatibility but redirects to unified template
  return generateWebReceiptHTML(receiptData);
};

/**
 * Generate Receipt for Fee Payment (Web Compatible)
 */
const generateFeeReceiptHTML = async (receiptData) => {
  const {
    schoolDetails,
    studentName,
    admissionNo,
    className,
    feeComponent,
    amount,
    paymentMethod,
    transactionId,
    referenceNumber,
    outstandingAmount = 0,
    academicYear = '2024-25',
    cashierName
  } = receiptData;

  return await generateWebReceiptHTML({
    schoolDetails,
    studentData: {
      name: studentName,
      admissionNo,
      className
    },
    feeData: {
      component: feeComponent,
      amount
    },
    paymentData: {
      mode: paymentMethod,
      transactionId
    },
    outstandingAmount,
    receiptNumber: referenceNumber,
    academicYear,
    cashierName
  });
};

/**
 * Generate Receipt for UPI Payment (Web Compatible)
 */
const generateUPIReceiptHTML = async (receiptData) => {
  const {
    schoolDetails,
    transactionData,
    paymentDetails,
    upiTransaction,
    outstandingAmount = 0,
    cashierName
  } = receiptData;

  return await generateWebReceiptHTML({
    schoolDetails,
    studentData: {
      name: transactionData.studentName,
      admissionNo: transactionData.admissionNo,
      className: transactionData.className || 'N/A'
    },
    feeData: {
      component: transactionData.feeComponent,
      amount: transactionData.amount
    },
    paymentData: {
      mode: 'UPI Payment',
      transactionId: upiTransaction.id
    },
    outstandingAmount,
    receiptNumber: paymentDetails.referenceNumber,
    academicYear: transactionData.academicYear || '2024-25',
    cashierName
  });
};

/**
 * Open Receipt in New Window (Web Browser)
 */
const openReceiptInNewWindow = (htmlContent, title = 'Official Receipt') => {
  if (typeof window === 'undefined') {
    console.warn('openReceiptInNewWindow: Not in browser environment');
    return;
  }

  const newWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes,resizable=yes');
  
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    newWindow.document.title = title;
    
    // Focus the new window
    newWindow.focus();
  } else {
    console.error('Failed to open new window. Popup might be blocked.');
    alert('Please allow popups to view the receipt in a new window.');
  }
};

/**
 * Download Receipt as HTML File
 */
const downloadReceiptHTML = (htmlContent, fileName = 'receipt.html') => {
  if (typeof window === 'undefined') {
    console.warn('downloadReceiptHTML: Not in browser environment');
    return;
  }

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
};

/**
 * Utility to check if running in web environment
 */
const isWebEnvironment = () => {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
};

// Export all functions for CommonJS
module.exports = {
  generateWebReceiptHTML,
  generateLegacyWebReceiptHTML,
  generateFeeReceiptHTML,
  generateUPIReceiptHTML,
  openReceiptInNewWindow,
  downloadReceiptHTML,
  isWebEnvironment,
  formatDate
};