const { createClient } = require('@supabase/supabase-js');

// Use the same config as the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

console.log('🔧 Debugging Leave Applications Table');

const supabase = createClient(supabaseUrl, supabaseKey);

const debugLeaveApplications = async () => {
  try {
    console.log('🔍 DEBUGGING LEAVE APPLICATIONS ACCESS');
    console.log('=====================================');
    
    console.log('\n1. 📊 Testing leave_applications table access...');
    const { data: applications, error } = await supabase
      .from('leave_applications')
      .select('*')
      .limit(10);
    
    console.log('📊 Leave applications query result:');
    console.log('   - Applications found:', applications?.length || 0);
    console.log('   - Error:', error?.message || 'None');
    console.log('   - Error code:', error?.code || 'None');
    console.log('   - Error details:', error?.details || 'None');
    
    if (error) {
      console.error('❌ Error accessing leave applications:', error);
      
      // Check for specific error types
      if (error.code === '42501') {
        console.log('🔒 RLS is blocking access to leave_applications table');
        console.log('📝 Solution: Run fix_leaves_rls.sql in Supabase SQL Editor');
      } else if (error.code === '42P01') {
        console.log('🚫 Table leave_applications does not exist');
        console.log('📝 Solution: Create the leave_applications table in Supabase');
      }
      return;
    }
    
    if (applications && applications.length > 0) {
      console.log('\n2. 📋 Found leave applications:');
      applications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.employee_name || 'Unknown'} - ${app.leave_type} (${app.status})`);
        console.log(`      Dates: ${app.start_date} to ${app.end_date}`);
        console.log(`      Reason: ${app.reason || 'No reason provided'}`);
        console.log(`      Applied: ${app.applied_date}`);
        console.log('');
      });
    } else {
      console.log('\n2. 📋 No leave applications found in database');
      console.log('   - This could mean:');
      console.log('     • Table is empty (need to add sample data)');
      console.log('     • RLS is blocking access (need to run RLS fix)');
      console.log('     • Table structure mismatch');
    }
    
    console.log('\n3. 🔍 Checking table structure...');
    try {
      // Try to get table info by doing a limited select
      const { data: schemaCheck } = await supabase
        .from('leave_applications')
        .select('*')
        .limit(1);
      
      if (schemaCheck !== null) {
        console.log('✅ Table exists and is accessible');
      }
    } catch (schemaError) {
      console.log('❌ Table structure issue:', schemaError.message);
    }
    
    console.log('\n4. 🎯 RECOMMENDATIONS:');
    if (error?.code === '42501') {
      console.log('   1. Run fix_leaves_rls.sql in Supabase SQL Editor');
      console.log('   2. This will create RLS policies for leave_applications table');
      console.log('   3. Also creates sample leave data if table is empty');
    } else if (error?.code === '42P01') {
      console.log('   1. Create leave_applications table in Supabase');
      console.log('   2. Set up proper schema with all required fields');
      console.log('   3. Then run fix_leaves_rls.sql');
    } else if (!applications || applications.length === 0) {
      console.log('   1. Table exists but is empty');
      console.log('   2. Run fix_leaves_rls.sql to add sample data');
      console.log('   3. Or add leave applications through the app');
    } else {
      console.log('   ✅ Everything looks good! Leave applications should work.');
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
    console.log('📝 Check your internet connection and Supabase configuration');
  }
};

debugLeaveApplications();
