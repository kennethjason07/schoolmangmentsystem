import { supabase, TABLES } from './supabase';
import universalNotificationService from '../services/UniversalNotificationService';
import { sendPushNotification } from './pushNotificationUtils';

/**
 * Enhanced homework notification helpers with push notification support
 * Extends existing homework notification system with push notifications for students and parents
 */

/**
 * Find student users for given student IDs (for homework notifications)
 * Uses: users.linked_student_id = student.id
 * 
 * @param {Array} studentIds - Array of student UUIDs
 * @param {String} tenantId - Tenant ID for filtering
 * @returns {Promise<Object>} { studentUsers: Array, studentUserMap: Object }
 */
export async function findStudentUsersForHomework(studentIds, tenantId) {
  try {
    console.log('🔍 Finding student users for homework:', studentIds, 'tenant:', tenantId);

    if (!studentIds || studentIds.length === 0) {
      return { studentUsers: [], studentUserMap: {} };
    }

    // Find student users linked to these students with tenant filtering
    let query = supabase
      .from(TABLES.USERS)
      .select(`
        id,
        email,
        full_name,
        phone,
        linked_student_id,
        tenant_id
      `)
      .in('linked_student_id', studentIds)
      .not('linked_student_id', 'is', null);
    
    // Add tenant filtering if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: studentUsers, error: studentError } = await query;

    if (studentError) {
      console.error('❌ Error finding student users:', studentError);
      throw studentError;
    }

    // Create a map: studentId -> studentUser
    const studentUserMap = {};
    (studentUsers || []).forEach(student => {
      if (student.linked_student_id) {
        studentUserMap[student.linked_student_id] = student;
      }
    });

    console.log('✅ Found student users for homework:', {
      totalStudentUsers: studentUsers?.length || 0,
      studentsWithUsers: Object.keys(studentUserMap).length
    });

    return {
      studentUsers: studentUsers || [],
      studentUserMap
    };

  } catch (error) {
    console.error('❌ Error in findStudentUsersForHomework:', error);
    throw error;
  }
}

/**
 * Find parent users for given student IDs (for homework notifications)
 * Uses: users.linked_parent_of = student.id
 * 
 * @param {Array} studentIds - Array of student UUIDs
 * @param {String} tenantId - Tenant ID for filtering
 * @returns {Promise<Object>} { parentUsers: Array, studentParentMap: Object }
 */
export async function findParentUsersForHomework(studentIds, tenantId) {
  try {
    console.log('🔍 Finding parent users for homework:', studentIds, 'tenant:', tenantId);

    if (!studentIds || studentIds.length === 0) {
      return { parentUsers: [], studentParentMap: {} };
    }

    // Find parent users linked to these students with tenant filtering
    let query = supabase
      .from(TABLES.USERS)
      .select(`
        id,
        email,
        full_name,
        phone,
        linked_parent_of,
        tenant_id
      `)
      .in('linked_parent_of', studentIds)
      .not('linked_parent_of', 'is', null);
    
    // Add tenant filtering if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: parentUsers, error: parentError } = await query;

    if (parentError) {
      console.error('❌ Error finding parent users:', parentError);
      throw parentError;
    }

    // Create a map: studentId -> parentUser (could have multiple parents per student)
    const studentParentMap = {};
    (parentUsers || []).forEach(parent => {
      if (parent.linked_parent_of) {
        if (!studentParentMap[parent.linked_parent_of]) {
          studentParentMap[parent.linked_parent_of] = [];
        }
        studentParentMap[parent.linked_parent_of].push(parent);
      }
    });

    console.log('✅ Found parent users for homework:', {
      totalParentUsers: parentUsers?.length || 0,
      studentsWithParents: Object.keys(studentParentMap).length
    });

    return {
      parentUsers: parentUsers || [],
      studentParentMap
    };

  } catch (error) {
    console.error('❌ Error in findParentUsersForHomework:', error);
    throw error;
  }
}

/**
 * Get active push tokens for a user
 * @param {string} userId - The user ID
 * @param {string} tenantId - The tenant ID for filtering
 * @returns {Array} Array of active push tokens
 */
export async function getActivePushTokensForUser(userId, tenantId) {
  try {
    console.log('📱 Getting active push tokens for user:', userId, 'tenant:', tenantId);
    
    let query = supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    // Add tenant filtering if provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data: tokens, error } = await query;
    
    if (error) {
      console.error('Error fetching push tokens:', error);
      return [];
    }
    
    const validTokens = (tokens || []).filter(t => t.push_token).map(t => t.push_token);
    console.log(`📱 Found ${validTokens.length} active push tokens for user ${userId}`);
    
    return validTokens;
  } catch (error) {
    console.error('Error in getActivePushTokensForUser:', error);
    return [];
  }
}

/**
 * Send push notifications to a user with multiple tokens
 * @param {Array} pushTokens - Array of push tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional notification data
 * @returns {Object} Results of push notification sending
 */
export async function sendPushNotificationsToUser(pushTokens, title, body, data = {}) {
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
}

