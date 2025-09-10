const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkParentAccounts() {
  console.log('🔍 CHECKING PARENT ACCOUNTS IN SYSTEM...\n');

  try {
    // Check users table for parent accounts (role_id = 3)
    console.log('1. 👥 Checking users table for parent accounts...');
    const { data: parentUsers, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, role_id, created_at')
      .eq('role_id', 3) // Parent role ID
      .order('created_at', { ascending: false });

    if (userError) {
      console.log('❌ Error querying users table:', userError.message);
      console.log('   This might be due to Row Level Security (RLS) policies');
      console.log('   Try using service key instead of anon key for admin operations');
    } else if (parentUsers && parentUsers.length > 0) {
      console.log(`✅ Found ${parentUsers.length} parent account(s) in users table:`);
      parentUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. Email: ${user.email}`);
        console.log(`      Name: ${user.full_name || 'Not set'}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No parent accounts found in users table');
      console.log('   This could mean:');
      console.log('   - No parent accounts have been created yet');
      console.log('   - RLS policies are preventing access');
      console.log('   - Parent accounts exist but with different role_id');
    }

    // Check roles table to confirm Parent role exists
    console.log('\n2. 🎭 Checking roles table...');
    const { data: roles, error: roleError } = await supabase
      .from('roles')
      .select('id, role_name')
      .order('id');

    if (roleError) {
      console.log('❌ Error querying roles table:', roleError.message);
    } else if (roles) {
      console.log('✅ Available roles in system:');
      roles.forEach(role => {
        const indicator = role.role_name === 'Parent' ? ' ← PARENT ROLE' : '';
        console.log(`   ${role.id}. ${role.role_name}${indicator}`);
      });
    }

    // Try to check auth.users (Supabase Auth users)
    console.log('\n3. 🔐 Checking for any users in auth system...');
    console.log('   Note: We cannot directly query auth.users with anon key');
    console.log('   But we can see if there are any user profiles that might exist');

    // Check all users regardless of role to see what exists
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('email, role_id, full_name')
      .limit(10);

    if (allError) {
      console.log('❌ Cannot access users table:', allError.message);
      console.log('   This is likely due to RLS policies');
    } else if (allUsers && allUsers.length > 0) {
      console.log(`\n✅ Found ${allUsers.length} total user(s) in system:`);
      allUsers.forEach((user, index) => {
        const roleNames = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
        const roleName = roleNames[user.role_id] || `Unknown (${user.role_id})`;
        console.log(`   ${index + 1}. ${user.email} - ${roleName}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 WHAT TO DO NEXT:');
    console.log('='.repeat(60));
    
    if (parentUsers && parentUsers.length > 0) {
      console.log('\n✅ PARENT ACCOUNTS FOUND:');
      console.log('   - Try logging in with one of the email addresses shown above');
      console.log('   - If you forgot the password, use the "Forgot Password" feature');
      console.log('   - Make sure you\'re using the exact email address (case-sensitive)');
    } else {
      console.log('\n❌ NO PARENT ACCOUNTS FOUND:');
      console.log('   - You need to create a parent account first');
      console.log('   - Use the "Sign Up" feature to create a new parent account');
      console.log('   - Or have an admin create the parent account for you');
    }

    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('   1. Double-check the email address and password');
    console.log('   2. Make sure you\'re selecting "Parent" as the role');
    console.log('   3. Try the "Forgot Password" feature if password is forgotten');
    console.log('   4. If no parent accounts exist, sign up as a new parent');
    console.log('   5. Contact admin if you believe your account should exist');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.log('\nTHIS ERROR MIGHT MEAN:');
    console.log('- Database connection issues');
    console.log('- RLS policies preventing data access');
    console.log('- Network connectivity problems');
    console.log('\nTry using service key instead of anon key for admin operations');
  }
}

// Run the check
if (require.main === module) {
  checkParentAccounts().then(() => {
    console.log('\n🏁 Parent account check complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Check failed:', err.message);
    process.exit(1);
  });
}

module.exports = { checkParentAccounts };
