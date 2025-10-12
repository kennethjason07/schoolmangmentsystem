/**
 * Parent Chat Badge Utilities
 * 
 * Specialized functions to diagnose and fix chat badge count issues
 * specifically for parent users.
 */

import { supabase, TABLES } from './supabase';
import { getCachedTenantId } from './tenantHelpers';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * Diagnose parent chat badge issues
 * @param {string} parentUserId - Parent user ID
 * @returns {Promise<Object>} Diagnostic results
 */
export const diagnoseParentChatBadge = async (parentUserId) => {
  console.log('🔍 Starting parent chat badge diagnosis for user:', parentUserId);
  
  const results = {
    timestamp: new Date().toISOString(),
    parentUserId,
    issues: [],
    recommendations: [],
    counts: {
      totalMessages: 0,
      unreadMessages: 0,
      crossTenantMessages: 0,
      notifications: 0
    },
    messages: []
  };

  try {
    // Get parent's tenant ID
    let parentTenantId = null;
    try {
      parentTenantId = getCachedTenantId();
      results.parentTenantId = parentTenantId;
    } catch (e) {
      results.issues.push('Could not determine parent tenant ID');
    }

    // 1. Check all messages for this parent
    const { data: allMessages, error: msgError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, receiver_id, is_read, message, sent_at, tenant_id, student_id')
      .eq('receiver_id', parentUserId)
      .order('sent_at', { ascending: false });

    if (msgError) {
      results.issues.push(`Message query error: ${msgError.message}`);
      return results;
    }

    results.counts.totalMessages = allMessages?.length || 0;
    results.messages = allMessages || [];

    // 2. Analyze unread messages
    const unreadMessages = allMessages?.filter(msg => msg.is_read === false) || [];
    results.counts.unreadMessages = unreadMessages.length;

    // 3. Check for cross-tenant messages
    if (parentTenantId) {
      const crossTenantMessages = unreadMessages.filter(msg => 
        msg.tenant_id && msg.tenant_id !== parentTenantId
      );
      results.counts.crossTenantMessages = crossTenantMessages.length;
      
      if (crossTenantMessages.length > 0) {
        results.issues.push({
          type: 'cross_tenant_messages',
          count: crossTenantMessages.length,
          description: 'Found unread messages from different tenants affecting badge count',
          messages: crossTenantMessages.map(msg => ({
            id: msg.id,
            messageTenant: msg.tenant_id,
            parentTenant: parentTenantId,
            sender: msg.sender_id,
            sent: msg.sent_at
          }))
        });
        
        results.recommendations.push({
          type: 'fix_cross_tenant',
          action: 'Mark cross-tenant messages as read or filter them out',
          severity: 'high'
        });
      }
    }

    // 4. Check notifications
    const { data: notifications, error: notifError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        is_read,
        notifications(
          id,
          message,
          type,
          tenant_id
        )
      `)
      .eq('recipient_id', parentUserId)
      .eq('is_read', false);

    if (!notifError) {
      results.counts.notifications = notifications?.length || 0;
    }

    // 5. Calculate expected vs actual badge count
    const expectedBadgeCount = results.counts.unreadMessages + results.counts.notifications;
    results.expectedBadgeCount = expectedBadgeCount;

    // 6. Provide specific recommendations
    if (results.counts.unreadMessages === 0 && results.counts.notifications === 0) {
      results.recommendations.push({
        type: 'clear_cache',
        action: 'Clear badge cache and force refresh',
        severity: 'medium'
      });
    }

    if (results.counts.unreadMessages > 0) {
      results.recommendations.push({
        type: 'check_legitimacy',
        action: 'Verify if unread messages should actually be marked as read',
        severity: 'medium',
        details: `Found ${results.counts.unreadMessages} unread messages`
      });
    }

    console.log('✅ Parent chat badge diagnosis complete:', results);
    return results;

  } catch (error) {
    results.issues.push(`Diagnosis error: ${error.message}`);
    console.error('❌ Error during parent chat badge diagnosis:', error);
    return results;
  }
};

/**
 * Auto-fix parent chat badge issues
 * @param {string} parentUserId - Parent user ID
 * @param {Array} fixTypes - Types of fixes to apply
 * @returns {Promise<Object>} Fix results
 */
export const fixParentChatBadge = async (parentUserId, fixTypes = ['cross_tenant', 'clear_cache']) => {
  console.log('🔧 Starting parent chat badge fixes for user:', parentUserId);
  
  const results = {
    timestamp: new Date().toISOString(),
    parentUserId,
    fixesApplied: [],
    errors: []
  };

  try {
    // Get current diagnosis
    const diagnosis = await diagnoseParentChatBadge(parentUserId);
    
    // Fix 1: Mark cross-tenant messages as read
    if (fixTypes.includes('cross_tenant') && diagnosis.counts.crossTenantMessages > 0) {
      try {
        const parentTenantId = getCachedTenantId();
        if (parentTenantId) {
          const { error: updateError, count } = await supabase
            .from(TABLES.MESSAGES)
            .update({ is_read: true })
            .eq('receiver_id', parentUserId)
            .eq('is_read', false)
            .neq('tenant_id', parentTenantId);

          if (updateError) {
            results.errors.push(`Cross-tenant fix failed: ${updateError.message}`);
          } else {
            results.fixesApplied.push({
              type: 'cross_tenant_messages_marked_read',
              messagesFixed: count,
              description: 'Marked cross-tenant messages as read'
            });
          }
        }
      } catch (error) {
        results.errors.push(`Cross-tenant fix error: ${error.message}`);
      }
    }

    // Fix 2: Clear cache
    if (fixTypes.includes('clear_cache')) {
      try {
        universalNotificationService.clearCache(parentUserId, 'parent');
        results.fixesApplied.push({
          type: 'cache_cleared',
          description: 'Cleared notification service cache'
        });
      } catch (error) {
        results.errors.push(`Cache clear error: ${error.message}`);
      }
    }

    // Fix 3: Mark all unread messages as read (if explicitly requested)
    if (fixTypes.includes('mark_all_read')) {
      try {
        const { error: markAllError, count } = await supabase
          .from(TABLES.MESSAGES)
          .update({ is_read: true })
          .eq('receiver_id', parentUserId)
          .eq('is_read', false);

        if (markAllError) {
          results.errors.push(`Mark all read failed: ${markAllError.message}`);
        } else {
          results.fixesApplied.push({
            type: 'all_messages_marked_read',
            messagesFixed: count,
            description: 'Marked all unread messages as read'
          });
        }
      } catch (error) {
        results.errors.push(`Mark all read error: ${error.message}`);
      }
    }

    // Broadcast update to refresh badges
    try {
      await universalNotificationService.broadcastMessageRead(parentUserId, 'ALL');
      results.fixesApplied.push({
        type: 'broadcast_sent',
        description: 'Sent broadcast to refresh all badges'
      });
    } catch (error) {
      results.errors.push(`Broadcast error: ${error.message}`);
    }

    console.log('✅ Parent chat badge fixes complete:', results);
    return results;

  } catch (error) {
    results.errors.push(`Fix process error: ${error.message}`);
    console.error('❌ Error during parent chat badge fixes:', error);
    return results;
  }
};

/**
 * Monitor parent chat badge in real-time for debugging
 * @param {string} parentUserId - Parent user ID
 * @param {Function} onUpdate - Callback for updates
 * @returns {Function} Cleanup function
 */
export const monitorParentChatBadge = (parentUserId, onUpdate) => {
  console.log('📡 Starting parent chat badge monitoring for user:', parentUserId);
  
  let cleanupFunctions = [];

  // Monitor messages table changes
  const messagesChannel = supabase
    .channel(`parent-badge-monitor-${parentUserId}-${Date.now()}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: TABLES.MESSAGES, 
        filter: `receiver_id=eq.${parentUserId}` 
      }, 
      async (payload) => {
        console.log('📨 Message change detected for parent:', payload);
        
        // Re-diagnose after change
        const diagnosis = await diagnoseParentChatBadge(parentUserId);
        
        if (onUpdate) {
          onUpdate({
            type: 'message_change',
            event: payload.eventType,
            payload: payload,
            diagnosis: diagnosis,
            timestamp: new Date().toISOString()
          });
        }
      }
    )
    .subscribe();

  cleanupFunctions.push(() => messagesChannel.unsubscribe());

  // Return cleanup function
  return () => {
    console.log('🛑 Stopping parent chat badge monitoring');
    cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    });
  };
};

/**
 * Quick fix for common parent badge issues
 * @param {string} parentUserId - Parent user ID
 * @returns {Promise<Object>} Quick fix results
 */
export const quickFixParentBadge = async (parentUserId) => {
  console.log('⚡ Applying quick fix for parent badge:', parentUserId);
  
  try {
    // 1. Clear cache
    universalNotificationService.clearCache(parentUserId, 'parent');
    
    // 2. Force refresh with proper tenant filtering
    const tenantId = getCachedTenantId();
    
    let query = supabase
      .from(TABLES.MESSAGES)
      .select('id')
      .eq('receiver_id', parentUserId)
      .eq('is_read', false);
      
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    const actualCount = data?.length || 0;
    
    // 3. Broadcast update
    await universalNotificationService.broadcastMessageRead(parentUserId, 'REFRESH');
    
    console.log('✅ Quick fix applied. Actual unread count:', actualCount);
    
    return {
      success: true,
      actualCount,
      tenantUsed: tenantId,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Quick fix failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Export all utilities
export default {
  diagnoseParentChatBadge,
  fixParentChatBadge,
  monitorParentChatBadge,
  quickFixParentBadge
};