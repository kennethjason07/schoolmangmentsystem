// 🚀 ENHANCED: Updated imports for enhanced tenant system
import { supabase } from './supabase';
import { tenantDatabase, createTenantQuery, getCachedTenantId, useTenantAccess } from './tenantHelpers';
import { validateTenantAccess } from './tenantValidation';

/**
 * Universal Leave Application Utilities
 * Handles leave applications for both admin and teacher roles
 */

/**
 * 🚀 ENHANCED: Get effective tenant ID using cached tenant system
 */
export const getEffectiveTenantId = async () => {
  try {
    console.log('🔍 Enhanced LeaveUtils: Getting effective tenant ID...');
    
    const tenantId = getCachedTenantId();
    
    if (!tenantId) {
      console.error('❌ Enhanced LeaveUtils: Cached tenant ID not available');
      throw new Error('Tenant system not ready. Please try again in a moment.');
    }
    
    console.log('✅ Enhanced LeaveUtils: Effective tenant ID:', tenantId);
    return tenantId;
  } catch (error) {
    console.error('❌ Enhanced LeaveUtils: Error getting effective tenant ID:', error);
    throw error;
  }
};

/**
 * Validate user access for leave operations
 */
export const validateLeaveAccess = async (user, tenantId, operation = 'leave operation') => {
  try {
    console.log(`🛡️ LeaveUtils: Validating access for ${operation}...`);
    
    if (!user || !user.id) {
      return {
        isValid: false,
        error: 'User authentication required. Please log in.'
      };
    }
    
    // Validate tenant access using centralized utility
    const validation = await validateTenantAccess(user.id, tenantId, `LeaveUtils - ${operation}`);
    
    if (!validation.isValid) {
      console.error(`❌ LeaveUtils: Tenant validation failed for ${operation}:`, validation.error);
      return {
        isValid: false,
        error: validation.error
      };
    }
    
    console.log(`✅ LeaveUtils: Access validated for ${operation}`);
    return { isValid: true };
  } catch (error) {
    console.error(`❌ LeaveUtils: Error validating access for ${operation}:`, error);
    return {
      isValid: false,
      error: `Access validation failed: ${error.message}`
    };
  }
};

/**
 * Get or create user record in users table
 */
export const ensureUserRecord = async (user, tenantId) => {
  try {
    console.log('👤 LeaveUtils: Ensuring user record exists...');
    
    // Check if user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, role_id')
      .eq('id', user.id)
      .single();
    
    if (userCheckError && userCheckError.code === 'PGRST116') {
      // User doesn't exist, determine role and create
      console.log('👤 LeaveUtils: User record not found, creating...');
      
      // Determine role based on user type or default
      let roleId = 2; // Default to teacher role
      
      if (user.user_metadata?.role === 'admin' || user.user_metadata?.userType === 'admin') {
        roleId = 1; // Admin role
      }
      
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.full_name || user.email,
          role_id: roleId,
          tenant_id: tenantId,
          created_at: new Date().toISOString()
        });
      
      if (createError) {
        console.warn('⚠️ LeaveUtils: Could not create user record:', createError);
        // Continue without user record - some operations might still work
        return { success: false, userId: user.id };
      }
      
      console.log('✅ LeaveUtils: User record created successfully');
      return { success: true, userId: user.id };
    } else if (userCheckError) {
      console.error('❌ LeaveUtils: Error checking user existence:', userCheckError);
      return { success: false, userId: user.id };
    }
    
    console.log('✅ LeaveUtils: User record already exists');
    return { success: true, userId: user.id };
  } catch (error) {
    console.error('❌ LeaveUtils: Error ensuring user record:', error);
    return { success: false, userId: user.id };
  }
};

/**
 * 🚀 ENHANCED: Submit leave application (for teachers)
 */
