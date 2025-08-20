import { supabase, TABLES } from '../utils/supabase';

/**
 * Automated Notification Service
 * Handles sending automated notifications for various events
 */

/**
 * Send absence notification to parent when student is marked absent
 * @param {string} studentId - The ID of the absent student
 * @param {string} date - The date of absence (YYYY-MM-DD format)
 * @param {string} markedBy - The ID of the teacher who marked attendance
 */
export const sendAbsenceNotificationToParent = async (studentId, date, markedBy) => {
  try {
    console.log(`📧 [NOTIFICATION DEBUG] Starting absence notification for student ${studentId} on ${date}`);

    // Get student details
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        admission_no,
        parent_id,
        classes (
          id,
          class_name,
          section
        )
      `)
      .eq('id', studentId)
      .single();

    console.log(`📧 [NOTIFICATION DEBUG] Student data:`, studentData);
    console.log(`📧 [NOTIFICATION DEBUG] Student error:`, studentError);

    if (studentError || !studentData) {
      console.error('❌ [NOTIFICATION DEBUG] Error fetching student data:', studentError);
      return { success: false, error: 'Student not found' };
    }

    // Get parent information using the current schema (parent_id in students table)
    let parentUser = null;
    let parentName = 'Parent';

    console.log(`📧 [NOTIFICATION DEBUG] Starting parent detection for student: ${studentData.name}`);
    console.log(`📧 [NOTIFICATION DEBUG] Student parent_id: ${studentData.parent_id}`);

    if (studentData.parent_id) {
      console.log(`📧 [NOTIFICATION DEBUG] Checking direct parent_id: ${studentData.parent_id}`);
      const { data: userData, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('id, full_name, email, role_id')
        .eq('id', studentData.parent_id)
        .single();

      console.log(`📧 [NOTIFICATION DEBUG] Parent user data:`, userData);
      console.log(`📧 [NOTIFICATION DEBUG] Parent user error:`, userError);

      if (!userError && userData) {
        parentUser = userData;
        parentName = userData.full_name || 'Parent';
        console.log(`📧 [NOTIFICATION DEBUG] Found parent via direct parent_id: ${parentName}`);
      }
    }

    // Check if we found a parent user account
    if (!parentUser) {
      console.log('⚠️ No parent user account found for student:', studentData.name);
      return { success: false, error: 'No parent user account found for student' };
    }

    // Format the date for display
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create notification title and message
    const title = 'Absent';
    const message = `Your ward ${studentData.name} (${studentData.admission_no}) was absent today (${formattedDate}). Please contact the school if this is incorrect.`;

    // Create notification record
    const notificationData = {
      type: 'Absentee',
      title: title,
      message: message,
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      scheduled_at: new Date().toISOString(),
      sent_by: markedBy,
      created_at: new Date().toISOString()
    };

    console.log(`📧 [NOTIFICATION DEBUG] Creating notification with data:`, notificationData);

    const { data: notificationResult, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert(notificationData)
      .select()
      .single();

    console.log(`📧 [NOTIFICATION DEBUG] Notification creation result:`, notificationResult);
    console.log(`📧 [NOTIFICATION DEBUG] Notification creation error:`, notificationError);

    if (notificationError) {
      console.error('❌ [NOTIFICATION DEBUG] Error creating notification:', notificationError);
      return { success: false, error: 'Failed to create notification' };
    }

    // Create notification recipient record
    const recipientData = {
      notification_id: notificationResult.id,
      recipient_id: parentUser.id,
      recipient_type: 'Parent',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
      is_read: false
    };

    console.log(`📧 [NOTIFICATION DEBUG] Creating recipient with data:`, recipientData);

    const { error: recipientError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipientData);

    console.log(`📧 [NOTIFICATION DEBUG] Recipient creation error:`, recipientError);

    if (recipientError) {
      console.error('❌ [NOTIFICATION DEBUG] Error creating notification recipient:', recipientError);
      return { success: false, error: 'Failed to create notification recipient' };
    }

    console.log(`✅ Absence notification sent successfully to parent: ${parentName}`);
    return {
      success: true,
      message: `Notification sent to ${parentName}`,
      notificationId: notificationResult.id
    };

  } catch (error) {
    console.error('❌ Error in sendAbsenceNotificationToParent:', error);
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
    // Get parent user ID from students table
    const { data: studentData } = await supabase
      .from(TABLES.STUDENTS)
      .select('parent_id')
      .eq('id', studentId)
      .single();

    if (!studentData?.parent_id) {
      return false;
    }

    const parentUserId = studentData.parent_id;

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

export default {
  sendAbsenceNotificationToParent,
  sendBulkAbsenceNotifications,
  hasAbsenceNotificationBeenSent,
  createTestNotification
};
