import { useState, useEffect } from 'react';
import { supabase, getUserTenantId } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';

/**
 * Custom hook to fetch unread notification count from notification_recipients table
 * 
 * @param {string} recipientType - The recipient type: 'Admin', 'Teacher', 'Parent', 'Student'
 * @returns {object} - Object containing unreadCount and refresh function
 */
export const useUnreadNotificationCount = (recipientType = 'Student') => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // console.log('🔔 useUnreadNotificationCount hook initialized with recipientType:', recipientType);

  const fetchUnreadCount = async () => {
    try {
      if (!user?.id) {
        console.log('⚠️ No user ID available, setting count to 0');
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      // Log for debugging when needed
      if (recipientType === 'Admin' || recipientType === 'Student') {
        console.log(`🔔 ${recipientType} notification count fetch for:`, user.email || user.id);
      }
      
      // Debug: Check what's in the table for this user
      const { data: debugData, error: debugError } = await supabase
        .from('notification_recipients')
        .select('id, recipient_id, recipient_type, is_read, notification_id, created_at')
        .eq('recipient_id', user.id);
      
      // Show debug for Admin and Student users
      if (recipientType === 'Admin' || recipientType === 'Student') {
        console.log(`🔍 ${recipientType} Debug - All notifications for this user ID:`, debugData || 'none');
        
        if (debugData) {
          const targetNotifications = debugData.filter(d => d.recipient_type === recipientType);
          const unreadTargetNotifications = targetNotifications.filter(d => !d.is_read);
          console.log(`📊 Total ${recipientType} notifications:`, targetNotifications.length);
          console.log(`📊 Unread ${recipientType} notifications:`, unreadTargetNotifications.length);
          console.log(`📊 ${recipientType} notification details:`, targetNotifications.slice(0, 5));
          
          // Check for notifications with wrong recipient_type
          const wrongTypeNotifications = debugData.filter(d => d.recipient_type !== recipientType);
          if (wrongTypeNotifications.length > 0) {
            console.log(`⚠️ WARNING: ${recipientType} user has notifications with wrong type:`, wrongTypeNotifications.slice(0, 3));
          }
        }
      }
      
      // Enhanced debugging for Admin case
      if (recipientType === 'Admin') {
        console.log('🔥 ADMIN DEBUG - Enhanced logging:');
        if (debugData) {
          const adminNotifications = debugData.filter(d => d.recipient_type === 'Admin');
          const unreadAdminNotifications = adminNotifications.filter(d => !d.is_read);
          console.log('🔥 Total Admin notifications:', adminNotifications.length);
          console.log('🔥 Unread Admin notifications:', unreadAdminNotifications.length);
          console.log('🔥 Admin notification details:', adminNotifications);
          
          // Check if there are notifications with wrong recipient_type
          const nonAdminNotifications = debugData.filter(d => d.recipient_type !== 'Admin');
          if (nonAdminNotifications.length > 0) {
            console.log('⚠️ WARNING: Admin user has non-Admin notifications:', nonAdminNotifications);
          }
        }
      }

      // Get tenant_id for proper filtering
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.warn('⚠️ No tenant_id available for notification filtering, setting count to 0');
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      // Fetch unread notifications with the same logic as StudentNotifications screen
      // We need to get the actual notification data to apply the same filtering
      const { data: notificationData, error: notificationError } = await supabase
        .from('notification_recipients')
        .select(`
          id,
          is_read,
          notifications(
            id,
            message,
            type,
            delivery_status,
            delivery_mode
          )
        `)
        .eq('recipient_id', user.id)
        .eq('recipient_type', recipientType)
        .eq('tenant_id', tenantId)
        .eq('is_read', false);

      if (notificationError) {
        console.error('❌ Error fetching unread notifications:', notificationError);
        setUnreadCount(0);
        return;
      }

      if (!notificationData || notificationData.length === 0) {
        console.log(`📊 No unread ${recipientType} notifications found`);
        setUnreadCount(0);
        return;
      }

      // For Student notifications, get student class info for filtering
      let studentClassInfo = null;
      if (recipientType === 'Student') {
        try {
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('id, class_id, classes(id, class_name, section)')
            .eq('id', user.linked_student_id)
            .eq('tenant_id', tenantId)
            .single();
            
          if (!studentError && studentData) {
            studentClassInfo = studentData;
          }
        } catch (err) {
          console.log('Could not fetch student class info for filtering:', err);
        }
      }

      // Apply the same filtering logic as StudentNotifications screen
      const filteredNotifications = notificationData.filter(record => {
        const notification = record.notifications;
        if (!notification || !notification.message) return false;
        
        const message = notification.message.toLowerCase();
        
        // 1. Filter out leave notifications (same logic as StudentNotifications)
        const isLeaveNotification = message.includes('leave') || 
                                   message.includes('absent') || 
                                   message.includes('vacation') || 
                                   message.includes('sick') ||
                                   message.includes('time off');
        
        if (isLeaveNotification) {
          if (recipientType === 'Student') {
            console.log(`🚫 Filtering out leave notification from count: ${notification.message.substring(0, 50)}...`);
          }
          return false;
        }
        
        // 2. For Student notifications, filter by class (same logic as StudentNotifications)
        if (recipientType === 'Student' && studentClassInfo) {
          const studentClass = studentClassInfo.classes?.class_name || '';
          
          // Look for class mentions in the message
          const classPatterns = [
            /class\s+(\d+|[ivxlc]+)/gi,
            /grade\s+(\d+|[ivxlc]+)/gi,
            /(\d+)(st|nd|rd|th)\s*class/gi,
            /for\s+class\s+(\d+|[ivxlc]+)/gi,
          ];
          
          for (const pattern of classPatterns) {
            const matches = [...message.matchAll(pattern)];
            for (const match of matches) {
              const mentionedClass = match[1]?.toLowerCase();
              if (mentionedClass && mentionedClass !== studentClass.toLowerCase()) {
                console.log(`🚫 Filtering out class-specific notification from count: mentioned class "${mentionedClass}" doesn't match student's class "${studentClass}"`);
                return false;
              }
            }
          }
        }
        
        return true;
      });

      const notificationCount = filteredNotifications.length;
      
      // Log results for debugging
      if (recipientType === 'Admin' || recipientType === 'Student') {
        console.log(`📊 ${recipientType} Raw unread notifications:`, notificationData.length);
        console.log(`📊 ${recipientType} After filtering:`, notificationCount);
        console.log(`📊 ${recipientType} Filtered out:`, notificationData.length - notificationCount);
      }
      
      setUnreadCount(notificationCount);
      
      // Final log for debugging
      if (recipientType === 'Admin' || recipientType === 'Student') {
        console.log(`✅ ${recipientType} final unread count set to:`, notificationCount);
      }
    } catch (err) {
      console.error('❌ useUnreadNotificationCount error:', err);
      setError(err.message);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      // Only log initial fetch for Admin users
      if (recipientType === 'Admin') {
        console.log('🔄 Initial Admin notification fetch triggered for user:', user.id);
      }
      fetchUnreadCount();
    }
  }, [user?.id, recipientType]);

  // Remove the excessive periodic refresh timer - rely on real-time subscriptions instead

  // Set up real-time subscription for notification updates
  useEffect(() => {
    if (!user?.id) return;

    // Only log subscription setup for Admin users
    if (recipientType === 'Admin') {
      console.log('🔄 Setting up Admin notification subscription for:', user.id);
    }

    const subscription = supabase
      .channel(`notification-count-updates-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notification_recipients',
        filter: `recipient_id=eq.${user.id}`
      }, (payload) => {
        // Only log changes for Admin users
        if (recipientType === 'Admin') {
          console.log('🔔 Admin notification recipients changed:', payload);
        }
        // Refresh the count when notifications change
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      if (recipientType === 'Admin') {
        console.log('🔄 Unsubscribing from Admin notification updates');
      }
      subscription.unsubscribe();
    };
  }, [user?.id, recipientType]);

  // Manual refresh function
  const refresh = () => {
    setLoading(true);
    setError(null);
    fetchUnreadCount();
  };

  return {
    unreadCount: Math.max(0, unreadCount), // Ensure non-negative
    loading,
    error,
    refresh
  };
};

export default useUnreadNotificationCount;
