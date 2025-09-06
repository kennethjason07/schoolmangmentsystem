import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';

const PushNotificationManager = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [isUrgent, setIsUrgent] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedUserTypes, setSelectedUserTypes] = useState([]);
  
  // User data
  const [users, setUsers] = useState([]);
  const [userTypes, setUserTypes] = useState([
    { type: 'student', label: 'Students', count: 0, selected: false },
    { type: 'parent', label: 'Parents', count: 0, selected: false },
    { type: 'teacher', label: 'Teachers', count: 0, selected: false },
    { type: 'admin', label: 'Admins', count: 0, selected: false },
  ]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('compose'); // compose, recipients, preview
  const [showUserList, setShowUserList] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUsers();
    } else {
      // Reset form when modal closes
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setPriority('normal');
    setIsUrgent(false);
    setSelectedUsers([]);
    setSelectedUserTypes([]);
    setActiveTab('compose');
    setShowUserList(false);
    setUserTypes(prev => prev.map(ut => ({ ...ut, selected: false })));
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Load users with push tokens
      const { data: usersData, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          role,
          profile:user_profiles(first_name, last_name),
          push_tokens!inner(id, is_active)
        `)
        .eq('push_tokens.is_active', true);

      if (error) {
        console.error('Error loading users:', error);
        Alert.alert('Error', 'Failed to load users with push notifications enabled');
        return;
      }

      const processedUsers = (usersData || []).map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.profile ? 
          `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim() :
          user.email,
        hasActiveTokens: user.push_tokens && user.push_tokens.length > 0,
      }));

      setUsers(processedUsers);

      // Update user type counts
      const typeCounts = {
        student: processedUsers.filter(u => u.role === 'student').length,
        parent: processedUsers.filter(u => u.role === 'parent').length,
        teacher: processedUsers.filter(u => u.role === 'teacher').length,
        admin: processedUsers.filter(u => u.role === 'admin').length,
      };

      setUserTypes(prev => prev.map(ut => ({
        ...ut,
        count: typeCounts[ut.type] || 0
      })));

    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserTypeToggle = (userType) => {
    setUserTypes(prev => prev.map(ut => 
      ut.type === userType ? { ...ut, selected: !ut.selected } : ut
    ));
    
    const typeUsers = users.filter(u => u.role === userType);
    
    if (selectedUserTypes.includes(userType)) {
      // Remove this type
      setSelectedUserTypes(prev => prev.filter(t => t !== userType));
      setSelectedUsers(prev => prev.filter(u => !typeUsers.some(tu => tu.id === u.id)));
    } else {
      // Add this type
      setSelectedUserTypes(prev => [...prev, userType]);
      setSelectedUsers(prev => {
        const newUsers = typeUsers.filter(tu => !prev.some(su => su.id === tu.id));
        return [...prev, ...newUsers];
      });
    }
  };

  const handleIndividualUserToggle = (user) => {
    if (selectedUsers.some(su => su.id === user.id)) {
      // Remove user
      setSelectedUsers(prev => prev.filter(su => su.id !== user.id));
      
      // Check if this was the last user of this type
      const remainingUsersOfType = selectedUsers.filter(
        su => su.id !== user.id && su.role === user.role
      );
      
      if (remainingUsersOfType.length === 0) {
        setSelectedUserTypes(prev => prev.filter(t => t !== user.role));
        setUserTypes(prev => prev.map(ut => 
          ut.type === user.role ? { ...ut, selected: false } : ut
        ));
      }
    } else {
      // Add user
      setSelectedUsers(prev => [...prev, user]);
      
      // Add user type if not already selected
      if (!selectedUserTypes.includes(user.role)) {
        setSelectedUserTypes(prev => [...prev, user.role]);
        setUserTypes(prev => prev.map(ut => 
          ut.type === user.role ? { ...ut, selected: true } : ut
        ));
      }
    }
  };

  const sendNotification = async () => {
    try {
      // Validation
      if (!title.trim()) {
        Alert.alert('Error', 'Please enter a notification title');
        return;
      }
      
      if (!message.trim()) {
        Alert.alert('Error', 'Please enter a notification message');
        return;
      }
      
      if (selectedUsers.length === 0) {
        Alert.alert('Error', 'Please select at least one recipient');
        return;
      }

      setSending(true);

      // Create notification records
      const notifications = selectedUsers.map(user => ({
        user_id: user.id,
        title: title.trim(),
        message: message.trim(),
        type: 'push_notification',
        priority: isUrgent ? 'urgent' : priority,
        is_read: false,
        created_by: user.id, // Admin who sent it
        created_at: new Date().toISOString(),
        data: {
          push_notification: true,
          sender_name: 'School Administration',
          sender_id: user.id,
        }
      }));

      // Store notifications in database
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Error storing notifications:', notificationError);
        Alert.alert('Error', 'Failed to store notifications in database');
        return;
      }

      // Get push tokens for selected users
      const userIds = selectedUsers.map(u => u.id);
      const { data: tokens, error: tokensError } = await supabase
        .from('push_tokens')
        .select('token, user_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (tokensError) {
        console.error('Error getting push tokens:', tokensError);
        Alert.alert('Error', 'Failed to get push tokens');
        return;
      }

      if (!tokens || tokens.length === 0) {
        Alert.alert('Warning', 'No active push tokens found for selected users');
        return;
      }

      // Prepare push notifications
      const pushNotifications = tokens.map(tokenRecord => ({
        to: tokenRecord.token,
        sound: isUrgent ? 'urgent_tone.wav' : 'notification_tone.wav',
        title: title.trim(),
        body: message.trim(),
        data: {
          type: 'formal_notification',
          priority: isUrgent ? 'urgent' : priority,
          isUrgent,
          notificationId: `admin_${Date.now()}`,
          timestamp: Date.now(),
        },
        android: {
          channelId: isUrgent ? 'urgent-notifications' : 'formal-notifications',
          priority: isUrgent ? 'max' : 'high',
          sticky: isUrgent,
          color: isUrgent ? '#F44336' : '#2196F3',
        },
        ios: {
          sound: isUrgent ? 'urgent_tone.wav' : 'notification_tone.wav',
          badge: 1,
          categoryId: isUrgent ? 'URGENT' : 'GENERAL',
        },
      }));

      // Send push notifications via Expo's push service
      console.log(`📤 Sending ${pushNotifications.length} push notifications...`);
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushNotifications),
      });

      const result = await response.json();
      console.log('📤 Push notification result:', result);

      // Check for any errors in the response
      const errors = result.data?.filter(r => r.status === 'error') || [];
      if (errors.length > 0) {
        console.warn('Some push notifications failed:', errors);
      }

      const successCount = result.data?.filter(r => r.status === 'ok').length || 0;
      
      Alert.alert(
        'Success',
        `Notification sent successfully to ${successCount} device${successCount !== 1 ? 's' : ''}!${
          errors.length > 0 ? `\n\n${errors.length} notification${errors.length !== 1 ? 's' : ''} failed to send.` : ''
        }`,
        [{ text: 'OK', onPress: onClose }]
      );

      resetForm();

    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Error', 'Failed to send notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getRecipientSummary = () => {
    const typeGroups = selectedUserTypes.map(type => {
      const count = selectedUsers.filter(u => u.role === type).length;
      const typeName = userTypes.find(ut => ut.type === type)?.label || type;
      return `${count} ${typeName}`;
    });
    
    return typeGroups.join(', ');
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Push Notification</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'compose' && styles.activeTab]}
            onPress={() => setActiveTab('compose')}
          >
            <Ionicons 
              name="create-outline" 
              size={20} 
              color={activeTab === 'compose' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'compose' && styles.activeTabText]}>
              Compose
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recipients' && styles.activeTab]}
            onPress={() => setActiveTab('recipients')}
          >
            <Ionicons 
              name="people-outline" 
              size={20} 
              color={activeTab === 'recipients' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'recipients' && styles.activeTabText]}>
              Recipients ({selectedUsers.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'preview' && styles.activeTab]}
            onPress={() => setActiveTab('preview')}
          >
            <Ionicons 
              name="eye-outline" 
              size={20} 
              color={activeTab === 'preview' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'preview' && styles.activeTabText]}>
              Preview
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'compose' && (
            <View style={styles.composeTab}>
              {/* Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Notification Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter notification title..."
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                />
                <Text style={styles.characterCount}>{title.length}/100</Text>
              </View>

              {/* Message Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Message *</Text>
                <TextInput
                  style={[styles.textInput, styles.messageInput]}
                  placeholder="Enter your notification message..."
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.characterCount}>{message.length}/500</Text>
              </View>

              {/* Priority Settings */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Priority Settings</Text>
                
                <View style={styles.priorityContainer}>
                  <View style={styles.urgentToggle}>
                    <Text style={styles.urgentLabel}>Mark as Urgent</Text>
                    <Switch
                      value={isUrgent}
                      onValueChange={setIsUrgent}
                      trackColor={{ false: '#767577', true: '#F44336' }}
                      thumbColor={isUrgent ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                  
                  {!isUrgent && (
                    <View style={styles.priorityOptions}>
                      <Text style={styles.subLabel}>Normal Priority</Text>
                      <View style={styles.priorityButtons}>
                        {['low', 'normal', 'high'].map(p => (
                          <TouchableOpacity
                            key={p}
                            style={[
                              styles.priorityButton,
                              priority === p && styles.activePriorityButton
                            ]}
                            onPress={() => setPriority(p)}
                          >
                            <Text style={[
                              styles.priorityButtonText,
                              priority === p && styles.activePriorityButtonText
                            ]}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {activeTab === 'recipients' && (
            <View style={styles.recipientsTab}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                  <Text style={styles.loadingText}>Loading users...</Text>
                </View>
              ) : (
                <>
                  {/* User Type Selection */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Select by User Type</Text>
                    {userTypes.map(userType => (
                      <TouchableOpacity
                        key={userType.type}
                        style={styles.userTypeOption}
                        onPress={() => handleUserTypeToggle(userType.type)}
                      >
                        <View style={styles.userTypeInfo}>
                          <Text style={styles.userTypeLabel}>{userType.label}</Text>
                          <Text style={styles.userTypeCount}>
                            {userType.count} user{userType.count !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={[
                          styles.checkbox,
                          userType.selected && styles.checkedCheckbox
                        ]}>
                          {userType.selected && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Individual User Selection */}
                  <View style={styles.section}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => setShowUserList(!showUserList)}
                    >
                      <Text style={styles.sectionTitle}>Individual Users</Text>
                      <Ionicons 
                        name={showUserList ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color="#666" 
                      />
                    </TouchableOpacity>
                    
                    {showUserList && (
                      <View style={styles.userList}>
                        {users.map(user => (
                          <TouchableOpacity
                            key={user.id}
                            style={styles.userOption}
                            onPress={() => handleIndividualUserToggle(user)}
                          >
                            <View style={styles.userInfo}>
                              <Text style={styles.userName}>{user.name}</Text>
                              <Text style={styles.userEmail}>
                                {user.email} • {user.role}
                              </Text>
                            </View>
                            <View style={[
                              styles.checkbox,
                              selectedUsers.some(su => su.id === user.id) && styles.checkedCheckbox
                            ]}>
                              {selectedUsers.some(su => su.id === user.id) && (
                                <Ionicons name="checkmark" size={16} color="#fff" />
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          {activeTab === 'preview' && (
            <View style={styles.previewTab}>
              {/* Notification Preview */}
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Notification Preview</Text>
                <View style={styles.notificationPreview}>
                  <View style={styles.previewHeader}>
                    <Ionicons name="school" size={24} color="#2196F3" />
                    <Text style={styles.appName}>VidyaSetu</Text>
                    <Text style={styles.previewTime}>now</Text>
                  </View>
                  <Text style={styles.previewTitle}>{title || 'Notification Title'}</Text>
                  <Text style={styles.previewMessage}>
                    {message || 'Your notification message will appear here...'}
                  </Text>
                  {isUrgent && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>URGENT</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Recipients Summary */}
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryLabel}>Recipients</Text>
                <Text style={styles.summaryText}>
                  {selectedUsers.length === 0 ? 
                    'No recipients selected' : 
                    `${selectedUsers.length} recipients: ${getRecipientSummary()}`
                  }
                </Text>
              </View>

              {/* Settings Summary */}
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryLabel}>Settings</Text>
                <Text style={styles.summaryText}>
                  Priority: {isUrgent ? 'URGENT' : priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Send Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (sending || !title.trim() || !message.trim() || selectedUsers.length === 0) && 
              styles.disabledSendButton
            ]}
            onPress={sendNotification}
            disabled={sending || !title.trim() || !message.trim() || selectedUsers.length === 0}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
            <Text style={styles.sendButtonText}>
              {sending ? 'Sending...' : `Send to ${selectedUsers.length} recipient${selectedUsers.length !== 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  composeTab: {},
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  messageInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  priorityContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  urgentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  urgentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  priorityOptions: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  subLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  activePriorityButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  priorityButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activePriorityButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  recipientsTab: {},
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  userTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  userTypeInfo: {},
  userTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userTypeCount: {
    fontSize: 14,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  userList: {
    marginTop: 12,
  },
  userOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  userInfo: {},
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
  },
  previewTab: {},
  previewContainer: {
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  notificationPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
  },
  previewTime: {
    fontSize: 12,
    color: '#666',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  previewMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  urgentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledSendButton: {
    backgroundColor: '#ccc',
    shadowColor: 'transparent',
    elevation: 0,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
});

export default PushNotificationManager;
