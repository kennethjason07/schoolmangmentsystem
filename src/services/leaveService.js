import { supabase } from '../utils/supabase';
import { format } from 'date-fns';

/**
 * Leave Management Service
 * Handles all leave-related operations including CRUD, approvals, and balance management
 */

class LeaveService {
  /**
   * Submit a new leave application
   * @param {Object} leaveData - Leave application data
   * @returns {Object} Response with success status and data
   */
  async submitLeaveApplication(leaveData) {
    try {
      const { data, error } = await supabase
        .from('leave_applications')
        .insert([leaveData])
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          applied_by_user:users!leave_applications_applied_by_fkey(id, full_name)
        `)
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Leave application submitted successfully'
      };
    } catch (error) {
      console.error('Error submitting leave application:', error);
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
  async getLeaveApplications(filters = {}) {
    try {
      let query = supabase
        .from('leave_applications')
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          applied_by_user:users!leave_applications_applied_by_fkey(id, full_name),
          reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name),
          replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
        `);

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

      return {
        success: true,
        data: data || [],
        message: 'Leave applications retrieved successfully'
      };
    } catch (error) {
      console.error('Error fetching leave applications:', error);
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
  async updateLeaveStatus(applicationId, updateData) {
    try {
      // Get current user for reviewed_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const updatePayload = {
        ...updateData,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('leave_applications')
        .update(updatePayload)
        .eq('id', applicationId)
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          reviewed_by_user:users!leave_applications_reviewed_by_fkey(id, full_name)
        `)
        .single();

      if (error) throw error;

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
   * Get teacher leave balance
   * @param {string} teacherId - Teacher ID
   * @param {string} academicYear - Academic year (optional, defaults to current year)
   * @returns {Object} Response with leave balance data
   */
  async getTeacherLeaveBalance(teacherId, academicYear = null) {
    try {
      const year = academicYear || new Date().getFullYear().toString();
      
      let { data, error } = await supabase
        .from('teacher_leave_balance')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('academic_year', year)
        .single();

      if (error && error.code === 'PGRST116') {
        // No balance record exists, create one with default values
        const { data: newBalance, error: insertError } = await supabase
          .from('teacher_leave_balance')
          .insert([{
            teacher_id: teacherId,
            academic_year: year,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        data = newBalance;
      } else if (error) {
        throw error;
      }

      return {
        success: true,
        data,
        message: 'Leave balance retrieved successfully'
      };
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch leave balance'
      };
    }
  }

  /**
   * Update teacher leave balance
   * @param {string} teacherId - Teacher ID
   * @param {string} leaveType - Type of leave
   * @param {number} days - Number of days to add/subtract
   * @param {string} academicYear - Academic year (optional)
   * @returns {Object} Response with success status
   */
  async updateLeaveBalance(teacherId, leaveType, days, academicYear = null) {
    try {
      const year = academicYear || new Date().getFullYear().toString();
      
      // First, get current balance
      const balanceResponse = await this.getTeacherLeaveBalance(teacherId, year);
      if (!balanceResponse.success) {
        throw new Error(balanceResponse.error);
      }

      const currentBalance = balanceResponse.data;
      let updateData = {};

      // Determine which field to update based on leave type
      switch (leaveType) {
        case 'Sick Leave':
          updateData.sick_leave_used = Math.max(0, currentBalance.sick_leave_used + days);
          break;
        case 'Casual Leave':
          updateData.casual_leave_used = Math.max(0, currentBalance.casual_leave_used + days);
          break;
        case 'Earned Leave':
          updateData.earned_leave_used = Math.max(0, currentBalance.earned_leave_used + days);
          break;
        default:
          // For other leave types, we don't track balance
          return {
            success: true,
            message: 'Leave type does not require balance tracking'
          };
      }

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('teacher_leave_balance')
        .update(updateData)
        .eq('teacher_id', teacherId)
        .eq('academic_year', year)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Leave balance updated successfully'
      };
    } catch (error) {
      console.error('Error updating leave balance:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update leave balance'
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
      let query = supabase
        .from('leave_applications')
        .select('id, status, leave_type, total_days, start_date, end_date');

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
      const { data, error } = await supabase
        .from('leave_applications')
        .select(`
          *,
          teacher:teachers!leave_applications_teacher_id_fkey(id, name),
          replacement_teacher:teachers!leave_applications_replacement_teacher_id_fkey(id, name)
        `)
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
      const { data, error } = await supabase
        .from('leave_applications')
        .select('id, start_date, end_date, leave_type')
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
      const { data: application, error: fetchError } = await supabase
        .from('leave_applications')
        .select('applied_by, status')
        .eq('id', applicationId)
        .single();

      if (fetchError) throw fetchError;

      if (application.applied_by !== userId && application.status !== 'Pending') {
        throw new Error('You can only cancel your own pending leave applications');
      }

      const { data, error } = await supabase
        .from('leave_applications')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)
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
  getTeacherLeaveBalance,
  updateLeaveBalance,
  getLeaveStatistics,
  getUpcomingLeaves,
  checkTeacherAvailability,
  cancelLeaveApplication
} = leaveService;
