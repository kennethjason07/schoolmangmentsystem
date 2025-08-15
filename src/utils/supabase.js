import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Utility functions
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Database table names matching your schema
export const TABLES = {
  USERS: 'users',
  ROLES: 'roles',
  CLASSES: 'classes',
  PARENTS: 'parents',
  STUDENTS: 'students',
  TEACHERS: 'teachers',
  SUBJECTS: 'subjects',
  TEACHER_SUBJECTS: 'teacher_subjects',
  STUDENT_ATTENDANCE: 'student_attendance',
  TEACHER_ATTENDANCE: 'teacher_attendance',
  FEE_STRUCTURE: 'fee_structure',
  STUDENT_FEES: 'student_fees',
  EXAMS: 'exams',
  MARKS: 'marks',
  HOMEWORKS: 'homeworks',
  HOMEWORK: 'homeworks',
  ASSIGNMENTS: 'assignments',
  TIMETABLE: 'timetable_entries',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_RECIPIENTS: 'notification_recipients',
  TASKS: 'tasks',
  PERSONAL_TASKS: 'personal_tasks',
  SCHOOL_DETAILS: 'school_details',
  MESSAGES: 'messages',
  EVENTS: 'events',
  FEES: 'fees',
};

// Authentication helper functions
export const authHelpers = {
  // Sign up a new user
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign in user
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign out user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      return { user, error };
    } catch (error) {
      return { user: null, error };
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper functions
export const dbHelpers = {
  // Ensure default roles exist
  async ensureRolesExist() {
    try {
      const defaultRoles = ['admin', 'teacher', 'student', 'parent'];

      for (const roleName of defaultRoles) {
        const { data: existingRole } = await supabase
          .from(TABLES.ROLES)
          .select('id')
          .eq('role_name', roleName)
          .single();

        if (!existingRole) {
          await supabase
            .from(TABLES.ROLES)
            .insert({ role_name: roleName });
          console.log(`Created role: ${roleName}`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error ensuring roles exist:', error);
      return { success: false, error };
    }
  },
  // Generic CRUD operations
  async create(table, data) {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select();
      return { data: result, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async read(table, filters = {}) {
    try {
      let query = supabase.from(table).select('*');
      
      // Apply filters
      Object.keys(filters).forEach(key => {
        query = query.eq(key, filters[key]);
      });
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async update(table, id, updates) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async delete(table, id) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      return { error };
    } catch (error) {
      return { error };
    }
  },

  // User management functions
  async getUserByEmail(email) {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('email', email)
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createUser(userData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .insert(userData)
        .select()
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Class and Section management
  async getClasses() {
    try {
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .order('class_name');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getSectionsByClass(classId = null) {
    try {
      let query = supabase
        .from(TABLES.CLASSES)
        .select('section');
      
      if (classId) {
        query = query.eq('id', classId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Extract unique sections
      const uniqueSections = [...new Set(data.map(item => item.section))];
      return { data: uniqueSections.map(s => ({ id: s, section_name: s })), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Student management
  async getStudentsByClass(classId, sectionId = null) {
    try {
      let query = supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(class_name, section),
          users!students_parent_id_fkey(full_name, phone, email)
        `)
        .eq('class_id', classId);

      if (sectionId) {
        query = query.eq('classes.section', sectionId);
      }

      const { data, error } = await query.order('roll_no');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentById(studentId) {
    try {
      console.log('getStudentById: Fetching student with ID:', studentId);

      // First try a simple query without joins
      const { data: basicData, error: basicError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentId)
        .single();

      if (basicError) {
        console.error('getStudentById: Basic query failed:', basicError);
        return { data: null, error: basicError };
      }

      console.log('getStudentById: Basic student data:', basicData);

      // Try to get class info separately
      let classData = null;
      if (basicData.class_id) {
        const { data: classInfo, error: classError } = await supabase
          .from(TABLES.CLASSES)
          .select('class_name, section')
          .eq('id', basicData.class_id)
          .single();

        if (!classError) {
          classData = classInfo;
        } else {
          console.warn('getStudentById: Class query failed:', classError);
        }
      }

      // Try to get parent info separately
      let parentData = null;
      if (basicData.parent_id) {
        const { data: parentInfo, error: parentError } = await supabase
          .from(TABLES.USERS)
          .select('full_name, phone, email')
          .eq('id', basicData.parent_id)
          .single();

        if (!parentError) {
          parentData = parentInfo;
        } else {
          console.warn('getStudentById: Parent query failed:', parentError);
        }
      }

      // Combine the data
      const combinedData = {
        ...basicData,
        classes: classData,
        users: parentData
      };

      console.log('getStudentById: Combined data:', combinedData);
      return { data: combinedData, error: null };

    } catch (error) {
      console.error('getStudentById: Unexpected error:', error);
      return { data: null, error };
    }
  },

  // Teacher management
  async getTeachers() {
    try {
      const { data, error } = await supabase
        .from(TABLES.TEACHERS)
        .select(`
          *,
          users!users_linked_teacher_id_fkey(id, email, full_name, phone)
        `)
        .order('name');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTeacherByUserId(userId) {
    try {
      // First get the user to find linked_teacher_id
      const { data: user, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_teacher_id')
        .eq('id', userId)
        .single();

      if (userError || !user?.linked_teacher_id) {
        return { data: null, error: userError || new Error('No teacher linked to this user') };
      }

      // Then get the teacher with related data
      const { data, error } = await supabase
        .from(TABLES.TEACHERS)
        .select(`
          *,
          teacher_subjects(
            subjects(id, name, class_id)
          )
        `)
        .eq('id', user.linked_teacher_id)
        .single();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createTeacherAccount(teacherData, authData) {
    try {
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      // 1. Create auth user using regular signup
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'teacher'
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) throw authError;

      if (!authUser.user) {
        throw new Error('Failed to create user account');
      }

      // 2. Get teacher role ID
      const { data: teacherRole, error: roleError } = await supabase
        .from(TABLES.ROLES)
        .select('id')
        .eq('role_name', 'teacher')
        .single();

      if (roleError) {
        // If role doesn't exist, create it
        const { data: newRole, error: createRoleError } = await supabase
          .from(TABLES.ROLES)
          .insert({ role_name: 'teacher' })
          .select()
          .single();

        if (createRoleError) throw createRoleError;
        teacherRole = newRole;
      }

      // 3. Create user profile with linked_teacher_id
      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert({
          id: authUser.user.id,
          email: authData.email,
          full_name: authData.full_name,
          phone: authData.phone || '',
          role_id: teacherRole.id,
          linked_teacher_id: teacherData.teacherId  // ✅ Link to teacher record
        })
        .select()
        .single();

      if (userError) throw userError;

      // 4. Get the teacher record for return
      const { data: teacher, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .eq('id', teacherData.teacherId)
        .single();

      if (teacherError) throw teacherError;

      return {
        data: {
          authUser: authUser.user,
          userProfile,
          teacher
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createStudentAccount(studentData, authData) {
    try {
      console.log('Creating student account - Step 1: Ensuring roles exist');
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      console.log('Creating student account - Step 2: Creating auth user for email:', authData.email);
      // 1. Create auth user using regular signup
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'student'
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      if (!authUser.user) {
        throw new Error('Failed to create user account - no user returned');
      }

      console.log('Creating student account - Step 3: Auth user created with ID:', authUser.user.id);

      // 2. Get student role ID
      console.log('Creating student account - Step 4: Getting student role');
      let { data: studentRole, error: roleError } = await supabase
        .from(TABLES.ROLES)
        .select('id')
        .eq('role_name', 'student')
        .single();

      if (roleError) {
        console.log('Student role not found, creating it');
        // If role doesn't exist, create it
        const { data: newRole, error: createRoleError } = await supabase
          .from(TABLES.ROLES)
          .insert({ role_name: 'student' })
          .select()
          .single();

        if (createRoleError) {
          console.error('Error creating student role:', createRoleError);
          throw createRoleError;
        }
        studentRole = newRole;
      }

      console.log('Creating student account - Step 5: Student role ID:', studentRole.id);

      // 3. Create user profile with linked_student_id
      console.log('Creating student account - Step 6: Creating user profile');
      const userProfileData = {
        id: authUser.user.id,
        email: authData.email,
        full_name: authData.full_name,
        phone: authData.phone || '',
        role_id: studentRole.id,
        linked_student_id: studentData.studentId  // ✅ Link to student record
      };

      console.log('User profile data:', userProfileData);

      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert(userProfileData)
        .select()
        .single();

      if (userError) {
        console.error('Error creating user profile:', userError);
        throw userError;
      }

      console.log('Creating student account - Step 7: User profile created:', userProfile);

      // 4. Get the student record for return
      console.log('Creating student account - Step 8: Getting student record for ID:', studentData.studentId);
      const { data: student, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentData.studentId)
        .single();

      if (studentError) {
        console.error('Error getting student record:', studentError);
        throw studentError;
      }

      console.log('Creating student account - Step 9: Success! Account created for student:', student.name);

      return {
        data: {
          authUser: authUser.user,
          userProfile,
          student
        },
        error: null
      };
    } catch (error) {
      console.error('Error in createStudentAccount:', error);
      return { data: null, error };
    }
  },

  async createParentAccount(studentData, authData) {
    try {
      console.log('Creating parent account - Step 1: Ensuring roles exist');
      // 0. Ensure roles exist
      await this.ensureRolesExist();

      console.log('Creating parent account - Step 2: Creating auth user for email:', authData.email);
      // 1. Create auth user using regular signup
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
        options: {
          data: {
            full_name: authData.full_name,
            role: 'parent'
          },
          emailRedirectTo: undefined // Disable email confirmation for admin-created accounts
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      if (!authUser.user) {
        throw new Error('Failed to create user account - no user returned');
      }

      console.log('Creating parent account - Step 3: Auth user created with ID:', authUser.user.id);

      // 2. Get parent role ID
      console.log('Creating parent account - Step 4: Getting parent role');
      let { data: parentRole, error: roleError } = await supabase
        .from(TABLES.ROLES)
        .select('id')
        .eq('role_name', 'parent')
        .single();

      if (roleError) {
        console.log('Parent role not found, creating it');
        // If role doesn't exist, create it
        const { data: newRole, error: createRoleError } = await supabase
          .from(TABLES.ROLES)
          .insert({ role_name: 'parent' })
          .select()
          .single();

        if (createRoleError) {
          console.error('Error creating parent role:', createRoleError);
          throw createRoleError;
        }
        parentRole = newRole;
      }

      console.log('Creating parent account - Step 5: Parent role ID:', parentRole.id);

      // 3. Create user profile with linked_parent_of
      console.log('Creating parent account - Step 6: Creating user profile');
      const userProfileData = {
        id: authUser.user.id,
        email: authData.email,
        full_name: authData.full_name,
        phone: authData.phone || '',
        role_id: parentRole.id,
        linked_parent_of: studentData.studentId  // ✅ Link to student record as parent
      };

      console.log('User profile data:', userProfileData);

      const { data: userProfile, error: userError } = await supabase
        .from(TABLES.USERS)
        .insert(userProfileData)
        .select()
        .single();

      if (userError) {
        console.error('Error creating user profile:', userError);
        throw userError;
      }

      console.log('Creating parent account - Step 7: User profile created:', userProfile);

      // 4. Create parent record in parents table
      console.log('Creating parent account - Step 8: Creating parent record');
      const parentRecordData = {
        name: authData.full_name,
        relation: authData.relation || 'Guardian', // Default to Guardian if not specified
        phone: authData.phone || '',
        email: authData.email,
        student_id: studentData.studentId
      };

      console.log('Parent record data:', parentRecordData);

      const { data: parentRecord, error: parentError } = await supabase
        .from(TABLES.PARENTS)
        .insert(parentRecordData)
        .select()
        .single();

      if (parentError) {
        console.error('Error creating parent record:', parentError);
        throw parentError;
      }

      console.log('Creating parent account - Step 9: Parent record created:', parentRecord);

      // 5. Update student record to link to the user account
      console.log('Creating parent account - Step 10: Updating student parent_id');
      const { error: studentUpdateError } = await supabase
        .from(TABLES.STUDENTS)
        .update({ parent_id: authUser.user.id })
        .eq('id', studentData.studentId);

      if (studentUpdateError) {
        console.error('Error updating student parent_id:', studentUpdateError);
        throw studentUpdateError;
      }

      console.log('Creating parent account - Step 11: Student parent_id updated successfully');

      // 6. Get the student record for return
      console.log('Creating parent account - Step 12: Getting student record for ID:', studentData.studentId);
      const { data: student, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .eq('id', studentData.studentId)
        .single();

      if (studentError) {
        console.error('Error getting student record:', studentError);
        throw studentError;
      }

      console.log('Creating parent account - Step 13: Success! Parent account and record created for student:', student.name);

      return {
        data: {
          authUser: authUser.user,
          userProfile,
          parentRecord,
          student
        },
        error: null
      };
    } catch (error) {
      console.error('Error in createParentAccount:', error);
      // Note: In a production environment, you might want to implement rollback logic here
      // to clean up any partially created records if the transaction fails
      return { data: null, error };
    }
  },

  // Test function to verify auth is working
  async testAuthConnection() {
    try {
      console.log('Testing Supabase Auth connection...');
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Current session:', session);
      console.log('Auth test completed, error:', error);
      return { session, error };
    } catch (error) {
      console.error('Auth connection test failed:', error);
      return { session: null, error };
    }
  },

  // Verify if a user exists in auth.users table
  async verifyAuthUser(email) {
    try {
      console.log('Verifying auth user for email:', email);
      // Note: This requires RLS policies to be set up properly
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) {
        console.log('Cannot access admin.listUsers, checking via sign-in attempt');
        return { exists: 'unknown', error: 'Admin access required' };
      }

      const userExists = data.users.some(user => user.email === email);
      console.log('Auth user exists:', userExists);
      return { exists: userExists, error: null };
    } catch (error) {
      console.error('Error verifying auth user:', error);
      return { exists: 'unknown', error };
    }
  },

  async getTeacherSubjects(teacherId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          *,
          subjects(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('teacher_id', teacherId);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Attendance management
  async getAttendanceByDate(date, classId = null, sectionId = null) {
    try {
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select(`
          *,
          students(
            name,
            roll_no,
            classes(class_name, section)
          )
        `)
        .eq('date', date);
      
      if (classId) {
        query = query.eq('students.class_id', classId);
      }
      
      if (sectionId) {
        query = query.eq('students.classes.section', sectionId);
      }
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async markAttendance(attendanceData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .upsert(attendanceData, { onConflict: 'student_id,date' })
        .select();
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Fee management
  async getFeeStructure(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.FEE_STRUCTURE)
        .select('*')
        .eq('class_id', classId);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentFees(studentId) {
    try {
      console.log('getStudentFees: Fetching fees for student ID:', studentId);

      // First try a simple query without joins
      const { data, error } = await supabase
        .from(TABLES.STUDENT_FEES)
        .select('*')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });

      console.log('getStudentFees: Query result:', { data, error });
      return { data, error };
    } catch (error) {
      console.error('getStudentFees: Unexpected error:', error);
      return { data: null, error };
    }
  },

  // Timetable management
  async getTeacherTimetable(teacherId, academicYear = null) {
    try {
      // If no academic year provided, use current year
      if (!academicYear) {
        const currentYear = new Date().getFullYear();
        academicYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
      }

      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          classes(class_name, section),
          subjects(subject_name)
        `)
        .eq('teacher_id', teacherId)
        .eq('academic_year', academicYear)
        .order('day_of_week')
        .order('period_number');

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Exam and Marks management
  async getExams(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXAMS)
        .select('*')
        .eq('class_id', classId)
        .order('date', { ascending: false });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getMarksByStudent(studentId, examId = null) {
    try {
      let query = supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          exams(name, date),
          subjects(name)
        `)
        .eq('student_id', studentId);
      
      if (examId) {
        query = query.eq('exam_id', examId);
      }
      
      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Homework management
  async getHomeworks(classId) {
    try {
      let query = supabase
        .from(TABLES.HOMEWORKS)
        .select('*')
        .eq('class_id', classId);

      const { data, error } = await query.order('due_date');

      // Handle case where homeworks table doesn't exist
      if (error && error.code === '42P01') {
        console.log('Homeworks table does not exist');
        return { data: [], error: null };
      }

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Parent management
  async getParentByUserId(userId) {
    try {
      // Get user data with linked student information
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select(`
          *,
          roles(role_name),
          students!users_linked_parent_of_fkey(
            id,
            name,
            admission_no,
            roll_no,
            dob,
            gender,
            address,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('id', userId)
        .single();

      if (userError) {
        return { data: null, error: userError };
      }

      if (!userData.linked_parent_of) {
        return { data: null, error: new Error('No student linked to this user') };
      }

      return { data: userData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentsByParentId(userId) {
    try {
      // Get all students linked to this parent user
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('linked_parent_of')
        .eq('id', userId)
        .single();

      if (userError || !userData.linked_parent_of) {
        return { data: [], error: userError || new Error('No students linked to this parent') };
      }

      // Get student details
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          *,
          classes(id, class_name, section)
        `)
        .eq('id', userData.linked_parent_of)
        .single();

      if (studentError) {
        return { data: [], error: studentError };
      }

      return { data: [studentData], error: null };
    } catch (error) {
      return { data: [], error };
    }
  },

  // Student management
  async getStudentByUserId(userId) {
    try {
      // Get user data with linked student information
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select(`
          *,
          roles(role_name),
          students!users_linked_student_id_fkey(
            id,
            name,
            admission_no,
            roll_no,
            dob,
            gender,
            address,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('id', userId)
        .single();

      if (userError) {
        return { data: null, error: userError };
      }

      if (!userData.linked_student_id) {
        return { data: null, error: new Error('No student linked to this user') };
      }

      return { data: userData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getStudentAttendance(studentId, startDate = null, endDate = null) {
    try {
      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  async getStudentMarks(studentId, examId = null) {
    try {
      let query = supabase
        .from(TABLES.MARKS)
        .select(`
          *,
          subjects(name),
          exams(name, date)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (examId) {
        query = query.eq('exam_id', examId);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  // Timetable management
  async getTimetable(classId) {
    try {
      let query = supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          subjects(id, name),
          teachers(id, name),
          classes(id, class_name, section)
        `)
        .eq('class_id', classId)
        .order('day_of_week, period_number');

      const { data, error } = await query;
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async createTimetableEntry(timetableData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .insert([timetableData])
        .select(`
          *,
          subjects(id, name),
          classes(id, class_name, section)
        `);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateTimetableEntry(id, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          subjects(id, name),
          classes(id, class_name, section)
        `);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async deleteTimetableEntry(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .delete()
        .eq('id', id);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTimetableByClass(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TIMETABLE)
        .select(`
          *,
          subjects(id, name),
          classes(id, class_name, section)
        `)
        .eq('class_id', classId)
        .order('day_of_week, start_time');
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Notifications
  async getNotificationsByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select(`
          *,
          notification_recipients!inner(recipient_id, recipient_type)
        `)
        .eq('notification_recipients.recipient_id', userId)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getNotificationsByRole(role, userId = null) {
    try {
      // For backward compatibility, redirect to user-based query if userId provided
      if (userId) {
        return this.getNotificationsByUserId(userId);
      }

      // For role-based queries, we need to join through users and roles
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select(`
          *,
          notification_recipients!inner(
            recipient_id,
            recipient_type,
            users!notification_recipients_recipient_id_fkey(
              id,
              roles(role_name)
            )
          )
        `)
        .eq('notification_recipients.users.roles.role_name', role)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTasks() {
    try {
      const { data, error } = await supabase
        .from(TABLES.TASKS)
        .select('*')
        .order('due_date', { ascending: true });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Dashboard statistics
  async getDashboardStats() {
    try {
      const [
        { data: students, error: studentsError },
        { data: teachers, error: teachersError },
        { data: classes, error: classesError },
        { data: todayAttendance, error: attendanceError }
      ] = await Promise.all([
        supabase.from(TABLES.STUDENTS).select('id', { count: 'exact' }),
        supabase.from(TABLES.TEACHERS).select('id', { count: 'exact' }),
        supabase.from(TABLES.CLASSES).select('id', { count: 'exact' }),
        supabase.from(TABLES.STUDENT_ATTENDANCE)
          .select('id', { count: 'exact' })
          .eq('date', new Date().toISOString().split('T')[0])
          .eq('status', 'present')
      ]);

      return {
        data: {
          totalStudents: students?.length || 0,
          totalTeachers: teachers?.length || 0,
          totalClasses: classes?.length || 0,
          todayAttendance: todayAttendance?.length || 0
        },
        error: studentsError || teachersError || classesError || attendanceError
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // School Details management
  async getSchoolDetails() {
    try {
      const { data, error } = await supabase
        .from(TABLES.SCHOOL_DETAILS)
        .select('*')
        .limit(1);

      if (error) {
        return { data: null, error };
      }

      // Return the first record if exists, otherwise null
      return { data: data && data.length > 0 ? data[0] : null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Standardized attendance utilities
  normalizeAttendanceStatus(status) {
    if (!status) return 'absent';
    const normalizedStatus = status.toLowerCase().trim();

    switch (normalizedStatus) {
      case 'present':
      case 'p':
        return 'present';
      case 'absent':
      case 'a':
        return 'absent';
      case 'late':
      case 'l':
        return 'late';
      case 'excused':
      case 'e':
        return 'excused';
      default:
        console.warn(`Unknown attendance status: ${status}, defaulting to absent`);
        return 'absent';
    }
  },

  isAttendedStatus(status) {
    const normalizedStatus = this.normalizeAttendanceStatus(status);
    return ['present', 'late', 'excused'].includes(normalizedStatus);
  },

  // Get standardized attendance statistics for a student
  async getStudentAttendanceStats(studentId, options = {}) {
    try {
      const {
        startDate = null,
        endDate = null,
        countMethod = 'attended', // 'attended' or 'present_only'
        groupBy = null // 'month', 'week', 'day', or null
      } = options;

      let query = supabase
        .from(TABLES.STUDENT_ATTENDANCE)
        .select('date, status')
        .eq('student_id', studentId)
        .order('date', { ascending: true });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data: attendanceRecords, error } = await query;
      if (error) return { data: null, error };

      if (!attendanceRecords || attendanceRecords.length === 0) {
        return {
          data: {
            totalDays: 0,
            attendedDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            excusedDays: 0,
            attendancePercentage: 0,
            presentOnlyPercentage: 0,
            breakdown: {}
          },
          error: null
        };
      }

      // Process records with standardized status
      const processedRecords = attendanceRecords.map(record => ({
        ...record,
        normalizedStatus: this.normalizeAttendanceStatus(record.status),
        isAttended: this.isAttendedStatus(record.status)
      }));

      // Calculate basic stats
      const totalDays = processedRecords.length;
      const attendedDays = processedRecords.filter(r => r.isAttended).length;
      const presentDays = processedRecords.filter(r => r.normalizedStatus === 'present').length;
      const absentDays = processedRecords.filter(r => r.normalizedStatus === 'absent').length;
      const lateDays = processedRecords.filter(r => r.normalizedStatus === 'late').length;
      const excusedDays = processedRecords.filter(r => r.normalizedStatus === 'excused').length;

      const attendancePercentage = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;
      const presentOnlyPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Group by period if requested
      let breakdown = {};
      if (groupBy) {
        processedRecords.forEach(record => {
          let key;
          const date = new Date(record.date);

          switch (groupBy) {
            case 'month':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            case 'week':
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              key = weekStart.toISOString().split('T')[0];
              break;
            case 'day':
              key = record.date;
              break;
            default:
              key = 'all';
          }

          if (!breakdown[key]) {
            breakdown[key] = {
              totalDays: 0,
              attendedDays: 0,
              presentDays: 0,
              absentDays: 0,
              lateDays: 0,
              excusedDays: 0
            };
          }

          breakdown[key].totalDays++;
          breakdown[key][`${record.normalizedStatus}Days`]++;
          if (record.isAttended) {
            breakdown[key].attendedDays++;
          }
        });

        // Calculate percentages for each group
        Object.keys(breakdown).forEach(key => {
          const group = breakdown[key];
          group.attendancePercentage = group.totalDays > 0 ?
            Math.round((group.attendedDays / group.totalDays) * 100) : 0;
          group.presentOnlyPercentage = group.totalDays > 0 ?
            Math.round((group.presentDays / group.totalDays) * 100) : 0;
        });
      }

      return {
        data: {
          totalDays,
          attendedDays,
          presentDays,
          absentDays,
          lateDays,
          excusedDays,
          attendancePercentage,
          presentOnlyPercentage,
          breakdown,
          records: processedRecords
        },
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  async updateSchoolDetails(schoolData) {
    try {
      // First check if school details exist
      const { data: existing, error: getError } = await this.getSchoolDetails();

      if (getError) {
        return { data: null, error: getError };
      }

      if (existing && existing.id) {
        // Update existing record
        const { data, error } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .update(schoolData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          return { data: null, error };
        }

        return { data, error: null };
      } else {
        // Create new record
        const { data, error } = await supabase
          .from(TABLES.SCHOOL_DETAILS)
          .insert(schoolData)
          .select()
          .single();

        if (error) {
          return { data: null, error };
        }

        return { data, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  },
};

export default supabase; 
