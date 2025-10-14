/**
 * Test file to verify date utility functions work correctly
 * This demonstrates that the timezone issues are resolved
 */

import { formatDateToYYYYMMDD, parseYYYYMMDDToDate, formatDateForDisplay, calculateAge } from './dateUtils';

// Test function to verify date handling
function testDateUtilities() {
  console.log('🧪 Testing Date Utilities');
  console.log('========================');
  
  // Test 1: Date formatting
  console.log('\n📅 Test 1: Date Formatting');
  const testDate = new Date(2024, 5, 6); // June 6, 2024 (month is 0-indexed)
  const formatted = formatDateToYYYYMMDD(testDate);
  console.log(`Input Date: ${testDate.toDateString()}`);
  console.log(`Formatted: ${formatted}`);
  console.log(`Expected: 2024-06-06`);
  console.log(`✅ Test 1 ${formatted === '2024-06-06' ? 'PASSED' : 'FAILED'}`);
  
  // Test 2: Date parsing
  console.log('\n📅 Test 2: Date Parsing');
  const dateString = '2024-06-06';
  const parsedDate = parseYYYYMMDDToDate(dateString);
  console.log(`Input String: ${dateString}`);
  console.log(`Parsed Date: ${parsedDate ? parsedDate.toDateString() : 'null'}`);
  console.log(`Expected: Thu Jun 06 2024`);
  const isCorrect = parsedDate && 
    parsedDate.getFullYear() === 2024 && 
    parsedDate.getMonth() === 5 && 
    parsedDate.getDate() === 6;
  console.log(`✅ Test 2 ${isCorrect ? 'PASSED' : 'FAILED'}`);
  
  // Test 3: Round-trip consistency
  console.log('\n📅 Test 3: Round-trip Consistency');
  const originalDate = new Date(2024, 11, 25); // December 25, 2024
  const formattedString = formatDateToYYYYMMDD(originalDate);
  const reparsedDate = parseYYYYMMDDToDate(formattedString);
  console.log(`Original: ${originalDate.toDateString()}`);
  console.log(`Formatted: ${formattedString}`);
  console.log(`Reparsed: ${reparsedDate ? reparsedDate.toDateString() : 'null'}`);
  const roundTripCorrect = reparsedDate && 
    originalDate.getFullYear() === reparsedDate.getFullYear() &&
    originalDate.getMonth() === reparsedDate.getMonth() &&
    originalDate.getDate() === reparsedDate.getDate();
  console.log(`✅ Test 3 ${roundTripCorrect ? 'PASSED' : 'FAILED'}`);
  
  // Test 4: Display formatting
  console.log('\n📅 Test 4: Display Formatting');
  const displayFormatted = formatDateForDisplay('2024-06-06');
  console.log(`Input: 2024-06-06`);
  console.log(`Display Format: ${displayFormatted}`);
  console.log(`Expected: 06/06/2024`);
  console.log(`✅ Test 4 ${displayFormatted === '06/06/2024' ? 'PASSED' : 'FAILED'}`);
  
  // Test 5: Age calculation
  console.log('\n📅 Test 5: Age Calculation');
  // Use a fixed date for testing (someone born 20 years ago)
  const today = new Date();
  const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
  const dobString = formatDateToYYYYMMDD(twentyYearsAgo);
  const calculatedAge = calculateAge(dobString);
  console.log(`DOB: ${dobString} (${twentyYearsAgo.toDateString()})`);
  console.log(`Calculated Age: ${calculatedAge}`);
  console.log(`Expected: 20`);
  console.log(`✅ Test 5 ${calculatedAge === 20 ? 'PASSED' : 'FAILED'}`);
  
  console.log('\n🎉 Date utility tests completed!');
}

// Mock environment for testing
if (typeof console !== 'undefined') {
  testDateUtilities();
}

export default testDateUtilities;