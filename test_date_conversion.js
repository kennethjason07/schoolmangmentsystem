// Test date conversion logic
function testDateConversion() {
  console.log('=== Testing Date Conversion Logic ===');
  
  // Test DD-MM-YYYY to Date object conversion
  const testDate = '05-09-2025';
  const [day, month, year] = testDate.split('-');
  
  // Old method (problematic)
  const oldDate = new Date(year, month - 1, day);
  console.log('Old method:', testDate, '->', oldDate);
  console.log('Old method day:', oldDate.getDate());
  
  // New method (fixed timezone issues)
  const newDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  console.log('New method:', testDate, '->', newDate);
  console.log('New method day:', newDate.getDate());
  
  // Test Date object to DD-MM-YYYY conversion
  const testDateObj = new Date(2025, 8, 5, 12, 0, 0); // September 5, 2025
  const day2 = String(testDateObj.getDate()).padStart(2, '0');
  const month2 = String(testDateObj.getMonth() + 1).padStart(2, '0');
  const year2 = testDateObj.getFullYear();
  const formattedDate = `${day2}-${month2}-${year2}`;
  console.log('Date object to DD-MM-YYYY:', testDateObj, '->', formattedDate);
}

// Run the test
testDateConversion();
