import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Alert, Keyboard, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as Animatable from 'react-native-animatable';

const TeacherChat = () => {
  const [selectedParent, setSelectedParent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const flatListRef = useRef(null);
  const { user } = useAuth();

  // Get teacher user ID from linked_teacher_id
  const getParentUserId = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('linked_parent_of', studentId)
        .single();
      
      if (error) {
        console.log('Error getting parent user ID:', error);
        return null;
      }
      return data?.id;
    } catch (err) {
      console.log('Error in getParentUserId:', err);
      return null;
    }
  };

  // Fetch parents and chat data
  const fetchParentsAndChats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get teacher info from users table
      const { data: userInfo, error: userError } = await supabase
        .from('users')
        .select('linked_teacher_id')
        .eq('id', user.id)
        .single();

      if (userError || !userInfo?.linked_teacher_id) {
        throw new Error('Teacher information not found');
      }

      const teacherId = userInfo.linked_teacher_id;

      // Get all messages for this teacher
      const { data: allMessages, error: messagesError } = await supabase
        .from(TABLES.MESSAGES)
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('sent_at', { ascending: true });

      if (messagesError && messagesError.code !== '42P01') {
        console.log('Messages error:', messagesError);
      }

      // Group messages by parent (sender/receiver)
      const messagesByParent = {};
      if (allMessages) {
        allMessages.forEach(msg => {
          const parentUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!messagesByParent[parentUserId]) {
            messagesByParent[parentUserId] = [];
          }
          messagesByParent[parentUserId].push({
            id: msg.id,
            message: msg.message,
            sender_id: msg.sender_id,
            receiver_id: msg.receiver_id,
            sent_at: msg.sent_at,
            student_id: msg.student_id,
            attachment_url: msg.attachment_url,
            attachment_type: msg.attachment_type
          });
        });
      }

      // Get students from classes this teacher teaches
      const { data: teacherClasses, error: classError } = await supabase
        .from('timetable_entries')
        .select(`
          class_id,
          classes(id, class_name, section)
        `)
        .eq('teacher_id', teacherId);

      if (classError) {
        console.log('Class error:', classError);
      }

      // Get unique class IDs
      const classIds = [...new Set(teacherClasses?.map(tc => tc.class_id) || [])];

      // Get students from these classes
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          roll_no,
          class_id,
          parent_id,
          classes(class_name, section)
        `)
        .in('class_id', classIds);

      if (studentsError) {
        console.log('Students error:', studentsError);
      }

      // Get parent information for each student
      let allParents = [];
      if (students) {
        for (const student of students) {
          if (student.parent_id) {
            // Get parent user info
            const { data: parentUser, error: parentUserError } = await supabase
              .from('users')
              .select('id, full_name, email')
              .eq('id', student.parent_id)
              .single();

            if (!parentUserError && parentUser) {
              const existingParent = allParents.find(p => p.userId === parentUser.id);
              if (existingParent) {
                // Add student to existing parent
                existingParent.students.push({
                  id: student.id,
                  name: student.name,
                  roll_no: student.roll_no,
                  class: `${student.classes?.class_name} ${student.classes?.section}`
                });
              } else {
                // Add new parent
                allParents.push({
                  id: student.parent_id,
                  userId: parentUser.id,
                  name: parentUser.full_name || parentUser.email,
                  email: parentUser.email,
                  students: [{
                    id: student.id,
                    name: student.name,
                    roll_no: student.roll_no,
                    class: `${student.classes?.class_name} ${student.classes?.section}`
                  }],
                  messages: messagesByParent[parentUser.id] || []
                });
              }
            }
          }
        }
      }

      console.log('Final parents array:', allParents);
      setParents(allParents);
    } catch (err) {
      console.error('Error fetching parents and chats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset parent selection and messages on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setSelectedParent(null);
      setMessages([]);
      fetchParentsAndChats();
    }, [])
  );

  // Select a parent and load chat
  const handleSelectParent = (parent) => {
    setSelectedParent(parent);
    setMessages(parent.messages || []);
  };

  // Send a message
  const handleSend = async () => {
    if (!input.trim() || !selectedParent) return;
    
    try {
      console.log('Starting to send message...');
      console.log('User ID:', user.id);
      console.log('Selected Parent:', selectedParent);

      // Create message for the messages table
      const newMsg = {
        sender_id: user.id,
        receiver_id: selectedParent.userId,
        student_id: selectedParent.students[0]?.id, // Use first student if multiple
        message: input,
        sent_at: new Date().toISOString(),
      };

      console.log('Message to insert:', newMsg);

      const { data: insertedMsg, error: sendError } = await supabase
        .from('messages')
        .insert(newMsg)
        .select();

      if (sendError) {
        console.error('Send error:', sendError);
        throw sendError;
      }

      console.log('Message sent successfully:', insertedMsg);

      // Create display message
      const displayMsg = {
        id: insertedMsg[0].id,
        message: input,
        sender_id: user.id,
        receiver_id: selectedParent.userId,
        sent_at: new Date().toISOString(),
        student_id: selectedParent.students[0]?.id
      };

      setMessages(prev => [...prev, displayMsg]);
      setInput('');

      // Scroll to bottom after sending
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      Alert.alert('Error', `Failed to send message: ${err.message || 'Unknown error'}`);
    }
  };

  // Back to parent list
  const handleBack = () => {
    setSelectedParent(null);
    setMessages([]);
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingMessageId(messageId);
              
              const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

              if (error) throw error;

              setMessages(prev => prev.filter(msg => msg.id !== messageId));
            } catch (err) {
              console.error('Error deleting message:', err);
              Alert.alert('Error', 'Failed to delete message');
            } finally {
              setDeletingMessageId(null);
            }
          }
        }
      ]
    );
  };

  // Send broadcast message to all parents
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim() || parents.length === 0) {
      Alert.alert('Error', 'Please enter a message and ensure you have students assigned.');
      return;
    }

    try {
      setSendingBroadcast(true);

      // Create messages for all parents
      const messagesToSend = parents.map(parent => ({
        sender_id: user.id,
        receiver_id: parent.userId,
        student_id: parent.students[0]?.id, // Use first student if multiple
        message: broadcastMessage,
        sent_at: new Date().toISOString(),
      }));

      // Send all messages
      const { data: insertedMessages, error: sendError } = await supabase
        .from('messages')
        .insert(messagesToSend)
        .select();

      if (sendError) {
        console.error('Broadcast send error:', sendError);
        throw sendError;
      }

      console.log('Broadcast messages sent successfully:', insertedMessages);

      // Update local state for each parent
      setParents(prevParents =>
        prevParents.map(parent => ({
          ...parent,
          messages: [
            ...parent.messages,
            {
              id: insertedMessages.find(msg => msg.receiver_id === parent.userId)?.id,
              message: broadcastMessage,
              sender_id: user.id,
              receiver_id: parent.userId,
              sent_at: new Date().toISOString(),
              student_id: parent.students[0]?.id
            }
          ]
        }))
      );

      setBroadcastMessage('');
      setShowBroadcastModal(false);
      Alert.alert('Success', `Message sent to ${parents.length} parent(s) successfully!`);

    } catch (err) {
      console.error('Error sending broadcast message:', err);
      Alert.alert('Error', `Failed to send broadcast message: ${err.message || 'Unknown error'}`);
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Sort parents by recent messages
  const getSortedParents = () => {
    return parents.sort((a, b) => {
      const aLastMsg = a.messages[a.messages.length - 1];
      const bLastMsg = b.messages[b.messages.length - 1];
      
      if (!aLastMsg && !bLastMsg) return 0;
      if (!aLastMsg) return 1;
      if (!bLastMsg) return -1;
      
      return new Date(bLastMsg.sent_at) - new Date(aLastMsg.sent_at);
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Chat With Parents" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Chat With Parents" showBack={true} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchParentsAndChats}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Chat With Parents" showBack={true} />
      {!selectedParent ? (
        <View style={styles.parentListContainer}>
          <Text style={styles.sectionTitle}>
            Student Parents ({parents.length})
          </Text>
          {parents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No parents found for your students.</Text>
            </View>
          ) : (
            <FlatList
              data={getSortedParents()}
              keyExtractor={item => item.userId}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.parentCard} onPress={() => handleSelectParent(item)}>
                  <Ionicons name="person-circle" size={36} color="#1976d2" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.parentName}>{item.name}</Text>
                    <Text style={styles.studentInfo}>
                      {item.students.map(s => `${s.name} (${s.class})`).join(', ')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="chatbubbles" size={22} color="#9c27b0" />
                    {item.messages && item.messages.length > 0 && (
                      <Text style={styles.messageCount}>{item.messages.length}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            />
          )}

          {/* Floating Action Button for Broadcast Message */}
          {parents.length > 0 && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowBroadcastModal(true)}
            >
              <Ionicons name="megaphone" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={handleBack} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#1976d2" />
            </TouchableOpacity>
            <Ionicons name="person-circle" size={32} color="#1976d2" style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.parentName}>{selectedParent.name}</Text>
              <Text style={styles.studentInfo}>
                {selectedParent.students.map(s => s.name).join(', ')}
              </Text>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={[...messages]}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onLongPress={() => {
                  if (item.sender_id === user.id) {
                    handleDeleteMessage(item.id);
                  }
                }}
                delayLongPress={500}
                activeOpacity={0.7}
                style={{
                  opacity: deletingMessageId === item.id ? 0.5 : 1,
                  transform: [{ scale: deletingMessageId === item.id ? 0.95 : 1 }]
                }}
              >
                <Animatable.View
                  style={[styles.messageRow, item.sender_id === user.id ? styles.messageRight : styles.messageLeft]}
                  animation="fadeInUp"
                  duration={300}
                >
                  <View style={[styles.messageBubble, item.sender_id === user.id ? styles.bubbleTeacher : styles.bubbleParent]}>
                    {deletingMessageId === item.id && (
                      <Animatable.View
                        style={styles.deletingOverlay}
                        animation="fadeIn"
                        duration={200}
                      >
                        <ActivityIndicator size="small" color="#fff" />
                        <Ionicons name="trash" size={16} color="#fff" style={{ marginLeft: 5 }} />
                      </Animatable.View>
                    )}
                    <Text style={styles.messageText}>{item.message}</Text>
                    <Text style={styles.messageTime}>{formatTime(item.sent_at)}</Text>
                  </View>
                </Animatable.View>
              </TouchableOpacity>
            )}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: 16 }}
            onLayout={() => {
              setTimeout(() => {
                if (flatListRef.current && messages.length > 0) {
                  flatListRef.current.scrollToEnd({ animated: false });
                }
              }, 50);
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.broadcastModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Message All Parents</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage('');
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.broadcastInfo}>
              This message will be sent to all {parents.length} parent(s) of your students.
            </Text>

            <TextInput
              style={styles.broadcastInput}
              placeholder="Type your message to all parents..."
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendButton, (!broadcastMessage.trim() || sendingBroadcast) && styles.sendButtonDisabled]}
                onPress={handleSendBroadcast}
                disabled={!broadcastMessage.trim() || sendingBroadcast}
              >
                {sendingBroadcast ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.sendButtonText}>Send to All</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#f44336', textAlign: 'center', marginVertical: 16 },
  retryButton: { backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  parentListContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', margin: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  parentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, elevation: 2 },
  parentName: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  studentInfo: { fontSize: 14, color: '#666' },
  messageCount: { fontSize: 10, color: '#9c27b0', marginTop: 2, fontWeight: 'bold' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageLeft: { justifyContent: 'flex-start' },
  messageRight: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleTeacher: { backgroundColor: '#e3f2fd', alignSelf: 'flex-end' },
  bubbleParent: { backgroundColor: '#f1f8e9', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#222' },
  messageTime: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' },
  deletingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(244, 67, 54, 0.8)', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 10, fontSize: 16 },
  sendBtn: { backgroundColor: '#1976d2', borderRadius: 20, padding: 10, justifyContent: 'center', alignItems: 'center' },

  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Broadcast Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  broadcastModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: '90%',
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  broadcastInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
  },
  broadcastInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default TeacherChat;
