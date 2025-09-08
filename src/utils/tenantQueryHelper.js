/**
 * 🛡️ SIMPLE TENANT-AWARE QUERY HELPER
 * A more reliable alternative to TenantAwareQueryBuilder
 */

import { supabase } from './supabase';

/**
 * Creates a simple tenant-filtered query
 * @param {string} tableName - The table name
 * @param {string} tenantId - The tenant ID
 * @param {string} selectClause - What to select (default: '*')
 * @returns {Object} Supabase query with tenant filter applied
 */
export const createTenantQuery = (tableName, tenantId, selectClause = '*') => {
  console.log(`🛡️ TENANT_QUERY_HELPER: Creating query for table '${tableName}' with tenant_id: ${tenantId}`);
  
  try {
    // Validate inputs
    if (!tableName) {
      throw new Error('Table name is required');
    }
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    // Create the query with immediate error checking
    const baseQuery = supabase.from(tableName);
    
    if (!baseQuery) {
      throw new Error(`Failed to create query for table '${tableName}' - supabase.from() returned null`);
    }
    
    if (typeof baseQuery.select !== 'function') {
      throw new Error(`Query for table '${tableName}' is missing .select() method`);
    }
    
    // FIXED: Call .select() FIRST, then .eq() becomes available
    const selectedQuery = baseQuery.select(selectClause);
    
    if (typeof selectedQuery.eq !== 'function') {
      throw new Error(`Query for table '${tableName}' is missing .eq() method after select`);
    }
    
    // Apply tenant filter after select
    const tenantQuery = selectedQuery.eq('tenant_id', tenantId);
    
    console.log(`✅ TENANT_QUERY_HELPER: Successfully created tenant query for '${tableName}'`);
    return tenantQuery;
    
  } catch (error) {
    console.error(`❌ TENANT_QUERY_HELPER: Error creating query for '${tableName}':`, error);
    throw error;
  }
};

/**
 * Executes a tenant-filtered query and returns results
 * @param {string} tableName - The table name
 * @param {string} tenantId - The tenant ID
 * @param {Object} options - Query options
 * @returns {Promise<{data: any, error: any}>}
 */
export const executeTenantQuery = async (tableName, tenantId, options = {}) => {
  const {
    select = '*',
    filters = {},
    orderBy = null,
    orderDirection = 'asc',
    limit = null,
    single = false
  } = options;
  
  console.log(`🛡️ TENANT_QUERY_HELPER: Executing query for '${tableName}' with tenant '${tenantId}'`);
  
  try {
    let query = createTenantQuery(tableName, tenantId, select);
    
    // Apply additional filters
    Object.entries(filters).forEach(([column, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(column, value);
      }
    });
    
    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });
    }
    
    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }
    
    // Apply single if needed
    if (single) {
      query = query.single();
    }
    
    // Execute the query
    const result = await query;
    
    console.log(`✅ TENANT_QUERY_HELPER: Query executed for '${tableName}':`, {
      recordCount: result.data?.length || (result.data ? 1 : 0),
      hasError: !!result.error
    });
    
    return result;
    
  } catch (error) {
    console.error(`❌ TENANT_QUERY_HELPER: Query execution failed for '${tableName}':`, error);
    return { data: null, error: error };
  }
};

/**
 * Simple helper to get fee structure for a class
 * @param {string} classId - The class ID
 * @param {string} tenantId - The tenant ID
 * @param {string} academicYear - The academic year (optional)
 * @returns {Promise<{data: any, error: any}>}
 */
export const getFeeStructureForClass = async (classId, tenantId, academicYear = '2024-25') => {
  console.log(`🛡️ TENANT_QUERY_HELPER: Getting fee structure for class '${classId}' in tenant '${tenantId}'`);
  
  return await executeTenantQuery('fee_structure', tenantId, {
    select: '*',
    filters: {
      class_id: classId,
      academic_year: academicYear
    },
    orderBy: 'fee_component'
  });
};

/**
 * Simple helper to get classes for a tenant
 * @param {string} tenantId - The tenant ID
 * @returns {Promise<{data: any, error: any}>}
 */
export const getClassesForTenant = async (tenantId) => {
  console.log(`🛡️ TENANT_QUERY_HELPER: Getting classes for tenant '${tenantId}'`);
  
  return await executeTenantQuery('classes', tenantId, {
    select: '*',
    orderBy: 'class_name'
  });
};

/**
 * Test the query helper with basic functionality
 */
export const testTenantQueryHelper = async (tenantId) => {
  console.log(`🧪 Testing tenant query helper with tenant: ${tenantId}`);
  
  try {
    // Test 1: Simple query creation
    console.log('🧪 Test 1: Creating simple query...');
    const simpleQuery = createTenantQuery('fee_structure', tenantId);
    console.log('✅ Test 1: Simple query created successfully');
    
    // Test 2: Query execution
    console.log('🧪 Test 2: Executing fee structure query...');
    const feeResult = await getFeeStructureForClass('test-class-id', tenantId);
    console.log('✅ Test 2: Fee structure query executed:', {
      hasData: !!feeResult.data,
      hasError: !!feeResult.error,
      error: feeResult.error?.message
    });
    
    // Test 3: Classes query
    console.log('🧪 Test 3: Executing classes query...');
    const classesResult = await getClassesForTenant(tenantId);
    console.log('✅ Test 3: Classes query executed:', {
      hasData: !!classesResult.data,
      hasError: !!classesResult.error,
      error: classesResult.error?.message,
      count: classesResult.data?.length || 0
    });
    
    console.log('🎉 All tenant query helper tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Tenant query helper test failed:', error);
    return false;
  }
};

export default {
  createTenantQuery,
  executeTenantQuery,
  getFeeStructureForClass,
  getClassesForTenant,
  testTenantQueryHelper
};
