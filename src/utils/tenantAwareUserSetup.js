/**
 * Tenant-Aware User Setup Utility
 * 
 * This utility provides functions to set up and fix user accounts
 * within the email-based tenant system. All operations are tenant-scoped
 * to ensure data isolation and security.
 */

import { supabase } from './supabase';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';

/**
 * Fix user setup issues for the current tenant
 * @param {Object} user - Current authenticated user
 * @returns {Object} - { success, message, details }
 */
export const fixCurrentUserSetup = async (user) => {
  console.log('🔧 TENANT USER SETUP: Starting user setup fix for:', user?.email);

  try {
    if (!user?.email) {
      return {
        success: false,
        message: 'No authenticated user found',
        code: 'NO_USER'
      };
    }

    // Step 1: Get current tenant context
    const tenantResult = await getCurrentUserTenantByEmail();
    if (!tenantResult.success) {
      console.error('❌ TENANT USER SETUP: Failed to get tenant context:', tenantResult.error);
      return {
        success: false,
        message: `Cannot fix user setup: ${tenantResult.error}`,
        code: 'NO_TENANT_CONTEXT'
      };
    }

    const { tenant, userRecord, tenantId } = tenantResult.data;
    console.log('✅ TENANT USER SETUP: Working with tenant:', tenant.name);

    const fixResults = [];

    // Step 2: Verify user record exists and is complete
    console.log('🔍 TENANT USER SETUP: Verifying user record...');
    const userCheckResult = await verifyUserRecord(userRecord, tenantId);
    if (!userCheckResult.isValid) {
      console.log('🔧 TENANT USER SETUP: Fixing user record...');
      const userFixResult = await fixUserRecord(user, userRecord, tenantId);
      fixResults.push(userFixResult);
    } else {
      fixResults.push({ success: true, action: 'User record is valid', details: 'No fixes needed' });
    }

    // Step 3: Ensure user has appropriate role for tenant
    console.log('🔍 TENANT USER SETUP: Verifying user role...');
    const roleCheckResult = await verifyUserRole(userRecord, tenantId);
    if (!roleCheckResult.isValid) {
      console.log('🔧 TENANT USER SETUP: Fixing user role...');
      const roleFixResult = await fixUserRole(userRecord, tenantId, user.email);
      fixResults.push(roleFixResult);
    } else {
      fixResults.push({ success: true, action: 'User role is valid', details: roleCheckResult.details });
    }

    // Step 4: Check tenant-specific user data integrity
    console.log('🔍 TENANT USER SETUP: Checking tenant data integrity...');
    const dataIntegrityResult = await checkTenantDataIntegrity(userRecord, tenantId);
    if (!dataIntegrityResult.isValid) {
      console.log('🔧 TENANT USER SETUP: Fixing data integrity issues...');
      const dataFixResult = await fixDataIntegrityIssues(userRecord, tenantId);
      fixResults.push(dataFixResult);
    } else {
      fixResults.push({ success: true, action: 'Data integrity is valid', details: 'All tenant data links are correct' });
    }

    // Step 5: Summary
    const successfulFixes = fixResults.filter(r => r.success).length;
    const totalChecks = fixResults.length;

    console.log(`✅ TENANT USER SETUP: Completed ${successfulFixes}/${totalChecks} checks/fixes successfully`);

    return {
      success: true,
      message: `User setup completed successfully for ${tenant.name}. ${successfulFixes}/${totalChecks} checks passed.`,
      details: {
        tenant: tenant.name,
        tenantId,
        user: user.email,
        fixes: fixResults,
        summary: `${successfulFixes} successful, ${totalChecks - successfulFixes} failed`
      }
    };

  } catch (error) {
    console.error('❌ TENANT USER SETUP: Unexpected error:', error);
    return {
      success: false,
      message: `User setup failed: ${error.message}`,
      code: 'UNEXPECTED_ERROR'
    };
  }
};

/**
 * Verify user record is complete and valid
 * @param {Object} userRecord - User record from database
 * @param {string} tenantId - Current tenant ID
 * @returns {Object} - { isValid, issues }
 */
