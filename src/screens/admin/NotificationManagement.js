import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Button, Alert, ScrollView, ActivityIndicator } from 'react-native';
import Header from '../../components/Header';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase, TABLES } from '../../utils/supabase';

const roles = ['teacher', 'parent', 'student', 'admin'];
const notificationTypes = ['General', 'Urgent', 'Fee Reminder', 'Event', 'Homework', 'Attendance', 'Absentee', 'Exam'];

const NotificationManagement = () => {
  const [notifications, setNotifications] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState({ visible: false, mode: 'view', notification: null });
  const [createForm, setCreateForm] = useState({ 
    type: notificationTypes[0], 
    message: '', 
    status: 'Pending' 
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load notifications from Supabase
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load from notifications table with recipients
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          notification_recipients(
            id,
            recipient_id,
            recipient_type,
            delivery_status,
            sent_at
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Filtering logic
  const filteredNotifications = notifications.filter(n => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (search && !(n.message?.toLowerCase().includes(search.toLowerCase()) || 
                   n.title?.toLowerCase().includes(search.toLowerCase()))) 
      return false;
    return true;
  });

  // Actions
  const openViewModal = (notification) => setModal({ visible: true, mode: 'view', notification });
  
  const openEditModal = (notification) => {
    // Format the scheduled_at date and time if available
    if (notification.scheduled_at) {
      const dateObj = new Date(notification.scheduled_at);
      const d = dateObj.toISOString().split('T')[0];
      const t = dateObj.toTimeString().split(' ')[0].substring(0, 5);
      setDate(d);
      setTime(t);
    } else {
      setDate('');
      setTime('');
    }
    
    setCreateForm({
      type: notification.type || notificationTypes[0],
      message: notification.message || '',
      status: notification.delivery_status || 'Pending'
    });
    
    setModal({ visible: true, mode: 'edit', notification });
  };
  
  const openCreateModal = () => {
    setDate('');
    setTime('');
    setCreateForm({ 
      type: notificationTypes[0], 
      message: '', 
      status: 'Pending' 
    });
    setModal({ visible: true, mode: 'create', notification: null });
  };
  
  const handleDelete = (notificationId) => {
    Alert.alert('Delete Notification', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          try {
            setLoading(true);
            
            // Delete from notifications table (will cascade to notification_recipients)
            const { error } = await supabase
              .from(TABLES.NOTIFICATIONS)
              .delete()
              .eq('id', notificationId);
            
            if (error) throw error;
            
            loadNotifications(); // Refresh the list
            Alert.alert('Success', 'Notification deleted successfully');
          } catch (err) {
            console.error('Error deleting notification:', err);
            Alert.alert('Error', 'Failed to delete notification');
          } finally {
            setLoading(false);
          }
        } 
      },
    ]);
  };
  
  const handleResend = async (notification) => {
    try {
      setLoading(true);
      
      // Update delivery status for all recipients of this notification
      const { error: updateError } = await supabase
        .from('notification_recipients')
        .update({ 
          delivery_status: 'Sent',
          sent_at: new Date().toISOString()
        })
        .eq('notification_id', notification.id);
      
      if (updateError) throw updateError;
      
      // Also update the main notification
      const { error: notifUpdateError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({ 
          delivery_status: 'Sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notification.id);
      
      if (notifUpdateError) throw notifUpdateError;
      
      loadNotifications(); // Refresh the list
      Alert.alert('Success', 'Notification resent successfully');
    } catch (err) {
      console.error('Error resending notification:', err);
      Alert.alert('Error', 'Failed to resend notification');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDuplicate = async (notification) => {
    try {
      setLoading(true);
      
      // Create a duplicate notification
      const duplicateNotification = {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        sent_to_role: notification.sent_to_role,
        sent_to_id: notification.sent_to_id,
        delivery_status: 'Scheduled',
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert(duplicateNotification)
        .select();
      
      if (error) throw error;
      
      // Update local state
      setNotifications([...(data || []), ...notifications]);
      Alert.alert('Success', 'Notification duplicated successfully');
    } catch (err) {
      console.error('Error duplicating notification:', err);
      Alert.alert('Error', 'Failed to duplicate notification');
    } finally {
      setLoading(false);
    }
  };
  
  // Create/Edit logic
  const handleSave = async () => {
    if (!createForm.message.trim()) {
      Alert.alert('Error', 'Message is required');
      return;
    }
    
    try {
      setLoading(true);
      
      let scheduledAt = null;
      if (date && time) {
        scheduledAt = new Date(`${date}T${time}`).toISOString();
      }
      
      // Step 1: Create notification record
      const notificationData = {
        type: createForm.type,
        message: createForm.message,
        delivery_mode: 'InApp',
        delivery_status: createForm.status,
        scheduled_at: scheduledAt,
        sent_by: null // Add current user ID if available
      };
      
      const { data: notificationResult, error: notificationError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert(notificationData)
        .select()
        .single();
      
      if (notificationError) throw notificationError;
      
      // Step 2: Get all users to create recipients
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, role_id');
      
      if (usersError) throw usersError;
      
      // Step 3: Create recipients for students and parents
      const recipients = users
        .filter(user => user.role_id === 2 || user.role_id === 3)
        .map(user => ({
          notification_id: notificationResult.id,
          recipient_id: user.id,
          recipient_type: user.role_id === 2 ? 'Student' : 'Parent',
          delivery_status: 'Pending'
        }));
      
      // Step 4: Insert into notification_recipients table
      if (recipients.length > 0) {
        const { error: recipientsError } = await supabase
          .from('notification_recipients')
          .insert(recipients);
        
        if (recipientsError) throw recipientsError;
      }
      
      loadNotifications(); // Refresh the list
      Alert.alert('Success', `Notification created and sent to ${recipients.length} recipients`);
      
      setModal({ visible: false, mode: 'view', notification: null });
      setCreateForm({ 
        type: notificationTypes[0], 
        message: '', 
        status: 'Pending' 
      });
      setDate('');
      setTime('');
    } catch (err) {
      console.error('Error saving notification:', err);
      Alert.alert('Error', `Failed to save notification: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // UI
  return (
    <View style={styles.container}>
      <Header title="Notification Management" showBack={true} />
      
      {/* Filter/Search Bar */}
      <View style={styles.filterBarMain}>
        <View style={styles.searchBarRow}>
          <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search message or title..."
            value={search}
            onChangeText={setSearch}
            style={styles.filterInput}
            placeholderTextColor="#888"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.filterBtn, (typeFilter.trim().toLowerCase() === '') ? styles.activeFilterBtn : null]}
            onPress={() => setTypeFilter('')}
          >
            <Text style={(typeFilter.trim().toLowerCase() === '') ? styles.activeFilterText : styles.filterBtnText}>All Types</Text>
          </TouchableOpacity>
          {notificationTypes.map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.filterBtn, (typeFilter.trim().toLowerCase() === type.toLowerCase()) ? styles.activeFilterBtn : null]}
              onPress={() => setTypeFilter(type)}
            >
              <Text style={(typeFilter.trim().toLowerCase() === type.toLowerCase()) ? styles.activeFilterText : styles.filterBtnText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      )}
      
      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Notifications List */}
      {!loading && !error && (
        <FlatList
          data={filteredNotifications}
          keyExtractor={item => item.id}
          style={{ width: '100%', marginTop: 8 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No notifications found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.notificationCard} onPress={() => openViewModal(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notificationType}>{(item.type || 'general').toUpperCase()}</Text>
                <Text style={styles.notificationMsg}>{item.message}</Text>
                <Text style={styles.notificationMeta}>
                  Recipients: {item.notification_recipients?.length || 0}
                  {item.scheduled_at ? ` | Scheduled: ${new Date(item.scheduled_at).toLocaleString()}` : ''}
                  {item.sent_at ? ` | Sent: ${new Date(item.sent_at).toLocaleString()}` : ''}
                </Text>
                <Text style={styles.notificationStatus}>
                  Status: {item.delivery_status || 'Pending'}
                  {item.notification_recipients && (
                    ` | Sent: ${item.notification_recipients.filter(r => r.delivery_status === 'Sent').length}/${item.notification_recipients.length}`
                  )}
                </Text>
              </View>
              <View style={styles.iconCol}>
                <TouchableOpacity onPress={() => openEditModal(item)}>
                  <Ionicons name="pencil" size={20} color="#1976d2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleResend(item)} style={{ marginTop: 8 }}>
                  <Ionicons name="send" size={20} color="#4caf50" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginTop: 8 }}>
                  <Ionicons name="trash" size={20} color="#f44336" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      {/* Floating Add Button */}
       <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
         <Text style={styles.fabIcon}>+</Text>
       </TouchableOpacity>
      
      {/* Create/Edit/View Modal */}
      <Modal visible={modal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentModern}>
            {modal.mode === 'view' && modal.notification && (
              <>
                <Text style={styles.modalTitle}>Notification Details</Text>
                <Text style={styles.notificationType}>{(modal.notification.type || 'general').toUpperCase()}</Text>
                <Text style={styles.notificationTitle}>{modal.notification.title || 'No Title'}</Text>
                <Text style={styles.notificationMsg}>{modal.notification.message}</Text>
                <Text style={styles.notificationMeta}>To: {modal.notification.sent_to_role || 'Unknown'}</Text>
                {modal.notification.scheduled_at && (
                  <Text style={styles.notificationMeta}>Scheduled: {new Date(modal.notification.scheduled_at).toLocaleString()}</Text>
                )}
                {modal.notification.sent_at && (
                  <Text style={styles.notificationMeta}>Sent: {new Date(modal.notification.sent_at).toLocaleString()}</Text>
                )}
                <Text style={styles.notificationMeta}>Status: {modal.notification.delivery_status || 'Unknown'}</Text>
                <Button title="Close" onPress={() => setModal({ visible: false, mode: 'view', notification: null })} />
              </>
            )}
            {(modal.mode === 'edit' || modal.mode === 'create') && (
              <ScrollView>
                <Text style={styles.modalTitle}>{modal.mode === 'edit' ? 'Edit Notification' : 'Create Notification'}</Text>
                
                <Text style={{ marginTop: 8 }}>Type:</Text>
                <ScrollView horizontal style={{ marginBottom: 8 }}>
                  {notificationTypes.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeBtn, createForm.type === type && styles.activeTypeBtn]}
                      onPress={() => setCreateForm(f => ({ ...f, type }))}
                    >
                      <Text>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <TextInput
                  placeholder="Title"
                  value={createForm.title}
                  onChangeText={text => setCreateForm(f => ({ ...f, title: text }))}
                  style={styles.input}
                />
                
                <TextInput
                  placeholder="Message"
                  value={createForm.message}
                  onChangeText={text => setCreateForm(f => ({ ...f, message: text }))}
                  style={[styles.input, { height: 100 }]}
                  multiline
                />
                
                <Text style={{ marginTop: 8 }}>Recipient Role:</Text>
                <ScrollView horizontal style={{ marginBottom: 8 }}>
                  {roles.map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.recipientBtn, createForm.sent_to_role === role && styles.activeRecipientBtn]}
                      onPress={() => setCreateForm(f => ({ ...f, sent_to_role: role }))}
                    >
                      <Text>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center' }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: date ? '#222' : '#888' }}>{date ? date : 'Date (YYYY-MM-DD)'}</Text>
                    <Ionicons name="calendar-outline" size={20} color="#888" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center' }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={{ color: time ? '#222' : '#888' }}>{time ? time : 'Time (HH:mm)'}</Text>
                    <Ionicons name="time-outline" size={20} color="#888" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    value={date ? new Date(date) : new Date()}
                    mode="date"
                    display="calendar"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const yyyy = selectedDate.getFullYear();
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        setDate(`${yyyy}-${mm}-${dd}`);
                      }
                    }}
                  />
                )}
                {showTimePicker && (
                  <DateTimePicker
                    value={time ? new Date(`1970-01-01T${time}:00`) : new Date()}
                    mode="time"
                    is24Hour={true}
                    display="clock"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (selectedDate) {
                        const h = selectedDate.getHours().toString().padStart(2, '0');
                        const m = selectedDate.getMinutes().toString().padStart(2, '0');
                        setTime(`${h}:${m}`);
                      }
                    }}
                  />
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                  <Button title="Cancel" onPress={() => setModal({ visible: false, mode: 'view', notification: null })} />
                  <Button title="Save" onPress={handleSave} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 28, // Increased for mobile header spacing
    paddingBottom: 8, // Keep lower padding
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007bff',
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
    color: '#222',
    backgroundColor: '#fff',
    fontSize: 16,
  },
  filterBtn: {
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  filterBtnText: {
    color: '#1976d2',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  activeFilterBtn: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
    color: '#fff',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  notificationType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  notificationMsg: {
    fontSize: 16,
    color: '#333',
    marginVertical: 2,
  },
  notificationMeta: {
    fontSize: 12,
    color: '#888',
  },
  iconCol: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  icon: {
    fontSize: 20,
    textAlign: 'center',
    marginVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 8,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  typeBtn: {
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTypeBtn: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  recipientBtn: {
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeRecipientBtn: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  filterBarMain: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#007bff',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalContentModern: {
    backgroundColor: '#fff',
    padding: 28,
    borderRadius: 16,
    width: '92%',
    maxHeight: '92%',
    elevation: 4,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  actionIcon: {
    marginVertical: 2,
    marginBottom: 2,
  },
});

export default NotificationManagement;
