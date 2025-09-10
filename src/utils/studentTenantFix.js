import { supabase } from './supabase';

/**
 * Enhanced tenant initialization specifically for student users
 * This fixes the "No tenant context available" error in StudentDashboard
 */
export class StudentTenantFix {
  /**
   * Initialize tenant context for a student user
   * @param {Object} user - The authenticated user object
   * @returns {Promise<Object>} - Tenant data or null
   */
  static async initializeTenantForStudent(user) {
    try {
      console.log('🎓 StudentTenantFix: Initializing tenant for student user:', user.email);
      
      if (!user || !user.id) {
        console.error('❌ StudentTenantFix: No valid user provided');
        return null;
      }

      // Get the user's tenant_id and linked_student_id from the users table
      console.log('🔍 StudentTenantFix: Fetching user record...');
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id, email, tenant_id, linked_student_id, role_id')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('❌ StudentTenantFix: Error fetching user record:', userError);
        return null;
      }

      if (!userRecord) {
        console.error('❌ StudentTenantFix: No user record found');
        return null;
      }

      console.log('📄 StudentTenantFix: User record:', {
        email: userRecord.email,
        tenant_id: userRecord.tenant_id,
        linked_student_id: userRecord.linked_student_id,
        role_id: userRecord.role_id
      });

      // Case 1: User has tenant_id assigned
      if (userRecord.tenant_id) {
        console.log('✅ StudentTenantFix: User has tenant_id, fetching tenant details...');
        
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userRecord.tenant_id)
          .eq('status', 'active')
          .single();

        if (tenantError) {
          console.error('❌ StudentTenantFix: Error fetching tenant:', tenantError);
          return null;
        }

        if (!tenant) {
          console.error('❌ StudentTenantFix: Tenant not found or inactive');
          return null;
        }

        console.log('✅ StudentTenantFix: Tenant found:', tenant.name);
        return tenant;
      }

      // Case 2: User doesn't have tenant_id but has linked_student_id
      if (userRecord.linked_student_id) {
        console.log('🔍 StudentTenantFix: User missing tenant_id, getting from linked student...');
        
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, name, tenant_id')
          .eq('id', userRecord.linked_student_id)
          .single();

        if (studentError) {
          console.error('❌ StudentTenantFix: Error fetching student record:', studentError);
          return null;
        }

        if (!student || !student.tenant_id) {
          console.error('❌ StudentTenantFix: Student has no tenant_id assigned');
          return null;
        }

        console.log('🎓 StudentTenantFix: Found student tenant:', student.tenant_id);

        // Update user record with the student's tenant_id
        console.log('🔧 StudentTenantFix: Updating user tenant_id...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ tenant_id: student.tenant_id })
          .eq('id', user.id);

        if (updateError) {
          console.error('❌ StudentTenantFix: Failed to update user tenant_id:', updateError);
        } else {
          console.log('✅ StudentTenantFix: Updated user tenant_id successfully');
        }

        // Get the tenant details
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', student.tenant_id)
          .eq('status', 'active')
          .single();

        if (tenantError) {
          console.error('❌ StudentTenantFix: Error fetching tenant from student:', tenantError);
          return null;
        }

        console.log('✅ StudentTenantFix: Tenant retrieved from student:', tenant.name);
        return tenant;
      }

      // Case 3: No tenant_id and no linked_student_id
      console.error('❌ StudentTenantFix: User has no tenant_id and no linked_student_id');
      return null;

    } catch (error) {
      console.error('💥 StudentTenantFix: Fatal error in tenant initialization:', error);
      return null;
    }
  }

  /**
   * Validate that a student user has proper tenant assignment
   * @param {Object} user - The authenticated user object
   * @returns {Promise<Boolean>} - True if tenant is properly assigned
   */
  static async validateStudentTenantAssignment(user) {
    try {
      const tenant = await this.initializeTenantForStudent(user);
      return tenant !== null;
    } catch (error) {
      console.error('💥 StudentTenantFix: Error validating tenant assignment:', error);
      return false;
    }
  }

  /**
   * Get tenant context data for a student user
   * @param {Object} user - The authenticated user object
   * @returns {Promise<Object>} - Tenant context object
   */
  static async getStudentTenantContext(user) {
    try {
      const tenant = await this.initializeTenantForStudent(user);
      
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
      console.error('💥 StudentTenantFix: Error getting tenant context:', error);
      return {
        tenantId: null,
        currentTenant: null,
        error: 'Failed to load tenant context. Please contact administrator.'
      };
    }
  }
}
