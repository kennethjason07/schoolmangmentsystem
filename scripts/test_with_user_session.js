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
    
  } catch (error) {\r\n    console.error('💥 Error in login test:', error);\r\n  }\r\n}\r\n\r\nasync function testNotificationAccess(supabase, isAuthenticated, userData = null) {\r\n  try {\r\n    console.log('\\n--- Notification Access Test ---');\r\n    console.log('Authenticated:', isAuthenticated);\r\n    if (userData) {\r\n      console.log('User tenant_id:', userData.tenant_id);\r\n      console.log('User role_id:', userData.role_id);\r\n    }\r\n    \r\n    // Test 1: Count notifications\r\n    const { count: totalCount, error: countError } = await supabase\r\n      .from('notifications')\r\n      .select('*', { count: 'exact', head: true });\r\n    \r\n    console.log('\\nCount query:');\r\n    console.log('  - Total count:', totalCount);\r\n    console.log('  - Error:', countError?.message || 'None');\r\n    console.log('  - Error code:', countError?.code || 'None');\r\n    \r\n    // Test 2: Select all notifications\r\n    const { data: allNotifications, error: allError } = await supabase\r\n      .from('notifications')\r\n      .select('id, type, message, tenant_id, delivery_status, created_at');\r\n    \r\n    console.log('\\nSelect all query:');\r\n    console.log('  - Found:', allNotifications?.length || 0);\r\n    console.log('  - Error:', allError?.message || 'None');\r\n    console.log('  - Error code:', allError?.code || 'None');\r\n    \r\n    if (allNotifications && allNotifications.length > 0) {\r\n      console.log('  - Sample notifications:');\r\n      allNotifications.slice(0, 3).forEach(n => {\r\n        console.log(`    * ID: ${n.id}`);\r\n        console.log(`      Type: ${n.type}`);\r\n        console.log(`      Tenant: ${n.tenant_id}`);\r\n        console.log(`      Status: ${n.delivery_status}`);\r\n        console.log(`      Message: \"${n.message?.substring(0, 40)}...\"`);\r\n        console.log(`      Matches target tenant: ${n.tenant_id === knownTenantId}`);\r\n      });\r\n    }\r\n    \r\n    // Test 3: Select with tenant filter\r\n    const { data: tenantFiltered, error: tenantError } = await supabase\r\n      .from('notifications')\r\n      .select('id, type, message, tenant_id, delivery_status')\r\n      .eq('tenant_id', knownTenantId);\r\n    \r\n    console.log('\\nTenant filtered query:');\r\n    console.log('  - Found with tenant filter:', tenantFiltered?.length || 0);\r\n    console.log('  - Error:', tenantError?.message || 'None');\r\n    console.log('  - Error code:', tenantError?.code || 'None');\r\n    \r\n    // Test 4: Test notification_recipients table\r\n    const { data: recipients, error: recipientsError } = await supabase\r\n      .from('notification_recipients')\r\n      .select('id, notification_id, recipient_type, tenant_id')\r\n      .eq('tenant_id', knownTenantId);\r\n    \r\n    console.log('\\nNotification recipients query:');\r\n    console.log('  - Recipients found:', recipients?.length || 0);\r\n    console.log('  - Error:', recipientsError?.message || 'None');\r\n    console.log('  - Error code:', recipientsError?.code || 'None');\r\n    \r\n    // Test 5: Try the exact query from NotificationManagement.js\r\n    console.log('\\nTesting exact query from NotificationManagement.js:');\r\n    const { data: exactQuery, error: exactError } = await supabase\r\n      .from('notifications')\r\n      .select(`\r\n        *,\r\n        notification_recipients(\r\n          id,\r\n          recipient_id,\r\n          recipient_type,\r\n          delivery_status,\r\n          sent_at,\r\n          tenant_id\r\n        ),\r\n        users!sent_by(\r\n          id,\r\n          full_name,\r\n          role_id\r\n        )\r\n      `)\r\n      .eq('tenant_id', knownTenantId)\r\n      .order('created_at', { ascending: false });\r\n    \r\n    console.log('  - Exact query result:', exactQuery?.length || 0);\r\n    console.log('  - Error:', exactError?.message || 'None');\r\n    console.log('  - Error code:', exactError?.code || 'None');\r\n    \r\n    if (exactError) {\r\n      console.log('  - Error details:', exactError.details || 'None');\r\n      console.log('  - Error hint:', exactError.hint || 'None');\r\n    }\r\n    \r\n  } catch (error) {\r\n    console.error('💥 Error in access test:', error);\r\n  }\r\n}\r\n\r\n// Check if password provided via environment variable\r\nconst envPassword = process.env.SUPABASE_USER_PASSWORD;\r\nif (envPassword) {\r\n  testPassword = envPassword;\r\n  testWithUserLogin();\r\n} else {\r\n  console.log('📝 To test with user login, provide password:');\r\n  console.log('   SUPABASE_USER_PASSWORD=your_password node scripts/test_with_user_session.js');\r\n  console.log('\\n🔍 Testing without authentication instead...\\n');\r\n  \r\n  const supabase = createClient(supabaseUrl, supabaseAnonKey);\r\n  testNotificationAccess(supabase, false);\r\n}\r\n"}}
</function_results>

Now let's run the comprehensive debug to see exactly what's happening:

<function_calls>
<invoke name="run_command">
<parameter name="command">node scripts/comprehensive_notification_debug.js
