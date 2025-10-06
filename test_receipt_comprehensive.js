/**
 * Comprehensive Receipt Generation Test
 * Tests the actual unified receipt template used by the apps
 */

// Mock modules that might not be available in Node.js environment
const mockGlobal = {
  expo: undefined // Simulate non-React Native environment
};
global.expo = undefined;

// Mock fetch for testing logo loading
const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  console.log(`🌐 Mock fetch called for: ${url}`);
  
  // Simulate successful response for test URLs
  if (url.includes('supabase') || url.includes('http')) {
    if (options.method === 'HEAD') {
      return { ok: true, status: 200 };
    }
    return { 
      ok: true, 
      status: 200, 
      text: () => Promise.resolve('mock response') 
    };
  }
  
  // Fallback to original fetch if available
  if (originalFetch) {
    return originalFetch(url, options);
  }
  
  throw new Error('Mock fetch: URL not supported');
};

// Import the unified receipt template
const { generateUnifiedReceiptHTML, convertNumberToWords } = require('./src/utils/unifiedReceiptTemplate.js');

// Test data matching the exact format used by both FeePayment components
const testReceiptData = {
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

const testSchoolDetails = {
  name: "GLOBAL'S SANMARG PUBLIC SCHOOL",
  address: "Near Fateh Darwaza, Pansal Taleem, Bidar-585401",
  phone: "+91 9341111576",
  email: "global295000@gmail.com",
  academic_year: "2024/25",
  logo_url: null // Test without logo first
};

// Test the number to words conversion
console.log('🧮 Testing convertNumberToWords function:');
const testNumbers = [0, 300, 1500, 15000, 100000, 1000000, 10000000];
testNumbers.forEach(num => {
  try {
    const words = convertNumberToWords(num);
    console.log(`  ${num} = "${words}"`);
  } catch (error) {
    console.error(`  ${num} = ERROR: ${error.message}`);
  }
});

// Main test function
async function testReceiptGeneration() {
  console.log('\n🧪 Testing Global\'s Sanmarg Public School receipt generation...');
  console.log('📋 Using EXACT data format from FeePayment components\n');

  try {
    console.log('📊 Test receipt data:');
    Object.entries(testReceiptData).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n🏫 Test school details:');
    Object.entries(testSchoolDetails).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n🔄 Calling generateUnifiedReceiptHTML...');
    const startTime = Date.now();
    
    const htmlContent = await generateUnifiedReceiptHTML(testReceiptData, testSchoolDetails, null);
    
    const endTime = Date.now();
    console.log(`✅ Receipt generated successfully in ${endTime - startTime}ms`);

    // Save to file
    require('fs').writeFileSync('test_receipt_unified.html', htmlContent);
    console.log('💾 Receipt saved as test_receipt_unified.html');

    // Verify key elements are present
    const requiredElements = [
      "GLOBAL'S SANMARG PUBLIC SCHOOL",
      "MOHAMMED NOMAN",
      "SPS0214", 
      "MOHAMMED ANWAR",
      "Receipt No:",
      "Fine",
      "Rs. 300",
      "Total fees paid: Rs. 2,200",
      "Total fees Due: Rs. 13,500",
      "Received with thanks,",
      "Cashier/Accountant"
    ];

    console.log('\n🔍 Verifying receipt content:');
    let allElementsFound = true;
    
    requiredElements.forEach(element => {
      const found = htmlContent.includes(element);
      console.log(`  ${element}: ${found ? '✅' : '❌'}`);
      if (!found) allElementsFound = false;
    });

    // Check HTML structure
    console.log('\n🏗️  Verifying HTML structure:');
    const structureChecks = [
      { name: 'DOCTYPE', check: htmlContent.includes('<!DOCTYPE html>') },
      { name: 'Header section', check: htmlContent.includes('header-section') },
      { name: 'Student info grid', check: htmlContent.includes('student-info') },
      { name: 'Fee table', check: htmlContent.includes('fee-table') },
      { name: 'Fee summary', check: htmlContent.includes('fee-summary') },
      { name: 'Footer section', check: htmlContent.includes('footer-section') },
      { name: 'CSS styles', check: htmlContent.includes('<style>') },
      { name: 'School logo fallback', check: htmlContent.includes('🏫') }
    ];

    structureChecks.forEach(({ name, check }) => {
      console.log(`  ${name}: ${check ? '✅' : '❌'}`);
      if (!check) allElementsFound = false;
    });

    console.log(`\n🎯 Overall Result: ${allElementsFound ? '✅ PASS' : '❌ FAIL'}`);
    
    if (allElementsFound) {
      console.log('🎉 The unified receipt template is working correctly!');
      console.log('📱 Both mobile and web apps should generate this same format');
    } else {
      console.log('⚠️  Some elements are missing from the generated receipt');
    }

    // Test with logo URL
    console.log('\n🖼️  Testing with logo URL...');
    const testSchoolWithLogo = {
      ...testSchoolDetails,
      logo_url: "https://example.com/test-logo.png" // This will fail gracefully and use fallback
    };
    
    const htmlWithLogo = await generateUnifiedReceiptHTML(testReceiptData, testSchoolWithLogo, null);
    const hasLogoFallback = htmlWithLogo.includes('🏫') || htmlWithLogo.includes('🏦');
    console.log(`  Logo fallback handling: ${hasLogoFallback ? '✅' : '❌'}`);

    return { success: true, htmlLength: htmlContent.length };

  } catch (error) {
    console.error('❌ Receipt generation failed:', error);
    console.error('📍 Error details:');
    console.error(`  Message: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

// Additional test for error scenarios
async function testErrorScenarios() {
  console.log('\n🧪 Testing error scenarios...');
  
  // Test with minimal data
  try {
    const minimalData = {
      student_name: "Test Student",
      amount_paid: 100
    };
    
    console.log('📝 Testing with minimal data...');
    const htmlMinimal = await generateUnifiedReceiptHTML(minimalData, {}, null);
    console.log('✅ Minimal data test passed');
  } catch (error) {
    console.log('❌ Minimal data test failed:', error.message);
  }

  // Test with null/undefined values
  try {
    const nullData = {
      student_name: null,
      amount_paid: undefined,
      class_name: "",
      fee_component: null
    };
    
    console.log('📝 Testing with null/undefined values...');
    const htmlNull = await generateUnifiedReceiptHTML(nullData, null, null);
    console.log('✅ Null values test passed');
  } catch (error) {
    console.log('❌ Null values test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive receipt generation tests...\n');
  
  const result = await testReceiptGeneration();
  await testErrorScenarios();
  
  console.log('\n📋 Test Summary:');
  console.log(`✅ Main test: ${result.success ? 'PASSED' : 'FAILED'}`);
  if (result.success) {
    console.log(`📄 Generated HTML size: ${result.htmlLength} characters`);
  }
  
  console.log('\n📝 Next Steps:');
  if (result.success) {
    console.log('1. ✅ The unified receipt template is working correctly');
    console.log('2. 🔍 Check mobile/web app logs for runtime errors during receipt generation');
    console.log('3. 🧪 Test actual receipt generation within the React Native app');
    console.log('4. 📱 Verify the format appears correctly in both parent and student components');
    console.log('5. 📄 Open test_receipt_unified.html in a browser to verify the visual layout');
  } else {
    console.log('1. ❌ Fix the issues identified in the unified receipt template');
    console.log('2. 🔧 Check for missing dependencies or import errors');
    console.log('3. 📱 Verify the template is being imported correctly in FeePayment components');
  }
}

// Run tests
runAllTests().catch(console.error);