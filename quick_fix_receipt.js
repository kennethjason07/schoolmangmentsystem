/**
 * Quick Fix: Restore proper generateReceiptHTML function
 */

const fs = require('fs');

// Clean generateReceiptHTML function for both components
const cleanGenerateReceiptHTML = `
  // Generate receipt HTML using unified template
  const generateReceiptHTML = async (receipt) => {
    console.log('🔥🔥🔥 EMERGENCY DEBUG - Starting receipt generation');
    console.log('🔥🔥🔥 Receipt data:', JSON.stringify(receipt, null, 2));
    console.log('🔥🔥🔥 School details:', JSON.stringify(schoolDetails, null, 2));
    
    try {
      console.log('📧 COMPONENT_TYPE - Generating unified receipt HTML...');
      
      // Convert receipt data format to match unified template expectations
      const unifiedReceiptData = {
        student_name: receipt.studentName,
        student_admission_no: receipt.admissionNo,
        class_name: receipt.className,
        fee_component: receipt.feeName,
        payment_date_formatted: formatDateForReceipt(receipt.paymentDate),
        receipt_no: cleanReceiptNumber(receipt.receiptNumber),
        payment_mode: receipt.paymentMethod,
        amount_paid: receipt.amount,
        fathers_name: receipt.fatherName,
        uid: receipt.studentUID || receipt.admissionNo,
        total_paid_till_date: receipt.totalPaidTillDate,
        amount_remaining: receipt.outstandingAmount
      };
      
      console.log('🔥🔥🔥 Converted unified data:', JSON.stringify(unifiedReceiptData, null, 2));
      console.log('🏫 COMPONENT_TYPE - Using unified template for Global\\'s Sanmarg format');
      
      const startTime = Date.now();
      const htmlContent = await generateUnifiedReceiptHTML(unifiedReceiptData, schoolDetails, null);
      
      const endTime = Date.now();
      console.log('🔥🔥🔥 Receipt generated in:', (endTime - startTime) + 'ms');
      console.log('🔥🔥🔥 HTML length:', htmlContent.length);
      
      // Check format
      const hasCorrectFormat = htmlContent.includes("GLOBAL'S SANMARG PUBLIC SCHOOL") && 
                               htmlContent.includes('student-info') && 
                               htmlContent.includes('Particulars') && 
                               htmlContent.includes('Received with thanks');
      
      console.log('🔥🔥🔥 Format check:', hasCorrectFormat ? '✅ CORRECT' : '❌ INCORRECT');
      
      if (!hasCorrectFormat) {
        console.error('🔥🔥🔥 WARNING: Generated HTML may not have correct format');
        console.error('🔥🔥🔥 HTML preview:', htmlContent.substring(0, 500));
      }
      
      console.log('✅ COMPONENT_TYPE - Unified receipt HTML generated successfully');
      return htmlContent;
      
    } catch (error) {
      console.error('🔥🔥🔥 CRITICAL ERROR:', error);
      console.error('🔥🔥🔥 Error stack:', error.stack);
      console.error('❌ COMPONENT_TYPE - Error generating unified receipt:', error);
      
      // Simple error fallback that still shows Global's Sanmarg format
      return \`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt - Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
            .error { color: #ff0000; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h2>\${schoolDetails?.name || "GLOBAL'S SANMARG PUBLIC SCHOOL"}</h2>
          <div class="error">Receipt generation encountered an error</div>
          <p>Student: \${receipt.studentName}</p>
          <p>Amount: ₹\${receipt.amount}</p>
          <p>Date: \${formatDateForReceipt(receipt.paymentDate)}</p>
          <p>Receipt No: \${cleanReceiptNumber(receipt.receiptNumber)}</p>
          <p><strong>Error:</strong> \${error.message}</p>
        </body>
        </html>
      \`;
    }
  };
`;

// Fix parent component
const parentPath = './src/screens/parent/FeePayment.js';
if (fs.existsSync(parentPath)) {
  let content = fs.readFileSync(parentPath, 'utf8');
  
  // Remove any corrupted generateReceiptHTML function and orphaned code
  const beforePattern = /\/\/ Generate receipt HTML using unified template[\s\S]*?};/;
  const afterPattern = /const getPaymentMethods/;
  
  const beforeMatch = content.search(beforePattern);
  const afterMatch = content.search(afterPattern);
  
  if (beforeMatch !== -1 && afterMatch !== -1) {
    const beforeCode = content.substring(0, beforeMatch);
    const afterCode = content.substring(afterMatch);
    
    const cleanFunction = cleanGenerateReceiptHTML.replace(/COMPONENT_TYPE/g, 'Parent');
    const newContent = beforeCode + cleanFunction.trim() + '\n\n  // Get payment methods available (QR Code only for parents)\n  ' + afterCode.substring('const getPaymentMethods'.length);
    
    fs.writeFileSync(parentPath, newContent);
    console.log('✅ Fixed parent FeePayment component');
  } else {
    console.log('❌ Could not find pattern in parent component');
  }
}

// Fix student component
const studentPath = './src/screens/student/FeePayment.js';
if (fs.existsSync(studentPath)) {
  let content = fs.readFileSync(studentPath, 'utf8');
  
  // Remove any corrupted generateReceiptHTML function and orphaned code
  const beforePattern = /\/\/ Generate receipt HTML using unified template[\s\S]*?};/;
  const afterPattern = /const getPaymentMethods/;
  
  const beforeMatch = content.search(beforePattern);
  const afterMatch = content.search(afterPattern);
  
  if (beforeMatch !== -1 && afterMatch !== -1) {
    const beforeCode = content.substring(0, beforeMatch);
    const afterCode = content.substring(afterMatch);
    
    const cleanFunction = cleanGenerateReceiptHTML.replace(/COMPONENT_TYPE/g, 'Student');
    const newContent = beforeCode + cleanFunction.trim() + '\n\n  // Get payment methods available (QR Code only for students)\n  ' + afterCode.substring('const getPaymentMethods'.length);
    
    fs.writeFileSync(studentPath, newContent);
    console.log('✅ Fixed student FeePayment component');
  } else {
    console.log('❌ Could not find pattern in student component');
  }
}

console.log('\n🚀 Quick fix applied!');
console.log('📋 Now restart your app with: npx expo start -c');
console.log('🔍 Look for 🔥🔥🔥 EMERGENCY DEBUG messages in browser console');
console.log('✅ Both components should now generate Global\'s Sanmarg format receipts');