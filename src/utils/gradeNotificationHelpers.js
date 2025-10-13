import { supabase, TABLES } from './supabase';
import universalNotificationService from '../services/UniversalNotificationService';
import { sendPushNotification } from './pushNotificationUtils';

/**
 * Helper functions for grade notifications using the existing notification system
 * Uses: notifications table + notification_recipients table
 * Notification type: GRADE_ENTERED
 * Enhanced with push notifications for students and parents
 */

/**
 * Find student users for given student IDs
 * Uses: users.linked_student_id = student.id
 * 
 * @param {Array} studentIds - Array of student UUIDs
 * @param {String} tenantId - Tenant ID for filtering
 * @returns {Promise<Object>} { studentUsers: Array, studentUserMap: Object }
 */
export async function findStudentUsersForStudents(studentIds, tenantId) {
  try {
    console.log('🔍 Finding student users for students:', studentIds, 'tenant:', tenantId);

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

    console.log('✅ Found student users:', {
      totalStudentUsers: studentUsers?.length || 0,
      studentsWithUsers: Object.keys(studentUserMap).length
    });

    return {
      studentUsers: studentUsers || [],
      studentUserMap
    };

  } catch (error) {
    console.error('❌ Error in findStudentUsersForStudents:', error);
    throw error;
  }
}

/**
 * Find parent users for given student IDs
 * Uses: users.linked_parent_of = student.id
 * 
 * @param {Array} studentIds - Array of student UUIDs
 * @returns {Promise<Object>} { parentUsers: Array, studentParentMap: Object }
 */
