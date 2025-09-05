import { supabase, TABLES, getUserTenantId } from '../utils/supabase';
import universalNotificationService from './UniversalNotificationService';

/**
 * Automated Notification Service
 * Handles sending automated notifications for various events
 */

/**
 * Get parent user ID from database using improved parent-student relationships
 * This function queries the actual database with multiple fallback methods
 */
const getParentUserIdForStudent = async (studentId) => {
  try {
    console.log(`🔍 [IMPROVED LOOKUP] Finding parent for student: ${studentId}`);

    // Method 1: Try to find parent through users.linked_parent_of (most direct)
    const { data: linkedParentUser, error: linkedError } = await supabase
      .from(TABLES.USERS)
      .select('id, full_name, email, role_id')
      .eq('linked_parent_of', studentId)
      .eq('role_id', 3) // Assuming role_id 3 is parent
      .maybeSingle();

    if (!linkedError && linkedParentUser) {
      console.log(`✅ [IMPROVED LOOKUP] Method 1 - Found parent via linked_parent_of:`, linkedParentUser);
      return {
        success: true,
        parentUserId: linkedParentUser.id,
        parentName: linkedParentUser.full_name,
        parentEmail: linkedParentUser.email,
        method: 'linked_parent_of'
      };
    }

    // Method 2: Try to find parent through parents table -> users table
    const { data: parentRecords, error: parentsError } = await supabase
      .from(TABLES.PARENTS)
      .select('id, name, email, relation, student_id')
      .eq('student_id', studentId);

    if (!parentsError && parentRecords && parentRecords.length > 0) {
      console.log(`✅ [IMPROVED LOOKUP] Method 2 - Found ${parentRecords.length} parent records:`, parentRecords);
      
      // Try to find a user account for any of these parent records
      for (const parentRecord of parentRecords) {
        if (parentRecord.email) {
          const { data: parentUser, error: userError } = await supabase
            .from(TABLES.USERS)
            .select('id, full_name, email, role_id')
            .eq('email', parentRecord.email)
            .eq('role_id', 3)
            .maybeSingle();

          if (!userError && parentUser) {
            console.log(`✅ [IMPROVED LOOKUP] Method 2 - Found matching user account:`, parentUser);
            return {
              success: true,
              parentUserId: parentUser.id,
              parentName: parentUser.full_name || parentRecord.name,
              parentEmail: parentUser.email,
              method: 'parents_table'
            };
          }
        }
      }
    }

    // Method 3: Try to find parent through students.parent_id -> parents -> users
    const { data: studentData, error: studentError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        parent_id
      `)
      .eq('id', studentId)
      .single();

    if (!studentError && studentData && studentData.parent_id) {
      console.log(`✅ [IMPROVED LOOKUP] Method 3 - Found student with parent_id:`, studentData.parent_id);
      
      // Get the parent record
      const { data: parentRecord, error: parentRecordError } = await supabase
        .from(TABLES.PARENTS)
        .select('id, name, email, relation')
        .eq('id', studentData.parent_id)
        .single();
      
      if (!parentRecordError && parentRecord && parentRecord.email) {
        // Find user account for this parent
        const { data: parentUser, error: userError } = await supabase
          .from(TABLES.USERS)
          .select('id, full_name, email, role_id')
          .eq('email', parentRecord.email)
          .eq('role_id', 3)
          .maybeSingle();

        if (!userError && parentUser) {
          console.log(`✅ [IMPROVED LOOKUP] Method 3 - Found parent user via parent_id:`, parentUser);
          return {
            success: true,
            parentUserId: parentUser.id,
            parentName: parentUser.full_name || parentRecord.name,
            parentEmail: parentUser.email,
            method: 'parent_id_chain'
          };
        }
      }
    }

    // Method 4: Try parent_student_relationships table (if it exists)
    try {
      const { data: parentRelationship, error: relationshipError } = await supabase
        .from('parent_student_relationships')
        .select(`
          parent_id,
          relationship_type,
          is_primary_contact,
          parents!inner(
            id,
            name,
            email
          )
        `)
        .eq('student_id', studentId)
        .order('is_primary_contact', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!relationshipError && parentRelationship) {
        console.log(`✅ [IMPROVED LOOKUP] Method 4 - Found parent via relationships table:`, parentRelationship);

        // Find the user account for this parent
        const { data: parentUser, error: userError } = await supabase
          .from(TABLES.USERS)
          .select('id, full_name, email, role_id')
          .eq('email', parentRelationship.parents.email)
          .eq('role_id', 3)
          .maybeSingle();

        if (!userError && parentUser) {
          console.log(`✅ [IMPROVED LOOKUP] Method 4 - Found parent user account:`, parentUser);
          return {
            success: true,
            parentUserId: parentUser.id,
            parentName: parentUser.full_name || parentRelationship.parents.name,
            parentEmail: parentUser.email,
            method: 'relationships_table'
          };
        }
      }
    } catch (relationshipTableError) {
      console.log('ℹ️ [IMPROVED LOOKUP] parent_student_relationships table not available');
    }

    console.log(`❌ [IMPROVED LOOKUP] No parent found for student ${studentId} after trying all methods`);
    return {
      success: false,
      error: 'No parent found for this student in database',
      details: 'Tried all available lookup methods: linked_parent_of, parents table, parent_id chain, and relationships table'
    };

  } catch (error) {
    console.error('❌ [IMPROVED LOOKUP] Error finding parent:', error);
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
    // Get tenant_id for the notification
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      console.error('❌ [SIMPLE NOTIFICATION] No tenant_id found for notification creation');
      return {
        success: false,
        error: 'Tenant information not found'
      };
    }
    
    // Format the date for display
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create notification with separate title and message
    const title = `${studentData.name} - Absent`;
    const message = `Your child was marked absent on ${formattedDate}. Please contact the school if this is incorrect.`;

    // Create notification record
    const notificationData = {
      type: 'Absentee',
      message: message,
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      scheduled_at: new Date().toISOString(),
      sent_by: markedBy,
      tenant_id: tenantId // Include tenant_id
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

    // Create notification recipient record with Pending status initially
    const recipientData = {
      notification_id: notificationResult.id,
      recipient_id: userId,
      recipient_type: 'Parent',
      delivery_status: 'Pending',
      sent_at: null,
      is_read: false,
      tenant_id: tenantId // Include tenant_id for notification recipients
    };

    const { error: recipientError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipientData);

    if (recipientError) {
      console.error('❌ [SIMPLE NOTIFICATION] Error creating notification recipient:', recipientError);
      return { success: false, error: 'Failed to create notification recipient' };
    }

    // Now deliver the notification (mark as Sent for InApp notifications)
    const deliveryResult = await deliverNotification(notificationResult.id, userId);
    
    if (deliveryResult.success) {
      console.log(`✅ [TARGETED NOTIFICATION] Notification delivered successfully to ${parentName} (${userId})`);
    } else {
      console.warn(`⚠️ [TARGETED NOTIFICATION] Notification created but delivery failed for ${parentName} (${userId}):`, deliveryResult.error);
    }
    
    // Broadcast real-time notification update for instant badge refresh
    try {
      console.log(`📡 [ABSENCE NOTIFICATION] Broadcasting real-time update to ${parentName} (${userId})`);
      await universalNotificationService.handleNewNotificationRecipient(
        userId,
        notificationResult.id,
        'parent'
      );
      console.log(`✅ [ABSENCE NOTIFICATION] Real-time broadcast sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [ABSENCE NOTIFICATION] Broadcasting failed (not critical):`, broadcastError);
    }

    return { 
      success: true, 
      message: `Notification sent to ${parentName}`,
      parentName: parentName,
      userId: userId,
      deliveryStatus: deliveryResult.success ? 'Sent' : 'Failed'
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
 * Create leave request notification for admins
 * @param {Object} leaveData - Leave application data
 * @param {Object} teacherData - Teacher profile data
 * @param {string} sent_by - User ID who sent the notification
 * @returns {Promise<Object>} Result with success status
 */
export const createLeaveRequestNotificationForAdmins = async (leaveData, teacherData, sent_by) => {
  try {
    console.log('📧 [LEAVE REQUEST] Creating notification for admins...');
    
    // Get tenant_id for the notification
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      console.error('❌ [LEAVE REQUEST] No tenant_id found for notification creation');
      return {
        success: false,
        error: 'Tenant information not found'
      };
    }
    console.log('📧 [LEAVE REQUEST] Using tenant_id:', tenantId);
    
    const notificationMessage = `[LEAVE_REQUEST] ${teacherData.teacher?.name || teacherData.full_name} has submitted a ${leaveData.leave_type} request from ${leaveData.start_date} to ${leaveData.end_date}. Reason: ${leaveData.reason}`;
    
    // Step 1: Create the main notification record
    const { data: notification, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert({
        message: notificationMessage,
        type: 'General',
        sent_by,
        delivery_mode: 'InApp',
        delivery_status: 'Sent',
        tenant_id: tenantId // Include tenant_id
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [LEAVE REQUEST] Error creating notification:', notificationError);
      throw notificationError;
    }

    console.log('✅ [LEAVE REQUEST] Notification created:', notification.id);

    // Step 2: Get all admin users (role_id = 1)
    const { data: adminUsers, error: adminError } = await supabase
      .from(TABLES.USERS)
      .select('id')
      .eq('role_id', 1);
    
    if (adminError) {
      console.error('❌ [LEAVE REQUEST] Error fetching admin users:', adminError);
      throw adminError;
    }

    console.log(`📧 [LEAVE REQUEST] Found ${adminUsers?.length || 0} admin users`);

    // Step 3: Create notification recipients for all admins
    if (adminUsers && adminUsers.length > 0) {
      // Use proper Admin recipient_type for admin notifications
      const adminRecipients = adminUsers.map(admin => ({
        notification_id: notification.id,
        recipient_id: admin.id,
        recipient_type: 'Admin', // Now using proper Admin recipient type
        delivery_status: 'Sent',
        sent_at: new Date().toISOString(),
        is_read: false,
        tenant_id: tenantId // Include tenant_id for notification recipients
      }));
      
      const { error: recipientsError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .insert(adminRecipients);
      
      if (recipientsError) {
        console.error('❌ [LEAVE REQUEST] Error creating admin notification recipients:', recipientsError);
        throw recipientsError;
      }

    console.log(`✅ [LEAVE REQUEST] Created notification recipients for ${adminUsers.length} admin users`);
    
    // Broadcast real-time notification updates to all admin users
    try {
      console.log(`📡 [LEAVE REQUEST] Broadcasting real-time updates to ${adminUsers.length} admin users...`);
      const adminUserIds = adminUsers.map(admin => admin.id);
      await universalNotificationService.broadcastNewNotificationToUsers(
        adminUserIds,
        notification.id,
        'General'
      );
      console.log(`✅ [LEAVE REQUEST] Real-time broadcasts sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [LEAVE REQUEST] Broadcasting failed (not critical):`, broadcastError);
    }
    }

    return {
      success: true,
      notification,
      recipientCount: adminUsers?.length || 0
    };

  } catch (error) {
    console.error('❌ [LEAVE REQUEST] Error in createLeaveRequestNotificationForAdmins:', error);
    return {
      success: false,
      error: error.message || 'Failed to create leave request notification'
    };
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

    // Get tenant_id for the notification
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      console.error('❌ [TEST] No tenant_id found for test notification creation');
      return {
        success: false,
        error: 'Tenant information not found'
      };
    }

    // Create notification record
    const notificationData = {
      type: 'General',
      message: message,
      delivery_mode: 'InApp',
      delivery_status: 'Sent',
      scheduled_at: new Date().toISOString(),
      sent_by: null,
      created_at: new Date().toISOString(),
      tenant_id: tenantId // Include tenant_id
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
      is_read: false,
      tenant_id: tenantId // Include tenant_id for notification recipients
    };

    const { error: recipientError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipientData);

    if (recipientError) {
      console.error('🧪 [TEST] Error creating test notification recipient:', recipientError);
      return { success: false, error: 'Failed to create test notification recipient' };
    }

    console.log(`🧪 [TEST] Test notification created successfully`);
    
    // Broadcast real-time notification update for test notification
    try {
      console.log(`📡 [TEST] Broadcasting real-time update to parent ${parentUserId}...`);
      await universalNotificationService.handleNewNotificationRecipient(
        parentUserId,
        notificationResult.id,
        'parent'
      );
      console.log(`✅ [TEST] Real-time broadcast sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [TEST] Broadcasting failed (not critical):`, broadcastError);
    }
    
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

/**
 * Deliver notification (mark as sent with timestamp)
 * For InApp notifications, this simulates immediate delivery
 * For other modes like SMS/Email, this would be called after actual delivery
 * @param {string} notificationId - Notification UUID
 * @param {string} userId - User UUID (optional, if not provided updates all recipients)
 */
export const deliverNotification = async (notificationId, userId = null) => {
  try {
    console.log(`📤 [DELIVERY] Marking notification ${notificationId} as delivered${userId ? ` for user ${userId}` : ' for all recipients'}`);
    
    const currentTimestamp = new Date().toISOString();
    
    // Update notification recipients
    let recipientQuery = supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .update({
        delivery_status: 'Sent',
        sent_at: currentTimestamp
      })
      .eq('notification_id', notificationId);
    
    // If specific user provided, only update for that user
    if (userId) {
      recipientQuery = recipientQuery.eq('recipient_id', userId);
    }
    
    const { error: recipientError } = await recipientQuery;
    
    if (recipientError) {
      console.error('❌ [DELIVERY] Error updating notification recipient:', recipientError);
      return { success: false, error: 'Failed to mark notification recipient as sent' };
    }
    
    // Update main notification record if all recipients are now sent
    const { data: pendingRecipients, error: checkError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select('delivery_status')
      .eq('notification_id', notificationId)
      .neq('delivery_status', 'Sent');
    
    if (!checkError && (!pendingRecipients || pendingRecipients.length === 0)) {
      // All recipients are now sent, update main notification
      await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({
          delivery_status: 'Sent',
          sent_at: currentTimestamp
        })
        .eq('id', notificationId);
      
      console.log(`✅ [DELIVERY] All recipients delivered, main notification marked as sent`);
    }
    
    console.log(`✅ [DELIVERY] Notification delivery successful`);
    return {
      success: true,
      message: 'Notification marked as delivered',
      deliveredAt: currentTimestamp
    };
    
  } catch (error) {
    console.error('❌ [DELIVERY] Error in deliverNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark notification as failed for specific recipient
 * @param {string} notificationId - Notification UUID
 * @param {string} userId - User UUID
 * @param {string} reason - Failure reason
 */
export const markNotificationAsFailed = async (notificationId, userId, reason = 'Delivery failed') => {
  try {
    console.log(`❌ [DELIVERY FAILED] Marking notification ${notificationId} as failed for user ${userId}: ${reason}`);
    
    const { error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .update({
        delivery_status: 'Failed',
        sent_at: new Date().toISOString()
      })
      .eq('notification_id', notificationId)
      .eq('recipient_id', userId);
    
    if (error) {
      console.error('❌ [DELIVERY FAILED] Error marking notification as failed:', error);
      return { success: false, error: 'Failed to mark notification as failed' };
    }
    
    console.log(`✅ [DELIVERY FAILED] Notification marked as failed successfully`);
    return {
      success: true,
      message: 'Notification marked as failed'
    };
    
  } catch (error) {
    console.error('❌ [DELIVERY FAILED] Error in markNotificationAsFailed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create leave status update notification for teacher
 * @param {Object} leaveData - Leave application data
 * @param {string} status - New status ('Approved' or 'Rejected')
 * @param {string} adminRemarks - Admin remarks
 * @param {string} sent_by - User ID who sent the notification (admin)
 * @returns {Promise<Object>} Result with success status
 */
export const createLeaveStatusNotificationForTeacher = async (leaveData, status, adminRemarks, sent_by) => {
  try {
    console.log(`📧 [LEAVE STATUS] Creating ${status} notification for teacher...`);
    
    // Get tenant_id for the notification
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      console.error('❌ [LEAVE STATUS] No tenant_id found for notification creation');
      return {
        success: false,
        error: 'Tenant information not found'
      };
    }
    console.log('📧 [LEAVE STATUS] Using tenant_id:', tenantId);
    
    // Find the user account for the teacher
    const { data: teacherUser, error: teacherError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('linked_teacher_id', leaveData.teacher_id)
      .single();

    if (teacherError || !teacherUser) {
      console.error('❌ [LEAVE STATUS] Error finding teacher user account:', teacherError);
      return {
        success: false,
        error: 'Teacher user account not found'
      };
    }

    const baseMessage = status === 'Approved' 
      ? `Your ${leaveData.leave_type} request has been approved.`
      : `Your ${leaveData.leave_type} request has been rejected.`;

    const fullMessage = adminRemarks?.trim() 
      ? `${baseMessage} Remarks: ${adminRemarks.trim()}`
      : baseMessage;
    
    // Step 1: Create the main notification record
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        message: fullMessage,
        type: 'General',
        sent_by,
        delivery_mode: 'InApp',
        delivery_status: 'Sent',
        tenant_id: tenantId // Include tenant_id
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [LEAVE STATUS] Error creating notification:', notificationError);
      throw notificationError;
    }

    console.log('✅ [LEAVE STATUS] Notification created:', notification.id);

    // Step 2: Create notification recipient for the teacher
    // Now using proper Teacher recipient_type
    const recipientData = {
      notification_id: notification.id,
      recipient_id: teacherUser.id,
      recipient_type: 'Teacher', // Now using proper Teacher recipient type
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
      is_read: false,
      tenant_id: tenantId // Include tenant_id for notification recipients
    };
      
    const { error: recipientError } = await supabase
      .from('notification_recipients')
      .insert(recipientData);
      
    if (recipientError) {
      console.error('❌ [LEAVE STATUS] Error creating teacher notification recipient:', recipientError);
      throw recipientError;
    }

    console.log(`✅ [LEAVE STATUS] Created notification recipient for teacher user ${teacherUser.id}`);
    
    // Broadcast real-time notification update to the teacher
    try {
      console.log(`📡 [LEAVE STATUS] Broadcasting real-time update to teacher ${teacherUser.id}...`);
      await universalNotificationService.handleNewNotificationRecipient(
        teacherUser.id,
        notification.id,
        'teacher'
      );
      console.log(`✅ [LEAVE STATUS] Real-time broadcast sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [LEAVE STATUS] Broadcasting failed (not critical):`, broadcastError);
    }

    return {
      success: true,
      notification,
      teacherUserId: teacherUser.id,
      teacherName: teacherUser.full_name
    };

  } catch (error) {
    console.error('❌ [LEAVE STATUS] Error in createLeaveStatusNotificationForTeacher:', error);
    return {
      success: false,
      error: error.message || 'Failed to create leave status notification'
    };
  }
};

export default {
  sendAbsenceNotificationToParent,
  sendAbsenceMessageOnly,
  sendBulkAbsenceNotifications,
  hasAbsenceNotificationBeenSent,
  createTestNotification,
  createLeaveRequestNotificationForAdmins,
  createLeaveStatusNotificationForTeacher,
  testParentLookupForStudent,
  getAllParentStudentRelationships,
  getParentUserIdForStudent
};
