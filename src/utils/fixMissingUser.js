/**
 * Utility to fix missing user records in the database
 * Creates user records for authenticated users who don't exist in the users table
 */

import { supabase } from './supabase';

export const checkAndCreateUserRecord = async () => {
  console.log('🔧 USER FIX: Starting user record check and creation...');
  
  try {
    // Step 1: Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('🔧 USER FIX: No authenticated user found:', authError?.message);
      return { success: false, error: 'No authenticated user found' };
    }
    
    console.log('🔧 USER FIX: ✅ Authenticated user:', {
      id: user.id,
      email: user.email
    });
    
    // Step 2: Check if user record exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name')
      .eq('id', user.id)
      .maybeSingle(); // Use maybeSingle to avoid error when no rows found
    
    if (checkError) {
      console.error('🔧 USER FIX: Error checking existing user:', checkError);
      return { success: false, error: `Error checking user: ${checkError.message}` };
    }
    
    if (existingUser) {
      console.log('🔧 USER FIX: ✅ User record already exists:', existingUser);
      return { 
        success: true, 
        message: 'User record already exists',
        userRecord: existingUser,
        action: 'none'
      };
    }
    
    console.log('🔧 USER FIX: ❌ No user record found, need to create one');
    
    // Step 3: Get available tenants to assign user to
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    
    if (tenantsError) {
      console.error('🔧 USER FIX: Error fetching tenants:', tenantsError);
      return { success: false, error: `Error fetching tenants: ${tenantsError.message}` };
    }
    
    if (!tenants || tenants.length === 0) {
      console.error('🔧 USER FIX: ❌ No active tenants found');
      return { 
        success: false, 
        error: 'No active tenants found. Please create a tenant first.',
        needsTenant: true
      };
    }
    
    console.log('🔧 USER FIX: ✅ Found active tenants:', tenants.map(t => ({ id: t.id, name: t.name })));
    
    // Step 4: Use the first available tenant (or you could implement logic to choose)
    const selectedTenant = tenants[0];
    console.log('🔧 USER FIX: 🏢 Assigning user to tenant:', selectedTenant.name);
    
    // Step 5: Create user record
    const newUserRecord = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email.split('@')[0],
      tenant_id: selectedTenant.id,
      created_at: new Date().toISOString()
    };
    
    console.log('🔧 USER FIX: Creating user record:', newUserRecord);
    
    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert(newUserRecord)
      .select()
      .single();
    
    if (createError) {
      console.error('🔧 USER FIX: Error creating user record:', createError);
      return { success: false, error: `Error creating user: ${createError.message}` };
    }
    
    console.log('🔧 USER FIX: ✅ User record created successfully:', createdUser);
    
    return {
      success: true,
      message: `User record created and assigned to tenant "${selectedTenant.name}"`,
      userRecord: createdUser,
      tenant: selectedTenant,
      action: 'created'
    };
    
  } catch (error) {
    console.error('🔧 USER FIX: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const createTenantIfNeeded = async () => {
  console.log('🏢 TENANT FIX: Checking if tenant needs to be created...');
  
  try {
    // Check if any tenants exist
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .limit(1);
    
    if (tenantsError) {
      console.error('🏢 TENANT FIX: Error checking tenants:', tenantsError);
      return { success: false, error: `Error checking tenants: ${tenantsError.message}` };
    }
    
    if (tenants && tenants.length > 0) {
      console.log('🏢 TENANT FIX: ✅ Tenants already exist');
      return { success: true, message: 'Tenants already exist', action: 'none' };
    }
    
    console.log('🏢 TENANT FIX: ❌ No tenants found, creating default tenant...');
    
    // Create a default tenant
    const defaultTenant = {
      name: 'Default School',
      subdomain: 'default-school',
      status: 'active',
      subscription_plan: 'basic',
      created_at: new Date().toISOString()
    };
    
    const { data: createdTenant, error: createError } = await supabase
      .from('tenants')
      .insert(defaultTenant)
      .select()
      .single();
    
    if (createError) {
      console.error('🏢 TENANT FIX: Error creating tenant:', createError);
      return { success: false, error: `Error creating tenant: ${createError.message}` };
    }
    
    console.log('🏢 TENANT FIX: ✅ Default tenant created:', createdTenant);
    
    return {
      success: true,
      message: 'Default tenant created successfully',
      tenant: createdTenant,
      action: 'created'
    };
    
  } catch (error) {
    console.error('🏢 TENANT FIX: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const fixUserAndTenantSetup = async () => {
  console.log('🚀 FULL FIX: Starting complete user and tenant setup...');
  
  try {
    // Step 1: Ensure tenant exists
    const tenantResult = await createTenantIfNeeded();
    if (!tenantResult.success) {
      return { success: false, error: `Tenant setup failed: ${tenantResult.error}` };
    }
    
    // Step 2: Ensure user record exists
    const userResult = await checkAndCreateUserRecord();
    if (!userResult.success) {
      return { success: false, error: `User setup failed: ${userResult.error}` };
    }
    
    console.log('🚀 FULL FIX: ✅ Complete setup finished successfully');
    
    return {
      success: true,
      message: 'User and tenant setup completed successfully',
      tenantResult,
      userResult
    };
    
  } catch (error) {
    console.error('🚀 FULL FIX: Unexpected error:', error);
    return {
      success: false,
      error: `Setup failed: ${error.message}`
    };
  }
};
