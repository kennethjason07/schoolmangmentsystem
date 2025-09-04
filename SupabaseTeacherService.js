// SupabaseTeacherService.js
// Teacher service methods with tenant-based RLS support

import { supabase } from '../lib/supabase'; // Adjust path as needed

class SupabaseTeacherService {
  
  // Get all teachers for current tenant
  static async getTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          classes!teachers_assigned_class_id_fkey (
            id,
            class_name,
            section,
            academic_year
          )
        `)
        .order('name');

      if (error) {
        console.error('Error fetching teachers:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get teachers failed:', error);
      return { data: null, error };
    }
  }

  // Get teacher by ID
  static async getTeacherById(teacherId) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          classes!teachers_assigned_class_id_fkey (
            id,
            class_name,
            section,
            academic_year
          ),
          teacher_subjects (
            id,
            subjects (
              id,
              name,
              is_optional
            )
          )
        `)
        .eq('id', teacherId)
        .single();

      if (error) {
        console.error('Error fetching teacher:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get teacher by ID failed:', error);
      return { data: null, error };
    }
  }

  // Get teachers by class
  static async getTeachersByClass(classId) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          classes!teachers_assigned_class_id_fkey (
            id,
            class_name,
            section
          )
        `)
        .eq('assigned_class_id', classId)
        .order('name');

      if (error) {
        console.error('Error fetching teachers by class:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get teachers by class failed:', error);
      return { data: null, error };
    }
  }

  // Get class teachers only
  static async getClassTeachers() {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          classes!teachers_assigned_class_id_fkey (
            id,
            class_name,
            section,
            academic_year
          )
        `)
        .eq('is_class_teacher', true)
        .order('name');

      if (error) {
        console.error('Error fetching class teachers:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get class teachers failed:', error);
      return { data: null, error };
    }
  }

  // Create new teacher
  static async createTeacher(teacherData) {
    try {
      // Get current user's tenant_id (RLS will handle this automatically, but good practice)
      const { data: session } = await supabase.auth.getSession();
      if (!session?.data?.session) {
        throw new Error('User not authenticated');
      }

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', session.data.session.user.id)
        .single();

      if (!user?.tenant_id) {
        throw new Error('User has no tenant assigned');
      }

      // Add tenant_id to teacher data
      const teacherWithTenant = {
        ...teacherData,
        tenant_id: user.tenant_id
      };

      const { data, error } = await supabase
        .from('teachers')
        .insert(teacherWithTenant)
        .select(`
          *,
          classes!teachers_assigned_class_id_fkey (
            id,
            class_name,
            section
          )
        `)
        .single();

      if (error) {
        console.error('Error creating teacher:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create teacher failed:', error);
      return { data: null, error };
    }
  }

  // Update teacher
  static async updateTeacher(teacherId, updateData) {
    try {
      // Remove tenant_id from update data to prevent changes
      const { tenant_id, ...safeUpdateData } = updateData;

      const { data, error } = await supabase
        .from('teachers')
        .update(safeUpdateData)
        .eq('id', teacherId)
        .select(`
          *,
          classes!teachers_assigned_class_id_fkey (
            id,
            class_name,
            section
          )
        `)
        .single();

      if (error) {
        console.error('Error updating teacher:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update teacher failed:', error);
      return { data: null, error };
    }
  }

  // Delete teacher
  static async deleteTeacher(teacherId) {
    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);

      if (error) {
        console.error('Error deleting teacher:', error);
        throw error;
      }

      return { data: true, error: null };
    } catch (error) {
      console.error('Delete teacher failed:', error);
      return { data: null, error };
    }
  }

  // Get teacher attendance
  static async getTeacherAttendance(teacherId, startDate, endDate) {
    try {
      let query = supabase
        .from('teacher_attendance')
        .select(`
          *,
          teachers (
            id,
            name
          )
        `)
        .order('date', { ascending: false });

      if (teacherId) {
        query = query.eq('teacher_id', teacherId);
      }

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching teacher attendance:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get teacher attendance failed:', error);
      return { data: null, error };
    }
  }

  // Mark teacher attendance
  static async markTeacherAttendance(attendanceData) {
    try {
      // Get current user's tenant_id
      const { data: session } = await supabase.auth.getSession();
      if (!session?.data?.session) {
        throw new Error('User not authenticated');
      }

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', session.data.session.user.id)
        .single();

      if (!user?.tenant_id) {
        throw new Error('User has no tenant assigned');
      }

      const attendanceWithTenant = {
        ...attendanceData,
        tenant_id: user.tenant_id,
        marked_by: session.data.session.user.id
      };

      const { data, error } = await supabase
        .from('teacher_attendance')
        .insert(attendanceWithTenant)
        .select(`
          *,
          teachers (
            id,
            name
          )
        `)
        .single();

      if (error) {
        console.error('Error marking teacher attendance:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mark teacher attendance failed:', error);
      return { data: null, error };
    }
  }

  // Get teacher subjects
  static async getTeacherSubjects(teacherId) {
    try {
      const { data, error } = await supabase
        .from('teacher_subjects')
        .select(`
          *,
          subjects (
            id,
            name,
            class_id,
            academic_year,
            is_optional,
            classes (
              class_name,
              section
            )
          )
        `)
        .eq('teacher_id', teacherId);

      if (error) {
        console.error('Error fetching teacher subjects:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get teacher subjects failed:', error);
      return { data: null, error };
    }
  }

  // Assign subject to teacher
  static async assignSubjectToTeacher(teacherId, subjectId) {
    try {
      // Get current user's tenant_id
      const { data: session } = await supabase.auth.getSession();
      if (!session?.data?.session) {
        throw new Error('User not authenticated');
      }

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', session.data.session.user.id)
        .single();

      if (!user?.tenant_id) {
        throw new Error('User has no tenant assigned');
      }

      const { data, error } = await supabase
        .from('teacher_subjects')
        .insert({
          teacher_id: teacherId,
          subject_id: subjectId,
          tenant_id: user.tenant_id
        })
        .select(`
          *,
          teachers (
            id,
            name
          ),
          subjects (
            id,
            name,
            classes (
              class_name,
              section
            )
          )
        `)
        .single();

      if (error) {
        console.error('Error assigning subject to teacher:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Assign subject to teacher failed:', error);
      return { data: null, error };
    }
  }

  // Get teacher statistics for current tenant
  static async getTeacherStats() {
    try {
      const { data, error } = await supabase
        .rpc('get_teacher_tenant_stats');

      if (error) {
        console.error('Error fetching teacher stats:', error);
        throw error;
      }

      return { data: data?.[0] || null, error: null };
    } catch (error) {
      console.error('Get teacher stats failed:', error);
      return { data: null, error };
    }
  }
}

export default SupabaseTeacherService;
