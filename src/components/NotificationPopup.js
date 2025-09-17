import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  FlatList, 
  ActivityIndicator, 
  Platform,
  Animated,
  Dimensions,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';
import { supabase, TABLES, getUserTenantId } from '../utils/supabase';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import { useParentAuth } from '../hooks/useParentAuth';
import { getStudentNotificationsForParent } from '../utils/parentAuthHelper';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const NotificationPopup = ({ 
  userType = 'Student',
  onNotificationPress,
  customStyle = {},
  iconSize = 24,
  iconColor = '#333'
}) => {
  const { user } = useAuth();
  const { isParent, parentStudents, directParentMode, loading: parentLoading } = useParentAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(screenHeight))[0];
  
  // Hook for unread notification count
  const { unreadCount, refresh: refreshNotificationCount } = useUnreadNotificationCount(userType);

  // Fetch notifications data
  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!user) {
      console.log('No user available');
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    try {
      // Check if user is a parent and use direct parent authentication
      if (userType === 'Parent' && isParent && parentStudents.length > 0) {
        console.log('📬 [POPUP] Using direct parent authentication for notifications');
        
        const studentData = parentStudents[0]; // Get first student
        const result = await getStudentNotificationsForParent(user.id, studentData.id);
        
        if (result.success) {
          console.log(`✅ [POPUP] Successfully loaded ${result.notifications.length} parent notifications`);
          setNotifications(result.notifications || []);
        } else {
          console.error('❌ [POPUP] Failed to load parent notifications:', result.error);
          setError('Failed to load notifications');
          setNotifications([]);
        }
        return;
      }
      
      // For non-parent users or fallback, use tenant-based approach
      if (!user?.linked_student_id && userType === 'Student') {
        console.log('No linked student ID available');
        return;
      }

      const tenantId = await getUserTenantId();
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

      // Build query based on user type
      let query = supabase
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .eq('tenant_id', tenantId);

      // Add user-specific filters
      if (userType === 'Student' && user?.linked_student_id) {
        query = query.eq('student_id', user.linked_student_id);
      } else if (userType === 'Parent' && user?.linked_student_id) {
        query = query.eq('student_id', user.linked_student_id);
      } else if (userType === 'Teacher' && user?.id) {
        query = query.eq('teacher_id', user.id);
      } else if (userType === 'Admin') {
        query = query.is('student_id', null).is('teacher_id', null);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Fetch notifications error:', error);
        setError('Failed to load notifications');
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('Notification fetch error:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userType, isParent, parentStudents]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      // For parent users using direct parent authentication
      if (userType === 'Parent' && isParent && parentStudents.length > 0) {
        console.log('📬 [POPUP] Marking parent notification as read:', notificationId);
        
        // Find the notification in the current list to get recipient ID
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification || !notification.recipientId) {
          console.warn('Could not find recipient ID for notification:', notificationId);
          return;
        }
        
        // Update notification_recipients table
        const { error } = await supabase
          .from('notification_recipients')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notification.recipientId);

        if (error) {
          console.error('Mark as read error (parent):', error);
          return;
        }
        
        // Update local state
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true, read_at: new Date().toISOString() }
              : notif
          )
        );
        
        console.log('✅ [POPUP] Parent notification marked as read');
        refreshNotificationCount();
        return;
      }
      
      // For non-parent users, use the old system
      const tenantId = await getUserTenantId();
      if (!tenantId) return;

      const { error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Mark as read error:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );

      // Refresh notification count
      refreshNotificationCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const tenantId = await getUserTenantId();
      if (!tenantId) return;

      const unreadNotifications = notifications.filter(n => !n.is_read);
      if (unreadNotifications.length === 0) return;

      const notificationIds = unreadNotifications.map(n => n.id);

      const { error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', notificationIds)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Mark all as read error:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({
          ...notif,
          is_read: true,
          read_at: new Date().toISOString()
        }))
      );

      // Refresh notification count
      refreshNotificationCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Handle notification item press
  const handleNotificationPress = (notification) => {
    // Mark as read if unread (check both property names for compatibility)
    const isUnread = !(notification.is_read || notification.isRead);
    if (isUnread) {
      markAsRead(notification.id);
    }

    // Call custom handler if provided
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };

  // Open modal with animation
  const openModal = () => {
    setModalVisible(true);
    fetchNotifications();
    
    // Animate modal appearance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Close modal with animation
  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setModalVisible(false);
    });
  };

  // Refresh notifications
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(false);
  };

  // Format notification date
  const formatNotificationDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'assignment': return 'document-text';
      case 'grade': return 'school';
      case 'attendance': return 'calendar';
      case 'fee': return 'card';
      case 'announcement': return 'megaphone';
      case 'homework': return 'book';
      case 'message': return 'chatbubble';
      default: return 'notifications';
    }
  };

  // Get notification color based on type
  const getNotificationColor = (type) => {
    switch (type) {
      case 'assignment': return '#FF9500';
      case 'grade': return '#34C759';
      case 'attendance': return '#007AFF';
      case 'fee': return '#FF3B30';
      case 'announcement': return '#5856D6';
      case 'homework': return '#FF9500';
      case 'message': return '#32D74B';
      default: return '#8E8E93';
    }
  };

  // Render notification item
  const renderNotificationItem = ({ item, index }) => {
    // Check both property names for read status compatibility
    const isRead = item.is_read || item.isRead;
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !isRead && styles.unreadNotification,
          index === notifications.length - 1 && styles.lastNotificationItem
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
      <View style={styles.notificationContent}>
        <View style={[
          styles.notificationIcon,
          { backgroundColor: getNotificationColor(item.type) + '20' }
        ]}>
          <Ionicons 
            name={getNotificationIcon(item.type)}
            size={20}
            color={getNotificationColor(item.type)}
          />
        </View>
        
        <View style={styles.notificationText}>
          <Text style={styles.notificationTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatNotificationDate(item.created_at || item.timestamp)}
          </Text>
        </View>
        
        {!isRead && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off" size={48} color="#ccc" />
      <Text style={styles.emptyStateText}>No notifications yet</Text>
      <Text style={styles.emptyStateSubtext}>
        You'll see important updates here
      </Text>
    </View>
  );

  return (
    <>
      {/* Bell Icon Button */}
      <TouchableOpacity 
        style={[styles.bellButton, customStyle]}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Ionicons 
          name="notifications" 
          size={iconSize} 
          color={iconColor}
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Notification Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            { opacity: fadeAnim }
          ]}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeModal}
          />
          
          <Animated.View 
            style={[
              styles.modalContent,
              Platform.OS === 'web' ? styles.modalContentWeb : styles.modalContentMobile,
              {
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <Text style={styles.unreadCountText}>
                    {unreadCount} unread
                  </Text>
                )}
              </View>
              
              <View style={styles.modalHeaderRight}>
                {unreadCount > 0 && (
                  <TouchableOpacity 
                    style={styles.markAllButton}
                    onPress={markAllAsRead}
                  >
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={closeModal}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications List */}
            <View style={styles.notificationsList}>
              {error ? (
                <View style={styles.errorState}>
                  <Ionicons name="warning" size={48} color="#ff4444" />
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => fetchNotifications()}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  renderItem={renderNotificationItem}
                  keyExtractor={(item) => item.id.toString()}
                  showsVerticalScrollIndicator={true}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={['#007AFF']}
                      tintColor="#007AFF"
                    />
                  }
                  ListEmptyComponent={loading ? null : renderEmptyState}
                  contentContainerStyle={notifications.length === 0 ? styles.emptyListContent : null}
                  onScrollEndDrag={() => {
                    // Mark visible notifications as read after scrolling
                    // This could be enhanced with intersection observer for web
                  }}
                />
              )}
              
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellButton: {
    padding: 8,
    marginRight: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
  },
  modalContentMobile: {
    height: screenHeight * 0.7,
  },
  modalContentWeb: {
    height: Math.min(600, screenHeight * 0.8),
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderLeft: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  unreadCountText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginRight: 12,
  },
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  notificationsList: {
    flex: 1,
  },
  notificationItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  lastNotificationItem: {
    borderBottomWidth: 0,
  },
  unreadNotification: {
    backgroundColor: '#f8f9ff',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
    paddingRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginTop: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyListContent: {
    flex: 1,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
});

export default NotificationPopup;
