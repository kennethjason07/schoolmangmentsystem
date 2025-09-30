import { supabase } from './supabase';

/**
 * Batch operations utility to reduce API calls
 * Provides functions for bulk insert/upsert/delete operations
 */

/**
 * Batch insert multiple records to a table
 * @param {string} tableName - Name of the table
 * @param {Array} records - Array of records to insert
 * @param {Object} options - Options for the operation
 * @returns {Promise} - Result of the batch operation
 */
export const batchInsert = async (tableName, records, options = {}) => {
  if (!records || records.length === 0) {
    return { data: [], error: null };
  }

  const { chunkSize = 1000, onProgress } = options;
  
  try {
    // Split into chunks to avoid payload size limits
    const chunks = [];
    for (let i = 0; i < records.length; i += chunkSize) {
      chunks.push(records.slice(i, i + chunkSize));
    }

    const allResults = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📦 Batch inserting chunk ${i + 1}/${chunks.length} (${chunk.length} records) to ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .insert(chunk)
        .select();

      if (error) {
        console.error(`❌ Batch insert error for chunk ${i + 1}:`, error);
        throw error;
      }

      if (data) {
        allResults.push(...data);
      }

      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: chunks.length,
          recordsProcessed: (i + 1) * chunkSize,
          totalRecords: records.length
        });
      }
    }

    console.log(`✅ Batch insert completed: ${allResults.length} records inserted to ${tableName}`);
    return { data: allResults, error: null };
    
  } catch (error) {
    console.error(`❌ Batch insert failed for ${tableName}:`, error);
    return { data: null, error };
  }
};

/**
 * Batch upsert (insert or update) multiple records to a table
 * @param {string} tableName - Name of the table
 * @param {Array} records - Array of records to upsert
 * @param {Object} options - Options including onConflict columns
 * @returns {Promise} - Result of the batch operation
 */
export const batchUpsert = async (tableName, records, options = {}) => {
  if (!records || records.length === 0) {
    return { data: [], error: null };
  }

  const { chunkSize = 1000, onConflict, onProgress } = options;
  
  try {
    // Split into chunks
    const chunks = [];
    for (let i = 0; i < records.length; i += chunkSize) {
      chunks.push(records.slice(i, i + chunkSize));
    }

    const allResults = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📦 Batch upserting chunk ${i + 1}/${chunks.length} (${chunk.length} records) to ${tableName}`);
      
      let query = supabase.from(tableName).upsert(chunk, { onConflict });
      
      // Always select to get the results back
      query = query.select();

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Batch upsert error for chunk ${i + 1}:`, error);
        throw error;
      }

      if (data) {
        allResults.push(...data);
      }

      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: chunks.length,
          recordsProcessed: (i + 1) * chunkSize,
          totalRecords: records.length
        });
      }
    }

    console.log(`✅ Batch upsert completed: ${allResults.length} records processed for ${tableName}`);
    return { data: allResults, error: null };
    
  } catch (error) {
    console.error(`❌ Batch upsert failed for ${tableName}:`, error);
    return { data: null, error };
  }
};

/**
 * Batch delete records from a table using a list of IDs
 * @param {string} tableName - Name of the table
 * @param {Array} ids - Array of IDs to delete
 * @param {Object} options - Options for the operation
 * @returns {Promise} - Result of the batch operation
 */
export const batchDelete = async (tableName, ids, options = {}) => {
  if (!ids || ids.length === 0) {
    return { data: [], error: null };
  }

  const { idColumn = 'id', chunkSize = 1000, onProgress } = options;
  
  try {
    // Split into chunks to avoid URL length limits
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    let totalDeleted = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📦 Batch deleting chunk ${i + 1}/${chunks.length} (${chunk.length} records) from ${tableName}`);
      
      const { error, count } = await supabase
        .from(tableName)
        .delete()
        .in(idColumn, chunk);

      if (error) {
        console.error(`❌ Batch delete error for chunk ${i + 1}:`, error);
        throw error;
      }

      totalDeleted += count || chunk.length;

      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: chunks.length,
          recordsProcessed: (i + 1) * chunkSize,
          totalRecords: ids.length
        });
      }
    }

    console.log(`✅ Batch delete completed: ${totalDeleted} records deleted from ${tableName}`);
    return { data: { count: totalDeleted }, error: null };
    
  } catch (error) {
    console.error(`❌ Batch delete failed for ${tableName}:`, error);
    return { data: null, error };
  }
};

/**
 * Replace all records in a table for a specific condition (delete + insert)
 * Useful for replacing all marks for an exam, all students for a class, etc.
 * @param {string} tableName - Name of the table
 * @param {Object} whereCondition - Condition to match existing records
 * @param {Array} newRecords - New records to insert
 * @param {Object} options - Options for the operation
 * @returns {Promise} - Result of the replace operation
 */
export const batchReplace = async (tableName, whereCondition, newRecords, options = {}) => {
  try {
    console.log(`🔄 Batch replace starting for ${tableName}:`, {
      whereCondition,
      newRecordsCount: newRecords?.length || 0
    });

    // Step 1: Delete existing records
    let deleteQuery = supabase.from(tableName).delete();
    
    // Apply where conditions
    Object.entries(whereCondition).forEach(([column, value]) => {
      deleteQuery = deleteQuery.eq(column, value);
    });

    const { error: deleteError } = await deleteQuery;
    
    if (deleteError) {
      console.error('❌ Error deleting existing records:', deleteError);
      throw deleteError;
    }

    console.log('✅ Existing records deleted successfully');

    // Step 2: Insert new records (if any)
    if (newRecords && newRecords.length > 0) {
      const { data, error: insertError } = await batchInsert(tableName, newRecords, options);
      
      if (insertError) {
        throw insertError;
      }
      
      console.log(`✅ Batch replace completed: ${data?.length || 0} new records inserted`);
      return { data, error: null };
    }

    console.log('✅ Batch replace completed: no new records to insert');
    return { data: [], error: null };
    
  } catch (error) {
    console.error(`❌ Batch replace failed for ${tableName}:`, error);
    return { data: null, error };
  }
};

/**
 * Batch operation with tenant awareness
 * Automatically adds tenant_id to all records if not present
 * @param {string} operation - Operation type: 'insert', 'upsert', 'delete', 'replace'
 * @param {string} tableName - Name of the table
 * @param {Array|Object} records - Records or parameters for the operation
 * @param {string} tenantId - Tenant ID to add to records
 * @param {Object} options - Additional options
 * @returns {Promise} - Result of the batch operation
 */
export const batchWithTenant = async (operation, tableName, records, tenantId, options = {}) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required for tenant-aware batch operations');
  }

  // Add tenant_id to records if not present
  const addTenantToRecords = (records) => {
    if (!Array.isArray(records)) return records;
    
    return records.map(record => ({
      ...record,
      tenant_id: record.tenant_id || tenantId
    }));
  };

  switch (operation) {
    case 'insert':
      return batchInsert(tableName, addTenantToRecords(records), options);
    
    case 'upsert':
      return batchUpsert(tableName, addTenantToRecords(records), options);
    
    case 'delete':
      return batchDelete(tableName, records, options);
    
    case 'replace':
      const { whereCondition, newRecords } = records;
      const whereWithTenant = { ...whereCondition, tenant_id: tenantId };
      return batchReplace(tableName, whereWithTenant, addTenantToRecords(newRecords), options);
    
    default:
      throw new Error(`Unsupported batch operation: ${operation}`);
  }
};

export default {
  batchInsert,
  batchUpsert,
  batchDelete,
  batchReplace,
  batchWithTenant
};