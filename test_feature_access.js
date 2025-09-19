/**
 * Test Script for Feature-Based Access Control System
 * 
 * This script can be used to verify that the feature access control
 * is working correctly for the tenant with restricted features.
 * 
 * Tenant ID: 826dbf39-6646-407d-9748-df2e1413343a
 * Email: hanokwarp@gmail.com
 * Expected: Only stationary_management should be true
 */

const { createClient } = require('@supabase/supabase-js');

// Replace with your actual Supabase credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

async function testFeatureAccess() {
  console.log('🧪 Testing Feature-Based Access Control System');
  console.log('=' .repeat(50));
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // Test 1: Verify tenant features configuration
    console.log('📋 Test 1: Checking tenant features configuration...');
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, contact_email, features')
      .eq('id', '826dbf39-6646-407d-9748-df2e1413343a')
      .single();
    
    if (tenantError) {
      console.error('❌ Failed to fetch tenant:', tenantError);
      return;
    }
    
    console.log('✅ Tenant found:', {
      name: tenant.name,
      email: tenant.contact_email,
      features: tenant.features
    });
    
    // Test 2: Verify only stationary_management is enabled
    console.log('\n📋 Test 2: Verifying feature restrictions...');
    
    const features = tenant.features || {};
    const expectedFeatures = {
      'stationary_management': true,
      'fee_management': false,
      'student_management': false,
      'teacher_management': false,
      'class_management': false,
      'analytics_reports': false
    };
    
    let testsPassed = 0;
    let testsTotal = Object.keys(expectedFeatures).length;
    
    for (const [feature, expectedValue] of Object.entries(expectedFeatures)) {
      const actualValue = features[feature];
      const passed = actualValue === expectedValue;
      
      console.log(`${passed ? '✅' : '❌'} ${feature}: ${actualValue} (expected: ${expectedValue})`);
      
      if (passed) testsPassed++;
    }
    
    console.log(`\n📊 Feature Test Results: ${testsPassed}/${testsTotal} passed`);
    
    // Test 3: Verify user is linked to correct tenant
    console.log('\n📋 Test 3: Checking user-tenant linkage...');
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id, role_id, roles(role_name)')
      .eq('email', 'hanokwarp@gmail.com')
      .single();
    
    if (userError) {
      console.error('❌ Failed to fetch user:', userError);
      return;
    }
    
    const isCorrectTenant = user.tenant_id === tenant.id;
    console.log(`${isCorrectTenant ? '✅' : '❌'} User linked to correct tenant: ${isCorrectTenant}`);
    console.log('👤 User details:', {
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.roles?.role_name || 'Unknown'
    });
    
    // Test 4: Summary
    console.log('\n🎯 Test Summary:');
    console.log('=' .repeat(50));
    
    if (testsPassed === testsTotal && isCorrectTenant) {
      console.log('🎉 All tests PASSED! Feature access control is configured correctly.');
      console.log('💡 Expected behavior:');
      console.log('   ✅ Stationary Management - ACCESSIBLE');
      console.log('   ❌ Fee Management - BLOCKED');
      console.log('   ❌ Student Management - BLOCKED');
      console.log('   ❌ Teacher Management - BLOCKED');
      console.log('   ❌ Class Management - BLOCKED');
      console.log('   ❌ Analytics Reports - BLOCKED');
    } else {
      console.log('⚠️  Some tests FAILED. Please check the configuration.');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  testFeatureAccess();
}

module.exports = { testFeatureAccess };