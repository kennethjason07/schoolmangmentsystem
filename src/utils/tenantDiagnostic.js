/**
 * 🔍 TENANT DIAGNOSTIC UTILITY
 * 
 * This utility helps debug tenant filtering issues in the school management system.
 * Use it to verify that users are properly assigned to tenants and that data filtering works correctly.
 */

import { supabase } from './supabase';

export class TenantDiagnostic {
  
  /**
   * Run a comprehensive diagnostic of tenant setup for current user
   */
  static async diagnoseCurrentUser() {
    console.log('🔍 STARTING TENANT DIAGNOSTIC');
    console.log('='.repeat(60));
    
    try {
      // Step 1: Check current authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('❌ No authenticated user found');
        return { success: false, error: 'No authenticated user' };
      }
      
      console.log('👤 Current User:', {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      });
      
      // Step 2: Get user record from database
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name, tenant_id')
        .eq('id', user.id)
        .single();
      
      if (userError) {
        console.log('❌ Error fetching user record:', userError.message);
        return { success: false, error: userError.message };
      }
      
      console.log('📋 User Database Record:', userRecord);
      
      // Step 3: Check if user has tenant_id
      if (!userRecord.tenant_id) {
        console.log('❌ ISSUE FOUND: User has no tenant_id assigned');
        
        // Try to find available tenants
        const { data: availableTenants } = await supabase
          .from('tenants')
          .select('id, name, subdomain, status')
          .eq('status', 'active');
        
        console.log('🏢 Available tenants:', availableTenants);
        
        return { 
          success: false, 
          error: 'User has no tenant_id assigned',
          availableTenants,
          recommendation: 'Assign user to appropriate tenant'
        };
      }
      
      // Step 4: Verify tenant exists and is valid
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userRecord.tenant_id)
        .single();
      
      if (tenantError || !tenant) {
        console.log('❌ ISSUE FOUND: User assigned to invalid tenant_id:', userRecord.tenant_id);
        return { 
          success: false, 
          error: `Invalid tenant_id: ${userRecord.tenant_id}`,
          recommendation: 'Update user with valid tenant_id'
        };
      }
      
      console.log('🏢 User Tenant:', {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        status: tenant.status
      });
      
      // Step 5: Test stationary data access
      console.log('📋 Testing stationary data access...');
      
      const { data: items, error: itemsError } = await supabase
        .from('stationary_items')
        .select('id, name, fee_amount, tenant_id')
        .eq('tenant_id', userRecord.tenant_id)
        .limit(5);
      
      if (itemsError) {
        console.log('❌ Error accessing stationary items:', itemsError.message);
      } else {
        console.log('📦 Stationary Items Access:', {
          itemsFound: items?.length || 0,
          tenantId: userRecord.tenant_id,
          sampleItems: items?.slice(0, 3)
        });
      }
      
      const { data: purchases, error: purchasesError } = await supabase
        .from('stationary_purchases')
        .select('id, total_amount, payment_date, tenant_id')
        .eq('tenant_id', userRecord.tenant_id)
        .limit(5);
      
      if (purchasesError) {
        console.log('❌ Error accessing stationary purchases:', purchasesError.message);
      } else {
        console.log('💳 Stationary Purchases Access:', {
          purchasesFound: purchases?.length || 0,
          tenantId: userRecord.tenant_id,
          samplePurchases: purchases?.slice(0, 3)
        });
      }
      
      // Step 6: Check for cross-tenant data leakage
      console.log('🔍 Checking for cross-tenant data leakage...');
      
      // Get all tenants to test isolation
      const { data: allTenants } = await supabase
        .from('tenants')
        .select('id, name')
        .neq('id', userRecord.tenant_id);
      
      if (allTenants && allTenants.length > 0) {
        console.log('🧪 Testing data isolation against other tenants...');
        
        for (const otherTenant of allTenants.slice(0, 2)) {
          const { data: otherItems } = await supabase
            .from('stationary_items')
            .select('id, name, tenant_id')
            .eq('tenant_id', otherTenant.id)
            .limit(1);
          
          if (otherItems && otherItems.length > 0) {
            console.log(`⚠️ WARNING: Can access data from other tenant ${otherTenant.name} (${otherTenant.id})`);
            console.log('   This suggests RLS policies may not be working properly');
          } else {
            console.log(`✅ Cannot access data from ${otherTenant.name} - isolation working`);
          }
        }
      }
      
      console.log('✅ DIAGNOSTIC COMPLETED SUCCESSFULLY');
      
      return {
        success: true,
        user: userRecord,
        tenant: tenant,
        dataAccess: {
          items: items?.length || 0,
          purchases: purchases?.length || 0
        }
      };
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Quick check if current user has proper tenant setup
   */
  static async quickTenantCheck() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { valid: false, reason: 'No authenticated user' };
      
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (!userRecord?.tenant_id) {
        return { valid: false, reason: 'No tenant_id assigned' };
      }
      
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, status')
        .eq('id', userRecord.tenant_id)
        .eq('status', 'active')
        .single();
      
      if (!tenant) {
        return { valid: false, reason: 'Invalid or inactive tenant' };
      }
      
      return { 
        valid: true, 
        tenantId: tenant.id, 
        tenantName: tenant.name 
      };
      
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }
  
  /**
   * Get available tenants for current user (admin function)
   */
  static async getAvailableTenants() {
    try {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, subdomain, status')
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      
      return tenants || [];
    } catch (error) {
      console.error('Error getting available tenants:', error);
      return [];
    }
  }
}

export default TenantDiagnostic;
