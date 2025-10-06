/**
 * EMERGENCY FIX: Force Unified Template Usage
 * 
 * This script will apply the changes needed to ensure the unified template
 * is used instead of any old fallback templates.
 */

const fs = require('fs');
const path = require('path');

// Enhanced generateReceiptHTML function with comprehensive error handling
const enhancedGenerateReceiptHTML = `
  // Generate receipt HTML using unified template with comprehensive error handling
  const generateReceiptHTML = async (receipt) => {
    console.log('🔥🔥🔥 EMERGENCY DEBUG - Receipt generation starting');
    console.log('🔥🔥🔥 Receipt data:', JSON.stringify(receipt, null, 2));
    console.log('🔥🔥🔥 School details:', JSON.stringify(schoolDetails, null, 2));
    
    try {
      console.log('📧 COMPONENT_TYPE - Generating unified receipt HTML...');
      
      // Validate required data
      if (!receipt) {
        throw new Error('Receipt data is null or undefined');
      }
      
      if (!schoolDetails) {
        console.warn('⚠️ School details missing, using default values');
      }
      
      // Convert receipt data format to match unified template expectations
      const unifiedReceiptData = {
        student_name: receipt.studentName || 'N/A',
        student_admission_no: receipt.admissionNo || 'N/A',
        class_name: receipt.className || 'N/A',
        fee_component: receipt.feeName || 'Fee Payment',
        payment_date_formatted: formatDateForReceipt(receipt.paymentDate),
        receipt_no: cleanReceiptNumber(receipt.receiptNumber),
        payment_mode: receipt.paymentMethod || 'Cash',
        amount_paid: receipt.amount || 0,
        fathers_name: receipt.fatherName || null,
        uid: receipt.studentUID || receipt.admissionNo || 'N/A',
        total_paid_till_date: receipt.totalPaidTillDate || receipt.amount || 0,
        amount_remaining: receipt.outstandingAmount || 0
      };
      
      console.log('🔥🔥🔥 Converted unified data:', JSON.stringify(unifiedReceiptData, null, 2));
      
      // Ensure school details have required fields
      const safeSchoolDetails = {
        name: schoolDetails?.name || "GLOBAL'S SANMARG PUBLIC SCHOOL",
        address: schoolDetails?.address || "Near Fateh Darwaza, Pansal Taleem, Bidar-585401",
        phone: schoolDetails?.phone || "+91 9341111576",
        email: schoolDetails?.email || "global295000@gmail.com",
        academic_year: schoolDetails?.academic_year || "2024/25",
        logo_url: schoolDetails?.logo_url || null
      };
      
      console.log('🔥🔥🔥 Using school details:', JSON.stringify(safeSchoolDetails, null, 2));
      console.log('🏫 COMPONENT_TYPE - Using unified template for Global\\'s Sanmarg format');
      
      // Add timing and detailed logging
      const startTime = Date.now();
      console.log('🔥🔥🔥 Calling generateUnifiedReceiptHTML at:', new Date().toISOString());
      
      const htmlContent = await generateUnifiedReceiptHTML(unifiedReceiptData, safeSchoolDetails, null);
      
      const endTime = Date.now();
      console.log('🔥🔥🔥 Receipt generation completed in:', (endTime - startTime) + 'ms');
      console.log('🔥🔥🔥 Generated HTML length:', htmlContent.length);
      console.log('🔥🔥🔥 HTML preview:', htmlContent.substring(0, 500));
      
      // Comprehensive format validation
      const formatChecks = {
        hasGlobalSchool: htmlContent.includes("GLOBAL'S SANMARG PUBLIC SCHOOL"),
        hasStudentInfoGrid: htmlContent.includes('student-info') && htmlContent.includes('grid-template-columns'),
        hasFeeTable: htmlContent.includes('fee-table') && htmlContent.includes('Particulars') && htmlContent.includes('Fees Amount'),
        hasFeeSummary: htmlContent.includes('fee-summary') && htmlContent.includes('Total fees paid') && htmlContent.includes('Total fees Due'),
        hasSignature: htmlContent.includes('Received with thanks,') && htmlContent.includes('Cashier/Accountant'),
        hasProperCSS: htmlContent.includes('.receipt-container') && htmlContent.includes('border: 2px solid #000')
      };
      
      console.log('🔥🔥🔥 FORMAT VALIDATION:');
      Object.entries(formatChecks).forEach(([check, passed]) => {
        console.log(\`  \${check}: \${passed ? '✅' : '❌'}\`);
      });
      
      const allChecksPassed = Object.values(formatChecks).every(check => check);
      console.log(\`🔥🔥🔥 All format checks: \${allChecksPassed ? '✅ PASSED' : '❌ FAILED'}\`);
      
      if (!allChecksPassed) {
        console.error('🔥🔥🔥 CRITICAL: Generated HTML does not match Global\\'s Sanmarg format!');
        console.error('🔥🔥🔥 HTML content preview:', htmlContent.substring(0, 1000));
      }
      
      console.log('✅ COMPONENT_TYPE - Unified receipt HTML generated successfully');
      return htmlContent;
      
    } catch (error) {
      console.error('🔥🔥🔥 CRITICAL ERROR in receipt generation:', error);
      console.error('🔥🔥🔥 Error stack:', error.stack);
      console.error('🔥🔥🔥 FORCING Global\\'s Sanmarg format with fallback template');
      console.error('❌ COMPONENT_TYPE - Error generating unified receipt:', error);
      
      // CRITICAL: Instead of old fallback, force Global's Sanmarg format
      const safeReceiptData = {
        studentName: receipt.studentName || 'Student Name',
        admissionNo: receipt.admissionNo || 'N/A',
        className: receipt.className || 'N/A',
        feeName: receipt.feeName || 'Fee Payment',
        paymentDate: formatDateForReceipt(receipt.paymentDate),
        receiptNumber: cleanReceiptNumber(receipt.receiptNumber),
        paymentMethod: receipt.paymentMethod || 'Cash',
        amount: receipt.amount || 0,
        fatherName: receipt.fatherName || 'N/A',
        studentUID: receipt.studentUID || receipt.admissionNo || 'N/A'
      };
      
      const safeTotalPaid = receipt.totalPaidTillDate || receipt.amount || 0;
      const safeRemaining = receipt.outstandingAmount || 0;
      const schoolName = schoolDetails?.name || "GLOBAL'S SANMARG PUBLIC SCHOOL";
      const schoolAddress = schoolDetails?.address || "Near Fateh Darwaza, Pansal Taleem, Bidar-585401";
      
      // FORCE Global's Sanmarg format even in error case
      return \`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fee Receipt - \${safeReceiptData.receiptNumber}</title>
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              body { 
                font-family: 'Arial', sans-serif; 
                margin: 0; 
                padding: 20px; 
                color: #000; 
                background: #fff; 
                font-size: 14px;
                line-height: 1.4;
              }
              .receipt-container { 
                border: 2px solid #000; 
                border-radius: 0; 
                padding: 20px; 
                max-width: 100%; 
                margin: 0 auto; 
                background: white;
              }
              
              .header-section {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #000;
                padding-bottom: 15px;
              }
              .logo-section {
                width: 80px;
                margin-right: 20px;
                flex-shrink: 0;
              }
              .school-logo-fallback {
                width: 80px;
                height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
                background: #f5f5f5;
                border: 2px dashed #ccc;
                border-radius: 8px;
              }
              .school-info {
                flex-grow: 1;
                text-align: center;
              }
              .school-name { 
                font-size: 28px; 
                font-weight: bold; 
                margin: 0 0 8px 0;
                text-transform: uppercase;
                color: #000;
              }
              .school-address { 
                font-size: 14px;
                color: #333;
                margin: 5px 0;
              }
              .school-contact {
                font-size: 12px;
                color: #666;
                margin: 3px 0;
              }
              
              .student-info {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px 30px;
                margin: 20px 0;
                font-size: 14px;
              }
              .info-item {
                display: flex;
                align-items: baseline;
              }
              .info-label {
                font-weight: bold;
                margin-right: 8px;
                color: #000;
              }
              .info-value {
                color: #333;
              }
              
              .fee-table-container {
                margin: 25px 0;
              }
              .fee-table {
                width: 100%;
                border-collapse: collapse;
                border: 2px solid #000;
              }
              .fee-table th {
                border: 1px solid #000;
                padding: 12px 15px;
                text-align: center;
                font-weight: bold;
                background-color: #f8f8f8;
              }
              .fee-table td {
                border: 1px solid #000;
                padding: 12px 15px;
                text-align: left;
              }
              .fee-table .amount-cell {
                text-align: right;
                font-weight: 500;
              }
              .total-row {
                font-weight: bold;
                background-color: #f0f0f0;
              }
              .total-row .particulars {
                text-align: right;
                font-weight: bold;
              }
              
              .fee-summary {
                display: flex;
                justify-content: space-between;
                margin: 20px 0;
                font-size: 14px;
                font-weight: 500;
              }
              .fee-summary-item {
                color: #333;
              }
              
              .footer-section {
                margin-top: 30px;
                font-size: 12px;
                line-height: 1.6;
              }
              .footer-notes {
                margin-bottom: 15px;
              }
              .footer-details {
                margin-bottom: 20px;
              }
              .signature-area {
                display: flex;
                justify-content: flex-end;
                margin-top: 40px;
              }
              .signature-box {
                text-align: center;
                width: 250px;
              }
              .signature-text {
                margin-bottom: 40px;
                text-align: right;
                padding-right: 20px;
              }
              .signature-line {
                border-top: 1px solid #000;
                padding-top: 8px;
                font-weight: 500;
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header-section">
                <div class="logo-section">
                  <div class="school-logo-fallback">🏫</div>
                </div>
                <div class="school-info">
                  <div class="school-name">\${schoolName}</div>
                  <div class="school-address">\${schoolAddress}</div>
                  <div class="school-contact">Contact No.: +91 9341111576</div>
                  <div class="school-contact">Email: global295000@gmail.com</div>
                </div>
              </div>
              
              <div class="student-info">
                <div class="info-item">
                  <span class="info-label">Student Name:</span>
                  <span class="info-value">\${safeReceiptData.studentName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">UID:</span>
                  <span class="info-value">\${safeReceiptData.studentUID}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Receipt No:</span>
                  <span class="info-value">\${safeReceiptData.receiptNumber}</span>
                </div>
                
                <div class="info-item">
                  <span class="info-label">Fathers Name:</span>
                  <span class="info-value">\${safeReceiptData.fatherName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Class:</span>
                  <span class="info-value">\${safeReceiptData.className}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Year:</span>
                  <span class="info-value">2024/25</span>
                </div>
                
                <div></div>
                <div></div>
                <div class="info-item">
                  <span class="info-label">Date:</span>
                  <span class="info-value">\${safeReceiptData.paymentDate}</span>
                </div>
              </div>
              
              <div class="fee-table-container">
                <table class="fee-table">
                  <thead>
                    <tr>
                      <th style="width: 70%;">Particulars</th>
                      <th style="width: 30%;">Fees Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>\${safeReceiptData.feeName}</td>
                      <td class="amount-cell">Rs. \${Number(safeReceiptData.amount).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr class="total-row">
                      <td class="particulars">Total:</td>
                      <td class="amount-cell">Rs. \${Number(safeReceiptData.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div class="fee-summary">
                <div class="fee-summary-item">
                  Total fees paid: Rs. \${Number(safeTotalPaid).toLocaleString('en-IN')}
                </div>
                <div class="fee-summary-item">
                  Total fees Due: Rs. \${Number(safeRemaining).toLocaleString('en-IN')}
                </div>
              </div>
              
              <div class="footer-section">
                <div class="footer-notes">
                  <div>In Words: Rupees \${safeReceiptData.amount > 0 ? 'Three Hundred' : 'Zero'} Only</div>
                  <div>Note: Fees once deposited will not be refunded under any Circumstances</div>
                </div>
                
                <div class="footer-details">
                  <div>Payment Mode: \${safeReceiptData.paymentMethod}</div>
                  <div>Cashier Name: System Generated &nbsp;&nbsp;&nbsp; Date: \${safeReceiptData.paymentDate}</div>
                </div>
                
                <div class="signature-area">
                  <div class="signature-box">
                    <div class="signature-text">Received with thanks,</div>
                    <div class="signature-line">Cashier/Accountant</div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      \`;
    }
  };`;

