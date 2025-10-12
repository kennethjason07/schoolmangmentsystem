const fs = require('fs');
const path = require('path');

// This script will help you execute the hostel database schema
// directly using Node.js if you can't access Supabase Dashboard

async function setupHostelDatabase() {
  console.log('🏫 HOSTEL DATABASE SETUP SCRIPT');
  console.log('================================\n');
  
  // Read the SQL file
  const sqlFilePath = path.join(__dirname, 'EXECUTE_THIS_IN_SUPABASE.sql');
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error('❌ Error: EXECUTE_THIS_IN_SUPABASE.sql file not found!');
    console.log('   Make sure the file exists in the project root.');
    return;
  }
  
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  
  console.log('✅ SQL file loaded successfully');
  console.log(`📄 File size: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);
  
  console.log('🔧 MANUAL SETUP REQUIRED:');
  console.log('=========================\n');
  
  console.log('Since you\'re getting "relation does not exist" errors, you need to:');
  console.log('\n1. 🌐 Go to your Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard\n');
  
  console.log('2. 🎯 Select your project\n');
  
  console.log('3. 📝 Open SQL Editor (in left sidebar)\n');
  
  console.log('4. ➕ Click "New query"\n');
  
  console.log('5. 📋 Copy and paste this ENTIRE SQL content:\n');
  console.log('   ┌─────────────────────────────────────────────┐');
  console.log('   │ The content is in: EXECUTE_THIS_IN_SUPABASE.sql │');
  console.log('   │ File path: ' + sqlFilePath);
  console.log('   └─────────────────────────────────────────────┘\n');
  
  console.log('6. ▶️  Click "Run" button to execute\n');
  
  console.log('7. ✅ Wait for "Tables Created Successfully!" message\n');
  
  console.log('📊 THIS WILL CREATE:');
  console.log('===================');
  console.log('✓ hostels table');
  console.log('✓ blocks table');  
  console.log('✓ rooms table        <- This fixes your first error');
  console.log('✓ beds table         <- This fixes your second error');
  console.log('✓ hostel_applications table');
  console.log('✓ bed_allocations table');
  console.log('✓ All necessary indexes');
  console.log('✓ Row Level Security policies\n');
  
  console.log('🚀 AFTER EXECUTING THE SQL:');
  console.log('==========================');
  console.log('Your application should work without the "relation does not exist" errors!\n');
  
  console.log('❓ TROUBLESHOOTING:');
  console.log('==================');
  console.log('If you still get errors after running the SQL:');
  console.log('• Make sure you\'re logged into the correct Supabase project');
  console.log('• Check that your app is connected to the same database');
  console.log('• Verify your authentication and tenant setup');
  console.log('• Try refreshing your application\n');
  
  // Also create a simple copy script
  console.log('💡 TIP: The SQL content starts with:');
  console.log('=====================================');
  const firstLines = sqlContent.split('\n').slice(0, 10).join('\n');
  console.log(firstLines);
  console.log('...\n(and continues for ~310 lines)\n');
  
  console.log('🎉 Good luck! Your hostel management system will work after this setup.');
}

// Alternative: If you have Supabase connection details, uncomment this section
/*
async function executeDirectly() {
  // Uncomment and configure these if you want to run directly
  // const { createClient } = require('@supabase/supabase-js');
  // 
  // const supabaseUrl = 'YOUR_SUPABASE_URL';
  // const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // NOT anon key!
  // 
  // const supabase = createClient(supabaseUrl, supabaseServiceKey);
  // 
  // const sqlFilePath = path.join(__dirname, 'EXECUTE_THIS_IN_SUPABASE.sql');
  // const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  // 
  // console.log('🚀 Executing SQL directly...');
  // 
  // try {
  //   const { data, error } = await supabase.rpc('exec_sql', { 
  //     sql_query: sqlContent 
  //   });
  //   
  //   if (error) {
  //     console.error('❌ Error:', error);
  //   } else {
  //     console.log('✅ Success:', data);
  //   }
  // } catch (err) {
  //   console.error('❌ Exception:', err.message);
  // }
}
*/

if (require.main === module) {
  setupHostelDatabase();
}

module.exports = { setupHostelDatabase };