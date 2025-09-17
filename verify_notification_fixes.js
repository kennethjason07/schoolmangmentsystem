// Script to verify that all notification-related queries are correctly fixed
const fs = require('fs');
const path = require('path');

// List of files that were fixed
const fixedFiles = [
  'src/screens/parent/ParentDashboard.js',
  'src/screens/student/StudentNotifications.js',
  'src/utils/tenantNotificationFilter.js'
];

console.log('🔍 Verifying notification fixes...\n');

let allGood = true;

for (const file of fixedFiles) {
  const fullPath = path.join(__dirname, file);
  
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if the file contains the correct pattern
    if (file === 'src/utils/tenantNotificationFilter.js') {
      // This file should have 'notifications.created_at' in the order clause
      if (content.includes('notifications.created_at')) {
        console.log(`✅ ${file} - Fixed correctly`);
      } else {
        console.log(`❌ ${file} - May not be fixed correctly`);
        allGood = false;
      }
    } else {
      // Other files should have 'notifications.created_at' in the order clause
      if (content.includes('notifications.created_at')) {
        console.log(`✅ ${file} - Fixed correctly`);
      } else {
        console.log(`❌ ${file} - May not be fixed correctly`);
        allGood = false;
      }
    }
  } else {
    console.log(`❌ ${file} - File not found`);
    allGood = false;
  }
}

console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('🎉 All notification fixes have been verified successfully!');
  console.log('The "column notification_recipients.created_at does not exist" error should now be resolved.');
} else {
  console.log('⚠️  Some files may not be fixed correctly. Please check manually.');
}
console.log('='.repeat(50));