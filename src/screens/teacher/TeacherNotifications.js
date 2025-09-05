import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabase';
import universalNotificationService from '../../services/UniversalNotificationService';

const TeacherNotifications = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const getNotificationTitle = (type, message) => {
    // Extract title from message or use type-based defaults
    if (message && message.includes('approved')) {
      return 'Leave Request Approved';
    }
    if (message && message.includes('rejected')) {
      return 'Leave Request Rejected';
    }
    if (message && message.includes('leave')) {
      return 'Leave Update';
    }
    
    switch (type) {
      case 'leave_approved':
        return 'Leave Request Approved';
      case 'leave_rejected':
        return 'Leave Request Rejected';
      case 'leave_pending':
        return 'Leave Request Pending';
      case 'general':
        return 'General Notification';
      case 'announcement':
        return 'Announcement';
      default:
        return 'Notification';
    }
  };


  const fetchNotifications = async () => {
    try {
      if (!user?.id) return;

      console.log('📱 Fetching notifications for teacher user ID:', user.id);

      // Method: Use notification_recipients table to get notifications for this teacher
      // Now using proper Teacher recipient_type after database constraint update
      const { data: teacherNotificationRecipients, error: recipientError } = await supabase
        .from('notification_recipients')
        .select(`
          id,
          notification_id,
          recipient_id,
          recipient_type,
          delivery_status,
          sent_at,
          is_read,
          read_at,
          notifications!inner (
            id,
            type,
            message,
            delivery_mode,
            delivery_status,
            sent_by,
            scheduled_at,
            sent_at,
            created_at
          )
        `)
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'Teacher') // Now using proper Teacher recipient type
        .order('sent_at', { ascending: false });

      if (recipientError) {
        console.error('❌ Error fetching notification recipients:', recipientError);
        setNotifications([]);
        return;
      }

      console.log(`📨 Found ${teacherNotificationRecipients?.length || 0} notifications from recipients table`);
      
      // Debug: Check for duplicates by notification_id
      if (teacherNotificationRecipients && teacherNotificationRecipients.length > 0) {
        const notificationIds = teacherNotificationRecipients.map(r => r.notification_id);
        const uniqueNotificationIds = [...new Set(notificationIds)];
        
        if (notificationIds.length !== uniqueNotificationIds.length) {
          console.log('⚠️ DUPLICATE NOTIFICATIONS DETECTED!');
          console.log('📊 Total recipients:', notificationIds.length);
          console.log('📊 Unique notifications:', uniqueNotificationIds.length);
          console.log('📋 All notification IDs:', notificationIds);
          console.log('📋 Duplicate IDs:', notificationIds.filter((id, index) => notificationIds.indexOf(id) !== index));
        }
      }

      const teacherNotifications = [];

      if (teacherNotificationRecipients && teacherNotificationRecipients.length > 0) {
        // Transform recipient records into notification objects
        const seenNotificationIds = new Set(); // Track seen notification IDs to prevent duplicates
        
        for (const recipient of teacherNotificationRecipients) {
          const notification = recipient.notifications;
          if (!notification) continue;

          // Skip if we've already processed this notification ID
          if (seenNotificationIds.has(notification.id)) {
            console.log('⚠️ Skipping duplicate notification ID:', notification.id);
            continue;
          }
          seenNotificationIds.add(notification.id);

          // Determine type based on message content
          let notificationType = 'general';
          if (notification.message.includes('approved')) {
            notificationType = 'leave_approved';
          } else if (notification.message.includes('rejected')) {
            notificationType = 'leave_rejected';
          } else if (notification.message.includes('pending')) {
            notificationType = 'leave_pending';
          }

          teacherNotifications.push({
            id: recipient.id,
            notificationId: notification.id,
            title: getNotificationTitle(notificationType, notification.message),
            message: notification.message,
            type: notificationType,
            isRead: recipient.is_read || false, // Use is_read from notification_recipients
            createdAt: notification.created_at,
            sentAt: recipient.sent_at,
            deliveryStatus: recipient.delivery_status,
            source: 'notification_recipients'
          });
        }
        
        console.log('📊 Processed notifications after deduplication:', teacherNotifications.length);
      }

      // Sort notifications by creation date (newest first)
      teacherNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('📊 Total notifications:', teacherNotifications.length);
      console.log('📊 Unread notifications:', teacherNotifications.filter(n => !n.isRead).length);
      
      setNotifications(teacherNotifications);
      
    } catch (error) {
      console.error('❌ Error in fetchNotifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId) => {
    try {
      console.log('🔔 [TEACHER_NOTIF] Marking notification as read:', notificationId);
      
      // Find the notification to get its actual notification_id for broadcasting
      const notification = notifications.find(n => n.id === notificationId);
      const actualNotificationId = notification?.notificationId || notificationId;
      
      // Update the notification_recipients table
      const { error: updateError } = await supabase
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('recipient_id', user.id);
      
      if (updateError) {
        console.error('❌ Error updating notification_recipients:', updateError);
        return;
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      
      console.log('📖 Marked notification as read in database:', notificationId);
      
      // Broadcast the notification read event for immediate badge updates
      try {
        console.log('📣 [TEACHER_NOTIF] Broadcasting notification read event...');
        await universalNotificationService.broadcastNotificationRead(user.id, actualNotificationId);
        console.log('✅ [TEACHER_NOTIF] Broadcast successful');
      } catch (broadcastError) {
        console.warn('⚠️ [TEACHER_NOTIF] Broadcast failed (not critical):', broadcastError);
        // Broadcasting is not critical, continue even if it fails
      }
      
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(notif => !notif.isRead);

      if (unreadNotifications.length === 0) {
        Alert.alert('Info', 'All notifications are already read.');
        return;
      }

      console.log('🔔 [TEACHER_NOTIF] Marking all notifications as read:', unreadNotifications.length);

      // Update all unread notifications in notification_recipients table
      const { error: updateError } = await supabase
        .from('notification_recipients')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'Teacher') // Now using proper Teacher recipient type
        .eq('is_read', false);
      
      if (updateError) {
        console.error('❌ Error updating all notifications:', updateError);
        Alert.alert('Error', 'Failed to mark notifications as read.');
        return;
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      Alert.alert('Success', 'All notifications marked as read.');
      console.log('📖 Marked all notifications as read in database');
      
      // Broadcast notification read events for immediate badge updates
      try {
        console.log('📣 [TEACHER_NOTIF] Broadcasting bulk notification read events...');
        // Broadcast for each unread notification
        const broadcastPromises = unreadNotifications.map(notif => 
          universalNotificationService.broadcastNotificationRead(user.id, notif.notificationId || notif.id)
        );
        await Promise.all(broadcastPromises);
        console.log('✅ [TEACHER_NOTIF] Bulk broadcast successful');
      } catch (broadcastError) {
        console.warn('⚠️ [TEACHER_NOTIF] Bulk broadcast failed (not critical):', broadcastError);
        // Broadcasting is not critical, continue even if it fails
      }
      
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read.');
    }
  };

  const deleteNotification = async (notificationId) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // For leave notifications, we just remove from local state since they're not in notification_recipients
              // In a production system, you'd want to create a proper teacher notification tracking table
              
              setNotifications(prev => 
                prev.filter(notif => notif.id !== notificationId)
              );
              
              console.log('🗑️ Deleted notification locally:', notificationId);
            } catch (error) {
              console.error('Error deleting notification:', error);
              Alert.alert('Error', 'Failed to delete notification.');
            }
          }
        }
      ]
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'leave_approved':
        return 'checkmark-circle';
      case 'leave_rejected':
        return 'close-circle';
      case 'leave_pending':
        return 'time';
      case 'general':
        return 'information-circle';
      case 'announcement':
        return 'megaphone';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'leave_approved':
        return '#4CAF50';
      case 'leave_rejected':
        return '#F44336';
      case 'leave_pending':
        return '#FF9800';
      case 'general':
        return '#2196F3';
      case 'announcement':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  const renderNotification = ({ item }) => {
    const iconName = getNotificationIcon(item.type);
    const iconColor = getNotificationColor(item.type);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.isRead && styles.unreadNotification
        ]}
        onPress={() => markAsRead(item.id)}
        onLongPress={() => deleteNotification(item.id)}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.notificationIcon, { backgroundColor: `${iconColor}20` }]}>
            <Ionicons name={iconName} size={24} color={iconColor} />
          </View>
          
          <View style={styles.notificationText}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>
              {new Date(item.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Notifications" showBack={true} navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Notifications" showBack={true} navigation={navigation} />
      
      {notifications.length > 0 && (
        <View style={styles.actionBar}>
          <View style={styles.notificationStats}>
            <Text style={styles.statsText}>
              {notifications.filter(n => !n.isRead).length} unread
            </Text>
          </View>
          {notifications.filter(n => !n.isRead).length > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done" size={16} color="#1976d2" />
              <Text style={styles.markAllText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id.toString()}
        style={styles.notificationsList}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyMessage}>
              You'll see notifications about leave approvals and other updates here
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
    fontSize: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationStats: {
    flex: 1,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
  },
  markAllText: {
    marginLeft: 4,
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1976d2',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});

export default TeacherNotifications;
