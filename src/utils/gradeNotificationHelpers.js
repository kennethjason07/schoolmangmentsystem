import { supabase, TABLES } from './supabase';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * Helper functions for grade notifications using the existing notification system
 * Uses: notifications table + notification_recipients table
 * Notification type: GRADE_ENTERED
 */

/**
 * Find parent users for given student IDs
 * Uses: users.linked_parent_of = student.id
 * 
 * @param {Array} studentIds - Array of student UUIDs
 * @returns {Promise<Object>} { parentUsers: Array, studentParentMap: Object }
 */
export async function findParentUsersForStudents(studentIds) {
  try {
    console.log('🔍 Finding parent users for students:', studentIds);

    if (!studentIds || studentIds.length === 0) {
      return { parentUsers: [], studentParentMap: {} };
    }

    // Find parent users linked to these students
    const { data: parentUsers, error: parentError } = await supabase
      .from(TABLES.USERS)
      .select(`
        id,
        email,
        full_name,
        phone,
        linked_parent_of
      `)
      .in('linked_parent_of', studentIds)
      .not('linked_parent_of', 'is', null);

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
 * 
 * @param {Object} params - Notification parameters
 * @param {String} params.classId - Class UUID
 * @param {String} params.subjectId - Subject UUID  
 * @param {String} params.examId - Exam UUID
 * @param {String} params.teacherId - Teacher UUID (sent_by)
 * @param {Array} params.studentIds - Array of student UUIDs who got marks
 * @returns {Promise<Object>} Notification creation result
 */
export async function createGradeNotification({ classId, subjectId, examId, teacherId, studentIds }) {
  try {
    console.log('📬 Creating grade notification...', {
      classId, subjectId, examId, teacherId, studentCount: studentIds.length
    });

    // 1. Find parent users for these students
    const { parentUsers, studentParentMap } = await findParentUsersForStudents(studentIds);

    if (parentUsers.length === 0) {
      console.log('⚠️ No parent users found for these students');
      return {
        success: true,
        message: 'Marks saved but no parent users found to notify',
        recipientCount: 0
      };
    }

    // 2. Get context information for notification content
    const context = await getNotificationContext(studentIds, classId, subjectId, examId);

    // 3. Create notification message
    const studentsWithParents = studentIds.filter(id => studentParentMap[id]);
    const studentNames = studentsWithParents
      .map(id => context.students.find(s => s.id === id)?.name)
      .filter(name => name)
      .slice(0, 3); // Show max 3 names

    let message = `New marks entered for ${context.subject.name} - ${context.exam.name}`;
    if (studentNames.length === 1) {
      message += ` for ${studentNames[0]}`;
    } else if (studentNames.length > 1) {
      message += ` for ${studentNames.join(', ')}${studentNames.length < studentsWithParents.length ? ` and ${studentsWithParents.length - studentNames.length} other(s)` : ''}`;
    }
    message += ` in ${context.classInfo.class_name} ${context.classInfo.section}`;

    // 4. Create notification record
    const { data: notification, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert({
        type: 'GRADE_ENTERED',
        message: message,
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        sent_by: teacherId,
        scheduled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Error creating notification:', notificationError);
      throw notificationError;
    }

    console.log('✅ Notification created:', notification.id);

    // 5. Create notification recipients (one for each parent)
    const recipients = parentUsers.map(parent => ({
      notification_id: notification.id,
      recipient_id: parent.id,
      recipient_type: 'Parent',
      delivery_status: 'Pending',
      is_read: false
    }));

    const { error: recipientsError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .insert(recipients);

    if (recipientsError) {
      console.error('❌ Error creating recipients:', recipientsError);
      throw recipientsError;
    }

    console.log('✅ Notification recipients created:', recipients.length);

    // 6. Deliver the notification properly (update both recipients and main notification)
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
    
    // Broadcast real-time notification updates to all parent users for instant badge refresh
    try {
      console.log(`📡 [GRADE NOTIFICATION] Broadcasting real-time updates to ${parentUsers.length} parents...`);
      const parentUserIds = parentUsers.map(p => p.id);
      await universalNotificationService.broadcastNewNotificationToUsers(
        parentUserIds,
        notification.id,
        'GRADE_ENTERED'
      );
      console.log(`✅ [GRADE NOTIFICATION] Real-time broadcasts sent successfully`);
    } catch (broadcastError) {
      console.warn(`⚠️ [GRADE NOTIFICATION] Broadcasting failed (not critical):`, broadcastError);
    }

    return {
      success: true,
      message: `Grade notification sent to ${parentUsers.length} parent(s)`,
      notificationId: notification.id,
      recipientCount: parentUsers.length,
      parentUsers: parentUsers.map(p => ({ name: p.full_name, email: p.email }))
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
