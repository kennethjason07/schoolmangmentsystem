import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

/**
 * Clean Print Receipt Utility
 * 
 * This utility generates high-quality receipts for printing and PDF generation
 * without any UI buttons or unwanted elements. It focuses on clean, professional
 * output with proper logo handling and print optimization.
 */

// Base64 encoded fallback logo (school emoji as SVG)
const FALLBACK_LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiByeD0iNCIgZmlsbD0iIzIxOTZGMyIvPgo8dGV4dCB4PSI0MCIgeT0iNDUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIzNiIgZmlsbD0id2hpdGUiPvCfj6g8L3RleHQ+Cjwvc3ZnPgo=';

/**
 * Load logo with multiple fallback strategies
 */
const loadLogoWithFallbacks = async (logoUrl) => {
  console.log('🏫 Loading logo with fallbacks:', logoUrl);

  // Return fallback immediately if no URL provided
  if (!logoUrl) {
    console.log('🏫 No logo URL provided, using fallback');
    return FALLBACK_LOGO_BASE64;
  }

  // Try multiple URL formats
  const urlsToTry = [
    logoUrl,
    logoUrl.replace('storage.googleapis.com', 'storage.cloud.google.com'),
    logoUrl + '?alt=media',
    logoUrl + '?alt=media&token=download'
  ];

  for (const url of urlsToTry) {
    try {
      console.log('🔄 Trying logo URL:', url);
      
      // Download and convert to base64
      const { uri } = await FileSystem.downloadAsync(
        url,
        FileSystem.documentDirectory + 'temp_logo.png'
      );
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Clean up temp file
      await FileSystem.deleteAsync(uri, { idempotent: true });
      
      const dataUrl = `data:image/png;base64,${base64}`;
      console.log('✅ Logo loaded successfully');
      return dataUrl;
      
    } catch (error) {
      console.log(`❌ Failed to load logo from ${url}:`, error.message);
      continue;
    }
  }

  console.log('⚠️ All logo URLs failed, using fallback');
  return FALLBACK_LOGO_BASE64;
};

/**
 * Generate clean receipt HTML without any UI elements
 */
