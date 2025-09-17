/**
 * Parent Authentication Helper
 * 
 * This module provides helper functions for parent authentication and data access
 * that work independently of tenant filtering. Parents access their children's data
 * through direct parent-student relationships stored in the database.
 */

import { supabase, TABLES } from './supabase';

/**
 * Get parent's student data using direct parent-student relationships
 * @param {string} parentUserId - The authenticated parent user's ID
 * @returns {Object} Result object with success status and student data
 */
export const getParentStudents = async (parentUserId) => {
  try {
    console.log('🔍 [PARENT AUTH] Fetching students for parent user ID:', parentUserId);

    // Method 1: Check if user has linked_parent_of (new structure)
    const { data: userData, error: userError } = await supabase
      .from(TABLES.USERS)
      .select(`
        id,
        email,
        full_name,
        linked_parent_of,
        students!users_linked_parent_of_fkey(
          id,
          name,
          admission_no,
          class_id,
          academic_year,
          classes(id, class_name, section)
        )
      `)
      .eq('id', parentUserId)
      .single();

    if (userError) {
      console.error('❌ [PARENT AUTH] Error fetching user data:', userError);
      return { success: false, error: userError.message };
    }

    let students = [];

    // If linked_parent_of exists, use the direct relationship
    if (userData.linked_parent_of && userData.students) {
      console.log('✅ [PARENT AUTH] Found linked student via users.linked_parent_of');
      students = [userData.students];
    }

    // Method 2: Use parent_student_relationships junction table
    if (students.length === 0) {
      console.log('🔍 [PARENT AUTH] Checking parent_student_relationships table...');
      
      const { data: relationshipData, error: relationshipError } = await supabase
        .from('parent_student_relationships')
        .select(`
          student_id,
          relationship_type,
          is_primary_contact,
          students!parent_student_relationships_student_id_fkey(
            id,
            name,
            admission_no,
            class_id,
            academic_year,
            classes(id, class_name, section)
          ),
          parents!parent_student_relationships_parent_id_fkey(
            id,
            user_id
          )
        `)
        .eq('parents.user_id', parentUserId);

      if (!relationshipError && relationshipData && relationshipData.length > 0) {
        console.log('✅ [PARENT AUTH] Found students via parent_student_relationships');
        students = relationshipData
          .filter(rel => rel.students) // Only include valid student records
          .map(rel => rel.students);
      }
    }

    // Method 3: Direct parent table lookup (fallback)
    if (students.length === 0) {
      console.log('🔍 [PARENT AUTH] Checking direct parents table...');
      
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select(`
          id,
          student_id,
          user_id,
          students!parents_student_id_fkey(
            id,
            name,
            admission_no,
            class_id,
            academic_year,
            classes(id, class_name, section)
          )
        `)
        .eq('user_id', parentUserId);

      if (!parentError && parentData && parentData.length > 0) {
        console.log('✅ [PARENT AUTH] Found students via parents table');
        students = parentData
          .filter(parent => parent.students) // Only include valid student records
          .map(parent => parent.students);
      }
    }

    if (students.length === 0) {
      console.warn('⚠️ [PARENT AUTH] No students found for parent user:', parentUserId);
      return {
        success: false,
        error: 'No students found for this parent account. Please contact the school administrator.'
      };
    }

    // Remove duplicates and format student data
    const uniqueStudents = students.filter((student, index, self) => 
      self.findIndex(s => s.id === student.id) === index
    );

    const formattedStudents = [];

    for (const student of uniqueStudents) {
      // Get student's profile photo from users table
      const { data: studentUserData, error: studentUserError } = await supabase
        .from(TABLES.USERS)
        .select('profile_url')
        .eq('linked_student_id', student.id)
        .maybeSingle();

      formattedStudents.push({
        id: student.id,
        name: student.name,
        admission_no: student.admission_no,
        class_id: student.class_id,
        academic_year: student.academic_year,
        profile_url: studentUserData?.profile_url || null,
        class_name: student.classes?.class_name,
        section: student.classes?.section,
        full_class_name: student.classes ? 
          `${student.classes.class_name} ${student.classes.section}` : 
          'Unknown Class'
      });
    }

    console.log('🎉 [PARENT AUTH] Successfully found students:', formattedStudents.length);
    
    return {
      success: true,
      students: formattedStudents,
      primaryStudent: formattedStudents[0] // First student as primary
    };

  } catch (error) {
    console.error('💥 [PARENT AUTH] Unexpected error:', error);
    return {
      success: false,
      error: `Failed to fetch student data: ${error.message}`
    };
  }
};

/**
 * Get student data by ID for a parent (with access validation)
 * @param {string} parentUserId - The authenticated parent user's ID
 * @param {string} studentId - The student ID to fetch
 * @returns {Object} Result object with success status and student data
 */
