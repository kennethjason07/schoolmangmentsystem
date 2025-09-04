const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Test user credentials - replace with actual
const testEmail = 'kenj7214@gmail.com';
const testPassword = process.env.SUPABASE_USER_PASSWORD || 'YOUR_PASSWORD';

console.log('=== TESTING getUserTenantId FUNCTION ===\n');

// Replicate the getUserTenantId function from your app
const getUserTenantId = async (supabase) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No authenticated user found for tenant context');
      return null;
    }

    console.log('🔍 [getUserTenantId] User ID:', user.id);
    console.log('🔍 [getUserTenantId] User email:', user.email);

    // First check user metadata for tenant_id
    const metadataTenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
    console.log('🔍 [getUserTenantId] app_metadata:', JSON.stringify(user.app_metadata || {}, null, 2));
    console.log('🔍 [getUserTenantId] user_metadata:', JSON.stringify(user.user_metadata || {}, null, 2));
    console.log('🔍 [getUserTenantId] metadataTenantId:', metadataTenantId);
    
    if (metadataTenantId) {
      console.log(`Found tenant_id in user metadata: ${metadataTenantId}`);
      return metadataTenantId;
    }

    // Try to get user's tenant_id from profile table
    try {
      console.log('🔍 [getUserTenantId] Trying to get tenant_id from users table...');
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('tenant_id, email, role_id')
        .eq('id', user.id)
        .maybeSingle();

      console.log('🔍 [getUserTenantId] Profile query result:');
      console.log('   - Found user profile:', !!userProfile);
      console.log('   - Profile tenant_id:', userProfile?.tenant_id);
      console.log('   - Profile email:', userProfile?.email);
      console.log('   - Profile role_id:', userProfile?.role_id);
      console.log('   - Error:', profileError?.message || 'None');
      console.log('   - Error code:', profileError?.code || 'None');

      if (!profileError && userProfile && userProfile.tenant_id) {
        console.log(`✅ Found tenant_id in user profile: ${userProfile.tenant_id}`);
        return userProfile.tenant_id;
      }

      if (profileError) {
        console.warn('❌ Error accessing user profile table:', profileError);
      } else {
        console.warn('⚠️ No tenant_id found in user profile');
      }
    } catch (profileError) {
      console.warn('💥 Could not access user profile table:', profileError);
    }

    // Use default tenant_id as fallback
    const defaultTenantId = '00000000-0000-0000-0000-000000000001';
    console.warn(`⚠️ Using default tenant_id as fallback: ${defaultTenantId}`);
    
    return defaultTenantId;
  } catch (error) {
    console.error('💥 Error in getUserTenantId:', error);
    const defaultTenantId = '00000000-0000-0000-0000-000000000001';
    console.warn(`⚠️ Using default tenant_id due to error: ${defaultTenantId}`);
    return defaultTenantId;
  }
};

async function testUserTenantId() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Test without authentication first
    console.log('🔍 Testing getUserTenantId without authentication...');
    const noAuthTenantId = await getUserTenantId(supabase);
    console.log('Result without auth:', noAuthTenantId);
    
    // Try to authenticate
    if (testPassword === 'YOUR_PASSWORD') {
      console.log('\\n⚠️ No password provided - skipping authentication test');
      console.log('Run with: SUPABASE_USER_PASSWORD=your_password node scripts/test_user_tenant_id.js');
      return;
    }
    
    console.log('\\n🔐 Attempting to sign in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.log('❌ Authentication failed:', authError.message);
      return;
    }
    
    console.log('✅ Authentication successful!');
    console.log('   - User ID:', authData.user?.id);
    console.log('   - User email:', authData.user?.email);
    
    // Test getUserTenantId with authentication
    console.log('\\n🔍 Testing getUserTenantId with authentication...');
    const authTenantId = await getUserTenantId(supabase);
    console.log('Result with auth:', authTenantId);
    
    // Check the JWT token content
    console.log('\\n🔍 Analyzing JWT token...');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        const token = session.access_token;
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(atob(base64Payload));
        
        console.log('JWT Payload:');
        console.log('   - sub (user_id):', payload.sub);
        console.log('   - email:', payload.email);
        console.log('   - role:', payload.role);
        console.log('   - tenant_id in JWT:', payload.tenant_id || '❌ MISSING!');
        console.log('   - app_metadata:', JSON.stringify(payload.app_metadata || {}, null, 2));
        console.log('   - user_metadata:', JSON.stringify(payload.user_metadata || {}, null, 2));
        
      } catch (e) {
        console.log('❌ Failed to decode JWT:', e.message);
      }
    }
    
    // Now test notifications query with this tenant_id
    console.log('\\n🔍 Testing notifications query with resolved tenant_id...');
    console.log('Using tenant_id:', authTenantId);
    
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, type, message, tenant_id, delivery_status')
      .eq('tenant_id', authTenantId)
      .limit(5);
    
    console.log('Notifications query result:');
    console.log('   - Found:', notifications?.length || 0);
    console.log('   - Error:', notifError?.message || 'None');
    console.log('   - Error code:', notifError?.code || 'None');
    
    if (notifications && notifications.length > 0) {
      console.log('   - Sample notifications:');
      notifications.forEach(n => {
        console.log(`     * "${n.message?.substring(0, 40)}..." (tenant: ${n.tenant_id})`);
      });
    }
    
    // Also test query without tenant filter to see if notifications exist at all
    console.log('\\n🔍 Testing notifications query without tenant filter...');
    const { data: allNotifications, error: allError } = await supabase
      .from('notifications')
      .select('id, type, message, tenant_id, delivery_status')
      .limit(5);
    
    console.log('All notifications query result:');
    console.log('   - Found:', allNotifications?.length || 0);
    console.log('   - Error:', allError?.message || 'None');
    console.log('   - Error code:', allError?.code || 'None');
    
    if (allNotifications && allNotifications.length > 0) {
      console.log('   - Sample notifications:');
      allNotifications.forEach(n => {
        console.log(`     * "${n.message?.substring(0, 40)}..." (tenant: ${n.tenant_id})`);
      });
    }
    
    // CRITICAL ANALYSIS
    console.log('\\n=== ANALYSIS ===');
    console.log(`Expected tenant_id: b8f8b5f0-1234-4567-8901-123456789000`);
    console.log(`Resolved tenant_id: ${authTenantId}`);
    console.log(`Match: ${authTenantId === 'b8f8b5f0-1234-4567-8901-123456789000'}`);
    
    if (authTenantId !== 'b8f8b5f0-1234-4567-8901-123456789000') {
      console.log('\\n❌ ISSUE IDENTIFIED:');
      console.log('The getUserTenantId function is returning the wrong tenant_id!');
      console.log('This is why RLS policies block access to notifications.');
      console.log('\\nSOLUTION: Update the JWT token or user metadata to include the correct tenant_id.');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testUserTenantId();
