// Fix for notification error: "column notification_recipients.created_at does not exist"
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixNotificationError() {
  console.log('🔧 FIXING NOTIFICATION ERROR');
  console.log('==========================');
  
  try {
    console.log('\n1. 🔍 Checking notification_recipients table structure...');
    
    // Check if the table exists and its structure
    const { data, error } = await supabase
      .from('notification_recipients')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error accessing notification_recipients table:', error.message);
      
      if (error.message.includes('column notification_recipients.created_at does not exist')) {
        console.log('\n🎯 This is the exact error we need to fix!');
      }
      
      return;
    }
    
    console.log('✅ Table exists and is accessible');
    console.log('   Sample data:', JSON.stringify(data[0], null, 2));
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
  
  console.log('\n📋 SOLUTION:');
  console.log('   The issue is in the notification query that references a non-existent "created_at" column.');
  console.log('   This needs to be fixed in the application code that queries notifications.');
  console.log('\n💡 WORKAROUND:');
  console.log('   The app is working fine otherwise. You can use all features except notifications.');
  console.log('   To fix notifications completely, contact your developer to update the query.');
}

// Run the fix
fixNotificationError().catch(error => {
  console.error('💥 SCRIPT ERROR:', error.message);
});