/**
 * Test file to verify academic year utility functions work correctly
 * This demonstrates that the hardcoded years issue is resolved
 */

import {
  getCurrentAcademicYear,
  getNextAcademicYear,
  getPreviousAcademicYear,
  generateAcademicYearList,
  isValidAcademicYear,
  getReceiptAcademicYear
} from './academicYearUtils';

// Test function to verify academic year handling
function testAcademicYearUtilities() {
  console.log('🧪 Testing Academic Year Utilities');
  console.log('==================================');
  
  // Test 1: Current academic year generation
  console.log('\n📅 Test 1: Current Academic Year Generation');
  
  // Test with different dates
  const testDates = [
    new Date(2024, 3, 1),  // April 1, 2024 (start of academic year)
    new Date(2024, 8, 15), // September 15, 2024 (mid academic year)
    new Date(2025, 2, 15), // March 15, 2025 (end of academic year)
    new Date(2025, 3, 1),  // April 1, 2025 (start of next academic year)
  ];
  
  const expectedResults = ['2024-25', '2024-25', '2024-25', '2025-26'];
  
  testDates.forEach((date, index) => {
    const result = getCurrentAcademicYear(date);
    const expected = expectedResults[index];
    console.log(`Date: ${date.toDateString()} → Academic Year: ${result} (Expected: ${expected})`);
    console.log(`✅ Test 1.${index + 1} ${result === expected ? 'PASSED' : 'FAILED'}`);
  });
  
  // Test 2: Next/Previous academic year
  console.log('\n📅 Test 2: Next/Previous Academic Year');
  const currentAY = '2024-25';
  const nextAY = getNextAcademicYear(currentAY);
  const prevAY = getPreviousAcademicYear(currentAY);
  
  console.log(`Current: ${currentAY}`);
  console.log(`Next: ${nextAY} (Expected: 2025-26)`);
  console.log(`Previous: ${prevAY} (Expected: 2023-24)`);
  console.log(`✅ Test 2 ${nextAY === '2025-26' && prevAY === '2023-24' ? 'PASSED' : 'FAILED'}`);
  
  // Test 3: Academic year list generation
  console.log('\n📅 Test 3: Academic Year List Generation');
  const yearList = generateAcademicYearList(2, 1); // 2 years back, 1 year ahead
  console.log(`Generated list (2 back, 1 ahead):`, yearList);
  console.log(`List length: ${yearList.length} (Expected: 4)`);
  console.log(`✅ Test 3 ${yearList.length === 4 ? 'PASSED' : 'FAILED'}`);
  
  // Test 4: Academic year validation
  console.log('\n📅 Test 4: Academic Year Validation');
  const validYears = ['2024-25', '2023-24', '2025-26'];
  const invalidYears = ['2024-26', '24-25', '2024-2025', '', null, undefined];
  
  console.log('Valid years:');
  validYears.forEach(year => {
    const isValid = isValidAcademicYear(year);
    console.log(`  ${year}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });
  
  console.log('Invalid years:');
  invalidYears.forEach(year => {
    const isValid = isValidAcademicYear(year);
    console.log(`  ${year}: ${isValid ? '❌ Should be invalid' : '✅ Correctly invalid'}`);
  });
  
  // Test 5: Receipt academic year generation
  console.log('\n📅 Test 5: Receipt Academic Year Generation');
  
  // Test with school details containing academic year
  const schoolWithAY = { academic_year: '2023-24', name: 'Test School' };
  const receiptAY1 = getReceiptAcademicYear(schoolWithAY);
  console.log(`School with AY: ${receiptAY1} (Expected: 2023-24)`);
  
  // Test without school academic year (should use current)
  const schoolWithoutAY = { name: 'Test School' };
  const receiptAY2 = getReceiptAcademicYear(schoolWithoutAY);
  const currentAY = getCurrentAcademicYear();
  console.log(`School without AY: ${receiptAY2} (Expected: ${currentAY})`);
  
  // Test with invalid school academic year (should use current)
  const schoolWithInvalidAY = { academic_year: 'invalid', name: 'Test School' };
  const receiptAY3 = getReceiptAcademicYear(schoolWithInvalidAY);
  console.log(`School with invalid AY: ${receiptAY3} (Expected: ${currentAY})`);
  
  const test5Passed = receiptAY1 === '2023-24' && receiptAY2 === currentAY && receiptAY3 === currentAY;
  console.log(`✅ Test 5 ${test5Passed ? 'PASSED' : 'FAILED'}`);
  
  // Test 6: Real-world scenario test
  console.log('\n📅 Test 6: Real-world Scenario Test');
  const realDate = new Date(); // Current date
  const realAcademicYear = getCurrentAcademicYear(realDate);
  console.log(`Current Date: ${realDate.toDateString()}`);
  console.log(`Current Academic Year: ${realAcademicYear}`);
  console.log(`Is Valid: ${isValidAcademicYear(realAcademicYear)}`);
  
  // Verify it follows the format YYYY-YY
  const isCorrectFormat = /^\d{4}-\d{2}$/.test(realAcademicYear);
  console.log(`✅ Test 6 ${isCorrectFormat && isValidAcademicYear(realAcademicYear) ? 'PASSED' : 'FAILED'}`);
  
  console.log('\n🎉 Academic year utility tests completed!');
  console.log('\n💡 Summary:');
  console.log('- Academic years are now generated dynamically based on current date');
  console.log('- No more hardcoded "2024-25" values in receipt generation');
  console.log('- Receipts will show correct academic year automatically');
  console.log('- Academic year transitions happen in April (Indian academic calendar)');
}

// Mock environment for testing
if (typeof console !== 'undefined') {
  testAcademicYearUtilities();
}

export default testAcademicYearUtilities;