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

const AdminNotifications = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const { user } = useAuth();

  const getNotificationTitle = (type, message) => {
    // Extract title from message or use type-based defaults
    if (message && message.includes('[LEAVE_REQUEST]')) {
      return 'New Leave Request';
    }
    if (message && message.includes('leave request')) {
      return 'New Leave Request';
    }
    if (message && message.includes('submitted')) {
      return 'Leave Request Submitted';
    }
    if (message && message.includes('leave')) {
      return 'Leave Update';
    }
    
    switch (type) {
      case 'General':
        return 'General Notification';
      case 'Urgent':
        return 'Urgent Notification';
      case 'Fee Reminder':
        return 'Fee Reminder';
      case 'Event':
        return 'Event Notification';
      case 'Homework':
        return 'Homework Assignment';
      case 'Attendance':
        return 'Attendance Notice';
      case 'Absentee':
        return 'Absentee Report';
      case 'Exam':
        return 'Exam Notification';
      default:
        return 'Notification';
    }
  };

  // Load read notifications from AsyncStorage
  const loadReadNotifications = async () => {
    try {
      if (!user?.id) return new Set();
      const key = `admin_read_notifications_${user.id}`;
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
      const key = `admin_read_notifications_${user.id}`;
      await AsyncStorage.setItem(key, JSON.stringify([...readIds]));
    } catch (error) {
      console.error('Error saving read notifications:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      if (!user?.id) return;

      // Load read notifications from storage
      const readIds = await loadReadNotifications();
      setReadNotifications(readIds);

      // Get all notifications for this admin
      // Since the schema doesn't support Admin recipient type, we'll get all general notifications
      // or notifications sent by the system for admin review
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`sent_by.is.null,type.eq.General`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin notifications:', error);
        return;
      }

      // Transform the data to a more usable format
      const formattedNotifications = data?.map(item => {
        const isLeaveRequest = item.message && item.message.includes('[LEAVE_REQUEST]');
        
        return {
          id: item.id,
          title: getNotificationTitle(item.type, item.message),
          message: item.message || '',
          type: isLeaveRequest ? 'leave_request' : (item.type || 'general'),
          isRead: readIds.has(item.id.toString()), // Check if this notification has been read
          createdAt: item.created_at
        };
      }) || [];

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching admin notifications:', error);
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
      // Update the readNotifications set
      const newReadNotifications = new Set([...readNotifications, notificationId.toString()]);
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
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadCount = notifications.filter(notif => !notif.isRead).length;

      if (unreadCount === 0) {
        Alert.alert('Info', 'All notifications are already read.');
        return;
      }

      // Get all notification IDs
      const allNotificationIds = notifications.map(notif => notif.id.toString());
      const newReadNotifications = new Set(allNotificationIds);
      setReadNotifications(newReadNotifications);
      
      // Save to AsyncStorage
      await saveReadNotifications(newReadNotifications);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      Alert.alert('Success', 'All notifications marked as read.');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read.');
    }
  };

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    
    // Handle different notification types
    switch (notification.type) {
      case 'leave_request':
        // Navigate to leave management screen
        navigation.navigate('LeaveManagement');
        break;
      default:
        // Just mark as read for other types
        break;
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'leave_request':
        return 'calendar-outline';
      case 'leave_approved':
        return 'checkmark-circle';
      case 'leave_rejected':
        return 'close-circle';
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
      case 'leave_request':
        return '#FF9800';
      case 'leave_approved':
        return '#4CAF50';
      case 'leave_rejected':
        return '#F44336';
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
        onPress={() => handleNotificationPress(item)}
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
        
        {item.type === 'leave_request' && (
          <View style={styles.actionHint}>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Admin Notifications" showBack={true} navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Admin Notifications" showBack={true} navigation={navigation} />
      
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
              You'll see leave requests and other administrative notifications here
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
    alignItems: 'center',
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
  actionHint: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -8,
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

export default AdminNotifications;
