/**
 * Database Connection Diagnostic Script
 * Run this to test your Supabase connection and identify timeout issues
 */

import { supabase } from './src/utils/supabase.js';

console.log('🔧 Starting Database Connection Diagnostics...\n');

// Test 1: Basic connection
async function testBasicConnection() {
  console.log('📡 Test 1: Basic Supabase Connection');
  try {
    const startTime = Date.now();
    const { data, error } = await supabase.from('users').select('count').limit(1);
    const endTime = Date.now();
    
    console.log(`✅ Connection successful (${endTime - startTime}ms)`);
    console.log('Response:', { data, error });
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
  console.log('');
}

// Test 2: Session check
async function testSessionCheck() {
  console.log('🔐 Test 2: Session Check');
  try {
    const startTime = Date.now();
    const { data: { session }, error } = await supabase.auth.getSession();
    const endTime = Date.now();
    
    console.log(`✅ Session check successful (${endTime - startTime}ms)`);
    console.log('Session exists:', !!session);
    console.log('User email:', session?.user?.email || 'None');
  } catch (error) {
    console.error('❌ Session check failed:', error);
  }
  console.log('');
}

// Test 3: Users table query
async function testUsersQuery() {
  console.log('👥 Test 3: Users Table Query');
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .limit(3);
    const endTime = Date.now();
    
    console.log(`✅ Users query successful (${endTime - startTime}ms)`);
    console.log(`Found ${data?.length || 0} users`);
    console.log('Sample data:', data);
  } catch (error) {
    console.error('❌ Users query failed:', error);
  }
  console.log('');
}

// Test 4: Roles table query
async function testRolesQuery() {
  console.log('🏷️ Test 4: Roles Table Query');
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('roles')
      .select('*');
    const endTime = Date.now();
    
    console.log(`✅ Roles query successful (${endTime - startTime}ms)`);
    console.log(`Found ${data?.length || 0} roles`);
    console.log('Roles data:', data);
  } catch (error) {
    console.error('❌ Roles query failed:', error);
  }
  console.log('');
}

// Test 5: Network latency test
async function testNetworkLatency() {
  console.log('⚡ Test 5: Network Latency Test');
  const tests = [];
  
  for (let i = 1; i <= 5; i++) {
    try {
      const startTime = Date.now();
      await supabase.from('users').select('count').limit(1);
      const endTime = Date.now();
      const latency = endTime - startTime;
      tests.push(latency);
      console.log(`Test ${i}: ${latency}ms`);
    } catch (error) {
      console.log(`Test ${i}: Failed - ${error.message}`);
    }
  }
  
  const avgLatency = tests.reduce((a, b) => a + b, 0) / tests.length;
  console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
  
  if (avgLatency > 5000) {
    console.log('⚠️ HIGH LATENCY DETECTED - This may cause timeout issues');
  } else if (avgLatency > 2000) {
    console.log('⚠️ MODERATE LATENCY - Consider optimizing connection');
  } else {
    console.log('✅ Good latency');
  }
  console.log('');
}

// Run all tests
async function runDiagnostics() {
  await testBasicConnection();
  await testSessionCheck();
  await testUsersQuery();
  await testRolesQuery();
  await testNetworkLatency();
  
  console.log('🏁 Diagnostics Complete!');
  console.log('\n📋 Recommendations:');
  console.log('1. Check your internet connection stability');
  console.log('2. Verify Supabase project URL and API keys');
  console.log('3. Check if your Supabase project is active');
  console.log('4. Consider upgrading your Supabase plan if on free tier');
}

// Export for use
export { runDiagnostics };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDiagnostics().catch(console.error);
}