export const getStudentForParent = async (parentUserId, studentId) => {
  try {
    console.log('🔍 [PARENT AUTH] Fetching specific student:', studentId, 'for parent:', parentUserId);

    // First verify that the parent has access to this student
    const parentStudentsResult = await getParentStudents(parentUserId);
    
    if (!parentStudentsResult.success) {
      return parentStudentsResult;
    }

    // Check if the requested student is in the parent's accessible students
    const accessibleStudent = parentStudentsResult.students.find(s => s.id === studentId);
    
    if (!accessibleStudent) {
      console.error('❌ [PARENT AUTH] Parent does not have access to student:', studentId);
      return {
        success: false,
        error: 'Access denied: You do not have permission to view this student\'s data.'
      };
    }

    // Fetch full student details
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        *,
        classes(id, class_name, section, academic_year)
      `)
      .eq('id', studentId)
      .single();

    if (studentError) {
      console.error('❌ [PARENT AUTH] Error fetching student details:', studentError);
      return {
        success: false,
        error: `Failed to fetch student details: ${studentError.message}`
      };
    }

    // Get student's profile photo from users table
    const { data: studentUserData, error: studentUserError } = await supabase
      .from(TABLES.USERS)
      .select('profile_url')
      .eq('linked_student_id', studentId)
      .maybeSingle();

    console.log('✅ [PARENT AUTH] Successfully fetched student details for:', studentData.name);

    return {
      success: true,
      student: {
        ...studentData,
        profile_url: studentUserData?.profile_url || null,
        class_name: studentData.classes?.class_name,
        section: studentData.classes?.section,
        full_class_name: studentData.classes ? 
          `${studentData.classes.class_name} ${studentData.classes.section}` : 
          'Unknown Class'
      }
    };

  } catch (error) {
    console.error('💥 [PARENT AUTH] Unexpected error:', error);
    return {
      success: false,
      error: `Failed to fetch student data: ${error.message}`
    };
  }
};

/**
 * Fetch student notifications for parent without tenant filtering
 * @param {string} parentUserId - The authenticated parent user's ID
 * @param {string} studentId - The student ID to fetch notifications for
 * @returns {Object} Result object with success status and notifications
 */
export const getStudentNotificationsForParent = async (parentUserId, studentId) => {
  try {
    console.log('📬 [PARENT AUTH] Fetching notifications for student:', studentId);

    // Verify parent access to student first
    const accessCheck = await getStudentForParent(parentUserId, studentId);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Fetch notifications for the student
    const { data: notificationsData, error: notificationsError } = await supabase
      .from('notification_recipients')
      .select(`
        id,
        is_read,
        created_at,
        notifications (
          id,
          message,
          type,
          created_at,
          sent_by,
          users!sent_by (
            full_name
          )
        )
      `)
      .eq('recipient_id', studentId)
      .eq('recipient_type', 'Student')
      .order('created_at', { ascending: false })
      .limit(20);

    if (notificationsError) {
      console.error('❌ [PARENT AUTH] Error fetching notifications:', notificationsError);
      return {
        success: false,
        error: `Failed to fetch notifications: ${notificationsError.message}`
      };
    }

    // Transform the data to match expected format
    // Note: notifications table doesn't have a title column, using type as title
    const formattedNotifications = (notificationsData || []).map(item => ({
      id: item.notifications.id,
      title: item.notifications.type || 'Notification',
      message: item.notifications.message,
      type: item.notifications.type,
      created_at: item.notifications.created_at,
      sender_name: item.notifications.users?.full_name || 'System',
      read: item.is_read
    }));

    console.log('📬 [PARENT AUTH] Successfully fetched notifications:', formattedNotifications.length);

    return {
      success: true,
      notifications: formattedNotifications
    };

  } catch (error) {
    console.error('💥 [PARENT AUTH] Error fetching notifications:', error);
    return {
      success: false,
      error: `Failed to fetch notifications: ${error.message}`
    };
  }
};

/**
 * Fetch student attendance for parent without tenant filtering
 * @param {string} parentUserId - The authenticated parent user's ID
 * @param {string} studentId - The student ID to fetch attendance for
 * @returns {Object} Result object with success status and attendance data
 */
export const getStudentAttendanceForParent = async (parentUserId, studentId) => {
  try {
    console.log('📊 [PARENT AUTH] Fetching attendance for student:', studentId);

    // Verify parent access to student first
    const accessCheck = await getStudentForParent(parentUserId, studentId);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Try multiple table names for attendance
    const tableNames = [TABLES.STUDENT_ATTENDANCE, 'student_attendance', 'attendance'];
    let attendanceData = null;
    let attendanceError = null;

    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select(`
            id,
            student_id,
            class_id,
            date,
            status,
            marked_by,
            created_at
          `)
          .eq('student_id', studentId)
          .order('date', { ascending: false })
          .limit(100); // Get last 100 attendance records

        if (!error) {
          attendanceData = data;
          console.log('✅ [PARENT AUTH] Found attendance data via table:', tableName);
          break;
        } else {
          attendanceError = error;
        }
      } catch (err) {
        console.log('❌ [PARENT AUTH] Failed to query table:', tableName, err.message);
      }
    }

    if (!attendanceData && attendanceError) {
      console.error('❌ [PARENT AUTH] Error fetching attendance:', attendanceError);
      return {
        success: false,
        error: `Failed to fetch attendance: ${attendanceError.message}`
      };
    }

    console.log('📊 [PARENT AUTH] Successfully fetched attendance records:', attendanceData?.length || 0);

    return {
      success: true,
      attendance: attendanceData || []
    };

  } catch (error) {
    console.error('💥 [PARENT AUTH] Error fetching attendance:', error);
    return {
      success: false,
      error: `Failed to fetch attendance: ${error.message}`
    };
  }
};

/**
 * Check if a user is a parent (helper function)
 * @param {string} userId - The user ID to check
 * @returns {Object} Result object with success status and parent status
 */
export const isUserParent = async (userId) => {
  try {
    const studentsResult = await getParentStudents(userId);
    return {
      success: true,
      isParent: studentsResult.success && studentsResult.students.length > 0,
      studentCount: studentsResult.success ? studentsResult.students.length : 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
