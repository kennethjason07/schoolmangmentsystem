import { supabase } from '../utils/supabase';

class HostelService {
  constructor() {
    this.tenantId = null;
  }

  setTenantId(tenantId) {
    this.tenantId = tenantId;
  }

  // ==================== HOSTEL MANAGEMENT ====================

  /**
   * Get all hostels for the current tenant
   */
  async getHostels() {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select(`
          *,
          warden:users(id, full_name, email, phone),
          rooms_count:rooms(count),
          total_beds:rooms(beds(count))
        `)
        .eq('tenant_id', this.tenantId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching hostels:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new hostel
   */
  async createHostel(hostelData) {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .insert({
          ...hostelData,
          tenant_id: this.tenantId
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating hostel:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update hostel information
   */
  async updateHostel(hostelId, updates) {
    try {
      const { data, error } = await supabase
        .from('hostels')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', hostelId)
        .eq('tenant_id', this.tenantId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating hostel:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ROOM & BED MANAGEMENT ====================

  /**
   * Get rooms for a specific hostel
   */
  async getRooms(hostelId, includeInactive = false) {
    try {
      let query = supabase
        .from('rooms')
        .select(`
          *,
          block:blocks(*),
          beds(id, bed_label, bed_type, status),
          occupancy:beds(count)
        `)
        .eq('hostel_id', hostelId)
        .eq('tenant_id', this.tenantId);

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('floor').order('room_number');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new room with beds
   */
  async createRoom(roomData) {
    try {
      // Start transaction
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          ...roomData,
          tenant_id: this.tenantId
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create beds for the room
      const beds = [];
      for (let i = 1; i <= roomData.capacity; i++) {
        beds.push({
          room_id: room.id,
          bed_label: String(i),
          bed_type: 'normal',
          status: 'available',
          tenant_id: this.tenantId
        });
      }

      const { error: bedsError } = await supabase
        .from('beds')
        .insert(beds);

      if (bedsError) throw bedsError;

      return { success: true, data: room };
    } catch (error) {
      console.error('Error creating room:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available beds for allocation
   */
  async getAvailableBeds(hostelId, roomType = null) {
    try {
      let query = supabase
        .from('beds')
        .select(`
          *,
          room:rooms(*),
          block:rooms(block:blocks(*))
        `)
        .eq('status', 'available')
        .eq('tenant_id', this.tenantId);

      if (hostelId) {
        query = query.eq('rooms.hostel_id', hostelId);
      }

      if (roomType) {
        query = query.eq('rooms.room_type', roomType);
      }

      const { data, error } = await query.order('rooms.floor').order('rooms.room_number');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching available beds:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== APPLICATION MANAGEMENT ====================

  /**
   * Get hostel applications with filtering
   */
  async getApplications(filters = {}) {
    try {
      let query = supabase
        .from('hostel_applications')
        .select(`
          *,
          student:students(*),
          hostel:hostels(name, hostel_type),
          verified_by:users!verified_by(full_name),
          decision_by:users!decision_by(full_name)
        `)
        .eq('tenant_id', this.tenantId);

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.hostelId) {
        query = query.eq('hostel_id', filters.hostelId);
      }
      if (filters.academicYear) {
        query = query.eq('academic_year', filters.academicYear);
      }

      const { data, error } = await query.order('applied_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching applications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(applicationId, status, userId, remarks = null) {
    try {
      const updates = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'verified') {
        updates.verified_by = userId;
        updates.verified_at = new Date().toISOString();
      } else if (['accepted', 'rejected'].includes(status)) {
        updates.decision_by = userId;
        updates.decision_at = new Date().toISOString();
      }

      if (remarks) {
        updates.remarks = remarks;
      }

      const { data, error } = await supabase
        .from('hostel_applications')
        .update(updates)
        .eq('id', applicationId)
        .eq('tenant_id', this.tenantId)
        .select()
        .single();

      if (error) throw error;

      // If accepted, add to waitlist for bed allocation
      if (status === 'waitlisted') {
        await this.addToWaitlist(applicationId, data.hostel_id);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating application status:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ALLOCATION MANAGEMENT ====================

  /**
   * Create bed allocation
   */
  async createAllocation(applicationId, bedId, userId, acceptanceDeadlineDays = 7) {
    try {
      // Get application details
      const { data: application, error: appError } = await supabase
        .from('hostel_applications')
        .select('*, student:students(*)')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      // Create allocation
      const acceptanceDeadline = new Date();
      acceptanceDeadline.setDate(acceptanceDeadline.getDate() + acceptanceDeadlineDays);

      const { data, error } = await supabase
        .from('bed_allocations')
        .insert({
          application_id: applicationId,
          student_id: application.student_id,
          bed_id: bedId,
          academic_year: application.academic_year,
          status: 'pending_acceptance',
          acceptance_deadline: acceptanceDeadline.toISOString(),
          created_by: userId,
          tenant_id: this.tenantId
        })
        .select()
        .single();

      if (error) throw error;

      // Update bed status to reserved
      await supabase
        .from('beds')
        .update({ status: 'reserved' })
        .eq('id', bedId);

      // Update application status to accepted
      await supabase
        .from('hostel_applications')
        .update({ 
          status: 'accepted',
          decision_by: userId,
          decision_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      // Remove from waitlist if exists
      await supabase
        .from('hostel_waitlist')
        .update({ 
          removed_at: new Date().toISOString(),
          removal_reason: 'allocated_bed'
        })
        .eq('application_id', applicationId);

      return { success: true, data };
    } catch (error) {
      console.error('Error creating allocation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Student accepts/rejects allocation
   */
  async respondToAllocation(allocationId, response, studentId) {
    try {
      const { data, error } = await supabase
        .from('bed_allocations')
        .update({
          student_response: response,
          student_response_at: new Date().toISOString(),
          status: response === 'accepted' ? 'active' : 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', allocationId)
        .eq('student_id', studentId)
        .eq('tenant_id', this.tenantId)
        .select()
        .single();

      if (error) throw error;

      // Update bed status
      const bedStatus = response === 'accepted' ? 'occupied' : 'available';
      await supabase
        .from('beds')
        .update({ status: bedStatus })
        .eq('id', data.bed_id);

      // Add to bed history
      await this.addBedHistory(data.bed_id, studentId, allocationId, 
        response === 'accepted' ? 'assigned' : 'cancelled');

      return { success: true, data };
    } catch (error) {
      console.error('Error responding to allocation:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== WAITLIST MANAGEMENT ====================

  /**
   * Add application to waitlist
   */
  async addToWaitlist(applicationId, hostelId, priorityScore = 1000) {
    try {
      const { data, error } = await supabase
        .from('hostel_waitlist')
        .insert({
          application_id: applicationId,
          hostel_id: hostelId,
          priority_score: priorityScore,
          tenant_id: this.tenantId
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get waitlist for a hostel
   */
  async getWaitlist(hostelId) {
    try {
      const { data, error } = await supabase
        .from('hostel_waitlist')
        .select(`
          *,
          application:hostel_applications(*,
            student:students(*)
          )
        `)
        .eq('hostel_id', hostelId)
        .eq('tenant_id', this.tenantId)
        .is('removed_at', null)
        .order('priority_score')
        .order('added_at');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== BED HISTORY ====================

  /**
   * Add entry to bed history
   */
  async addBedHistory(bedId, studentId, allocationId, action, notes = null, performedBy = null) {
    try {
      const { data, error } = await supabase
        .from('bed_history')
        .insert({
          bed_id: bedId,
          student_id: studentId,
          allocation_id: allocationId,
          start_date: new Date().toISOString().split('T')[0],
          action,
          notes,
          performed_by: performedBy,
          tenant_id: this.tenantId
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error adding bed history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get bed history
   */
  async getBedHistory(bedId) {
    try {
      const { data, error } = await supabase
        .from('bed_history')
        .select(`
          *,
          student:students(name, student_number),
          performed_by:users(full_name)
        `)
        .eq('bed_id', bedId)
        .eq('tenant_id', this.tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching bed history:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== REPORTS & ANALYTICS ====================

  /**
   * Get hostel occupancy report
   */
  async getOccupancyReport(hostelId = null) {
    try {
      let query = supabase
        .from('v_hostel_occupancy')
        .select('*')
        .eq('tenant_id', this.tenantId);

      if (hostelId) {
        query = query.eq('hostel_id', hostelId);
      }

      const { data, error } = await query.order('occupancy_percentage', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching occupancy report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get application statistics
   */
  async getApplicationStats(academicYear = null) {
    try {
      let query = supabase
        .from('hostel_applications')
        .select('status, hostel_id')
        .eq('tenant_id', this.tenantId);

      if (academicYear) {
        query = query.eq('academic_year', academicYear);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process statistics
      const stats = {
        total: data.length,
        submitted: data.filter(app => app.status === 'submitted').length,
        verified: data.filter(app => app.status === 'verified').length,
        accepted: data.filter(app => app.status === 'accepted').length,
        rejected: data.filter(app => app.status === 'rejected').length,
        waitlisted: data.filter(app => app.status === 'waitlisted').length,
        acceptance_rate: data.length > 0 ? 
          (data.filter(app => app.status === 'accepted').length / data.length * 100).toFixed(2) : 0
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error fetching application stats:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== MAINTENANCE ====================

  /**
   * Report maintenance issue
   */
  async reportMaintenance(maintenanceData, reportedBy) {
    try {
      const { data, error } = await supabase
        .from('hostel_maintenance_logs')
        .insert({
          ...maintenanceData,
          reported_by: reportedBy,
          tenant_id: this.tenantId
        })
        .select()
        .single();

      if (error) throw error;

      // If bed maintenance, update bed status
      if (maintenanceData.bed_id) {
        await supabase
          .from('beds')
          .update({ status: 'maintenance' })
          .eq('id', maintenanceData.bed_id);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error reporting maintenance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get maintenance logs
   */
  async getMaintenanceLogs(hostelId = null) {
    try {
      let query = supabase
        .from('hostel_maintenance_logs')
        .select(`
          *,
          hostel:hostels(name),
          room:rooms(room_number),
          reported_by:users!reported_by(full_name),
          assigned_to:users!assigned_to(full_name)
        `)
        .eq('tenant_id', this.tenantId);

      if (hostelId) {
        query = query.eq('hostel_id', hostelId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching maintenance logs:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new HostelService();