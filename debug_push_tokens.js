/**
 * 🔍 DEBUG PUSH TOKENS
 * Test script to check push token registration in the database
 */

// Simple fetch approach to check push tokens
const supabaseUrl = 'https://fqgkcmpnojhgqyudksuj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZ2tjbXBub2poZ3F5dWRrc3VqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjU3MDUwNCwiZXhwIjoyMDQyMTQ2NTA0fQ.6u6O9sFBY-8f5zZJNFqM-4cddW3A7S4CXf8wvAX9KnY';

async function querySupabase(table, select = '*', filters = {}) {
  try {
    let url = `${supabaseUrl}/rest/v1/${table}?select=${select}`;
    
    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      url += `&${key}=eq.${value}`;
    });
    
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error querying ${table}:`, error.message);
    return null;
  }
}

async function debugPushTokens() {
  try {
    console.log('🔍 Checking push_tokens table...');
    
    // Check if table exists and get all tokens
    const tokens = await querySupabase('push_tokens', '*');
    
    if (!tokens) {
      console.error('❌ Error reading push_tokens table or table does not exist');
      return;
    }
    
    console.log('📊 Push Tokens Summary:');
    console.log(`   Total tokens: ${tokens?.length || 0}`);
    
    if (tokens && tokens.length > 0) {
      console.log('\n📱 Tokens by user type:');
      const tokensByUserType = tokens.reduce((acc, token) => {
        const key = token.device_type || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      console.log(tokensByUserType);
      
      console.log('\n📱 Active tokens:');
      const activeTokens = tokens.filter(token => token.is_active);
      console.log(`   Active: ${activeTokens.length}`);
      console.log(`   Inactive: ${tokens.length - activeTokens.length}`);
      
      console.log('\n📱 Tokens by tenant:');
      const tokensByTenant = tokens.reduce((acc, token) => {
        const key = token.tenant_id || 'no-tenant';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      console.log(tokensByTenant);
      
      // Show first few tokens for inspection
      console.log('\n📋 Sample tokens:');
      tokens.slice(0, 3).forEach((token, index) => {
        console.log(`   Token ${index + 1}:`);
        console.log(`      User ID: ${token.user_id}`);
        console.log(`      Device: ${token.device_type} - ${token.device_name}`);
        console.log(`      Tenant: ${token.tenant_id}`);
        console.log(`      Active: ${token.is_active}`);
        console.log(`      Created: ${token.created_at}`);
        console.log(`      Token: ${token.token?.substring(0, 20)}...`);
        console.log('');
      });
    } else {
      console.log('❌ No push tokens found in database!');
      console.log('📱 This means push notification registration is not working yet.');
      console.log('🔧 Check if:');
      console.log('   1. You are testing on a physical device (not emulator)');
      console.log('   2. You are not using Expo Go (use development build)');
      console.log('   3. Push notification permissions are granted');
      console.log('   4. The pushNotificationService.initialize() is being called during login');
    }
    
    // Check for admin users to see who should have tokens
    console.log('\n👥 Checking admin users in tenant b8f8b5f0-1234-4567-8901-123456789000:');
    const adminUsers = await querySupabase('users', 'id,email,full_name,role_id', {
      role_id: 1,
      tenant_id: 'b8f8b5f0-1234-4567-8901-123456789000'
    });
    
    if (!adminUsers) {
      console.error('❌ Error fetching admin users');
    } else {
      console.log(`   Found ${adminUsers?.length || 0} admin users:`);
      adminUsers?.forEach((user, index) => {
        const hasToken = tokens?.some(token => token.user_id === user.id && token.is_active);
        console.log(`      ${index + 1}. ${user.full_name || user.email} - ${hasToken ? '✅ Has token' : '❌ No token'}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error in debug script:', error);
  }
}

// Run the debug
debugPushTokens();