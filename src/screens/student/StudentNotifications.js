import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import Header from '../../components/Header';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'important', label: 'Important' },
];

const StudentNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  // Fetch notifications from Supabase with read status
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== FETCHING STUDENT NOTIFICATIONS ===');
      console.log('User ID:', user.id);
      console.log('Linked Student ID:', user.linked_student_id);

      // Fetch all notifications from admins (role_id = 1) - all notification types
      // Filter out leave notifications manually below
      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select(`
          id,
          message,
          type,
          created_at,
          sent_by,
          delivery_status,
          delivery_mode,
          users!sent_by(
            id,
            role_id,
            full_name
          )
        `)
        .in('type', ['General', 'Urgent', 'Fee Reminder', 'Event', 'Homework', 'Attendance', 'Absentee', 'Exam', 'GRADE_ENTERED', 'HOMEWORK_UPLOADED'])
        .eq('users.role_id', 1)
        .order('created_at', { ascending: false })
        .limit(50);
      

      console.log(`✅ [STUDENT NOTIFICATIONS] Found ${notificationsData?.length || 0} notifications for student ${user.id}`);

      if (notifError) {
        console.error('❌ [STUDENT NOTIFICATIONS] Error fetching notifications:', notifError);
        throw notifError;
      }

      if (!notificationsData || notificationsData.length === 0) {
        console.log('No notifications found for this student, showing empty list');
        setNotifications([]);
        return;
      }

      // Update delivery status to 'Sent' for any InApp notifications that are still 'Pending'
      const pendingNotifications = notificationsData.filter(n => 
        n.delivery_status === 'Pending' && n.delivery_mode === 'InApp'
      );
      
      if (pendingNotifications.length > 0) {
        console.log(`🔄 Updating ${pendingNotifications.length} notifications from Pending to Sent status`);
        
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            delivery_status: 'Sent',
            sent_at: new Date().toISOString()
          })
          .in('id', pendingNotifications.map(n => n.id))
          .eq('delivery_mode', 'InApp');
        
        if (updateError) {
          console.error('Error updating notification status:', updateError);
        } else {
          console.log('✅ Successfully updated notification delivery status');
          // Update the local data to reflect the change
          notificationsData.forEach(n => {
            if (pendingNotifications.some(p => p.id === n.id)) {
              n.delivery_status = 'Sent';
              n.sent_at = new Date().toISOString();
            }
          });
        }
      }

      // Get read status for these notifications from notification_recipients table
      const notificationIds = notificationsData.map(n => n.id);
      let readStatusData = [];
      
      if (notificationIds.length > 0) {
        const { data: readData } = await supabase
          .from('notification_recipients')
          .select('notification_id, is_read, id')
          .eq('recipient_id', user.id)
          .eq('recipient_type', 'Student')
          .in('notification_id', notificationIds);
        
        readStatusData = readData || [];
        
        // Create recipient records for notifications that don't have them yet
        const missingRecords = notificationsData.filter(notification => 
          !readStatusData.some(record => record.notification_id === notification.id)
        );
        
        if (missingRecords.length > 0) {
          console.log(`📝 Creating recipient records for ${missingRecords.length} notifications`);
          
          const newRecords = missingRecords.map(notification => ({
            notification_id: notification.id,
            recipient_id: user.id,
            recipient_type: 'Student',
            is_read: false,
            delivery_status: 'Sent' // Mark as sent since we're showing it to the student
          }));
          
          const { data: insertedRecords, error: insertError } = await supabase
            .from('notification_recipients')
            .insert(newRecords)
            .select('notification_id, is_read, id');
          
          if (insertError) {
            console.error('Error creating recipient records:', insertError);
          } else {
            console.log(`✅ Created ${insertedRecords?.length || 0} new recipient records`);
            // Add the new records to our read status data
            readStatusData = [...readStatusData, ...(insertedRecords || [])];
          }
        }
      }

      // Log all notifications to debug what we're getting
      console.log('Raw notifications from database:', notificationsData.map(n => ({
        id: n.id,
        type: n.type,
        message: n.message.substring(0, 100),
        sender_role: n.users?.role_id,
        sender_name: n.users?.full_name
      })));

      // Filter out leave notifications (which might be marked as General but contain leave-related content)
      const filteredNotifications = notificationsData.filter(notification => {
        const message = notification.message.toLowerCase();
        const isLeaveNotification = message.includes('leave') || 
                                   message.includes('absent') || 
                                   message.includes('vacation') || 
                                   message.includes('sick') ||
                                   message.includes('time off');
        
        if (isLeaveNotification) {
          console.log(`🚫 Filtering out leave notification: ${notification.message.substring(0, 50)}...`);
          return false;
        }
        return true;
      });

      console.log(`📋 After filtering: ${filteredNotifications.length} out of ${notificationsData.length} notifications`);

      // Transform the data to match the expected format
      const transformedNotifications = filteredNotifications.map(notification => {
        const readRecord = readStatusData.find(r => r.notification_id === notification.id);
        
        return {
          id: notification.id,
          title: notification.message.substring(0, 50) + (notification.message.length > 50 ? '...' : ''),
          message: notification.message,
          type: notification.type || 'General',
          created_at: notification.created_at,
          read: readRecord?.is_read || false,
          date: notification.created_at,
          important: notification.type === 'Urgent' || notification.type === 'Exam',
          recipientId: readRecord?.id || null,
          delivery_status: notification.delivery_status,
          delivery_mode: notification.delivery_mode,
          sender: notification.users
        };
      });

      console.log(`✅ [STUDENT NOTIFICATIONS] Transformed ${transformedNotifications.length} notifications`);
      setNotifications(transformedNotifications);

    } catch (err) {
      console.error('Error in fetchNotifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Real-time subscription
    const notifSub = supabase
      .channel('student-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.NOTIFICATIONS }, fetchNotifications)
      .subscribe();
    return () => {
      notifSub.unsubscribe();
    };
  }, []);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchNotifications();
    } catch (err) {
      console.error('Error refreshing notifications:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    if (filter === 'important') return n.important;
    return true;
  }).filter(n =>
    (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.message || '').toLowerCase().includes(search.toLowerCase())
  );

  const markAsRead = async (id) => {
    try {
      console.log('=== MARKING NOTIFICATION AS READ ===');
      console.log('Notification ID:', id);
      console.log('User ID:', user.id);

      // Find the notification to get its recipient record
      const notification = notifications.find(n => n.id === id);
      console.log('Found notification:', notification);

      if (notification?.recipientId) {
        // Update existing recipient record
        console.log('Updating existing recipient record:', notification.recipientId);
        const { error: updateError } = await supabase
          .from('notification_recipients')
          .update({
            is_read: true
          })
          .eq('id', notification.recipientId);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
      } else {
        // Create new recipient record
        console.log('Creating new recipient record');
        const { error: insertError } = await supabase
          .from('notification_recipients')
          .insert({
            notification_id: id,
            recipient_id: user.id,
            recipient_type: 'Student', // Valid values: 'Student', 'Parent' (capitalized)
            is_read: true,
            delivery_status: 'Sent' // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }

      // Update local state
      setNotifications(notifications =>
        notifications.map(n => n.id === id ? { ...n, read: true } : n)
      );

      console.log('✅ Successfully marked notification as read');
      
      // Force a slight delay and trigger navigation event to refresh dashboard
      setTimeout(() => {
        console.log('Triggering navigation state change...');
        // This will help ensure the dashboard refreshes when we go back
        navigation.setParams({ refreshTrigger: Date.now() });
      }, 100);
    } catch (err) {
      console.error('Mark as read error:', err);
      Alert.alert('Error', 'Failed to mark as read.');
    }
  };

  const renderNotification = ({ item }) => {
    const getTypeColor = (type) => {
      switch (type) {
        case 'Urgent': return '#F44336';
        case 'Fee Reminder': return '#FF9800';
        case 'General': return '#4CAF50';
        case 'Event': return '#9C27B0';
        case 'Homework': return '#2196F3';
        case 'Attendance': return '#607D8B';
        case 'Absentee': return '#E91E63';
        case 'Exam': return '#FF5722';
        case 'GRADE_ENTERED': return '#00BCD4';
        case 'HOMEWORK_UPLOADED': return '#795548';
        default: return '#9E9E9E';
      }
    };

    const getDeliveryStatusColor = (status) => {
      switch (status) {
        case 'Sent': return '#4CAF50';
        case 'Pending': return '#FF9800';
        case 'Failed': return '#F44336';
        default: return '#9E9E9E';
      }
    };

    return (
      <View style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}>
        <View style={styles.cardHeader}>
          <Ionicons name={item.read ? 'mail-open' : 'mail'} size={22} color={item.read ? '#888' : '#1976d2'} style={{ marginRight: 10 }} />
          <Text style={[styles.title, item.read && { color: '#888' }]}>{item.title}</Text>
          {item.important && (
            <Ionicons name="star" size={18} color="#FFD700" style={{ marginLeft: 6 }} />
          )}
          <Text style={styles.date}>{item.date ? (item.date.split('T')[0] || item.date) : ''}</Text>
        </View>
        
        {/* Type and Delivery Status Badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
            <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
          </View>
          {item.delivery_status && (
            <View style={[styles.statusBadge, { backgroundColor: getDeliveryStatusColor(item.delivery_status) }]}>
              <Text style={styles.badgeText}>{item.delivery_status}</Text>
            </View>
          )}
          {item.delivery_mode && item.delivery_mode !== 'InApp' && (
            <View style={[styles.modeBadge, { backgroundColor: '#9C27B0' }]}>
              <Text style={styles.badgeText}>{item.delivery_mode}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.message}>{item.message}</Text>
        <View style={styles.actionsRow}>
          {!item.read && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => markAsRead(item.id)}>
              <Ionicons name="mail-open" size={18} color="#388e3c" />
              <Text style={styles.actionText}>Mark as Read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1976d2" style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#d32f2f', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>Error: {error}</Text>
        <TouchableOpacity onPress={fetchNotifications} style={{ backgroundColor: '#1976d2', padding: 12, borderRadius: 8, alignSelf: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Notifications" showBack={true} showProfile={false} />
      <View style={styles.contentContainer}>
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
        keyExtractor={item => item.id}
        renderItem={renderNotification}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No notifications found.</Text>}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
      />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    letterSpacing: 0.5,
    flex: 1,
    marginBottom: 0,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 10,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
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
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default StudentNotifications; 

//comment vbvbhsbvihbvhbifbvhbj

//comment fjlkdjlfsjflkjslk