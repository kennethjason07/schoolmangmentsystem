/**
 * 🧪 MANUAL TEST RUNNER
 * Run database tests manually after user authentication is complete
 * This prevents database queries from running before login
 */

import { runAllProductionTests } from './supabaseProductionTest';
import { testTenantQueryHelper, createTenantQuery, executeTenantQuery } from './tenantQueryHelper';
import { testSupabasePattern, testTenantQueryHelperFixed } from './quickSupabaseTest';
import { testFixedTenantAwareQueryBuilder, testTenantBuilderVsDirectComparison } from './testFixedTenantBuilder';

/**
 * Run all database tests manually after authentication
 * Call this from authenticated screens or after login is complete
 * @param {string} tenantId - The authenticated user's tenant ID
 */
export const runPostAuthenticationTests = async (tenantId = 'b8f8b5f0-1234-4567-8901-123456789000') => {
  console.log('🧪 RUNNING POST-AUTHENTICATION TESTS');
  console.log('=' .repeat(50));
  console.log('🔐 User is authenticated - safe to run database tests');
  console.log('🏢 Tenant ID:', tenantId);
  console.log('');

  try {
    // 1. Quick Supabase pattern tests
    console.log('1️⃣ Running Supabase pattern tests...');
    const patternTest = testSupabasePattern();
    if (patternTest) {
      const helperTest = await testTenantQueryHelperFixed();
      console.log('✅ Quick tests completed:', {
        patternTest: patternTest ? 'PASSED' : 'FAILED',
        helperTest: helperTest ? 'PASSED' : 'FAILED'
      });
    }
    console.log('');

    // 2. TenantAwareQueryBuilder tests
    console.log('2️⃣ Running TenantAwareQueryBuilder tests...');
    const comparisonResult = await testTenantBuilderVsDirectComparison();
    console.log('✅ Builder tests completed:', comparisonResult.bothWork ? 'BOTH METHODS WORKING!' : 'NEEDS WORK');
    console.log('');

    // 3. Tenant query helper tests
    console.log('3️⃣ Running tenant query helper tests...');
    const tenantHelperResult = await testTenantQueryHelper(tenantId);
    console.log('✅ Tenant helper tests:', tenantHelperResult ? 'PASSED' : 'FAILED');
    console.log('');

    // 4. Full production tests (optional - can be heavy)
    console.log('4️⃣ Running full production tests...');
    runAllProductionTests();
    
    console.log('');
    console.log('🎉 ALL POST-AUTHENTICATION TESTS COMPLETED');
    console.log('=' .repeat(50));
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in post-authentication tests:', error);
    return false;
  }
};

/**
 * Run lightweight tests for quick verification
 * @param {string} tenantId - The authenticated user's tenant ID
 */
export const runQuickPostAuthTests = async (tenantId) => {
  console.log('🚀 QUICK POST-AUTH VERIFICATION');
  
  try {
    // Test basic query pattern
    const patternTest = testSupabasePattern();
    
    // Test tenant query helper
    const helperTest = await testTenantQueryHelper(tenantId);
    
    const success = patternTest && helperTest;
    console.log('🎯 Quick verification:', success ? '✅ PASSED' : '❌ FAILED');
    
    return success;
    
  } catch (error) {
    console.error('❌ Quick test error:', error);
    return false;
  }
};

/**
 * Call this from authenticated screens to verify database connectivity
 * Example usage in a dashboard or home screen:
 * 
 * import { runPostAuthenticationTests } from '../utils/manualTestRunner';
 * 
 * useEffect(() => {
 *   if (isAuthenticated && currentTenant?.id) {
 *     runPostAuthenticationTests(currentTenant.id);
 *   }
 * }, [isAuthenticated, currentTenant]);
 */
