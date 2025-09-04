const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugStudentDataAccess() {
  console.log('🔍 DEBUGGING STUDENT DATA ACCESS ISSUES...\n');

  try {
    // Step 1: Check authentication status
    console.log('1. 🔐 Checking authentication status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('❌ Authentication error:', authError.message);
      console.log('💡 SOLUTION: You need to be authenticated to access student data');
      console.log('   - Sign in to the application first');
      console.log('   - Ensure your JWT token includes tenant_id');
      return;
    }
    
    if (!user) {
      console.log('❌ No authenticated user found');
      console.log('💡 SOLUTION: Sign in first to access student data');
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Decode JWT to check tenant_id
    try {
      const payload = JSON.parse(Buffer.from(user.access_token?.split('.')[1] || '', 'base64').toString());
      console.log('🎫 JWT payload tenant_id:', payload.tenant_id || '❌ MISSING');
      
      if (!payload.tenant_id) {
        console.log('⚠️  No tenant_id in JWT token - this is likely the main issue');
      }
    } catch (e) {
      console.log('⚠️  Unable to decode JWT token');
    }

    // Step 2: Check if students table exists and has data
    console.log('\n2. 📊 Checking students table structure and data...');
    
    // First try to get table info (this should work even without RLS)
    const { data: tableData, error: tableError } = await supabase
      .from('students')
      .select('id, name, tenant_id')
      .limit(1);
      
    if (tableError) {
      console.log('❌ Error accessing students table:', tableError.message);
      console.log('📋 Error details:', JSON.stringify(tableError, null, 2));
      
      // Analyze the error type
      if (tableError.message.includes('permission denied') || tableError.code === '42501') {
        console.log('\n💡 DIAGNOSIS: Permission/RLS Issue');
        console.log('   - Row Level Security (RLS) is blocking access');
        console.log('   - Your user lacks proper tenant_id in JWT token');
        console.log('   - RLS policies require tenant_id to match');
      } else if (tableError.message.includes('relation') || tableError.code === '42P01') {
        console.log('\n💡 DIAGNOSIS: Table Missing');
        console.log('   - The students table does not exist');
        console.log('   - Database migration may be incomplete');
      } else {
        console.log('\n💡 DIAGNOSIS: Unknown Database Error');
        console.log('   - Check database connection');
        console.log('   - Verify table permissions');
      }
    } else {
      console.log('✅ Students table accessible');
      console.log(`📈 Found ${tableData?.length || 0} student(s) (limited to 1 for test)`);
      
      if (tableData && tableData.length > 0) {
        console.log('📋 Sample student:', {
          id: tableData[0].id,
          name: tableData[0].name,
          tenant_id: tableData[0].tenant_id
        });
      }
    }

    // Step 3: Check tenant information
    console.log('\n3. 🏫 Checking tenant information...');
    
    // Try to get user's tenant from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id, role_id, email')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      console.log('❌ Error getting user tenant info:', userError.message);
      console.log('💡 SOLUTION: User may not exist in users table');
    } else {
      console.log('✅ User tenant info:', {
        tenant_id: userData.tenant_id,
        role_id: userData.role_id,
        email: userData.email
      });
      
      // Check if this tenant exists
      if (userData.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, status')
          .eq('id', userData.tenant_id)
          .single();
          
        if (tenantError) {
          console.log('❌ Error getting tenant details:', tenantError.message);
        } else {
          console.log('✅ Tenant details:', {
            id: tenantData.id,
            name: tenantData.name,
            status: tenantData.status
          });
        }
      }
    }

    // Step 4: Test direct student query without RLS bypass
    console.log('\n4. 🧪 Testing student queries...');
    
    // Test 1: Simple select
    const { data: simpleData, error: simpleError } = await supabase
      .from('students')
      .select('id, name, admission_no')
      .limit(5);
      
    console.log('Test 1 - Simple select:', {
      success: !simpleError,
      error: simpleError?.message,
      count: simpleData?.length || 0
    });
    
    // Test 2: With JOIN
    const { data: joinData, error: joinError } = await supabase
      .from('students')
      .select(`
        id, name, admission_no,
        classes:class_id (
          id, class_name, section
        )
      `)
      .limit(3);
      
    console.log('Test 2 - With JOIN:', {
      success: !joinError,
      error: joinError?.message,
      count: joinData?.length || 0
    });
    
    // Test 3: Specific tenant query (if we know tenant_id)
    if (userData?.tenant_id) {
      const { data: tenantData, error: tenantError } = await supabase
        .from('students')
        .select('id, name, tenant_id')
        .eq('tenant_id', userData.tenant_id)
        .limit(5);
        
      console.log('Test 3 - Tenant-specific query:', {
        success: !tenantError,
        error: tenantError?.message,
        count: tenantData?.length || 0,
        tenant_id: userData.tenant_id
      });
    }

    // Step 5: Check RLS policies
    console.log('\n5. 🔒 Checking RLS policies (if accessible)...');
    
    try {
      const { data: policies, error: policyError } = await supabase.rpc('get_policies', {
        schema_name: 'public',
        table_name: 'students'
      });
      
      if (policies) {
        console.log('✅ RLS policies found:', policies.length);
      } else if (policyError) {
        console.log('⚠️  Cannot check RLS policies:', policyError.message);
      }
    } catch (e) {
      console.log('⚠️  Cannot check RLS policies (function may not exist)');
    }

    // Step 6: Provide solutions
    console.log('\n' + '='.repeat(60));
    console.log('🔧 SOLUTIONS BASED ON DIAGNOSIS:');
    console.log('='.repeat(60));
    
    if (!user) {
      console.log('\n1. AUTHENTICATION ISSUE:');
      console.log('   - Sign in to the application first');
      console.log('   - Use: supabase.auth.signInWithPassword({email, password})');
    }
    
    console.log('\n2. TENANT_ID ISSUE (Most Common):');
    console.log('   - Your JWT token is missing tenant_id');
    console.log('   - Fix: Update user metadata with tenant_id');
    console.log('   - Run: UPDATE auth.users SET app_metadata = app_metadata || \'{"tenant_id":"your-tenant-id"}\' WHERE id = \'user-id\';');
    console.log('   - Or: Use service key to bypass RLS temporarily');
    
    console.log('\n3. RLS POLICY ISSUE:');
    console.log('   - RLS policies are blocking data access');
    console.log('   - Fix: Update RLS policies to match your authentication setup');
    console.log('   - Run: The fix_rls_data_access.sql script');
    
    console.log('\n4. SERVICE KEY BYPASS (Quick Fix):');
    console.log('   - Create a service key client for admin operations');
    console.log('   - Use: createClient(url, serviceKey) instead of anon key');
    console.log('   - WARNING: Only use service key server-side');
    
    console.log('\n5. DATA VERIFICATION:');
    console.log('   - Check if student records actually exist in database');
    console.log('   - Verify tenant_id values match your user\'s tenant');
    console.log('   - Run: SELECT COUNT(*) FROM students WHERE tenant_id = \'your-tenant-id\';');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.log('\nDEBUG INFO:', error);
  }
}

// Function to test with different authentication methods
async function testWithDifferentAuth() {
  console.log('\n🔄 Testing with different authentication methods...');
  
  // Test 1: Try with current session
  console.log('\nTest 1: Current session');
  await debugStudentDataAccess();
  
  // Test 2: Instructions for service key test
  console.log('\n' + '='.repeat(50));
  console.log('Test 2: SERVICE KEY TEST (Server-side only)');
  console.log('='.repeat(50));
  console.log('To test with service key (DANGEROUS - server only):');
  console.log('1. Get your service key from Supabase dashboard');
  console.log('2. Replace anon key with service key in this script');
  console.log('3. Run the test again');
  console.log('4. ⚠️  NEVER use service key in client applications');
  console.log('');
  console.log('Service key client would look like:');
  console.log('const supabase = createClient(url, SERVICE_ROLE_KEY);');
}

// Main execution
if (require.main === module) {
  debugStudentDataAccess().then(() => {
    console.log('\n🏁 Student data access diagnostic complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Diagnostic failed:', err.message);
    process.exit(1);
  });
}

module.exports = { debugStudentDataAccess, testWithDifferentAuth };
