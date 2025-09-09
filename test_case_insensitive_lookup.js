const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCaseInsensitiveLookup() {
  console.log('🧪 Testing case-insensitive email lookup...\n');
  
  const testEmails = [
    'Arshadpatel1431@gmail.com',  // Original case from database
    'arshadpatel1431@gmail.com',  // Lowercase (what auth might return)
    'ARSHADPATEL1431@GMAIL.COM',  // Uppercase
    'ArshadPatel1431@Gmail.com'   // Mixed case
  ];
  
  for (const email of testEmails) {
    console.log(`📧 Testing email: "${email}"`);
    
    try {
      // Test with exact match (eq)
      const { data: exactMatch, error: exactError } = await supabase
        .from('users')
        .select('id, email, tenant_id, full_name')
        .eq('email', email)
        .maybeSingle();
      
      console.log(`   🎯 Exact match (eq): ${exactMatch ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (exactMatch) {
        console.log(`      - Stored email: "${exactMatch.email}"`);
        console.log(`      - Tenant ID: ${exactMatch.tenant_id}`);
      }
      if (exactError) {
        console.log(`      - Error: ${exactError.message}`);
      }
      
      // Test with case-insensitive match (ilike)  
      const { data: ilikeMatch, error: ilikeError } = await supabase
        .from('users')
        .select('id, email, tenant_id, full_name')
        .ilike('email', email)
        .maybeSingle();
      
      console.log(`   🔍 Case-insensitive (ilike): ${ilikeMatch ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (ilikeMatch) {
        console.log(`      - Stored email: "${ilikeMatch.email}"`);
        console.log(`      - Tenant ID: ${ilikeMatch.tenant_id}`);
      }
      if (ilikeError) {
        console.log(`      - Error: ${ilikeError.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
}

// Run the test
testCaseInsensitiveLookup().then(() => {
  console.log('🏁 Case-insensitive lookup test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
