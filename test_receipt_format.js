/**
 * Test Script: Receipt Format Verification
 * This script tests the unified receipt template to ensure it matches the Global's Sanmarg Public School format
 */

const { generateUnifiedReceiptHTML } = require('./src/utils/unifiedReceiptTemplate.js');
const { generateWebReceiptHTML } = require('./src/utils/webReceiptGenerator.js');
const fs = require('fs');

// Sample data that matches the reference receipt format
const sampleReceiptData = {
  student_name: "MOHAMMED NOMAN",
  student_admission_no: "SPS0214",
  fathers_name: "MOHAMMED ANWAR", 
  class_name: "2nd--",
  fee_component: "Fine",
  payment_date_formatted: "11/08/2025",
  receipt_no: "1477",
  payment_mode: "Cash",
  amount_paid: 300,
  total_paid_till_date: 2200,
  amount_remaining: 13500,
  uid: "SPS0214",
  cashier_name: "Mohiuddin"
};

const sampleSchoolDetails = {
  name: "GLOBAL'S SANMARG PUBLIC SCHOOL",
  address: "Near Fateh Darwaza, Pansal Taleem, Bidar-585401",
  phone: "+91 9341111576",
  email: "global295000@gmail.com",
  academic_year: "2024/25",
  logo_url: null // No logo for this test
};

async function testUnifiedReceiptGeneration() {
  try {
    console.log('🧪 Testing unified receipt template...');
    
    // Test mobile/unified template
    const unifiedHTML = await generateUnifiedReceiptHTML(
      sampleReceiptData, 
      sampleSchoolDetails, 
      null
    );
    
    // Save mobile receipt
    fs.writeFileSync('test_receipt_mobile.html', unifiedHTML);
    console.log('✅ Mobile receipt saved as test_receipt_mobile.html');
    
    // Test web template (should use unified template internally)
    const webReceiptData = {
      schoolDetails: sampleSchoolDetails,
      studentData: {
        name: sampleReceiptData.student_name,
        admissionNo: sampleReceiptData.student_admission_no,
        className: sampleReceiptData.class_name,
        studentUID: sampleReceiptData.uid
      },
      feeData: {
        feeName: sampleReceiptData.fee_component,
        amount: sampleReceiptData.amount_paid,
        paymentDate: '2025-08-11',
        paymentMethod: sampleReceiptData.payment_mode
      },
      receiptNumber: sampleReceiptData.receipt_no,
      cashierName: sampleReceiptData.cashier_name,
      fatherName: sampleReceiptData.fathers_name,
      totalPaidTillDate: sampleReceiptData.total_paid_till_date,
      outstandingAmount: sampleReceiptData.amount_remaining
    };
    
    const webHTML = await generateWebReceiptHTML(webReceiptData);
    
    // Save web receipt
    fs.writeFileSync('test_receipt_web.html', webHTML);
    console.log('✅ Web receipt saved as test_receipt_web.html');
    
    // Verify both use the same format
    const mobileFormatCheck = unifiedHTML.includes('GLOBAL\'S SANMARG PUBLIC SCHOOL') && 
                              unifiedHTML.includes('MOHAMMED NOMAN') &&
                              unifiedHTML.includes('SPS0214') &&
                              unifiedHTML.includes('Rs. 300');
    
    const webFormatCheck = webHTML.includes('GLOBAL\'S SANMARG PUBLIC SCHOOL') && 
                           webHTML.includes('MOHAMMED NOMAN') &&
                           webHTML.includes('SPS0214') &&
                           webHTML.includes('Rs. 300');
    
    console.log('📊 Format Verification:');
    console.log(`  Mobile template format: ${mobileFormatCheck ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Web template format: ${webFormatCheck ? '✅ PASS' : '❌ FAIL'}`);
    
    // Check for Global's Sanmarg specific elements
    const specificElements = [
      'Contact No.:',
      'UID:',
      'Receipt No:',
      'Year:',
      'Fathers Name:',
      'Total fees paid',
      'Total fees Due',
      'Received with thanks,',
      'Cashier/Accountant'
    ];
    
    console.log('🔍 Checking for Global\'s Sanmarg specific elements:');
    specificElements.forEach(element => {
      const inMobile = unifiedHTML.includes(element);
      const inWeb = webHTML.includes(element);
      console.log(`  ${element}: Mobile ${inMobile ? '✅' : '❌'}, Web ${inWeb ? '✅' : '❌'}`);
    });
    
    console.log('\n🎯 Test Summary:');
    console.log('- Both mobile and web receipts should now follow the Global\'s Sanmarg format');
    console.log('- Check test_receipt_mobile.html and test_receipt_web.html to verify layout');
    console.log('- The format should match the reference image you provided');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
console.log('🧪 Starting receipt format verification test...');
console.log('📋 Reference: Global\'s Sanmarg Public School receipt format');
console.log('🎯 Goal: Ensure both mobile and web receipts match the reference format\n');

testUnifiedReceiptGeneration()
  .then(() => {
    console.log('\n✅ Receipt format test completed!');
    console.log('📄 Open the generated HTML files in a browser to verify the format');
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
  });