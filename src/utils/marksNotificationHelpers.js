import { supabase, TABLES } from './supabase';

/**
 * Helper functions for bulk marks notifications
 * Uses: notifications table + notification_recipients table + messages table
 * Notification type: MARKS_ENTERED
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
    console.log('🔍 [MARKS] Finding parent users for students:', studentIds);

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
      console.error('❌ [MARKS] Error finding parent users:', parentError);
      throw parentError;
    }

    // Create a map: studentId -> parentUser
    const studentParentMap = {};
    (parentUsers || []).forEach(parent => {
      if (parent.linked_parent_of) {
        studentParentMap[parent.linked_parent_of] = parent;
      }
    });

    console.log('✅ [MARKS] Found parent users:', {
      totalParents: parentUsers?.length || 0,
      studentsWithParents: Object.keys(studentParentMap).length
    });

    return {
      parentUsers: parentUsers || [],
      studentParentMap
    };

  } catch (error) {
    console.error('❌ [MARKS] Error in findParentUsersForStudents:', error);
    throw error;
  }
}

/**
 * Get student, subject and class information for marks data
 * 
 * @param {Array} marksData - Array of marks objects with student_id, subject_id
 * @returns {Promise<Object>} Students, subjects map
 */
export async function getMarksNotificationContext(marksData) {
  try {
    console.log('📋 [MARKS] Getting marks notification context...');

    const studentIds = [...new Set(marksData.map(mark => mark.student_id))];
    const subjectIds = [...new Set(marksData.map(mark => mark.subject_id))];

    // Get students with their class info
    const { data: students, error: studentsError } = await supabase
      .from(TABLES.STUDENTS)
      .select(`
        id,
        name,
        roll_no,
        admission_no,
        class_id,
        classes(class_name, section)
      `)
      .in('id', studentIds);

    if (studentsError) throw studentsError;

    // Get subjects info
    const { data: subjects, error: subjectsError } = await supabase
      .from(TABLES.SUBJECTS)
      .select('id, name')
      .in('id', subjectIds);

    if (subjectsError) throw subjectsError;

    // Create subjects map for quick lookup
    const subjectsMap = {};
    (subjects || []).forEach(subject => {
      subjectsMap[subject.id] = subject;
    });

    return {
      students: students || [],
      subjectsMap
    };

  } catch (error) {
    console.error('❌ [MARKS] Error getting marks notification context:', error);
    throw error;
  }
}

/**
 * Create bulk marks notifications and messages for parents
 * 
 * @param {Array} marksData - Array of marks objects
 * @param {Object} exam - Exam object with id, name, max_marks
 * @param {String} adminUserId - Admin user ID (sent_by)
 * @returns {Promise<Object>} Bulk notification creation results
 */
