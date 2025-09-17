import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { formatToLocalTime } from '../../utils/timeUtils';
import { getParentNotifications, markNotificationAsRead } from '../../utils/gradeNotificationHelpers';
import universalNotificationService from '../../services/UniversalNotificationService';
import { useParentAuth } from '../../hooks/useParentAuth'; // Import parent auth hook

const { width } = Dimensions.get('window');

const Notifications = ({ navigation }) => {
  const { user } = useAuth();
  const { 
    isParent, 
    parentStudents, 
    directParentMode, 
    loading: parentLoading, 
    error: parentError 
  } = useParentAuth(); // Use parent auth hook instead of tenant context
  
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    // Validate parent access before refresh
    if (!isParent) {
      console.error('❌ [PARENT_NOTIFICATIONS] Cannot refresh - user is not a parent');
      return;
    }
    
    await fetchNotifications();
  });

  const fetchNotifications = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // 🛡️ STEP 1: Validate parent access
      console.log('🛡️ [PARENT_NOTIFICATIONS] Validating parent access...');
      
      if (!isParent) {
        console.error('❌ [PARENT_NOTIFICATIONS] Parent validation failed: User is not a parent');
        setError('This feature is only available for parents');
        return;
      }
      
      // Get the first student from parent students
      const studentData = parentStudents && parentStudents.length > 0 ? parentStudents[0] : null;
      
      if (!studentData) {
        console.error('❌ [PARENT_NOTIFICATIONS] No student found for parent');
        setError('No student found for this parent account');
        return;
      }
      
      console.log('🔍 [NOTIFICATIONS] Fetching notifications for parent:', user.id, 'student:', studentData.id);

      // Get notifications with recipients for this parent ONLY using direct parent access
      // Include created_at from notifications for proper ordering
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notification_recipients')
        .select(`
          id,
          is_read,
          sent_at,
          read_at,
          notification_id,
          notifications!inner(
            id,
            message,
            type,
            created_at,
            sent_by,
            sent_at
          )
        `)
        .eq('recipient_type', 'Parent')
        .eq('recipient_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (notificationsError) {
        console.error('❌ [NOTIFICATIONS] Error fetching notifications:', notificationsError);
        throw notificationsError;
      }

      console.log(`✅ [NOTIFICATIONS] Found ${notificationsData?.length || 0} notifications for parent ${user.id}`);

      // Transform the data to match the expected format
      const allTransformedNotifications = (notificationsData || []).map(notificationRecord => {
        const notification = notificationRecord.notifications;

        // Create proper title and message for different notification types
        let title, message;
        if (notification.type === 'Absentee' || notification.type === 'Attendance') {
          // Set title as "Absentee" for consistency
          title = 'Absentee';
          
          // Extract student name and date info
          const studentNameMatch = notification.message.match(/Your child (\w+)|Student (\w+)/);
          const studentName = studentNameMatch ? (studentNameMatch[1] || studentNameMatch[2]) : 'Student';
          
          // Extract date from the message
          const dateMatch = notification.message.match(/on ([^.]+)/);
          const dateStr = dateMatch ? dateMatch[1] : '';
          
          // Get the current time to determine which period
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 5); // Format as HH:MM
          
          // Try to get actual period name from timetable (this will be enhanced with actual DB query)
          let periodName = 'school hours';
          
          // For now, use a simple time-based approach until we can query the actual timetable
          const hour = now.getHours();
          const minute = now.getMinutes();
          const timeInMinutes = hour * 60 + minute;
          
          // School periods (typical schedule - can be made dynamic later)
          if (timeInMinutes >= 480 && timeInMinutes < 540) { // 8:00-9:00
            periodName = '1st period';
          } else if (timeInMinutes >= 540 && timeInMinutes < 600) { // 9:00-10:00
            periodName = '2nd period';
          } else if (timeInMinutes >= 600 && timeInMinutes < 660) { // 10:00-11:00
            periodName = '3rd period';
          } else if (timeInMinutes >= 660 && timeInMinutes < 720) { // 11:00-12:00
            periodName = '4th period';
          } else if (timeInMinutes >= 720 && timeInMinutes < 780) { // 12:00-13:00
            periodName = '5th period';
          } else if (timeInMinutes >= 780 && timeInMinutes < 840) { // 13:00-14:00
            periodName = '6th period';
          } else if (timeInMinutes >= 840 && timeInMinutes < 900) { // 14:00-15:00
            periodName = '7th period';
          } else if (timeInMinutes >= 900 && timeInMinutes < 960) { // 15:00-16:00
            periodName = '8th period';
          } else {
            // Outside normal school hours
            if (timeInMinutes < 480) {
              periodName = 'morning session';
            } else {
              periodName = 'evening session';
            }
          }
          
          // Create a clean, formatted message
          message = `${studentName} was absent during ${periodName} on ${dateStr}.`;
        } else if (notification.type === 'GRADE_ENTERED') {
          // Handle grade entry notifications
          title = 'New Marks Entered';
          message = notification.message;
        } else if (notification.type === 'HOMEWORK_UPLOADED') {
          // Handle homework notifications  
          title = 'New Homework Assigned';
          message = notification.message;
        } else {
          title = notification.type || 'Notification';
          message = notification.message;
        }

        return {
          id: notification.id,
          uniqueKey: `notif-${notification.id}-rec-${notificationRecord.id}-${Date.now()}`, // Absolutely unique keys with timestamp
          title: title, // Add title field back since it's used in the UI
          message: message,
          sender: notification.sent_by || 'School Admin',
          type: notification.type || 'general',
          priority: 'regular',
          isRead: notificationRecord.is_read || false,
          timestamp: notification.created_at,
          relatedAction: null,
          recipientId: notificationRecord.id, // Store recipient record ID for updates
          recipientRecord: notificationRecord // Store full record for debugging
        };
      });

      // Remove duplicates using multiple criteria to ensure no UI duplicates
      const notificationMap = new Map();
      const seenNotifications = new Set();
      
      console.log('🔍 [NOTIFICATIONS] Starting deduplication process...');
      console.log('📊 [NOTIFICATIONS] Raw notification data before deduplication:', {
        totalRecords: allTransformedNotifications.length,
        notificationIds: allTransformedNotifications.map(n => ({ id: n.id, recipientId: n.recipientId }))
      });
      
      allTransformedNotifications.forEach((notification, index) => {
        // Create multiple deduplication keys
        const notificationIdKey = `notif_${notification.id}`;
        const messageKey = `msg_${notification.message.substring(0, 100)}`; // Use first 100 chars of message
        const contentKey = `content_${notification.type}_${notification.message.substring(0, 50)}_${notification.timestamp.split('T')[0]}`;
        
        console.log(`🔍 [NOTIFICATIONS] Processing notification ${index + 1}:`, {
          id: notification.id,
          recipientId: notification.recipientId,
          type: notification.type,
          messagePreview: notification.message.substring(0, 50) + '...'
        });
        
        // Check if we've already seen this notification using any of our keys
        if (seenNotifications.has(notificationIdKey) || 
            seenNotifications.has(messageKey) || 
            seenNotifications.has(contentKey)) {
          console.log(`⚠️ [NOTIFICATIONS] DUPLICATE DETECTED - Skipping notification ${notification.id}`);
          return; // Skip this duplicate
        }
        
        // Check if we already have a notification with this ID
        const existingByNotificationId = notificationMap.get(notificationIdKey);
        if (existingByNotificationId) {
          console.log(`⚠️ [NOTIFICATIONS] Found existing notification with same ID, comparing timestamps...`);
          // Keep the one with the more recent timestamp, or better recipient data
          if (new Date(notification.timestamp) > new Date(existingByNotificationId.timestamp) ||
              (!existingByNotificationId.recipientId && notification.recipientId)) {
            console.log(`✅ [NOTIFICATIONS] Replacing with newer/better notification`);
            notificationMap.set(notificationIdKey, notification);
          } else {
            console.log(`⏭️ [NOTIFICATIONS] Keeping existing notification`);
          }
        } else {
          // This is a new unique notification
          console.log(`✅ [NOTIFICATIONS] Adding new unique notification:`, notification.id);
          notificationMap.set(notificationIdKey, notification);
        }
        
        // Mark all our keys as seen
        seenNotifications.add(notificationIdKey);
        seenNotifications.add(messageKey);
        seenNotifications.add(contentKey);
      });
      
      // Convert back to array, sorted by timestamp
      const transformedNotifications = Array.from(notificationMap.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      console.log(`🔧 [NOTIFICATIONS] Deduplication completed: ${allTransformedNotifications.length} → ${transformedNotifications.length} notifications`);
      console.log('📊 [NOTIFICATIONS] Final notification IDs:', transformedNotifications.map(n => n.id));
      
      if (allTransformedNotifications.length !== transformedNotifications.length) {
        const duplicateCount = allTransformedNotifications.length - transformedNotifications.length;
        console.log(`⚠️ [NOTIFICATIONS] SUCCESS: Removed ${duplicateCount} duplicate notification(s) from UI!`);
        
        // Log details about what was deduplicated
        const finalIds = new Set(transformedNotifications.map(n => n.id));
        const duplicatedNotifications = allTransformedNotifications.filter(n => !finalIds.has(n.id));
        console.log('🗑️ [NOTIFICATIONS] Duplicates that were removed:', duplicatedNotifications.map(n => ({
          id: n.id,
          type: n.type,
          messagePreview: n.message.substring(0, 30) + '...'
        })));
      } else {
        console.log('✅ [NOTIFICATIONS] No duplicates found - all notifications are unique');
      }
      
      console.log(`✅ [NOTIFICATIONS] Showing ${transformedNotifications.length} notifications for parent ${user.id}`);

      // Log notification types for debugging
      const notificationTypes = transformedNotifications.map(n => ({
        type: n.type,
        message: n.message.substring(0, 50) + '...',
        isRead: n.isRead
      }));
      console.log('🔍 [NOTIFICATIONS] Notification types:', notificationTypes);

      setNotifications(transformedNotifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isParent && !parentLoading) {
      fetchNotifications();
    }
  }, [user, isParent, parentLoading]);

  // Refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user && isParent && !parentLoading) {
        fetchNotifications();
      }
    }, [user, isParent, parentLoading])
  );

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    if (filter === 'important') return n.priority === 'important';
    return true;
  }).filter(n =>
    (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.message || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.sender || '').toLowerCase().includes(search.toLowerCase())
  );

  const markAsRead = async (id) => {
    try {
      // 🛡️ Validate parent access before marking as read
      console.log('🛡️ [PARENT_NOTIFICATIONS] Validating parent access for mark as read...');
      
      if (!isParent) {
        console.error('❌ [PARENT_NOTIFICATIONS] Mark as read failed - user is not a parent');
        Alert.alert('Error', 'This feature is only available for parents');
        return;
      }
      
      console.log('🔄 Marking notification as read:', id);
      
      // Find the notification to get its recipient record
      const notification = notifications.find(n => n.id === id);
      
      if (notification?.recipientId) {
        console.log('📝 Updating recipient record:', notification.recipientId);
        
        // Update existing recipient record
        const { data: updateData, error: updateError } = await supabase
          .from('notification_recipients')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notification.recipientId)
          .select();
        
        if (updateError) {
          console.error('❌ Error updating recipient:', updateError);
          throw updateError;
        }
        
        console.log('✅ Successfully marked as read in database');
        
        // Update local state immediately
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        
        console.log('✅ Updated local state');
        
        // Broadcast the notification read event to update badges
        await universalNotificationService.broadcastNotificationRead(user.id, id);
        console.log('✅ Broadcast notification read event');
        
        return;
      } else {
        console.log('=== CREATING NEW RECIPIENT RECORD ===');
        
        // Check if record already exists
        const { data: existingRecord, error: checkError } = await supabase
          .from('notification_recipients')
          .select('*')
          .eq('notification_id', id)
          .eq('recipient_id', user.id)
          .single();

        console.log('Existing record check:', existingRecord);
        console.log('Check error:', checkError);

        if (existingRecord) {
          // Update the existing record
          const { data: updateData, error: updateError } = await supabase
            .from('notification_recipients')
            .update({ 
              is_read: true
            })
            .eq('id', existingRecord.id)
            .select();

          console.log('Update existing result:', updateData);
          if (updateError) {
            throw updateError;
          }
        } else {
          console.log('=== ANALYZING EXISTING DATA TO UNDERSTAND CONSTRAINTS ===');
          
          // First, let's see what values already exist in the database
          const { data: existingRecipients, error: analyzeError } = await supabase
            .from('notification_recipients')
            .select('recipient_type, delivery_status')
            .limit(10);
          
          console.log('Existing recipient records for analysis:', existingRecipients);
          console.log('Analysis error:', analyzeError);
          
          if (existingRecipients && existingRecipients.length > 0) {
            // Extract unique values from existing data
            const uniqueRecipientTypes = [...new Set(existingRecipients.map(r => r.recipient_type).filter(Boolean))];
            const uniqueDeliveryStatuses = [...new Set(existingRecipients.map(r => r.delivery_status).filter(Boolean))];
            
            console.log('Valid recipient_type values found:', uniqueRecipientTypes);
            console.log('Valid delivery_status values found:', uniqueDeliveryStatuses);
            
            // Try combinations based on existing data
            const validCombinations = [];
            
            for (const recipientType of uniqueRecipientTypes) {
              for (const deliveryStatus of uniqueDeliveryStatuses) {
                validCombinations.push({
                  notification_id: id,
                  recipient_id: user.id,
                  recipient_type: recipientType,
                  delivery_status: deliveryStatus,
                  is_read: true
                });
              }
            }
            
            console.log('Trying combinations based on existing data:', validCombinations);
            
            let insertSuccess = false;
            let lastError = null;
            
            for (const record of validCombinations) {
              console.log('Trying combination from existing data:', record);
              
              const { data: insertData, error: insertError } = await supabase
                .from('notification_recipients')
                .insert(record)
                .select();

              console.log('Insert result:', { insertData, insertError });
              
              if (!insertError) {
                console.log('✅ Successfully created record with existing data pattern!');
                insertSuccess = true;
                break;
              } else {
                console.log('❌ Failed, trying next...');
                lastError = insertError;
              }
            }
            
            if (!insertSuccess) {
              console.error('=== ALL COMBINATIONS FROM EXISTING DATA FAILED ===');
              console.error('This suggests the constraint is more complex than just enum values');
              console.error('Last error:', lastError);
              throw lastError;
            }
          } else {
            // No existing data to learn from, try minimal approach
            console.log('No existing data found, trying minimal insert...');
            
            const minimalRecord = {
              notification_id: id,
              recipient_id: user.id,
              recipient_type: 'Parent', // Match schema constraint: 'Student' or 'Parent' (capitalized)
              delivery_status: 'Sent', // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
              is_read: false // Start as unread, then update
            };
            
            console.log('Trying minimal record:', minimalRecord);
            
            const { data: insertData, error: insertError } = await supabase
              .from('notification_recipients')
              .insert(minimalRecord)
              .select();
            
            if (insertError) {
              console.error('=== MINIMAL INSERT FAILED ===');
              console.error('Error:', insertError);
              throw insertError;
            } else {
              console.log('✅ Created minimal record, now updating to read status...');
              
              // Update the newly created record to mark as read
              const { error: updateError } = await supabase
                .from('notification_recipients')
                .update({ 
                  is_read: true
                })
                .eq('id', insertData[0].id);
              
              if (updateError) {
                console.error('Failed to update to read status:', updateError);
                throw updateError;
              }
              
              console.log('✅ Successfully marked as read!');
              
              // Force a slight delay and trigger navigation event to refresh dashboard
              setTimeout(() => {
                console.log('Triggering navigation state change...');
                // This will help ensure the dashboard refreshes when we go back
                navigation.setParams({ refreshTrigger: Date.now() });
              }, 100);
            }
          }
        }
      }
      
      // Update local state
      setNotifications(notifications =>
        notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      
      console.log('=== SUCCESSFULLY MARKED NOTIFICATION AS READ ===');
    } catch (error) {
      console.error('=== ERROR MARKING NOTIFICATION AS READ ===');
      console.error('Full error object:', error);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Error code:', error.code);
      
      Alert.alert('Error', `Failed to mark notification as read: ${error.message}`);
    }
  };

  const markAsUnread = async (id) => {
    try {
      // 🛡️ Validate parent access before marking as unread
      console.log('🛡️ [PARENT_NOTIFICATIONS] Validating parent access for mark as unread...');
      
      if (!isParent) {
        console.error('❌ [PARENT_NOTIFICATIONS] Mark as unread failed - user is not a parent');
        Alert.alert('Error', 'This feature is only available for parents');
        return;
      }
      
      console.log('Marking notification as unread:', { id, userId: user.id });
      
      // Find the notification to get its recipient record
      const notification = notifications.find(n => n.id === id);
      console.log('Found notification for unread:', notification);
      
      if (notification?.recipientId) {
        console.log('Updating existing recipient record to unread:', notification.recipientId);
        // Update existing recipient record
        const { data: updateData, error: updateError } = await supabase
          .from('notification_recipients')
          .update({ 
            is_read: false,
            read_at: null
          })
          .eq('id', notification.recipientId)
          .select();

        console.log('Unread update result:', { updateData, updateError });
        if (updateError) {
          throw updateError;
        }
      }
      
      // Update local state
      setNotifications(notifications =>
        notifications.map(n => n.id === id ? { ...n, isRead: false } : n)
      );
      
      // Broadcast the notification read event to update badges  
      await universalNotificationService.broadcastNotificationRead(user.id, id);
      console.log('✅ Broadcast notification unread event');
      
      console.log('Successfully marked notification as unread');
    } catch (error) {
      console.error('Detailed error marking notification as unread:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      Alert.alert('Error', `Failed to mark notification as unread: ${error.message}`);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
      } else {
        return formatToLocalTime(timestamp);
      }
    }
  };

  const renderNotification = ({ item }) => (
    <View style={[styles.card, item.isRead ? styles.cardRead : styles.cardUnread]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.title, item.isRead && { color: '#888' }]}>{item.type}</Text>
        <Text style={styles.date}>{formatDate(item.timestamp)}</Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <View style={styles.actionRow}>
        {item.isRead ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => markAsUnread(item.id)}>
            <Text style={styles.actionText}>Mark as Unread</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, styles.unreadBtn]} onPress={() => markAsRead(item.id)}>
            <Text style={[styles.actionText, styles.unreadText]}>Mark as Read</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'read', label: 'Read' },
    { key: 'important', label: 'Important' },
  ];

  if (loading || parentLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Notifications" showBack={true} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header title="Notifications" showBack={true} />
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.errorText}>Failed to load notifications</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Header title="Notifications" showBack={true} />
        <View style={styles.content}>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
              {f.key === 'important' && (
                <Ionicons name="star" size={15} color="#FFD700" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notifications..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#aaa"
        />
        <FlatList
          data={filteredNotifications}
          keyExtractor={item => item.uniqueKey}
          renderItem={renderNotification}
          contentContainerStyle={{ 
            paddingBottom: 24,
            flexGrow: 1 // Ensures proper scrolling on web
          }}
          style={{
            flex: 1,
            maxHeight: '100%' // Prevents overflow issues on web
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No notifications found</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' 
                  ? 'You have no notifications yet.' 
                  : `No ${filter} notifications found.`
                }
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          bounces={false} // Better web experience
          overScrollMode="never" // Android specific but helps with consistency
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false} // Better for web rendering
          maxToRenderPerBatch={10} // Optimize rendering performance
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 120, // Approximate height of each notification card
            offset: 120 * index,
            index,
          })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1976d2']}
              progressBackgroundColor="#fff"
            />
          }
        />
      </View>
    </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
    overflow: 'hidden', // Prevents content overflow on web
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e3eaf2',
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#1976d2',
  },
  filterText: {
    color: '#1976d2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e3eaf2',
    color: '#222',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e3eaf2',
  },
  cardUnread: {
    borderLeftWidth: 5,
    borderLeftColor: '#1976d2',
  },
  cardRead: {
    borderLeftWidth: 5,
    borderLeftColor: '#bdbdbd',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    color: '#222',
  },
  date: {
    color: '#888',
    fontSize: 13,
    marginLeft: 8,
  },
  message: {
    color: '#333',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sender: {
    color: '#888',
    fontSize: 13,
    fontStyle: 'italic',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e3eaf2',
    marginLeft: 8,
  },
  actionText: {
    color: '#1976d2',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 13,
  },
  actionRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBtn: {
    backgroundColor: '#1976d2',
  },
  unreadText: {
    color: '#fff',
    marginLeft: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#1976d2',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#F44336',
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1976d2',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#bbb',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
});

export default Notifications;
