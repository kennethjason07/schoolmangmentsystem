import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../utils/AuthContext';
import { supabase, TABLES, getUserTenantId } from '../utils/supabase';

/**
 * Web-Optimized Notification Badge Component
 * 
 * This component provides a simple, reliable notification count badge
 * with enhanced web platform compatibility.
 * 
 * Features:
 * - Direct database queries for reliability
 * - Web platform optimizations
 * - Fallback for Supabase subscription issues
 * - Manual refresh capability
 * - Platform-specific styling
 */
const WebOptimizedNotificationBadge = ({ 
  style, 
  textStyle, 
  showZero = false, 
  onCountChange,
  userType = 'Student',
  testID = 'web-notification-badge'
}) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Debug logging for web development
  const debugLog = (message, data = '') => {
    if (Platform.OS === 'web') {
      console.log(`🔔 [WebNotificationBadge - ${userType}] ${message}`, data);
    }
  };

  // Get user type for database queries
  const getUserTypeForDB = (userType) => {
    const typeMap = {
      'admin': 'Admin',
      'teacher': 'Teacher', 
      'parent': 'Parent',
      'student': 'Student'
    };
    return typeMap[userType?.toLowerCase()] || 'Student';
  };

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id || !userType) {
      debugLog('No user or userType, resetting counts');
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoading(true);
      debugLog('Fetching counts for user', { userId: user.id, userType });
      
      // Get tenant_id for filtering
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        debugLog('No tenant ID available');
        setUnreadCount(0);
        return;
      }

      const recipientType = getUserTypeForDB(userType);
      debugLog('Using recipient type:', recipientType);

      // Get unread notifications with filtering
      const { data: notificationData, error } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
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

      if (error) {
        debugLog('Error fetching unread notifications:', error);
        setUnreadCount(0);
        return;
      }

      if (!notificationData || notificationData.length === 0) {
        debugLog('No unread notifications found');
        setUnreadCount(0);
        return;
      }

      // Apply filtering logic (similar to notification screens)
      let filteredNotifications = notificationData.filter(record => {
        const notification = record.notifications;
        if (!notification || !notification.message) return false;
        
        const message = notification.message.toLowerCase();
        
        // Filter out system leave notifications
        const isSystemLeaveNotification = (
          (message.includes('absent') && !message.includes('request')) ||
          (message.includes('on leave') && !message.includes('request')) ||
          (message.includes('vacation') && !message.includes('request')) ||
          (message.includes('time off') && !message.includes('request'))
        );
        
        // Keep important leave-related notifications
        const isImportantLeaveNotification = (
          message.includes('approved') ||
          message.includes('denied') ||
          message.includes('rejected') ||
          message.includes('processed') ||
          message.includes('pending') ||
          message.includes('submitted')
        );
        
        if (isSystemLeaveNotification && !isImportantLeaveNotification) {
          return false;
        }
        
        return true;
      });

      // Additional filtering for student notifications based on class
      if (userType.toLowerCase() === 'student') {
        try {
          const { data: studentData, error: studentError } = await supabase
            .from(TABLES.STUDENTS)
            .select('id, class_id, classes(id, class_name, section)')
            .eq('id', user.linked_student_id)
            .eq('tenant_id', tenantId)
            .single();
            
          if (!studentError && studentData?.classes?.class_name) {
            const studentClass = studentData.classes.class_name;
            
            filteredNotifications = filteredNotifications.filter(record => {
              const message = record.notifications.message.toLowerCase();
              
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
              
              return true;
            });
          }
        } catch (err) {
          debugLog('Could not fetch student class info for filtering:', err);
        }
      }

      const count = filteredNotifications.length;
      debugLog('Final count after filtering:', count);
      setUnreadCount(count);
      
      // Call callback if provided
      if (onCountChange) {
        onCountChange({ 
          messageCount: 0, // We're not counting messages in this component
          notificationCount: count, 
          totalCount: count 
        });
      }
    } catch (error) {
      debugLog('Error in fetchUnreadCount:', error);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userType, onCountChange]);

  // Set up real-time subscription (web-optimized)
  useEffect(() => {
    if (!user?.id || !userType) return;

    debugLog('Setting up subscription');

    // Initial fetch
    fetchUnreadCount();

    // Set up subscription with better error handling for web
    let subscription;
    
    const setupSubscription = () => {
      try {
        subscription = supabase
          .channel(`notification-count-updates-${user.id}-${Date.now()}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notification_recipients',
            filter: `recipient_id=eq.${user.id}`
          }, (payload) => {
            debugLog('Notification recipients changed:', payload);
            // Refresh the count when notifications change
            setTimeout(() => fetchUnreadCount(), 100);
          })
          .subscribe((status) => {
            debugLog('Subscription status:', status);
            if (status === 'SUBSCRIBED') {
              debugLog('Successfully subscribed to notifications');
            } else if (status === 'CHANNEL_ERROR') {
              debugLog('Subscription error, will retry');
              // For web, we'll rely more on manual refreshes
              if (Platform.OS !== 'web') {
                // Only retry on mobile platforms
                setTimeout(setupSubscription, 5000);
              }
            }
          });
      } catch (error) {
        debugLog('Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      debugLog('Cleaning up subscription');
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [user?.id, userType, fetchUnreadCount]);

  // Refresh when screen comes into focus (web-friendly)
  useFocusEffect(
    useCallback(() => {
      debugLog('Screen focused, refreshing counts');
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // For web, also refresh periodically as a fallback
  useEffect(() => {
    if (Platform.OS === 'web') {
      const interval = setInterval(() => {
        debugLog('Web periodic refresh');
        fetchUnreadCount();
      }, 30000); // Refresh every 30 seconds on web

      return () => clearInterval(interval);
    }
  }, [fetchUnreadCount]);

  // Don't render if count is 0 and showZero is false
  if (!showZero && unreadCount === 0) {
    return null;
  }

  // Don't render if loading and no cached count
  if (isLoading && unreadCount === 0) {
    return null;
  }

  return (
    <View 
      style={[styles.badge, style]} 
      testID={testID}
      accessible={true}
      accessibilityLabel={`${unreadCount} unread notifications`}
      accessibilityRole="text"
    >
      <Text 
        style={[styles.badgeText, textStyle]}
        testID={`${testID}-text`}
      >
        {unreadCount > 99 ? '99+' : unreadCount.toString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f44336',
    borderRadius: Platform.OS === 'web' ? 10 : 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
      },
      android: {
        elevation: 3,
      },
      web: {
        // Web-specific styles
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: '2px solid #fff',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2.22,
        elevation: 3,
      }
    }),
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    ...Platform.select({
      web: {
        userSelect: 'none', // Prevent text selection on web
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }
    }),
  },
});

export default WebOptimizedNotificationBadge;