const verifyUserRecord = async (userRecord, tenantId) => {
  const issues = [];

  if (!userRecord.full_name || userRecord.full_name.trim() === '') {
    issues.push('Missing full name');
  }

  if (!userRecord.tenant_id || userRecord.tenant_id !== tenantId) {
    issues.push('Incorrect or missing tenant assignment');
  }

  if (!userRecord.role_id) {
    issues.push('Missing role assignment');
  }

  if (!userRecord.email || !userRecord.email.includes('@')) {
    issues.push('Invalid email address');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};

/**
 * Fix user record issues
 * @param {Object} authUser - Authenticated user from Supabase Auth
 * @param {Object} userRecord - Current user record
 * @param {string} tenantId - Tenant ID
 * @returns {Object} - Fix result
 */
const fixUserRecord = async (authUser, userRecord, tenantId) => {
  try {
    const updates = {};

    // Fix missing full name
    if (!userRecord.full_name || userRecord.full_name.trim() === '') {
      updates.full_name = authUser.user_metadata?.full_name || 
                          authUser.email.split('@')[0].replace(/[._]/g, ' ') + ' (User)';
    }

    // Fix tenant assignment
    if (!userRecord.tenant_id || userRecord.tenant_id !== tenantId) {
      updates.tenant_id = tenantId;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authUser.id);

      if (error) {
        return {
          success: false,
          action: 'Fix user record',
          error: error.message
        };
      }
    }

    return {
      success: true,
      action: 'Fix user record',
      details: `Updated fields: ${Object.keys(updates).join(', ') || 'None needed'}`
    };

  } catch (error) {
    return {
      success: false,
      action: 'Fix user record',
      error: error.message
    };
  }
};

/**
 * Verify user has appropriate role for tenant
 * @param {Object} userRecord - User record
 * @param {string} tenantId - Tenant ID
 * @returns {Object} - Verification result
 */
const verifyUserRole = async (userRecord, tenantId) => {
  try {
    if (!userRecord.role_id) {
      return { isValid: false, issues: ['No role assigned'] };
    }

    // Check if role exists and belongs to tenant
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, role_name, tenant_id')
      .eq('id', userRecord.role_id)
      .eq('tenant_id', tenantId)
      .single();

    if (roleError || !role) {
      return { 
        isValid: false, 
        issues: ['Role not found or belongs to different tenant'] 
      };
    }

    return {
      isValid: true,
      details: `Role: ${role.role_name}`
    };

  } catch (error) {
    return {
      isValid: false,
      issues: [`Role verification error: ${error.message}`]
    };
  }
};

/**
 * Fix user role assignment
 * @param {Object} userRecord - User record
 * @param {string} tenantId - Tenant ID
 * @param {string} userEmail - User email for role determination
 * @returns {Object} - Fix result
 */
const fixUserRole = async (userRecord, tenantId, userEmail) => {
  try {
    // Determine appropriate role based on email domain or pattern
    let targetRoleName = 'Teacher'; // Default role
    
    if (userEmail.toLowerCase().includes('admin') || 
        userEmail.toLowerCase().includes('principal')) {
      targetRoleName = 'Admin';
    } else if (userEmail.toLowerCase().includes('student')) {
      targetRoleName = 'Student';
    } else if (userEmail.toLowerCase().includes('parent')) {
      targetRoleName = 'Parent';
    }

    // Find or create the role for this tenant
    let { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role_name', targetRoleName)
      .single();

    if (roleError && roleError.code === 'PGRST116') {
      // Role doesn't exist, create it
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({
          role_name: targetRoleName,
          tenant_id: tenantId
        })
        .select('id')
        .single();

      if (createError) {
        return {
          success: false,
          action: 'Fix user role',
          error: `Failed to create role: ${createError.message}`
        };
      }

      role = newRole;
    } else if (roleError) {
      return {
        success: false,
        action: 'Fix user role',
        error: `Failed to find role: ${roleError.message}`
      };
    }

    // Update user with correct role
    const { error: updateError } = await supabase
      .from('users')
      .update({ role_id: role.id })
      .eq('id', userRecord.id);

    if (updateError) {
      return {
        success: false,
        action: 'Fix user role',
        error: updateError.message
      };
    }

    return {
      success: true,
      action: 'Fix user role',
      details: `Assigned role: ${targetRoleName}`
    };

  } catch (error) {
    return {
      success: false,
      action: 'Fix user role',
      error: error.message
    };
  }
};

/**
 * Check tenant-specific data integrity
 * @param {Object} userRecord - User record
 * @param {string} tenantId - Tenant ID
 * @returns {Object} - Check result
 */
const checkTenantDataIntegrity = async (userRecord, tenantId) => {
  const issues = [];

  try {
    // Check if there are any data records that reference this user but wrong tenant
    const checkQueries = [
      // Check if user has teacher records in wrong tenant
      supabase.from('teachers').select('id, tenant_id').eq('user_id', userRecord.id),
      // Check if user has student records in wrong tenant
      supabase.from('students').select('id, tenant_id').eq('parent_id', userRecord.id)
    ];

    const results = await Promise.allSettled(checkQueries);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.data) {
        const records = result.value.data;
        const wrongTenantRecords = records.filter(record => record.tenant_id !== tenantId);
        
        if (wrongTenantRecords.length > 0) {
          const tableNames = ['teachers', 'students'];
          issues.push(`Found ${wrongTenantRecords.length} ${tableNames[index]} records with wrong tenant_id`);
        }
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };

  } catch (error) {
    return {
      isValid: false,
      issues: [`Data integrity check failed: ${error.message}`]
    };
  }
};

