import { supabase } from '../utils/supabase';

// Tenant-aware Supabase service
class SupabaseService {
  constructor() {
    this.selectedTenantId = null;
  }

  // Set the current tenant context
  setTenantContext(tenantId) {
    console.log('🏫 SupabaseService - setTenantContext called with:', tenantId);
    this.selectedTenantId = tenantId;
    console.log('🏫 SupabaseService - selectedTenantId now set to:', this.selectedTenantId);
  }

  // Get tenant-filtered query
  getTenantQuery(tableName) {
    console.log('🔎 SupabaseService - getTenantQuery called for table:', tableName, 'with selectedTenantId:', this.selectedTenantId);
    
    try {
      const query = supabase.from(tableName);
      console.log('🔎 SupabaseService - base query after supabase.from():', query);
      
      if (this.selectedTenantId) {
        // Return a query object that automatically includes tenant filtering
        return {
          select: (columns) => {
            console.log('🔎 Custom select called with:', columns);
            return query.select(columns).eq('tenant_id', this.selectedTenantId);
          }
        };
      }
      
      console.log('🔎 SupabaseService - returning unfiltered base query');
      return query; // Return the base query without select
      
    } catch (error) {
      console.error('😱 SupabaseService - Error in getTenantQuery:', error);
      throw error;
    }
  }

  // Add tenant_id to data before insert/update
  addTenantId(data) {
    if (!this.selectedTenantId) {
      throw new Error('No tenant selected');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => ({ ...item, tenant_id: this.selectedTenantId }));
    }
    
