#!/usr/bin/env node

/**
 * Fix validateTenantAccess Parameter Order
 * 
 * This script fixes all instances where validateTenantAccess is called with
 * parameters in the wrong order: (tenantId, userId) -> (userId, tenantId)
 */

const fs = require('fs');
const path = require('path');

// List of files that need to be fixed based on grep results
const filesToFix = [
  'src/screens/admin/FeeManagement.js',
  'src/screens/admin/MarksEntry.js', 
  'src/screens/admin/ExpenseManagement.js',
  'src/screens/admin/ExamsMarks.js',
  'src/screens/admin/LeaveManagement.js',
  'src/screens/admin/ManageClasses.js',
  'src/screens/admin/ManageTeachers.js',
  'src/screens/admin/AdminNotifications.js',
  'src/screens/parent/Notifications.js',
  'src/utils/optimizedFeeHelpers.js',
  'src/screens/teacher/TeacherTimetable.js'
];

// Patterns to find and replace
const patterns = [
  {
    // Pattern 1: validateTenantAccess(tenantId, user?.id, ...)
    find: /validateTenantAccess\(tenantId,\s*user\?\.id/g,
    replace: 'validateTenantAccess(user?.id, tenantId'
  },
  {
    // Pattern 2: validateTenantAccess(tenantId, userId, ...)
    find: /validateTenantAccess\(tenantId,\s*userId/g,
    replace: 'validateTenantAccess(userId, tenantId'
  },
  {
    // Pattern 3: validateTenantAccess(tenantId, user.id, ...)
    find: /validateTenantAccess\(tenantId,\s*user\.id/g,
    replace: 'validateTenantAccess(user.id, tenantId'
  }
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  
  // Apply all patterns
  for (const pattern of patterns) {
    const originalContent = content;
    content = content.replace(pattern.find, pattern.replace);
    if (content !== originalContent) {
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed parameter order in: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed in: ${filePath}`);
    return false;
  }
}

// Main execution
console.log('🔧 Fixing validateTenantAccess parameter order...\n');

let totalFixed = 0;

for (const file of filesToFix) {
  if (fixFile(file)) {
    totalFixed++;
  }
}

console.log(`\n📊 Summary: Fixed ${totalFixed} out of ${filesToFix.length} files`);

if (totalFixed > 0) {
  console.log('\n✅ Fix completed! Please test your application.');
  console.log('\n📋 What was changed:');
  console.log('   validateTenantAccess(tenantId, user?.id, ...) → validateTenantAccess(user?.id, tenantId, ...)');
  console.log('   validateTenantAccess(tenantId, userId, ...) → validateTenantAccess(userId, tenantId, ...)');
  console.log('   validateTenantAccess(tenantId, user.id, ...) → validateTenantAccess(user.id, tenantId, ...)');
} else {
  console.log('\n👍 All files are already using the correct parameter order!');
}
