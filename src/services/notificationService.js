import { supabase, TABLES } from '../utils/supabase';

/**
 * Automated Notification Service
 * Handles sending automated notifications for various events
 */

/**
 * Get parent user ID from database using proper parent-student relationships
 * This function queries the actual database instead of using hardcoded mappings
 */
const getParentUserIdForStudent = async (studentId) => {
  try {
    console.log(`🔍 [DATABASE LOOKUP] Finding parent for student: ${studentId}`);

    // Method 1: Try to find parent through parent_student_relationships table
    const { data: parentRelationship, error: relationshipError } = await supabase
      .from('parent_student_relationships')
      .select(`
        parent_id,
        parents!inner(
          id,
          name,
          email
        )
      `)
      .eq('student_id', studentId)
      .eq('is_primary_contact', true)
      .single();

    if (!relationshipError && parentRelationship) {
      console.log(`✅ [DATABASE LOOKUP] Found parent via relationships table:`, parentRelationship);

      // Now find the user account for this parent
      const { data: parentUser, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, full_name, email')
        .eq('email', parentRelationship.parents.email)
        .eq('role_id', 3) // Assuming role_id 3 is parent
        .single();

      if (!userError && parentUser) {
        console.log(`✅ [DATABASE LOOKUP] Found parent user account:`, parentUser);
        return {
          success: true,
          parentUserId: parentUser.id,
          parentName: parentUser.full_name || parentRelationship.parents.name,
          parentEmail: parentUser.email
        };
      }
    }

    // Method 2: Try to find parent through students.parent_id (fallback)
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        parent_id,
        parents!inner(
          id,
          name,
          email
        )
      `)
      .eq('id', studentId)
      .single();

    if (!studentError && studentData && studentData.parent_id) {
      console.log(`✅ [DATABASE LOOKUP] Found parent via students.parent_id:`, studentData.parents);

      // Find the user account for this parent
      const { data: parentUser, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, full_name, email')
        .eq('email', studentData.parents.email)
        .eq('role_id', 3) // Assuming role_id 3 is parent
        .single();

      if (!userError && parentUser) {
        console.log(`✅ [DATABASE LOOKUP] Found parent user account via fallback:`, parentUser);
        return {
          success: true,
          parentUserId: parentUser.id,
          parentName: parentUser.full_name || studentData.parents.name,
          parentEmail: parentUser.email
        };
      }
    }

    // Method 3: Try to find parent through users.linked_parent_of (another fallback)
    const { data: linkedParentUser, error: linkedError } = await supabase
      .from(TABLES.USERS)
      .select('id, full_name, email')
      .eq('linked_parent_of', studentId)
      .eq('role_id', 3) // Assuming role_id 3 is parent
      .single();

    if (!linkedError && linkedParentUser) {
      console.log(`✅ [DATABASE LOOKUP] Found parent via linked_parent_of:`, linkedParentUser);
      return {
        success: true,
        parentUserId: linkedParentUser.id,
        parentName: linkedParentUser.full_name,
        parentEmail: linkedParentUser.email
      };
    }

    console.log(`❌ [DATABASE LOOKUP] No parent found for student ${studentId}`);
    return {
      success: false,
      error: 'No parent found for this student in database'
    };

  } catch (error) {
    console.error('❌ [DATABASE LOOKUP] Error finding parent:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Helper function to test parent lookup for a specific student
 * Call this to verify parent-student relationships in database
 */
export const testParentLookupForStudent = async (studentId) => {
  console.log(`🧪 [TEST] Testing parent lookup for student: ${studentId}`);
  const result = await getParentUserIdForStudent(studentId);
  console.log(`🧪 [TEST] Result:`, result);
  return result;
};

/**
 * Helper function to get all parent-student relationships from database
 */
export const getAllParentStudentRelationships = async () => {
  try {
    const { data: relationships, error } = await supabase
      .from('parent_student_relationships')
      .select(`
        id,
        student_id,
        parent_id,
        relationship_type,
        is_primary_contact,
        students(id, name, admission_no),
        parents(id, name, email)
      `);

    if (error) {
      console.error('❌ Error fetching relationships:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Found ${relationships?.length || 0} parent-student relationships`);
    return { success: true, relationships };
  } catch (error) {
    console.error('❌ Error in getAllParentStudentRelationships:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send absence notification AND message to the specific parent of the absent student
 * Uses simple mapping - NO DATABASE CHANGES REQUIRED
 */
export const sendAbsenceNotificationToParent = async (studentId, date, markedBy) => {
  try {
    console.log(`📧 [MAPPED NOTIFICATION] Creating absence notification and message for student ${studentId} on ${date}`);

    // Get student details
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select('id, name, admission_no')
      .eq('id', studentId)
      .single();

    console.log(`📧 [MAPPED NOTIFICATION] Student data:`, studentData);

    if (studentError || !studentData) {
      console.error('❌ [MAPPED NOTIFICATION] Error fetching student data:', studentError);
      return { success: false, error: 'Student not found' };
    }

    // Find parent using database lookup
    const parentLookupResult = await getParentUserIdForStudent(studentId);

    if (parentLookupResult.success) {
      console.log(`📧 [DATABASE NOTIFICATION] ✅ Found parent in database: ${parentLookupResult.parentName} (${parentLookupResult.parentUserId})`);

      // Get teacher/admin user ID for message sender
      let senderUserId = markedBy;
      if (!senderUserId) {
        // If no specific teacher, use a default system user or first teacher
        const { data: teacherUser } = await supabase
          .from(TABLES.USERS)
          .select('id')
          .eq('role_id', 2) // Assuming role_id 2 is teacher
          .limit(1)
          .single();
        senderUserId = teacherUser?.id;
      }

      // Send both notification and message
      const notificationResult = await createNotificationForSpecificUser(
        studentData,
        date,
        markedBy,
        parentLookupResult.parentUserId,
        parentLookupResult.parentName
      );

      const messageResult = await sendAbsenceMessageToParent(
        studentData,
        date,
        parentLookupResult.parentUserId,
        senderUserId
      );

      return {
        success: notificationResult.success && messageResult.success,
        message: `Notification and message sent to ${parentLookupResult.parentName}`,
        parentName: parentLookupResult.parentName,
        userId: parentLookupResult.parentUserId,
        notificationSent: notificationResult.success,
        messageSent: messageResult.success,
        details: {
          notification: notificationResult,
          message: messageResult
        }
      };
    } else {
      console.log(`⚠️ [DATABASE NOTIFICATION] No parent found in database for student ${studentData.name} (${studentId})`);
      console.log(`📧 [DATABASE NOTIFICATION] Error: ${parentLookupResult.error}`);
    }

    // Fallback: Don't send notification if no parent found in database
    return {
      success: false,
      error: `No parent found in database for student ${studentData.name}. Please ensure parent data is properly set up in the parents table and parent_student_relationships table.`
    };

  } catch (error) {
    console.error('❌ [MAPPED NOTIFICATION] Error in sendAbsenceNotificationToParent:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send absence message to specific parent
 */
const sendAbsenceMessageToParent = async (studentData, date, parentUserId, senderUserId) => {
  try {
    console.log(`💬 [ABSENCE MESSAGE] Sending absence message to parent ${parentUserId} for student ${studentData.name}`);

    // Format the date for display
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create absence message
    const messageText = `Dear Parent,\n\nThis is to inform you that your child ${studentData.name} (Admission No: ${studentData.admission_no}) was marked absent on ${formattedDate}.\n\nIf this is incorrect or if there are any concerns, please contact the school immediately.\n\nThank you,\nSchool Administration`;

    // Create message record
    const messageData = {
      sender_id: senderUserId,
      receiver_id: parentUserId,
      student_id: studentData.id,
      message: messageText,
      message_type: 'text',
      sent_at: new Date().toISOString()
    };

    console.log(`💬 [ABSENCE MESSAGE] Creating message record:`, messageData);

    const { data: messageResult, error: messageError } = await supabase
      .from(TABLES.MESSAGES)
      .insert(messageData)
      .select()
      .single();

    if (messageError) {
      console.error('❌ [ABSENCE MESSAGE] Error creating message:', messageError);
      return { success: false, error: 'Failed to create absence message' };
    }

    console.log(`✅ [ABSENCE MESSAGE] Message sent successfully to parent ${parentUserId}`);
    return {
      success: true,
      message: 'Absence message sent successfully',
      messageId: messageResult.id
    };

  } catch (error) {
    console.error('❌ [ABSENCE MESSAGE] Error in sendAbsenceMessageToParent:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create notification for a specific user
 */
const createNotificationForSpecificUser = async (studentData, date, markedBy, userId, parentName = 'Parent') => {
  try {
    // Format the date for display
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create notification message
    const message = `Absent: Student ${studentData.name} (${studentData.admission_no}) was marked absent on ${formattedDate}. Please contact the school if this is incorrect.`;

    // Create notification record
    const notificationData = {
      type: 'Absentee',
      message: message,
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      scheduled_at: new Date().toISOString(),
      sent_by: markedBy
    };

    console.log(`📧 [SIMPLE NOTIFICATION] Creating notification for user ${userId}`);

    const { data: notificationResult, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert(notificationData)
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [SIMPLE NOTIFICATION] Error creating notification:', notificationError);
      return { success: false, error: 'Failed to create notification' };
    }

    // Create notification recipient record
    const recipientData = {
      notification_id: notificationResult.id,
      recipient_id: userId,
      recipient_type: 'Parent',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
      is_read: false
    };

    const { error: recipientError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipientData);

    if (recipientError) {
      console.error('❌ [SIMPLE NOTIFICATION] Error creating notification recipient:', recipientError);
      return { success: false, error: 'Failed to create notification recipient' };
    }

    console.log(`✅ [TARGETED NOTIFICATION] Notification sent successfully to ${parentName} (${userId})`);
    return { 
      success: true, 
      message: `Notification sent to ${parentName}`,
      parentName: parentName,
      userId: userId
    };
  } catch (error) {
    console.error('❌ [SIMPLE NOTIFICATION] Error in createNotificationForSpecificUser:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send bulk absence notifications for multiple students
 * @param {Array} absentStudents - Array of {studentId, date, markedBy}
 */
export const sendBulkAbsenceNotifications = async (absentStudents) => {
  console.log(`📧 Sending bulk absence notifications for ${absentStudents.length} students`);
  
  const results = [];
  
  for (const { studentId, date, markedBy } of absentStudents) {
    const result = await sendAbsenceNotificationToParent(studentId, date, markedBy);
    results.push({
      studentId,
      ...result
    });
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`📊 Bulk notification results: ${successCount} sent, ${failureCount} failed`);
  
  return {
    total: absentStudents.length,
    success: successCount,
    failed: failureCount,
    results
  };
};

/**
 * Check if notification already sent for student on specific date
 * @param {string} studentId - Student ID
 * @param {string} date - Date in YYYY-MM-DD format
 */
export const hasAbsenceNotificationBeenSent = async (studentId, date) => {
  try {
    // Get parent user ID using new schema
    // Find user where linked_parent_of = studentId
    const { data: parentUser } = await supabase
      .from(TABLES.USERS)
      .select('id')
      .eq('linked_parent_of', studentId)
      .single();

    if (!parentUser?.id) {
      return false;
    }

    const parentUserId = parentUser.id;

    // Check if notification exists for this date
    const { data: existingNotification, error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        notifications!inner (
          id,
          type,
          message,
          created_at
        )
      `)
      .eq('recipient_id', parentUserId)
      .eq('recipient_type', 'Parent')
      .eq('notifications.type', 'Absentee')
      .gte('notifications.created_at', `${date}T00:00:00`)
      .lt('notifications.created_at', `${date}T23:59:59`)
      .limit(1);

    return !error && existingNotification && existingNotification.length > 0;
  } catch (error) {
    console.error('Error checking existing notification:', error);
    return false;
  }
};

/**
 * Test function to create a simple notification for debugging
 * @param {string} parentUserId - The parent user ID
 * @param {string} message - Test message
 */
export const createTestNotification = async (parentUserId, message = 'Test notification') => {
  try {
    console.log(`🧪 [TEST] Creating test notification for parent: ${parentUserId}`);

    // Create notification record
    const notificationData = {
      type: 'General',
      message: message,
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      scheduled_at: new Date().toISOString(),
      sent_by: null,
      created_at: new Date().toISOString()
    };

    const { data: notificationResult, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert(notificationData)
      .select()
      .single();

    if (notificationError) {
      console.error('🧪 [TEST] Error creating test notification:', notificationError);
      return { success: false, error: 'Failed to create test notification' };
    }

    // Create notification recipient record
    const recipientData = {
      notification_id: notificationResult.id,
      recipient_id: parentUserId,
      recipient_type: 'Parent',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
      is_read: false
    };

    const { error: recipientError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipientData);

    if (recipientError) {
      console.error('🧪 [TEST] Error creating test notification recipient:', recipientError);
      return { success: false, error: 'Failed to create test notification recipient' };
    }

    console.log(`🧪 [TEST] Test notification created successfully`);
    return {
      success: true,
      message: 'Test notification created',
      notificationId: notificationResult.id
    };

  } catch (error) {
    console.error('🧪 [TEST] Error in createTestNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send only absence message to parent (without notification)
 * @param {string} studentId - Student ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} markedBy - User ID who marked the attendance
 */
export const sendAbsenceMessageOnly = async (studentId, date, markedBy) => {
  try {
    console.log(`💬 [MESSAGE ONLY] Sending absence message for student ${studentId} on ${date}`);

    // Get student details
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select('id, name, admission_no')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      console.error('❌ [MESSAGE ONLY] Error fetching student data:', studentError);
      return { success: false, error: 'Student not found' };
    }

    // Find parent using database lookup
    const parentLookupResult = await getParentUserIdForStudent(studentId);

    if (parentLookupResult.success) {
      console.log(`💬 [MESSAGE ONLY] ✅ Found parent in database: ${parentLookupResult.parentName} (${parentLookupResult.parentUserId})`);

      // Get teacher/admin user ID for message sender
      let senderUserId = markedBy;
      if (!senderUserId) {
        // If no specific teacher, use a default system user or first teacher
        const { data: teacherUser } = await supabase
          .from(TABLES.USERS)
          .select('id')
          .eq('role_id', 2) // Assuming role_id 2 is teacher
          .limit(1)
          .single();
        senderUserId = teacherUser?.id;
      }

      // Send only message
      const messageResult = await sendAbsenceMessageToParent(
        studentData,
        date,
        parentLookupResult.parentUserId,
        senderUserId
      );

      return {
        success: messageResult.success,
        message: messageResult.success ? `Message sent to ${parentLookupResult.parentName}` : messageResult.error,
        details: messageResult
      };
    } else {
      console.log(`⚠️ [MESSAGE ONLY] No parent found in database for student ${studentData.name} (${studentId})`);
      return {
        success: false,
        error: `No parent found in database for student ${studentData.name}. Please ensure parent data is properly set up.`
      };
    }

  } catch (error) {
    console.error('❌ [MESSAGE ONLY] Error in sendAbsenceMessageOnly:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendAbsenceNotificationToParent,
  sendAbsenceMessageOnly,
  sendBulkAbsenceNotifications,
  hasAbsenceNotificationBeenSent,
  createTestNotification,
  testParentLookupForStudent,
  getAllParentStudentRelationships,
  getParentUserIdForStudent
};
