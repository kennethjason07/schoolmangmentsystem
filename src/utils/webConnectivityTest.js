import { Platform } from 'react-native';

/**
 * Test web connectivity to Supabase and other services
 */
export const testWebConnectivity = async () => {
  if (Platform.OS !== 'web') {
    console.log('🔄 Connectivity test is only for web platform');
    return { success: true, message: 'Not web platform' };
  }

  console.log('🌐 Starting web connectivity test...');
  
  const tests = [];
  
  // Test 1: Basic internet connectivity
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    
    const basicTest = await fetch('https://httpbin.org/status/200', {
      method: 'GET',
      signal: controller.signal
    });
    
    tests.push({
      name: 'Basic Internet',
      success: basicTest.ok,
      status: basicTest.status,
      message: basicTest.ok ? 'Connected' : 'Failed'
    });
  } catch (error) {
    tests.push({
      name: 'Basic Internet',
      success: false,
      message: error.message || 'Connection failed'
    });
  }
  
  // Test 2: Supabase connectivity
  try {
    const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    
    const supabaseTest = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    tests.push({
      name: 'Supabase REST API',
      success: supabaseTest.ok,
      status: supabaseTest.status,
      message: supabaseTest.ok ? 'Connected' : `Failed with status ${supabaseTest.status}`
    });
  } catch (error) {
    tests.push({
      name: 'Supabase REST API',
      success: false,
      message: error.message || 'Connection failed'
    });
  }
  
  // Test 3: Supabase Auth endpoint
  try {
    const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    
    const authTest = await fetch(`${supabaseUrl}/auth/v1/`, {
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8',
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    tests.push({
      name: 'Supabase Auth API',
      success: authTest.ok,
      status: authTest.status,
      message: authTest.ok ? 'Connected' : `Failed with status ${authTest.status}`
    });
  } catch (error) {
    tests.push({
      name: 'Supabase Auth API',
      success: false,
      message: error.message || 'Connection failed'
    });
  }
  
  // Log results
  console.log('🌐 Connectivity test results:');
  tests.forEach(test => {
    const status = test.success ? '✅' : '❌';
    console.log(`${status} ${test.name}: ${test.message}`);
  });
  
  const allSuccessful = tests.every(test => test.success);
  const summary = `${tests.filter(t => t.success).length}/${tests.length} tests passed`;
  
  return {
    success: allSuccessful,
    tests,
    summary,
    message: allSuccessful ? 'All connectivity tests passed' : 'Some connectivity tests failed'
  };
};

/**
 * Quick test specifically for Supabase auth endpoint
 */
export const testSupabaseAuth = async () => {
  if (Platform.OS !== 'web') {
    return { success: true, message: 'Not web platform' };
  }

  try {
    console.log('🔑 Testing Supabase auth endpoint...');
    
    const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15000); // Longer timeout for auth
    
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com', // This will fail but should reach the server
        password: 'test'
      }),
      signal: controller.signal
    });
    
    console.log('🔑 Auth endpoint response status:', response.status);
    
    // Even if login fails (400), reaching the endpoint (not 0 or network error) is success
    const reachedEndpoint = response.status > 0 && response.status !== 0;
    
    return {
      success: reachedEndpoint,
      status: response.status,
      message: reachedEndpoint 
        ? `Auth endpoint reachable (status: ${response.status})`
        : 'Auth endpoint unreachable'
    };
  } catch (error) {
    console.error('🔑 Auth endpoint test failed:', error);
    return {
      success: false,
      message: error.message || 'Auth endpoint connection failed'
    };
  }
};