    return { ...data, tenant_id: this.selectedTenantId };
  }

  // STUDENT SERVICES
  async getStudents() {
    return this.getTenantQuery('students')
      .select('*')
      .order('name');
  }

  async getStudentById(studentId) {
    return this.getTenantQuery('students')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        ),
        parents (
          id,
          name,
          phone,
          email,
          relation
        )
      `)
      .eq('id', studentId)
      .single();
  }

  async createStudent(studentData) {
    return supabase
      .from('students')
      .insert(this.addTenantId(studentData));
  }

  async updateStudent(studentId, studentData) {
    return supabase
      .from('students')
      .update(studentData)
      .eq('id', studentId)
      .eq('tenant_id', this.selectedTenantId);
  }

  // TEACHER SERVICES
  async getTeachers() {
    return this.getTenantQuery('teachers')
      .select('*')
      .order('name');
  }

  async getTeacherById(teacherId) {
    return this.getTenantQuery('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();
  }

  async createTeacher(teacherData) {
    return supabase
      .from('teachers')
      .insert(this.addTenantId(teacherData));
  }

  // CLASS SERVICES
  async getClasses() {
    return this.getTenantQuery('classes')
      .select('*')
      .order('class_name');
  }

  async getClassById(classId) {
    return this.getTenantQuery('classes')
      .select(`
        *,
        teachers (
          id,
          name,
          phone
        ),
        students (
          id,
          name,
          admission_no,
          roll_no
        )
      `)
      .eq('id', classId)
      .single();
  }

  async createClass(classData) {
    return supabase
      .from('classes')
      .insert(this.addTenantId(classData));
  }

  // ATTENDANCE SERVICES
  async getStudentAttendance(startDate, endDate, classId = null, studentId = null) {
    let query = this.getTenantQuery('student_attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    return query;
  }

  async markStudentAttendance(attendanceRecords) {
    return supabase
      .from('student_attendance')
      .upsert(this.addTenantId(attendanceRecords));
  }

  async getTeacherAttendance(startDate, endDate, teacherId = null) {
    let query = this.getTenantQuery('teacher_attendance')
      .select(`
        *,
        teachers (
          id,
          name
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (teacherId) {
      query = query.eq('teacher_id', teacherId);
    }

    return query;
  }

  // EXAM SERVICES
  async getExams() {
    return this.getTenantQuery('exams')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        )
      `)
      .order('start_date', { ascending: false });
  }

  async getExamById(examId) {
    return this.getTenantQuery('exams')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        ),
        marks (
          id,
          marks_obtained,
          students (
            id,
            name,
            admission_no
          )
        )
      `)
      .eq('id', examId)
      .single();
  }

  async createExam(examData) {
    return supabase
      .from('exams')
      .insert(this.addTenantId(examData));
  }

  // MARKS SERVICES
  async getMarksByExam(examId) {
    return this.getTenantQuery('marks')
      .select(`
        *,
        students (
          id,
          name,
          admission_no
        ),
        exams (
          id,
          name,
          max_marks
        )
      `)
      .eq('exam_id', examId)
      .order('marks_obtained', { ascending: false });
  }

  async submitMarks(marksData) {
    return supabase
      .from('marks')
      .upsert(this.addTenantId(marksData));
  }

  // ASSIGNMENT SERVICES
  async getAssignments() {
    return this.getTenantQuery('assignments')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        ),
        subjects (
          id,
          name
        ),
        teachers (
          id,
          name
        )
      `)
      .order('due_date', { ascending: true });
  }

  async createAssignment(assignmentData) {
    return supabase
      .from('assignments')
      .insert(this.addTenantId(assignmentData));
  }

  // HOMEWORK SERVICES  
  async getHomeworks() {
    return this.getTenantQuery('homeworks')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        ),
        subjects (
          id,
          name
        ),
        teachers (
          id,
          name
        )
      `)
      .order('due_date', { ascending: true });
  }

  async createHomework(homeworkData) {
    return supabase
      .from('homeworks')
      .insert(this.addTenantId(homeworkData));
  }

  // FEE SERVICES
  async getStudentFees(studentId = null) {
    let query = this.getTenantQuery('student_fees')
      .select(`
        *,
        students (
          id,
          name,
          admission_no,
          classes (
            id,
            class_name,
            section
          )
        )
      `)
      .order('payment_date', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    return query;
  }

  async getFeeStructure() {
    return this.getTenantQuery('fee_structure')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        )
      `)
      .order('fee_component');
  }

  // SUBJECT SERVICES
  async getSubjects() {
    return this.getTenantQuery('subjects')
      .select('*')
      .order('name');
  }

  async createSubject(subjectData) {
    return supabase
      .from('subjects')
      .insert(this.addTenantId(subjectData));
  }

  // PARENT SERVICES
  async getParents() {
    return this.getTenantQuery('parents')
      .select(`
        *,
        students (
          id,
          name,
          admission_no,
          classes (
            id,
            class_name,
            section
          )
        )
      `)
      .order('name');
  }

  async createParent(parentData) {
    return supabase
      .from('parents')
      .insert(this.addTenantId(parentData));
  }

  // TIMETABLE SERVICES
  async getTimetable(classId = null) {
    let query = this.getTenantQuery('timetable_entries')
      .select(`
        *,
        classes (
          id,
          class_name,
          section
        ),
        subjects (
          id,
          name
        ),
        teachers (
          id,
          name
        )
      `)
      .order('day_of_week')
      .order('start_time');

    if (classId) {
      query = query.eq('class_id', classId);
    }

    return query;
  }

  async createTimetableEntry(entryData) {
    return supabase
      .from('timetable_entries')
      .insert(this.addTenantId(entryData));
  }

  // NOTIFICATION SERVICES
  async getNotifications() {
    return this.getTenantQuery('notifications')
      .select('*')
      .order('created_at', { ascending: false });
  }

  async createNotification(notificationData) {
    return supabase
      .from('notifications')
      .insert(this.addTenantId(notificationData));
  }

  // EVENT SERVICES
  async getEvents() {
    return this.getTenantQuery('events')
      .select('*')
      .order('event_date', { ascending: true });
  }

  async createEvent(eventData) {
    return supabase
      .from('events')
      .insert(this.addTenantId(eventData));
  }

  // TENANT MANAGEMENT (for admin users)
  async getTenantDetails() {
    if (!this.selectedTenantId) {
      throw new Error('No tenant selected');
    }
    
    return supabase
      .from('tenants')
      .select('*')
      .eq('id', this.selectedTenantId)
      .single();
  }

  async updateTenantDetails(tenantData) {
    if (!this.selectedTenantId) {
      throw new Error('No tenant selected');
    }
    
    return supabase
      .from('tenants')
      .update(tenantData)
      .eq('id', this.selectedTenantId);
  }

  // ANALYTICS AND REPORTS (tenant-specific)
  async getAttendanceStatistics(startDate, endDate) {
    return this.getTenantQuery('student_attendance')
      .select(`
        status,
        date,
        students (
          classes (
            id,
            class_name,
            section
          )
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate);
  }

  async getClasswiseAttendance(startDate, endDate) {
    return this.getTenantQuery('student_attendance')
      .select(`
        status,
        date,
        class_id,
        classes (
          class_name,
          section
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate);
  }

  async getExamResults(examId) {
    return this.getTenantQuery('marks')
      .select(`
        marks_obtained,
        students (
          name,
          admission_no,
          classes (
            class_name,
            section
          )
        ),
        exams (
          name,
          max_marks
        )
      `)
      .eq('exam_id', examId)
      .order('marks_obtained', { ascending: false });
  }
}

// Create a singleton instance
const supabaseService = new SupabaseService();

export default supabaseService;
