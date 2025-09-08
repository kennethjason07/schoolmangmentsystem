/**
 * 🎯 WORKING TENANT QUERY EXAMPLES
 * Demonstrates the correct patterns that work with the current Supabase version
 */

import { supabase } from './supabase';
import { createTenantQuery, executeTenantQuery } from './tenantQueryHelper';

// ✅ WORKING PATTERN 1: Direct Supabase Usage (Correct Order)
export const getFeeStructureDirectly = async (tenantId, classId) => {
  console.log('🎯 WORKING EXAMPLE 1: Direct Supabase usage');
  
  try {
    // CORRECT ORDER: .from() → .select() → .eq() → .eq()...
    const { data, error } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .order('fee_component');
    
    if (error) {
      console.error('❌ Direct query error:', error);
      return { data: null, error };
    }
    
    console.log('✅ Direct query success:', data?.length || 0, 'records');
    return { data, error: null };
    
  } catch (error) {
    console.error('❌ Direct query exception:', error);
    return { data: null, error };
  }
};

// ✅ WORKING PATTERN 2: Using Tenant Query Helper
export const getFeeStructureWithHelper = async (tenantId, classId) => {
  console.log('🎯 WORKING EXAMPLE 2: Using tenant query helper');
  
  try {
    const result = await executeTenantQuery('fee_structure', tenantId, {
      select: '*',
      filters: { class_id: classId },
      orderBy: 'fee_component'
    });
    
    if (result.error) {
      console.error('❌ Helper query error:', result.error);
      return result;
    }
    
    console.log('✅ Helper query success:', result.data?.length || 0, 'records');
    return result;
    
  } catch (error) {
    console.error('❌ Helper query exception:', error);
    return { data: null, error };
  }
};

// ✅ WORKING PATTERN 3: Manual Step-by-Step
export const getFeeStructureStepByStep = async (tenantId, classId) => {
  console.log('🎯 WORKING EXAMPLE 3: Step-by-step query building');
  
  try {
    // Step 1: Create base query
    const baseQuery = supabase.from('fee_structure');
    console.log('  Step 1: Base query created:', !!baseQuery);
    
    // Step 2: Add select (this makes .eq() available)
    const selectedQuery = baseQuery.select('*');
    console.log('  Step 2: Select added, .eq() available:', typeof selectedQuery.eq);
    
    // Step 3: Add tenant filter
    const tenantQuery = selectedQuery.eq('tenant_id', tenantId);
    console.log('  Step 3: Tenant filter added');
    
    // Step 4: Add class filter
    const classQuery = tenantQuery.eq('class_id', classId);
    console.log('  Step 4: Class filter added');
    
    // Step 5: Add ordering
    const orderedQuery = classQuery.order('fee_component');
    console.log('  Step 5: Ordering added');
    
    // Step 6: Execute
    const { data, error } = await orderedQuery;
    
    if (error) {
      console.error('❌ Step-by-step query error:', error);
      return { data: null, error };
    }
    
    console.log('✅ Step-by-step query success:', data?.length || 0, 'records');
    return { data, error: null };
    
  } catch (error) {
    console.error('❌ Step-by-step query exception:', error);
    return { data: null, error };
  }
};

// ❌ BROKEN PATTERN: What doesn't work
export const brokenPattern = () => {
  console.log('❌ BROKEN PATTERN: This is what fails');
  
  try {
    const baseQuery = supabase.from('fee_structure');
    console.log('  Base query created:', !!baseQuery);
    console.log('  Base query .eq() available:', typeof baseQuery.eq); // undefined!
    
    // This will fail:
    // const filtered = baseQuery.eq('tenant_id', 'some-id'); // ❌ TypeError
    
    console.log('  ❌ Cannot call .eq() directly on base query - must call .select() first');
    
  } catch (error) {
    console.error('  ❌ Broken pattern error:', error);
  }
};

// 🧪 Test all patterns
export const testAllPatterns = async () => {
  const tenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  const classId = 'test-class-id';
  
  console.log('🧪 TESTING ALL WORKING PATTERNS');
  console.log('='.repeat(50));
  
  // Show broken pattern first
  brokenPattern();
  console.log('-'.repeat(50));
  
  // Test working patterns
  console.log('Testing Pattern 1: Direct Supabase usage...');
  const result1 = await getFeeStructureDirectly(tenantId, classId);
  console.log('Result 1:', result1.error ? 'ERROR' : 'SUCCESS');
  
  console.log('-'.repeat(50));
  
  console.log('Testing Pattern 2: Tenant query helper...');
  const result2 = await getFeeStructureWithHelper(tenantId, classId);
  console.log('Result 2:', result2.error ? 'ERROR' : 'SUCCESS');
  
  console.log('-'.repeat(50));
  
  console.log('Testing Pattern 3: Step-by-step...');
  const result3 = await getFeeStructureStepByStep(tenantId, classId);
  console.log('Result 3:', result3.error ? 'ERROR' : 'SUCCESS');
  
  console.log('='.repeat(50));
  console.log('🎉 ALL PATTERN TESTS COMPLETED');
  
  return {
    direct: !result1.error,
    helper: !result2.error,
    stepByStep: !result3.error
  };
};

// 📚 Usage examples for components
export const componentUsageExamples = {
  
  // Example 1: In a React component with useTenant hook
  exampleWithHook: `
import { useTenant } from '../contexts/TenantContext';

const FeeManagementComponent = () => {
  const { executeTenantQuery, tenantId } = useTenant();
  
  const loadFeeStructure = async (classId) => {
    const result = await executeTenantQuery('fee_structure', {
      select: 'id, fee_component, amount, due_date',
      filters: { class_id: classId },
      orderBy: 'fee_component'
    });
    
    if (result.error) {
      console.error('Fee structure load failed:', result.error);
      return [];
    }
    
    return result.data || [];
  };
  
  // ... rest of component
};`,

  // Example 2: Direct usage in utility functions
  exampleDirect: `
import { supabase } from '../utils/supabase';

const loadClasses = async (tenantId) => {
  // CORRECT: .from() → .select() → .eq()
  const { data, error } = await supabase
    .from('classes')
    .select('id, class_name, section')
    .eq('tenant_id', tenantId)
    .order('class_name');
  
  return { data: data || [], error };
};`,

  // Example 3: With error handling
  exampleWithErrorHandling: `
const safeTenantQuery = async (tableName, tenantId, options = {}) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(options.select || '*')
      .eq('tenant_id', tenantId);
    
    if (error) {
      console.error(\`Query error for \${tableName}:\`, error);
      return { data: [], error, success: false };
    }
    
    return { data: data || [], error: null, success: true };
    
  } catch (exception) {
    console.error(\`Query exception for \${tableName}:\`, exception);
    return { 
      data: [], 
      error: exception, 
      success: false 
    };
  }
};`
};

console.log('📚 Working tenant query examples loaded');
console.log('   Call testAllPatterns() to test all patterns');
console.log('   Check componentUsageExamples for implementation examples');
