const { createClient } = require('@supabase/supabase-js');

// Use the same config as the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

console.log('🔧 Using hardcoded Supabase configuration');

const supabase = createClient(supabaseUrl, supabaseKey);

const debugAuthenticatedLookup = async () => {
  try {
    console.log('🔍 DEBUGGING AUTHENTICATED USER LOOKUP');
    console.log('======================================');
    
    const testEmail = 'kenj7214@gmail.com';
    const testPassword = 'password123';
    
    console.log('\n1. 🔐 Testing authentication...');
    const { data: { session, user }, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      return;
    }
    
    if (!user) {
      console.error('❌ No user returned from authentication');
      return;
    }
    
    console.log('✅ Authentication successful:');
    console.log('   - User ID:', user.id);
    console.log('   - Email:', user.email);
    console.log('   - Session:', !!session);
    
    console.log('\n2. 🔍 Testing user profile lookup (exact match)...');
    let userQuery = supabase
      .from('users')
      .select('*')
      .eq('email', testEmail);
    
    let { data: userProfile, error: profileError } = await userQuery.maybeSingle();
    
    console.log('📊 Exact match result:');
    console.log('   - Profile found:', !!userProfile);
    console.log('   - Error:', profileError?.message || 'None');
    console.log('   - Error code:', profileError?.code || 'None');
    
    if (userProfile) {
      console.log('   - User data:', {
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name,
        role_id: userProfile.role_id,
        tenant_id: userProfile.tenant_id
      });
    } else {
      console.log('\n3. 🔄 Trying case-insensitive lookup...');
      userQuery = supabase
        .from('users')
        .select('*')
        .ilike('email', testEmail);
      
      const result = await userQuery.maybeSingle();
      userProfile = result.data;
      profileError = result.error;
      
      console.log('📊 Case-insensitive result:');
      console.log('   - Profile found:', !!userProfile);
      console.log('   - Error:', profileError?.message || 'None');
      console.log('   - Error code:', profileError?.code || 'None');
      
      if (userProfile) {
        console.log('   - User data:', {
          id: userProfile.id,
          email: userProfile.email,
          full_name: userProfile.full_name,
          role_id: userProfile.role_id,
          tenant_id: userProfile.tenant_id
        });
      }
    }
    
    console.log('\n4. 🔍 Testing role lookup...');
    if (userProfile?.role_id) {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('role_name')
        .eq('id', userProfile.role_id)
        .maybeSingle();
      
      console.log('📊 Role lookup result:');
      console.log('   - Role found:', !!roleData);
      console.log('   - Role name:', roleData?.role_name || 'None');
      console.log('   - Error:', roleError?.message || 'None');
      console.log('   - Error code:', roleError?.code || 'None');
    }
    
    console.log('\n5. 🧹 Cleaning up - signing out...');
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
    
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
};

debugAuthenticatedLookup();
