import { enhancedNotificationService } from '../services/enhancedNotificationService';
import { triggerGradeEntryNotification } from '../utils/gradeNotificationTrigger';
import { triggerHomeworkNotification } from '../utils/homeworkNotificationTrigger';
import { supabase, TABLES } from '../utils/supabase';

/**
 * Notification API Endpoints
 * Provides REST-like API functions for notification management
 * These can be called directly from React components or used as API route handlers
 */

/**
 * API endpoint to trigger grade entry notification
 * POST /api/notifications/grade-entry
 * 
 * @param {Object} req - Request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.classId - Class UUID
 * @param {string} req.body.subjectId - Subject UUID
 * @param {string} req.body.examId - Exam UUID
 * @param {string} req.body.teacherId - Teacher UUID
 * @param {Array} req.body.studentMarks - Optional array of student marks
 * @param {string} req.body.enteredBy - User who entered grades
 * @returns {Promise<Object>} API response
 */
export async function triggerGradeNotificationEndpoint(req) {
  try {
    const { classId, subjectId, examId, teacherId, studentMarks, enteredBy } = req.body;

    // Validate required fields
    if (!classId || !subjectId || !examId || !teacherId) {
      return {
        success: false,
        error: 'Missing required fields: classId, subjectId, examId, teacherId',
        status: 400
      };
    }

    // Trigger the notification
    const result = await triggerGradeEntryNotification({
      classId,
      subjectId,
      examId,
      teacherId,
      studentMarks: studentMarks || [],
      enteredBy: enteredBy || teacherId
    });

    return {
      success: result.success,
      data: result.success ? {
        notificationId: result.notificationId,
        message: result.message,
        recipientCount: result.recipientCount
      } : null,
      error: result.error,
      status: result.success ? 200 : 500
    };

  } catch (error) {
    console.error('❌ [GRADE API] Error in grade notification endpoint:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to trigger homework upload notification
 * POST /api/notifications/homework-upload
 * 
 * @param {Object} req - Request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.homeworkId - Homework UUID
 * @param {string} req.body.classId - Class UUID
 * @param {string} req.body.subjectId - Subject UUID
 * @param {string} req.body.teacherId - Teacher UUID
 * @param {string} req.body.title - Homework title
 * @param {string} req.body.dueDate - Due date
 * @param {string} req.body.createdBy - User who created homework
 * @returns {Promise<Object>} API response
 */
export async function triggerHomeworkNotificationEndpoint(req) {
  try {
    const { homeworkId, classId, subjectId, teacherId, title, dueDate, createdBy } = req.body;

    // Validate required fields
    if (!homeworkId || !classId || !subjectId || !teacherId) {
      return {
        success: false,
        error: 'Missing required fields: homeworkId, classId, subjectId, teacherId',
        status: 400
      };
    }

    // Trigger the notification
    const result = await triggerHomeworkNotification({
      homeworkId,
      classId,
      subjectId,
      teacherId,
      title,
      dueDate,
      createdBy: createdBy || teacherId
    });

    return {
      success: result.success,
      data: result.success ? {
        notificationId: result.notificationId,
        message: result.message,
        recipientCount: result.recipientCount
      } : null,
      error: result.error,
      status: result.success ? 200 : 500
    };

  } catch (error) {
    console.error('❌ [HOMEWORK API] Error in homework notification endpoint:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to get user notifications
 * GET /api/notifications/user/:userId
 * 
 * @param {Object} req - Request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.userId - User UUID
 * @param {Object} req.query - Query parameters
 * @param {number} req.query.limit - Limit number of notifications (default: 50)
 * @param {number} req.query.offset - Offset for pagination (default: 0)
 * @param {boolean} req.query.unreadOnly - Only get unread notifications (default: false)
 * @returns {Promise<Object>} API response
 */
export async function getUserNotificationsEndpoint(req) {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        status: 400
      };
    }

    const result = await enhancedNotificationService.getUserNotifications(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true'
    });

    return {
      success: result.success,
      data: result.success ? {
        notifications: result.notifications,
        count: result.count,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: result.notifications.length === parseInt(limit)
        }
      } : null,
      error: result.error,
      status: result.success ? 200 : 500
    };

  } catch (error) {
    console.error('❌ [GET NOTIFICATIONS API] Error:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to mark notification as read
 * PUT /api/notifications/:notificationId/read
 * 
 * @param {Object} req - Request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.notificationId - Notification UUID
 * @param {Object} req.body - Request body
 * @param {string} req.body.userId - User UUID
 * @returns {Promise<Object>} API response
 */
export async function markNotificationReadEndpoint(req) {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;

    if (!notificationId || !userId) {
      return {
        success: false,
        error: 'Notification ID and User ID are required',
        status: 400
      };
    }

    const result = await enhancedNotificationService.markNotificationAsRead(notificationId, userId);

    return {
      success: result.success,
      data: result.success ? { marked: result.marked } : null,
      error: result.error,
      status: result.success ? 200 : 500
    };

  } catch (error) {
    console.error('❌ [MARK READ API] Error:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to get notification statistics
 * GET /api/notifications/stats
 * 
 * @param {Object} req - Request object
 * @param {Object} req.query - Query parameters (optional filters)
 * @returns {Promise<Object>} API response
 */
export async function getNotificationStatsEndpoint(req) {
  try {
    const result = await enhancedNotificationService.getNotificationStats(req.query || {});

    return {
      success: result.success,
      data: result.success ? result.stats : null,
      error: result.error,
      status: result.success ? 200 : 500
    };

  } catch (error) {
    console.error('❌ [STATS API] Error:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to create custom bulk notification
 * POST /api/notifications/bulk
 * 
 * @param {Object} req - Request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.type - Notification type
 * @param {string} req.body.message - Notification message
 * @param {string} req.body.classId - Class UUID
 * @param {string} req.body.sentBy - User who sent notification
 * @param {Array} req.body.recipientTypes - Array of recipient types ['Parent', 'Student']
 * @param {string} req.body.deliveryMode - Delivery mode (InApp, SMS, WhatsApp)
 * @returns {Promise<Object>} API response
 */
export async function createBulkNotificationEndpoint(req) {
  try {
    const { type, message, classId, sentBy, recipientTypes, deliveryMode } = req.body;

    if (!type || !message || !classId || !sentBy) {
      return {
        success: false,
        error: 'Missing required fields: type, message, classId, sentBy',
        status: 400
      };
    }

    const result = await enhancedNotificationService.createBulkNotification({
      type,
      message,
      classId,
      sentBy,
      recipientTypes: recipientTypes || ['Parent'],
      deliveryMode: deliveryMode || 'InApp'
    });

    return {
      success: result.success,
      data: result.success ? { notificationId: result.notificationId } : null,
      error: result.error,
      status: result.success ? 201 : 500
    };

  } catch (error) {
    console.error('❌ [BULK NOTIFICATION API] Error:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to get class notification recipients
 * GET /api/notifications/recipients/class/:classId
 * 
 * @param {Object} req - Request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.classId - Class UUID
 * @param {Object} req.query - Query parameters
 * @param {string} req.query.type - Recipient type filter (Parent, Student, or both)
 * @returns {Promise<Object>} API response
 */
export async function getClassRecipientsEndpoint(req) {
  try {
    const { classId } = req.params;
    const { type = 'both' } = req.query;

    if (!classId) {
      return {
        success: false,
        error: 'Class ID is required',
        status: 400
      };
    }

    // Use database function to get recipients
    let recipientTypes = ['Parent', 'Student'];
    if (type === 'Parent' || type === 'Student') {
      recipientTypes = [type];
    }

    const { data, error } = await supabase
      .rpc('get_class_students_and_parents', { p_class_id: classId });

    if (error) {
      throw error;
    }

    // Filter by recipient type if specified
    const filteredRecipients = data.filter(recipient => 
      recipientTypes.includes(recipient.recipient_type)
    );

    return {
      success: true,
      data: {
        classId,
        recipients: filteredRecipients,
        count: filteredRecipients.length,
        byType: {
          parents: filteredRecipients.filter(r => r.recipient_type === 'Parent').length,
          students: filteredRecipients.filter(r => r.recipient_type === 'Student').length
        }
      },
      status: 200
    };

  } catch (error) {
    console.error('❌ [CLASS RECIPIENTS API] Error:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API endpoint to get notification delivery status
 * GET /api/notifications/:notificationId/status
 * 
 * @param {Object} req - Request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.notificationId - Notification UUID
 * @returns {Promise<Object>} API response
 */
export async function getNotificationStatusEndpoint(req) {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return {
        success: false,
        error: 'Notification ID is required',
        status: 400
      };
    }

    // Get notification details
    const { data: notification, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notificationError || !notification) {
      return {
        success: false,
        error: 'Notification not found',
        status: 404
      };
    }

    // Get recipient details
    const { data: recipients, error: recipientsError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select('*')
      .eq('notification_id', notificationId);

    if (recipientsError) {
      throw recipientsError;
    }

    // Calculate statistics
    const stats = {
      total: recipients.length,
      sent: recipients.filter(r => r.delivery_status === 'Sent').length,
      pending: recipients.filter(r => r.delivery_status === 'Pending').length,
      failed: recipients.filter(r => r.delivery_status === 'Failed').length,
      read: recipients.filter(r => r.is_read === true).length,
      unread: recipients.filter(r => r.is_read === false).length
    };

    return {
      success: true,
      data: {
        notification,
        recipients,
        stats
      },
      status: 200
    };

  } catch (error) {
    console.error('❌ [NOTIFICATION STATUS API] Error:', error);
    return {
      success: false,
      error: error.message,
      status: 500
    };
  }
}

/**
 * API middleware for authentication and authorization
 * This should be used to protect notification endpoints
 * 
 * @param {Object} req - Request object
 * @param {Function} next - Next middleware function
 * @returns {Promise<Object|void>} Response or next()
 */
export async function authMiddleware(req, next) {
  try {
    // Check for authorization header
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Authorization token required',
        status: 401
      };
    }

    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return {
        success: false,
        error: 'Invalid or expired token',
        status: 401
      };
    }

    // Add user to request object
    req.user = user;
    req.userId = user.id;

    // Get user role for authorization
    const { data: userData } = await supabase
      .from(TABLES.USERS)
      .select('role_id, roles(role_name)')
      .eq('id', user.id)
      .single();

    if (userData) {
      req.userRole = userData.roles?.role_name;
      req.roleId = userData.role_id;
    }

    return next ? next() : { success: true };

  } catch (error) {
    console.error('❌ [AUTH MIDDLEWARE] Error:', error);
    return {
      success: false,
      error: 'Authentication error',
      status: 500
    };
  }
}

// API route mappings for easy integration
export const notificationRoutes = {
  // Grade notification endpoints
  'POST /api/notifications/grade-entry': triggerGradeNotificationEndpoint,
  
  // Homework notification endpoints
  'POST /api/notifications/homework-upload': triggerHomeworkNotificationEndpoint,
  
  // User notification management
  'GET /api/notifications/user/:userId': getUserNotificationsEndpoint,
  'PUT /api/notifications/:notificationId/read': markNotificationReadEndpoint,
  
  // Bulk and custom notifications
  'POST /api/notifications/bulk': createBulkNotificationEndpoint,
  
  // Statistics and monitoring
  'GET /api/notifications/stats': getNotificationStatsEndpoint,
  'GET /api/notifications/:notificationId/status': getNotificationStatusEndpoint,
  
  // Utility endpoints
  'GET /api/notifications/recipients/class/:classId': getClassRecipientsEndpoint
};

// Export all endpoint functions for individual use
export default {
  triggerGradeNotificationEndpoint,
  triggerHomeworkNotificationEndpoint,
  getUserNotificationsEndpoint,
  markNotificationReadEndpoint,
  createBulkNotificationEndpoint,
  getNotificationStatsEndpoint,
  getClassRecipientsEndpoint,
  getNotificationStatusEndpoint,
  authMiddleware,
  notificationRoutes
};
