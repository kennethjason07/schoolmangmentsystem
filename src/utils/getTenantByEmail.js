/**
 * Utility to get tenant_id by referencing email address
 * This bypasses the user ID matching issue and looks up tenant directly by email
 */

import { supabase } from './supabase';

export const getTenantIdByEmail = async (email) => {
  console.log('📧 EMAIL LOOKUP: Starting tenant lookup by email:', email);
  
  try {
    // Step 1: Look up user record by email address
    console.log('📧 EMAIL LOOKUP: Step 1 - Searching users table by email...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name, role_id, created_at')
      .eq('email', email)
      .maybeSingle(); // Use maybeSingle to avoid error when no rows found
    
    if (userError) {
      console.error('📧 EMAIL LOOKUP: Error querying users by email:', userError);
      return { 
        success: false, 
        error: `Database error: ${userError.message}`,
        code: userError.code 
      };
    }
    
    if (!userRecord) {
      console.log('📧 EMAIL LOOKUP: ❌ No user record found for email:', email);
      return { 
        success: false, 
        error: `No user record found for email: ${email}`,
        notFound: true 
      };
    }
    
    console.log('📧 EMAIL LOOKUP: ✅ Found user record by email:', {
      id: userRecord.id,
      email: userRecord.email,
      tenant_id: userRecord.tenant_id,
      full_name: userRecord.full_name
    });
    
    if (!userRecord.tenant_id) {
      console.log('📧 EMAIL LOOKUP: ❌ User record exists but has no tenant_id assigned');
      return { 
        success: false, 
        error: `User ${email} exists but has no tenant assigned`,
        userRecord,
        needsTenantAssignment: true 
      };
    }
    
    // Step 2: Get tenant details using the tenant_id
    console.log('📧 EMAIL LOOKUP: Step 2 - Fetching tenant details for ID:', userRecord.tenant_id);
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userRecord.tenant_id)
      .single();
    
    if (tenantError) {
      console.error('📧 EMAIL LOOKUP: Error fetching tenant:', tenantError);
      return { 
        success: false, 
        error: `Tenant fetch error: ${tenantError.message}`,
        userRecord,
        tenantId: userRecord.tenant_id 
      };
    }
    
    if (!tenant) {
      console.log('📧 EMAIL LOOKUP: ❌ Tenant not found for ID:', userRecord.tenant_id);
      return { 
        success: false, 
        error: `Tenant not found for ID: ${userRecord.tenant_id}`,
        userRecord,
        tenantId: userRecord.tenant_id 
      };
    }
    
    console.log('📧 EMAIL LOOKUP: ✅ Successfully found tenant:', {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status
    });
    
    // Step 3: Verify tenant is active
    if (tenant.status !== 'active') {
      console.warn('📧 EMAIL LOOKUP: ⚠️ Tenant is not active:', tenant.status);
      return {
        success: false,
        error: `Tenant "${tenant.name}" is ${tenant.status}, expected active`,
        userRecord,
        tenant,
        tenantInactive: true
      };
    }
    
    console.log('📧 EMAIL LOOKUP: 🎉 SUCCESS! Complete tenant lookup successful');
    
    return {
      success: true,
      data: {
        userRecord,
        tenant,
        tenantId: tenant.id,
        tenantName: tenant.name
      }
    };
    
  } catch (error) {
    console.error('📧 EMAIL LOOKUP: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const getCurrentUserTenantByEmail = async () => {
  console.log('📧 CURRENT USER: Getting tenant for current authenticated user...');
  
  try {
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('📧 CURRENT USER: No authenticated user found:', authError?.message || 'Auth session missing!');
      return { 
        success: false, 
        error: 'No authenticated user found',
        code: 'NO_AUTH_USER',
        isAuthError: true
      };
    }
    
    console.log('📧 CURRENT USER: ✅ Authenticated user:', {
      id: user.id,
      email: user.email
    });
    
    // Get tenant by email
    const result = await getTenantIdByEmail(user.email);
    
    if (result.success) {
      console.log('📧 CURRENT USER: ✅ Tenant found for current user:', result.data.tenantName);
    } else {
      console.log('📧 CURRENT USER: ❌ Failed to get tenant for current user:', result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('📧 CURRENT USER: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

export const getAllUserEmails = async () => {
  console.log('📧 ALL USERS: Getting all user emails for debugging...');
  
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name, created_at')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.error('📧 ALL USERS: Error fetching users:', usersError);
      return { success: false, error: `Error fetching users: ${usersError.message}` };
    }
    
    console.log('📧 ALL USERS: ✅ Found users:', users?.length || 0);
    users?.forEach((user, index) => {
      console.log(`📧 ALL USERS: ${index + 1}. ${user.email} (ID: ${user.id}) - Tenant: ${user.tenant_id || 'NONE'}`);
    });
    
    return {
      success: true,
      data: {
        users: users || [],
        count: users?.length || 0
      }
    };
    
  } catch (error) {
    console.error('📧 ALL USERS: Unexpected error:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};
