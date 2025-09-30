import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import { 
  useTenantAccess,
  tenantDatabase,
  createTenantQuery,
  getCachedTenantId
} from '../../utils/tenantHelpers';
import Header from '../../components/Header';
import universalNotificationService from '../../services/UniversalNotificationService';
import { webScrollViewStyles, getWebScrollProps, webContainerStyle, injectScrollbarStyles } from '../../styles/webScrollFix';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'important', label: 'Important' },
];

const StudentNotifications = ({ navigation }) => {
  const { user } = useAuth();
  // 🚀 ENHANCED: Use enhanced tenant system
  const { tenantId, isReady, error: tenantError } = useTenantAccess();
  
  const [notifications, setNotifications] = useState([]);
  const flatListRef = useRef(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // 🚀 ENHANCED: Tenant validation helper
  const validateTenant = async () => {
    const cachedTenantId = await getCachedTenantId();
    if (!cachedTenantId) {
      throw new Error('Tenant context not available');
    }
    return { valid: true, tenantId: cachedTenantId };
  };

  // Initialize web scroll styles on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      injectScrollbarStyles();
    }
  }, []);

  // Utility function to format date from yyyy-mm-dd to dd-mm-yyyy
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    
    try {
      let date;
      if (dateString.includes('T')) {
        // Handle full datetime string
        date = new Date(dateString);
      } else if (dateString.includes('-') && dateString.split('-').length === 3) {
        // Handle date-only string
        const [year, month, day] = dateString.split('-');
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return dateString; // Return original if parsing fails
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return dateString;
    }
  };

  // Fetch notifications from Supabase with read status
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== FETCHING STUDENT NOTIFICATIONS ===');
      console.log('User ID:', user.id);
      console.log('Linked Student ID:', user.linked_student_id);

      // Validate tenant context is ready
      if (!isReady || !tenantId) {
        console.log('⚠️ Tenant context not ready, skipping fetch');
        return;
      }
      
      console.log('✅ Using tenant ID:', tenantId);
      
      // Get student details to filter notifications properly with tenant-aware query
      const { data: studentData, error: studentError } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, class_id, classes(id, class_name, section), tenant_id')
        .eq('tenant_id', tenantId)
        .eq('id', user.linked_student_id)
        .single();
        
      if (studentError || !studentData) {
        console.error('Error fetching student data:', studentError);
        throw new Error('Student profile not found');
      }
      
      console.log('Student details for notification filtering:', {
        studentId: studentData.id,
        classId: studentData.class_id,
        className: studentData.classes?.class_name,
        section: studentData.classes?.section
      });
      
      // Fetch notifications that are specifically for this student with tenant-aware query
      // This includes notifications that have recipients records for this user
      const { data: recipientRecords, error: recipientError } = await supabase
        .from('notification_recipients')
        .select(`
          notification_id,
          is_read,
          id,
          tenant_id,
          created_at,
          notifications(
            id,
            message,
            type,
            created_at,
            sent_by,
            delivery_status,
            delivery_mode,
            tenant_id,
            users!sent_by(
              id,
              role_id,
              full_name
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('recipient_id', user.id)
        .eq('recipient_type', 'Student')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (recipientError) {
        console.error('❌ [STUDENT NOTIFICATIONS] Error fetching recipient records:', recipientError);
        throw recipientError;
      }
      
      // Extract notification data from recipient records
      let notificationsData = recipientRecords?.map(record => ({
        ...record.notifications,
        recipientId: record.id,
        is_read_from_recipient: record.is_read,
        recipient_created_at: record.created_at
      })).filter(n => n && n.id) || [];
      
      // Ensure newest first by notification timestamp, fallback to recipient record timestamp
      notificationsData.sort((a, b) => {
        const aTime = new Date(a.created_at || a.recipient_created_at || 0).getTime();
        const bTime = new Date(b.created_at || b.recipient_created_at || 0).getTime();
        return bTime - aTime;
      });
      

      console.log(`✅ [STUDENT NOTIFICATIONS] Found ${notificationsData?.length || 0} notifications for student ${user.id}`);

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
          
          // Use tenant_id from context
          if (!tenantId) {
            console.error('Cannot create recipient records: tenant_id is null');
            return;
          }
          
          const newRecords = missingRecords.map(notification => ({
            notification_id: notification.id,
            recipient_id: user.id,
            recipient_type: 'Student',
            is_read: false,
            delivery_status: 'Sent', // Mark as sent since we're showing it to the student
            tenant_id: tenantId
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

      // Filter notifications based on student's class and other criteria
      const filteredNotifications = notificationsData.filter(notification => {
        const message = notification.message.toLowerCase();
        
        // 1. Filter out leave notifications (which might be marked as General but contain leave-related content)
        const isLeaveNotification = message.includes('leave') || 
                                   message.includes('absent') || 
                                   message.includes('vacation') || 
                                   message.includes('sick') ||
                                   message.includes('time off');
        
        if (isLeaveNotification) {
          console.log(`🚫 Filtering out leave notification: ${notification.message.substring(0, 50)}...`);
          return false;
        }
        
        // 2. Filter out class-specific notifications that don't match this student's class
        // Check if the message contains specific class references that don't match the student's class
        const studentClass = studentData.classes?.class_name || '';
        const studentSection = studentData.classes?.section || '';
        const studentFullClass = `${studentClass}${studentSection}`; // e.g., "3A"
        
        // Look for class mentions in the message (e.g., "class 10", "class XII", etc.)
        const classPatterns = [
          /class\s+(\d+|[ivxlc]+)/gi, // "class 10", "class XII", etc.
          /grade\s+(\d+|[ivxlc]+)/gi, // "grade 10", "grade XII", etc.
          /(\d+)(st|nd|rd|th)\s*class/gi, // "10th class", "12th class", etc.
          /for\s+class\s+(\d+|[ivxlc]+)/gi, // "for class 10", etc.
        ];
        
        let containsWrongClass = false;
        for (const pattern of classPatterns) {
          const matches = [...message.matchAll(pattern)];
          for (const match of matches) {
            const mentionedClass = match[1]?.toLowerCase();
            if (mentionedClass && mentionedClass !== studentClass.toLowerCase()) {
              console.log(`🚫 Filtering out class-specific notification: "${notification.message.substring(0, 100)}..." - mentioned class "${mentionedClass}" doesn't match student's class "${studentClass}"`);
              containsWrongClass = true;
              break;
            }
          }
          if (containsWrongClass) break;
        }
        
        if (containsWrongClass) {
          return false;
        }
        
        return true;
      });

      console.log(`📋 After filtering: ${filteredNotifications.length} out of ${notificationsData.length} notifications`);

      // Remove duplicate notifications based on message content and type
      const uniqueNotifications = filteredNotifications.reduce((unique, notification) => {
        const key = `${notification.type}_${notification.message.substring(0, 100)}`;
        const existing = unique.find(n => `${n.type}_${n.message.substring(0, 100)}` === key);
        
        if (!existing) {
          unique.push(notification);
        } else {
          console.log(`🔄 Removing duplicate notification: "${notification.message.substring(0, 50)}..."`);
        }
        
        return unique;
      }, []);
      
      console.log(`📋 After deduplication: ${uniqueNotifications.length} out of ${filteredNotifications.length} notifications`);

      // Transform the data to match the expected format
      const transformedNotifications = uniqueNotifications.map(notification => {
        const readRecord = readStatusData.find(r => r.notification_id === notification.id);
        
        // Create a more user-friendly title based on notification type
        const getFriendlyTitle = (type, message) => {
          switch (type) {
            case 'GRADE_ENTERED':
              return 'New Marks Available';
            case 'HOMEWORK_UPLOADED':
              return 'New Assignment Posted';
            case 'Fee Reminder':
              return 'Fee Payment Reminder';
            case 'Urgent':
              return 'Important Notice';
            case 'Exam':
              return 'Exam Notification';
            case 'Attendance':
              return 'Attendance Update';
            case 'Event':
              return 'School Event';
            case 'General':
            default:
              // For general notifications, use the first meaningful part of the message
              const sentences = message.split('.').filter(s => s.trim().length > 0);
              const firstSentence = sentences[0]?.trim() || message;
              return firstSentence.length > 40 ? firstSentence.substring(0, 40) + '...' : firstSentence;
          }
        };
        
        // Get user-friendly type label
        const getFriendlyType = (type) => {
          switch (type) {
            case 'GRADE_ENTERED': return 'Marks';
            case 'HOMEWORK_UPLOADED': return 'Assignment';
            case 'Fee Reminder': return 'Fee';
            case 'Urgent': return 'Important';
            case 'Exam': return 'Exam';
            case 'Attendance': return 'Attendance';
            case 'Event': return 'Event';
            case 'General': return 'Notice';
            default: return type;
          }
        };
        
        return {
          id: notification.id,
          title: getFriendlyType(notification.type || 'General'), // Show short type as title
          message: notification.message, // Show full message as description
          type: notification.type || 'General',
          displayType: getFriendlyType(notification.type || 'General'),
          created_at: notification.created_at,
          read: notification.is_read_from_recipient || readRecord?.is_read || false,
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
    if (user?.id && isReady) {
      fetchNotifications();
    }
  }, [user?.id, isReady]);

  // Add focus effect to refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id && isReady) {
        fetchNotifications();
      }
    }, [user?.id, isReady])
  );

  // Real-time subscription effect
  useEffect(() => {
    if (!user?.id) return;
    
    const notifSub = supabase
      .channel('student-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.NOTIFICATIONS }, fetchNotifications)
      .subscribe();
      
    return () => {
      notifSub.unsubscribe();
    };
  }, [user?.id]);

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

      let updateSuccess = false;

      if (notification?.recipientId) {
        // Update existing recipient record
        console.log('Updating existing recipient record:', notification.recipientId);
        const { error: updateError } = await supabase
          .from('notification_recipients')
          .update({
            is_read: true,
            read_at: new Date().toISOString() // Add timestamp when read
          })
          .eq('id', notification.recipientId);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
        updateSuccess = true;
      } else {
        // Create new recipient record
        console.log('Creating new recipient record');
        
        // Use tenant_id from context
        if (!tenantId) {
          console.error('Cannot create recipient record: tenant_id is null');
          throw new Error('Tenant ID not available');
        }
        
        const { error: insertError } = await supabase
          .from('notification_recipients')
          .insert({
            notification_id: id,
            recipient_id: user.id,
            recipient_type: 'Student',
            is_read: true,
            read_at: new Date().toISOString(),
            delivery_status: 'Sent',
            tenant_id: tenantId
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
        updateSuccess = true;
      }

      // Update local state
      setNotifications(notifications =>
        notifications.map(n => n.id === id ? { ...n, read: true } : n)
      );

      console.log('✅ Successfully marked notification as read');
      
      // Broadcast the notification-read event to update badge counts immediately
      if (updateSuccess) {
        try {
          await universalNotificationService.broadcastNotificationRead(user.id, id);
          console.log('📣 Successfully broadcasted notification-read event');
        } catch (broadcastError) {
          console.error('Error broadcasting notification-read event:', broadcastError);
          // Continue execution even if broadcast fails
        }
      }
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
          <Text style={styles.date}>{formatDateToDDMMYYYY(item.date)}</Text>
        </View>
        
        {/* Type badge row */}
        <View style={styles.badgeOnlyRow}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
            <Text style={styles.badgeText}>{item.displayType.toUpperCase()}</Text>
          </View>
        </View>
        
        {/* Additional badges if needed */}
        {(item.delivery_status && item.delivery_status !== 'Sent') || (item.delivery_mode && item.delivery_mode !== 'InApp') ? (
          <View style={styles.additionalBadgeRow}>
            {item.delivery_status && item.delivery_status !== 'Sent' && (
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
        ) : null}
        
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
    <View style={Platform.OS === 'web' ? styles.webContainer : styles.container}>
      <Header title="Notifications" showBack={true} showProfile={false} />
      
      {/* Filter and Search Controls */}
      <View style={styles.controlsContainer}>
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
      </View>
      
      {/* Platform-Specific Scrolling Implementation */}
      {Platform.OS === 'web' ? (
        <div style={{ 
          flex: 1,
          height: 'calc(100vh - 200px)', // Proper height constraint
          overflow: 'auto',
          overflowX: 'hidden',
          padding: '16px',
          backgroundColor: '#f5f7fa',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* List Header */}
          {filteredNotifications.length > 0 && (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                {filter !== 'all' && ` (${filter})`}
              </Text>
            </View>
          )}
          
          {/* Notifications Content */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No notifications found</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'unread' ? 'You have no unread notifications.' :
                 filter === 'read' ? 'You have no read notifications.' :
                 filter === 'important' ? 'You have no important notifications.' :
                 search ? 'No notifications match your search.' : 'You have no notifications yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsContent}>
              {filteredNotifications.map(item => (
                <View key={item.id} style={styles.notificationWrapper}>
                  {renderNotification({ item })}
                </View>
              ))}
            </View>
          )}
        </div>
      ) : (
        <ScrollView
          ref={flatListRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1976d2']}
              tintColor="#1976d2"
              title="Pull to refresh"
              titleColor="#666"
            />
          }
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* List Header */}
          {filteredNotifications.length > 0 && (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                {filter !== 'all' && ` (${filter})`}
              </Text>
            </View>
          )}
          
          {/* Notifications Content */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No notifications found</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'unread' ? 'You have no unread notifications.' :
                 filter === 'read' ? 'You have no read notifications.' :
                 filter === 'important' ? 'You have no important notifications.' :
                 search ? 'No notifications match your search.' : 'You have no notifications yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsContent}>
              {filteredNotifications.map(item => (
                <View key={item.id} style={styles.notificationWrapper}>
                  {renderNotification({ item })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  webContainer: {
    flex: 1,
    height: '100vh',
    backgroundColor: '#f5f7fa',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  controlsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  // AttendanceSummary-style scrolling pattern (working approach)
  content: {
    flex: 1,
    padding: 16,
  },
  notificationsContent: {
    // Remove horizontal padding since content style already has padding
  },
  notificationWrapper: {
    // Individual notification wrapper for better spacing
  },
  listHeader: {
    paddingVertical: 8,
    paddingTop: 16,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
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
  // New improved badge layout styles
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  additionalBadgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 2,
  },
  // Badge styles
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
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
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // Badge row for type badge only
  badgeOnlyRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 2,
  },
  // Legacy styles for backward compatibility (can be removed later)
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 4,
  },
});

export default StudentNotifications; 

//comment vbvbhsbvihbvhbifbvhbj

//comment fjlkdjlfsjflkjslk