import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

/**
 * Isolated Print Receipt System
 * 
 * This system creates completely isolated HTML documents for printing,
 * ensuring no UI elements from the app interface are included.
 */

// High-quality school logo fallback (blue school building SVG)
const SCHOOL_LOGO_SVG = `data:image/svg+xml;base64,${btoa(`
<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <rect width="80" height="80" rx="8" fill="#1976D2"/>
  <rect x="20" y="25" width="40" height="35" fill="#fff"/>
  <rect x="22" y="27" width="36" height="3" fill="#1976D2"/>
  <rect x="25" y="35" width="6" height="8" fill="#1976D2"/>
  <rect x="34" y="35" width="6" height="8" fill="#1976D2"/>
  <rect x="43" y="35" width="6" height="8" fill="#1976D2"/>
  <rect x="25" y="48" width="6" height="8" fill="#1976D2"/>
  <rect x="34" y="48" width="6" height="8" fill="#1976D2"/>
  <rect x="43" y="48" width="6" height="8" fill="#1976D2"/>
  <polygon points="20,25 40,15 60,25" fill="#fff"/>
  <circle cx="40" cy="20" r="2" fill="#1976D2"/>
</svg>
`)}`;

/**
 * Load school logo with robust error handling
 */
const loadSchoolLogo = async (logoUrl) => {
  console.log('🏫 Loading school logo:', logoUrl);

  if (!logoUrl) {
    console.log('📱 No logo URL provided, using fallback');
    return SCHOOL_LOGO_SVG;
  }

  const urlVariations = [
    logoUrl,
    logoUrl.includes('?') ? logoUrl : `${logoUrl}?alt=media`,
    logoUrl.replace('googleapis.com', 'cloud.google.com'),
    logoUrl + (logoUrl.includes('?') ? '&' : '?') + 'token=download'
  ];

  for (const url of urlVariations) {
    try {
      console.log('🔄 Attempting to load:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'image/*',
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const reader = new FileReader();
        
        return new Promise((resolve) => {
          reader.onloadend = () => {
            console.log('✅ Logo loaded successfully');
            resolve(reader.result);
          };
          reader.onerror = () => {
            console.log('❌ Error converting logo to base64');
            resolve(SCHOOL_LOGO_SVG);
          };
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.log(`❌ Failed to load from ${url}:`, error.message);
      continue;
    }
  }

  console.log('⚠️ All logo loading attempts failed, using fallback');
  return SCHOOL_LOGO_SVG;
};

/**
 * Convert number to Indian words format
 */
const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convert = (n) => {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  
  return convert(Math.floor(num));
};

/**
 * Generate completely isolated receipt HTML
 */
const generateIsolatedReceiptHTML = async (receiptData, schoolDetails) => {
  console.log('🧾 Generating isolated receipt HTML');
  
  try {
    // Load logo
    const logoBase64 = await loadSchoolLogo(schoolDetails?.logo_url);
    
    // Calculate amounts
    const mainAmount = parseFloat(receiptData.amount_paid) || 0;
    const fineAmount = parseFloat(receiptData.fine_amount) || 0;
    const totalAmount = mainAmount + fineAmount;
    const amountInWords = receiptData.amount_in_words || numberToWords(totalAmount);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fee Receipt</title>
    <style>
        /* Complete CSS Reset */
        *, *::before, *::after {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            outline: none !important;
            box-sizing: border-box !important;
        }
        
        /* Hide all potentially problematic elements */
        button, input, select, textarea, form, nav, header, footer, aside,
        .button, .btn, .print-btn, .download-btn, .close-btn, .modal,
        [role="button"], [onclick], .clickable, .touchable, .pressable,
        .react-native, .rn-*, .css-*, [class*="Button"], [class*="button"],
        [data-testid], [class*="modal"], [class*="overlay"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
        }

        @page {
            size: A4 portrait;
            margin: 15mm;
        }

        html, body {
            width: 100% !important;
            height: auto !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            color: #000 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .receipt {
            width: 100% !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding: 15px !important;
            border: 2px solid #000 !important;
            background: #fff !important;
            font-family: Arial, sans-serif !important;
        }

        .header {
            display: flex !important;
            align-items: center !important;
            margin-bottom: 20px !important;
            padding-bottom: 15px !important;
            border-bottom: 2px solid #000 !important;
        }

        .logo {
            width: 60px !important;
            height: 60px !important;
            margin-right: 20px !important;
            flex-shrink: 0 !important;
        }

        .logo img {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            border-radius: 4px !important;
        }

        .school-info {
            flex-grow: 1 !important;
            text-align: center !important;
        }

        .school-name {
            font-size: 20px !important;
            font-weight: bold !important;
            color: #000 !important;
            margin-bottom: 5px !important;
            text-transform: uppercase !important;
            letter-spacing: 1px !important;
        }

        .school-address {
            font-size: 11px !important;
            color: #333 !important;
            margin-bottom: 8px !important;
        }

        .receipt-title {
            font-size: 16px !important;
            font-weight: bold !important;
            text-decoration: underline !important;
            color: #000 !important;
        }

        .student-section {
            margin: 20px 0 !important;
        }

        .info-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 15px !important;
            margin-bottom: 10px !important;
        }

        .info-item {
            font-size: 11px !important;
        }

        .info-label {
            font-weight: bold !important;
            color: #000 !important;
            display: inline !important;
            margin-right: 5px !important;
        }

        .info-value {
            color: #333 !important;
            display: inline !important;
        }

        .fee-table {
            width: 100% !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            margin: 20px 0 !important;
        }

        .fee-table th,
        .fee-table td {
            border: 1px solid #000 !important;
            padding: 8px !important;
            text-align: left !important;
            font-size: 11px !important;
        }

        .fee-table th {
            background-color: #f0f0f0 !important;
            font-weight: bold !important;
            text-align: center !important;
        }

        /* Tighten first data row under header */
        .fee-table tbody tr:first-child td {
            padding-top: 4px !important;
            border-top: none !important;
        }

        .amount-cell {
            text-align: right !important;
            font-family: 'Courier New', monospace !important;
            font-weight: bold !important;
        }

        .total-row {
            background-color: #f8f8f8 !important;
            font-weight: bold !important;
        }

        .summary {
            margin: 15px 0 !important;
            padding: 10px !important;
            background-color: #f9f9f9 !important;
            border: 1px solid #ddd !important;
        }

        .summary-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 10px !important;
            margin-bottom: 3px !important;
        }

        .footer {
            margin-top: 20px !important;
        }

        .words {
            font-weight: bold !important;
            margin-bottom: 10px !important;
            font-size: 11px !important;
        }

        .note {
            font-size: 9px !important;
            font-style: italic !important;
            color: #666 !important;
            margin-bottom: 15px !important;
        }

        .payment-info {
            display: flex !important;
            justify-content: space-between !important;
            margin-bottom: 20px !important;
            font-size: 10px !important;
        }

        .signature {
            display: flex !important;
            justify-content: flex-end !important;
            margin-top: 25px !important;
        }

        .signature-box {
            text-align: center !important;
            width: 180px !important;
        }

        .signature-line {
            border-top: 1px solid #000 !important;
            margin-top: 35px !important;
            padding-top: 5px !important;
            font-size: 10px !important;
        }

        @media print {
            /* Aggressive hiding for print */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            /* Hide everything except the receipt */
            body > *:not(.receipt) {
                display: none !important;
            }
            
            /* Ensure receipt prints properly */
            .receipt {
                border: 2px solid #000 !important;
                break-inside: avoid !important;
            }
            
            .fee-table th {
                background-color: #f0f0f0 !important;
            }
            
            .total-row {
                background-color: #f8f8f8 !important;
            }
            
            .summary {
                background-color: #f9f9f9 !important;
            }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="logo">
                <img src="${logoBase64}" alt="School Logo">
            </div>
            <div class="school-info">
                <div class="school-name">${schoolDetails?.name || "GLOBAL'S SANMARG PUBLIC SCHOOL"}</div>
                <div class="school-address">${schoolDetails?.address || 'Near Fateh Darwaza, Pansal Taleem, Bidar-585401'}</div>
                <div class="receipt-title">FEE RECEIPT</div>
            </div>
        </div>

        <div class="student-section">
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Receipt No:</span>
                    <span class="info-value">${receiptData.receipt_no || receiptData.receipt_number || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Admission No:</span>
                    <span class="info-value">${receiptData.student_admission_no || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${receiptData.payment_date_formatted || new Date().toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Student Name:</span>
                    <span class="info-value">${receiptData.student_name || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Father's Name:</span>
                    <span class="info-value">${receiptData.father_name || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Class:</span>
                    <span class="info-value">${receiptData.class_name || 'N/A'}</span>
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item"></div>
                <div class="info-item"></div>
                <div class="info-item">
                    <span class="info-label">Year:</span>
                    <span class="info-value">${schoolDetails?.academic_year || new Date().getFullYear()}</span>
                </div>
            </div>
        </div>

        <table class="fee-table">
            <thead>
                <tr>
                    <th style="width: 70%">Particulars</th>
                    <th style="width: 30%">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${receiptData.fee_component || 'Fee Payment'}</td>
                    <td class="amount-cell">Rs. ${mainAmount.toLocaleString('en-IN')}</td>
                </tr>
                ${fineAmount > 0 ? `
                <tr>
                    <td>Fine</td>
                    <td class="amount-cell">Rs. ${fineAmount.toLocaleString('en-IN')}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td><strong>Total:</strong></td>
                    <td class="amount-cell"><strong>Rs. ${totalAmount.toLocaleString('en-IN')}</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="summary">
            <div class="summary-row">
                <span>Total fees paid:</span>
                <span>Rs. ${(receiptData.total_paid_till_date || mainAmount).toLocaleString('en-IN')}</span>
            </div>
            <div class="summary-row">
                <span>Total fees Due:</span>
                <span>Rs. ${(receiptData.amount_remaining || 0).toLocaleString('en-IN')}</span>
            </div>
        </div>

        <div class="footer">
            <div class="words">In Words: Rupees ${amountInWords} Only</div>
            <div class="note">Note: Fees once deposited will not be refunded under any Circumstances</div>
            
            <div class="payment-info">
                <span>Payment Mode: ${receiptData.payment_mode || 'N/A'}</span>
                <span>Cashier: ${receiptData.cashier_name || 'System Generated'} | Date: ${receiptData.payment_date_formatted || new Date().toLocaleDateString()}</span>
            </div>
            
            <div class="signature">
                <div class="signature-box">
                    <div>Received with thanks,</div>
                    <div class="signature-line">Cashier/Accountant</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    console.log('✅ Isolated receipt HTML generated');
    return html;

  } catch (error) {
    console.error('❌ Error generating isolated receipt:', error);
    throw error;
  }
};

/**
 * Print receipt in isolated context
 */
export const printIsolatedReceipt = async (receiptData, schoolDetails) => {
  try {
    console.log('🖨️ Starting isolated print process');
    
    const html = await generateIsolatedReceiptHTML(receiptData, schoolDetails);
    
    await Print.printAsync({
      html,
      width: 595, // A4 width in points (210mm)
      height: 842, // A4 height in points (297mm)
      orientation: Print.Orientation.portrait,
      margins: {
        left: 42,   // 15mm
        top: 42,    // 15mm  
        right: 42,  // 15mm
        bottom: 42, // 15mm
      }
    });
    
    console.log('✅ Isolated print completed');
    
  } catch (error) {
    console.error('❌ Isolated print error:', error);
    throw error;
  }
};

/**
 * Generate PDF in isolated context
 */
export const generateIsolatedPDF = async (receiptData, schoolDetails) => {
  try {
    console.log('💾 Starting isolated PDF generation');
    
    const html = await generateIsolatedReceiptHTML(receiptData, schoolDetails);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: 595, // A4 width in points
      height: 842, // A4 height in points  
      orientation: Print.Orientation.portrait,
      margins: {
        left: 42,
        top: 42,
        right: 42,
        bottom: 42,
      }
    });

    const receiptNumber = receiptData.receipt_no || receiptData.receipt_number || 'N_A';
    const fileName = `Receipt_${String(receiptNumber).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Handle platform-specific sharing
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

          Alert.alert('Success', `Receipt saved as ${fileName}`);
          return;
        }
      } catch (error) {
        console.log('Android storage failed, using share:', error.message);
      }
    }

    // Fallback to sharing
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Receipt',
      UTI: 'com.adobe.pdf'
    });
    
    console.log('✅ Isolated PDF generated and shared');
    
  } catch (error) {
    console.error('❌ Isolated PDF error:', error);
    throw error;
  }
};

export default {
  printIsolatedReceipt,
  generateIsolatedPDF
};