import { supabase, TABLES } from './supabase';
import universalNotificationService from '../services/UniversalNotificationService';
import { sendPushNotification } from './pushNotificationUtils';

/**
 * Find student user account linked to a student
 * @param {string} studentId - The student ID
 * @param {string} tenantId - The tenant ID for filtering
 * @returns {Object|null} Student user object or null if not found
 */
export const findStudentUserForStudent = async (studentId, tenantId) => {
  try {
    console.log('🔍 Finding student user account for student:', studentId, 'tenant:', tenantId);
    
    // Look for users where linked_student_id matches the student ID and tenant matches
    const { data: studentUsers, error: studentError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, linked_student_id, tenant_id')
      .eq('linked_student_id', studentId)
      .eq('tenant_id', tenantId);
    
    if (studentError) {
      console.error('Error fetching student user:', studentError);
      return null;
    }
    
    if (!studentUsers || studentUsers.length === 0) {
      console.log('⚠️ No user account found for student:', studentId);
      return null;
    }
    
    const studentUser = studentUsers[0]; // Take the first matching user
    console.log(`✅ Found student user account: ${studentUser.email} for student: ${studentId}`);
    
    return {
      userId: studentUser.id,
      userEmail: studentUser.email,
      studentId: studentId
    };
    
  } catch (error) {
    console.error('Error in findStudentUserForStudent:', error);
    return null;
  }
};

/**
 * Find parent user accounts linked to a student
 * @param {string} studentId - The student ID
 * @param {string} tenantId - The tenant ID for filtering
 * @returns {Array} Array of parent user objects with linking information
 */
export const findParentUsersForStudent = async (studentId, tenantId = null) => {
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
      // Look for users where linked_parent_of matches the student_id and tenant matches
      let query = supabase
        .from(TABLES.USERS)
        .select('id, email, linked_parent_of, tenant_id')
        .eq('linked_parent_of', studentId);
      
      // Add tenant filtering if tenantId is provided
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data: linkedUsers, error: userError } = await query;
      
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
 * Get active push tokens for a user
 * @param {string} userId - The user ID
 * @param {string} tenantId - The tenant ID for filtering
 * @returns {Array} Array of active push tokens
 */
export const getActivePushTokensForUser = async (userId, tenantId) => {
  try {
    console.log('📱 Getting active push tokens for user:', userId, 'tenant:', tenantId);
    
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token, user_id, is_active, created_at')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching push tokens:', error);
      return [];
    }
    
    // Extract tokens manually to avoid SQL alias issues
    const validTokens = (tokens || [])
      .filter(t => t.token && typeof t.token === 'string' && t.token.trim() !== '')
      .map(t => t.token);
    
    console.log(`📱 Found ${validTokens.length} active push tokens for user ${userId}`);
    
    return validTokens;
  } catch (error) {
    console.error('Error in getActivePushTokensForUser:', error);
    return [];
  }
};

/**
 * Send push notifications to a user with multiple tokens
 * @param {Array} pushTokens - Array of push tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional notification data
 * @returns {Object} Results of push notification sending
 */
