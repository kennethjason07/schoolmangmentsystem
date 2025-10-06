/**
 * Receipt Generation Debugging Script
 * This script simulates exactly what the FeePayment components do
 */

// Mock React Native environment
global.expo = undefined;

// Mock fetch for logo testing
global.fetch = async (url, options = {}) => {
  console.log(`🌐 Mock fetch called for: ${url}`);
  if (options.method === 'HEAD') {
    return { ok: true, status: 200 };
  }
  return { 
    ok: true, 
    status: 200, 
    text: () => Promise.resolve('mock response') 
  };
};

console.log('🔍 DEBUGGING: Receipt generation in app context\n');

// Test 1: Direct unified template import (same as FeePayment components)
console.log('TEST 1: Direct unified template import');
try {
  const { generateUnifiedReceiptHTML } = require('./src/utils/unifiedReceiptTemplate.js');
  console.log('✅ Unified template imported successfully');
  console.log('📋 Function type:', typeof generateUnifiedReceiptHTML);
  
  // Test data exactly as FeePayment components format it
  const receiptData = {
    student_name: "MOHAMMED NOMAN",
    student_admission_no: "SPS0214", 
    class_name: "2nd--",
    fee_component: "Fine",
    payment_date_formatted: "11/08/2025",
    receipt_no: "1477",
    payment_mode: "Cash",
    amount_paid: 300,
    fathers_name: "MOHAMMED ANWAR",
    uid: "SPS0214",
    total_paid_till_date: 2200,
    amount_remaining: 13500
  };

  const schoolDetails = {
    name: "GLOBAL'S SANMARG PUBLIC SCHOOL",
    address: "Near Fateh Darwaza, Pansal Taleem, Bidar-585401",
    phone: "+91 9341111576",
    email: "global295000@gmail.com",
    academic_year: "2024/25",
    logo_url: null
  };

  console.log('🔄 Calling generateUnifiedReceiptHTML...');
  
  generateUnifiedReceiptHTML(receiptData, schoolDetails, null)
    .then(htmlContent => {
      console.log('✅ Receipt generated successfully');
      console.log('📄 HTML length:', htmlContent.length);
      
      // Save to file for comparison
      require('fs').writeFileSync('debug_app_receipt.html', htmlContent);
      console.log('💾 Receipt saved as debug_app_receipt.html');
      
      // Check for key elements
      const requiredElements = [
        "GLOBAL'S SANMARG PUBLIC SCHOOL",
        "Student Name:",
        "UID:",
        "Receipt No:",
        "Fathers Name:",
        "Class:",
        "Year:",
        "Date:",
        "Particulars",
        "Fees Amount",
        "Fine",
        "Rs. 300",
        "Total fees paid: Rs. 2,200",
        "Total fees Due: Rs. 13,500",
        "Received with thanks,",
        "Cashier/Accountant"
      ];
      
      console.log('\n🔍 Checking for Global\'s Sanmarg elements:');
      let allFound = true;
      requiredElements.forEach(element => {
        const found = htmlContent.includes(element);
        console.log(`  ${element}: ${found ? '✅' : '❌'}`);
        if (!found) allFound = false;
      });
      
      if (allFound) {
        console.log('\n🎉 SUCCESS: App-context receipt matches expected format!');
      } else {
        console.log('\n⚠️  WARNING: Some elements missing from app-context receipt');
      }
      
      console.log('\n📋 Compare files:');
      console.log('  test_receipt_unified.html (standalone test - CORRECT)');
      console.log('  debug_app_receipt.html (app context - CHECK THIS)');
      
    })
    .catch(error => {
      console.error('❌ Receipt generation failed:', error);
      console.error('Stack:', error.stack);
    });
    
} catch (importError) {
  console.error('❌ Failed to import unified template:', importError);
}

console.log('\nTEST 2: Simulating FeePayment component receipt generation...');

