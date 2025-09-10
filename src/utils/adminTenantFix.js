import { supabase } from './supabase';

/**
 * Enhanced tenant initialization specifically for admin users
 * This fixes tenant context issues in admin screens like ManageTeachers
 */
export class AdminTenantFix {
  /**
   * Initialize tenant context for an admin user
   * @param {Object} user - The authenticated user object
   * @returns {Promise<Object>} - Tenant data or null
   */
  static async initializeTenantForAdmin(user) {
    try {
      console.log('👨‍💼 AdminTenantFix: Initializing tenant for admin user:', user.email);
      
      if (!user || !user.id) {
        console.error('❌ AdminTenantFix: No valid user provided');
        return null;
      }

      // Get the user's tenant_id from the users table
      console.log('🔍 AdminTenantFix: Fetching user record...');
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id, email, tenant_id, role_id')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('❌ AdminTenantFix: Error fetching user record:', userError);
        return null;
      }

      if (!userRecord) {
        console.error('❌ AdminTenantFix: No user record found');
        return null;
      }

      console.log('📄 AdminTenantFix: User record:', {
        email: userRecord.email,
        tenant_id: userRecord.tenant_id,
        role_id: userRecord.role_id
      });

      // Case 1: User has tenant_id assigned
      if (userRecord.tenant_id) {
        console.log('✅ AdminTenantFix: User has tenant_id, fetching tenant details...');
        
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userRecord.tenant_id)
          .eq('status', 'active')
          .single();

        if (tenantError) {
          console.error('❌ AdminTenantFix: Error fetching tenant:', tenantError);
          return null;
        }

        if (!tenant) {
          console.error('❌ AdminTenantFix: Tenant not found or inactive');
          return null;
        }

        console.log('✅ AdminTenantFix: Tenant found:', tenant.name);
        return tenant;
      }

      // Case 2: User doesn't have tenant_id - try to find from email domain or assign to a default
      console.log('⚠️ AdminTenantFix: User missing tenant_id, checking available tenants...');
      
      // Get all active tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (tenantsError) {
        console.error('❌ AdminTenantFix: Error fetching tenants:', tenantsError);
        return null;
      }

      if (!tenants || tenants.length === 0) {
        console.error('❌ AdminTenantFix: No active tenants found');
        return null;
      }

      // For admin users, typically assign to the first/primary tenant
      // In a real system, you might want more sophisticated logic
      const primaryTenant = tenants[0];
      console.log('🔧 AdminTenantFix: Assigning admin to primary tenant:', primaryTenant.name);

      // Update user record with the primary tenant_id
      const { error: updateError } = await supabase
        .from('users')
        .update({ tenant_id: primaryTenant.id })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ AdminTenantFix: Failed to update user tenant_id:', updateError);
        return primaryTenant; // Return tenant even if update fails
      } else {
        console.log('✅ AdminTenantFix: Updated user tenant_id successfully');
      }

      return primaryTenant;

    } catch (error) {
      console.error('💥 AdminTenantFix: Fatal error in tenant initialization:', error);
      return null;
    }
  }

  /**
   * Get tenant context data for an admin user
   * @param {Object} user - The authenticated user object
   * @returns {Promise<Object>} - Tenant context object
   */
  static async getAdminTenantContext(user) {
    try {
      const tenant = await this.initializeTenantForAdmin(user);
      
      if (!tenant) {
        return {
          tenantId: null,
          currentTenant: null,
          error: 'No tenant context available. Please contact administrator.'
        };
      }

      return {
        tenantId: tenant.id,
        currentTenant: tenant,
        tenantName: tenant.name,
        error: null
      };
    } catch (error) {
      console.error('💥 AdminTenantFix: Error getting tenant context:', error);
      return {
        tenantId: null,
        currentTenant: null,
        error: 'Failed to load tenant context. Please contact administrator.'
      };
    }
  }

  /**
   * Validate that an admin user has proper tenant assignment
   * @param {Object} user - The authenticated user object
   * @returns {Promise<Boolean>} - True if tenant is properly assigned
   */
  static async validateAdminTenantAssignment(user) {
    try {
      const tenant = await this.initializeTenantForAdmin(user);
      return tenant !== null;
    } catch (error) {
      console.error('💥 AdminTenantFix: Error validating tenant assignment:', error);
      return false;
    }
  }
}
