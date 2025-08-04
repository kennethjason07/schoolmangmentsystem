import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator, Alert, Keyboard, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as Animatable from 'react-native-animatable';

const ChatWithTeacher = () => {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const flatListRef = useRef(null);
  const { user } = useAuth();

  // Helper function to get teacher's user ID
  const getTeacherUserId = async (teacherId) => {
    try {
      const { data: teacherUser } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('linked_teacher_id', teacherId)
        .single();
      return teacherUser?.id;
    } catch (error) {
      console.log('Error getting teacher user ID:', error);
      return null;
    }
  };

  // Fetch teachers and chat data
  const fetchTeachersAndChats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get parent's student data directly
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select(`
          linked_parent_of,
          students!users_linked_parent_of_fkey(
            id,
            name,
            class_id,
            classes(id, class_name, section)
          )
        `)
        .eq('id', user.id)
        .single();

      if (parentError || !parentUser?.linked_parent_of) {
        throw new Error('Parent data not found');
      }

      // Get student details from the linked student
      const studentData = parentUser.students;
      if (!studentData) {
        throw new Error('Student data not found');
      }

      // First, get all messages for this parent
      const { data: allMessages, error: messagesError } = await supabase
        .from(TABLES.MESSAGES)
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('sent_at', { ascending: true });

      if (messagesError && messagesError.code !== '42P01') {
        console.log('Messages error:', messagesError);
      }

      // Group messages by teacher (the other participant in the conversation)
      const messagesByTeacher = {};
      if (allMessages) {
        allMessages.forEach(msg => {
          const teacherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
          if (!messagesByTeacher[teacherId]) {
            messagesByTeacher[teacherId] = [];
          }
          // Format message for display
          const formattedMsg = {
            ...msg,
            text: msg.message,
            timestamp: new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender: msg.sender_id === user.id ? 'parent' : 'teacher',
            type: 'text'
          };
          messagesByTeacher[teacherId].push(formattedMsg);
        });
      }

      // Get teachers for the student's class
      // Method 1: Get class teacher directly
      const { data: classData, error: classError } = await supabase
        .from(TABLES.CLASSES)
        .select(`
          class_teacher_id,
          teachers!classes_class_teacher_id_fkey(id, name)
        `)
        .eq('id', studentData.class_id)
        .single();

      let allTeachers = [];

      // Add class teacher if exists
      if (classData?.teachers) {
        const teacherUserId = await getTeacherUserId(classData.teachers.id);
        allTeachers.push({
          id: classData.teachers.id,
          userId: teacherUserId,
          name: classData.teachers.name,
          subject: 'Class Teacher',
          messages: messagesByTeacher[teacherUserId] || []
        });
      }

      // Method 2: Get subject teachers with proper joins
      const { data: subjectTeachers, error: subjectError } = await supabase
        .from(TABLES.TEACHER_SUBJECTS)
        .select(`
          teacher_id,
          teachers!teacher_subjects_teacher_id_fkey(id, name),
          subjects!teacher_subjects_subject_id_fkey(id, name, class_id)
        `)
        .eq('subjects.class_id', studentData.class_id);

      console.log('Subject Teachers Data:', subjectTeachers);

      // Add subject teachers
      if (subjectTeachers) {
        for (const assignment of subjectTeachers) {
          if (assignment.teachers && assignment.subjects) {
            const teacherUserId = await getTeacherUserId(assignment.teachers.id);
            const existingTeacher = allTeachers.find(t => t.id === assignment.teachers.id);
            
            if (!existingTeacher) {
              allTeachers.push({
                id: assignment.teachers.id,
                userId: teacherUserId,
                name: assignment.teachers.name,
                subject: assignment.subjects.name, // Use actual subject name
                messages: messagesByTeacher[teacherUserId] || []
              });
            } else {
              // If teacher already exists and is not class teacher, add subject
              if (existingTeacher.subject === 'Class Teacher') {
                existingTeacher.subject = `Class Teacher (${assignment.subjects.name})`;
              } else {
                existingTeacher.subject = `${existingTeacher.subject}, ${assignment.subjects.name}`;
              }
            }
          }
        }
      }

      // Fallback: Try alternative method if no teachers found
      if (allTeachers.length === 0) {
        const { data: altTeachers, error: altError } = await supabase
          .from(TABLES.TEACHERS)
          .select('id, name')
          .eq('assigned_class_id', studentData.class_id);
        
        if (altTeachers && altTeachers.length > 0) {
          allTeachers = altTeachers.map(teacher => ({
            id: teacher.id,
            name: teacher.name,
            subject: 'Class Teacher',
            messages: messagesByTeacher[teacher.id] || []
          }));
        }
      }

      console.log('Final teachers array:', allTeachers);
      setTeachers(allTeachers);
    } catch (err) {
      console.error('Error fetching teachers and chats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset teacher selection and messages on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setSelectedTeacher(null);
      setMessages([]);
      fetchTeachersAndChats();
    }, [])
  );

  // Select a teacher and load chat
  const handleSelectTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setMessages(teacher.messages || []);
  };

  // Send a message
  const handleSend = async () => {
    if (!input.trim() || !selectedTeacher) return;
    
    try {
      console.log('Starting to send message...');
      console.log('User ID:', user.id);
      console.log('Selected Teacher:', selectedTeacher);

      // Get parent's linked student ID directly from users table
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select('linked_parent_of')
        .eq('id', user.id)
        .single();

      console.log('Parent User Data:', parentUser);
      console.log('Parent Error:', parentError);

      if (parentError || !parentUser?.linked_parent_of) {
        throw new Error('Parent data not found or no student linked');
      }

      // Get teacher's user ID from the users table
      const { data: teacherUser, error: teacherError } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('linked_teacher_id', selectedTeacher.id)
        .single();

      console.log('Teacher User Data:', teacherUser);
      console.log('Teacher Error:', teacherError);

      if (teacherError || !teacherUser) {
        throw new Error('Teacher user account not found');
      }

      // Create message for the messages table
      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUser.id, // Use teacher's user ID, not teacher table ID
        student_id: parentUser.linked_parent_of,
        message: input,
        sent_at: new Date().toISOString(),
      };

      console.log('Message to insert:', newMsg);
      console.log('Table name being used:', TABLES.MESSAGES);

      const { data: insertedMsg, error: sendError } = await supabase
        .from('messages')
        .insert(newMsg)
        .select();

      console.log('Insert result:', insertedMsg);
      console.log('Insert error:', sendError);
      console.log('Insert error code:', sendError?.code);
      console.log('Insert error message:', sendError?.message);
      console.log('Insert error details:', sendError?.details);

      if (sendError) {
        console.error('Supabase error object:', JSON.stringify(sendError, null, 2));
        throw new Error(`Database error: ${sendError.message || sendError.code || 'Unknown database error'}`);
      }

      if (!insertedMsg || insertedMsg.length === 0) {
        throw new Error('Message was not inserted successfully');
      }

      // Add message to local state for immediate display
      const displayMsg = {
        id: Date.now().toString(),
        sender_id: user.id,
        receiver_id: teacherUser.id,
        message: input,
        text: input, // Add this for compatibility with render
        sent_at: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
        sender: 'parent' // Add this for the render logic
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
      console.error('Error details:', JSON.stringify(err, null, 2));
      Alert.alert('Error', `Failed to send message: ${err.message || 'Unknown error'}`);
    }
  };

  // Attachment handler
  const handleAttach = async () => {
    Alert.alert(
      'Select Attachment',
      'Choose what you want to attach',
      [
        {
          text: 'Photos',
          onPress: handleImageUpload
        },
        {
          text: 'Documents',
          onPress: handleDocumentUpload
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // Handle image upload with database save
  const handleImageUpload = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // For now, create local message (you can add Supabase storage later)
        const newMsg = {
          id: Date.now().toString(),
          sender_id: user.id,
          receiver_id: selectedTeacher.userId,
          message: '📷 Photo',
          message_type: 'image',
          file_url: asset.uri, // Local URI for now
          file_name: asset.fileName || 'image.jpg',
          file_size: asset.fileSize || 0,
          file_type: 'image/jpeg',
          sent_at: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'parent'
        };
        
        setMessages(prev => [...prev, newMsg]);
        
        // TODO: Save to database with actual file upload
        // await sendFileMessage(newMsg);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image: ' + e.message);
    }
  };

  // Handle document upload with database save
  const handleDocumentUpload = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        const newMsg = {
          id: Date.now().toString(),
          sender_id: user.id,
          receiver_id: selectedTeacher.userId,
          message: `📎 ${file.name}`,
          message_type: 'file',
          file_url: file.uri, // Local URI for now
          file_name: file.name,
          file_size: file.size || 0,
          file_type: file.mimeType || 'application/octet-stream',
          sent_at: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'parent'
        };
        
        setMessages(prev => [...prev, newMsg]);
        
        // TODO: Save to database with actual file upload
        // await sendFileMessage(newMsg);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick document: ' + e.message);
    }
  };

  // Send file message to database
  const sendFileMessage = async (fileData) => {
    try {
      // Get parent's linked student ID
      const { data: parentUser, error: parentError } = await supabase
        .from(TABLES.USERS)
        .select('linked_parent_of')
        .eq('id', user.id)
        .single();

      if (parentError || !parentUser?.linked_parent_of) {
        throw new Error('Parent data not found');
      }

      // Get teacher's user ID
      const { data: teacherUser, error: teacherError } = await supabase
        .from(TABLES.USERS)
        .select('id')
        .eq('linked_teacher_id', selectedTeacher.id)
        .single();

      if (teacherError || !teacherUser) {
        throw new Error('Teacher user account not found');
      }

      // Create message with file data
      const newMsg = {
        sender_id: user.id,
        receiver_id: teacherUser.id,
        student_id: parentUser.linked_parent_of,
        message: fileData.message_type === 'image' ? '📷 Photo' : `📎 ${fileData.file_name}`,
        message_type: fileData.message_type,
        file_url: fileData.file_url,
        file_name: fileData.file_name,
        file_size: fileData.file_size,
        file_type: fileData.file_type,
        sent_at: new Date().toISOString(),
      };

      const { data: insertedMsg, error: sendError } = await supabase
        .from('messages')
        .insert(newMsg)
        .select();

      if (sendError) throw sendError;

      // Add to local state for immediate display
      const displayMsg = {
        ...newMsg,
        id: insertedMsg[0].id,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'parent'
      };

      setMessages(prev => [...prev, displayMsg]);

    } catch (error) {
      console.error('Error sending file message:', error);
      Alert.alert('Error', 'Failed to send file: ' + error.message);
    }
  };

  // Go back to teacher list
  const handleBack = () => {
    setSelectedTeacher(null);
    setMessages([]);
  };

  // Sort teachers by most recent chat (latest message timestamp)
  const getSortedTeachers = () => {
    return [...teachers].sort((a, b) => {
      const aMsgs = a.messages || [];
      const bMsgs = b.messages || [];
      const aTime = aMsgs.length ? new Date(aMsgs[aMsgs.length - 1].created_at) : new Date(0);
      const bTime = bMsgs.length ? new Date(bMsgs[bMsgs.length - 1].created_at) : new Date(0);
      return bTime - aTime;
    });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [messages]);

  // Auto-scroll when keyboard opens
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, [messages]);

  // Delete message function
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
              
              // Delete from database
              const { error } = await supabase
                .from(TABLES.MESSAGES)
                .delete()
                .eq('id', messageId);

              if (error) throw error;

              // Remove from local state with animation
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== messageId));
                
                // Update teacher's messages as well
                setTeachers(prev => prev.map(teacher => {
                  if (teacher.id === selectedTeacher.id) {
                    return {
                      ...teacher,
                      messages: teacher.messages.filter(msg => msg.id !== messageId)
                    };
                  }
                  return teacher;
                }));
                
                setDeletingMessageId(null);
              }, 500);

            } catch (error) {
              console.error('Error deleting message:', error);
              setDeletingMessageId(null);
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Chat With Teacher" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading teachers...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Chat With Teacher" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTeachersAndChats}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Chat With Teacher" showBack={true} />
      {!selectedTeacher ? (
        <View style={styles.teacherListContainer}>
          <Text style={styles.sectionTitle}>Your Child's Teachers</Text>
          {teachers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No teachers found for your child's class.</Text>
            </View>
          ) : (
            <FlatList
              data={getSortedTeachers()}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.teacherCard} onPress={() => handleSelectTeacher(item)}>
                  <Ionicons name="person-circle" size={36} color="#1976d2" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teacherName}>{item.name}</Text>
                    <Text style={styles.teacherSubject}>{item.subject || 'Teacher'}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="chatbubbles" size={22} color="#9c27b0" />
                    {item.messages && item.messages.length > 0 && (
                      <Text style={styles.messageCount}>{item.messages.length}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 16 }}
            />
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
              <Text style={styles.teacherName}>{selectedTeacher.name}</Text>
              <Text style={styles.teacherSubject}>{selectedTeacher.subject}</Text>
            </View>
          </View>
          
          <FlatList
            ref={flatListRef}
            data={[...messages]}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onLongPress={() => {
                  if (item.sender === 'parent' || item.sender_id === user.id) {
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
                  style={[styles.messageRow, (item.sender === 'parent' || item.sender_id === user.id) ? styles.messageRight : styles.messageLeft]}
                  animation="fadeInUp"
                  duration={300}
                >
                  <View style={[styles.messageBubble, (item.sender === 'parent' || item.sender_id === user.id) ? styles.bubbleParent : styles.bubbleTeacher]}>
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
                    
                    {/* Image Messages */}
                    {item.message_type === 'image' && item.file_url && (
                      <TouchableOpacity onPress={() => {
                        // Open image in full screen
                        Alert.alert('Image', 'Image viewer coming soon');
                      }}>
                        <Image 
                          source={{ uri: item.file_url }} 
                          style={styles.chatImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                    
                    {/* File Messages */}
                    {item.message_type === 'file' && (
                      <TouchableOpacity 
                        style={styles.fileContainer}
                        onPress={() => {
                          if (item.file_url) {
                            Linking.openURL(item.file_url).catch(() => {
                              Alert.alert('Error', 'Cannot open this file');
                            });
                          }
                        }}
                      >
                        <View style={styles.fileRow}>
                          <Ionicons name="document" size={24} color="#1976d2" />
                          <View style={styles.fileInfo}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {item.file_name || 'Document'}
                            </Text>
                            {item.file_size && (
                              <Text style={styles.fileSize}>
                                {item.file_size > 1024 * 1024 
                                  ? `${(item.file_size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(item.file_size / 1024).toFixed(1)} KB`
                                }
                              </Text>
                            )}
                          </View>
                          <Ionicons name="download" size={20} color="#666" />
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {/* Text Messages */}
                    {(!item.message_type || item.message_type === 'text') && (
                      <Text style={[styles.messageText, { opacity: deletingMessageId === item.id ? 0.3 : 1 }]}>
                        {item.text || item.message}
                      </Text>
                    )}
                    
                    <Text style={[styles.messageTime, { opacity: deletingMessageId === item.id ? 0.3 : 1 }]}>
                      {item.timestamp || (item.sent_at ? new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                    </Text>
                  </View>
                </Animatable.View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.chatList}
            style={{ flex: 1 }}
            onContentSizeChange={() => {
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 50);
            }}
            onLayout={() => {
              setTimeout(() => {
                if (flatListRef.current && messages.length > 0) {
                  flatListRef.current.scrollToEnd({ animated: false });
                }
              }, 50);
            }}
          />
          
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttach}>
              <Ionicons name="attach" size={22} color="#1976d2" />
            </TouchableOpacity>
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
      {/* WhatsApp-style Attachment Menu with Animations */}
      {showAttachmentMenu && (
        <Animatable.View 
          style={styles.attachmentOverlay}
          animation="fadeIn"
          duration={200}
        >
          <TouchableOpacity 
            style={styles.attachmentBackdrop} 
            onPress={() => setShowAttachmentMenu(false)}
            activeOpacity={1}
          />
          <Animatable.View 
            style={styles.attachmentMenu}
            animation="slideInUp"
            duration={300}
            delay={100}
          >
            <Animatable.View
              animation="bounceIn"
              delay={200}
              duration={400}
            >
              <TouchableOpacity 
                style={[styles.attachmentOption, { backgroundColor: '#7C4DFF' }]}
                onPress={handleDocumentUpload}
              >
                <Ionicons name="document" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.attachmentText}>Document</Text>
            </Animatable.View>
            
            <Animatable.View
              animation="bounceIn"
              delay={300}
              duration={400}
            >
              <TouchableOpacity 
                style={[styles.attachmentOption, { backgroundColor: '#FF5722' }]}
                onPress={handleImageUpload}
              >
                <Ionicons name="camera" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.attachmentText}>Photos</Text>
            </Animatable.View>
          </Animatable.View>
        </Animatable.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  teacherListContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1976d2', margin: 16 },
  teacherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, elevation: 2 },
  teacherName: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  teacherSubject: { fontSize: 14, color: '#666' },
  lastMessage: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  messageCount: {
    fontSize: 10,
    color: '#9c27b0',
    marginTop: 2,
    fontWeight: 'bold',
  },
  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  chatList: { flexGrow: 1, justifyContent: 'flex-end', padding: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageLeft: { justifyContent: 'flex-start' },
  messageRight: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleParent: { backgroundColor: '#e3f2fd', alignSelf: 'flex-end' },
  bubbleTeacher: { backgroundColor: '#f1f8e9', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#222' },
  messageTime: { fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderColor: '#eee',
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
  },
  attachBtn: { marginRight: 8 },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, marginRight: 8 },
  sendBtn: { backgroundColor: '#1976d2', borderRadius: 20, padding: 10 },
  chatImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minWidth: 200,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  fileName: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  attachmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 80,
    zIndex: 1000,
  },
  attachmentBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  attachmentMenu: {
    alignItems: 'center',
  },
  attachmentOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  attachmentText: {
    color: '#fff',
    fontSize: 10,
    marginTop: -5,
    marginBottom: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ChatWithTeacher; 