export async function findParentUsersForStudents(studentIds, tenantId = null) {
  try {
    console.log('🔍 Finding parent users for students:', studentIds);

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

    // Create a map: studentId -> parentUser
    const studentParentMap = {};
    (parentUsers || []).forEach(parent => {
      if (parent.linked_parent_of) {
        studentParentMap[parent.linked_parent_of] = parent;
      }
    });

    console.log('✅ Found parent users:', {
      totalParents: parentUsers?.length || 0,
      studentsWithParents: Object.keys(studentParentMap).length
    });

    return {
      parentUsers: parentUsers || [],
      studentParentMap
    };

  } catch (error) {
    console.error('❌ Error in findParentUsersForStudents:', error);
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
      .from('push_tokens')
      .select('token, user_id, is_active, created_at')
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
 * Get student and class information for notification content
 * 
 * @param {Array} studentIds - Array of student UUIDs
 * @param {String} classId - Class UUID
 * @param {String} subjectId - Subject UUID
 * @param {String} examId - Exam UUID
 * @returns {Promise<Object>} Student, class, subject, exam details
 */
export async function getNotificationContext(studentIds, classId, subjectId, examId) {
  try {
    console.log('📋 Getting notification context...');

    // Get students with their class info
    const { data: students, error: studentsError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        roll_no,
        classes(class_name, section)
      `)
      .in('id', studentIds);

    if (studentsError) throw studentsError;

    // Get subject info
    const { data: subject, error: subjectError } = await supabase
      .from(TABLES.SUBJECTS)
      .select('name')
      .eq('id', subjectId)
      .single();

    if (subjectError) throw subjectError;

    // Get exam info
    const { data: exam, error: examError } = await supabase
      .from(TABLES.EXAMS)
      .select('name, start_date, end_date')
      .eq('id', examId)
      .single();

    if (examError) throw examError;

    // Get class info
    const { data: classInfo, error: classError } = await supabase
      .from(TABLES.CLASSES)
      .select('class_name, section')
      .eq('id', classId)
      .single();

    if (classError) throw classError;

    return {
      students: students || [],
      subject: subject,
      exam: exam,
      classInfo: classInfo
    };

  } catch (error) {
    console.error('❌ Error getting notification context:', error);
    throw error;
  }
}

/**
 * Create grade notification when teacher enters marks
 * Enhanced with push notifications for students and parents
 * 
 * @param {Object} params - Notification parameters
 * @param {String} params.classId - Class UUID
 * @param {String} params.subjectId - Subject UUID  
 * @param {String} params.examId - Exam UUID
 * @param {String} params.teacherId - Teacher UUID (sent_by)
 * @param {Array} params.studentIds - Array of student UUIDs who got marks
 * @param {String} params.tenantId - Tenant UUID for filtering (optional)
 * @returns {Promise<Object>} Notification creation result with push notification results
 */
export async function createGradeNotification({ classId, subjectId, examId, teacherId, studentIds, tenantId = null }) {
  try {
    console.log('📬 Creating grade notification...', {
      classId, subjectId, examId, teacherId, studentCount: studentIds.length
    });

    // 1. Find parent and student users for these students
    const { parentUsers, studentParentMap } = await findParentUsersForStudents(studentIds, tenantId);
    const { studentUsers, studentUserMap } = await findStudentUsersForStudents(studentIds, tenantId);

    if (parentUsers.length === 0 && studentUsers.length === 0) {
      console.log('⚠️ No parent or student users found for these students');
      return {
        success: true,
        message: 'Marks saved but no parent or student users found to notify',
        recipientCount: 0
      };
    }
    
    console.log(`📋 Found ${parentUsers.length} parent users and ${studentUsers.length} student users to notify`);
    
    // Combine all users to notify
    const allUsersToNotify = [
      ...parentUsers.map(user => ({ ...user, userType: 'parent' })),
      ...studentUsers.map(user => ({ ...user, userType: 'student' }))
    ];

    // 2. Get context information for notification content
    const context = await getNotificationContext(studentIds, classId, subjectId, examId);

    // 3. Create notification messages for different user types
    const studentsWithUsers = studentIds.filter(id => studentParentMap[id] || studentUserMap[id]);
    const studentNames = studentsWithUsers
      .map(id => context.students.find(s => s.id === id)?.name)
      .filter(name => name)
      .slice(0, 3); // Show max 3 names

    // In-app notification message (for parents)
    let parentMessage = `New marks entered for ${context.subject.name} - ${context.exam.name}`;
    if (studentNames.length === 1) {
      parentMessage += ` for ${studentNames[0]}`;
    } else if (studentNames.length > 1) {
      parentMessage += ` for ${studentNames.join(', ')}${studentNames.length < studentsWithUsers.length ? ` and ${studentsWithUsers.length - studentNames.length} other(s)` : ''}`;
    }
    parentMessage += ` in ${context.classInfo.class_name} ${context.classInfo.section}`;
    
    // Student message
    const studentMessage = `Your marks for ${context.subject.name} - ${context.exam.name} have been entered in ${context.classInfo.class_name} ${context.classInfo.section}`;

    // Push notification messages
    const parentPushTitle = '🎆 New Marks Available';
    const parentPushBody = `${context.subject.name} marks entered for ${context.exam.name}`;
    
    const studentPushTitle = '📊 Your Marks Are Ready';
    const studentPushBody = `Check your ${context.subject.name} marks for ${context.exam.name}`;

    // 4. Create notification record (using parent message as primary)
    let insertData = {
      type: 'GRADE_ENTERED',
      message: parentMessage,
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

    console.log('✅ Notification created:', notification.id);

    // 5. Create notification recipients (for parents and students)
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
    
    // 6. Send push notifications to all users in parallel (before creating recipients)
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
              type: 'grade_entered',
              classId: classId,
              subjectId: subjectId,
              examId: examId,
              userType: user.userType,
              studentIds: user.userType === 'student' ? [user.linked_student_id] : studentIds
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
    
    // 7. Create in-app notification recipients

    const { error: recipientsError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipients);

    if (recipientsError) {
      console.error('❌ Error creating recipients:', recipientsError);
      throw recipientsError;
    }

    console.log('✅ Notification recipients created:', recipients.length);

    // 8. Deliver the notification properly (update both recipients and main notification)
    const currentTimestamp = new Date().toISOString();
    
    // First update all recipients to 'Sent' status
    await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .update({
        delivery_status: 'Sent',
        sent_at: currentTimestamp
      })
      .eq('notification_id', notification.id);
    
    // Then update main notification to 'Sent' status
    await supabase
      .from(TABLES.NOTIFICATIONS)
      .update({
        delivery_status: 'Sent',
        sent_at: currentTimestamp
      })
      .eq('id', notification.id);
    
    console.log('✅ Notification delivered successfully with proper timestamps');
    
    // Broadcast real-time notification updates to all users for instant badge refresh
    try {
      console.log(`📡 [GRADE NOTIFICATION] Broadcasting real-time updates to ${allUsersToNotify.length} users...`);
      const allUserIds = allUsersToNotify.map(u => u.id);
      await universalNotificationService.broadcastNewNotificationToUsers(
        allUserIds,
        notification.id,
        'GRADE_ENTERED'
      );
      console.log(`✅ [GRADE NOTIFICATION] Real-time broadcasts sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [GRADE NOTIFICATION] Broadcasting failed (not critical):`, broadcastError);
    }

    return {
      success: true,
      message: `Grade notification sent to ${allUsersToNotify.length} user(s) (${parentUsers.length} parents, ${studentUsers.length} students)`,
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
    console.error('❌ Error creating grade notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get notifications for a parent user
 * 
 * @param {String} parentUserId - Parent user UUID
 * @param {Object} options - Query options
 * @param {Boolean} options.unreadOnly - Get only unread notifications
 * @param {Number} options.limit - Limit number of results
 * @returns {Promise<Array>} Array of notifications
 */
export async function getParentNotifications(parentUserId, { unreadOnly = false, limit = 50 } = {}) {
  try {
    console.log('📖 Getting notifications for parent:', parentUserId);

    let query = supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        is_read,
        read_at,
        sent_at,
        delivery_status,
        notifications!inner(
          id,
          type,
          message,
          sent_by,
          scheduled_at,
          sent_at,
          created_at,
          users!notifications_sent_by_fkey(
            full_name
          )
        )
      `)
      .eq('recipient_id', parentUserId)
      .eq('recipient_type', 'Parent')
      .order('created_at', { foreignTable: 'notifications', ascending: false });

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('❌ Error getting parent notifications:', error);
      throw error;
    }

    console.log('✅ Found notifications:', notifications?.length || 0);

    return notifications || [];

  } catch (error) {
    console.error('❌ Error in getParentNotifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read for a parent
 * 
 * @param {String} notificationRecipientId - notification_recipients table ID
 * @returns {Promise<Boolean>} Success status
 */
export async function markNotificationAsRead(notificationRecipientId) {
  try {
    console.log('✓ Marking notification as read:', notificationRecipientId);

    const { error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationRecipientId);

    if (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }

    console.log('✅ Notification marked as read');
    return true;

  } catch (error) {
    console.error('❌ Error in markNotificationAsRead:', error);
    return false;
  }
}

/**
 * Get unread notification count for a parent
 * 
 * @param {String} parentUserId - Parent user UUID
 * @returns {Promise<Number>} Count of unread notifications
 */
export async function getUnreadNotificationCount(parentUserId) {
  try {
    const { count, error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', parentUserId)
      .eq('recipient_type', 'Parent')
      .eq('is_read', false);

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
}

export default {
  findParentUsersForStudents,
  getNotificationContext,
  createGradeNotification,
  getParentNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount
};
