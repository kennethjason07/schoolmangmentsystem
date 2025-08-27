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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase } from '../../utils/supabase';

const TeacherNotifications = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readNotifications, setReadNotifications] = useState(new Set());
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

  // Load read notifications from AsyncStorage
  const loadReadNotifications = async () => {
    try {
      if (!user?.id) return new Set();
      const key = `teacher_read_notifications_${user.id}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
      console.error('Error loading read notifications:', error);
      return new Set();
    }
  };

  // Save read notifications to AsyncStorage
  const saveReadNotifications = async (readIds) => {
    try {
      if (!user?.id) return;
      const key = `teacher_read_notifications_${user.id}`;
      await AsyncStorage.setItem(key, JSON.stringify([...readIds]));
    } catch (error) {
      console.error('Error saving read notifications:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!user?.id) return;

      console.log('📱 Fetching notifications for teacher user ID:', user.id);

      // First, get teacher profile to find linked teacher ID
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('linked_teacher_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
      }

      const linkedTeacherId = userProfile?.linked_teacher_id;
      console.log('👩‍🏫 Linked teacher ID:', linkedTeacherId);

      // Load read notifications from storage
      const readIds = await loadReadNotifications();
      setReadNotifications(readIds);

      let teacherNotifications = [];

      // Method 1: Skip recipient-specific notifications as schema doesn't support Teacher type
      // Note: Schema only allows 'Student' and 'Parent' as recipient_type, not 'Teacher'
      console.log('ℹ️ Skipping recipient-specific notifications (schema limitation)');
      

      // Method 2: Direct approach - get all notifications and check if they're relevant to this teacher
      console.log('🔍 Looking for all notifications that might be for this teacher...');
      
      // Get ALL recent notifications (like admin dashboard does)
      const { data: allNotificationsFromDB, error: allNotifError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Get more recent notifications

      if (!allNotifError && allNotificationsFromDB && allNotificationsFromDB.length > 0) {
        console.log('📨 Found', allNotificationsFromDB.length, 'total notifications in system');
        
        // Filter for leave-related notifications
        const leaveNotifications = allNotificationsFromDB.filter(notif => 
          notif.message && (
            notif.message.includes('[LEAVE_APPROVED]') ||
            notif.message.includes('[LEAVE_REJECTED]') ||
            notif.message.includes('approved') ||
            notif.message.includes('rejected')
          )
        );
        
        console.log('📨 Found', leaveNotifications.length, 'leave-related notifications');
        
        if (linkedTeacherId && leaveNotifications.length > 0) {
          // Get teacher info to match against notification messages
          const { data: teacherInfo, error: teacherInfoError } = await supabase
            .from('teachers')
            .select('id, name')
            .eq('id', linkedTeacherId)
            .single();

          if (!teacherInfoError && teacherInfo) {
            console.log('👩‍🏫 Current teacher:', teacherInfo.name, '(ID:', teacherInfo.id, ')');
            
            const relevantNotifications = [];
            
            // Check each leave notification
            for (const notification of leaveNotifications) {
              console.log('🔍 Processing notification:', notification.message.substring(0, 100) + '...');
              
              // Try to match this notification to the current teacher
              // Since we can't easily parse the message, let's get this teacher's recent leaves and match by timing
              const { data: recentLeaves, error: leavesError } = await supabase
                .from('leave_applications')
                .select('id, teacher_id, start_date, end_date, leave_type, reviewed_at, status')
                .eq('teacher_id', linkedTeacherId)
                .not('status', 'eq', 'Pending')
                .order('reviewed_at', { ascending: false })
                .limit(20); // Get recent leaves

              if (!leavesError && recentLeaves && recentLeaves.length > 0) {
                // Check if this notification could be for any of this teacher's leaves
                const notificationDate = new Date(notification.created_at);
                
                for (const leave of recentLeaves) {
                  if (!leave.reviewed_at) continue;
                  
                  const reviewDate = new Date(leave.reviewed_at);
                  const timeDiff = Math.abs(notificationDate - reviewDate);
                  const hoursDiff = timeDiff / (1000 * 60 * 60);
                  
                  // Check if notification is within reasonable time of leave review (48 hours)
                  // and contains leave type
                  const hasLeaveType = notification.message.toLowerCase().includes(leave.leave_type.toLowerCase());
                  
                  console.log(`     Testing leave: ${leave.leave_type} (${leave.status})`);
                  console.log(`     Leave reviewed: ${leave.reviewed_at}`);
                  console.log(`     Notification created: ${notification.created_at}`);
                  console.log(`     Time diff: ${hoursDiff.toFixed(1)}h, Has type: ${hasLeaveType}`);
                  
                  if (hoursDiff <= 48 && hasLeaveType) {
                    console.log('✅ MATCHED! This notification is for this teacher\'s leave');
                    
                    // Determine type
                    let notificationType = 'general';
                    if (notification.message.includes('[LEAVE_APPROVED]') || notification.message.includes('approved')) {
                      notificationType = 'leave_approved';
                    } else if (notification.message.includes('[LEAVE_REJECTED]') || notification.message.includes('rejected')) {
                      notificationType = 'leave_rejected';
                    }
                    
                    relevantNotifications.push({
                      id: `teacher_notif_${notification.id}`,
                      notificationId: notification.id,
                      title: getNotificationTitle(notificationType, notification.message),
                      message: notification.message.replace(/^\[LEAVE_(APPROVED|REJECTED)\]\s*/, ''),
                      type: notificationType,
                      isRead: readIds.has(notification.id.toString()), // Check if this notification has been read
                      createdAt: notification.created_at,
                      data: { leaveId: leave.id, teacherId: linkedTeacherId },
                      source: 'direct_match'
                    });
                    
                    break; // Found a match, don't check other leaves for this notification
                  }
                }
              }
            }
            
            // Remove duplicates
            const uniqueNotifications = relevantNotifications.filter((notif, index, self) =>
              index === self.findIndex(n => n.notificationId === notif.notificationId)
            );
            
            console.log('🎯 Final result: Found', uniqueNotifications.length, 'notifications for this teacher');
            teacherNotifications.push(...uniqueNotifications);
          }
        }
      } else {
        console.log('ℹ️ No notifications found in system');
      }

      if (!linkedTeacherId) {
        console.warn('⚠️ Teacher not linked to a teacher profile, cannot fetch leave notifications');
      }

      // Sort all notifications by creation date (newest first)
      teacherNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('📊 Total notifications:', teacherNotifications.length);
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
      // Extract the actual notification ID from teacher-prefixed ID
      const actualNotificationId = notificationId.replace('teacher_notif_', '');
      
      // Update the readNotifications set
      const newReadNotifications = new Set([...readNotifications, actualNotificationId]);
      setReadNotifications(newReadNotifications);
      
      // Save to AsyncStorage
      await saveReadNotifications(newReadNotifications);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      
      console.log('📖 Marked notification as read and saved to storage:', actualNotificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(notif => !notif.isRead);

      if (unreadNotifications.length === 0) {
        Alert.alert('Info', 'All notifications are already read.');
        return;
      }

      // Get all notification IDs (extract actual IDs from teacher-prefixed IDs)
      const allNotificationIds = notifications.map(notif => 
        notif.notificationId ? notif.notificationId.toString() : notif.id.toString().replace('teacher_notif_', '')
      );
      const newReadNotifications = new Set(allNotificationIds);
      setReadNotifications(newReadNotifications);
      
      // Save to AsyncStorage
      await saveReadNotifications(newReadNotifications);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      Alert.alert('Success', 'All notifications marked as read.');
      console.log('📖 Marked all notifications as read and saved to storage');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
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
