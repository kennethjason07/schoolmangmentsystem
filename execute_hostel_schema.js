const fs = require('fs');
const path = require('path');

// ============================================================================
// 🏫 BACKEND HOSTEL SCHEMA EXECUTOR
// ============================================================================
// 
// This script helps you execute the hostel schema SQL directly
// Use this if you can't access Supabase Dashboard directly
// ============================================================================

async function executeHostelSchema() {
  console.log('🏫 HOSTEL SCHEMA EXECUTOR');
  console.log('========================\n');

  // Step 1: Check if SQL file exists
  const sqlFilePath = path.join(__dirname, 'ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql');
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error('❌ Error: ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql file not found!');
    console.log('   Make sure the file exists in the project root.');
    return;
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log('✅ SQL schema file loaded successfully');
  console.log(`📄 File size: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

  // Step 2: Show manual instructions (primary method)
  console.log('🎯 RECOMMENDED: MANUAL EXECUTION IN SUPABASE DASHBOARD');
  console.log('=======================================================\n');
  console.log('1. 🌐 Go to: https://supabase.com/dashboard');
  console.log('2. 🎯 Select your school management project');
  console.log('3. 📝 Open SQL Editor (left sidebar)');
  console.log('4. ➕ Click "New query"');
  console.log('5. 📋 Copy the entire content of: ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql');
  console.log('6. 📝 Paste it into the SQL Editor');
  console.log('7. ▶️  Click "Run" button');
  console.log('8. ✅ Wait for success message\n');

  console.log('📊 THIS WILL ADD TO YOUR EXISTING DATABASE:');
  console.log('============================================');
  console.log('✅ hostels table');
  console.log('✅ blocks table');
  console.log('✅ rooms table          <- Fixes your "rooms" error');
  console.log('✅ beds table           <- Fixes your "beds" error');
  console.log('✅ hostel_applications table');
  console.log('✅ bed_allocations table');
  console.log('✅ hostel_fee_payments table <- You requested this');
  console.log('✅ hostel_maintenance_logs table');
  console.log('✅ All indexes and RLS policies');
  console.log('✅ Warden role\n');

  console.log('⚡ AFTER EXECUTION:');
  console.log('==================');
  console.log('Your hostel management features will work immediately!');
  console.log('No more "relation does not exist" errors.\n');

  // Step 3: Alternative automated method (requires configuration)
  console.log('🤖 ALTERNATIVE: AUTOMATED EXECUTION (Advanced)');
  console.log('===============================================');
  console.log('If you want to execute automatically, uncomment and configure');
  console.log('the executeDirectlyWithSupabase() function below.\n');

  console.log('📋 WHAT YOU NEED:');
  console.log('- Supabase Project URL');
  console.log('- Service Role Key (NOT the anon key)');
  console.log('- Uncomment the function at the bottom of this file\n');

  console.log('🚀 Ready to go? Execute the SQL in Supabase Dashboard now!');
}

// Alternative automated execution method
// UNCOMMENT AND CONFIGURE THIS IF YOU WANT AUTOMATIC EXECUTION
/*
async function executeDirectlyWithSupabase() {
  try {
    console.log('🤖 Attempting automated execution...\n');
    
    // CONFIGURE THESE VALUES:
    const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL'; // e.g., https://xyz.supabase.co
    const SUPABASE_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // NOT the anon key!
    
    // Validate configuration
    if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL' || SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY') {
      console.log('⚠️  Configuration needed!');
      console.log('   Edit this file and set your Supabase URL and Service Role Key');
      console.log('   Then uncomment this function.\n');
      return;
    }
    
    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Read SQL file
    const sqlFilePath = path.join(__dirname, 'ADD_HOSTEL_TABLES_TO_EXISTING_DB.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📤 Executing SQL schema...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });
    
    if (error) {
      console.error('❌ Error executing SQL:', error);
      console.log('\n💡 Try manual execution in Supabase Dashboard instead.');
    } else {
      console.log('✅ Success! Hostel tables created:', data);
      console.log('\n🎉 Your hostel management system is now ready!');
    }
    
  } catch (err) {
    console.error('❌ Execution failed:', err.message);
    console.log('\n💡 Please use manual execution in Supabase Dashboard.');
  }
}
*/

// Validation function to check if tables exist
async function validateHostelTables() {
  console.log('🔍 VALIDATION: Check if hostel tables exist');
  console.log('=============================================\n');
  
  // This would require Supabase connection - showing what to check
  console.log('After executing the schema, verify these tables exist:');
  console.log('1. hostels');
  console.log('2. blocks'); 
  console.log('3. rooms');
  console.log('4. beds');
  console.log('5. hostel_applications');
  console.log('6. bed_allocations');
  console.log('7. hostel_fee_payments');
  console.log('8. hostel_maintenance_logs\n');
  
  console.log('💡 You can verify by running this query in Supabase SQL Editor:');
  console.log('SELECT table_name FROM information_schema.tables');
  console.log('WHERE table_schema = \'public\''); 
  console.log('AND table_name LIKE \'%hostel%\' OR table_name IN (\'rooms\', \'beds\', \'blocks\');');
}

// Main execution
if (require.main === module) {
  executeHostelSchema();
}

module.exports = { 
  executeHostelSchema, 
  validateHostelTables 
};