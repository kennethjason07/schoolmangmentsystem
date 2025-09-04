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

      // Simplified logging
      // console.log(`🔔 ${recipientType} notification count fetch for:`, user.email || user.id);

      // Get tenant_id for proper filtering
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.error('❌ Cannot fetch notification count: tenant_id is null');
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
                return false;
              }
            }
          }
        }
        
        return true;
      });

      const notificationCount = filteredNotifications.length;
      
      setUnreadCount(notificationCount);
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