export const sendPushNotificationsToUser = async (pushTokens, title, body, data = {}) => {
  try {
    if (!pushTokens || pushTokens.length === 0) {
      console.log('⚠️ No push tokens provided for notification');
      return { successCount: 0, failureCount: 0 };
    }
    
    console.log(`📤 Sending push notifications to ${pushTokens.length} tokens`);
    
    const results = await Promise.all(
      pushTokens.map(async (token) => {
        try {
          const success = await sendPushNotification(token, title, body, data);
          return { success, token };
        } catch (error) {
          console.error('Error sending push notification to token:', token, error);
          return { success: false, token, error: error.message };
        }
      })
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`📤 Push notifications sent: ${successCount} successful, ${failureCount} failed`);
    
    return {
      successCount,
      failureCount,
      results
    };
    
  } catch (error) {
    console.error('Error in sendPushNotificationsToUser:', error);
    return { successCount: 0, failureCount: pushTokens?.length || 0 };
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
    
    // If tenantId is provided, skip teacher user lookup. Otherwise, try to derive from markedBy.
    const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    if (!tenantId) {
      if (!markedBy || !isUuid(markedBy)) {
        console.error('Error fetching teacher user data: invalid markedBy user id:', markedBy);
        return {
          success: false,
          error: 'Invalid user context for notification sender',
          recipientCount: 0
        };
      }

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
      tenantId = teacherUser.tenant_id;
    }
    
    // Find parent users for this student (with tenant filtering)
    const parentUsers = await findParentUsersForStudent(studentId, tenantId);
    
    // Find student user account for direct notifications
    const studentUser = await findStudentUserForStudent(studentId, tenantId);
    
    // Check if we have any users to notify (parent or student)
    if (parentUsers.length === 0 && !studentUser) {
      console.log('⚠️ No parent or student users found, skipping notification');
      return {
        success: false,
        error: 'No parent or student users found for this student',
        recipientCount: 0
      };
    }
    
    console.log(`📋 Found ${parentUsers.length} parent users and ${studentUser ? '1' : '0'} student user for notifications`);
    
    // Collect all users to notify (combine parents and student)
    const allUsersToNotify = [
      ...parentUsers.map(pu => ({ ...pu, userType: 'parent' })),
      ...(studentUser ? [{ ...studentUser, userType: 'student' }] : [])
    ];
    
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
    
    // Create notification messages for different user types
    const parentMessage = `Your child ${context.student.name} from ${context.class.name} - ${context.class.section} was marked absent on ${context.date.formatted}.`;
    const studentMessage = `You were marked absent from ${context.class.name} - ${context.class.section} on ${context.date.formatted}.`;
    
    // Push notification titles and bodies
    const parentPushTitle = '🚨 Student Absence Alert';
    const parentPushBody = `${context.student.name} was absent from ${context.class.name} today`;
    
    const studentPushTitle = '📋 Attendance Update';
    const studentPushBody = `You were marked absent from ${context.class.name} today`;
    
    // Create the main notification record (using parent message as default)
    const { data: notificationData, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert([{
        type: 'Absentee', // Using correct enum value for attendance notifications
        message: parentMessage,
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
    
    // Deduplicate all users by userId to avoid duplicate constraint violations
    console.log('🔍 [NOTIFICATION] Creating recipients for new notification...');
    
    const uniqueUsers = allUsersToNotify.filter((user, index, array) => 
      array.findIndex(u => u.userId === user.userId) === index
    );
    
    if (uniqueUsers.length !== allUsersToNotify.length) {
      console.log(`⚠️ [NOTIFICATION] Removed ${allUsersToNotify.length - uniqueUsers.length} duplicate users`);
    }
    
    // Create notification recipients for all unique users (parents and student)
    const recipientRecords = uniqueUsers.map(user => ({
      notification_id: notificationData.id,
      recipient_id: user.userId,
      recipient_type: user.userType === 'parent' ? 'Parent' : 'Student',
      delivery_status: 'Sent',
      is_read: false,
      sent_at: new Date().toISOString(),
      tenant_id: tenantId // Include tenant_id for notification recipients
    }));
    
    console.log(`📝 [NOTIFICATION] Creating ${recipientRecords.length} recipient records`);
    
    // Send push notifications to all users in parallel
    console.log(`📤 [PUSH] Sending push notifications to ${uniqueUsers.length} users...`);
    
    const pushNotificationResults = await Promise.allSettled(
      uniqueUsers.map(async (user) => {
        try {
          // Get push tokens for the user
          const pushTokens = await getActivePushTokensForUser(user.userId, tenantId);
          
          if (pushTokens.length === 0) {
            console.log(`⚠️ No push tokens found for user: ${user.userEmail}`);
            return { userId: user.userId, success: false, reason: 'no_tokens' };
          }
          
          // Select appropriate push notification content based on user type
          const pushTitle = user.userType === 'parent' ? parentPushTitle : studentPushTitle;
          const pushBody = user.userType === 'parent' ? parentPushBody : studentPushBody;
          
          // Send push notifications
          const result = await sendPushNotificationsToUser(
            pushTokens,
            pushTitle,
            pushBody,
            {
              type: 'attendance_absence',
              studentId: studentId,
              attendanceDate: attendanceDate,
              userType: user.userType
            }
          );
          
          console.log(`📤 Push notifications for ${user.userEmail} (${user.userType}): ${result.successCount} successful, ${result.failureCount} failed`);
          
          return {
            userId: user.userId,
            userEmail: user.userEmail,
            userType: user.userType,
            success: result.successCount > 0,
            successCount: result.successCount,
            failureCount: result.failureCount
          };
          
        } catch (error) {
          console.error(`Error sending push notification to user ${user.userEmail}:`, error);
          return {
            userId: user.userId,
            userEmail: user.userEmail,
            userType: user.userType,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    // Process push notification results
    const pushResults = pushNotificationResults.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
    );
    
    const successfulPushCount = pushResults.filter(r => r.success).length;
    console.log(`📤 [PUSH] Push notifications completed: ${successfulPushCount}/${uniqueUsers.length} successful`);
    
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
    
    // Broadcast real-time notification updates to all users for instant badge refresh
    try {
      console.log(`📡 [ATTENDANCE NOTIFICATION] Broadcasting real-time updates to ${uniqueUsers.length} users...`);
      const allUserIds = uniqueUsers.map(u => u.userId);
      await universalNotificationService.broadcastNewNotificationToUsers(
        allUserIds,
        notificationData.id,
        'Absentee'
      );
      console.log(`✅ [ATTENDANCE NOTIFICATION] Real-time broadcasts sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [ATTENDANCE NOTIFICATION] Broadcasting failed (not critical):`, broadcastError);
    }
    
    return {
      success: true,
      notificationId: notificationData.id,
      recipientCount: recipientData.length,
      pushNotificationResults: {
        totalUsers: uniqueUsers.length,
        successfulPushCount: successfulPushCount,
        results: pushResults
      },
      notifiedUsers: {
        parents: parentUsers.map(pu => ({
          email: pu.userEmail,
          parentName: pu.parentInfo?.name || 'Unknown',
          relation: pu.parentInfo?.relation || 'Unknown'
        })),
        student: studentUser ? {
          email: studentUser.userEmail,
          studentId: studentUser.studentId
        } : null
      }
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
      // Try to get tenant_id from the absent record first
      const fromRecord = absentStudents?.[0]?.tenant_id;
      if (fromRecord) {
        tenantId = fromRecord;
        console.log(`📋 Using tenant_id from absent record: ${tenantId}`);
      } else {
        // Fallback to current user if valid
        const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        if (markedBy && isUuid(markedBy)) {
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
        } else {
          console.warn('⚠️ No valid markedBy provided to derive tenant_id; notifications may be skipped');
        }
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
