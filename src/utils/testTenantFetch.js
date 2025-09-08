/**
 * Simple utility to test direct tenant fetching from database
 * This bypasses all context complexity to test the basic database fetch
 */

import { supabase } from './supabase';

export const testDirectTenantFetch = async () => {
  console.log('🧪 TEST: Starting direct tenant fetch test...');
  
  try {
    // Step 1: Get authenticated user
    console.log('🧪 TEST: Step 1 - Getting authenticated user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('🧪 TEST: Auth error:', authError);
      return { success: false, error: `Auth error: ${authError.message}` };
    }
    
    if (!user) {
      console.error('🧪 TEST: No authenticated user found');
      return { success: false, error: 'No authenticated user found' };
    }
    
    console.log('🧪 TEST: ✅ Authenticated user found:', {
      id: user.id,
      email: user.email
    });
    
    // Step 2: Fetch user record from database
    console.log('🧪 TEST: Step 2 - Fetching user record from database...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, role_id')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('🧪 TEST: User fetch error:', userError);
      return { success: false, error: `User fetch error: ${userError.message}` };
    }
    
    console.log('🧪 TEST: ✅ User record fetched:', {
      id: userRecord.id,
      email: userRecord.email,
      full_name: userRecord.full_name,
      tenant_id: userRecord.tenant_id,
      role_id: userRecord.role_id
    });
    
    if (!userRecord.tenant_id) {
      console.error('🧪 TEST: ❌ User has no tenant_id assigned!');
      return { 
        success: false, 
        error: 'User has no tenant_id assigned in database',
        userRecord 
      };
    }
    
    // Step 3: Fetch tenant details
    console.log('🧪 TEST: Step 3 - Fetching tenant details...');
    console.log('🧪 TEST: Looking for tenant ID:', userRecord.tenant_id);
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userRecord.tenant_id)
      .single();
    
    if (tenantError) {
      console.error('🧪 TEST: Tenant fetch error:', tenantError);
      return { 
        success: false, 
        error: `Tenant fetch error: ${tenantError.message}`,
        tenantId: userRecord.tenant_id 
      };
    }
    
    if (!tenant) {
      console.error('🧪 TEST: ❌ No tenant found with ID:', userRecord.tenant_id);
      return { 
        success: false, 
        error: `No tenant found with ID: ${userRecord.tenant_id}`,
        tenantId: userRecord.tenant_id 
      };
    }
    
    console.log('🧪 TEST: ✅ Tenant fetched successfully:', {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status
    });
    
    // Step 4: Check tenant status
    if (tenant.status !== 'active') {
      console.warn('🧪 TEST: ⚠️ Tenant is not active:', tenant.status);
      return {
        success: false,
        error: `Tenant status is '${tenant.status}', expected 'active'`,
        tenant
      };
    }
    
    console.log('🧪 TEST: 🎉 SUCCESS! All steps completed successfully');
    
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email
        },
        userRecord,
        tenant
      }
    };
    
  } catch (error) {
    console.error('🧪 TEST: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

// Export a function that can be called from components
export const runTenantTest = async () => {
  const result = await testDirectTenantFetch();
  
  if (result.success) {
    console.log('🎉 TENANT TEST PASSED:', result.data);
  } else {
    console.error('❌ TENANT TEST FAILED:', result.error);
  }
  
  return result;
};