// Mock the exact process that FeePayment components use
const simulateFeePaymentReceipt = () => {
  try {
    // This is exactly how parent FeePayment formats the data
    const mockReceipt = {
      studentName: "MOHAMMED NOMAN",
      admissionNo: "SPS0214",
      className: "2nd--", 
      feeName: "Fine",
      paymentDate: "2025-08-11", // Different format - needs formatting
      receiptNumber: "RCP1477", // Has RCP prefix - needs cleaning
      paymentMethod: "Cash",
      amount: 300,
      fatherName: "MOHAMMED ANWAR",
      studentUID: "SPS0214",
      totalPaidTillDate: 2200,
      outstandingAmount: 13500
    };
    
    const mockSchoolDetails = {
      name: "GLOBAL'S SANMARG PUBLIC SCHOOL",
      address: "Near Fateh Darwaza, Pansal Taleem, Bidar-585401",
      phone: "+91 9341111576",
      email: "global295000@gmail.com",
      academic_year: "2024/25",
      logo_url: null
    };
    
    // Clean receipt number by removing RCP prefix
    const cleanReceiptNumber = (receiptNumber) => {
      if (!receiptNumber) return 'N/A';
      const str = receiptNumber.toString();
      if (str.startsWith('RCP')) {
        return str.substring(3);
      }
      return str;
    };

    // Format date from yyyy-mm-dd to dd-mm-yyyy  
    const formatDateForReceipt = (dateString) => {
      if (!dateString) return 'N/A';
      
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return dateString;
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); 
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
      } catch (error) {
        console.warn('Error formatting date:', dateString, error);
        return dateString;
      }
    };
    
    // Convert to unified template format (as FeePayment components do)
    const unifiedReceiptData = {
      student_name: mockReceipt.studentName,
      student_admission_no: mockReceipt.admissionNo,
      class_name: mockReceipt.className,
      fee_component: mockReceipt.feeName,
      payment_date_formatted: formatDateForReceipt(mockReceipt.paymentDate),
      receipt_no: cleanReceiptNumber(mockReceipt.receiptNumber),
      payment_mode: mockReceipt.paymentMethod,
      amount_paid: mockReceipt.amount,
      fathers_name: mockReceipt.fatherName,
      uid: mockReceipt.studentUID || mockReceipt.admissionNo,
      total_paid_till_date: mockReceipt.totalPaidTillDate,
      amount_remaining: mockReceipt.outstandingAmount
    };
    
    console.log('📊 Simulated FeePayment receipt data:');
    Object.entries(unifiedReceiptData).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    console.log('🔄 Calling unified template with FeePayment-formatted data...');
    
    const { generateUnifiedReceiptHTML } = require('./src/utils/unifiedReceiptTemplate.js');
    
    return generateUnifiedReceiptHTML(unifiedReceiptData, mockSchoolDetails, null)
      .then(htmlContent => {
        console.log('✅ FeePayment simulation successful');
        
        // Save simulation result
        require('fs').writeFileSync('debug_feepayment_simulation.html', htmlContent);
        console.log('💾 Simulation saved as debug_feepayment_simulation.html');
        
        // Compare with original test
        const originalHtml = require('fs').readFileSync('test_receipt_unified.html', 'utf8');
        
        console.log('\n📊 Comparison:');
        console.log(`  Original test HTML length: ${originalHtml.length}`);
        console.log(`  FeePayment simulation length: ${htmlContent.length}`);
        console.log(`  Length match: ${originalHtml.length === htmlContent.length ? '✅' : '❌'}`);
        
        // Check if content is identical
        const contentMatch = originalHtml === htmlContent;
        console.log(`  Content identical: ${contentMatch ? '✅' : '❌'}`);
        
        if (!contentMatch) {
          console.log('\n⚠️  Content differs - investigating...');
          
          // Find first difference
          for (let i = 0; i < Math.min(originalHtml.length, htmlContent.length); i++) {
            if (originalHtml[i] !== htmlContent[i]) {
              console.log(`  First difference at position ${i}:`);
              console.log(`    Original: "${originalHtml.substring(i, i + 50)}..."`);
              console.log(`    Simulation: "${htmlContent.substring(i, i + 50)}..."`);
              break;
            }
          }
        }
        
        return htmlContent;
      });
      
  } catch (error) {
    console.error('❌ FeePayment simulation failed:', error);
    throw error;
  }
};

// Run simulation
simulateFeePaymentReceipt()
  .then(() => {
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Compare the generated files:');
    console.log('   - test_receipt_unified.html (standalone - correct)');
    console.log('   - debug_app_receipt.html (app context)');
    console.log('   - debug_feepayment_simulation.html (FeePayment simulation)');
    console.log('2. If they match but your app shows different format:');
    console.log('   - Check browser cache');
    console.log('   - Verify receipt is being generated by FeePayment (not cached)');
    console.log('   - Check console logs in app for errors');
    console.log('3. If they differ, we\'ll need to check the actual receipt data');
    console.log('   being passed from your FeePayment components');
  })
  .catch(error => {
    console.error('❌ Diagnosis failed:', error);
  });