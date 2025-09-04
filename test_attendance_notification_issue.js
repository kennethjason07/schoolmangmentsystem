const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Test user credentials
const testEmail = 'kenj7214@gmail.com';
const testPassword = process.env.SUPABASE_USER_PASSWORD || 'YOUR_PASSWORD';

console.log('=== TESTING ATTENDANCE NOTIFICATION TENANT ISSUE ===\n');

async function testAttendanceNotificationIssue() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // First, let's test without authentication to see the error
    console.log('🔍 1. Testing notification insert without authentication...');
    
    const testNotificationData = {
      type: 'Absentee',
      message: 'Test absence notification',
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      sent_by: 'b8f8b5f0-1234-4567-8901-123456789001', // Test teacher ID
      sent_at: new Date().toISOString()
      // Notice: NO tenant_id provided - let's see if trigger handles it
    };

    console.log('Attempting to insert notification without tenant_id...');
    const { data: noAuthResult, error: noAuthError } = await supabase
      .from('notifications')
      .insert(testNotificationData)
      .select()
      .single();

    if (noAuthError) {
      console.log('❌ Error without auth:', noAuthError.message);
      console.log('   Error code:', noAuthError.code);
      console.log('   Details:', JSON.stringify(noAuthError.details || {}, null, 2));
    } else {
      console.log('✅ Inserted notification without auth:', noAuthResult.id);
      console.log('   Assigned tenant_id:', noAuthResult.tenant_id);
    }

    // Now test with authentication
    if (testPassword === 'YOUR_PASSWORD') {
      console.log('\n⚠️ No password provided - skipping authentication test');
      console.log('Run with: SUPABASE_USER_PASSWORD=your_password node test_attendance_notification_issue.js');
      return;
    }
    
    console.log('\n🔐 2. Attempting to sign in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.log('❌ Authentication failed:', authError.message);
      return;
    }
    
    console.log('✅ Authentication successful!');
    console.log('   User ID:', authData.user?.id);
    console.log('   User email:', authData.user?.email);

    // Test getUserTenantId equivalent logic
    console.log('\n🔍 3. Testing tenant resolution logic...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Try to get tenant_id from user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id, email, role_id')
      .eq('id', user.id)
      .maybeSingle();

    console.log('Database user profile lookup:');
    console.log('   Profile found:', !!userProfile);
    console.log('   Profile tenant_id:', userProfile?.tenant_id);
    console.log('   Profile email:', userProfile?.email);
    console.log('   Profile role_id:', userProfile?.role_id);
    console.log('   Error:', profileError?.message || 'None');

    // Check JWT metadata
    console.log('\nJWT metadata:');
    console.log('   app_metadata:', JSON.stringify(user.app_metadata || {}, null, 2));
    console.log('   user_metadata:', JSON.stringify(user.user_metadata || {}, null, 2));

    const resolvedTenantId = userProfile?.tenant_id || 
                           user.app_metadata?.tenant_id || 
                           user.user_metadata?.tenant_id ||
                           'b8f8b5f0-1234-4567-8901-123456789000'; // Known fallback

    console.log('   Resolved tenant_id:', resolvedTenantId);

    // Test notification insertion with authentication
    console.log('\n🔍 4. Testing notification insert WITH authentication...');
    
    const authNotificationData = {
      type: 'Absentee',
      message: 'Test authenticated absence notification',
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      sent_by: user.id,
      sent_at: new Date().toISOString(),
      tenant_id: resolvedTenantId // Explicitly provide tenant_id
    };

    console.log('Attempting to insert notification with authentication and explicit tenant_id...');
    const { data: authResult, error: authInsertError } = await supabase
      .from('notifications')
      .insert(authNotificationData)
      .select()
      .single();

    if (authInsertError) {
      console.log('❌ Error with auth and explicit tenant_id:', authInsertError.message);
      console.log('   Error code:', authInsertError.code);
      console.log('   Details:', JSON.stringify(authInsertError.details || {}, null, 2));
    } else {
      console.log('✅ Inserted notification with auth:', authResult.id);
      console.log('   Final tenant_id:', authResult.tenant_id);
    }

    // Test notification insertion letting trigger handle tenant_id
    console.log('\n🔍 5. Testing notification insert letting trigger assign tenant_id...');
    
    const triggerNotificationData = {
      type: 'Absentee',
      message: 'Test trigger-assigned tenant_id notification',
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      sent_by: user.id,
      sent_at: new Date().toISOString()
      // NO tenant_id - let trigger assign it
    };

    console.log('Attempting to insert notification without tenant_id (trigger should assign)...');
    const { data: triggerResult, error: triggerError } = await supabase
      .from('notifications')
      .insert(triggerNotificationData)
      .select()
      .single();

    if (triggerError) {
      console.log('❌ Error with trigger assignment:', triggerError.message);
      console.log('   Error code:', triggerError.code);
      console.log('   Details:', JSON.stringify(triggerError.details || {}, null, 2));
      
      // This is likely where our issue is!
      if (triggerError.message.includes('tenant_id is null') || 
          triggerError.message.includes('No authenticated user found')) {
        console.log('\n🎯 ISSUE IDENTIFIED:');
        console.log('The database trigger is trying to get tenant_id but failing.');
        console.log('This suggests the trigger function is calling getUserTenantId equivalent');
        console.log('but the user context is not available in the trigger context.');
      }
    } else {
      console.log('✅ Inserted notification with trigger assignment:', triggerResult.id);
      console.log('   Trigger-assigned tenant_id:', triggerResult.tenant_id);
    }

    // Test notification recipients insert
    if (authResult?.id) {
      console.log('\n🔍 6. Testing notification recipient insert...');
      
      const recipientData = {
        notification_id: authResult.id,
        recipient_id: user.id,
        recipient_type: 'Parent',
        delivery_status: 'Sent',
        sent_at: new Date().toISOString(),
        tenant_id: resolvedTenantId
      };

      const { data: recipientResult, error: recipientError } = await supabase
        .from('notification_recipients')
        .insert(recipientData)
        .select()
        .single();

      if (recipientError) {
        console.log('❌ Error inserting notification recipient:', recipientError.message);
        console.log('   Error code:', recipientError.code);
      } else {
        console.log('✅ Inserted notification recipient:', recipientResult.id);
        console.log('   Final recipient tenant_id:', recipientResult.tenant_id);
      }
    }

    // Test what happens when we simulate the attendance notification flow
    console.log('\n🔍 7. Simulating actual attendance notification flow...');
    
    // Get a test student ID from the database
    const { data: testStudent, error: studentError } = await supabase
      .from('students')
      .select('id, name, class_id')
      .limit(1)
      .single();

    if (studentError || !testStudent) {
      console.log('⚠️ No test student found, skipping simulation');
    } else {
      console.log('Using test student:', testStudent.name, '(ID:', testStudent.id, ')');
      
      // Simulate the flow from attendance notification helper
      const simulatedNotification = {
        type: 'Absentee',
        message: `Your child ${testStudent.name} was marked absent on ${new Date().toLocaleDateString()}.`,
        delivery_mode: 'InApp',
        delivery_status: 'Sent',
        sent_by: user.id,
        sent_at: new Date().toISOString(),
        tenant_id: resolvedTenantId
      };

      const { data: simulatedResult, error: simulatedError } = await supabase
        .from('notifications')
        .insert(simulatedNotification)
        .select()
        .single();

      if (simulatedError) {
        console.log('❌ Error in simulated attendance notification:', simulatedError.message);
      } else {
        console.log('✅ Simulated attendance notification successful:', simulatedResult.id);
      }
    }

    console.log('\n=== ANALYSIS ===');
    console.log('If errors occurred above, they likely indicate:');
    console.log('1. Database triggers may be calling a function that requires user authentication');
    console.log('2. The getUserTenantId equivalent in the trigger context may not have access to the session');
    console.log('3. RLS policies may be preventing trigger functions from accessing user data');
    console.log('\nRecommendation: Check database triggers and ensure they handle tenant_id assignment without relying on session context');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testAttendanceNotificationIssue();