export const submitLeaveApplication = async (applicationData, user) => {
  const startTime = performance.now();
  
  try {
    console.log('🚀 Enhanced LeaveUtils: Starting leave application submission...');
    
    // ✨ Get cached tenant ID
    const tenantId = await getEffectiveTenantId();
    
    // Basic user validation (tenant validation handled by tenantDatabase helpers)
    if (!user || !user.id) {
      return {
        success: false,
        error: 'User authentication required. Please log in.'
      };
    }
    
    // Ensure user record exists
    await ensureUserRecord(user, tenantId);
    
    // Get teacher profile if user is a teacher
    let teacherId = user.linked_teacher_id;
    
    if (!teacherId) {
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('linked_teacher_id')
        .eq('id', user.id)
        .single();
        
      if (profileError) {
        console.warn('⚠️ LeaveUtils: Could not fetch user profile:', profileError);
      } else {
        teacherId = userProfile?.linked_teacher_id;
      }
    }
    
    if (!teacherId) {
      return {
        success: false,
        error: 'Teacher profile not found. Please contact administrator to link your account.'
      };
    }
    
    // Prepare leave data (tenant_id will be added automatically by tenantDatabase)
    const leaveData = {
      teacher_id: teacherId,
      leave_type: applicationData.leave_type,
      start_date: applicationData.start_date,
      end_date: applicationData.end_date,
      reason: applicationData.reason.trim(),
      applied_by: user.id,
      attachment_url: applicationData.attachment_url || null,
      status: 'Pending',
      applied_date: new Date().toISOString().split('T')[0]
    };
    
    console.log('💾 Enhanced LeaveUtils: Creating leave application via tenantDatabase...');
    
    // 🚀 ENHANCED: Use tenantDatabase.create for automatic tenant isolation
    const { data, error } = await tenantDatabase.create(
      'leave_applications',
      leaveData
    );
    
    if (error) {
      console.error('❌ Enhanced LeaveUtils: Error creating leave application:', error);
      return {
        success: false,
        error: error.message || 'Failed to submit leave application. Please try again.'
      };
    }
    
    if (!data) {
      return {
        success: false,
        error: 'Failed to submit leave application. Please try again.'
      };
    }
    
    const submitTime = Math.round(performance.now() - startTime);
    console.log(`✅ Enhanced LeaveUtils: Leave application submitted successfully in ${submitTime}ms`);
    
    return {
      success: true,
      data
    };
    
  } catch (error) {
    console.error('❌ Enhanced LeaveUtils: Error submitting leave application:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred.'
    };
  }
};

/**
 * 🚀 ENHANCED: Load leave applications with proper tenant filtering
 */
export const loadLeaveApplications = async (user, filters = {}) => {
  const startTime = performance.now();
  
  try {
    console.log('🚀 Enhanced LeaveUtils: Loading leave applications...');
    
    // ✨ Get cached tenant ID
    const tenantId = await getEffectiveTenantId();
    
    // Basic user validation
    if (!user || !user.id) {
      return {
        success: false,
        error: 'User authentication required. Please log in.'
      };
    }
    
    console.log('📊 Enhanced LeaveUtils: Querying leave applications...');
    
    // 🚀 ENHANCED: Use createTenantQuery for automatic tenant filtering
    let query = createTenantQuery(tenantId, 'leave_applications', `
      *,
      teacher:teachers!leave_applications_teacher_id_fkey(id, name),
      applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
      reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
      replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
    `);
    
    // Apply filters if provided
    if (filters.teacherId) {
      query = query.eq('teacher_id', filters.teacherId);
    }
    
    if (filters.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }
    
    // Order by most recent first
    query = query.order('applied_date', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Enhanced LeaveUtils: Query error:', error);
      
      let userMessage = 'Failed to load leave applications.';
      
      if (error.code === '42501') {
        userMessage = 'Permission denied. Please check your access rights.';
      } else if (error.message) {
        userMessage = error.message;
      }
      
      return {
        success: false,
        error: userMessage
      };
    }
    
    const loadTime = Math.round(performance.now() - startTime);
    console.log(`✅ Enhanced LeaveUtils: Loaded ${data?.length || 0} leave applications in ${loadTime}ms`);
    
    return {
      success: true,
      data: data || []
    };
    
  } catch (error) {
    console.error('❌ Enhanced LeaveUtils: Error loading leave applications:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred.'
    };
  }
};

