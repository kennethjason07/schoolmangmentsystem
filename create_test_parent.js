const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestParent() {
  console.log('🆕 CREATING TEST PARENT ACCOUNT...\n');

  const testEmail = 'testparent123@gmail.com';
  const testPassword = 'TestPassword123!';
  
  try {
    console.log('1. Creating Supabase Auth account...');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });

    if (signUpError) {
      if (signUpError.message.includes('User already registered')) {
        console.log('✅ Account already exists, trying to sign in...');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        
        if (signInError) {
          console.log('❌ Sign in failed:', signInError.message);
          return false;
        } else {
          console.log('✅ Successfully signed in to existing account');
          
          // Create/update profile
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .upsert({
              id: signInData.user.id,
              email: testEmail,
              role_id: 3, // Parent
              full_name: 'Test Parent User',
              created_at: new Date().toISOString()
            })
            .select();
          
          if (profileError) {
            console.log('❌ Profile creation failed:', profileError.message);
          } else {
            console.log('✅ Profile created/updated successfully');
          }
          
          await supabase.auth.signOut();
          return true;
        }
      } else {
        console.log('❌ Account creation failed:', signUpError.message);
        return false;
      }
    } else if (signUpData.user) {
      console.log('✅ Auth account created successfully');
      console.log(`   User ID: ${signUpData.user.id}`);
      
      // Wait a moment for the user to be fully created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('\n2. Creating user profile in database...');
      
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: signUpData.user.id,
          email: testEmail,
          role_id: 3, // Parent
          full_name: 'Test Parent User',
          phone: '',
          created_at: new Date().toISOString()
        })
        .select();
      
      if (profileError) {
        console.log('❌ Profile creation failed:', profileError.message);
        console.log('   Error details:', profileError);
        return false;
      } else {
        console.log('✅ User profile created successfully');
        console.log('   Profile data:', profile[0]);
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    return false;
  }
}

// Run the creation
if (require.main === module) {
  createTestParent().then((success) => {
    if (success) {
      console.log('\n' + '='.repeat(50));
      console.log('🎉 TEST PARENT ACCOUNT READY!');
      console.log('='.repeat(50));
      console.log('\n📧 Email: testparent123@gmail.com');
      console.log('🔒 Password: TestPassword123!');
      console.log('👤 Role: Parent');
      console.log('\n💡 You can now use these credentials to log into your app!');
      console.log('   1. Open your app');
      console.log('   2. Select "Parent" role');
      console.log('   3. Enter the email and password above');
      console.log('   4. Tap Login');
    } else {
      console.log('\n❌ Failed to create test account');
      console.log('\n🔧 ALTERNATIVE SOLUTIONS:');
      console.log('   1. Try the "Forgot Password" feature with: Arshadpatel1431@gmail.com');
      console.log('   2. Use the Sign Up feature in your app to create a new parent account');
    }
    
    console.log('\n🏁 Script complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  });
}
