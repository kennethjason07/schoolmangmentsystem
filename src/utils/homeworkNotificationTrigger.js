import { enhancedNotificationService } from '../services/enhancedNotificationService';
import { supabase, TABLES } from './supabase';

/**
 * Homework Upload Notification Trigger Utilities
 * Provides hooks and triggers for homework-related notification events
 */

/**
 * Trigger homework notification when homework is uploaded/assigned
 * This function should be called whenever homework is created or assigned to students
 * 
 * @param {Object} homeworkData - Homework information
 * @param {string} homeworkData.homeworkId - Homework UUID
 * @param {string} homeworkData.classId - Class UUID
 * @param {string} homeworkData.subjectId - Subject UUID
 * @param {string} homeworkData.teacherId - Teacher UUID
 * @param {string} homeworkData.title - Homework title
 * @param {string} homeworkData.dueDate - Due date
 * @param {string} homeworkData.createdBy - User who created the homework
 * @returns {Promise<Object>} Notification result
 */
export async function triggerHomeworkNotification(homeworkData) {
  try {
    console.log('📚 [HOMEWORK TRIGGER] Triggering homework notification:', homeworkData);

    const { homeworkId, classId, subjectId, teacherId, title, dueDate, createdBy } = homeworkData;

    // Validate required data
    if (!homeworkId || !classId || !subjectId || !teacherId) {
      throw new Error('Missing required homework data for notification');
    }

    // Log the homework creation for audit purposes
    await logHomeworkCreation({
      homeworkId,
      classId,
      subjectId,
      teacherId,
      title,
      dueDate,
      createdBy,
      timestamp: new Date().toISOString()
    });

    // Trigger the notification
    const notificationResult = await enhancedNotificationService.notifyHomeworkUpload({
      homeworkId,
      classId,
      subjectId,
      teacherId
    });

    if (notificationResult.success) {
      console.log('✅ [HOMEWORK TRIGGER] Homework notification sent successfully:', {
        notificationId: notificationResult.notificationId,
        recipients: notificationResult.recipientCount
      });
    } else {
      console.error('❌ [HOMEWORK TRIGGER] Failed to send homework notification:', notificationResult.error);
    }

    return notificationResult;

  } catch (error) {
    console.error('❌ [HOMEWORK TRIGGER] Error in homework notification trigger:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Hook function to be called after homework creation
 * This is designed to integrate with existing homework upload workflows
 * 
 * @param {Object} homework - Homework object from database
 * @param {Object} context - Additional context about the creation
 */
export async function onHomeworkCreated(homework, context = {}) {
  try {
    const { id, title, class_id, subject_id, teacher_id, due_date } = homework;
    const { createdBy } = context;

    await triggerHomeworkNotification({
      homeworkId: id,
      classId: class_id,
      subjectId: subject_id,
      teacherId: teacher_id,
      title,
      dueDate: due_date,
      createdBy: createdBy || teacher_id
    });

  } catch (error) {
    console.error('❌ [HOMEWORK CREATED] Error in homework creation hook:', error);
  }
}

/**
 * Hook function to be called after homework is assigned to specific students
 * This handles targeted homework assignments
 * 
 * @param {Object} assignmentData - Homework assignment data
 */
export async function onHomeworkAssigned(assignmentData) {
  const { homeworkId, assignedStudents, classId, subjectId, teacherId } = assignmentData;
  
  // Only trigger notification if students were actually assigned
  if (assignedStudents && assignedStudents.length > 0) {
    await triggerHomeworkNotification({
      homeworkId,
      classId,
      subjectId,
      teacherId,
      createdBy: teacherId
    });
  }
}

/**
 * Utility function to get class information from homework data
 * This helps extract class details for notification purposes
 * 
 * @param {string} homeworkId - Homework UUID
 * @returns {Promise<Object>} Homework and class information
 */
export async function getHomeworkDetails(homeworkId) {
  try {
    const { data: homework, error } = await supabase
      .from(TABLES.HOMEWORKS)
      .select(`
        id,
        title,
        description,
        due_date,
        class_id,
        subject_id,
        teacher_id,
        classes!inner(id, class_name, section),
        subjects!inner(id, name),
        teachers!inner(id, name)
      `)
      .eq('id', homeworkId)
      .single();

    if (error || !homework) {
      throw new Error('Homework not found');
    }

    return {
      homework,
      classInfo: homework.classes,
      subjectInfo: homework.subjects,
      teacherInfo: homework.teachers
    };

  } catch (error) {
    console.error('❌ [HOMEWORK DETAILS] Error getting homework details:', error);
    return { homework: null, error: error.message };
  }
}

/**
 * Enhanced hook that automatically extracts details from homework ID
 * This is useful when you only have the homework ID available
 * 
 * @param {string} homeworkId - Homework UUID
 * @param {Object} additionalContext - Any additional context
 */
export async function smartHomeworkNotificationTrigger(homeworkId, additionalContext = {}) {
  try {
    const { homework, classInfo, subjectInfo, teacherInfo, error } = await getHomeworkDetails(homeworkId);
    
    if (error || !homework) {
      console.warn('⚠️ [SMART TRIGGER] Could not get homework details, skipping notification');
      return { success: false, error: 'Could not get homework details' };
    }

    return await triggerHomeworkNotification({
      homeworkId: homework.id,
      classId: homework.class_id,
      subjectId: homework.subject_id,
      teacherId: homework.teacher_id,
      title: homework.title,
      dueDate: homework.due_date,
      createdBy: additionalContext.createdBy || homework.teacher_id
    });

  } catch (error) {
    console.error('❌ [SMART TRIGGER] Error in smart homework trigger:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log homework creation for audit and analytics purposes
 * This helps track notification triggers and can be used for reporting
 * 
 * @param {Object} logData - Homework creation log data
 */
async function logHomeworkCreation(logData) {
  try {
    console.log('📊 [HOMEWORK AUDIT] Homework creation logged:', {
      timestamp: logData.timestamp,
      homework: logData.homeworkId,
      title: logData.title,
      class: logData.classId,
      subject: logData.subjectId,
      teacher: logData.teacherId,
      dueDate: logData.dueDate,
      createdBy: logData.createdBy
    });

    // Optional: Store in database audit table
    // await supabase.from('homework_creation_audit').insert(logData);

  } catch (error) {
    console.error('❌ [HOMEWORK AUDIT] Error logging homework creation:', error);
  }
}

/**
 * Batch notification for multiple homework assignments
 * Useful when multiple homework items are created at once
 * 
 * @param {Array} batchHomeworkData - Array of homework data for multiple assignments
 */
export async function triggerBatchHomeworkNotifications(batchHomeworkData) {
  const results = [];

  for (const homeworkData of batchHomeworkData) {
    try {
      const result = await triggerHomeworkNotification(homeworkData);
      results.push({
        homeworkId: homeworkData.homeworkId,
        classId: homeworkData.classId,
        success: result.success,
        notificationId: result.notificationId,
        error: result.error
      });

      // Add small delay between notifications to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      results.push({
        homeworkId: homeworkData.homeworkId,
        classId: homeworkData.classId,
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: results.some(r => r.success),
    totalProcessed: results.length,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    results
  };
}

/**
 * Integration helper for existing homework upload components
 * This provides a simple interface for existing React components to trigger notifications
 * 
 * @param {Object} componentProps - Props from React component
 * @param {Object} homeworkData - The homework data being saved
 */
export async function integrateWithHomeworkComponent(componentProps, homeworkData) {
  try {
    // Extract relevant data from component props and homework data
    const classId = componentProps.selectedClass?.id || homeworkData.classId;
    const subjectId = componentProps.selectedSubject?.id || homeworkData.subjectId;
    const teacherId = componentProps.currentUser?.teacherId || componentProps.currentUser?.id;
    const homeworkId = homeworkData.id || homeworkData.homeworkId;

    if (!classId || !subjectId || !teacherId || !homeworkId) {
      console.warn('⚠️ [COMPONENT INTEGRATION] Missing required data for homework notification');
      return { success: false, error: 'Missing required data' };
    }

    return await triggerHomeworkNotification({
      homeworkId,
      classId,
      subjectId,
      teacherId,
      title: homeworkData.title,
      dueDate: homeworkData.dueDate || homeworkData.due_date,
      createdBy: teacherId
    });

  } catch (error) {
    console.error('❌ [COMPONENT INTEGRATION] Error integrating with homework component:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Integration helper for homework upload form submissions
 * This can be called directly from homework upload forms
 * 
 * @param {Object} formData - Form data from homework upload
 * @param {Object} uploadContext - Context about the upload (user, etc.)
 */
export async function onHomeworkFormSubmission(formData, uploadContext) {
  try {
    const {
      title,
      description,
      due_date,
      class_id,
      subject_id,
      teacher_id,
      assigned_students
    } = formData;

    const { userId, homeworkId } = uploadContext;

    if (!homeworkId) {
      console.warn('⚠️ [FORM INTEGRATION] No homework ID provided, skipping notification');
      return { success: false, error: 'No homework ID provided' };
    }

    return await triggerHomeworkNotification({
      homeworkId,
      classId: class_id,
      subjectId: subject_id,
      teacherId: teacher_id,
      title,
      dueDate: due_date,
      createdBy: userId || teacher_id
    });

  } catch (error) {
    console.error('❌ [FORM INTEGRATION] Error in homework form submission:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Utility function to notify about homework updates (not just creation)
 * This can be used when homework is modified or updated
 * 
 * @param {string} homeworkId - Homework UUID
 * @param {string} updateType - Type of update (modified, deadline_changed, etc.)
 */
export async function notifyHomeworkUpdate(homeworkId, updateType = 'modified') {
  try {
    const { homework, error } = await getHomeworkDetails(homeworkId);
    
    if (error || !homework) {
      return { success: false, error: 'Could not get homework details for update notification' };
    }

    // Create a modified notification message
    const message = `Homework "${homework.title}" has been ${updateType}. Please check for updates.`;

    return await enhancedNotificationService.createBulkNotification({
      type: 'HOMEWORK_UPLOADED', // We can use the same type or create a new one
      message,
      classId: homework.class_id,
      sentBy: homework.teacher_id,
      recipientTypes: ['Parent', 'Student']
    });

  } catch (error) {
    console.error('❌ [HOMEWORK UPDATE] Error notifying homework update:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if homework notification should be sent
 * This can be used to implement business logic around when to send notifications
 * 
 * @param {Object} homeworkData - Homework data
 * @returns {boolean} Whether notification should be sent
 */
export function shouldSendHomeworkNotification(homeworkData) {
  // Add your business logic here
  // For example: only notify during school hours, or only for certain subjects
  
  const currentHour = new Date().getHours();
  const isSchoolHours = currentHour >= 8 && currentHour <= 18; // 8 AM to 6 PM
  
  // Don't send notifications outside school hours for non-urgent homework
  if (!isSchoolHours && !homeworkData.urgent) {
    console.log('⏰ [NOTIFICATION POLICY] Skipping notification outside school hours');
    return false;
  }

  // Always send if due date is within 24 hours
  if (homeworkData.dueDate) {
    const dueDate = new Date(homeworkData.dueDate);
    const hoursUntilDue = (dueDate - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
      return true; // Always notify for urgent deadlines
    }
  }

  return isSchoolHours; // Default to school hours policy
}

// Export default object with all functions for easy importing
export default {
  triggerHomeworkNotification,
  onHomeworkCreated,
  onHomeworkAssigned,
  smartHomeworkNotificationTrigger,
  triggerBatchHomeworkNotifications,
  integrateWithHomeworkComponent,
  onHomeworkFormSubmission,
  notifyHomeworkUpdate,
  shouldSendHomeworkNotification,
  getHomeworkDetails
};
