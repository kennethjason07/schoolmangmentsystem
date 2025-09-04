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

  // Test method to debug Supabase client
  testSupabaseClient() {
    console.log('🧪 Testing Supabase client...');
    console.log('🧪 supabase:', supabase);
    console.log('🧪 supabase keys:', Object.keys(supabase));
    
    try {
      const testQuery = supabase.from('students');
      console.log('🧪 Test query:', testQuery);
      console.log('🧪 Test query keys:', Object.keys(testQuery));
      console.log('🧪 Test query methods:', {
        select: typeof testQuery.select,
        eq: typeof testQuery.eq,
        insert: typeof testQuery.insert,
        update: typeof testQuery.update,
        delete: typeof testQuery.delete
      });
      
      // Try a simple select
      const selectQuery = testQuery.select('*');
      console.log('🧪 Select query:', selectQuery);
      console.log('🧪 Select query keys:', Object.keys(selectQuery));
      console.log('🧪 Select query eq method:', typeof selectQuery.eq);
      
    } catch (error) {
      console.error('🧪 Test error:', error);
    }
  }
  
  // Get tenant-filtered query
  getTenantQuery(tableName) {
    console.log('🔎 SupabaseService - getTenantQuery called for table:', tableName, 'with selectedTenantId:', this.selectedTenantId);
    
    // Run test first time only
    if (!this._testRun) {
      this._testRun = true;
      this.testSupabaseClient();
    }
    
    try {
      const query = supabase.from(tableName);
      console.log('🔎 SupabaseService - base query after supabase.from():', query);
      
      if (this.selectedTenantId) {
        // Return the base query, filtered by tenant_id, without .select()
        // The service methods will call .select() themselves
        console.log('🔎 SupabaseService - adding tenant filter to base query');
        
        // Since query.from() returns a raw query builder, we need to use it properly
        // Let's try to add the filter in a different way
        const filteredQuery = query.select('*').eq('tenant_id', this.selectedTenantId);
        console.log('🔎 SupabaseService - filtered query created:', filteredQuery);
        console.log('🔎 SupabaseService - filtered query type:', typeof filteredQuery);
        console.log('🔎 SupabaseService - filtered query methods:', {
          select: typeof filteredQuery.select,
          eq: typeof filteredQuery.eq,
          order: typeof filteredQuery.order
        });
        
        // Return a function that allows chaining
        return {
          select: (columns) => {
            console.log('🔎 Custom select called with:', columns);
            const newQuery = query.select(columns).eq('tenant_id', this.selectedTenantId);
            console.log('🔎 Custom select newQuery methods:', {
              eq: typeof newQuery.eq,
              order: typeof newQuery.order,
              gte: typeof newQuery.gte,
              lte: typeof newQuery.lte,
              single: typeof newQuery.single
            });
            return newQuery;
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

  // Add school_id to data before insert/update
  addSchoolId(data) {
    if (!this.selectedSchoolId) {
      throw new Error('No school selected');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => ({ ...item, school_id: this.selectedSchoolId }));
    }
    
    return { ...data, school_id: this.selectedSchoolId };
  }

  // STUDENT SERVICES
  async getStudents() {
    return this.getSchoolQuery('students')
      .select('*')
      .order('name');
  }

  async getStudentById(studentId) {
    return this.getSchoolQuery('students')
      .select(`
        *,
        classes (
          id,
          name,
          grade
        ),
        parents (
          id,
          name,
          phone,
          email,
          relationship
        )
      `)
      .eq('id', studentId)
      .single();
  }

  async createStudent(studentData) {
    return supabase
      .from('students')
      .insert(this.addSchoolId(studentData));
  }

  async updateStudent(studentId, studentData) {
    return supabase
      .from('students')
      .update(studentData)
      .eq('id', studentId)
      .eq('school_id', this.selectedSchoolId);
  }

  // TEACHER SERVICES
  async getTeachers() {
    return this.getSchoolQuery('teachers')
      .select('*')
      .order('name');
  }

  async getTeacherById(teacherId) {
    return this.getSchoolQuery('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();
  }

  async createTeacher(teacherData) {
    return supabase
      .from('teachers')
      .insert(this.addSchoolId(teacherData));
  }

  // CLASS SERVICES
  async getClasses() {
    return this.getSchoolQuery('classes')
      .select('*')
      .order('class_name');
  }

  async getClassById(classId) {
    return this.getSchoolQuery('classes')
      .select(`
        *,
        teachers (
          id,
          name,
          phone,
          email
        ),
        students (
          id,
          name,
          student_id,
          phone,
          email,
          date_of_birth,
          address
        )
      `)
      .eq('id', classId)
      .single();
  }

  async createClass(classData) {
    return supabase
      .from('classes')
      .insert(this.addSchoolId(classData));
  }

  // ATTENDANCE SERVICES
  async getStudentAttendance(startDate, endDate, classId = null, studentId = null) {
    let query = this.getSchoolQuery('student_attendance')
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

  async getAttendanceByClassAndDate(classId, date) {
    return this.getSchoolQuery('student_attendance')
      .select(`
        *,
        students (
          id,
          name,
          student_id
        )
      `)
      .eq('class_id', classId)
      .eq('date', date);
  }

  async markStudentAttendance(attendanceRecords) {
    return supabase
      .from('student_attendance')
      .upsert(this.addSchoolId(attendanceRecords));
  }

  async getTeacherAttendance(startDate, endDate, teacherId = null) {
    let query = this.getSchoolQuery('teacher_attendance')
      .select(`
        *,
        teachers (
          id,
          name,
          employee_id
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
    return this.getSchoolQuery('exams')
      .select(`
        *,
        classes (
          id,
          name,
          grade
        ),
        subjects (
          id,
          name
        )
      `)
      .order('exam_date', { ascending: false });
  }

  async getExamById(examId) {
    return this.getSchoolQuery('exams')
      .select(`
        *,
        classes (
          id,
          name,
          grade
        ),
        subjects (
          id,
          name
        ),
        marks (
          id,
          marks_obtained,
          students (
            id,
            name,
            student_id
          )
        )
      `)
      .eq('id', examId)
      .single();
  }

  async createExam(examData) {
    return supabase
      .from('exams')
      .insert(this.addSchoolId(examData));
  }

  // MARKS SERVICES
  async getMarksByExam(examId) {
    return this.getSchoolQuery('marks')
      .select(`
        *,
        students (
          id,
          name,
          student_id
        ),
        exams (
          id,
          title,
          total_marks,
          subjects (
            id,
            name
          )
        )
      `)
      .eq('exam_id', examId)
      .order('marks_obtained', { ascending: false });
  }

  async submitMarks(marksData) {
    return supabase
      .from('marks')
      .upsert(this.addSchoolId(marksData));
  }

  // ASSIGNMENT SERVICES
  async getAssignments() {
    return this.getSchoolQuery('assignments')
      .select(`
        *,
        classes (
          id,
          name,
          grade
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
      .insert(this.addSchoolId(assignmentData));
  }

  // FEE SERVICES
  async getStudentFees(studentId = null) {
    let query = this.getSchoolQuery('student_fees')
      .select(`
        *,
        students (
          id,
          name,
          student_id,
          classes (
            id,
            name,
            grade
          )
        ),
        fee_structure (
          id,
          fee_type,
          amount
        )
      `)
      .order('due_date', { ascending: true });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    return query;
  }

  async getFeeStructure() {
    return this.getSchoolQuery('fee_structure')
      .select(`
        *,
        classes (
          id,
          name,
          grade
        )
      `)
      .order('fee_type');
  }

  // NOTIFICATION SERVICES
  async getNotifications() {
    return this.getSchoolQuery('notifications')
      .select('*')
      .order('created_at', { ascending: false });
  }

  async createNotification(notificationData) {
    return supabase
      .from('notifications')
      .insert(this.addSchoolId(notificationData));
  }

  // TIMETABLE SERVICES
  async getTimetable(classId = null) {
    let query = this.getSchoolQuery('timetable_entries')
      .select(`
        *,
        classes (
          id,
          name,
          grade
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
      .insert(this.addSchoolId(entryData));
  }

  // SUBJECT SERVICES
  async getSubjects() {
    return this.getSchoolQuery('subjects')
      .select('*')
      .order('name');
  }

  async createSubject(subjectData) {
    return supabase
      .from('subjects')
      .insert(this.addSchoolId(subjectData));
  }

  // PARENT SERVICES
  async getParents() {
    return this.getSchoolQuery('parents')
      .select(`
        *,
        students (
          id,
          name,
          student_id,
          classes (
            id,
            name,
            grade
          )
        )
      `)
      .order('name');
  }

  async createParent(parentData) {
    return supabase
      .from('parents')
      .insert(this.addSchoolId(parentData));
  }

  // SCHOOL MANAGEMENT (for admin users)
  async getSchoolDetails() {
    if (!this.selectedSchoolId) {
      throw new Error('No school selected');
    }
    
    return supabase
      .from('school_details')
      .select('*')
      .eq('id', this.selectedSchoolId)
      .single();
  }

  async updateSchoolDetails(schoolData) {
    if (!this.selectedSchoolId) {
      throw new Error('No school selected');
    }
    
    return supabase
      .from('school_details')
      .update(schoolData)
      .eq('id', this.selectedSchoolId);
  }

  // USER SCHOOL MANAGEMENT
  async getUserSchools(userId) {
    return supabase
      .from('school_users')
      .select(`
        school_id,
        role_in_school,
        is_primary_school,
        school_details:school_id (
          id,
          name,
          type,
          school_code,
          address,
          phone,
          email,
          is_active
        )
      `)
      .eq('user_id', userId)
      .eq('school_details.is_active', true);
  }

  async switchUserSchool(userId, schoolId) {
    return supabase.rpc('switch_user_school', {
      user_uuid: userId,
      new_school_id: schoolId
    });
  }

  // ANALYTICS AND REPORTS (school-specific)
  async getAttendanceStatistics(startDate, endDate) {
    return this.getSchoolQuery('student_attendance')
      .select(`
        status,
        date,
        students (
          classes (
            id,
            name,
            grade
          )
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate);
  }

  async getClasswiseAttendance(startDate, endDate) {
    return this.getSchoolQuery('student_attendance')
      .select(`
        status,
        date,
        class_id,
        classes (
          name,
          grade
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate);
  }

  async getExamResults(examId) {
    return this.getSchoolQuery('marks')
      .select(`
        marks_obtained,
        students (
          name,
          student_id,
          classes (
            name,
            grade
          )
        ),
        exams (
          title,
          total_marks,
          subjects (
            name
          )
        )
      `)
      .eq('exam_id', examId)
      .order('marks_obtained', { ascending: false });
  }
}

// Create a singleton instance
const supabaseService = new SupabaseService();

export default supabaseService;