/**
 * Get homework context information for notifications
 * @param {String} homeworkId - Homework UUID
 * @param {Array} studentIds - Array of student IDs (from assigned_students)
 * @returns {Promise<Object>} Homework context information
 */
export async function getHomeworkNotificationContext(homeworkId, studentIds = []) {
  try {
    console.log('📋 Getting homework notification context for:', homeworkId);

    // Get homework information with class, subject details
    const { data: homework, error: homeworkError } = await supabase
      .from(TABLES.HOMEWORKS)
      .select(`
        id,
        title,
        description,
        due_date,
        class_id,
        subject_id,
        teacher_id,
        assigned_students,
        created_at,
        classes(class_name, section),
        subjects(name),
        teachers(name)
      `)
      .eq('id', homeworkId)
      .single();

    if (homeworkError) throw homeworkError;

    // Get student information if student IDs provided
    let students = [];
    if (studentIds.length > 0) {
      const { data: studentsData, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, name, roll_no')
        .in('id', studentIds);

      if (!studentsError) {
        students = studentsData || [];
      }
    }

    // Format due date for display
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
      homework: {
        id: homework.id,
        title: homework.title,
        description: homework.description,
        dueDate: homework.due_date,
        formattedDueDate: homework.due_date ? formatDate(homework.due_date) : null,
        assignedStudents: homework.assigned_students || []
      },
      class: {
        name: homework.classes?.class_name || 'Unknown Class',
        section: homework.classes?.section || 'Unknown Section',
        id: homework.class_id
      },
      subject: {
        name: homework.subjects?.name || 'Unknown Subject',
        id: homework.subject_id
      },
      teacher: {
        name: homework.teachers?.name || 'Unknown Teacher',
        id: homework.teacher_id
      },
      students: students
    };

    console.log('📋 Homework notification context prepared:', {
      homeworkTitle: context.homework.title,
      className: context.class.name,
      subjectName: context.subject.name,
      studentsCount: students.length
    });

    return context;

  } catch (error) {
    console.error('Error getting homework notification context:', error);
    throw error;
  }
}

/**
 * Create enhanced homework notification with push notifications
 * @param {Object} params - Homework notification parameters
 * @param {String} params.homeworkId - Homework UUID
 * @param {String} params.classId - Class UUID
 * @param {String} params.subjectId - Subject UUID
 * @param {String} params.teacherId - Teacher UUID
 * @param {Array} params.assignedStudents - Array of assigned student UUIDs
 * @param {String} params.tenantId - Tenant UUID for filtering
 * @returns {Promise<Object>} Notification creation result with push notification results
 */
