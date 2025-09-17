import { getSchoolLogoBase64, getLogoHTML } from './logoUtils';
import { formatReferenceNumberForDisplay } from './referenceNumberGenerator';

/**
 * Web Receipt Generator with Demo Bill Format
 * Generates HTML receipts that work perfectly in web browsers and for PDF printing
 */

// Convert amount to words utility
const convertAmountToWords = (amount) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const numberToWords = (num) => {
    if (num === 0) return 'Zero';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + numberToWords(num % 100) : '');
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '');
    if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + numberToWords(num % 100000) : '');
    return 'Amount too large';
  };
  
  return numberToWords(parseInt(amount)) + ' Rupees Only';
};

/**
 * Generate Demo Bill Style Receipt HTML for Web
 */
export const generateWebReceiptHTML = async (receiptData) => {
  try {
    const {
      schoolDetails,
      studentData,
      feeData,
      paymentData,
      outstandingAmount = 0,
      receiptNumber,
      academicYear = '2024-25'
    } = receiptData;

    // Get school logo - try multiple sources
    let logoHTML = '';
    
    // First try to use the directly loaded school logo URL (if available)
    if (schoolDetails?.schoolLogo) {
      console.log('📷 Using directly loaded school logo URL for receipt');
      logoHTML = `<img src="${schoolDetails.schoolLogo}" alt="School Logo" style="width: 60px; height: 60px; margin: 0 auto 10px auto; border-radius: 8px; object-fit: contain; display: block;" />`;
    } else if (schoolDetails?.logo_url) {
      console.log('📷 Attempting to load school logo from storage for receipt');
      try {
        const logoBase64 = await getSchoolLogoBase64(schoolDetails.logo_url);
        logoHTML = logoBase64 ? getLogoHTML(logoBase64, { width: '60px', height: '60px' }) : '';
      } catch (logoError) {
        console.warn('⚠️ Failed to load logo from storage, proceeding without logo:', logoError);
        logoHTML = '';
      }
    }
    
    console.log('📷 Logo HTML result:', logoHTML ? 'Logo loaded successfully' : 'No logo available');

    // Convert amount to words
    const amountInWords = convertAmountToWords(feeData.amount);

    // Format date and time
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-IN');
    const formattedTime = currentDate.toLocaleTimeString('en-IN');

    const receiptHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Official Receipt - ${studentData.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Arial', sans-serif;
              background-color: #e6f3ff;
              padding: 20px;
              color: #000;
              font-size: 12px;
              line-height: 1.4;
            }
            
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              background: linear-gradient(135deg, #e6f3ff 0%, #cce7ff 100%);
              border: 2px solid #000;
              position: relative;
              min-height: 800px;
            }
            
            .header {
              text-align: center;
              padding: 15px;
              border-bottom: 2px solid #000;
              background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
            }
            
            .logo {
              float: left;
              margin-right: 15px;
            }
            
            .school-info {
              display: inline-block;
              text-align: center;
              width: calc(100% - 80px);
            }
            
            .school-name {
              font-size: 18px;
              font-weight: bold;
              color: #000;
              margin-bottom: 5px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            .school-address {
              font-size: 11px;
              color: #333;
              margin-bottom: 3px;
            }
            
            .official-receipt {
              font-size: 16px;
              font-weight: bold;
              color: #000;
              margin-top: 10px;
              text-decoration: underline;
            }
            
            .receipt-details {
              padding: 15px;
              background: #f8fcff;
            }
            
            .detail-row {
              display: flex;
              margin-bottom: 8px;
              align-items: center;
            }
            
            .detail-label {
              font-weight: bold;
              width: 140px;
              color: #000;
            }
            
            .detail-value {
              flex: 1;
              color: #333;
              border-bottom: 1px dotted #666;
              padding-bottom: 2px;
            }
            
            .fee-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              background: #fff;
            }
            
            .fee-table th,
            .fee-table td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            
            .fee-table th {
              background: #d6e9ff;
              font-weight: bold;
              text-align: center;
            }
            
            .fee-table .amount-col {
              text-align: right;
              width: 120px;
            }
            
            .total-row {
              background: #e6f3ff;
              font-weight: bold;
            }
            
            .amount-words {
              margin: 10px 0;
              padding: 8px;
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              font-style: italic;
              font-weight: bold;
            }
            
            .payment-info {
              margin-top: 15px;
              display: flex;
              justify-content: space-between;
            }
            
            .left-info,
            .right-info {
              width: 48%;
            }
            
            .payment-detail {
              font-size: 11px;
              color: #000;
              margin-bottom: 5px;
            }
            
            .outstanding-balance {
              background: #f8f9fa;
              padding: 8px;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              color: #333;
              font-weight: bold;
            }
            
            .paid-status {
              background: #d4edda;
              padding: 8px;
              border: 1px solid #c3e6cb;
              border-radius: 4px;
              color: #155724;
              font-weight: bold;
            }
            
            .signature-section {
              margin-top: 30px;
              text-align: right;
              padding: 10px;
            }
            
            .signature-line {
              border-top: 1px solid #000;
              width: 200px;
              margin-left: auto;
              margin-top: 40px;
              text-align: center;
              padding-top: 5px;
              font-size: 11px;
            }
            
            .footer {
              text-align: center;
              padding: 10px;
              font-size: 10px;
              border-top: 1px solid #666;
              margin-top: 20px;
              color: #666;
            }
            
            .clearfix::after {
              content: "";
              display: table;
              clear: both;
            }
            
            /* Web Actions for Browser */
            .web-actions {
              text-align: center;
              margin: 20px 0;
              padding: 15px;
              background: #f0f8ff;
              border: 1px solid #ccc;
            }
            
            .web-button {
              display: inline-block;
              margin: 0 10px;
              padding: 10px 20px;
              background: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              font-weight: 500;
              border: none;
              cursor: pointer;
              font-size: 14px;
              transition: background-color 0.3s;
            }
            
            .web-button:hover {
              background: #0056b3;
            }
            
            .web-button.secondary {
              background: #28a745;
            }
            
            .web-button.secondary:hover {
              background: #218838;
            }
            
            /* Print Styles */
            @media print {
              body {
                background-color: white;
                padding: 0;
              }
              .web-actions {
                display: none;
              }
              .receipt-container {
                border: 1px solid #000;
                box-shadow: none;
              }
            }
            
            /* Mobile Responsive */
            @media (max-width: 600px) {
              body {
                padding: 10px;
              }
              
              .receipt-container {
                margin: 0;
              }
              
              .payment-info {
                flex-direction: column;
              }
              
              .left-info,
              .right-info {
                width: 100%;
                margin-bottom: 10px;
              }
              
              .school-name {
                font-size: 16px;
              }
              
              .detail-row {
                flex-direction: column;
                align-items: flex-start;
              }
              
              .detail-label {
                width: auto;
                margin-bottom: 2px;
              }
              
              .detail-value {
                width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header -->
            <div class="header clearfix">
              <div class="logo">
                ${logoHTML}
              </div>
              <div class="school-info">
                <div class="school-name">${schoolDetails?.name || 'School Management System'}</div>
                <div class="school-address">${schoolDetails?.address || ''}</div>
                ${schoolDetails?.phone ? `<div class="school-address">Phone: ${schoolDetails.phone}</div>` : ''}
                ${schoolDetails?.email ? `<div class="school-address">Email: ${schoolDetails.email}</div>` : ''}
                <div class="official-receipt">Official Receipt</div>
              </div>
            </div>
            
            <!-- Student Details -->
            <div class="receipt-details">
              <div class="detail-row">
                <div class="detail-label">Student Name:</div>
                <div class="detail-value">${studentData.name}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Admission No.:</div>
                <div class="detail-value">${studentData.admissionNo}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Class/Year:</div>
                <div class="detail-value">${studentData.className || 'N/A'}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Receipt No.:</div>
                <div class="detail-value">${formatReferenceNumberForDisplay(receiptNumber)}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Date & Time:</div>
                <div class="detail-value">${formattedDate} & ${formattedTime}</div>
              </div>
              
              <!-- Fee Table -->
              <table class="fee-table">
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Item</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>${feeData.component}</td>
                    <td class="amount-col">₹${feeData.amount}.00</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="2"><strong>Total Outstanding: ₹${outstandingAmount > 0 ? outstandingAmount + '.00' : '0.00'}</strong></td>
                    <td class="amount-col"><strong>₹${feeData.amount}.00</strong></td>
                  </tr>
                </tbody>
              </table>
              
              <!-- Amount in Words -->
              <div class="amount-words">
                <strong>Received with thanks a sum of ₹${feeData.amount}.00 (${amountInWords}) Only</strong>
              </div>
              
              <!-- Payment Information -->
              <div class="payment-info">
                <div class="left-info">
                  <div class="payment-detail"><strong>Payment Mode:</strong> ${paymentData.mode}</div>
                  <div class="payment-detail"><strong>Transaction ID:</strong> ${paymentData.transactionId}</div>
                  <div class="payment-detail"><strong>Reference:</strong> ${formatReferenceNumberForDisplay(receiptNumber)}</div>
                </div>
                <div class="right-info">
                  ${outstandingAmount > 0 ? `
                    <div class="outstanding-balance">
                      <strong>Remaining Balance: ₹${outstandingAmount}.00</strong>
                    </div>
                  ` : `
                    <div class="paid-status">
                      <strong>✓ All Fees Paid</strong>
                    </div>
                  `}
                </div>
              </div>
              
              <!-- Signature Section -->
              <div class="signature-section">
                <div class="signature-line">
                  Authorized Signatory
                </div>
              </div>
            </div>
            
            <!-- Web Actions -->
            <div class="web-actions">
              <button class="web-button" onclick="window.print()">🖨️ Print Receipt</button>
              <button class="web-button secondary" onclick="downloadPDF()">💾 Save as PDF</button>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <p>For any queries, please contact the administration.</p>
            </div>
          </div>
          
          <script>
            function downloadPDF() {
              // Hide web actions before printing
              document.querySelector('.web-actions').style.display = 'none';
              
              // Trigger print dialog (user can choose to save as PDF)
              window.print();
              
              // Show web actions after printing
              setTimeout(() => {
                document.querySelector('.web-actions').style.display = 'block';
              }, 1000);
            }
            
            // Auto-focus on load for better accessibility
            window.onload = function() {
              document.body.focus();
            };
          </script>
        </body>
      </html>
    `;
    
    return receiptHTML;
  } catch (error) {
    console.error('Error generating web receipt HTML:', error);
    throw error;
  }
};

/**
 * Generate Receipt for Fee Payment (Web Compatible)
 */
export const generateFeeReceiptHTML = async (receiptData) => {
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
    academicYear = '2024-25'
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
    academicYear
  });
};

/**
 * Generate Receipt for UPI Payment (Web Compatible)
 */
export const generateUPIReceiptHTML = async (receiptData) => {
  const {
    schoolDetails,
    transactionData,
    paymentDetails,
    upiTransaction,
    outstandingAmount = 0
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
    academicYear: transactionData.academicYear || '2024-25'
  });
};

/**
 * Open Receipt in New Window (Web Browser)
 */
export const openReceiptInNewWindow = (htmlContent, title = 'Official Receipt') => {
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
export const downloadReceiptHTML = (htmlContent, fileName = 'receipt.html') => {
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
export const isWebEnvironment = () => {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
};

export default {
  generateWebReceiptHTML,
  generateFeeReceiptHTML,
  generateUPIReceiptHTML,
  openReceiptInNewWindow,
  downloadReceiptHTML,
  isWebEnvironment,
  convertAmountToWords
};
