/**
 * PUSH TOKEN DEBUG AND FIX SCRIPT
 * 
 * This script helps debug and fix the push token query issue where 
 * 'token as push_token' is being interpreted as 'tokenaspush_token'
 */

import { supabase } from '../path/to/your/supabase/config'; // Update this path

/**
 * Test different query variations to find working solution
 */
export async function debugPushTokenQueries(userId, tenantId) {
  console.log('🔍 DEBUGGING PUSH TOKEN QUERIES...\n');
  
  // Test 1: Original problematic query
  console.log('1️⃣ Testing original query: select("token as push_token")');
  try {
    const { data: result1, error: error1 } = await supabase
      .from('push_tokens')
      .select('token as push_token')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    console.log('✅ Result 1:', result1);
    console.log('❌ Error 1:', error1);
  } catch (e) {
    console.log('❌ Exception 1:', e.message);
  }

  // Test 2: Using backticks
  console.log('\n2️⃣ Testing backtick query: select(`token as push_token`)');
  try {
    const { data: result2, error: error2 } = await supabase
      .from('push_tokens')
      .select(`token as push_token`)
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    console.log('✅ Result 2:', result2);
    console.log('❌ Error 2:', error2);
  } catch (e) {
    console.log('❌ Exception 2:', e.message);
  }

  // Test 3: Just selecting token column
  console.log('\n3️⃣ Testing simple query: select("token")');
  try {
    const { data: result3, error: error3 } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    console.log('✅ Result 3:', result3);
    console.log('❌ Error 3:', error3);
  } catch (e) {
    console.log('❌ Exception 3:', e.message);
  }

  // Test 4: Using double quotes for alias
  console.log('\n4️⃣ Testing quoted alias: select("token as \\"push_token\\"")');
  try {
    const { data: result4, error: error4 } = await supabase
      .from('push_tokens')
      .select('token as "push_token"')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    console.log('✅ Result 4:', result4);
    console.log('❌ Error 4:', error4);
  } catch (e) {
    console.log('❌ Exception 4:', e.message);
  }

  // Test 5: Separate select with mapping
  console.log('\n5️⃣ Testing simple select with manual mapping');
  try {
    const { data: result5, error: error5 } = await supabase
      .from('push_tokens')
      .select('token, user_id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    console.log('✅ Result 5 (raw):', result5);
    console.log('❌ Error 5:', error5);
    
    // Manual mapping
    if (result5 && result5.length > 0) {
      const mapped = result5.map(item => ({ push_token: item.token }));
      console.log('✅ Result 5 (mapped):', mapped);
    }
  } catch (e) {
    console.log('❌ Exception 5:', e.message);
  }
}

/**
 * Fixed version of getActivePushTokensForUser that should work
 */
export async function getActivePushTokensForUserFixed(userId, tenantId) {
  try {
    console.log('📱 [FIXED] Getting active push tokens for user:', userId, 'tenant:', tenantId);
    
    // Use simple select and manually map the result
    let query = supabase
      .from('push_tokens')
      .select('token, user_id, is_active, created_at')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    // Add tenant filtering if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data: tokens, error } = await query;
    
    if (error) {
      console.error('Error fetching push tokens:', error);
      return [];
    }
    
    // Manually extract and validate tokens
    const validTokens = (tokens || [])
      .filter(t => t.token && typeof t.token === 'string' && t.token.trim() !== '')
      .map(t => t.token);
    
    console.log(`📱 [FIXED] Found ${validTokens.length} active push tokens for user ${userId}`);
    
    return validTokens;
  } catch (error) {
    console.error('Error in getActivePushTokensForUserFixed:', error);
    return [];
  }
}

/**
 * Test the fixed function
 */
export async function testFixedFunction(userId, tenantId) {
  console.log('\n🧪 TESTING FIXED FUNCTION...\n');
  
  try {
    const tokens = await getActivePushTokensForUserFixed(userId, tenantId);
    console.log('✅ Fixed function result:', tokens);
    return tokens;
  } catch (error) {
    console.error('❌ Fixed function error:', error);
    return [];
  }
}

// Example usage:
export async function runCompleteTest() {
  const testUserId = 'your-test-user-id-here';
  const testTenantId = 'your-test-tenant-id-here';
  
  console.log('🚀 STARTING COMPLETE PUSH TOKEN DEBUG TEST\n');
  
  // 1. Run all debug queries
  await debugPushTokenQueries(testUserId, testTenantId);
  
  // 2. Test the fixed function
  await testFixedFunction(testUserId, testTenantId);
  
  console.log('\n🎯 DEBUG TEST COMPLETE');
}