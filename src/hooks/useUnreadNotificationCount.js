import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
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

      // Only log for debugging when needed
      if (recipientType === 'Admin') {
        console.log('🔔 Admin notification count fetch for:', user.email);
      }
      
      // Debug: Check what's in the table for this user
      const { data: debugData, error: debugError } = await supabase
        .from('notification_recipients')
        .select('id, recipient_id, recipient_type, is_read')
        .eq('recipient_id', user.id);
      
      // Only show debug for Admin users to reduce noise
      if (recipientType === 'Admin') {
        console.log('🔍 Admin Debug - All notifications for this user ID:', debugData || 'none');
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

      // Count unread notifications from notification_recipients table
      const { data, error: notificationError, count } = await supabase
        .from('notification_recipients')
        .select('id', { count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('recipient_type', recipientType)
        .eq('is_read', false);

      // Only log query results for Admin to debug the issue
      if (recipientType === 'Admin') {
        console.log('📊 Admin Query result:', { data, count, error: notificationError });
      }

      if (notificationError) {
        console.error('❌ Error fetching unread notifications:', notificationError);
        setUnreadCount(0);
      } else {
        const notificationCount = count || data?.length || 0;
        
        // TEMPORARY DEBUG: Double-check the count for Admin users
        if (recipientType === 'Admin') {
          console.log('🔥 ADMIN FINAL COUNT DEBUG:');
          console.log('🔥 Raw count from query:', count);
          console.log('🔥 Data length:', data?.length);
          console.log('🔥 Final calculated count:', notificationCount);
          
          // Manual verification query for admin
          const { data: manualVerifyData, error: manualError } = await supabase
            .from('notification_recipients')
            .select('*')
            .eq('recipient_id', user.id)
            .eq('recipient_type', 'Admin')
            .eq('is_read', false);
            
          console.log('🔥 Manual verification - unread admin notifications:', manualVerifyData?.length || 0);
          console.log('🔥 Manual verification - data:', manualVerifyData);
          console.log('🔥 Manual verification - error:', manualError);
          
          // Use the manual verification result if there's a discrepancy
          const manualCount = manualVerifyData?.length || 0;
          if (manualCount !== notificationCount) {
            console.log('⚠️ DISCREPANCY FOUND! Using manual count:', manualCount, 'instead of:', notificationCount);
            setUnreadCount(manualCount);
            return;
          }
        }
        
        setUnreadCount(notificationCount);
        // Only log final count for Admin to debug the issue
        if (recipientType === 'Admin') {
          console.log('✅ Admin final unread count set to:', notificationCount);
        }
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
