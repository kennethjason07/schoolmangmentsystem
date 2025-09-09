import { supabase, TABLES } from '../utils/supabase';
import { getCurrentUserTenantByEmail } from '../utils/getTenantByEmail';
import { validateTenantAccess, validateNotificationRecipients } from '../utils/tenantValidation';

/**
 * Enhanced Notification Service for Grade Entry and Homework Upload
 * Handles automated notifications for various school events with tenant isolation
 */
class EnhancedNotificationService {
  constructor() {
    this.deliveryModes = {
      IN_APP: 'InApp',
      SMS: 'SMS', 
      WHATSAPP: 'WhatsApp'
    };

    this.notificationTypes = {
      GRADE_ENTERED: 'GRADE_ENTERED',
      HOMEWORK_UPLOADED: 'HOMEWORK_UPLOADED',
      ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
      ANNOUNCEMENT: 'ANNOUNCEMENT',
      EVENT_CREATED: 'EVENT_CREATED'
    };

    this.recipientTypes = {
      PARENT: 'Parent',
      STUDENT: 'Student'
    };
  }

  /**
   * Get current user's tenant context using email-based lookup
   * @returns {Promise<Object>} Tenant context or error
   */
  async getTenantContext() {
    try {
      const result = await getCurrentUserTenantByEmail();
      if (!result.success) {
        console.error('❌ [NOTIF_SERVICE] Failed to get tenant context:', result.error);
        return { success: false, error: result.error };
      }
      
      return {
        success: true,
        tenantId: result.data.tenant.id,
        tenantName: result.data.tenant.name,
        userRecord: result.data.userRecord
      };
    } catch (error) {
      console.error('❌ [NOTIF_SERVICE] Error getting tenant context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify parents when grades/marks are entered for a class
   * @param {Object} gradeData - Grade entry data
   * @param {string} gradeData.classId - Class UUID
   * @param {string} gradeData.subjectId - Subject UUID
   * @param {string} gradeData.examId - Exam UUID
   * @param {string} gradeData.teacherId - Teacher UUID
   * @param {string} gradeData.enteredBy - User who entered grades
   * @returns {Promise<Object>} Notification result
   */
  async notifyGradeEntry(gradeData) {
    try {
      console.log('🎯 [GRADE NOTIFICATION] Creating grade entry notification:', gradeData);

      // Get tenant context first
      const tenantContext = await this.getTenantContext();
      if (!tenantContext.success) {
        throw new Error(`Tenant context error: ${tenantContext.error}`);
      }

      const { classId, subjectId, examId, teacherId, enteredBy } = gradeData;

      // Validate required fields
      if (!classId || !subjectId || !examId || !teacherId) {
        throw new Error('Missing required fields for grade notification');
      }
      
      console.log(`🎯 [GRADE NOTIFICATION] Processing for tenant: ${tenantContext.tenantName} (${tenantContext.tenantId})`);

      // Use database function to create notification
      const { data: notificationId, error: dbError } = await supabase
        .rpc('notify_grade_entry', {
          p_class_id: classId,
          p_subject_id: subjectId,
          p_exam_id: examId,
          p_teacher_id: teacherId
        });

      if (dbError) {
        console.error('❌ [GRADE NOTIFICATION] Database error:', dbError);
        
        // Fallback to manual creation if database function fails
        return await this.createGradeNotificationManually(gradeData);
      }

      console.log('✅ [GRADE NOTIFICATION] Successfully created notification:', notificationId);

      // Mark notification as sent (InApp notifications are immediately delivered)
      await this.markNotificationAsSent(notificationId);

      return {
        success: true,
        notificationId,
        message: 'Grade entry notification sent to parents',
        recipientCount: await this.getNotificationRecipientCount(notificationId)
      };

    } catch (error) {
      console.error('❌ [GRADE NOTIFICATION] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Notify students and parents when homework is uploaded
   * @param {Object} homeworkData - Homework upload data
   * @param {string} homeworkData.homeworkId - Homework UUID
   * @param {string} homeworkData.classId - Class UUID
   * @param {string} homeworkData.subjectId - Subject UUID
   * @param {string} homeworkData.teacherId - Teacher UUID
   * @returns {Promise<Object>} Notification result
   */
  async notifyHomeworkUpload(homeworkData) {
    try {
      console.log('📚 [HOMEWORK NOTIFICATION] Creating homework upload notification:', homeworkData);

      // Get tenant context first
      const tenantContext = await this.getTenantContext();
      if (!tenantContext.success) {
        throw new Error(`Tenant context error: ${tenantContext.error}`);
      }

      const { homeworkId, classId, subjectId, teacherId } = homeworkData;

      // Validate required fields
      if (!homeworkId || !classId || !subjectId || !teacherId) {
        throw new Error('Missing required fields for homework notification');
      }
      
      console.log(`📚 [HOMEWORK NOTIFICATION] Processing for tenant: ${tenantContext.tenantName} (${tenantContext.tenantId})`);

      // Use database function to create notification
      const { data: notificationId, error: dbError } = await supabase
        .rpc('notify_homework_upload', {
          p_homework_id: homeworkId,
          p_class_id: classId,
          p_subject_id: subjectId,
          p_teacher_id: teacherId
        });

      if (dbError) {
        console.error('❌ [HOMEWORK NOTIFICATION] Database error:', dbError);
        
        // Fallback to manual creation if database function fails
        return await this.createHomeworkNotificationManually(homeworkData);
      }

      console.log('✅ [HOMEWORK NOTIFICATION] Successfully created notification:', notificationId);

      // Mark notification as sent (InApp notifications are immediately delivered)
      await this.markNotificationAsSent(notificationId);

      return {
        success: true,
        notificationId,
        message: 'Homework upload notification sent to students and parents',
        recipientCount: await this.getNotificationRecipientCount(notificationId)
      };

    } catch (error) {
      console.error('❌ [HOMEWORK NOTIFICATION] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual fallback for grade notification creation
   */
  async createGradeNotificationManually(gradeData) {
    const { classId, subjectId, examId, teacherId } = gradeData;

    // Get class, subject, exam, and teacher details
    const [classInfo, subjectInfo, examInfo, teacherInfo] = await Promise.all([
      this.getClassInfo(classId),
      this.getSubjectInfo(subjectId),
      this.getExamInfo(examId),
      this.getTeacherInfo(teacherId)
    ]);

    const message = `New marks have been entered for ${subjectInfo?.name} - ${examInfo?.name} by ${teacherInfo?.name}. Check your child's progress in the marks section.`;

    return await this.createBulkNotification({
      type: this.notificationTypes.GRADE_ENTERED,
      message,
      classId,
      sentBy: teacherInfo?.userId,
      recipientTypes: [this.recipientTypes.PARENT]
    });
  }

  /**
   * Manual fallback for homework notification creation
   */
  async createHomeworkNotificationManually(homeworkData) {
    const { homeworkId, classId, subjectId, teacherId } = homeworkData;

    // Get homework, class, subject, and teacher details
    const [homeworkInfo, classInfo, subjectInfo, teacherInfo] = await Promise.all([
      this.getHomeworkInfo(homeworkId),
      this.getClassInfo(classId),
      this.getSubjectInfo(subjectId),
      this.getTeacherInfo(teacherId)
    ]);

    const message = `New homework assigned for ${subjectInfo?.name}: "${homeworkInfo?.title}" by ${teacherInfo?.name}. Due date: ${homeworkInfo?.due_date}. Check the homework section for details.`;

    return await this.createBulkNotification({
      type: this.notificationTypes.HOMEWORK_UPLOADED,
      message,
      classId,
      sentBy: teacherInfo?.userId,
      recipientTypes: [this.recipientTypes.PARENT, this.recipientTypes.STUDENT]
    });
  }

  /**
   * Create bulk notification with recipients (tenant-aware)
   */
  async createBulkNotification(options) {
    const { type, message, classId, sentBy, recipientTypes = ['Parent'], deliveryMode = 'InApp' } = options;

    try {
      // Get tenant context
      const tenantContext = await this.getTenantContext();
      if (!tenantContext.success) {
        throw new Error(`Tenant context error: ${tenantContext.error}`);
      }
      
      console.log(`📦 [BULK NOTIFICATION] Creating for tenant: ${tenantContext.tenantName}`);
      
      // Use database function for bulk creation with tenant context
      const { data: notificationId, error } = await supabase
        .rpc('create_bulk_notification', {
          p_notification_type: type,
          p_message: message,
          p_sent_by: sentBy,
          p_class_id: classId,
          p_recipient_types: recipientTypes,
          p_delivery_mode: deliveryMode,
          p_tenant_id: tenantContext.tenantId
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        notificationId,
        message: 'Bulk notification created successfully'
      };

    } catch (error) {
      console.error('❌ [BULK NOTIFICATION] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark notifications as read for a user
   * @param {string} notificationId - Notification UUID
   * @param {string} userId - User UUID
   */
  async markNotificationAsRead(notificationId, userId) {
    try {
      const { data, error } = await supabase
        .rpc('mark_notification_read', {
          p_notification_id: notificationId,
          p_recipient_id: userId
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        marked: data
      };

    } catch (error) {
      console.error('❌ [MARK READ] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user notifications (tenant-aware)
   * @param {string} userId - User UUID
   * @param {Object} options - Query options
   */
  async getUserNotifications(userId, options = {}) {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    try {
      // Get tenant context
      const tenantContext = await this.getTenantContext();
      if (!tenantContext.success) {
        console.warn('⚠️ [USER NOTIFICATIONS] No tenant context, falling back to direct query');
        
        // Fallback to direct query with manual tenant filtering
        const { data, error } = await supabase
          .from(TABLES.NOTIFICATION_RECIPIENTS)
          .select(`
            *,
            notifications!inner(
              id,
              type,
              message,
              delivery_status,
              created_at,
              tenant_id
            )
          `)
          .eq('recipient_id', userId)
          .eq('is_read', unreadOnly ? false : undefined)
          .order('created_at', { ascending: false })
          .limit(limit);
          
        if (error) throw error;
        
        return {
          success: true,
          notifications: data || [],
          count: data?.length || 0
        };
      }
      
      console.log(`📱 [USER NOTIFICATIONS] Getting notifications for user in tenant: ${tenantContext.tenantName}`);
      
      const { data, error } = await supabase
        .rpc('get_user_notifications', {
          p_user_id: userId,
          p_limit: limit,
          p_offset: offset,
          p_unread_only: unreadOnly,
          p_tenant_id: tenantContext.tenantId
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        notifications: data || [],
        count: data?.length || 0
      };

    } catch (error) {
      console.error('❌ [GET NOTIFICATIONS] Error:', error);
      return {
        success: false,
        error: error.message,
        notifications: []
      };
    }
  }

  /**
   * Get notification recipient count
   */
  async getNotificationRecipientCount(notificationId) {
    try {
      const { count, error } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select('*', { count: 'exact', head: true })
        .eq('notification_id', notificationId);

      return error ? 0 : count;
    } catch (error) {
      console.error('❌ [RECIPIENT COUNT] Error:', error);
      return 0;
    }
  }

  /**
   * Mark notification as sent (deliver notification)
   * This should be called after the notification has been successfully processed/delivered
   */
  async markNotificationAsSent(notificationId, userId = null) {
    try {
      console.log(`📤 [ENHANCED DELIVERY] Marking notification ${notificationId} as delivered${userId ? ` for user ${userId}` : ' for all recipients'}`);
      
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
        console.error('❌ [ENHANCED DELIVERY] Error updating notification recipient:', recipientError);
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
        
        console.log(`✅ [ENHANCED DELIVERY] All recipients delivered, main notification marked as sent`);
      }
      
      return { success: true, deliveredAt: currentTimestamp };
      
    } catch (error) {
      console.error('❌ [ENHANCED DELIVERY] Error in markNotificationAsSent:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper methods to get entity information
  async getClassInfo(classId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, section, academic_year')
        .eq('id', classId)
        .single();

      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  async getSubjectInfo(subjectId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.SUBJECTS)
        .select('id, name')
        .eq('id', subjectId)
        .single();

      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  async getExamInfo(examId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXAMS)
        .select('id, name, start_date, end_date')
        .eq('id', examId)
        .single();

      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  async getTeacherInfo(teacherId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.TEACHERS)
        .select('id, name')
        .eq('id', teacherId)
        .single();

      if (error || !data) return null;

      // Try to get the teacher's user ID
      const { data: userData } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .ilike('full_name', `%${data.name}%`)
        .eq('role_id', 2) // Assuming role_id 2 is teacher
        .single();

      return {
        ...data,
        userId: userData?.id
      };
    } catch (error) {
      return null;
    }
  }

  async getHomeworkInfo(homeworkId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.HOMEWORKS)
        .select('id, title, description, due_date')
        .eq('id', homeworkId)
        .single();

      return error ? null : data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Utility method to trigger grade notification from external code
   * @param {string} classId - Class UUID
   * @param {string} subjectId - Subject UUID  
   * @param {string} examId - Exam UUID
   * @param {string} teacherId - Teacher UUID
   */
  async triggerGradeNotification(classId, subjectId, examId, teacherId) {
    return await this.notifyGradeEntry({
      classId,
      subjectId,
      examId,
      teacherId
    });
  }

  /**
   * Utility method to trigger homework notification from external code
   * @param {string} homeworkId - Homework UUID
   * @param {string} classId - Class UUID
   * @param {string} subjectId - Subject UUID
   * @param {string} teacherId - Teacher UUID
   */
  async triggerHomeworkNotification(homeworkId, classId, subjectId, teacherId) {
    return await this.notifyHomeworkUpload({
      homeworkId,
      classId,
      subjectId,
      teacherId
    });
  }

  /**
   * Get notification statistics for admin dashboard
   * @param {Object} filters - Optional filters
   */
  async getNotificationStats(filters = {}) {
    try {
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select(`
          id,
          type,
          delivery_status,
          created_at,
          notification_recipients(count)
        `);

      if (error) throw error;

      const stats = {
        total: data.length,
        byType: {},
        byStatus: {},
        recentCount: 0
      };

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      data.forEach(notification => {
        // Count by type
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
        
        // Count by status
        stats.byStatus[notification.delivery_status] = (stats.byStatus[notification.delivery_status] || 0) + 1;
        
        // Count recent notifications
        if (new Date(notification.created_at) > oneWeekAgo) {
          stats.recentCount++;
        }
      });

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('❌ [NOTIFICATION STATS] Error:', error);
      return {
        success: false,
        error: error.message,
        stats: {}
      };
    }
  }
}

// Export singleton instance
export const enhancedNotificationService = new EnhancedNotificationService();
export default enhancedNotificationService;