export async function createBulkMarksNotifications(marksData, exam, adminUserId = null) {
  try {
    console.log('📬 [MARKS] Creating bulk marks notifications...', {
      marksCount: marksData.length,
      examId: exam?.id,
      examName: exam?.name
    });

    if (!marksData || marksData.length === 0) {
      return {
        success: true,
        message: 'No marks data provided',
        totalRecipients: 0,
        results: []
      };
    }

    // 1. Get unique student IDs from marks data
    const studentIds = [...new Set(marksData.map(mark => mark.student_id))];

    // 2. Find parent users for these students
    const { parentUsers, studentParentMap } = await findParentUsersForStudents(studentIds);

    if (parentUsers.length === 0) {
      console.log('⚠️ [MARKS] No parent users found for these students');
      return {
        success: false,
        message: 'No parent users found to notify',
        totalRecipients: 0,
        results: []
      };
    }

    // 3. Get context information (students and subjects)
    const context = await getMarksNotificationContext(marksData);

    // 4. Group marks by student for personalized messages
    const marksByStudent = {};
    marksData.forEach(mark => {
      if (!marksByStudent[mark.student_id]) {
        marksByStudent[mark.student_id] = [];
      }
      marksByStudent[mark.student_id].push(mark);
    });

    const results = [];

    // 5. Create notifications and messages for each student's parent
    for (const [studentId, studentMarks] of Object.entries(marksByStudent)) {
      try {
        const parent = studentParentMap[studentId];
        if (!parent) {
          results.push({
            studentId,
            success: false,
            error: 'No parent mapping found'
          });
          continue;
        }

        const student = context.students.find(s => s.id === studentId);
        if (!student) {
          results.push({
            studentId,
            success: false,
            error: 'Student not found'
          });
          continue;
        }

        // Check for existing notifications for this exam/student/parent combination
        const examName = exam?.name || 'exam';
        const duplicateCheckMessage = `New marks entered for ${student.name} - ${examName}`;
        
        const { data: existingNotification, error: checkError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .select(`
            id,
            notification_recipients!inner(recipient_id)
          `)
          .eq('type', 'GRADE_ENTERED')
          .eq('notification_recipients.recipient_id', parent.id)
          .ilike('message', `%${student.name}%${examName}%`)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Only check last 24 hours
          .limit(1);

        if (checkError) {
          console.warn('⚠️ [MARKS] Could not check for duplicates:', checkError);
        }

        if (existingNotification && existingNotification.length > 0) {
          console.log(`ℹ️ [MARKS] Duplicate notification found for ${student.name}, skipping...`);
          results.push({
            studentId,
            parentId: parent.id,
            success: true,
            skipped: true,
            reason: 'Duplicate notification already exists'
          });
          continue;
        }

        // Create notification message
        const subjectNames = studentMarks
          .map(mark => context.subjectsMap[mark.subject_id]?.name)
          .filter(name => name);

        let notificationMessage = `New marks entered for ${student.name}`;
        if (exam?.name) {
          notificationMessage += ` - ${exam.name}`;
        }
        if (subjectNames.length > 0) {
          notificationMessage += ` in ${subjectNames.join(', ')}`;
        }
        if (student.classes) {
          notificationMessage += ` (${student.classes.class_name} ${student.classes.section || ''})`;
        }

        // Create detailed message content
        let messageContent = `📊 Marks Update for ${student.name}\n\n`;
        if (exam?.name) {
          messageContent += `Exam: ${exam.name}\n`;
        }
        messageContent += `Class: ${student.classes?.class_name || 'N/A'} ${student.classes?.section || ''}\n`;
        if (student.roll_no) {
          messageContent += `Roll No: ${student.roll_no}\n`;
        }
        messageContent += '\nMarks Details:\n';

        studentMarks.forEach(mark => {
          const subjectName = context.subjectsMap[mark.subject_id]?.name || 'Unknown Subject';
          messageContent += `• ${subjectName}: ${mark.marks_obtained}/${mark.max_marks || exam?.max_marks || 100}`;
          if (mark.grade) {
            messageContent += ` (${mark.grade})`;
          }
          messageContent += '\n';
        });

        messageContent += '\nKeep up the great work! 🌟';

        // Create notification record
        const { data: notification, error: notificationError } = await supabase
          .from(TABLES.NOTIFICATIONS)
          .insert({
            type: 'GRADE_ENTERED',
            message: notificationMessage,
            delivery_mode: 'InApp',
            delivery_status: 'Pending',
            sent_by: adminUserId,
            scheduled_at: new Date().toISOString()
          })
          .select()
          .single();

        if (notificationError) {
          console.error('❌ [MARKS] Error creating notification:', notificationError);
          results.push({
            studentId,
            parentId: parent.id,
            success: false,
            error: `Notification creation failed: ${notificationError.message}`
          });
          continue;
        }

        // Create notification recipient
        const { error: recipientError } = await supabase
          .from(TABLES.NOTIFICATION_RECIPIENTS)
          .insert({
            notification_id: notification.id,
            recipient_id: parent.id,
            recipient_type: 'Parent',
            delivery_status: 'Pending',
            is_read: false
          });

        if (recipientError) {
          console.error('❌ [MARKS] Error creating recipient:', recipientError);
          results.push({
            studentId,
            parentId: parent.id,
            success: false,
            error: `Recipient creation failed: ${recipientError.message}`
          });
          continue;
        }

        // Update notification delivery status
        const sentAt = new Date().toISOString();
        await supabase
          .from(TABLES.NOTIFICATIONS)
          .update({
            delivery_status: 'Sent',
            sent_at: sentAt
          })
          .eq('id', notification.id);

        // Update notification recipient delivery status
        await supabase
          .from(TABLES.NOTIFICATION_RECIPIENTS)
          .update({
            delivery_status: 'Sent',
            sent_at: sentAt
          })
          .eq('notification_id', notification.id)
          .eq('recipient_id', parent.id);

        // Create message record
        const { error: messageError } = await supabase
          .from(TABLES.MESSAGES)
          .insert({
            sender_id: adminUserId,
            recipient_id: parent.id,
            subject: `Marks Update - ${student.name}`,
            content: messageContent,
            message_type: 'System',
            is_read: false,
            priority: 'Normal',
            sent_at: new Date().toISOString()
          });

        if (messageError) {
          console.error('⚠️ [MARKS] Warning: Could not create message:', messageError);
          // Continue anyway, notification was successful
        }

        results.push({
          studentId,
          parentId: parent.id,
          parentName: parent.full_name,
          studentName: student.name,
          success: true,
          notificationId: notification.id
        });

        console.log(`✅ [MARKS] Notification created for ${student.name} -> ${parent.full_name}`);

      } catch (error) {
        console.error('❌ [MARKS] Error processing student marks:', error);
        results.push({
          studentId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalAttempted = results.length;

    console.log('📊 [MARKS] Bulk marks notification results:', {
      attempted: totalAttempted,
      successful: successCount,
      failed: totalAttempted - successCount
    });

    return {
      success: successCount > 0,
      message: `Marks notifications: ${successCount} sent, ${totalAttempted - successCount} failed`,
      totalRecipients: successCount,
      results
    };

  } catch (error) {
    console.error('❌ [MARKS] Error creating bulk marks notifications:', error);
    return {
      success: false,
      error: error.message,
      totalRecipients: 0,
      results: []
    };
  }
}

/**
 * Get marks notifications for a parent user
 * 
 * @param {String} parentUserId - Parent user UUID
 * @param {Object} options - Query options
 * @param {Boolean} options.unreadOnly - Get only unread notifications
 * @param {Number} options.limit - Limit number of results
 * @returns {Promise<Array>} Array of marks notifications
 */
export async function getParentMarksNotifications(parentUserId, { unreadOnly = false, limit = 50 } = {}) {
  try {
    console.log('📖 [MARKS] Getting marks notifications for parent:', parentUserId);

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
      .eq('notifications.type', 'GRADE_ENTERED')
      .order('created_at', { foreignTable: 'notifications', ascending: false });

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('❌ [MARKS] Error getting parent marks notifications:', error);
      throw error;
    }

    console.log('✅ [MARKS] Found marks notifications:', notifications?.length || 0);

    return notifications || [];

  } catch (error) {
    console.error('❌ [MARKS] Error in getParentMarksNotifications:', error);
    throw error;
  }
}

export default {
  findParentUsersForStudents,
  getMarksNotificationContext,
  createBulkMarksNotifications,
  getParentMarksNotifications
};
