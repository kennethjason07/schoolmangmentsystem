const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Known user credentials - update these with actual user credentials
const testEmail = 'kenj7214@gmail.com'; // Update with actual email
const testPassword = 'YOUR_PASSWORD'; // Update with actual password
const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';

console.log('=== TESTING WITH USER SESSION ===\\n');

async function testWithUserLogin() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Step 1: Try to sign in as the user
    console.log('🔐 Attempting to sign in as:', testEmail);
    
    if (testPassword === 'YOUR_PASSWORD') {
      console.log('❌ Please update the testPassword in the script with the actual password');
      console.log('Or run with: SUPABASE_USER_PASSWORD=actual_password node scripts/test_with_user_session.js');
      return;
    }
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.log('❌ Login failed:', authError.message);
      console.log('This is expected - we\'ll test without login');
      
      // Test without login (anonymous)
      console.log('\\n🔍 Testing without authentication...');
      await testNotificationAccess(supabase, false);
      return;
    }
    
    console.log('✅ Login successful!');
    console.log('  - User ID:', authData.user?.id);
    console.log('  - User email:', authData.user?.email);
    
    // Get user record from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role_id, tenant_id')
      .eq('email', testEmail)
      .single();
    
    console.log('\\n📋 User database record:');
    console.log('  - Found:', !!userData);
    console.log('  - Role ID:', userData?.role_id);
    console.log('  - Tenant ID:', userData?.tenant_id);
    console.log('  - Error:', userError?.message || 'None');
    
    // Test notification access with authenticated user
    console.log('\\n🔍 Testing with authenticated user...');
    await testNotificationAccess(supabase, true, userData);
    
  } catch (error) {\r
    console.error('💥 Error in login test:', error);\r
  }\r
}\r
\r
async function testNotificationAccess(supabase, isAuthenticated, userData = null) {\r
  try {\r
    console.log('\n--- Notification Access Test ---');\r
    console.log('Authenticated:', isAuthenticated);\r
    if (userData) {\r
      console.log('User tenant_id:', userData.tenant_id);\r
      console.log('User role_id:', userData.role_id);\r
    }\r
    \r
    // Test 1: Count notifications\r
    const { count: totalCount, error: countError } = await supabase\r
      .from('notifications')\r
      .select('*', { count: 'exact', head: true });\r
    \r
    console.log('\nCount query:');\r
    console.log('  - Total count:', totalCount);\r
    console.log('  - Error:', countError?.message || 'None');\r
    console.log('  - Error code:', countError?.code || 'None');\r
    \r
    // Test 2: Select all notifications\r
    const { data: allNotifications, error: allError } = await supabase\r
      .from('notifications')\r
      .select('id, type, message, tenant_id, delivery_status, created_at');\r
    \r
    console.log('\nSelect all query:');\r
    console.log('  - Found:', allNotifications?.length || 0);\r
    console.log('  - Error:', allError?.message || 'None');\r
    console.log('  - Error code:', allError?.code || 'None');\r
    \r
    if (allNotifications && allNotifications.length > 0) {\r
      console.log('  - Sample notifications:');\r
      allNotifications.slice(0, 3).forEach(n => {\r
        console.log(`    * ID: ${n.id}`);\r
        console.log(`      Type: ${n.type}`);\r
        console.log(`      Tenant: ${n.tenant_id}`);\r
        console.log(`      Status: ${n.delivery_status}`);\r
        console.log(`      Message: \"${n.message?.substring(0, 40)}...\"`);\r
        console.log(`      Matches target tenant: ${n.tenant_id === knownTenantId}`);\r
      });\r
    }\r
    \r
    // Test 3: Select with tenant filter\r
    const { data: tenantFiltered, error: tenantError } = await supabase\r
      .from('notifications')\r
      .select('id, type, message, tenant_id, delivery_status')\r
      .eq('tenant_id', knownTenantId);\r
    \r
    console.log('\nTenant filtered query:');\r
    console.log('  - Found with tenant filter:', tenantFiltered?.length || 0);\r
    console.log('  - Error:', tenantError?.message || 'None');\r
    console.log('  - Error code:', tenantError?.code || 'None');\r
    \r
    // Test 4: Test notification_recipients table\r
    const { data: recipients, error: recipientsError } = await supabase\r
      .from('notification_recipients')\r
      .select('id, notification_id, recipient_type, tenant_id')\r
      .eq('tenant_id', knownTenantId);\r
    \r
    console.log('\nNotification recipients query:');\r
    console.log('  - Recipients found:', recipients?.length || 0);\r
    console.log('  - Error:', recipientsError?.message || 'None');\r
    console.log('  - Error code:', recipientsError?.code || 'None');\r
    \r
    // Test 5: Try the exact query from NotificationManagement.js\r
    console.log('\nTesting exact query from NotificationManagement.js:');\r
    const { data: exactQuery, error: exactError } = await supabase\r
      .from('notifications')\r
      .select(`\r
        *,\r
        notification_recipients(\r
          id,\r
          recipient_id,\r
          recipient_type,\r
          delivery_status,\r
          sent_at,\r
          tenant_id\r
        ),\r
        users!sent_by(\r
          id,\r
          full_name,\r
          role_id\r
        )\r
      `)\r
      .eq('tenant_id', knownTenantId)\r
      .order('created_at', { ascending: false });\r
    \r
    console.log('  - Exact query result:', exactQuery?.length || 0);\r
    console.log('  - Error:', exactError?.message || 'None');\r
    console.log('  - Error code:', exactError?.code || 'None');\r
    \r
    if (exactError) {\r
      console.log('  - Error details:', exactError.details || 'None');\r
      console.log('  - Error hint:', exactError.hint || 'None');\r
    }\r
    \r
  } catch (error) {\r
    console.error('💥 Error in access test:', error);\r
  }\r
}\r
\r
// Check if password provided via environment variable\r
const envPassword = process.env.SUPABASE_USER_PASSWORD;\r
if (envPassword) {\r
  testPassword = envPassword;\r
  testWithUserLogin();\r
} else {\r
  console.log('📝 To test with user login, provide password:');\r
  console.log('   SUPABASE_USER_PASSWORD=your_password node scripts/test_with_user_session.js');\r
  console.log('\n🔍 Testing without authentication instead...\n');\r
  \r
  const supabase = createClient(supabaseUrl, supabaseAnonKey);\r
  testNotificationAccess(supabase, false);\r
}\r
"}}