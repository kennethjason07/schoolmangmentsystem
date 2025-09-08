/**
 * 🔍 SUPABASE CLIENT DEBUG TEST
 * Quick test to verify Supabase client initialization and basic operations
 */

import { supabase } from './supabase';

export const testSupabaseClient = async () => {
  console.log('🧪 SUPABASE DEBUG TEST: Starting tests...');
  
  // Test 1: Check if supabase client exists
  console.log('🧪 Test 1: Supabase client exists:', !!supabase);
  console.log('🧪 Test 1: Supabase type:', typeof supabase);
  console.log('🧪 Test 1: Supabase constructor:', supabase?.constructor?.name);
  
  // Test 2: Check if from method exists
  console.log('🧪 Test 2: supabase.from exists:', !!supabase?.from);
  console.log('🧪 Test 2: supabase.from type:', typeof supabase?.from);
  
  // Test 3: Try creating a query for fee_structure table
  try {
    console.log('🧪 Test 3: Creating query for fee_structure table...');
    const query = supabase.from('fee_structure');
    console.log('🧪 Test 3: Query created:', !!query);
    console.log('🧪 Test 3: Query type:', typeof query);
    console.log('🧪 Test 3: Query has .eq method:', !!query?.eq);
    console.log('🧪 Test 3: .eq method type:', typeof query?.eq);
    
    // Test 4: Try calling .eq() method
    console.log('🧪 Test 4: Testing .eq() method...');
    const queryWithEq = query.eq('tenant_id', 'test-tenant-id');
    console.log('🧪 Test 4: .eq() method works:', !!queryWithEq);
    console.log('🧪 Test 4: Query after .eq() type:', typeof queryWithEq);
    
  } catch (error) {
    console.error('❌ Test 3/4 failed with error:', error);
    console.error('Error stack:', error.stack);
  }
  
  // Test 5: Try creating a query for classes table
  try {
    console.log('🧪 Test 5: Creating query for classes table...');
    const classesQuery = supabase.from('classes');
    console.log('🧪 Test 5: Classes query created:', !!classesQuery);
    
    const classesWithEq = classesQuery.eq('tenant_id', 'test-tenant-id');
    console.log('🧪 Test 5: Classes .eq() method works:', !!classesWithEq);
    
  } catch (error) {
    console.error('❌ Test 5 failed with error:', error);
  }
  
  // Test 6: Check Supabase client properties
  console.log('🧪 Test 6: Supabase client properties:');
  if (supabase) {
    console.log('  - keys:', Object.keys(supabase).slice(0, 10));
    console.log('  - auth exists:', !!supabase.auth);
    console.log('  - storage exists:', !!supabase.storage);
    console.log('  - rest exists:', !!supabase.rest);
    console.log('  - realtime exists:', !!supabase.realtime);
  }
  
  // Test 7: Check environment and import
  console.log('🧪 Test 7: Environment check:');
  console.log('  - Platform:', typeof window !== 'undefined' ? 'web' : 'non-web');
  console.log('  - Node.js version:', typeof process !== 'undefined' ? process.version : 'N/A');
  console.log('  - React Native:', typeof navigator !== 'undefined' && navigator.product === 'ReactNative');
  
  console.log('🧪 SUPABASE DEBUG TEST: Tests completed');
};

// Auto-run the test when this module is imported
testSupabaseClient().catch(error => {
  console.error('🧪 SUPABASE DEBUG TEST: Failed to run tests:', error);
});
