import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useAuth } from '../../utils/AuthContext';
import { supabase, getUserTenantId } from '../../utils/supabase';
import universalNotificationService from '../../services/UniversalNotificationService';
import { validateTenantAccess, createTenantQuery, validateDataTenancy, TENANT_ERROR_MESSAGES } from '../../utils/tenantValidation';
import { useTenant } from '../../contexts/TenantContext';

const AdminNotifications = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const { user } = useAuth();
  const { tenantId } = useTenant();

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
      console.log('🔔 [ADMIN_NOTIF] Starting to fetch admin notifications...');
      console.log('🔔 [ADMIN_NOTIF] Current user:', user?.email || 'Not logged in');
      
      // 🛡️ Validate tenant access first
      const validation = await validateTenantAccess(user?.id, tenantId, 'AdminNotifications - fetchNotifications');
      if (!validation.isValid) {
        console.error('❌ AdminNotifications fetchNotifications: Tenant validation failed:', validation.error);
        Alert.alert('Access Denied', validation.error);
        return;
      }
      
      if (!user?.id) {
        console.log('❌ [ADMIN_NOTIF] No user ID available');
        return;
      }

      // Check current session first (keeping for compatibility)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔔 [ADMIN_NOTIF] Session check:');
      console.log('   - Session exists:', !!session);
      console.log('   - Session user:', session?.user?.email || 'None');
      console.log('   - Session error:', sessionError?.message || 'None');
      
      if (!session) {
        console.log('❌ [ADMIN_NOTIF] No active session found');
        return;
      }

      console.log('🏢 [ADMIN_NOTIF] Using validated tenant ID:', tenantId);

      // Load read notifications from storage
      const readIds = await loadReadNotifications();
      setReadNotifications(readIds);

      // Get notifications from notification_recipients table first (preferred method)
      // Try with 'Admin' recipient_type first, then fallback to 'Parent' if constraint not updated
      let recipientNotifications = null;
      let recipientError = null;
      
      console.log('🔔 [ADMIN_NOTIF] Querying notification_recipients with Admin type...');
      // Try with Admin recipient type first using tenant-aware query
      const { data: adminNotifications, error: adminError } = await createTenantQuery(tenantId, 'notification_recipients')
        .select(`
          *,
          notification:notifications(*)
        `)
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'Admin')
        .order('sent_at', { ascending: false })
        .execute();
        
      console.log('🔔 [ADMIN_NOTIF] Admin notifications query result:');
      console.log('   - Found:', adminNotifications?.length || 0);
      console.log('   - Error:', adminError?.message || 'None');
      console.log('   - Error code:', adminError?.code || 'None');
        
      if (!adminError) {
        recipientNotifications = adminNotifications;
        console.log('✅ [ADMIN_NOTIF] Using Admin recipient type for admin notifications');
      } else {
        console.log('🔄 [ADMIN_NOTIF] Admin recipient type failed, trying Parent fallback...');
        // Fallback to Parent type if Admin constraint not updated yet using tenant-aware query
        const { data: fallbackNotifications, error: fallbackError } = await createTenantQuery(tenantId, 'notification_recipients')
          .select(`
            *,
            notification:notifications(*)
          `)
          .eq('recipient_id', user.id)
          .eq('recipient_type', 'Parent')
          .order('sent_at', { ascending: false })
          .execute();
          
        console.log('🔔 [ADMIN_NOTIF] Parent fallback query result:');
        console.log('   - Found:', fallbackNotifications?.length || 0);
        console.log('   - Error:', fallbackError?.message || 'None');
        console.log('   - Error code:', fallbackError?.code || 'None');
          
        recipientNotifications = fallbackNotifications;
        recipientError = fallbackError;
        
        if (!fallbackError) {
          console.log('✅ [ADMIN_NOTIF] Using Parent fallback for admin notifications');
        }
      }

      let allNotifications = [];

      // Process recipient notifications (these are targeted to this specific admin)
      if (!recipientError && recipientNotifications) {
        console.log('🔔 [ADMIN_NOTIF] Processing', recipientNotifications.length, 'recipient notifications');
        
        // 🛡️ Validate recipient notifications belong to correct tenant
        if (recipientNotifications.length > 0) {
          const notificationsValid = validateDataTenancy(recipientNotifications, tenantId, 'AdminNotifications - Recipient Notifications');
          if (!notificationsValid) {
            console.error('Recipient notifications data validation failed');
            Alert.alert('Data Security Alert', 'Notifications data validation failed. Please contact administrator.');
            setNotifications([]);
            return;
          }
        }
        
        const recipientNotifs = recipientNotifications.map(item => ({
          id: item.notification.id,
          title: getNotificationTitle(item.notification.type, item.notification.message),
          message: item.notification.message || '',
          type: item.notification.message && item.notification.message.includes('[LEAVE_REQUEST]') 
            ? 'leave_request' 
            : (item.notification.type || 'general'),
          isRead: item.is_read || readIds.has(item.notification.id.toString()),
          createdAt: item.notification.created_at,
          sentAt: item.sent_at,
          deliveryStatus: item.delivery_status
        }));
        allNotifications = [...recipientNotifs];
      }

      // Also get general notifications not specifically targeted using tenant-aware query
      // BUT exclude notifications sent by this admin to avoid seeing their own approval notifications
      console.log('🔔 [ADMIN_NOTIF] Querying general notifications...');
      const { data: generalNotifications, error: generalError } = await createTenantQuery(tenantId, 'notifications')
        .select('*')
        .or(`sent_by.is.null,type.eq.General`)
        .neq('sent_by', user.id) // Exclude notifications sent by this admin
        .order('created_at', { ascending: false })
        .execute();

      console.log('🔔 [ADMIN_NOTIF] General notifications query result:');
      console.log('   - Found:', generalNotifications?.length || 0);
      console.log('   - Error:', generalError?.message || 'None');
      console.log('   - Error code:', generalError?.code || 'None');

      if (!generalError && generalNotifications) {
        // 🛡️ Validate general notifications belong to correct tenant
        if (generalNotifications.length > 0) {
          const generalNotificationsValid = validateDataTenancy(generalNotifications, tenantId, 'AdminNotifications - General Notifications');
          if (!generalNotificationsValid) {
            console.error('General notifications data validation failed');
            // Don't show alert for general notifications as they're supplementary
            // Just skip them and continue with recipient notifications
          } else {
            const generalNotifs = generalNotifications
              .filter(item => !allNotifications.some(existing => existing.id === item.id)) // Avoid duplicates
              .filter(item => item.sent_by !== user.id) // Additional safety check to exclude admin's own notifications
              .map(item => ({
                id: item.id,
                title: getNotificationTitle(item.type, item.message),
                message: item.message || '',
                type: item.message && item.message.includes('[LEAVE_REQUEST]') 
                  ? 'leave_request' 
                  : (item.type || 'general'),
                isRead: readIds.has(item.id.toString()),
                createdAt: item.created_at,
                sentAt: item.sent_at,
                deliveryStatus: item.delivery_status
              }));
            allNotifications = [...allNotifications, ...generalNotifs];
          }
        }
      }

      // Sort all notifications by created date (most recent first)
      allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      console.log('✅ [ADMIN_NOTIF] Total notifications loaded:', allNotifications.length);
      setNotifications(allNotifications);

    } catch (error) {
      console.error('💥 [ADMIN_NOTIF] Error fetching admin notifications:', error);
      console.error('💥 [ADMIN_NOTIF] Error details:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details
      });
      
      // Check for RLS errors
      if (error.code === '42501') {
        console.log('🔒 [ADMIN_NOTIF] RLS blocking notifications access');
        Alert.alert(
          'Database Access Issue',
          'Unable to load notifications due to database permissions. Please contact support.',
          [
            { text: 'OK' },
            { text: 'Retry', onPress: fetchNotifications }
          ]
        );
      }
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
      console.log('🔔 [ADMIN_NOTIF] Marking notification as read:', notificationId);
      
      // 🛡️ Validate tenant access first
      const validation = await validateTenantAccess(user?.id, tenantId, 'AdminNotifications - markAsRead');
      if (!validation.isValid) {
        Alert.alert('Access Denied', validation.error);
        return;
      }
      
      // Update the notification_recipients table in the database
      const { error: dbError } = await supabase
        .from('notification_recipients')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('notification_id', notificationId)
        .eq('recipient_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('recipient_type', 'Admin');
        
      if (dbError) {
        console.error('❌ [ADMIN_NOTIF] Error updating notification in database:', dbError);
        
        // Try with Parent fallback if Admin type fails
        const { error: fallbackError } = await supabase
          .from('notification_recipients')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('notification_id', notificationId)
          .eq('recipient_id', user.id)
          .eq('tenant_id', tenantId)
          .eq('recipient_type', 'Parent');
          
        if (fallbackError) {
          console.error('❌ [ADMIN_NOTIF] Fallback update also failed:', fallbackError);
          Alert.alert('Error', 'Failed to mark notification as read');
          return;
        }
        
        console.log('✅ [ADMIN_NOTIF] Notification marked as read using Parent fallback');
      } else {
        console.log('✅ [ADMIN_NOTIF] Notification marked as read in database');
      }
      
      // Update the readNotifications set for local state
      const newReadNotifications = new Set([...readNotifications, notificationId.toString()]);
      setReadNotifications(newReadNotifications);
      
      // Save to AsyncStorage as backup
      await saveReadNotifications(newReadNotifications);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      
      // Broadcast the notification read event for immediate badge updates
      try {
        console.log('📣 [ADMIN_NOTIF] Broadcasting notification read event...');
        await universalNotificationService.broadcastNotificationRead(user.id, notificationId);
        console.log('✅ [ADMIN_NOTIF] Broadcast successful');
      } catch (broadcastError) {
        console.warn('⚠️ [ADMIN_NOTIF] Broadcast failed (not critical):', broadcastError);
        // Broadcasting is not critical, continue even if it fails
      }
      
    } catch (error) {
      console.error('💥 [ADMIN_NOTIF] Error marking notification as read:', error);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(notif => !notif.isRead);

      if (unreadNotifications.length === 0) {
        Alert.alert('Info', 'All notifications are already read.');
        return;
      }

      console.log('🔔 [ADMIN_NOTIF] Marking all notifications as read, count:', unreadNotifications.length);
      
      // Get tenant_id for RLS compliance
      const tenantId = await getUserTenantId();
      if (!tenantId) {
        console.error('❌ [ADMIN_NOTIF] No tenant_id found for marking all notifications as read');
        Alert.alert('Error', 'Tenant information not found');
        return;
      }
      
      // Update all unread notifications in the database
      const { error: dbError } = await supabase
        .from('notification_recipients')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('recipient_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('recipient_type', 'Admin')
        .eq('is_read', false);
        
      if (dbError) {
        console.error('❌ [ADMIN_NOTIF] Error marking all notifications as read in database:', dbError);
        
        // Try with Parent fallback if Admin type fails
        const { error: fallbackError } = await supabase
          .from('notification_recipients')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('recipient_id', user.id)
          .eq('tenant_id', tenantId)
          .eq('recipient_type', 'Parent')
          .eq('is_read', false);
          
        if (fallbackError) {
          console.error('❌ [ADMIN_NOTIF] Fallback mark all also failed:', fallbackError);
          Alert.alert('Error', 'Failed to mark all notifications as read');
          return;
        }
        
        console.log('✅ [ADMIN_NOTIF] All notifications marked as read using Parent fallback');
      } else {
        console.log('✅ [ADMIN_NOTIF] All notifications marked as read in database');
      }

      // Get all notification IDs
      const allNotificationIds = notifications.map(notif => notif.id.toString());
      const newReadNotifications = new Set(allNotificationIds);
      setReadNotifications(newReadNotifications);
      
      // Save to AsyncStorage as backup
      await saveReadNotifications(newReadNotifications);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      Alert.alert('Success', 'All notifications marked as read.');
      
      // Broadcast notification read events for immediate badge updates
      try {
        console.log('📣 [ADMIN_NOTIF] Broadcasting bulk notification read events...');
        // Broadcast for each unread notification
        const broadcastPromises = unreadNotifications.map(notif => 
          universalNotificationService.broadcastNotificationRead(user.id, notif.id)
        );
        await Promise.all(broadcastPromises);
        console.log('✅ [ADMIN_NOTIF] Bulk broadcast successful');
      } catch (broadcastError) {
        console.warn('⚠️ [ADMIN_NOTIF] Bulk broadcast failed (not critical):', broadcastError);
        // Broadcasting is not critical, continue even if it fails
      }
    } catch (error) {
      console.error('💥 [ADMIN_NOTIF] Error marking all notifications as read:', error);
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
        showsVerticalScrollIndicator={Platform.OS === 'web'}
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
    ...(Platform.OS === 'web' && {
      maxHeight: '100vh',
      overflowY: 'auto',
    }),
  },
  listContainer: {
    padding: 16,
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
    }),
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