const generateCleanReceiptHTML = async (receiptData, schoolDetails) => {
  console.log('🧾 Generating clean receipt HTML');
  console.log('📊 Receipt data:', receiptData);
  console.log('🏫 School details:', schoolDetails);

  try {
    // Load logo
    const logoDataUrl = await loadLogoWithFallbacks(schoolDetails?.logo_url);
    
    // Calculate total amount including fine
    const mainAmount = parseFloat(receiptData.amount_paid) || 0;
    const fineAmount = parseFloat(receiptData.fine_amount) || 0;
    const totalAmount = mainAmount + fineAmount;
    
    // Generate amount in words (simple implementation)
    const amountInWords = receiptData.amount_in_words || convertNumberToWords(totalAmount);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fee Receipt - ${receiptData.receipt_no || receiptData.receipt_number}</title>
    <style>
        /* Reset and Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4 portrait;
            margin: 10mm 15mm;
        }

        body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* Receipt Container */
        .receipt-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            padding: 15px;
            border: 2px solid #000;
            background: #fff;
        }

        /* Header Section */
        .receipt-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
        }

        .school-logo {
            margin-right: 20px;
            flex-shrink: 0;
        }

        .school-logo img {
            width: 60px;
            height: 60px;
            object-fit: contain;
            border-radius: 4px;
        }

        .school-info {
            flex-grow: 1;
            text-align: center;
        }

        .school-name {
            font-size: 22px;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .school-address {
            font-size: 11px;
            color: #333;
            margin-bottom: 8px;
        }

        .receipt-title {
            font-size: 18px;
            font-weight: bold;
            text-decoration: underline;
            color: #000;
        }

        /* Student Info Section */
        .student-info {
            margin: 20px 0;
        }

        .info-row {
            display: flex;
            margin-bottom: 8px;
        }

        .info-left, .info-center, .info-right {
            flex: 1;
            display: flex;
        }

        .info-label {
            font-weight: bold;
            color: #000;
            margin-right: 5px;
        }

        .info-value {
            color: #333;
        }

        /* Fee Table */
        .fee-table {
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            margin: 20px 0;
        }

        .fee-table th,
        .fee-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
        }

        /* Tighten first data row under header */
        .fee-table tbody tr:first-child td {
            padding-top: 4px;
            border-top: none;
        }

        .fee-table th {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
        }

        .fee-table .amount-cell {
            text-align: right;
            font-family: monospace;
        }

        .total-row {
            background-color: #f9f9f9;
            font-weight: bold;
        }

        /* Summary Section */
        .fee-summary {
            margin: 15px 0;
            padding: 10px;
            background-color: #f8f8f8;
            border: 1px solid #ddd;
        }

        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 11px;
        }

        /* Footer Section */
        .footer-section {
            margin-top: 20px;
        }

        .amount-words {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 11px;
        }

        .note-text {
            font-size: 10px;
            font-style: italic;
            color: #666;
            margin-bottom: 15px;
        }

        .footer-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 11px;
        }

        .signature-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 30px;
        }

        .signature-box {
            text-align: center;
            width: 200px;
        }

        .signature-line {
            border-top: 1px solid #000;
            margin-top: 40px;
            padding-top: 5px;
        }

        /* Print Optimization */
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .receipt-container {
                border: 2px solid #000 !important;
                break-inside: avoid;
            }
            
            .fee-table th {
                background-color: #f5f5f5 !important;
            }
            
            .total-row {
                background-color: #f9f9f9 !important;
            }
            
            .fee-summary {
                background-color: #f8f8f8 !important;
            }
            
            /* Hide any potential UI elements */
            button, input[type="button"], input[type="submit"], 
            .print-button, .download-button, .btn, .button,
            [role="button"], .touchable, .pressable, .clickable {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <!-- Header -->
        <div class="receipt-header">
            <div class="school-logo">
                <img src="${logoDataUrl}" alt="School Logo">
            </div>
            <div class="school-info">
                <div class="school-name">${schoolDetails?.name || 'SCHOOL NAME'}</div>
                <div class="school-address">${schoolDetails?.address || 'School Address'}</div>
                <div class="receipt-title">FEE RECEIPT</div>
            </div>
        </div>

        <!-- Student Information -->
        <div class="student-info">
            <div class="info-row">
                <div class="info-left">
                    <span class="info-label">Receipt No:</span>
                    <span class="info-value">${receiptData.receipt_no || receiptData.receipt_number || 'N/A'}</span>
                </div>
                <div class="info-center">
                    <span class="info-label">Admission No:</span>
                    <span class="info-value">${receiptData.student_admission_no || 'N/A'}</span>
                </div>
                <div class="info-right">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${receiptData.payment_date_formatted || new Date().toLocaleDateString()}</span>
                </div>
            </div>

            <div class="info-row">
                <div class="info-left">
                    <span class="info-label">Student Name:</span>
                    <span class="info-value">${receiptData.student_name || 'N/A'}</span>
                </div>
                <div class="info-center">
                    <span class="info-label">Father's Name:</span>
                    <span class="info-value">${receiptData.father_name || 'N/A'}</span>
                </div>
                <div class="info-right">
                    <span class="info-label">Class:</span>
                    <span class="info-value">${receiptData.class_name || 'N/A'}</span>
                </div>
            </div>

            <div class="info-row">
                <div class="info-left"></div>
                <div class="info-center"></div>
                  <div class="student-right">
                    <span class="info-label">Year:</span>
                    <span class="info-value">${receiptData.student_academic_year || ''}</span>
                  </div>
            </div>
        </div>

        <!-- Fee Table -->
        <table class="fee-table">
            <thead>
                <tr>
                    <th style="width: 70%;">Particulars</th>
                    <th style="width: 30%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${receiptData.fee_component || 'Fee Payment'}</td>
                    <td class="amount-cell">Rs. ${mainAmount.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                </tr>
                ${fineAmount > 0 ? `
                <tr>
                    <td>Fine</td>
                    <td class="amount-cell">Rs. ${fineAmount.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td><strong>Total:</strong></td>
                    <td class="amount-cell"><strong>Rs. ${totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</strong></td>
                </tr>
            </tbody>
        </table>

        <!-- Fee Summary -->
        <div class="fee-summary">
            <div class="summary-row">
                <span>Total fees paid:</span>
                <span>Rs. ${(receiptData.total_paid_till_date || mainAmount).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
            </div>
            <div class="summary-row">
                <span>Total fees Due:</span>
                <span>Rs. ${(receiptData.amount_remaining || 0).toLocaleString('en-IN', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer-section">
            <div class="amount-words">
                In Words: Rupees ${amountInWords} Only
            </div>
            
            <div class="note-text">
                Note: Fees once deposited will not be refunded under any Circumstances
            </div>
            
            <div class="footer-details">
                <div>Payment Mode: ${receiptData.payment_mode || 'N/A'}</div>
                <div>Cashier: ${receiptData.cashier_name || 'System Generated'} | Date: ${receiptData.payment_date_formatted || new Date().toLocaleDateString()}</div>
            </div>
            
            <div class="signature-section">
                <div class="signature-box">
                    <div>Received with thanks,</div>
                    <div class="signature-line">Cashier/Accountant</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    console.log('✅ Clean receipt HTML generated successfully');
    return html;

  } catch (error) {
    console.error('❌ Error generating clean receipt HTML:', error);
    throw error;
  }
};

/**
 * Simple number to words conversion (for Indian numbering)
 */
const convertNumberToWords = (number) => {
  if (!number || number === 0) return 'Zero';
  
  // Simple implementation - you can enhance this
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  if (number < 10) return ones[number];
  if (number < 20) return teens[number - 10];
  if (number < 100) return tens[Math.floor(number / 10)] + (number % 10 ? ' ' + ones[number % 10] : '');
  if (number < 1000) return ones[Math.floor(number / 100)] + ' Hundred' + (number % 100 ? ' ' + convertNumberToWords(number % 100) : '');
  if (number < 100000) return convertNumberToWords(Math.floor(number / 1000)) + ' Thousand' + (number % 1000 ? ' ' + convertNumberToWords(number % 1000) : '');
  
  return 'Amount'; // Fallback for very large numbers
};

/**
 * Print receipt with high quality and no UI elements
 */
export const printCleanReceipt = async (receiptData, schoolDetails) => {
  try {
    console.log('🖨️ Starting clean print process');
    
    const htmlContent = await generateCleanReceiptHTML(receiptData, schoolDetails);
    
    await Print.printAsync({
      html: htmlContent,
      width: 612, // A4 width in points
      height: 792, // A4 height in points
      orientation: Print.Orientation.portrait,
      margins: {
        left: 40,
        top: 40,
        right: 40,
        bottom: 40,
      }
    });
    
    console.log('✅ Clean print completed successfully');
    
  } catch (error) {
    console.error('❌ Clean print error:', error);
    throw error;
  }
};

/**
 * Generate PDF with high quality and no UI elements
 */
export const generateCleanPDF = async (receiptData, schoolDetails) => {
  try {
    console.log('💾 Starting clean PDF generation');
    
    const htmlContent = await generateCleanReceiptHTML(receiptData, schoolDetails);
    
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
      width: 612, // A4 width in points
      height: 792, // A4 height in points
      orientation: Print.Orientation.portrait,
      margins: {
        left: 40,
        top: 40,
        right: 40,
        bottom: 40,
      }
    });

    const receiptNumber = receiptData.receipt_no || receiptData.receipt_number || 'N_A';
    const fileName = `receipt_${String(receiptNumber).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Handle sharing/saving based on platform
    if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
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

          Alert.alert('Receipt Downloaded', `Receipt saved as ${fileName}`);
          return;
        }
      } catch (error) {
        console.log('Android storage access failed, falling back to sharing');
      }
    }

    // Fallback to sharing
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Receipt',
      UTI: 'com.adobe.pdf'
    });
    
    console.log('✅ Clean PDF generated and shared successfully');
    
  } catch (error) {
    console.error('❌ Clean PDF generation error:', error);
    throw error;
  }
};

export default {
  printCleanReceipt,
  generateCleanPDF
};