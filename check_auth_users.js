const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Replace with service key if you have it (from Supabase Dashboard > Settings > API > service_role key)
// WARNING: Only use service key server-side, never in client apps
const SERVICE_KEY = 'YOUR_SERVICE_KEY_HERE'; // Replace with actual service key if needed

const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Uncomment below if you have service key:
// const supabaseAdmin = createClient(supabaseUrl, SERVICE_KEY);

async function checkAuthUsers() {
  console.log('🔍 CHECKING SUPABASE AUTH USERS...\n');

  const parentEmail = 'Arshadpatel1431@gmail.com';
  
  try {
    // Test 1: Try to sign in with known credentials
    console.log('1. 🔐 Testing sign in with known parent account...');
    console.log(`   Email: ${parentEmail}`);
    console.log('   Password: [You need to provide this]');
    
    // You need to replace 'TEST_PASSWORD_HERE' with the actual password
    const testPassword = 'TEST_PASSWORD_HERE'; // Replace with actual password
    
    if (testPassword === 'TEST_PASSWORD_HERE') {
      console.log('❌ Please update this script with the actual password for testing');
      console.log('   Replace TEST_PASSWORD_HERE with the real password');
    } else {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: parentEmail,
        password: testPassword
      });

      if (signInError) {
        console.log('❌ Sign in failed:', signInError.message);
        if (signInError.message.includes('Invalid login credentials')) {
          console.log('   This means either:');
          console.log('   - Wrong password');
          console.log('   - User doesn\'t exist in Supabase Auth');
          console.log('   - Email confirmation required');
        }
      } else {
        console.log('✅ Sign in successful!');
        console.log('   User:', signInData.user.email);
        console.log('   This means the parent account works correctly');
        
        // Sign out after test
        await supabase.auth.signOut();
      }
    }

    // Test 2: Create a new test parent account
    console.log('\n2. 🆕 Creating a test parent account...');
    const testEmail = 'testparent@example.com';
    const newTestPassword = 'TestPassword123!';
    
    console.log(`   Creating account: ${testEmail}`);
    console.log(`   Password: ${newTestPassword}`);
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: newTestPassword,
      options: {
        emailRedirectTo: undefined // Skip email confirmation for testing
      }
    });

    if (signUpError) {
      console.log('❌ Test account creation failed:', signUpError.message);
      if (signUpError.message.includes('User already registered')) {
        console.log('   Test account already exists, trying to sign in...');
        
        const { data: testSignIn, error: testSignInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: newTestPassword
        });
        
        if (testSignInError) {
          console.log('❌ Test sign in failed:', testSignInError.message);
        } else {
          console.log('✅ Test account sign in successful!');
          
          // Add to users table for testing
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .upsert({
              id: testSignIn.user.id,
              email: testEmail,
              role_id: 3, // Parent role
              full_name: 'Test Parent',
              created_at: new Date().toISOString()
            })
            .select();
          
          if (profileError) {
            console.log('❌ Failed to create user profile:', profileError.message);
          } else {
            console.log('✅ Test user profile created successfully');
          }
          
          await supabase.auth.signOut();
        }
      }
    } else if (signUpData.user) {
      console.log('✅ Test account created successfully!');
      console.log('   User ID:', signUpData.user.id);
      console.log('   Email confirmed:', !signUpData.user.email_confirmed_at ? 'No (normal for test)' : 'Yes');
      
      // Add to users table
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: signUpData.user.id,
          email: testEmail,
          role_id: 3, // Parent role
          full_name: 'Test Parent',
          created_at: new Date().toISOString()
        })
        .select();
      
      if (profileError) {
        console.log('❌ Failed to create user profile:', profileError.message);
        console.log('   Error details:', profileError);
      } else {
        console.log('✅ Test user profile created in database');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 SOLUTIONS:');
    console.log('='.repeat(60));
    
    console.log('\n🔧 OPTION 1 - Reset Password for Existing Account:');
    console.log(`   1. Go to your app's "Forgot Password" feature`);
    console.log(`   2. Enter: ${parentEmail}`);
    console.log('   3. Check email for reset link');
    console.log('   4. Set a new password');
    console.log('   5. Try logging in again');
    
    console.log('\n🔧 OPTION 2 - Use Test Account (if created successfully):');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${newTestPassword}`);
    console.log('   Role: Parent');
    
    console.log('\n🔧 OPTION 3 - Check Service Key Access:');
    console.log('   1. Get your service key from Supabase Dashboard > Settings > API');
    console.log('   2. Update this script with the service key');
    console.log('   3. Run again to get more detailed auth information');
    
    console.log('\n🔧 OPTION 4 - Create New Parent Account:');
    console.log('   1. Use the Sign Up feature in your app');
    console.log('   2. Create a new parent account with known credentials');
    console.log('   3. Use that account for testing');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.log('\nDEBUG INFO:', error);
  }
}

// Run the check
if (require.main === module) {
  checkAuthUsers().then(() => {
    console.log('\n🏁 Auth user check complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Check failed:', err.message);
    process.exit(1);
  });
}

module.exports = { checkAuthUsers };
