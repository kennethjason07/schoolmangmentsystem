/**
 * 🧪 SUPABASE PRODUCTION ENVIRONMENT TEST
 * This test will run in the actual React Native environment to debug the issue
 */

import { supabase } from './supabase';
import { TenantAwareQueryBuilder } from './tenantValidation';

// Test 1: Basic Supabase Client Test
export const testSupabaseBasics = () => {
  console.log('🧪 PRODUCTION TEST: Basic Supabase Client Test');
  console.log('  📋 Supabase object exists:', !!supabase);
  console.log('  📋 Supabase type:', typeof supabase);
  console.log('  📋 Supabase.from exists:', !!supabase?.from);
  console.log('  📋 Supabase.from type:', typeof supabase?.from);
  
  if (supabase && supabase.from) {
    console.log('  📋 Testing basic query creation...');
    
    try {
      const testQuery = supabase.from('fee_structure');
      console.log('  ✅ Query created successfully:', !!testQuery);
      console.log('  📋 Query type:', typeof testQuery);
      console.log('  📋 Query.eq exists:', !!testQuery?.eq);
      console.log('  📋 Query.eq type:', typeof testQuery?.eq);
      
      if (testQuery && testQuery.eq) {
        console.log('  📋 Testing .eq() method...');
        const queryWithEq = testQuery.eq('tenant_id', 'test-id-123');
        console.log('  ✅ .eq() method works:', !!queryWithEq);
        console.log('  📋 Query after .eq() type:', typeof queryWithEq);
      } else {
        console.error('  ❌ Query object missing .eq() method');
      }
      
    } catch (error) {
      console.error('  ❌ Error in basic query test:', error);
      console.error('  📋 Error name:', error.name);
      console.error('  📋 Error message:', error.message);
    }
  } else {
    console.error('  ❌ Supabase client or .from method is missing');
  }
};

// Test 2: TenantAwareQueryBuilder Test
export const testTenantQueryBuilder = () => {
  console.log('🧪 PRODUCTION TEST: TenantAwareQueryBuilder Test');
  
  try {
    const tenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    const tableName = 'fee_structure';
    
    console.log('  📋 Creating TenantAwareQueryBuilder...');
    console.log('  📋 Tenant ID:', tenantId);
    console.log('  📋 Table Name:', tableName);
    
    const builder = new TenantAwareQueryBuilder(tenantId, tableName);
    console.log('  ✅ TenantAwareQueryBuilder created successfully');
    console.log('  📋 Builder.query exists:', !!builder.query);
    
    if (builder.query) {
      console.log('  📋 Builder.query type:', typeof builder.query);
      console.log('  📋 Builder.query.select exists:', !!builder.query.select);
      
      // Test the select method
      try {
        const selectedQuery = builder.select('*');
        console.log('  ✅ Select method works:', !!selectedQuery);
      } catch (selectError) {
        console.error('  ❌ Error with select method:', selectError);
      }
    }
    
  } catch (error) {
    console.error('  ❌ Error creating TenantAwareQueryBuilder:', error);
    console.error('  📋 Error name:', error.name);
    console.error('  📋 Error message:', error.message);
    console.error('  📋 Error stack:', error.stack);
  }
};

// Test 3: Multiple Table Test
export const testMultipleTables = () => {
  console.log('🧪 PRODUCTION TEST: Multiple Tables Test');
  
  const tables = ['fee_structure', 'classes', 'students', 'teachers', 'users'];
  
  tables.forEach(table => {
    try {
      console.log(`  📋 Testing table: ${table}`);
      const query = supabase.from(table);
      console.log(`    ✅ Query for ${table} created:`, !!query);
      
      if (query && query.eq) {
        const queryWithEq = query.eq('tenant_id', 'test-id');
        console.log(`    ✅ .eq() for ${table} works:`, !!queryWithEq);
      } else {
        console.error(`    ❌ Query for ${table} missing .eq() method`);
      }
      
    } catch (error) {
      console.error(`    ❌ Error with table ${table}:`, error.message);
    }
  });
};

// Test 4: Environment Information
export const testEnvironmentInfo = () => {
  console.log('🧪 PRODUCTION TEST: Environment Information');
  console.log('  📋 Platform:', 
    typeof window !== 'undefined' ? 'Web Browser' :
    typeof global !== 'undefined' && global.navigator?.product === 'ReactNative' ? 'React Native' :
    typeof process !== 'undefined' ? 'Node.js' : 'Unknown'
  );
  
  if (typeof global !== 'undefined') {
    console.log('  📋 React Native Global:', !!global);
    console.log('  📋 Navigator Product:', global.navigator?.product);
  }
  
  if (typeof window !== 'undefined') {
    console.log('  📋 Window exists:', !!window);
    console.log('  📋 Document exists:', !!window.document);
  }
  
  console.log('  📋 Supabase import path: ./supabase');
  console.log('  📋 Current function context:', typeof this);
};

// Main test runner
export const runAllProductionTests = () => {
  console.log('🚀 STARTING ALL PRODUCTION TESTS');
  console.log('='.repeat(50));
  
  testEnvironmentInfo();
  console.log('-'.repeat(50));
  
  testSupabaseBasics();
  console.log('-'.repeat(50));
  
  testTenantQueryBuilder();
  console.log('-'.repeat(50));
  
  testMultipleTables();
  console.log('-'.repeat(50));
  
  console.log('✅ ALL PRODUCTION TESTS COMPLETED');
  console.log('='.repeat(50));
};

// Auto-run test in development
if (__DEV__) {
  setTimeout(() => {
    console.log('🧪 Auto-running production tests in 2 seconds...');
    runAllProductionTests();
  }, 2000);
}
