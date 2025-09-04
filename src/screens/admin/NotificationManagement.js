import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator, Modal, Button, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { useAuth } from '../../utils/AuthContext';
import Header from '../../components/Header';
import CrossPlatformDatePicker, { DatePickerButton } from '../../components/CrossPlatformDatePicker';
import { formatToLocalTime } from '../../utils/timeUtils';
const roles = ['teacher', 'parent', 'student', 'admin'];
const notificationTypes = ['General', 'Urgent', 'Event', 'Homework', 'Attendance', 'Absentee', 'Exam'];

// Color mapping for notification types
const getNotificationTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'urgent': return '#F44336'; // Red
    case 'event': return '#9C27B0'; // Purple
    case 'homework': return '#2196F3'; // Blue
    case 'attendance': return '#4CAF50'; // Green
    case 'absentee': return '#FF5722'; // Deep Orange
    case 'exam': return '#673AB7'; // Deep Purple
    case 'general': 
    default: return '#607D8B'; // Blue Grey
  }
};

const NotificationManagement = () => {
  const { user } = useAuth(); // Get current admin user
  const [notifications, setNotifications] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState({ visible: false, mode: 'view', notification: null });
  const [createForm, setCreateForm] = useState({ 
    type: notificationTypes[0], 
    message: '', 
    status: 'Pending',
    selectedRoles: [] // Array for multiple role selection
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load notifications from Supabase
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Loading notifications...');
      
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
          ),
          users!sent_by(
            id,
            full_name,
            role_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`✅ Loaded ${data?.length || 0} notifications`);
      setNotifications(data || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 Pull-to-refresh triggered in Notification Management');
      
      // Clear any existing errors
      setError(null);
      
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
          ),
          users!sent_by(
            id,
            full_name,
            role_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Refresh error:', error);
        setError('Failed to refresh notifications');
        return;
      }
      
      console.log(`✅ Refreshed ${data?.length || 0} notifications`);
      setNotifications(data || []);
      
    } catch (err) {
      console.error('Error refreshing notifications:', err);
      setError('Failed to refresh notifications');
    } finally {
      setRefreshing(false);
    }
  };

  // Filtering logic
  const filteredNotifications = notifications.filter(n => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (search && !n.message?.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // Actions
  const openViewModal = (notification) => setModal({ visible: true, mode: 'view', notification });
  
  const openEditModal = (notification) => {
    // Format the scheduled_at date and time if available
    if (notification.scheduled_at) {
      const dateObj = new Date(notification.scheduled_at);
      // Format as DD-MM-YYYY
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      setDate(`${dd}-${mm}-${yyyy}`);
      
      // Format as 12-hour time
      let hours = dateObj.getHours();
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      const displayTime = `${hours}:${minutes} ${ampm}`;
      setTime(displayTime);
    } else {
      setDate('');
      setTime('');
    }
    
    // Get selected roles from existing recipients
    const existingRoles = [];
    if (notification.notification_recipients) {
      const recipientTypes = [...new Set(notification.notification_recipients.map(r => r.recipient_type.toLowerCase()))];
      existingRoles.push(...recipientTypes.map(type => type === 'student' ? 'student' : 'parent'));
    }
    
    setCreateForm({
      type: notification.type || notificationTypes[0],
      message: notification.message || '',
      status: notification.delivery_status || 'Pending',
      selectedRoles: existingRoles
    });
    
    setModal({ visible: true, mode: 'edit', notification });
  };
  
  const openCreateModal = () => {
    setDate('');
    setTime('');
    setCreateForm({ 
      type: notificationTypes[0], 
      message: '', 
      status: 'Pending',
      selectedRoles: []
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
          delivery_status: 'Sent' // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
        })
        .eq('notification_id', notification.id);
      
      if (updateError) throw updateError;
      
      // Also update the main notification
      const { error: notifUpdateError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({ 
          delivery_status: 'Sent' // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
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
        message: notification.message,
        delivery_mode: 'InApp',
        delivery_status: 'Pending', // Valid values: 'Pending', 'Sent', 'Failed' (capitalized)
        sent_by: user?.id || null // Store current admin user ID
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
    
    if (createForm.selectedRoles.length === 0) {
      Alert.alert('Error', 'Please select at least one recipient role');
      return;
    }
    
    try {
      setLoading(true);
      
      let scheduledAt = null;
      if (date && time) {
        try {
          // Convert DD-MM-YYYY and 12-hour time to ISO string
          const [dd, mm, yyyy] = date.split('-');
          let timeFormatted = time;
          
          // Validate date parts
          const dayNum = parseInt(dd, 10);
          const monthNum = parseInt(mm, 10);
          const yearNum = parseInt(yyyy, 10);
          
          if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) ||
              dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
            throw new Error('Invalid date format');
          }
          
          // Convert 12-hour time to 24-hour format for ISO string
          if (time.includes('AM') || time.includes('PM')) {
            const [timeStr, ampm] = time.split(' ');
            const [hours12, minutes] = timeStr.split(':');
            let hours24 = parseInt(hours12, 10);
            const minutesNum = parseInt(minutes, 10);
            
            if (isNaN(hours24) || isNaN(minutesNum) || hours24 < 1 || hours24 > 12 || minutesNum < 0 || minutesNum > 59) {
              throw new Error('Invalid time format');
            }
            
            if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
            if (ampm === 'AM' && hours24 === 12) hours24 = 0;
            timeFormatted = `${String(hours24).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}:00`;
          } else {
            // Handle 24-hour format if provided
            const [hours, minutes] = timeFormatted.split(':');
            const hoursNum = parseInt(hours, 10);
            const minutesNum = parseInt(minutes, 10);
            
            if (isNaN(hoursNum) || isNaN(minutesNum) || hoursNum < 0 || hoursNum > 23 || minutesNum < 0 || minutesNum > 59) {
              throw new Error('Invalid time format');
            }
            
            timeFormatted = `${String(hoursNum).padStart(2, '0')}:${String(minutesNum).padStart(2, '0')}:00`;
          }
          
          // Create date using Date constructor with separate parameters to avoid parsing issues
          const scheduleDate = new Date(yearNum, monthNum - 1, dayNum);
          const [hours, minutes] = timeFormatted.split(':');
          scheduleDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          
          if (isNaN(scheduleDate.getTime())) {
            throw new Error('Invalid date/time combination');
          }
          
          scheduledAt = scheduleDate.toISOString();
        } catch (error) {
          console.error('Date/time parsing error:', error);
          Alert.alert('Error', 'Invalid date or time format. Please check your input.');
          return;
        }
      }
      
      // Step 1: Create notification record
      const notificationData = {
        type: createForm.type,
        message: createForm.message,
        delivery_mode: 'InApp',
        delivery_status: createForm.status,
        scheduled_at: scheduledAt,
        sent_by: user?.id || null // Store current admin user ID
      };
      
      const { data: notificationResult, error: notificationError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert(notificationData)
        .select()
        .single();
      
      if (notificationError) throw notificationError;
      
      // Step 2: Get all users to create recipients based on selected roles
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, role_id');
      
      if (usersError) throw usersError;
      
      // Map role names to role_ids based on typical school management system structure
      const roleMap = {
        'admin': 1,
        'student': 2,
        'parent': 3,
        'teacher': 4
      };
      
      // Get role_ids for selected roles
      const selectedRoleIds = createForm.selectedRoles.map(role => roleMap[role]).filter(Boolean);
      
      // Step 3: Create recipients based on selected roles
      // Note: Database only supports 'Student' and 'Parent' in notification_recipients table
      const supportedRoles = createForm.selectedRoles.filter(role => role === 'student' || role === 'parent');
      const unsupportedRoles = createForm.selectedRoles.filter(role => role === 'teacher' || role === 'admin');
      
      const recipients = users
        .filter(user => selectedRoleIds.includes(user.role_id))
        .map(user => {
          // Map role_id back to recipient_type (only Student and Parent are valid in notification_recipients)
          let recipientType = null;
          if (user.role_id === 3) recipientType = 'Parent';
          else if (user.role_id === 2) recipientType = 'Student';
          // Teachers (role_id 4) and Admins (role_id 1) are not supported in notification_recipients table
          
          return {
            notification_id: notificationResult.id,
            recipient_id: user.id,
            recipient_type: recipientType,
            delivery_status: 'Pending'
          };
        })
        .filter(recipient => recipient.recipient_type === 'Student' || recipient.recipient_type === 'Parent');
      
      // Step 4: Insert into notification_recipients table
      if (recipients.length > 0) {
        const { error: recipientsError } = await supabase
          .from('notification_recipients')
          .insert(recipients);
        
        if (recipientsError) throw recipientsError;
      }
      
      // Create success message with role breakdown
      let successMessage = `Notification created successfully!\n`;
      if (supportedRoles.length > 0) {
        const studentCount = recipients.filter(r => r.recipient_type === 'Student').length;
        const parentCount = recipients.filter(r => r.recipient_type === 'Parent').length;
        
        const roleCounts = [];
        if (supportedRoles.includes('student') && studentCount > 0) {
          roleCounts.push(`${studentCount} Student${studentCount > 1 ? 's' : ''}`);
        }
        if (supportedRoles.includes('parent') && parentCount > 0) {
          roleCounts.push(`${parentCount} Parent${parentCount > 1 ? 's' : ''}`);
        }
        
        if (roleCounts.length > 0) {
          successMessage += `Sent to: ${roleCounts.join(', ')}\n`;
        }
      }
      
      if (unsupportedRoles.length > 0) {
        successMessage += `Note: ${unsupportedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} notifications are not yet supported by the system.`;
      }
      
      loadNotifications(); // Refresh the list
      Alert.alert('Success', successMessage.trim());
      
      setModal({ visible: false, mode: 'view', notification: null });
      setCreateForm({ 
        type: notificationTypes[0], 
        message: '', 
        status: 'Pending',
        selectedRoles: []
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
            placeholder="Search message..."
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
        <View style={styles.scrollWrapper}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === 'web'}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#1976d2', '#007bff']} // Android colors
                tintColor="#1976d2" // iOS color
                title="Pull to refresh" // iOS title
                titleColor="#1976d2" // iOS title color
              />
            }
          >
            {filteredNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No notifications found</Text>
              </View>
            ) : (
              filteredNotifications.map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    { borderLeftWidth: 4, borderLeftColor: getNotificationTypeColor(item.type) }
                  ]} 
                  onPress={() => openViewModal(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.notificationType,
                      { color: getNotificationTypeColor(item.type) }
                    ]}>
                      {(item.type || 'general').toUpperCase()}
                    </Text>
                    <Text style={styles.notificationMsg}>{item.message}</Text>
                    <Text style={styles.notificationMeta}>
                      Recipients: {item.notification_recipients?.length || 0}
                      {item.scheduled_at ? ` | Scheduled: ${formatToLocalTime(item.scheduled_at)}` : ''}
                      {item.sent_at ? ` | Sent: ${formatToLocalTime(item.sent_at)}` : ''}
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
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginTop: 8 }}>
                      <Ionicons name="trash" size={20} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
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
                <Text style={styles.notificationMsg}>{modal.notification.message}</Text>
                <Text style={styles.notificationMeta}>To: {modal.notification.sent_to_role || 'Unknown'}</Text>
                {modal.notification.scheduled_at && (
                  <Text style={styles.notificationMeta}>Scheduled: {formatToLocalTime(modal.notification.scheduled_at)}</Text>
                )}
                {modal.notification.sent_at && (
                  <Text style={styles.notificationMeta}>Sent: {formatToLocalTime(modal.notification.sent_at)}</Text>
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
                  placeholder="Message"
                  value={createForm.message}
                  onChangeText={text => setCreateForm(f => ({ ...f, message: text }))}
                  style={[styles.input, { height: 100 }]}
                  multiline
                />
                
                <Text style={{ marginTop: 8 }}>Recipient Roles (Multiple Selection):</Text>
                <ScrollView horizontal style={{ marginBottom: 8 }}>
                  {roles.map(role => {
                    const isSelected = createForm.selectedRoles.includes(role);
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[styles.recipientBtn, isSelected && styles.activeRecipientBtn]}
                        onPress={() => {
                          const newRoles = isSelected 
                            ? createForm.selectedRoles.filter(r => r !== role)
                            : [...createForm.selectedRoles, role];
                          setCreateForm(f => ({ ...f, selectedRoles: newRoles }));
                        }}
                      >
                        <Text style={[{ color: isSelected ? '#1976d2' : '#666' }]}>{role}</Text>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#1976d2" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={{ marginTop: 8, marginBottom: 4 }}>Schedule Notification (Optional):</Text>
                {Platform.OS === 'web' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <CrossPlatformDatePicker
                        label="Date"
                        value={date ? (() => {
                          const [dd, mm, yyyy] = date.split('-');
                          return new Date(yyyy, mm - 1, dd);
                        })() : null}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            const dd = String(selectedDate.getDate()).padStart(2, '0');
                            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                            const yyyy = selectedDate.getFullYear();
                            setDate(`${dd}-${mm}-${yyyy}`);
                          }
                        }}
                        mode="date"
                        placeholder="Select Date"
                        containerStyle={{ marginBottom: 8 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <CrossPlatformDatePicker
                        label="Time"
                        value={time ? (() => {
                          const [timeStr, ampm] = time.split(' ');
                          const [hours12, minutes] = timeStr.split(':');
                          let hours24 = parseInt(hours12);
                          if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
                          if (ampm === 'AM' && hours24 === 12) hours24 = 0;
                          return new Date(1970, 0, 1, hours24, parseInt(minutes));
                        })() : new Date()}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            let hours = selectedDate.getHours();
                            const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12;
                            hours = hours ? hours : 12;
                            setTime(`${hours}:${minutes} ${ampm}`);
                          }
                        }}
                        mode="time"
                        placeholder="Select Time"
                        containerStyle={{ marginBottom: 8 }}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <DatePickerButton
                      label="Date"
                      value={date ? (() => {
                        const [dd, mm, yyyy] = date.split('-');
                        return new Date(yyyy, mm - 1, dd);
                      })() : null}
                      onPress={() => setShowDatePicker(true)}
                      placeholder="Date (DD-MM-YYYY)"
                      mode="date"
                      style={{ flex: 1 }}
                      containerStyle={{ flex: 1, marginBottom: 8 }}
                    />
                    <DatePickerButton
                      label="Time"
                      value={time ? (() => {
                        const [timeStr, ampm] = time.split(' ');
                        const [hours12, minutes] = timeStr.split(':');
                        let hours24 = parseInt(hours12);
                        if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
                        if (ampm === 'AM' && hours24 === 12) hours24 = 0;
                        return new Date(1970, 0, 1, hours24, parseInt(minutes));
                      })() : new Date()}
                      onPress={() => setShowTimePicker(true)}
                      placeholder="Time (12hr format)"
                      mode="time"
                      style={{ flex: 1 }}
                      containerStyle={{ flex: 1, marginBottom: 8 }}
                    />
                  </View>
                )}
                {/* Mobile Date/Time Pickers - Only show on mobile platforms */}
                {Platform.OS !== 'web' && showDatePicker && (
                  <CrossPlatformDatePicker
                    value={date ? (
                      // Convert DD-MM-YYYY to Date object
                      date.includes('-') ? 
                        (() => {
                          const [dd, mm, yyyy] = date.split('-');
                          return new Date(yyyy, mm - 1, dd);
                        })()
                      : new Date(date)
                    ) : new Date()}
                    mode="date"
                    display="calendar"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const yyyy = selectedDate.getFullYear();
                        setDate(`${dd}-${mm}-${yyyy}`);
                      }
                    }}
                  />
                )}
                {Platform.OS !== 'web' && showTimePicker && (
                  <CrossPlatformDatePicker
                    value={time ? (
                      // Convert 12-hour format to Date object for picker
                      time.includes('AM') || time.includes('PM') ? 
                        (() => {
                          const [timeStr, ampm] = time.split(' ');
                          const [hours12, minutes] = timeStr.split(':');
                          let hours24 = parseInt(hours12);
                          if (ampm === 'PM' && hours24 !== 12) hours24 += 12;
                          if (ampm === 'AM' && hours24 === 12) hours24 = 0;
                          return new Date(1970, 0, 1, hours24, parseInt(minutes));
                        })()
                      : new Date(`1970-01-01T${time}:00`)
                    ) : new Date()}
                    mode="time"
                    display="clock"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (selectedDate) {
                        let hours = selectedDate.getHours();
                        const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // 0 should be 12
                        setTime(`${hours}:${minutes} ${ampm}`);
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
  },
  // Scroll wrapper styles to fix scrolling issues (matching ManageClasses pattern)
  scrollWrapper: {
    flex: 1,
    ...Platform.select({
      web: {
        height: 'calc(100vh - 200px)',
        maxHeight: 'calc(100vh - 200px)',
        minHeight: 400,
        overflow: 'hidden',
      },
    }),
  },
  scrollContainer: {
    flex: 1,
    marginTop: 8,
    ...Platform.select({
      web: {
        overflowY: 'auto',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        paddingBottom: 80,
      },
    }),
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
  notificationStatus: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
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