export async function createHomeworkNotification({ homeworkId, classId, subjectId, teacherId, assignedStudents, tenantId }) {
  try {
    console.log('🚀 Creating homework notification with push notifications:', {
      homeworkId, classId, subjectId, teacherId, tenantId, studentCount: assignedStudents?.length || 0
    });

    // Get the assigned students or all students in the class
    let studentIds = assignedStudents;
    if (!studentIds || studentIds.length === 0) {
      // If no specific students assigned, get all students in the class
      const { data: classStudents, error: studentsError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id')
        .eq('class_id', classId)
        .eq('tenant_id', tenantId);

      if (studentsError) {
        console.warn('Warning: Could not fetch class students:', studentsError);
        studentIds = [];
      } else {
        studentIds = classStudents?.map(s => s.id) || [];
      }
    }

    if (studentIds.length === 0) {
      console.log('⚠️ No students found for homework notification');
      return {
        success: false,
        error: 'No students found for homework notification',
        recipientCount: 0
      };
    }

    // Find parent and student users for these students
    const { parentUsers, studentParentMap } = await findParentUsersForHomework(studentIds, tenantId);
    const { studentUsers, studentUserMap } = await findStudentUsersForHomework(studentIds, tenantId);

    if (parentUsers.length === 0 && studentUsers.length === 0) {
      console.log('⚠️ No parent or student users found for homework notification');
      return {
        success: false,
        error: 'No parent or student users found for homework notification',
        recipientCount: 0
      };
    }

    console.log(`📋 Found ${parentUsers.length} parent users and ${studentUsers.length} student users for homework notification`);

    // Get homework context for notification content
    const context = await getHomeworkNotificationContext(homeworkId, studentIds);

    // Combine all users to notify
    const allUsersToNotify = [
      ...parentUsers.map(user => ({ ...user, userType: 'parent' })),
      ...studentUsers.map(user => ({ ...user, userType: 'student' }))
    ];

    // Create notification messages for different user types
    const parentMessage = `New homework assigned: "${context.homework.title}" in ${context.subject.name} for ${context.class.name} - ${context.class.section}. Due: ${context.homework.formattedDueDate || 'No due date'}.`;
    const studentMessage = `New homework: "${context.homework.title}" in ${context.subject.name}. Due: ${context.homework.formattedDueDate || 'No due date'}. Check the homework section for details.`;

    // Push notification messages
    const parentPushTitle = '📚 New Homework Assigned';
    const parentPushBody = `${context.subject.name} homework for ${context.class.name}`;

    const studentPushTitle = '📝 New Homework';
    const studentPushBody = `${context.subject.name}: ${context.homework.title}`;

    // Create the main notification record
    let insertData = {
      type: 'HOMEWORK_UPLOADED',
      message: parentMessage, // Use parent message as default
      delivery_mode: 'InApp',
      delivery_status: 'Pending',
      sent_by: teacherId,
      scheduled_at: new Date().toISOString()
    };

    // Add tenant_id if provided
    if (tenantId) {
      insertData.tenant_id = tenantId;
    }

    const { data: notification, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert(insertData)
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Error creating notification:', notificationError);
      throw notificationError;
    }

    console.log('✅ Homework notification created:', notification.id);

    // Create notification recipients (for parents and students)
    const recipients = allUsersToNotify.map(user => {
      let recipientData = {
        notification_id: notification.id,
        recipient_id: user.id,
        recipient_type: user.userType === 'parent' ? 'Parent' : 'Student',
        delivery_status: 'Pending',
        is_read: false
      };

      // Add tenant_id if provided
      if (tenantId) {
        recipientData.tenant_id = tenantId;
      }

      return recipientData;
    });

    // Send push notifications to all users in parallel (before creating recipients)
    console.log(`📤 [PUSH] Sending push notifications to ${allUsersToNotify.length} users...`);

    const pushNotificationResults = await Promise.allSettled(
      allUsersToNotify.map(async (user) => {
        try {
          // Get push tokens for the user
          const pushTokens = await getActivePushTokensForUser(user.id, tenantId);

          if (pushTokens.length === 0) {
            console.log(`⚠️ No push tokens found for user: ${user.email}`);
            return { userId: user.id, success: false, reason: 'no_tokens' };
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
              type: 'homework_uploaded',
              homeworkId: homeworkId,
              classId: classId,
              subjectId: subjectId,
              userType: user.userType,
              dueDate: context.homework.dueDate
            }
          );

          console.log(`📤 Push notifications for ${user.email} (${user.userType}): ${result.successCount} successful, ${result.failureCount} failed`);

          return {
            userId: user.id,
            userEmail: user.email,
            userType: user.userType,
            success: result.successCount > 0,
            successCount: result.successCount,
            failureCount: result.failureCount
          };

        } catch (error) {
          console.error(`Error sending push notification to user ${user.email}:`, error);
          return {
            userId: user.id,
            userEmail: user.email,
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
    console.log(`📤 [PUSH] Push notifications completed: ${successfulPushCount}/${allUsersToNotify.length} successful`);

    // Create in-app notification recipients
    const { error: recipientsError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipients);

    if (recipientsError) {
      console.error('❌ Error creating notification recipients:', recipientsError);
      throw recipientsError;
    }

    console.log('✅ Notification recipients created:', recipients.length);

    // Mark notifications as delivered
    const currentTimestamp = new Date().toISOString();

    // Update all recipients to 'Sent' status
    await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .update({
        delivery_status: 'Sent',
        sent_at: currentTimestamp
      })
      .eq('notification_id', notification.id);

    // Update main notification to 'Sent' status
    await supabase
      .from(TABLES.NOTIFICATIONS)
      .update({
        delivery_status: 'Sent',
        sent_at: currentTimestamp
      })
      .eq('id', notification.id);

    console.log('✅ Homework notification delivered successfully');

    // Broadcast real-time notification updates to all users for instant badge refresh
    try {
      console.log(`📡 [HOMEWORK NOTIFICATION] Broadcasting real-time updates to ${allUsersToNotify.length} users...`);
      const allUserIds = allUsersToNotify.map(u => u.id);
      await universalNotificationService.broadcastNewNotificationToUsers(
        allUserIds,
        notification.id,
        'HOMEWORK_UPLOADED'
      );
      console.log(`✅ [HOMEWORK NOTIFICATION] Real-time broadcasts sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [HOMEWORK NOTIFICATION] Broadcasting failed (not critical):`, broadcastError);
    }

    return {
      success: true,
      message: `Homework notification sent to ${allUsersToNotify.length} user(s) (${parentUsers.length} parents, ${studentUsers.length} students)`,
      notificationId: notification.id,
      recipientCount: allUsersToNotify.length,
      pushNotificationResults: {
        totalUsers: allUsersToNotify.length,
        successfulPushCount: successfulPushCount,
        results: pushResults
      },
      notifiedUsers: {
        parents: parentUsers.map(p => ({ name: p.full_name, email: p.email })),
        students: studentUsers.map(s => ({ name: s.full_name, email: s.email }))
      }
    };

  } catch (error) {
    console.error('❌ Error creating homework notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  findStudentUsersForHomework,
  findParentUsersForHomework,
  getActivePushTokensForUser,
  sendPushNotificationsToUser,
  getHomeworkNotificationContext,
  createHomeworkNotification
};