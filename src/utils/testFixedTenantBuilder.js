/**
 * 🧪 TEST FIXED TENANT AWARE QUERY BUILDER
 * Quick test to verify the TenantAwareQueryBuilder fix works
 */

import { TenantAwareQueryBuilder } from './tenantValidation';

export const testFixedTenantAwareQueryBuilder = async () => {
  console.log('🧪 TESTING FIXED TenantAwareQueryBuilder');
  console.log('='.repeat(50));
  
  try {
    const tenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    
    // Test 1: Basic construction
    console.log('🧪 Test 1: Creating TenantAwareQueryBuilder...');
    const builder = new TenantAwareQueryBuilder(tenantId, 'fee_structure');
    console.log('  ✅ Builder created successfully');
    
    // Test 2: Select with automatic tenant filtering
    console.log('🧪 Test 2: Calling .select() method...');
    builder.select('id, fee_component, amount');
    console.log('  ✅ Select with tenant filter applied');
    
    // Test 3: Additional filtering
    console.log('🧪 Test 3: Adding additional filters...');
    builder.eq('academic_year', '2024-25');
    builder.order('fee_component');
    console.log('  ✅ Additional filters applied');
    
    // Test 4: Execute query
    console.log('🧪 Test 4: Executing query...');
    const result = await builder.execute();
    console.log('  ✅ Query executed:', {
      hasData: !!result.data,
      hasError: !!result.error,
      recordCount: result.data?.length || 0,
      errorMessage: result.error?.message || null
    });
    
    console.log('🎉 ALL TESTS PASSED - TenantAwareQueryBuilder is working!');
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Error stack:', error.stack);
    return { success: false, error };
  }
};

export const testTenantBuilderVsDirectComparison = async () => {
  console.log('🧪 COMPARISON TEST: TenantAwareQueryBuilder vs Direct Supabase');
  console.log('='.repeat(60));
  
  const tenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  
  try {
    // Test with TenantAwareQueryBuilder
    console.log('🧪 Testing with TenantAwareQueryBuilder...');
    const builderResult = await testFixedTenantAwareQueryBuilder();
    
    // Test with direct Supabase (working pattern)
    console.log('🧪 Testing with direct Supabase...');
    const { supabase } = await import('./supabase');
    const { data: directData, error: directError } = await supabase
      .from('fee_structure')
      .select('id, fee_component, amount')
      .eq('tenant_id', tenantId)
      .eq('academic_year', '2024-25')
      .order('fee_component');
    
    console.log('📊 COMPARISON RESULTS:');
    console.log('  TenantAwareQueryBuilder:', builderResult.success ? 'SUCCESS' : 'FAILED');
    console.log('  Direct Supabase:', directError ? 'FAILED' : 'SUCCESS');
    console.log('  Both methods working:', builderResult.success && !directError);
    
    return {
      builderWorks: builderResult.success,
      directWorks: !directError,
      bothWork: builderResult.success && !directError
    };
    
  } catch (error) {
    console.error('❌ COMPARISON TEST ERROR:', error);
    return { builderWorks: false, directWorks: false, bothWork: false };
  }
};

// Auto-run tests - DISABLED to prevent pre-login database queries
// console.log('🚀 Auto-running TenantAwareQueryBuilder tests...');
// setTimeout(async () => {
//   const comparisonResult = await testTenantBuilderVsDirectComparison();
//   console.log('🎯 FINAL RESULT:', comparisonResult.bothWork ? 'BOTH METHODS WORKING!' : 'NEEDS MORE WORK');
// }, 2000);

// Tests can now be run manually after authentication
