const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixTestParent() {
  console.log('🔧 FIXING TEST PARENT ACCOUNT...\n');

  const testEmail = 'testparent123@gmail.com';
  const testPassword = 'TestPassword123!';
  
  try {
    // First, get the tenant_id from an existing user
    console.log('1. Getting tenant_id from existing parent account...');
    const { data: existingParent, error: parentError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();
    
    if (parentError || !existingParent) {
      console.log('❌ Could not get tenant_id from existing parent');
      return false;
    }
    
    const tenantId = existingParent.tenant_id;
    console.log(`✅ Found tenant_id: ${tenantId}`);
    
    // Sign in to our test account
    console.log('\n2. Signing in to test account...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) {
      console.log('❌ Could not sign in to test account:', signInError.message);
      return false;
    }
    
    console.log('✅ Successfully signed in to test account');
    
    // Create the profile with tenant_id
    console.log('\n3. Creating user profile with correct tenant_id...');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: signInData.user.id,
        email: testEmail,
        role_id: 3, // Parent
        tenant_id: tenantId,
        full_name: 'Test Parent User',
        phone: '',
        created_at: new Date().toISOString()
      })
      .select();
    
    if (profileError) {
      console.log('❌ Profile creation failed:', profileError.message);
      await supabase.auth.signOut();
      return false;
    } else {
      console.log('✅ User profile created successfully');
      console.log('   Profile data:', profile[0]);
    }
    
    // Sign out
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
    
    return true;
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

// Run the fix
if (require.main === module) {
  fixTestParent().then((success) => {
    if (success) {
      console.log('\n' + '='.repeat(50));
      console.log('🎉 TEST PARENT ACCOUNT IS NOW READY!');
      console.log('='.repeat(50));
      console.log('\n📧 Email: testparent123@gmail.com');
      console.log('🔒 Password: TestPassword123!');
      console.log('👤 Role: Parent');
      console.log('\n💡 You can now use these credentials to log into your app!');
      console.log('   1. Open your app');
      console.log('   2. Select "Parent" role');
      console.log('   3. Enter the email and password above');
      console.log('   4. Tap Login');
      console.log('\n🚀 This should work without "Invalid login credentials" error!');
    } else {
      console.log('\n❌ Failed to fix test account');
      console.log('\n🔧 ALTERNATIVE SOLUTION:');
      console.log('   Try the "Forgot Password" feature with: Arshadpatel1431@gmail.com');
    }
    
    console.log('\n🏁 Script complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  });
}
