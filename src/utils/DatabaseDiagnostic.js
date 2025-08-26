import { supabase, TABLES } from './supabase';

export const DatabaseDiagnostic = {
  // Check what tables exist and their structure
  checkTableStructure: async () => {
    try {
      console.log('🔍 DIAGNOSTIC: Checking database structure...');
      
      // Check Users table
      const { data: users, error: usersError } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .limit(3);
      
      if (users && users.length > 0) {
        console.log('👤 USERS table structure:');
        console.log('Fields available:', Object.keys(users[0]));
        users.forEach((user, index) => {
          console.log(`User ${index + 1}:`, user);
        });
      } else {
        console.log('❌ No users found or error:', usersError);
      }

      // Check Students table
      const { data: students, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('*')
        .limit(3);
      
      if (students && students.length > 0) {
        console.log('🎓 STUDENTS table structure:');
        console.log('Fields available:', Object.keys(students[0]));
        students.forEach((student, index) => {
          console.log(`Student ${index + 1}:`, student);
        });
      } else {
        console.log('❌ No students found or error:', studentsError);
      }

      // Check Teachers table
      const { data: teachers, error: teachersError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .limit(3);
      
      if (teachers && teachers.length > 0) {
        console.log('👨‍🏫 TEACHERS table structure:');
        console.log('Fields available:', Object.keys(teachers[0]));
        teachers.forEach((teacher, index) => {
          console.log(`Teacher ${index + 1}:`, teacher);
        });
      } else {
        console.log('❌ No teachers found or error:', teachersError);
      }

      // Check Classes table
      const { data: classes, error: classesError } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .limit(3);
      
      if (classes && classes.length > 0) {
        console.log('🏫 CLASSES table structure:');
        console.log('Fields available:', Object.keys(classes[0]));
        classes.forEach((cls, index) => {
          console.log(`Class ${index + 1}:`, cls);
        });
      } else {
        console.log('❌ No classes found or error:', classesError);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      return { success: false, error: error.message };
    }
  },

  // Check specific relationships for Bheem Rao Patil
  checkBheemRaoPatilData: async () => {
    try {
      console.log('🔍 DIAGNOSTIC: Checking Bheem Rao Patil specific data...');
      
      // Find Bheem Rao Patil in users
      const { data: bheemUser, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .ilike('email', '%bheem%')
        .or('full_name.ilike.%bheem%,name.ilike.%bheem%');
      
      console.log('👤 Bheem Rao Patil user records:', bheemUser?.length || 0);
      if (bheemUser) {
        bheemUser.forEach(user => {
          console.log('User:', user);
        });
      }

      // Find Bheem Rao Patil in teachers
      const { data: bheemTeacher, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .ilike('name', '%bheem%');
      
      console.log('👨‍🏫 Bheem Rao Patil teacher records:', bheemTeacher?.length || 0);
      if (bheemTeacher) {
        bheemTeacher.forEach(teacher => {
          console.log('Teacher:', teacher);
        });
      }

      // Check for Class 3 A
      const { data: class3A, error: classError } = await supabase
        .from(TABLES.CLASSES)
        .select('*')
        .eq('class_name', '3')
        .eq('section', 'A');
      
      console.log('🏫 Class 3 A records:', class3A?.length || 0);
      if (class3A) {
        class3A.forEach(cls => {
          console.log('Class 3 A:', cls);
        });
      }

      // Check students in Class 3 A
      if (class3A && class3A.length > 0) {
        const classId = class3A[0].id;
        const { data: class3AStudents, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select('*')
          .eq('class_id', classId);
        
        console.log(`🎓 Students in Class 3 A (ID: ${classId}):`, class3AStudents?.length || 0);
        if (class3AStudents) {
          class3AStudents.forEach(student => {
            console.log('Student:', student);
          });
        }

        // Check parents for these students
        if (class3AStudents && class3AStudents.length > 0) {
          const studentIds = class3AStudents.map(s => s.id);
          console.log('🔍 Looking for parents with student IDs:', studentIds);

          // Try different field names for parent linking
          const parentFieldNames = ['linked_student_id', 'linked_parent_of', 'student_id', 'child_id'];
          
          for (const fieldName of parentFieldNames) {
            try {
              const { data: parents, error: parentError } = await supabase
                .from(TABLES.USERS)
                .select('*')
                .in(fieldName, studentIds);
              
              console.log(`👨‍👩‍👧‍👦 Parents found using '${fieldName}' field:`, parents?.length || 0);
              if (parents && parents.length > 0) {
                parents.forEach(parent => {
                  console.log(`Parent (${fieldName}):`, parent);
                });
              }
            } catch (err) {
              console.log(`❌ Field '${fieldName}' doesn't exist in users table`);
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Bheem diagnostic error:', error);
      return { success: false, error: error.message };
    }
  },

  // Test the current ViewStudentInfo query
  testCurrentQuery: async (userId) => {
    try {
      console.log('🔍 DIAGNOSTIC: Testing current ViewStudentInfo query...');
      console.log('User ID:', userId);

      // Simulate the exact query from ViewStudentInfo
      const { data: user, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.log('❌ User not found:', userError);
        return { success: false };
      }

      console.log('👤 Current user:', user);

      // Check if user has linked_teacher_id
      console.log('🔍 Checking teacher linking...');
      const teacherId = user.linked_teacher_id;
      console.log('Teacher ID from user:', teacherId);

      if (!teacherId) {
        console.log('❌ No teacher ID found in user record');
        return { success: false };
      }

      // Get teacher record
      const { data: teacherData, error: teacherError } = await supabase
        .from(TABLES.TEACHERS)
        .select('*')
        .eq('id', teacherId)
        .single();

      console.log('👨‍🏫 Teacher data:', teacherData);
      console.log('Teacher error:', teacherError);

      return { success: true, user, teacher: teacherData };
    } catch (error) {
      console.error('❌ Query test error:', error);
      return { success: false, error: error.message };
    }
  }
};
