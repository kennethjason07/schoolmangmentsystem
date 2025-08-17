import React, { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import usePullToRefresh from '../../hooks/usePullToRefresh';

const { width } = Dimensions.get('window');

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'important', label: 'Important' },
];

const StudentNotifications = ({ navigation }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pull-to-refresh functionality
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchNotifications();
  });

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching notifications for student user:', user.id);
      
      // First, get all notifications
      const { data: allNotifications, error: notificationsError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) {
        throw notificationsError;
      }

      console.log('All notifications:', allNotifications);

      // Then get recipient records for this user
      const { data: recipientRecords, error: recipientError } = await supabase
        .from('notification_recipients')
        .select('*')
        .eq('recipient_id', user.id);

      if (recipientError && recipientError.code !== '42P01') {
        console.log('Recipient error (table might not exist):', recipientError);
      }

      console.log('Recipient records:', recipientRecords);
      
      // Transform the data to match the expected format
      const transformedNotifications = (allNotifications || []).map(notification => {
        // Find the recipient record for current user
        const recipientRecord = recipientRecords?.find(
          recipient => recipient.notification_id === notification.id
        );
        
        return {
          id: notification.id,
          title: notification.message, // Using message as title
          message: notification.message,
          sender: notification.sent_by || 'School Admin',
          type: notification.type || 'general',
          priority: 'regular',
          isRead: recipientRecord?.is_read || false,
          timestamp: notification.created_at,
          relatedAction: null,
          recipientId: recipientRecord?.id, // Store recipient record ID for updates
          recipientRecord: recipientRecord // Store full record for debugging
        };
      });
      
      console.log('Transformed notifications:', transformedNotifications);
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
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchNotifications();
      }
    }, [user])
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
      console.log('=== MARKING NOTIFICATION AS READ ===');
      console.log('Notification ID:', id);
      console.log('User ID:', user.id);
      
      // Find the notification to get its recipient record
      const notification = notifications.find(n => n.id === id);
      console.log('Found notification:', notification);
      console.log('Existing recipient record:', notification?.recipientRecord);
      
      if (notification?.recipientId) {
        console.log('=== UPDATING EXISTING RECIPIENT RECORD ===');
        console.log('Recipient ID to update:', notification.recipientId);
        
        // Update existing recipient record
        const { data: updateData, error: updateError } = await supabase
          .from('notification_recipients')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notification.recipientId)
          .select();

        console.log('Update result data:', updateData);
        console.log('Update error:', updateError);
        
        if (updateError) {
          throw updateError;
        }
      } else {
        console.log('=== CREATING NEW RECIPIENT RECORD ===');
        
        // Check if record already exists (maybe we missed it in the fetch)
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
              is_read: true,
              read_at: new Date().toISOString()
            })
            .eq('id', existingRecord.id)
            .select();

          console.log('Update existing result:', updateData);
          if (updateError) {
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
              read_at: new Date().toISOString(),
              delivery_status: 'Sent', // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
              sent_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
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
        return date.toLocaleDateString();
      }
    }
  };

  const renderNotification = ({ item }) => (
    <View style={[styles.card, item.isRead ? styles.cardRead : styles.cardUnread]}>
      <View style={styles.cardHeader}>
        <Ionicons name={item.isRead ? 'mail-open' : 'mail'} size={22} color={item.isRead ? '#888' : '#1976d2'} style={{ marginRight: 10 }} />
        <Text style={[styles.title, item.isRead && { color: '#888' }]}>{item.title}</Text>
        {item.priority === 'important' && (
          <Ionicons name="star" size={18} color="#FFD700" style={{ marginLeft: 6 }} />
        )}
        <Text style={styles.date}>{formatDate(item.timestamp)}</Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.sender}>{item.sender}</Text>
        <View style={styles.actionButtons}>
          {item.isRead ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => markAsUnread(item.id)}>
              <Ionicons name="mail-open" size={18} color="#1976d2" />
              <Text style={styles.actionText}>Mark as Unread</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={() => markAsRead(item.id)}>
              <Ionicons name="mail" size={18} color="#388e3c" />
              <Text style={styles.actionText}>Mark as Read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Notifications" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Notifications" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>Failed to load notifications</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
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
          keyExtractor={item => item.id}
          renderItem={renderNotification}
          contentContainerStyle={{ paddingBottom: 24 }}
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
          showsVerticalScrollIndicator={false}
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
  );
};

const styles = StyleSheet.create({
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
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

export default StudentNotifications; 

//comment vbvbhsbvihbvhbifbvhbj

//comment fjlkdjlfsjflkjslk