// Legacy function - keeping for backward compatibility but with updated signature
export const addLeaveApplication = async (leaveFormData, user) => {
  try {
    console.log('🚀 Enhanced LeaveUtils: Starting admin add leave application...');
    
    // ✨ Get cached tenant ID
    const tenantId = await getEffectiveTenantId();
    
    // Validate access (more permissive for admins)
    const accessValidation = await validateLeaveAccess(user, tenantId, 'add leave application');
    if (!accessValidation.isValid) {
      return {
        success: false,
        error: accessValidation.error
      };
    }
    
    // Ensure user record exists
    const userRecord = await ensureUserRecord(user, tenantId);
    
    // Prepare leave data for admin-added leave
    const leaveData = {
      teacher_id: leaveFormData.teacher_id,
      leave_type: leaveFormData.leave_type,
      start_date: leaveFormData.start_date,
      end_date: leaveFormData.end_date,
      reason: leaveFormData.reason.trim(),
      applied_by: userRecord.userId,
      replacement_teacher_id: leaveFormData.replacement_teacher_id || null,
      replacement_notes: leaveFormData.replacement_notes?.trim() || null,
      tenant_id: tenantId,
      status: 'Approved', // Admin-added leaves are auto-approved
      reviewed_by: userRecord.userId,
      reviewed_at: new Date().toISOString(),
      admin_remarks: `Added by admin (${user.email}) on behalf of teacher`,
      applied_date: new Date().toISOString().split('T')[0]
    };
    
    console.log('💾 LeaveUtils: Inserting admin leave application...');
    
    // Insert leave application
    const { data, error } = await supabase
      .from('leave_applications')
      .insert([leaveData])
      .select();
    
    if (error) {
      console.error('❌ LeaveUtils: Admin insert error:', error);
      
      let userMessage = 'Failed to add leave application.';
      
      if (error.code === '42501') {
        userMessage = 'Permission denied. Please check your admin privileges.';
      } else if (error.code === '23503') {
        userMessage = 'Invalid teacher reference. Please select a valid teacher.';
      } else if (error.message) {
        userMessage = error.message;
      }
      
      return {
        success: false,
        error: userMessage
      };
    }
    
    console.log('✅ LeaveUtils: Admin leave application added successfully');
    
    return {
      success: true,
      data: data[0]
    };
    
  } catch (error) {
    console.error('❌ LeaveUtils: Error adding admin leave application:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred.'
    };
  }
};

/**
 * Review leave application (for admins)
 */
export const reviewLeaveApplication = async (applicationId, reviewData, user) => {
  try {
    console.log('🚀 LeaveUtils: Starting leave review...');
    
    // Get effective tenant ID
    const tenantId = await getEffectiveTenantId();
    
    // Validate access
    const accessValidation = await validateLeaveAccess(user, tenantId, 'review leave application');
    if (!accessValidation.isValid) {
      return {
        success: false,
        error: accessValidation.error
      };
    }
    
    // Ensure user record exists
    const userRecord = await ensureUserRecord(user, tenantId);
    
    // Prepare review data
    const updateData = {
      status: reviewData.status,
      reviewed_by: userRecord.userId,
      reviewed_at: new Date().toISOString(),
      admin_remarks: reviewData.admin_remarks.trim(),
      replacement_teacher_id: reviewData.replacement_teacher_id || null,
      replacement_notes: reviewData.replacement_notes?.trim() || null
    };
    
    console.log('💾 LeaveUtils: Updating leave application review...');
    
    // Update leave application
    const { data, error } = await supabase
      .from('leave_applications')
      .update(updateData)
      .eq('id', applicationId)
      .eq('tenant_id', tenantId) // Ensure tenant isolation
      .select();
    
    if (error) {
      console.error('❌ LeaveUtils: Review update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update leave application.'
      };
    }
    
    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Leave application not found or access denied.'
      };
    }
    
    console.log('✅ LeaveUtils: Leave application reviewed successfully');
    
    return {
      success: true,
      data: data[0]
    };
    
  } catch (error) {
    console.error('❌ LeaveUtils: Error reviewing leave application:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred.'
    };
  }
};


// 🚀 ENHANCED: Updated exports for enhanced tenant system
export default {
  getEffectiveTenantId,
  submitLeaveApplication,
  loadLeaveApplications,
  addLeaveApplication, // Legacy compatibility
  // Legacy functions (kept for backward compatibility but may need updates)
  validateLeaveAccess,
  ensureUserRecord,
  reviewLeaveApplication
};
