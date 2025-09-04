// Utility function to fix user setup and foreign key constraint issues
// This can be called from the admin dashboard to resolve user account issues

import { supabase } from './supabase';

export const fixUserSetup = async () => {
  try {
    console.log('🔧 Starting user setup fix...');
    
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('No authenticated user found');
    }
    
    console.log('🔧 Current auth user:', user.id, user.email);
    
    // Check if user exists in users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role_id, tenant_id')
      .eq('id', user.id)
      .single();
    
    if (existingUser && !checkError) {
      console.log('🔧 User already exists in users table:', existingUser);
      return { success: true, message: 'User already exists in database', user: existingUser };
    }
    
    console.log('🔧 User not found in users table, creating...');
    
    // Ensure default tenant exists
    const defaultTenantId = 'default-tenant';
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', defaultTenantId)
      .single();
    
    if (!tenant && tenantError?.code === 'PGRST116') {
      console.log('🔧 Creating default tenant...');
      await supabase
        .from('tenants')
        .insert({
          id: defaultTenantId,
          name: 'Default School',
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
    
    // Ensure admin role exists  
    const { data: adminRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('id', 1)
      .single();
    
    if (!adminRole && roleError?.code === 'PGRST116') {
      console.log('🔧 Creating admin role...');
      await supabase
        .from('roles')
        .insert({
          id: 1,
          name: 'Admin',
          description: 'System Administrator',
          permissions: ['all'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
    
    // Create user record in users table
    const newUserData = {
      id: user.id,
      email: user.email,
      first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Admin',
      last_name: user.user_metadata?.last_name || 'User',
      role_id: 1, // Admin role
      tenant_id: defaultTenantId,
      status: 'Active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('🔧 Creating user record:', newUserData);
    
    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert(newUserData)
      .select()
      .single();
    
    if (createError) {
      console.error('🔧 Error creating user:', createError);
      throw createError;
    }
    
    console.log('🔧 User created successfully:', createdUser);
    
    // Clean up any orphaned events (events with invalid created_by references)
    console.log('🔧 Cleaning up orphaned events...');
    const { data: orphanedEvents, error: orphanError } = await supabase
      .rpc('fix_orphaned_events', {
        sql_query: `
          UPDATE events 
          SET created_by = NULL 
          WHERE created_by IS NOT NULL 
            AND created_by NOT IN (SELECT id FROM users)
        `
      })
      .catch(() => {
        // If RPC doesn't work, try direct update
        return supabase
          .from('events')
          .update({ created_by: null })
          .neq('created_by', createdUser.id);
      });
    
    return {
      success: true,
      message: 'User setup completed successfully',
      user: createdUser
    };
    
  } catch (error) {
    console.error('🔧 Error in fixUserSetup:', error);
    return {
      success: false,
      message: error.message,
      error
    };
  }
};

export const checkUserSetup = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { valid: false, message: 'No authenticated user' };
    }
    
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role_id, tenant_id')
      .eq('id', user.id)
      .single();
    
    if (error || !dbUser) {
      return { 
        valid: false, 
        message: 'User not found in database', 
        authUser: user 
      };
    }
    
    return { 
      valid: true, 
      message: 'User setup is valid', 
      authUser: user, 
      dbUser 
    };
    
  } catch (error) {
    return { 
      valid: false, 
      message: error.message, 
      error 
    };
  }
};