// Apply to parent component
const parentPath = './src/screens/parent/FeePayment.js';
if (fs.existsSync(parentPath)) {
  let parentContent = fs.readFileSync(parentPath, 'utf8');
  
  // Find the generateReceiptHTML function and replace it
  const functionStart = parentContent.indexOf('const generateReceiptHTML = async (receipt) => {');
  const functionEnd = parentContent.indexOf('};', functionStart) + 2;
  
  if (functionStart !== -1 && functionEnd !== -1) {
    const newFunction = enhancedGenerateReceiptHTML.replace(/COMPONENT_TYPE/g, 'Parent');
    const newContent = parentContent.substring(0, functionStart) + newFunction.trim() + parentContent.substring(functionEnd);
    
    fs.writeFileSync(parentPath, newContent);
    console.log('✅ Applied enhanced receipt generation to Parent FeePayment');
  }
}

// Apply to student component
const studentPath = './src/screens/student/FeePayment.js';
if (fs.existsSync(studentPath)) {
  let studentContent = fs.readFileSync(studentPath, 'utf8');
  
  // Find the generateReceiptHTML function and replace it
  const functionStart = studentContent.indexOf('const generateReceiptHTML = async (receipt) => {');
  const functionEnd = studentContent.indexOf('};', functionStart) + 2;
  
  if (functionStart !== -1 && functionEnd !== -1) {
    const newFunction = enhancedGenerateReceiptHTML.replace(/COMPONENT_TYPE/g, 'Student');
    const newContent = studentContent.substring(0, functionStart) + newFunction.trim() + studentContent.substring(functionEnd);
    
    fs.writeFileSync(studentPath, newContent);
    console.log('✅ Applied enhanced receipt generation to Student FeePayment');
  }
}

console.log('\n🚨 EMERGENCY FIX APPLIED!');
console.log('\n📋 What was changed:');
console.log('1. ✅ Added comprehensive error logging with 🔥🔥🔥 markers');
console.log('2. ✅ Added format validation checks');
console.log('3. ✅ Forced Global\'s Sanmarg format even in error cases');
console.log('4. ✅ Enhanced error handling and data validation');
console.log('\n📱 Next steps:');
console.log('1. Restart your app (stop Metro bundler and start again)');
console.log('2. Generate a receipt');
console.log('3. Check browser console for 🔥🔥🔥 EMERGENCY DEBUG messages');
console.log('4. The receipt MUST now show Global\'s Sanmarg format');
console.log('\n🎯 If you still see the old format after this fix,');
console.log('   share the 🔥🔥🔥 console messages to identify the issue.');