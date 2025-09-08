/**
 * 🔍 TENANT QUERY DEBUG TEST
 * Simple test to debug the TenantAwareQueryBuilder issue
 */

import { supabase, TABLES } from './supabase';

// Test direct supabase usage
export const testDirectSupabase = async () => {
  console.log('🧪 DIRECT SUPABASE TEST: Starting...');
  
  try {
    console.log('🧪 Step 1: Check supabase client');
    console.log('  - supabase exists:', !!supabase);
    console.log('  - supabase.from exists:', !!supabase.from);
    console.log('  - supabase type:', typeof supabase);
    
    console.log('🧪 Step 2: Test basic query creation');
    const query = supabase.from('fee_structure');
    console.log('  - Query created:', !!query);
    console.log('  - Query type:', typeof query);
    console.log('  - Query.eq exists:', !!query.eq);
    console.log('  - Query.eq type:', typeof query.eq);
    
    console.log('🧪 Step 3: Test .eq() method');
    const queryWithEq = query.eq('tenant_id', 'test-tenant-id');
    console.log('  - Query with .eq() created:', !!queryWithEq);
    console.log('  - Query with .eq() type:', typeof queryWithEq);
    
    console.log('🧪 Step 4: Test classes table');
    const classesQuery = supabase.from('classes');
    console.log('  - Classes query created:', !!classesQuery);
    
    const classesWithEq = classesQuery.eq('tenant_id', 'test-tenant-id');
    console.log('  - Classes with .eq() created:', !!classesWithEq);
    
    console.log('🧪 Step 5: Test TABLES constants');
    console.log('  - TABLES.FEE_STRUCTURE:', TABLES.FEE_STRUCTURE);
    console.log('  - TABLES.CLASSES:', TABLES.CLASSES);
    
    console.log('🧪 Step 6: Test with TABLES constants');
    const tableQuery = supabase.from(TABLES.FEE_STRUCTURE);
    console.log('  - Table query created:', !!tableQuery);
    
    const tableWithEq = tableQuery.eq('tenant_id', 'test-tenant-id');
    console.log('  - Table with .eq() created:', !!tableWithEq);
    
    console.log('✅ DIRECT SUPABASE TEST: All tests passed');
    
  } catch (error) {
    console.error('❌ DIRECT SUPABASE TEST: Error occurred:', error);
    console.error('Error stack:', error.stack);
  }
};

// Test TenantAwareQueryBuilder specifically
export const testTenantQueryBuilder = async () => {
  console.log('🧪 TENANT QUERY BUILDER TEST: Starting...');
  
  try {
    const tenantId = 'test-tenant-id-123';
    const tableName = 'fee_structure';
    
    console.log('🧪 Step 1: Manual TenantAwareQueryBuilder construction');
    console.log('  - tenantId:', tenantId);
    console.log('  - tableName:', tableName);
    
    // Manually replicate TenantAwareQueryBuilder logic
    console.log('🧪 Step 2: Creating base query');
    const baseQuery = supabase.from(tableName);
    console.log('  - Base query created:', !!baseQuery);
    console.log('  - Base query type:', typeof baseQuery);
    console.log('  - Base query .eq exists:', !!baseQuery.eq);
    console.log('  - Base query .eq type:', typeof baseQuery.eq);
    
    console.log('🧪 Step 3: Adding tenant filter');
    const filteredQuery = baseQuery.eq('tenant_id', tenantId);
    console.log('  - Filtered query created:', !!filteredQuery);
    console.log('  - Filtered query type:', typeof filteredQuery);
    
    console.log('🧪 Step 4: Test with actual TenantAwareQueryBuilder');
    // Import here to avoid circular dependency issues
    const { TenantAwareQueryBuilder } = await import('./tenantValidation');
    
    console.log('🧪 Step 5: Create TenantAwareQueryBuilder instance');
    const builder = new TenantAwareQueryBuilder(tenantId, tableName);
    console.log('  - Builder created:', !!builder);
    console.log('  - Builder query exists:', !!builder.query);
    
    console.log('✅ TENANT QUERY BUILDER TEST: All tests passed');
    
  } catch (error) {
    console.error('❌ TENANT QUERY BUILDER TEST: Error occurred:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
};

// Run tests automatically
if (typeof window === 'undefined') {
  // Running in Node.js environment
  testDirectSupabase()
    .then(() => testTenantQueryBuilder())
    .catch(console.error);
} else {
  // Running in browser/React Native
  setTimeout(() => {
    testDirectSupabase()
      .then(() => testTenantQueryBuilder())
      .catch(console.error);
  }, 1000);
}

export default {
  testDirectSupabase,
  testTenantQueryBuilder
};
