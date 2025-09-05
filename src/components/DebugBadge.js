import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { supabase, TABLES } from '../utils/supabase';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * DebugBadge - Simple component to debug badge count issues
 */
const DebugBadge = ({ style = {} }) => {
  const { user, userType } = useAuth();
  const [counts, setCounts] = useState({ messageCount: 0, notificationCount: 0, totalCount: 0 });
  const [debugInfo, setDebugInfo] = useState('Loading...');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id && userType) {
      testCounts();
    }
  }, [user?.id, userType]);

  const testCounts = async () => {
    try {
      console.log('🔍 [DEBUG BADGE] Starting count test for:', { userId: user.id, userType });
      setDebugInfo('Testing...');
      
      // Clear cache first to get fresh data
      universalNotificationService.clearCache(user.id, userType);
      console.log('🔍 [DEBUG BADGE] Cleared cache for user');
      
      // Test 1: Direct message count
      const { data: messages, error: msgError } = await supabase
        .from(TABLES.MESSAGES)
        .select('id, sender_id, receiver_id, is_read, message')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      console.log('🔍 [DEBUG BADGE] Raw unread messages:', messages);
      console.log('🔍 [DEBUG BADGE] Message query error:', msgError);

      // Test 2: Direct notification count
      const recipientType = getRecipientType(userType);
      const { data: notifications, error: notifError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select(`
          id,
          is_read,
          notifications(id, message, type)
        `)
        .eq('recipient_id', user.id)
        .eq('recipient_type', recipientType)
        .eq('is_read', false);

      console.log('🔍 [DEBUG BADGE] Raw unread notifications:', notifications);
      console.log('🔍 [DEBUG BADGE] Notification query error:', notifError);

      // Test 3: Universal service count
      const serviceCounts = await universalNotificationService.getUnreadCounts(user.id, userType);
      console.log('🔍 [DEBUG BADGE] Service counts:', serviceCounts);

      const messageCount = messages?.length || 0;
      const notificationCount = notifications?.length || 0;
      const totalCount = messageCount + notificationCount;

      setCounts({
        messageCount,
        notificationCount,
        totalCount
      });

      setDebugInfo(`Messages: ${messageCount}, Notifications: ${notificationCount}, Service: ${serviceCounts.totalCount}`);
      
      if (msgError || notifError) {
        setError(`MsgErr: ${msgError?.message || 'OK'}, NotifErr: ${notifError?.message || 'OK'}`);
      }
      
    } catch (err) {
      console.error('🔍 [DEBUG BADGE] Error:', err);
      setError(err.message);
      setDebugInfo('Error occurred');
    }
  };

  const getRecipientType = (userType) => {
    const typeMap = {
      'admin': 'Admin',
      'teacher': 'Teacher', 
      'parent': 'Parent',
      'student': 'Student'
    };
    return typeMap[userType?.toLowerCase()] || 'Student';
  };

  const showDetails = () => {
    Alert.alert(
      'Debug Badge Details',
      `User: ${user?.email}\nType: ${userType}\nMessages: ${counts.messageCount}\nNotifications: ${counts.notificationCount}\nTotal: ${counts.totalCount}\n\nInfo: ${debugInfo}\n\nError: ${error || 'None'}`,
      [
        { text: 'Refresh', onPress: testCounts },
        { text: 'OK' }
      ]
    );
  };

  if (!user?.id || !userType) {
    return (
      <View style={[styles.badge, { backgroundColor: '#999' }, style]}>
        <Text style={styles.badgeText}>?</Text>
      </View>
    );
  }

  // Always show badge in debug mode, even if count is 0
  return (
    <TouchableOpacity 
      style={[styles.badge, style]} 
      onPress={showDetails}
      activeOpacity={0.7}
    >
      <Text style={styles.badgeText}>
        {counts.totalCount > 99 ? '99+' : counts.totalCount.toString()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default DebugBadge;
