const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
  try {
    const userEmail = 'arshadpatel1431@gmail.com';
    console.log(`🔍 Checking user: ${userEmail}`);
    
    // Try different approaches to find the user
    console.log('\n1. Direct email search:');
    const { data: userData1, error: userError1 } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail);
    
    console.log('Result:', { data: userData1, error: userError1 });
    
    console.log('\n2. Case insensitive search:');
    const { data: userData2, error: userError2 } = await supabase
      .from('users')
      .select('*')
      .ilike('email', userEmail);
    
    console.log('Result:', { data: userData2, error: userError2 });
    
    console.log('\n3. Get all users to see what emails exist:');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, email, full_name, role_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allUsersError) {
      console.log('Error getting all users:', allUsersError);
    } else {
      console.log('Recent users in database:');
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.full_name}) - Role ID: ${user.role_id}`);
      });
    }
    
    // Check if there are any users with similar email
    console.log('\n4. Search for similar emails:');
    const { data: similarUsers, error: similarError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', '%arshad%');
    
    console.log('Similar emails found:', similarUsers);
    
    // Check database structure
    console.log('\n5. Check users table structure:');
    const { data: tableInfo, error: tableError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (tableInfo && tableInfo.length > 0) {
      console.log('Users table columns:', Object.keys(tableInfo[0]));
    }
    
  } catch (error) {
    console.error('💥 Error checking user:', error);
  }
}

// Run the script
checkUser().then(() => {
  console.log('\n🏁 User check completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
