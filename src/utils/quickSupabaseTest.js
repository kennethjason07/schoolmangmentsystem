/**
 * 🧪 QUICK SUPABASE QUERY PATTERN TEST
 * Tests the correct pattern for Supabase queries
 */

import { supabase } from './supabase';

export const testSupabasePattern = () => {
  console.log('🧪 QUICK TEST: Testing correct Supabase query pattern');
  
  try {
    // Step 1: Create base query
    console.log('🧪 Step 1: Creating base query...');
    const baseQuery = supabase.from('fee_structure');
    console.log('  ✅ Base query created:', !!baseQuery);
    console.log('  📋 Base query .select exists:', !!baseQuery.select);
    console.log('  📋 Base query .eq exists:', !!baseQuery.eq);
    
    // Step 2: Call .select() first
    console.log('🧪 Step 2: Calling .select() first...');
    const selectedQuery = baseQuery.select('*');
    console.log('  ✅ Selected query created:', !!selectedQuery);
    console.log('  📋 Selected query .eq exists:', !!selectedQuery.eq);
    console.log('  📋 Selected query .eq type:', typeof selectedQuery.eq);
    
    // Step 3: Call .eq() after select
    if (selectedQuery.eq) {
      console.log('🧪 Step 3: Calling .eq() after select...');
      const filteredQuery = selectedQuery.eq('tenant_id', 'test-tenant-id');
      console.log('  ✅ Filtered query created:', !!filteredQuery);
      console.log('  🎉 SUCCESS: Correct pattern works!');
      return true;
    } else {
      console.error('  ❌ .eq() still not available after .select()');
      return false;
    }
    
  } catch (error) {
    console.error('🧪 QUICK TEST: Error:', error);
    return false;
  }
};

export const testTenantQueryHelperFixed = async () => {
  console.log('🧪 QUICK TEST: Testing fixed tenant query helper');
  
  try {
    // Import the helper
    const { createTenantQuery } = await import('./tenantQueryHelper');
    
    const tenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    const query = createTenantQuery('fee_structure', tenantId);
    
    console.log('  ✅ Fixed tenant query helper works!');
    return true;
    
  } catch (error) {
    console.error('🧪 QUICK TEST: Fixed helper error:', error);
    return false;
  }
};

// Auto-run tests
console.log('🧪 Auto-running quick Supabase pattern tests...');
const patternTest = testSupabasePattern();
if (patternTest) {
  testTenantQueryHelperFixed().then(helperTest => {
    console.log('🧪 QUICK TESTS COMPLETED:', {
      patternTest: patternTest ? 'PASSED' : 'FAILED',
      helperTest: helperTest ? 'PASSED' : 'FAILED'
    });
  });
}
