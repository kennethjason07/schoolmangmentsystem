import { enhancedNotificationService } from '../services/enhancedNotificationService';
import { supabase, TABLES } from './supabase';

/**
 * Grade Entry Notification Trigger Utilities
 * Provides hooks and triggers for grade-related notification events
 */

/**
 * Trigger grade notification when marks are entered
 * This function should be called whenever grades/marks are entered for students
 * 
 * @param {Object} gradeEntryData - Grade entry information
 * @param {string} gradeEntryData.classId - Class UUID
 * @param {string} gradeEntryData.subjectId - Subject UUID
 * @param {string} gradeEntryData.examId - Exam UUID
 * @param {string} gradeEntryData.teacherId - Teacher UUID
 * @param {Array} gradeEntryData.studentMarks - Array of student marks
 * @param {string} gradeEntryData.enteredBy - User who entered the grades
 * @returns {Promise<Object>} Notification result
 */
export async function triggerGradeEntryNotification(gradeEntryData) {
  try {
    console.log('🎯 [GRADE TRIGGER] Triggering grade entry notification:', gradeEntryData);

    const { classId, subjectId, examId, teacherId, studentMarks, enteredBy } = gradeEntryData;

    // Validate required data
    if (!classId || !subjectId || !examId || !teacherId) {
      throw new Error('Missing required grade entry data for notification');
    }

    // Log the grade entry for audit purposes
    await logGradeEntry({
      classId,
      subjectId,
      examId,
      teacherId,
      studentCount: studentMarks?.length || 0,
      enteredBy,
      timestamp: new Date().toISOString()
    });

    // Trigger the notification
    const notificationResult = await enhancedNotificationService.notifyGradeEntry({
      classId,
      subjectId,
      examId,
      teacherId,
      enteredBy
    });

    if (notificationResult.success) {
      console.log('✅ [GRADE TRIGGER] Grade notification sent successfully:', {
        notificationId: notificationResult.notificationId,
        recipients: notificationResult.recipientCount
      });
    } else {
      console.error('❌ [GRADE TRIGGER] Failed to send grade notification:', notificationResult.error);
    }

    return notificationResult;

  } catch (error) {
    console.error('❌ [GRADE TRIGGER] Error in grade notification trigger:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Hook function to be called after bulk marks entry
 * This is designed to integrate with existing marks entry workflows
 * 
 * @param {Object} bulkMarksData - Bulk marks entry data
 */
export async function onBulkMarksEntry(bulkMarksData) {
  const { marks, classId, subjectId, examId, teacherId } = bulkMarksData;
  
  // Only trigger notification if marks were actually entered
  if (marks && marks.length > 0) {
    await triggerGradeEntryNotification({
      classId,
      subjectId,
      examId,
      teacherId,
      studentMarks: marks,
      enteredBy: teacherId // Assuming teacher entered the marks
    });
  }
}

/**
 * Hook function to be called after individual mark entry
 * This handles single student mark entries
 * 
 * @param {Object} individualMarkData - Individual mark entry data
 */
export async function onIndividualMarkEntry(individualMarkData) {
  const { studentId, mark, classId, subjectId, examId, teacherId } = individualMarkData;
  
  await triggerGradeEntryNotification({
    classId,
    subjectId,
    examId,
    teacherId,
    studentMarks: [{ studentId, mark }],
    enteredBy: teacherId
  });
}

/**
 * Utility function to get class information from marks data
 * This helps determine which class to notify based on exam/subject data
 * 
 * @param {string} examId - Exam UUID
 * @param {string} subjectId - Subject UUID
 * @returns {Promise<Object>} Class information
 */
export async function getClassFromMarksContext(examId, subjectId) {
  try {
    // Get class from exam
    const { data: examData, error: examError } = await supabase
      .from(TABLES.EXAMS)
      .select('class_id')
      .eq('id', examId)
      .single();

    if (examError || !examData) {
      // Fallback: get class from subject
      const { data: subjectData, error: subjectError } = await supabase
        .from(TABLES.SUBJECTS)
        .select('class_id')
        .eq('id', subjectId)
        .single();

      if (subjectError || !subjectData) {
        throw new Error('Could not determine class from exam or subject');
      }

      return { classId: subjectData.class_id };
    }

    return { classId: examData.class_id };

  } catch (error) {
    console.error('❌ [CLASS CONTEXT] Error getting class from marks context:', error);
    return { classId: null, error: error.message };
  }
}

/**
 * Enhanced hook that automatically detects class from marks entry context
 * This is useful when integrating with existing systems where class might not be explicitly provided
 * 
 * @param {Object} marksData - Marks data potentially missing class info
 */
export async function smartGradeNotificationTrigger(marksData) {
  let { classId, subjectId, examId, teacherId, studentMarks } = marksData;

  // Auto-detect class if not provided
  if (!classId && (examId || subjectId)) {
    const classInfo = await getClassFromMarksContext(examId, subjectId);
    if (classInfo.classId) {
      classId = classInfo.classId;
    } else {
      console.warn('⚠️ [SMART TRIGGER] Could not auto-detect class, skipping notification');
      return { success: false, error: 'Could not determine class for notification' };
    }
  }

  return await triggerGradeEntryNotification({
    classId,
    subjectId,
    examId,
    teacherId,
    studentMarks
  });
}

/**
 * Log grade entry for audit and analytics purposes
 * This helps track notification triggers and can be used for reporting
 * 
 * @param {Object} logData - Grade entry log data
 */
async function logGradeEntry(logData) {
  try {
    // You could store this in a separate audit table if needed
    console.log('📊 [GRADE AUDIT] Grade entry logged:', {
      timestamp: logData.timestamp,
      class: logData.classId,
      subject: logData.subjectId,
      exam: logData.examId,
      teacher: logData.teacherId,
      studentCount: logData.studentCount,
      enteredBy: logData.enteredBy
    });

    // Optional: Store in database audit table
    // await supabase.from('grade_entry_audit').insert(logData);

  } catch (error) {
    console.error('❌ [GRADE AUDIT] Error logging grade entry:', error);
  }
}

/**
 * Batch notification for multiple classes
 * Useful when grades are entered for multiple classes at once
 * 
 * @param {Array} batchGradeData - Array of grade entry data for multiple classes
 */
export async function triggerBatchGradeNotifications(batchGradeData) {
  const results = [];

  for (const gradeData of batchGradeData) {
    try {
      const result = await triggerGradeEntryNotification(gradeData);
      results.push({
        classId: gradeData.classId,
        success: result.success,
        notificationId: result.notificationId,
        error: result.error
      });

      // Add small delay between notifications to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      results.push({
        classId: gradeData.classId,
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
 * Integration helper for existing mark entry components
 * This provides a simple interface for existing React components to trigger notifications
 * 
 * @param {Object} componentProps - Props from React component
 * @param {Object} marksData - The marks data being saved
 */
export async function integrateWithMarkComponent(componentProps, marksData) {
  try {
    // Extract relevant data from component props and marks data
    const classId = componentProps.selectedClass?.id || marksData.classId;
    const subjectId = componentProps.selectedSubject?.id || marksData.subjectId;
    const examId = componentProps.selectedExam?.id || marksData.examId;
    const teacherId = componentProps.currentUser?.teacherId || componentProps.currentUser?.id;

    if (!classId || !subjectId || !examId) {
      console.warn('⚠️ [COMPONENT INTEGRATION] Missing required data for notification');
      return { success: false, error: 'Missing required data' };
    }

    return await triggerGradeEntryNotification({
      classId,
      subjectId,
      examId,
      teacherId,
      studentMarks: marksData.marks || [],
      enteredBy: teacherId
    });

  } catch (error) {
    console.error('❌ [COMPONENT INTEGRATION] Error integrating with mark component:', error);
    return { success: false, error: error.message };
  }
}

// Export default object with all functions for easy importing
export default {
  triggerGradeEntryNotification,
  onBulkMarksEntry,
  onIndividualMarkEntry,
  smartGradeNotificationTrigger,
  triggerBatchGradeNotifications,
  integrateWithMarkComponent,
  getClassFromMarksContext
};