/**
 * Fix data integrity issues
 * @param {Object} userRecord - User record
 * @param {string} tenantId - Tenant ID
 * @returns {Object} - Fix result
 */
const fixDataIntegrityIssues = async (userRecord, tenantId) => {
  try {
    const fixes = [];

    // Fix teacher records with wrong tenant_id
    const { data: teacherRecords, error: teacherError } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userRecord.id)
      .neq('tenant_id', tenantId);

    if (!teacherError && teacherRecords?.length > 0) {
      const { error: updateTeacherError } = await supabase
        .from('teachers')
        .update({ tenant_id: tenantId })
        .eq('user_id', userRecord.id);

      if (!updateTeacherError) {
        fixes.push(`Fixed ${teacherRecords.length} teacher records`);
      }
    }

    // Fix student parent assignments with wrong tenant_id
    const { data: studentRecords, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('parent_id', userRecord.id)
      .neq('tenant_id', tenantId);

    if (!studentError && studentRecords?.length > 0) {
      const { error: updateStudentError } = await supabase
        .from('students')
        .update({ tenant_id: tenantId })
        .eq('parent_id', userRecord.id);

      if (!updateStudentError) {
        fixes.push(`Fixed ${studentRecords.length} student parent assignments`);
      }
    }

    return {
      success: true,
      action: 'Fix data integrity',
      details: fixes.length > 0 ? fixes.join(', ') : 'No fixes needed'
    };

  } catch (error) {
    return {
      success: false,
      action: 'Fix data integrity',
      error: error.message
    };
  }
};

/**
 * Get user setup status for current tenant
 * @param {Object} user - Current authenticated user
 * @returns {Object} - Status information
 */
export const getUserSetupStatus = async (user) => {
  try {
    if (!user?.email) {
      return {
        success: false,
        status: 'not_authenticated',
        message: 'No authenticated user found'
      };
    }

    // Get tenant context
    const tenantResult = await getCurrentUserTenantByEmail();
    if (!tenantResult.success) {
      return {
        success: false,
        status: 'no_tenant',
        message: tenantResult.error
      };
    }

    const { tenant, userRecord, tenantId } = tenantResult.data;

    // Check various aspects of user setup
    const checks = {
      hasFullName: !!(userRecord.full_name && userRecord.full_name.trim()),
      hasCorrectTenant: userRecord.tenant_id === tenantId,
      hasRole: !!userRecord.role_id,
      tenantActive: tenant.status === 'active'
    };

    const allChecksPass = Object.values(checks).every(check => check === true);

    return {
      success: true,
      status: allChecksPass ? 'complete' : 'needs_fixes',
      tenant: tenant.name,
      tenantId,
      checks,
      message: allChecksPass 
        ? `User setup is complete for ${tenant.name}` 
        : `User setup needs fixes for ${tenant.name}`
    };

  } catch (error) {
    return {
      success: false,
      status: 'error',
      message: error.message
    };
  }
};
