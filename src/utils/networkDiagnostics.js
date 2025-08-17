// Network Diagnostics Utility
// Tests basic network connectivity to isolate network vs code issues

import { supabase } from './supabase';

export const runNetworkDiagnostics = async () => {
  console.log('🌐 Starting network diagnostics...');
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      overallHealth: false,
      networkIssues: [],
      recommendations: []
    }
  };

  try {
    // Test 1: Basic internet connectivity
    console.log('🌐 Test 1: Basic internet connectivity');
    try {
      const response = await fetch('https://httpbin.org/get', {
        method: 'GET',
        timeout: 10000
      });
      
      results.tests.push({
        name: 'Basic Internet Connectivity',
        success: response.ok,
        data: { status: response.status, statusText: response.statusText },
        error: null
      });
    } catch (error) {
      results.tests.push({
        name: 'Basic Internet Connectivity',
        success: false,
        data: null,
        error: error.message
      });
      results.summary.networkIssues.push('No basic internet connectivity');
    }

    // Test 2: Supabase API connectivity
    console.log('🔗 Test 2: Supabase API connectivity');
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      results.tests.push({
        name: 'Supabase API Connectivity',
        success: !error,
        data: data ? { recordCount: data.length } : null,
        error: error?.message || null
      });
    } catch (error) {
      results.tests.push({
        name: 'Supabase API Connectivity',
        success: false,
        data: null,
        error: error.message
      });
      results.summary.networkIssues.push('Cannot connect to Supabase API');
    }

    // Test 3: Direct HTTP to Supabase storage domain
    console.log('🗂️ Test 3: Supabase storage domain connectivity');
    try {
      const supabaseUrl = supabase.supabaseUrl;
      const projectId = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
      const storageUrl = `https://${projectId}.supabase.co/storage/v1`;
      
      console.log('📡 Testing storage URL:', storageUrl);
      
      const response = await fetch(storageUrl, {
        method: 'GET',
        timeout: 10000
      });
      
      results.tests.push({
        name: 'Supabase Storage Domain',
        success: response.status < 500, // Even 404 means we can reach the domain
        data: { 
          status: response.status, 
          statusText: response.statusText,
          storageUrl: storageUrl
        },
        error: null
      });
    } catch (error) {
      results.tests.push({
        name: 'Supabase Storage Domain',
        success: false,
        data: null,
        error: error.message
      });
      results.summary.networkIssues.push('Cannot reach Supabase storage domain');
    }

    // Test 4: DNS Resolution test
    console.log('🔍 Test 4: DNS resolution test');
    try {
      const supabaseUrl = supabase.supabaseUrl;
      const response = await fetch(supabaseUrl + '/rest/v1/', {
        method: 'GET',
        timeout: 5000
      });
      
      results.tests.push({
        name: 'DNS Resolution',
        success: response.status < 500,
        data: { status: response.status, url: supabaseUrl },
        error: null
      });
    } catch (error) {
      results.tests.push({
        name: 'DNS Resolution',
        success: false,
        data: null,
        error: error.message
      });
      results.summary.networkIssues.push('DNS resolution failed');
    }

    // Test 5: Check if behind corporate firewall
    console.log('🏢 Test 5: Corporate firewall detection');
    try {
      const response = await fetch('https://api.github.com', {
        method: 'GET',
        timeout: 5000
      });
      
      results.tests.push({
        name: 'External API Access (GitHub)',
        success: response.ok,
        data: { status: response.status },
        error: null
      });
      
      if (!response.ok) {
        results.summary.networkIssues.push('External API access blocked (possible corporate firewall)');
      }
    } catch (error) {
      results.tests.push({
        name: 'External API Access (GitHub)',
        success: false,
        data: null,
        error: error.message
      });
      results.summary.networkIssues.push('External API access blocked (possible corporate firewall)');
    }

    // Test 6: Check user agent restrictions
    console.log('🤖 Test 6: User agent test');
    try {
      const supabaseUrl = supabase.supabaseUrl;
      const projectId = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
      const storageUrl = `https://${projectId}.supabase.co/storage/v1/bucket`;
      
      const response = await fetch(storageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ReactNative/0.72.0)',
        },
        timeout: 5000
      });
      
      results.tests.push({
        name: 'Custom User Agent Test',
        success: response.status < 500,
        data: { status: response.status },
        error: null
      });
    } catch (error) {
      results.tests.push({
        name: 'Custom User Agent Test',
        success: false,
        data: null,
        error: error.message
      });
    }

    // Calculate overall health
    const successfulTests = results.tests.filter(test => test.success).length;
    const totalTests = results.tests.length;
    results.summary.overallHealth = successfulTests >= (totalTests * 0.5); // At least 50% success

    // Generate recommendations
    if (results.summary.networkIssues.length === 0) {
      results.summary.recommendations.push('Network connectivity appears normal - issue may be with Supabase storage service');
      results.summary.recommendations.push('Try testing from a different network/device');
      results.summary.recommendations.push('Check Supabase status page: https://status.supabase.com');
    } else {
      if (results.summary.networkIssues.includes('No basic internet connectivity')) {
        results.summary.recommendations.push('Check your internet connection');
        results.summary.recommendations.push('Verify WiFi/cellular data is working');
      }
      
      if (results.summary.networkIssues.includes('External API access blocked (possible corporate firewall)')) {
        results.summary.recommendations.push('You may be behind a corporate firewall');
        results.summary.recommendations.push('Try connecting from a different network (mobile hotspot)');
        results.summary.recommendations.push('Contact your IT admin about accessing *.supabase.co domains');
      }
      
      if (results.summary.networkIssues.includes('Cannot reach Supabase storage domain')) {
        results.summary.recommendations.push('Supabase storage domain is blocked or unreachable');
        results.summary.recommendations.push('Try switching to mobile data to test');
        results.summary.recommendations.push('Check if VPN is interfering');
      }
      
      if (results.summary.networkIssues.includes('DNS resolution failed')) {
        results.summary.recommendations.push('DNS resolution issue detected');
        results.summary.recommendations.push('Try changing DNS servers (8.8.8.8, 1.1.1.1)');
        results.summary.recommendations.push('Restart your router/modem');
      }
    }

    console.log('🌐 Network diagnostics completed:', results);
    return results;

  } catch (error) {
    console.error('❌ Network diagnostics failed:', error);
    return {
      timestamp: new Date().toISOString(),
      tests: [],
      success: false,
      error: error.message,
      summary: {
        overallHealth: false,
        networkIssues: ['Diagnostic test failed to run'],
        recommendations: ['Unable to complete network diagnostics', 'Check console for detailed error information']
      }
    };
  }
};

// Helper function to format results for display
export const formatNetworkDiagnosticResults = (results) => {
  if (!results.success && results.error) {
    return `Network Diagnostics Failed: ${results.error}`;
  }

  const passedTests = results.tests.filter(t => t.success).length;
  const totalTests = results.tests.length;
  
  let summary = `Network Health: ${results.summary.overallHealth ? '✅ Good' : '❌ Issues Found'}\n`;
  summary += `Tests Passed: ${passedTests}/${totalTests}\n\n`;
  
  if (results.summary.networkIssues.length > 0) {
    summary += `Issues Detected:\n${results.summary.networkIssues.map(issue => `• ${issue}`).join('\n')}\n\n`;
  }
  
  summary += `Recommendations:\n${results.summary.recommendations.map(rec => `• ${rec}`).join('\n')}`;
  
  return summary;
};
