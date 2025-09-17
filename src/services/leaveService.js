// 🚀 ENHANCED: Updated imports for enhanced tenant system
import { supabase, TABLES } from '../utils/supabase';
import { tenantDatabase, createTenantQuery, getCachedTenantId } from '../utils/tenantHelpers';
import { format } from 'date-fns';

/**
 * Leave Management Service
 * Handles all leave-related operations including CRUD, approvals, and balance management
 * All operations are tenant-aware to ensure proper data isolation
 */

class LeaveService {
  // 🚀 ENHANCED: Tenant validation helper for service methods
  async validateTenantReadiness() {
    try {
      const tenantId = getCachedTenantId();
      
      if (!tenantId) {
        console.error('❌ LeaveService: Cached tenant ID not available');
        return {
          isValid: false,
          error: 'Tenant system not ready. Please try again in a moment.'
        };
      }
      
      console.log('✅ LeaveService: Tenant validation successful:', tenantId);
      return {
        isValid: true,
        tenantId
      };
    } catch (error) {
      console.error('❌ LeaveService: Tenant validation error:', error);
      return {
        isValid: false,
        error: 'Tenant validation failed. Please contact support.'
      };
    }
  }

  /**
   * Submit a new leave application
   * @param {Object} leaveData - Leave application data
   * @returns {Object} Response with success status and data
   */
  // 🚀 ENHANCED: Use tenant validation and tenantDatabase helper
  async submitLeaveApplication(leaveData) {
    const startTime = performance.now();
    
    try {
      console.log('🚀 Enhanced LeaveService: Starting submitLeaveApplication...');
      
      // ✨ Validate tenant readiness
      const { isValid, tenantId, error: validationError } = await this.validateTenantReadiness();
      if (!isValid) {
        return {
          success: false,
          error: validationError,
          message: 'Failed to submit leave application'
        };
      }

      // 🚀 ENHANCED: Use tenantDatabase.create for automatic tenant isolation
      console.log('💾 Enhanced LeaveService: Creating leave application via tenantDatabase...');
      const { data, error } = await tenantDatabase.create(
        TABLES.LEAVE_APPLICATIONS,
        leaveData
      );

      if (error) {
        throw new Error(`Failed to create leave application record: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('Failed to create leave application record');
      }
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const submitTime = Math.round(endTime - startTime);
      console.log(`✅ Enhanced LeaveService: Leave submitted in ${submitTime}ms`);

      return {
        success: true,
        data,
        message: 'Leave application submitted successfully'
      };
    } catch (error) {
      console.error('❌ Enhanced LeaveService: Error submitting leave application:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to submit leave application'
      };
    }
  }

  /**
   * Get leave applications with optional filters
   * @param {Object} filters - Filter criteria
   * @returns {Object} Response with leave applications
   */
  // 🚀 ENHANCED: Use tenant validation and createTenantQuery helper
  async getLeaveApplications(filters = {}) {
    const startTime = performance.now();
    
    try {
      console.log('🚀 Enhanced LeaveService: Starting getLeaveApplications...');
      
      // ✨ Validate tenant readiness
      const { isValid, tenantId, error: validationError } = await this.validateTenantReadiness();
      if (!isValid) {
        return {
          success: false,
          error: validationError,
          message: 'Failed to fetch leave applications'
        };
      }

      // 🚀 ENHANCED: Use createTenantQuery for automatic tenant filtering
      console.log('📊 Enhanced LeaveService: Creating tenant-aware query...');
      let query = createTenantQuery(tenantId, TABLES.LEAVE_APPLICATIONS, `
        *,
        teacher:teachers!leave_applications_teacher_id_fkey(id, name),
        applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
        reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
        replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
      `);
        // Note: tenant_id filtering is handled automatically by createTenantQuery

      // Apply filters
      if (filters.teacher_id) {
        query = query.eq('teacher_id', filters.teacher_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.academic_year) {
        query = query.eq('academic_year', filters.academic_year);
      }
      if (filters.start_date) {
        query = query.gte('start_date', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('end_date', filters.end_date);
      }

      // Order by applied date (most recent first)
      query = query.order('applied_date', { ascending: false });

      // Apply limit if specified
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // 📊 Performance monitoring
      const endTime = performance.now();
      const fetchTime = Math.round(endTime - startTime);
      console.log(`✅ Enhanced LeaveService: Leave applications fetched in ${fetchTime}ms`);

      return {
        success: true,
        data: data || [],
        message: 'Leave applications retrieved successfully'
      };
    } catch (error) {
      console.error('❌ Enhanced LeaveService: Error fetching leave applications:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch leave applications'
      };
    }
  }

  /**
   * Update leave application status (approve/reject)
   * @param {string} applicationId - Leave application ID
   * @param {Object} updateData - Update data including status and admin remarks
   * @returns {Object} Response with success status
   */
  // 🚀 ENHANCED: Use tenant validation and tenantDatabase helper
  async updateLeaveStatus(applicationId, updateData) {
    try {
      console.log('🚀 Enhanced LeaveService: Starting updateLeaveStatus...');
      
      // Get current user for reviewed_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // ✨ Validate tenant readiness
      const { isValid, tenantId, error: validationError } = await this.validateTenantReadiness();
      if (!isValid) {
        return {
          success: false,
          error: validationError,
          message: 'Failed to update leave application status'
        };
      }

      const updatePayload = {
        ...updateData,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 🚀 ENHANCED: Use tenantDatabase.update for automatic tenant isolation
      console.log('💾 Enhanced LeaveService: Updating via tenantDatabase...');
      const data = await tenantDatabase.update(
        TABLES.LEAVE_APPLICATIONS,
        updatePayload,
        { id: applicationId },
        tenantId,
        `
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name)
        `
      );

      if (!data) {
        throw new Error('Failed to update leave application status');
      }

      return {
        success: true,
        data,
        message: `Leave application ${updateData.status.toLowerCase()} successfully`
      };
    } catch (error) {
      console.error('Error updating leave status:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update leave application status'
      };
    }
  }


  /**
   * Get leave statistics for dashboard
   * @param {Object} filters - Filter criteria
   * @returns {Object} Response with leave statistics
   */
  async getLeaveStatistics(filters = {}) {
    try {
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        throw new Error('Tenant context required to fetch leave statistics');
      }

      let query = supabase
        .from(TABLES.LEAVE_APPLICATIONS)
        .select('id, status, leave_type, total_days, start_date, end_date')
        .eq('tenant_id', tenantId);

      // Apply filters
      if (filters.academic_year) {
        query = query.eq('academic_year', filters.academic_year);
      }
      if (filters.start_date && filters.end_date) {
        query = query.gte('start_date', filters.start_date);
        query = query.lte('end_date', filters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        total_applications: data.length,
        pending_applications: data.filter(app => app.status === 'Pending').length,
        approved_applications: data.filter(app => app.status === 'Approved').length,
        rejected_applications: data.filter(app => app.status === 'Rejected').length,
        total_leave_days: data
          .filter(app => app.status === 'Approved')
          .reduce((sum, app) => sum + (app.total_days || 0), 0),
        by_leave_type: {},
        by_status: {
          Pending: data.filter(app => app.status === 'Pending').length,
          Approved: data.filter(app => app.status === 'Approved').length,
          Rejected: data.filter(app => app.status === 'Rejected').length,
          Cancelled: data.filter(app => app.status === 'Cancelled').length,
        }
      };

      // Group by leave type
      data.forEach(app => {
        if (!stats.by_leave_type[app.leave_type]) {
          stats.by_leave_type[app.leave_type] = {
            count: 0,
            total_days: 0
          };
        }
        stats.by_leave_type[app.leave_type].count++;
        if (app.status === 'Approved') {
          stats.by_leave_type[app.leave_type].total_days += (app.total_days || 0);
        }
      });

      return {
        success: true,
        data: stats,
        message: 'Leave statistics retrieved successfully'
      };
    } catch (error) {
      console.error('Error fetching leave statistics:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch leave statistics'
      };
    }
  }

  /**
   * Get upcoming leaves for a specific date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} Response with upcoming leaves
   */
  async getUpcomingLeaves(startDate, endDate) {
    try {
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        throw new Error('Tenant context required to fetch upcoming leaves');
      }

      const { data, error } = await supabase
        .from(TABLES.LEAVE_APPLICATIONS)
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'Approved')
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_date', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        message: 'Upcoming leaves retrieved successfully'
      };
    } catch (error) {
      console.error('Error fetching upcoming leaves:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch upcoming leaves'
      };
    }
  }

  /**
   * Check if teacher is available on a specific date
   * @param {string} teacherId - Teacher ID
   * @param {string} date - Date to check (YYYY-MM-DD)
   * @returns {Object} Response with availability status
   */
  async checkTeacherAvailability(teacherId, date) {
    try {
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        throw new Error('Tenant context required to check teacher availability');
      }

      const { data, error } = await supabase
        .from(TABLES.LEAVE_APPLICATIONS)
        .select('id, start_date, end_date, leave_type')
        .eq('tenant_id', tenantId)
        .eq('teacher_id', teacherId)
        .eq('status', 'Approved')
        .lte('start_date', date)
        .gte('end_date', date);

      if (error) throw error;

      const isAvailable = data.length === 0;
      
      return {
        success: true,
        data: {
          is_available: isAvailable,
          conflicting_leaves: data || []
        },
        message: isAvailable ? 'Teacher is available' : 'Teacher is on leave'
      };
    } catch (error) {
      console.error('Error checking teacher availability:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to check teacher availability'
      };
    }
  }

  /**
   * Cancel a leave application (only if pending or by the applicant)
   * @param {string} applicationId - Leave application ID
   * @param {string} userId - User ID requesting cancellation
   * @returns {Object} Response with success status
   */
  async cancelLeaveApplication(applicationId, userId) {
    try {
      // First check if the user has permission to cancel
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        throw new Error('Tenant context required to cancel leave application');
      }

      const { data: application, error: fetchError } = await supabase
        .from(TABLES.LEAVE_APPLICATIONS)
        .select('applied_by, status')
        .eq('id', applicationId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) throw fetchError;

      if (application.applied_by !== userId && application.status !== 'Pending') {
        throw new Error('You can only cancel your own pending leave applications');
      }

      const { data, error } = await supabase
        .from(TABLES.LEAVE_APPLICATIONS)
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Leave application cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling leave application:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to cancel leave application'
      };
    }
  }
}

// Create and export a singleton instance
const leaveService = new LeaveService();
export default leaveService;

// Export individual methods for convenience
export const {
  submitLeaveApplication,
  getLeaveApplications,
  updateLeaveStatus,
  getLeaveStatistics,
  getUpcomingLeaves,
  checkTeacherAvailability,
  cancelLeaveApplication
} = leaveService;
