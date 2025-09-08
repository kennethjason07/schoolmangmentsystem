// Debug utility to test tenant loading for FeeManagement screen
import { getCurrentUserTenantByEmail } from './getTenantByEmail';
import { supabase } from './supabase';

export const debugTenantLoading = async () => {
  console.log('🔍 DEBUG TENANT LOADING: Starting comprehensive tenant debug...');
  
  try {
    // Step 1: Check current auth user
    console.log('🔍 Step 1: Getting current authenticated user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ No authenticated user:', authError?.message);
      return { success: false, error: 'No authenticated user' };
    }
    
    console.log('✅ Current user:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    });
    
    // Step 2: Test email-based tenant lookup
    console.log('🔍 Step 2: Testing getCurrentUserTenantByEmail...');
    const tenantResult = await getCurrentUserTenantByEmail();
    
    if (tenantResult.success) {
      console.log('✅ Email-based tenant lookup successful:', {
        tenantId: tenantResult.data.tenant.id,
        tenantName: tenantResult.data.tenant.name,
        tenantStatus: tenantResult.data.tenant.status,
        userEmail: tenantResult.data.userRecord.email
      });
      
      // Step 3: Test if this tenant has fee data
      console.log('🔍 Step 3: Checking for fee data in this tenant...');
      const { data: feeCount, error: feeError } = await supabase
        .from('fee_structure')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantResult.data.tenant.id);
        
      const { data: studentCount, error: studentError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantResult.data.tenant.id);
        
      const { data: classCount, error: classError } = await supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantResult.data.tenant.id);
      
      console.log('📊 Data availability check:', {
        feeStructures: feeError ? 'ERROR' : (feeCount || 0),
        students: studentError ? 'ERROR' : (studentCount || 0),
        classes: classError ? 'ERROR' : (classCount || 0)
      });
      
      return {
        success: true,
        data: {
          user,
          tenant: tenantResult.data.tenant,
          userRecord: tenantResult.data.userRecord,
          dataAvailability: {
            feeStructures: feeCount || 0,
            students: studentCount || 0,
            classes: classCount || 0
          }
        }
      };
      
    } else {
      console.error('❌ Email-based tenant lookup failed:', tenantResult.error);
      
      // Step 3: Alternative - check user record directly
      console.log('🔍 Step 3: Checking user record directly...');
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userError) {
        console.error('❌ Error getting user record:', userError);
      } else {
        console.log('📄 User record:', {
          id: userRecord.id,
          email: userRecord.email,
          tenant_id: userRecord.tenant_id,
          full_name: userRecord.full_name,
          role_id: userRecord.role_id
        });
      }
      
      return {
        success: false,
        error: tenantResult.error,
        userRecord
      };
    }
    
  } catch (error) {
    console.error('❌ Debug tenant loading error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const debugCurrentTenantContext = (tenantContext) => {
  console.log('🏗️ DEBUG CURRENT TENANT CONTEXT:', {
    tenantId: tenantContext.tenantId || 'NULL',
    tenantName: tenantContext.tenantName || 'NULL', 
    loading: tenantContext.loading,
    error: tenantContext.error || 'none',
    hasTenant: !!tenantContext.currentTenant,
    availableTenants: tenantContext.availableTenants?.length || 0
  });
  
  if (tenantContext.currentTenant) {
    console.log('🏢 Current tenant details:', {
      id: tenantContext.currentTenant.id,
      name: tenantContext.currentTenant.name,
      status: tenantContext.currentTenant.status,
      subdomain: tenantContext.currentTenant.subdomain,
      created_at: tenantContext.currentTenant.created_at
    });
  }
  
  return tenantContext;
};
