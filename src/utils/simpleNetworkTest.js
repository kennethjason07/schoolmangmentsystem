import { supabase } from './supabase';

/**
 * Simple network connectivity test
 * Tests basic connection to Supabase without storage operations
 */

export const runSimpleNetworkTest = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    supabaseUrl: 'https://dmagnsbdjsnzsddxqrwd.supabase.co',
    tests: {
      basicConnection: { success: false, error: null, responseTime: 0 },
      authConnection: { success: false, error: null, responseTime: 0 },
      databaseConnection: { success: false, error: null, responseTime: 0 },
      internetConnection: { success: false, error: null, responseTime: 0 }
    },
    summary: {
      overallWorking: false,
      issues: [],
      recommendations: []
    }
  };

  console.log('🌐 Starting simple network test...');

  // Test 1: Basic internet connectivity
  try {
    console.log('1️⃣ Testing basic internet connectivity...');
    const startTime = Date.now();
    
    const response = await fetch('https://www.google.com', { 
      method: 'HEAD',
      timeout: 5000 
    });
    
    const responseTime = Date.now() - startTime;
    results.tests.internetConnection = {
      success: response.ok,
      error: response.ok ? null : `Status: ${response.status}`,
      responseTime
    };
    
    console.log(`✅ Internet connectivity: ${response.ok ? 'Working' : 'Failed'} (${responseTime}ms)`);
  } catch (error) {
    results.tests.internetConnection = {
      success: false,
      error: error.message,
      responseTime: 0
    };
    console.log('❌ Internet connectivity failed:', error.message);
  }

  // Test 2: Supabase URL accessibility
  try {
    console.log('2️⃣ Testing Supabase URL accessibility...');
    const startTime = Date.now();
    
    const response = await fetch(results.supabaseUrl + '/rest/v1/', { 
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8'
      }
    });
    
    const responseTime = Date.now() - startTime;
    results.tests.basicConnection = {
      success: response.ok,
      error: response.ok ? null : `Status: ${response.status}`,
      responseTime
    };
    
    console.log(`✅ Supabase URL: ${response.ok ? 'Accessible' : 'Failed'} (${responseTime}ms)`);
  } catch (error) {
    results.tests.basicConnection = {
      success: false,
      error: error.message,
      responseTime: 0
    };
    console.log('❌ Supabase URL failed:', error.message);
  }

  // Test 3: Supabase auth connection
  try {
    console.log('3️⃣ Testing Supabase auth connection...');
    const startTime = Date.now();
    
    const { data, error } = await supabase.auth.getUser();
    const responseTime = Date.now() - startTime;
    
    results.tests.authConnection = {
      success: !error,
      error: error?.message || null,
      responseTime,
      userExists: !!data?.user
    };
    
    console.log(`✅ Supabase auth: ${!error ? 'Working' : 'Failed'} (${responseTime}ms)`);
  } catch (error) {
    results.tests.authConnection = {
      success: false,
      error: error.message,
      responseTime: 0
    };
    console.log('❌ Supabase auth failed:', error.message);
  }

  // Test 4: Simple database query
  try {
    console.log('4️⃣ Testing simple database query...');
    const startTime = Date.now();
    
    // Try a simple query that should work on any Supabase instance
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    results.tests.databaseConnection = {
      success: !error,
      error: error?.message || null,
      responseTime,
      recordsFound: data?.length || 0
    };
    
    console.log(`✅ Database query: ${!error ? 'Working' : 'Failed'} (${responseTime}ms)`);
  } catch (error) {
    results.tests.databaseConnection = {
      success: false,
      error: error.message,
      responseTime: 0
    };
    console.log('❌ Database query failed:', error.message);
  }

  // Generate summary and recommendations
  const workingTests = Object.values(results.tests).filter(test => test.success).length;
  const totalTests = Object.keys(results.tests).length;
  
  results.summary.overallWorking = workingTests === totalTests;

  // Generate specific recommendations
  if (!results.tests.internetConnection.success) {
    results.summary.issues.push('No internet connection');
    results.summary.recommendations.push('📶 Check your device\'s internet connection');
    results.summary.recommendations.push('📡 Try switching between WiFi and cellular data');
  }

  if (!results.tests.basicConnection.success && results.tests.internetConnection.success) {
    results.summary.issues.push('Cannot reach Supabase servers');
    results.summary.recommendations.push('🔧 Check if Supabase URL is correct');
    results.summary.recommendations.push('🔒 Check firewall/proxy settings');
  }

  if (!results.tests.authConnection.success && results.tests.basicConnection.success) {
    results.summary.issues.push('Supabase authentication issues');
    results.summary.recommendations.push('🔑 Check if API key is valid');
    results.summary.recommendations.push('⚙️ Verify Supabase project settings');
  }

  if (!results.tests.databaseConnection.success && results.tests.authConnection.success) {
    results.summary.issues.push('Database query issues');
    results.summary.recommendations.push('🗄️ Check if users table exists');
    results.summary.recommendations.push('🔐 Verify RLS policies allow reading');
  }

  if (results.summary.overallWorking) {
    results.summary.recommendations.push('✅ All network tests passed - the issue might be specific to storage operations');
    results.summary.recommendations.push('🔧 Try running the bucket setup SQL if you haven\'t already');
  }

  console.log('🌐 Network test completed:', results);
  return results;
};

export const formatSimpleNetworkResults = (results) => {
  const lines = [
    `🌐 NETWORK CONNECTIVITY TEST`,
    `Timestamp: ${results.timestamp}`,
    ``,
    `📊 TEST RESULTS (${Object.values(results.tests).filter(t => t.success).length}/${Object.keys(results.tests).length} passed):`,
    ``,
    `🌍 Internet Connection: ${results.tests.internetConnection.success ? '✅' : '❌'} (${results.tests.internetConnection.responseTime}ms)`,
    `${results.tests.internetConnection.error ? `   Error: ${results.tests.internetConnection.error}` : ''}`,
    ``,
    `🔗 Supabase URL Access: ${results.tests.basicConnection.success ? '✅' : '❌'} (${results.tests.basicConnection.responseTime}ms)`,
    `${results.tests.basicConnection.error ? `   Error: ${results.tests.basicConnection.error}` : ''}`,
    ``,
    `🔐 Supabase Auth: ${results.tests.authConnection.success ? '✅' : '❌'} (${results.tests.authConnection.responseTime}ms)`,
    `${results.tests.authConnection.error ? `   Error: ${results.tests.authConnection.error}` : ''}`,
    `${results.tests.authConnection.userExists !== undefined ? `   User logged in: ${results.tests.authConnection.userExists ? '✅' : '❌'}` : ''}`,
    ``,
    `🗄️ Database Query: ${results.tests.databaseConnection.success ? '✅' : '❌'} (${results.tests.databaseConnection.responseTime}ms)`,
    `${results.tests.databaseConnection.error ? `   Error: ${results.tests.databaseConnection.error}` : ''}`,
    `${results.tests.databaseConnection.recordsFound !== undefined ? `   Records found: ${results.tests.databaseConnection.recordsFound}` : ''}`,
  ].filter(line => line !== '');

  if (results.summary.issues.length > 0) {
    lines.push(
      ``,
      `⚠️ ISSUES FOUND:`,
      ...results.summary.issues.map(issue => `  • ${issue}`)
    );
  }

  lines.push(
    ``,
    `🛠️ RECOMMENDATIONS:`
  );

  results.summary.recommendations.forEach(rec => {
    lines.push(`  ${rec}`);
  });

  return lines.join('\n');
};
