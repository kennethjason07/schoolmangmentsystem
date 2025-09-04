import { supabase, TABLES } from './supabase';

/**
 * Find parent user accounts linked to a student
 * @param {string} studentId - The student ID
 * @returns {Array} Array of parent user objects with linking information
 */
export const findParentUsersForStudent = async (studentId) => {
  try {
    console.log('🔍 Finding parent users for student:', studentId);
    
    // Get all parent records for this student
    const { data: parentRecords, error: parentError } = await supabase
      .from(TABLES.PARENTS)
      .select('id, name, relation, phone, email, student_id')
      .eq('student_id', studentId);
    
    if (parentError) {
      console.error('Error fetching parent records:', parentError);
      return [];
    }
    
    if (!parentRecords || parentRecords.length === 0) {
      console.log('⚠️ No parent records found for student:', studentId);
      return [];
    }
    
    console.log(`📋 Found ${parentRecords.length} parent record(s) for student ${studentId}`);
    
    // Find users linked to these parents via linked_parent_of field
    const parentUserPromises = parentRecords.map(async (parentRecord) => {
      // Look for users where linked_parent_of matches the student_id
      const { data: linkedUsers, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, email, linked_parent_of')
        .eq('linked_parent_of', studentId);
      
      if (userError) {
        console.error(`Error finding linked users for parent ${parentRecord.name}:`, userError);
        return null;
      }
      
      if (!linkedUsers || linkedUsers.length === 0) {
        console.log(`⚠️ No user account found for parent ${parentRecord.name} (student: ${studentId})`);
        return null;
      }
      
      // Return the first linked user with parent info
      const linkedUser = linkedUsers[0];
      console.log(`✅ Found linked user ${linkedUser.email} for parent ${parentRecord.name}`);
      
      return {
        userId: linkedUser.id,
        userEmail: linkedUser.email,
        parentInfo: parentRecord,
        studentId: studentId
      };
    });
    
    const results = await Promise.all(parentUserPromises);
    const validParentUsers = results.filter(result => result !== null);
    
    console.log(`🎯 Found ${validParentUsers.length} parent user(s) with accounts for student ${studentId}`);
    return validParentUsers;
    
  } catch (error) {
    console.error('Error in findParentUsersForStudent:', error);
    return [];
  }
};

/**
 * Get context information for the attendance notification
 * @param {string} studentId - The student ID
 * @param {string} attendanceDate - The attendance date
 * @returns {Object} Context information for the notification
 */
export const getAttendanceNotificationContext = async (studentId, attendanceDate) => {
  try {
    console.log('🔍 Getting attendance notification context for student:', studentId, 'date:', attendanceDate);
    
    // Get student and class information
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        class_id,
        classes(
          id,
          class_name,
          section
        )
      `)
      .eq('id', studentId)
      .single();
    
    if (studentError || !studentData) {
      console.error('Error fetching student data:', studentError);
      return null;
    }
    
    // Format date for display
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    
    const context = {
      student: {
        name: studentData.name,
        id: studentData.id
      },
      class: {
        name: studentData.classes?.class_name || 'Unknown Class',
        section: studentData.classes?.section || 'Unknown Section',
        id: studentData.class_id
      },
      date: {
        raw: attendanceDate,
        formatted: formatDate(attendanceDate)
      }
    };
    
    console.log('📋 Attendance notification context:', context);
    return context;
    
  } catch (error) {
    console.error('Error getting attendance notification context:', error);
    return null;
  }
};

/**
 * Create a new attendance notification and insert notification recipients
 * @param {Object} params - Parameters for creating the attendance notification
 * @param {string} params.studentId - The student ID who was absent
 * @param {string} params.attendanceDate - The date of absence
 * @param {string} params.markedBy - The teacher/user ID who marked the attendance
 * @param {string} params.tenantId - The tenant ID for the notification
 * @returns {Object} Result object with success status and details
 */
export const createAttendanceNotification = async ({ studentId, attendanceDate, markedBy, tenantId }) => {
  try {
    console.log('🚀 Creating attendance notification for student:', studentId, 'on:', attendanceDate);
    
    // Get teacher info to get tenant_id
    const { data: teacherUser, error: teacherUserError } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id')
      .eq('id', markedBy)
      .single();
    
    if (teacherUserError || !teacherUser) {
      console.error('Error fetching teacher user data:', teacherUserError);
      return {
        success: false,
        error: 'Could not get teacher tenant information',
        recipientCount: 0
      };
    }
    
    // Find parent users for this student
    const parentUsers = await findParentUsersForStudent(studentId);
    
    if (parentUsers.length === 0) {
      console.log('⚠️ No parent users found for student, skipping notification');
      return {
        success: false,
        error: 'No parent users found for this student',
        recipientCount: 0
      };
    }
    
    // Get context for the notification
    const context = await getAttendanceNotificationContext(studentId, attendanceDate);
    
    if (!context) {
      console.log('⚠️ Could not get notification context, skipping notification');
      return {
        success: false,
        error: 'Could not get notification context',
        recipientCount: 0
      };
    }
    
    // Create notification message
    const message = `Your child ${context.student.name} from ${context.class.name} - ${context.class.section} was marked absent on ${context.date.formatted}.`;
    
    // Create the main notification record
    const { data: notificationData, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert([{
        type: 'Absentee', // Using correct enum value for attendance notifications
        message: message,
        delivery_mode: 'InApp',
        delivery_status: 'Sent',
        sent_by: markedBy,
        sent_at: new Date().toISOString(),
        tenant_id: tenantId // Include tenant_id to satisfy NOT NULL constraint
      }])
      .select()
      .single();
    
    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      return {
        success: false,
        error: notificationError.message,
        recipientCount: 0
      };
    }
    
    console.log('✅ Created notification:', notificationData.id);
    
    // Deduplicate parent users by userId to avoid duplicate constraint violations
    console.log('🔍 [NOTIFICATION] Creating recipients for new notification...');
    
    const uniqueParentUsers = parentUsers.filter((parentUser, index, array) => 
      array.findIndex(p => p.userId === parentUser.userId) === index
    );
    
    if (uniqueParentUsers.length !== parentUsers.length) {
      console.log(`⚠️ [NOTIFICATION] Removed ${parentUsers.length - uniqueParentUsers.length} duplicate parent users`);
    }
    
    // Create notification recipients for unique parent users
    const recipientRecords = uniqueParentUsers.map(parentUser => ({
      notification_id: notificationData.id,
      recipient_id: parentUser.userId,
      recipient_type: 'Parent',
      delivery_status: 'Sent',
      is_read: false,
      sent_at: new Date().toISOString(),
      tenant_id: tenantId // Include tenant_id for notification recipients
    }));
    
    console.log(`📝 [NOTIFICATION] Creating ${recipientRecords.length} recipient records`);
    
    // Use simple INSERT since we've deduplicated and this is a new notification
    const { data: recipientData, error: recipientError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipientRecords)
      .select();
    
    if (recipientError) {
      console.error('Error creating notification recipients:', recipientError);
      return {
        success: false,
        error: recipientError.message,
        recipientCount: 0
      };
    }
    
    console.log(`✅ Created ${recipientData.length} notification recipients`);
    
    return {
      success: true,
      notificationId: notificationData.id,
      recipientCount: recipientData.length,
      parentUsers: parentUsers.map(pu => ({
        email: pu.userEmail,
        parentName: pu.parentInfo.name,
        relation: pu.parentInfo.relation
      }))
    };
    
  } catch (error) {
    console.error('Error creating attendance notification:', error);
    return {
      success: false,
      error: error.message,
      recipientCount: 0
    };
  }
};

/**
 * Create attendance notifications for multiple absent students
 * @param {Array} absentStudents - Array of absent student records
 * @param {string} markedBy - The teacher/user ID who marked the attendance
 * @param {string} tenantId - The tenant ID for the notifications
 * @returns {Object} Result object with success status and summary
 */
export const createBulkAttendanceNotifications = async (absentStudents, markedBy, tenantId = null) => {
  try {
    console.log(`🚀 Creating bulk attendance notifications for ${absentStudents.length} absent students`);
    
    // Get tenant_id if not provided
    if (!tenantId) {
      // Try to get tenant_id from the first student's record or current user
      try {
        const { data: userData, error: userError } = await supabase
          .from(TABLES.USERS)
          .select('tenant_id')
          .eq('id', markedBy)
          .single();
        
        if (!userError && userData?.tenant_id) {
          tenantId = userData.tenant_id;
          console.log(`📋 Using tenant_id from user: ${tenantId}`);
        } else {
          console.warn('⚠️ Could not get tenant_id from user, notifications may fail');
        }
      } catch (error) {
        console.warn('⚠️ Error getting tenant_id:', error.message);
      }
    }
    
    const results = await Promise.all(
      absentStudents.map(async (student) => {
        try {
          const result = await createAttendanceNotification({
            studentId: student.student_id,
            attendanceDate: student.date,
            markedBy: markedBy,
            tenantId: tenantId
          });
          
          return {
            studentId: student.student_id,
            success: result.success,
            recipientCount: result.recipientCount,
            error: result.error
          };
        } catch (error) {
          console.error(`Error creating notification for student ${student.student_id}:`, error);
          return {
            studentId: student.student_id,
            success: false,
            recipientCount: 0,
            error: error.message
          };
        }
      })
    );
    
    const successCount = results.filter(r => r.success).length;
    const totalRecipients = results.reduce((sum, r) => sum + r.recipientCount, 0);
    
    console.log(`✅ Bulk attendance notifications completed: ${successCount}/${absentStudents.length} successful, ${totalRecipients} total recipients`);
    
    return {
      success: successCount > 0,
      totalStudents: absentStudents.length,
      successfulNotifications: successCount,
      totalRecipients: totalRecipients,
      results: results
    };
    
  } catch (error) {
    console.error('Error in bulk attendance notifications:', error);
    return {
      success: false,
      error: error.message,
      totalStudents: absentStudents.length,
      successfulNotifications: 0,
      totalRecipients: 0
    };
  }
};

/**
 * Helper function to check if attendance notifications are enabled for a student
 * This can be expanded later to include user preferences
 * @param {string} studentId - The student ID
 * @returns {boolean} Whether notifications should be sent
 */
export const shouldSendAttendanceNotification = async (studentId) => {
  // For now, always send notifications
  // Later this can check parent preferences, school policies, etc.
  return true;
};
