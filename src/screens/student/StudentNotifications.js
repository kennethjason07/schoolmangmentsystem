import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
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
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  // Fetch notifications from Supabase with read status
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== FETCHING STUDENT NOTIFICATIONS ===');
      console.log('User ID:', user.id);

      console.log('🔍 [STUDENT NOTIFICATIONS] Fetching notifications ONLY for student:', user.id);

      // Get notifications with recipients for this student ONLY
      const { data: notificationsData, error: notifError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select(`
          id,
          is_read,
          sent_at,
          read_at,
          notifications!inner(
            id,
            message,
            type,
            created_at,
            sent_by
          )
        `)
        .eq('recipient_type', 'Student')
        .eq('recipient_id', user.id)
        .order('sent_at', { ascending: false })
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

      // Transform the data to match the expected format
      const transformedNotifications = notificationsData.map(notificationRecord => {
        const notification = notificationRecord.notifications;

        return {
          id: notification.id,
          title: notification.message.substring(0, 50) + (notification.message.length > 50 ? '...' : ''),
          message: notification.message,
          type: notification.type || 'general',
          created_at: notification.created_at,
          read: notificationRecord.is_read || false,
          date: notification.created_at,
          important: notification.type === 'Urgent' || notification.type === 'Important',
          recipientId: notificationRecord.id
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

  const renderNotification = ({ item }) => (
    <View style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}>
      <View style={styles.cardHeader}>
        <Ionicons name={item.read ? 'mail-open' : 'mail'} size={22} color={item.read ? '#888' : '#1976d2'} style={{ marginRight: 10 }} />
        <Text style={[styles.title, item.read && { color: '#888' }]}>{item.title}</Text>
        {item.important && (
          <Ionicons name="star" size={18} color="#FFD700" style={{ marginLeft: 6 }} />
        )}
        <Text style={styles.date}>{item.date ? (item.date.split('T')[0] || item.date) : ''}</Text>
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
});

export default StudentNotifications; 

//comment vbvbhsbvihbvhbifbvhbj

//comment fjlkdjlfsjflkjslk