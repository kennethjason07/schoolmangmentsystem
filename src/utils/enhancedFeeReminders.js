import feeReminderNotificationService from '../services/FeeReminderNotificationService';

/**
 * Enhanced Fee Reminder Utilities
 * Provides functions for sending fee reminders with push notifications
 * to be used in the FeeCollection admin screen
 */

/**
 * Send enhanced fee reminders with push notifications
 * @param {Object} options - Reminder options
 * @param {string} options.message - Reminder message
 * @param {Array<string>} options.recipientTypes - ['Parent', 'Student', 'Both']
 * @param {string} options.scope - 'all' or 'class'
 * @param {string|null} options.classId - Class ID for specific class reminders
 * @param {Object} options.feeInfo - Fee information (totalOutstanding, dueDate, etc.)
 * @param {Array} options.classes - Available classes for scope resolution
 * @param {string} options.selectedClass - Currently selected class filter
 * @returns {Promise<Object>} Result object with success status and details
 */
export const sendEnhancedFeeReminders = async (options) => {
  const {
    message,
    recipientTypes: rawRecipientTypes = ['Parent'],
    scope = 'all',
    classId: rawClassId,
    feeInfo = {},
    classes = [],
    selectedClass = 'All'
  } = options;

  try {
    console.log('🚀 [ENHANCED_FEE_REMINDER] Starting enhanced fee reminder process...');
    console.log('🚀 [ENHANCED_FEE_REMINDER] Options:', {
      recipientTypes: rawRecipientTypes,
      scope,
      classId: rawClassId,
      selectedClass,
      messageLength: message?.length || 0
    });

    // Validate message
    if (!message || !message.trim()) {
      throw new Error('Reminder message is required');
    }

    // Process recipient types - handle 'Both' option
    let recipientTypes = [];
    if (rawRecipientTypes.includes('Both')) {
      recipientTypes = ['Parent', 'Student'];
    } else {
      recipientTypes = rawRecipientTypes.filter(type => ['Parent', 'Student'].includes(type));
    }

    if (recipientTypes.length === 0) {
      throw new Error('At least one recipient type must be selected');
    }

    // Determine target class IDs based on scope
    let targetClassIds = [];
    
    if (scope === 'class') {
      // Specific class
      const targetClassId = rawClassId || (selectedClass !== 'All' ? selectedClass : null);
      if (targetClassId) {
        targetClassIds = [targetClassId];
      } else {
        throw new Error('No class selected for class-specific reminders');
      }
    } else {
      // All classes
      if (selectedClass !== 'All') {
        // If a specific class is currently selected, use only that class
        targetClassIds = [selectedClass];
      } else {
        // Use all available classes
        targetClassIds = classes.map(c => c.id).filter(Boolean);
      }
    }

    console.log('🎯 [ENHANCED_FEE_REMINDER] Target classes:', targetClassIds);

    // Send reminders for each class or globally
    let totalRecipients = 0;
    let totalPushNotifications = 0;
    let successfulClasses = 0;
    const results = [];

    if (targetClassIds.length === 0) {
      // Global reminder (no specific class)
      console.log('📢 [ENHANCED_FEE_REMINDER] Sending global reminder...');
      
      const result = await feeReminderNotificationService.sendFeeReminders({
        message: message.trim(),
        recipientTypes,
        classId: null, // Global
        feeInfo
      });

      if (result.success) {
        totalRecipients += result.recipientCount;
        totalPushNotifications += result.pushCount;
        successfulClasses = 1;
      }

      results.push(result);
    } else {
      // Class-specific reminders
      console.log(`📚 [ENHANCED_FEE_REMINDER] Sending reminders for ${targetClassIds.length} classes...`);
      
      for (const classId of targetClassIds) {
        console.log(`📝 [ENHANCED_FEE_REMINDER] Processing class: ${classId}`);
        
        const result = await feeReminderNotificationService.sendFeeReminders({
          message: message.trim(),
          recipientTypes,
          classId,
          feeInfo
        });

        if (result.success) {
          totalRecipients += result.recipientCount;
          totalPushNotifications += result.pushCount;
          successfulClasses++;
        }

        results.push({ classId, ...result });

        // Small delay between classes to avoid overwhelming the system
        if (targetClassIds.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    // Compile final result
    const overallSuccess = successfulClasses > 0;
    let resultMessage;

    if (overallSuccess) {
      if (targetClassIds.length <= 1) {
        resultMessage = `✅ Fee reminders sent successfully!\n📧 ${totalRecipients} recipients notified\n📱 ${totalPushNotifications} push notifications delivered`;
      } else {
        resultMessage = `✅ Fee reminders sent to ${successfulClasses}/${targetClassIds.length} classes!\n📧 ${totalRecipients} total recipients\n📱 ${totalPushNotifications} push notifications delivered`;
      }
    } else {
      resultMessage = '❌ Failed to send fee reminders. Please check your connection and try again.';
    }

    console.log('✅ [ENHANCED_FEE_REMINDER] Process completed:', {
      success: overallSuccess,
      totalRecipients,
      totalPushNotifications,
      successfulClasses,
      totalClasses: targetClassIds.length || 1
    });

    return {
      success: overallSuccess,
      message: resultMessage,
      details: {
        totalRecipients,
        totalPushNotifications,
        successfulClasses,
        totalClasses: targetClassIds.length || 1,
        results
      }
    };

  } catch (error) {
    console.error('❌ [ENHANCED_FEE_REMINDER] Error:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to send fee reminders: ${error.message}`
    };
  }
};

/**
 * Generate a default fee reminder message
 * @param {Object} feeInfo - Fee information
 * @param {number} feeInfo.totalOutstanding - Total outstanding amount
 * @param {string} feeInfo.dueDate - Due date for fee payment
 * @param {string} feeInfo.academicYear - Current academic year
 * @returns {string} Default reminder message
 */
export const generateDefaultFeeReminderMessage = (feeInfo = {}) => {
  const { totalOutstanding = 0, dueDate = null, academicYear = '2024-25' } = feeInfo;
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'as soon as possible';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'as soon as possible';
    }
  };

  let message = `Dear Parent/Student,\n\n`;
  message += `This is a reminder regarding pending fee payment for academic year ${academicYear}.\n\n`;
  
  if (totalOutstanding > 0) {
    message += `Outstanding Amount: ${formatCurrency(totalOutstanding)}\n`;
  }
  
  if (dueDate) {
    message += `Due Date: ${formatDate(dueDate)}\n`;
  }
  
  message += `\nPlease clear the dues at the earliest to avoid any inconvenience.\n\n`;
  message += `For any queries, please contact the school office.\n\n`;
  message += `Thank you for your cooperation.`;

  return message;
};

/**
 * Validate fee reminder options
 * @param {Object} options - Reminder options to validate
 * @returns {Object} Validation result with isValid flag and error message
 */
export const validateFeeReminderOptions = (options) => {
  const { message, recipientTypes, scope, classId, classes } = options;

  // Check message
  if (!message || !message.trim()) {
    return {
      isValid: false,
      error: 'Reminder message is required'
    };
  }

  if (message.trim().length < 10) {
    return {
      isValid: false,
      error: 'Reminder message is too short (minimum 10 characters)'
    };
  }

  if (message.trim().length > 500) {
    return {
      isValid: false,
      error: 'Reminder message is too long (maximum 500 characters)'
    };
  }

  // Check recipient types
  if (!recipientTypes || recipientTypes.length === 0) {
    return {
      isValid: false,
      error: 'At least one recipient type must be selected'
    };
  }

  const validRecipientTypes = ['Parent', 'Student', 'Both'];
  const hasValidRecipient = recipientTypes.some(type => validRecipientTypes.includes(type));
  if (!hasValidRecipient) {
    return {
      isValid: false,
      error: 'Invalid recipient type selected'
    };
  }

  // Check scope-specific requirements
  if (scope === 'class') {
    if (!classId) {
      return {
        isValid: false,
        error: 'Please select a class for class-specific reminders'
      };
    }

    if (classes && classes.length > 0) {
      const classExists = classes.some(c => c.id === classId);
      if (!classExists) {
        return {
          isValid: false,
          error: 'Selected class is not valid'
        };
      }
    }
  }

  return {
    isValid: true
  };
};